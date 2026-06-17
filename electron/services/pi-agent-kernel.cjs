const { createAgentExecutorSession, supportsNativeAgentLoop } = require("./agent-executor.cjs");

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

let piModulesPromise;

async function loadPiModules() {
  if (!piModulesPromise) {
    piModulesPromise = Promise.all([
      import("@earendil-works/pi-agent-core"),
      import("@earendil-works/pi-ai")
    ]).then(([agentCore, piAi]) => ({
      Agent: agentCore.Agent,
      createAssistantMessageEventStream: piAi.createAssistantMessageEventStream
    }));
  }

  return piModulesPromise;
}

function textContentToText(content) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      if (block.type === "image") {
        return `[image:${block.mimeType}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function messageToText(message) {
  if (message.role === "user") {
    return `User:\n${textContentToText(message.content)}`;
  }

  if (message.role === "assistant") {
    const text = message.content
      .map((block) => {
        if (block.type === "text") {
          return block.text;
        }
        if (block.type === "thinking") {
          return `<thinking>${block.thinking}</thinking>`;
        }
        return `[tool:${block.name}] ${JSON.stringify(block.arguments)}`;
      })
      .join("\n");
    return `Assistant:\n${text}`;
  }

  return `Tool ${message.toolName}:\n${textContentToText(message.content)}`;
}

function contextToPrompt(context) {
  return context.messages.map(messageToText).join("\n\n");
}

function createPiModel(profile, payload) {
  return {
    id: profile?.model || payload.model || "fiitx-model",
    // Fiitx branding kept for easy restore:
    // name: profile?.model || payload.model || "Fiitx Model",
    name: profile?.model || payload.model || "Deepsix Model",
    api: "fiitx-openai-compatible",
    provider: profile?.provider || "fiitx",
    baseUrl: profile?.baseUrl || "",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: profile?.contextWindow || 64000,
    maxTokens: 4096
  };
}

function createAssistantMessage(text, profile, payload, stopReason = "stop", errorMessage) {
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

function createUserMessage(text) {
  return {
    role: "user",
    content: text ? [{ type: "text", text }] : [],
    timestamp: Date.now()
  };
}

function createExternalContextMessage(payload) {
  const prompt = payload.externalContext?.prompt;
  if (!prompt) {
    return null;
  }

  return {
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
    fiitxContextKind: "external-url"
  };
}

function createThreadContextMessage(payload) {
  const prompt = payload.threadContextPrompt;
  if (!prompt) {
    return null;
  }

  return {
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
    fiitxContextKind: "thread-semantic"
  };
}

function createChannelContextMessage(payload) {
  const prompt = payload.channelAdapterPrompt;
  if (!prompt) {
    return null;
  }

  return {
    role: "user",
    content: [{ type: "text", text: prompt }],
    timestamp: Date.now(),
    fiitxContextKind: "channel-adapter"
  };
}

function createInitialMessages(payload, profile) {
  return (payload.contextMessages || [])
    .filter((message) => message?.content && ["user", "assistant"].includes(message.role))
    .slice(-20)
    .map((message) =>
      message.role === "user"
        ? createUserMessage(message.content)
        : createAssistantMessage(message.content, profile, payload)
    );
}

function createStreamFn({ createAssistantMessageEventStream, modelRouter, profile, payload }) {
  return (_model, context, options) => {
    const stream = createAssistantMessageEventStream();

    queueMicrotask(async () => {
      const partial = createAssistantMessage("", profile, payload);
      stream.push({ type: "start", partial });
      stream.push({ type: "text_start", contentIndex: 0, partial });

      try {
        const text = await modelRouter.callChat(profile, contextToPrompt(context), {
          systemPrompt: context.systemPrompt,
          timeoutMs: options?.timeoutMs || 180000,
          signal: options?.signal
        });
        const finalMessage = createAssistantMessage(text, profile, payload);
        stream.push({
          type: "text_delta",
          contentIndex: 0,
          delta: text,
          partial: finalMessage
        });
        stream.push({
          type: "text_end",
          contentIndex: 0,
          content: text,
          partial: finalMessage
        });
        stream.push({
          type: "done",
          reason: "stop",
          message: finalMessage
        });
        stream.end(finalMessage);
      } catch (error) {
        const aborted = options?.signal?.aborted;
        const message = error instanceof Error ? error.message : "模型调用失败";
        const finalMessage = createAssistantMessage("", profile, payload, aborted ? "aborted" : "error", message);
        stream.push({
          type: "error",
          reason: aborted ? "aborted" : "error",
          error: finalMessage
        });
        stream.end(finalMessage);
      }
    });

    return stream;
  };
}

function assistantMessageToText(message) {
  return (message?.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function runPiAgentTurn({ payload, profile, modelRouter, systemPrompt, userPrompt, emitProgress }) {
  const session = await createPiAgentSession({
    payload,
    profile,
    modelRouter,
    systemPrompt,
    emitProgress
  });

  return session.prompt(userPrompt);
}

async function createPiAgentSession({
  payload,
  profile,
  modelRouter,
  systemPrompt,
  emitProgress = () => undefined,
  toolRuntime,
  toolRegistry,
  policyGate,
  sessionLogStore,
  telemetryStore,
  signal
}) {
  if (
    payload?.intent?.mode === "coding" &&
    payload?.enableToolCalling !== false &&
    profile?.supportsTools !== false &&
    toolRuntime &&
    policyGate &&
    typeof modelRouter.callChatMessages === "function"
  ) {
    const agentLoopMode = supportsNativeAgentLoop(profile) ? "原生Agent Loop" : "外部调度框架（AgentExecutor）";
    emitProgress({
      status: "running",
      title: "Agent Loop",
      detail: `${agentLoopMode} — ${profile.provider} / ${profile.model}`
    });

    return createAgentExecutorSession({
      payload,
      profile,
      modelRouter,
      systemPrompt,
      toolRegistry,
      toolRuntime,
      policyGate,
      sessionLogStore,
      telemetryStore,
      emitProgress,
      signal
    });
  }

  const { Agent, createAssistantMessageEventStream } = await loadPiModules();
  const externalContextMessage = createExternalContextMessage(payload);
  const threadContextMessage = createThreadContextMessage(payload);
  const channelContextMessage = createChannelContextMessage(payload);
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: createPiModel(profile, payload),
      tools: [],
      messages: createInitialMessages(payload, profile),
      thinkingLevel: "off"
    },
    streamFn: createStreamFn({
      createAssistantMessageEventStream,
      modelRouter,
      profile,
      payload
    }),
    transformContext: async (messages, signal) => {
      if (signal?.aborted) {
        return messages;
      }
      const injected = [];
      if (threadContextMessage) {
        injected.push(threadContextMessage);
      }
      if (channelContextMessage) {
        injected.push(channelContextMessage);
      }
      if (externalContextMessage) {
        injected.push(externalContextMessage);
      }
      if (injected.length === 0) {
        return messages;
      }
      emitProgress({
        status: "running",
        title: "transformContext",
        detail: [
          threadContextMessage ? "线程语义上下文" : "",
          channelContextMessage ? "通道上下文" : "",
          externalContextMessage ? "外部文档上下文" : ""
        ].filter(Boolean).join(" + ")
      });
      return [
        ...injected,
        ...messages
      ];
    },
    steeringMode: "all",
    followUpMode: "one-at-a-time",
    toolExecution: "sequential",
    sessionId: payload.threadId || payload.taskId
  });

  let finalText = "";
  let errorMessage = "";
  let running = false;

  function toResult() {
    return {
      ok: !errorMessage,
      summary: finalText || errorMessage || "模型没有返回内容",
      errorMessage,
      transcript: agent.state.messages
    };
  }

  agent.subscribe((event) => {
    if (event.type === "agent_start") {
      running = true;
    }

    if (event.type === "agent_end") {
      running = false;
    }

    if (event.type === "turn_start") {
      emitProgress({
        status: "running",
        title: "正在思考",
        detail: "已进入 pi-agent-core 通用消息循环。"
      });
    }

    if (event.type === "message_start" && event.message.role === "assistant") {
      emitProgress({
        status: "running",
        title: "正在生成回答",
        detail: `${profile.provider} / ${profile.model}`
      });
    }

    if (event.type === "message_end" && event.message.role === "assistant") {
      finalText = assistantMessageToText(event.message);
      errorMessage = event.message.errorMessage || "";
    }
  });

  async function runActiveTurn(action) {
    running = true;
    try {
      await action();
    } catch (error) {
      const aborted = agent.signal?.aborted;
      errorMessage = aborted ? "用户已停止当前 Agent 回合。" : error instanceof Error ? error.message : "Agent runtime 执行失败";
    } finally {
      running = false;
    }
    return toResult();
  }

  return {
    get id() {
      return payload.threadId || payload.taskId;
    },
    get running() {
      return running || Boolean(agent.signal && !agent.signal.aborted && agent.state.isStreaming);
    },
    get state() {
      return agent.state;
    },
    prompt(text) {
      return runActiveTurn(() => agent.prompt(text));
    },
    continueTurn() {
      return runActiveTurn(() => agent.continue());
    },
    steer(text) {
      agent.steer(createUserMessage(`用户中途补充：\n${text}`));
      emitProgress({
        status: "running",
        title: "收到中途补充",
        detail: String(text || "").slice(0, 120)
      });
      return {
        ok: true,
        queued: true,
        message: "steer 已进入当前 Agent 回合。"
      };
    },
    followUp(text) {
      agent.followUp(createUserMessage(text));
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
      agent.abort();
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
      if (running || agent.state.isStreaming) {
        return {
          ok: false,
          message: "compact 需要 Agent 空闲后执行。"
        };
      }

      const source = agent.state.messages.map(messageToText).join("\n\n");
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
          // Fiitx branding kept for easy restore:
          // "你负责压缩 Fiitx Agent session 上下文。",
          "你负责压缩 Deepsix Agent session 上下文。",
          "保留用户目标、关键约束、已完成动作、未完成动作、文件路径、审批结果和错误信息。",
          "输出中文摘要，避免丢失可恢复执行所需的信息。",
          customInstructions ? `额外要求：${customInstructions}` : ""
        ].filter(Boolean).join("\n")
      });

      agent.state.messages = [
        createAssistantMessage(`上下文压缩摘要：\n${summary}`, profile, payload)
      ];
      emitProgress({
        status: "success",
        title: "上下文已压缩",
        detail: `保留摘要 ${summary.length} 字。`
      });

      return {
        ok: true,
        summary,
        messageCount: agent.state.messages.length
      };
    },
    waitForIdle() {
      return agent.waitForIdle();
    },
    toResult
  };
}

module.exports = {
  createPiAgentSession,
  runPiAgentTurn
};
