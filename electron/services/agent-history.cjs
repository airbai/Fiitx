const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const FAILURE_PATTERNS = [
  /failed/i,
  /error/i,
  /exception/i,
  /timeout/i,
  /失败/,
  /异常/,
  /报错/,
  /未完成/,
  /不存在/,
  /未落盘/,
  /尚未找到可用模型/,
  /需要审批/
];

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 12);
}

function safeFilePart(value) {
  return String(value || "thread")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "thread";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function clip(value, limit = 600) {
  const text = toText(value).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function timeOf(entry) {
  return entry?.createdAt || entry?.time || entry?.updatedAt || "";
}

function normalizeRecord(record = {}) {
  return {
    messages: asArray(record.messages),
    progressEvents: asArray(record.progressEvents),
    artifacts: asArray(record.artifacts),
    executionArtifacts: asArray(record.executionArtifacts),
    sessionEntries: asArray(record.sessionEntries),
    lastAgentArtifact: record.lastAgentArtifact || null,
    activeAgentTaskId: record.activeAgentTaskId || "",
    executionStartedAt: record.executionStartedAt || null,
    executionFinishedAt: record.executionFinishedAt || null
  };
}

function extractEntryText(entry) {
  return [
    entry?.content,
    entry?.reasoning_content,
    entry?.reasoningContent,
    entry?.message,
    entry?.summary,
    entry?.errorMessage,
    entry?.title,
    entry?.detail,
    entry?.target,
    entry?.toolName,
    entry?.type,
    entry?.event,
    entry?.payload
  ].map(toText).filter(Boolean).join(" ");
}

function extractToolNames(sessionLog, telemetry) {
  const names = new Set();
  for (const entry of sessionLog) {
    if (entry.toolName) {
      names.add(String(entry.toolName));
    }
    for (const call of asArray(entry.toolCalls)) {
      if (call?.name) {
        names.add(String(call.name));
      }
      if (call?.function?.name) {
        names.add(String(call.function.name));
      }
    }
  }
  for (const event of telemetry) {
    if (event.toolName) {
      names.add(String(event.toolName));
    }
    for (const tool of asArray(event.tools)) {
      names.add(String(tool));
    }
  }
  return [...names].sort();
}

function buildTimeline({ record, sessionLog, telemetry }) {
  const rows = [];

  for (const message of record.messages) {
    rows.push({
      id: message.id || `message-${rows.length}`,
      time: message.time || "",
      source: "message",
      status: message.role === "agent" ? "info" : "running",
      title: `${message.author || message.role || "Message"}`,
      detail: clip(message.body, 500),
      raw: message
    });
  }

  for (const event of record.progressEvents) {
    rows.push({
      id: event.id || `progress-${rows.length}`,
      time: event.time || "",
      source: "progress",
      status: event.status || "info",
      title: event.title || "Progress",
      detail: clip(event.detail, 500),
      raw: event
    });
  }

  for (const entry of record.sessionEntries) {
    rows.push({
      id: entry.id || `entry-${rows.length}`,
      time: entry.time || "",
      source: "ui-session",
      status: entry.kind === "approval" ? "warn" : "info",
      title: `UI ${entry.kind || "entry"}`,
      detail: clip(entry.payload, 500),
      raw: entry
    });
  }

  for (const entry of sessionLog) {
    rows.push({
      id: entry.id || `session-${rows.length}`,
      time: entry.createdAt || "",
      source: "runtime-session",
      status: entry.type === "error" ? "warn" : entry.type === "tool_result" ? "success" : "info",
      title: entry.toolName || entry.type || entry.role || "Session",
      detail: clip(extractEntryText(entry), 500),
      raw: entry
    });
  }

  for (const event of telemetry) {
    rows.push({
      id: event.id || `telemetry-${rows.length}`,
      time: event.createdAt || "",
      source: "telemetry",
      status: event.ok === false || event.type === "error" ? "warn" : event.type === "run_end" ? "success" : "info",
      title: event.type || "Telemetry",
      detail: clip(event.errorMessage || event.model || event.provider || event.toolName || event.intent, 500),
      raw: event
    });
  }

  return rows.sort((left, right) => {
    const leftTime = Date.parse(left.time || "") || 0;
    const rightTime = Date.parse(right.time || "") || 0;
    return leftTime - rightTime;
  });
}

function artifactExists(artifact, workspacePath) {
  const artifactPath = artifact?.path;
  if (!artifactPath || /^(https?:|wechat:|artifact:)/i.test(String(artifactPath))) {
    return true;
  }
  const candidate = path.isAbsolute(artifactPath)
    ? artifactPath
    : workspacePath
      ? path.resolve(workspacePath, artifactPath)
      : "";
  return candidate ? fs.existsSync(candidate) : true;
}

function analyzeTrace({ thread, record, sessionLog, telemetry, state }) {
  const allText = [
    thread?.title,
    thread?.kind,
    ...record.messages.map((message) => message.body),
    ...record.progressEvents.map((event) => `${event.title} ${event.detail}`),
    ...sessionLog.map(extractEntryText),
    ...telemetry.map(extractEntryText)
  ].join("\n");

  const warnings = record.progressEvents.filter((event) => event.status === "warn").length
    + telemetry.filter((event) => event.ok === false || event.type === "error").length
    + sessionLog.filter((entry) => entry.type === "error").length;
  const missingArtifacts = [...record.artifacts, ...record.executionArtifacts]
    .filter((artifact) => !artifactExists(artifact, thread?.workspacePath || state.workspacePath));
  const pendingApprovals = asArray(state.approvals).filter((approval) => approval.status === "pending").length;
  const hasFailureText = FAILURE_PATTERNS.some((pattern) => pattern.test(allText));
  const latestProgress = record.progressEvents[record.progressEvents.length - 1];
  const runEnd = telemetry.filter((event) => event.type === "run_end").slice(-1)[0];

  const findings = [];
  if (/尚未找到可用模型/.test(allText)) {
    findings.push("模型路由没有找到可用 profile，任务在真正调用模型前结束。");
  }
  if (/未落盘|不存在/.test(allText) || missingArtifacts.length > 0) {
    findings.push("结果中出现本地文件不存在或未落盘迹象，需要检查 file manifest 和写入工具链。");
  }
  if (pendingApprovals > 0 || /需要审批/.test(allText)) {
    findings.push("任务存在待审批步骤，UI 不应直接标记为完成。");
  }
  if (warnings > 0) {
    findings.push(`Trace 中发现 ${warnings} 个 warning/error 事件。`);
  }
  if (record.messages.length > 0 && record.artifacts.length === 0 && /coding|代码|实现|修复|创建/i.test(allText)) {
    findings.push("这是编码类任务，但当前线程没有记录可展示的产物。");
  }
  if (findings.length === 0) {
    findings.push("未发现明确失败信号，建议以 artifact、diff 或运行日志作为完成判定。");
  }

  const nextActions = [];
  if (/尚未找到可用模型/.test(allText)) {
    nextActions.push("在模型中心保存可用 API Key，或关闭自动路由后选择明确模型。");
  }
  if (/未落盘|不存在/.test(allText) || missingArtifacts.length > 0) {
    nextActions.push("重新执行时要求 Agent 输出完整 file manifest，并在写入后立即读取校验目标文件。");
  }
  if (pendingApprovals > 0 || /需要审批/.test(allText)) {
    nextActions.push("把待审批状态纳入任务状态机：pending approval 应显示为未完成。");
  }
  nextActions.push("打开 Trace 时间线核对最后一个 tool_result、artifact 和 run_end 是否一致。");

  const status = thread?.status === "waiting" || latestProgress?.status === "warn" || runEnd?.ok === false || hasFailureText
    ? "needs-review"
    : "complete";

  return {
    status,
    headline: status === "complete" ? "任务看起来已完成" : "任务需要复盘",
    findings,
    nextActions,
    metrics: {
      messages: record.messages.length,
      progressEvents: record.progressEvents.length,
      sessionEntries: record.sessionEntries.length,
      runtimeEntries: sessionLog.length,
      telemetryEvents: telemetry.length,
      artifacts: record.artifacts.length + record.executionArtifacts.length,
      warnings,
      missingArtifacts: missingArtifacts.length,
      pendingApprovals
    }
  };
}

function buildPromptVersions(state) {
  const now = state.savedAt || new Date().toISOString();
  const agents = asArray(state.agentSpecs).map((agent) => ({
    id: `agent-${agent.id || stableHash(agent)}`,
    type: "agent",
    name: agent.name || agent.id || "Unnamed Agent",
    version: stableHash(agent),
    updatedAt: now,
    body: agent.systemPrompt || agent.objective || "",
    metadata: {
      model: agent.model,
      policy: agent.policy,
      status: agent.status,
      tools: asArray(agent.tools),
      skills: asArray(agent.skills)
    }
  }));
  const channels = asArray(state.channelAdapters).map((adapter) => ({
    id: `channel-${adapter.id || stableHash(adapter)}`,
    type: "channel",
    name: adapter.name || adapter.id || "Unnamed Channel",
    version: stableHash(adapter),
    updatedAt: now,
    body: adapter.systemPrompt || adapter.description || "",
    metadata: {
      channelType: adapter.channelType,
      status: adapter.status,
      capabilities: asArray(adapter.capabilities),
      agentBindings: asArray(adapter.agentBindings)
    }
  }));
  return [...agents, ...channels];
}

function buildPolicyVersions(state) {
  const policy = state.policySettings || {};
  return [{
    id: "policy-current",
    type: "policy",
    name: "当前 Policy Gate",
    version: stableHash(policy),
    updatedAt: state.savedAt || new Date().toISOString(),
    body: JSON.stringify(policy, null, 2),
    metadata: {
      defaultPermissionMode: policy.defaultPermissionMode,
      sandboxMode: policy.sandboxMode,
      toolExecution: policy.toolExecution
    }
  }];
}

function buildRunRows(telemetry) {
  const startsByRun = new Map();
  for (const event of telemetry) {
    if (event.type === "run_start") {
      startsByRun.set(event.runId, event);
    }
  }
  return telemetry
    .filter((event) => event.type === "run_end")
    .map((end) => {
      const start = startsByRun.get(end.runId) || {};
      return {
        runId: end.runId,
        threadId: start.threadId || end.threadId || "",
        taskId: start.taskId || end.taskId || "",
        ok: Boolean(end.ok),
        mode: end.mode || start.intent?.mode || "",
        provider: end.provider || start.provider || "",
        model: end.model || start.model || "",
        startedAt: start.createdAt || "",
        endedAt: end.createdAt || "",
        durationMs: end.durationMs || 0,
        artifactPath: end.artifactPath || "",
        errorMessage: end.errorMessage || ""
      };
    })
    .sort((left, right) => (Date.parse(right.endedAt) || 0) - (Date.parse(left.endedAt) || 0));
}

function buildMarkdownSummary(trace) {
  const lines = [
    `# Fiitx Agent Audit Package`,
    ``,
    `- Thread: ${trace.thread?.title || trace.threadId}`,
    `- Thread ID: ${trace.threadId}`,
    `- Status: ${trace.analysis.status}`,
    `- Generated At: ${new Date().toISOString()}`,
    ``,
    `## Findings`,
    ...trace.analysis.findings.map((item) => `- ${item}`),
    ``,
    `## Next Actions`,
    ...trace.analysis.nextActions.map((item) => `- ${item}`),
    ``,
    `## Metrics`,
    ...Object.entries(trace.analysis.metrics).map(([key, value]) => `- ${key}: ${value}`),
    ``,
    `## Timeline`,
    ...trace.timeline.slice(-80).map((item) => `- ${item.time || "n/a"} [${item.source}] ${item.title}: ${item.detail}`)
  ];
  return `${lines.join("\n")}\n`;
}

function createAgentHistoryService({ app, sessionLogStore, telemetryStore, threadStore }) {
  function getHistoryDir() {
    const dir = path.join(app.getPath("userData"), "fiitx-agent-history");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getVersionHistoryPath() {
    return path.join(getHistoryDir(), "version-history.json");
  }

  function readVersionHistory() {
    try {
      const parsed = JSON.parse(fs.readFileSync(getVersionHistoryPath(), "utf8"));
      return {
        versions: asArray(parsed.versions)
      };
    } catch {
      return { versions: [] };
    }
  }

  function recordVersionSnapshots(state) {
    const history = readVersionHistory();
    const current = [...buildPromptVersions(state), ...buildPolicyVersions(state)];
    const seen = new Set(history.versions.map((item) => `${item.type}:${item.id}:${item.version}`));
    const observedAt = new Date().toISOString();
    const additions = current
      .filter((item) => !seen.has(`${item.type}:${item.id}:${item.version}`))
      .map((item) => ({
        ...item,
        observedAt
      }));

    if (additions.length > 0) {
      const next = {
        versions: [...history.versions, ...additions].slice(-500)
      };
      fs.writeFileSync(getVersionHistoryPath(), JSON.stringify(next, null, 2), "utf8");
      return next;
    }

    return history;
  }

  function loadState() {
    return threadStore.load();
  }

  function readTelemetry(limit = 1000) {
    return telemetryStore.read(limit);
  }

  function telemetryForThread(threadId, events) {
    const runThread = new Map();
    for (const event of events) {
      if (event.runId && event.threadId) {
        runThread.set(event.runId, event.threadId);
      }
    }
    return events.filter((event) => event.threadId === threadId || (event.runId && runThread.get(event.runId) === threadId));
  }

  function getTrace(payload = {}) {
    const threadId = payload.threadId || payload.taskId || payload.sessionId || "default";
    const state = loadState();
    const versionHistory = recordVersionSnapshots(state);
    const thread = asArray(state.threads).find((item) => item.id === threadId) || null;
    const record = normalizeRecord(state.threadRecords?.[threadId]);
    const sessionLog = sessionLogStore.read(threadId);
    const telemetry = telemetryForThread(threadId, readTelemetry(payload.limit || 1200));
    const timeline = buildTimeline({ record, sessionLog, telemetry });
    const analysis = analyzeTrace({ thread, record, sessionLog, telemetry, state });
    const toolNames = extractToolNames(sessionLog, telemetry);

    return {
      threadId,
      generatedAt: new Date().toISOString(),
      thread,
      record,
      sessionLog,
      telemetry,
      timeline,
      analysis,
      toolNames,
      promptVersions: versionHistory.versions.filter((item) => item.type === "agent" || item.type === "channel"),
      policyVersions: versionHistory.versions.filter((item) => item.type === "policy")
    };
  }

  function getSnapshot(payload = {}) {
    const limit = payload.limit || 1000;
    const state = loadState();
    const versionHistory = recordVersionSnapshots(state);
    const telemetry = readTelemetry(limit);
    const sessions = sessionLogStore.listSessions();
    const rowsByThread = new Map();

    for (const thread of asArray(state.threads)) {
      const record = normalizeRecord(state.threadRecords?.[thread.id]);
      rowsByThread.set(thread.id, {
        id: thread.id,
        title: thread.title || thread.id,
        kind: thread.kind || "Task",
        status: thread.status || "waiting",
        model: thread.model || "",
        updatedAt: thread.updatedAt || "",
        createdAt: thread.createdAt || 0,
        workspacePath: thread.workspacePath || state.workspacePath || "",
        messageCount: record.messages.length,
        progressCount: record.progressEvents.length,
        artifactCount: record.artifacts.length + record.executionArtifacts.length,
        sessionEntryCount: record.sessionEntries.length,
        lastProgressStatus: record.progressEvents[record.progressEvents.length - 1]?.status || "",
        lastProgressTitle: record.progressEvents[record.progressEvents.length - 1]?.title || ""
      });
    }

    for (const session of sessions) {
      if (!rowsByThread.has(session.threadId)) {
        rowsByThread.set(session.threadId, {
          id: session.threadId,
          title: session.threadId,
          kind: "Runtime Session",
          status: "done",
          model: "",
          updatedAt: session.updatedAt,
          createdAt: Date.parse(session.updatedAt) || 0,
          workspacePath: state.workspacePath || "",
          messageCount: 0,
          progressCount: 0,
          artifactCount: 0,
          sessionEntryCount: 0,
          lastProgressStatus: "",
          lastProgressTitle: ""
        });
      }
    }

    const runRows = buildRunRows(telemetry);
    const failedRuns = runRows.filter((run) => !run.ok).length;

    return {
      generatedAt: new Date().toISOString(),
      workspacePath: state.workspacePath || "",
      activeThreadId: state.activeThreadId || "",
      threads: [...rowsByThread.values()].sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt) || left.createdAt || 0;
        const rightTime = Date.parse(right.updatedAt) || right.createdAt || 0;
        return rightTime - leftTime;
      }),
      sessions,
      telemetrySummary: telemetryStore.summarize(limit),
      recentRuns: runRows,
      failedRuns,
      promptVersions: versionHistory.versions.filter((item) => item.type === "agent" || item.type === "channel"),
      policyVersions: versionHistory.versions.filter((item) => item.type === "policy")
    };
  }

  function compareRuns(payload = {}) {
    const left = getTrace({ threadId: payload.leftThreadId, limit: payload.limit });
    const right = getTrace({ threadId: payload.rightThreadId, limit: payload.limit });
    const leftMetrics = left.analysis.metrics;
    const rightMetrics = right.analysis.metrics;
    const metricKeys = [...new Set([...Object.keys(leftMetrics), ...Object.keys(rightMetrics)])];
    const toolsLeft = new Set(left.toolNames);
    const toolsRight = new Set(right.toolNames);
    const leftArtifacts = asArray(left.record.artifacts).concat(asArray(left.record.executionArtifacts)).map((item) => item.path || item.title || "");
    const rightArtifacts = asArray(right.record.artifacts).concat(asArray(right.record.executionArtifacts)).map((item) => item.path || item.title || "");

    return {
      generatedAt: new Date().toISOString(),
      left,
      right,
      diff: {
        summary: [
          `左侧：${left.thread?.title || left.threadId} (${left.analysis.status})`,
          `右侧：${right.thread?.title || right.threadId} (${right.analysis.status})`,
          left.analysis.status === right.analysis.status ? "状态一致" : "状态不一致，需要比较最后阶段事件"
        ],
        metrics: metricKeys.map((key) => ({
          key,
          left: leftMetrics[key] || 0,
          right: rightMetrics[key] || 0,
          delta: (rightMetrics[key] || 0) - (leftMetrics[key] || 0)
        })),
        tools: {
          leftOnly: [...toolsLeft].filter((item) => !toolsRight.has(item)),
          rightOnly: [...toolsRight].filter((item) => !toolsLeft.has(item)),
          shared: [...toolsLeft].filter((item) => toolsRight.has(item))
        },
        artifacts: {
          leftOnly: leftArtifacts.filter((item) => item && !rightArtifacts.includes(item)),
          rightOnly: rightArtifacts.filter((item) => item && !leftArtifacts.includes(item)),
          shared: leftArtifacts.filter((item) => item && rightArtifacts.includes(item))
        },
        failures: {
          left: left.analysis.findings,
          right: right.analysis.findings
        }
      }
    };
  }

  function exportAuditPackage(payload = {}) {
    const trace = getTrace(payload);
    const downloads = (() => {
      try {
        return app.getPath("downloads");
      } catch {
        return app.getPath("documents") || app.getPath("userData");
      }
    })();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(downloads, "fiitx-audit-exports", `${safeFilePart(trace.threadId)}-${timestamp}`);
    fs.mkdirSync(dir, { recursive: true });

    const files = [
      ["summary.md", buildMarkdownSummary(trace)],
      ["trace.json", JSON.stringify(trace, null, 2)],
      ["session-log.jsonl", trace.sessionLog.map((entry) => JSON.stringify(entry)).join("\n") + (trace.sessionLog.length ? "\n" : "")],
      ["telemetry.json", JSON.stringify(trace.telemetry, null, 2)],
      ["thread-state.json", JSON.stringify({ thread: trace.thread, record: trace.record }, null, 2)],
      ["prompt-policy-versions.json", JSON.stringify({ promptVersions: trace.promptVersions, policyVersions: trace.policyVersions }, null, 2)]
    ];

    for (const [name, content] of files) {
      fs.writeFileSync(path.join(dir, name), content, "utf8");
    }

    return {
      ok: true,
      path: dir,
      files: files.map(([name]) => path.join(dir, name)),
      generatedAt: trace.generatedAt
    };
  }

  return {
    compareRuns,
    exportAuditPackage,
    getSnapshot,
    getTrace
  };
}

module.exports = {
  createAgentHistoryService
};
