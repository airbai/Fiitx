/**
 * client.ts — Deepsix VS Code Extension HTTP 客户端
 *
 * 通过本地 HTTP 与 Deepsix Electron 桌面应用的 vscode-channel-server 通信。
 * 所有 API 调用走 127.0.0.1:18767，支持超时、重试、错误标准化。
 */

import * as vscode from 'vscode';

// ─── 类型定义 ───────────────────────────────────────────────

export interface VscodeContext {
  workspaceRoot: string;
  activeFilePath: string;
  activeFileContent: string;
  selection: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    selectedText: string;
  } | null;
  languageId: string;
  openFiles: string[];
  diagnostics: Array<{
    file: string;
    line: number;
    message: string;
    severity: string;
  }>;
  command?: string;
  timestamp: number;
}

export interface DiffFile {
  path: string;
  oldContent: string;
  newContent: string;
  title: string;
  language: string;
}

export interface DiffPayload {
  diffId: string;
  threadId: string;
  files: DiffFile[];
  summary: string;
  timestamp: number;
}

export interface PingResult {
  ok: boolean;
  clientId: string;
  serverTime: number;
  channelId: string;
  deepsixVersion: string;
  pendingDiffs: number;
  message: string;
}

export interface ContextResult {
  ok: boolean;
  contextId: string;
  context: {
    workspaceRoot: string;
    activeFilePath: string;
    languageId: string;
    hasSelection: boolean;
    fileCount: number;
    diagnosticCount: number;
  };
  message: string;
}

export interface DiffResult {
  ok: boolean;
  diffId: string;
  files: Array<{
    path: string;
    title: string;
    language: string;
    hasChanges: boolean;
    oldLength: number;
    newLength: number;
  }>;
  instructions: {
    display: string;
    commandAccept: string;
    commandReject: string;
  };
}

export interface WorkspaceInfo {
  ok: boolean;
  connectedClients: number;
  clients: Array<{
    clientId: string;
    lastPing: number;
    workspaceRoot: string;
    vscodeVersion: string;
    extensionVersion: string;
    connected: boolean;
  }>;
  pendingDiffs: number;
  diffs: Array<{
    diffId: string;
    fileCount: number;
    files: string[];
    summary: string;
    createdAt: number;
  }>;
  channelStatus: string;
}

// ─── 客户端配置 ──────────────────────────────────────────

export interface ClientConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: ClientConfig = {
  host: '127.0.0.1',
  port: 18767,
  timeoutMs: 10000,
};

// ─── 错误类型 ───────────────────────────────────────────────

export class DeepsixConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DeepsixConnectionError';
  }
}

export class DeepsixApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'DeepsixApiError';
  }
}

// ─── HTTP 客户端 ────────────────────────────────────────────

export class DeepsixClient {
  private config: ClientConfig;
  private clientId: string | null = null;

