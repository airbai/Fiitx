const generationCapabilityByModality = {
  image: "imageGeneration",
  video: "videoGeneration",
  audio: "audioGeneration"
};

const providerCapabilityDefaults = [
  {
    provider: "DeepSeek",
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
    }
  },
  {
    provider: "MiniMax",
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
    }
  },
  {
    provider: "Kimi",
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
    }
  },
  {
    provider: "清华智谱 GLM",
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
    }
  },
  {
    provider: "OpenRouter",
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
    }
  },
  {
    provider: "硅基流动",
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
    }
  },
  {
    provider: "SiliconFlow",
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
    }
  },
  {
    provider: "OpenAI-compatible",
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
    }
  }
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function unique(values) {
  return Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function providerMatches(profileProvider, expectedProvider) {
  const left = normalizeText(profileProvider);
  const right = normalizeText(expectedProvider);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function defaultEntryForProvider(provider) {
  return providerCapabilityDefaults.find((entry) => providerMatches(provider, entry.provider)) || null;
}

function modelCapabilityHints(profile, capability) {
  const provider = normalizeText(profile?.provider);
  const model = normalizeText(profile?.model);
  const haystack = `${provider} ${model}`;

  if (capability === "imageInput" || capability === "vision") {
    return [
      "vision",
      "vl",
      "omni",
      "gpt-4o",
      "qwen-vl",
      "glm-4v",
      "gemini",
      "claude-3",
      "minimax-vision"
    ].some((hint) => haystack.includes(hint));
  }

  if (capability === "imageGeneration" || capability === "image") {
    return [
      "image",
      "img",
      "flux",
      "kolors",
      "stable-diffusion",
      "sdxl",
      "dall-e",
      "gpt-image",
      "midjourney",
      "ideogram",
      "janus"
    ].some((hint) => haystack.includes(hint));
  }

  if (capability === "videoGeneration" || capability === "video") {
    return ["video", "wan", "kling", "sora", "hunyuan", "minimax-video", "runway", "veo", "seedance"].some((hint) =>
      haystack.includes(hint)
    );
  }

  if (capability === "audioGeneration" || capability === "audio") {
    return ["audio", "voice", "speech", "tts", "asr", "whisper", "fish-speech"].some((hint) => haystack.includes(hint));
  }

  return false;
}

function inferOutputModalities(profile, baseOutputModalities) {
  const outputModalities = unique(baseOutputModalities);
  if (modelCapabilityHints(profile, "imageGeneration")) {
    outputModalities.push("image");
  }
  if (modelCapabilityHints(profile, "videoGeneration")) {
    outputModalities.push("video");
  }
  if (modelCapabilityHints(profile, "audioGeneration")) {
    outputModalities.push("audio");
  }
  return unique(outputModalities);
}

function normalizeCapabilities(profile = {}) {
  const defaults = defaultEntryForProvider(profile.provider);
  const baseCapabilities = {
    chat: true,
    tools: Boolean(profile.supportsTools),
    streaming: Boolean(profile.supportsStreaming),
    jsonMode: Boolean(profile.supportsJsonMode),
    imageInput: Boolean(profile.supportsVision),
    imageGeneration: false,
    videoGeneration: false,
    audioGeneration: false,
    ...(defaults?.capabilities || {}),
    ...(profile.capabilities || {})
  };

  if (profile.supportsTools != null) {
    baseCapabilities.tools = Boolean(profile.supportsTools);
  }
  if (profile.supportsStreaming != null) {
    baseCapabilities.streaming = Boolean(profile.supportsStreaming);
  }
  if (profile.supportsJsonMode != null) {
    baseCapabilities.jsonMode = Boolean(profile.supportsJsonMode);
  }
  if (profile.supportsVision != null) {
    baseCapabilities.imageInput = Boolean(profile.supportsVision);
  }

  if (modelCapabilityHints(profile, "imageInput")) {
    baseCapabilities.imageInput = true;
  }
  if (modelCapabilityHints(profile, "imageGeneration")) {
    baseCapabilities.imageGeneration = true;
  }
  if (modelCapabilityHints(profile, "videoGeneration")) {
    baseCapabilities.videoGeneration = true;
  }
  if (modelCapabilityHints(profile, "audioGeneration")) {
    baseCapabilities.audioGeneration = true;
  }

  return baseCapabilities;
}

function normalizeCapabilityProfile(profile = {}) {
  const defaults = defaultEntryForProvider(profile.provider);
  const capabilities = normalizeCapabilities(profile);
  const inputModalities = unique([...(defaults?.inputModalities || ["text"]), ...(profile.inputModalities || [])]);
  if (capabilities.imageInput) {
    inputModalities.push("image");
  }

  const outputModalities = inferOutputModalities(profile, [
    ...(defaults?.outputModalities || ["text"]),
    ...(profile.outputModalities || [])
  ]);
  Object.entries(generationCapabilityByModality).forEach(([modality, capability]) => {
    if (capabilities[capability]) {
      outputModalities.push(modality);
    }
  });

  return {
    ...profile,
    inputModalities: unique(inputModalities),
    outputModalities: unique(outputModalities),
    capabilities
  };
}

function profileCanGenerate(profile, modality) {
  const normalized = normalizeCapabilityProfile(profile);
  const capability = generationCapabilityByModality[modality];
  if (!capability) {
    return false;
  }
  return Boolean(normalized.capabilities?.[capability] || normalized.outputModalities?.includes(modality));
}

function profileCanUseCapability(profile, capability) {
  if (!profile || !capability || capability === "text") {
    return false;
  }
  const normalized = normalizeCapabilityProfile(profile);
  if (generationCapabilityByModality[capability]) {
    return profileCanGenerate(normalized, capability);
  }
  if (capability === "vision") {
    return Boolean(normalized.capabilities?.imageInput || normalized.inputModalities?.includes("image"));
  }
  const bestFor = Array.isArray(profile.bestFor) ? profile.bestFor.map((item) => normalizeText(item)) : [];
  return Boolean(bestFor.includes(capability) || normalized.capabilities?.[capability] || modelCapabilityHints(profile, capability));
}

module.exports = {
  generationCapabilityByModality,
  modelCapabilityHints,
  normalizeCapabilityProfile,
  normalizeCapabilities,
  profileCanGenerate,
  profileCanUseCapability,
  providerCapabilityDefaults
};
