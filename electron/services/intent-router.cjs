const codingSignals = [
  "代码",
  "项目",
  "文件",
  "目录结构",
  "开发",
  "实现",
  "生成",
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
  "脚本"
];

const imageSignals = ["生成图片", "画图", "画一张", "图片", "海报", "logo", "插画", "png", "jpg", "jpeg", "webp", "封面"];
const videoSignals = ["生成视频", "视频", "短视频", "动效", "动画", "mp4", "mov"];
const audioSignals = ["语音", "音频", "配音", "tts", "朗读", "wav", "mp3"];
const htmlSignals = ["html", "网页预览", "页面预览", "iframe"];
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

function detectModality(text) {
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
  const hasAttachment = Array.isArray(payload?.attachments) && payload.attachments.length > 0;
  const modality = detectModality(normalizedPrompt);
  const preferredProvider = detectProvider(normalizedPrompt);
  const isMediaGeneration = ["image", "video", "audio"].includes(modality);
  const isCoding =
    !isMediaGeneration && (
    hasAttachment ||
    modality === "html" ||
    codingSignals.some((signal) => normalizedPrompt.includes(signal.toLowerCase()))
    );

  return {
    mode: isCoding ? "coding" : "chat",
    modality,
    preferredProvider,
    reason: [
      isCoding ? "输入包含代码/项目/文件相关意图" : "输入更像普通对话或问答",
      modality !== "text" ? `识别到 ${modality} 任务` : "",
      preferredProvider ? `用户点名 ${preferredProvider}` : ""
    ].filter(Boolean).join("；")
  };
}

module.exports = {
  routeIntent
};
