import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
let PptxGenJS;
try {
  PptxGenJS = require("pptxgenjs");
} catch {
  PptxGenJS = require("/Users/botbotbot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs/dist/pptxgen.cjs.js");
}

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "outputs", "fiitx-openclaw-agent-talk");
const SLIDES_DIR = path.join(OUTPUT_DIR, "html");
const ASSET_DIR = path.join(OUTPUT_DIR, "assets");
const PPTX_PATH = path.join(OUTPUT_DIR, "fiitx-openclaw-agent-talk.pptx");
const LOGO_SRC = path.join(ROOT, "assets", "fiitx-logo.png");
const LOGO_OUT = path.join(ASSET_DIR, "fiitx-logo.png");
const GIAC_ASSET_DIR = path.join(ASSET_DIR, "giac-2026");
const GIAC_ASSETS = {
  coverVisual: path.join(GIAC_ASSET_DIR, "cover-visual.png"),
  arrow: path.join(GIAC_ASSET_DIR, "arrow-glow.png"),
  logo: path.join(GIAC_ASSET_DIR, "giac-logo-cyan.png"),
  msup: path.join(GIAC_ASSET_DIR, "msup-archnotes.png")
};
let pptx;

fs.mkdirSync(SLIDES_DIR, { recursive: true });
fs.mkdirSync(ASSET_DIR, { recursive: true });
if (fs.existsSync(LOGO_SRC)) {
  fs.copyFileSync(LOGO_SRC, LOGO_OUT);
}

const deckTitle = "从 LLM 到 Digital Worker";
const deckSubtitle = "OpenClaw 的 Agent 架构设计与落地实践";
const speaker = "白朋飞 / FIIT.AI";
const eventName = "GIAC 全球智能应用开发与架构大会 2026";

