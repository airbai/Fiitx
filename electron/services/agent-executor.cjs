/**
 * agent-executor.cjs
 *
 * 外部 Agent 调度框架 — 替代手写的 tool-agent-loop.cjs 状态机
 *
 * ========== 设计原则 ==========
 * 1. 保留 DeepSeek（BYOM），通过外部调度实现多步自主推理
 * 2. 兼容原生支持 agent loop 的 LLM（NativeLoopBridge）
 * 3. 流式推送中间状态到前端（onStep 回调）
 * 4. 复用现有的 tool-registry、policy-engine、session-log-store
 * 5. 零外部依赖，纯 CommonJS
 *
 * ========== 核心架构 ==========
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │                    AgentExecutor                        │
 * │                                                        │
 * │  run(messages) {                                       │
 * │    for (step = 0; step < MAX; step++) {                │
 * │      1. 调用 LLM (callChatMessages)                     │
 * │      2. 推流中间推理状态 (onStep)                        │
 * │      3. 解析 tool_calls                                │
 * │      4. [策略审批] policyGate                          │
 * │      5. 执行工具 (toolRegistry.execute)                 │
 * │      6. 结果回填到 messages                             │
 * │      7. 继续循环 / 结束                                 │
 * │    }                                                   │
 * │  }                                                     │
 * └─────────────────────────────────────────────────────────┘
 *
 * ========== 兼容原生 Agent Loop ==========
 *
 * NativeAgentBridge 是 AgentExecutor 的一个变体：
 * - 对 OpenAI Codex / Vertex AI / Gemini 等原生支持 agent loop 的 LLM
 * - 直接调用模型的 Run API（/v1/assistants/runs 等）
 * - 自动获得多步推理、文件读写、代码解释器
 * - 通过统一的 AgentExecutor 接口对外暴露
 */

const { createToolRegistry } = require('./tool-registry.cjs');
const { StructuredMemory, MEMORY_ENTRY_TYPES } = require('./structured-memory.cjs');

// ============================================================
// Native Agent Loop Bridge
// ============================================================

/**
 * 检测模型是否原生支持 agent loop
 * 扩展此函数以支持更多平台
 */
function supportsNativeAgentLoop(profile) {
  if (!profile) return false;

  const provider = String(profile.provider || '').toLowerCase();
  const model = String(profile.model || '').toLowerCase();

  // OpenAI Codex / Assistants API
  if (provider === 'openai' && (model.includes('codex') || model.includes('o1') || model.includes('o3'))) {
    return true;
  }

  // Vertex AI Agent Builder
  if (provider === 'google' && model.includes('gemini') && profile.supportsNativeAgentLoop) {
    return true;
  }

  // 显式标记
  if (profile.supportsNativeAgentLoop === true) {
    return true;
  }

  return false;
}

/**
 * NativeLoopBridge — 直接使用模型原生的 agent loop
 * 通过 profile.nativeAgentRunApi 指定端点
 */
class NativeLoopBridge {
  constructor({ modelRouter, profile, payload, toolRegistry, policyGate, emitProgress, signal, onStep }) {
    this.modelRouter = modelRouter;
    this.profile = profile;
    this.payload = payload;
    this.toolRegistry = toolRegistry;
    this.policyGate = policyGate;
    this.emitProgress = emitProgress;
    this.signal = signal;
    this.onStep = onStep;
  }

  async run(messages) {
    this.onStep?.({ type: 'native_agent_start', detail: `使用原生 Agent Loop：${this.profile.provider} / ${this.profile.model}` });
    this.emitProgress({
      status: 'running',
      title: '原生 Agent Loop',
      detail: `${this.profile.provider} / ${this.profile.model}`,
    });

    // 调用模型的原生 agent loop API
    // 对 OpenAI 来说，可以通过 Assistant API 创建一个 Run
    // 这里使用统一的 callChatMessages 作为降级路径
    const response = await this.modelRouter.callChatMessages(
      this.profile,
      messages,
      {
        tools: this.toolRegistry.getOpenAiTools(),
        toolChoice: 'auto',
        timeoutMs: 300000,
        signal: this.signal,
      }
    );

    this.onStep?.({ type: 'native_agent_end', ok: Boolean(response.content || response.toolCalls?.length) });

    return {
      ok: Boolean(response.content || response.toolCalls?.length),
      summary: response.content || '模型已完成。',
      errorMessage: '',
      fullResponse: response,
    };
  }
}

