const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const QRCode = require("qrcode");

const DEFAULT_PORT = 18766;
const MAX_BODY_BYTES = 1024 * 1024;
const BIND_TTL_MS = 5 * 60 * 1000;

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

function writeHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(html);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && entry.address) {
        return entry.address;
      }
    }
  }
  return "127.0.0.1";
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

function createWechatChannelServer({ wechatAiSkillGateway, channelGateway, port = DEFAULT_PORT, host = "127.0.0.1", bindingStorePath = "", onInboundMessage } = {}) {
  if (!wechatAiSkillGateway && !channelGateway) {
    throw new Error("wechatAiSkillGateway or channelGateway is required");
  }

  let server = null;
  let currentPort = port;
  let activeBindSession = null;

  function getLocalHost() {
    return host === "0.0.0.0" ? "127.0.0.1" : host;
  }

  function getLocalBaseUrl() {
    return `http://${getLocalHost()}:${currentPort}`;
  }

  function getLanBaseUrl() {
    const lanHost = host === "127.0.0.1" ? "127.0.0.1" : firstLanAddress();
    return `http://${lanHost}:${currentPort}`;
  }

  function readBinding() {
    if (!bindingStorePath || !fs.existsSync(bindingStorePath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(bindingStorePath, "utf8"));
    } catch {
      return null;
    }
  }

  function writeBinding(binding) {
    if (!bindingStorePath) {
      return binding;
    }
    fs.mkdirSync(path.dirname(bindingStorePath), { recursive: true });
    fs.writeFileSync(bindingStorePath, JSON.stringify(binding, null, 2));
    return binding;
  }

  function clearExpiredBindSession() {
    if (activeBindSession && Date.now() > Date.parse(activeBindSession.expiresAt)) {
      activeBindSession = {
        ...activeBindSession,
        status: "expired"
      };
    }
  }

  function getBindingStatus() {
    clearExpiredBindSession();
    const binding = readBinding();
    return {
      ok: true,
      channelId: "wechat-clawbot",
      bound: Boolean(binding?.bound),
      binding: binding?.bound ? binding : null,
      session: activeBindSession,
      status: binding?.bound ? "bound" : activeBindSession?.status || "idle",
      localBaseUrl: getLocalBaseUrl(),
      lanBaseUrl: getLanBaseUrl()
    };
  }

  async function startBindSession(options = {}) {
    await start();
    const sessionId = `wxbind-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const token = crypto.randomBytes(24).toString("base64url");
    const now = Date.now();
    const bindUrl = `${getLanBaseUrl()}/channels/wechat/bind/confirm?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(bindUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 260,
      color: {
        dark: "#111827",
        light: "#ffffff"
      }
    });
    activeBindSession = {
      id: sessionId,
      token,
      status: "pending",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + BIND_TTL_MS).toISOString(),
      bindUrl,
      qrDataUrl,
      instructions: [
        "在微信中扫描二维码。",
        "微信打开确认页后会自动绑定当前 Fiitx runtime。",
        "绑定后微信消息进入 ChannelGateway，再进入 Agent Runtime、Policy、SessionDB 和 Delivery Queue。"
      ],
      metadata: {
        requestedBy: options.requestedBy || "Fiitx Settings",
        source: "channels-settings"
      }
    };
    return getBindingStatus();
  }

  function cancelBindSession() {
    if (activeBindSession && activeBindSession.status === "pending") {
      activeBindSession = {
        ...activeBindSession,
        status: "cancelled"
      };
    }
    return getBindingStatus();
  }

  function confirmBindSession(url, request) {
    clearExpiredBindSession();
    const sessionId = url.searchParams.get("sessionId") || "";
    const token = url.searchParams.get("token") || "";
    if (!activeBindSession || activeBindSession.status !== "pending") {
      return {
        ok: false,
        status: "invalid",
        message: "绑定会话不存在或已过期，请回到 Fiitx 重新开始扫码。"
      };
    }
    if (sessionId !== activeBindSession.id || token !== activeBindSession.token) {
      return {
        ok: false,
        status: "invalid",
        message: "绑定 token 无效，请回到 Fiitx 重新开始扫码。"
      };
    }

    const now = new Date().toISOString();
    const binding = writeBinding({
      bound: true,
      channelId: "wechat-clawbot",
      accountId: `wechat-local-${sessionId.slice(-8)}`,
      displayName: "微信 ClawBot",
      openId: `scan-${sessionId.slice(-8)}`,
      userAgent: String(request.headers["user-agent"] || ""),
      boundAt: now,
      lastSeenAt: now,
      sessionId,
      endpoint: getLanBaseUrl()
    });
    activeBindSession = {
      ...activeBindSession,
      status: "bound",
      confirmedAt: now,
      binding
    };
    return {
      ok: true,
      status: "bound",
      message: "Fiitx 微信 ClawBot 已绑定。",
      binding
    };
  }

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

    const payload = channelGateway
      ? await channelGateway.routeInbound({
          channelId: "wechat-clawbot",
          transport: "http",
          source: "wechat-miniapp-chatbox",
          inbound
        })
      : await routeWechatSkillPrompt(inbound);

    onInboundMessage?.(payload);
    writeJson(response, 200, payload);
  }

  async function routeWechatSkillPrompt(inbound) {
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

    return {
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
          port: currentPort,
          gateway: channelGateway ? "Fiitx ChannelGateway" : "WechatAiSkillGateway",
          binding: getBindingStatus()
        });
        return;
      }

      if (request.method === "GET" && ["/channels/wechat/bind/status", "/wechat/bind/status"].includes(url.pathname)) {
        writeJson(response, 200, getBindingStatus());
        return;
      }

      if (request.method === "GET" && ["/channels/wechat/bind/confirm", "/wechat/bind/confirm"].includes(url.pathname)) {
        const result = confirmBindSession(url, request);
        writeHtml(response, result.ok ? 200 : 410, `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fiitx 微信 ClawBot 绑定</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: #f9fafb; }
    main { width: min(420px, calc(100vw - 40px)); padding: 32px; border-radius: 20px; background: #1f2937; box-shadow: 0 20px 80px rgba(0,0,0,.35); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { line-height: 1.7; color: #cbd5e1; }
    .ok { color: #34d399; }
    .bad { color: #fbbf24; }
    code { color: #93c5fd; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1 class="${result.ok ? "ok" : "bad"}">${escapeHtml(result.ok ? "绑定成功" : "绑定未完成")}</h1>
    <p>${escapeHtml(result.message)}</p>
    ${result.ok ? `<p>现在可以回到 Fiitx，微信 ClawBot 会显示为已绑定。</p><p><code>${escapeHtml(result.binding?.endpoint || "")}</code></p>` : "<p>请回到 Fiitx Channels 页面重新开始扫码。</p>"}
  </main>
</body>
</html>`);
        return;
      }

      if (request.method === "POST" && ["/channels/wechat/bind/start", "/wechat/bind/start"].includes(url.pathname)) {
        const body = await readRequestBody(request);
        writeJson(response, 200, await startBindSession(body));
        return;
      }

      if (request.method === "POST" && ["/channels/wechat/bind/cancel", "/wechat/bind/cancel"].includes(url.pathname)) {
        writeJson(response, 200, cancelBindSession());
        return;
      }

      if (request.method === "GET" && ["/channels/wechat/deliveries", "/wechat/deliveries"].includes(url.pathname)) {
        writeJson(response, 200, {
          ok: true,
          deliveries: channelGateway?.listDeliveries?.({
            channelId: "wechat-clawbot",
            conversationId: url.searchParams.get("conversationId") || ""
          }) || []
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
          "POST /channels/wechat/bind/start",
          "GET /channels/wechat/bind/status",
          "GET /channels/wechat/bind/confirm",
          "POST /channels/wechat/messages",
          "POST /channels/wechat/actions",
          "GET /channels/wechat/deliveries"
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
    const localBaseUrl = getLocalBaseUrl();
    const lanBaseUrl = getLanBaseUrl();
    return {
      running: Boolean(server),
      host,
      port: currentPort,
      baseUrl: localBaseUrl,
      lanBaseUrl,
      messageEndpoint: `${localBaseUrl}/channels/wechat/messages`,
      actionEndpoint: `${localBaseUrl}/channels/wechat/actions`,
      healthEndpoint: `${localBaseUrl}/channels/wechat/health`,
      deliveryEndpoint: `${localBaseUrl}/channels/wechat/deliveries`,
      bindStartEndpoint: `${localBaseUrl}/channels/wechat/bind/start`,
      bindStatusEndpoint: `${localBaseUrl}/channels/wechat/bind/status`,
      bindConfirmEndpoint: `${lanBaseUrl}/channels/wechat/bind/confirm`,
      binding: getBindingStatus()
    };
  }

  return {
    cancelBindSession,
    getBindingStatus,
    start,
    startBindSession,
    stop,
    getStatus
  };
}

module.exports = {
  createWechatChannelServer
};
