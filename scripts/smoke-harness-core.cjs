const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { convertToLlm, createContextMessage, createLlmMessage, createToolResultMessage, transformContext } = require("../electron/services/agent-messages.cjs");
const { createConnectorRegistry } = require("../electron/services/connector-registry.cjs");
const { normalizeMessagesForProvider } = require("../electron/services/model-router.cjs");
const { createSessionLogStore } = require("../electron/services/session-log-store.cjs");
const { createTelemetryStore } = require("../electron/services/telemetry-store.cjs");
const { createToolRegistry } = require("../electron/services/tool-registry.cjs");

function createFakeApp(root) {
  return {
    getPath(name) {
      if (name === "userData") return root;
      return root;
    }
  };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deepsix-harness-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, "README.md"), "# Demo\n", "utf8");

  const agentMessages = [
    createLlmMessage("system", "system prompt"),
    createContextMessage("external_context", "external doc"),
    createLlmMessage("user", "hello"),
    createToolResultMessage({ id: "call-1", name: "workspace_ls" }, { ok: true })
  ];
  const llmMessages = convertToLlm(transformContext(agentMessages));
  assert.equal(llmMessages[0].role, "system");
  assert.ok(!llmMessages.some((message) => message.role === "tool"));
  assert.ok(llmMessages.some((message) => message.role === "user" && /历史工具结果/.test(message.content)));
  const providerMessages = normalizeMessagesForProvider([
    { role: "system", content: "system" },
    { role: "tool", name: "workspace_ls", content: "{\"ok\":true}" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          type: "function",
          function: {
            name: "workspace_read",
            arguments: "{\"path\":\"README.md\"}"
          }
        }
      ]
    },
    { role: "tool", content: "{\"content\":\"# Demo\"}" }
  ]);
  assert.equal(providerMessages[1].role, "user");
  assert.ok(providerMessages[2].tool_calls[0].id);
  assert.equal(providerMessages[3].role, "tool");
  assert.equal(providerMessages[3].tool_call_id, providerMessages[2].tool_calls[0].id);

  const toolRuntime = {
    listDirectory: async () => ({ entries: [{ name: "README.md" }] }),
    readWorkspaceFile: async () => ({ path: "README.md", content: "# Demo\n" }),
    writeWorkspaceFile: async () => ({ path: "out.txt", bytes: 2 }),
    editWorkspaceFile: async () => ({ path: "README.md", replacements: 1 }),
    grepWorkspace: async () => ({ matches: [] }),
    findWorkspaceFiles: async () => ({ files: [] }),
    runShell: async () => ({ exitCode: 0, stdout: "ok", stderr: "" })
  };
  const toolRegistry = createToolRegistry({ toolRuntime });
  assert.ok(toolRegistry.getOpenAiTools().some((tool) => tool.function.name === "workspace_read"));
  const ls = await toolRegistry.execute("workspace_ls", { path: "." }, { payload: { workspacePath: workspaceRoot } });
  assert.equal(ls.entries[0].name, "README.md");

  const connectorRegistry = createConnectorRegistry();
  assert.ok(connectorRegistry.listByCapability("guest.profile").length >= 1);
  assert.match(connectorRegistry.buildContextPrompt(), /Connector registry/);

  const sessionLogStore = createSessionLogStore({ app: createFakeApp(tempRoot) });
  const first = sessionLogStore.append("thread-a", { type: "message", content: "root" });
  const second = sessionLogStore.append("thread-a", { type: "message", content: "child" });
  sessionLogStore.appendBranch("thread-a", first.id, { type: "message", content: "branch" });
  const tree = sessionLogStore.getTree("thread-a");
  assert.equal(tree.count, 3);
  assert.ok(tree.branchPoints.some((item) => item.id === first.id));
  assert.equal(sessionLogStore.replay("thread-a", { toId: second.id }).length, 2);

  const telemetryStore = createTelemetryStore({ app: createFakeApp(tempRoot) });
  const runId = telemetryStore.startRun({ threadId: "thread-a", model: "mock" });
  telemetryStore.finishRun(runId, { ok: true, mode: "coding", provider: "mock", model: "mock", durationMs: 1 });
  assert.equal(telemetryStore.summarize().successful, 1);

  console.log("harness core smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
