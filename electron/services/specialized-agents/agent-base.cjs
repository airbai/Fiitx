/**
 * agent-base.cjs
 *
 * 专用 Agent 基类 — 所有 Specialized Agent 的统一接口
 *
 * ========== 设计原则 ==========
 * 1. 每个 Agent 负责一个领域：coding / research / chat / artifact / ...
 * 2. 通过统一的接口（prompt/steer/followUp/abort）与 Orchestrator 交互
 * 3. 可共享同一个 StructuredMemory 实例（由 Orchestrator 注入）
 * 4. 支持级联：一个 Agent 可以建议 Orchestrator 切换到另一个 Agent
 *
 * ========== 接口 ==========
 * class SpecializedAgent {
 *   get id()           -> string
 *   get capabilities() -> string[]
 *   get description()  -> string
 *   canHandle(intent, payload) -> number (0-1 confidence)
 *   prompt(text, context) -> Promise<AgentResult>
 *   steer(text)        -> Promise<void>
 *   followUp(text)     -> Promise<void>
 *   abort()            -> void
 *   reset()            -> void
 * }
 */

class AgentResult {
  /**
   * @param {Object} options
   * @param {boolean} options.ok
   * @param {string} options.summary - 最终回复文本
   * @param {string} [options.errorMessage]
   * @param {string} [options.suggestNextAgent] - 建议 Orchestrator 切换到的 Agent id
   * @param {Object} [options.suggestNextContext] - 切换时携带的上下文
   * @param {Array} [options.toolEvents]
   * @param {Object} [options.approvalRequest]
   * @param {Array} [options.artifacts]
   * @param {Object} [options.meta] - 额外元信息（执行时间、token 用量等）
   */
  constructor(options = {}) {
    this.ok = options.ok !== false;
    this.summary = options.summary || '';
    this.errorMessage = options.errorMessage || '';
    this.suggestNextAgent = options.suggestNextAgent || '';
    this.suggestNextContext = options.suggestNextContext || null;
    this.toolEvents = options.toolEvents || [];
    this.approvalRequest = options.approvalRequest || null;
    this.artifacts = options.artifacts || [];
    this.meta = options.meta || {};
  }
}

class SpecializedAgent {
  /**
   * @param {Object} options
   * @param {string} options.id - Agent 唯一标识
   * @param {string} options.name - 可读名称
   * @param {string} options.description - 职责描述
   * @param {string[]} options.capabilities - 能力标签
   * @param {Object} options.modelRouter - 模型路由实例
   * @param {Object} [options.memory] - 可选的 StructuredMemory 实例
   * @param {Object} [options.toolRegistry] - 工具注册中心
   * @param {Function} [options.emitProgress] - 进度回调
   */
  constructor(options = {}) {
    if (new.target === SpecializedAgent) {
      throw new Error('SpecializedAgent 是抽象类，不能直接实例化');
    }

    this._id = options.id || 'unknown-agent';
    this._name = options.name || '未知 Agent';
    this._description = options.description || '';
    this._capabilities = options.capabilities || [];
    this.modelRouter = options.modelRouter;
    this.memory = options.memory || null;
    this.toolRegistry = options.toolRegistry || null;
    this.emitProgress = options.emitProgress || (() => {});
    this._running = false;
  }

  /** @returns {string} */
  get id() { return this._id; }

  /** @returns {string} */
  get name() { return this._name; }

  /** @returns {string} */
  get description() { return this._description; }

  /** @returns {string[]} */
  get capabilities() { return [...this._capabilities]; }

  /** @returns {boolean} */
  get running() { return this._running; }

  /**
   * 判断是否能处理该意图/请求
   * @param {Object} intent - routeIntent 的输出
   * @param {Object} payload - 原始请求 payload
   * @returns {number} 0~1 置信度
   */
  canHandle(intent, payload) {
    return 0;
  }

  /**
   * 处理用户请求
   * @param {string} text - 用户输入
   * @param {Object} context - 上下文（含 systemPrompt, messages, intent, payload 等）
   * @returns {Promise<AgentResult>}
   */
  async prompt(text, context) {
    throw new Error(`${this._id}.prompt() 未实现`);
  }

  /**
   * 中途补充
   * @param {string} text
   * @returns {Promise<void>}
   */
  async steer(text) {
    this.emitProgress({ status: 'running', title: `${this._name} 收到补充`, detail: String(text || '').slice(0, 120) });
  }

  /**
   * 后续任务排队
   * @param {string} text
   * @returns {Promise<void>}
   */
  async followUp(text) {
    this.emitProgress({ status: 'running', title: `${this._name} 收到后续任务`, detail: String(text || '').slice(0, 120) });
  }

  /**
   * 终止当前回合
   */
  abort() {
    this._running = false;
    this.emitProgress({ status: 'warn', title: `${this._name} 已停止`, detail: '用户请求停止 Agent。' });
  }

  /**
   * 重置 Agent 状态
   */
  reset() {
    this._running = false;
  }
}

module.exports = {
  SpecializedAgent,
  AgentResult,
};
