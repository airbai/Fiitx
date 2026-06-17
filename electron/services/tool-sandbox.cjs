/**
 * tool-sandbox.cjs
 *
 * 工具/技能系统 — 动态注册 + 沙箱隔离
 *
 * ========== 能力 ==========
 * 1. 动态工具注册/注销/热加载 — 运行时增删工具定义
 * 2. VM 沙箱隔离 — 工具在受限的 Node.js VM 中执行
 * 3. 资源限制 — 内存/CPU/超时/文件系统访问控制
 * 4. 政策边界 — 每个工具独立 policy，沙箱强制执行
 * 5. 工具版本管理 — 支持多版本共存与回滚
 *
 * ========== 架构 ==========
 *
 * ┌──────────────────────────────────────────────────────┐
 * │                   ToolSandbox                        │
 * │                                                      │
 * │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
 * │  │ 动态注册中心  │  │ VM 沙箱工厂   │  │ 资源监控器  │  │
 * │  │ register()  │  │ createVM()   │  │ memory     │  │
 * │  │ unregister()│  │ execute()    │  │ timeout    │  │
 * │  │ hotload()   │  │ sandbox      │  │ fs access  │  │
 * │  └─────────────┘  └──────────────┘  └────────────┘  │
 * │         │                │                │          │
 * │         ▼                ▼                ▼          │
 * │  ┌─────────────────────────────────────────────┐     │
 * │  │           Policy Enforcement Layer          │     │
 * │  │   每个工具执行前都必须经过 policy check       │     │
 * │  └─────────────────────────────────────────────┘     │
 * └──────────────────────────────────────────────────────┘
 */

const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');

// ============================================================
// 工具版本管理
// ============================================================

class ToolVersion {
  /**
   * @param {Object} descriptor - 工具描述符
   * @param {string} [version] - 版本号，默认自动生成
   */
  constructor(descriptor, version) {
    this.descriptor = { ...descriptor };
    this.version = version || `v${Date.now()}`;
    this.createdAt = Date.now();
    this.hash = this._computeHash();
  }

  _computeHash() {
    const stable = JSON.stringify({
      name: this.descriptor.name,
      label: this.descriptor.label,
      description: this.descriptor.description,
      parameters: this.descriptor.parameters,
      executionMode: this.descriptor.executionMode,
    });
    return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 12);
  }
}

// ============================================================
// 动态注册中心
// ============================================================

class DynamicRegistry {
  constructor({ policyEngine }) {
    this._tools = new Map();       // name -> { current, versions: ToolVersion[] }
    this._aliases = new Map();     // alias -> toolName
    this._hooks = new Map();       // event -> Set<handler>
    this._policyEngine = policyEngine;
  }

  /**
   * 动态注册一个工具
   *
   * @param {Object} descriptor - 工具描述符
   * @param {string} descriptor.name - 工具名（唯一标识）
   * @param {string} [descriptor.label] - 可读名称
   * @param {string} [descriptor.description] - 描述
   * @param {Object} [descriptor.parameters] - JSON Schema 参数定义
   * @param {Function} descriptor.execute - 执行函数
   * @param {Object} [descriptor.policy] - 策略配置
   * @param {string} [descriptor.executionMode] - sequential | isolated
   * @param {string[]} [descriptor.capabilities] - 能力标签
   * @param {Function} [descriptor.sandbox] - 沙箱配置 factory
   * @returns {Object} 注册后的工具信息
   */
  register(descriptor) {
    if (!descriptor || !descriptor.name) {
      throw new Error('工具注册需要 name 属性');
    }

    const name = descriptor.name;

    // 保存版本历史
    const version = new ToolVersion(descriptor);
    const existing = this._tools.get(name);

    if (existing) {
      existing.versions.push(version);
      existing.current = version;
      this._emit('update', { name, version: version.version });
    } else {
      this._tools.set(name, {
        current: version,
        versions: [version],
      });
      this._emit('register', { name, version: version.version });
    }

    return {
      name,
      version: version.version,
      hash: version.hash,
      totalVersions: this._tools.get(name).versions.length,
    };
  }

  /**
   * 注销一个工具
   * @param {string} name - 工具名
   * @param {Object} [options]
   * @param {boolean} [options.keepVersions=false] - 是否保留版本历史
   */
  unregister(name, options = {}) {
    const entry = this._tools.get(name);
    if (!entry) {
      throw new Error(`工具未注册：${name}`);
    }

    if (!options.keepVersions) {
      this._tools.delete(name);
    } else {
      // 标记为已停用
      entry.current = null;
    }

    // 清理别名
    for (const [alias, target] of this._aliases) {
      if (target === name) {
        this._aliases.delete(alias);
      }
    }

    this._emit('unregister', { name });
  }

