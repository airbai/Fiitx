const app = getApp();

function createConversationId() {
  const key = "deepsix_conversation_id";
  const cached = wx.getStorageSync(key);
  if (cached) return cached;
  const value = `wx-demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  wx.setStorageSync(key, value);
  return value;
}

function getDemoAddress() {
  return {
    name: "测试用户",
    phone: "13581680620",
    detail: "北京市海淀区清华同方大厦D座"
  };
}

function chooseAddressOrDemo() {
  return new Promise((resolve) => {
    if (!wx.chooseAddress) {
      resolve(getDemoAddress());
      return;
    }

    wx.chooseAddress({
      success: (address) => {
        resolve({
          name: address.userName,
          phone: address.telNumber,
          detail: `${address.provinceName || ""}${address.cityName || ""}${address.countyName || ""}${address.detailInfo || ""}`
        });
      },
      fail: () => {
        wx.showToast({
          title: "使用测试地址",
          icon: "none"
        });
        resolve(getDemoAddress());
      }
    });
  });
}

Page({
  data: {
    inputValue: "第一杯美式咖啡",
    busy: false,
    lastMessageId: "",
    messages: [
      {
        id: "welcome",
        role: "agent",
        author: "Deepsix",
        body: "输入咖啡点单需求，我会通过 Deepsix Gateway 调用官方 drink-skill。"
      }
    ],
    cards: []
  },

  onInput(event) {
    this.setData({ inputValue: event.detail.value });
  },

  appendMessage(message) {
    const next = this.data.messages.concat(message);
    this.setData({
      messages: next,
      lastMessageId: message.id
    });
  },

  appendCard(primaryCard) {
    if (!primaryCard) return;
    const structured = primaryCard.structuredContent || {};
    const address = primaryCard.rendererMeta && primaryCard.rendererMeta.address;
    const status = structured.status || "";
    const amount = structured.totalPrice || structured.paidAmount || "";
    const card = {
      id: `card-${Date.now()}`,
      title: primaryCard.title || structured.drinkName || "订单确认卡",
      componentPath: primaryCard.componentPath || "",
      orderId: structured.orderId || "",
      status,
      totalPrice: amount,
      needAddress: Boolean(structured.needAddress || status === "awaiting_address"),
      canConfirmOrder: status === "confirmed",
      isPaid: status === "paid",
      addressText: address ? `${address.name} ${address.phone} ${address.detail}` : "",
      raw: primaryCard,
      preview: JSON.stringify(primaryCard, null, 2)
    };
    this.setData({
      cards: this.data.cards.concat(card),
      lastMessageId: card.id
    });
  },

  updateCard(cardId, primaryCard) {
    if (!primaryCard) return;
    const structured = primaryCard.structuredContent || {};
    const address = primaryCard.rendererMeta && primaryCard.rendererMeta.address;
    const status = structured.status || "";
    const amount = structured.totalPrice || structured.paidAmount || "";
    const cards = this.data.cards.map((card) => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        title: primaryCard.title || structured.drinkName || card.title,
        componentPath: primaryCard.componentPath || card.componentPath,
        orderId: structured.orderId || card.orderId,
        status: status || card.status,
        totalPrice: amount || card.totalPrice,
        needAddress: Boolean(structured.needAddress || status === "awaiting_address"),
        canConfirmOrder: status === "confirmed",
        isPaid: status === "paid",
        addressText: address ? `${address.name} ${address.phone} ${address.detail}` : card.addressText,
        raw: primaryCard,
        preview: JSON.stringify(primaryCard, null, 2)
      };
    });
    this.setData({ cards, lastMessageId: cardId });
  },

  async confirmAddress(event) {
    const cardId = event.currentTarget.dataset.cardId;
    const card = this.data.cards.find((item) => item.id === cardId);
    if (!card || this.data.busy) return;

    const address = await chooseAddressOrDemo();
    this.setData({ busy: true });

    wx.request({
      url: app.globalData.gatewayActionEndpoint,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        actionType: "confirmAddress",
        address,
        appId: "wx-demo-customer-miniapp",
        openId: "openid-demo-customer",
        conversationId: createConversationId(),
        pagePath: "/pages/index/index",
        scene: "customer-chatbox",
        card: card.raw
      },
      success: (response) => {
        const data = response.data || {};
        if (!data.ok) {
          wx.showModal({
            title: "地址确认失败",
            content: data.error || (data.reply && data.reply.text) || "Deepsix Gateway 返回异常。",
            showCancel: false
          });
          return;
        }
        this.appendMessage({
          id: `agent-address-${Date.now()}`,
          role: "agent",
          author: "Deepsix Gateway",
          body: "地址已确认，订单卡片已更新。"
        });
        this.updateCard(cardId, data.reply && data.reply.primaryCard);
      },
      fail: (error) => {
        wx.showModal({
          title: "请求失败",
          content: error.errMsg || "请确认 Deepsix 桌面端正在运行。",
          showCancel: false
        });
      },
      complete: () => {
        this.setData({ busy: false });
      }
    });
  },

  confirmOrder(event) {
    const cardId = event.currentTarget.dataset.cardId;
    const card = this.data.cards.find((item) => item.id === cardId);
    if (!card || this.data.busy) return;

    this.setData({ busy: true });

    wx.request({
      url: app.globalData.gatewayActionEndpoint,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        actionType: "confirmOrder",
        orderId: card.orderId,
        appId: "wx-demo-customer-miniapp",
        openId: "openid-demo-customer",
        conversationId: createConversationId(),
        pagePath: "/pages/index/index",
        scene: "customer-chatbox",
        card: card.raw
      },
      success: (response) => {
        const data = response.data || {};
        if (!data.ok) {
          wx.showModal({
            title: "下单失败",
            content: data.error || (data.reply && data.reply.text) || "Deepsix Gateway 返回异常。",
            showCancel: false
          });
          return;
        }
        this.appendMessage({
          id: `agent-paid-${Date.now()}`,
          role: "agent",
          author: "Deepsix Gateway",
          body: "支付成功，预计 20 分钟内出杯。"
        });
        this.updateCard(cardId, data.reply && data.reply.primaryCard);
      },
      fail: (error) => {
        wx.showModal({
          title: "请求失败",
          content: error.errMsg || "请确认 Deepsix 桌面端正在运行。",
          showCancel: false
        });
      },
      complete: () => {
        this.setData({ busy: false });
      }
    });
  },

  sendMessage() {
    const text = String(this.data.inputValue || "").trim();
    if (!text || this.data.busy) return;

    const messageId = `user-${Date.now()}`;
    this.appendMessage({
      id: messageId,
      role: "user",
      author: "我",
      body: text
    });
    this.setData({ busy: true, inputValue: "" });

    wx.request({
      url: app.globalData.gatewayEndpoint,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        text,
        appId: "wx-demo-customer-miniapp",
        openId: "openid-demo-customer",
        conversationId: createConversationId(),
        pagePath: "/pages/index/index",
        scene: "customer-chatbox"
      },
      success: (response) => {
        const data = response.data || {};
        if (!data.ok) {
          this.appendMessage({
            id: `agent-error-${Date.now()}`,
            role: "agent",
            author: "Deepsix",
            body: data.error || "Deepsix Gateway 返回异常。"
          });
          return;
        }
        this.appendMessage({
          id: `agent-${Date.now()}`,
          role: "agent",
          author: "Deepsix Gateway",
          body: data.reply && data.reply.text ? data.reply.text : "已处理。"
        });
        this.appendCard(data.reply && data.reply.primaryCard);
      },
      fail: (error) => {
        this.appendMessage({
          id: `agent-fail-${Date.now()}`,
          role: "agent",
          author: "Deepsix",
          body: `请求失败：${error.errMsg || "请确认 Deepsix 桌面端正在运行，且微信开发者工具已关闭域名校验。"}`
        });
      },
      complete: () => {
        this.setData({ busy: false });
      }
    });
  }
});
