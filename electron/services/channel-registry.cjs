const fs = require("fs");
const path = require("path");

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
}

function nodeMajor() {
  return Number(String(process.versions.node || "0").split(".")[0] || 0);
}

function packageAvailable(packageName) {
  const packageParts = packageName.startsWith("@") ? packageName.split("/") : [packageName];
  const candidatePackageJsonPaths = [
    path.join(process.cwd(), "node_modules", ...packageParts, "package.json"),
    path.join(__dirname, "..", "..", "node_modules", ...packageParts, "package.json")
  ];

  const packageJsonPath = candidatePackageJsonPaths.find((candidate) => fs.existsSync(candidate));
  if (packageJsonPath) {
    try {
      const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return {
        packageName,
        installed: true,
        resolved: packageJsonPath,
        version: manifest.version || ""
      };
    } catch (error) {
      return {
        packageName,
        installed: true,
        resolved: packageJsonPath,
        error: error instanceof Error ? error.message : "package manifest unreadable"
      };
    }
  }

  try {
    return {
      packageName,
      installed: true,
      resolved: require.resolve(packageName)
    };
  } catch (error) {
    return {
      packageName,
      installed: false,
      error: error instanceof Error ? error.message : "package not installed"
    };
  }
}

function createRuntimeChannel(id, patch = {}) {
  return {
    id,
    name: id,
    channelType: "desktop-ui",
    transport: "unknown",
    entrypoint: "",
    status: "ready",
    runtimeStatus: "available",
    description: "",
    capabilities: [],
    contextSources: [],
    outputModes: [],
    endpoints: [],
    requirements: [],
    warnings: [],
    docs: [],
    ...patch
  };
}

function endpointList(status = {}) {
  return [
    status.healthEndpoint,
    status.bindStartEndpoint,
    status.bindStatusEndpoint,
    status.bindConfirmEndpoint,
    status.messageEndpoint,
    status.actionEndpoint,
    status.deliveryEndpoint,
    status.baseUrl
  ].filter(Boolean);
}

function normalizeAdapterObjects(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === "object" && String(item.id || "").trim());
}

