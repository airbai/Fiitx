const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clearRequireCacheUnder(rootPath) {
  const normalizedRoot = path.resolve(rootPath);
  for (const cachedPath of Object.keys(require.cache)) {
    if (cachedPath.startsWith(normalizedRoot)) {
      delete require.cache[cachedPath];
    }
  }
}

function getFirstText(result) {
  const item = Array.isArray(result?.content)
    ? result.content.find((entry) => entry?.type === "text" && entry.text)
    : null;
  return item?.text || "";
}

function createWxMock({ registeredApis, middlewares, storage, logs }) {
  return {
    modelContext: {
      createSkill(skillPath) {
        logs.push({ type: "skill.create", skillPath });
        return {
          use(middleware) {
            if (typeof middleware === "function") {
              middlewares.push(middleware);
            }
          },
          registerAPI(name, handler) {
            if (typeof handler !== "function") {
              throw new Error(`WeChat Skill API ${name} is not a function`);
            }
            registeredApis.set(name, {
              handler,
              middlewares: [...middlewares],
              skillPath
            });
            logs.push({ type: "api.register", name, skillPath });
          }
        };
      }
    },
    getStorageSync(key) {
      return storage.get(key);
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    removeStorageSync(key) {
      storage.delete(key);
    },
    chooseAddress(options = {}) {
      const mockAddress = storage.get("__mock_address__");
      if (mockAddress) {
        options.success?.(mockAddress);
        return;
      }
      options.fail?.({ errMsg: "chooseAddress:fail mock address unavailable" });
    },
    requestPayment(options = {}) {
      options.fail?.({ errMsg: "requestPayment:fail mock payment disabled" });
    }
  };
}

async function executeWithMiddlewares(api, args) {
  let result;
  const stack = [
    ...(api.middlewares || []),
    async () => {
      result = await api.handler(args || {});
      return result;
    }
  ];

  let index = -1;
  async function dispatch(i) {
    if (i <= index) {
      throw new Error("WeChat Skill middleware called next() more than once");
    }
    index = i;
    const middleware = stack[i];
    if (!middleware) return result;
    return middleware({ apiName: api.name, arguments: args || {} }, () => dispatch(i + 1));
  }

  await dispatch(0);
  return result;
}

function normalizeCard({ apiName, spec, result, args }) {
  const structuredContent = result?.structuredContent || null;
  const componentPath = spec?._meta?.ui?.componentPath || spec?.component || null;
  const title =
    structuredContent?.drinkName ||
    structuredContent?.name ||
    structuredContent?.storeName ||
    structuredContent?.title ||
    (Array.isArray(structuredContent?.items) ? "推荐饮品" : spec?.description || apiName);

  return {
    type: "wechat-card",
    title,
    apiName,
    componentPath,
    relatedPage: spec?.relatedPage || null,
    arguments: args || {},
    contentText: getFirstText(result),
    structuredContent,
    rendererMeta: result?._meta || null
  };
}

function inferPreferredKeyword(prompt) {
  if (/拿铁/.test(prompt)) return "拿铁";
  if (/美式/.test(prompt)) return "美式";
  if (/咖啡/.test(prompt)) return "咖啡";
  if (/奶茶/.test(prompt)) return "奶茶";
  if (/茶/.test(prompt)) return "茶";
  return "咖啡";
}

function inferRecommendedScenario(prompt) {
  if (/咖啡|美式|拿铁/.test(prompt)) return "coffee";
  if (/茶|奶茶/.test(prompt)) return "tea";
  if (/热|暖/.test(prompt)) return "warm";
  return "default";
}

function pickFirstDrink(result) {
  const structured = result?.structuredContent;
  if (Array.isArray(structured?.items) && structured.items.length > 0) {
    return structured.items[0];
  }
  if (Array.isArray(structured?.drinks) && structured.drinks.length > 0) {
    return structured.drinks[0];
  }
  return null;
}

function buildDefaultSpecs(specOptions = {}, prompt = "") {
  const specs = {};
  for (const [key, optionConfig] of Object.entries(specOptions || {})) {
    const values = Array.isArray(optionConfig?.options) ? optionConfig.options : [];
    if (optionConfig?.multiple) {
      specs[key] = [];
      continue;
    }
    const preferred =
      (key === "temperature" && /冰|冷/.test(prompt) && values.find((item) => item.value === "ice")) ||
      (key === "temperature" && /热|暖/.test(prompt) && values.find((item) => item.value === "hot")) ||
      (key === "temperature" && values.find((item) => item.value === "ice")) ||
      (key === "sugar" && /无糖/.test(prompt) && values.find((item) => item.value === "none")) ||
      (key === "sugar" && /少糖/.test(prompt) && values.find((item) => item.value === "less")) ||
      (key === "sugar" && values.find((item) => item.value === "normal")) ||
      (key === "cupSize" && /大杯/.test(prompt) && values.find((item) => item.value === "large")) ||
      (key === "cupSize" && values.find((item) => item.value === "medium")) ||
      values[0];
    if (preferred?.value) {
      specs[key] = preferred.value;
    }
  }
  return specs;
}

function isSkillRoot(candidatePath) {
  return fs.existsSync(path.join(candidatePath, "mcp.json")) && fs.existsSync(path.join(candidatePath, "index.js"));
}

function readSkillManifest(skillRoot) {
  const resolvedRoot = path.resolve(skillRoot);
  const mcp = readJson(path.join(resolvedRoot, "mcp.json"));
  const skillPromptPath = path.join(resolvedRoot, "SKILL.md");
  const skillPrompt = fs.existsSync(skillPromptPath) ? fs.readFileSync(skillPromptPath, "utf8") : "";
  return {
    root: resolvedRoot,
    id: mcp.name || path.basename(resolvedRoot),
    name: mcp.name || path.basename(resolvedRoot),
    mcp,
    skillPrompt
  };
}

function collectSkillRoots(rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  if (!fs.existsSync(resolvedRoot)) return [];
  if (isSkillRoot(resolvedRoot)) return [resolvedRoot];

  const found = [];
  const queue = [{ directory: resolvedRoot, depth: 0 }];
  const maxDepth = 5;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth > maxDepth) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childPath = path.join(current.directory, entry.name);
      if (isSkillRoot(childPath)) {
        found.push(childPath);
        continue;
      }
      queue.push({ directory: childPath, depth: current.depth + 1 });
    }
  }

  return found;
}

