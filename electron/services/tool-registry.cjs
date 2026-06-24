function sanitizeArgsForPolicy(toolName, args = {}) {
  if (toolName === "workspace_write") {
    return {
      ...args,
      content: args.content ? `[${String(args.content).length} chars]` : undefined
    };
  }
  return args;
}

function createToolDescriptor({ name, label, description, parameters, policy, execute, executionMode = "sequential", capabilities = [], prepareArguments }) {
  return {
    name,
    label,
    description,
    parameters,
    executionMode,
    capabilities,
    prepareArguments(args) {
      if (typeof prepareArguments === "function") {
        return prepareArguments(args);
      }
      return args && typeof args === "object" ? args : {};
    },
    toOpenAiTool() {
      return {
        type: "function",
        function: {
          name,
          description,
          parameters
        }
      };
    },
    policy(args) {
      return typeof policy === "function"
        ? policy(args)
        : {
            action: "tool.execute",
            title: `允许执行 ${label || name}`,
            detail: description,
            command: `${name} ${JSON.stringify(sanitizeArgsForPolicy(name, args))}`,
            risk: "medium"
          };
    },
    execute
  };
}

function sanitizeToolDescriptor(tool) {
  return {
    name: tool.name,
    label: tool.label || tool.name,
    description: tool.description || "",
    executionMode: tool.executionMode || "sequential",
    capabilities: Array.isArray(tool.capabilities) ? tool.capabilities : [],
    parameters: tool.parameters || {
      type: "object",
      properties: {}
    }
  };
}

