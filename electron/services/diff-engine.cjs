/**
 * diff-engine.cjs
 *
 * 结构化文件差异引擎 + 跨文件感知
 *
 * ========== 能力 ==========
 * 1. 行级结构化 diff（增/删/改/上下文）
 * 2. 跨文件引用分析（import/require/模块引用）
 * 3. 文件依赖图构建与变更影响推断
 * 4. Snapshot 对比（基于文件内容的快照管理）
 *
 * ========== 使用场景 ==========
 * - 文件编辑后显示精确变更行
 * - 跨文件重构时自动发现受影响模块
 * - 审查历史修改时生成结构化的 diff 报告
 */

// ============================================================
// 结构化 Diff 引擎
// ============================================================

/**
 * diff 行类型枚举
 */
const DiffLineType = Object.freeze({
  CONTEXT: 'context',   // 未变更的上下文行
  ADDED: 'added',       // 新增行
  REMOVED: 'removed',   // 删除行
  CHANGED: 'changed',   // 修改行（组合 removed + added）
});

/**
 * 对两段文本进行逐行结构化 diff
 *
 * 使用 Myers 差分算法简化实现（基于 LCS 变体）
 *
 * @param {string} oldText - 旧文本
 * @param {string} newText - 新文本
 * @param {Object} [options]
 * @param {number} [options.contextLines=3] - 上下文行数
 * @param {boolean} [options.includeLineNumbers=true] - 是否包含行号
 * @returns {Array<{type: string, oldLine: number|null, newLine: number|null, content: string}>}
 */
function structuredDiff(oldText, newText, options = {}) {
  const contextLines = options.contextLines ?? 3;
  const includeLineNumbers = options.includeLineNumbers !== false;

  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  // 简单 LCS 实现
  const lcs = computeLcs(oldLines, newLines);

  // 将 LCS 转换为 diff 操作序列
  const operations = lcsToOperations(lcs, oldLines, newLines);
  const result = [];

  let lastChangeIndex = -1;
  let pendingContext = [];

  function flushContext() {
    const contextStart = Math.max(0, lastChangeIndex - contextLines);
    const contextEnd = Math.min(result.length, lastChangeIndex + contextLines + 1);

    // 只保留变化附近的上下文
    const oldLen = result.length;
    const sliced = result.slice(
      Math.max(0, contextStart),
      Math.min(oldLen, contextEnd)
    );
    result.length = 0;
    result.push(...sliced);
    pendingContext = [];
  }

  // 构建 diff 结果
  let oldIdx = 0;
  let newIdx = 0;

  for (const op of operations) {
    if (op.type === 'equal') {
      const content = oldLines[oldIdx];
      result.push({
        type: DiffLineType.CONTEXT,
        oldLine: includeLineNumbers ? oldIdx + 1 : null,
        newLine: includeLineNumbers ? newIdx + 1 : null,
        content,
      });
      oldIdx++;
      newIdx++;
    } else if (op.type === 'remove') {
      result.push({
        type: DiffLineType.REMOVED,
        oldLine: includeLineNumbers ? oldIdx + 1 : null,
        newLine: null,
        content: oldLines[oldIdx],
      });
      oldIdx++;
      lastChangeIndex = result.length - 1;
    } else if (op.type === 'add') {
      result.push({
        type: DiffLineType.ADDED,
        oldLine: null,
        newLine: includeLineNumbers ? newIdx + 1 : null,
        content: newLines[newIdx],
      });
      newIdx++;
      lastChangeIndex = result.length - 1;
    }
  }

  // 上下文裁剪
  const finalResult = [];
  let lastChangePos = -1;

  for (let i = 0; i < result.length; i++) {
    if (result[i].type !== DiffLineType.CONTEXT) {
      lastChangePos = i;
    }
  }

  const firstChangePos = result.findIndex(r => r.type !== DiffLineType.CONTEXT);
  if (firstChangePos < 0) {
    return []; // 无变化
  }

  const start = Math.max(0, firstChangePos - contextLines);
  const end = Math.min(result.length, lastChangePos + contextLines + 1);

  for (let i = start; i < end; i++) {
    finalResult.push(result[i]);
  }

  // 在上下文边界插入折叠标记
  if (start > 0) {
    finalResult.unshift({
      type: 'fold',
      oldLine: null,
      newLine: null,
      content: `... 以上省略 ${start} 行 ...`,
    });
  }

  if (end < result.length) {
    finalResult.push({
      type: 'fold',
      oldLine: null,
      newLine: null,
      content: `... 以下省略 ${result.length - end} 行 ...`,
    });
  }

  return finalResult;
}