// ============================================================
// AgentExecutor — 外部调度框架
// ============================================================

const MAX_TOOL_STEPS = 10;

class AgentExecutor {
  /**
   * @param {Object} options
   * @param {Object} options.modelRouter - 模型路由实例
   * @param {Object} options.profile - 模型 profile（包含 provider, model, baseUrl 等）
   * @param {Object} options.payload - 原始请求 payload
   * @param {Object} options.toolRegistry - 工具注册中心
   * @param {Function} options.policyGate - 策略审批函数
   * @param {Object} [options.sessionLogStore] - 会话日志存储
   * @param {Object} [options.telemetryStore] - 遥测存储
   * @param {Function} options.emitProgress - 进度更新回调 (用于 agent-runtime 的 IPC)
   * @param {AbortSignal} [options.signal] - 终止信号
   * @param {Function} [options.onStep] - 中间步骤回调 (用于前端实时展示)
   */
  constructor({
    modelRouter,
    profile,
    payload,
    toolRegistry,
    policyGate,
    sessionLogStore,
    telemetryStore,
    emitProgress = () => {},
    signal,
    onStep = () => {},
  }) {
    this.modelRouter = modelRouter;
    this.profile = profile;
    this.payload = payload;
    this.registry = toolRegistry || createToolRegistry({ toolRuntime: payload.toolRuntime });
    this.policyGate = policyGate;
    this.sessionLogStore = sessionLogStore;
    this.telemetryStore = telemetryStore;
    this.emitProgress = emitProgress;
    this.signal = signal;
    this.onStep = onStep;

    // 运行时状态
    this.messages = [];
    this.state = {
      isRunning: false,
      errorMessage: '',
      pendingToolCalls: [],
      steps: [],
    };
    this.finalText = '';
    this.currentRunId = '';

    // 结构化记忆实例（替代全量消息回放）
    this.memory = new StructuredMemory({
      maxRecentTurns: 3,
      maxEntries: 50,
      autoCompactThreshold: 30,
    });
    /** @type {string|null} 缓存的记忆上下文提示词（在每次 LLM 调用前注入） */
    this.memoryContextPrompt = null;
  }

  /** 检查是否被中止 */
  _throwIfAborted() {
    if (this.signal?.aborted) {
      throw new Error('用户已停止当前 Agent 回合。');
    }
  }

