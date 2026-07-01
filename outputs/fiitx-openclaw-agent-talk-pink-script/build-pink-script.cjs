const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = __dirname;
const CHECKS_DIR = path.join(OUT_DIR, "checks");
const OUTLINE_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/outline.txt");
const NOTES_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/speaker_notes.txt");
const VIEWPORT_CSS_PATH = "/Users/botbotbot/.codex/skills/frontend-slides/viewport-base.css";
const LOGO_PATH = path.join(ROOT, "assets/fiitx-logo.png");
const INTRO_PATH = path.join(ROOT, "assets/intro.png");
const EVENT_POSTER_PATH = "/Users/botbotbot/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/airbai_d805/temp/RWTemp/2026-06/2f1ca2312bf3c1265fe4b48c61a6c991/bf9dc3114fdc2b1e8169ca9150db0274.jpg";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CHECKS_DIR, { recursive: true });

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readMaybe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function dataUrl(filePath, type = "image/png") {
  try {
    return `data:${type};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch {
    return "";
  }
}

function parseOutline(text) {
  const blocks = text.split(/\n(?=# Page \d+\.)/g).filter(Boolean);
  return blocks.map((block) => {
    const pageMatch = block.match(/^# Page\s+(\d+)\.\s*(.+)$/m);
    const titleMatch = block.match(/^- Title:\s*(.+)$/m);
    const subTitleMatch = block.match(/^- SubTitle:\s*(.+)$/m);
    const kickerMatch = block.match(/^\s+- Kicker:\s*(.+)$/m);
    const contentMatch = block.match(/- Content:\n([\s\S]*?)(?:\n- Design:|$)/);
    const bullets = [];
    if (contentMatch) {
      for (const line of contentMatch[1].split("\n")) {
        const match = line.match(/^\s+-\s+(.+)$/);
        if (match && !match[1].startsWith("Kicker:")) bullets.push(match[1].trim());
      }
    }
    return {
      page: Number(pageMatch?.[1] || 0),
      title: (titleMatch?.[1] || pageMatch?.[2] || "").trim(),
      subtitle: (subTitleMatch?.[1] || "").trim(),
      bullets,
      kicker: (kickerMatch?.[1] || "").trim()
    };
  });
}

function parseNotes(text) {
  const notes = new Map();
  const regex = /^(\d{2})\.\s+\[([^\]]+)\]\s+(.+?)\n\s+(.+?)\n\s+Takeaway:\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(text))) {
    notes.set(Number(match[1]), {
      timing: match[2].trim(),
      title: match[3].trim(),
      note: match[4].trim(),
      takeaway: match[5].trim()
    });
  }
  return notes;
}

const sourceFacts = {
  hermes: ["daemon / scheduler", "web + telegram + discord channels", "SessionDB + full-text search", "profile isolation"],
  fiitx: ["local-first Electron workbench", "policy gates + audit", "model router + BYOM", "MCP / Skill runtime"],
  openclaw: ["agent framework", "memory + external world", "business actions", "operable digital worker"],
  pi: ["coding-agent kernel", "tool protocol", "workspace edits", "verification loop"]
};

const visualOverrides = new Map([
  [1, "cover"],
  [2, "big-question"],
  [3, "agenda"],
  [4, "manifesto"],
  [8, "definition-map"],
  [11, "stack"],
  [14, "orchestrator"],
  [20, "case-file"],
  [29, "runtime-flow"],
  [30, "state-table"],
  [32, "approval"],
  [33, "protocol"],
  [34, "skill-card"],
  [47, "comparison-table"],
  [49, "checklist"],
  [50, "migration"],
  [51, "metrics"],
  [52, "mesh"],
  [53, "risk-matrix"],
  [60, "closing"]
]);

function slideKind(slide) {
  if (visualOverrides.has(slide.page)) return visualOverrides.get(slide.page);
  if (/第一层|第二层|第三层|第四层|第五层|第六层|第七层|第八层/.test(slide.title)) return "layer";
  if (/问题线|幻觉|坑|原则/.test(slide.title)) return "case-file";
  if (/架构|闭环|运行时|状态模型|Router|Runtime|Policy|MCP|Skill|Channel/.test(slide.title)) return "diagram";
  if (/路线|阶段|迁移|下一阶段/.test(slide.title)) return "timeline";
  return slide.page % 4 === 0 ? "paper-quote" : "editorial";
}

function splitLabel(text) {
  const [head, ...rest] = String(text).split("：");
  return {
    head: head.trim(),
    body: rest.join("：").trim() || text
  };
}

function bulletList(items, limit = 5) {
  return `<ul class="bullet-list">${items.slice(0, limit).map((item, index) => `
    <li class="reveal" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(item)}</span>
    </li>`).join("")}</ul>`;
}

function tagRow(items, limit = 5) {
  return `<div class="tag-row reveal">${items.slice(0, limit).map((item) => `<span>${esc(splitLabel(item).head)}</span>`).join("")}</div>`;
}

function sourceStrip() {
  return `<div class="source-strip reveal">
    <span>Hermes architecture</span>
    <span>OpenClaw</span>
    <span>Fiitx repo</span>
    <span>Pi coding-agent</span>
  </div>`;
}

function architectureStack(slide) {
  const layers = slide.bullets.slice(0, 4).map(splitLabel);
  return `<div class="stack-visual">
    ${layers.map((item, index) => `
      <div class="stack-layer reveal" style="--d:${index}">
        <div>
          <b>${esc(item.head)}</b>
          <span>${esc(item.body)}</span>
        </div>
        <i>${String(index + 1).padStart(2, "0")}</i>
      </div>`).join("")}
    <div class="loop-label">input → decision → execution → verification → review</div>
  </div>`;
}

function flowVisual(items, labels = ["Intent", "Context", "Plan", "Tool", "Artifact", "Review"]) {
  const nodes = labels;
  return `<div class="flow-visual">
    ${nodes.map((label, index) => `
      <div class="flow-node reveal" style="--d:${index}">
        <b>${String(index + 1).padStart(2, "0")}</b>
        <span>${esc(label)}</span>
      </div>
      ${index < nodes.length - 1 ? '<div class="flow-edge"></div>' : ""}`).join("")}
  </div>`;
}

function tableRows(rows) {
  return rows.map((row, index) => `
    <div class="table-row reveal" style="--d:${index}">
      ${row.map((cell) => `<span>${esc(cell)}</span>`).join("")}
    </div>`).join("");
}

function body(slide, note, kind) {
  if (kind === "cover") {
    const poster = dataUrl(EVENT_POSTER_PATH, "image/jpeg");
    const logo = dataUrl(LOGO_PATH, "image/png");
    return `<div class="cover-layout">
      <section class="cover-copy">
        <div class="kicker reveal">GIAC 2026 / Agent Architecture</div>
        <h1 class="cover-title reveal">${esc(slide.title)}</h1>
        <p class="cover-subtitle reveal">${esc(slide.subtitle)}</p>
        <div class="cover-meta reveal">
          <span>白朋飞 / FIIT.AI</span>
          <span>OpenClaw Architecture</span>
          <span>50 min + Q&amp;A</span>
        </div>
      </section>
      <section class="cover-paper reveal">
        ${poster ? `<img src="${poster}" alt="GIAC event poster" />` : ""}
        <div class="logo-line">${logo ? `<img src="${logo}" alt="Fiitx logo" />` : ""}<span>Digital Worker Workbench</span></div>
      </section>
    </div>`;
  }

  if (kind === "closing") {
    return `<div class="closing-wrap">
      <div class="script-mark reveal">Q&amp;A</div>
      <h2 class="closing-title reveal">${esc(slide.title)}</h2>
      <p class="closing-subtitle reveal">${esc(slide.subtitle)}</p>
      <blockquote class="closing-quote reveal">${esc(slide.kicker || note?.takeaway || "")}</blockquote>
    </div>`;
  }

  if (kind === "agenda") {
    const rows = slide.bullets.slice(0, 4).map((item, index) => [String(index + 1).padStart(2, "0"), item.replace(/^第.段：/, ""), index < 2 ? "architecture" : "practice"]);
    return `<div class="agenda-layout">
      <div class="paper-note reveal">
        <b>50 MINUTES</b>
        <span>one talk arc, four acts, speaker-led density</span>
      </div>
      <div class="agenda-table">${tableRows(rows)}</div>
    </div>`;
  }

  if (kind === "manifesto" || kind === "big-question") {
    return `<div class="manifesto-layout">
      <blockquote class="hero-quote reveal">${esc(slide.subtitle || slide.kicker)}</blockquote>
      <div class="manifesto-grid">
        ${slide.bullets.slice(0, 4).map((item, index) => `
          <article class="manifesto-item reveal" style="--d:${index}">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <span>${esc(item)}</span>
          </article>`).join("")}
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "definition-map") {
    return `<div class="definition-map">
      <div class="worker-core reveal"><span>Digital</span><b>Worker</b></div>
      ${slide.bullets.slice(0, 5).map((item, index) => {
        const label = splitLabel(item);
        return `<div class="radial-item radial-${index} reveal" style="--d:${index}">
          <b>${esc(label.head)}</b><span>${esc(label.body)}</span>
        </div>`;
      }).join("")}
      <div class="takeaway map-takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "stack") {
    return `<div class="split-layout">
      <div>
        ${bulletList(slide.bullets, 4)}
        <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
      </div>
      ${architectureStack(slide)}
    </div>`;
  }

  if (kind === "orchestrator") {
    return `<div class="orchestrator-layout">
      <div class="hub reveal">Agent<br/>Orchestrator</div>
      ${["Research", "Coding", "Artifact", "Chat"].map((label, index) => `
        <div class="agent-node agent-${index} reveal" style="--d:${index}">
          <b>${label}</b><span>${esc(slide.bullets[index] || "")}</span>
        </div>`).join("")}
      <div class="takeaway orchestrator-takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "runtime-flow") {
    return `<div class="runtime-flow">
      ${flowVisual(slide.bullets, ["一句话", "Intent", "Context", "Tool", "File stat", "Artifact"])}
      <div class="runtime-caption reveal">
        <b>落盘闭环</b>
        <span>${esc(slide.kicker || note?.takeaway || "")}</span>
      </div>
    </div>`;
  }

  if (kind === "state-table") {
    const rows = [
      ["Thread", "长期上下文", "用户目标、历史摘要、结构化记忆"],
      ["Session", "一次执行账本", "工具调用、审批、错误、trace"],
      ["Artifact", "可交付结果", "文件、预览、导出物、验证记录"]
    ];
    return `<div class="state-layout">
      <div class="state-table">${tableRows(rows)}</div>
      <div class="ledger-visual reveal">
        <b>SessionDB</b>
        <span>searchable execution ledger</span>
        <i>FTS</i><i>trace</i><i>audit</i>
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "approval") {
    return `<div class="approval-layout">
      ${flowVisual(slide.bullets, ["request", "risk score", "human gate", "resume", "audit"])}
      <div class="approval-branch reveal">
        <span>approve → continue</span>
        <span>reject → explain / rollback</span>
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "protocol" || kind === "skill-card") {
    const facts = kind === "protocol" ? sourceFacts.openclaw : sourceFacts.pi;
    return `<div class="protocol-layout">
      <div class="protocol-grid">
        ${facts.map((item, index) => `<span class="reveal" style="--d:${index}">${esc(item)}</span>`).join("")}
      </div>
      <div class="paper-quote-box reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
      ${tagRow(slide.bullets, 4)}
    </div>`;
  }

  if (kind === "comparison-table") {
    const rows = [
      ["OpenClaw", "Agent Framework", "把模型能力组织成可运行、可记忆、可连接外部世界的系统"],
      ["Hermes", "Lifecycle Runtime", "daemon、scheduler、channels、session search、profile isolation"],
      ["Pi coding-agent", "Agent Kernel", "面向编码任务的工具协议、文件编辑、验证闭环"],
      ["Fiitx", "Local Workbench", "把上述思想落到桌面、workspace、审批、MCP/Skill 与模型路由"]
    ];
    return `<div class="comparison-layout">
      <div class="comparison-table">${tableRows(rows)}</div>
      ${sourceStrip()}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "checklist") {
    const questions = [
      "目标与完成标准",
      "上下文与记忆边界",
      "工具协议与错误分类",
      "审批、审计、回滚",
      "模型能力矩阵",
      "Channel 身份隔离",
      "Session 可检索",
      "交付物可验证",
      "失败可恢复",
      "经验可沉淀为 Skill"
    ];
    return `<div class="checklist-grid">
      ${questions.map((item, index) => `<div class="check-item reveal" style="--d:${index}"><b>${String(index + 1).padStart(2, "0")}</b><span>${esc(item)}</span></div>`).join("")}
    </div>`;
  }

  if (kind === "migration") {
    return `<div class="migration-layout">
      ${["高频场景", "可验证交付", "低风险工具", "审批闭环", "复盘数据", "技能市场"].map((item, index) => `
        <div class="step-card reveal" style="--d:${index}; --step:${index}">
          <b>${String(index + 1).padStart(2, "0")}</b><span>${esc(item)}</span>
        </div>`).join("")}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "metrics") {
    const rows = [
      ["交付成功率", 92],
      ["人工打断率", 34],
      ["可复盘覆盖", 78],
      ["工具失败恢复", 63],
      ["Skill 复用", 52]
    ];
    return `<div class="metrics-layout">
      <div class="bar-chart">
        ${rows.map(([label, value], index) => `<div class="bar-row reveal" style="--d:${index}">
          <span>${esc(label)}</span>
          <i><b style="width:${value}%"></b></i>
          <em>${value}%</em>
        </div>`).join("")}
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "mesh") {
    return `<div class="mesh-layout">
      <div class="mesh-node mesh-core reveal">Worker<br/>Mesh</div>
      ${["Workbench", "Skill Market", "Channel", "Policy", "Telemetry", "Workflow OS"].map((item, index) => `
        <div class="mesh-node mesh-${index} reveal" style="--d:${index}">${esc(item)}</div>`).join("")}
      <div class="takeaway mesh-takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "risk-matrix") {
    const rows = [
      ["长期稳定", "需要任务级调度、重试和崩溃恢复"],
      ["评测体系", "不能只看回答质量，要看系统行为"],
      ["技能治理", "版本、权限、回滚、依赖还要产品化"],
      ["组织采用", "从单点闭环扩展到跨部门工作流"]
    ];
    return `<div class="risk-layout">
      <div class="risk-table">${tableRows(rows)}</div>
      <div class="paper-quote-box reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "case-file") {
    return `<div class="case-layout">
      <div class="case-paper">
        <b>FIELD NOTE / ${String(slide.page).padStart(2, "0")}</b>
        <p>${esc(note?.note || slide.subtitle)}</p>
      </div>
      <div class="case-board">
        ${slide.bullets.slice(0, 4).map((item, index) => `<div class="case-slip slip-${index} reveal" style="--d:${index}"><span>${esc(item)}</span></div>`).join("")}
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "timeline" || kind === "layer" || kind === "diagram") {
    return `<div class="split-layout">
      <div>
        ${bulletList(slide.bullets, 5)}
        <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
      </div>
      <div class="diagram-panel reveal">
        ${flowVisual(slide.bullets, slide.bullets.slice(0, 5).map((item) => splitLabel(item).head))}
      </div>
    </div>`;
  }

  if (kind === "paper-quote") {
    return `<div class="quote-layout">
      <blockquote class="hero-quote reveal">${esc(slide.kicker || slide.subtitle)}</blockquote>
      ${bulletList(slide.bullets, 4)}
    </div>`;
  }

  return `<div class="editorial-layout">
    <div class="paper-quote-box reveal">${esc(slide.kicker || slide.subtitle)}</div>
    <div>
      ${bulletList(slide.bullets, 5)}
      ${tagRow(slide.bullets, 4)}
    </div>
  </div>`;
}

