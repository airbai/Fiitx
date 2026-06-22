/**
 * extension.ts — Deepsix VS Code Extension 主入口
 *
 * 注册所有 8 个命令、状态栏、Diff 预览、右键菜单事件。
 * 架构：VS Code Extension 作为客户端，通过 HTTP 与 Deepsix Electron 桌面应用通信。
 *
 * 命令列表（来自 package.json）：
 *   deepsix.connect          — 连接到 Deepsix 桌面应用
 *   deepsix.disconnect       — 断开连接
 *   deepsix.sendContext      — 发送当前文件上下文
 *   deepsix.sendSelection    — 发送选中代码到 Deepsix
 *   deepsix.showStatus       — 查看连接状态
 *   deepsix.acceptDiff       — 接受差异
 *   deepsix.rejectDiff       — 拒绝差异
 *   deepsix.openInEditor     — 在编辑器中打开差异文件
 */

import * as vscode from 'vscode';
import {
  DeepsixClient,
  getDeepsixClient,
  resetDeepsixClient,
  DeepsixConnectionError,
  DeepsixApiError,
} from './client';
import { DeepsixStatusBar } from './status-bar';
import { DeepsixDiffPanel, DiffFileEntry } from './diff-view';

// ─── 全局状态 ───────────────────────────────────────────────

let statusBar: DeepsixStatusBar | null = null;
let client: DeepsixClient | null = null;
let currentDiffId: string | null = null;
let diffPollTimer: ReturnType<typeof setInterval> | null = null;

// ─── 激活 ───────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log('[Deepsix] 扩展激活');

  // 初始化客户端和状态栏
  const config = vscode.workspace.getConfiguration('deepsix');
  client = getDeepsixClient({
    host: config.get<string>('host', '127.0.0.1'),
    port: config.get<number>('port', 18767),
    timeoutMs: 10000,
  });
  statusBar = new DeepsixStatusBar(client);
  context.subscriptions.push(statusBar);

  // ─── 注册所有命令 ───────────────────────────────────

  // 1. deepsix.connect — 连接到 Deepsix 桌面应用
  const connectCmd = vscode.commands.registerCommand('deepsix.connect', async () => {
    await connectToDeepsix();
  });

  // 2. deepsix.disconnect — 断开连接
  const disconnectCmd = vscode.commands.registerCommand('deepsix.disconnect', () => {
    disconnectFromDeepsix();
  });

  // 3. deepsix.sendContext — 发送当前文件上下文
  const sendContextCmd = vscode.commands.registerCommand(
    'deepsix.sendContext',
    async (uri?: vscode.Uri) => {
      await sendCurrentContext(uri);
    }
  );

  // 4. deepsix.sendSelection — 发送选中代码
  const sendSelectionCmd = vscode.commands.registerCommand(
    'deepsix.sendSelection',
    async () => {
      await sendSelectedCode();
    }
  );

  // 5. deepsix.showStatus — 查看连接状态
  const showStatusCmd = vscode.commands.registerCommand('deepsix.showStatus', async () => {
    await showConnectionStatus();
  });

  // 6. deepsix.acceptDiff — 接受差异
  const acceptDiffCmd = vscode.commands.registerCommand(
    'deepsix.acceptDiff',
    async (diffId?: string) => {
      await acceptCurrentDiff(diffId);
    }
  );

  // 7. deepsix.rejectDiff — 拒绝差异
  const rejectDiffCmd = vscode.commands.registerCommand(
    'deepsix.rejectDiff',
    async (diffId?: string) => {
      await rejectCurrentDiff(diffId);
    }
  );

  // 8. deepsix.openInEditor — 在编辑器中打开差异文件
  const openInEditorCmd = vscode.commands.registerCommand(
    'deepsix.openInEditor',
    async (filePath?: string) => {
      await openDiffFileInEditor(filePath);
    }
  );

  context.subscriptions.push(
    connectCmd,
    disconnectCmd,
    sendContextCmd,
    sendSelectionCmd,
    showStatusCmd,
    acceptDiffCmd,
    rejectDiffCmd,
    openInEditorCmd
  );

  // ─── 自动连接 ───────────────────────────────────────

  const autoConnect = config.get<boolean>('autoConnect', true);
  if (autoConnect) {
    // 延迟 1 秒再自动连接，确保 VS Code 完全就绪
    setTimeout(() => {
      connectToDeepsix().catch(() => {
        // 静默失败，用户稍后可手动连接
      });
    }, 1000);
  }

  // ─── 文件保存监听：保存后自动发送上下文 ─────────────

  const saveListener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (!client?.isConnected) return;
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      await client.sendContext({
        workspaceRoot,
        activeFilePath: doc.uri.fsPath,
        activeFileContent: doc.getText(),
        languageId: doc.languageId,
        timestamp: Date.now(),
      });
    } catch {
      // 静默
    }
  });
  context.subscriptions.push(saveListener);

  // ─── 启动 Diff 轮询 ────────────────────────────────

  startDiffPolling();

  console.log('[Deepsix] 扩展激活完成');
}