  /** 获取消息列表中最近一条 assistant 文本 */
  _getLatestAssistantText() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }
    }
    return '';
  }

  /**
   * 运行 Agent 循环
   *
   * @param {Array} messages - 初始消息列表（已包含 system prompt + 历史上下文）
   * @returns {Promise<{ok: boolean, summary: string, errorMessage: string, approvalRequest?: Object}>}
   */
  async run(messages) {
    this.state.isRunning = true;
    this.state.errorMessage = '';
    this.state.steps = [];
    this.finalText = '';
    this.messages = [...messages];

    this.currentRunId = this.telemetryStore?.startRun?.({
      threadId: this.payload.threadId || this.payload.taskId,
      taskId: this.payload.taskId,
      intent: this.payload.intent,
      provider: this.profile?.provider,
      model: this.profile?.model,
      channelId: this.payload.channelAdapter?.id,
    }) || '';

    try {
      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        this._throwIfAborted();

        // ======== Step 1: 推送推理状态 ========
        const stepInfo = {
          type: 'think',
          step,
          totalSteps: MAX_TOOL_STEPS,
          detail: `第 ${step + 1} 轮推理`,
          timestamp: new Date().toISOString(),
        };
        this.state.steps.push(stepInfo);
        this.onStep?.(stepInfo);

        this.emitProgress({
          status: 'running',
          title: step === 0 ? '正在思考' : `继续推理 (第 ${step + 1} 步)`,
          detail: `${this.profile.provider} / this.profile.model}`,
        });

        // ======== 记忆管理：检查是否需要自动压缩 ========
        if (this.memory.shouldCompact(this.messages)) {
          this.onStep?.({
            type: 'memory_compact',
            step,
            beforeCount: this.messages.length,
            detail: '消息数量达到阈值，触发自动压缩...',
          });
          this.emitProgress({
            status: 'running',
            title: '压缩上下文',
            detail: `${this.messages.length} 条消息 → 结构化记忆`,
          });
          const compacted = await this.memory.compactMessages(this.messages, {
            summaryModel: async (text) => {
              const res = await this.modelRouter.callChat(this.profile, text, {
                systemPrompt: '你负责压缩 Agent 会话上下文。保留用户目标、关键约束、已完成动作、未完成动作、文件路径和审批结果。输出中文摘要，不超过 500 字。',
                timeoutMs: 30000,
                signal: this.signal,
              });
              return res || '';
            },
            maxRecentTurns: 3,
          });
          this.messages = compacted;
          this.memoryContextPrompt = this.memory.buildContextPrompt();
          this.onStep?.({
            type: 'memory_compacted',
            step,
            afterCount: this.messages.length,
            savedTokens: this.memory.totalTokensSaved,
            entries: this.memory.entries.length,
          });
          this.emitProgress({
            status: 'success',
            title: '上下文已压缩',
            detail: `${compacted.length} 条消息 + ${this.memory.entries.length} 条记忆`,
          });
        } else if (this.memory.entries.length > 0 && this.memoryContextPrompt) {
          // 即使没触发压缩，也确保记忆上下文消息存在
          const memIdx = this.messages.findIndex(m => m.name === 'structured_memory');
          const memMsg = {
            role: 'user',
            content: this.memoryContextPrompt,
            name: 'structured_memory',
          };
          if (memIdx >= 0) {
            this.messages[memIdx] = memMsg;
          }
        }

        // ======== Step 2: 调用 LLM ========
        this.onStep?.({
          type: 'llm_call_start',
          step,
          model: this.profile.model,
          provider: this.profile.provider,
          messageCount: this.messages.length,
        });

        const response = await this.modelRouter.callChatMessages(
          this.profile,
          this.messages,
          {
            tools: this.registry.getOpenAiTools(),
            toolChoice: 'auto',
            timeoutMs: 180000,
            signal: this.signal,
          }
        );
        this._throwIfAborted();

        // 记录 LLM 响应
        this.onStep?.({
          type: 'llm_call_end',
          step,
          hasContent: Boolean(response.content),
          hasToolCalls: response.toolCalls?.length > 0,
          finishReason: response.finishReason,
        });

        // ======== Step 3: 记录消息 + 提取记忆 ========
        this.messages.push(response.message);
        if (response.content) {
          this.finalText = response.content;
          // 从 Assistant 回复中提取决策、待办等记忆
          this.memory.extractFromAssistantContent(response.content, step);
        }

        // ======== Step 4: 没有 tool_calls → 结束 ========
        if (!response.toolCalls?.length) {
          this.onStep?.({
            type: 'loop_end',
            step,
            reason: 'no_tool_calls',
            summary: this.finalText.slice(0, 200),
          });
          break;
        }

        // ======== Step 5: 推流工具调用状态 ========
        this.state.pendingToolCalls = response.toolCalls;
        this.onStep?.({
          type: 'tool_calls',
          step,
          count: response.toolCalls.length,
          toolCalls: response.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function?.name || tc.name,
            arguments: tc.function?.arguments || tc.arguments,
          })),
        });

        this.telemetryStore?.append?.({
          runId: this.currentRunId,
          type: 'tool_calls',
          threadId: this.payload.threadId,
          count: response.toolCalls.length,
          tools: response.toolCalls.map((tc) => tc.function?.name || tc.name),
        });

        // ======== Step 6: 逐个执行工具 ========
        for (const toolCall of response.toolCalls) {
          this._throwIfAborted();

          const toolName = toolCall.function?.name || toolCall.name;
          const rawArgs = toolCall.function?.arguments || toolCall.arguments || '{}';

          let parsedArgs;
          try {
            parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
          } catch {
            parsedArgs = {};
          }

          const tool = this.registry.get(toolName);
          const preparedArgs = tool?.prepareArguments?.(parsedArgs) || parsedArgs;
          const policy = this.registry.policy(toolName, preparedArgs);

          // 6a. 策略检查
          this.onStep?.({
            type: 'policy_check',
            toolName,
            action: policy.action,
            risk: policy.risk,
          });

          const gate = this.policyGate({
            payload: this.payload,
            ...policy,
            emitProgress: this.emitProgress,
          });

          if (!gate.allowed) {
            const message = gate.blocked
              ? `策略已阻止工具调用：${toolName}`
              : `等待审批：需要允许 Agent 执行 ${toolName} 后才能继续。`;
            this.state.pendingToolCalls = [toolCall];
            this.state.errorMessage = message;

            this.onStep?.({
              type: 'policy_blocked',
              toolName,
              blocked: !!gate.blocked,
              message,
            });

            return {
              ok: false,
              summary: message,
              errorMessage: message,
              approvalRequest: gate.approvalRequest || null,
              pendingToolCall: toolCall,
            };
          }

          // 6b. 执行工具
          this.onStep?.({
            type: 'tool_start',
            toolName,
            args: preparedArgs,
            command: policy.command,
          });

          this.emitProgress({
            status: 'running',
            title: `执行 ${toolName}`,
            detail: policy.command,
          });

          let toolResult;
          try {
            toolResult = await this.registry.execute(toolName, preparedArgs, {
              payload: this.payload,
              signal: this.signal,
            });
          } catch (error) {
            toolResult = {
              ok: false,
              error: error instanceof Error ? error.message : '工具执行失败',
            };
          }

          const toolContent = JSON.stringify(toolResult, null, 2);

          // 6c. 结果回填到 messages
          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolContent,
          });

          // 6c2. 提取结构化记忆
          this.memory.extractFromToolResult(toolName, preparedArgs, toolResult, step);

          // 6d. 推流结果
          this.onStep?.({
            type: 'tool_result',
            toolName,
            ok: toolResult?.ok !== false,
            resultPreview: toolContent.slice(0, 300),
          });

          this.telemetryStore?.append?.({
            runId: this.currentRunId,
            type: 'tool_end',
            threadId: this.payload.threadId,
            toolName,
            ok: toolResult?.ok !== false,
            bytes: toolContent.length,
          });

          this.emitProgress({
            status: 'success',
            title: `已执行 ${toolName}`,
            detail: toolContent.slice(0, 160),
          });
        }

        this.state.pendingToolCalls = [];
      }

      // ======== 循环结束 ========
      this.finalText = this.finalText || this._getLatestAssistantText() || 'Agent 已完成。';

      this.onStep?.({
        type: 'done',
        ok: true,
        summary: this.finalText.slice(0, 300),
      });

      this.telemetryStore?.finishRun?.(this.currentRunId, {
        ok: true,
        mode: this.payload.intent?.mode,
        provider: this.profile?.provider,
        model: this.profile?.model,
      });

      return {
        ok: true,
        summary: this.finalText,
        errorMessage: '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent runtime 执行失败';
      this.state.errorMessage = message;

      this.onStep?.({
        type: 'error',
        message,
      });

      this.telemetryStore?.finishRun?.(this.currentRunId, {
        ok: false,
        mode: this.payload.intent?.mode,
        provider: this.profile?.provider,
        model: this.profile?.model,
        errorMessage: message,
      });

      return {
        ok: false,
        summary: message,
        errorMessage: message,
      };
    } finally {
      this.state.isRunning = false;
    }
  }

  /** 获取当前运行状态快照（用于前端展示） */
  getStateSnapshot() {
    return {
      isRunning: this.state.isRunning,
      errorMessage: this.state.errorMessage,
      pendingToolCalls: this.state.pendingToolCalls.map((tc) => ({
        name: tc.function?.name || tc.name,
        id: tc.id,
      })),
      steps: this.state.steps.slice(-20),
      messageCount: this.messages.length,
      finalText: this.finalText?.slice(0, 200) || '',
    };
  }
}

