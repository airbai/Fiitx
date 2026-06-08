const { extractFileManifest, removeFileManifest } = require("./file-manifest.cjs");
const { routeIntent } = require("./intent-router.cjs");
const { createPiAgentSession } = require("./pi-agent-kernel.cjs");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWorkspacePrompt(workspace) {
  const fileList = workspace.files
    .slice(0, 120)
    .map((file) => `- ${file.path}${file.text ? "" : " (binary/large)"}`)
    .join("\n");
  const snippets = workspace.snippets
    .map((snippet) => `### ${snippet.path}\n${snippet.content}`)
    .join("\n\n");

  return `工作区：${workspace.root}

文件列表：
${fileList || "- 未发现可读取文件"}

Git diff stat：
${workspace.gitDiffStat || "当前没有未提交 diff stat，或该目录不是 git 仓库。"}

关键文件片段：
${snippets || "没有可读取的文本片段。"}`;
}

function buildRuntimeContext(payload) {
  const runtimeDate = payload.currentDate || new Date().toLocaleString("zh-CN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: payload.timeZone || "Asia/Shanghai"
  });
  const attachments = (payload.attachments || []).map((item) => `- ${item}`).join("\n");

  return `Pi turn context：
- 当前日期时间：${runtimeDate}
- 时区：${payload.timeZone || "Asia/Shanghai"}
- workspace：${payload.workspacePath || "未选择"}
- threadId：${payload.threadId || payload.taskId || "unknown"}
- intent：${payload.intent ? `${payload.intent.mode}/${payload.intent.modality || "text"} ${payload.intent.preferredProvider ? `provider=${payload.intent.preferredProvider}` : ""}` : "未识别"}
- 附件：${attachments || "无"}

上下文原则：
1. 每轮都必须结合 Pi thread history、运行环境和当前用户输入理解任务。
2. 如果用户当前输入是补充、纠正、追问或只提供参数，要回到上一个未解决的问题继续完成。
3. 不要把当前输入当成孤立问题，除非用户明确开启新任务。`;
}

function buildCodingSystemPrompt(payload) {
  return `你是 Fiitx Coding Agent，运行在一个通用 agent kernel 中。

${buildRuntimeContext(payload)}

原则：
1. 你面向 coding 任务，不绑定任何特定项目类型。
2. 基于用户任务和 workspace 上下文工作。
3. 如果只需要分析或计划，直接用中文回答。
4. 如果用户明确要求生成或修改文件，请在说明之后追加一个 fenced block：

\`\`\`fiitx-file-manifest
{
  "projectName": "short-project-folder-name",
  "title": "交付物标题",
  "files": [
    { "path": "app.js", "content": "完整文件内容" }
  ]
}
\`\`\`

manifest 规则：
- files 必须包含完整文件内容，不能用省略号。
- path 必须是相对路径，不能用绝对路径，不能包含 ..。
- 不要臆造已经执行 shell；需要 shell 时列为待执行动作。
- 如果 intent 是 image/video/audio，不要用代码或 base64 文本假装生成媒体；除非你返回真实媒体 URL、data URI 或写入 manifest 的真实媒体/HTML 文件。`;
}

function buildChatSystemPrompt(payload) {
  return `你是 Fiitx Chat Agent，运行在 pi-core 的通用消息循环中。

${buildRuntimeContext(payload)}

回答用户问题，保持清晰、直接、可执行。
不要声称已经读取或修改文件；如果用户转向开发任务，说明需要进入 Coding 模式。
如果 intent 是 image/video/audio：
- 只有在当前模型或工具真实返回媒体 URL、data URI 或文件路径时，才把它作为结果展示。
- 不要用长 base64 文本或代码片段假装已经生成媒体。
- 如果当前没有对应媒体生成 profile/API Key，直接说明需要在模型中心配置具备该能力的 profile。`;
}

function buildLocalSummary(payload, workspace, profile, modelError) {
  const textFileCount = workspace?.files?.filter((file) => file.text).length || 0;
  const topFiles = workspace?.files?.slice(0, 10).map((file) => file.path).join("、");
  const modelLine = profile
    ? `已选择 ${profile.provider} / ${profile.model}。`
    : "尚未找到可用模型 profile。";
  const errorLine = modelError ? `模型调用未完成：${modelError}` : "模型调用未执行，本地扫描已完成。";

  return [
    workspace ? `已完成 workspace 安全扫描。${modelLine}` : modelLine,
    workspace
      ? `共发现 ${workspace.files.length} 个可见文件，其中 ${textFileCount} 个文本文件可用于上下文。`
      : "Chat 模式未扫描 workspace。",
    workspace?.gitDiffStat ? `当前存在 git diff：${workspace.gitDiffStat}` : "当前没有检测到 git diff stat。",
    topFiles ? `关键文件入口：${topFiles}` : "未发现可读取文件。",
    `用户任务：${payload.prompt}`,
    errorLine
  ].join("\n");
}

