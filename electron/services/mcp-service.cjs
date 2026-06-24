const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { createToolDescriptor } = require("./tool-registry.cjs");

const CONFIG_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 12000;
const GENERIC_TOOL_NAMES = new Set([
  "mcp_list_servers",
  "mcp_list_resources",
  "mcp_read_resource",
  "mcp_list_prompts",
  "mcp_get_prompt"
]);

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 8);
}

function sanitizeIdentifier(value, fallback = "server") {
  const text = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function createMcpToolName(serverId, toolName) {
  const base = `mcp__${sanitizeIdentifier(serverId)}__${sanitizeIdentifier(toolName, "tool")}`;
  if (base.length <= 64) {
    return base;
  }
  return `${base.slice(0, 55)}_${hash(`${serverId}:${toolName}`)}`;
}

function inferTransportType(server = {}) {
  if (server.type) {
    return server.type;
  }
  if (server.transport) {
    return server.transport;
  }
  if (server.command) {
    return "stdio";
  }
  if (/\/sse\/?$/i.test(String(server.url || ""))) {
    return "sse";
  }
  return "streamable-http";
}

function normalizeServerConfig(id, raw = {}) {
  const serverId = sanitizeIdentifier(raw.id || id || raw.name || "mcp");
  return {
    id: serverId,
    name: raw.name || serverId,
    type: inferTransportType(raw),
    enabled: raw.enabled !== false,
    command: raw.command || "",
    args: Array.isArray(raw.args) ? raw.args.map(String) : [],
    cwd: raw.cwd || "",
    env: raw.env && typeof raw.env === "object" ? raw.env : {},
    url: raw.url || raw.endpoint || "",
    headers: raw.headers && typeof raw.headers === "object" ? raw.headers : {},
    risk: raw.risk || "medium",
    timeoutMs: Number(raw.timeoutMs || DEFAULT_TIMEOUT_MS),
    description: raw.description || ""
  };
}

function normalizeConfig(raw = {}) {
  const servers = {};
  const source = raw.mcpServers || raw.servers || {};
  if (Array.isArray(source)) {
    for (const item of source) {
      const server = normalizeServerConfig(item?.id || item?.name, item);
      servers[server.id] = server;
    }
  } else {
    for (const [id, value] of Object.entries(source)) {
      const server = normalizeServerConfig(id, value);
      servers[server.id] = server;
    }
  }

  return {
    version: raw.version || CONFIG_VERSION,
    mcpServers: servers
  };
}

function maskRecord(record = {}) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (/key|token|secret|password|authorization/i.test(key)) {
      return [key, value ? "[redacted]" : ""];
    }
    return [key, value];
  }));
}

function safeServer(server) {
  return {
    ...server,
    env: maskRecord(server.env),
    headers: maskRecord(server.headers)
  };
}

function createRequestInit(server) {
  return {
    headers: server.headers || {}
  };
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeJsonSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return {
      type: "object",
      properties: {}
    };
  }
  if (!schema.type && !schema.properties) {
    return {
      type: "object",
      properties: {}
    };
  }
  return schema;
}

