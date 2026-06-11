const {
  AGENT_MESSAGE_TYPES,
  convertToLlm,
  createApprovalMessage,
  createContextMessage,
  createLlmMessage,
  createToolCallMessage,
  createToolResultMessage,
  fromUiContextMessage,
  transformContext
} = require("./agent-messages.cjs");
const { createToolRegistry } = require("./tool-registry.cjs");

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0
  }
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "workspace_ls",
      description: "List files and folders inside the current workspace or a workspace-relative subdirectory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative directory path. Defaults to ." },
          limit: { type: "number", description: "Maximum number of entries to return." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "workspace_read",
      description: "Read a safe text file from the current workspace.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          maxBytes: { type: "number", description: "Maximum bytes to read." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "workspace_write",
      description: "Create or replace a text file inside the current workspace.",
      parameters: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          content: { type: "string", description: "Complete file content." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "workspace_edit",
      description: "Apply an exact string replacement to a text file inside the current workspace.",
      parameters: {
        type: "object",
        required: ["path", "search", "replace"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          search: { type: "string", description: "Exact text to replace." },
          replace: { type: "string", description: "Replacement text." },
          all: { type: "boolean", description: "Replace all occurrences instead of the first match." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "workspace_grep",
      description: "Search workspace text files for a literal or regex pattern.",
      parameters: {
        type: "object",
        required: ["pattern"],
        properties: {
          pattern: { type: "string", description: "Search pattern." },
          path: { type: "string", description: "Workspace-relative file or directory. Defaults to ." },
          maxMatches: { type: "number", description: "Maximum number of matches." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "workspace_find",
      description: "Find files in the workspace by path substring.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Case-insensitive path substring." },
          path: { type: "string", description: "Workspace-relative directory. Defaults to ." },
          maxResults: { type: "number", description: "Maximum number of files." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the current workspace directory.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: { type: "string", description: "Shell command to run." },
          timeoutMs: { type: "number", description: "Optional timeout in milliseconds." }
        }
      }
    }
  }
];

function textToAssistantMessage(text, profile, payload, stopReason = "stop", errorMessage = "") {
  return {
    role: "assistant",
    content: text ? [{ type: "text", text }] : [],
    api: "fiitx-openai-compatible",
    provider: profile?.provider || "fiitx",
    model: profile?.model || payload.model || "fiitx-model",
    usage: EMPTY_USAGE,
    stopReason,
    errorMessage,
    timestamp: Date.now()
  };
}

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }
  return (content || [])
    .map((block) => block?.text || block?.thinking || "")
    .filter(Boolean)
    .join("\n");
}

function contextMessageToOpenAi(message) {
  if (!message?.content || !["user", "assistant"].includes(message.role)) {
    return null;
  }
  return {
    role: message.role,
    content: typeof message.content === "string" ? message.content : contentToText(message.content)
  };
}

function createContextMessages(payload) {
  const messages = [];
  if (payload.threadContextPrompt) {
    messages.push({
      role: "user",
      content: payload.threadContextPrompt,
      name: "thread_context"
    });
  }
  if (payload.channelAdapterPrompt) {
    messages.push({
      role: "user",
      content: payload.channelAdapterPrompt,
      name: "channel_context"
    });
  }
  if (payload.externalContext?.prompt) {
    messages.push({
      role: "user",
      content: payload.externalContext.prompt,
      name: "external_context"
    });
  }
  return messages;
}

function buildToolPolicy(toolName, args) {
  if (["workspace_ls", "workspace_read", "workspace_grep", "workspace_find"].includes(toolName)) {
    return {
      action: "workspace.scan",
      title: "允许读取工作区",
      detail: "Agent 请求读取当前 workspace 的文件列表或文本片段，用于按需构建任务上下文。",
      command: `${toolName} ${JSON.stringify(args)}`,
      risk: "medium"
    };
  }

  if (["workspace_write", "workspace_edit"].includes(toolName)) {
    return {
      action: "workspace.write_manifest",
      title: "允许修改文件",
      detail: "Agent 请求创建或修改 workspace 文件。",
      command: `${toolName} ${JSON.stringify({ ...args, content: args?.content ? `[${String(args.content).length} chars]` : undefined })}`,
      risk: "high"
    };
  }

  return {
    action: "shell.exec",
    title: "允许执行命令",
    detail: "Agent 请求在当前 workspace 中执行 shell 命令。",
    command: args?.command || toolName,
    risk: "high"
  };
}

async function executeTool({ toolName, args, payload, toolRuntime, signal }) {
  if (toolName === "workspace_ls") {
    return toolRuntime.listDirectory(payload.workspacePath, args.path || ".", { limit: args.limit });
  }
  if (toolName === "workspace_read") {
    return toolRuntime.readWorkspaceFile(payload.workspacePath, args.path, { maxBytes: args.maxBytes });
  }
  if (toolName === "workspace_write") {
    return toolRuntime.writeWorkspaceFile(payload.workspacePath, args.path, args.content);
  }
  if (toolName === "workspace_edit") {
    return toolRuntime.editWorkspaceFile(payload.workspacePath, args.path, args);
  }
  if (toolName === "workspace_grep") {
    return toolRuntime.grepWorkspace(payload.workspacePath, args.pattern, {
      path: args.path,
      maxMatches: args.maxMatches
    });
  }
  if (toolName === "workspace_find") {
    return toolRuntime.findWorkspaceFiles(payload.workspacePath, args);
  }
  if (toolName === "bash") {
    return toolRuntime.runShell(payload.workspacePath, args.command, {
      timeoutMs: args.timeoutMs,
      signal
    });
  }
  throw new Error(`未知工具：${toolName}`);
}

function formatToolResult(result) {
  return JSON.stringify(result, null, 2);
}

function latestAssistantText(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }
  return "";
}

