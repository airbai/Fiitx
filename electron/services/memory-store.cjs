const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MEMORY_KINDS = Object.freeze({
  USER_PROFILE: "user_profile",
  USER_PREFERENCE: "user_preference",
  PROJECT_FACT: "project_fact",
  WORKFLOW_PATTERN: "workflow_pattern",
  DECISION: "decision",
  ARTIFACT: "artifact",
  TOOL_RESULT: "tool_result",
  PROFILE_HINT: "profile_hint",
  NOTE: "note"
});

const DEFAULT_MAX_ENTRIES = 2000;
const BUILTIN_MEMORY_CHAR_LIMIT = 2200;
const USER_PROFILE_CHAR_LIMIT = 1375;
const DEFAULT_SESSION_SEARCH_LIMIT = 3;
const PROVIDER_CONFIG_FILE = "providers.json";

function safeReadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
}

function tokenize(value) {
  const text = String(value || "").toLowerCase();
  const ascii = text.match(/[a-z0-9_./:@-]{2,}/g) || [];
  const cjkChunks = text.match(/[\u3400-\u9fff]{2,}/g) || [];
  const cjk = [];
  for (const chunk of cjkChunks) {
    if (chunk.length <= 2) {
      cjk.push(chunk);
      continue;
    }
    for (let index = 0; index < chunk.length - 1; index += 1) {
      cjk.push(chunk.slice(index, index + 2));
    }
  }
  return [...new Set([...ascii, ...cjk])].filter(Boolean);
}

function scoreEntry(entry, queryTokens, options = {}) {
  if (!queryTokens.length) {
    return 1;
  }
  const haystack = tokenize([
    entry.text,
    entry.kind,
    entry.scope,
    entry.workspacePath,
    entry.channelId,
    ...(entry.tags || [])
  ].filter(Boolean).join(" "));
  const haystackSet = new Set(haystack);
  let score = 0;
  for (const token of queryTokens) {
    if (haystackSet.has(token)) {
      score += token.length > 2 ? 3 : 1;
    }
  }
  if (entry.workspacePath && options.workspacePath && entry.workspacePath === options.workspacePath) {
    score += 5;
  }
  if (entry.channelId && options.channelId && entry.channelId === options.channelId) {
    score += 3;
  }
  if (entry.threadId && options.threadId && entry.threadId === options.threadId) {
    score += 2;
  }
  score += Math.max(0, Math.min(5, Number(entry.confidence || 0.5) * 5));
  score += Math.min(3, Number(entry.useCount || 0));
  return score;
}

function boundLines(lines, limit) {
  const selected = [];
  let used = 0;
  for (const line of lines) {
    const next = normalizeText(line);
    if (!next) continue;
    const projected = used + next.length + (selected.length ? 1 : 0);
    if (projected > limit) {
      continue;
    }
    selected.push(next);
    used = projected;
  }
  return {
    lines: selected,
    chars: used,
    limit
  };
}

function entryTextFromSessionEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }
  const chunks = [];
  for (const key of ["content", "summary", "prompt", "message", "detail", "target"]) {
    if (typeof entry[key] === "string") {
      chunks.push(entry[key]);
    }
  }
  if (entry.agentMessage && typeof entry.agentMessage.content === "string") {
    chunks.push(entry.agentMessage.content);
  }
  if (entry.toolEvent) {
    chunks.push([entry.toolEvent.actor, entry.toolEvent.event, entry.toolEvent.target].filter(Boolean).join(" "));
  }
  if (entry.artifact) {
    chunks.push([entry.artifact.title, entry.artifact.path].filter(Boolean).join(" "));
  }
  return normalizeText(chunks.join("\n"));
}

