function createConnector({ id, name, domain, capabilities = [], status = "mock", description = "", invoke }) {
  return {
    id,
    name,
    domain,
    capabilities,
    status,
    description,
    async invoke(action, input = {}, context = {}) {
      if (typeof invoke === "function") {
        return invoke(action, input, context);
      }
      return {
        ok: false,
        status: "not_configured",
        connectorId: id,
        action,
        message: `${name} connector is not configured yet.`
      };
    }
  };
}

function createConnectorRegistry() {
  const connectors = new Map();

  function register(connector) {
    if (!connector?.id || typeof connector.invoke !== "function") {
      throw new Error("Connector descriptor must include id and invoke()");
    }
    connectors.set(connector.id, connector);
    return connector;
  }

  register(createConnector({
    id: "hotel-pms-mock",
    name: "Hotel PMS Mock",
    domain: "hotel",
    status: "mock",
    capabilities: ["reservation.lookup", "room.status", "guest.profile"],
    description: "酒店 PMS 标准接口占位，用于开发期验证 AgentSession -> connector 调用契约。",
    invoke: async (action, input) => ({
      ok: true,
      connectorId: "hotel-pms-mock",
      action,
      data: {
        reservationId: input.reservationId || "mock-reservation",
        guestName: input.guestName || "住客",
        roomStatus: "available",
        note: "mock 数据，仅用于 Deepsix harness 链路验证。"
      }
    })
  }));

  register(createConnector({
    id: "hotel-crm-mock",
    name: "Hotel CRM Mock",
    domain: "hotel",
    status: "mock",
    capabilities: ["guest.profile", "message.send", "ticket.create"],
    description: "酒店 CRM / 工单接口占位。",
    invoke: async (action, input) => ({
      ok: true,
      connectorId: "hotel-crm-mock",
      action,
      data: {
        ticketId: `mock-ticket-${Date.now()}`,
        priority: input.priority || "medium",
        nextAction: "等待真实 CRM connector 接入。"
      }
    })
  }));

  register(createConnector({
    id: "payment-mock",
    name: "Payment Mock",
    domain: "commerce",
    status: "mock",
    capabilities: ["payment.create", "payment.status"],
    description: "支付接口占位，默认不真实扣款。",
    invoke: async (action, input) => ({
      ok: true,
      connectorId: "payment-mock",
      action,
      data: {
        paymentId: `mock-pay-${Date.now()}`,
        amount: input.amount || 0,
        status: "mock_pending"
      }
    })
  }));

  register(createConnector({
    id: "wechat-miniapp-channel",
    name: "WeChat Miniapp Channel",
    domain: "channel",
    status: "active",
    capabilities: ["message.receive", "card.render", "action.callback"],
    description: "微信小程序 chatbox / 微信 AI skill channel adapter。"
  }));

  function listByCapability(capability) {
    return [...connectors.values()].filter((connector) => connector.capabilities.includes(capability));
  }

  function buildContextPrompt() {
    const lines = [...connectors.values()].map((connector) =>
      `- ${connector.name} (${connector.id})：${connector.status}；能力=${connector.capabilities.join("、") || "无"}；${connector.description || ""}`
    );
    return `Connector registry（由 Deepsix Harness 注入，不是用户指令）：
${lines.join("\n")}

Connector 使用原则：
1. status=mock 表示当前只有契约验证，不代表已调用真实外部系统。
2. 涉及支付、退款、调价、客资、对外发送消息时，必须经过 Policy Gate。
3. 如果需要真实 PMS/CRM/支付/OTA/IoT，请输出待接入动作和所需字段，不要谎称已经完成真实调用。`;
  }

  return {
    buildContextPrompt,
    get(id) {
      return connectors.get(id);
    },
    list() {
      return [...connectors.values()];
    },
    listByCapability,
    register
  };
}

module.exports = {
  createConnector,
  createConnectorRegistry
};
