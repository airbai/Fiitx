/**
 * observability.cjs
 *
 * 可观测性 — 流式推理展示 + 执行轨迹
 *
 * ========== 能力 ==========
 * 1. 流式推理展示 — 实时推送 LLM 推理 token、思考过程
 * 2. 执行轨迹 — 记录所有步骤的时间线（工具调用、决策、错误）
 * 3. 步骤追踪 — 每个 agent 回合的详细步骤记录
 * 4. 性能分析 — 各步骤耗时、token 用量、工具调用统计
 * 5. 可视化数据结构 — 供前端渲染时间线/火焰图/调用树
 *
 * ========== 架构 ==========
 *
 *  ┌────────────────────────────────────────────────────┐
 *  │                  Observability                      │
 *  │                                                     │
 *  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
 *  │  │  StreamingBus │  │  TraceStore  │  │  StepLog  │  │
 *  │  │  pushToken()  │  │  beginTrace()│  │  logStep()│  │
 *  │  │  pushThinking()│  │  endTrace() │  │  getSteps()│  │
 *  │  │  pushToolCall()│  │  getTrace() │  │          │  │
 *  │  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
 *  │         │                 │                │        │
 *  │         ▼                 ▼                ▼        │
 *  │  ┌──────────────────────────────────────────────┐   │
 *  │  │              Event Bus (emit)                 │   │
 *  │  │   → 通过 emitProgress 回调推送到前端           │   │
 *  │  └──────────────────────────────────────────────┘   │
 *  └────────────────────────────────────────────────────┘
 */

// ============================================================
// 流式推理总线 — StreamingBus
// ============================================================

/**
 * 推理片段类型
 */
const ThoughtType = Object.freeze({
  TEXT: 'text',           // 普通文本 token
  THINKING: 'thinking',   // 推理/思考过程
  TOOL_CALL: 'tool_call', // 工具调用
  TOOL_RESULT: 'tool_result', // 工具返回结果
  ERROR: 'error',          // 错误
  STEP: 'step',            // 步骤标记
  DECISION: 'decision',    // 决策点
  SYSTEM: 'system',        // 系统消息
});

class StreamingBus {
  /**
   * @param {Object} [options]
   * @param {Function} [options.emitProgress] - 进度回调函数
   * @param {boolean} [options.buffered=false] - 是否启用缓冲（批量推送）
   * @param {number} [options.bufferMs=50] - 缓冲间隔 ms
   */
  constructor(options = {}) {
    this._emitProgress = options.emitProgress || (() => {});
    this._buffered = options.buffered || false;
    this._bufferMs = options.bufferMs || 50;

    this._buffer = [];
    this._bufferTimer = null;
    this._segments = [];
    this._startedAt = Date.now();
    this._finished = false;

    // 统计
    this._stats = {
      totalTokens: 0,
      thinkingTokens: 0,
      textTokens: 0,
      toolCalls: 0,
      steps: 0,
      startTime: Date.now(),
      endTime: null,
    };
  }

  /**
   * 推送一个推理 token
   * @param {string} token - token 文本
   * @param {Object} [options]
   * @param {string} [options.type='text'] - ThoughtType
   * @param {number} [options.stepIndex] - 所属步骤
   */
  pushToken(token, options = {}) {
    if (this._finished) return;

    const type = options.type || ThoughtType.TEXT;
    const segment = {
      type,
      text: token,
      timestamp: Date.now(),
      delta: Date.now() - this._startedAt,
      stepIndex: options.stepIndex,
    };

    this._segments.push(segment);
    this._stats.totalTokens++;

    if (type === ThoughtType.THINKING) this._stats.thinkingTokens++;
    else if (type === ThoughtType.TEXT) this._stats.textTokens++;

    if (this._buffered) {
      this._buffer.push(segment);
      this._scheduleFlush();
    } else {
      this._emitProgress({
        status: 'streaming',
        title: type === ThoughtType.THINKING ? '推理中…' : '生成中…',
        detail: token,
        meta: { type, stepIndex: options.stepIndex },
      });
    }
  }