  constructor(config?: Partial<ClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 基础 URL */
  get baseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /** 是否已连接（有过成功的 ping） */
  get isConnected(): boolean {
    return this.clientId !== null;
  }

  /** 获取客户端 ID */
  get currentClientId(): string | null {
    return this.clientId;
  }

  /** 重置连接状态 */
  reset(): void {
    this.clientId = null;
  }

  /**
   * 通用 HTTP POST 请求
   */
  private async post<T>(
    path: string,
    body: Record<string, unknown> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Deepsix-Channel-Token': 'vscode-extension',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new DeepsixApiError(
          (data as Record<string, unknown>)?.error
            ? String((data as Record<string, unknown>).error)
            : `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof DeepsixApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new DeepsixConnectionError(
          `请求超时（${this.config.timeoutMs}ms）: ${path}`
        );
      }
      throw new DeepsixConnectionError(
        `无法连接到 Deepsix 桌面应用（${this.config.host}:${this.config.port}）: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 通用 HTTP GET 请求
   */
  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'X-Deepsix-Channel-Token': 'vscode-extension',
        },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new DeepsixApiError(
          (data as Record<string, unknown>)?.error
            ? String((data as Record<string, unknown>).error)
            : `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof DeepsixApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new DeepsixConnectionError(
          `请求超时（${this.config.timeoutMs}ms）: GET ${path}`
        );
      }
      throw new DeepsixConnectionError(
        `无法连接到 Deepsix 桌面应用: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── API 方法 ─────────────────────────────────────────

  /**
   * 健康检查 — 检测 Deepsix 桌面应用是否运行
   */
  async healthCheck(): Promise<{ ok: boolean; service: string; port: number }> {
    const result = await this.get<{
      ok: boolean;
      service: string;
      port: number;
    }>('/health');
    return result;
  }

  /**
   * 连接 / 心跳 Ping
   */
  async ping(context?: {
    workspaceRoot?: string;
    vscodeVersion?: string;
  }): Promise<PingResult> {
    const result = await this.post<PingResult>('/vscode/ping', {
      clientId: this.clientId || undefined,
      workspaceRoot: context?.workspaceRoot || '',
      vscodeVersion: context?.vscodeVersion || vscode.version,
      extensionVersion: '0.1.0',
    });
    this.clientId = result.clientId;
    return result;
  }

  /**
   * 发送当前上下文（文件、选区、诊断信息）
   */
  async sendContext(context: Partial<VscodeContext>): Promise<ContextResult> {
    return this.post<ContextResult>('/vscode/context', context as Record<string, unknown>);
  }

  /**
   * 从 Deepsix 获取差异推送（由 Deepsix 端发起，这里作为客户端只是预留接口）
   * 实际 diff 由 Deepsix 通过 /vscode/diff POST 主动推送到此客户端？
   * 不 — 架构是 Deepsix 作为 HTTP 服务器，VS Code 扩展作为客户端轮询或等待推送。
   * 目前 Deepsix 端在 handleDiff 中直接返回 diff 到调用方。
   * VS Code 扩展通过命令触发获取 diff 的逻辑在 extension.ts 中实现。
   */

  /**
   * 接受差异
   */
  async acceptDiff(
    diffId: string,
    acceptedFiles?: string[]
  ): Promise<{ ok: boolean; appliedFiles: Array<{ path: string; status: string }> }> {
    return this.post('/vscode/diff/accept', {
      diffId,
      acceptedFiles: acceptedFiles || [],
    });
  }

  /**
   * 拒绝差异
   */
  async rejectDiff(
    diffId: string,
    reason?: string
  ): Promise<{ ok: boolean; message: string }> {
    return this.post('/vscode/diff/reject', {
      diffId,
      reason: reason || '用户取消了差异',
    });
  }

  /**
   * 请求 Deepsix 写入文件
   */
  async writeFiles(
    files: Array<{ path: string; content: string; title?: string }>
  ): Promise<{ ok: boolean; writeId: string }> {
    return this.post('/vscode/write', { files });
  }

  /**
   * 发送命令到 Deepsix Agent
   */
  async sendCommand(
    command: string,
    context?: Partial<VscodeContext>
  ): Promise<{ ok: boolean; command: string; message: string }> {
    return this.post('/vscode/command', {
      command,
      ...(context || {}),
    });
  }

  /**
   * 获取工作区状态
   */
  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return this.get<WorkspaceInfo>('/vscode/workspace');
  }
}

// ─── 工厂函数 ───────────────────────────────────────────────

let _instance: DeepsixClient | null = null;

/**
 * 获取全局单例客户端
 */
export function getDeepsixClient(config?: Partial<ClientConfig>): DeepsixClient {
  if (!_instance) {
    _instance = new DeepsixClient(config);
  }
  return _instance;
}

/**
 * 重置全局客户端（断开连接时使用）
 */
export function resetDeepsixClient(): void {
  if (_instance) {
    _instance.reset();
    _instance = null;
  }
}
