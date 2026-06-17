/**
 * chat-agent.cjs
 *
 * Chat Agent — 处理一般对话、问答、非代码类任务
 *
 * ========== 能力 ==========
 * - 知识问答
 * - 闲聊对话
 * - 文本翻译
 * - 内容改写
 * - 创意写作
 *
 * ========== 触发条件 ==========
 * - intent.mode === 'chat'
 * - 没有明显的 coding/research/artifact 信号
 */

const { SpecializedAgent, AgentResult } = require('./agent-base.cjs');

class ChatAgent extends SpecializedAgent {
  constructor(options = {}) {
    super({
      id: 'chat-agent',
      name: 'Chat Agent',
      description: '处理一般对话、知识问答、文本创作等非代码任务',
      capabilities: [
        'qa',
        'conversation',
        'translation',
        'writing',
        'creative-content',
      ],
      ...options,
    });
  }

  /**
   * 判断是否能处理该请求 — Chat Agent 是兜底
   */
  canHandle(intent, payload) {
    if (!intent) return 0.5;

    // 如果其他 Agent 都没命中，Chat Agent 兜底
    // 对显式 chat 模式
    if (intent.mode === 'chat' && intent.confidence < 0.6) {
      return 0.7;
    }

    // 如果没有任何编码/研究/文档生成信号，且不是媒体生成
    if (
      intent.mode === 'chat' &&
      !['image', 'video', 'audio'].includes(intent.modality) &&
      intent.codingScore < 3
    ) {
      return 0.6;
    }

    return 0.3;
  }

  /**
   * 处理聊天对话
   */
  async prompt(text, context) {
    this._running = true;
    this.emitProgress({
      status: 'running',
      title: 'Chat Agent',
      detail: `正在思考：${String(text || '').slice(0, 80)}...`,
    });

    try {
      const { session } = context;
      if (!session || typeof session.prompt !== 'function') {
        return new AgentResult({
          ok: false,
          summary: 'Chat Agent 需要有效的会话才能执行。',
          errorMessage: '缺少 session',
        });
      }

      // Chat Agent 不需要额外指令，使用默认 system prompt
      const agentResult = await session.prompt(text);

      return new AgentResult({
        ok: agentResult.ok !== false,
        summary: agentResult.summary || '',
        errorMessage: agentResult.errorMessage || '',
        meta: {
          agentId: this._id,
          agentName: this._name,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat Agent 执行失败';
      return new AgentResult({
        ok: false,
        summary: message,
        errorMessage: message,
      });
    } finally {
      this._running = false;
    }
  }
}

module.exports = { ChatAgent };
