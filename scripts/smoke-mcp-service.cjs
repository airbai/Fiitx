const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMcpService } = require("../electron/services/mcp-service.cjs");
const { createSkillMarketplace } = require("../electron/services/skill-marketplace.cjs");
const { createToolRegistry } = require("../electron/services/tool-registry.cjs");

function createFakeServer(tempDir, repoRoot) {
  const serverPath = path.join(tempDir, "fake-mcp-server.cjs");
  const sdkRoot = path.join(repoRoot, "node_modules/@modelcontextprotocol/sdk").replace(/\\/g, "\\\\");
  fs.writeFileSync(serverPath, `
const { Server } = require("${sdkRoot}/dist/cjs/server/index.js");
const { StdioServerTransport } = require("${sdkRoot}/dist/cjs/server/stdio.js");
const {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} = require("${sdkRoot}/dist/cjs/types.js");

const server = new Server({ name: "fake-fiitx-mcp", version: "1.0.0" }, {
  capabilities: { tools: {}, resources: {}, prompts: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
      name: "echo",
      description: "Echo a value.",
      inputSchema: { type: "object", properties: { value: { type: "string" } } }
    }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: "text", text: "echo:" + (request.params.arguments.value || "") }]
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: "fake://hello", name: "hello.txt", mimeType: "text/plain" }]
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: []
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [{ uri: request.params.uri, mimeType: "text/plain", text: "resource body" }]
}));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{ name: "brief", description: "Brief prompt", arguments: [] }]
}));

server.setRequestHandler(GetPromptRequestSchema, async () => ({
  messages: [{ role: "user", content: { type: "text", text: "brief prompt" } }]
}));

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
`, "utf8");
  return serverPath;
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fiitx-mcp-"));
  const app = { getPath: () => tempDir };
  const serverPath = createFakeServer(tempDir, repoRoot);
  const mcpService = createMcpService({
    app,
    configPath: path.join(tempDir, "mcp-config.json")
  });

  mcpService.upsertServer({
    id: "fake",
    name: "Fake MCP",
    type: "stdio",
    command: process.execPath,
    args: [serverPath],
    risk: "low"
  });

  const registry = createToolRegistry({
    toolRuntime: {
      fetchUrlContext: async () => ({}),
      listDirectory: async () => ({}),
      readWorkspaceFile: async () => ({}),
      writeWorkspaceFile: async () => ({}),
      editWorkspaceFile: async () => ({}),
      grepWorkspace: async () => ({}),
      findWorkspaceFiles: async () => ({}),
      runShell: async () => ({})
    }
  });

  const snapshot = await mcpService.registerTools(registry);
  assert.equal(snapshot.servers[0].connected, true);
  assert.equal(snapshot.tools.length, 1);
  assert.equal(snapshot.resources.length, 1);
  assert.equal(snapshot.prompts.length, 1);

  const toolName = snapshot.tools[0].fiitxToolName;
  const result = await registry.execute(toolName, { value: "ok" }, { payload: {} });
  assert.equal(result.ok, true);
  assert.match(result.contentText, /echo:ok/);

  const resource = await mcpService.readResource("fake", "fake://hello");
  assert.match(resource.contentText, /resource body/);

  const prompt = await mcpService.getPrompt("fake", "brief", {});
  assert.match(prompt.contentText, /brief prompt/);

  const skillMarketplace = createSkillMarketplace({
    app,
    configPath: path.join(tempDir, "skills.json")
  });
  const skillRoot = path.join(repoRoot, "examples/wechat-ai/customer-chatbox-miniapp/skills/drink-skill");
  const installed = skillMarketplace.installLocalSkill({ root: skillRoot });
  assert.equal(installed.name, "drink-skill");
  assert.ok(skillMarketplace.listInstalled().length >= 1);
  assert.ok(skillMarketplace.getEnabledDescriptors().length >= 1);

  await mcpService.closeAll();
  console.log("mcp service smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
