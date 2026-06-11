const http = require("node:http");
const crypto = require("node:crypto");

const DEFAULT_PORT = 18766;
const MAX_BODY_BYTES = 1024 * 1024;

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-deepsix-channel-token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function getTextPayload(body) {
  return String(body.text || body.content || body.message || body.query || "").trim();
}

function normalizeInbound(body = {}) {
  const appId = String(body.appId || body.appid || body.channel?.appId || "wx-local-dev");
  const openId = String(body.openId || body.openid || body.userId || body.fromUser || "openid-local");
  const conversationId = String(body.conversationId || body.sessionId || body.threadId || `${appId}:${openId}`);
  const messageId = String(body.messageId || body.msgId || `wxmsg-${Date.now()}-${crypto.randomUUID()}`);
  const text = getTextPayload(body);

  return {
    text,
    appId,
    openId,
    conversationId,
    messageId,
    tenantId: String(body.tenantId || body.hotelId || body.channel?.tenantId || ""),
    pagePath: String(body.pagePath || body.path || body.channel?.pagePath || "/pages/index/index"),
    scene: String(body.scene || body.channel?.scene || "chatbox"),
    raw: body
  };
}

function normalizeAddress(rawAddress = {}) {
  return {
    name: String(rawAddress.name || rawAddress.userName || "").trim(),
    phone: String(rawAddress.phone || rawAddress.telNumber || "").trim(),
    detail: String(
      rawAddress.detail ||
      rawAddress.detailInfo ||
      `${rawAddress.provinceName || ""}${rawAddress.cityName || ""}${rawAddress.countyName || ""}${rawAddress.detailInfo || ""}`
    ).trim()
  };
}

function buildActionPayload({ inbound, actionType, apiName, apiResponse }) {
  return {
    ok: apiResponse.ok,
    channel: {
      id: "wechat-clawbot",
      type: "wechat-miniprogram-ai",
      transport: "http",
      sessionKey: inbound.conversationId
    },
    inbound,
    action: {
      type: actionType,
      apiName,
      arguments: apiResponse.arguments || null
    },
    reply: {
      text: apiResponse.card?.contentText || "卡片动作已处理。",
      primaryCard: apiResponse.card || null,
      cards: apiResponse.card?.componentPath ? [apiResponse.card] : []
    },
    apiCalls: [
      {
        apiName,
        arguments: apiResponse.arguments || null,
        ok: apiResponse.ok
      }
    ],
    toolEvents: [
      {
        label: "WeChat Card Action",
        detail: `${actionType} -> ${apiName}`
      }
    ]
  };
}

function createWechatChannelServer({ wechatAiSkillGateway, port = DEFAULT_PORT, host = "127.0.0.1", onInboundMessage } = {}) {
  if (!wechatAiSkillGateway) {
    throw new Error("wechatAiSkillGateway is required");
  }

  let server = null;
  let currentPort = port;

  async function handleMessage(request, response) {
    const body = await readRequestBody(request);
    const inbound = normalizeInbound(body);
    if (!inbound.text) {
      writeJson(response, 400, {
        ok: false,
        error: "Missing text/message/content in request body"
      });
      return;
    }

    const result = await wechatAiSkillGateway.routePrompt({
      prompt: inbound.text,
      sessionId: inbound.conversationId,
      channelContext: {
        channelId: "wechat-clawbot",
        conversationId: inbound.conversationId,
        messageId: inbound.messageId,
        senderId: inbound.openId,
        senderName: "微信客户",
        tenantId: inbound.tenantId,
        appId: inbound.appId,
        pagePath: inbound.pagePath,
        scene: inbound.scene,
        eventType: "message",
        replyStyle: "wechat-mini-program",
        metadata: {
          source: "wechat-miniapp-chatbox"
        }
      }
    });

    const payload = {
      ok: result.ok,
      channel: {
        id: "wechat-clawbot",
        type: "wechat-miniprogram-ai",
        transport: "http",
        sessionKey: inbound.conversationId
      },
      inbound,
      reply: {
        text: result.wechatReply?.text || "",
        primaryCard: result.wechatReply?.primaryCard || null,
        cards: result.wechatReply?.cards || []
      },
      gateway: result.gateway,
      apiCalls: result.apiCalls || [],
      toolEvents: result.toolEvents || []
    };

    onInboundMessage?.(payload);
    writeJson(response, 200, payload);
  }

  async function handleAction(request, response) {
    const body = await readRequestBody(request);
    const inbound = normalizeInbound(body);
    const actionType = String(body.actionType || body.action || body.apiName || "").trim();

    if (!actionType) {
      writeJson(response, 400, {
        ok: false,
        error: "Missing actionType/action/apiName in request body"
      });
      return;
    }

    let apiName = actionType;
    let args = body.arguments || body.args || {};

    if (["confirmAddress", "saveAddress", "address.confirm"].includes(actionType)) {
      apiName = "saveAddress";
      args = normalizeAddress(body.address || args.address || args);
    }

    if (["confirmOrder", "payOrder", "order.confirm", "payment.confirm"].includes(actionType)) {
      apiName = "payOrder";
      const cardOrderId = body.card?.structuredContent?.orderId;
      args = {
        ...args,
        orderId: String(body.orderId || args.orderId || cardOrderId || "").trim(),
        address: body.address || args.address
      };
    }

    const apiResponse = await wechatAiSkillGateway.callApi({
      skillRoot: body.skillRoot,
      sessionId: inbound.conversationId,
      apiName,
      arguments: args
    });
    const payload = buildActionPayload({ inbound, actionType, apiName, apiResponse });

    onInboundMessage?.(payload);
    writeJson(response, apiResponse.ok ? 200 : 422, payload);
  }

  async function requestHandler(request, response) {
    try {
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {});
        return;
      }

      const url = new URL(request.url || "/", `http://${host}:${currentPort}`);
      if (request.method === "GET" && ["/health", "/channels/wechat/health"].includes(url.pathname)) {
        writeJson(response, 200, {
          ok: true,
          service: "deepsix-wechat-channel",
          channelId: "wechat-clawbot",
          port: currentPort
        });
        return;
      }

      if (request.method === "POST" && ["/channels/wechat/messages", "/wechat/messages"].includes(url.pathname)) {
        await handleMessage(request, response);
        return;
      }

      if (request.method === "POST" && ["/channels/wechat/actions", "/wechat/actions"].includes(url.pathname)) {
        await handleAction(request, response);
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: "Not found",
        endpoints: [
          "GET /channels/wechat/health",
          "POST /channels/wechat/messages",
          "POST /channels/wechat/actions"
        ]
      });
    } catch (error) {
      writeJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Wechat channel server failed"
      });
    }
  }

  function start() {
    if (server) {
      return Promise.resolve(getStatus());
    }

    return new Promise((resolve, reject) => {
      server = http.createServer(requestHandler);
      server.once("error", (error) => {
        server = null;
        reject(error);
      });
      server.listen(currentPort, host, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          currentPort = address.port;
        }
        resolve(getStatus());
      });
    });
  }

  function stop() {
    if (!server) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }

  function getStatus() {
    return {
      running: Boolean(server),
      host,
      port: currentPort,
      baseUrl: `http://${host}:${currentPort}`,
      messageEndpoint: `http://${host}:${currentPort}/channels/wechat/messages`,
      actionEndpoint: `http://${host}:${currentPort}/channels/wechat/actions`,
      healthEndpoint: `http://${host}:${currentPort}/channels/wechat/health`
    };
  }

  return {
    start,
    stop,
    getStatus
  };
}

module.exports = {
  createWechatChannelServer
};