function createChannelRegistry({ wechatChannelServer, vscodeChannelServer, weixinChatChannel } = {}) {
  function getChatSdkStatus() {
    const chatPackage = packageAvailable("chat");
    const statePackage = packageAvailable("@chat-adapter/state-memory");
    const weixinPackage = packageAvailable("chat-adapter-weixin");
    const currentNodeMajor = nodeMajor();
    const weixinNodeOk = currentNodeMajor >= 22;

    return {
      chatPackage,
      statePackage,
      weixinPackage,
      nodeVersion: process.versions.node,
      weixinNodeOk,
      ready: chatPackage.installed && statePackage.installed && weixinPackage.installed && weixinNodeOk,
      warnings: [
        !chatPackage.installed ? "chat SDK 未安装" : "",
        !statePackage.installed ? "@chat-adapter/state-memory 未安装" : "",
        !weixinPackage.installed ? "chat-adapter-weixin 未安装" : "",
        weixinPackage.installed && !weixinNodeOk ? "chat-adapter-weixin 要求 Node >=22，当前 Electron runtime 可能无法直接启动 iLink 长轮询 adapter。" : ""
      ].filter(Boolean)
    };
  }

  function listRuntimeChannels(configuredAdapters = []) {
    const wechatStatus = wechatChannelServer?.getStatus?.() || {};
    const vscodeStatus = vscodeChannelServer?.getStatus?.() || {};
    const weixinStatus = weixinChatChannel?.getStatus?.() || {};
    const chatSdk = getChatSdkStatus();
    const configuredById = new Map(normalizeAdapterObjects(configuredAdapters).map((adapter) => [String(adapter.id), adapter]));
    const weixinConfigured = Boolean(weixinStatus.configured);
    const weixinRunning = Boolean(weixinStatus.running);
    const wechatBinding = weixinStatus.binding || {};
    const hasLegacyHttpBinding = Boolean(wechatStatus.binding?.bound);
    const weixinWarnings = [
      ...chatSdk.warnings,
      ...(Array.isArray(weixinStatus.missing) && weixinStatus.missing.length > 0
        ? [`缺少 ${weixinStatus.missing.join(", ")}`]
        : []),
      hasLegacyHttpBinding && !wechatBinding.bound ? "检测到旧本地 HTTP 绑定；微信 App 收发需要重新扫码完成 iLink 绑定。" : "",
      weixinStatus.lastError ? `启动错误：${weixinStatus.lastError}` : ""
    ].filter(Boolean);

    const channels = [
      createRuntimeChannel("deepsix-workbench", {
        name: "Fiitx Workbench",
        channelType: "desktop-ui",
        transport: "Electron IPC / local session",
        entrypoint: "Chatbox -> Agent Runtime",
        status: "active",
        runtimeStatus: "running",
        description: "Fiitx 桌面工作台默认通道。",
        capabilities: ["chat", "coding", "artifact", "approval", "followUp", "steer", "abort", "compact"],
        contextSources: ["threadContext", "workspace", "attachments", "selected artifact"],
        outputModes: ["desktop-rich", "artifact-pane", "inline-approval"]
      }),
      createRuntimeChannel("wechat-clawbot", {
        name: "微信 ClawBot",
        channelType: "wechat-miniprogram-ai",
        transport: "Weixin iLink long poll + HTTP fallback",
        entrypoint: "Weixin iLink getupdates -> ChannelGateway",
        status: weixinRunning ? "active" : wechatBinding.bound ? "ready" : wechatStatus.running ? "ready" : "draft",
        runtimeStatus: weixinRunning ? "polling" : wechatBinding.bound ? "bound" : wechatStatus.running ? "local-http-only" : "stopped",
        description: "正式 Fiitx runtime 微信通道。微信 App 消息经 iLink 长轮询进入 ChannelGateway，再进入 Agent Runtime、Policy、SessionDB 和 Delivery Queue。",
        endpoints: [
          weixinStatus.baseUrl ? `iLink: ${weixinStatus.baseUrl}` : "",
          weixinStatus.accountId ? `accountId: ${weixinStatus.accountId}` : "",
          ...endpointList(wechatStatus)
        ].filter(Boolean),
        binding: wechatBinding,
        warnings: hasLegacyHttpBinding && !wechatBinding.bound
          ? ["当前只有旧本地 HTTP 绑定记录，没有微信 iLink token。需要重新扫码绑定后，微信 App 消息才会进入 Fiitx。"]
          : [],
        sessionKeyStrategy: weixinRunning ? "iLink from_user_id + session_id" : wechatBinding.bound ? "bound account + conversationId" : "扫码绑定后启用",
        capabilities: ["chat", "coding", "quick-reply", "followUp", "context-carry", "approval", "service-handoff", "delivery-queue"],
        contextSources: ["openId", "conversationId", "pagePath", "scene", "tenantId", "SessionDB"],
        outputModes: ["mobile-first markdown", "wechat action suggestion", "handoff summary", "runtime delivery"]
      }),
      createRuntimeChannel("wechat-ilink", {
        name: "Weixin iLink Adapter",
        channelType: "wechat-miniprogram-ai",
        transport: "vercel/chat + chat-adapter-weixin",
        entrypoint: "Weixin iLink long polling adapter",
        status: weixinRunning ? "active" : chatSdk.ready && weixinConfigured ? "ready" : "draft",
        runtimeStatus: weixinRunning ? "running" : chatSdk.ready && weixinConfigured ? "available" : "blocked",
        description: "兼容 vercel/chat 的 Weixin iLink adapter。配置 token/secret 后可由微信/IM 控制本机 Fiitx。",
        capabilities: ["chat-sdk-adapter", "long-polling", "thread-state", "im-control"],
        contextSources: ["Weixin iLink message", "chat thread", "conversation state"],
        outputModes: ["chat response", "thread reply"],
        requirements: [
          "chat",
          "@chat-adapter/state-memory",
          "chat-adapter-weixin",
          "Node >=22",
          "WEIXIN_ACCOUNT_ID / WEIXIN_BOT_TOKEN / WEIXIN_BASE_URL"
        ],
        warnings: weixinWarnings,
        docs: [
          "https://github.com/vercel/chat",
          "https://github.com/wong2/chat-adapter-weixin"
        ],
        packageStatus: chatSdk,
        endpointStatus: weixinStatus,
        endpoints: [
          weixinStatus.baseUrl ? `iLink: ${weixinStatus.baseUrl}` : "",
          weixinStatus.accountId ? `accountId: ${weixinStatus.accountId}` : "",
          weixinStatus.startedAt ? `startedAt: ${new Date(weixinStatus.startedAt).toISOString()}` : ""
        ].filter(Boolean)
      }),
      createRuntimeChannel("daemon-cron", {
        name: "Fiitx Daemon / Cron",
        channelType: "background-daemon",
        transport: "Electron main process scheduler",
        entrypoint: "Agent Platform Service",
        status: "active",
        runtimeStatus: "running",
        description: "长期运行后台通道，用于定时任务、后台巡检、自动复盘和跨会话触发。",
        capabilities: ["daemon", "cron", "scheduled-task", "profile-isolation", "session-search"],
        contextSources: ["cron prompt", "session log", "profile isolation"],
        outputModes: ["desktop thread", "audit event", "daemon log"]
      }),
      createRuntimeChannel("vscode-deepsix", {
        name: "VS Code Fiitx",
        channelType: "vscode-extension",
        transport: "HTTP / localhost",
        entrypoint: "VS Code extension -> Fiitx channel server",
        status: vscodeStatus.running ? "active" : "ready",
        runtimeStatus: vscodeStatus.running ? "running" : "stopped",
        description: "VS Code 扩展通道，用于代码上下文、inline diff 和文件写入确认。",
        endpoints: endpointList(vscodeStatus),
        capabilities: ["inline-diff", "code-context", "file-write", "diff-accept", "diff-reject"],
        contextSources: ["activeFile", "selection", "openFiles", "diagnostics", "workspaceRoot"],
        outputModes: ["inline-diff-preview", "vscode-notification", "status-bar"]
      }),
      createRuntimeChannel("telegram-bot", {
        name: "Telegram Bot",
        channelType: "telegram",
        transport: "Bot API webhook / polling",
        status: "draft",
        runtimeStatus: "blocked",
        description: "Telegram 远程控制通道预留。配置 bot token 和 webhook 后可接入 Fiitx Agent。",
        capabilities: ["chat", "im-control", "file-upload", "approval"],
        requirements: ["TELEGRAM_BOT_TOKEN", "public webhook or polling daemon"]
      }),
      createRuntimeChannel("slack-bot", {
        name: "Slack App",
        channelType: "slack",
        transport: "Events API / Socket Mode",
        status: "draft",
        runtimeStatus: "blocked",
        description: "Slack 工作区通道预留，可用于团队协作、审批和任务触发。",
        capabilities: ["chat", "slash-command", "approval", "thread-reply"],
        requirements: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET or Socket Mode token"]
      }),
      createRuntimeChannel("discord-bot", {
        name: "Discord Bot",
        channelType: "discord",
        transport: "Gateway / interactions",
        status: "draft",
        runtimeStatus: "blocked",
        description: "Discord Bot 通道预留，用于社区/团队 IM 控制 Fiitx。",
        capabilities: ["chat", "slash-command", "thread-reply"],
        requirements: ["DISCORD_BOT_TOKEN", "application commands"]
      }),
      createRuntimeChannel("whatsapp-business", {
        name: "WhatsApp Business",
        channelType: "whatsapp",
        transport: "Meta Cloud API webhook",
        status: "draft",
        runtimeStatus: "blocked",
        description: "WhatsApp Business 通道预留，面向国际用户的移动 IM 入口。",
        capabilities: ["chat", "mobile-im", "approval"],
        requirements: ["WHATSAPP_ACCESS_TOKEN", "phone number id", "verify token"]
      }),
      createRuntimeChannel("wecom-bot", {
        name: "WeCom Bot",
        channelType: "wecom",
        transport: "企业微信 Bot / callback",
        status: "draft",
        runtimeStatus: "blocked",
        description: "企业微信通道预留，用于公司内部审批、审计和任务触发。",
        capabilities: ["chat", "approval", "enterprise-im"],
        requirements: ["WECOM_CORP_ID", "WECOM_SECRET", "callback URL"]
      })
    ];

    return channels.map((channel) => ({
      ...channel,
      configured: Boolean(configuredById.get(channel.id)),
      configuredAdapter: configuredById.get(channel.id) || null
    }));
  }

  return {
    getChatSdkStatus,
    listRuntimeChannels
  };
}

module.exports = {
  createChannelRegistry
};