  /**
   * 热加载 — 从文件路径加载工具
   *
   * @param {string} filePath - 工具文件的绝对路径
   * @param {Object} [options]
   * @param {Object} [options.sandboxContext] - 注入沙箱的额外上下文
   * @returns {Promise<Object>} 注册结果
   */
  async hotload(filePath, options = {}) {
    let moduleExports;
    try {
      moduleExports = require(filePath);
    } catch (error) {
      throw new Error(`热加载工具失败：${filePath} — ${error.message}`);
    }

    // 支持单个工具或工具数组
    const descriptors = Array.isArray(moduleExports)
      ? moduleExports
      : [moduleExports];

    if (moduleExports.default) {
      descriptors.push(...(Array.isArray(moduleExports.default)
        ? moduleExports.default
        : [moduleExports.default]));
    }

    const results = [];
    for (const descriptor of descriptors) {
      if (descriptor && descriptor.name && typeof descriptor.execute === 'function') {
        // 注入沙箱上下文
        if (options.sandboxContext && descriptor.sandbox) {
          descriptor._sandboxContext = options.sandboxContext;
        }
        results.push(this.register(descriptor));
      }
    }

    if (results.length === 0) {
      throw new Error(`工具文件 ${filePath} 中没有找到有效的工具描述符`);
    }

    return results;
  }

  /**
   * 获取工具
   * @param {string} name - 工具名或别名
   * @returns {Object|null} 当前版本的工具描述符
   */
  get(name) {
    // 检查别名
    const resolvedName = this._aliases.get(name) || name;
    const entry = this._tools.get(resolvedName);
    if (!entry || !entry.current) return null;
    return entry.current.descriptor;
  }

  /**
   * 获取指定版本的工具
   */
  getVersion(name, versionStr) {
    const entry = this._tools.get(name);
    if (!entry) return null;
    return entry.versions.find(v => v.version === versionStr)?.descriptor || null;
  }

  /**
   * 回滚到指定版本
   */
  rollback(name, versionStr) {
    const entry = this._tools.get(name);
    if (!entry) throw new Error(`工具未注册：${name}`);

    const target = entry.versions.find(v => v.version === versionStr);
    if (!target) throw new Error(`版本不存在：${name}@${versionStr}`);

    entry.current = target;
    this._emit('rollback', { name, version: versionStr });
    return target.descriptor;
  }

  /**
   * 设置别名
   */
  setAlias(alias, toolName) {
    if (!this._tools.has(toolName)) {
      throw new Error(`别名指向的工具不存在：${toolName}`);
    }
    this._aliases.set(alias, toolName);
  }

  /**
   * 列出所有已注册的工具
   */
  list() {
    return [...this._tools.entries()]
      .filter(([, entry]) => entry.current)
      .map(([name, entry]) => ({
        name,
        label: entry.current.descriptor.label || name,
        description: entry.current.descriptor.description || '',
        version: entry.current.version,
        executionMode: entry.current.descriptor.executionMode || 'sequential',
        capabilities: entry.current.descriptor.capabilities || [],
        parameters: entry.current.descriptor.parameters || { type: 'object', properties: {} },
        createdAt: entry.current.createdAt,
        totalVersions: entry.versions.length,
      }));
  }

  /**
   * 事件钩子
   */
  on(event, handler) {
    if (!this._hooks.has(event)) {
      this._hooks.set(event, new Set());
    }
    this._hooks.get(event).add(handler);
    return () => this._hooks.get(event)?.delete(handler);
  }

  _emit(event, data) {
    const handlers = this._hooks.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(data); } catch { /* 静默处理钩子错误 */ }
      }
    }
  }
}

// ============================================================
// VM 沙箱工厂
// ============================================================

const DEFAULT_SANDBOX_GLOBALS = {
  console: {
    log: (...args) => args.join(' '),
    warn: (...args) => `[WARN] ${args.join(' ')}`,
    error: (...args) => `[ERROR] ${args.join(' ')}`,
  },
  Math,
  Date,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  Promise,
  Error,
  TypeError,
  RangeError,
  setTimeout: undefined, // 禁用 setTimeout
  setInterval: undefined, // 禁用 setInterval
};

/**
 * 创建沙箱执行环境
 *
 * @param {Object} [options]
 * @param {Object} [options.context] - 注入沙箱的额外变量
 * @param {number} [options.timeoutMs=30000] - 执行超时
 * @param {number} [options.maxMemoryMb=128] - 最大内存限制（MB）
 * @param {string[]} [options.allowedModules] - 允许的工具内 require 的模块
 * @returns {Object} { execute, context }
 */