function fallbackTaskTitle(prompt) {
  const clean = String(prompt || "")
    .replace(/\s+/g, " ")
    .replace(/[，。；;,.!?！？]+$/g, "")
    .trim();
  if (!clean) {
    return "未命名任务";
  }
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean;
}

function fileUrlFromPath(filePath) {
  const normalized = String(filePath || "").split("\\").join("/");
  return `file://${encodeURI(normalized)}`;
}

function createMediaArtifact({ payload, profile, mediaResult, modality }) {
  const localMedia = mediaResult.localMedia || mediaResult.localImage;
  const fileUrl = fileUrlFromPath(localMedia.path);
  const extension = String(localMedia.title || localMedia.path).split(".").pop() || modality;
  const label = modality === "image" ? "图片" : modality === "video" ? "视频" : "音频";
  const markdownMedia =
    modality === "audio"
      ? fileUrl
      : `![${localMedia.title}](${fileUrl})`;
  const preview = [
    `已生成${label}：${payload.prompt}`,
    "",
    markdownMedia,
    "",
    `- Provider：${profile.provider}`,
    `- Model：${mediaResult.model}`,
    `- 本地文件：${localMedia.path}`,
    mediaResult.remoteUrl && !String(mediaResult.remoteUrl).startsWith("data:")
      ? `- 原始 URL：${mediaResult.remoteUrl}`
      : ""
  ].filter(Boolean).join("\n");

  return {
    path: localMedia.path,
    title: localMedia.title,
    language: extension,
    status: "added",
    additions: 1,
    deletions: 0,
    preview
  };
}

async function buildTaskTitle({ payload, profile, modelRouter }) {
  const fallback = fallbackTaskTitle(payload.prompt);
  if (!profile || payload.intent?.modality === "image" || payload.intent?.modality === "video" || payload.intent?.modality === "audio") {
    return fallback;
  }

  try {
    const title = await modelRouter.callChat(profile, payload.prompt, {
      timeoutMs: 12000,
      systemPrompt: "你只负责为用户任务生成一个中文短标题。要求：8到18个汉字以内，不要引号，不要句号，不要解释。"
    });
    return fallbackTaskTitle(title || fallback);
  } catch {
    return fallback;
  }
}

