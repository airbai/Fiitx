#!/usr/bin/env node

const path = require("node:path");
const { createWechatAiSkillGateway } = require("../electron/services/wechat-ai-skill-gateway.cjs");

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const skillRoot = path.join(repoRoot, "examples/wechat-ai/customer-chatbox-miniapp/skills/drink-skill");
  const gateway = createWechatAiSkillGateway({
    defaultSkillRoot: skillRoot,
    defaultSkillsRoot: path.join(repoRoot, "examples/wechat-ai/customer-chatbox-miniapp/skills")
  });

  const prompt = process.argv.slice(2).join(" ") || "第一杯美式咖啡";
  const result = await gateway.routePrompt({
    prompt,
    sessionId: "smoke-wechat-ai-gateway",
    channelContext: {
      source: "wechat-miniprogram-ai",
      conversationId: "smoke-wechat-ai-gateway",
      openId: "mock-openid",
      pagePath: "/pages/index/index"
    }
  });

  const summary = {
    ok: result.ok,
    prompt,
    gateway: result.gateway,
    skill: result.skill,
    apiCalls: result.apiCalls,
    primaryCard: {
      apiName: result.wechatReply?.primaryCard?.apiName,
      componentPath: result.wechatReply?.primaryCard?.componentPath,
      title: result.wechatReply?.primaryCard?.title,
      structuredContent: result.wechatReply?.primaryCard?.structuredContent
    },
    toolEvents: result.toolEvents
  };

  console.log(JSON.stringify(summary, null, 2));

  const primaryCard = result.wechatReply?.primaryCard;
  const hasDrinkSkill = /drink-skill/.test(result.gateway?.routerDecision?.selectedSkillRoot || "");
  const hasOrderCard = primaryCard?.componentPath === "components/order-confirm-card/index";
  const hasOrderId = Boolean(primaryCard?.structuredContent?.orderId);
  if (!result.ok || !hasDrinkSkill || !hasOrderCard || !hasOrderId) {
    throw new Error("WeChat AI Gateway smoke test failed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