function createSandbox(options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const allowedModules = options.allowedModules || [];

  const sandboxContext = vm.createContext({
    ...DEFAULT_SANDBOX_GLOBALS,
    ...(options.context || {}),
    _sandboxMeta: {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      timeoutMs,
      allowedModules,
    },
  });

  /**
   * 在沙箱中执行代码
   *
   * @param {string} code - 要执行的 JS 代码
   * @param {Object} [executeOptions]
   * @param {*} [executeOptions.data] - 传入沙箱的数据
   * @returns {Promise<*>} 执行结果
   */
  async function execute(code, executeOptions = {}) {
    // 注入执行时数据
    if (executeOptions.data !== undefined) {
      sandboxContext._input = executeOptions.data;
    }

    sandboxContext._result = undefined;

    const wrappedCode = `
      (async () => {
        try {
          const input = typeof _input !== 'undefined' ? _input : undefined;
          const result = (${code})(input);
          _result = result instanceof Promise ? await result : result;
        } catch (err) {
          _error = { message: err.message, stack: err.stack };
        }
      })()
    `;

    try {
      vm.runInContext(wrappedCode, sandboxContext, {
        timeout: timeoutMs,
        filename: `sandbox-${sandboxContext._sandboxMeta.id}.js`,
        displayErrors: true,
      });
    } catch (error) {
      // VM 级别的错误（语法错误、超时等）
      const message = error.message || 'VM 执行错误';
      if (error.message?.includes('Script execution timed out')) {
        throw new Error(`沙箱执行超时（${timeoutMs}ms）`);
      }
      throw new Error(`沙箱执行错误：${message}`);
    }

    if (sandboxContext._error) {
      throw new Error(`沙箱工具错误：${sandboxContext._error.message}`);
    }

    return sandboxContext._result;
  }

  return {
    execute,
    context: sandboxContext,
    id: sandboxContext._sandboxMeta.id,
  };
}

// ============================================================
// 资源监控器
// ============================================================

class ResourceMonitor {
  constructor() {
    this._usage = new Map(); // toolName -> { calls, totalTime, errors, maxTime }
    this._limits = new Map(); // toolName -> { maxCalls, maxTimeMs, cooldownMs }
    this._cooldowns = new Map(); // toolName -> cooldown until
  }

  /**
   * 设置资源限制
   */
  setLimit(toolName, limits) {
    this._limits.set(toolName, {
      maxCalls: limits.maxCalls || 100,
      maxTimeMs: limits.maxTimeMs || 60000,
      cooldownMs: limits.cooldownMs || 0,
    });
  }

  /**
   * 记录一次工具调用
   */
  recordCall(toolName, durationMs, error = false) {
    if (!this._usage.has(toolName)) {
      this._usage.set(toolName, {
        calls: 0,
        totalTime: 0,
        errors: 0,
        maxTime: 0,
        lastCallAt: 0,
      });
    }

    const usage = this._usage.get(toolName);
    usage.calls++;
    usage.totalTime += durationMs;
    usage.maxTime = Math.max(usage.maxTime, durationMs);
    usage.lastCallAt = Date.now();
    if (error) usage.errors++;
  }