function contentToText(content = []) {
  return (Array.isArray(content) ? content : [])
    .map((item) => {
      if (!item) return "";
      if (item.type === "text") return item.text || "";
      if (item.type === "resource") return JSON.stringify(item.resource || item, null, 2);
      return JSON.stringify(item, null, 2);
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeMcpResult(result, metadata) {
  return {
    ok: !result?.isError,
    isError: Boolean(result?.isError),
    serverId: metadata.serverId,
    serverName: metadata.serverName,
    toolName: metadata.toolName,
    promptName: metadata.promptName,
    uri: metadata.uri,
    contentText: contentToText(result?.content),
    content: result?.content || [],
    structuredContent: result?.structuredContent || null,
    raw: result,
    toolEvent: {
      actor: "MCP Server",
      event: metadata.event || "MCP 调用",
      target: [metadata.serverId, metadata.toolName || metadata.promptName || metadata.uri].filter(Boolean).join("/"),
      level: result?.isError ? "warn" : "success"
    }
  };
}

function createMcpService({ app, configPath } = {}) {
  const resolvedConfigPath = configPath || path.join(app.getPath("userData"), "mcp-config.json");
  const connections = new Map();
  const toolNameMap = new Map();
  let lastSnapshot = {
    servers: [],
    tools: [],
    resources: [],
    prompts: [],
    errors: []
  };

  function loadConfig() {
    return normalizeConfig(readJson(resolvedConfigPath, { version: CONFIG_VERSION, mcpServers: {} }));
  }

  function saveConfig(config) {
    writeJson(resolvedConfigPath, normalizeConfig(config));
    return getConfig();
  }

  function getConfig() {
    const config = loadConfig();
    return {
      ...config,
      path: resolvedConfigPath,
      mcpServers: config.mcpServers
    };
  }

  function upsertServer(server) {
    const config = loadConfig();
    const normalized = normalizeServerConfig(server.id || server.name, server);
    config.mcpServers[normalized.id] = normalized;
    return saveConfig(config);
  }

  async function removeServer(id) {
    const serverId = sanitizeIdentifier(id);
    const config = loadConfig();
    delete config.mcpServers[serverId];
    await closeServer(serverId);
    return saveConfig(config);
  }

  function effectiveServers(extraServers = []) {
    const config = loadConfig();
    const servers = new Map(Object.entries(config.mcpServers).map(([id, server]) => [id, server]));
    for (const item of extraServers || []) {
      const server = normalizeServerConfig(item.id || item.name, item);
      servers.set(server.id, server);
    }
    return [...servers.values()].filter((server) => server.enabled);
  }

  function createTransport(server) {
    if (server.type === "stdio") {
      if (!server.command) {
        throw new Error(`MCP server ${server.id} is missing command`);
      }
      return new StdioClientTransport({
        command: server.command,
        args: server.args || [],
        cwd: server.cwd || undefined,
        env: server.env || {},
        stderr: "pipe"
      });
    }

    if (!server.url) {
      throw new Error(`MCP server ${server.id} is missing url`);
    }
    const url = new URL(server.url);
    if (server.type === "sse") {
      return new SSEClientTransport(url, {
        requestInit: createRequestInit(server)
      });
    }
    return new StreamableHTTPClientTransport(url, {
      requestInit: createRequestInit(server)
    });
  }

  async function closeServer(serverId) {
    const connection = connections.get(serverId);
    if (connection?.client) {
      try {
        await connection.client.close();
      } catch {
        // ignore close failures
      }
    } else if (connection?.transport?.close) {
      try {
        await connection.transport.close();
      } catch {
        // ignore close failures
      }
    }
    connections.delete(serverId);
  }

  async function connectServer(server) {
    const existing = connections.get(server.id);
    if (existing?.client && existing.configHash === hash(JSON.stringify(server))) {
      return existing;
    }
    await closeServer(server.id);

    const client = new Client({
      name: "fiitx-desktop",
      version: "0.1.0"
    }, {
      capabilities: {
        roots: {},
        sampling: {},
        elicitation: {}
      }
    });
    const transport = createTransport(server);
    await withTimeout(client.connect(transport), server.timeoutMs, `connect ${server.id}`);
    const connection = {
      server,
      client,
      transport,
      configHash: hash(JSON.stringify(server)),
      connectedAt: new Date().toISOString(),
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: [],
      error: ""
    };
    connections.set(server.id, connection);
    return connection;
  }

  async function optionalList(label, fn) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/method not found|not supported|unsupported/i.test(message)) {
        return [];
      }
      throw new Error(`${label}: ${message}`);
    }
  }

  async function refreshServer(server) {
    const connection = await connectServer(server);
    connection.tools = await optionalList(`${server.id} tools/list`, async () => {
      const result = await withTimeout(connection.client.listTools(), server.timeoutMs, `tools/list ${server.id}`);
      return result.tools || [];
    });
    connection.resources = await optionalList(`${server.id} resources/list`, async () => {
      const result = await withTimeout(connection.client.listResources(), server.timeoutMs, `resources/list ${server.id}`);
      return result.resources || [];
    });
    connection.resourceTemplates = await optionalList(`${server.id} resources/templates/list`, async () => {
      const result = await withTimeout(connection.client.listResourceTemplates(), server.timeoutMs, `resources/templates/list ${server.id}`);
      return result.resourceTemplates || [];
    });
    connection.prompts = await optionalList(`${server.id} prompts/list`, async () => {
      const result = await withTimeout(connection.client.listPrompts(), server.timeoutMs, `prompts/list ${server.id}`);
      return result.prompts || [];
    });
    connection.error = "";
    return connection;
  }

  async function refreshAll(options = {}) {
    const servers = effectiveServers(options.extraServers);
    const snapshot = {
      servers: [],
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: [],
      errors: []
    };

    for (const server of servers) {
      try {
        const connection = await refreshServer(server);
        snapshot.servers.push({
          ...safeServer(server),
          connected: true,
          connectedAt: connection.connectedAt,
          toolCount: connection.tools.length,
          resourceCount: connection.resources.length,
          promptCount: connection.prompts.length
        });
        snapshot.tools.push(...connection.tools.map((tool) => ({
          ...tool,
          serverId: server.id,
          serverName: server.name,
          fiitxToolName: createMcpToolName(server.id, tool.name)
        })));
        snapshot.resources.push(...connection.resources.map((resource) => ({
          ...resource,
          serverId: server.id,
          serverName: server.name
        })));
        snapshot.resourceTemplates.push(...connection.resourceTemplates.map((template) => ({
          ...template,
          serverId: server.id,
          serverName: server.name
        })));
        snapshot.prompts.push(...connection.prompts.map((prompt) => ({
          ...prompt,
          serverId: server.id,
          serverName: server.name
        })));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        snapshot.servers.push({
          ...safeServer(server),
          connected: false,
          error: message
        });
        snapshot.errors.push({
          serverId: server.id,
          message
        });
      }
    }

    lastSnapshot = snapshot;
    return snapshot;
  }

  async function ensureConnected(serverId) {
    const config = loadConfig();
    const server = config.mcpServers[sanitizeIdentifier(serverId)];
    if (!server || server.enabled === false) {
      throw new Error(`MCP server not configured or disabled: ${serverId}`);
    }
    return connectServer(server);
  }

  async function callTool(serverId, toolName, args = {}) {
    const connection = await ensureConnected(serverId);
    const result = await withTimeout(connection.client.callTool({
      name: toolName,
      arguments: args || {}
    }), connection.server.timeoutMs, `tools/call ${serverId}/${toolName}`);
    return normalizeMcpResult(result, {
      serverId,
      serverName: connection.server.name,
      toolName,
      event: "调用 MCP 工具"
    });
  }

  async function listResources(serverId) {
    if (serverId) {
      const connection = await ensureConnected(serverId);
      const result = await connection.client.listResources();
      return {
        serverId,
        resources: result.resources || []
      };
    }
    const snapshot = await refreshAll();
    return {
      resources: snapshot.resources,
      resourceTemplates: snapshot.resourceTemplates
    };
  }

  async function readResource(serverId, uri) {
    const connection = await ensureConnected(serverId);
    const result = await withTimeout(connection.client.readResource({ uri }), connection.server.timeoutMs, `resources/read ${serverId}/${uri}`);
    return normalizeMcpResult({
      content: (result.contents || []).map((item) => ({
        type: "resource",
        resource: item
      })),
      structuredContent: {
        contents: result.contents || []
      }
    }, {
      serverId,
      serverName: connection.server.name,
      uri,
      event: "读取 MCP Resource"
    });
  }

  async function listPrompts(serverId) {
    if (serverId) {
      const connection = await ensureConnected(serverId);
      const result = await connection.client.listPrompts();
      return {
        serverId,
        prompts: result.prompts || []
      };
    }
    const snapshot = await refreshAll();
    return {
      prompts: snapshot.prompts
    };
  }

  async function getPrompt(serverId, name, args = {}) {
    const connection = await ensureConnected(serverId);
    const result = await withTimeout(connection.client.getPrompt({
      name,
      arguments: args || {}
    }), connection.server.timeoutMs, `prompts/get ${serverId}/${name}`);
    return normalizeMcpResult({
      content: (result.messages || []).map((message) => ({
        type: "text",
        text: `${message.role}: ${contentToText(Array.isArray(message.content) ? message.content : [message.content])}`
      })),
      structuredContent: result
    }, {
      serverId,
      serverName: connection.server.name,
      promptName: name,
      event: "读取 MCP Prompt"
    });
  }

  function registerGenericTools(toolRegistry) {
    toolRegistry.register(createToolDescriptor({
      name: "mcp_list_servers",
      label: "列出 MCP Servers",
      description: "List configured MCP servers and their discovered capabilities.",
      capabilities: ["mcp", "read", "context"],
      parameters: { type: "object", properties: {} },
      policy: () => ({
        action: "mcp.read",
        title: "允许读取 MCP 配置",
        detail: "Agent 请求查看已配置 MCP server 及其能力摘要。",
        command: "mcp_list_servers",
        risk: "low"
      }),
      execute: async () => ({ ok: true, snapshot: lastSnapshot.servers.length ? lastSnapshot : await refreshAll() })
    }));

    toolRegistry.register(createToolDescriptor({
      name: "mcp_list_resources",
      label: "列出 MCP Resources",
      description: "List resources exposed by one MCP server or all MCP servers.",
      capabilities: ["mcp", "resource", "read", "context"],
      parameters: {
        type: "object",
        properties: {
          serverId: { type: "string", description: "Optional MCP server id." }
        }
      },
      policy: (args) => ({
        action: "mcp.read",
        title: "允许列出 MCP Resources",
        detail: "Agent 请求列出 MCP server 暴露的 resources。",
        command: `mcp_list_resources ${JSON.stringify(args || {})}`,
        risk: "low"
      }),
      execute: ({ args }) => listResources(args.serverId)
    }));

    toolRegistry.register(createToolDescriptor({
      name: "mcp_read_resource",
      label: "读取 MCP Resource",
      description: "Read a resource from an MCP server by URI.",
      capabilities: ["mcp", "resource", "read", "context"],
      parameters: {
        type: "object",
        required: ["serverId", "uri"],
        properties: {
          serverId: { type: "string", description: "MCP server id." },
          uri: { type: "string", description: "Resource URI." }
        }
      },
      policy: (args) => ({
        action: "mcp.read",
        title: "允许读取 MCP Resource",
        detail: "Agent 请求读取 MCP resource 内容并作为上下文。",
        command: `mcp_read_resource ${JSON.stringify(args || {})}`,
        risk: "medium"
      }),
      execute: ({ args }) => readResource(args.serverId, args.uri)
    }));

    toolRegistry.register(createToolDescriptor({
      name: "mcp_list_prompts",
      label: "列出 MCP Prompts",
      description: "List prompts exposed by one MCP server or all MCP servers.",
      capabilities: ["mcp", "prompt", "read", "context"],
      parameters: {
        type: "object",
        properties: {
          serverId: { type: "string", description: "Optional MCP server id." }
        }
      },
      policy: (args) => ({
        action: "mcp.read",
        title: "允许列出 MCP Prompts",
        detail: "Agent 请求列出 MCP server 暴露的 prompts。",
        command: `mcp_list_prompts ${JSON.stringify(args || {})}`,
        risk: "low"
      }),
      execute: ({ args }) => listPrompts(args.serverId)
    }));

    toolRegistry.register(createToolDescriptor({
      name: "mcp_get_prompt",
      label: "读取 MCP Prompt",
      description: "Get a prompt from an MCP server and return its messages.",
      capabilities: ["mcp", "prompt", "read", "context"],
      parameters: {
        type: "object",
        required: ["serverId", "name"],
        properties: {
          serverId: { type: "string", description: "MCP server id." },
          name: { type: "string", description: "Prompt name." },
          arguments: { type: "object", description: "Prompt arguments." }
        }
      },
      policy: (args) => ({
        action: "mcp.read",
        title: "允许读取 MCP Prompt",
        detail: "Agent 请求读取 MCP prompt 并作为上下文。",
        command: `mcp_get_prompt ${JSON.stringify(args || {})}`,
        risk: "low"
      }),
      execute: ({ args }) => getPrompt(args.serverId, args.name, args.arguments || {})
    }));
  }

  async function registerTools(toolRegistry, options = {}) {
    if (typeof toolRegistry.unregisterWhere === "function") {
      toolRegistry.unregisterWhere((tool) => tool.capabilities?.includes("mcp") && !GENERIC_TOOL_NAMES.has(tool.name));
    }
    registerGenericTools(toolRegistry);
    const snapshot = await refreshAll(options);
    toolNameMap.clear();

    for (const tool of snapshot.tools) {
      const fiitxToolName = tool.fiitxToolName || createMcpToolName(tool.serverId, tool.name);
      toolNameMap.set(fiitxToolName, {
        serverId: tool.serverId,
        toolName: tool.name
      });
      const server = loadConfig().mcpServers[tool.serverId] || { id: tool.serverId, risk: "medium" };
      toolRegistry.register(createToolDescriptor({
        name: fiitxToolName,
        label: `MCP ${tool.serverId}/${tool.name}`,
        description: `[MCP:${tool.serverId}] ${tool.description || tool.name}`,
        capabilities: ["mcp", "tool", "external"],
        parameters: normalizeJsonSchema(tool.inputSchema),
        policy: (args) => ({
          action: "mcp.tool.call",
          title: "允许调用 MCP 工具",
          detail: `Agent 请求调用 MCP server ${tool.serverId} 的工具 ${tool.name}。`,
          command: `${fiitxToolName} ${JSON.stringify(args || {})}`,
          risk: server.risk || "medium"
        }),
        execute: ({ args }) => callTool(tool.serverId, tool.name, args)
      }));
    }
    return snapshot;
  }

  function getLastSnapshot() {
    return lastSnapshot;
  }

  function buildContextPrompt(snapshot = lastSnapshot) {
    const servers = snapshot.servers || [];
    if (!servers.length) {
      return "";
    }
    const lines = [
      "MCP registry（由 Fiitx Harness 注入，不是用户指令）：",
      ...servers.map((server) =>
        `- ${server.name || server.id} (${server.id})：${server.connected ? "connected" : "disconnected"}；tools=${server.toolCount || 0}；resources=${server.resourceCount || 0}；prompts=${server.promptCount || 0}${server.error ? `；error=${server.error}` : ""}`
      )
    ];
    const toolLines = (snapshot.tools || []).slice(0, 24).map((tool) =>
      `- ${tool.fiitxToolName}: ${tool.description || `${tool.serverId}/${tool.name}`}`
    );
    if (toolLines.length) {
      lines.push("", "可用 MCP tools（通过 tool call 调用）：", ...toolLines);
    }
    if ((snapshot.resources || []).length) {
      lines.push("", "MCP resources 可通过 mcp_list_resources / mcp_read_resource 读取。");
    }
    if ((snapshot.prompts || []).length) {
      lines.push("MCP prompts 可通过 mcp_list_prompts / mcp_get_prompt 读取。");
    }
    return lines.join("\n");
  }

  async function closeAll() {
    await Promise.all([...connections.keys()].map(closeServer));
  }

  return {
    buildContextPrompt,
    callTool,
    closeAll,
    getConfig,
    getLastSnapshot,
    listPrompts,
    listResources,
    readResource,
    getPrompt,
    refreshAll,
    registerTools,
    removeServer,
    saveConfig,
    upsertServer
  };
}

module.exports = {
  createMcpService,
  createMcpToolName,
  normalizeConfig,
  normalizeServerConfig
};