function renderSlide(slide, note, total) {
  const kind = slideKind(slide);
  const active = slide.page === 1 ? " active visible" : "";
  return `<section class="slide slide-${kind}${active}" data-slide="${slide.page}" data-kind="${kind}">
    <div class="canvas-noise"></div>
    <div class="hot-rule top"></div>
    <div class="hot-rule side"></div>
    <div class="deck-chrome">
      <span>FIIT.AI / OPENCLAW</span>
      <span>${String(slide.page).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
    </div>
    <div class="folio">${String(slide.page).padStart(2, "0")}</div>
    <div class="slide-frame">
      ${kind !== "cover" && kind !== "closing" ? `<header class="slide-header">
        <div class="kicker reveal">From LLM to Digital Worker</div>
        <h2 class="reveal">${esc(slide.title)}</h2>
        <p class="reveal">${esc(slide.subtitle)}</p>
      </header>` : ""}
      <main class="slide-main">${body(slide, note, kind)}</main>
    </div>
    ${note?.note ? `<!-- speaker-note: ${esc(note.note)} -->` : ""}
  </section>`;
}

function css(viewportCss) {
  return `
/* === FONT IMPORTS === */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');

/* === THEME TOKENS === */
:root {
  --stage-bg: #050203;
  --slide-bg: #050203;
  --ink: #14060a;
  --canvas: #050203;
  --canvas-soft: #14070c;
  --paper: #f6ead1;
  --paper-deep: #ead7af;
  --paper-muted: #b8a889;
  --pink: #ff2e93;
  --pink-deep: #b5005b;
  --cream: #fff7e6;
  --line: rgba(255, 247, 230, 0.26);
  --paper-line: rgba(20, 6, 10, 0.18);
  --shadow: rgba(0, 0, 0, 0.48);
  --display: "Instrument Serif", "Noto Serif SC", serif;
  --serif-cn: "Noto Serif SC", "Instrument Serif", serif;
  --body: "Noto Sans SC", sans-serif;
  --mono: "JetBrains Mono", monospace;
}

/* === RESET AND FIXED VIEWPORT === */
* { box-sizing: border-box; }
${viewportCss}

/* === BASE CANVAS === */
body { font-family: var(--body); color: var(--cream); }
.slide {
  background:
    linear-gradient(90deg, rgba(255, 46, 147, 0.08) 0 1px, transparent 1px 120px),
    linear-gradient(180deg, rgba(255, 247, 230, 0.055) 0 1px, transparent 1px 120px),
    linear-gradient(135deg, #050203 0%, #12060b 64%, #1c0711 100%);
}
.canvas-noise {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  mix-blend-mode: screen;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.36'/%3E%3C/svg%3E");
  pointer-events: none;
}
.slide::before {
  content: "";
  position: absolute;
  inset: 48px;
  border: 1.5px solid var(--line);
  pointer-events: none;
}
.hot-rule {
  position: absolute;
  background: var(--pink);
  box-shadow: 0 0 28px rgba(255, 46, 147, 0.34);
  pointer-events: none;
}
.hot-rule.top { left: 92px; top: 82px; width: 210px; height: 6px; }
.hot-rule.side { right: 78px; top: 160px; width: 6px; height: 420px; }
.slide-frame {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 100px 124px 86px;
}
.deck-chrome {
  position: absolute;
  left: 124px;
  right: 124px;
  bottom: 48px;
  display: flex;
  justify-content: space-between;
  color: rgba(255, 247, 230, 0.58);
  font: 700 20px var(--mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  z-index: 4;
}
.folio {
  position: absolute;
  right: 126px;
  top: 86px;
  z-index: 2;
  color: rgba(255, 247, 230, 0.12);
  font-family: var(--display);
  font-size: 164px;
  line-height: 0.8;
}

/* === TYPOGRAPHY === */
.kicker {
  color: var(--pink);
  font: 700 22px var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.slide-header { max-width: 1350px; }
.slide-header h2 {
  margin: 18px 0 12px;
  color: var(--cream);
  font-family: var(--serif-cn);
  font-size: 78px;
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: 0;
}
.slide-header p {
  margin: 0;
  max-width: 1080px;
  color: rgba(255, 247, 230, 0.76);
  font-size: 32px;
  font-weight: 500;
  line-height: 1.28;
}
.slide-main { margin-top: 52px; position: relative; }
.takeaway {
  padding: 28px 34px;
  color: var(--ink);
  background: var(--paper);
  border-left: 10px solid var(--pink);
  box-shadow: 0 26px 60px var(--shadow);
  font-family: var(--serif-cn);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}

/* === ANIMATION === */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  filter: blur(5px);
  transition: opacity 740ms cubic-bezier(.16,1,.3,1), transform 740ms cubic-bezier(.16,1,.3,1), filter 740ms cubic-bezier(.16,1,.3,1);
  transition-delay: calc(80ms + var(--d, 0) * 80ms);
}
.slide.visible .reveal { opacity: 1; transform: translateY(0); filter: blur(0); }

/* === COVER === */
.cover-layout {
  height: 842px;
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  gap: 76px;
  align-items: center;
}
.cover-title {
  margin: 30px 0 26px;
  color: var(--cream);
  font-family: var(--display);
  font-size: 148px;
  font-weight: 400;
  line-height: 0.84;
}
.cover-subtitle {
  margin: 0;
  max-width: 900px;
  color: rgba(255, 247, 230, 0.84);
  font-size: 38px;
  font-weight: 700;
  line-height: 1.18;
}
.cover-meta { margin-top: 56px; display: flex; flex-wrap: wrap; gap: 14px; }
.cover-meta span {
  padding: 14px 20px;
  color: var(--cream);
  border: 1px solid rgba(255, 247, 230, 0.28);
  background: rgba(255, 46, 147, 0.10);
  font: 700 20px var(--mono);
  text-transform: uppercase;
}
.cover-paper {
  position: relative;
  height: 760px;
  padding: 26px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 42px 100px rgba(0, 0, 0, 0.52);
  transform: rotate(1.2deg);
}
.cover-paper img { width: 100%; height: 640px; object-fit: cover; object-position: top center; display: block; filter: saturate(.82) contrast(1.04); }
.logo-line { height: 76px; display: flex; align-items: center; gap: 18px; color: var(--ink); font: 700 22px var(--mono); }
.logo-line img { width: 118px; height: auto; object-fit: contain; filter: none; }

/* === COMMON LAYOUTS === */
.split-layout, .editorial-layout, .quote-layout {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 64px;
  align-items: start;
}
.bullet-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 20px; }
.bullet-list li {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 18px;
  align-items: start;
  color: var(--cream);
  font-size: 31px;
  font-weight: 700;
  line-height: 1.24;
}
.bullet-list b {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--pink);
  font: 700 18px var(--mono);
}
.paper-quote-box, .hero-quote, .paper-note {
  margin: 0;
  padding: 42px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--paper-line);
  box-shadow: 0 28px 70px var(--shadow);
}
.paper-quote-box, .hero-quote {
  font-family: var(--serif-cn);
  font-size: 46px;
  font-weight: 900;
  line-height: 1.12;
}
.tag-row { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 12px; }
.tag-row span, .source-strip span {
  padding: 10px 15px;
  color: var(--cream);
  background: rgba(255, 46, 147, 0.16);
  border: 1px solid rgba(255, 46, 147, 0.44);
  font: 700 17px var(--mono);
}
.source-strip { display: flex; gap: 12px; flex-wrap: wrap; }

/* === AGENDA AND MANIFESTO === */
.agenda-layout { display: grid; grid-template-columns: 430px 1fr; gap: 58px; align-items: start; }
.paper-note b { display: block; color: var(--pink); font: 700 28px var(--mono); margin-bottom: 18px; }
.paper-note span { display: block; font: 900 44px/1.08 var(--serif-cn); }
.agenda-table, .comparison-table, .state-table, .risk-table {
  display: grid;
  gap: 12px;
}
.table-row {
  display: grid;
  grid-template-columns: 110px 1.2fr 1.7fr;
  gap: 18px;
  align-items: center;
  padding: 22px 24px;
  background: var(--paper);
  color: var(--ink);
  border-left: 8px solid var(--pink);
  box-shadow: 0 18px 44px rgba(0,0,0,.26);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.24;
}
.table-row span:first-child { color: var(--pink-deep); font: 700 24px var(--mono); }
.manifesto-layout { display: grid; gap: 34px; }
.manifesto-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.manifesto-item {
  min-height: 180px;
  padding: 28px;
  color: var(--cream);
  border: 1px solid rgba(255, 247, 230, 0.25);
  background: rgba(255, 247, 230, 0.055);
}
.manifesto-item b { display: block; color: var(--pink); font: 700 22px var(--mono); margin-bottom: 18px; }
.manifesto-item span { font-size: 26px; font-weight: 700; line-height: 1.24; }

/* === DIAGRAMS === */
.stack-visual { position: relative; display: grid; gap: 20px; padding-top: 10px; }
.stack-layer {
  display: grid;
  grid-template-columns: 1fr 72px;
  align-items: center;
  min-height: 112px;
  padding: 22px 26px;
  color: var(--ink);
  background: var(--paper);
  border-left: 10px solid var(--pink);
  box-shadow: 0 20px 50px rgba(0,0,0,.33);
}
.stack-layer b { display: block; font: 900 31px var(--serif-cn); }
.stack-layer span { display: block; margin-top: 7px; font-size: 22px; font-weight: 700; color: rgba(20,6,10,.74); }
.stack-layer i { color: var(--pink-deep); font: 700 28px var(--mono); font-style: normal; text-align: right; }
.loop-label {
  margin-top: 16px;
  color: var(--pink);
  font: 700 22px var(--mono);
  letter-spacing: .05em;
  text-transform: uppercase;
}
.flow-visual { display: flex; align-items: center; justify-content: center; gap: 0; }
.flow-node {
  width: 190px;
  height: 150px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--ink);
  background: var(--paper);
  border-top: 8px solid var(--pink);
  box-shadow: 0 20px 48px rgba(0,0,0,.28);
}
.flow-node b { color: var(--pink-deep); font: 700 20px var(--mono); }
.flow-node span { max-width: 150px; font: 900 29px/1.05 var(--serif-cn); }
.flow-edge { width: 54px; height: 4px; background: var(--pink); box-shadow: 0 0 22px rgba(255,46,147,.42); }
.diagram-panel {
  padding: 58px 24px;
  border: 1px solid rgba(255,247,230,.18);
  background: rgba(255,247,230,.04);
}

/* === SPECIAL VISUALS === */
.definition-map { position: relative; height: 610px; }
.worker-core {
  position: absolute;
  left: 640px;
  top: 190px;
  width: 280px;
  height: 220px;
  display: grid;
  place-items: center;
  text-align: center;
  background: var(--pink);
  color: #fff;
  box-shadow: 0 0 90px rgba(255,46,147,.35);
}
.worker-core span { font: italic 44px var(--display); }
.worker-core b { font: 900 44px var(--serif-cn); }
.radial-item {
  position: absolute;
  width: 330px;
  min-height: 130px;
  padding: 24px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 18px 46px var(--shadow);
}
.radial-item b { display: block; color: var(--pink-deep); font: 900 30px var(--serif-cn); }
.radial-item span { font-size: 23px; font-weight: 700; line-height: 1.22; }
.radial-0 { left: 150px; top: 0; }
.radial-1 { right: 150px; top: 0; }
.radial-2 { left: 30px; top: 250px; }
.radial-3 { right: 30px; top: 250px; }
.radial-4 { left: 610px; bottom: 10px; }
.map-takeaway { position: absolute; left: 440px; right: 440px; bottom: 0; font-size: 25px; }
.orchestrator-layout { position: relative; height: 610px; }
.hub {
  position: absolute;
  left: 690px;
  top: 194px;
  width: 260px;
  height: 180px;
  display: grid;
  place-items: center;
  text-align: center;
  color: #fff;
  background: var(--pink);
  font: 900 34px/1.05 var(--serif-cn);
}
.agent-node {
  position: absolute;
  width: 390px;
  min-height: 150px;
  padding: 26px;
  color: var(--ink);
  background: var(--paper);
  border-left: 8px solid var(--pink);
}
.agent-node b { display: block; font: 700 28px var(--mono); color: var(--pink-deep); margin-bottom: 10px; }
.agent-node span { font-size: 22px; font-weight: 700; line-height: 1.22; }
.agent-0 { left: 80px; top: 40px; }
.agent-1 { right: 80px; top: 40px; }
.agent-2 { left: 80px; bottom: 90px; }
.agent-3 { right: 80px; bottom: 90px; }
.orchestrator-takeaway { position: absolute; left: 490px; right: 490px; bottom: 0; font-size: 24px; }
.runtime-flow, .approval-layout { display: grid; gap: 54px; justify-items: center; }
.runtime-caption, .approval-branch {
  width: 920px;
  padding: 30px 34px;
  color: var(--ink);
  background: var(--paper);
  border-left: 10px solid var(--pink);
}
.runtime-caption b { display: block; color: var(--pink-deep); font: 900 32px var(--serif-cn); }
.runtime-caption span { display: block; margin-top: 8px; font-size: 27px; font-weight: 700; line-height: 1.24; }
.approval-branch { display: flex; justify-content: space-around; font: 700 28px var(--mono); color: var(--pink-deep); }
.state-layout { display: grid; grid-template-columns: 1.35fr .65fr; gap: 46px; align-items: start; }
.ledger-visual {
  min-height: 320px;
  padding: 34px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 24px 60px var(--shadow);
}
.ledger-visual b { display: block; font: 900 44px var(--serif-cn); }
.ledger-visual span { display: block; margin: 12px 0 28px; font-size: 24px; font-weight: 700; color: rgba(20,6,10,.72); }
.ledger-visual i { display: inline-block; margin: 8px 8px 0 0; padding: 10px 14px; background: var(--pink); color: #fff; font: 700 18px var(--mono); font-style: normal; }
.protocol-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 42px; }
.protocol-grid span {
  min-height: 150px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 22px;
  background: var(--paper);
  color: var(--ink);
  border-top: 8px solid var(--pink);
  font: 900 28px/1.08 var(--serif-cn);
}
.comparison-layout { display: grid; gap: 24px; }
.comparison-table .table-row { grid-template-columns: 210px 280px 1fr; }
.checklist-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
.check-item {
  min-height: 165px;
  padding: 24px;
  color: var(--ink);
  background: var(--paper);
  border-top: 8px solid var(--pink);
}
.check-item b { display: block; color: var(--pink-deep); font: 700 22px var(--mono); margin-bottom: 18px; }
.check-item span { font: 900 28px/1.14 var(--serif-cn); }
.migration-layout { position: relative; height: 610px; }
.step-card {
  position: absolute;
  left: calc(80px + var(--step) * 245px);
  top: calc(350px - var(--step) * 46px);
  width: 220px;
  height: 150px;
  padding: 22px;
  background: var(--paper);
  color: var(--ink);
  border-left: 8px solid var(--pink);
}
.step-card b { display: block; color: var(--pink-deep); font: 700 20px var(--mono); }
.step-card span { display: block; margin-top: 16px; font: 900 30px/1.08 var(--serif-cn); }
.migration-layout .takeaway { position: absolute; left: 160px; right: 160px; bottom: 0; }
.metrics-layout { display: grid; gap: 40px; }
.bar-chart { display: grid; gap: 26px; padding: 40px; border: 1px solid rgba(255,247,230,.18); background: rgba(255,247,230,.04); }
.bar-row { display: grid; grid-template-columns: 260px 1fr 80px; gap: 24px; align-items: center; color: var(--cream); font-size: 26px; font-weight: 900; }
.bar-row i { height: 34px; background: rgba(255,247,230,.14); display: block; }
.bar-row i b { display: block; height: 100%; background: var(--pink); box-shadow: 0 0 26px rgba(255,46,147,.32); }
.bar-row em { color: var(--pink); font: 700 24px var(--mono); font-style: normal; }
.mesh-layout { position: relative; height: 610px; }
.mesh-node {
  position: absolute;
  display: grid;
  place-items: center;
  text-align: center;
  background: var(--paper);
  color: var(--ink);
  border: 2px solid var(--pink);
  font: 900 25px/1.08 var(--serif-cn);
  box-shadow: 0 20px 50px var(--shadow);
}
.mesh-core { left: 666px; top: 176px; width: 260px; height: 190px; color: #fff; background: var(--pink); font-size: 34px; }
.mesh-0 { left: 210px; top: 40px; width: 220px; height: 118px; }
.mesh-1 { right: 230px; top: 40px; width: 220px; height: 118px; }
.mesh-2 { left: 110px; top: 260px; width: 210px; height: 110px; }
.mesh-3 { right: 120px; top: 260px; width: 210px; height: 110px; }
.mesh-4 { left: 300px; bottom: 44px; width: 210px; height: 110px; }
.mesh-5 { right: 320px; bottom: 44px; width: 210px; height: 110px; }
.mesh-takeaway { position: absolute; left: 530px; right: 530px; bottom: 0; font-size: 24px; }
.risk-layout { display: grid; grid-template-columns: 1.1fr .9fr; gap: 52px; }
.risk-table .table-row { grid-template-columns: 220px 1fr; }
.case-layout { display: grid; grid-template-columns: 420px 1fr; gap: 48px; align-items: start; }
.case-paper {
  padding: 34px;
  color: var(--ink);
  background: var(--paper);
  box-shadow: 0 24px 60px var(--shadow);
}
.case-paper b { color: var(--pink-deep); font: 700 22px var(--mono); }
.case-paper p { margin: 24px 0 0; font-size: 28px; font-weight: 700; line-height: 1.28; }
.case-board { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
.case-slip {
  min-height: 160px;
  padding: 28px;
  color: var(--cream);
  background: rgba(255, 247, 230, 0.07);
  border: 1px solid rgba(255, 247, 230, 0.20);
  border-top: 8px solid var(--pink);
  font-size: 25px;
  font-weight: 700;
  line-height: 1.25;
}
.case-layout .takeaway { grid-column: 1 / -1; }
.closing-wrap { height: 780px; display: grid; place-items: center; text-align: center; }
.script-mark { color: var(--pink); font: italic 148px/0.86 var(--display); }
.closing-title {
  margin: 20px 0 0;
  color: var(--cream);
  font: 900 92px/1.02 var(--serif-cn);
}
.closing-subtitle { margin: 10px 0 0; color: rgba(255,247,230,.75); font-size: 34px; font-weight: 700; }
.closing-quote {
  max-width: 1100px;
  margin: 44px auto 0;
  padding: 30px 42px;
  color: var(--ink);
  background: var(--paper);
  border-left: 10px solid var(--pink);
  font: 900 36px/1.22 var(--serif-cn);
}
`;
}

