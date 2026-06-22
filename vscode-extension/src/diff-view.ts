/**
 * diff-view.ts — Deepsix 内联 Diff 预览 Webview Panel
 *
 * 展示 Deepsix Agent 生成的文件差异对比，支持逐个文件查看、
 * 接受/拒绝操作、一键应用到工作区。
 */

import * as vscode from 'vscode';
import { DeepsixClient } from './client';

// ─── 类型 ───────────────────────────────────────────────────

export interface DiffFileEntry {
  path: string;
  oldContent: string;
  newContent: string;
  title: string;
  language: string;
  /** 前端状态 */
  _status?: 'pending' | 'accepted' | 'rejected';
}

interface DiffViewState {
  diffId: string;
  threadId: string;
  files: DiffFileEntry[];
  summary: string;
  currentIndex: number;
}

// ─── Diff Webview Panel ─────────────────────────────────

export class DeepsixDiffPanel {
  public static readonly viewType = 'deepsix.diffPreview';

  private static _instances = new Map<string, DeepsixDiffPanel>();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _state: DiffViewState;
  private _disposables: vscode.Disposable[] = [];
  private _client: DeepsixClient;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    state: DiffViewState,
    client: DeepsixClient
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._state = state;
    this._client = client;

    this._panel.webview.html = this._getWebviewContent();
    this._panel.onDidChangeViewState(() => this._update(), null, this._disposables);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // 监听来自 Webview 的消息
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  /**
   * 创建或聚焦 Diff 面板
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    diffId: string,
    threadId: string,
    files: DiffFileEntry[],
    summary: string,
    client: DeepsixClient
  ): DeepsixDiffPanel {
    const existing = DeepsixDiffPanel._instances.get(diffId);
    if (existing) {
      existing._state.files = files;
      existing._state.summary = summary;
      existing._state.currentIndex = 0;
      existing._panel.reveal(vscode.ViewColumn.Beside);
      existing._update();
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      DeepsixDiffPanel.viewType,
      `Diff: ${files.length} 个文件`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    const instance = new DeepsixDiffPanel(panel, extensionUri, {
      diffId,
      threadId,
      files,
      summary,
      currentIndex: 0,
    }, client);

    DeepsixDiffPanel._instances.set(diffId, instance);
    return instance;
  }

  /**
   * 追加更多差异文件到已有面板
   */
  appendFiles(files: DiffFileEntry[], summary: string): void {
    // 去重：已存在的 path 跳过
    const existingPaths = new Set(this._state.files.map((f) => f.path));
    const newFiles = files.filter((f) => !existingPaths.has(f.path));

    if (newFiles.length === 0) return;

    this._state.files.push(...newFiles);
    if (summary) {
      this._state.summary = summary;
    }
    this._panel.title = `Diff: ${this._state.files.length} 个文件`;
    this._update();
  }

  /**
   * 更新 Webview 内容
   */
  private _update(): void {
    if (this._panel.webview.html) {
      this._panel.webview.html = this._getWebviewContent();
    }
  }