const slides = [
  {
    type: "cover",
    chapter: "Opening",
    title: deckTitle,
    subtitle: deckSubtitle,
    eyebrow: eventName,
    bullets: ["以 Fiitx 开发过程为例", "50 分钟演讲 + 10 分钟问答", "从架构问题到落地闭环"],
    takeaway: "Agent Framework 的价值，不是接一个模型，而是让模型可运行、可治理、可复盘。",
    notes: "开场先建立主题边界：这不是产品功能介绍，而是一次架构方法论分享。Fiitx 是贯穿全场的工程样本。",
    minutes: 0.9
  },
  {
    chapter: "Opening",
    title: "今天只讲一个问题",
    subtitle: "为什么从 LLM 走到 Digital Worker，必须重做业务架构？",
    bullets: ["LLM 很强，但默认没有组织边界", "Tool Calling 很有用，但默认不可治理", "Agent Demo 很快，但默认不可长期运行"],
    takeaway: "Digital Worker 不是更聪明的 Chat，而是带职责、工具、记忆、权限和交付闭环的软件员工。",
    notes: "把听众注意力从模型能力拉回系统设计：能不能真正接住业务、工具和责任，是分水岭。",
    minutes: 0.8
  },
  {
    chapter: "Opening",
    title: "50 分钟路线图",
    subtitle: "用一个真实桌面 Agent 的迭代过程拆架构",
    bullets: ["第一段：从 LLM 到 Digital Worker 的定义", "第二段：OpenClaw / Fiitx 的分层架构", "第三段：开发 Fiitx 时踩到的 8 个坑", "第四段：可迁移的方法论和组织落地路径"],
    takeaway: "听完之后，拿走的不是一个工具清单，而是一套 Agent 系统设计检查表。",
    notes: "明确演讲收益和节奏，降低听众焦虑。60 页不是密集讲功能，而是每页一个关键转折。",
    minutes: 0.8
  },
  {
    chapter: "Opening",
    title: "先给结论",
    subtitle: "Agent 架构的核心不是“会调用工具”，而是“能被托付任务”",
    bullets: ["能理解目标：Intent / Plan / Context", "能执行任务：Tool / Workspace / Channel", "能承担责任：Policy / Audit / Rollback", "能持续改进：History / Skill / Evaluation"],
    takeaway: "从能力到责任，是 Agent Framework 与 Chat Wrapper 的本质差别。",
    notes: "这一页给全场主线。后续所有案例都回到四个动词：理解、执行、负责、改进。",
    minutes: 0.8
  },
  {
    chapter: "Problem",
    title: "阶段一：LLM 应用的第一层幻觉",
    subtitle: "“模型能回答”不等于“系统能完成”",
    bullets: ["回答是文本，业务需要状态变化", "一次对话是瞬时的，工作流是长期的", "模型输出没有天然权限边界", "用户真正关心的是交付结果是否落盘"],
    takeaway: "把 LLM 当接口，会得到 Chat；把 LLM 当执行者，必须设计运行时。",
    notes: "用 Fiitx 早期经历举例：用户看到“已完成”，但文件没有真正存在，这就是回答和完成之间的差异。",
    minutes: 0.85
  },
  {
    chapter: "Problem",
    title: "阶段二：Tool Calling 的第二层幻觉",
    subtitle: "工具能调用，不代表工具链可信",
    bullets: ["工具调用需要审批、回滚、审计", "工具结果需要结构化归档，而不是只显示日志", "失败需要分类：权限、路径、依赖、模型、上下文", "多轮工具调用还要保留 reasoning_content 等协议字段"],
    takeaway: "工具不是插件按钮，而是 Agent 运行时的一部分。",
    notes: "强调 DeepSeek Thinking Mode 的 reasoning_content 坑：丢字段会造成多轮工具调用失败，这是协议兼容而不是 UI 问题。",
    minutes: 0.85
  },
  {
    chapter: "Problem",
    title: "阶段三：Agent Demo 的第三层幻觉",
    subtitle: "Demo 能跑，不代表能上线",
    bullets: ["没有长期运行 daemon，任务无法跨时间触发", "没有 Channel 抽象，外部 IM 无法可靠进入系统", "没有 SessionDB，复盘只能靠截图", "没有 Profile isolation，不同入口会污染上下文假设"],
    takeaway: "上线级 Agent 的问题大多不在模型，而在系统边界和生命周期。",
    notes: "引出 Hermes 强项：daemon、cron、channels、session search、profile isolation；再说明 Fiitx 为什么吸收这些能力。",
    minutes: 0.85
  },
  {
    chapter: "Definition",
    title: "Digital Worker 的最小定义",
    subtitle: "一个能被托付、能交付、能复盘的 Agent 单元",
    bullets: ["身份：它是谁，服务哪个场景", "能力：它能用哪些工具和数据", "边界：它需要什么审批和权限", "记录：它做过什么，为什么这么做", "改进：它如何从历史任务形成 Skill"],
    takeaway: "Digital Worker = Agent Runtime + Tool Boundary + Memory + Policy + Delivery.",
    notes: "不要把 Digital Worker 神秘化。它是工程对象，必须有接口、配置、状态和审计。",
    minutes: 0.8
  },
  {
    chapter: "Definition",
    title: "Fiitx 为什么适合作为案例",
    subtitle: "它不是拿 Agent 做 Demo，而是用 Agent 迭代 Agent 产品本身",
    bullets: ["React + Electron 的桌面壳，接近真实工作流", "本地 workspace、IDE、文件预览、审批都在一个闭环中", "MCP、Skill、Channel、Model Router 持续加入", "开发过程暴露出 Agent 产品化的真实痛点"],
    takeaway: "Fiitx 的价值在于，它把“Agent 做事”变成了可观察的工程过程。",
    notes: "这里不是推销 Fiitx，而是解释为什么这个案例有研究价值：它经历了从 Chat 到 Workbench 的真实转变。",
    minutes: 0.75
  },
  {
    chapter: "Definition",
    title: "从 OpenClaw 看 Agent Framework",
    subtitle: "框架要解决的是系统性问题，而不是模型提示词问题",
    bullets: ["Context：怎样把用户、文件、历史、外部事件组织成输入", "Action：怎样选择工具、执行工具、处理失败", "Control：怎样审批、隔离、审计和降级", "Evolution：怎样沉淀 Skill、Profile 和评价数据"],
    takeaway: "Agent Framework 是一层“生产关系”：让模型、工具、数据和人协同。",
    notes: "把 OpenClaw 放到更抽象的位置：不是某个具体仓库，而是一种 Agent 操作系统的架构视角。",
    minutes: 0.85
  },
  {
    chapter: "Architecture",
    title: "总架构：四层闭环",
    subtitle: "Fiitx 的开发过程最终收敛为四层",
    bullets: ["交互层：Workbench、IDE、Artifacts、Channels", "决策层：Intent Router、Agent Orchestrator、Model Router", "执行层：Tool Runtime、Workspace、MCP、Skill", "治理层：Policy、Approval、Audit、History、Profile Isolation"],
    takeaway: "一切能力都必须落到闭环：输入、决策、执行、验证、复盘。",
    notes: "用这一页作为后面所有架构图的索引。每层都不是孤立模块，而是通过 session 和 trace 串起来。",
    minutes: 0.95,
    diagram: "layers"
  },
  {
    chapter: "Architecture",
    title: "第一层：交互不是 Chatbox",
    subtitle: "用户需要的是工作台，而不是输入框",
    bullets: ["任务列表：区分 Chat / Coding / Waiting / Done", "本地资源：显示真实落盘文件，而不是模型声称的路径", "Artifacts：预览 HTML、图片、PDF、PPT、文档", "IDE：代码查看、Diff、保存、路径定位"],
    takeaway: "Agent UI 的核心是减少状态不确定性。",
    notes: "解释为什么 Fiitx 从单个 App.tsx 和文本框逐步走向 IDE、Artifacts、资源列表和执行流。",
    minutes: 0.85
  },
  {
    chapter: "Architecture",
    title: "第二层：Intent Router",
    subtitle: "一开始就判断任务类型，而不是中途提示用户切 Agent",
    bullets: ["Chat：解释、问答、分析", "Coding：读取 workspace、修改文件、运行验证", "Artifact：生成可预览交付物", "Channel：来自 IM、IDE、Cron 的任务带不同上下文"],
    takeaway: "路由判断越早，用户越少被系统内部结构打断。",
    notes: "呼应用户曾问“为什么要有切换 agent 提示”。答案是：产品上应该在入口处路由，而不是在执行中暴露内部模式。",
    minutes: 0.8
  },
  {
    chapter: "Architecture",
    title: "第三层：Agent Orchestrator",
    subtitle: "不是一个万能 Agent，而是一组可组合角色",
    bullets: ["Research Agent：补上下文和证据", "Coding Agent：读写文件、运行命令、验证结果", "Artifact Agent：生成 HTML/PPT/文档等交付物", "Chat Agent：用更低成本处理纯问答"],
    takeaway: "专业化不是为了复杂，而是为了把责任边界拆清楚。",
    notes: "强调多 Agent 不是炫技。真正价值是不同工具权限、上下文、输出格式和评价标准分离。",
    minutes: 0.85,
    diagram: "orchestrator"
  },
  {
    chapter: "Architecture",
    title: "第四层：Tool Runtime",
    subtitle: "工具链要有统一的执行协议",
    bullets: ["Shell / Workspace / Network / MCP 使用同一审批模型", "工具输入、输出、错误都进入 session log", "工具结果会反哺本地资源列表和 artifact 预览", "每次写入后需要校验真实文件状态"],
    takeaway: "工具调用的重点不是 call，而是 result grounding。",
    notes: "用本地资源误列不存在文件的例子说明：没有 post-check，就会把模型输出当成事实。",
    minutes: 0.85
  },
  {
    chapter: "Architecture",
    title: "第五层：Policy Gate",
    subtitle: "Agent 必须先学会“不能做什么”",
    bullets: ["默认请求审批：文件写入、shell、网络、MCP tool", "风险分级：低风险自动，高风险显式确认", "审批结果写入审计链", "策略可配置，而不是硬编码在 prompt 里"],
    takeaway: "企业 Agent 的可用性，来自安全边界清晰，而不是边界消失。",
    notes: "强调安全不是用户体验的反面。清晰的权限模型反而降低用户不确定性。",
    minutes: 0.8
  },
  {
    chapter: "Architecture",
    title: "第六层：Model Router",
    subtitle: "模型对用户透明，但对系统可治理",
    bullets: ["Provider Registry：模型、能力、成本、延迟元数据", "按任务路由：文本、工具调用、视觉、JSON 输出", "Fallback：失败后自动换 MaaS", "熔断：连续失败后短时避开故障 Provider"],
    takeaway: "BYOM 不只是填 API Key，而是让模型成为可替换资源。",
    notes: "结合 Fiitx 最近实现的跨 MaaS 自动路由、fallback、成本和延迟感知。",
    minutes: 0.9
  },
  {
    chapter: "Architecture",
    title: "第七层：MCP / Skill",
    subtitle: "外部能力必须标准化进入运行时",
    bullets: ["MCP：tools、resources、prompts 统一注册", "Skill：把工作流经验封装为可安装能力", "权限：外部工具同样走审批和审计", "市场：本地 Skill、仓库 Skill、未来远程 Skill"],
    takeaway: "Skill 是经验的交付格式，MCP 是外部世界的协议边界。",
    notes: "点到 dokie-ppt 这次任务本身：它就是一个 Skill，把 PPT 工程方法固化成可调用流程。",
    minutes: 0.85
  },
  {
    chapter: "Architecture",
    title: "第八层：Channel Adapter",
    subtitle: "电脑里的 Agent 需要能被外部世界触发",
    bullets: ["Desktop Workbench：默认交互入口", "WeChat / Weixin iLink：IM 控制本机 Agent", "VS Code：把 IDE 上下文带进任务", "Daemon / Cron：没有用户在线时也能运行"],
    takeaway: "Channel 不是 UI 适配，而是上下文和身份边界。",
    notes: "解释为什么 Channels 要进入 Settings 页面：它决定了任务从哪里来、带什么上下文、走哪个 profile。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "Fiitx 开发过程：第一条问题线",
    subtitle: "从“完成了”到“真的完成了”",
    bullets: ["早期：Agent 回复结果，但 UI 没有展示真实执行过程", "问题：用户不知道任务是否卡住、失败或只生成了摘要", "改造：流式展示执行过程和 agent 正文", "结果：执行和交付开始可观察"],
    takeaway: "Agent 产品第一优先级：让用户看见系统正在做什么。",
    notes: "这是第一个真实产品教训。可观察性不是审计之后再做，而是一开始就决定信任感。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "执行过程应该默认折叠",
    subtitle: "信息透明不等于信息噪声",
    bullets: ["默认折叠：不打断阅读正文", "点击展开：查看工具调用、推理阶段、状态变化", "关键摘要常驻：已处理多久、编辑了几个文件", "异常高亮：未完成、需审批、未落盘"],
    takeaway: "透明度要分层：摘要给所有人，trace 给需要排查的人。",
    notes: "对应用户反馈：执行过程太长导致页面卡顿和信息干扰。架构上要支持 trace，UI 上要做折叠。",
    minutes: 0.75
  },
  {
    chapter: "Case",
    title: "第二条问题线：本地资源必须可信",
    subtitle: "不要把模型提到的路径当文件列表",
    bullets: ["问题：文件不存在，却出现在本地资源区", "根因：从文本和 manifest 抽路径，没有落盘校验", "修复：去重、过滤 missing、区分 workspace 与 artifact", "教训：资源列表展示的是事实，不是候选线索"],
    takeaway: "Agent UI 中的“文件”必须来自文件系统状态。",
    notes: "这个案例很适合架构听众：它说明 Grounding 不只是模型 grounding，也包括 UI grounding。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "第三条问题线：IDE 不是装饰",
    subtitle: "代码任务必须有阅读、Diff、保存和预览闭环",
    bullets: ["Monaco Editor：语法高亮和大文件阅读", "多标签：跨文件查看上下文", "Diff：查看修改前后，而不是只信 agent 总结", "Artifact 预览：HTML、图片、文档、PPT 可快速验证"],
    takeaway: "Coding Agent 没有 Diff，就像数据库迁移没有变更脚本。",
    notes: "提到曾出现 IDE diff 不生效的问题：Diff 的关键是保存原始版本和当前版本，而不是显示两列同一内容。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "第四条问题线：路径和模块解析",
    subtitle: "Agent 生成代码后，运行环境会暴露真实约束",
    bullets: ["HTML 中 import three 失败：Vite 不认识裸模块", "file:// 安全域限制：本地文件不能直接跨模块加载", "解决：CDN import、Vite server、依赖安装或构建配置", "教训：生成代码必须接运行验证"],
    takeaway: "Agent 写完代码不是结束，运行验证才是交付。",
    notes: "用孔乙己小游戏案例说明：页面看起来生成了，但模块解析失败，说明执行链没闭环。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "第五条问题线：多轮 Thinking Mode",
    subtitle: "reasoning_content 是协议兼容问题，不是日志问题",
    bullets: ["DeepSeek-V4 Thinking Mode 多轮工具调用需要保留 reasoning_content", "只保存 content 会破坏后续请求", "Agent message schema 必须容纳 content、reasoning_content、tool_calls", "历史存储和模型适配都要支持该字段"],
    takeaway: "Harness 的稳定性，取决于你是否保存了模型协议的完整状态。",
    notes: "这页面向做框架的人特别重要：框架不能只抽象成 role/content，否则会丢关键上下文字段。",
    minutes: 0.9
  },
  {
    chapter: "Case",
    title: "第六条问题线：MaaS 不是一个 Key",
    subtitle: "配置了 Key，不代表路由能找到正确能力",
    bullets: ["文本模型、视觉模型、图像生成模型是不同能力域", "Provider 需要声明 supportsVision / imageGeneration / toolUse", "Router 需要按任务类型选择候选队列", "错误提示要告诉用户缺的是能力，不只是 Key"],
    takeaway: "模型中心要管理能力矩阵，而不是 API Key 表。",
    notes: "回应硅基流动 Key 但没有图片 model 的问题。根因通常是 profile 没声明或 router 没纳入图像能力。",
    minutes: 0.85
  },
  {
    chapter: "Case",
    title: "第七条问题线：Settings 不是杂物间",
    subtitle: "配置页必须反映系统架构",
    bullets: ["General：语言、版本、本机状态", "Agent / Policy / Model：运行时核心", "MCP / Skill / Channels：扩展能力", "Platform：Daemon、Cron、SessionDB、Profile Isolation"],
    takeaway: "产品导航本身就是架构教育。",
    notes: "解释为什么后来把 Agent、审批、历史、审计、策略、模型广场等都收敛到 Settings。",
    minutes: 0.75
  },
  {
    chapter: "Case",
    title: "第八条问题线：长期运行",
    subtitle: "Digital Worker 不能只在用户按发送时存在",
    bullets: ["Daemon：桌面 Agent 的后台生命线", "Cron：定时巡检、发布、复盘、同步", "Channel Keep Warm：IM 入口需要长期监听", "SessionDB：后台任务同样必须可审计"],
    takeaway: "从 Chatbot 到 Worker 的一个标志：它能在你不看着的时候工作。",
    notes: "这是 Fiitx 吸收 Hermes 强项的核心原因。桌面 Agent 如果只依赖前端页面，就不是真正 Worker。",
    minutes: 0.85
  },
  {
    chapter: "Deep Dive",
    title: "运行时闭环：从一句话到文件落盘",
    subtitle: "Agent task 的完整链路",
    bullets: ["输入：用户、附件、workspace、channel context", "路由：intent + agent + model profile", "执行：tool loop + policy gate + progress stream", "验证：文件系统检查 + artifact preview + audit log"],
    takeaway: "把“模型回答”变成“系统状态变化”，需要至少四次转换。",
    notes: "这一页作为技术深挖入口。建议讲的时候画出从 prompt 到 manifest 到 file stat 的路径。",
    minutes: 0.9,
    diagram: "pipeline"
  },
  {
    chapter: "Deep Dive",
    title: "状态模型：Thread / Session / Artifact",
    subtitle: "没有状态模型，就没有复盘",
    bullets: ["Thread：用户可见的任务上下文", "Session：运行时事件和工具调用日志", "Artifact：可预览、可打开、可复用的交付物", "Trace：把消息、工具、策略、产物串起来"],
    takeaway: "Agent 的记忆不是聊天记录，而是可查询的执行账本。",
    notes: "把 SessionDB/FTS 引入：搜索历史任务不是为了聊天回忆，而是为了定位决策、工具和交付物。",
    minutes: 0.85
  },
  {
    chapter: "Deep Dive",
    title: "Progress Stream：即时信任感",
    subtitle: "流式展示的不只是 token，而是状态",
    bullets: ["模型正文流式：减少等待黑箱", "工具事件流式：让用户看到正在读写什么", "状态摘要流式：处理多久、是否等待审批", "异常流式：失败尽早暴露，不等最终回答"],
    takeaway: "Agent UI 的 streaming 应该包含文字、工具、状态三条流。",
    notes: "强调和普通 LLM streaming 不同：只流 token 不够，工具和执行状态也要流。",
    minutes: 0.75
  },
  {
    chapter: "Deep Dive",
    title: "Approval：让人参与关键决策",
    subtitle: "Human-in-the-loop 不是弹窗，而是责任边界",
    bullets: ["请求审批：解释要做什么、为什么做、影响范围", "审批后继续：runtime 能恢复现场", "拒绝后降级：给出替代路径", "审计可追踪：谁在何时批准了什么"],
    takeaway: "审批系统的难点不是问用户，而是恢复执行。",
    notes: "说明审批不是阻碍自动化，而是企业场景下让自动化可用的前提。",
    minutes: 0.8
  },
  {
    chapter: "Deep Dive",
    title: "MCP：外部世界的工具协议",
    subtitle: "把工具、资源、提示词纳入统一生命周期",
    bullets: ["连接：stdio / HTTP / SSE server", "发现：tools / resources / prompts", "转换：模型 tool calls", "治理：审批、调用、展示、审计"],
    takeaway: "MCP 的价值不是多一个插件格式，而是把外部能力变成治理对象。",
    notes: "可以讲 Fiitx 中 MCP 管理页：server 列表、启用/禁用、调用结果、权限策略。",
    minutes: 0.85
  },
  {
    chapter: "Deep Dive",
    title: "Skill：把经验固化为能力",
    subtitle: "从一次成功任务，到可复用 workflow",
    bullets: ["Skill.md：说明触发条件、步骤、约束", "本地安装：从目录或 Git 仓库扫描", "启用/禁用/删除：像软件包一样管理", "自学习：从 session 中生成 Skill 草稿"],
    takeaway: "Skill 是 Agent 团队的知识资产格式。",
    notes: "以 dokie-ai-ppt 为例：这次 PPT 需求本身就是用 Skill 把“如何做演讲 deck”标准化。",
    minutes: 0.85
  },
  {
    chapter: "Deep Dive",
    title: "Profile Isolation：避免上下文污染",
    subtitle: "不同入口应该拥有不同身份和默认假设",
    bullets: ["Workbench：完整上下文，适合复杂任务", "IM Channel：短文本、轻交互、需确认", "Cron：无人值守，默认更保守", "Coding：拥有 workspace，但写入仍需策略约束"],
    takeaway: "Profile 不是用户画像，而是运行边界。",
    notes: "解释为什么 Hermes 的 Profile isolation 很关键，Fiitx 也实现了按 channel/intent/workspace 匹配。",
    minutes: 0.8
  },
  {
    chapter: "Deep Dive",
    title: "SessionDB / FTS：让复盘成为产品能力",
    subtitle: "搜索历史不是辅助功能，而是治理能力",
    bullets: ["按线程搜索：找任务上下文", "按工具搜索：找失败调用", "按产物搜索：找交付路径", "按策略搜索：找审批和风险点"],
    takeaway: "没有可检索历史，就无法从失败中学习。",
    notes: "结合 Settings > Platform 的 session search，说它是以后 Skill self-learning 和评测数据的入口。",
    minutes: 0.8
  },
  {
    chapter: "Deep Dive",
    title: "Model Router：不要让用户理解 MaaS 差异",
    subtitle: "系统负责选择模型，用户负责定义目标",
    bullets: ["能力维度：tools、vision、JSON、streaming、image", "质量维度：成功率、连续失败、熔断状态", "成本维度：input/output price", "体验维度：延迟和可用性"],
    takeaway: "模型路由是 Agent 平台的基础设施，不是高级设置。",
    notes: "强调如果用户配置了多个 MaaS，Fiitx 应该把它们组织成能力池，而不是让用户手动挑。",
    minutes: 0.8
  },
  {
    chapter: "Deep Dive",
    title: "Channel：外部 IM 控制本机 Agent",
    subtitle: "真正的 Digital Worker 应该能被工作流触发",
    bullets: ["WeChat / iLink：移动端任务入口", "Telegram / Slack / Discord：全球协作入口", "VS Code：开发者上下文入口", "Daemon Cron：时间触发入口"],
    takeaway: "Channel 决定任务从哪里来，也决定默认权限和交互密度。",
    notes: "说明 Channels 页面不是展示列表，而是未来不同入口的身份、认证、审计和上下文管理面。",
    minutes: 0.8
  },
  {
    chapter: "Engineering",
    title: "工程原则一：先定义完成标准",
    subtitle: "每个 Agent 任务都要回答“什么叫完成”",
    bullets: ["聊天任务：给出答案和不确定性", "代码任务：文件写入 + 构建/测试通过", "文档任务：文件生成 + 可预览", "运维任务：命令结果 + 回滚方案"],
    takeaway: "没有完成标准，就只能得到漂亮总结。",
    notes: "把 Fiitx 的本地资源、Artifact、执行过程这些功能都解释为完成标准的 UI 表达。",
    minutes: 0.75
  },
  {
    chapter: "Engineering",
    title: "工程原则二：一切输出都要落到事实",
    subtitle: "文件系统、命令退出码、URL、截图、测试结果",
    bullets: ["写文件后立即 stat/read 校验", "启动服务后用浏览器或 HTTP 验证", "Diff 需要真实 base 和 current", "预览文件只显示存在的路径"],
    takeaway: "事实校验是 Agent 产品和文本生成器的分界线。",
    notes: "再次引用“不存在文件不要列出来”的修复，把它抽象成 grounding 原则。",
    minutes: 0.75
  },
  {
    chapter: "Engineering",
    title: "工程原则三：协议字段不能被 UI 简化掉",
    subtitle: "message history 是运行时状态，不只是聊天内容",
    bullets: ["保留 reasoning_content", "保留 tool_calls 和 tool_results", "保留 channel context", "保留 approval decision 和 policy snapshot"],
    takeaway: "Agent Framework 最容易被低估的部分，是消息 schema。",
    notes: "这一页给做 Harness 的工程师：未来模型协议变化会更多，schema 要可扩展。",
    minutes: 0.75
  },
  {
    chapter: "Engineering",
    title: "工程原则四：把失败做成一等公民",
    subtitle: "失败不是边角 case，而是 Agent 迭代燃料",
    bullets: ["分类：模型、权限、路径、依赖、工具、网络", "展示：用户能看懂，不只看 stack trace", "复盘：进入 history 和 audit", "学习：沉淀为 Skill、policy 或 route rule"],
    takeaway: "成熟 Agent 系统不是不失败，而是失败可恢复、可解释、可学习。",
    notes: "用截图中的“已处理但未完成感”作为反例：状态标签必须反映真实风险。",
    minutes: 0.8
  },
  {
    chapter: "Engineering",
    title: "工程原则五：前端性能也是 Agent 架构问题",
    subtitle: "多轮对话越长，UI 越容易成为瓶颈",
    bullets: ["长 trace 默认折叠", "消息和执行事件分层渲染", "大型文件放进 IDE/Artifact，不堆在消息里", "历史线程需要索引和懒加载"],
    takeaway: "Agent 任务越真实，UI 状态越多；性能必须早设计。",
    notes: "回应“任务 chat 轮次太多页面卡顿”的问题。不是简单优化 CSS，而是重新划分信息层级。",
    minutes: 0.75
  },
  {
    chapter: "Engineering",
    title: "工程原则六：Settings 是控制面",
    subtitle: "用户要能理解和改变系统行为",
    bullets: ["Model：配置 provider 和路由", "Policy：配置权限和沙箱", "MCP / Skill：配置外部能力", "Platform：配置 daemon、cron、profile"],
    takeaway: "Agent 平台需要 control plane，而不是只靠 prompt 约束。",
    notes: "把 Fiitx Settings 的几次调整总结为控制面设计原则。",
    minutes: 0.7
  },
  {
    chapter: "Engineering",
    title: "工程原则七：本地优先，云端可选",
    subtitle: "桌面 Agent 的独特优势",
    bullets: ["可直接访问 workspace 和本地应用", "Keychain / safeStorage 保护密钥", "离线状态下保留历史和配置", "外部 Channel 通过受控入口进入本机"],
    takeaway: "Local-first 不是反云，而是把执行权交回用户机器。",
    notes: "这一页解释为什么 Fiitx 是桌面 app，而不是纯 SaaS 网页。",
    minutes: 0.75
  },
  {
    chapter: "Engineering",
    title: "工程原则八：自举能力",
    subtitle: "用 Fiitx 开发 Fiitx，暴露架构真实度",
    bullets: ["发现问题：用户直接在产品里反馈", "修改代码：Agent 读写项目文件", "运行验证：build / smoke test", "沉淀规则：把坑变成产品能力"],
    takeaway: "能自我迭代的 Agent 产品，更容易发现真实工作流问题。",
    notes: "这是全场案例的核心：Fiitx 不是被动演示，而是成为自己的生产环境。",
    minutes: 0.8
  },
  {
    chapter: "Comparison",
    title: "OpenClaw、Hermes、Fiitx 的角色分工",
    subtitle: "三类能力对 Agent 平台都重要",
    bullets: ["OpenClaw：结构化 Agent / Skill / Channel 思路", "Hermes：长期运行、Cron、多 Channel、Profile isolation", "Fiitx：桌面 Workbench、IDE、Artifact、Policy 和本地 workspace", "融合方向：Digital Worker OS"],
    takeaway: "架构演进不是替代，而是吸收不同系统的强项。",
    notes: "避免做谁好谁坏的比较。重点是 Fiitx 在吸收 Hermes 强项后如何补齐生命周期。",
    minutes: 0.85
  },
  {
    chapter: "Comparison",
    title: "为什么要吸收 Hermes 的强项",
    subtitle: "Fiitx 原本强在交互闭环，Hermes 强在后台生命周期",
    bullets: ["Daemon：让 Agent 不依赖前端页面", "Cron：让任务可以按时间发生", "Channels：让外部世界触发本机能力", "Profile isolation：让不同入口互不污染", "SessionDB/FTS：让历史可检索"],
    takeaway: "Digital Worker 的生命周期，比 Chat 会话长得多。",
    notes: "把这几项和刚刚实现的 Platform 页面对应起来。",
    minutes: 0.8
  },
  {
    chapter: "Method",
    title: "架构检查表：十个必须回答的问题",
    subtitle: "做 Agent Framework 前先问清楚",
    bullets: ["谁触发任务？从哪个 channel？", "用哪个 profile？默认权限是什么？", "上下文从哪里来？如何压缩？", "工具如何审批？失败如何恢复？", "结果如何验证？历史如何复盘？"],
    takeaway: "如果这些问题答不上来，系统还停留在 Demo 阶段。",
    notes: "这页可以作为听众拍照页。它是整场演讲的可迁移输出。",
    minutes: 0.85
  },
  {
    chapter: "Method",
    title: "从 Demo 到业务闭环的迁移路径",
    subtitle: "不要一次性建完 Agent OS",
    bullets: ["Step 1：把任务完成标准产品化", "Step 2：把工具调用治理化", "Step 3：把历史和失败结构化", "Step 4：把能力 Skill 化", "Step 5：把 Channel 和 Daemon 接入生产流程"],
    takeaway: "Agent 平台应当从一个闭环场景开始，而不是从功能大而全开始。",
    notes: "给企业落地建议：先选一个高频、可验证、风险可控的场景，不要先做万能助手。",
    minutes: 0.85,
    diagram: "migration"
  },
  {
    chapter: "Method",
    title: "评价 Digital Worker 的五个指标",
    subtitle: "不要只看回答质量",
    bullets: ["Task success：真实完成率", "Grounding：结果和事实的一致性", "Recoverability：失败后可恢复性", "Governance：审批和审计覆盖率", "Learnability：能否沉淀为 Skill 和路由规则"],
    takeaway: "Agent 评测应该覆盖系统行为，而不只是模型输出。",
    notes: "这页可引出后续 Fiitx 的评价系统和 telemetry。",
    minutes: 0.8
  },
  {
    chapter: "Future",
    title: "下一阶段：从 Workbench 到 Worker Mesh",
    subtitle: "多个 Digital Worker 协同，而不是一个大模型助手",
    bullets: ["每个 Worker 有明确职责和 profile", "通过 Channel 接收外部事件", "通过 Skill 复用组织经验", "通过 Policy 共享安全边界", "通过 SessionDB 形成组织记忆"],
    takeaway: "未来的 Agent 平台更像组织系统，而不是聊天工具。",
    notes: "把 Fiitx 的路线放到更大的架构趋势里：worker mesh、skill market、workflow OS。",
    minutes: 0.85
  },
  {
    chapter: "Future",
    title: "还没有完全解决的问题",
    subtitle: "成熟度来自承认边界",
    bullets: ["跨工具事务：部分成功后的回滚仍复杂", "长期记忆：保留什么、忘记什么、谁有权限看", "Skill 质量：自学习草稿如何验证和版本化", "多 Channel 安全：外部 IM 控制本机需要强认证", "模型漂移：Provider 行为变化需要持续监测"],
    takeaway: "Agent OS 的难点不是第一次跑通，而是长期稳定。",
    notes: "技术分享要有诚实边界，避免听众误以为已经全部解决。",
    minutes: 0.85
  },
  {
    chapter: "Future",
    title: "给架构师的三条建议",
    subtitle: "从明天可以做的事情开始",
    bullets: ["把当前 AI 应用的状态模型画出来", "给每个工具调用补上审批、日志和结果校验", "把一个成功 workflow 写成 Skill，而不是写进 prompt"],
    takeaway: "先把一个场景做成闭环，再谈平台化。",
    notes: "这页让听众带走行动项。建议配合前面的检查表一起讲。",
    minutes: 0.75
  },
  {
    chapter: "Takeaway",
    title: "核心洞察一",
    subtitle: "Agent Framework 的本质是“责任工程”",
    bullets: ["让模型知道目标", "让工具有边界", "让结果可验证", "让过程可追踪", "让经验可复用"],
    takeaway: "从 LLM 到 Digital Worker，就是从生成能力到责任能力。",
    notes: "进入收尾，开始压缩全场观点。",
    minutes: 0.7
  },
  {
    chapter: "Takeaway",
    title: "核心洞察二",
    subtitle: "最有价值的不是成功路径，而是失败闭环",
    bullets: ["失败可见：用户知道发生了什么", "失败可诊断：系统知道哪里出了问题", "失败可恢复：运行时可以继续或降级", "失败可学习：沉淀为 Skill、策略和路由"],
    takeaway: "如果失败不能进入系统记忆，Agent 永远停留在一次性 Demo。",
    notes: "强调失败案例的价值，呼应中段的多个坑。",
    minutes: 0.7
  },
  {
    chapter: "Takeaway",
    title: "核心洞察三",
    subtitle: "Digital Worker 需要 Control Plane",
    bullets: ["Model：能力、成本、延迟和 fallback", "Policy：审批、沙箱和敏感操作", "Skill：能力安装、启用和版本", "Channel：入口、身份和上下文", "Platform：Daemon、Cron 和 SessionDB"],
    takeaway: "没有控制面，Agent 就只能靠 prompt 运气运行。",
    notes: "把 Settings 页面作为控制面的具象化。",
    minutes: 0.7
  },
  {
    chapter: "Takeaway",
    title: "把峰值记忆留给听众",
    subtitle: "一句话总结全场",
    bullets: ["不要问模型能不能回答", "要问系统能不能交付", "不要只看 Demo 漂亮不漂亮", "要看失败之后能不能复盘和修复"],
    takeaway: "好的 Agent 系统，是能把不确定性变成可管理工程对象的系统。",
    notes: "这一页是结尾前的峰值时刻，语速放慢。",
    minutes: 0.75
  },
  {
    chapter: "Q&A",
    title: "Q&A：建议讨论的问题",
    subtitle: "10 分钟问答",
    bullets: ["企业内部第一个 Agent 闭环场景怎么选？", "MCP 和 Skill 的边界如何划分？", "模型路由和成本控制怎么做？", "IM 控制本机 Agent 的安全边界在哪里？", "长期记忆和隐私如何平衡？"],
    takeaway: "欢迎从架构、工程、产品和组织落地四个角度提问。",
    notes: "这页作为问答引导，提前把问题聚焦到技术架构和落地方法。",
    minutes: 0.5
  },
  {
    type: "ending",
    chapter: "Ending",
    title: "谢谢",
    subtitle: "从 LLM 到 Digital Worker",
    bullets: ["FIIT.AI / Fiitx", "Agent Framework、OpenClaw、Digital Worker", "让 AI 从回答问题走向完成工作"],
    takeaway: "把模型能力变成可托付的工作系统。",
    notes: "结束页，保留联系方式或二维码位置。现场可口头补充联系渠道。",
    minutes: 0.4
  }
];

