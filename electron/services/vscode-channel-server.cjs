/**
 * vscode-channel-server.cjs
 *
 * VS Code Extension 通道服务器 — 让 VS Code 扩展通过本地 HTTP 与 Fiitx 通信
 *
 * ========== 能力 ==========
 * 1. 接收来自 VS Code 扩展的查询（当前文件内容、选区、工作区信息）
 * 2. 推送文件差异（diff）到 VS Code，触发内联 Diff 预览
 * 3. 接收 VS Code 的编辑确认/拒绝反馈
 * 4. 支持文件写入请求（Fiitx → VS Code → 文件系统）
 * 5. 支持 VS Code → Fiitx 发送代码上下文（选中的代码段、错误信息等）
 *
 * ========== API 端点 ==========
 * GET  /health                  - 健康检查
 * POST /vscode/ping             - VS Code → Fiitx 连通确认
 * POST /vscode/context          - VS Code → Fiitx 发送上下文（文件、选区、错误）
 * POST /vscode/diff             - Fiitx → VS Code 推送差异预览
 * POST /vscode/diff/accept      - VS Code → Fiitx 确认应用差异
 * POST /vscode/diff/reject      - VS Code → Fiitx 拒绝差异
 * POST /vscode/write            - Fiitx → VS Code 请求写入文件
 * POST /vscode/command          - VS Code → Fiitx 执行命令（如"解释这段代码"）
 * GET  /vscode/workspace        - VS Code → Fiitx 查询当前工作区信息
 */

const http = require("node:http");

const DEFAULT_PORT = 18767;
const MAX_BODY_BYTES = 1024 * 512;

/**
 * 从请求中读取 JSON body
 */
function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

/**
 * 写入 JSON 响应
 */
function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-deepsix-channel-token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(payload, null, 2));
}

/**
 * 标准化 VS Code 传来的上下文
 */
function normalizeVscodeContext(body = {}) {
  return {
    workspaceRoot: String(body.workspaceRoot || body.rootPath || "").trim(),
    activeFilePath: String(body.activeFilePath || body.filePath || body.path || "").trim(),
    activeFileContent: String(body.activeFileContent || body.content || body.text || "").trim(),
    selection: body.selection
      ? {
          startLine: body.selection.startLine ?? body.selection.line ?? 0,
          startColumn: body.selection.startColumn ?? body.selection.column ?? 0,
          endLine: body.selection.endLine ?? body.selection.line ?? 0,
          endColumn: body.selection.endColumn ?? body.selection.column ?? 0,
          selectedText: String(body.selection.selectedText || body.selection.text || "").trim()
        }
      : null,
    languageId: String(body.languageId || body.language || "").trim(),
    openFiles: Array.isArray(body.openFiles) ? body.openFiles.map((f) => String(f).trim()).filter(Boolean) : [],
    diagnostics: Array.isArray(body.diagnostics)
      ? body.diagnostics.map((d) => ({
          file: String(d.file || "").trim(),
          line: d.line ?? 0,
          message: String(d.message || "").trim(),
          severity: String(d.severity || "info").trim()
        }))
      : [],
    command: String(body.command || "").trim(),
    timestamp: body.timestamp || Date.now(),
    raw: body
  };
}

/**
 * 标准化 diff 推送请求
 */
function normalizeDiffPayload(body = {}) {
  const files = Array.isArray(body.files) ? body.files.map((f) => ({
    path: String(f.path || "").trim(),
    oldContent: String(f.oldContent || f.original || ""),
    newContent: String(f.newContent || f.modified || f.content || ""),
    title: String(f.title || f.path || "").trim(),
    language: String(f.language || "").trim()
  })).filter((f) => f.path && (f.oldContent !== f.newContent)) : [];

  return {
    diffId: String(body.diffId || `diff-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`).trim(),
    threadId: String(body.threadId || body.sessionId || "").trim(),
    files,
    summary: String(body.summary || "").trim(),
    timestamp: body.timestamp || Date.now()
  };
}

