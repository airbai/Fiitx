/**
 * agent-orchestrator.cjs
 *
 * 多 Agent 编排器 — 将 intent-router + specialized agents 串联成完整工作流
 *
 * ========== 架构 ==========
 *
 *   payload ──→ routeIntent() ──→ intent
 *                    │
 *                    ▼
 *            AgentOrchestrator
 *            ┌──────────────────────────────────────────┐
 *            │  1. selectAgent(intent, payload)         │
 *            │     → 按置信度排名，选最佳 Agent         │
 *            │                                          │
 *            │  2. createAgentSession(context)          │
 *            │     → 为 Agent 构建专属 session          │
 *            │                                          │
 *            │  3. agent.prompt(text, context)          │
 *            │     → AgentResult                        │
 *            │                                          │
 *            │  4. 检查 suggestNextAgent                │
 *            │     → 如果有级联，递归调度下一个 Agent   │
 *            │                                          │
 *            │  5. 返回最终 AgentResult                 │
 *            └──────────────────────────────────────────┘
 *                    │
 *         ┌──────────┼──────────┐
 *         ▼          ▼          ▼
 *    Coding A.  Research A.  Artifact A.  Chat A.
 *
 * ========== 级联示例 ==========
 *
 * 用户: "调研酒店官网定价，做成对比报告PPT"
 *
 * 第1步: Research Agent 执行调研
 *   → suggestNextAgent: "artifact-agent"
 *   → suggestNextContext: { researchData: {...} }
 *
 * 第2步: Orchestrator 检测到 suggestNextAgent
 *   → 注入 suggestNextContext 到 Artifact Agent 的上下文
 *   → 启动 Artifact Agent 生成交付物
 *
 * 第3步: 返回汇总结果
 */

const { routeIntent } = require("./intent-router.cjs");
const { CodingAgent } = require("./specialized-agents/coding-agent.cjs");
const { ResearchAgent } = require("./specialized-agents/research-agent.cjs");
const { ArtifactAgent } = require("./specialized-agents/artifact-agent.cjs");
const { ChatAgent } = require("./specialized-agents/chat-agent.cjs");
const { AgentResult } = require("./specialized-agents/agent-base.cjs");
const { createPiAgentSession } = require("./pi-agent-kernel.cjs");

// ============================================================
// Agent Registry — 所有注册的 Specialized Agent
// ============================================================

const DEFAULT_AGENTS = [
  "coding-agent",
  "research-agent",
  "artifact-agent",
  "chat-agent",
];

/**
 * 创建 Agent 注册表
 */
function createAgentRegistry(options = {}) {
  const { modelRouter, toolRegistry, toolRuntime, policyGate, sessionLogStore, telemetryStore } = options;
  const emitProgress = options.emitProgress || (() => {});

  const agents = new Map();

  /** 注册一个 Agent 实例 */
  function register(agent) {
    if (!agent || !agent.id) {
      throw new Error("Agent 必须包含 id 属性");
    }
    agents.set(agent.id, agent);
  }

  /** 批量注册默认 Agent */
  function registerDefaults() {
    const sharedDeps = { modelRouter, toolRegistry, emitProgress };

    const codingAgent = new CodingAgent(sharedDeps);
    const researchAgent = new ResearchAgent(sharedDeps);
    const artifactAgent = new ArtifactAgent(sharedDeps);
    const chatAgent = new ChatAgent(sharedDeps);

    register(codingAgent);
    register(researchAgent);
    register(artifactAgent);
    register(chatAgent);
  }

  /** 按 ID 获取 Agent */
  function get(agentId) {
    return agents.get(agentId) || null;
  }

  /** 列出所有注册的 Agent */
  function list() {
    return Array.from(agents.values());
  }

  return { register, registerDefaults, get, list };
}

// ============================================================
// Orchestrator — 多 Agent 编排核心
// ============================================================

/**
 * 创建 Agent Orchestrator
 *
 * @param {Object} options
 * @param {Object} options.modelRouter - 模型路由实例
 * @param {Object} options.toolRegistry - 工具注册中心
 * @param {Object} options.toolRuntime - 工具运行时
 * @param {Function} options.policyGate - 策略审批函数
 * @param {Object} options.sessionLogStore - 会话日志存储
 * @param {Object} options.telemetryStore - 遥测存储
 * @param {Function} options.emitProgress - 进度回调
 * @returns {Object} orchestrator
 */
