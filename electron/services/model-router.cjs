const fs = require("node:fs");
const path = require("node:path");
const { defaultProfileSeeds, endpointForProfile, normalizeModelName } = require("./provider-registry.cjs");
const {
  modelCapabilityHints: registryModelCapabilityHints,
  normalizeCapabilityProfile,
  profileCanUseCapability
} = require("./model-capability-registry.cjs");

const siliconFlowImageFallbackModels = [
  "Kwai-Kolors/Kolors",
  "Qwen/Qwen-Image",
  "black-forest-labs/FLUX.1-schnell",
  "black-forest-labs/FLUX.1-dev"
];

const siliconFlowVideoFallbackModels = [
  "Wan-AI/Wan2.2-T2V-A14B",
  "Wan-AI/Wan2.2-I2V-A14B"
];

const siliconFlowAudioFallbackModels = [
  "fishaudio/fish-speech-1.5"
];

const openRouterVideoFallbackModels = [
  "google/veo-3.1-fast",
  "google/veo-3.1",
  "bytedance/seedance-2.0",
  "alibaba/wan-2.7"
];

function imageEndpointForProfile(profile) {
  const baseUrl = (profile?.baseUrl || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
  return `${baseUrl}/images/generations`;
}

function videoSubmitEndpointForProfile(profile) {
  const baseUrl = (profile?.baseUrl || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
  return `${baseUrl}/video/submit`;
}

function videoStatusEndpointForProfile(profile) {
  const baseUrl = (profile?.baseUrl || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
  return `${baseUrl}/video/status`;
}

function openRouterVideosEndpoint(profile) {
  const baseUrl = (profile?.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  return `${baseUrl}/videos`;
}

function audioSpeechEndpointForProfile(profile) {
  const baseUrl = (profile?.baseUrl || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
  return `${baseUrl}/audio/speech`;
}

function stringifyMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (content == null) {
    return "";
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || "")
      .filter(Boolean)
      .join("\n");
  }
  return String(content);
}

function extractReasoningContent(message) {
  const value =
    message?.reasoning_content ??
    message?.reasoningContent ??
    message?.metadata?.reasoning_content ??
    message?.metadata?.reasoningContent;
  return typeof value === "string" ? value : "";
}

function normalizeProviderToolCall(call, index, messageIndex = 0) {
  const rawArguments = call?.function?.arguments ?? call?.arguments ?? "{}";
  let argumentsText = "{}";
  if (typeof rawArguments === "string") {
    argumentsText = rawArguments || "{}";
  } else {
    try {
      argumentsText = JSON.stringify(rawArguments || {});
    } catch {
      argumentsText = "{}";
    }
  }

  const name = call?.function?.name || call?.name || "";
  if (!name) {
    return null;
  }

  return {
    id: call?.id || `tool-call-${messageIndex}-${index}`,
    type: "function",
    function: {
      name,
      arguments: argumentsText
    }
  };
}

function normalizeMessagesForProvider(messages = []) {
  const normalized = [];
  const pendingToolCallIds = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") {
      continue;
    }

    if (message.role === "assistant") {
      const assistantMessage = {
        role: "assistant",
        content: stringifyMessageContent(message.content)
      };
      const reasoningContent = extractReasoningContent(message);
      if (reasoningContent) {
        assistantMessage.reasoning_content = reasoningContent;
      }
      const sourceToolCalls = Array.isArray(message.tool_calls)
        ? message.tool_calls
        : Array.isArray(message.toolCalls)
          ? message.toolCalls
          : Array.isArray(message.metadata?.tool_calls)
            ? message.metadata.tool_calls
            : Array.isArray(message.metadata?.toolCalls)
              ? message.metadata.toolCalls
              : [];
      const toolCalls = sourceToolCalls.length
        ? sourceToolCalls
            .map((call, callIndex) => normalizeProviderToolCall(call, callIndex, index))
            .filter(Boolean)
        : [];
      if (toolCalls.length) {
        pendingToolCallIds.push(...toolCalls.map((call) => call.id));
        assistantMessage.tool_calls = toolCalls;
      }
      normalized.push(assistantMessage);
      continue;
    }

    if (message.role === "tool") {
      let toolCallId = message.tool_call_id || message.toolCallId || "";
      if (!toolCallId && pendingToolCallIds.length) {
        toolCallId = pendingToolCallIds.shift();
      } else if (toolCallId) {
        const pendingIndex = pendingToolCallIds.indexOf(toolCallId);
        if (pendingIndex >= 0) {
          pendingToolCallIds.splice(pendingIndex, 1);
        }
      }

      if (!toolCallId) {
        const toolName = message.name ? `（${message.name}）` : "";
        normalized.push({
          role: "user",
          content: `历史工具结果${toolName}：\n${stringifyMessageContent(message.content)}`
        });
        continue;
      }

      const toolMessage = {
        role: "tool",
        tool_call_id: toolCallId,
        content: stringifyMessageContent(message.content)
      };
      if (message.name) {
        toolMessage.name = message.name;
      }
      normalized.push(toolMessage);
      continue;
    }

    if (["system", "user"].includes(message.role)) {
      normalized.push({
        role: message.role,
        content: stringifyMessageContent(message.content)
      });
      continue;
    }

    normalized.push({
      role: "user",
      content: stringifyMessageContent(message.content)
    });
  }

  return normalized;
}

function extensionFromContentType(contentType, fallback = "png") {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("mp4")) {
    return "mp4";
  }
  if (normalized.includes("quicktime")) {
    return "mov";
  }
  if (normalized.includes("webm")) {
    return "webm";
  }
  if (normalized.includes("mpeg") || normalized.includes("mp3")) {
    return "mp3";
  }
  if (normalized.includes("wav")) {
    return "wav";
  }
  if (normalized.includes("ogg") || normalized.includes("opus")) {
    return normalized.includes("opus") ? "opus" : "ogg";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("gif")) {
    return "gif";
  }
  return fallback;
}

function safeFilename(value) {
  return String(value || "generated-image")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "generated-image";
}

function formatTimeoutSeconds(timeoutMs) {
  return Math.max(1, Math.round(timeoutMs / 1000));
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("用户已停止当前任务。"));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener?.("abort", () => {
      clearTimeout(timeout);
      reject(new Error("用户已停止当前任务。"));
    }, { once: true });
  });
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function absoluteUrl(baseUrl, value) {
  const raw = String(value || "");
  if (isHttpUrl(raw)) {
    return raw;
  }
  const origin = new URL(baseUrl).origin;
  return new URL(raw, origin).toString();
}