  /**
   * 处理来自 Webview 的消息
   */
  private async _handleMessage(message: Record<string, unknown>): Promise<void> {
    const type = String(message.type || '');
    const fileIndex = Number(message.fileIndex ?? this._state.currentIndex);
    const file = this._state.files[fileIndex];

    switch (type) {
      case 'navigate': {
        const idx = Number(message.index ?? 0);
        if (idx >= 0 && idx < this._state.files.length) {
          this._state.currentIndex = idx;
          this._update();
        }
        break;
      }

      case 'acceptFile': {
        if (!file) return;
        file._status = 'accepted';
        try {
          // 将新内容写入文件
          const uri = vscode.Uri.file(file.path);
          const workspaceEdit = new vscode.WorkspaceEdit();
          const oldContent = Buffer.byteLength(file.oldContent, 'utf-8');
          const range = new vscode.Range(0, 0, 999999, 0);
          workspaceEdit.replace(uri, range, file.newContent);
          const applied = await vscode.workspace.applyEdit(workspaceEdit);
          if (applied) {
            vscode.window.showInformationMessage(`✅ 已应用: ${file.path}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `写入失败 ${file.path}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        this._update();
        break;
      }

      case 'rejectFile': {
        if (!file) return;
        file._status = 'rejected';
        this._update();
        break;
      }

      case 'acceptAll': {
        // 逐个接受所有待处理的文件
        for (let i = 0; i < this._state.files.length; i++) {
          const f = this._state.files[i];
          if (f._status === 'pending' || !f._status) {
            f._status = 'accepted';
            try {
              const uri = vscode.Uri.file(f.path);
              const workspaceEdit = new vscode.WorkspaceEdit();
              const range = new vscode.Range(0, 0, 999999, 0);
              workspaceEdit.replace(uri, range, f.newContent);
              await vscode.workspace.applyEdit(workspaceEdit);
            } catch {
              // 静默失败，继续处理下一个
            }
          }
        }
        // 通知 Deepsix 服务器
        try {
          await this._client.acceptDiff(this._state.diffId,
            this._state.files.filter(f => f._status === 'accepted').map(f => f.path)
          );
        } catch {
          // 服务器可能已不可达
        }
        vscode.window.showInformationMessage(
          `✅ 已接受所有 ${this._state.files.length} 个文件`
        );
        this._update();
        break;
      }

      case 'rejectAll': {
        this._state.files.forEach((f) => (f._status = 'rejected'));
        try {
          await this._client.rejectDiff(this._state.diffId, '用户拒绝了全部差异');
        } catch {
          // 服务器可能已不可达
        }
        vscode.window.showInformationMessage('已拒绝所有差异');
        this._update();
        break;
      }

      case 'openInEditor': {
        if (!file) return;
        const uri = vscode.Uri.file(file.path);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        break;
      }
    }
  }

  /**
   * 生成 Webview HTML
   */
  private _getWebviewContent(): string {
    const file = this._state.files[this._state.currentIndex];
    if (!file) {
      return `<!DOCTYPE html><html><body><p>没有差异文件</p></body></html>`;
    }

    const total = this._state.files.length;
    const idx = this._state.currentIndex;
    const hasPrev = idx > 0;
    const hasNext = idx < total - 1;

    // 生成统一差异格式
    const diffLines = this._computeUnifiedDiff(file.oldContent, file.newContent);

    // 文件状态徽标
    const statusBadge = file._status === 'accepted'
      ? '<span class="badge badge-accept">✅ 已接受</span>'
      : file._status === 'rejected'
      ? '<span class="badge badge-reject">❌ 已拒绝</span>'
      : '<span class="badge badge-pending">⏳ 待处理</span>';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Deepsix Diff</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 16px;
    margin: 0;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-size: 13px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .file-path {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-weight: 600;
    font-size: 14px;
  }
  .nav-buttons {
    display: flex;
    gap: 4px;
  }
  .summary {
    color: var(--vscode-descriptionForeground);
    margin-bottom: 12px;
    padding: 8px;
    background: var(--vscode-textBlockQuote-background);
    border-radius: 4px;
    font-size: 12px;
  }
  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .badge-accept { background: #27ae6020; color: #27ae60; }
  .badge-reject { background: #e74c3c20; color: #e74c3c; }
  .badge-pending { background: #f39c1220; color: #f39c12; }
  .diff-container {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    overflow: hidden;
  }
  .diff-line {
    display: flex;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    min-height: 22px;
  }
  .diff-line.add {
    background: #27ae6015;
  }
  .diff-line.add .prefix { color: #27ae60; }
  .diff-line.remove {
    background: #e74c3c15;
  }
  .diff-line.remove .prefix { color: #e74c3c; }
  .diff-line.normal {
    background: transparent;
  }
  .diff-line.normal .prefix { color: var(--vscode-descriptionForeground); }
  .line-num {
    width: 48px;
    text-align: right;
    padding: 0 8px;
    color: var(--vscode-editorLineNumber-foreground);
    user-select: none;
    flex-shrink: 0;
  }
  .prefix {
    width: 20px;
    text-align: center;
    user-select: none;
    flex-shrink: 0;
    font-weight: 700;
  }
  .content {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
    padding-left: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  button:hover { opacity: 0.85; }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .file-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }
  .progress-bar {
    display: flex;
    gap: 2px;
    margin-bottom: 8px;
  }
  .progress-dot {
    width: 16px;
    height: 4px;
    border-radius: 2px;
    background: var(--vscode-panel-border);
    cursor: pointer;
  }
  .progress-dot.active { background: var(--vscode-button-background); }
  .progress-dot.accepted { background: #27ae60; }
  .progress-dot.rejected { background: #e74c3c; }
</style>
</head>
<body>
  <div class="header">
    <div class="file-info">
      <span class="file-path">${this._escapeHtml(file.title || file.path)}</span>
      ${statusBadge}
      <span class="file-count">${idx + 1} / ${total}</span>
    </div>
    <div class="nav-buttons">
      <button class="secondary" onclick="navigate(${idx - 1})" ${hasPrev ? '' : 'disabled'}>◀ 上一个</button>
      <button class="secondary" onclick="navigate(${idx + 1})" ${hasNext ? '' : 'disabled'}>下一个 ▶</button>
    </div>
  </div>

  ${
    this._state.summary
      ? `<div class="summary">${this._escapeHtml(this._state.summary)}</div>`
      : ''
  }

  <div class="progress-bar">
    ${this._state.files
      .map(
        (f, i) =>
          `<div class="progress-dot ${
            i === idx ? 'active' : ''
          } ${f._status === 'accepted' ? 'accepted' : ''} ${
            f._status === 'rejected' ? 'rejected' : ''
          }" onclick="navigate(${i})" title="${this._escapeHtml(f.path)}"></div>`
      )
      .join('')}
  </div>

  <div class="diff-container">
    ${diffLines
      .map(
        (line) =>
          `<div class="diff-line ${line.type}">
            <span class="line-num">${line.num}</span>
            <span class="prefix">${line.prefix}</span>
            <span class="content">${this._escapeHtml(line.text)}</span>
          </div>`
      )
      .join('')}
  </div>

  <div class="actions">
    <button onclick="acceptFile(${idx})" ${
      file._status === 'accepted' ? 'disabled' : ''
    }>✅ 接受此文件</button>
    <button class="secondary" onclick="rejectFile(${idx})" ${
      file._status === 'rejected' ? 'disabled' : ''
    }>❌ 拒绝此文件</button>
    <button class="secondary" onclick="openInEditor(${idx})">📂 在编辑器中打开</button>
    <button onclick="acceptAll()">✅ 接受全部</button>
    <button class="secondary" onclick="rejectAll()">❌ 拒绝全部</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function navigate(index) { vscode.postMessage({ type: 'navigate', index }); }
    function acceptFile(fileIndex) { vscode.postMessage({ type: 'acceptFile', fileIndex }); }
    function rejectFile(fileIndex) { vscode.postMessage({ type: 'rejectFile', fileIndex }); }
    function openInEditor(fileIndex) { vscode.postMessage({ type: 'openInEditor', fileIndex }); }
    function acceptAll() { vscode.postMessage({ type: 'acceptAll' }); }
    function rejectAll() { vscode.postMessage({ type: 'rejectAll' }); }
  </script>
</body>
</html>`;
  }

  /**
   * 计算统一差异格式
   */
  private _computeUnifiedDiff(
    oldText: string,
    newText: string
  ): Array<{ type: 'add' | 'remove' | 'normal'; num: string; prefix: string; text: string }> {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result: Array<{
      type: 'add' | 'remove' | 'normal';
      num: string;
      prefix: string;
      text: string;
    }> = [];

    // 简化版逐行对比（基于 LCS 的简单实现）
    const lcs = this._longestCommonSubsequence(oldLines, newLines);
    let oldIdx = 0;
    let newIdx = 0;
    let lineNum = 1;

    for (const lcsLine of lcs) {
      // 输出旧文件中被删除的行
      while (oldIdx < oldLines.length && oldLines[oldIdx] !== lcsLine) {
        result.push({
          type: 'remove',
          num: `-${oldIdx + 1}`,
          prefix: '-',
          text: oldLines[oldIdx],
        });
        oldIdx++;
      }
      // 输出新文件中增加的行
      while (newIdx < newLines.length && newLines[newIdx] !== lcsLine) {
        result.push({
          type: 'add',
          num: `+${newIdx + 1}`,
          prefix: '+',
          text: newLines[newIdx],
        });
        newIdx++;
      }
      // 输出公共行
      if (oldIdx < oldLines.length && newIdx < newLines.length) {
        result.push({
          type: 'normal',
          num: String(lineNum++),
          prefix: ' ',
          text: lcsLine,
        });
        oldIdx++;
        newIdx++;
      }
    }

    // 剩余的行
    while (oldIdx < oldLines.length) {
      result.push({
        type: 'remove',
        num: `-${oldIdx + 1}`,
        prefix: '-',
        text: oldLines[oldIdx],
      });
      oldIdx++;
    }
    while (newIdx < newLines.length) {
      result.push({
        type: 'add',
        num: `+${newIdx + 1}`,
        prefix: '+',
        text: newLines[newIdx],
      });
      newIdx++;
    }

    return result;
  }

  /**
   * LCS — 最长公共子序列
   */
  private _longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 回溯
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        result.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    return result;
  }

  /**
   * HTML 转义
   */
  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 释放资源
   */
  dispose(): void {
    DeepsixDiffPanel._instances.delete(this._state.diffId);
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