function createToolRegistry({ toolRuntime }) {
  const tools = new Map();

  function register(descriptor) {
    if (!descriptor?.name || typeof descriptor.execute !== "function") {
      throw new Error("Tool descriptor must include name and execute()");
    }
    tools.set(descriptor.name, descriptor);
    return descriptor;
  }

  function registerWorkspaceTools() {
    register(createToolDescriptor({
      name: "web_fetch_url",
      label: "读取外部 URL",
      description: "Fetch one or more external http/https URLs and return readable text context. Use this before answering or generating artifacts based on a website, official docs, or bare domain such as www.example.com.",
      capabilities: ["web", "read", "context"],
      parameters: {
        type: "object",
        required: ["urls"],
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            description: "External URLs or bare domains to fetch, for example https://example.com or www.example.com."
          },
          limit: { type: "number", description: "Maximum number of URLs to fetch." }
        }
      },
      prepareArguments: (args) => {
        if (typeof args === "string") {
          return { urls: [args] };
        }
        if (Array.isArray(args)) {
          return { urls: args };
        }
        if (args?.url && !args.urls) {
          return { ...args, urls: [args.url] };
        }
        return args && typeof args === "object" ? args : {};
      },
      policy: (args) => ({
        action: "web.fetch_url",
        title: "允许读取外部文档",
        detail: "Agent 请求读取外部 URL，并把正文作为本轮模型上下文。",
        command: `web_fetch_url ${JSON.stringify(args)}`,
        risk: "low"
      }),
      execute: ({ args, signal }) => toolRuntime.fetchUrlContext(args.urls || [], {
        limit: args.limit || 5,
        signal,
        timeoutMs: args.timeoutMs || 25000,
        maxCharsPerDocument: args.maxCharsPerDocument || 14000
      })
    }));

    register(createToolDescriptor({
      name: "workspace_ls",
      label: "列出工作区",
      description: "List files and folders inside the current workspace or a workspace-relative subdirectory.",
      capabilities: ["workspace", "read", "context"],
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace-relative directory path. Defaults to ." },
          limit: { type: "number", description: "Maximum number of entries to return." }
        }
      },
      policy: (args) => ({
        action: "workspace.scan",
        title: "允许读取工作区",
        detail: "Agent 请求读取当前 workspace 的文件列表，用于按需构建任务上下文。",
        command: `workspace_ls ${JSON.stringify(args)}`,
        risk: "medium"
      }),
      execute: ({ args, payload }) => toolRuntime.listDirectory(payload.workspacePath, args.path || ".", { limit: args.limit })
    }));

    register(createToolDescriptor({
      name: "workspace_read",
      label: "读取文件",
      description: "Read a safe text file from the current workspace.",
      capabilities: ["workspace", "read", "context"],
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          maxBytes: { type: "number", description: "Maximum bytes to read." }
        }
      },
      policy: (args) => ({
        action: "workspace.scan",
        title: "允许读取文件",
        detail: "Agent 请求读取 workspace 中的安全文本片段。",
        command: `workspace_read ${JSON.stringify(args)}`,
        risk: "medium"
      }),
      execute: ({ args, payload }) => toolRuntime.readWorkspaceFile(payload.workspacePath, args.path, { maxBytes: args.maxBytes })
    }));

    register(createToolDescriptor({
      name: "workspace_write",
      label: "写入文件",
      description: "Create or replace a text file inside the current workspace.",
      capabilities: ["workspace", "write"],
      parameters: {
        type: "object",
        required: ["path", "content"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          content: { type: "string", description: "Complete file content." }
        }
      },
      policy: (args) => ({
        action: "workspace.write_manifest",
        title: "允许修改文件",
        detail: "Agent 请求创建或替换 workspace 文件。",
        command: `workspace_write ${JSON.stringify(sanitizeArgsForPolicy("workspace_write", args))}`,
        risk: "high"
      }),
      execute: ({ args, payload }) => toolRuntime.writeWorkspaceFile(payload.workspacePath, args.path, args.content)
    }));

    register(createToolDescriptor({
      name: "workspace_edit",
      label: "编辑文件",
      description: "Apply an exact string replacement to a text file inside the current workspace.",
      capabilities: ["workspace", "write", "edit"],
      parameters: {
        type: "object",
        required: ["path", "search", "replace"],
        properties: {
          path: { type: "string", description: "Workspace-relative file path." },
          search: { type: "string", description: "Exact text to replace." },
          replace: { type: "string", description: "Replacement text." },
          all: { type: "boolean", description: "Replace all occurrences instead of the first match." }
        }
      },
      policy: (args) => ({
        action: "workspace.write_manifest",
        title: "允许编辑文件",
        detail: "Agent 请求修改 workspace 文件中的文本。",
        command: `workspace_edit ${JSON.stringify({ ...args, replace: args?.replace ? `[${String(args.replace).length} chars]` : "" })}`,
        risk: "high"
      }),
      execute: ({ args, payload }) => toolRuntime.editWorkspaceFile(payload.workspacePath, args.path, args)
    }));

    register(createToolDescriptor({
      name: "workspace_grep",
      label: "搜索文件",
      description: "Search workspace text files for a literal or regex pattern.",
      capabilities: ["workspace", "read", "search"],
      parameters: {
        type: "object",
        required: ["pattern"],
        properties: {
          pattern: { type: "string", description: "Search pattern." },
          path: { type: "string", description: "Workspace-relative file or directory. Defaults to ." },
          maxMatches: { type: "number", description: "Maximum number of matches." }
        }
      },
      policy: (args) => ({
        action: "workspace.scan",
        title: "允许搜索工作区",
        detail: "Agent 请求搜索 workspace 文本文件。",
        command: `workspace_grep ${JSON.stringify(args)}`,
        risk: "medium"
      }),
      execute: ({ args, payload }) => toolRuntime.grepWorkspace(payload.workspacePath, args.pattern, {
        path: args.path,
        maxMatches: args.maxMatches
      })
    }));

    register(createToolDescriptor({
      name: "workspace_find",
      label: "查找文件",
      description: "Find files in the workspace by path substring.",
      capabilities: ["workspace", "read", "search"],
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Case-insensitive path substring." },
          path: { type: "string", description: "Workspace-relative directory. Defaults to ." },
          maxResults: { type: "number", description: "Maximum number of files." }
        }
      },
      policy: (args) => ({
        action: "workspace.scan",
        title: "允许查找文件",
        detail: "Agent 请求按路径查找 workspace 文件。",
        command: `workspace_find ${JSON.stringify(args)}`,
        risk: "medium"
      }),
      execute: ({ args, payload }) => toolRuntime.findWorkspaceFiles(payload.workspacePath, args)
    }));

    register(createToolDescriptor({
      name: "bash",
      label: "执行命令",
      description: "Run a shell command in the current workspace directory.",
      capabilities: ["shell", "test", "build"],
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: { type: "string", description: "Shell command to run." },
          timeoutMs: { type: "number", description: "Optional timeout in milliseconds." }
        }
      },
      policy: (args) => ({
        action: "shell.exec",
        title: "允许执行命令",
        detail: "Agent 请求在当前 workspace 中执行 shell 命令。",
        command: args?.command || "bash",
        risk: "high"
      }),
      execute: ({ args, payload, signal }) => toolRuntime.runShell(payload.workspacePath, args.command, {
        timeoutMs: args.timeoutMs,
        signal
      })
    }));
  }

  registerWorkspaceTools();

  return {
    get(name) {
      return tools.get(name);
    },
    list() {
      return [...tools.values()].map(sanitizeToolDescriptor);
    },
    describe(name) {
      const tool = tools.get(name);
      return tool ? sanitizeToolDescriptor(tool) : null;
    },
    getOpenAiTools() {
      return [...tools.values()].map((tool) => tool.toOpenAiTool());
    },
    register,
    unregister(name) {
      return tools.delete(name);
    },
    unregisterWhere(predicate) {
      let removed = 0;
      for (const [name, tool] of tools.entries()) {
        if (predicate(tool, name)) {
          tools.delete(name);
          removed += 1;
        }
      }
      return removed;
    },
    async execute(name, args, context) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`未知工具：${name}`);
      }
      const prepared = tool.prepareArguments(args);
      return tool.execute({ ...context, args: prepared });
    },
    policy(name, args) {
      const tool = tools.get(name);
      if (!tool) {
        return {
          action: "tool.execute",
          title: "允许执行未知工具",
          detail: `Agent 请求执行未知工具 ${name}`,
          command: `${name} ${JSON.stringify(args || {})}`,
          risk: "high"
        };
      }
      return tool.policy(tool.prepareArguments(args));
    }
  };
}

module.exports = {
  createToolDescriptor,
  createToolRegistry,
  sanitizeToolDescriptor
};
