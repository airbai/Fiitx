#!/usr/bin/env node

const path = require("node:path");
const { createWechatAiSkillGateway } = require("../electron/services/wechat-ai-skill-gateway.cjs");
const { createWechatChannelServer } = require("../electron/services/wechat-channel-server.cjs");

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const skillRoot = path.join(repoRoot, "examples/wechat-ai/customer-chatbox-miniapp/skills/drink-skill");
  const gateway = createWechatAiSkillGateway({
    defaultSkillRoot: skillRoot,
    defaultSkillsRoot: path.join(repoRoot, "examples/wechat-ai/customer-chatbox-miniapp/skills")
  });
  const inboundEvents = [];
  const server = createWechatChannelServer({
    wechatAiSkillGateway: gateway,
    port: 0,
    onInboundMessage: (event) => inboundEvents.push(event)
  });

  try {
    const status = await server.start();
    const response = await fetch(status.messageEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        text: "第一杯美式咖啡",
        appId: "wx-smoke-miniapp",
        openId: "openid-smoke-user",
        conversationId: "smoke-wechat-channel",
        pagePath: "/pages/index/index",
        scene: "customer-chatbox"
      })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    const primaryCard = data.reply?.primaryCard;
    if (!response.ok || !data.ok || primaryCard?.componentPath !== "components/order-confirm-card/index") {
      throw new Error("Wechat channel server smoke test failed");
    }
    if (inboundEvents.length !== 1) {
      throw new Error(`Expected 1 inbound event, got ${inboundEvents.length}`);
    }

    const actionResponse = await fetch(`${status.baseUrl}/channels/wechat/actions`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        actionType: "confirmAddress",
        appId: "wx-smoke-miniapp",
        openId: "openid-smoke-user",
        conversationId: "smoke-wechat-channel",
        pagePath: "/pages/index/index",
        scene: "customer-chatbox",
        address: {
          name: "测试用户",
          phone: "13581680620",
          detail: "北京市海淀区清华同方大厦D座"
        }
      })
    });
    const actionData = await actionResponse.json();
    console.log(JSON.stringify(actionData, null, 2));

    if (
      !actionResponse.ok ||
      !actionData.ok ||
      actionData.reply?.primaryCard?.structuredContent?.status !== "confirmed"
    ) {
      throw new Error("Wechat channel address action smoke test failed");
    }

    const payResponse = await fetch(`${status.baseUrl}/channels/wechat/actions`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        actionType: "confirmOrder",
        appId: "wx-smoke-miniapp",
        openId: "openid-smoke-user",
        conversationId: "smoke-wechat-channel",
        pagePath: "/pages/index/index",
        scene: "customer-chatbox",
        orderId: actionData.reply?.primaryCard?.structuredContent?.orderId
      })
    });
    const payData = await payResponse.json();
    console.log(JSON.stringify(payData, null, 2));

    if (
      !payResponse.ok ||
      !payData.ok ||
      payData.reply?.primaryCard?.structuredContent?.status !== "paid" ||
      payData.reply?.primaryCard?.componentPath !== "components/pay-success-card/index"
    ) {
      throw new Error("Wechat channel payment action smoke test failed");
    }
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
