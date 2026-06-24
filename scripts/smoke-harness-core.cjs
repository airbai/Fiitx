const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { convertToLlm, createContextMessage, createLlmMessage, createToolResultMessage, transformContext } = require("../electron/services/agent-messages.cjs");
const { createConnectorRegistry } = require("../electron/services/connector-registry.cjs");
const { createModelRouter, normalizeMessagesForProvider } = require("../electron/services/model-router.cjs");
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
    createLlmMessage("assistant", "", {
      reasoningContent: "需要先读取 README。",
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name: "workspace_ls",
            arguments: "{\"path\":\".\"}"
          }
        }
      ]
    }),
    createToolResultMessage({ id: "call-1", name: "workspace_ls" }, { ok: true })
  ];
  const llmMessages = convertToLlm(transformContext(agentMessages));
  assert.equal(llmMessages[0].role, "system");
  assert.ok(!llmMessages.some((message) => message.role === "tool"));
  assert.ok(llmMessages.some((message) => message.role === "user" && /历史工具结果/.test(message.content)));
  const thinkingAssistant = llmMessages.find((message) => message.role === "assistant" && message.reasoning_content);
  assert.equal(thinkingAssistant.reasoning_content, "需要先读取 README。");
  assert.equal(thinkingAssistant.tool_calls[0].id, "call-1");
  const providerMessages = normalizeMessagesForProvider([
    { role: "system", content: "system" },
    { role: "tool", name: "workspace_ls", content: "{\"ok\":true}" },
    {
      role: "assistant",
      content: "",
      reasoning_content: "需要读取 README 再回答。",
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
  assert.equal(providerMessages[2].reasoning_content, "需要读取 README 再回答。");
  assert.ok(providerMessages[2].tool_calls[0].id);
  assert.equal(providerMessages[3].role, "tool");
  assert.equal(providerMessages[3].tool_call_id, providerMessages[2].tool_calls[0].id);

  const originalFetch = global.fetch;
  let capturedBody = null;
  global.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            reasoning_content: "我需要读取工作区文件。",
            content: "",
            tool_calls: [
              {
                id: "call-read",
                type: "function",
                function: {
                  name: "workspace_read",
                  arguments: "{\"path\":\"README.md\"}"
                }
              }
            ]
          }
        }
      ]
    }), { status: 200 });
  };
  try {
    const router = createModelRouter({
      app: createFakeApp(tempRoot),
      safeStorage: {
        isEncryptionAvailable: () => false
      }
    });
    const response = await router.callChatMessages({
      provider: "DeepSeek",
      model: "deepseek-v4-flash",
      baseUrl: "https://example.test",
      encryptedApiKey: {
        encoding: "plain",
        value: "test-key"
      }
    }, [
      {
        role: "assistant",
        reasoning_content: "历史推理必须回传。",
        content: "",
        tool_calls: providerMessages[2].tool_calls
      },
      {
        role: "tool",
        tool_call_id: providerMessages[2].tool_calls[0].id,
        content: "{\"content\":\"# Demo\"}"
      }
    ], {
      tools: []
    });
    assert.equal(capturedBody.messages[0].reasoning_content, "历史推理必须回传。");
    assert.equal(response.reasoningContent, "我需要读取工作区文件。");
    assert.equal(response.message.reasoning_content, "我需要读取工作区文件。");
    assert.equal(response.message.tool_calls[0].id, "call-read");
  } finally {
    global.fetch = originalFetch;
  }

  {
    const router = createModelRouter({
      app: createFakeApp(path.join(tempRoot, "router-fallback")),
      safeStorage: {
        isEncryptionAvailable: () => false
      }
    });
    const primary = router.saveProfile({
      id: "primary-provider",
      provider: "PrimaryMaaS",
      model: "primary-model",
      baseUrl: "https://primary.example/v1",
      apiKey: "primary-key",
      supportsTools: true,
      supportsStreaming: false,
      bestFor: ["coding"],
      inputCostPer1M: 2,
      outputCostPer1M: 4,
      expectedLatencyMs: 9000,
      priority: 90
    });
    router.saveProfile({
      id: "fallback-provider",
      provider: "FallbackMaaS",
      model: "fallback-model",
      baseUrl: "https://fallback.example/v1",
      apiKey: "fallback-key",
      supportsTools: true,
      supportsStreaming: false,
      bestFor: ["coding", "cheap"],
      inputCostPer1M: 0.2,
      outputCostPer1M: 0.4,
      expectedLatencyMs: 2500,
      priority: 80
    });

    const urls = [];
    global.fetch = async (url, options) => {
      urls.push(String(url));
      const body = JSON.parse(options.body);
      if (String(url).includes("primary.example")) {
        return new Response(JSON.stringify({ error: "temporary provider outage" }), { status: 503 });
      }
      return new Response(JSON.stringify({
        usage: {
          prompt_tokens: 12,
          completion_tokens: 6,
          total_tokens: 18
        },
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: `fallback ok:${body.model}`
            }
          }
        ]
      }), { status: 200 });
    };
    try {
      const response = await router.callChatMessages(primary, [{ role: "user", content: "hello" }], {
        intent: { mode: "coding", modality: "text" }
      });
      assert.deepEqual(urls, [
        "https://primary.example/v1/chat/completions",
        "https://fallback.example/v1/chat/completions"
      ]);
      assert.equal(response.provider, "FallbackMaaS");
      assert.equal(response.model, "fallback-model");
      assert.equal(response.routing.fallbackCount, 1);
      assert.equal(response.usage.promptTokens, 12);
      const profiles = router.listProfiles();
      assert.equal(profiles.find((profile) => profile.id === "primary-provider").routeStats.failureCount, 1);
      assert.equal(profiles.find((profile) => profile.id === "fallback-provider").routeStats.successCount, 1);
      assert.ok(router.listRouteCandidates("auto", { mode: "coding" }).length >= 2);
    } finally {
      global.fetch = originalFetch;
    }
  }

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