  /**
   * 推送推理过程（多 token 批量）
   * @param {string} text - 推理文本
   * @param {Object} [options]
   */
  pushThinking(text, options = {}) {
    this.pushToken(text, { ...options, type: ThoughtType.THINKING });
  }

  /**
   * 推送工具调用事件
   * @param {string} toolName - 工具名
   * @param {Object} args - 调用参数
   * @param {string} [toolCallId] - 调用 ID
   */
  pushToolCall(toolName, args, toolCallId) {
    const segment = {
      type: ThoughtType.TOOL_CALL,
      text: '',
      toolName,
      args,
      toolCallId: toolCallId || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      delta: Date.now() - this._startedAt,
    };

    this._segments.push(segment);
    this._stats.toolCalls++;

    const argSummary = JSON.stringify(args || {}).slice(0, 120);
    this._emitProgress({
      status: 'streaming',
      title: `🛠 调用 ${toolName}`,
      detail: argSummary,
      meta: { type: ThoughtType.TOOL_CALL, toolName, toolCallId: segment.toolCallId },
    });
  }

  /**
   * 推送工具调用结果
   * @param {string} toolCallId
   * @param {*} result
   * @param {boolean} [error=false]
   */
  pushToolResult(toolCallId, result, error = false) {
    const resultText = typeof result === 'string'
      ? result.slice(0, 200)
      : JSON.stringify(result || {}).slice(0, 200);

    const segment = {
      type: error ? ThoughtType.ERROR : ThoughtType.TOOL_RESULT,
      text: resultText,
      toolCallId,
      error,
      timestamp: Date.now(),
      delta: Date.now() - this._startedAt,
    };

    this._segments.push(segment);

    this._emitProgress({
      status: error ? 'warn' : 'streaming',
      title: error ? `❌ 工具执行出错` : `✅ 工具返回`,
      detail: resultText,
      meta: { type: ThoughtType.TOOL_RESULT, toolCallId, error },
    });
  }

  /**
   * 推送步骤标记
   * @param {string} label - 步骤名称
   * @param {Object} [options]
   * @param {string} [options.status='running'] - running | success | error
   */
  pushStep(label, options = {}) {
    const index = this._stats.steps;
    const segment = {
      type: ThoughtType.STEP,
      text: label,
      stepIndex: index,
      status: options.status || 'running',
      timestamp: Date.now(),
      delta: Date.now() - this._startedAt,
    };

    this._segments.push(segment);
    this._stats.steps++;

    this._emitProgress({
      status: options.status || 'running',
      title: `📋 步骤 ${index + 1}: ${label}`,
      detail: '',
      meta: { type: ThoughtType.STEP, stepIndex: index },
    });
  }

  /**
   * 推送决策点
   * @param {string} decision - 决策描述
   * @param {Object} [context] - 决策上下文
   */
  pushDecision(decision, context = {}) {
    const segment = {
      type: ThoughtType.DECISION,
      text: decision,
      context,
      timestamp: Date.now(),
      delta: Date.now() - this._startedAt,
    };

    this._segments.push(segment);

    this._emitProgress({
      status: 'running',
      title: `🎯 决策: ${decision}`,
      detail: JSON.stringify(context).slice(0, 200),
      meta: { type: ThoughtType.DECISION },
    });
  }

  /**
   * 标记推理结束
   * @param {Object} [result]
   */
  finish(result = {}) {
    this._finished = true;
    this._stats.endTime = Date.now();
    this._flushBuffer();

    const duration = this._stats.endTime - this._stats.startTime;
    this._emitProgress({
      status: 'success',
      title: '✅ 推理完成',
      detail: `共 ${this._stats.totalTokens} tokens, ${this._stats.toolCalls} 次工具调用, ${duration}ms`,
      meta: { stats: this.getStats(), result },
    });
  }