function discoverSkills(skillsRoot) {
  return collectSkillRoots(skillsRoot).map(readSkillManifest);
}

function scoreSkillForPrompt(skill, prompt) {
  const source = `${skill.name}\n${skill.root}\n${skill.skillPrompt}\n${JSON.stringify(skill.mcp?.apis || [])}`;
  const promptTokens = [
    "咖啡",
    "美式",
    "拿铁",
    "奶茶",
    "饮品",
    "喝",
    "点单",
    "订单",
    "门店",
    "排队",
    "营业",
    "地址",
    "支付"
  ];
  let score = 0;
  for (const token of promptTokens) {
    if (prompt.includes(token) && source.includes(token)) score += 8;
  }
  if (/drink|cafe|coffee|饮品|咖啡/i.test(source) && /喝|咖啡|美式|拿铁|饮品|奶茶|点/.test(prompt)) {
    score += 40;
  }
  return score;
}

function createWechatAiSkillGateway(options = {}) {
  const bundledSkillRoots = [
    path.resolve(__dirname, "../../examples/wechat-ai/customer-chatbox-miniapp/skills/drink-skill"),
    path.resolve(__dirname, "../../examples/wechat-ai/customer-chatbox-miniapp/drink-skill"),
    path.resolve(__dirname, "../../examples/wechat-ai/drink-skill")
  ];
  const defaultSkillRoot = options.defaultSkillRoot || bundledSkillRoots.find(isSkillRoot) || bundledSkillRoots[0];
  const defaultSkillsRoot = options.defaultSkillsRoot || path.dirname(defaultSkillRoot);
  const sessionStores = new Map();

  function getSessionStorage(sessionId = "default") {
    if (!sessionStores.has(sessionId)) {
      sessionStores.set(sessionId, new Map());
    }
    return sessionStores.get(sessionId);
  }

  function loadSkill(skillRoot = defaultSkillRoot, sessionId = "default") {
    const resolvedSkillRoot = path.resolve(skillRoot);
    const mcpPath = path.join(resolvedSkillRoot, "mcp.json");
    const entryPath = path.join(resolvedSkillRoot, "index.js");
    const skillPromptPath = path.join(resolvedSkillRoot, "SKILL.md");
    if (!fs.existsSync(mcpPath)) {
      throw new Error(`WeChat Skill mcp.json not found: ${mcpPath}`);
    }
    if (!fs.existsSync(entryPath)) {
      throw new Error(`WeChat Skill index.js not found: ${entryPath}`);
    }

    const logs = [];
    const registeredApis = new Map();
    const middlewares = [];
    const storage = getSessionStorage(sessionId);
    const wxMock = createWxMock({ registeredApis, middlewares, storage, logs });
    const previousWx = global.wx;
    clearRequireCacheUnder(resolvedSkillRoot);
    global.wx = wxMock;
    try {
      require(entryPath);
    } finally {
      global.wx = previousWx;
    }

    const mcp = readJson(mcpPath);
    return {
      skillRoot: resolvedSkillRoot,
      mcp,
      skillPrompt: fs.existsSync(skillPromptPath) ? fs.readFileSync(skillPromptPath, "utf8") : "",
      apis: registeredApis,
      storage,
      wxMock,
      logs
    };
  }

  async function callApi({ skillRoot = defaultSkillRoot, sessionId = "default", apiName, arguments: args = {} }) {
    const skill = loadSkill(skillRoot, sessionId);
    const api = skill.apis.get(apiName);
    if (!api) {
      throw new Error(`WeChat Skill API not registered: ${apiName}`);
    }
    const spec = Array.isArray(skill.mcp?.apis)
      ? skill.mcp.apis.find((entry) => entry.name === apiName)
      : null;
    const previousWx = global.wx;
    global.wx = skill.wxMock;
    try {
      const result = await executeWithMiddlewares({ ...api, name: apiName }, args);
      const card = normalizeCard({ apiName, spec, result, args });
      return {
        ok: !result?.isError,
        skill: {
          root: skill.skillRoot,
          name: skill.mcp?.name || "wechat-skill",
          version: skill.mcp?.version || null
        },
        apiName,
        arguments: args,
        result,
        card,
        registeredApis: [...skill.apis.keys()],
        loaderLogs: skill.logs
      };
    } finally {
      global.wx = previousWx;
    }
  }

  function selectSkillForPrompt({ prompt, skillsRoot = defaultSkillsRoot, skillRoot } = {}) {
    const skills = skillRoot ? [readSkillManifest(skillRoot)] : discoverSkills(skillsRoot);
    const ranked = skills
      .map((skill) => ({
        ...skill,
        score: scoreSkillForPrompt(skill, prompt || "")
      }))
      .sort((a, b) => b.score - a.score);
    const selected = ranked[0] || null;
    return {
      selected,
      candidates: ranked.map((skill) => ({
        root: skill.root,
        name: skill.name,
        score: skill.score
      }))
    };
  }

  async function routeDrinkPrompt(payload = {}) {
    const prompt = payload.prompt || "我要喝咖啡";
    const sessionId = payload.sessionId || payload.channelContext?.conversationId || "wechat-drink-demo";
    const skillRoot = payload.skillRoot || defaultSkillRoot;
    const toolEvents = [];
    const apiCalls = [];
    const cards = [];

    toolEvents.push({
      label: "WeChat AI Skill Loader",
      detail: "读取 mcp.json 并执行官方 index.js 注册原子接口。"
    });

    const skill = loadSkill(skillRoot, sessionId);
    toolEvents.push({
      label: "Fiitx Gateway Router",
      detail: `替代微信 AI router，命中 ${path.basename(skill.skillRoot)}。`
    });
    toolEvents.push({
      label: "AgentSession",
      detail: `将微信会话输入写入会话上下文：${prompt}`
    });

    async function trackedCall(apiName, args, label) {
      toolEvents.push({ label: "Skill API", detail: `${apiName} ${JSON.stringify(args || {})}` });
      const response = await callApi({ skillRoot, sessionId, apiName, arguments: args });
      apiCalls.push({ apiName, arguments: args, ok: response.ok });
      if (response.card?.componentPath) {
        cards.push(response.card);
      }
      if (label) {
        toolEvents.push({ label, detail: response.card?.title || response.card?.contentText || apiName });
      }
      return response;
    }

    if (/门店|排队|营业|附近/.test(prompt)) {
      const store = await trackedCall("getStoreStatus", { storeId: "mock-store-001" }, "Mock Connector");
      return {
        ok: true,
        mode: "wechat-ai-skill",
        prompt,
        skill: { root: skill.skillRoot, name: skill.mcp?.name, registeredApis: [...skill.apis.keys()] },
        apiCalls,
        toolEvents,
        wechatReply: {
          text: store.card?.contentText || "已生成门店状态卡。",
          primaryCard: store.card,
          cards
        }
      };
    }

    const keyword = inferPreferredKeyword(prompt);
    const searchApi = /推荐|想喝|随便/.test(prompt) && !/美式|拿铁|咖啡|奶茶|茶/.test(prompt)
      ? "getRecommendedDrinks"
      : "searchDrinks";
    const first = await trackedCall(
      searchApi,
      searchApi === "getRecommendedDrinks" ? { scenario: inferRecommendedScenario(prompt) } : { keyword },
      "Mock Connector"
    );
    const firstDrink = pickFirstDrink(first.result);
    if (!firstDrink?.drinkId) {
      throw new Error(`WeChat Skill did not return a drinkId for prompt: ${prompt}`);
    }

    const detail = await trackedCall("selectDrink", { drinkId: firstDrink.drinkId }, "Mock Connector");
    const specs = buildDefaultSpecs(detail.result?.structuredContent?.specOptions, prompt);
    toolEvents.push({
      label: "Policy Gate",
      detail: "允许创建饮品订单草稿；不自动付款。"
    });
    const order = await trackedCall("confirmSku", { drinkId: firstDrink.drinkId, specs }, "WeChat Card Formatter");

    return {
      ok: true,
      mode: "wechat-ai-skill",
      gateway: {
        name: "Fiitx Gateway",
        role: "wechat-ai-router-compatible",
        selectedSkill: path.basename(skill.skillRoot),
        officialSkillUnmodified: true
      },
      prompt,
      channel: {
        type: "wechat-miniprogram-ai",
        adapter: "wechat-clawbot"
      },
      skill: {
        root: skill.skillRoot,
        name: skill.mcp?.name || "drink-skill",
        version: skill.mcp?.version || null,
        registeredApis: [...skill.apis.keys()]
      },
      apiCalls,
      toolEvents,
      wechatReply: {
        text: "已为你生成咖啡订单确认卡，请在微信卡片中确认规格和地址。",
        primaryCard: order.card,
        cards
      }
    };
  }

  async function routePrompt(payload = {}) {
    const prompt = payload.prompt || "";
    const routing = selectSkillForPrompt(payload);
    if (!routing.selected) {
      throw new Error("没有找到可用的微信 AI Skill。");
    }

    if (/drink|cafe|coffee|饮品|咖啡/i.test(`${routing.selected.name} ${routing.selected.root} ${routing.selected.skillPrompt}`)) {
      const result = await routeDrinkPrompt({
        ...payload,
        skillRoot: routing.selected.root
      });
      return {
        ...result,
        gateway: {
          ...result.gateway,
          routerDecision: {
            prompt,
            selectedSkill: routing.selected.name,
            selectedSkillRoot: routing.selected.root,
            candidates: routing.candidates
          }
        }
      };
    }

    const firstApi = routing.selected.mcp?.apis?.[0];
    if (!firstApi?.name) {
      throw new Error(`Skill ${routing.selected.name} 没有可调用 API。`);
    }
    const response = await callApi({
      skillRoot: routing.selected.root,
      sessionId: payload.sessionId || payload.channelContext?.conversationId || "wechat-gateway-session",
      apiName: firstApi.name,
      arguments: payload.arguments || {}
    });
    return {
      ok: response.ok,
      mode: "wechat-ai-skill",
      gateway: {
        name: "Fiitx Gateway",
        role: "wechat-ai-router-compatible",
        selectedSkill: routing.selected.name,
        officialSkillUnmodified: true,
        routerDecision: {
          prompt,
          selectedSkill: routing.selected.name,
          selectedSkillRoot: routing.selected.root,
          candidates: routing.candidates
        }
      },
      prompt,
      skill: response.skill,
      apiCalls: [{ apiName: firstApi.name, arguments: payload.arguments || {}, ok: response.ok }],
      toolEvents: [
        { label: "Fiitx Gateway Router", detail: `命中 ${routing.selected.name}` },
        { label: "Skill API", detail: `${firstApi.name} ${JSON.stringify(payload.arguments || {})}` }
      ],
      wechatReply: {
        text: response.card?.contentText || "已调用微信 AI Skill。",
        primaryCard: response.card,
        cards: response.card?.componentPath ? [response.card] : []
      }
    };
  }

  return {
    discoverSkills: () => discoverSkills(defaultSkillsRoot),
    selectSkillForPrompt,
    loadSkill,
    callApi,
    routePrompt,
    routeDrinkPrompt,
    runDrinkOrderDemo: routeDrinkPrompt
  };
}

module.exports = {
  createWechatAiSkillGateway
};
