const { detectCapabilityIntent } = require("./capability-router.cjs");
const { detectSystemIntent } = require("./system-intent-router.cjs");
const { detectTaskIntent } = require("./task-intent-router.cjs");
const { extractExternalUrlsFromText, stripExternalUrlsFromText } = require("./url-utils.cjs");

const providerAliases = [
  { provider: "OpenRouter", aliases: ["openrouter", "open router"] },
  { provider: "硅基流动", aliases: ["硅基流动", "siliconflow", "silicon flow"] },
  { provider: "DeepSeek", aliases: ["deepseek", "deepseek-v4", "deepseek-v4-flash", "deepseek-v4-pro"] },
  { provider: "MiniMax", aliases: ["minimax", "mini max"] },
  { provider: "Kimi", aliases: ["kimi", "moonshot", "月之暗面"] },
  { provider: "清华智谱 GLM", aliases: ["glm", "智谱", "清华智普", "清华智谱"] }
];

function detectProvider(text) {
  const matched = providerAliases.find((item) => item.aliases.some((alias) => text.includes(alias.toLowerCase())));
  return matched?.provider || "";
}

function detectEntryIntent(payload) {
  const channelId = String(payload?.channelId || payload?.channelContext?.channelId || "fiitx-workbench");
  const channelType = String(payload?.channelAdapter?.channelType || payload?.channelContext?.channelType || "desktop-ui");
  const replyStyle = String(payload?.channelContext?.replyStyle || "");
  const isConversationalChannel = /wechat|clawbot|miniprogram|telegram|slack|discord|whatsapp/i.test(channelId) ||
    /wechat|mini-program|im|mobile/i.test(replyStyle);

  return {
    channelId,
    channelType,
    source: channelType === "desktop-ui" ? "desktop" : "channel",
    conversational: isConversationalChannel,
    deliveryRequired: channelType !== "desktop-ui",
    replyStyle: replyStyle || "default"
  };
}

function buildRouteReason({ isSystemIntent, systemIntent, taskIntent, capabilityIntent, preferredProvider, externalUrls }) {
  return [
    isSystemIntent ? `系统意图 ${systemIntent.namespace}` : `任务意图 ${taskIntent.namespace}`,
    systemIntent.reason && !isSystemIntent ? systemIntent.reason : "",
    taskIntent.mode === "coding" ? "输入包含代码/项目/文件相关意图" : "输入更像普通对话或问答",
    externalUrls.length ? `识别到外部 URL ${externalUrls.length} 个` : "",
    taskIntent.needsExternalArtifact ? "外部资料需要生成交付物" : "",
    taskIntent.modality !== "text" ? `识别到 ${taskIntent.modality} 任务` : "",
    taskIntent.wantsCodingMode ? "用户明确要求进入 coding/编码模式" : "",
    taskIntent.taskKind ? `任务类型 ${taskIntent.taskKind}` : "",
    taskIntent.outputAction ? `输出动作 ${taskIntent.outputAction}` : "",
    capabilityIntent.modelCapability !== "chat" ? `模型能力 ${capabilityIntent.modelCapability}` : "",
    capabilityIntent.localFirst ? "优先本地工具链" : "",
    capabilityIntent.runtime ? `执行运行时 ${capabilityIntent.runtime}` : "",
    preferredProvider ? `用户点名 ${preferredProvider}` : "",
    taskIntent.isContinuationCoding ? "结合线程上下文识别为 coding continuation" : ""
  ].filter(Boolean).join("；");
}

function routeIntent(payload) {
  const prompt = String(payload?.prompt || "");
  const normalizedPrompt = prompt.toLowerCase();
  const externalUrls = extractExternalUrlsFromText(prompt);
  const promptWithoutUrls = stripExternalUrlsFromText(normalizedPrompt);
  const entryIntent = detectEntryIntent(payload);
  const systemIntent = detectSystemIntent({ promptWithoutUrls, hasUrl: externalUrls.length > 0 });
  const taskIntent = detectTaskIntent({ payload, promptWithoutUrls, externalUrls, entryIntent });
  const capabilityIntent = detectCapabilityIntent(taskIntent);
  const preferredProvider = detectProvider(promptWithoutUrls);
  const isSystemIntent = systemIntent.namespace !== "none" && systemIntent.confidence >= 0.85;
  const selectedNamespace = isSystemIntent ? systemIntent.namespace : taskIntent.namespace;

  return {
    routeVersion: "intent-v3",
    entryIntent,
    systemIntent,
    taskIntent,
    capabilityIntent,
    executionPlan: capabilityIntent.executionPlan,
    intentNamespace: selectedNamespace,
    mode: taskIntent.mode,
    modality: taskIntent.modality,
    taskKind: taskIntent.taskKind,
    confidence: Math.max(taskIntent.confidence, isSystemIntent ? systemIntent.confidence : 0),
    codingScore: taskIntent.codingScore,
    mediaScore: taskIntent.mediaScore,
    preferredProvider,
    externalUrls,
    requiresExternalContext: taskIntent.requiresExternalContext,
    requiresWorkspace: taskIntent.requiresWorkspace,
    isSystemIntent,
    reason: buildRouteReason({ isSystemIntent, systemIntent, taskIntent, capabilityIntent, preferredProvider, externalUrls })
  };
}

module.exports = {
  detectCapabilityIntent,
  detectEntryIntent,
  detectProvider,
  detectSystemIntent,
  detectTaskIntent,
  routeIntent
};
