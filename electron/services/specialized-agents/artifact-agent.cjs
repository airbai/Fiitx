/**
 * artifact-agent.cjs
 *
 * Artifact Agent — 专门生成文档、PPT、HTML 交互页面等交付物
 *
 * ========== 能力 ==========
 * - PPT / 幻灯片生成（完整 markdown + manifest）
 * - 结构化文档（报告、合同、模板）
 * - HTML 交互页面 / 演示动画
 * - 数据可视化看板
 *
 * ========== 触发条件 ==========
 * - intent.taskKind === 'ppt-artifact' / 'document-artifact' / 'html-artifact'
 * - 用户要求"做成PPT"、"生成文档"、"做成网页"
 */

const { SpecializedAgent, AgentResult } = require('./agent-base.cjs');

const ARTIFACT_TRIGGER_SIGNALS = [
  'ppt', 'pptx', '幻灯片', '演示文稿', 'keynote',
  'word', 'docx', 'doc', 'pdf',
  '合同', '报告', '文档', '协议', '模板', '条款',
  'html', '网页', '页面', '交互演示',
  '可视化', '看板', 'dashboard', '图表',
  '生成文件', '写入', '保存', '导出',
  '素材', '官网素材', '网站素材',
];

class ArtifactAgent extends SpecializedAgent {
  constructor(options = {}) {
    super({
      id: 'artifact-agent',
      name: 'Artifact Agent',
      description: '专门生成文档、PPT、HTML 页面、报告等结构化交付物',
      capabilities: [
        'ppt-generation',
        'document-generation',
        'html-artifact',
        'data-visualization',
        'template-creation',
      ],
      ...options,
    });
  }

  /**
   * 判断是否能处理该请求
   */
  canHandle(intent, payload) {
    if (!intent) return 0;

    // 任务类型直接匹配
    const artifactKinds = ['ppt-artifact', 'document-artifact', 'html-artifact'];
    if (artifactKinds.includes(intent.taskKind)) {
      return 0.95;
    }

    // 关键词匹配
    const text = String(payload?.prompt || '').toLowerCase();
    const matchedSignals = ARTIFACT_TRIGGER_SIGNALS.filter(signal => text.includes(signal.toLowerCase()));
    if (matchedSignals.length >= 2) return 0.75;
    if (matchedSignals.length === 1) return 0.4;

    return 0;
  }

  /**
   * 生成交付物
   */
  async prompt(text, context) {
    this._running = true;
    this.emitProgress({
      status: 'running',
      title: 'Artifact Agent',
      detail: `正在生成交付物：${String(text || '').slice(0, 80)}...`,
    });

    try {
      const { session, payload } = context;
      if (!session || typeof session.prompt !== 'function') {
        return new AgentResult({
          ok: false,
          summary: 'Artifact Agent 需要有效的会话才能执行。',
          errorMessage: '缺少 session',
        });
      }

      // 检查是否有外部文档需要参考
      const hasExternalDocs = Boolean(payload?.externalContext?.documents?.length);
      const externalContextHint = hasExternalDocs
        ? 'Pi turn context 中已注入外部文档，优先使用这些文档内容生成交付物。'
        : '';

      const artifactInstruction = `
## Artifact Agent 执行要求

你正在以 **Artifact Agent** 身份工作。你的核心职责是生成**可直接交付的文件**。

${externalContextHint}

### 交付物类型与工具选择

| 交付物类型 | 工具/方法 | 说明 |
|-----------|----------|------|
| PPT 幻灯片 | fiitx-file-manifest 或 workspace_write | 生成完整 markdown 后再转 ppt，或直接写 .md 文件 |
| 结构化文档 | workspace_write | 写入 .md / .html 文件到工作区 |
| HTML 交互页面 | workspace_write 或 fiitx-file-manifest | 单页 HTML（含 CSS + JS） |
| 数据看板 | workspace_write | 单页 HTML 文件，用 ECharts / Chart.js |

### 约束
1. **必须产生真实文件输出** — 使用 workspace_write 写入文件 manifest，或直接写入工作区
2. **不要谎称文件已写入** — 没有工具结果或 manifest 时不能声称已完成
3. **参考外部文档** — 如果用户提供了 URL 或文档，必须参考其内容
4. **HTML 模块可预览** — 单页 HTML 禁止使用裸模块 import（例如 from "three"）；three 相关模块使用 https://esm.sh/three@0.160.0 的完整 URL
5. **如果只有调研需求** — 建议切换到 Research Agent
`;

      const agentResult = await session.prompt(`${artifactInstruction}\n\n用户任务：${text}`);

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
      const message = error instanceof Error ? error.message : 'Artifact Agent 执行失败';
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

module.exports = { ArtifactAgent };
