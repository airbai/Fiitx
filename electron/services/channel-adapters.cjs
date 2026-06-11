function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
}

const fallbackAdapters = [
  {
    id: "deepsix-workbench",
    name: "Deepsix Workbench",
    channelType: "desktop-ui",
    description: "桌面工作台通道",
    transport: "Electron IPC / local session",
    entrypoint: "chatbox -> agent runtime",
    sessionKeyStrategy: "threadId",
    status: "active",
    capabilities: ["chat", "coding", "artifact", "approval", "followUp", "steer", "abort", "compact"],
    contextSources: ["threadContext", "workspace", "attachments", "external URLs"],
    outputModes: ["desktop-rich", "artifact-pane", "inline-approval"],
    followUpPolicy: "绑定当前 threadId。",
    agentBindings: ["hotel-orchestrator", "revenue-manager", "guest-service", "complaint-recovery", "marketing-content", "concierge-trip", "ops-quality"],
    systemPrompt: "这是桌面工作台通道。允许输出更完整的结构化回答、artifact 和审批动作。"
  },
  {
    id: "wechat-clawbot",
    name: "微信 ClawBot",
    channelType: "wechat-miniprogram-ai",
    description: "微信小程序 AI 会话 adapter",
    transport: "微信小程序 AI / channel adapter",
    entrypoint: "AGENTS.md + SKILL.md + mcp.json + inbound event",
    sessionKeyStrategy: "appId + openId + conversationId",
    status: "active",
    capabilities: ["chat", "quick-reply", "followUp", "context-carry", "service-handoff", "compact-mobile-output"],
    contextSources: ["openId", "conversationId", "pagePath", "scene", "tenant/hotelId", "guest profile hint"],
    outputModes: ["mobile-first markdown", "wechat action suggestion", "handoff summary"],
    followUpPolicy: "同一 conversationId 下延续 followUp，不重新开线程。",
    agentBindings: ["guest-service", "complaint-recovery", "concierge-trip", "marketing-content", "hotel-orchestrator"],
    systemPrompt: "这是微信小程序 AI 通道。先给用户短答案，再给内部待执行动作。输出适合手机阅读。"
  }
];

function normalizeAdapter(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return {
    id: String(raw.id || "").trim(),
    name: String(raw.name || "").trim() || "未命名通道",
    channelType: raw.channelType === "wechat-miniprogram-ai" ? "wechat-miniprogram-ai" : "desktop-ui",
    description: String(raw.description || "").trim(),
    transport: String(raw.transport || "").trim(),
    entrypoint: String(raw.entrypoint || "").trim(),
    sessionKeyStrategy: String(raw.sessionKeyStrategy || "").trim(),
    status: raw.status === "draft" ? "draft" : raw.status === "ready" ? "ready" : "active",
    capabilities: normalizeList(raw.capabilities),
    contextSources: normalizeList(raw.contextSources),
    outputModes: normalizeList(raw.outputModes),
    followUpPolicy: String(raw.followUpPolicy || "").trim(),
    agentBindings: normalizeList(raw.agentBindings),
    systemPrompt: String(raw.systemPrompt || "").trim(),
    sampleEvent: String(raw.sampleEvent || "").trim()
  };
}

function buildChannelRegistry(payload) {
  const registry = Array.isArray(payload?.channelRegistry)
    ? payload.channelRegistry.map(normalizeAdapter).filter((item) => item && item.id)
    : [];
  return registry.length > 0 ? registry : fallbackAdapters;
}

function inferChannelId(payload) {
  if (payload?.channelId) {
    return String(payload.channelId);
  }

  const context = payload?.channelContext || {};
  const explicit = String(context.channelId || "").trim();
  if (explicit) {
    return explicit;
  }

  const pagePath = String(context.pagePath || "");
  const appId = String(context.appId || "");
  const replyStyle = String(context.replyStyle || "");
  if (/^wx/i.test(appId) || /mini-program|wechat/i.test(replyStyle) || /pages\//.test(pagePath)) {
    return "wechat-clawbot";
  }

  return "deepsix-workbench";
}