// ─── 停用 ───────────────────────────────────────────────────

export function deactivate() {
  console.log('[Deepsix] 扩展停用');
  stopDiffPolling();
  if (statusBar) {
    statusBar.dispose();
    statusBar = null;
  }
  resetDeepsixClient();
  client = null;
}

// ─── 核心操作 ──────────────────────────────────────────────

/**
 * 连接到 Deepsix 桌面应用
 */
async function connectToDeepsix(): Promise<boolean> {
  if (!client || !statusBar) return false;

  statusBar.setConnecting();
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const result = await client.ping({ workspaceRoot });

    if (result.ok) {
      statusBar.setConnected(true, result.pendingDiffs);
      statusBar.startPolling();

      // 连接成功后自动发送当前上下文
      vscode.commands.executeCommand('deepsix.sendContext');

      vscode.window.showInformationMessage(
        `✅ Deepsix 已连接（${result.deepsixVersion}）`
      );
      return true;
    } else {
      statusBar.setError();
      vscode.window.showWarningMessage('⚠️ Deepsix 连接失败：服务器返回异常');
      return false;
    }
  } catch (error) {
    statusBar.setError();
    const message =
      error instanceof DeepsixConnectionError
        ? error.message
        : '无法连接到 Deepsix 桌面应用。请确保 Deepsix 已启动。';
    vscode.window.showWarningMessage(`⚠️ ${message}`);
    return false;
  }
}

/**
 * 断开与 Deepsix 的连接
 */
function disconnectFromDeepsix(): void {
  if (statusBar) {
    statusBar.stopPolling();
    statusBar.setConnected(false);
  }
  if (client) {
    client.reset();
  }
  vscode.window.showInformationMessage('Deepsix 已断开连接');
}

/**
 * 发送当前文件上下文到 Deepsix
 */
async function sendCurrentContext(uri?: vscode.Uri): Promise<void> {
  if (!client || !client.isConnected) {
    vscode.window.showWarningMessage('⚠️ Deepsix 未连接，请先执行 "Deepsix: 连接"');
    return;
  }

  try {
    let targetUri = uri;
    if (!targetUri) {
      // 尝试获取活动编辑器中的文件
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        targetUri = editor.document.uri;
      }
    }

    if (!targetUri) {
      vscode.window.showWarningMessage('没有打开的文件可以发送上下文');
      return;
    }

    const doc = await vscode.workspace.openTextDocument(targetUri);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const diagnostics = collectDiagnostics(targetUri.fsPath);

    const result = await client.sendContext({
      workspaceRoot,
      activeFilePath: targetUri.fsPath,
      activeFileContent: doc.getText(),
      selection: null,
      languageId: doc.languageId,
      openFiles: vscode.workspace.textDocuments
        .filter((d) => !d.isUntitled)
        .map((d) => d.uri.fsPath),
      diagnostics,
      timestamp: Date.now(),
    });

    if (result.ok) {
      vscode.window.setStatusBarMessage(
        `$(check) Deepsix: 已发送 ${result.context.activeFilePath.split('/').pop() || '文件'}`,
        3000
      );
    }
  } catch (error) {
    const msg =
      error instanceof DeepsixConnectionError
        ? error.message
        : '发送上下文失败';
    vscode.window.showErrorMessage(`❌ ${msg}`);
  }
}

/**
 * 发送选中代码到 Deepsix
 */
