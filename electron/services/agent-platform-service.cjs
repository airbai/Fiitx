const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_VERSION = 1;
const CRON_TICK_MS = 30 * 1000;
const DAY_MINUTES = 24 * 60;
const YOUXIAOJIA_BLOG_CRON_ID = "youxiaojia-x-blog-daily";

function resolveYouxiaojiaWorkspace() {
  const configured = process.env.FIITX_YOUXIAOJIA_WORKSPACE || process.env.YOUXIAOJIA_WORKSPACE;
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(__dirname, "..", "..", "..", "zero2codex");
}

function createYouxiaojiaBlogPrompt(workspacePath) {
  return [
    "你是 FIIT.AI youxiaojia.cn 的每日 SEO Blog 发布 Agent。",
    "",
    "目标：每天从 x.com 的公开信息中筛选 10 条与 Codex、Codex CLI、Agent Harness、Pi Agent Core、Hermes、Fiitx、MCP、agent memory、tool calling、eval/safety 相关的信息，重写成 www.youxiaojia.cn Blog 的 10 篇多语言 SEO 内容并发布。",
    "",
    `工作区：${workspacePath}`,
    "必须使用这个工作区。先运行 `pwd` 和 `git status --short`，确认当前仓库是 zero2codex。",
    "",
    "执行规则：",
    "1. 信息获取：优先使用 x.com / X 的公开搜索或公开帖子页面；如果 X 限制访问，可用搜索引擎结果、公开网页摘要或可访问的 X 链接做候选，但 sourceUrl 必须尽量指向 x.com 原帖。",
    "2. 选题：10 条内容要围绕 Codex 与 Agent Harness 工程化，不要泛泛转发 AI 新闻，也不要写成广告稿。",
    "3. 写作：不要复制原帖全文；只保留短标签、链接和事实线索，用自己的话重写。每篇必须生成 zh/en/ja/es/de 的 title、summary、body。",
    "4. 更新文件：优先只改 `lib/blogPosts.js`。保持 `blogLocales`、`blogCopy`、`blogPosts`、`getBlogPost`、`normalizeBlogLocale` 的导出兼容，`blogPosts` 保持 10 条。",
    "5. SEO：slug 使用英文短横线；date 使用今天日期；tags 控制在 3-5 个；正文要解释工程意义，以及它对《从零上手 Codex》和《从零到精通 Agent Harness》的学习启发。",
    "6. 验证：运行 `npm run build`。如失败，先修复再继续。",
    "7. 发布：构建通过后运行 `vercel --prod --yes` 发布到生产环境，并确保 www.youxiaojia.cn 指向最新生产部署。不要破坏课程、支付、兑换码、dashboard 或已有用户权益。",
    "8. 发布后校验：访问 `https://www.youxiaojia.cn/blog?lang=zh`、`https://www.youxiaojia.cn/blog?lang=en` 和至少一个详情页，确认 10 条内容可访问，再检查 Vercel 日志是否有运行时错误。",
    "",
    "输出：列出 10 条 sourceUrl、改动文件、构建结果、部署 URL、线上校验结果。如果 X 或 Vercel 被限制，说明阻塞点并保留已完成的本地改动。"
  ].join("\n");
}