/**
 * 创建 VS Code 通道服务器
 *
 * @param {Object} options
 * @param {Function} [options.onInboundMessage] - 收到 VS Code 消息时的回调 (payload) => void
 * @param {Function} [options.onContextReceived] - 收到 VS Code 上下文时的回调 (context) => void
 * @param {Function} [options.onDiffAccepted] - 差异被接受时的回调 (diffId, files) => void
 * @param {Function} [options.onDiffRejected] - 差异被拒绝时的回调 (diffId, reason) => void
 * @param {number} [options.port] - 监听端口
 * @param {string} [options.host] - 监听地址
 * @returns {Object} { start, stop, getStatus, sendDiff, sendWriteRequest }
 */
function createVscodeChannelServer({
  onInboundMessage,
  onContextReceived,
  onDiffAccepted,
  onDiffRejected,
  port = DEFAULT_PORT,
  host = "127.0.0.1"
} = {}) {
  let server = null;
  let currentPort = port;
  let pendingDiffs = new Map(); // diffId -> { files, resolved, threadId }
  let vscodeClients = new Map(); // clientId -> { lastPing, workspaceRoot }

  async function handlePing(request, response) {
    const body = await readRequestBody(request);
    const clientId = String(body.clientId || `vscode-${Date.now()}`).trim();
    const workspaceRoot = String(body.workspaceRoot || "").trim();

    vscodeClients.set(clientId, {
      lastPing: Date.now(),
      workspaceRoot,
      vscodeVersion: String(body.vscodeVersion || "").trim(),
      extensionVersion: String(body.extensionVersion || "0.1.0").trim()
    });

    writeJson(response, 200, {
      ok: true,
      clientId,
      serverTime: Date.now(),
      channelId: "vscode-deepsix",
      deepsixVersion: "0.1.0",
      pendingDiffs: pendingDiffs.size,
      message: "VS Code ↔ Fiitx 通道已连接"
    });
  }

  async function handleContext(request, response) {
    const body = await readRequestBody(request);
    const context = normalizeVscodeContext(body);

    onContextReceived?.(context);
    onInboundMessage?.({
      type: "vscode:context",
      channel: "vscode-deepsix",
      context,
      timestamp: Date.now()
    });

    writeJson(response, 200, {
      ok: true,
      contextId: `ctx-${Date.now()}`,
      context: {
        workspaceRoot: context.workspaceRoot,
        activeFilePath: context.activeFilePath,
        languageId: context.languageId,
        hasSelection: Boolean(context.selection),
        fileCount: context.openFiles.length,
        diagnosticCount: context.diagnostics.length
      },
      message: "上下文已接收"
    });
  }

  async function handleDiff(request, response) {
    const body = await readRequestBody(request);
    const diffPayload = normalizeDiffPayload(body);

    if (diffPayload.files.length === 0) {
      writeJson(response, 400, {
        ok: false,
        error: "没有有效的文件差异（oldContent === newContent 或缺少 path）"
      });
      return;
    }

    // 暂存差异，等待 VS Code 确认或拒绝
    pendingDiffs.set(diffPayload.diffId, {
      files: diffPayload.files,
      resolved: false,
      threadId: diffPayload.threadId,
      summary: diffPayload.summary,
      createdAt: Date.now()
    });

    onInboundMessage?.({
      type: "vscode:diff",
      channel: "vscode-deepsix",
      diffId: diffPayload.diffId,
      fileCount: diffPayload.files.length,
      summary: diffPayload.summary,
      timestamp: Date.now()
    });

    writeJson(response, 200, {
      ok: true,
      diffId: diffPayload.diffId,
      files: diffPayload.files.map((f) => ({
        path: f.path,
        title: f.title,
        language: f.language,
        hasChanges: true,
        oldLength: f.oldContent.length,
        newLength: f.newContent.length
      })),
      instructions: {
        display: "请在 VS Code 中查看并确认内联差异。使用 `Fiitx: 接受差异` 或 `Fiitx: 拒绝差异` 命令。",
        commandAccept: "deepsix.acceptDiff",
        commandReject: "deepsix.rejectDiff"
      }
    });
  }

  async function handleDiffAccept(request, response) {
    const body = await readRequestBody(request);
    const diffId = String(body.diffId || "").trim();
    const clientAcceptedFiles = Array.isArray(body.acceptedFiles) ? body.acceptedFiles : [];

    if (!diffId || !pendingDiffs.has(diffId)) {
      writeJson(response, 404, {
        ok: false,
        error: `差异 ${diffId} 不存在或已过期`
      });
      return;
    }

    const diff = pendingDiffs.get(diffId);
    diff.resolved = true;

    // 确定要应用的文件
    const filesToApply = clientAcceptedFiles.length > 0
      ? diff.files.filter((f) => clientAcceptedFiles.includes(f.path))
      : diff.files;

    pendingDiffs.delete(diffId);

    onDiffAccepted?.(diffId, filesToApply);
    onInboundMessage?.({
      type: "vscode:diff:accepted",
      channel: "vscode-deepsix",
      diffId,
      files: filesToApply.map((f) => f.path),
      timestamp: Date.now()
    });

    writeJson(response, 200, {
      ok: true,
      diffId,
      appliedFiles: filesToApply.map((f) => ({
        path: f.path,
        title: f.title,
        status: "applied"
      })),
      message: `已应用 ${filesToApply.length} 个文件的差异`
    });
  }

  async function handleDiffReject(request, response) {
    const body = await readRequestBody(request);
    const diffId = String(body.diffId || "").trim();
    const reason = String(body.reason || "用户取消了差异").trim();

    if (!diffId || !pendingDiffs.has(diffId)) {
      writeJson(response, 404, {
        ok: false,
        error: `差异 ${diffId} 不存在或已过期`
      });
      return;
    }

    const diff = pendingDiffs.get(diffId);
    pendingDiffs.delete(diffId);

    onDiffRejected?.(diffId, reason);
    onInboundMessage?.({
      type: "vscode:diff:rejected",
      channel: "vscode-deepsix",
      diffId,
      reason,
      timestamp: Date.now()
    });

    writeJson(response, 200, {
      ok: true,
      diffId,
      message: "差异已拒绝"
    });
  }

  async function handleWrite(request, response) {
    const body = await readRequestBody(request);
    const files = Array.isArray(body.files) ? body.files : [];
    const targetRoot = String(body.workspaceRoot || "").trim();

    if (files.length === 0) {
      writeJson(response, 400, {
        ok: false,
        error: "没有指定要写入的文件"
      });
      return;
    }

    onInboundMessage?.({
      type: "vscode:write",
      channel: "vscode-deepsix",
      files: files.map((f) => ({ path: f.path, size: (f.content || "").length })),
      targetRoot,
      timestamp: Date.now()
    });

    // 通知 VS Code 写入文件
    writeJson(response, 200, {
      ok: true,
      writeId: `write-${Date.now()}`,
      files: files.map((f) => ({
        path: String(f.path || "").trim(),
        content: String(f.content || ""),
        title: String(f.title || f.path || "").trim()
      })),
      instructions: {
        display: "请在 VS Code 中查看文件写入请求并使用 `Fiitx: 接受写入` 确认。",
        commandAccept: "deepsix.acceptWrite",
        commandReject: "deepsix.rejectWrite"
      }
    });
  }

  async function handleCommand(request, response) {
    const body = await readRequestBody(request);
    const command = String(body.command || "").trim();
    const context = normalizeVscodeContext(body);

    if (!command) {
      writeJson(response, 400, {
        ok: false,
        error: "缺少 command 字段"
      });
      return;
    }

    onInboundMessage?.({
      type: "vscode:command",
      channel: "vscode-deepsix",
      command,
      context: {
        workspaceRoot: context.workspaceRoot,
        activeFilePath: context.activeFilePath,
        hasSelection: Boolean(context.selection),
        selectedText: context.selection?.selectedText || ""
      },
      timestamp: Date.now()
    });

    writeJson(response, 200, {
      ok: true,
      command,
      message: `命令 "${command}" 已转发到 Fiitx Agent`
    });
  }

  async function handleWorkspace(request, response) {
    writeJson(response, 200, {
      ok: true,
      connectedClients: vscodeClients.size,
      clients: [...vscodeClients.entries()].map(([id, info]) => ({
        clientId: id,
        lastPing: info.lastPing,
        workspaceRoot: info.workspaceRoot,
        vscodeVersion: info.vscodeVersion,
        extensionVersion: info.extensionVersion,
        connected: (Date.now() - info.lastPing) < 60000
      })),
      pendingDiffs: pendingDiffs.size,
      diffs: [...pendingDiffs.entries()].map(([id, diff]) => ({
        diffId: id,
        fileCount: diff.files.length,
        files: diff.files.map((f) => f.path),
        summary: diff.summary,
        createdAt: diff.createdAt
      })),
      channelStatus: "active"
    });
  }

  async function requestHandler(request, response) {
    try {
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {});
        return;
      }

      const url = new URL(request.url || "/", `http://${host}:${currentPort}`);

      // 健康检查
      if (request.method === "GET" && ["/health", "/vscode/health"].includes(url.pathname)) {
        writeJson(response, 200, {
          ok: true,
          service: "deepsix-vscode-channel",
          channelId: "vscode-deepsix",
          port: currentPort,
          uptime: process.uptime()
        });
        return;
      }

      // VS Code → Fiitx 连通确认
      if (request.method === "POST" && url.pathname === "/vscode/ping") {
        await handlePing(request, response);
        return;
      }

      // VS Code → Fiitx 发送上下文
      if (request.method === "POST" && url.pathname === "/vscode/context") {
        await handleContext(request, response);
        return;
      }

      // Fiitx → VS Code 推送差异
      if (request.method === "POST" && url.pathname === "/vscode/diff") {
        await handleDiff(request, response);
        return;
      }

      // VS Code → Fiitx 接受差异
      if (request.method === "POST" && url.pathname === "/vscode/diff/accept") {
        await handleDiffAccept(request, response);
        return;
      }

      // VS Code → Fiitx 拒绝差异
      if (request.method === "POST" && url.pathname === "/vscode/diff/reject") {
        await handleDiffReject(request, response);
        return;
      }

      // Fiitx → VS Code 写入文件
      if (request.method === "POST" && url.pathname === "/vscode/write") {
        await handleWrite(request, response);
        return;
      }

      // VS Code → Fiitx 执行命令
      if (request.method === "POST" && url.pathname === "/vscode/command") {
        await handleCommand(request, response);
        return;
      }

      // 查询工作区状态
      if (request.method === "GET" && url.pathname === "/vscode/workspace") {
        await handleWorkspace(request, response);
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: "Not found",
        endpoints: [
          "GET  /health",
          "POST /vscode/ping",
          "POST /vscode/context",
          "POST /vscode/diff",
          "POST /vscode/diff/accept",
          "POST /vscode/diff/reject",
          "POST /vscode/write",
          "POST /vscode/command",
          "GET  /vscode/workspace"
        ]
      });
    } catch (error) {
      writeJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "VS Code channel server failed"
      });
    }
  }

  function start() {
    if (server) {
      return Promise.resolve(getStatus());
    }

    return new Promise((resolve, reject) => {
      server = http.createServer(requestHandler);
      server.once("error", (error) => {
        server = null;
        reject(error);
      });
      server.listen(currentPort, host, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          currentPort = address.port;
        }
        resolve(getStatus());
      });
    });
  }

  function stop() {
    if (!server) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      pendingDiffs.clear();
      vscodeClients.clear();
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }

  function getStatus() {
    return {
      running: Boolean(server),
      host,
      port: currentPort,
      baseUrl: `http://${host}:${currentPort}`,
      connectedClients: vscodeClients.size,
      pendingDiffs: pendingDiffs.size,
      endpoints: {
        ping: `http://${host}:${currentPort}/vscode/ping`,
        context: `http://${host}:${currentPort}/vscode/context`,
        diff: `http://${host}:${currentPort}/vscode/diff`,
        diffAccept: `http://${host}:${currentPort}/vscode/diff/accept`,
        diffReject: `http://${host}:${currentPort}/vscode/diff/reject`,
        write: `http://${host}:${currentPort}/vscode/write`,
        command: `http://${host}:${currentPort}/vscode/command`,
        workspace: `http://${host}:${currentPort}/vscode/workspace`
      }
    };
  }

  return {
    start,
    stop,
    getStatus
  };
}

module.exports = {
  createVscodeChannelServer
};
