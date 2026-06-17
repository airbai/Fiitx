const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const artifactEngine = require("./services/artifact-engine.cjs");
const policyEngine = require("./services/policy-engine.cjs");
const { createAgentRuntime } = require("./services/agent-runtime.cjs");
const { createModelRouter } = require("./services/model-router.cjs");
const { createSessionLogStore } = require("./services/session-log-store.cjs");
const { createTelemetryStore } = require("./services/telemetry-store.cjs");
const { createThreadStore } = require("./services/thread-store.cjs");
const { createToolRuntime } = require("./services/tool-runtime.cjs");
const { createWorkspaceManager } = require("./services/workspace-manager.cjs");
const { createWechatChannelServer } = require("./services/wechat-channel-server.cjs");
const { createWechatAiSkillGateway } = require("./services/wechat-ai-skill-gateway.cjs");

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow = null;

function getDefaultWorkspaceRoot() {
  const documentsPath = app.getPath("documents");
  // Fiitx branding kept for easy restore:
  // const root = path.join(documentsPath, "Fiitx Workspaces");
  const root = path.join(documentsPath, "Deepsix Workspaces");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

const workspaceManager = createWorkspaceManager({
  policyEngine,
  fallbackRoot: getDefaultWorkspaceRoot
});
const toolRuntime = createToolRuntime({ workspaceManager });
const modelRouter = createModelRouter({ app, safeStorage });
const sessionLogStore = createSessionLogStore({ app });
const telemetryStore = createTelemetryStore({ app });
const threadStore = createThreadStore({ app });
const wechatAiSkillGateway = createWechatAiSkillGateway();
const agentRuntime = createAgentRuntime({
  artifactEngine,
  modelRouter,
  policyEngine,
  sessionLogStore,
  telemetryStore,
  toolRuntime,
  wechatAiSkillGateway
});
const wechatChannelServer = createWechatChannelServer({
  wechatAiSkillGateway,
  port: Number(process.env.DEEPSIX_WECHAT_CHANNEL_PORT || 18766),
  onInboundMessage: (payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("wechat-channel:inbound", payload);
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f6f7fb",
    // Fiitx branding kept for easy restore:
    // title: "Fiitx",
    title: "Deepsix",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    // Fiitx icon kept for easy restore:
    // icon: path.join(__dirname, "../assets/icon-1024.png"),
    icon: path.join(__dirname, "../assets/deepsix-logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = window;

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createProgressEmitter(event, taskId, threadId) {
  return (progress) => {
    event.sender.send("agent:progress", {
      id: `progress-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      taskId,
      threadId,
      time: new Date().toISOString(),
      ...progress
    });
  };
}

const previewTextExtensions = new Set([
  ".c",
  ".cc",
  ".cjs",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".ts",
  ".tsx",
  ".txt",
  ".wxml",
  ".wxss",
  ".xml",
  ".yaml",
  ".yml"
]);

const pathSearchIgnoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "node_modules",
  "out",
  "release"
]);

function cleanUserPath(userPath) {
  return String(userPath || "").trim().replace(/^["'`]+|["'`.,，。；;:：）)\]]+$/g, "");
}

function normalizeUserPath(userPath, basePath) {
  const trimmed = cleanUserPath(userPath);
  if (!trimmed) {
    return "";
  }

  if (/^file:\/\//i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return "";
    }
  }

  if (trimmed === "~" || trimmed.startsWith("~/")) {
    return path.join(app.getPath("home"), trimmed.slice(2));
  }

  if (!path.isAbsolute(trimmed)) {
    const base = basePath ? normalizeUserPath(basePath) : workspaceManager.getFallbackRoot();
    return path.resolve(base || workspaceManager.getFallbackRoot(), trimmed);
  }

  return path.resolve(trimmed);
}

function getSearchRoot(basePath) {
  const candidate = basePath ? normalizeUserPath(basePath) : workspaceManager.getFallbackRoot();
  if (candidate && fs.existsSync(candidate)) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      return workspaceManager.getFallbackRoot();
    }
  }
  return workspaceManager.getFallbackRoot();
}

function pathSuffixMatches(relativePath, suffix) {
  if (!suffix) {
    return false;
  }

  const normalizedRelative = relativePath.split(path.sep).join("/");
  const normalizedSuffix = suffix.split(path.sep).join("/").replace(/^\.{1,2}\//, "").replace(/^\/+/, "");
  return normalizedRelative === normalizedSuffix || normalizedRelative.endsWith(`/${normalizedSuffix}`);
}

function findPathInWorkspace(userPath, basePath) {
  const trimmed = cleanUserPath(userPath);
  if (!trimmed) {
    return "";
  }

  const searchRoot = getSearchRoot(basePath);
  const suffix = path.isAbsolute(trimmed) || trimmed.startsWith("~/")
    ? path.basename(trimmed)
    : trimmed;
  const basename = path.basename(trimmed);
  const allowBasenameFallback = !trimmed.includes("/") || path.isAbsolute(trimmed) || trimmed.startsWith("~/");
  let visited = 0;
  let basenameMatch = "";

  function walk(directory, depth) {
    if (visited > 6000 || depth > 8) {
      return "";
    }

    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      return "";
    }

    for (const entry of entries) {
      visited += 1;
      if (visited > 6000) {
        break;
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(searchRoot, absolutePath);

      if (pathSuffixMatches(relativePath, suffix)) {
        return absolutePath;
      }

      if (!basenameMatch && allowBasenameFallback && entry.name === basename) {
        basenameMatch = absolutePath;
      }

      if (entry.isDirectory() && !pathSearchIgnoredDirectories.has(entry.name)) {
        const nested = walk(absolutePath, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }

    return "";
  }

  return walk(searchRoot, 0) || basenameMatch;
}

function inspectLocalPath(userPath, basePath) {
  const directPath = normalizeUserPath(userPath, basePath);
  const foundPath = directPath && fs.existsSync(directPath) ? "" : findPathInWorkspace(userPath, basePath);
  const absolutePath = foundPath || directPath;
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return {
      exists: false,
      path: absolutePath || String(userPath || ""),
      kind: "missing",
      name: path.basename(absolutePath || String(userPath || ""))
    };
  }

  const stat = fs.statSync(absolutePath);
  const kind = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
  const extension = path.extname(absolutePath).toLowerCase();
  return {
    exists: true,
    path: absolutePath,
    name: path.basename(absolutePath),
    kind,
    size: stat.size,
    extension,
    previewable: kind === "file" && previewTextExtensions.has(extension),
    resolvedFromWorkspace: Boolean(foundPath)
  };
}

function parsePathPayload(payload) {
  if (payload && typeof payload === "object") {
    return {
      path: payload.path,
      basePath: payload.basePath
    };
  }

  return {
    path: payload,
    basePath: undefined
  };
}

app.whenReady().then(() => {
  modelRouter.ensureSeededProfiles();
  wechatChannelServer.start().catch((error) => {
    console.error("[wechat-channel] failed to start", error);
  });

  ipcMain.handle("app:get-platform", () => ({
    platform: process.platform,
    version: app.getVersion(),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    defaultWorkspace: workspaceManager.getFallbackRoot()
  }));

  ipcMain.handle("app:choose-workspace", async () =>
    dialog.showOpenDialog({
      title: "选择工作区",
      properties: ["openDirectory"]
    })
  );

  ipcMain.handle("app:choose-files", async () =>
    dialog.showOpenDialog({
      title: "添加附件",
      properties: ["openFile", "multiSelections"]
    })
  );

  ipcMain.handle("path:inspect", (_event, payload) => {
    const parsed = parsePathPayload(payload);
    return inspectLocalPath(parsed.path, parsed.basePath);
  });

  ipcMain.handle("path:open", async (_event, payload) => {
    const parsed = parsePathPayload(payload);
    const inspected = inspectLocalPath(parsed.path, parsed.basePath);
    if (!inspected.exists) {
      return {
        ok: false,
        message: "路径不存在"
      };
    }

    const error = inspected.kind === "directory"
      ? await shell.openPath(inspected.path)
      : shell.showItemInFolder(inspected.path);
    return {
      ok: !error,
      message: error || "已打开"
    };
  });

  ipcMain.handle("path:show-in-folder", async (_event, payload) => {
    const parsed = parsePathPayload(payload);
    const inspected = inspectLocalPath(parsed.path, parsed.basePath);
    if (!inspected.exists) {
      return {
        ok: false,
        message: "路径不存在"
      };
    }

    shell.showItemInFolder(inspected.path);
    return {
      ok: true,
      message: "已打开所在位置"
    };
  });

  ipcMain.handle("path:preview", async (_event, payload) => {
    const parsed = parsePathPayload(payload);
    const inspected = inspectLocalPath(parsed.path, parsed.basePath);
    if (!inspected.exists) {
      throw new Error("路径不存在");
    }

    if (inspected.kind !== "file") {
      throw new Error("只有文件可以预览");
    }

    if (!inspected.previewable) {
      throw new Error("当前文件类型暂不支持文本预览");
    }

    const maxBytes = 1024 * 160;
    const fd = fs.openSync(inspected.path, "r");
    const buffer = Buffer.alloc(Math.min(inspected.size || maxBytes, maxBytes));
    try {
      fs.readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(fd);
    }

    return {
      ...inspected,
      truncated: (inspected.size || 0) > maxBytes,
      content: buffer.toString("utf8").replace(/\u0000/g, "")
    };
  });

  ipcMain.handle("model:list", () => modelRouter.listProfiles());

  ipcMain.handle("model:save", (_event, payload) => modelRouter.saveProfile(payload));

  ipcMain.handle("model:test", (_event, payload) => modelRouter.testConnection(payload));

  ipcMain.handle("thread-state:load", () => threadStore.load());

  ipcMain.handle("thread-state:save", (_event, payload) => threadStore.save(payload));

  ipcMain.handle("wechat-ai:discover-skills", () => wechatAiSkillGateway.discoverSkills());

  ipcMain.handle("wechat-ai:route-prompt", (_event, payload) => wechatAiSkillGateway.routePrompt(payload));

  ipcMain.handle("wechat-ai:invoke-skill", (_event, payload) => wechatAiSkillGateway.callApi(payload));

  ipcMain.handle("wechat-channel:status", () => wechatChannelServer.getStatus());

  ipcMain.handle("terminal:run-command", async (_event, payload = {}) => {
    const command = String(payload.command || "").trim();
    const workspacePath = payload.workspacePath || workspaceManager.getFallbackRoot();

    if (!command) {
      return {
        ok: false,
        command: "",
        cwd: workspacePath,
        exitCode: 1,
        stdout: "",
        stderr: "请输入命令"
      };
    }

    try {
      const result = await toolRuntime.runShell(workspacePath, command, {
        timeoutMs: payload.timeoutMs || 120000
      });
      return {
        ok: result.exitCode === 0,
        ...result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "命令执行失败";
      return {
        ok: false,
        command,
        cwd: workspacePath,
        exitCode: 1,
        stdout: "",
        stderr: message
      };
    }
  });

  ipcMain.handle("agent:run-task", async (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);

    try {
      return await agentRuntime.runAgentTask(payload, emitProgress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent runtime 执行失败";
      emitProgress({
        status: "warn",
        title: "任务失败",
        detail: message
      });

      return {
        ok: false,
        summary: message,
        model: payload?.model,
        provider: "local",
        artifact: null,
        toolEvents: [
          {
            actor: "Agent Runtime",
            event: "任务失败",
            target: message,
            level: "warn"
          }
        ]
      };
    }
  });

  ipcMain.handle("agent:prompt", async (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.prompt(payload, emitProgress);
  });

  ipcMain.handle("agent:steer", (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.steer(payload, emitProgress);
  });

  ipcMain.handle("agent:follow-up", (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.followUp(payload, emitProgress);
  });

  ipcMain.handle("agent:abort", (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.abort(payload, emitProgress);
  });

  ipcMain.handle("agent:continue", async (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.continueTurn(payload, emitProgress);
  });

  ipcMain.handle("agent:compact", async (event, payload) => {
    const emitProgress = createProgressEmitter(event, payload?.taskId, payload?.threadId);
    return agentRuntime.compact(payload, emitProgress);
  });

  ipcMain.handle("agent:session-tree", (_event, payload = {}) => {
    return sessionLogStore.getTree(payload.threadId || payload.taskId || payload.sessionId || "default");
  });

  ipcMain.handle("agent:session-replay", (_event, payload = {}) => {
    return sessionLogStore.replay(payload.threadId || payload.taskId || payload.sessionId || "default", payload);
  });

  ipcMain.handle("agent:telemetry-summary", (_event, payload = {}) => {
    return telemetryStore.summarize(payload.limit || 500);
  });

  ipcMain.handle("agent:inspect-route", (_event, payload = {}) => {
    return agentRuntime.inspectRoute(payload);
  });

  ipcMain.handle("agent:run-eval", (_event, payload = {}) => {
    return agentRuntime.runEval(payload);
  });

  ipcMain.handle("agent:harness-snapshot", (_event, payload = {}) => {
    return agentRuntime.getHarnessSnapshot(payload);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void wechatChannelServer.stop();
});
