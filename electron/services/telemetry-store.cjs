const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function createTelemetryStore({ app }) {
  function getStoreDir() {
    const dir = path.join(app.getPath("userData"), "deepsix-telemetry");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getEventsPath() {
    return path.join(getStoreDir(), "events.jsonl");
  }

  function append(event = {}) {
    const next = {
      id: event.id || crypto.randomUUID(),
      runId: event.runId || "global",
      type: event.type || "event",
      createdAt: event.createdAt || new Date().toISOString(),
      ...event
    };
    fs.appendFileSync(getEventsPath(), `${JSON.stringify(next)}\n`, "utf8");
    return next;
  }

  function startRun(input = {}) {
    const runId = input.runId || crypto.randomUUID();
    append({
      runId,
      type: "run_start",
      threadId: input.threadId,
      taskId: input.taskId,
      intent: input.intent,
      provider: input.provider,
      model: input.model,
      channelId: input.channelId
    });
    return runId;
  }

  function finishRun(runId, result = {}) {
    return append({
      runId,
      type: "run_end",
      ok: Boolean(result.ok),
      mode: result.mode,
      provider: result.provider,
      model: result.model,
      errorMessage: result.errorMessage || "",
      artifactPath: result.artifact?.path || "",
      durationMs: result.durationMs
    });
  }

  function read(limit = 500) {
    try {
      const lines = fs.readFileSync(getEventsPath(), "utf8").split(/\r?\n/).filter(Boolean);
      return lines.slice(-limit).map(parseJsonLine).filter(Boolean);
    } catch {
      return [];
    }
  }

  function summarize(limit = 500) {
    const events = read(limit);
    const runs = events.filter((event) => event.type === "run_end");
    const successful = runs.filter((event) => event.ok).length;
    const failed = runs.length - successful;
    const byMode = {};
    const byProvider = {};
    for (const run of runs) {
      byMode[run.mode || "unknown"] = (byMode[run.mode || "unknown"] || 0) + 1;
      byProvider[run.provider || "unknown"] = (byProvider[run.provider || "unknown"] || 0) + 1;
    }
    return {
      totalRuns: runs.length,
      successful,
      failed,
      successRate: runs.length ? successful / runs.length : 0,
      byMode,
      byProvider
    };
  }

  return {
    append,
    finishRun,
    read,
    startRun,
    summarize
  };
}

module.exports = {
  createTelemetryStore
};