/**
 * 计算最长公共子序列（LCS）
 * 用于 Myers 差分算法
 */
function computeLcs(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯重建 LCS
  const result = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', aIndex: i - 1, bIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      result.unshift({ type: 'remove', aIndex: i - 1, bIndex: null });
      i--;
    } else {
      result.unshift({ type: 'add', aIndex: null, bIndex: j - 1 });
      j--;
    }
  }

  while (i > 0) {
    result.unshift({ type: 'remove', aIndex: i - 1, bIndex: null });
    i--;
  }

  while (j > 0) {
    result.unshift({ type: 'add', aIndex: null, bIndex: j - 1 });
    j--;
  }

  return result;
}

/**
 * 将 LCS 结果转换为操作序列（合并相邻的相同操作）
 */
function lcsToOperations(lcs, a, b) {
  const operations = [];
  let i = 0;

  while (i < lcs.length) {
    const current = lcs[i];

    if (current.type === 'equal') {
      operations.push({
        type: 'equal',
        aStart: current.aIndex,
        aEnd: current.aIndex,
        bStart: current.bIndex,
        bEnd: current.bIndex,
      });
      i++;
    } else if (current.type === 'remove') {
      let count = 0;
      while (i + count < lcs.length && lcs[i + count].type === 'remove') {
        count++;
      }
      operations.push({
        type: 'remove',
        aStart: lcs[i].aIndex,
        aEnd: lcs[i + count - 1].aIndex,
        count,
      });
      i += count;
    } else if (current.type === 'add') {
      let count = 0;
      while (i + count < lcs.length && lcs[i + count].type === 'add') {
        count++;
      }
      operations.push({
        type: 'add',
        bStart: lcs[i].bIndex,
        bEnd: lcs[i + count - 1].bIndex,
        count,
      });
      i += count;
    }
  }

  return operations;
}

/**
 * 生成 diff 摘要统计
 */
function diffStats(diffLines) {
  const stats = {
    added: 0,
    removed: 0,
    changed: 0,
    context: 0,
  };

  for (const line of diffLines) {
    if (line.type === DiffLineType.ADDED) stats.added++;
    else if (line.type === DiffLineType.REMOVED) stats.removed++;
    else if (line.type === DiffLineType.CHANGED) stats.changed++;
    else if (line.type === DiffLineType.CONTEXT) stats.context++;
  }

  return stats;
}

// ============================================================
// 跨文件引用分析器
// ============================================================

/**
 * 支持的引用类型
 */
const RefType = Object.freeze({
  REQUIRE: 'require',       // require('...')
  IMPORT: 'import',         // import ... from '...'
  IMPORT_RAW: 'import_raw', // import '...' (side-effect)
  EXPORT: 'export',         // export { ... }, export default
  DYNAMIC_IMPORT: 'dynamic_import', // import('...')
  CSS_IMPORT: 'css_import', // @import '...' or import('./style.css')
});

/**
 * 分析单个文件的引用（import/require）
 *
 * @param {string} content - 文件内容
 * @param {string} filePath - 文件路径（用于解析相对引用）
 * @returns {Array<{type: string, source: string, line: number, resolved?: string}>}
 */