  /**
   * 获取当前流式记录
   */
  getSegments() {
    return [...this._segments];
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this._stats,
      duration: this._stats.endTime
        ? (this._stats.endTime - this._stats.startTime)
        : (Date.now() - this._stats.startTime),
    };
  }

  _scheduleFlush() {
    if (this._bufferTimer) return;
    this._bufferTimer = setTimeout(() => {
      this._flushBuffer();
      this._bufferTimer = null;
    }, this._bufferMs);
  }

  _flushBuffer() {
    if (this._buffer.length === 0) return;
    const batch = this._buffer.splice(0);
    this._emitProgress({
      status: 'streaming_batch',
      title: `推送 ${batch.length} 个片段`,
      detail: batch.map(s => s.text).join(''),
      meta: { batch: true, count: batch.length },
    });
  }
}

// ============================================================
// 执行轨迹存储 — TraceStore
// ============================================================

/**
 * 轨迹条目类型
 */
const TraceEntryType = Object.freeze({
  AGENT_START: 'agent_start',
  AGENT_END: 'agent_end',
  LLM_CALL: 'llm_call',
  LLM_RESPONSE: 'llm_response',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  POLICY_CHECK: 'policy_check',
  DECISION: 'decision',
  ERROR: 'error',
  STEP: 'step',
  MEMORY_COMPACT: 'memory_compact',
  CASCADE: 'cascade',
});

