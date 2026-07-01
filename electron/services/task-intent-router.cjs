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
  "html 代码形式",
  "ppt",
  "pptx",
  "幻灯片",
  "演示文稿",
  "官网",
  "网站",
  "素材"
];

const imageSignals = ["生成图片", "画图", "画一张", "图片", "照片", "相片", "图像", "海报", "logo", "插画", "png", "jpg", "jpeg", "webp", "封面"];
const videoSignals = ["生成视频", "视频", "短视频", "动效", "动画", "mp4", "mov"];
const audioSignals = ["语音", "音频", "配音", "tts", "朗读", "wav", "mp3"];
const htmlSignals = ["html", "网页预览", "页面预览", "iframe"];
const htmlArtifactSignals = ["html代码", "html 代码", "html格式", "html 格式", "html文件", "html 文件", "代码形式", "网页", "网页形式", "页面", "canvas", "css", "javascript", "js", "svg", "交互演示", "演示动画", "教学动画"];
const interactiveArtifactSignals = ["小游戏", "游戏", "游览", "漫游", "导览", "场景", "主角", "角色", "npc", "交互", "互动", "three", "3d", "canvas", "地图", "关卡", "像素", "动画", "复古", "页面", "网站"];
const creationSignals = ["做", "制作", "生成", "创建", "搭建", "开发", "实现", "复刻", "仿照", "设计", "输出", "写"];
const codingModeSwitchSignals = ["切换进入编码模式", "切换到编码模式", "进入编码模式", "编码模式", "切换进入coding", "切换到coding", "进入coding", "coding模式", "coding mode", "开发模式"];
const documentArtifactSignals = [
  "ppt",
  "pptx",
  "幻灯片",
  "演示文稿",
  "keynote",
  "word",
  "docx",
  "doc",
  "pdf",
  "报告",
  "文档",
  "合同",
  "协议",
  "模板",
  "条款",
  "标题",
  "素材",
  "官网素材",
  "网站素材",
  "生成文件",
  "写入",
  "保存",
  "导出"
];
const fileTransformSignals = ["base64", "base64形式", "转base64", "转换base64", "编码", "转码"];
const webResearchSignals = ["官网", "网站", "网页", "链接", "url", "抓取", "读取", "参考", "素材"];
const codeDeliverySignals = ["代码", "脚本", "目录结构", "开发", "实现", "升级", "修复", "bug", "build", "npm", "git", "小程序", "网页", "组件", "接口"].concat(htmlSignals, htmlArtifactSignals, documentArtifactSignals);
const continuationSignals = ["这个", "上面", "刚才", "继续", "升级", "修改", "改进", "优化", "参考", "文档", "当前", "已有"];
const contentQuestionSignals = ["解释", "总结", "阅读", "这篇文章", "这个链接", "这个网页", "文档", "网页", "文章", "讲一下", "分析", "是什么", "为什么", "怎么做", "说明"];

function includesAny(text, signals) {
  return signals.some((signal) => text.includes(signal.toLowerCase()));
}

function scoreSignals(text, signals, weight = 1) {
  return signals.reduce((score, signal) => text.includes(signal.toLowerCase()) ? score + weight : score, 0);
}