function js(total) {
  return `
/* === DECK NAVIGATION === */
const stage = document.querySelector('.deck-stage');
const slides = Array.from(document.querySelectorAll('.slide'));
let current = 0;
function fitStage() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const left = (window.innerWidth - 1920 * scale) / 2;
  const top = (window.innerHeight - 1080 * scale) / 2;
  stage.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + scale + ')';
}
function showSlide(index) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === current);
    slide.classList.toggle('visible', i === current);
  });
  history.replaceState(null, '', '#' + (current + 1));
}
window.showSlide = showSlide;
window.addEventListener('resize', fitStage);
window.addEventListener('keydown', (event) => {
  if (['ArrowRight', ' ', 'PageDown'].includes(event.key)) showSlide(current + 1);
  if (['ArrowLeft', 'PageUp'].includes(event.key)) showSlide(current - 1);
});
fitStage();
const fromHash = Number(location.hash.replace('#', ''));
showSlide(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0);
window.__SLIDE_COUNT__ = ${total};
`;
}

const outline = parseOutline(readMaybe(OUTLINE_PATH));
const notes = parseNotes(readMaybe(NOTES_PATH));
const viewportCss = readMaybe(VIEWPORT_CSS_PATH);
const slides = outline.map((slide) => renderSlide(slide, notes.get(slide.page), outline.length)).join("\n");
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fiitx OpenClaw Agent Talk - Pink Script Editorial</title>
  <style>${css(viewportCss)}</style>
</head>
<body>
  <div class="deck-viewport">
    <div class="deck-stage">
      ${slides}
    </div>
  </div>
  <script>${js(outline.length)}</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
fs.writeFileSync(path.join(OUT_DIR, "build-summary.json"), JSON.stringify({
  slideCount: outline.length,
  style: "Black canvas, hot pink accent, pearl-cream paper, Instrument Serif editorial",
  generatedAt: new Date().toISOString()
}, null, 2));
console.log(`Built ${outline.length} slides at ${path.join(OUT_DIR, "index.html")}`);
