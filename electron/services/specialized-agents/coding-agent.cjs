/**
 * coding-agent.cjs
 *
 * Coding Agent — 处理代码生成、文件操作、项目开发等任务
 *
 * ========== 能力 ==========
 * - 读取/写入/修改工作区文件
 * - 生成项目脚手架
 * - 执行 Web 抓取（用于参考外部文档）
 * - 生成 HTML/文档/PPT 等交付物（通过 manifest）
 * - 执行 shell 命令（构建、测试等）
 *
 * ========== 触发条件 ==========
 * - intent.mode === 'coding'
 * - intent.taskKind 包含 'coding', 'fix', 'miniapp-coding', 'html-artifact', 'document-artifact', 'ppt-artifact'
 * - 用户消息包含代码相关的关键词
 */

const { SpecializedAgent, AgentResult } = require('./agent-base.cjs');

const CODING_TRIGGER_SIGNALS = [
  '代码', '项目', '文件', '目录', '开发', '实现', '升级', '修复',
  'bug', 'build', 'npm', 'git', '小程序', '网页', '组件', '接口',
  '脚本', '写入', '保存', '生成', '导出', '修改',
  'html', 'css', 'javascript', 'js', 'ts', 'python', 'java',
  'react', 'vue', 'node', 'express',
  'workspace', 'workbench', 'cli',
];

class CodingAgent extends SpecializedAgent {
  constructor(options = {}) {
    super({
      id: 'coding-agent',
      name: 'Coding Agent',
      description: '处理代码生成、文件操作、项目开发和文档生成等任务',
      capabilities: [
        'code-generation',
        'file-operations',
        'project-scaffolding',
        'web-fetch',
        'html-artifact',
        'document-artifact',
        'shell-execution',
      ],
      ...options,
    });
  }

  /**
   * 判断是否能处理该请求
   */
  canHandle(intent, payload) {
    if (!intent) return 0;

    // 显式 coding 模式 → 高置信度
    if (intent.mode === 'coding') {
      return 0.95;
    }

    // 任务类型匹配
    const codingKinds = ['coding', 'fix', 'miniapp-coding', 'html-artifact', 'document-artifact', 'ppt-artifact'];
    if (codingKinds.includes(intent.taskKind)) {
      return 0.9;
    }

    // 消息中包含编码关键词
    const text = String(payload?.prompt || '').toLowerCase();
    const matchedSignals = CODING_TRIGGER_SIGNALS.filter(signal => text.includes(signal.toLowerCase()));
    if (matchedSignals.length >= 2) {
      return 0.7;
    }
    if (matchedSignals.length === 1) {
      return 0.4;
    }

    return 0;
  }

  /**
   * 处理用户请求 — 通过 AgentExecutor 执行
   */
  async prompt(text, context) {
    this._running = true;
    this.emitProgress({
      status: 'running',
      title: 'Coding Agent',
      detail: `正在分析任务：${String(text || '').slice(0, 80)}...`,
    });

    try {
      const { session } = context;
      if (!session || typeof session.prompt !== 'function') {
        return new AgentResult({
          ok: false,
          summary: 'Coding Agent 需要有效的 AgentExecutor session 才能执行。',
          errorMessage: '缺少 session',
        });
      }

      // 注入 coding 专属的系统指令
      const codingInstruction = `
## Coding Agent 执行要求

你正在以 **Coding Agent** 身份工作。以下是你的专属约束：

1. **优先操作工作区文件**：使用 workspace_ls / workspace_read / workspace_write / workspace_edit / workspace_find / workspace_grep
2. **生成完整交付物**：对网页/文档/PPT 等，使用 fiitx-file-manifest 或 workspace_write
3. **Web 抓取**：需要参考外部网站时，调用 web_fetch_url
4. **Shell 命令**：构建、测试、安装依赖时，调用 bash
5. **不要谎称文件已写入**：没有工具结果或 manifest 时，禁止写"已生成到某路径"
6. **自动识别项目类型**：如果用户说"升级/修改这个项目"，先扫描工作区理解现有代码
`;

      const agentResult = await session.prompt(`${codingInstruction}\n\n用户任务：${text}`);

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
      const message = error instanceof Error ? error.message : 'Coding Agent 执行失败';
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

module.exports = { CodingAgent };