function detectTaskKind(text, modality, isCoding) {
  if (/(base64|转码|编码)/i.test(text) && /\.(png|jpe?g|webp|gif|svg|pdf|html|md|txt|json|csv|docx?|pptx?|xlsx?|js|ts|tsx|css)\b/i.test(text)) {
    return "file-transform-base64";
  }
  if (isCoding && /ppt|pptx|幻灯片|演示文稿|keynote/.test(text)) {
    return "ppt-artifact";
  }
  if (isCoding && /报告|文档|docx|doc|word|pdf|合同|协议|模板|条款/.test(text)) {
    return "document-artifact";
  }
  if (isCoding && /html|网页|canvas|svg|演示动画|教学动画|交互演示/.test(text)) {
    return "html-artifact";
  }
  if (isCoding && /小游戏|游戏|游览|漫游|导览|场景|主角|角色|npc|交互|互动|three|3d|canvas|地图|关卡|像素|动画/.test(text)) {
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

function detectTaskIntent({ payload, promptWithoutUrls, externalUrls }) {
  const hasUrl = externalUrls.length > 0;
  const hasAttachment = Array.isArray(payload?.attachments) && payload.attachments.length > 0;
  const hasImageAttachment = (payload?.attachments || []).some((attachment) =>
    /image\//i.test(String(attachment?.type || attachment?.mimeType || "")) ||
    /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(String(attachment?.name || attachment?.path || ""))
  );
  const hasNonImageAttachment = hasAttachment && !hasImageAttachment;
  const hasCreationIntent = includesAny(promptWithoutUrls, creationSignals);
  const wantsCodingMode = includesAny(promptWithoutUrls, codingModeSwitchSignals);
  const wantsInteractiveArtifact = hasCreationIntent && includesAny(promptWithoutUrls, interactiveArtifactSignals);
  const referenceDeliveryIntent =
    hasUrl &&
    hasCreationIntent &&
    includesAny(promptWithoutUrls, ["参考", "照着", "仿照", "复刻", "风格", "类似"]);
  const hasExplicitCodingSignal =
    hasNonImageAttachment ||
    includesAny(promptWithoutUrls, codingSignals) ||
    includesAny(promptWithoutUrls, htmlSignals) ||
    includesAny(promptWithoutUrls, htmlArtifactSignals) ||
    includesAny(promptWithoutUrls, documentArtifactSignals) ||
    wantsCodingMode ||
    wantsInteractiveArtifact ||
    referenceDeliveryIntent;
  const hasCodeDeliverySignal = hasNonImageAttachment || includesAny(promptWithoutUrls, codeDeliverySignals);
  const wantsFileTransform = includesAny(promptWithoutUrls, fileTransformSignals) &&
    /\.(png|jpe?g|webp|gif|svg|pdf|html|md|txt|json|csv|docx?|pptx?|xlsx?|js|ts|tsx|css)\b/i.test(promptWithoutUrls);
  const wantsHtmlEmbed = wantsFileTransform &&
    /\.html?\b/i.test(promptWithoutUrls) &&
    /(放到|写入|替换|替换为|src|img|html|内嵌|嵌入|data uri|data-uri)/i.test(promptWithoutUrls);
  const needsExternalArtifact = hasUrl && (
    includesAny(promptWithoutUrls, documentArtifactSignals) ||
    referenceDeliveryIntent ||
    includesAny(promptWithoutUrls, webResearchSignals) && /做|生成|制作|创建|搭建|实现|复刻|仿照|设计|输出|整理|升级|改|写|ppt|报告|文档|素材/.test(promptWithoutUrls)
  );
  const codingScore =
    scoreSignals(promptWithoutUrls, codingSignals, 2) +
    scoreSignals(promptWithoutUrls, htmlArtifactSignals, 4) +
    scoreSignals(promptWithoutUrls, interactiveArtifactSignals, wantsInteractiveArtifact ? 3 : 1) +
    scoreSignals(promptWithoutUrls, documentArtifactSignals, 4) +
    (wantsFileTransform ? 8 : 0) +
    scoreSignals(promptWithoutUrls, codeDeliverySignals, 1) +
    (hasNonImageAttachment ? 6 : 0) +
    (wantsCodingMode ? 9 : 0) +
    (wantsInteractiveArtifact ? 7 : 0) +
    (referenceDeliveryIntent ? 7 : 0) +
    (needsExternalArtifact ? 7 : 0);
  const mediaScore =
    scoreSignals(promptWithoutUrls, imageSignals, 2) +
    scoreSignals(promptWithoutUrls, videoSignals, 2) +
    scoreSignals(promptWithoutUrls, audioSignals, 2);
  const detectedModality = wantsInteractiveArtifact
    ? "html"
    : detectModality(promptWithoutUrls, { preferCodeArtifact: hasCodeDeliverySignal || referenceDeliveryIntent });
  const modality = wantsFileTransform ? "text" : hasImageAttachment && !hasCreationIntent ? "text" : detectedModality;
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
    hasNonImageAttachment ||
    wantsCodingMode ||
    modality === "html" ||
    hasExplicitCodingSignal ||
    needsExternalArtifact ||
    wantsFileTransform ||
    codingScore >= 3 ||
    isContinuationCoding
    );
  const taskKind = detectTaskKind(promptWithoutUrls, modality, isCoding);
  const namespace =
    taskKind === "file-transform-base64" ? "file.transform.base64" :
    taskKind === "ppt-artifact" ? "artifact.ppt.generate" :
    taskKind === "document-artifact" && /pdf/.test(promptWithoutUrls) ? "artifact.pdf.export" :
    taskKind === "document-artifact" ? "artifact.document.generate" :
    taskKind === "html-artifact" ? "artifact.html.generate" :
    taskKind === "miniapp-coding" ? "coding.miniapp" :
    taskKind === "fix" ? "coding.fix" :
    ["image", "video", "audio"].includes(modality) && !isCoding ? `media.${modality}.generate` :
    hasImageAttachment ? "vision.qa" :
    isCoding ? "coding.file_edit" :
    hasUrl && includesAny(promptWithoutUrls, contentQuestionSignals) ? "content.explain.url" :
    "chat.qa";

  return {
    namespace,
    mode: isCoding ? "coding" : "chat",
    modality,
    taskKind,
    confidence: Math.min(1, Math.max(0.25, (isCoding ? codingScore : mediaScore || 1) / 12)),
    codingScore,
    mediaScore,
    hasAttachment,
    hasImageAttachment,
    hasNonImageAttachment,
    wantsCodingMode,
    wantsInteractiveArtifact,
    referenceDeliveryIntent,
    needsExternalArtifact,
    outputAction: wantsHtmlEmbed ? "html.embed_data_uri" : wantsFileTransform ? "file.write_base64" : "",
    isContinuationCoding,
    requiresWorkspace: isCoding,
    requiresExternalContext: hasUrl
  };
}

module.exports = {
  detectTaskIntent
};
