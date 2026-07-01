const defaultProfileSeeds = [
  {
    id: "default-deepseek-v4-flash",
    provider: "DeepSeek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    envKey: "FIITX_DEEPSEEK_API_KEY",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text"],
    outputModalities: ["text"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: true,
      imageGeneration: false,
      videoGeneration: false,
      audioGeneration: false
    },
    bestFor: ["coding", "research", "vision", "cheap"],
    toolCallStyle: "openai",
    inputCostPer1M: 0.28,
    outputCostPer1M: 0.42,
    expectedLatencyMs: 4500,
    priority: 90
  },
  {
    id: "default-minimax",
    provider: "MiniMax",
    model: "minimax-text-01",
    baseUrl: "https://api.minimax.chat/v1",
    envKey: "FIITX_MINIMAX_API_KEY",
    contextWindow: 100000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text"],
    outputModalities: ["text"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: false,
      imageGeneration: false,
      videoGeneration: false,
      audioGeneration: false
    },
    bestFor: ["writing", "research", "long-context"],
    toolCallStyle: "openai",
    inputCostPer1M: 0.6,
    outputCostPer1M: 1.2,
    expectedLatencyMs: 6500,
    priority: 65
  },
  {
    id: "default-openrouter-auto",
    provider: "OpenRouter",
    model: "openrouter/auto",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "FIITX_OPENROUTER_API_KEY",
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text", "image"],
    outputModalities: ["text", "video"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: true,
      imageGeneration: false,
      videoGeneration: true,
      audioGeneration: false
    },
    bestFor: ["coding", "research", "vision", "video", "long-context"],
    toolCallStyle: "openai",
    inputCostPer1M: 1,
    outputCostPer1M: 2,
    expectedLatencyMs: 7500,
    priority: 55
  },
  {
    id: "default-siliconflow",
    provider: "硅基流动",
    model: "deepseek-ai/DeepSeek-V3",
    baseUrl: "https://api.siliconflow.cn/v1",
    envKey: "FIITX_SILICONFLOW_API_KEY",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text"],
    outputModalities: ["text", "image", "video", "audio"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: false,
      imageGeneration: true,
      videoGeneration: true,
      audioGeneration: true
    },
    bestFor: ["coding", "research", "cheap"],
    toolCallStyle: "openai",
    inputCostPer1M: 0.3,
    outputCostPer1M: 0.6,
    expectedLatencyMs: 5200,
    priority: 80
  },
  {
    id: "default-kimi",
    provider: "Kimi",
    model: "moonshot-v1-128k",
    baseUrl: "https://api.moonshot.cn/v1",
    envKey: "FIITX_KIMI_API_KEY",
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text"],
    outputModalities: ["text"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: false,
      imageGeneration: false,
      videoGeneration: false,
      audioGeneration: false
    },
    bestFor: ["research", "writing", "long-context"],
    toolCallStyle: "openai",
    inputCostPer1M: 1.5,
    outputCostPer1M: 1.5,
    expectedLatencyMs: 6000,
    priority: 70
  },
  {
    id: "default-glm",
    provider: "清华智谱 GLM",
    model: "glm-4-flash",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    envKey: "FIITX_GLM_API_KEY",
    contextWindow: 64000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    inputModalities: ["text"],
    outputModalities: ["text"],
    capabilities: {
      chat: true,
      tools: true,
      streaming: true,
      jsonMode: true,
      imageInput: false,
      imageGeneration: false,
      videoGeneration: false,
      audioGeneration: false
    },
    bestFor: ["research", "writing", "cheap"],
    toolCallStyle: "openai",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.15,
    expectedLatencyMs: 5000,
    priority: 72
  }
];

function normalizeModelName(model) {
  if (!model) {
    return "";
  }

  const normalized = String(model).toLowerCase();
  if (normalized === "openrouter auto" || normalized === "openrouter-auto") {
    return "openrouter/auto";
  }

  if (normalized === "minimax") {
    return "minimax-text-01";
  }

  if (normalized === "kimi") {
    return "moonshot-v1-128k";
  }

  if (normalized === "glm") {
    return "glm-4-flash";
  }

  if (normalized === "deepseek-v4-flash") {
    return "deepseek-v4-flash";
  }

  if (normalized === "deepseek-v4-pro") {
    return "deepseek-v4-pro";
  }

  return model;
}

function endpointForProfile(profile) {
  const baseUrl = (profile?.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
  return `${baseUrl}/chat/completions`;
}

module.exports = {
  defaultProfileSeeds,
  endpointForProfile,
  normalizeModelName
};
