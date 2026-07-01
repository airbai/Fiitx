const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const QRCode = require("qrcode");

const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
const ILINK_BOT_TYPE = "3";
const CHANNEL_ID = "wechat-clawbot";
const LOGIN_TTL_MS = 5 * 60 * 1000;
const LOGIN_POLL_MS = 1800;
const GET_UPDATES_TIMEOUT_MS = 35_000;
const API_TIMEOUT_MS = 15_000;
const CHANNEL_VERSION = "2.4.6-fiitx";
const ILINK_APP_CLIENT_VERSION = 0x00020406;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    }, { once: true });
  });
}

function safeJsonRead(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeJsonWrite(filePath, value) {
  if (!filePath) return value;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  return value;
}

function randomWechatUin() {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf8").toString("base64");
}

function ensureTrailingSlash(value) {
  return String(value || "").endsWith("/") ? String(value) : `${String(value || "")}/`;
}

function buildBaseInfo() {
  return {
    channel_version: CHANNEL_VERSION,
    bot_agent: "Fiitx/0.1.0 OpenClaw-Compatible"
  };
}

function buildCommonHeaders(token = "") {
  const headers = {
    "Content-Type": "application/json",
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION),
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": randomWechatUin()
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${options.method || "GET"} ${url} ${response.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

async function postJson({ baseUrl, endpoint, body = {}, token = "", timeoutMs = API_TIMEOUT_MS, signal }) {
  const url = new URL(endpoint, ensureTrailingSlash(baseUrl)).toString();
  return fetchWithTimeout(url, {
    method: "POST",
    headers: buildCommonHeaders(token),
    body: JSON.stringify(body),
    signal
  }, timeoutMs);
}

async function getJson({ baseUrl, endpoint, timeoutMs = API_TIMEOUT_MS }) {
  const url = new URL(endpoint, ensureTrailingSlash(baseUrl)).toString();
  return fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "iLink-App-Id": "bot",
      "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION)
    }
  }, timeoutMs);
}

function readConfig(overrides = {}, credentialStorePath = "") {
  const saved = safeJsonRead(credentialStorePath) || {};
  return {
    accountId: String(overrides.accountId || process.env.WEIXIN_ACCOUNT_ID || saved.accountId || "").trim(),
    token: String(overrides.token || process.env.WEIXIN_BOT_TOKEN || saved.token || "").trim(),
    baseUrl: String(overrides.baseUrl || process.env.WEIXIN_BASE_URL || saved.baseUrl || ILINK_BASE_URL).trim(),
    userId: String(overrides.userId || saved.userId || "").trim(),
    userName: String(overrides.userName || process.env.WEIXIN_BOT_USER_NAME || saved.userName || "fiitx").trim(),
    botType: String(overrides.botType || process.env.WEIXIN_BOT_TYPE || saved.botType || ILINK_BOT_TYPE).trim()
  };
}

function missingConfig(config) {
  return [
    ["WEIXIN_ACCOUNT_ID", config.accountId],
    ["WEIXIN_BOT_TOKEN", config.token],
    ["WEIXIN_BASE_URL", config.baseUrl]
  ].filter(([, value]) => !value).map(([key]) => key);
}

function extractTextFromMessage(message = {}) {
  const item = (message.item_list || []).find((entry) => entry?.type === 1 && entry?.text_item?.text);
  return String(item?.text_item?.text || message.text || message.content || "").trim();
}

function compactText(value, maxLength = 1800) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 20).trim()}\n\n...已截断，完整结果请在 Fiitx 桌面端查看。`;
}

function generateClientId() {
  return `fiitx-weixin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function createQrDataUrl(payload) {
  const text = String(payload || "").trim();
  if (!text) return "";
  if (text.startsWith("data:image/")) return text;
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: {
      dark: "#111827",
      light: "#ffffff"
    }
  });
}

function createTextMessage({ to, text, contextToken, runId }) {
  return {
    msg: {
      from_user_id: "",
      to_user_id: to,
      client_id: generateClientId(),
      message_type: 2,
      message_state: 2,
      item_list: text ? [{ type: 1, text_item: { text } }] : undefined,
      context_token: contextToken || undefined,
      run_id: runId || undefined
    }
  };
}