function inferKind(text, fallback = MEMORY_KINDS.NOTE) {
  if (/我叫|我是|我的名字|名字是|叫我|my name is|call me|i am\b/i.test(text)) return MEMORY_KINDS.USER_PROFILE;
  if (/偏好|喜欢|默认|以后|每次|习惯|prefer|default/i.test(text)) return MEMORY_KINDS.USER_PREFERENCE;
  if (/决定|采用|选择|约定|架构|策略|decision|choose|adopt/i.test(text)) return MEMORY_KINDS.DECISION;
  if (/项目|workspace|仓库|repo|公司|产品|Fiitx|OpenClaw/i.test(text)) return MEMORY_KINDS.PROJECT_FACT;
  if (/流程|步骤|workflow|runbook|SOP|操作/i.test(text)) return MEMORY_KINDS.WORKFLOW_PATTERN;
  if (/profile|provider|model|api key|MaaS|OpenAI|DeepSeek|Kimi|GLM|硅基/i.test(text)) return MEMORY_KINDS.PROFILE_HINT;
  if (/artifact|文件|路径|已写入|生成|修改|\.html|\.pdf|\.pptx|\.png|\.js|\.tsx/i.test(text)) return MEMORY_KINDS.ARTIFACT;
  return fallback;
}

function extractMemoryCandidates(text) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 6) {
    return [];
  }
  const candidates = [];
  const explicitPatterns = [
    /(?:我叫|我是|我的名字(?:是|叫)?|名字是|叫我)\s*[:：]?\s*([a-zA-Z0-9_\-\u3400-\u9fff]{2,80})/gi,
    /(?:my name is|call me|i am)\s*[:：]?\s*([a-zA-Z0-9_\- ]{2,80})/gi,
    /(?:记住|请记住|以后|之后|默认|偏好|我的|我们公司|项目叫|产品叫|规则是|约定是|必须|不要)\s*[:：]?\s*([^。.!?\n]{4,220})/gi,
    /(?:remember|preference|default|rule|always|never)\s*[:：]?\s*([^。.!?\n]{4,220})/gi
  ];
  for (const pattern of explicitPatterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      candidates.push(match[0].trim());
    }
  }
  if (/已写入|已生成|已修改|已配置|已安装|已启用|绑定成功|路由|profile|provider|MaaS/i.test(normalized)) {
    candidates.push(normalized.slice(0, 320));
  }
  return [...new Set(candidates)]
    .map((candidate) => normalizeText(candidate))
    .filter((candidate) => candidate.length >= 6)
    .slice(0, 8);
}