function createYouxiaojiaBlogCronJob() {
  const workspacePath = resolveYouxiaojiaWorkspace();
  const now = Date.now();
  return {
    id: YOUXIAOJIA_BLOG_CRON_ID,
    name: "youxiaojia.cn X SEO Blog daily publisher",
    enabled: true,
    prompt: createYouxiaojiaBlogPrompt(workspacePath),
    channelId: "daemon-cron",
    model: "auto",
    everyMinutes: DAY_MINUTES,
    workspacePath,
    permissionMode: "auto",
    nextRunAt: new Date(now + DAY_MINUTES * 60 * 1000).toISOString(),
    lastRunAt: null,
    lastStatus: "idle",
    lastSummary: "",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value, fallback = "item") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asPermissionMode(value, fallback = "ask") {
  return ["ask", "auto", "full"].includes(value) ? value : fallback;
}

function clip(value, max = 240) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function withBuiltInCronJobs(cronJobs = []) {
  const normalizedJobs = asArray(cronJobs).map(normalizeCronJob).filter(Boolean);
  const builtInJobs = [createYouxiaojiaBlogCronJob()].map(normalizeCronJob).filter(Boolean);
  for (const job of builtInJobs) {
    const existingIndex = normalizedJobs.findIndex((item) => item.id === job.id);
    if (existingIndex >= 0) {
      const existing = normalizedJobs[existingIndex];
      normalizedJobs[existingIndex] = {
        ...existing,
        name: job.name,
        prompt: job.prompt,
        channelId: job.channelId,
        workspacePath: job.workspacePath,
        permissionMode: existing.permissionMode || job.permissionMode,
        model: existing.model || job.model,
        everyMinutes: existing.everyMinutes || job.everyMinutes,
        enabled: existing.enabled !== false,
        nextRunAt: existing.nextRunAt || job.nextRunAt,
        updatedAt: new Date().toISOString()
      };
    } else {
      normalizedJobs.push(job);
    }
  }
  return normalizedJobs;
}

function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    daemon: {
      enabled: true,
      autoStart: true,
      keepChannelsWarm: true,
      lastStartedAt: null
    },
    cronJobs: [],
    learnedSkills: [],
    profileIsolation: {
      enabled: true,
      profiles: [
        {
          id: "default",
          name: "Default desktop profile",
          enabled: true,
          model: "auto",
          match: { channelIds: ["deepsix-workbench"], intentModes: [] },
          notes: "Default Fiitx Workbench routing."
        },
        {
          id: "coding",
          name: "Coding isolation",
          enabled: true,
          model: "auto",
          match: { channelIds: [], intentModes: ["coding"] },
          notes: "Keeps coding tasks isolated from IM profile assumptions."
        },
        {
          id: "im",
          name: "IM channel isolation",
          enabled: true,
          model: "auto",
          match: { channelIds: ["wechat-clawbot", "wechat-ilink"], intentModes: [] },
          notes: "Compact replies and channel context for IM-driven tasks."
        },
        {
          id: "cron",
          name: "Daemon Cron isolation",
          enabled: true,
          model: "auto",
          match: { channelIds: ["daemon-cron"], intentModes: [] },
          notes: "Scheduled background tasks should use their own routing identity."
        }
      ]
    }
  };
}

function normalizeConfig(raw = {}) {
  const fallback = defaultConfig();
  return {
    ...fallback,
    ...raw,
    version: CONFIG_VERSION,
    daemon: {
      ...fallback.daemon,
      ...(raw.daemon && typeof raw.daemon === "object" ? raw.daemon : {})
    },
    cronJobs: withBuiltInCronJobs(raw.cronJobs),
    learnedSkills: asArray(raw.learnedSkills).map(normalizeLearnedSkill).filter(Boolean),
    profileIsolation: normalizeProfileIsolation(raw.profileIsolation || fallback.profileIsolation)
  };
}

