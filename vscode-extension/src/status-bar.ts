/**
 * status-bar.ts — Deepsix VS Code 状态栏指示器
 *
 * 显示连接状态、待处理差异数、点击快捷操作。
 */

import * as vscode from 'vscode';
import { DeepsixClient, DeepsixConnectionError } from './client';

// ─── 状态栏颜色 ─────────────────────────────────────────

const COLORS = {
  connected: new vscode.ThemeColor('statusBarItem.prominentForeground'),
  disconnected: new vscode.ThemeColor('statusBarItem.warningForeground'),
  error: new vscode.ThemeColor('statusBarItem.errorForeground'),
  busy: new vscode.ThemeColor('statusBarItem.prominentForeground'),
};

// ─── 状态栏项目 ─────────────────────────────────────────

export class DeepsixStatusBar {
  private item: vscode.StatusBarItem;
  private client: DeepsixClient;
  private _status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private _pendingDiffs: number = 0;
  private _disposables: vscode.Disposable[] = [];
  private _pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(client: DeepsixClient) {
    this.client = client;

    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.name = 'Deepsix';
    this.item.tooltip = 'Deepsix AI Agent — 点击查看详情';
    this.item.command = 'deepsix.showStatus';
    this.item.show();

    this._disposables.push(this.item);
    this.render();
  }

  get status(): string {
    return this._status;
  }

  get pendingDiffs(): number {
    return this._pendingDiffs;
  }

  /**
   * 更新连接状态
   */
  setConnected(connected: boolean, pendingDiffs: number = 0): void {
    this._status = connected ? 'connected' : 'disconnected';
    this._pendingDiffs = pendingDiffs;
    this.render();
  }

  /**
   * 设置为连接中
   */
  setConnecting(): void {
    this._status = 'connecting';
    this.render();
  }

  /**
   * 设置为错误状态
   */
  setError(): void {
    this._status = 'error';
    this.render();
  }

  /**
   * 更新待处理差异数
   */
  setPendingDiffs(count: number): void {
    this._pendingDiffs = count;
    this.render();
  }

  /**
   * 渲染状态栏图标和文字
   */
  private render(): void {
    switch (this._status) {
      case 'connected': {
        const diffBadge = this._pendingDiffs > 0 ? ` (${this._pendingDiffs})` : '';
        this.item.text = `$(radio-tower) Deepsix${diffBadge}`;
        this.item.backgroundColor = undefined;
        this.item.color = COLORS.connected;
        this.item.tooltip =
          this._pendingDiffs > 0
            ? `Deepsix 已连接 — ${this._pendingDiffs} 个差异待处理`
            : 'Deepsix 已连接 — 点击查看详情';
        break;
      }
      case 'connecting':
        this.item.text = '$(loading~spin) Deepsix';
        this.item.backgroundColor = undefined;
        this.item.color = COLORS.busy;
        this.item.tooltip = '正在连接 Deepsix 桌面应用…';
        break;
      case 'error':
        this.item.text = '$(alert) Deepsix 错误';
        this.item.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.item.color = COLORS.error;
        this.item.tooltip = 'Deepsix 连接异常 — 点击重新连接';
        break;
      case 'disconnected':
      default:
        this.item.text = '$(wifi) Deepsix 未连接';
        this.item.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.item.color = COLORS.disconnected;
        this.item.tooltip = 'Deepsix 未连接 — 点击连接';
        break;
    }
  }

  /**
   * 启动定期轮询（每 30 秒检查连接状态）
   */
  startPolling(): void {
    this.stopPolling();
    this._pollTimer = setInterval(async () => {
      try {
        await this.client.ping();
        const ws = await this.client.getWorkspaceInfo();
        this.setConnected(true, ws.pendingDiffs);
      } catch {
        if (this._status === 'connected') {
          this.setError();
        }
      }
    }, 30000);
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.stopPolling();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
