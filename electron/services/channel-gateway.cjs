const crypto = require("node:crypto");

function safeId(value, fallback = "local") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function mobileText(value, maxLength = 1800) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 20).trim()}\n\n...已截断，完整结果请在 Fiitx 桌面端查看。`;
}

function normalizeInbound(envelope = {}) {
  const inbound = envelope.inbound && typeof envelope.inbound === "object" ? envelope.inbound : envelope;
  const channelId = String(envelope.channelId || inbound.channelId || "wechat-clawbot").trim();
  const conversationId = String(inbound.conversationId || inbound.sessionId || inbound.threadId || `${channelId}:local`).trim();
  const messageId = String(inbound.messageId || inbound.msgId || `channel-msg-${Date.now()}-${crypto.randomUUID()}`).trim();
  const senderId = String(inbound.openId || inbound.senderId || inbound.userId || inbound.fromUser || "channel-user").trim();
  const text = String(inbound.text || inbound.content || inbound.message || inbound.query || "").trim();

  return {
    ...inbound,
    text,
    channelId,
    conversationId,
    messageId,
    senderId,
    openId: String(inbound.openId || inbound.openid || senderId).trim(),
    senderName: String(inbound.senderName || inbound.userName || inbound.nickname || (channelId.includes("wechat") ? "微信用户" : "Channel 用户")).trim(),
    appId: String(inbound.appId || inbound.appid || inbound.channel?.appId || "").trim(),
    tenantId: String(inbound.tenantId || inbound.hotelId || inbound.channel?.tenantId || "").trim(),
    pagePath: String(inbound.pagePath || inbound.path || inbound.channel?.pagePath || "").trim(),
    scene: String(inbound.scene || inbound.channel?.scene || envelope.scene || "message").trim(),
    raw: inbound.raw || inbound
  };
}

function buildThreadId(inbound) {
  const channelPrefix = inbound.channelId === "wechat-clawbot" || inbound.channelId === "wechat-ilink"
    ? "thread-wechat"
    : `thread-channel-${safeId(inbound.channelId)}`;
  return `${channelPrefix}-${safeId(inbound.conversationId)}`;
}

function createDeliveryQueue(limit = 100) {
  const deliveries = [];

  function push(delivery) {
    deliveries.push(delivery);
    while (deliveries.length > limit) {
      deliveries.shift();
    }
    return delivery;
  }

  function list(filter = {}) {
    const conversationId = filter.conversationId ? String(filter.conversationId) : "";
    const channelId = filter.channelId ? String(filter.channelId) : "";
    return deliveries.filter((delivery) => {
      if (conversationId && delivery.conversationId !== conversationId) return false;
      if (channelId && delivery.channelId !== channelId) return false;
      return true;
    });
  }

  function latest(filter = {}) {
    return list(filter).at(-1) || null;
  }

  return {
    push,
    list,
    latest
  };
}

function createChannelGateway({
  runAgentTask,
  sessionLogStore,
  workspaceManager,
  defaultModel = "auto",
  defaultPermissionMode = "ask",
  getWorkspacePath,
  getAgentRegistry,
  getChannelRegistry,
  getPolicySettings,
  onDelivery
} = {}) {
  if (typeof runAgentTask !== "function") {
    throw new Error("ChannelGateway requires runAgentTask");
  }

  const deliveryQueue = createDeliveryQueue();

  function resolveWorkspacePath(envelope = {}) {
    if (envelope.workspacePath) return envelope.workspacePath;
    const loaded = typeof getWorkspacePath === "function" ? getWorkspacePath(envelope) : "";
    if (loaded) return loaded;
    return workspaceManager?.getFallbackRoot?.() || "";
  }

  function resolvePolicySettings(envelope = {}) {
    if (envelope.policySettings && typeof envelope.policySettings === "object") {
      return {
        source: "envelope",
        value: envelope.policySettings
      };
    }

    const loaded = typeof getPolicySettings === "function" ? getPolicySettings(envelope) : null;
    if (loaded && typeof loaded === "object") {
      return {
        source: "live-store",
        value: loaded
      };
    }

    return {
      source: "default",
      value: undefined
    };
  }

  function resolvePermissionMode(envelope = {}, policySettings) {
    return envelope.permissionMode || policySettings?.defaultPermissionMode || defaultPermissionMode;
  }

  function readContextMessages(threadId) {
    const entries = sessionLogStore?.replay?.(threadId) || [];
    return entries
      .filter((entry) => entry.role === "user" || entry.role === "assistant")
      .slice(-10)
      .map((entry) => ({
        role: entry.role,
        content: String(entry.content || entry.summary || ""),
        time: entry.createdAt
      }))
      .filter((entry) => entry.content);
  }

  function appendSession(threadId, entry) {
    try {
      return sessionLogStore?.append?.(threadId, entry);
    } catch {
      return null;
    }
  }

  function buildReply(result, errorMessage = "") {
    const primaryCard = result?.wechatReply?.primaryCard || null;
    const cards = Array.isArray(result?.wechatReply?.cards) ? result.wechatReply.cards : primaryCard ? [primaryCard] : [];
    const text = result?.wechatReply?.text || result?.summary || result?.text || errorMessage || "已处理。";
    return {
      text: mobileText(text),
      primaryCard,
      cards
    };
  }

  function emitDelivery(delivery) {
    deliveryQueue.push(delivery);
    onDelivery?.(delivery);
    return delivery;
  }

  async function routeInbound(envelope = {}) {
    const inbound = normalizeInbound(envelope);
    if (!inbound.text) {
      throw new Error("ChannelGateway inbound text is required");
    }

    const threadId = envelope.threadId || buildThreadId(inbound);
    const taskId = envelope.taskId || `channel-${safeId(inbound.channelId)}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const deliveryId = `delivery-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const progressEvents = [];
    const startedAt = nowIso();
    const channelContext = {
      channelId: inbound.channelId,
      conversationId: inbound.conversationId,
      messageId: inbound.messageId,
      senderId: inbound.senderId,
      senderName: inbound.senderName,
      tenantId: inbound.tenantId,
      appId: inbound.appId,
      pagePath: inbound.pagePath,
      scene: inbound.scene,
      eventType: envelope.eventType || "message",
      replyStyle: envelope.replyStyle || "wechat-mini-program",
      metadata: {
        source: envelope.source || inbound.raw?.source || "channel-gateway",
        transport: envelope.transport || "http",
        deliveryId
      }
    };
    const resolvedPolicy = resolvePolicySettings(envelope);
    const resolvedPermissionMode = resolvePermissionMode(envelope, resolvedPolicy.value);

    appendSession(threadId, {
      type: "channel_inbound",
      role: "user",
      channelId: inbound.channelId,
      content: inbound.text,
      metadata: {
        inbound,
        channelContext,
        deliveryId,
        taskId
      }
    });

    const taskPayload = {
      taskId,
      prompt: inbound.text,
      workspacePath: resolveWorkspacePath(envelope),
      model: envelope.model || defaultModel,
      permissionMode: resolvedPermissionMode,
      policySettings: resolvedPolicy.value,
      attachments: Array.isArray(envelope.attachments) ? envelope.attachments : [],
      threadId,
      currentDate: envelope.currentDate || new Date().toLocaleString("zh-CN", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: envelope.timeZone || "Asia/Shanghai"
      }),
      timeZone: envelope.timeZone || "Asia/Shanghai",
      wechatSkillRoot: envelope.wechatSkillRoot,
      wechatSkillsRoot: envelope.wechatSkillsRoot,
      channelId: inbound.channelId,
      channelContext,
      agentRegistry: typeof getAgentRegistry === "function" ? getAgentRegistry(envelope) : envelope.agentRegistry,
      channelRegistry: typeof getChannelRegistry === "function" ? getChannelRegistry(envelope) : envelope.channelRegistry,
      contextMessages: envelope.contextMessages || readContextMessages(threadId),
      threadContext: envelope.threadContext
    };
    taskPayload.channelContext.metadata.policySource = resolvedPolicy.source;
    taskPayload.channelContext.metadata.permissionMode = resolvedPermissionMode;

    const emitProgress = (progress = {}) => {
      const event = {
        id: progress.id || `channel-progress-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        taskId,
        threadId,
        time: nowIso(),
        status: progress.status || "running",
        ...progress
      };
      progressEvents.push(event);
      appendSession(threadId, {
        type: "channel_progress",
        role: "system",
        channelId: inbound.channelId,
        content: event.detail || event.title || event.status,
        metadata: {
          deliveryId,
          progress: event
        }
      });
    };

    try {
      const result = await runAgentTask(taskPayload, emitProgress);
      const reply = buildReply(result);
      const approvalRequests = Array.isArray(result?.approvalRequests) ? result.approvalRequests : [];
      const approvalResumePayload = approvalRequests.length
        ? {
            ...taskPayload,
            permissionMode: "auto"
          }
        : null;
      const delivery = emitDelivery({
        id: deliveryId,
        status: result?.ok === false ? "warn" : "done",
        channelId: inbound.channelId,
        conversationId: inbound.conversationId,
        threadId,
        taskId,
        startedAt,
        finishedAt: nowIso(),
        inbound,
        reply,
        progressEvents,
        result,
        approvalRequests
      });

      appendSession(threadId, {
        type: "channel_delivery",
        role: "assistant",
        channelId: inbound.channelId,
        content: reply.text,
        metadata: {
          deliveryId,
          ok: result?.ok !== false,
          result: {
            mode: result?.mode,
            model: result?.model,
            provider: result?.provider,
            title: result?.title,
            artifact: result?.artifact || null,
            approvalRequests
          }
        }
      });

      return {
        ok: result?.ok !== false,
        channel: {
          id: inbound.channelId,
          type: "wechat-miniprogram-ai",
          transport: envelope.transport || "channel-gateway",
          sessionKey: inbound.conversationId
        },
        inbound,
        reply,
        gateway: {
          name: "Fiitx ChannelGateway",
          role: "runtime-channel-gateway",
          route: "agentRuntime.runAgentTask",
          threadId,
          taskId,
          deliveryId
        },
        delivery,
        approvalRequests,
        approvalResumePayload,
        apiCalls: result?.apiCalls || [],
        toolEvents: result?.toolEvents || [],
        artifact: result?.artifact || null,
        result: {
          mode: result?.mode,
          model: result?.model,
          provider: result?.provider,
          title: result?.title,
          summary: result?.summary || ""
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fiitx ChannelGateway 执行失败";
      const reply = buildReply(null, `Fiitx Channel 执行失败：${errorMessage}`);
      const delivery = emitDelivery({
        id: deliveryId,
        status: "error",
        channelId: inbound.channelId,
        conversationId: inbound.conversationId,
        threadId,
        taskId,
        startedAt,
        finishedAt: nowIso(),
        inbound,
        reply,
        progressEvents,
        error: errorMessage
      });

      appendSession(threadId, {
        type: "channel_delivery_error",
        role: "assistant",
        channelId: inbound.channelId,
        content: reply.text,
        metadata: {
          deliveryId,
          error: errorMessage
        }
      });

      return {
        ok: false,
        channel: {
          id: inbound.channelId,
          type: "wechat-miniprogram-ai",
          transport: envelope.transport || "channel-gateway",
          sessionKey: inbound.conversationId
        },
        inbound,
        reply,
        gateway: {
          name: "Fiitx ChannelGateway",
          role: "runtime-channel-gateway",
          route: "agentRuntime.runAgentTask",
          threadId,
          taskId,
          deliveryId
        },
        delivery,
        apiCalls: [],
        toolEvents: [{
          actor: "Fiitx ChannelGateway",
          event: "runtime 执行失败",
          target: errorMessage,
          level: "error"
        }],
        error: errorMessage
      };
    }
  }

  return {
    routeInbound,
    listDeliveries: deliveryQueue.list,
    latestDelivery: deliveryQueue.latest
  };
}

module.exports = {
  createChannelGateway
};