function normalizeCronJob(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = slugify(raw.id || raw.name || crypto.randomUUID(), "cron");
  const everyMinutes = Math.max(1, Number(raw.everyMinutes || raw.schedule?.everyMinutes || 60));
  const now = Date.now();
  return {
    id,
    name: String(raw.name || id).trim(),
    enabled: raw.enabled !== false,
    prompt: String(raw.prompt || "").trim(),
    channelId: String(raw.channelId || "daemon-cron").trim(),
    model: String(raw.model || "auto").trim(),
    everyMinutes,
    workspacePath: String(raw.workspacePath || "").trim(),
    permissionMode: asPermissionMode(raw.permissionMode),
    nextRunAt: raw.nextRunAt || new Date(now + everyMinutes * 60 * 1000).toISOString(),
    lastRunAt: raw.lastRunAt || null,
    lastStatus: raw.lastStatus || "idle",
    lastSummary: raw.lastSummary || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function normalizeLearnedSkill(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = slugify(raw.id || raw.name || crypto.randomUUID(), "learned-skill");
  return {
    id,
    name: String(raw.name || id).trim(),
    description: String(raw.description || "").trim(),
    promptTemplate: String(raw.promptTemplate || "").trim(),
    sourceThreadId: String(raw.sourceThreadId || "").trim(),
    sourceCount: Number(raw.sourceCount || 0),
    keywords: asArray(raw.keywords).map(String).slice(0, 16),
    status: raw.status || "draft",
    root: raw.root || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function normalizeProfileIsolation(raw = {}) {
  const fallback = defaultConfig().profileIsolation;
  return {
    ...fallback,
    ...raw,
    enabled: raw.enabled !== false,
    profiles: asArray(raw.profiles || fallback.profiles).map((profile) => ({
      id: slugify(profile.id || profile.name, "profile"),
      name: String(profile.name || profile.id || "Profile").trim(),
      enabled: profile.enabled !== false,
      model: String(profile.model || "auto").trim(),
      match: {
        channelIds: asArray(profile.match?.channelIds || profile.channelIds).map(String),
        intentModes: asArray(profile.match?.intentModes || profile.intentModes).map(String),
        workspaceIncludes: String(profile.match?.workspaceIncludes || profile.workspaceIncludes || "").trim()
      },
      notes: String(profile.notes || "").trim()
    }))
  };
}

function tokenScore(text, tokens) {
  const normalized = String(text || "").toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function stringifyEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return String(entry || "");
  }
  return [
    entry.type,
    entry.role,
    entry.title,
    entry.content,
    entry.detail,
    entry.summary,
    entry.agentMessage?.body,
    entry.progress?.detail,
    entry.progress?.title,
    JSON.stringify(entry.metadata || {})
  ].filter(Boolean).join("\n");
}

function createAgentPlatformService({ app, sessionLogStore, threadStore, skillMarketplace, runAgentTask, emitProgress } = {}) {
  const configPath = path.join(app.getPath("userData"), "agent-platform.json");
  const learnedSkillRoot = path.join(app.getPath("userData"), "learned-skills");
  let daemonRunning = false;
  let daemonStartedAt = null;
  let cronTimer = null;
  let runningCronIds = new Set();
  const daemonEvents = [];

  function readConfig() {
    return normalizeConfig(readJson(configPath, defaultConfig()));
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    writeJson(configPath, normalized);
    return normalized;
  }

  function recordEvent(event, detail = "") {
    daemonEvents.unshift({
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      event,
      detail
    });
    daemonEvents.splice(80);
  }

  function shortTime() {
    return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function createEmptyThreadRecord() {
    return {
      messages: [],
      progressEvents: [],
      artifacts: [],
      lastAgentArtifact: null,
      executionArtifacts: [],
      activeAgentTaskId: "",
      executionStartedAt: null,
      executionFinishedAt: null,
      executionExpanded: false,
      sessionEntries: [],
      currentEntryId: null
    };
  }

  function mutateCronThread(job, taskId, status, updater) {
    if (!threadStore?.load || !threadStore?.save || !job?.id) {
      return;
    }
    const state = threadStore.load() || {};
    const threadId = `cron-${job.id}`;
    const now = Date.now();
    const currentThread = asArray(state.threads).find((thread) => thread?.id === threadId);
    const nextThread = {
      ...(currentThread || {}),
      id: threadId,
      title: job.name || "Cron 任务",
      kind: "Cron",
      model: job.model || "auto",
      status,
      workspacePath: job.workspacePath || "",
      createdAt: currentThread?.createdAt || now,
      updatedAt: "刚刚",
      projectFolderId: null
    };
    const currentRecords = state.threadRecords && typeof state.threadRecords === "object" ? state.threadRecords : {};
    const currentRecord = currentRecords[threadId] || createEmptyThreadRecord();
    const baseRecord = {
      ...createEmptyThreadRecord(),
      ...currentRecord,
      messages: asArray(currentRecord.messages),
      progressEvents: asArray(currentRecord.progressEvents),
      artifacts: asArray(currentRecord.artifacts),
      executionArtifacts: asArray(currentRecord.executionArtifacts),
      sessionEntries: asArray(currentRecord.sessionEntries)
    };
    const nextRecord = updater ? updater(baseRecord) || baseRecord : baseRecord;
    const nextState = {
      ...state,
      threads: [nextThread, ...asArray(state.threads).filter((thread) => thread?.id !== threadId)],
      rootThreadIds: [threadId, ...asArray(state.rootThreadIds).filter((id) => id !== threadId)],
      threadRecords: {
        ...currentRecords,
        [threadId]: nextRecord
      }
    };
    threadStore.save(nextState);
  }

  function ensureCronThread(job, taskId, reason) {
    mutateCronThread(job, taskId, "running", (record) => {
      const userMessageId = `cron-user-${taskId}`;
      const agentMessageId = `cron-agent-${taskId}`;
      const existingMessages = asArray(record.messages);
      const hasSeed = existingMessages.some((message) => message?.id === agentMessageId);
      const messages = hasSeed ? existingMessages : existingMessages.concat([
        {
          id: userMessageId,
          role: "user",
          author: "Cron",
          body: `${job.name || "Cron 任务"}\n\n工作区：${job.workspacePath || "未设置"}`,
          time: shortTime(),
          taskId
        },
        {
          id: agentMessageId,
          role: "agent",
          author: "Agent Runtime",
          body: reason === "manual" ? "手动执行已提交，正在后台运行。" : "计划任务已触发，正在后台运行。",
          time: shortTime(),
          taskId,
          streamBaseBody: reason === "manual" ? "手动执行已提交，正在后台运行。" : "计划任务已触发，正在后台运行。",
          streamEvents: [],
          streamStatus: "running",
          streamDetailsExpanded: false
        }
      ]);
      return {
        ...record,
        messages,
        activeAgentTaskId: taskId,
        executionStartedAt: record.executionStartedAt || Date.now(),
        executionFinishedAt: null
      };
    });
  }

  function emitCronProgress(job, taskId, progress = {}) {
    const threadId = `cron-${job.id}`;
    const event = {
      id: crypto.randomUUID(),
      taskId,
      threadId,
      threadTitle: job.name || "Cron 任务",
      threadKind: "Cron",
      threadModel: job.model || "auto",
      threadWorkspacePath: job.workspacePath || "",
      cronJobId: job.id,
      cronSource: progress.cronSource || "daemon-cron",
      time: new Date().toISOString(),
      status: progress.status || "running",
      ...progress
    };
    if (typeof emitProgress === "function") {
      emitProgress(event);
    }
    mutateCronThread(job, taskId, event.status === "error" ? "failed" : event.status === "finished" ? "done" : "running", (record) => {
      const progressEvents = asArray(record.progressEvents).concat(event).slice(-64);
      const messages = asArray(record.messages).map((message) => {
        if (message?.taskId !== taskId || message.role !== "agent") {
          return message;
        }
        return {
          ...message,
          streamEvents: asArray(message.streamEvents).concat(event).slice(-64),
          streamStatus: event.status === "finished" || event.status === "error" ? "finished" : "running"
        };
      });
      return {
        ...record,
        messages,
        progressEvents,
        activeAgentTaskId: event.status === "finished" || event.status === "error" ? "" : taskId,
        executionFinishedAt: event.status === "finished" || event.status === "error" ? Date.now() : record.executionFinishedAt
      };
    });
    return event;
  }

  function finishCronThread(job, taskId, status, summary) {
    const body = status === "error"
      ? `执行失败：${clip(summary || "未知错误", 500)}`
      : `执行完成：${clip(summary || "Cron run finished.", 500)}`;
    mutateCronThread(job, taskId, status === "error" ? "failed" : "done", (record) => {
      const messages = asArray(record.messages).map((message) => {
        if (message?.taskId !== taskId || message.role !== "agent") {
          return message;
        }
        return {
          ...message,
          body,
          streamStatus: "finished"
        };
      });
      return {
        ...record,
        messages,
        activeAgentTaskId: "",
        executionFinishedAt: Date.now()
      };
    });
  }

  function getDaemonStatus() {
    const config = readConfig();
    return {
      running: daemonRunning,
      enabled: config.daemon.enabled !== false,
      autoStart: config.daemon.autoStart !== false,
      keepChannelsWarm: config.daemon.keepChannelsWarm !== false,
      startedAt: daemonStartedAt,
      uptimeMs: daemonStartedAt ? Date.now() - new Date(daemonStartedAt).getTime() : 0,
      cronTickMs: CRON_TICK_MS,
      events: daemonEvents.slice(0, 20)
    };
  }

  function startDaemon(options = {}) {
    if (daemonRunning) {
      return getSnapshot();
    }
    const config = readConfig();
    if (!options.manual && (config.daemon.enabled === false || config.daemon.autoStart === false)) {
      return getSnapshot();
    }
    config.daemon.enabled = true;
    daemonRunning = true;
    daemonStartedAt = new Date().toISOString();
    config.daemon.lastStartedAt = daemonStartedAt;
    saveConfig(config);
    startCronLoop();
    recordEvent("daemon_started", "Fiitx background platform daemon is running.");
    return getSnapshot();
  }

  function stopDaemon() {
    daemonRunning = false;
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
    }
    recordEvent("daemon_stopped", "Fiitx background platform daemon stopped.");
    return getSnapshot();
  }

  function startCronLoop() {
    if (cronTimer) {
      return;
    }
    cronTimer = setInterval(() => {
      tickCron().catch((error) => recordEvent("cron_tick_error", error instanceof Error ? error.message : String(error)));
    }, CRON_TICK_MS);
    setTimeout(() => {
      tickCron().catch((error) => recordEvent("cron_tick_error", error instanceof Error ? error.message : String(error)));
    }, 0);
  }

  function computeNextRun(job, from = Date.now()) {
    return new Date(from + Math.max(1, Number(job.everyMinutes || 60)) * 60 * 1000).toISOString();
  }

  function repairStaleCronJobs(config) {
    if (!config?.cronJobs?.length) {
      return config;
    }
    let changed = false;
    const now = new Date().toISOString();
    const cronJobs = config.cronJobs.map((job) => {
      if (job?.lastStatus !== "running" || runningCronIds.has(job.id)) {
        return job;
      }
      changed = true;
      return {
        ...job,
        lastStatus: "error",
        lastSummary: "上一次运行没有返回完成事件，已自动标记为中断。请重新手动执行。",
        nextRunAt: computeNextRun(job),
        updatedAt: now
      };
    });
    return changed ? saveConfig({ ...config, cronJobs }) : config;
  }

  async function runCronJob(job, reason = "scheduled") {
    if (!job?.prompt || runningCronIds.has(job.id)) {
      return;
    }
    runningCronIds.add(job.id);
    const startedAt = Date.now();
    const taskId = `cron-${job.id}-${startedAt}`;
    recordEvent("cron_run_started", `${job.name}: ${reason}`);
    ensureCronThread(job, taskId, reason);
    emitCronProgress(job, taskId, {
      title: reason === "manual" ? "手动执行" : "计划执行",
      detail: `${job.name || job.id} 已提交到后台运行。`,
      status: "running"
    });
    updateCronJob({
      ...job,
      lastRunAt: new Date(startedAt).toISOString(),
      lastStatus: "running",
      lastSummary: reason === "manual" ? "手动执行正在运行" : "计划执行正在运行"
    });
    try {
      if (typeof runAgentTask !== "function") {
        throw new Error("Agent runtime 未连接，无法执行 cron 任务");
      }
      const result = await runAgentTask({
        prompt: job.prompt,
        taskId,
        threadId: `cron-${job.id}`,
        channelId: job.channelId || "daemon-cron",
        model: job.model || "auto",
        workspacePath: job.workspacePath || "",
        permissionMode: asPermissionMode(job.permissionMode),
        cronJobId: job.id
      }, (progress) => emitCronProgress(job, taskId, progress));
      updateCronJob({
        ...job,
        lastRunAt: new Date().toISOString(),
        nextRunAt: computeNextRun(job),
        lastStatus: result?.ok === false ? "warn" : "success",
        lastSummary: clip(result?.summary || "Cron run finished.")
      });
      emitCronProgress(job, taskId, {
        title: result?.ok === false ? "执行完成但有警告" : "执行完成",
        detail: clip(result?.summary || "Cron run finished.", 500),
        status: "finished"
      });
      finishCronThread(job, taskId, result?.ok === false ? "warn" : "success", result?.summary || "Cron run finished.");
      recordEvent("cron_run_finished", `${job.name}: ${clip(result?.summary || "finished", 120)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateCronJob({
        ...job,
        lastRunAt: new Date().toISOString(),
        nextRunAt: computeNextRun(job),
        lastStatus: "error",
        lastSummary: message
      });
      emitCronProgress(job, taskId, {
        title: "执行异常",
        detail: message,
        status: "error"
      });
      finishCronThread(job, taskId, "error", message);
      recordEvent("cron_run_failed", `${job.name}: ${message}`);
    } finally {
      runningCronIds.delete(job.id);
    }
  }

  async function tickCron() {
    if (!daemonRunning) {
      return;
    }
    const config = readConfig();
    const now = Date.now();
    for (const job of config.cronJobs) {
      if (!job.enabled || !job.prompt) {
        continue;
      }
      const nextRunAt = new Date(job.nextRunAt || 0).getTime();
      if (Number.isFinite(nextRunAt) && nextRunAt <= now) {
        void runCronJob(job, "schedule");
      }
    }
  }

  function listCronJobs() {
    return repairStaleCronJobs(readConfig()).cronJobs;
  }

  function updateCronJob(payload = {}) {
    const job = normalizeCronJob(payload);
    if (!job) {
      throw new Error("Invalid cron job");
    }
    const config = readConfig();
    config.cronJobs = [
      { ...job, updatedAt: new Date().toISOString() },
      ...config.cronJobs.filter((item) => item.id !== job.id)
    ];
    return saveConfig(config).cronJobs.find((item) => item.id === job.id);
  }

  function removeCronJob(id) {
    const config = readConfig();
    config.cronJobs = config.cronJobs.filter((job) => job.id !== id);
    return saveConfig(config).cronJobs;
  }

  async function runCronJobNow(id) {
    const job = readConfig().cronJobs.find((item) => item.id === id);
    if (!job) {
      throw new Error(`Cron job not found: ${id}`);
    }
    if (!runningCronIds.has(job.id)) {
      void runCronJob(job, "manual");
    }
    return readConfig().cronJobs.find((item) => item.id === id);
  }

  function searchSessions({ query = "", limit = 20 } = {}) {
    const threadState = threadStore?.load?.() || {};
    const records = threadState.threadRecords || {};
    if (sessionLogStore?.search) {
      return sessionLogStore.search({ query, limit }).map((result) => {
        const threadRecord = records[result.threadId] || {};
        return {
          ...result,
          title: threadRecord.title || result.threadId,
          snippet: clip(result.snippet || threadRecord.title || result.threadId, 220)
        };
      });
    }
    return [];
  }

  function extractKeywords(text) {
    const words = String(text || "")
      .toLowerCase()
      .match(/[\p{L}\p{N}_-]{2,}/gu) || [];
    const counts = new Map();
    for (const word of words) {
      if (word.length > 24 || ["http", "https", "the", "and", "for", "with", "这个", "一个"].includes(word)) {
        continue;
      }
      counts.set(word, (counts.get(word) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word]) => word);
  }

  function learnSkillFromThread({ threadId, name } = {}) {
    const targetThreadId = String(threadId || "").trim();
    if (!targetThreadId) {
      throw new Error("threadId is required");
    }
    const entries = sessionLogStore?.read?.(targetThreadId) || [];
    const text = entries.map(stringifyEntry).filter(Boolean).join("\n\n");
    const title = String(name || `Learned ${targetThreadId}`).trim();
    const learned = normalizeLearnedSkill({
      id: `learned-${slugify(title)}-${Date.now()}`,
      name: title,
      description: clip(`Learned from ${targetThreadId}: ${text}`, 200),
      promptTemplate: [
        `# ${title}`,
        "",
        "Use this workflow when the task resembles the source thread.",
        "",
        "## Learned context",
        clip(text, 2400)
      ].join("\n"),
      sourceThreadId: targetThreadId,
      sourceCount: entries.length,
      keywords: extractKeywords(text),
      status: "draft"
    });
    const config = readConfig();
    config.learnedSkills = [learned, ...config.learnedSkills.filter((item) => item.id !== learned.id)];
    saveConfig(config);
    recordEvent("skill_learned", learned.name);
    return learned;
  }

  function materializeLearnedSkill(id) {
    const config = readConfig();
    const learned = config.learnedSkills.find((item) => item.id === id);
    if (!learned) {
      throw new Error(`Learned skill not found: ${id}`);
    }
    const root = path.join(learnedSkillRoot, learned.id);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "SKILL.md"), `${learned.promptTemplate}\n`, "utf8");
    const installed = skillMarketplace?.installLocalSkill?.({ root, id: learned.id, enabled: true });
    const nextLearned = { ...learned, root, status: "installed", updatedAt: new Date().toISOString() };
    config.learnedSkills = [nextLearned, ...config.learnedSkills.filter((item) => item.id !== id)];
    saveConfig(config);
    recordEvent("skill_installed", learned.name);
    return { learned: nextLearned, installed };
  }

  function removeLearnedSkill(id) {
    const config = readConfig();
    config.learnedSkills = config.learnedSkills.filter((item) => item.id !== id);
    return saveConfig(config).learnedSkills;
  }

  function updateProfileIsolation(profileIsolation = {}) {
    const config = readConfig();
    config.profileIsolation = normalizeProfileIsolation(profileIsolation);
    return saveConfig(config).profileIsolation;
  }

  function resolveProfileIsolation(payload = {}) {
    const isolation = readConfig().profileIsolation;
    if (!isolation.enabled) {
      return null;
    }
    const channelId = String(payload.channelId || payload.channelContext?.channelId || "");
    const intentMode = String(payload.intent?.mode || payload.mode || "");
    const workspace = String(payload.workspacePath || "");
    return isolation.profiles.find((profile) => {
      if (!profile.enabled) {
        return false;
      }
      const match = profile.match || {};
      const channelMatches = match.channelIds.length === 0 || match.channelIds.includes(channelId);
      const intentMatches = match.intentModes.length === 0 || match.intentModes.includes(intentMode);
      const workspaceMatches = !match.workspaceIncludes || workspace.includes(match.workspaceIncludes);
      return channelMatches && intentMatches && workspaceMatches;
    }) || null;
  }

  function applyProfileIsolation(payload = {}) {
    const selected = resolveProfileIsolation(payload);
    if (!selected) {
      return payload;
    }
    const model = selected.model && selected.model !== "auto" ? selected.model : payload.model;
    return {
      ...payload,
      model,
      profileIsolation: {
        id: selected.id,
        name: selected.name,
        model: selected.model
      }
    };
  }

  function getSnapshot() {
    const config = repairStaleCronJobs(readConfig());
    return {
      path: configPath,
      daemon: getDaemonStatus(),
      cronJobs: config.cronJobs,
      learnedSkills: config.learnedSkills,
      profileIsolation: config.profileIsolation,
      sessionIndex: {
        sessionCount: asArray(sessionLogStore?.listSessions?.()).length
      }
    };
  }

  return {
    applyProfileIsolation,
    getSnapshot,
    learnSkillFromThread,
    listCronJobs,
    materializeLearnedSkill,
    removeCronJob,
    removeLearnedSkill,
    runCronJobNow,
    searchSessions,
    startDaemon,
    stopDaemon,
    updateCronJob,
    updateProfileIsolation
  };
}

module.exports = {
  createAgentPlatformService
};