function createApprovalRequest({ payload, action, title, detail, command, requester = "Coding Agent", risk = "medium" }) {
  return {
    id: `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    detail,
    command,
    requester,
    risk,
    action,
    status: "pending"
  };
}

function resolvePolicyMode(payload, action) {
  const policy = payload.policySettings || {};
  const actionMode = policy.actionModes?.[action];
  const sandboxMode = policy.sandboxMode || "workspace-write";
  const permissionMode = payload.permissionMode || policy.defaultPermissionMode || "ask";

  if (permissionMode === "full" && actionMode !== "block") {
    return "full";
  }

  if (permissionMode === "auto" && actionMode !== "block") {
    return "auto";
  }

  if (actionMode) {
    return actionMode;
  }

  if (sandboxMode === "read-only" && action !== "workspace.scan") {
    return "block";
  }

  if (sandboxMode === "danger-full-access") {
    return "full";
  }

  return permissionMode;
}

function authorizeToolAction({ payload, action, title, detail, command, risk = "medium", emitProgress }) {
  const mode = resolvePolicyMode(payload, action);
  if (mode === "block") {
    const approvalRequest = createApprovalRequest({
      payload,
      action,
      title,
      detail: `策略已阻止：${detail}`,
      command,
      risk
    });
    emitProgress({
      status: "warn",
      title: "策略阻止",
      detail: command
    });
    return {
      allowed: false,
      blocked: true,
      approvalRequest,
      toolEvent: {
        actor: "Policy Engine",
        event: "策略阻止工具调用",
        target: command,
        level: "warn"
      }
    };
  }

  if (mode === "full") {
    return {
      allowed: true,
      toolEvent: {
        actor: "Policy Engine",
        event: "完全访问权限",
        target: command,
        level: "success"
      }
    };
  }

  if (mode === "auto") {
    return {
      allowed: true,
      toolEvent: {
        actor: "Policy Engine",
        event: "自动批准工具调用",
        target: command,
        level: "success"
      }
    };
  }

  const approvalRequest = createApprovalRequest({
    payload,
    action,
    title,
    detail,
    command,
    risk
  });
  emitProgress({
    status: "warn",
    title: "等待审批",
    detail: command
  });
  return {
    allowed: false,
    approvalRequest,
    toolEvent: {
      actor: "Policy Engine",
      event: "请求工具审批",
      target: command,
      level: "warn"
    }
  };
}

function createAgentRuntime({ modelRouter, toolRuntime, artifactEngine }) {
  const sessions = new Map();

  function getSessionId(payload = {}) {
    return payload.threadId || payload.sessionId || payload.taskId;
  }

  function getSession(threadId) {
    return sessions.get(threadId);
  }

  function setSession(payload, session) {
    const sessionId = getSessionId(payload);
    if (sessionId) {
      sessions.set(sessionId, session);
    }
  }

  async function createSession({ payload, profile, systemPrompt, emitProgress }) {
    const session = await createPiAgentSession({
      payload,
      profile,
      modelRouter,
      systemPrompt,
      emitProgress
    });
    setSession(payload, session);
    return session;
  }

  async function runAgentTask(payload, emitProgress = () => undefined) {
    async function emitProgressStep(step) {
      emitProgress({
        status: "running",
        ...step
      });
      await delay(45);
    }

    await emitProgressStep({
      title: "接收任务",
      detail: String(payload.prompt || "").slice(0, 100)
    });

    const intent = routeIntent(payload);
    payload.intent = intent;
    let taskTitle = fallbackTaskTitle(payload.prompt);
    await emitProgressStep({
      title: "Intent Router",
      detail: `${intent.mode}：${intent.reason}`
    });

    const profile = modelRouter.resolveModelProfile(payload.model, intent);
    if (profile) {
      await emitProgressStep({
        title: "模型路由",
        detail: `${profile.provider} / ${profile.model}`
      });
    }
    taskTitle = await buildTaskTitle({ payload, profile, modelRouter });
    if (!profile) {
      const summary = buildLocalSummary(payload, null, null, "没有找到可用模型 profile");
      return {
        ok: false,
        summary,
        mode: intent.mode,
        model: payload.model,
        provider: "local",
        title: taskTitle,
        artifact: null,
        toolEvents: [
          {
            actor: "Model Router",
            event: "模型凭据不可用",
            target: payload.model,
            level: "warn"
          }
        ]
      };
    }

    if (["image", "video", "audio"].includes(intent.modality)) {
      const mediaLabel = intent.modality === "image" ? "图片" : intent.modality === "video" ? "视频" : "音频";
      await emitProgressStep({
        title: `${mediaLabel}生成`,
        detail: "按已配置 key 和模型能力自动尝试。"
      });

      try {
        const mediaResult = await modelRouter.callMediaWithFallback(intent, payload.prompt, {
          preferredModel: payload.model,
          timeoutMs: intent.modality === "image" ? 120000 : 600000,
          onAttempt: (candidateProfile) => {
            emitProgress({
              status: "running",
              title: "尝试媒体模型",
              detail: `${candidateProfile.provider} / ${candidateProfile.model}`
            });
          }
        });
        const artifact = createMediaArtifact({ payload, profile: mediaResult.profile || profile, mediaResult, modality: intent.modality });
        const markdownMedia =
          intent.modality === "audio"
            ? fileUrlFromPath(artifact.path)
            : `![${artifact.title}](${fileUrlFromPath(artifact.path)})`;
        const summary = [
          `已生成${mediaLabel}：${payload.prompt}`,
          "",
          markdownMedia,
          "",
          `模型路由：${mediaResult.provider} / ${mediaResult.model}`,
          `本地文件：${artifact.path}`
        ].join("\n");

        emitProgress({
          status: "success",
          title: `${mediaLabel}已生成`,
          detail: artifact.path
        });

        return {
          ok: true,
          summary,
          mode: "chat",
          model: mediaResult.model,
          provider: mediaResult.provider,
          title: taskTitle,
          artifact,
          toolEvents: [
            {
              actor: "Intent Router",
              event: `识别${mediaLabel}生成任务`,
              target: payload.prompt,
              level: "info"
            },
            {
              actor: "Model Router",
              event: `调用${mediaLabel}生成模型`,
              target: `${mediaResult.provider} / ${mediaResult.model}`,
              level: "success"
            },
            {
              actor: "Artifact Engine",
              event: `保存生成${mediaLabel}`,
              target: artifact.path,
              level: "success"
            }
          ]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `${mediaLabel}生成失败`;
        emitProgress({
          status: "warn",
          title: `${mediaLabel}生成失败`,
          detail: message
        });

        return {
          ok: false,
          summary: message,
          mode: "chat",
          model: profile.model,
          provider: profile.provider,
          title: taskTitle,
          artifact: null,
          toolEvents: [
            {
              actor: "Model Router",
              event: `${mediaLabel}生成失败`,
              target: message,
              level: "warn"
            }
          ]
        };
      }
    }

    if (intent.mode === "chat") {
      await emitProgressStep({
        title: "Chat Agent",
        detail: `加载 pi-core thread context：${payload.contextMessages?.length || 0} 条历史消息。`
      });
      const session = await createSession({
        payload,
        profile,
        systemPrompt: buildChatSystemPrompt(payload),
        emitProgress
      });
      const result = await session.prompt(payload.prompt);

      return {
        ok: result.ok,
        summary: result.summary,
        mode: "chat",
        model: profile.model,
        provider: profile.provider,
        title: taskTitle,
        artifact: null,
        toolEvents: [
          {
            actor: "Pi Agent Core",
            event: result.ok ? "chat turn 完成" : "chat turn 失败",
            target: `${profile.provider} / ${profile.model}`,
            level: result.ok ? "success" : "warn"
          }
        ]
      };
    }

    await emitProgressStep({
      title: "策略检查",
      detail: `权限模式：${payload.permissionMode || "ask"}，附件 ${payload.attachments?.length || 0} 个。`
    });

    const scanGate = authorizeToolAction({
      payload,
      action: "workspace.scan",
      title: "允许扫描工作区",
      detail: "Agent 请求读取当前 workspace 文件列表和安全文本片段，用于构建任务上下文。",
      command: `scan "${payload.workspacePath}"`,
      risk: "medium",
      emitProgress
    });
    if (!scanGate.allowed) {
      return {
        ok: false,
        summary: scanGate.blocked ? "策略已阻止：Agent 无法扫描当前 workspace。" : "等待审批：需要允许 Agent 扫描当前 workspace 后才能继续。",
        mode: "coding",
        model: profile.model,
        provider: profile.provider,
        title: taskTitle,
        artifact: null,
        approvalRequests: [scanGate.approvalRequest],
        toolEvents: [scanGate.toolEvent]
      };
    }

    const { workspace, toolEvent: scanEvent } = await toolRuntime.scanWorkspace(payload.workspacePath);
    await emitProgressStep({
      title: "扫描工作区",
      detail: `发现 ${workspace.files.length} 个可见文件，读取 ${workspace.snippets.length} 个非敏感文本片段。`
    });

    let modelError = "";
    let summary = "";
    try {
      await emitProgressStep({
        title: "Pi Agent Core",
        detail: `${profile.provider} / ${modelRouter.normalizeModelName(profile.model)}`
      });
      const session = await createSession({
        payload,
        profile,
        systemPrompt: buildCodingSystemPrompt(payload),
        emitProgress
      });
      const result = await session.prompt(`${payload.prompt}\n\n${buildWorkspacePrompt(workspace)}`);
      summary = result.summary;
      modelError = result.errorMessage || "";
    } catch (error) {
      modelError = error instanceof Error ? error.message : "Pi Agent Core 执行失败";
      emitProgress({
        status: "warn",
        title: "Pi Agent 回退",
        detail: modelError
      });
    }

    if (!summary || modelError) {
      summary = summary || buildLocalSummary(payload, workspace, profile, modelError);
    }

    let artifact = null;
    const toolEvents = [
      scanGate.toolEvent,
      scanEvent,
      {
        actor: "Pi Agent Core",
        event: modelError ? "coding turn 回退" : "coding turn 完成",
        target: `${profile.provider} / ${profile.model}`,
        level: modelError ? "warn" : "success"
      }
    ];

    if (!modelError) {
      try {
        const manifest = extractFileManifest(summary);
        if (manifest) {
          const writeGate = authorizeToolAction({
            payload,
            action: "workspace.write_manifest",
            title: "允许写入文件",
            detail: "模型返回了文件 manifest，请确认是否允许写入 workspace。",
            command: `write ${manifest.files?.length || 0} file(s) to "${workspace.root}"`,
            risk: "high",
            emitProgress
          });
          toolEvents.push(writeGate.toolEvent);
          if (!writeGate.allowed) {
            return {
              ok: false,
              summary: removeFileManifest(summary) || (writeGate.blocked ? "策略已阻止：不允许写入文件。" : "等待审批：需要允许写入文件后才能继续。"),
              mode: "coding",
              model: profile.model,
              provider: profile.provider,
              title: taskTitle,
              artifact: null,
              approvalRequests: [writeGate.approvalRequest],
              toolEvents
            };
          }

          const written = await toolRuntime.writeFileManifest(workspace.root, manifest);
          summary = removeFileManifest(summary);
          artifact = artifactEngine.createGeneratedProjectArtifact({
            projectName: manifest.projectName,
            projectRoot: written.projectRoot,
            relativeFiles: written.relativeFiles,
            title: manifest.title || "Generated Coding Project",
            summary
          });
          toolEvents.push(written.toolEvent);
          emitProgress({
            status: "success",
            title: "写入文件 manifest",
            detail: written.projectRoot
          });
        }
      } catch (error) {
        modelError = error instanceof Error ? error.message : "文件 manifest 解析或写入失败";
        emitProgress({
          status: "warn",
          title: "文件 manifest 失败",
          detail: modelError
        });
      }
    }

    if (!artifact) {
      artifact = artifactEngine.createWorkspaceScanArtifact({
        payload,
        workspace,
        profile,
        summary,
        modelError
      });
    }

    emitProgress({
      status: modelError ? "warn" : "success",
      title: "生成结果 Artifact",
      detail: artifact.path
    });

    return {
      ok: !modelError,
      summary,
      mode: "coding",
      model: profile.model,
      provider: profile.provider,
      title: taskTitle,
      artifact,
      toolEvents: toolEvents.concat({
        actor: "Artifact Engine",
        event: "生成 artifact",
        target: artifact.path,
        level: modelError ? "warn" : "success"
      })
    };
  }

  async function prompt(payload, emitProgress = () => undefined) {
    return runAgentTask(payload, emitProgress);
  }

  function steer(payload, emitProgress = () => undefined) {
    const session = getSession(payload.threadId);
    if (!session) {
      emitProgress({
        status: "warn",
        title: "Steer 失败",
        detail: "当前 thread 没有可接收 steering 的 Agent session。"
      });
      return {
        ok: false,
        message: "当前 thread 没有可接收 steering 的 Agent session。"
      };
    }

    return session.steer(payload.text || payload.prompt || "");
  }

  function followUp(payload, emitProgress = () => undefined) {
    const session = getSession(payload.threadId);
    if (!session) {
      emitProgress({
        status: "warn",
        title: "Follow-up 失败",
        detail: "当前 thread 没有 Agent session。"
      });
      return {
        ok: false,
        message: "当前 thread 没有 Agent session。"
      };
    }

    return session.followUp(payload.text || payload.prompt || "");
  }

  function abort(payload, emitProgress = () => undefined) {
    const session = getSession(payload.threadId);
    if (!session) {
      emitProgress({
        status: "warn",
        title: "Abort 失败",
        detail: "当前 thread 没有正在运行的 Agent session。"
      });
      return {
        ok: false,
        message: "当前 thread 没有正在运行的 Agent session。"
      };
    }

    return session.abort();
  }

  async function continueTurn(payload, emitProgress = () => undefined) {
    const session = getSession(payload.threadId);
    if (!session) {
      emitProgress({
        status: "warn",
        title: "Continue 失败",
        detail: "当前 thread 没有可继续的 Agent session。"
      });
      return {
        ok: false,
        message: "当前 thread 没有可继续的 Agent session。"
      };
    }

    emitProgress({
      status: "running",
      title: "继续执行",
      detail: payload.threadId
    });
    return session.continueTurn();
  }

  async function compact(payload, emitProgress = () => undefined) {
    const session = getSession(payload.threadId);
    if (!session) {
      emitProgress({
        status: "warn",
        title: "Compact 失败",
        detail: "当前 thread 没有可压缩的 Agent session。"
      });
      return {
        ok: false,
        message: "当前 thread 没有可压缩的 Agent session。"
      };
    }

    return session.compact(payload.instructions || "");
  }

  return {
    abort,
    compact,
    continueTurn,
    followUp,
    prompt,
    runAgentTask,
    steer
  };
}

module.exports = {
  createAgentRuntime
};
