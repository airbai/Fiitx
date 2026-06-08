const fs = require("node:fs");
const path = require("node:path");

const STATE_VERSION = 1;

function createEmptyState() {
  return {
    version: STATE_VERSION,
    activeThreadId: "",
    workspacePath: "",
    threads: [],
    projectFolders: [],
    rootThreadIds: [],
    threadRecords: {},
    approvals: [],
    auditLogs: []
  };
}

function createThreadStore({ app }) {
  const statePath = path.join(app.getPath("userData"), "fiitx-thread-state.json");

  function load() {
    if (!fs.existsSync(statePath)) {
      return createEmptyState();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      return {
        ...createEmptyState(),
        ...parsed,
        version: STATE_VERSION,
        threads: Array.isArray(parsed.threads) ? parsed.threads : [],
        projectFolders: Array.isArray(parsed.projectFolders) ? parsed.projectFolders : [],
        rootThreadIds: Array.isArray(parsed.rootThreadIds) ? parsed.rootThreadIds : [],
        threadRecords: parsed.threadRecords && typeof parsed.threadRecords === "object" ? parsed.threadRecords : {},
        approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : []
      };
    } catch {
      return createEmptyState();
    }
  }

  function save(payload) {
    const nextState = {
      ...createEmptyState(),
      ...payload,
      version: STATE_VERSION,
      savedAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const tempPath = `${statePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(nextState, null, 2), "utf8");
    fs.renameSync(tempPath, statePath);
    return {
      ok: true,
      path: statePath,
      savedAt: nextState.savedAt
    };
  }

  return {
    load,
    save
  };
}

module.exports = {
  createThreadStore
};
