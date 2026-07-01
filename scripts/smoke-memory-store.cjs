const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMemoryStore } = require("../electron/services/memory-store.cjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fiitx-memory-"));
const app = {
  getPath(name) {
    assert.equal(name, "userData");
    return tmp;
  }
};

const fakeSessionEntries = [
  {
    type: "message",
    role: "user",
    content: "记住：Fiitx 默认优先使用硅基流动生成图片。"
  },
  {
    type: "message",
    role: "assistant",
    summary: "已写入 outputs/demo/index.html，并配置为演示首页。"
  }
];

const sessionLogStore = {
  read(threadId) {
    assert.equal(threadId, "thread-a");
    return fakeSessionEntries;
  },
  listSessions() {
    return [{ threadId: "thread-b", updatedAt: new Date().toISOString(), size: 128 }];
  },
  search({ query, limit, excludeThreadId }) {
    assert.match(query, /Fiitx|产品|问题/);
    assert.equal(limit, 3);
    assert.equal(excludeThreadId, "thread-a");
    return [
      {
        threadId: "thread-b",
        updatedAt: new Date().toISOString(),
        entryCount: 2,
        score: 5,
        snippet: "上一轮讨论过 Fiitx 产品介绍和默认中文回复。"
      }
    ];
  }
};

const memoryStore = createMemoryStore({ app, sessionLogStore, maxEntries: 20 });

const manual = memoryStore.remember({
  text: "记住：用户偏好使用中文回答 Fiitx 产品问题。",
  workspacePath: "/tmp/workspace",
  channelId: "fiitx-workbench",
  threadId: "thread-a",
  confidence: 0.9
});
assert.ok(manual?.id);

const profileEntries = memoryStore.recordRun({
  payload: {
    prompt: "我叫bryan",
    workspacePath: "/tmp/workspace",
    channelId: "fiitx-workbench",
    threadId: "thread-a"
  },
  result: {
    ok: true,
    summary: "好的，Bryan。"
  }
});
assert.ok(profileEntries.some((entry) => entry.kind === "user_profile"));

const recalled = memoryStore.recall("Fiitx 中文回答", {
  workspacePath: "/tmp/workspace",
  channelId: "fiitx-workbench",
  threadId: "thread-a"
});
assert.ok(recalled.length >= 1);
assert.match(recalled[0].text, /中文回答|Fiitx/);

const prompt = memoryStore.buildContextPrompt({
  prompt: "Fiitx 产品问题应该怎么回答？",
  workspacePath: "/tmp/workspace",
  channelId: "fiitx-workbench",
  threadId: "thread-a"
});
assert.match(prompt, /long-term memory/);
assert.match(prompt, /USER PROFILE|MEMORY snapshot/);
assert.match(prompt, /SESSION SEARCH/);
assert.match(prompt, /当前用户输入/);

const extracted = memoryStore.extractFromSession("thread-a", {
  workspacePath: "/tmp/workspace",
  channelId: "fiitx-workbench"
});
assert.ok(extracted.length >= 1);

const snapshot = memoryStore.getSnapshot();
assert.ok(snapshot.count >= 2);
assert.ok(snapshot.byKind.user_profile >= 1);
assert.ok(snapshot.byKind.user_preference >= 1 || snapshot.byKind.artifact >= 1);
assert.equal(snapshot.layers.curatedMemory.memoryLimit, 2200);
assert.equal(snapshot.layers.sessionSearch.sessionCount, 1);
assert.ok(snapshot.layers.provider.providers.length >= 1);

console.log("memory-store smoke ok");
