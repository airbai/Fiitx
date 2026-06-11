const codingSignals = [
  "代码",
  "项目",
  "文件",
  "目录结构",
  "开发",
  "实现",
  "升级",
  "修复",
  "bug",
  "build",
  "npm",
  "git",
  "app",
  "小程序",
  "网页",
  "组件",
  "接口",
  "脚本",
  "演示",
  "可视化",
  "流程图",
  "表格",
  "html代码形式",
  "html 代码形式"
];

const imageSignals = ["生成图片", "画图", "画一张", "图片", "海报", "logo", "插画", "png", "jpg", "jpeg", "webp", "封面"];
const videoSignals = ["生成视频", "视频", "短视频", "动效", "动画", "mp4", "mov"];
const audioSignals = ["语音", "音频", "配音", "tts", "朗读", "wav", "mp3"];
const htmlSignals = ["html", "网页预览", "页面预览", "iframe"];
const htmlArtifactSignals = ["html代码", "html 代码", "html格式", "html 格式", "html文件", "html 文件", "代码形式", "网页", "网页形式", "页面", "canvas", "css", "javascript", "js", "svg", "交互演示", "演示动画", "教学动画"];
const codeDeliverySignals = ["代码", "脚本", "目录结构", "开发", "实现", "升级", "修复", "bug", "build", "npm", "git", "小程序", "网页", "组件", "接口"].concat(htmlSignals, htmlArtifactSignals);
const continuationSignals = ["这个", "上面", "刚才", "继续", "升级", "修改", "改进", "优化", "参考", "文档", "当前", "已有"];
const providerAliases = [
  { provider: "OpenRouter", aliases: ["openrouter", "open router"] },
  { provider: "硅基流动", aliases: ["硅基流动", "siliconflow", "silicon flow"] },
  { provider: "DeepSeek", aliases: ["deepseek", "deepseek-v4", "deepseek-v4-flash", "deepseek-v4-pro"] },
  { provider: "MiniMax", aliases: ["minimax", "mini max"] },
  { provider: "Kimi", aliases: ["kimi", "moonshot", "月之暗面"] },
  { provider: "清华智谱 GLM", aliases: ["glm", "智谱", "清华智普", "清华智谱"] }
];

function includesAny(text, signals) {
  return signals.some((signal) => text.includes(signal.toLowerCase()));
}

function detectProvider(text) {
  const matched = providerAliases.find((item) => item.aliases.some((alias) => text.includes(alias.toLowerCase())));
  return matched?.provider || "";
}

function scoreSignals(text, signals, weight = 1) {
  return signals.reduce((score, signal) => text.includes(signal.toLowerCase()) ? score + weight : score, 0);
}

function detectTaskKind(text, modality, isCoding) {
  if (isCoding && /html|网页|canvas|svg|演示动画|教学动画|交互演示/.test(text)) {
    return "html-artifact";
  }
  if (isCoding && /微信|小程序/.test(text)) {
    return "miniapp-coding";
  }
  if (isCoding && /修复|bug|报错|失败/.test(text)) {
    return "fix";
  }
  if (["image", "video", "audio"].includes(modality)) {
    return `${modality}-generation`;
  }
  return isCoding ? "coding" : "chat";
}

function detectModality(text, options = {}) {
  if (options.preferCodeArtifact && includesAny(text, htmlArtifactSignals.concat(htmlSignals))) {
    return "html";
  }
  if (options.preferCodeArtifact) {
    return "text";
  }
  if (includesAny(text, videoSignals)) {
    return "video";
  }
  if (includesAny(text, audioSignals)) {
    return "audio";
  }
  if (includesAny(text, imageSignals)) {
    return "image";
  }
  if (includesAny(text, htmlSignals)) {
    return "html";
  }
  return "text";
}

function routeIntent(payload) {
  const prompt = String(payload?.prompt || "");
  const normalizedPrompt = prompt.toLowerCase();
  const promptWithoutUrls = normalizedPrompt.replace(/https?:\/\/\S+/gi, " ");
  const hasUrl = /https?:\/\/\S+/i.test(prompt);
  const hasAttachment = Array.isArray(payload?.attachments) && payload.attachments.length > 0;
  const hasExplicitCodingSignal =
    hasAttachment ||
    includesAny(promptWithoutUrls, codingSignals) ||
    includesAny(promptWithoutUrls, htmlSignals) ||
    includesAny(promptWithoutUrls, htmlArtifactSignals);
  const hasCodeDeliverySignal = hasAttachment || includesAny(promptWithoutUrls, codeDeliverySignals);
  const codingScore =
    scoreSignals(promptWithoutUrls, codingSignals, 2) +
    scoreSignals(promptWithoutUrls, htmlArtifactSignals, 4) +
    scoreSignals(promptWithoutUrls, codeDeliverySignals, 1) +
    (hasAttachment ? 6 : 0);
  const mediaScore =
    scoreSignals(promptWithoutUrls, imageSignals, 2) +
    scoreSignals(promptWithoutUrls, videoSignals, 2) +
    scoreSignals(promptWithoutUrls, audioSignals, 2);
  const modality = detectModality(promptWithoutUrls, { preferCodeArtifact: hasCodeDeliverySignal });
  const preferredProvider = detectProvider(promptWithoutUrls);
  const isMediaGeneration = ["image", "video", "audio"].includes(modality) && !hasCodeDeliverySignal && mediaScore >= codingScore;
  const threadContext = payload?.threadContext || {};
  const hasArtifactTarget = Boolean(
    threadContext.currentTarget ||
    threadContext.lastArtifact ||
    threadContext.selectedFile ||
    (Array.isArray(threadContext.artifacts) && threadContext.artifacts.length > 0) ||
    (Array.isArray(threadContext.executionArtifacts) && threadContext.executionArtifacts.length > 0)
  );
  const hasWorkspaceOnly = Boolean(threadContext.activeThread?.workspacePath);
  const channelId = String(payload?.channelId || payload?.channelContext?.channelId || "");
  const replyStyle = String(payload?.channelContext?.replyStyle || "");
  const isConversationalChannel = /wechat|clawbot|miniprogram/i.test(channelId) || /wechat|mini-program/i.test(replyStyle);
  const isContinuationCoding = (
    (hasUrl && (hasArtifactTarget || hasWorkspaceOnly)) ||
    (!isConversationalChannel && hasArtifactTarget && continuationSignals.some((signal) => promptWithoutUrls.includes(signal.toLowerCase())))
  );
  const isCoding =
    !isMediaGeneration && (
    hasAttachment ||
    modality === "html" ||
    hasExplicitCodingSignal ||
    codingScore >= 3 ||
    isContinuationCoding
    );
  const taskKind = detectTaskKind(promptWithoutUrls, modality, isCoding);

  return {
    mode: isCoding ? "coding" : "chat",
    modality,
    taskKind,
    confidence: Math.min(1, Math.max(0.25, (isCoding ? codingScore : mediaScore || 1) / 12)),
    codingScore,
    mediaScore,
    preferredProvider,
    reason: [
      isCoding ? "输入包含代码/项目/文件相关意图" : "输入更像普通对话或问答",
      modality !== "text" ? `识别到 ${modality} 任务` : "",
      hasExplicitCodingSignal && ["image", "video", "audio"].includes(modality) ? "明确要求代码交付，跳过媒体生成" : "",
      taskKind ? `任务类型 ${taskKind}` : "",
      preferredProvider ? `用户点名 ${preferredProvider}` : "",
      isContinuationCoding ? "结合线程上下文识别为 coding continuation" : ""
    ].filter(Boolean).join("；")
  };
}

module.exports = {
  routeIntent
};
