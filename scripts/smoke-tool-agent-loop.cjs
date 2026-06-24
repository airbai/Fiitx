const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const policyEngine = require("../electron/services/policy-engine.cjs");
const { createToolCallingAgentSession } = require("../electron/services/tool-agent-loop.cjs");
const { createToolRuntime } = require("../electron/services/tool-runtime.cjs");
const { createWorkspaceManager } = require("../electron/services/workspace-manager.cjs");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deepsix-tool-loop-"));
  const workspaceManager = createWorkspaceManager({
    policyEngine,
    fallbackRoot: () => root
  });
  const toolRuntime = createToolRuntime({ workspaceManager });
  const logs = [];
  let calls = 0;
  const modelRouter = {
    async callChatMessages(_profile, messages) {
      calls += 1;
      if (calls === 1) {
        return {
          content: "",
          reasoningContent: "需要写入 hello.txt，所以调用 workspace_write。",
          finishReason: "tool_calls",
          message: {
            role: "assistant",
            reasoning_content: "需要写入 hello.txt，所以调用 workspace_write。",
            content: "",
            tool_calls: [
              {
                id: "call-write",
                type: "function",
                function: {
                  name: "workspace_write",
                  arguments: JSON.stringify({
                    path: "hello.txt",
                    content: "hello from deepsix tool loop\n"
                  })
                }
              }
            ]
          },
          toolCalls: [
            {
              id: "call-write",
              name: "workspace_write",
              arguments: {
                path: "hello.txt",
                content: "hello from deepsix tool loop\n"
              }
            }
          ]
        };
      }

      const previousAssistant = messages.find((message) => message.role === "assistant" && message.tool_calls?.length);
      if (!previousAssistant?.reasoning_content) {
        throw new Error(`missing reasoning_content in tool follow-up: ${JSON.stringify(messages)}`);
      }
      if (previousAssistant.reasoning_content !== "需要写入 hello.txt，所以调用 workspace_write。") {
        throw new Error(`unexpected reasoning_content: ${previousAssistant.reasoning_content}`);
      }

      return {
        content: "已写入 hello.txt",
        finishReason: "stop",
        message: {
          role: "assistant",
          content: "已写入 hello.txt"
        },
        toolCalls: []
      };
    },
    async callChat() {
      return "summary";
    }
  };

  const session = createToolCallingAgentSession({
    payload: {
      threadId: "smoke-thread",
      taskId: "smoke-task",
      workspacePath: root,
      intent: { mode: "coding" },
      contextMessages: []
    },
    profile: {
      provider: "Fake",
      model: "fake-tools"
    },
    modelRouter,
    systemPrompt: "You are a coding agent.",
    toolRuntime,
    policyGate: () => ({ allowed: true, toolEvent: { actor: "Policy", event: "allow", level: "success" } }),
    sessionLogStore: {
      append: (_threadId, entry) => {
        logs.push(entry);
        return entry;
      },
      read: () => logs,
      appendCompact: (_threadId, summary) => logs.push({ type: "compact", content: summary })
    }
  });

  const result = await session.prompt("create hello file");
  const written = fs.readFileSync(path.join(root, "hello.txt"), "utf8");
  if (!result.ok || !/已写入/.test(result.summary) || written !== "hello from deepsix tool loop\n") {
    throw new Error(`tool loop smoke failed: ${JSON.stringify({ result, written })}`);
  }
  if (!logs.some((entry) => entry.type === "tool_result")) {
    throw new Error("tool loop smoke failed: missing tool_result session log");
  }
  const assistantLog = logs.find((entry) => entry.type === "message" && entry.role === "assistant" && entry.tool_calls?.length);
  if (!assistantLog?.reasoning_content) {
    throw new Error(`assistant reasoning_content was not persisted: ${JSON.stringify(logs)}`);
  }
  console.log("tool agent loop smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