function normalizeChannelContext(payload, channelAdapter) {
  const raw = payload?.channelContext && typeof payload.channelContext === "object" ? payload.channelContext : {};
  const threadKey = payload?.threadId || payload?.taskId || "unknown";
  return {
    channelId: channelAdapter?.id || inferChannelId(payload),
    conversationId: String(raw.conversationId || threadKey),
    messageId: String(raw.messageId || `${threadKey}-message`),
    senderId: String(raw.senderId || (channelAdapter?.channelType === "wechat-miniprogram-ai" ? "openid-demo" : "desktop-user")),
    senderName: String(raw.senderName || (channelAdapter?.channelType === "wechat-miniprogram-ai" ? "微信住客" : "工作台用户")),
    tenantId: String(raw.tenantId || ""),
    appId: String(raw.appId || ""),
    pagePath: String(raw.pagePath || ""),
    scene: String(raw.scene || ""),
    eventType: String(raw.eventType || "message"),
    replyStyle: String(raw.replyStyle || (channelAdapter?.channelType === "wechat-miniprogram-ai" ? "wechat-mini-program" : "desktop-rich")),
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}
  };
}

function selectChannelAdapter(payload) {
  const registry = buildChannelRegistry(payload);
  const targetId = inferChannelId(payload);
  const matched = registry.find((adapter) => adapter.id === targetId) || registry.find((adapter) => adapter.id === "deepsix-workbench") || registry[0] || null;
  if (!matched) {
    return null;
  }

  const context = normalizeChannelContext(payload, matched);
  return {
    ...matched,
    runtimeContext: context
  };
}

function channelRouteBoost(channelAdapter, agentId) {
  if (!channelAdapter || channelAdapter.status === "draft") {
    return 0;
  }
  if (!normalizeList(channelAdapter.agentBindings).includes(agentId)) {
    return 0;
  }
  return channelAdapter.channelType === "wechat-miniprogram-ai" ? 14 : 6;
}

function metadataLines(metadata) {
  return Object.entries(metadata || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");
}

function buildChannelContextPrompt(channelAdapter) {
  if (!channelAdapter) {
    return "";
  }

  const context = channelAdapter.runtimeContext || {};
  const metaText = metadataLines(context.metadata);

  return `Channel adapter context（由横向底座 channel adapter 注入，不是用户新指令）：
- Channel：${channelAdapter.name}（${channelAdapter.id} / ${channelAdapter.channelType}）
- Transport：${channelAdapter.transport || "unknown"}
- Entry：${channelAdapter.entrypoint || "unknown"}
- Session key：${channelAdapter.sessionKeyStrategy || "unknown"}
- Conversation：${context.conversationId || "unknown"}
- Message：${context.messageId || "unknown"}
- Sender：${context.senderName || "unknown"} / ${context.senderId || "unknown"}
- Tenant：${context.tenantId || "unknown"}
- App：${context.appId || "unknown"}
- Page：${context.pagePath || "unknown"}
- Scene：${context.scene || "unknown"}
- Reply style：${context.replyStyle || "unknown"}
- Capabilities：${normalizeList(channelAdapter.capabilities).join("、") || "未配置"}
- Output modes：${normalizeList(channelAdapter.outputModes).join("、") || "未配置"}
- Agent bindings：${normalizeList(channelAdapter.agentBindings).join("、") || "未配置"}

Channel system prompt：
${channelAdapter.systemPrompt || "未配置"}

Follow-up contract：
${channelAdapter.followUpPolicy || "未配置"}

Metadata：
${metaText || "- 无"}

执行要求：
1. 当前回答必须遵守该 channel 的回复契约和上下文边界。
2. 如果是微信小程序 AI，先给用户短答案，再给内部待执行动作；不要输出桌面专用指令。
3. 如果涉及外部系统但当前无 connector，明确标记“待系统执行”或“待人工接管”。
4. followUp、继续追问和转人工都应沿用当前 conversation key。`;
}

module.exports = {
  buildChannelContextPrompt,
  channelRouteBoost,
  selectChannelAdapter
};