function analyzeReferences(content, filePath) {
  const references = [];
  const lines = (content || '').split('\n');
  const ext = filePath ? filePath.split('.').pop().toLowerCase() : '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // require('...')
    const requireMatch = line.match(/(?:const|let|var|)\s*(?:\w+\s*,\s*)?\{?\s*(\w+(?:\s*,\s*\w+)*)\s*\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch) {
      references.push({
        type: RefType.REQUIRE,
        source: requireMatch[2],
        line: lineNum,
        symbols: requireMatch[1].split(',').map(s => s.trim()).filter(Boolean),
      });
      continue;
    }

    // 裸 require('...')
    const bareRequire = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (bareRequire) {
      references.push({
        type: RefType.REQUIRE,
        source: bareRequire[1],
        line: lineNum,
        symbols: [],
      });
      continue;
    }

    // import ... from '...'
    const importMatch = line.match(/import\s+(?:\{[^}]*\}\s*|\w+\s*|\*\s*as\s+\w+\s*),?\s*(?:\{[^}]*\}\s*)?from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      references.push({
        type: RefType.IMPORT,
        source: importMatch[1],
        line: lineNum,
      });
      continue;
    }

    // import '...' (side-effect)
    const sideEffectImport = line.match(/import\s+['"]([^'"]+)['"]/);
    if (sideEffectImport) {
      references.push({
        type: RefType.IMPORT_RAW,
        source: sideEffectImport[1],
        line: lineNum,
      });
      continue;
    }

    // CSS @import
    if (ext === 'css' || ext === 'wxss') {
      const cssImport = line.match(/@import\s+['"]([^'"]+)['"]/);
      if (cssImport) {
        references.push({
          type: RefType.CSS_IMPORT,
          source: cssImport[1],
          line: lineNum,
        });
        continue;
      }
    }
  }

  return references;
}

/**
 * 分析某个文件的导出符号
 *
 * @param {string} content - 文件内容
 * @returns {Array<{name: string, line: number, type: string}>}
 */
function analyzeExports(content) {
  const exports = [];
  const lines = (content || '').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // module.exports = ...
    const moduleExports = line.match(/module\.exports\s*=\s*(\{?[\s\S]*?\}?)/);
    if (moduleExports) {
      exports.push({
        name: 'module.exports',
        line: lineNum,
        type: 'module-export',
      });
      continue;
    }

    // exports.xxx = ...
    const exportsProp = line.match(/exports\.(\w+)\s*=/);
    if (exportsProp) {
      exports.push({
        name: exportsProp[1],
        line: lineNum,
        type: 'named-export',
      });
      continue;
    }

    // export function / export const / export class
    const exportDecl = line.match(/export\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/);
    if (exportDecl) {
      exports.push({
        name: exportDecl[1],
        line: lineNum,
        type: line.includes('default') ? 'default-export' : 'named-export',
      });
      continue;
    }

    // export { ... }
    const exportList = line.match(/export\s+\{([^}]+)\}/);
    if (exportList) {
      const names = exportList[1].split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      }).filter(Boolean);
      for (const name of names) {
        exports.push({
          name,
          line: lineNum,
          type: 'named-export',
        });
      }
      continue;
    }
  }

  return exports;
}

// ============================================================
// 文件依赖图
// ============================================================

/**
 * 构建文件依赖图
 *
 * @param {Map<string, {content: string, path: string}>} fileMap - 文件路径 -> 内容映射
 * @param {Object} [options]
 * @param {string[]} [options.extensions] - 解析时尝试的文件扩展名
 * @returns {Object} { nodes, edges, adjacencyList }
 */