function extractMediaUrl(data) {
  if (!data) {
    return "";
  }
  if (typeof data === "string") {
    return data;
  }
  const direct = data.url || data.video_url || data.audio_url || data.download_url || data.file_url || data.content_url;
  if (direct) {
    return direct;
  }
  const arrays = [
    data.images,
    data.videos,
    data.audios,
    data.data,
    data.result?.videos,
    data.result?.audios,
    data.results,
    data.output,
    data.unsigned_urls
  ].filter(Array.isArray);
  for (const list of arrays) {
    for (const item of list) {
      const nested = extractMediaUrl(item);
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

function createModelRouter({ app, safeStorage }) {
  function getStorePath() {
    return path.join(app.getPath("userData"), "model-profiles.json");
  }

  function getPackagedSeedPaths() {
    const candidates = [
      path.join(__dirname, "../model-profile-seeds.json")
    ];
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "model-profile-seeds.json"));
    }
    return candidates;
  }

  function getMetricsPath() {
    return path.join(app.getPath("userData"), "model-router-metrics.json");
  }

  function getLegacyStorePath() {
    return path.join(app.getPath("appData"), "fiitx-desktop", "model-profiles.json");
  }

  function readLegacyProfiles() {
    try {
      const raw = fs.readFileSync(getLegacyStorePath(), "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function profileIdentity(profile) {
    return `${String(profile?.provider || "").toLowerCase()}::${normalizeModelName(profile?.model || "").toLowerCase()}`;
  }

  function migrateLegacyProfileKeys(profiles) {
    const legacyProfiles = readLegacyProfiles().filter(hasStoredApiKey);
    if (legacyProfiles.length === 0) {
      return { profiles, changed: false };
    }

    let changed = false;
    const migrated = profiles.map((profile) => {
      if (hasDecryptableApiKey(profile)) {
        return profile;
      }
      const legacy =
        legacyProfiles.find((item) => profileIdentity(item) === profileIdentity(profile) && hasDecryptableApiKey(item)) ||
        legacyProfiles.find((item) => profileMatchesProvider(item, profile.provider) && hasDecryptableApiKey(item));
      if (!legacy?.encryptedApiKey) {
        return profile;
      }
      changed = true;
      return {
        ...profile,
        encryptedApiKey: legacy.encryptedApiKey,
        updatedAt: profile.updatedAt || new Date().toISOString(),
        migratedFrom: "fiitx-desktop"
      };
    });

    const known = new Set(migrated.map(profileIdentity));
    for (const legacy of legacyProfiles) {
      if (known.has(profileIdentity(legacy))) {
        continue;
      }
      known.add(profileIdentity(legacy));
      changed = true;
      migrated.push({
        ...legacy,
        id: `legacy-${legacy.id || profileIdentity(legacy)}`,
        migratedFrom: "fiitx-desktop"
      });
    }

    return { profiles: migrated, changed };
  }

  function readProfiles() {
    try {
      const raw = fs.readFileSync(getStorePath(), "utf8");
      const profiles = JSON.parse(raw);
      const migrated = migrateLegacyProfileKeys(profiles);
      if (migrated.changed) {
        writeProfiles(migrated.profiles);
      }
      return migrated.profiles;
    } catch {
      const migrated = migrateLegacyProfileKeys([]);
      if (migrated.changed) {
        writeProfiles(migrated.profiles);
      }
      return migrated.profiles;
    }
  }

  function writeProfiles(profiles) {
    fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
    fs.writeFileSync(getStorePath(), JSON.stringify(profiles, null, 2), "utf8");
  }

  function readMetrics() {
    try {
      const raw = fs.readFileSync(getMetricsPath(), "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMetrics(metrics) {
    fs.mkdirSync(path.dirname(getMetricsPath()), { recursive: true });
    fs.writeFileSync(getMetricsPath(), JSON.stringify(metrics, null, 2), "utf8");
  }

  function emptyProfileMetrics() {
    return {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      estimatedCostUsd: 0,
      lastSuccessAt: "",
      lastFailureAt: "",
      lastError: "",
      circuitOpenUntil: 0
    };
  }

  function metricsForProfile(metrics, profile) {
    return {
      ...emptyProfileMetrics(),
      ...(metrics[profileIdentity(profile)] || {})
    };
  }

  function profileStats(profile) {
    const metrics = metricsForProfile(readMetrics(), profile);
    const calls = metrics.successCount + metrics.failureCount;
    return {
      ...metrics,
      successRate: calls ? metrics.successCount / calls : null,
      averageLatencyMs: metrics.successCount ? Math.round(metrics.totalLatencyMs / metrics.successCount) : 0,
      circuitOpen: Number(metrics.circuitOpenUntil || 0) > Date.now()
    };
  }

  function updateProfileMetrics(profile, patch) {
    const metrics = readMetrics();
    const key = profileIdentity(profile);
    const current = {
      ...emptyProfileMetrics(),
      ...(metrics[key] || {})
    };
    metrics[key] = {
      ...current,
      ...patch
    };
    writeMetrics(metrics);
    return metrics[key];
  }

  function estimateTokensFromMessages(messages = []) {
    const text = messages.map((message) => stringifyMessageContent(message.content)).join("\n");
    return Math.max(1, Math.ceil(text.length / 4));
  }

  function estimateTokensFromText(text = "") {
    return Math.max(1, Math.ceil(String(text || "").length / 4));
  }

  function usageFromResponse(data, providerMessages, content) {
    const usage = data?.usage || {};
    return {
      promptTokens: Number(usage.prompt_tokens || usage.promptTokens || 0) || estimateTokensFromMessages(providerMessages),
      completionTokens: Number(usage.completion_tokens || usage.completionTokens || 0) || estimateTokensFromText(content),
      totalTokens: Number(usage.total_tokens || usage.totalTokens || 0) || undefined
    };
  }

  function estimateCostUsd(profile, usage = {}) {
    const inputCost = Number(profile?.inputCostPer1M || profile?.pricing?.inputPer1M || 0);
    const outputCost = Number(profile?.outputCostPer1M || profile?.pricing?.outputPer1M || 0);
    const promptTokens = Number(usage.promptTokens || 0);
    const completionTokens = Number(usage.completionTokens || 0);
    if (!inputCost && !outputCost) {
      return 0;
    }
    return (promptTokens * inputCost + completionTokens * outputCost) / 1000000;
  }

  function recordProfileSuccess(profile, startedAt, usage) {
    const current = profileStats(profile);
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const estimatedCostUsd = estimateCostUsd(profile, usage);
    updateProfileMetrics(profile, {
      successCount: current.successCount + 1,
      consecutiveFailures: 0,
      totalLatencyMs: current.totalLatencyMs + latencyMs,
      lastLatencyMs: latencyMs,
      totalPromptTokens: current.totalPromptTokens + Number(usage?.promptTokens || 0),
      totalCompletionTokens: current.totalCompletionTokens + Number(usage?.completionTokens || 0),
      estimatedCostUsd: Number((current.estimatedCostUsd + estimatedCostUsd).toFixed(8)),
      lastSuccessAt: new Date().toISOString(),
      lastError: "",
      circuitOpenUntil: 0
    });
    return {
      latencyMs,
      estimatedCostUsd
    };
  }

  function recordProfileFailure(profile, startedAt, error) {
    const current = profileStats(profile);
    const consecutiveFailures = current.consecutiveFailures + 1;
    const backoffMs = consecutiveFailures >= 3 ? Math.min(300000, 30000 * 2 ** Math.min(consecutiveFailures - 3, 3)) : 0;
    updateProfileMetrics(profile, {
      failureCount: current.failureCount + 1,
      consecutiveFailures,
      lastLatencyMs: Math.max(1, Date.now() - startedAt),
      lastFailureAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error || "模型调用失败"),
      circuitOpenUntil: backoffMs ? Date.now() + backoffMs : 0
    });
  }

  function encryptApiKey(apiKey) {
    if (!apiKey) {
      return null;
    }

    if (safeStorage.isEncryptionAvailable()) {
      return {
        encoding: "electron-safe-storage",
        value: safeStorage.encryptString(apiKey).toString("base64")
      };
    }

    return {
      encoding: "plain",
      value: apiKey
    };
  }

  function decryptApiKey(encryptedApiKey) {
    if (!encryptedApiKey?.value) {
      return "";
    }

    if (encryptedApiKey.encoding === "electron-safe-storage" && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(encryptedApiKey.value, "base64"));
      } catch {
        return "";
      }
    }

    if (encryptedApiKey.encoding === "plain") {
      return encryptedApiKey.value;
    }

    return "";
  }

  function hasStoredApiKey(profile) {
    return Boolean(profile?.encryptedApiKey?.value);
  }

  function hasDecryptableApiKey(profile) {
    return Boolean(decryptApiKey(profile?.encryptedApiKey));
  }

  function apiKeyStatus(profile) {
    if (hasDecryptableApiKey(profile)) {
      return "available";
    }
    if (hasStoredApiKey(profile)) {
      return "locked";
    }
    return "missing";
  }

  function createStoredProfile(payload, existingProfile = null) {
    const now = new Date().toISOString();
    const encryptedApiKey = payload.apiKey
      ? encryptApiKey(payload.apiKey)
      : existingProfile?.encryptedApiKey || null;
    return normalizeCapabilityProfile({
      id: payload.id,
      provider: payload.provider,
      model: normalizeModelName(payload.model),
      baseUrl: payload.baseUrl,
      contextWindow: payload.contextWindow,
      supportsTools: payload.supportsTools,
      supportsVision: payload.supportsVision,
      supportsStreaming: payload.supportsStreaming,
      supportsJsonMode: payload.supportsJsonMode,
      inputModalities: payload.inputModalities,
      outputModalities: payload.outputModalities,
      capabilities: payload.capabilities,
      bestFor: payload.bestFor,
      toolCallStyle: payload.toolCallStyle,
      inputCostPer1M: payload.inputCostPer1M,
      outputCostPer1M: payload.outputCostPer1M,
      expectedLatencyMs: payload.expectedLatencyMs,
      priority: payload.priority,
      apiKeyRef: `keychain:${payload.provider}:${normalizeModelName(payload.model)}`,
      encryptedApiKey,
      updatedAt: now,
      createdAt: payload.createdAt || existingProfile?.createdAt || now
    });
  }

  function readPackagedProfileSeeds() {
    for (const seedPath of getPackagedSeedPaths()) {
      try {
        if (!fs.existsSync(seedPath)) {
          continue;
        }
        const parsed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
        const list = Array.isArray(parsed) ? parsed : parsed?.profiles;
        if (!Array.isArray(list)) {
          continue;
        }
        return list
          .map((seed) => {
            const normalizedModel = normalizeModelName(seed?.model || "");
            const baseSeed = defaultProfileSeeds.find((item) =>
              item.id === seed?.id ||
              (item.provider === seed?.provider && normalizeModelName(item.model) === normalizedModel)
            );
            return {
              ...(baseSeed || {}),
              ...seed,
              id: seed?.id || baseSeed?.id || `packaged-${String(seed?.provider || "model").toLowerCase()}-${normalizedModel}`,
              model: normalizedModel,
              apiKey: seed?.apiKey || seed?.key || process.env[seed?.envKey] || ""
            };
          })
          .filter((seed) => seed.provider && seed.model && seed.apiKey);
      } catch {
        continue;
      }
    }
    return [];
  }

  function ensureSeededProfiles() {
    const envSeeds = defaultProfileSeeds
      .map((seed) => ({
        ...seed,
        apiKey: process.env[seed.envKey]
      }))
      .filter((seed) => seed.apiKey);
    const seedById = new Map();
    for (const seed of readPackagedProfileSeeds().concat(envSeeds)) {
      seedById.set(seed.id, seed);
    }
    const seeds = Array.from(seedById.values());

    if (seeds.length === 0) {
      return;
    }

    const profiles = readProfiles();
    const seededIds = new Set(seeds.map((seed) => seed.id));
    const next = seeds
      .map((seed) => {
        const existingProfile = profiles.find((profile) => profile.id === seed.id) ||
          profiles.find((profile) => profile.provider === seed.provider && normalizeModelName(profile.model) === normalizeModelName(seed.model));
        return hasDecryptableApiKey(existingProfile) ? existingProfile : createStoredProfile(seed, existingProfile);
      })
      .concat(profiles.filter((profile) => !seededIds.has(profile.id)));
    writeProfiles(next);
  }

  function sanitizeProfile(profile) {
    const { encryptedApiKey, ...safeProfile } = profile;
    const keyStatus = apiKeyStatus(profile);
    return normalizeCapabilityProfile({
      ...safeProfile,
      hasApiKey: keyStatus === "available",
      hasStoredApiKey: hasStoredApiKey(profile),
      keyStatus,
      routeStats: profileStats(profile)
    });
  }

  function listProfiles() {
    return readProfiles().map(sanitizeProfile);
  }

  function saveProfile(payload) {
    const profiles = readProfiles();
    const id = payload.id || `${payload.provider}-${payload.model}-${Date.now()}`;
    const normalizedModel = normalizeModelName(payload.model);
    const matchingProfiles = profiles.filter(
      (profile) =>
        profile.id === id ||
        (profile.provider === payload.provider && normalizeModelName(profile.model) === normalizedModel)
    );
    const existingProfile =
      matchingProfiles.find(hasDecryptableApiKey) ||
      matchingProfiles.find(hasStoredApiKey) ||
      matchingProfiles[0] ||
      null;
    const storedProfile = createStoredProfile({
      ...payload,
      id
    }, existingProfile);

    const next = [storedProfile].concat(profiles.filter((profile) => profile.id !== id));
    writeProfiles(next);
    return sanitizeProfile(storedProfile);
  }

  function profileMatchesProvider(profile, provider) {
    if (!profile || !provider) {
      return false;
    }
    const left = String(profile.provider || "").toLowerCase();
    const right = String(provider || "").toLowerCase();
    return left === right || left.includes(right) || right.includes(left);
  }

  function isAutoSelection(value) {
    const normalized = String(value || "").toLowerCase();
    return ["auto", "openrouter auto", "openrouter-auto", "openrouter/auto"].includes(normalized);
  }

  function modelCapabilityHints(profile, capability) {
    return registryModelCapabilityHints(profile, capability);
  }

  function imageModelCandidates(profile) {
    const model = normalizeModelName(profile?.model || "");
    const candidates = [];
    const isSiliconFlow = profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow");
    if (modelCapabilityHints(profile, "image")) {
      candidates.push(model);
    }
    if (isSiliconFlow) {
      candidates.push(...siliconFlowImageFallbackModels);
    }
    if (!isSiliconFlow && model && !candidates.includes(model) && !["deepseek-v4-flash", "deepseek-v4-pro", "minimax-text-01", "openrouter/auto"].includes(String(model).toLowerCase())) {
      candidates.push(model);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function videoModelCandidates(profile) {
    const model = normalizeModelName(profile?.model || "");
    const candidates = [];
    const isSiliconFlow = profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow");
    if (modelCapabilityHints(profile, "video")) {
      candidates.push(model);
    }
    if (isSiliconFlow) {
      candidates.push(...siliconFlowVideoFallbackModels);
    }
    if (profileMatchesProvider(profile, "OpenRouter")) {
      candidates.push(...openRouterVideoFallbackModels);
    }
    if (!isSiliconFlow && model && !candidates.includes(model) && !["deepseek-v4-flash", "deepseek-v4-pro", "minimax-text-01", "openrouter/auto"].includes(String(model).toLowerCase())) {
      candidates.push(model);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function audioModelCandidates(profile) {
    const model = normalizeModelName(profile?.model || "");
    const candidates = [];
    const isSiliconFlow = profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow");
    if (modelCapabilityHints(profile, "audio")) {
      candidates.push(model);
    }
    if (isSiliconFlow) {
      candidates.push(...siliconFlowAudioFallbackModels);
    }
    if (!isSiliconFlow && model && !candidates.includes(model) && !["deepseek-v4-flash", "deepseek-v4-pro", "minimax-text-01", "openrouter/auto"].includes(String(model).toLowerCase())) {
      candidates.push(model);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function profileRouteEconomyScore(profile) {
    const inputCost = Number(profile?.inputCostPer1M || profile?.pricing?.inputPer1M || 0);
    const outputCost = Number(profile?.outputCostPer1M || profile?.pricing?.outputPer1M || 0);
    const blendedCost = inputCost + outputCost;
    if (!blendedCost) {
      return 0;
    }
    return Math.max(-18, -Math.log10(blendedCost + 1) * 10);
  }

  function profileRouteLatencyScore(profile, stats) {
    const observedLatency = Number(stats?.averageLatencyMs || stats?.lastLatencyMs || 0);
    const expectedLatency = Number(profile?.expectedLatencyMs || 0);
    const latencyMs = observedLatency || expectedLatency;
    if (!latencyMs) {
      return 0;
    }
    return Math.max(-18, -Math.log10(Math.max(1000, latencyMs) / 1000) * 10);
  }

  function profileRouteHealthScore(profile) {
    const stats = profileStats(profile);
    if (stats.circuitOpen) {
      return -1000;
    }
    const calls = stats.successCount + stats.failureCount;
    let score = 0;
    if (calls > 0 && stats.successRate != null) {
      score += (stats.successRate - 0.5) * 30;
    }
    if (stats.consecutiveFailures) {
      score -= stats.consecutiveFailures * 12;
    }
    if (stats.lastSuccessAt) {
      score += 4;
    }
    return score;
  }

  function profileRank(profile, preferredModel, intent = {}) {
    let score = 0;
    const requiredCapability = primaryIntentModelCapability(intent);
    if (profile.id === preferredModel || profile.provider === preferredModel || normalizeModelName(profile.model) === normalizeModelName(preferredModel)) {
      score += 40;
    }
    if (intent.preferredProvider && profileMatchesProvider(profile, intent.preferredProvider)) {
      score += 35;
    }
    if (requiredCapability && profileMatchesCapability(profile, requiredCapability)) {
      score += 45;
    }
    if (intent.modality && intent.modality !== "text" && profileMatchesCapability(profile, intent.modality)) {
      score += 30;
    }
    if (intent.mode === "coding" && profileMatchesCapability(profile, "coding")) {
      score += 10;
    }
    if (Number.isFinite(Number(profile.priority))) {
      score += Number(profile.priority) / 10;
    }
    if (isAutoSelection(preferredModel) || !preferredModel) {
      score += profileRouteEconomyScore(profile);
      score += profileRouteLatencyScore(profile, profileStats(profile));
    }
    score += profileRouteHealthScore(profile);
    return score;
  }

  function routeCandidate(profile, preferredModel, intent = {}, index = 0) {
    const stats = profileStats(profile);
    const score = profileRank(profile, preferredModel, intent);
    const requiredCapability = primaryIntentModelCapability(intent);
    return {
      profile,
      index,
      score,
      reasons: [
        profile.id === preferredModel || profile.provider === preferredModel || normalizeModelName(profile.model) === normalizeModelName(preferredModel)
          ? "preferred"
          : "",
        intent.preferredProvider && profileMatchesProvider(profile, intent.preferredProvider) ? "provider-match" : "",
        requiredCapability && profileMatchesCapability(profile, requiredCapability) ? `capability:${requiredCapability}` : "",
        intent.mode === "coding" && profileMatchesCapability(profile, "coding") ? "coding" : "",
        intent.modality && intent.modality !== "text" && profileMatchesCapability(profile, intent.modality) ? intent.modality : "",
        stats.averageLatencyMs ? `avg-latency:${stats.averageLatencyMs}ms` : "",
        profile.inputCostPer1M || profile.outputCostPer1M ? `cost:${profile.inputCostPer1M || 0}/${profile.outputCostPer1M || 0}` : "",
        stats.circuitOpen ? "circuit-open" : ""
      ].filter(Boolean)
    };
  }

  function resolveModelProfiles(preferredModel, intent = {}) {
    const allProfiles = readProfiles().filter(hasDecryptableApiKey);
    const requiredCapability = primaryIntentModelCapability(intent);
    const profiles =
      requiredCapability
        ? allProfiles.filter((profile) => profileMatchesCapability(profile, requiredCapability))
        : intent.modality && ["image", "video", "audio"].includes(intent.modality)
        ? allProfiles.filter((profile) => profileMatchesCapability(profile, intent.modality))
        : allProfiles;
    const sorted = profiles
      .map((profile, index) => routeCandidate(profile, preferredModel, intent, index))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.profile);

    return sorted;
  }

  function listRouteCandidates(preferredModel, intent = {}) {
    return resolveModelProfiles(preferredModel, intent).map((profile, index) => {
      const candidate = routeCandidate(profile, preferredModel, intent, index);
      return {
        ...sanitizeProfile(profile),
        routeScore: Number(candidate.score.toFixed(2)),
        routeReasons: candidate.reasons
      };
    });
  }

  function profileMatchesCapability(profile, capability) {
    if (!profile || !capability || capability === "text") {
      return false;
    }
    return profileCanUseCapability(profile, capability);
  }

  function primaryIntentModelCapability(intent = {}) {
    const capabilities = Array.isArray(intent.capabilityIntent?.requiredModelCapabilities)
      ? intent.capabilityIntent.requiredModelCapabilities.filter(Boolean)
      : [];
    if (capabilities.length > 0) {
      return capabilities[0];
    }
    const modelCapability = String(intent.capabilityIntent?.modelCapability || "");
    if (modelCapability && modelCapability !== "chat") {
      return modelCapability;
    }
    if (intent.modality === "image") {
      return "imageGeneration";
    }
    if (intent.modality === "video") {
      return "videoGeneration";
    }
    if (intent.modality === "audio") {
      return "audioGeneration";
    }
    return "";
  }

  function resolveModelProfile(preferredModel, intent = {}) {
    return resolveModelProfiles(preferredModel, intent)[0] || null;
  }

  function normalizeToolCall(call, index) {
    const rawArguments = call?.function?.arguments || call?.arguments || "{}";
    let parsedArguments = {};
    try {
      parsedArguments = typeof rawArguments === "string" ? JSON.parse(rawArguments || "{}") : rawArguments || {};
    } catch {
      parsedArguments = {
        _raw: String(rawArguments || "")
      };
    }

    return {
      id: call?.id || `tool-call-${Date.now()}-${index}`,
      type: call?.type || "function",
      name: call?.function?.name || call?.name || "",
      arguments: parsedArguments,
      rawArguments
    };
  }

  async function callChatMessagesOnce(profile, messages, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    if (!profile || !apiKey) {
      throw new Error("没有找到可解密的模型 API Key");
    }
    const providerMessages = normalizeMessagesForProvider(messages);

    const controller = new AbortController();
    let timeoutTriggered = false;
    const timeout = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, options.timeoutMs || 60000);
    const abortListener = () => controller.abort();
    options.signal?.addEventListener?.("abort", abortListener, { once: true });

    try {
      let response;
      try {
        response = await fetch(endpointForProfile(profile), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: normalizeModelName(profile.model),
            messages: providerMessages,
            tools: options.tools?.length ? options.tools : undefined,
            tool_choice: options.tools?.length ? options.toolChoice || "auto" : undefined,
            temperature: 0.2,
            stream: false
          }),
          signal: controller.signal
        });
      } catch (error) {
        if (timeoutTriggered) {
          throw new Error(`模型调用超时：${profile.provider} / ${profile.model} 在 ${formatTimeoutSeconds(options.timeoutMs || 60000)} 秒内没有返回。`);
        }
        if (options.signal?.aborted) {
          throw new Error("用户已停止当前 Agent 回合。");
        }
        throw error;
      }

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${raw.slice(0, 160)}`);
      }

      const data = JSON.parse(raw);
      const choice = data?.choices?.[0];
      const message = choice?.message;
      if (!message) {
        throw new Error("模型响应中没有 message");
      }

      const content = typeof message.content === "string" ? message.content.trim() : "";
      const reasoningContent = extractReasoningContent(message);
      const toolCalls = (message.tool_calls || []).map(normalizeToolCall);
      const usage = usageFromResponse(data, providerMessages, content);
      const assistantMessage = {
        role: message.role || "assistant",
        content
      };
      if (reasoningContent) {
        assistantMessage.reasoning_content = reasoningContent;
      }
      if (toolCalls.length) {
        assistantMessage.tool_calls = toolCalls.map((toolCall, index) => normalizeProviderToolCall({
          id: toolCall.id,
          type: toolCall.type,
          name: toolCall.name,
          arguments: toolCall.rawArguments
        }, index));
      }
      return {
        content,
        reasoningContent,
        finishReason: choice?.finish_reason || "",
        message: assistantMessage,
        rawToolCalls: message.tool_calls || [],
        toolCalls,
        usage,
        estimatedCostUsd: estimateCostUsd(profile, usage),
        profile,
        raw: data
      };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener?.("abort", abortListener);
    }
  }

  function resolveChatRouteProfiles(preferredProfile, options = {}) {
    const intent = {
      modality: "text",
      ...(options.intent || {}),
      mode: options.mode || options.intent?.mode || options.payload?.intent?.mode || options.payload?.mode
    };
    const preferredModel =
      options.preferredModel ||
      preferredProfile?.id ||
      preferredProfile?.model ||
      preferredProfile?.provider ||
      "auto";
    const routed = resolveModelProfiles(preferredModel, intent);
    const explicitHasKey = preferredProfile && hasDecryptableApiKey(preferredProfile);
    const explicitIdentity = profileIdentity(preferredProfile);
    const merged = [];

    if (explicitHasKey) {
      merged.push(preferredProfile);
    }
    for (const candidate of routed) {
      if (!candidate || merged.some((item) => profileIdentity(item) === profileIdentity(candidate))) {
        continue;
      }
      merged.push(candidate);
    }

    if (!isAutoSelection(preferredModel) && explicitHasKey) {
      return merged;
    }

    return merged
      .map((profile, index) => routeCandidate(profile, preferredModel, intent, index))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.profile);
  }

  function shouldStopChatFallback(error, options = {}) {
    const message = error instanceof Error ? error.message : String(error || "");
    return options.signal?.aborted || /用户已停止|aborted|AbortError/i.test(message);
  }

  async function callChatMessages(profile, messages, options = {}) {
    if (options.disableFallback) {
      return callChatMessagesOnce(profile, messages, options);
    }

    const candidates = resolveChatRouteProfiles(profile, options);
    const errors = [];
    const attempts = [];

    for (const candidate of candidates) {
      if (options.signal?.aborted) {
        throw new Error("用户已停止当前 Agent 回合。");
      }
      const startedAt = Date.now();
      options.onAttempt?.(candidate);
      attempts.push({
        provider: candidate.provider,
        model: normalizeModelName(candidate.model),
        startedAt
      });
      try {
        const result = await callChatMessagesOnce(candidate, messages, options);
        const recorded = recordProfileSuccess(candidate, startedAt, result.usage);
        const successfulAttempt = attempts[attempts.length - 1];
        successfulAttempt.ok = true;
        successfulAttempt.latencyMs = recorded.latencyMs;
        successfulAttempt.estimatedCostUsd = recorded.estimatedCostUsd;
        return {
          ...result,
          profile: candidate,
          provider: candidate.provider,
          model: normalizeModelName(candidate.model),
          routing: {
            selectedProvider: candidate.provider,
            selectedModel: normalizeModelName(candidate.model),
            attempts,
            fallbackCount: attempts.length - 1,
            estimatedCostUsd: result.estimatedCostUsd
          }
        };
      } catch (error) {
        if (shouldStopChatFallback(error, options)) {
          throw error;
        }
        recordProfileFailure(candidate, startedAt, error);
        const message = error instanceof Error ? error.message : "模型调用失败";
        const failedAttempt = attempts[attempts.length - 1];
        failedAttempt.ok = false;
        failedAttempt.error = message;
        failedAttempt.latencyMs = Math.max(1, Date.now() - startedAt);
        errors.push(`${candidate.provider} / ${candidate.model}: ${message}`);
      }
    }

    const keylessProfiles = readProfiles()
      .filter((candidate) => !hasDecryptableApiKey(candidate))
      .slice(0, 6)
      .map((candidate) => `${candidate.provider} / ${candidate.model}${hasStoredApiKey(candidate) ? "（API Key 无法解密，请重新保存）" : ""}`);
    const keylessHint = keylessProfiles.length ? `；跳过无可用 API Key 的 profile：${keylessProfiles.join("；")}` : "";
    throw new Error(`没有可用 MaaS 模型完成本次调用，已尝试 ${candidates.length} 个候选：${errors.join("；")}${keylessHint}`);
  }

  async function callChat(profile, prompt, options = {}) {
    const result = await callChatMessages(profile, [
      {
        role: "system",
        content:
          options.systemPrompt ||
          "你是 Fiitx Coding Agent。你只能基于给定 workspace 上下文回答。不要声称已经写文件或执行 shell；需要这些动作时明确标为待审批。"
      },
      {
        role: "user",
        content: prompt
      }
    ], options);

    if (!result.content) {
      throw new Error("模型响应中没有 message content");
    }

    return result.content;
  }

  async function downloadImageToCache(url, prompt, model) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`图片下载失败 HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFromContentType(contentType);
    const outputDir = path.join(app.getPath("userData"), "generated-images");
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${Date.now()}-${safeFilename(prompt)}.${extension}`;
    const absolutePath = path.join(outputDir, filename);
    fs.writeFileSync(absolutePath, buffer);

    return {
      path: absolutePath,
      title: filename,
      contentType,
      size: buffer.length,
      model
    };
  }

  async function downloadMediaToCache(url, prompt, model, modality, fallbackExtension) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${modality} 下载失败 HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFromContentType(contentType, fallbackExtension);
    const outputDir = path.join(app.getPath("userData"), `generated-${modality}s`);
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${Date.now()}-${safeFilename(prompt)}.${extension}`;
    const absolutePath = path.join(outputDir, filename);
    fs.writeFileSync(absolutePath, buffer);

    return {
      path: absolutePath,
      title: filename,
      contentType,
      size: buffer.length,
      model
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${raw.slice(0, 160)}`);
    }
    return raw ? JSON.parse(raw) : {};
  }

  async function fetchProviderCapabilityModels(profile, apiKey, capability) {
    if (!(profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow"))) {
      return [];
    }

    try {
      const baseUrl = (profile?.baseUrl || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
      const data = await fetchJson(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });
      const models = (data.data || data.models || [])
        .map((item) => item.id || item.name || item.model || item.slug)
        .filter(Boolean);
      return models.filter((model) => modelCapabilityHints({ provider: profile.provider, model }, capability));
    } catch {
      return [];
    }
  }

  async function mergeDynamicCandidates(profile, apiKey, capability, staticCandidates) {
    const dynamicCandidates = await fetchProviderCapabilityModels(profile, apiKey, capability);
    return Array.from(new Set(dynamicCandidates.concat(staticCandidates).filter(Boolean)));
  }

  async function callImage(profile, prompt, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    if (!profile || !apiKey) {
      throw new Error("没有找到可用于图片生成的 API Key");
    }

    const candidates = await mergeDynamicCandidates(profile, apiKey, "image", imageModelCandidates(profile));
    if (candidates.length === 0) {
      throw new Error(`${profile.provider} / ${profile.model} 不是可识别的图片生成模型，请在模型中心保存具备 image 能力的 profile。`);
    }

    const controller = new AbortController();
    let timeoutTriggered = false;
    const timeout = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, options.timeoutMs || 120000);
    const abortListener = () => controller.abort();
    options.signal?.addEventListener?.("abort", abortListener, { once: true });
    const errors = [];

    try {
      for (const model of candidates) {
        try {
          const response = await fetch(imageEndpointForProfile(profile), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              prompt,
              image_size: options.imageSize || "1024x1024",
              batch_size: 1,
              num_inference_steps: options.steps || 20,
              guidance_scale: options.guidanceScale || 7.5
            }),
            signal: controller.signal
          });

          const raw = await response.text();
          if (!response.ok) {
            errors.push(`${model}: HTTP ${response.status}: ${raw.slice(0, 160)}`);
            continue;
          }

          const data = JSON.parse(raw);
          const firstImage = data?.images?.[0] || data?.data?.[0];
          const imageUrl = firstImage?.url || firstImage?.b64_json || firstImage?.base64 || "";
          if (!imageUrl) {
            errors.push(`${model}: 响应中没有图片 URL 或 base64`);
            continue;
          }

          if (String(imageUrl).startsWith("data:image/")) {
            const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(imageUrl);
            if (!match) {
              errors.push(`${model}: base64 图片格式不可识别`);
              continue;
            }
            const extension = extensionFromContentType(match[1]);
            const outputDir = path.join(app.getPath("userData"), "generated-images");
            fs.mkdirSync(outputDir, { recursive: true });
            const filename = `${Date.now()}-${safeFilename(prompt)}.${extension}`;
            const absolutePath = path.join(outputDir, filename);
            fs.writeFileSync(absolutePath, Buffer.from(match[2], "base64"));
            return {
              model,
              provider: profile.provider,
              remoteUrl: imageUrl,
              localImage: {
                path: absolutePath,
                title: filename,
                contentType: match[1],
                model
              }
            };
          }

          const localImage = await downloadImageToCache(imageUrl, prompt, model);
          return {
            model,
            provider: profile.provider,
            remoteUrl: imageUrl,
            localImage
          };
        } catch (error) {
          if (controller.signal.aborted) {
            if (timeoutTriggered) {
              throw new Error(`图片生成超时：${profile.provider} 在 ${formatTimeoutSeconds(options.timeoutMs || 120000)} 秒内没有返回。`);
            }
            if (options.signal?.aborted) {
              throw new Error("用户已停止当前 Agent 回合。");
            }
            throw error;
          }
          errors.push(`${model}: ${error instanceof Error ? error.message : "图片生成失败"}`);
        }
      }

      throw new Error(`图片生成模型均未成功：${errors.join("；")}`);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener?.("abort", abortListener);
    }
  }

  async function callSiliconFlowVideo(profile, prompt, model, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    const submit = await fetchJson(videoSubmitEndpointForProfile(profile), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        image_size: options.imageSize || "1280x720"
      }),
      signal: options.signal
    });
    const requestId = submit.requestId || submit.request_id || submit.id || submit.data?.requestId || submit.data?.request_id || submit.data?.id;
    if (!requestId) {
      const immediateUrl = extractMediaUrl(submit);
      if (immediateUrl) {
        const localVideo = await downloadMediaToCache(immediateUrl, prompt, model, "video", "mp4");
        return { model, provider: profile.provider, remoteUrl: immediateUrl, localMedia: localVideo };
      }
      throw new Error("提交视频任务后没有 requestId");
    }

    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs || 600000;
    while (Date.now() - startedAt < timeoutMs) {
      await delay(options.pollIntervalMs || 5000, options.signal);
      const status = await fetchJson(videoStatusEndpointForProfile(profile), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requestId }),
        signal: options.signal
      });
      const state = String(status.status || status.data?.status || status.state || status.data?.state || "").toLowerCase();
      const videoUrl = extractMediaUrl(status);
      if (videoUrl && !["pending", "running", "processing", "queued", "created"].includes(state)) {
        const localVideo = await downloadMediaToCache(videoUrl, prompt, model, "video", "mp4");
        return { model, provider: profile.provider, remoteUrl: videoUrl, localMedia: localVideo };
      }
      if (["failed", "fail", "error", "canceled", "cancelled"].includes(state)) {
        throw new Error(`视频任务失败：${JSON.stringify(status).slice(0, 180)}`);
      }
    }

    throw new Error(`视频生成超时：${profile.provider} / ${model}`);
  }

  async function fetchOpenRouterVideoModels(profile, apiKey) {
    try {
      const data = await fetchJson(`${openRouterVideosEndpoint(profile)}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const models = (data.data || data.models || [])
        .map((item) => item.id || item.slug || item.name)
        .filter(Boolean);
      if (models.length > 0) {
        return models;
      }
    } catch {
      // Fall through to static fallbacks.
    }
    return openRouterVideoFallbackModels;
  }

  async function callOpenRouterVideo(profile, prompt, model, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    const submitted = await fetchJson(openRouterVideosEndpoint(profile), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt
      }),
      signal: options.signal
    });
    const pollingUrl = submitted.polling_url || submitted.pollingUrl || submitted.url || submitted.data?.polling_url || submitted.data?.url;
    const directUrl = extractMediaUrl(submitted);
    if (directUrl && directUrl !== pollingUrl) {
      const localVideo = await downloadMediaToCache(absoluteUrl(openRouterVideosEndpoint(profile), directUrl), prompt, model, "video", "mp4");
      return { model, provider: profile.provider, remoteUrl: directUrl, localMedia: localVideo };
    }
    if (!pollingUrl) {
      throw new Error("提交 OpenRouter 视频任务后没有 polling_url");
    }

    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs || 600000;
    const statusUrl = absoluteUrl(openRouterVideosEndpoint(profile), pollingUrl);
    while (Date.now() - startedAt < timeoutMs) {
      await delay(options.pollIntervalMs || 5000, options.signal);
      const status = await fetchJson(statusUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: options.signal
      });
      const state = String(status.status || status.state || status.data?.status || status.data?.state || "").toLowerCase();
      const videoUrl = extractMediaUrl(status);
      if (videoUrl && !["pending", "running", "processing", "queued", "created"].includes(state)) {
        const localVideo = await downloadMediaToCache(absoluteUrl(statusUrl, videoUrl), prompt, model, "video", "mp4");
        return { model, provider: profile.provider, remoteUrl: videoUrl, localMedia: localVideo };
      }
      if (["failed", "fail", "error", "canceled", "cancelled"].includes(state)) {
        throw new Error(`OpenRouter 视频任务失败：${JSON.stringify(status).slice(0, 180)}`);
      }
    }

    throw new Error(`OpenRouter 视频生成超时：${model}`);
  }

  async function callVideo(profile, prompt, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    if (!profile || !apiKey) {
      throw new Error("没有找到可用于视频生成的 API Key");
    }

    if (profileMatchesProvider(profile, "OpenRouter")) {
      const candidates = await fetchOpenRouterVideoModels(profile, apiKey);
      const errors = [];
      for (const model of candidates) {
        try {
          return await callOpenRouterVideo(profile, prompt, model, options);
        } catch (error) {
          errors.push(`${model}: ${error instanceof Error ? error.message : "视频生成失败"}`);
        }
      }
      throw new Error(errors.join("；"));
    }

    if (profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow")) {
      const errors = [];
      const candidates = await mergeDynamicCandidates(profile, apiKey, "video", videoModelCandidates(profile));
      for (const model of candidates) {
        try {
          return await callSiliconFlowVideo(profile, prompt, model, options);
        } catch (error) {
          errors.push(`${model}: ${error instanceof Error ? error.message : "视频生成失败"}`);
        }
      }
      throw new Error(errors.join("；"));
    }

    throw new Error(`${profile.provider} 暂未配置可调用的视频生成 endpoint`);
  }

  async function callAudio(profile, prompt, options = {}) {
    const apiKey = decryptApiKey(profile?.encryptedApiKey);
    if (!profile || !apiKey) {
      throw new Error("没有找到可用于音频生成的 API Key");
    }

    if (!(profileMatchesProvider(profile, "硅基流动") || profileMatchesProvider(profile, "SiliconFlow"))) {
      throw new Error(`${profile.provider} 暂未配置可调用的音频生成 endpoint`);
    }

    const errors = [];
    const candidates = await mergeDynamicCandidates(profile, apiKey, "audio", audioModelCandidates(profile));
    for (const model of candidates) {
      try {
        const response = await fetch(audioSpeechEndpointForProfile(profile), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            input: prompt,
            voice: options.voice || "fishaudio/fish-speech-1.5:anna",
            response_format: "mp3"
          }),
          signal: options.signal
        });
        const raw = Buffer.from(await response.arrayBuffer());
        if (!response.ok) {
          errors.push(`${model}: HTTP ${response.status}: ${raw.toString("utf8").slice(0, 160)}`);
          continue;
        }
        const outputDir = path.join(app.getPath("userData"), "generated-audios");
        fs.mkdirSync(outputDir, { recursive: true });
        const filename = `${Date.now()}-${safeFilename(prompt)}.mp3`;
        const absolutePath = path.join(outputDir, filename);
        fs.writeFileSync(absolutePath, raw);
        return {
          model,
          provider: profile.provider,
          remoteUrl: "",
          localMedia: {
            path: absolutePath,
            title: filename,
            contentType: response.headers.get("content-type") || "audio/mpeg",
            size: raw.length,
            model
          }
        };
      } catch (error) {
        errors.push(`${model}: ${error instanceof Error ? error.message : "音频生成失败"}`);
      }
    }

    throw new Error(errors.join("；"));
  }

  async function callMediaWithFallback(intent, prompt, options = {}) {
    const profiles = resolveModelProfiles(options.preferredModel, intent);
    const requiredCapability = primaryIntentModelCapability(intent);
    const skippedKeyless = readProfiles()
      .filter((profile) => !hasDecryptableApiKey(profile) && profileMatchesCapability(profile, requiredCapability || intent.modality))
      .map((profile) =>
        `${profile.provider} / ${profile.model}${hasStoredApiKey(profile) ? "（API Key 无法解密，请重新保存）" : ""}`
      );
    const errors = [];
    for (const profile of profiles) {
      if (options.signal?.aborted) {
        throw new Error("用户已停止当前媒体生成任务。");
      }
      options.onAttempt?.(profile);
      try {
        if (intent.modality === "image") {
          return { ...(await callImage(profile, prompt, options)), profile };
        }
        if (intent.modality === "video") {
          return { ...(await callVideo(profile, prompt, options)), profile };
        }
        if (intent.modality === "audio") {
          return { ...(await callAudio(profile, prompt, options)), profile };
        }
      } catch (error) {
        if (options.signal?.aborted) {
          throw new Error("用户已停止当前媒体生成任务。");
        }
        errors.push(`${profile.provider} / ${profile.model}: ${error instanceof Error ? error.message : "媒体生成失败"}`);
      }
    }

    const skippedHint = skippedKeyless.length
      ? `；已跳过 API Key 不可用的 profile：${skippedKeyless.join("；")}`
      : "";
    throw new Error(`${intent.modality} 生成没有可用结果，已尝试 ${profiles.length} 个已配置 key：${errors.join("；")}${skippedHint}`);
  }

  async function testConnection(payload) {
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (!payload.provider || !payload.model || !payload.apiKey) {
      return {
        ok: false,
        message: "供应商、模型和 API Key 不能为空"
      };
    }

    return {
      ok: true,
      message: "连接格式校验通过，模型 profile 可保存"
    };
  }

  return {
    callMediaWithFallback,
    callImage,
    callChat,
    callChatMessages,
    ensureSeededProfiles,
    listProfiles,
    listRouteCandidates,
    normalizeModelName,
    resolveModelProfile,
    resolveModelProfiles,
    saveProfile,
    testConnection
  };
}

module.exports = {
  createModelRouter,
  extractReasoningContent,
  normalizeMessagesForProvider
};