function createMemoryStore({ app, sessionLogStore, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  function getStoreDir() {
    const dir = path.join(app.getPath("userData"), "fiitx-memory");
    ensureDir(dir);
    return dir;
  }

  function getStorePath() {
    return path.join(getStoreDir(), "memories.json");
  }

  function getProviderConfigPath() {
    return path.join(getStoreDir(), PROVIDER_CONFIG_FILE);
  }

  function getBuiltInMemoryPath() {
    return path.join(getStoreDir(), "MEMORY.md");
  }

  function getUserProfilePath() {
    return path.join(getStoreDir(), "USER.md");
  }

  function loadState() {
    const state = safeReadJson(getStorePath(), { version: 1, entries: [] });
    if (!Array.isArray(state.entries)) {
      state.entries = [];
    }
    return state;
  }

  function saveState(state) {
    const entries = [...(state.entries || [])]
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
      .slice(0, maxEntries);
    const next = { version: 1, entries };
    fs.writeFileSync(getStorePath(), JSON.stringify(next, null, 2), "utf8");
    writeBuiltInMemoryFiles(next);
    return next;
  }

  function loadProviderConfig() {
    return safeReadJson(getProviderConfigPath(), {
      version: 1,
      activeProvider: "",
      providers: [
        {
          id: "local",
          name: "Built-in Fiitx Memory",
          status: "enabled",
          type: "builtin",
          description: "MEMORY.md / USER.md + SessionDB search"
        },
        {
          id: "external-provider",
          name: "External Memory Provider",
          status: "available",
          type: "provider-api",
          description: "Placeholder for Honcho / mem0 / MCP memory provider"
        }
      ]
    });
  }

  function saveProviderConfig(config) {
    const next = {
      version: 1,
      activeProvider: String(config.activeProvider || ""),
      providers: Array.isArray(config.providers) ? config.providers : []
    };
    fs.writeFileSync(getProviderConfigPath(), JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  function splitCuratedMemory(entries = []) {
    const sorted = [...entries].sort((left, right) => {
      const leftScore = Number(left.confidence || 0) + Math.min(1, Number(left.useCount || 0) / 20);
      const rightScore = Number(right.confidence || 0) + Math.min(1, Number(right.useCount || 0) / 20);
      return rightScore - leftScore || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
    const userLines = [];
    const memoryLines = [];
    for (const entry of sorted) {
      const line = `[${entry.kind}${entry.scope ? `/${entry.scope}` : ""}] ${entry.text}`;
      if ([MEMORY_KINDS.USER_PROFILE, MEMORY_KINDS.USER_PREFERENCE].includes(entry.kind)) {
        userLines.push(line);
      } else if (![MEMORY_KINDS.TOOL_RESULT].includes(entry.kind)) {
        memoryLines.push(line);
      }
    }
    return {
      userProfile: boundLines(userLines, USER_PROFILE_CHAR_LIMIT),
      memory: boundLines(memoryLines, BUILTIN_MEMORY_CHAR_LIMIT)
    };
  }

  function renderBuiltInMemoryFile(title, bounded) {
    const percent = bounded.limit ? Math.round((bounded.chars / bounded.limit) * 100) : 0;
    return [
      `# ${title}`,
      "",
      `Usage: ${percent}% (${bounded.chars}/${bounded.limit} chars)`,
      "",
      ...(bounded.lines.length ? bounded.lines.map((line) => `- ${line}`) : ["_No curated entries yet._"]),
      ""
    ].join("\n");
  }

  function writeBuiltInMemoryFiles(state = loadState()) {
    try {
      const curated = splitCuratedMemory(state.entries || []);
      fs.writeFileSync(getBuiltInMemoryPath(), renderBuiltInMemoryFile("Fiitx MEMORY", curated.memory), "utf8");
      fs.writeFileSync(getUserProfilePath(), renderBuiltInMemoryFile("Fiitx USER", curated.userProfile), "utf8");
    } catch {
      // Memory files are a derived cache; JSON state remains the source of truth.
    }
  }

  function remember(input = {}) {
    const text = normalizeText(input.text || input.content || input.summary);
    if (!text) {
      return null;
    }
    const state = loadState();
    const now = new Date().toISOString();
    const kind = input.kind || inferKind(text);
    const scope = input.scope || (input.workspacePath ? "workspace" : input.channelId ? "channel" : "global");
    const dedupeKey = input.dedupeKey || hashText([scope, kind, input.workspacePath || "", input.channelId || "", text.toLowerCase().slice(0, 240)].join("|"));
    const existing = state.entries.find((entry) => entry.dedupeKey === dedupeKey);
    if (existing) {
      existing.text = text.length > existing.text.length ? text : existing.text;
      existing.updatedAt = now;
      existing.lastSeenAt = now;
      existing.confidence = Math.max(Number(existing.confidence || 0.5), Number(input.confidence || 0.6));
      existing.tags = [...new Set([...(existing.tags || []), ...(input.tags || [])])].slice(0, 12);
      saveState(state);
      return existing;
    }
    const entry = {
      id: input.id || crypto.randomUUID(),
      dedupeKey,
      kind,
      scope,
      text,
      workspacePath: input.workspacePath || "",
      channelId: input.channelId || "",
      threadId: input.threadId || input.sourceThreadId || "",
      source: input.source || "manual",
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 12) : [],
      confidence: Number(input.confidence || 0.65),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      lastUsedAt: "",
      useCount: 0
    };
    state.entries.push(entry);
    saveState(state);
    return entry;
  }

  function list(options = {}) {
    const state = loadState();
    let entries = state.entries || [];
    if (options.kind) {
      entries = entries.filter((entry) => entry.kind === options.kind);
    }
    if (options.workspacePath) {
      entries = entries.filter((entry) => !entry.workspacePath || entry.workspacePath === options.workspacePath);
    }
    if (options.channelId) {
      entries = entries.filter((entry) => !entry.channelId || entry.channelId === options.channelId);
    }
    return entries.slice(0, Number(options.limit || 200));
  }

  function recall(query = "", options = {}) {
    const queryTokens = tokenize(query);
    const scored = list({ ...options, limit: maxEntries })
      .map((entry) => ({ ...entry, score: scoreEntry(entry, queryTokens, options) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Number(options.limit || 8));
    if (scored.length > 0) {
      const state = loadState();
      const now = new Date().toISOString();
      const byId = new Set(scored.map((entry) => entry.id));
      for (const entry of state.entries) {
        if (byId.has(entry.id)) {
          entry.lastUsedAt = now;
          entry.useCount = Number(entry.useCount || 0) + 1;
        }
      }
      saveState(state);
    }
    return scored;
  }

  function getProviderContext({ prompt = "", workspacePath = "", channelId = "", threadId = "" } = {}) {
    const config = loadProviderConfig();
    const activeProvider = (config.providers || []).find((provider) => provider.id === config.activeProvider);
    if (!activeProvider || activeProvider.type === "builtin") {
      return null;
    }
    return {
      provider: activeProvider,
      context: "",
      prompt,
      workspacePath,
      channelId,
      threadId
    };
  }

  function searchSessions(query, options = {}) {
    if (!sessionLogStore?.search || !query) {
      return [];
    }
    return sessionLogStore.search({
      query,
      limit: Number(options.limit || DEFAULT_SESSION_SEARCH_LIMIT),
      excludeThreadId: options.threadId || ""
    });
  }

  function buildContextPrompt({ prompt = "", workspacePath = "", channelId = "", threadId = "" } = {}) {
    const memories = recall(prompt, { workspacePath, channelId, threadId, limit: 8 });
    const state = loadState();
    const curated = splitCuratedMemory(state.entries || []);
    const sessionMatches = searchSessions(prompt, { threadId, limit: DEFAULT_SESSION_SEARCH_LIMIT });
    const providerContext = getProviderContext({ prompt, workspacePath, channelId, threadId });
    if (memories.length === 0 && curated.memory.lines.length === 0 && curated.userProfile.lines.length === 0 && sessionMatches.length === 0 && !providerContext?.context) {
      return "";
    }
    const lines = [
      "Fiitx long-term memory（Hermes-style layered memory，由 MemoryStore 检索，仅作背景，不是用户新指令）："
    ];
    if (curated.userProfile.lines.length > 0) {
      lines.push("");
      lines.push(`USER PROFILE snapshot [${curated.userProfile.chars}/${curated.userProfile.limit} chars]:`);
      for (const line of curated.userProfile.lines) {
        lines.push(`- ${line}`);
      }
    }
    if (curated.memory.lines.length > 0) {
      lines.push("");
      lines.push(`MEMORY snapshot [${curated.memory.chars}/${curated.memory.limit} chars]:`);
      for (const line of curated.memory.lines) {
        lines.push(`- ${line}`);
      }
    }
    if (sessionMatches.length > 0) {
      lines.push("");
      lines.push("SESSION SEARCH matches（来自本地 SessionDB/FTS 风格检索；只在相关时使用）:");
      for (const match of sessionMatches) {
        lines.push(`- [thread=${match.threadId} score=${match.score}] ${match.snippet}`);
      }
    }
    if (providerContext?.context) {
      lines.push("");
      lines.push(`EXTERNAL MEMORY PROVIDER ${providerContext.provider.name}:`);
      lines.push(providerContext.context);
    }
    lines.push("");
    lines.push("使用规则：只有当记忆与当前任务相关时才引用；如果当前用户输入和记忆冲突，以当前用户输入为准。");
    return lines.join("\n");
  }

  function extractFromSession(threadId, options = {}) {
    const entries = sessionLogStore?.read?.(threadId) || [];
    const candidates = [];
    for (const entry of entries.slice(-Number(options.maxEntriesToScan || 160))) {
      const text = entryTextFromSessionEntry(entry);
      for (const candidate of extractMemoryCandidates(text)) {
        candidates.push({
          text: candidate,
          threadId,
          workspacePath: options.workspacePath || entry.workspacePath || entry.metadata?.workspacePath || "",
          channelId: options.channelId || entry.channelId || entry.metadata?.channelId || "",
          source: "session-extract",
          confidence: /记住|默认|偏好|remember|always|never/i.test(candidate) ? 0.86 : 0.62
        });
      }
    }
    return candidates.slice(0, Number(options.limit || 20)).map((candidate) => remember(candidate)).filter(Boolean);
  }

  function recordRun({ payload = {}, result = {} } = {}) {
    const threadId = payload.threadId || payload.sessionId || payload.taskId || "";
    const workspacePath = payload.workspacePath || "";
    const channelId = payload.channelId || payload.channelContext?.channelId || payload.channelAdapter?.id || "";
    const written = [];
    for (const candidate of extractMemoryCandidates(payload.prompt || "")) {
      const entry = remember({
        text: candidate,
        threadId,
        workspacePath,
        channelId,
        source: "user-explicit",
        confidence: 0.82
      });
      if (entry) written.push(entry);
    }
    if (result?.ok && (result.artifact?.path || /已写入|已生成|已修改|已配置|已安装|绑定成功/i.test(String(result.summary || "")))) {
      const text = normalizeText([
        result.title ? `任务：${result.title}` : "",
        result.artifact?.path ? `产物：${result.artifact.path}` : "",
        String(result.summary || "").slice(0, 260)
      ].filter(Boolean).join("；"));
      const entry = remember({
        text,
        kind: result.artifact?.path ? MEMORY_KINDS.ARTIFACT : inferKind(text),
        threadId,
        workspacePath,
        channelId,
        source: "run-result",
        confidence: 0.66
      });
      if (entry) written.push(entry);
    }
    return written;
  }

  function remove(id) {
    const state = loadState();
    const before = state.entries.length;
    state.entries = state.entries.filter((entry) => entry.id !== id);
    saveState(state);
    return { ok: state.entries.length < before, removed: before - state.entries.length };
  }

  function clear(options = {}) {
    if (!options.confirm) {
      return { ok: false, error: "confirm required" };
    }
    saveState({ version: 1, entries: [] });
    return { ok: true };
  }

  function getSnapshot() {
    const entries = list({ limit: maxEntries });
    const byKind = {};
    const byScope = {};
    for (const entry of entries) {
      byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
      byScope[entry.scope] = (byScope[entry.scope] || 0) + 1;
    }
    const curated = splitCuratedMemory(entries);
    writeBuiltInMemoryFiles({ version: 1, entries });
    const providerConfig = loadProviderConfig();
    const sessionCount = Number(sessionLogStore?.listSessions?.().length || 0);
    return {
      storePath: getStorePath(),
      memoryPath: getBuiltInMemoryPath(),
      userProfilePath: getUserProfilePath(),
      count: entries.length,
      byKind,
      byScope,
      latest: entries.slice(0, 10),
      layers: {
        curatedMemory: {
          enabled: true,
          memoryPath: getBuiltInMemoryPath(),
          userProfilePath: getUserProfilePath(),
          memoryChars: curated.memory.chars,
          memoryLimit: curated.memory.limit,
          userProfileChars: curated.userProfile.chars,
          userProfileLimit: curated.userProfile.limit
        },
        sessionSearch: {
          enabled: Boolean(sessionLogStore?.search),
          sessionCount,
          engine: "jsonl-token-index",
          storePath: sessionLogStore?.getStoreDir?.() || ""
        },
        provider: {
          activeProvider: providerConfig.activeProvider || "",
          providers: providerConfig.providers || []
        }
      }
    };
  }

  function listProviders() {
    return loadProviderConfig().providers || [];
  }

  function setProvider(providerId = "") {
    const config = loadProviderConfig();
    const targetId = String(providerId || "");
    if (targetId && !(config.providers || []).some((provider) => provider.id === targetId)) {
      throw new Error(`Memory provider not found: ${targetId}`);
    }
    config.activeProvider = targetId;
    return saveProviderConfig(config);
  }

  return {
    buildContextPrompt,
    clear,
    extractFromSession,
    getSnapshot,
    listProviders,
    list,
    recall,
    recordRun,
    remember,
    remove,
    searchSessions,
    setProvider
  };
}

module.exports = {
  MEMORY_KINDS,
  createMemoryStore
};