if (slides.length !== 60) {
  throw new Error(`Expected 60 slides, got ${slides.length}`);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slideNo(index) {
  return String(index + 1).padStart(2, "0");
}

function htmlForSlide(slide, index) {
  const page = slideNo(index);
  const icon = slide.chapter === "Q&A" ? "fa-comments" : slide.type === "cover" ? "fa-layer-group" : slide.type === "ending" ? "fa-flag-checkered" : "fa-diagram-project";
  const bulletHtml = slide.bullets.map((item) => `<li><span>${esc(item)}</span></li>`).join("\n");
  const diagramHtml = diagramForHtml(slide.diagram);
  const isCover = slide.type === "cover";
  const isEnding = slide.type === "ending";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1280, initial-scale=1.0">
  <title>${esc(slide.title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    :root {
      --blue: #06a9df;
      --deep: #0b2b6b;
      --ink: #111827;
      --muted: #667085;
      --line: #d8edf7;
      --paper: #fbfdff;
      --pale: #eaf8ff;
      --orange: #f59e0b;
      --green: #10b981;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e9f4fb; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Inter", sans-serif; }
    .slide { position: relative; width: 1280px; height: 720px; overflow: hidden; background: #fff; color: var(--ink); }
    .slide.cover, .slide.ending { background: #0b37d9 url("../assets/giac-2026/cover-visual.png") center/cover no-repeat; color: #fff; }
    .grid { display: none; }
    .cover .shade, .ending .shade { position:absolute; left:0; top:0; width:54%; height:100%; background:rgba(7,50,199,.28); }
    .template-arrow { position:absolute; left:36px; top:40px; width:26px; height:auto; }
    .template-giac { position:absolute; right:30px; top:44px; width:74px; height:auto; }
    .template-footer { position:absolute; left:0; right:0; bottom:0; height:38px; background:linear-gradient(90deg,#2288ff 0%,#8eeaf2 100%); border-radius:14px 14px 0 0; }
    .cover .template-footer, .ending .template-footer { display:none; }
    .template-msup { position:absolute; left:30px; bottom:12px; width:140px; height:auto; }
    .content { position: relative; z-index: 2; height: 100%; padding: 38px 78px 54px; display: flex; flex-direction: column; }
    .cover .content, .ending .content { justify-content: flex-start; padding: 192px 74px 70px; max-width: 760px; color: #fff; }
    .eyebrow { color: var(--blue); text-transform: uppercase; letter-spacing: .16em; font-size: 18px; font-weight: 800; margin-bottom: 18px; }
    h1 { margin: 0; font-size: ${isCover ? "52px" : isEnding ? "58px" : "40px"}; line-height: 1.08; letter-spacing: -.04em; max-width: 1000px; }
    h2 { margin: 16px 0 0; color: var(--muted); font-size: ${isCover ? "27px" : "23px"}; line-height: 1.35; font-weight: 600; max-width: 1030px; }
    .cover h1, .ending h1 { color: #fff; }
    .cover h2, .ending h2 { color: #e6f3ff; }
    .cover li span, .ending li span { color: #fff; }
    .main { flex: 1; display: grid; grid-template-columns: ${slide.diagram ? "1.02fr .98fr" : "1fr"}; gap: 38px; align-items: center; margin-top: 28px; }
    ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 15px; }
    li { display: grid; grid-template-columns: 34px 1fr; align-items: start; gap: 12px; font-size: 25px; line-height: 1.34; font-weight: 650; }
    li:before { content: ""; width: 14px; height: 14px; border-radius: 50%; margin-top: 10px; background: var(--blue); box-shadow: 0 0 0 7px #e4f6ff; }
    .takeaway { margin-top: 26px; border-left: 8px solid #2288ff; background: #effbff; padding: 18px 22px; border-radius: 8px; border-top: 1px solid #8edff0; border-right: 1px solid #8edff0; border-bottom: 1px solid #8edff0; font-size: 22px; line-height: 1.3; font-weight: 800; max-width: 1090px; }
    .cover .takeaway, .ending .takeaway { max-width: 640px; color: #fff; background: transparent; border: 0; border-top: 2px solid rgba(142,223,240,.85); border-radius: 0; padding-left: 0; }
    .diagram { min-height: 330px; background: rgba(247,253,255,.92); border: 1px solid #9ddff1; border-radius: 12px; padding: 24px; box-shadow: none; }
    .flow { display: grid; gap: 14px; }
    .flow-row { display: flex; align-items: center; gap: 12px; }
    .node { flex: 1; border: 2px solid #cfe8f5; background: #f6fbff; border-radius: 15px; padding: 14px; font-size: 21px; font-weight: 800; text-align: center; }
    .arrow { color: var(--blue); font-size: 24px; font-weight: 900; }
    .layers { display: grid; gap: 12px; }
    .layer { border-radius: 16px; padding: 16px 20px; color: #0b2b6b; background: linear-gradient(90deg, #dff5ff, #ffffff); border: 2px solid #b8e3f4; font-size: 22px; font-weight: 850; }
    .footer { position: absolute; left: 78px; right: 78px; bottom: 24px; display: flex; justify-content: space-between; color: #8a94a6; font-size: 16px; font-weight: 650; }
    .wave { display:none; }
    .cover-card { position: absolute; right: 146px; bottom: 152px; width: 248px; height: 58px; border-radius: 12px; background: rgba(255,255,255,.9); border: 1px solid #b8e3f4; display:flex; align-items:center; justify-content:center; box-shadow: none; }
    .cover-card img { width: 84px; height: auto; object-fit: contain; }
  </style>
</head>
<body>
  <section class="slide ${isCover ? "cover" : ""} ${isEnding ? "ending" : ""}">
    <div class="shade"></div>
    <div class="grid"></div>
    <div class="template-footer"></div>
    ${isCover || isEnding ? "" : `<img class="template-arrow" src="../assets/giac-2026/arrow-glow.png" alt=""><img class="template-giac" src="../assets/giac-2026/giac-logo-cyan.png" alt="GIAC"><img class="template-msup" src="../assets/giac-2026/msup-archnotes.png" alt="">`}
    ${isCover ? `<div class="cover-card"><img src="../assets/fiitx-logo.png" alt="Fiitx"></div>` : ""}
    <div class="content">
      <div class="eyebrow"><i class="fas ${icon}"></i> ${esc(slide.eyebrow || `Page ${page}`)}</div>
      <h1>${esc(slide.title)}</h1>
      <h2>${esc(slide.subtitle || "")}</h2>
      <div class="main">
        <div>
          <ul>${bulletHtml}</ul>
          <div class="takeaway">${esc(slide.takeaway)}</div>
        </div>
        ${diagramHtml}
      </div>
    </div>
    <div class="footer"><span>${esc(deckSubtitle)}</span><span>${page} / 60</span></div>
  </section>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      gsap.fromTo('.content > *', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .45, stagger: .08, ease: 'power2.out' });
    });
  </script>
</body>
</html>`;
}

function diagramForHtml(kind) {
  if (!kind) return "";
  if (kind === "layers") {
    return `<div class="diagram layers">
      <div class="layer">Interaction: Workbench / IDE / Channels</div>
      <div class="layer">Decision: Intent / Agent / Model Router</div>
      <div class="layer">Execution: Tools / Workspace / MCP / Skill</div>
      <div class="layer">Governance: Policy / Audit / History / Profile</div>
    </div>`;
  }
  if (kind === "orchestrator") {
    return `<div class="diagram flow">
      <div class="flow-row"><div class="node">Intent Router</div><span class="arrow">→</span><div class="node">Agent Registry</div></div>
      <div class="flow-row"><div class="node">Research</div><span class="arrow">→</span><div class="node">Coding</div><span class="arrow">→</span><div class="node">Artifact</div></div>
      <div class="flow-row"><div class="node">Policy Gate</div><span class="arrow">→</span><div class="node">Tool Runtime</div></div>
    </div>`;
  }
  if (kind === "pipeline") {
    return `<div class="diagram flow">
      <div class="flow-row"><div class="node">Prompt + Files</div><span class="arrow">→</span><div class="node">Route</div></div>
      <div class="flow-row"><div class="node">Plan</div><span class="arrow">→</span><div class="node">Tool Loop</div></div>
      <div class="flow-row"><div class="node">Write / Run</div><span class="arrow">→</span><div class="node">Verify / Preview</div></div>
    </div>`;
  }
  if (kind === "migration") {
    return `<div class="diagram flow">
      <div class="flow-row"><div class="node">Demo</div><span class="arrow">→</span><div class="node">Closed Task</div></div>
      <div class="flow-row"><div class="node">Policy</div><span class="arrow">→</span><div class="node">Skill</div></div>
      <div class="flow-row"><div class="node">Channel</div><span class="arrow">→</span><div class="node">Worker Mesh</div></div>
    </div>`;
  }
  return "";
}

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: "PingFang SC",
    margin: 0,
    breakLine: false,
    fit: "shrink",
    ...opts
  });
}

function addTopBar(slide, page, chapter) {
  const isCoverLike = (chapter === "Opening" && page === "01") || chapter === "Ending";
  slide.background = { color: isCoverLike ? "0B37D9" : "FFFFFF" };

  if (isCoverLike && fs.existsSync(GIAC_ASSETS.coverVisual)) {
    slide.addImage({ path: GIAC_ASSETS.coverVisual, x: 0, y: 0, w: 13.333, h: 7.5 });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.45, w: 5.55, h: 6.05, fill: { color: "0732C7", transparency: 10 }, line: { color: "0732C7", transparency: 100 } });
  } else {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", transparency: 100 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.12, w: 13.333, h: 0.38, fill: { color: "76DFF0", transparency: 12 }, line: { color: "76DFF0", transparency: 100 } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.12, w: 5.8, h: 0.38, fill: { color: "2288FF", transparency: 5 }, line: { color: "2288FF", transparency: 100 } });
    if (fs.existsSync(GIAC_ASSETS.arrow)) {
      slide.addImage({ path: GIAC_ASSETS.arrow, x: 0.35, y: 0.42, w: 0.27, h: 0.22 });
    }
    if (fs.existsSync(GIAC_ASSETS.logo)) {
      slide.addImage({ path: GIAC_ASSETS.logo, x: 12.1, y: 0.42, w: 0.62, h: 0.16 });
    }
    if (fs.existsSync(GIAC_ASSETS.msup)) {
      slide.addImage({ path: GIAC_ASSETS.msup, x: 0.28, y: 7.22, w: 1.45, h: 0.16 });
    }
  }

  addText(slide, chapter.toUpperCase(), 10.35, 6.82, 1.15, 0.18, { color: isCoverLike ? "B8D8FF" : "7A8797", fontSize: 7.5, bold: true, align: "right", charSpace: 0.8 });
  addText(slide, `${page} / 60`, 11.62, 6.82, 0.6, 0.18, { color: isCoverLike ? "B8D8FF" : "7A8797", fontSize: 7.5, bold: true, align: "right" });
}

function addWave(slide) {
  // The GIAC template already contains the footer wave and brand chrome.
}

function addBullets(slide, bullets, x, y, w, fontSize = 18, opts = {}) {
  const textColor = opts.color || "111827";
  const dotColor = opts.dotColor || "08A9D6";
  bullets.forEach((item, i) => {
    const yy = y + i * 0.52;
    slide.addShape(pptx.ShapeType.ellipse, { x, y: yy + 0.08, w: 0.09, h: 0.09, fill: { color: dotColor }, line: { color: dotColor } });
    addText(slide, item, x + 0.24, yy, w - 0.25, 0.36, { color: textColor, fontSize, bold: true, fit: "shrink" });
  });
}

function addTakeaway(slide, text, x, y, w, h, fontSize = 18) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: "EFFBFF" }, line: { color: "8EDFF0", width: 1.0 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h, fill: { color: "2288FF" }, line: { color: "2288FF" } });
  addText(slide, text, x + 0.18, y + 0.1, w - 0.28, h - 0.2, { color: "111827", fontSize, bold: true, valign: "mid", fit: "shrink" });
}

function addDiagram(slide, kind, x, y, w, h) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: "F7FDFF" }, line: { color: "9DDFF1", width: 1.0 } });
  if (kind === "cards") {
    ["目标", "工具", "权限", "交付"].forEach((label, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = x + 0.32 + col * ((w - 0.84) / 2);
      const by = y + 0.42 + row * ((h - 1.0) / 2);
      slide.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: (w - 1.05) / 2, h: (h - 1.2) / 2, rectRadius: 0.05, fill: { color: row ? "FFFFFF" : "EAF8FF" }, line: { color: "B8E3F4" } });
      addText(slide, label, bx + 0.18, by + 0.22, (w - 1.3) / 2, 0.28, { color: "0B2B6B", fontSize: 17, bold: true, align: "center" });
    });
    return;
  }
  if (kind === "bars") {
    const values = [82, 64, 48, 36];
    ["可观察", "可治理", "可复盘", "可扩展"].forEach((label, i) => {
      const yy = y + 0.48 + i * 0.58;
      addText(slide, label, x + 0.36, yy, 0.95, 0.18, { color: "0B2B6B", fontSize: 9.5, bold: true });
      slide.addShape(pptx.ShapeType.rect, { x: x + 1.35, y: yy + 0.03, w: 2.35, h: 0.15, fill: { color: "D9F3FF" }, line: { color: "D9F3FF" } });
      slide.addShape(pptx.ShapeType.rect, { x: x + 1.35, y: yy + 0.03, w: 2.35 * values[i] / 100, h: 0.15, fill: { color: i % 2 ? "06A9DF" : "1268FF" }, line: { color: i % 2 ? "06A9DF" : "1268FF" } });
    });
    return;
  }
  if (kind === "matrix") {
    ["模型", "工具", "上下文", "策略"].forEach((label, i) => addText(slide, label, x + 0.58 + i * 0.82, y + 0.38, 0.6, 0.18, { color: "667085", fontSize: 8, bold: true, align: "center" }));
    ["Demo", "产品", "企业"].forEach((label, r) => {
      addText(slide, label, x + 0.28, y + 0.82 + r * 0.56, 0.58, 0.18, { color: "667085", fontSize: 8, bold: true });
      for (let c = 0; c < 4; c += 1) {
        const hot = c <= r + 1;
        slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.72 + c * 0.82, y: y + 0.8 + r * 0.56, w: 0.18, h: 0.18, fill: { color: hot ? "06A9DF" : "D8EDF7" }, line: { color: hot ? "06A9DF" : "D8EDF7" } });
      }
    });
    return;
  }
  const boxes = {
    layers: ["Interaction", "Decision", "Execution", "Governance"],
    orchestrator: ["Intent Router", "Agent Registry", "Specialized Agents", "Tool Runtime"],
    pipeline: ["Input", "Route", "Plan", "Tool Loop", "Verify"],
    migration: ["Demo", "Closed Task", "Governance", "Skill", "Worker Mesh"],
    channel: ["WeChat", "ChannelGateway", "Agent Runtime", "Delivery Queue"],
    policy: ["Request", "Risk", "Approval", "Audit"],
    model: ["Intent", "Provider", "Fallback", "Cost / Latency"],
    skill: ["Experience", "SKILL.md", "MCP Tools", "Reusable Workflow"],
    session: ["Trace", "SessionDB", "FTS Search", "Review"],
    timeline: ["Chat", "Workbench", "Runtime", "Digital Worker"]
  }[kind] || ["输入", "路由", "执行", "验证"];
  boxes.forEach((label, i) => {
    const yy = y + 0.28 + i * ((h - 0.56) / boxes.length);
    slide.addShape(pptx.ShapeType.roundRect, { x: x + 0.35, y: yy, w: w - 0.7, h: 0.42, rectRadius: 0.05, fill: { color: i % 2 ? "FFFFFF" : "EAF8FF" }, line: { color: "B8E3F4" } });
    addText(slide, label, x + 0.52, yy + 0.1, w - 1.05, 0.2, { color: "0B2B6B", fontSize: 14, bold: true, align: "center" });
    if (i < boxes.length - 1) {
      addText(slide, "↓", x + w / 2 - 0.08, yy + 0.44, 0.18, 0.16, { color: "06A9DF", fontSize: 13, bold: true, align: "center" });
    }
  });
}

function autoVisualKind(item, index) {
  if (item.diagram) return item.diagram;
  if (item.chapter === "Opening") return index === 2 ? "timeline" : "cards";
  if (item.chapter === "Problem") return "bars";
  if (item.chapter === "Definition") return "matrix";
  if (item.chapter === "Architecture") {
    if (/Policy|审批|权限/.test(item.title)) return "policy";
    if (/Model|MaaS|模型/.test(item.title)) return "model";
    if (/MCP|Skill/.test(item.title)) return "skill";
    if (/Channel|微信|IM/.test(item.title)) return "channel";
    return "layers";
  }
  if (item.chapter === "Case") return index % 2 ? "pipeline" : "bars";
  if (item.chapter === "Deep Dive") {
    if (/Session|Trace|FTS|复盘/.test(item.title)) return "session";
    if (/Model|Router/.test(item.title)) return "model";
    if (/Channel|IM/.test(item.title)) return "channel";
    return "pipeline";
  }
  if (item.chapter === "Engineering") return "cards";
  if (item.chapter === "Comparison") return "matrix";
  if (item.chapter === "Method") return "migration";
  if (item.chapter === "Future" || item.chapter === "Takeaway") return "timeline";
  if (item.chapter === "Q&A") return "cards";
  return "pipeline";
}

function buildPptx() {
  const deck = new PptxGenJS();
  pptx = deck;
  deck.layout = "LAYOUT_WIDE";
  deck.author = speaker;
  deck.company = "FIIT.AI";
  deck.subject = deckSubtitle;
  deck.title = deckTitle;
  deck.lang = "zh-CN";
  deck.theme = {
    headFontFace: "PingFang SC",
    bodyFontFace: "PingFang SC",
    lang: "zh-CN"
  };

  slides.forEach((item, index) => {
    const page = slideNo(index);
    const slide = deck.addSlide();
    addTopBar(slide, page, item.chapter);
    addWave(slide);
    if (item.type === "cover") {
      addText(slide, item.eyebrow, 0.75, 1.96, 6.9, 0.22, { color: "BFEFFF", fontSize: 10.5, bold: true, charSpace: 1.2 });
      addText(slide, item.title, 0.74, 2.42, 6.9, 0.9, { color: "FFFFFF", fontSize: 38, bold: true, fit: "shrink" });
      addText(slide, item.subtitle, 0.76, 3.36, 6.7, 0.42, { color: "E6F3FF", fontSize: 18, bold: true });
      addBullets(slide, item.bullets.slice(0, 2), 0.82, 4.15, 5.7, 12.8, { color: "FFFFFF", dotColor: "8EDFF0" });
      slide.addShape(pptx.ShapeType.rect, { x: 0.76, y: 5.16, w: 5.85, h: 0.02, fill: { color: "8EDFF0", transparency: 15 }, line: { color: "8EDFF0", transparency: 100 } });
      addText(slide, item.takeaway, 0.76, 5.38, 6.45, 0.54, { color: "FFFFFF", fontSize: 15.5, bold: true, fit: "shrink" });
      slide.addShape(pptx.ShapeType.roundRect, { x: 9.22, y: 5.32, w: 2.58, h: 0.58, rectRadius: 0.08, fill: { color: "FFFFFF", transparency: 10 }, line: { color: "B8E3F4", width: 1.0 } });
      if (fs.existsSync(LOGO_OUT)) {
        slide.addImage({ path: LOGO_OUT, x: 9.42, y: 5.49, w: 0.78, h: 0.22, sizing: { type: "contain", x: 9.42, y: 5.49, w: 0.78, h: 0.22 } });
      }
      addText(slide, speaker, 10.25, 5.47, 1.25, 0.18, { color: "111827", fontSize: 8.5, bold: true, align: "center" });
    } else if (item.type === "ending") {
      addText(slide, item.title, 0.74, 2.12, 5.9, 0.82, { color: "FFFFFF", fontSize: 48, bold: true });
      addText(slide, item.subtitle, 0.76, 3.04, 6.5, 0.36, { color: "E6F3FF", fontSize: 22, bold: true });
      addBullets(slide, item.bullets, 0.82, 3.82, 6.2, 15, { color: "FFFFFF", dotColor: "8EDFF0" });
      slide.addShape(pptx.ShapeType.rect, { x: 0.76, y: 5.52, w: 5.85, h: 0.02, fill: { color: "8EDFF0", transparency: 15 }, line: { color: "8EDFF0", transparency: 100 } });
      addText(slide, item.takeaway, 0.76, 5.76, 6.3, 0.34, { color: "FFFFFF", fontSize: 16, bold: true, fit: "shrink" });
      slide.addShape(pptx.ShapeType.roundRect, { x: 9.2, y: 2.25, w: 2.6, h: 2.6, rectRadius: 0.1, fill: { color: "EAF8FF" }, line: { color: "B8E3F4" } });
      if (fs.existsSync(LOGO_OUT)) {
        slide.addImage({ path: LOGO_OUT, x: 9.58, y: 3.07, w: 1.82, h: 0.55, sizing: { type: "contain", x: 9.58, y: 3.07, w: 1.82, h: 0.55 } });
      }
    } else {
      const visual = autoVisualKind(item, index);
      addText(slide, item.title, 0.82, 0.38, 7.1, 0.48, { color: "111827", fontSize: 28, bold: true, fit: "shrink" });
      addText(slide, item.subtitle, 0.84, 1.06, 7.0, 0.28, { color: "667085", fontSize: 14.2, bold: true, fit: "shrink" });
      addText(slide, `${item.chapter.toUpperCase()} · ${slideNo(index)}`, 0.86, 6.82, 1.72, 0.15, { color: "7A8797", fontSize: 7.2, bold: true, charSpace: 0.7 });
      addBullets(slide, item.bullets, 0.93, 1.78, 6.25, item.bullets.length > 4 ? 13.2 : 14.8);
      addTakeaway(slide, item.takeaway, 0.86, 5.65, 6.65, 0.62, 16);
      addDiagram(slide, visual, 8.08, 1.62, 4.15, 3.82);
    }
    if (typeof slide.addNotes === "function") {
      slide.addNotes(`预计 ${item.minutes} 分钟。${item.notes}`);
    }
  });
  return deck.writeFile({ fileName: PPTX_PATH });
}

function writeTextArtifacts() {
  const totalMinutes = slides.reduce((sum, slide) => sum + Number(slide.minutes || 0), 0);
  const outline = slides.map((slide, index) => [
    `# Page ${index + 1}. ${slide.title}`,
    `- Title: ${slide.title}`,
    `- SubTitle: ${slide.subtitle || ""}`,
    "- Content:",
    ...slide.bullets.map((item) => `  - ${item}`),
    `  - Kicker: ${slide.takeaway}`,
    `- Design: ${slide.diagram ? "Left text with right diagram, grid paper background and blue speaker-reminder bar" : "Single-topic layout, grid paper background, blue speaker-reminder bar, highlighted takeaway"}`,
    ""
  ].join("\n")).join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "outline.txt"), outline, "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "speaker_notes.txt"), [
    `${deckTitle}: ${deckSubtitle}`,
    `Speaker: ${speaker}`,
    `Talk: ${totalMinutes.toFixed(1)} minutes planned, plus 10 minutes Q&A`,
    "",
    ...slides.map((slide, index) => `${String(index + 1).padStart(2, "0")}. [${slide.minutes} min] ${slide.title}\n    ${slide.notes}\n    Takeaway: ${slide.takeaway}`)
  ].join("\n\n"), "utf8");
}

function writeHtmlSlides() {
  slides.forEach((slide, index) => {
    fs.writeFileSync(path.join(SLIDES_DIR, `slide_${slideNo(index)}.html`), htmlForSlide(slide, index), "utf8");
  });
  fs.writeFileSync(path.join(SLIDES_DIR, "index.html"), `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${esc(deckTitle)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#eef7fb;margin:0;padding:32px;color:#111827}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}a{display:block;padding:18px;border-radius:16px;background:white;color:#0b2b6b;text-decoration:none;font-weight:800;box-shadow:0 8px 30px rgba(0,0,0,.06)}span{display:block;color:#667085;font-size:13px;margin-top:8px}</style></head>
<body><h1>${esc(deckTitle)}</h1><p>${esc(deckSubtitle)}</p><div class="grid">${slides.map((slide, index) => `<a href="./slide_${slideNo(index)}.html">Page ${index + 1}: ${esc(slide.title)}<span>${esc(slide.chapter)}</span></a>`).join("")}</div></body></html>`, "utf8");
}

writeHtmlSlides();
writeTextArtifacts();
await buildPptx();

console.log(JSON.stringify({
  pptx: PPTX_PATH,
  html: path.join(SLIDES_DIR, "index.html"),
  slides: slides.length,
  outputDir: OUTPUT_DIR
}, null, 2));