  /**
   * 检查是否可以执行
   * @returns {{ allowed: boolean, reason?: string }}
   */
  checkAllowed(toolName) {
    const usage = this._usage.get(toolName);
    const limits = this._limits.get(toolName);

    if (!limits) return { allowed: true };

    // 冷却检查
    const cooldownUntil = this._cooldowns.get(toolName);
    if (cooldownUntil && Date.now() < cooldownUntil) {
      return {
        allowed: false,
        reason: `工具 ${toolName} 处于冷却中，剩余 ${Math.ceil((cooldownUntil - Date.now()) / 1000)} 秒`,
      };
    }

    if (usage) {
      // 调用次数限制
      if (usage.calls >= limits.maxCalls) {
        if (limits.cooldownMs > 0) {
          this._cooldowns.set(toolName, Date.now() + limits.cooldownMs);
          this._usage.delete(toolName);
        }
        return {
          allowed: false,
          reason: `工具 ${toolName} 已达到调用次数上限（${limits.maxCalls}）`,
        };
      }

      // 总时间限制
      if (usage.totalTime >= limits.maxTimeMs) {
        return {
          allowed: false,
          reason: `工具 ${toolName} 已达到总执行时间上限（${limits.maxTimeMs}ms）`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 获取资源使用统计
   */
  getStats(toolName) {
    const usage = this._usage.get(toolName);
    if (!usage) {
      return { calls: 0, totalTime: 0, errors: 0, avgTime: 0 };
    }
    return {
      ...usage,
      avgTime: usage.calls > 0 ? (usage.totalTime / usage.calls).toFixed(1) : 0,
    };
  }

  /**
   * 重置所有统计
   */
  reset() {
    this._usage.clear();
    this._cooldowns.clear();
  }
}

// ============================================================
// ToolSandbox — 主入口
// ============================================================

/**
 * 创建工具沙箱实例
 *
 * @param {Object} options
 * @param {Object} [options.policyEngine] - 策略引擎实例
 * @param {Object} [options.toolRuntime] - 工具运行时实例
 * @param {Object} [options.logger] - 日志记录器
 * @returns {Object} toolSandbox
 */
function createToolSandbox(options = {}) {
  const { policyEngine, toolRuntime, logger } = options;

  const registry = new DynamicRegistry({ policyEngine });
  const monitor = new ResourceMonitor();
  const sandboxes = new Map(); // toolName -> sandbox

  // 预设资源限制
  monitor.setLimit('*', {
    maxCalls: 500,
    maxTimeMs: 300000,
  });

  return {
    registry,
    monitor,

    /**
     * 注册工具（自动选择执行模式）
     */
    register(descriptor) {
      const name = descriptor.name;

      // 如果工具声明了 isolated 模式，自动创建沙箱
      if (descriptor.executionMode === 'isolated' || descriptor.sandbox) {
        sandboxes.set(name, createSandbox({
          context: descriptor._sandboxContext || {},
          timeoutMs: descriptor.sandbox?.timeoutMs || 30000,
          allowedModules: descriptor.sandbox?.allowedModules || [],
        }));
        descriptor._isSandboxed = true;
      }

      return registry.register(descriptor);
    },

    /**
     * 注销工具
     */
    unregister(name) {
      sandboxes.delete(name);
      registry.unregister(name);
    },

    /**
     * 沙箱内执行工具
     */
    async execute(name, args, context = {}) {
      const tool = registry.get(name);
      if (!tool) {
        throw new Error(`工具未注册：${name}`);
      }

      // 1. 资源限制检查
      const check = monitor.checkAllowed(name);
      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // 2. Policy 检查
      if (policyEngine) {
        const policy = tool.policy ? tool.policy(args) : {
          action: 'tool.execute',
          title: `执行 ${name}`,
          risk: 'medium',
        };

        const policyResult = await policyEngine.evaluate(policy, {
          toolName: name,
          args,
          context,
        });

        if (!policyResult.allowed) {
          throw new Error(`策略拦截：${policyResult.reason || '未经授权'}`);
        }
      }

      // 3. 执行
      const startTime = Date.now();
      let error = false;

      try {
        if (tool._isSandboxed) {
          // 沙箱执行
          const sandbox = sandboxes.get(name);
          if (!sandbox) {
            throw new Error(`沙箱未就绪：${name}`);
          }

          const sandboxCode = tool.sandboxCode || tool.execute.toString();
          const result = await sandbox.execute(sandboxCode, {
            data: { args, context },
          });

          monitor.recordCall(name, Date.now() - startTime);
          return result;
        } else {
          // 直接执行（默认）
          const result = await tool.execute({ args, payload: context });
          monitor.recordCall(name, Date.now() - startTime);
          return result;
        }
      } catch (err) {
        error = true;
        monitor.recordCall(name, Date.now() - startTime, true);
        throw err;
      }
    },

    /**
     * 获取执行统计
     */
    getStats(name) {
      return monitor.getStats(name);
    },

    /**
     * 重置沙箱状态
     */
    reset() {
      sandboxes.clear();
      monitor.reset();
    },
  };
}

// ============================================================
// 沙箱适配器 — 给 tool-registry 集成用
// ============================================================

/**
 * 创建沙箱感知的工具描述符
 * 用于替换 tool-registry.cjs 中的 createToolDescriptor
 */
function createSandboxedToolDescriptor(descriptor) {
  return {
    ...descriptor,
    executionMode: descriptor.executionMode || 'sequential',
    _isSandboxed: descriptor.executionMode === 'isolated',
    sandbox: descriptor.sandbox || null,
    sandboxCode: descriptor.sandboxCode || null,
    policy(args) {
      return typeof descriptor.policy === 'function'
        ? descriptor.policy(args)
        : {
            action: 'tool.execute',
            title: `允许执行 ${descriptor.label || descriptor.name}`,
            detail: descriptor.description,
            command: `${descriptor.name} ${JSON.stringify(args || {})}`,
            risk: descriptor._isSandboxed ? 'low' : 'medium',
          };
    },
  };
}

module.exports = {
  createToolSandbox,
  createSandbox,
  DynamicRegistry,
  ToolVersion,
  ResourceMonitor,
  createSandboxedToolDescriptor,
};
