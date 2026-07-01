const contentQuestionSignals = ["解释", "总结", "阅读", "这篇文章", "这个链接", "这个网页", "文档", "网页", "文章", "讲一下", "分析", "是什么", "为什么", "怎么做", "说明"];
const systemActionSignals = ["配置", "设置", "新增", "添加", "保存", "更新", "删除", "测试", "切换", "启用", "禁用", "安装", "卸载", "批准", "同意", "拒绝", "审批"];
const modelConfigSignals = ["api key", "apikey", "base url", "base_url", "provider", "profile", "模型 profile", "模型profile", "模型配置", "maas", "openai-compatible", "openai compatible"];
const channelConfigSignals = ["channel", "通道", "微信", "clawbot", "wecom", "whatsapp", "slack", "telegram"];
const skillConfigSignals = ["skill", "技能"];
const mcpConfigSignals = ["mcp", "mcp server", "mcp服务器", "mcp server"];

function includesAny(text, signals) {
  return signals.some((signal) => text.includes(signal.toLowerCase()));
}

function hasAnyRegex(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function detectSystemIntent({ promptWithoutUrls, hasUrl }) {
  const hasSystemAction = includesAny(promptWithoutUrls, systemActionSignals);
  const hasContentQuestion = includesAny(promptWithoutUrls, contentQuestionSignals);
  const explicitModelConfig =
    hasSystemAction &&
    includesAny(promptWithoutUrls, modelConfigSignals) &&
    !(
      hasUrl &&
      hasContentQuestion &&
      !hasAnyRegex(promptWithoutUrls, [
        /配置.*(api key|apikey|base url|base_url|模型|model|provider|profile|maas)/i,
        /(保存|新增|添加|更新|测试).*(api key|apikey|base url|base_url|模型|model|provider|profile|maas)/i
      ])
    );
  const explicitChannelConfig =
    hasSystemAction &&
    includesAny(promptWithoutUrls, channelConfigSignals) &&
    hasAnyRegex(promptWithoutUrls, [/切换.*(通道|channel)/i, /(设置|配置|启用|禁用).*(通道|channel|clawbot|微信|wecom|whatsapp)/i]);
  const explicitSkillConfig =
    hasSystemAction &&
    includesAny(promptWithoutUrls, skillConfigSignals) &&
    hasAnyRegex(promptWithoutUrls, [/(安装|卸载|启用|禁用|添加).*(skill|技能)/i]);
  const explicitMcpConfig =
    hasSystemAction &&
    includesAny(promptWithoutUrls, mcpConfigSignals) &&
    hasAnyRegex(promptWithoutUrls, [/(安装|卸载|启用|禁用|添加|配置).*(mcp|server|服务器)/i]);
  const explicitApproval =
    hasAnyRegex(promptWithoutUrls, [/^(同意|批准|拒绝|审批|允许)\b/i, /(同意|批准|拒绝|允许).*(审批|权限|执行|读取|写入)/i]);

  if (explicitModelConfig) {
    return {
      namespace: "system.model.configure",
      action: "configure-model-profile",
      confidence: 0.92,
      reason: "明确出现模型配置动作和模型配置字段"
    };
  }
  if (explicitChannelConfig) {
    return {
      namespace: "system.channel.configure",
      action: "configure-channel",
      confidence: 0.88,
      reason: "明确出现 Channel/通道配置动作"
    };
  }
  if (explicitSkillConfig) {
    return {
      namespace: "system.skill.configure",
      action: "configure-skill",
      confidence: 0.88,
      reason: "明确出现 Skill 安装或启停动作"
    };
  }
  if (explicitMcpConfig) {
    return {
      namespace: "system.mcp.configure",
      action: "configure-mcp",
      confidence: 0.88,
      reason: "明确出现 MCP 配置动作"
    };
  }
  if (explicitApproval) {
    return {
      namespace: "system.approval.respond",
      action: "respond-approval",
      confidence: 0.86,
      reason: "明确出现审批响应动作"
    };
  }

  return {
    namespace: "none",
    action: "none",
    confidence: 0,
    reason: hasUrl && hasContentQuestion ? "URL 被视为用户内容，不触发系统配置" : ""
  };
}

module.exports = {
  detectSystemIntent
};