class TraceStore {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxEntries=500] - 最大条目数
   */
  constructor(options = {}) {
    this._maxEntries = options.maxEntries || 500;
    this._entries = [];
    this._currentTraceId = null;
    this._traceMeta = {};
    this._startTime = null;
  }

  /**
   * 开始一条新轨迹
   * @param {Object} meta - 轨迹元信息
   * @param {string} [meta.sessionId]
   * @param {string} [meta.agentId]
   * @param {string} [meta.intent]
   * @returns {string} traceId
   */
  beginTrace(meta = {}) {
    this._currentTraceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this._startTime = Date.now();
    this._traceMeta = {
      traceId: this._currentTraceId,
      startTime: this._startTime,
      ...meta,
    };

    this._addEntry({
      type: TraceEntryType.AGENT_START,
      title: 'Agent 开始执行',
      detail: meta.intent || '',
      duration: 0,
    });

    return this._currentTraceId;
  }

  /**
   * 结束当前轨迹
   * @param {Object} [result]
   */
  endTrace(result = {}) {
    if (!this._currentTraceId) return;

    const endTime = Date.now();
    const duration = endTime - this._startTime;

    this._addEntry({
      type: TraceEntryType.AGENT_END,
      title: 'Agent 执行结束',
      detail: result.ok ? '完成' : `错误: ${result.errorMessage || ''}`,
      duration,
      meta: { ok: result.ok, errorMessage: result.errorMessage },
    });

    this._traceMeta.endTime = endTime;
    this._traceMeta.duration = duration;
  }

  /**
   * 记录 LLM 调用
   * @param {Object} info
   * @param {string} info.provider
   * @param {string} info.model
   * @param {number} info.inputTokens
   * @param {number} info.outputTokens
   * @param {number} [info.durationMs]
   */
  logLlmCall(info) {
    this._addEntry({
      type: TraceEntryType.LLM_CALL,
      title: `${info.provider}/${info.model}`,
      detail: `input: ${info.inputTokens || '?'} tokens, output: ${info.outputTokens || '?'} tokens`,
      duration: info.durationMs || 0,
      meta: {
        provider: info.provider,
        model: info.model,
        inputTokens: info.inputTokens,
        outputTokens: info.outputTokens,
      },
    });
  }

  /**
   * 记录工具调用
   * @param {Object} info
   * @param {string} info.toolName
   * @param {Object} info.args
   * @param {number} info.durationMs
   * @param {boolean} [info.error]
   * @param {*} [info.result]
   */
  logToolCall(info) {
    this._addEntry({
      type: info.error ? TraceEntryType.ERROR : TraceEntryType.TOOL_CALL,
      title: info.error ? `❌ ${info.toolName}` : `🛠 ${info.toolName}`,
      detail: JSON.stringify(info.args || {}).slice(0, 150),
      duration: info.durationMs || 0,
      meta: {
        toolName: info.toolName,
        args: info.args,
        error: info.error,
        resultPreview: info.result !== undefined
          ? JSON.stringify(info.result).slice(0, 200)
          : undefined,
      },
    });
  }

  /**
   * 记录一个步骤
   * @param {string} label
   * @param {string} [status='running']
   */
  logStep(label, status = 'running') {
    this._addEntry({
      type: TraceEntryType.STEP,
      title: label,
      detail: status,
      duration: 0,
      meta: { status },
    });
  }

  /**
   * 记录决策
   * @param {string} decision
   * @param {Object} [context]
   */
  logDecision(decision, context = {}) {
    this._addEntry({
      type: TraceEntryType.DECISION,
      title: decision,
      detail: JSON.stringify(context).slice(0, 200),
      duration: 0,
      meta: { context },
    });
  }

  /**
   * 记录错误
   * @param {string} message
   * @param {Object} [context]
   */
  logError(message, context = {}) {
    this._addEntry({
      type: TraceEntryType.ERROR,
      title: message,
      detail: JSON.stringify(context).slice(0, 200),
      duration: 0,
      meta: { context },
    });
  }

  /**
   * 获取轨迹数据
   * @returns {Object} 完整轨迹
   */
  getTrace() {
    return {
      traceId: this._currentTraceId,
      meta: this._traceMeta,
      entries: [...this._entries],
      summary: this.summarize(),
    };
  }

  /**
   * 生成轨迹摘要
   */
  summarize() {
    if (this._entries.length === 0) {
      return { totalEntries: 0, toolsCalled: 0, totalDuration: 0 };
    }

    const toolCalls = this._entries.filter(e =>
      e.type === TraceEntryType.TOOL_CALL || e.type === TraceEntryType.ERROR
    );
    const llmCalls = this._entries.filter(e => e.type === TraceEntryType.LLM_CALL);
    const totalDuration = this._entries.reduce((sum, e) => sum + (e.duration || 0), 0);

    const toolStats = {};
    for (const tc of toolCalls) {
      const name = tc.meta?.toolName || tc.title;
      if (!toolStats[name]) {
        toolStats[name] = { calls: 0, totalTime: 0, errors: 0 };
      }
      toolStats[name].calls++;
      toolStats[name].totalTime += tc.duration || 0;
      if (tc.type === TraceEntryType.ERROR) toolStats[name].errors++;
    }

    return {
      totalEntries: this._entries.length,
      toolsCalled: Object.keys(toolStats).length,
      toolCallsDetail: toolStats,
      llmCalls: llmCalls.length,
      totalLlmTokens: llmCalls.reduce((sum, c) => {
        return sum + (c.meta?.inputTokens || 0) + (c.meta?.outputTokens || 0);
      }, 0),
      totalDuration,
      traceDuration: this._traceMeta.duration || totalDuration,
    };
  }

  /**
   * 导出为简易火焰图格式
   */
  toFlameChart() {
    const items = [];
    for (const entry of this._entries) {
      items.push({
        name: entry.title,
        type: entry.type,
        duration: entry.duration,
        start: entry.timestamp ? entry.timestamp - (this._startTime || 0) : 0,
        detail: entry.detail,
      });
    }
    return items;
  }

  _addEntry(entry) {
    const enriched = {
      ...entry,
      id: `entry-${Date.now()}-${this._entries.length}`,
      timestamp: Date.now(),
      relativeTime: this._startTime ? Date.now() - this._startTime : 0,
    };

    this._entries.push(enriched);

    // 限制条目数
    if (this._entries.length > this._maxEntries) {
      this._entries.splice(0, this._entries.length - this._maxEntries);
    }
  }
}

// ============================================================
// Agent 步骤记录器 — StepLog
// ============================================================

class StepLog {
  constructor(traceStore) {
    this._traceStore = traceStore;
    this._steps = [];
    this._currentStep = null;
  }

  /**
   * 开始一个新步骤
   * @param {string} name - 步骤名称
   * @param {Object} [meta]
   * @returns {number} step index
   */
  beginStep(name, meta = {}) {
    const step = {
      index: this._steps.length,
      name,
      meta,
      startedAt: Date.now(),
      endedAt: null,
      duration: null,
      subSteps: [],
      toolCalls: [],
      tokens: { input: 0, output: 0 },
      status: 'running',
      error: null,
    };

    this._steps.push(step);
    this._currentStep = step;
    this._traceStore.logStep(name, 'running');

    return step.index;
  }

