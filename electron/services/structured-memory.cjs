/**
 * structured-memory.cjs
 *
 * 结构化记忆系统 — 替代全量消息回放
 *
 * ========== 设计原则 ==========
 * 1. 保留最近 N 轮的原始消息（maxRecentTurns），维持即时上下文感知
 * 2. 将更早的消息提炼为结构化记忆条目（事实、决策、工件、待办、约束）
 * 3. 在 LLM 调用前注入记忆上下文提示词，替代完整的旧消息回放
 * 4. 支持增量更新：每次工具执行后提取新的事实
 * 5. 支持主动压缩：当消息数量超过阈值时自动归档
 *
 * ========== 记忆条目类型 ==========
 * - summary   — 已归档上下文的压缩摘要
 * - fact      — 关键事实（文件路径、搜索发现等）
 * - artifact  — 已创建/修改的文件引用
 * - decision  — 设计决策
 * - constraint— 业务/技术约束
 * - pending   — 未完成任务或已知问题
 * - tool_result — 重要工具执行结果
 *
 * ========== 使用示例 ==========
 * const { StructuredMemory } = require('./structured-memory.cjs');
 * const memory = new StructuredMemory({ maxRecentTurns: 3 });
 * memory.extractFromToolResult('workspace_write', { path: 'app.js' }, { ok: true });
 * const prompt = memory.buildContextPrompt();
 * const compacted = await memory.compactMessages(allMessages, { summaryModel });
 */

const crypto = require('node:crypto');

// ============================================================
// 记忆条目类型常量
// ============================================================

const MEMORY_ENTRY_TYPES = Object.freeze({
  SUMMARY: 'summary',
  FACT: 'fact',
  ARTIFACT: 'artifact',
  DECISION: 'decision',
  CONSTRAINT: 'constraint',
  PENDING: 'pending',
  TOOL_RESULT: 'tool_result',
  CONTEXT: 'context',
});

// ============================================================
// 重要性权重常量
// ============================================================

const IMPORTANCE = Object.freeze({
  HIGH: 9,
  MEDIUM: 6,
  LOW: 3,
  TRIVIAL: 1,
});

// ============================================================
// StructuredMemory 类
// ============================================================