function buildDependencyGraph(fileMap, options = {}) {
  const extensions = options.extensions || ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.wxss', '.json'];
  const nodes = [];
  const edges = [];
  const adjacencyList = new Map();
  const reverseDependencies = new Map();

  // 初始化所有文件节点
  for (const [filePath] of fileMap) {
    nodes.push({
      id: filePath,
      label: filePath.split('/').pop(),
      path: filePath,
    });
    adjacencyList.set(filePath, []);
    reverseDependencies.set(filePath, []);
  }

  // 分析每个文件的引用
  for (const [filePath, fileData] of fileMap) {
    const references = analyzeReferences(fileData.content, filePath);
    const resolvedPaths = new Set();

    for (const ref of references) {
      // 跳过外部依赖（node_modules 包名）
      if (!ref.source.startsWith('.') && !ref.source.startsWith('/')) {
        // npm 包引用 — 标记为外部依赖
        const edgeId = `${filePath} -> npm:${ref.source}`;
        if (!resolvedPaths.has(edgeId)) {
          resolvedPaths.add(edgeId);
          edges.push({
            from: filePath,
            to: `npm:${ref.source}`,
            type: ref.type,
            source: ref.source,
            line: ref.line,
            external: true,
          });
        }
        continue;
      }

      // 解析相对路径
      const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1) || '';
      let resolved = resolveModulePath(ref.source, dir, extensions, fileMap);

      if (resolved) {
        const edgeId = `${filePath} -> ${resolved}`;
        if (!resolvedPaths.has(edgeId)) {
          resolvedPaths.add(edgeId);
          edges.push({
            from: filePath,
            to: resolved,
            type: ref.type,
            source: ref.source,
            line: ref.line,
            external: false,
          });
          adjacencyList.get(filePath)?.push(resolved);
          reverseDependencies.get(resolved)?.push(filePath);
        }
      } else {
        // 未解析的引用
        edges.push({
          from: filePath,
          to: `unresolved:${ref.source}`,
          type: ref.type,
          source: ref.source,
          line: ref.line,
          external: false,
          unresolved: true,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    adjacencyList: Object.fromEntries(adjacencyList),
    reverseDependencies: Object.fromEntries(reverseDependencies),
    getAffectedFiles(changedPath) {
      return findAffectedFiles(changedPath, reverseDependencies, fileMap);
    },
  };
}

/**
 * 解析模块路径（尝试多种扩展名和 index 文件）
 */
function resolveModulePath(source, dir, extensions, fileMap) {
  // 绝对路径
  if (source.startsWith('/')) {
    const absolute = source.substring(1); // 去掉前导 /
    for (const ext of ['', ...extensions]) {
      const candidate = absolute + ext;
      if (fileMap.has(candidate)) return candidate;
    }
    return null;
  }

  // 相对路径
  const base = source.endsWith('/') ? source.slice(0, -1) : source;

  // 精确匹配
  for (const ext of ['', ...extensions]) {
    const candidate = dir + base + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  // index 文件
  for (const ext of extensions) {
    const candidate = dir + base + '/index' + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  return null;
}

/**
 * 查找受变更影响的所有文件（反向依赖传播）
 */
function findAffectedFiles(changedPath, reverseDeps, fileMap) {
  const affected = new Set();
  const visited = new Set();
  const queue = [changedPath];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    // 依赖于当前文件的文件
    const dependents = reverseDeps[current] || [];
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return [...affected];
}

// ============================================================
// 快照管理器
// ============================================================

/**
 * 文件内容快照管理器
 * 用于跟踪文件变更历史
 */
class SnapshotManager {
  constructor() {
    this.snapshots = new Map(); // path -> [{timestamp, content, hash}]
  }

  /**
   * 记录快照
   * @param {string} filePath
   * @param {string} content
   * @returns {string} snapshot id
   */
  snapshot(filePath, content) {
    if (!this.snapshots.has(filePath)) {
      this.snapshots.set(filePath, []);
    }

    const history = this.snapshots.get(filePath);
    const hash = simpleHash(content);
    const entry = {
      id: `snap-${history.length}-${Date.now()}`,
      timestamp: Date.now(),
      content,
      hash,
      size: content.length,
    };

    // 避免重复快照
    if (history.length > 0 && history[history.length - 1].hash === hash) {
      return history[history.length - 1].id;
    }

    history.push(entry);

    // 限制历史深度
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    return entry.id;
  }

  /**
   * 获取两个快照之间的 diff
   * @param {string} filePath
   * @param {number} [fromIndex] - 旧快照索引（默认倒数第二个）
   * @param {number} [toIndex] - 新快照索引（默认最后一个）
   * @returns {Object|null}
   */
  diff(filePath, fromIndex, toIndex) {
    const history = this.snapshots.get(filePath);
    if (!history || history.length < 2) return null;

    const from = history[fromIndex ?? history.length - 2];
    const to = history[toIndex ?? history.length - 1];
    if (!from || !to) return null;

    const diffLines = structuredDiff(from.content, to.content);
    return {
      filePath,
      from: { id: from.id, timestamp: from.timestamp },
      to: { id: to.id, timestamp: to.timestamp },
      stats: diffStats(diffLines),
      lines: diffLines,
    };
  }

  /**
   * 获取文件快照历史
   */
  getHistory(filePath) {
    return (this.snapshots.get(filePath) || []).map(({ id, timestamp, hash, size }) => ({
      id, timestamp, hash, size,
    }));
  }

  /**
   * 获取指定快照的内容
   */
  getContent(filePath, index) {
    const history = this.snapshots.get(filePath);
    if (!history) return null;
    const entry = history[index ?? history.length - 1];
    return entry ? entry.content : null;
  }

  /**
   * 清理所有快照
   */
  clear() {
    this.snapshots.clear();
  }
}

/**
 * 简单哈希（djb2）
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}

// ============================================================
// 便利工具函数
// ============================================================

/**
 * 生成人类可读的 diff 文本
 */
function formatDiffText(diffLines, options = {}) {
  const color = options.color ?? false;
  const lines = [];

  for (const line of diffLines) {
    if (line.type === 'fold') {
      lines.push(line.content);
      continue;
    }

    const oldMarker = line.oldLine != null ? `${line.oldLine}`.padStart(4) : '    ';
    const newMarker = line.newLine != null ? `${line.newLine}`.padStart(4) : '    ';
    const prefix = `${oldMarker} ${newMarker}`;

    switch (line.type) {
      case DiffLineType.ADDED:
        lines.push(color ? `\x1b[32m${prefix} + ${line.content}\x1b[0m` : `${prefix} + ${line.content}`);
        break;
      case DiffLineType.REMOVED:
        lines.push(color ? `\x1b[31m${prefix} - ${line.content}\x1b[0m` : `${prefix} - ${line.content}`);
        break;
      case DiffLineType.CHANGED:
        lines.push(color ? `\x1b[33m${prefix} ~ ${line.content}\x1b[0m` : `${prefix} ~ ${line.content}`);
        break;
      default:
        lines.push(`${prefix}   ${line.content}`);
    }
  }

  return lines.join('\n');
}

/**
 * 从文件路径列表构建 fileMap
 * 适用于 workspace 文件列表
 */
function buildFileMapFromFiles(files, workspacePath, fs) {
  const fileMap = new Map();
  for (const file of files) {
    if (!file.text) continue; // 跳过二进制文件
    try {
      const absolutePath = path.resolve(workspacePath, file.path);
      const content = fs.readFileSync(absolutePath, 'utf8');
      fileMap.set(file.path, { content, path: file.path });
    } catch {
      // 跳过无法读取的文件
    }
  }
  return fileMap;
}

// ============================================================
// 创建 DiffEngine 实例
// ============================================================

function createDiffEngine({ workspaceManager, fs } = {}) {
  const snapshotManager = new SnapshotManager();
  const resolvedFs = fs || require('node:fs');
  const resolvedPath = require('node:path');

  return {
    // 核心差分
    structuredDiff,
    diffStats,
    formatDiffText,
    DiffLineType,

    // 引用分析
    analyzeReferences,
    analyzeExports,
    RefType,

    // 依赖图
    buildDependencyGraph,
    findAffectedFiles,

    // 快照管理
    snapshotManager,

    /**
     * 对比文件的两个版本
     * @param {string} oldContent - 旧内容
     * @param {string} newContent - 新内容
     * @param {Object} [options]
     * @returns {Object} { lines, stats, summary }
     */
    compare(oldContent, newContent, options = {}) {
      const lines = structuredDiff(oldContent, newContent, options);
      const stats = diffStats(lines);
      const summary = stats.added + stats.removed > 0
        ? `+${stats.added} / -${stats.removed} 行`
        : '无变更';
      return { lines, stats, summary };
    },

    /**
     * 构建工作区依赖图
     * @param {string} workspacePath
     * @param {Object} [options]
     * @returns {Object} { nodes, edges, adjacencyList, reverseDependencies }
     */
    analyzeWorkspace(workspacePath, options = {}) {
      const files = workspaceManager
        ? workspaceManager.listWorkspaceFiles(workspacePath, 200)
        : (options.files || []);

      const fileMap = new Map();
      for (const file of files) {
        if (!file.text) continue;
        try {
          const absolutePath = resolvedPath.resolve(workspacePath, file.path);
          const content = resolvedFs.readFileSync(absolutePath, 'utf8');
          fileMap.set(file.path, { content, path: file.path });
        } catch {
          // skip
        }
      }

      return buildDependencyGraph(fileMap, options);
    },

    /**
     * 分析变更影响范围
     * @param {string} changedPath - 变更的文件路径
     * @param {Object} depGraph - buildDependencyGraph 的返回结果
     * @returns {Array<string>} 受影响文件列表
     */
    getChangeImpact(changedPath, depGraph) {
      return depGraph.getAffectedFiles(changedPath);
    },
  };
}

module.exports = {
  createDiffEngine,
  SnapshotManager,
  structuredDiff,
  diffStats,
  formatDiffText,
  analyzeReferences,
  analyzeExports,
  buildDependencyGraph,
  DiffLineType,
  RefType,
};