function createAgentOrchestrator(options = {}) {
  const {
    modelRouter,
    toolRegistry,
    toolRuntime,
    policyGate,
    sessionLogStore,
    telemetryStore,
    emitProgress: defaultEmitProgress = () => {},
  } = options;

  const agentRegistry = createAgentRegistry({
    modelRouter,
    toolRegistry,
    emitProgress: defaultEmitProgress,
  });

  // 注册默认 Agent
  agentRegistry.registerDefaults();

  /** 当前级联链路追踪 */
  let cascadeChain = [];

  /**
   * 选择最适合处理当前请求的 Agent
   *
   * @param {Object} intent - routeIntent 的输出
   * @param {Object} payload - 原始请求 payload
   * @returns {Object|null} { agent, confidence, reason }
   */
  function selectAgent(intent, payload) {
    const candidates = agentRegistry
      .list()
      .map((agent) => ({
        agent,
        confidence: agent.canHandle(intent, payload),
      }))
      .filter((c) => c.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    if (candidates.length === 0) {
      return null;
    }

    const best = candidates[0];
    return {
      agent: best.agent,
      confidence: best.confidence,
      reason: `${best.agent.name} 置信度 ${(best.confidence * 100).toFixed(0)}%${
        candidates.length > 1
          ? `（次选：${candidates[1].agent.name} ${(candidates[1].confidence * 100).toFixed(0)}%）`
          : ""
      }`,
      allCandidates: candidates.map((c) => ({
        id: c.agent.id,
        name: c.agent.name,
        confidence: c.confidence,
      })),
    };
  }

  /**
   * 为 Agent 创建执行 session
   *
   * @param {Object} agent - SpecializedAgent 实例
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} session
   */
  async function createAgentSession(agent, context) {
    const { payload, intent, systemPrompt, cascadeContext } = context;

    // 如果级联上下文中有研究数据，注入到 systemPrompt
    let enrichedSystemPrompt = systemPrompt || "";
    if (cascadeContext?.researchData) {
      enrichedSystemPrompt += `\n\n## 来自 Research Agent 的研究数据\n${JSON.stringify(cascadeContext.researchData, null, 2)}\n\n请基于以上研究数据生成交付物。`;
    }
    if (cascadeContext?.summary) {
      enrichedSystemPrompt += `\n\n## 来自上一个 Agent 的输出摘要\n${cascadeContext.summary}\n\n`;
    }

    // 构建 agent 专属的 system prompt
    const agentContext = {
      session: null, // 下面创建
      payload,
      intent,
      agentId: agent.id,
      agentName: agent.name,
    };

    // 使用 pi-agent-kernel 创建 session
    try {
      const session = await createPiAgentSession({
        payload: {
          ...payload,
          intent,
        },
        profile: payload._resolvedProfile,
        modelRouter,
        systemPrompt: enrichedSystemPrompt,
        emitProgress: agent.emitProgress || defaultEmitProgress,
        toolRuntime,
        toolRegistry,
        policyGate,
        sessionLogStore,
        telemetryStore,
        signal: context.signal,
      });

      agentContext.session = session;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建 Agent session 失败";
      agentContext.sessionError = message;
    }

    return agentContext;
  }

  /**
   * 核心编排方法 — 选择 Agent → 执行 → 级联
   *
   * @param {Object} payload - 完整请求 payload
   * @param {Object} options
   * @param {Function} options.emitProgress - 进度回调
   * @param {AbortSignal} options.signal - 中止信号
   * @param {Object} options.cascadeContext - 来自上一个 Agent 的级联上下文
   * @param {number} options.depth - 当前级联深度（防止死循环）
   * @returns {Promise<AgentResult>}
   */
  async function orchestrate(payload, options = {}) {
    const emitProgress = options.emitProgress || defaultEmitProgress;
    const signal = options.signal || null;
    const cascadeContext = options.cascadeContext || null;
    const depth = options.depth || 0;
    const maxDepth = options.maxDepth || 5;

    // 防止级联死循环
    if (depth >= maxDepth) {
      return new AgentResult({
        ok: false,
        summary: `级联深度达到上限 ${maxDepth}，已停止编排。`,
        errorMessage: "max-cascade-depth-reached",
      });
    }

    // 1. 路由意图
    const intent = payload.intent || routeIntent(payload);
    payload.intent = intent;

    if (signal?.aborted) {
      return new AgentResult({
        ok: false,
        summary: "用户已停止编排。",
        errorMessage: "aborted",
      });
    }

    emitProgress({
      status: "running",
      title: "Orchestrator",
      detail: `Intent: ${intent.mode}/${intent.taskKind || "chat"} (${(intent.confidence * 100).toFixed(0)}%)`,
    });

    // 2. 检查外部上下文（如果有 URL 需要先 fetch）
    const hasUrls = intent.externalUrls?.length > 0;
    if (hasUrls && !payload.externalContext) {
      // 标记需要等待外部上下文加载
      emitProgress({
        status: "running",
        title: "Orchestrator",
        detail: `检测到 ${intent.externalUrls.length} 个外部 URL，等待上下文加载...`,
      });
    }

    // 3. 选择最佳 Agent
    const selection = selectAgent(intent, payload);

    if (!selection) {
      // 没有 Agent 能处理 → 回退到 Chat Agent
      const chatAgent = agentRegistry.get("chat-agent");
      if (chatAgent) {
        emitProgress({
          status: "running",
          title: "Orchestrator",
          detail: "没有专用 Agent 匹配，回退到 Chat Agent",
        });
        const agentContext = await createAgentSession(chatAgent, {
          payload,
          intent,
          systemPrompt: buildOrchestratorSystemPrompt(payload, intent, null),
          cascadeContext,
          signal,
        });

        if (agentContext.sessionError) {
          return new AgentResult({
            ok: false,
            summary: agentContext.sessionError,
            errorMessage: agentContext.sessionError,
          });
        }

        const result = await chatAgent.prompt(payload.prompt, agentContext);
        cascadeChain = [];
        return result;
      }

      return new AgentResult({
        ok: false,
        summary: "没有可用的 Agent 处理当前请求。",
        errorMessage: "no-agent-available",
      });
    }

    // 4. 记录级联链路
    cascadeChain.push({
      depth,
      agentId: selection.agent.id,
      agentName: selection.agent.name,
      confidence: selection.confidence,
    });

    emitProgress({
      status: "running",
      title: `🧠 ${selection.agent.name}`,
      detail: selection.reason,
    });

    // 5. 为 Agent 创建 session
    const agentContext = await createAgentSession(selection.agent, {
      payload,
      intent,
      systemPrompt: buildOrchestratorSystemPrompt(
        payload,
        intent,
        selection,
        cascadeContext
      ),
      cascadeContext,
      signal,
    });

    if (agentContext.sessionError) {
      return new AgentResult({
        ok: false,
        summary: agentContext.sessionError,
        errorMessage: agentContext.sessionError,
      });
    }

    // 6. 执行 Agent
    emitProgress({
      status: "running",
      title: `⏳ ${selection.agent.name} 执行中`,
      detail: `正在处理：${String(payload.prompt || "").slice(0, 100)}`,
    });

    const agentResult = await selection.agent.prompt(payload.prompt, agentContext);

    if (signal?.aborted) {
      return new AgentResult({
        ok: false,
        summary: "用户已停止编排。",
        errorMessage: "aborted",
      });
    }

    // 7. 检查是否需要级联到下一个 Agent
    if (
      agentResult.suggestNextAgent &&
      agentRegistry.get(agentResult.suggestNextAgent)
    ) {
      const nextAgentName = agentRegistry.get(agentResult.suggestNextAgent).name;
      emitProgress({
        status: "running",
        title: "🔄 Orchestrator 级联",
        detail: `${selection.agent.name} → ${nextAgentName}（suggestNextAgent: ${agentResult.suggestNextAgent}）`,
      });

      // 将当前 Agent 的输出作为级联上下文传递
      const nextCascadeContext = {
        ...(agentResult.suggestNextContext || {}),
        previousAgentId: selection.agent.id,
        previousAgentName: selection.agent.name,
        summary: agentResult.summary,
        artifacts: agentResult.artifacts || [],
      };

      // 构建下一个 Agent 的 prompt
      const nextPrompt = buildCascadePrompt(
        payload.prompt,
        selection.agent,
        agentResult,
        agentRegistry.get(agentResult.suggestNextAgent)
      );

      // 递归调度下一个 Agent
      const nextResult = await orchestrate(
        {
          ...payload,
          prompt: nextPrompt,
        },
        {
          emitProgress,
          signal,
          cascadeContext: nextCascadeContext,
          depth: depth + 1,
          maxDepth,
        }
      );

      // 汇总结果：当前 Agent 的 summary + 下一个 Agent 的 summary
      const combinedSummary = [
        `## ✅ ${selection.agent.name} 已完成`,
        agentResult.summary,
        "",
        `## ✅ ${nextAgentName} 已完成`,
        nextResult.summary,
      ].join("\n\n");

      return new AgentResult({
        ok: agentResult.ok && nextResult.ok,
        summary: combinedSummary,
        errorMessage: agentResult.errorMessage || nextResult.errorMessage,
        toolEvents: [
          ...(agentResult.toolEvents || []),
          ...(nextResult.toolEvents || []),
        ],
        artifacts: [
          ...(agentResult.artifacts || []),
          ...(nextResult.artifacts || []),
        ],
        meta: {
          cascade: true,
          agents: [selection.agent.id, agentResult.suggestNextAgent],
          depth: depth + 1,
        },
      });
    }

    // 8. 没有级联，直接返回结果
    cascadeChain = [];

    emitProgress({
      status: "success",
      title: `✅ ${selection.agent.name} 执行完成`,
      detail: agentResult.ok ? "任务完成" : `错误：${agentResult.errorMessage || "未知错误"}`,
    });

    return agentResult;
  }

  /**
   * 获取当前级联链路信息
   */
  function getCascadeChain() {
    return [...cascadeChain];
  }

  /**
   * 重置编排器状态
   */
  function reset() {
    cascadeChain = [];
    for (const agent of agentRegistry.list()) {
      agent.reset();
    }
  }

  return {
    agentRegistry,
    selectAgent,
    orchestrate,
    getCascadeChain,
    reset,
  };
}

// ============================================================
// Prompt 构建辅助函数
// ============================================================

/**
 * 构建 Orchestrator 注入给 Agent 的 system prompt
 */
function buildOrchestratorSystemPrompt(payload, intent, selection, cascadeContext) {
  const parts = [
    `## 当前任务上下文`,
    `- 任务类型: ${intent.mode} / ${intent.taskKind || "chat"}`,
    `- 置信度: ${(intent.confidence * 100).toFixed(0)}%`,
    selection
      ? `- 选择的 Agent: ${selection.agent.name}（置信度 ${(selection.confidence * 100).toFixed(0)}%）`
      : "",
    intent.externalUrls?.length
      ? `- 外部 URL: ${intent.externalUrls.join(", ")}`
      : "",
    payload.externalContext?.documents?.length
      ? `- 已加载外部文档: ${payload.externalContext.documents.length} 个`
      : "",
    cascadeContext?.previousAgentName
      ? `\n## 级联来源\n- 来自: ${cascadeContext.previousAgentName}\n- 摘要: ${(cascadeContext.summary || "").slice(0, 500)}`
      : "",
    cascadeContext?.researchData
      ? `\n## 研究数据（来自 Research Agent）\n${JSON.stringify(cascadeContext.researchData, null, 2)}`
      : "",
  ];

  return parts.filter(Boolean).join("\n\n");
}

/**
 * 构建级联 prompt — 把上一个 Agent 的输出作为下一个 Agent 的输入
 */
function buildCascadePrompt(originalPrompt, currentAgent, agentResult, nextAgent) {
  const lines = [
    `原始用户请求：${originalPrompt}`,
    "",
    `--- ${currentAgent.name} 已完成 ---`,
    agentResult.summary,
    "",
    `--- 要求 ${nextAgent.name} 执行 ---`,
    `请基于以上 ${currentAgent.name} 的输出，继续完成用户请求的后续部分。`,
  ];

  if (agentResult.suggestNextContext?.instructions) {
    lines.push("");
    lines.push(`额外指令：${agentResult.suggestNextContext.instructions}`);
  }

  return lines.join("\n");
}

// ============================================================
// 快捷入口 — 给 agent-runtime.cjs 直接调用
// ============================================================

/**
 * 一键运行 Orchestrator 编排
 *
 * @param {Object} payload - 完整请求 payload
 * @param {Object} deps - 依赖注入
 * @returns {Promise<AgentResult>}
 */
async function runOrchestrator(payload, deps = {}) {
  const orchestrator = createAgentOrchestrator(deps);

  // 如果 payload 中已经有 externalContext，直接使用
  // 否则由 orchestrator 内部处理

  return orchestrator.orchestrate(payload, {
    emitProgress: deps.emitProgress || (() => {}),
    signal: deps.signal || null,
  });
}

module.exports = {
  createAgentOrchestrator,
  createAgentRegistry,
  runOrchestrator,
  AgentResult,
};