  /**
   * 结束当前步骤
   * @param {Object} [options]
   * @param {string} [options.status='success']
   * @param {string} [options.error]
   */
  endStep(options = {}) {
    if (!this._currentStep) return;

    this._currentStep.endedAt = Date.now();
    this._currentStep.duration = this._currentStep.endedAt - this._currentStep.startedAt;
    this._currentStep.status = options.status || 'success';
    this._currentStep.error = options.error || null;

    this._traceStore.logStep(
      `${this._currentStep.name} — ${this._currentStep.duration}ms`,
      this._currentStep.status
    );

    this._currentStep = null;
  }

  /**
   * 记录子步骤
   */
  logSubStep(name, detail = '') {
    if (!this._currentStep) return;
    this._currentStep.subSteps.push({
      name,
      detail,
      timestamp: Date.now(),
    });
  }

  /**
   * 记录步骤中的工具调用
   */
  logToolCall(info) {
    if (!this._currentStep) return;
    this._currentStep.toolCalls.push({
      ...info,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取所有步骤
   */
  getSteps() {
    return [...this._steps];
  }

  /**
   * 获取步骤摘要
   */
  summarize() {
    const totalDuration = this._steps.reduce((s, step) => s + (step.duration || 0), 0);
    const totalToolCalls = this._steps.reduce((s, step) => s + step.toolCalls.length, 0);
    const errors = this._steps.filter(s => s.status === 'error').map(s => ({
      step: s.name,
      error: s.error,
    }));

    return {
      totalSteps: this._steps.length,
      totalDuration,
      totalToolCalls,
      averageStepDuration: this._steps.length ? totalDuration / this._steps.length : 0,
      errors,
      status: errors.length > 0 ? 'has_errors' : 'ok',
    };
  }
}

// ============================================================
// 主入口 — createObservability
// ============================================================

/**
 * 创建可观测性实例
 *
 * @param {Object} [options]
 * @param {Function} [options.emitProgress] - 进度回调
 * @param {Object} [options.logger] - 日志记录器
 * @returns {Object} observability
 */
function createObservability(options = {}) {
  const { emitProgress, logger } = options;

  const traceStore = new TraceStore({ maxEntries: options.maxEntries || 500 });
  const stepLog = new StepLog(traceStore);

  return {
    traceStore,
    stepLog,

    /**
     * 创建流式推理总线
     * @param {Object} [busOptions]
     * @returns {StreamingBus}
     */
    createStream(busOptions = {}) {
      return new StreamingBus({
        emitProgress: busOptions.emitProgress || emitProgress,
        buffered: busOptions.buffered,
        bufferMs: busOptions.bufferMs,
      });
    },

    /**
     * 开始一个 Agent 执行回合
     * @param {Object} meta
     * @returns {string} traceId
     */
    beginSession(meta = {}) {
      return traceStore.beginTrace(meta);
    },

    /**
     * 结束当前会话
     */
    endSession(result = {}) {
      traceStore.endTrace(result);
    },

    /**
     * 生成执行报告
     * @returns {Object}
     */
    generateReport() {
      const trace = traceStore.getTrace();
      return {
        traceId: trace.traceId,
        meta: trace.meta,
        traceSummary: trace.summary,
        stepSummary: stepLog.summarize(),
        steps: stepLog.getSteps(),
        flameChart: traceStore.toFlameChart(),
        timeline: trace.entries.map(e => ({
          time: `${e.relativeTime}ms`,
          type: e.type,
          title: e.title,
          detail: e.detail,
          duration: e.duration || 0,
        })),
      };
    },

    /**
     * 重置所有状态
     */
    reset() {
      // 无法重置 traceStore（只能开始新的）
      // 但 stepLog 可以重置
      // 保留原 traceStore 的引用
    },
  };
}

module.exports = {
  createObservability,
  StreamingBus,
  TraceStore,
  StepLog,
  ThoughtType,
  TraceEntryType,
};
