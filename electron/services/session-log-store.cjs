const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function safeSessionId(value) {
  return String(value || "default")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "default";
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function createSessionLogStore({ app }) {
  function getStoreDir() {
    const dir = path.join(app.getPath("userData"), "deepsix-sessions");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getSessionPath(threadId) {
    return path.join(getStoreDir(), `${safeSessionId(threadId)}.jsonl`);
  }

  function read(threadId) {
    const file = getSessionPath(threadId);
    try {
      const raw = fs.readFileSync(file, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map(parseJsonLine)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function append(threadId, entry = {}) {
    const entries = read(threadId);
    const previous = entries[entries.length - 1];
    const now = new Date().toISOString();
    const next = {
      id: entry.id || crypto.randomUUID(),
      parentId: Object.prototype.hasOwnProperty.call(entry, "parentId")
        ? entry.parentId
        : previous?.id || null,
      threadId: threadId || entry.threadId || "default",
      createdAt: entry.createdAt || now,
      ...entry
    };

    fs.appendFileSync(getSessionPath(threadId), `${JSON.stringify(next)}\n`, "utf8");
    return next;
  }

  function appendBranch(threadId, parentId, entry = {}) {
    return append(threadId, {
      ...entry,
      parentId: parentId || null,
      branch: entry.branch || `branch-${Date.now()}`
    });
  }

  function appendMany(threadId, entries = []) {
    return entries.map((entry) => append(threadId, entry));
  }

  function appendCompact(threadId, summary, metadata = {}) {
    return append(threadId, {
      type: "compact",
      role: "system",
      content: summary,
      metadata
    });
  }

  function getTree(threadId) {
    const entries = read(threadId);
    const byId = new Map();
    const childrenByParent = new Map();
    for (const entry of entries) {
      byId.set(entry.id, entry);
      const parentId = entry.parentId || null;
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(entry);
    }
    const roots = childrenByParent.get(null) || [];
    const latest = entries[entries.length - 1] || null;
    const branchPoints = entries
      .filter((entry) => (childrenByParent.get(entry.id) || []).length > 1)
      .map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        childCount: (childrenByParent.get(entry.id) || []).length
      }));
    return {
      threadId,
      count: entries.length,
      latestId: latest?.id || null,
      roots,
      branchPoints,
      childrenByParent: Object.fromEntries([...childrenByParent.entries()].map(([key, value]) => [key || "root", value]))
    };
  }

  function replay(threadId, options = {}) {
    const entries = read(threadId);
    if (entries.length === 0) {
      return [];
    }
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const targetId = options.toId || entries[entries.length - 1]?.id;
    const chain = [];
    let cursor = byId.get(targetId) || entries[entries.length - 1];
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.push(cursor);
      if (options.fromId && cursor.id === options.fromId) {
        break;
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
    }
    const ordered = chain.reverse();
    if (!options.visibility) {
      return ordered;
    }
    return ordered.filter((entry) => entry.visibility === options.visibility || entry.agentMessage?.visibility === options.visibility);
  }

  function listSessions() {
    try {
      return fs
        .readdirSync(getStoreDir(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
        .map((entry) => {
          const threadId = entry.name.replace(/\.jsonl$/, "");
          const file = path.join(getStoreDir(), entry.name);
          const stat = fs.statSync(file);
          return {
            threadId,
            path: file,
            size: stat.size,
            updatedAt: stat.mtime.toISOString()
          };
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    } catch {
      return [];
    }
  }

  return {
    append,
    appendBranch,
    appendCompact,
    appendMany,
    getTree,
    listSessions,
    replay,
    read
  };
}

module.exports = {
  createSessionLogStore
};