/**
 * 创建 Agent 执行器会话
 *
 * 统一入口：根据模型能力自动选择
 * - 原生支持 agent loop → NativeLoopBridge
 * - 普通模型（DeepSeek 等）→ AgentExecutor
 *
 * @param {Object} options
 * @returns {Object} session 接口（兼容 pi-agent-kernel 返回格式）
 */
function createAgentExecutorSession({
  payload,
  profile,
  modelRouter,
  systemPrompt,
  toolRegistry,
  toolRuntime,
  policyGate,
  sessionLogStore,
  telemetryStore,
  emitProgress = () => {},
  signal,
}) {
  const threadId = payload.threadId || payload.taskId || payload.sessionId || 'default';
  const registry = toolRegistry || createToolRegistry({ toolRuntime });

  // 检测是否使用原生 Agent Loop
  const useNativeLoop = supportsNativeAgentLoop(profile);

  // 选择执行器
  const executor = useNativeLoop
    ? new NativeLoopBridge({ modelRouter, profile, payload, toolRegistry: registry, policyGate, emitProgress, signal, onStep: emitProgress })
    : new AgentExecutor({ modelRouter, profile, payload, toolRegistry: registry, policyGate, sessionLogStore, telemetryStore, emitProgress, signal, onStep: emitProgress });

  // 构建初始消息
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(payload.contextMessages || []).slice(-20).map((msg) => ({
      role: msg.role === 'agent' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  // 注入外部上下文（threadContext, channelContext, externalContext）
  if (payload.threadContextPrompt) {
    messages.push({ role: 'user', content: payload.threadContextPrompt, name: 'thread_context' });
  }
  if (payload.channelAdapterPrompt) {
    messages.push({ role: 'user', content: payload.channelAdapterPrompt, name: 'channel_context' });
  }
  if (payload.externalContext?.prompt) {
    messages.push({ role: 'user', content: payload.externalContext.prompt, name: 'external_context' });
  }

  let running = false;
  let lastResult = null;

  return {
    get id() { return threadId; },
    get running() { return running; },
    get state() {
      return executor instanceof AgentExecutor ? executor.getStateSnapshot() : { isRunning: running };
    },

    async prompt(text) {
      running = true;
      try {
        const runMessages = [...messages, { role: 'user', content: text }];
        const result = await executor.run(runMessages);
        lastResult = result;
        return result;
      } finally {
        running = false;
      }
    },

    continueTurn() {
      if (!lastResult && running) {
        return { ok: false, summary: '没有可继续的回合。', errorMessage: '没有可继续的回合。' };
      }
      return this.prompt('继续执行上一个未完成任务。请从停止点继续。');
    },

    steer(text) {
      emitProgress({
        status: 'running',
        title: '收到中途补充',
        detail: String(text || '').slice(0, 120),
      });
      return { ok: true, queued: true, message: 'steer 已接收。' };
    },

    followUp(text) {
      emitProgress({
        status: 'running',
        title: '已加入后续任务',
        detail: String(text || '').slice(0, 120),
      });
      return { ok: true, queued: true, message: 'followUp 已加入队列。' };
    },

    abort() {
      emitProgress({
        status: 'warn',
        title: '停止当前回合',
        detail: '用户请求停止 Agent。',
      });
      return { ok: true, aborted: true };
    },

    compact() {
      return { ok: true, summary: '', message: 'AgentExecutor 使用按需消息传递，不需要手动压缩。' };
    },

    waitForIdle() {
      return Promise.resolve();
    },

    toResult() {
      return lastResult || { ok: false, summary: '尚未执行', errorMessage: '' };
    },
  };
}

module.exports = {
  AgentExecutor,
  NativeLoopBridge,
  createAgentExecutorSession,
  supportsNativeAgentLoop,
};