class StructuredMemory {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxRecentTurns=3] - 保留的原始消息轮次
   * @param {number} [options.maxEntries=50] - 记忆条目上限
   * @param {number} [options.autoCompactThreshold=30] - 触发自动压缩的消息数阈值
   * @param {string} [options.id] - 记忆实例 ID（自动生成）
   */
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.maxRecentTurns = options.maxRecentTurns || 3;
    this.maxEntries = options.maxEntries || 50;
    this.autoCompactThreshold = options.autoCompactThreshold || 30;

    /** @type {Array<{id:string, type:string, content:string, turn:number, timestamp:number, importance:number, source?:string, path?:string, toolName?:string}>} */
    this.entries = [];

    /** @type {Array<{turn:number, summary:string, timestamp:number}>} */
    this.turnSummaries = [];

    /** @type {number} */
    this.turnCount = 0;

    /** @type {number} */
    this.lastCompactTurn = 0;

    /** @type {number} 累计节省的 token 估算 */
    this.totalTokensSaved = 0;
  }

  // ----------------------------------------------------------
  // 核心 API
  // ----------------------------------------------------------

  /**
   * 添加一条记忆条目
   * @param {string} type - 条目类型（MEMORY_ENTRY_TYPES 枚举）
   * @param {string} content - 条目内容
   * @param {Object} [metadata] - 元数据
   * @param {number} [metadata.importance=5]
   * @param {number} [metadata.turn]
   * @param {string} [metadata.source]
   * @param {string} [metadata.path]
   * @param {string} [metadata.toolName]
   * @returns {Object} 创建的条目
   */
  addEntry(type, content, metadata = {}) {
    const entry = {
      id: crypto.randomUUID(),
      type,
      content: String(content).trim(),
      turn: metadata.turn ?? this.turnCount,
      timestamp: Date.now(),
      importance: metadata.importance ?? 5,
      source: metadata.source || '',
      path: metadata.path || '',
      toolName: metadata.toolName || '',
      ...metadata,
    };

    this.entries.push(entry);

    // 按重要性降序排列，保留最重要的条目
    this.entries.sort((a, b) => b.importance - a.importance);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    return entry;
  }

  /**
   * 从工具执行结果中增量提取记忆
   *
   * @param {string} toolName - 工具名称
   * @param {Object} args - 工具参数
   * @param {Object} result - 工具执行结果
   * @param {number} turnNumber - 当前轮次
   */
  extractFromToolResult(toolName, args, result, turnNumber) {
    if (!toolName || !args) return;

    this.turnCount = Math.max(this.turnCount, (turnNumber ?? 0) + 1);
    const resultOk = result?.ok !== false;

    // ---- workspace_write: 记录文件工件 ----
    if (toolName === 'workspace_write' && args.path) {
      this.addEntry(MEMORY_ENTRY_TYPES.ARTIFACT,
        `已写入文件: ${args.path} (${String(args.content || '').length} 字符)`,
        { path: args.path, toolName, turn: turnNumber, importance: IMPORTANCE.HIGH }
      );
      return;
    }

    // ---- workspace_edit: 记录文件编辑 ----
    if (toolName === 'workspace_edit' && args.path) {
      this.addEntry(MEMORY_ENTRY_TYPES.ARTIFACT,
        `已编辑文件: ${args.path}`,
        { path: args.path, toolName, turn: turnNumber, importance: IMPORTANCE.HIGH }
      );
      return;
    }

    // ---- workspace_grep / workspace_find: 记录搜索发现 ----
    if ((toolName === 'workspace_grep' || toolName === 'workspace_find') && resultOk) {
      const matchCount = result?.matches?.length ?? result?.files?.length ?? 0;
      if (matchCount > 0) {
        this.addEntry(MEMORY_ENTRY_TYPES.FACT,
          `搜索 "${String(args.pattern || args.query || '').slice(0, 80)}" 发现 ${matchCount} 个结果`,
          { toolName, turn: turnNumber, importance: IMPORTANCE.MEDIUM }
        );
      }
      return;
    }

    // ---- workspace_ls: 记录目录结构（仅首次） ----
    if (toolName === 'workspace_ls' && resultOk && result?.entries?.length > 0) {
      const existing = this.entries.some(
        e => e.type === MEMORY_ENTRY_TYPES.FACT && e.toolName === 'workspace_ls' && e.path === args.path
      );
      if (!existing) {
        this.addEntry(MEMORY_ENTRY_TYPES.FACT,
          `目录 ${args.path || '.'}: ${result.entries.length} 个条目`,
          { path: args.path || '.', toolName, turn: turnNumber, importance: IMPORTANCE.LOW }
        );
      }
      return;
    }

    // ---- workspace_read: 记录已读文件 ----
    if (toolName === 'workspace_read' && resultOk && args.path) {
      const existing = this.entries.some(
        e => e.type === MEMORY_ENTRY_TYPES.FACT && e.toolName === 'workspace_read' && e.path === args.path
      );
      if (!existing) {
        this.addEntry(MEMORY_ENTRY_TYPES.FACT,
          `已读取文件: ${args.path}`,
          { path: args.path, toolName, turn: turnNumber, importance: IMPORTANCE.LOW }
        );
      }
      return;
    }

    // ---- bash: 记录关键命令执行 ----
    if (toolName === 'bash' && args.command) {
      this.addEntry(MEMORY_ENTRY_TYPES.TOOL_RESULT,
        `执行命令: ${String(args.command).slice(0, 200)}${resultOk ? '' : ' (失败)'}`,
        { toolName, turn: turnNumber, importance: IMPORTANCE.MEDIUM }
      );
      return;
    }

    // ---- 其他工具: 通用记录 ----
    if (resultOk && args.path) {
      this.addEntry(MEMORY_ENTRY_TYPES.TOOL_RESULT,
        `${toolName}: ${args.path}`,
        { toolName, path: args.path, turn: turnNumber, importance: IMPORTANCE.LOW }
      );
    }
  }

  /**
   * 从 Assistant 消息中提取决策、待办等记忆
   * @param {string} content - Assistant 回复文本
   * @param {number} turnNumber
   */
  extractFromAssistantContent(content, turnNumber) {
    if (!content || typeof content !== 'string') return;

    // ----- 决策模式 -----
    const decisionPatterns = [
      /(?:决定|选择|采用|使用|改用|迁移|切换到|确定为)\s*[:：]?\s*([^。\n]{4,120})/gi,
      /(?:方案|架构|设计|策略|路线)[：:]\s*([^。\n]{4,200})/gi,
      /最终(?:决定|方案|选择)[：:]\s*([^。\n]{4,200})/gi,
    ];
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length >= 4 && this._isUnique(MEMORY_ENTRY_TYPES.DECISION, text)) {
          this.addEntry(MEMORY_ENTRY_TYPES.DECISION, text,
            { turn: turnNumber, importance: IMPORTANCE.HIGH, source: 'assistant' }
          );
        }
      }
    }

    // ----- 待办/未完成任务模式 -----
    const pendingPatterns = [
      /(?:还需要|下一步|待办|TODO|未完成|还有[什么]?|剩下|需要继续|尚未)[：:：]?\s*([^。\n]{4,120})/gi,
      /[•\-*]\s*(?:还需要|下一步|TODO|待办)[：:：]?\s*([^。\n]{4,120})/gi,
    ];
    for (const pattern of pendingPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length >= 4 && this._isUnique(MEMORY_ENTRY_TYPES.PENDING, text)) {
          this.addEntry(MEMORY_ENTRY_TYPES.PENDING, text,
            { turn: turnNumber, importance: IMPORTANCE.HIGH, source: 'assistant' }
          );
        }
      }
    }

    // ----- 约束条件模式 -----
    const constraintPatterns = [
      /(?:约束|限制|要求|前提|必须|不能|不允许)[：:：]?\s*([^。\n]{4,120})/gi,
    ];
    for (const pattern of constraintPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length >= 4 && this._isUnique(MEMORY_ENTRY_TYPES.CONSTRAINT, text)) {
          this.addEntry(MEMORY_ENTRY_TYPES.CONSTRAINT, text,
            { turn: turnNumber, importance: IMPORTANCE.HIGH, source: 'assistant' }
          );
        }
      }
    }
  }

  /**
   * 压缩消息列表：保留最近 N 轮的原始消息，把旧的转换为结构化记忆
   *
   * @param {Array} messages - 完整消息列表（含 system 和 context 消息）
   * @param {Object} [options]
   * @param {Function} [options.summaryModel] - async (text) => summary
   * @param {number} [options.maxRecentTurns] - 覆盖实例配置
   * @returns {Promise<Array>} 压缩后的消息列表
   */
  async compactMessages(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length <= 12) {
      return messages;
    }

    const maxRecent = options.maxRecentTurns ?? this.maxRecentTurns;
    const systemMsg = messages.find(m => m.role === 'system');
    const structuredMemMsg = messages.find(m => m.name === 'structured_memory');
    const nonSystem = messages.filter(m => m.role !== 'system' && m.name !== 'structured_memory');

    // 从后往前扫描，收集最近 maxRecent 轮用户请求（不含 named context 消息）
    const recentMsgs = [];
    let userTurnCount = 0;

    for (let i = nonSystem.length - 1; i >= 0 && userTurnCount < maxRecent; i--) {
      const msg = nonSystem[i];
      recentMsgs.unshift(msg);
      if (msg.role === 'user' && !msg.name) {
        userTurnCount++;
      }
    }

    // 需要归档的消息 = 不在 recentMsgs 中的消息
    const archiveMsgs = nonSystem.slice(0, nonSystem.length - recentMsgs.length);

    if (archiveMsgs.length < 4) {
      return messages; // 可归档的消息太少，不压缩
    }

    // 从归档消息中提取事实和决策
    for (const msg of archiveMsgs) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        this.extractFromAssistantContent(msg.content, this.turnCount);
      }
    }

    // 计算压缩前的 token 估算
    const beforeBytes = archiveMsgs.reduce((sum, m) => {
      return sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length);
    }, 0);

    // 构建归档摘要
    let archiveSummary = '';
    if (options.summaryModel && typeof options.summaryModel === 'function') {
      try {
        const textToSummarize = archiveMsgs
          .map(m => {
            const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            return `${m.role}: ${content.slice(0, 600)}`;
          })
          .join('\n---\n')
          .slice(0, 12000);

        archiveSummary = await options.summaryModel(textToSummarize);
      } catch {
        archiveSummary = this._buildFallbackSummary(archiveMsgs);
      }
    } else {
      archiveSummary = this._buildFallbackSummary(archiveMsgs);
    }

    // 添加归档摘要作为记忆条目
    this.addEntry(MEMORY_ENTRY_TYPES.SUMMARY, archiveSummary, {
      turn: this.turnCount,
      importance: IMPORTANCE.MEDIUM,
      source: 'compaction',
    });

    this.turnSummaries.push({
      turn: this.turnCount,
      summary: archiveSummary,
      timestamp: Date.now(),
    });

    this.lastCompactTurn = this.turnCount;
    this.turnCount++;

    // 计算压缩后的 token 估算
    const afterBytes = archiveSummary.length;
    this.totalTokensSaved += Math.max(0, Math.floor((beforeBytes - afterBytes) / 2));

    // 返回压缩后的消息
    const summaryMsg = {
      role: 'user',
      content: [
        `## 归档记忆（自动压缩 — 替代 ${archiveMsgs.length} 条原始消息）`,
        '',
        archiveSummary,
        '',
        '以上是之前对话的结构化摘要。后续的原始消息保留在下方。',
      ].join('\n'),
      name: 'structured_memory',
    };

    return [
      ...(systemMsg ? [systemMsg] : []),
      summaryMsg,
      ...recentMsgs,
    ];
  }

  /**
   * 构建记忆上下文提示词（在每次 LLM 调用前注入）
   * @returns {string} 格式化的记忆上下文文本
   */
  buildContextPrompt() {
    if (this.entries.length === 0) return '';

    const lines = ['## 会话结构化记忆（压缩上下文）\n'];

    // ---- 关键决策 ----
    const decisions = this.entries
      .filter(e => e.type === MEMORY_ENTRY_TYPES.DECISION)
      .slice(-5);
    if (decisions.length > 0) {
      lines.push('### 关键决策');
      decisions.forEach((d, i) => { lines.push(`${i + 1}. ${d.content}`); });
      lines.push('');
    }

    // ---- 已创建/修改的文件 ----
    const artifacts = this.entries
      .filter(e => e.type === MEMORY_ENTRY_TYPES.ARTIFACT)
      .slice(-10);
    if (artifacts.length > 0) {
      lines.push('### 已创建/修改的文件');
      artifacts.forEach((a, i) => { lines.push(`${i + 1}. ${a.content}`); });
      lines.push('');
    }

    // ---- 未完成任务 ----
    const pending = this.entries
      .filter(e => e.type === MEMORY_ENTRY_TYPES.PENDING)
      .slice(-5);
    if (pending.length > 0) {
      lines.push('### 未完成任务');
      pending.forEach((p, i) => { lines.push(`${i + 1}. ${p.content}`); });
      lines.push('');
    }

    // ---- 关键事实 ----
    const facts = this.entries
      .filter(e => e.type === MEMORY_ENTRY_TYPES.FACT)
      .slice(-5);
    if (facts.length > 0) {
      lines.push('### 关键事实');
      facts.forEach((f, i) => { lines.push(`${i + 1}. ${f.content}`); });
      lines.push('');
    }

    // ---- 约束条件 ----
    const constraints = this.entries
      .filter(e => e.type === MEMORY_ENTRY_TYPES.CONSTRAINT)
      .slice(-3);
    if (constraints.length > 0) {
      lines.push('### 约束条件');
      constraints.forEach((c, i) => { lines.push(`${i + 1}. ${c.content}`); });
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * 判断是否需要自动压缩
   * @param {Array} messages
   * @returns {boolean}
   */
  shouldCompact(messages) {
    return Array.isArray(messages) && messages.length >= this.autoCompactThreshold;
  }

  /**
   * 获取最近的消息子集（不压缩，只截取）
   * @param {Array} messages
   * @param {number} [turnCount]
   * @returns {Array}
   */
  getRecentMessages(messages) {
    if (!Array.isArray(messages)) return [];
    if (messages.length <= 12) return messages;

    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');
    const recent = [];
    let turns = 0;

    for (let i = nonSystem.length - 1; i >= 0 && turns < this.maxRecentTurns; i--) {
      recent.unshift(nonSystem[i]);
      if (nonSystem[i].role === 'user' && !nonSystem[i].name) {
        turns++;
      }
    }

    return [
      ...(systemMsg ? [systemMsg] : []),
      ...recent,
    ];
  }

  /**
   * 获取当前记忆状态（用于调试/遥测）
   * @returns {Object}
   */
  getState() {
    const typeCount = {};
    for (const e of this.entries) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    }

    return {
      id: this.id,
      entryCount: this.entries.length,
      turnCount: this.turnCount,
      lastCompactTurn: this.lastCompactTurn,
      totalTokensSaved: this.totalTokensSaved,
      entriesByType: typeCount,
      maxRecentTurns: this.maxRecentTurns,
      hasMemory: this.entries.length > 0,
    };
  }

  /**
   * 重置所有记忆
   */
  clear() {
    this.entries = [];
    this.turnSummaries = [];
    this.turnCount = 0;
    this.lastCompactTurn = 0;
    this.totalTokensSaved = 0;
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /** 检查同类条目是否已存在（避免重复） */
  _isUnique(type, content) {
    const normalized = content.toLowerCase().slice(0, 60);
    return !this.entries.some(e => {
      if (e.type !== type) return false;
      return e.content.toLowerCase().slice(0, 60) === normalized;
    });
  }

  /** 不用 LLM 时的降级摘要 */
  _buildFallbackSummary(msgs) {
    const userCount = msgs.filter(m => m.role === 'user' && !m.name).length;
    const assistantCount = msgs.filter(m => m.role === 'assistant').length;
    const toolCount = msgs.filter(m => m.role === 'tool').length;

    const lines = [
      `【已归档 ${msgs.length} 条消息】对话包含 ${userCount} 轮用户请求，${assistantCount} 次模型响应，${toolCount} 次工具调用。`,
    ];

    // 选取最近归档的记忆条目作为补充
    const recentEntries = this.entries
      .filter(e => e.type !== MEMORY_ENTRY_TYPES.SUMMARY)
      .slice(-6);

    for (const e of recentEntries) {
      lines.push(`- ${e.type}: ${e.content}`);
    }

    return lines.join('\n');
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  StructuredMemory,
  MEMORY_ENTRY_TYPES,
  IMPORTANCE,
};