function createChatSdkWeixinChannel({ wechatAiSkillGateway, channelGateway, credentialStorePath = "", onInboundMessage } = {}) {
  let running = false;
  let starting = false;
  let lastError = "";
  let startedAt = null;
  let lastInboundAt = null;
  let lastOutboundAt = null;
  let activeConfig = readConfig({}, credentialStorePath);
  let syncBuf = "";
  let abortController = null;
  let loginSession = null;

  function getCredential() {
    return readConfig({}, credentialStorePath);
  }

  function saveCredential(next) {
    const credential = {
      ...next,
      savedAt: nowIso(),
      source: "fiitx-ilink-login"
    };
    safeJsonWrite(credentialStorePath, credential);
    activeConfig = readConfig({}, credentialStorePath);
    return credential;
  }

  async function fetchLoginQr({ force = false } = {}) {
    if (!force && loginSession?.status === "pending" && Date.now() < Date.parse(loginSession.expiresAt || "")) {
      return loginSession;
    }
    const response = await postJson({
      baseUrl: ILINK_BASE_URL,
      endpoint: `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(ILINK_BOT_TYPE)}`,
      body: {
        local_token_list: activeConfig.token ? [activeConfig.token] : []
      },
      token: "",
      timeoutMs: API_TIMEOUT_MS
    });
    const qrcode = String(response.qrcode || "");
    const qrcodeUrl = String(response.qrcode_img_content || "");
    const qrPayload = qrcodeUrl || qrcode;
    if (!qrcode || !qrPayload) {
      throw new Error(`微信 iLink 未返回二维码：${JSON.stringify(response).slice(0, 300)}`);
    }
    const qrDataUrl = await createQrDataUrl(qrPayload);
    loginSession = {
      id: `ilink-login-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      sessionKey: crypto.randomUUID(),
      qrcode,
      bindUrl: qrcodeUrl,
      qrPayload,
      qrDataUrl,
      status: "pending",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + LOGIN_TTL_MS).toISOString(),
      message: "用手机微信扫描二维码，以连接 Fiitx 微信 ClawBot。"
    };
    pollLoginSession().catch((error) => {
      lastError = error instanceof Error ? error.message : String(error);
    });
    return loginSession;
  }

  async function pollLoginSession() {
    const session = loginSession;
    if (!session || session.polling) return;
    session.polling = true;
    while (loginSession === session && session.status === "pending" && Date.now() < Date.parse(session.expiresAt)) {
      const response = await getJson({
        baseUrl: ILINK_BASE_URL,
        endpoint: `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(session.qrcode)}`,
        timeoutMs: 35_000
      }).catch((error) => {
        if (error?.name === "AbortError") return { status: "wait" };
        throw error;
      });
      const status = String(response.status || "wait");
      session.lastStatus = status;
      if (status === "scaned") {
        session.message = "已扫码，等待微信确认。";
      } else if (status === "expired") {
        session.status = "expired";
        session.message = "二维码已过期，请重新开始扫码。";
        break;
      } else if (status === "binded_redirect") {
        session.status = "bound";
        session.message = "微信 ClawBot 已连接过，请直接启动通道。";
        break;
      } else if (status === "confirmed") {
        const token = String(response.bot_token || "");
        const accountId = String(response.ilink_bot_id || "");
        const baseUrl = String(response.baseurl || ILINK_BASE_URL);
        if (!token || !accountId) {
          throw new Error("微信 iLink 确认成功但未返回 bot_token 或 accountId");
        }
        const credential = saveCredential({
          accountId,
          token,
          baseUrl,
          userId: String(response.ilink_user_id || ""),
          userName: "fiitx",
          botType: ILINK_BOT_TYPE
        });
        session.status = "bound";
        session.message = "Fiitx 微信 ClawBot 已连接。";
        session.binding = {
          bound: true,
          channelId: CHANNEL_ID,
          accountId: credential.accountId,
          displayName: "微信 ClawBot",
          openId: credential.userId,
          boundAt: credential.savedAt,
          endpoint: credential.baseUrl
        };
        await start();
        break;
      }
      await sleep(LOGIN_POLL_MS);
    }
    if (loginSession === session && session.status === "pending") {
      session.status = "expired";
      session.message = "二维码已过期，请重新开始扫码。";
    }
    session.polling = false;
  }

  function getBindingStatus() {
    const credential = getCredential();
    const bound = Boolean(credential.accountId && credential.token && credential.baseUrl);
    return {
      ok: true,
      channelId: CHANNEL_ID,
      bound,
      status: bound ? (running ? "polling" : "bound") : loginSession?.status || "idle",
      binding: bound ? {
        bound: true,
        channelId: CHANNEL_ID,
        accountId: credential.accountId,
        displayName: "微信 ClawBot",
        openId: credential.userId || "",
        boundAt: credential.savedAt || "",
        lastSeenAt: lastInboundAt || credential.savedAt || "",
        endpoint: credential.baseUrl
      } : null,
      session: loginSession,
      localBaseUrl: credential.baseUrl || ILINK_BASE_URL,
      lanBaseUrl: credential.baseUrl || ILINK_BASE_URL,
      running,
      lastInboundAt,
      lastOutboundAt,
      lastError
    };
  }

  async function startLoginSession(options = {}) {
    lastError = "";
    try {
      const session = await fetchLoginQr({ force: options.force !== false });
      return getBindingStatus();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return getBindingStatus();
    }
  }

  function cancelLoginSession() {
    if (loginSession?.status === "pending") {
      loginSession = {
        ...loginSession,
        status: "cancelled",
        message: "已取消扫码。"
      };
    }
    return getBindingStatus();
  }

  async function notifyStart() {
    await postJson({
      baseUrl: activeConfig.baseUrl,
      endpoint: "ilink/bot/msg/notifystart",
      body: { base_info: buildBaseInfo() },
      token: activeConfig.token,
      timeoutMs: API_TIMEOUT_MS
    }).catch((error) => {
      lastError = `notifyStart: ${error instanceof Error ? error.message : String(error)}`;
    });
  }

  async function notifyStop() {
    if (!activeConfig.token) return;
    await postJson({
      baseUrl: activeConfig.baseUrl,
      endpoint: "ilink/bot/msg/notifystop",
      body: { base_info: buildBaseInfo() },
      token: activeConfig.token,
      timeoutMs: API_TIMEOUT_MS
    }).catch(() => {});
  }

  async function sendReply(to, text, message = {}) {
    if (!to || !text) return;
    await postJson({
      baseUrl: activeConfig.baseUrl,
      endpoint: "ilink/bot/sendmessage",
      body: {
        ...createTextMessage({
          to,
          text: compactText(text),
          contextToken: message.context_token,
          runId: message.run_id
        }),
        base_info: buildBaseInfo()
      },
      token: activeConfig.token,
      timeoutMs: API_TIMEOUT_MS
    });
    lastOutboundAt = nowIso();
  }

  async function handleMessage(message = {}) {
    const text = extractTextFromMessage(message);
    const fromUserId = String(message.from_user_id || "");
    const conversationId = String(message.session_id || message.group_id || fromUserId || `weixin-${Date.now()}`);
    if (!text || !fromUserId) return;
    lastInboundAt = nowIso();

    const result = channelGateway?.routeInbound
      ? await channelGateway.routeInbound({
          channelId: CHANNEL_ID,
          transport: "weixin-ilink-long-poll",
          source: "openclaw-weixin-compatible",
          eventType: "direct_message",
          inbound: {
            text,
            conversationId,
            messageId: String(message.message_id || `weixin-ilink-${Date.now()}`),
            openId: fromUserId,
            senderId: fromUserId,
            senderName: "微信用户",
            appId: activeConfig.accountId,
            scene: "weixin-clawbot",
            raw: message
          }
        })
      : await wechatAiSkillGateway.routePrompt({
          prompt: text,
          sessionId: conversationId,
          channelContext: {
            channelId: CHANNEL_ID,
            conversationId,
            messageId: String(message.message_id || `weixin-ilink-${Date.now()}`),
            senderId: fromUserId,
            senderName: "微信用户",
            tenantId: "",
            appId: activeConfig.accountId,
            pagePath: "",
            scene: "weixin-clawbot",
            eventType: "direct_message",
            replyStyle: "wechat-mini-program",
            metadata: {
              source: "openclaw-weixin-compatible",
              messageType: message.message_type || ""
            }
          }
        });

    const replyText = result?.wechatReply?.text || result?.reply?.text || result?.summary || result?.content || result?.text || "已处理。";
    await sendReply(fromUserId, replyText, message);
    onInboundMessage?.({
      ok: Boolean(result?.ok ?? true),
      channel: {
        id: CHANNEL_ID,
        type: "wechat-miniprogram-ai",
        transport: "weixin-ilink-long-poll",
        sessionKey: conversationId
      },
      inbound: {
        text,
        conversationId,
        messageId: String(message.message_id || ""),
        openId: fromUserId,
        appId: activeConfig.accountId,
        raw: message
      },
      reply: {
        text: replyText,
        primaryCard: result?.wechatReply?.primaryCard || result?.reply?.primaryCard || null,
        cards: result?.wechatReply?.cards || result?.reply?.cards || []
      },
      gateway: result?.gateway || null,
      delivery: result?.delivery || null,
      approvalRequests: Array.isArray(result?.approvalRequests) ? result.approvalRequests : [],
      approvalResumePayload: result?.approvalResumePayload || null,
      apiCalls: result?.apiCalls || [],
      toolEvents: result?.toolEvents || []
    });
  }

  async function pollLoop(signal) {
    await notifyStart();
    while (!signal.aborted) {
      try {
        const response = await postJson({
          baseUrl: activeConfig.baseUrl,
          endpoint: "ilink/bot/getupdates",
          body: {
            get_updates_buf: syncBuf || "",
            base_info: buildBaseInfo()
          },
          token: activeConfig.token,
          timeoutMs: GET_UPDATES_TIMEOUT_MS,
          signal
        });
        if (response.get_updates_buf) {
          syncBuf = response.get_updates_buf;
        }
        const apiError = (response.ret !== undefined && response.ret !== 0) || (response.errcode !== undefined && response.errcode !== 0);
        if (apiError) {
          lastError = `getupdates ret=${response.ret ?? ""} errcode=${response.errcode ?? ""} ${response.errmsg || ""}`.trim();
          await sleep(3000, signal);
          continue;
        }
        for (const message of response.msgs || []) {
          await handleMessage(message);
        }
      } catch (error) {
        if (signal.aborted) return;
        lastError = error instanceof Error ? error.message : String(error);
        await sleep(3000, signal);
      }
    }
  }

  async function start(overrides = {}) {
    if (running || starting) {
      return getStatus();
    }
    if (!channelGateway?.routeInbound && !wechatAiSkillGateway?.routePrompt) {
      lastError = "channelGateway or wechatAiSkillGateway is not available";
      return getStatus();
    }

    starting = true;
    lastError = "";
    activeConfig = readConfig(overrides, credentialStorePath);
    const missing = missingConfig(activeConfig);
    if (missing.length > 0) {
      starting = false;
      return getStatus();
    }

    abortController = new AbortController();
    running = true;
    startedAt = Date.now();
    starting = false;
    pollLoop(abortController.signal).catch((error) => {
      if (!abortController?.signal.aborted) {
        lastError = error instanceof Error ? error.message : String(error);
        running = false;
      }
    });
    return getStatus();
  }

  async function stop() {
    const controller = abortController;
    abortController = null;
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    await notifyStop();
    running = false;
    starting = false;
    return getStatus();
  }

  function getStatus() {
    const binding = getBindingStatus();
    const missing = missingConfig(activeConfig);
    return {
      channelId: "wechat-ilink",
      configured: missing.length === 0,
      missing,
      running,
      starting,
      startedAt,
      accountId: activeConfig.accountId,
      baseUrl: activeConfig.baseUrl,
      userName: activeConfig.userName,
      binding,
      lastInboundAt,
      lastOutboundAt,
      lastError
    };
  }

  return {
    cancelLoginSession,
    getBindingStatus,
    getStatus,
    start,
    startLoginSession,
    stop
  };
}

module.exports = {
  createChatSdkWeixinChannel
};