async function sendSelectedCode(): Promise<void> {
  if (!client || !client.isConnected) {
    vscode.window.showWarningMessage('⚠️ Deepsix 未连接，请先执行 "Deepsix: 连接"');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('没有活动的编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('请先选中一段代码');
    return;
  }

  const doc = editor.document;
  const selectedText = doc.getText(selection);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  try {
    const result = await client.sendContext({
      workspaceRoot,
      activeFilePath: doc.uri.fsPath,
      activeFileContent: doc.getText(),
      selection: {
        startLine: selection.start.line,
        startColumn: selection.start.character,
        endLine: selection.end.line,
        endColumn: selection.end.character,
        selectedText,
      },
      languageId: doc.languageId,
      openFiles: vscode.workspace.textDocuments
        .filter((d) => !d.isUntitled)
        .map((d) => d.uri.fsPath),
      diagnostics: collectDiagnostics(doc.uri.fsPath),
      timestamp: Date.now(),
    });

    if (result.ok) {
      vscode.window.setStatusBarMessage(
        `$(check) Deepsix: 已发送选中代码 (${selectedText.length} 字符)`,
        3000
      );
    }
  } catch (error) {
    const msg =
      error instanceof DeepsixConnectionError
        ? error.message
        : '发送选中代码失败';
    vscode.window.showErrorMessage(`❌ ${msg}`);
  }
}

/**
 * 查看连接状态
 */
async function showConnectionStatus(): Promise<void> {
  if (!client || !statusBar) return;

  if (!client.isConnected) {
    const choice = await vscode.window.showInformationMessage(
      'Deepsix 未连接',
      { modal: false, detail: 'Deepsix 桌面应用通道服务器未连接。请确保 Deepsix 已启动。' },
      '连接'
    );
    if (choice === '连接') {
      await connectToDeepsix();
    }
    return;
  }

  try {
    const info = await client.getWorkspaceInfo();
    const items: vscode.MessageItem[] = [
      { title: '断开连接' },
      { title: '重新连接' },
    ];

    const detail = [
      `状态: ✅ 已连接`,
      `服务器: ${client.baseUrl}`,
      `通道: ${info.channelStatus}`,
      `待处理差异: ${info.pendingDiffs}`,
      `连接客户端: ${info.connectedClients}`,
      ...(info.diffs.length > 0
        ? [`\n差异列表:`, ...info.diffs.map((d) => `  • ${d.diffId} (${d.fileCount} 文件)`)]
        : []),
    ].join('\n');

    if (info.pendingDiffs > 0) {
      items.unshift({ title: `查看 ${info.pendingDiffs} 个待处理差异` });
    }

    const choice = await vscode.window.showInformationMessage(
      'Deepsix 连接状态',
      { modal: false, detail },
      ...items
    );

    if (choice?.title === '断开连接') {
      disconnectFromDeepsix();
    } else if (choice?.title === '重新连接') {
      disconnectFromDeepsix();
      await connectToDeepsix();
    } else if (choice?.title?.includes('待处理差异')) {
      // 触发 diff 列表显示
      vscode.commands.executeCommand('deepsix.acceptDiff');
    }
  } catch {
    statusBar.setError();
    vscode.window.showWarningMessage('⚠️ 无法获取 Deepsix 状态，连接可能已断开');
  }
}

/**
 * 接受当前差异
 */
async function acceptCurrentDiff(diffId?: string): Promise<void> {
  if (!client || !client.isConnected) {
    vscode.window.showWarningMessage('⚠️ Deepsix 未连接');
    return;
  }

  const id = diffId || currentDiffId;
  if (!id) {
    // 尝试从服务器获取当前待处理差异
    try {
      const info = await client.getWorkspaceInfo();
      if (info.pendingDiffs === 0) {
        vscode.window.showInformationMessage('没有待处理的差异');
        return;
      }
      // 如果有多个，让用户选择
      if (info.diffs.length === 1) {
        await applyDiffById(info.diffs[0].diffId);
      } else if (info.diffs.length > 1) {
        const picks = info.diffs.map((d) => ({
          label: d.diffId,
          detail: `${d.fileCount} 个文件 — ${d.summary || '无描述'}`,
          description: d.files.slice(0, 3).join(', '),
        }));
        const pick = await vscode.window.showQuickPick(picks, {
          placeHolder: '选择要接受的差异',
        });
        if (pick) {
          await applyDiffById(pick.label);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage('❌ 获取差异列表失败');
    }
    return;
  }

  await applyDiffById(id);
}

/**
 * 按 ID 应用差异
 */
async function applyDiffById(diffId: string): Promise<void> {
  if (!client) return;
  try {
    const result = await client.acceptDiff(diffId);
    if (result.ok) {
      currentDiffId = null;
      vscode.window.showInformationMessage(
        `✅ 已接受 ${result.appliedFiles.length} 个文件`
      );
      if (statusBar) {
        statusBar.setPendingDiffs(0);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `❌ 接受差异失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 拒绝当前差异
 */
async function rejectCurrentDiff(diffId?: string): Promise<void> {
  if (!client || !client.isConnected) {
    vscode.window.showWarningMessage('⚠️ Deepsix 未连接');
    return;
  }

  const id = diffId || currentDiffId;
  if (!id) {
    vscode.window.showWarningMessage('没有指定要拒绝的差异');
    return;
  }

  try {
    const reason = await vscode.window.showInputBox({
      prompt: '拒绝原因（可选）',
      placeHolder: '输入拒绝原因或留空',
    });
    const result = await client.rejectDiff(id, reason || undefined);
    if (result.ok) {
      currentDiffId = null;
      vscode.window.showInformationMessage('差异已拒绝');
      if (statusBar) {
        statusBar.setPendingDiffs(0);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `❌ 拒绝差异失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * 在编辑器中打开差异文件
 */
async function openDiffFileInEditor(filePath?: string): Promise<void> {
  let targetPath = filePath;

  if (!targetPath) {
    // 让用户选择
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      targetPath = editor.document.uri.fsPath;
    } else {
      vscode.window.showWarningMessage('没有指定文件路径');
      return;
    }
  }

  try {
    const uri = vscode.Uri.file(targetPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(
      `无法打开文件: ${targetPath} — ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ─── 辅助函数 ──────────────────────────────────────────────

/**
 * 收集当前文件的诊断信息
 */
function collectDiagnostics(filePath: string): Array<{
  file: string;
  line: number;
  message: string;
  severity: string;
}> {
  const allDiagnostics = vscode.languages.getDiagnostics();
  const result: Array<{
    file: string;
    line: number;
    message: string;
    severity: string;
  }> = [];

  for (const [uri, diagnostics] of allDiagnostics) {
    if (uri.fsPath !== filePath) continue;
    for (const d of diagnostics) {
      result.push({
        file: uri.fsPath,
        line: d.range.start.line,
        message: d.message,
        severity:
          d.severity === vscode.DiagnosticSeverity.Error
            ? 'error'
            : d.severity === vscode.DiagnosticSeverity.Warning
            ? 'warning'
            : 'info',
      });
    }
  }

  return result;
}

/**
 * 启动 Diff 轮询（每 15 秒检查 Deepsix 是否有新的待处理差异）
 */
function startDiffPolling(): void {
  stopDiffPolling();
  diffPollTimer = setInterval(async () => {
    if (!client?.isConnected || !statusBar) return;
    try {
      const info = await client.getWorkspaceInfo();
      statusBar.setPendingDiffs(info.pendingDiffs);

      if (info.pendingDiffs > 0 && info.diffs.length > 0) {
        // 有新差异，通知用户
        const latestDiff = info.diffs[0];
        currentDiffId = latestDiff.diffId;

        // 弹出通知（仅当 VS Code 未聚焦 Deepsix diff 面板时）
        const action = await vscode.window.showInformationMessage(
          `Deepsix: ${latestDiff.fileCount} 个文件差异待处理` +
            (latestDiff.summary ? ` — ${latestDiff.summary}` : ''),
          '查看差异',
          '接受全部'
        );

        if (action === '查看差异') {
          // 打开 Diff 面板 — 但由于我们不知道具体内容，从服务器获取
          // 实际内容应由之前 /vscode/diff 的响应携带
          // 这里我们引导用户使用 acceptDiff 命令
          vscode.commands.executeCommand('deepsix.acceptDiff');
        } else if (action === '接受全部') {
          await client.acceptDiff(latestDiff.diffId);
          statusBar.setPendingDiffs(0);
          vscode.window.showInformationMessage('✅ 已接受全部差异');
        }
      }
    } catch {
      // 轮询失败静默处理
    }
  }, 15000);
}

/**
 * 停止 Diff 轮询
 */
function stopDiffPolling(): void {
  if (diffPollTimer) {
    clearInterval(diffPollTimer);
    diffPollTimer = null;
  }
}
