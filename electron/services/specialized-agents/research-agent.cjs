/**
 * research-agent.cjs
 *
 * Research Agent — 处理 Web 调研、信息收集、数据整理等任务
 *
 * ========== 能力 ==========
 * - 多 URL 并行抓取与内容提取
 * - 信息汇总与结构化输出
 * - 竞品分析、资料整理
 * - 数据对比表生成
 *
 * ========== 触发条件 ==========
 * - 用户提供 URL 并要求分析/总结
 * - 需要外部知识获取
 * - "调研"、"查资料"、"搜索"、"对比"、"分析"
 */

const { SpecializedAgent, AgentResult } = require('./agent-base.cjs');

const RESEARCH_SIGNALS = [
  '调研', '查资料', '搜索', '查询', '查找', '找一下',
  '分析', '对比', '比较', '研究', '调查',
  '官网', '网站', '网页', '链接', 'url',
  '参考', '资料', '文献', '数据', '信息',
  '总结', '归纳', '整理', '汇总',
  '竞品', '竞对', '行业', '市场', '趋势',
];

class ResearchAgent extends SpecializedAgent {
  constructor(options = {}) {
    super({
      id: 'research-agent',
      name: 'Research Agent',
      description: '负责 Web 调研、信息收集、资料整理与数据分析',
      capabilities: [
        'web-fetch',
        'information-extraction',
        'data-summarization',
        'comparison-analysis',
      ],
      ...options,
    });
  }

  /**
   * 判断是否能处理该请求
   */
  canHandle(intent, payload) {
    if (!intent) return 0;

    const text = String(payload?.prompt || '').toLowerCase();
    const hasUrls = Boolean(intent.externalUrls?.length) || Boolean(payload?.externalContext?.documents?.length);

    // 有 URL + 需要整理/分析/总结 → 高置信度
    if (hasUrls) {
      const researchIntent = [
        '整理', '总结', '分析', '对比', '归纳', '调研', '报告',
        '做成', '生成', '输出', 'ppt', '报告',
      ].some(s => text.includes(s));
      if (researchIntent) return 0.85;
      return 0.4;
    }

    // 关键词匹配
    const matchedSignals = RESEARCH_SIGNALS.filter(signal => text.includes(signal.toLowerCase()));
    if (matchedSignals.length >= 3) return 0.8;
    if (matchedSignals.length === 2) return 0.6;
    if (matchedSignals.length === 1) return 0.3;

    return 0;
  }

  /**
   * 处理 Web 调研任务
   */
  async prompt(text, context) {
    this._running = true;
    this.emitProgress({
      status: 'running',
      title: 'Research Agent',
      detail: `正在收集信息：${String(text || '').slice(0, 80)}...`,
    });

    try {
      const { session, payload } = context;
      if (!session || typeof session.prompt !== 'function') {
        return new AgentResult({
          ok: false,
          summary: 'Research Agent 需要有效的会话才能执行。',
          errorMessage: '缺少 session',
        });
      }

      const researchInstruction = `
## Research Agent 执行要求

你正在以 **Research Agent** 身份工作。以下是你的专属约束：

1. **优先使用外部文档上下文**：如果 Pi turn context 显示已读取外部文档，直接使用这些内容
2. **调用 web_fetch_url 抓取**：如果没有外部文档但用户提供了 URL，调用 web_fetch_url 获取正文
3. **引用来源**：所有信息必须标注来源 URL
4. **结构化输出**：优先使用表格、列表、分层标题等格式
5. **不要编造数据**：如果外部文档中没有相关信息，明确说明"未找到相关信息"
6. **如果用户要求生成 PPT/报告**：先完成调研，再建议切换到 Artifact Agent 或 Coding Agent 生成交付物
`;

      const agentResult = await session.prompt(`${researchInstruction}\n\n用户任务：${text}`);

      return new AgentResult({
        ok: agentResult.ok !== false,
        summary: agentResult.summary || '',
        errorMessage: agentResult.errorMessage || '',
        approvalRequest: agentResult.approvalRequest || null,
        toolEvents: agentResult.toolEvents || [],
        artifacts: agentResult.artifacts || [],
        meta: {
          agentId: this._id,
          agentName: this._name,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Research Agent 执行失败';
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

module.exports = { ResearchAgent };
