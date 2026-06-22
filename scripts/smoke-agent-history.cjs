const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createAgentHistoryService } = require("../electron/services/agent-history.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "fiitx-agent-history-"));
const downloads = path.join(root, "Downloads");
fs.mkdirSync(downloads, { recursive: true });

const app = {
  getPath(name) {
    if (name === "downloads") {
      return downloads;
    }
    return root;
  }
};

const state = {
  workspacePath: root,
  activeThreadId: "thread-a",
  savedAt: "2026-06-22T10:00:00.000Z",
  threads: [
    {
      id: "thread-a",
      title: "Trace smoke",
      kind: "Coding",
      status: "waiting",
      model: "deepseek-v4-flash",
      updatedAt: "2026-06-22T10:01:00.000Z",
      createdAt: Date.now(),
      workspacePath: root
    },
    {
      id: "thread-b",
      title: "Trace baseline",
      kind: "Chat",
      status: "done",
      model: "deepseek-v4-flash",
      updatedAt: "2026-06-22T09:01:00.000Z",
      createdAt: Date.now() - 1000,
      workspacePath: root
    }
  ],
  threadRecords: {
    "thread-a": {
      messages: [{ id: "m1", role: "user", author: "你", body: "修复文件不存在问题", time: "2026-06-22T10:00:01.000Z" }],
      progressEvents: [{ id: "p1", status: "warn", title: "执行异常", detail: "结果文件不存在", time: "2026-06-22T10:00:02.000Z" }],
      artifacts: [],
      executionArtifacts: [],
      sessionEntries: [{ id: "s1", kind: "progress", time: "2026-06-22T10:00:02.000Z", payload: { title: "执行异常" } }]
    },
    "thread-b": {
      messages: [{ id: "m2", role: "agent", author: "Agent", body: "done", time: "2026-06-22T09:00:01.000Z" }],
      progressEvents: [],
      artifacts: [],
      executionArtifacts: [],
      sessionEntries: []
    }
  },
  agentSpecs: [
    {
      id: "coding-agent",
      name: "Coding Agent",
      systemPrompt: "Edit files and verify results.",
      status: "active",
      tools: ["workspace.read", "workspace.write"]
    }
  ],
  channelAdapters: [
    {
      id: "desktop",
      name: "Fiitx Workbench",
      systemPrompt: "Route desktop messages.",
      status: "active"
    }
  ],
  policySettings: {
    defaultPermissionMode: "ask",
    sandboxMode: "workspace-write",
    toolExecution: "sequential",
    actionModes: {
      "workspace.scan": "ask"
    }
  },
  approvals: [{ id: "approval-1", status: "pending" }]
};

const sessionLog = {
  "thread-a": [
    { id: "log-1", type: "message", role: "user", content: "修复文件不存在问题", createdAt: "2026-06-22T10:00:01.000Z" },
    { id: "log-2", type: "tool_result", toolName: "workspace_read", content: "文件不存在", createdAt: "2026-06-22T10:00:02.000Z" }
  ],
  "thread-b": [
    { id: "log-3", type: "message", role: "assistant", content: "done", createdAt: "2026-06-22T09:00:01.000Z" }
  ]
};

const telemetry = [
  { id: "t1", runId: "run-a", type: "run_start", threadId: "thread-a", taskId: "task-a", model: "deepseek-v4-flash", provider: "DeepSeek", createdAt: "2026-06-22T10:00:00.000Z" },
  { id: "t2", runId: "run-a", type: "run_end", ok: false, model: "deepseek-v4-flash", provider: "DeepSeek", errorMessage: "文件不存在", createdAt: "2026-06-22T10:00:03.000Z" },
  { id: "t3", runId: "run-b", type: "run_start", threadId: "thread-b", taskId: "task-b", model: "deepseek-v4-flash", provider: "DeepSeek", createdAt: "2026-06-22T09:00:00.000Z" },
  { id: "t4", runId: "run-b", type: "run_end", ok: true, model: "deepseek-v4-flash", provider: "DeepSeek", createdAt: "2026-06-22T09:00:03.000Z" }
];

const service = createAgentHistoryService({
  app,
  threadStore: {
    load: () => state
  },
  sessionLogStore: {
    read: (threadId) => sessionLog[threadId] || [],
    listSessions: () => Object.keys(sessionLog).map((threadId) => ({ threadId, path: `${threadId}.jsonl`, size: 10, updatedAt: "2026-06-22T10:00:00.000Z" }))
  },
  telemetryStore: {
    read: () => telemetry,
    summarize: () => ({ totalRuns: 2, successful: 1, failed: 1, successRate: 0.5 })
  }
});

const snapshot = service.getSnapshot();
assert.equal(snapshot.threads.length, 2);
assert.equal(snapshot.failedRuns, 1);
assert.ok(snapshot.promptVersions.length >= 2);
assert.ok(snapshot.policyVersions.length >= 1);

const trace = service.getTrace({ threadId: "thread-a" });
assert.equal(trace.analysis.status, "needs-review");
assert.ok(trace.timeline.length >= 5);
assert.ok(trace.analysis.findings.some((item) => item.includes("不存在") || item.includes("未落盘")));

const compare = service.compareRuns({ leftThreadId: "thread-b", rightThreadId: "thread-a" });
assert.ok(compare.diff.metrics.length > 0);
assert.ok(compare.diff.summary.some((line) => line.includes("状态")));

const exported = service.exportAuditPackage({ threadId: "thread-a" });
assert.equal(exported.ok, true);
assert.ok(fs.existsSync(path.join(exported.path, "summary.md")));
assert.ok(fs.existsSync(path.join(exported.path, "trace.json")));

console.log("agent history smoke ok");