function latestCompactSummary(entries = []) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type === "compact" && entry.content) {
      return entry.content;
    }
  }
  return "";
}

function createToolCallingAgentSession({
  payload,
  profile,
  modelRouter,
  systemPrompt,
  toolRuntime,
  toolRegistry,
  policyGate,
  sessionLogStore,
  telemetryStore,
  emitProgress = () => undefined,
  signal
}) {
  const threadId = payload.threadId || payload.taskId || payload.sessionId || "default";
  const registry = toolRegistry || createToolRegistry({ toolRuntime });
  const controller = new AbortController();
  const storedEntries = sessionLogStore?.read(threadId) || [];
  const compactSummary = latestCompactSummary(storedEntries);
  signal?.addEventListener?.("abort", () => controller.abort(), { once: true });
  const initialAgentMessages = [
    createLlmMessage("system", systemPrompt, { kind: "system" }),
    ...(compactSummary
      ? [
          createContextMessage(AGENT_MESSAGE_TYPES.SUMMARY, `Deepsix session compact summary:\n${compactSummary}`, {
            name: "compact_summary"
          })
        ]
      : []),
    ...createContextMessages(payload).map((message) => createContextMessage(AGENT_MESSAGE_TYPES.EXTERNAL_CONTEXT, message.content, {
      role: message.role,
      name: message.name
    })),
    ...(payload.contextMessages || []).slice(-20).map((message) => fromUiContextMessage(message)).filter(Boolean)
  ];
  const messages = convertToLlm(transformContext(initialAgentMessages, { maxMessages: 28 }));
  const state = {
    messages: [],
    isStreaming: false,
    streamingMessage: null,
    pendingToolCalls: [],
    errorMessage: ""
  };
  let running = false;
  let finalText = "";
  let pendingFollowUps = [];
  let currentRunId = "";

  function throwIfAborted() {
    if (controller.signal.aborted || signal?.aborted) {
      throw new Error("用户已停止当前 Agent 回合。");
    }
  }

  function appendLog(entry) {
    if (!sessionLogStore || !threadId) {
      return null;
    }
    return sessionLogStore.append(threadId, entry);
  }

  function pushTranscript(role, content, metadata = {}) {
    if (role === "assistant") {
      state.messages.push(textToAssistantMessage(content, profile, payload, metadata.stopReason || "stop", metadata.errorMessage || ""));
    } else {
      state.messages.push({
        role,
        content: [{ type: "text", text: content }],
        timestamp: Date.now(),
        ...metadata
      });
    }
  }

  async function runLoop(userText, loopKind = "prompt") {
    running = true;
    state.isStreaming = true;
    state.errorMessage = "";
    finalText = "";
    currentRunId = telemetryStore?.startRun?.({
      threadId,
      taskId: payload.taskId,
      intent: payload.intent,
      provider: profile?.provider,
      model: profile?.model,
      channelId: payload.channelAdapter?.id || payload.channelContext?.channelId
    }) || "";
    const localMessages = messages;
    const userMessage = {
      role: "user",
      content: userText
    };
    localMessages.push(userMessage);
    pushTranscript("user", userText);
    appendLog({
      type: "message",
      role: "user",
      content: userText,
      agentMessage: createLlmMessage("user", userText, { loopKind }),
      metadata: { loopKind }
    });

    try {
      for (let turn = 0; turn < 10; turn += 1) {
        throwIfAborted();
        emitProgress({
          status: "running",
          title: turn === 0 ? "正在思考" : "继续推理",
          detail: `${profile.provider} / ${profile.model}`
        });

        const response = await modelRouter.callChatMessages(profile, localMessages, {
          tools: registry.getOpenAiTools(),
          toolChoice: "auto",
          timeoutMs: 180000,
          signal: controller.signal
        });
        throwIfAborted();

        localMessages.push(response.message);
        if (response.content) {
          finalText = response.content;
          pushTranscript("assistant", response.content);
          appendLog({
            type: "message",
            role: "assistant",
            content: response.content,
            metadata: {
              finishReason: response.finishReason,
              model: profile.model,
              provider: profile.provider
            },
            agentMessage: createLlmMessage("assistant", response.content, {
              finishReason: response.finishReason,
              model: profile.model,
              provider: profile.provider
            })
          });
        }

        if (!response.toolCalls.length) {
          break;
        }

        state.pendingToolCalls = response.toolCalls;
        appendLog({
          type: "assistant_tool_calls",
          role: "assistant",
          toolCalls: response.toolCalls.map((call) => ({
            id: call.id,
            name: call.name,
            arguments: call.arguments
          })),
          agentMessages: response.toolCalls.map((call) => createToolCallMessage(call))
        });
        telemetryStore?.append?.({
          runId: currentRunId,
          type: "tool_calls",
          threadId,
          count: response.toolCalls.length,
          tools: response.toolCalls.map((call) => call.name)
        });

        for (const toolCall of response.toolCalls) {
          throwIfAborted();
          const tool = registry.get(toolCall.name);
          const args = tool?.prepareArguments(toolCall.arguments || {}) || toolCall.arguments || {};
          const policy = registry.policy(toolCall.name, args);
          const gate = policyGate({
            payload,
            ...policy,
            emitProgress
          });
          const approvalAgentMessage = gate.approvalRequest ? createApprovalMessage(gate.approvalRequest, {
            toolCallId: toolCall.id,
            toolName: toolCall.name
          }) : null;
          appendLog({
            type: "policy_check",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            allowed: gate.allowed,
            blocked: gate.blocked,
            approvalRequest: gate.approvalRequest || null,
            agentMessage: approvalAgentMessage,
            metadata: { action: policy.action, risk: policy.risk }
          });
          telemetryStore?.append?.({
            runId: currentRunId,
            type: "policy_check",
            threadId,
            toolName: toolCall.name,
            allowed: gate.allowed,
            blocked: gate.blocked,
            risk: policy.risk,
            action: policy.action
          });

          if (!gate.allowed) {
            const message = gate.blocked
              ? `策略已阻止工具调用：${toolCall.name}`
              : `等待审批：需要允许 Agent 执行 ${toolCall.name} 后才能继续。`;
            state.pendingToolCalls = [toolCall];
            state.errorMessage = message;
            appendLog({
              type: "pending_approval",
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: message,
              agentMessage: approvalAgentMessage
            });
            return {
              ok: false,
              summary: message,
              errorMessage: message,
              approvalRequest: gate.approvalRequest || null,
              pendingToolCall: toolCall,
              transcript: state.messages
            };
          }

          emitProgress({
            status: "running",
            title: `执行 ${toolCall.name}`,
            detail: policy.command
          });
          appendLog({
            type: "tool_start",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            arguments: args,
            agentMessage: createToolCallMessage({ ...toolCall, arguments: args })
          });
          telemetryStore?.append?.({
            runId: currentRunId,
            type: "tool_start",
            threadId,
            toolName: toolCall.name
          });

          let toolResult;
          try {
            toolResult = await registry.execute(toolCall.name, args, {
              payload,
              signal: controller.signal
            });
          } catch (error) {
            toolResult = {
              ok: false,
              error: error instanceof Error ? error.message : "工具执行失败"
            };
          }
          const toolContent = formatToolResult(toolResult);
          localMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: toolContent
          });
          pushTranscript("tool", toolContent, {
            toolName: toolCall.name,
            toolCallId: toolCall.id
          });
          appendLog({
            type: "tool_result",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: toolContent,
            agentMessage: createToolResultMessage(toolCall, toolContent)
          });
          telemetryStore?.append?.({
            runId: currentRunId,
            type: "tool_end",
            threadId,
            toolName: toolCall.name,
            ok: toolResult?.ok !== false,
            bytes: toolContent.length
          });
          emitProgress({
            status: "success",
            title: `已执行 ${toolCall.name}`,
            detail: toolContent.slice(0, 160)
          });
        }
        state.pendingToolCalls = [];
      }

      finalText = finalText || latestAssistantText(localMessages) || "Agent 已完成，但模型没有返回可展示文本。";
      return {
        ok: true,
        summary: finalText,
        errorMessage: "",
        transcript: state.messages
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent runtime 执行失败";
      state.errorMessage = message;
      pushTranscript("assistant", "", { stopReason: controller.signal.aborted || signal?.aborted ? "aborted" : "error", errorMessage: message });
      appendLog({
        type: "error",
        role: "assistant",
        content: message,
        agentMessage: createLlmMessage("assistant", message, { stopReason: "error" })
      });
      return {
        ok: false,
        summary: message,
        errorMessage: message,
        transcript: state.messages
      };
    } finally {
      telemetryStore?.finishRun?.(currentRunId, {
        ok: !state.errorMessage,
        mode: payload.intent?.mode,
        provider: profile?.provider,
        model: profile?.model,
        errorMessage: state.errorMessage
      });
      running = false;
      state.isStreaming = false;
    }
  }

  return {
    get id() {
      return threadId;
    },
    get running() {
      return running;
    },
    get state() {
      return state;
    },
    prompt(text) {
      return runLoop(text, "prompt");
    },
    continueTurn() {
      const text = pendingFollowUps.shift() || "继续完成上一个未完成任务。";
      return runLoop(text, "continue");
    },
    steer(text) {
      const steering = `用户中途补充：\n${text}`;
      pendingFollowUps.unshift(steering);
      appendLog({
        type: "steer",
        role: "user",
        content: steering
      });
      emitProgress({
        status: "running",
        title: "收到中途补充",
        detail: String(text || "").slice(0, 120)
      });
      return {
        ok: true,
        queued: true,
        message: "steer 已进入当前 Agent session。"
      };
    },
    followUp(text) {
      pendingFollowUps.push(text);
      appendLog({
        type: "follow_up",
        role: "user",
        content: text
      });
      emitProgress({
        status: "running",
        title: "已加入后续任务",
        detail: String(text || "").slice(0, 120)
      });
      return {
        ok: true,
        queued: true,
        message: "followUp 已加入队列。"
      };
    },
    abort() {
      controller.abort();
      appendLog({
        type: "abort",
        role: "system",
        content: "用户请求停止 Agent。"
      });
      emitProgress({
        status: "warn",
        title: "停止当前回合",
        detail: "用户请求停止 Agent。"
      });
      return {
        ok: true,
        aborted: true
      };
    },
    async compact(customInstructions = "") {
      const entries = sessionLogStore?.read(threadId) || [];
      const source = entries
        .filter((entry) => ["message", "tool_result", "policy_check"].includes(entry.type))
        .map((entry) => `${entry.type}:${entry.role || entry.toolName || "system"}\n${entry.content || JSON.stringify(entry)}`)
        .join("\n\n");
      if (!source.trim()) {
        return {
          ok: true,
          summary: "",
          message: "当前 session 没有可压缩上下文。"
        };
      }
      const summary = await modelRouter.callChat(profile, source, {
        timeoutMs: 60000,
        systemPrompt: [
          "你负责压缩 Deepsix Agent session 上下文。",
          "保留用户目标、关键约束、已完成动作、未完成动作、文件路径、审批结果、工具调用结果和错误信息。",
          "输出中文摘要；原始 JSONL 历史会继续保留，本摘要只用于后续模型上下文。",
          customInstructions ? `额外要求：${customInstructions}` : ""
        ].filter(Boolean).join("\n")
      });
      sessionLogStore?.appendCompact(threadId, summary, { customInstructions });
      messages.splice(1, messages.length - 1, {
        role: "user",
        content: `Deepsix session compact summary:\n${summary}`,
        name: "compact_summary"
      });
      emitProgress({
        status: "success",
        title: "上下文已压缩",
        detail: `JSONL 原始历史保留，摘要 ${summary.length} 字。`
      });
      return {
        ok: true,
        summary,
        messageCount: messages.length
      };
    },
    async waitForIdle() {
      while (running) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    toResult() {
      return {
        ok: !state.errorMessage,
        summary: finalText || state.errorMessage || "模型没有返回内容",
        errorMessage: state.errorMessage,
        transcript: state.messages
      };
    }
  };
}

module.exports = {
  TOOL_DEFINITIONS,
  createToolCallingAgentSession
};
