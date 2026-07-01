const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = __dirname;
const OUTLINE_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/outline.txt");
const NOTES_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/speaker_notes.txt");
const VIEWPORT_CSS_PATH = "/Users/botbotbot/.codex/skills/frontend-slides/viewport-base.css";
const LOGO_PATH = path.join(ROOT, "assets/fiitx-logo.png");
const EVENT_POSTER_PATH = "/Users/botbotbot/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/airbai_d805/temp/RWTemp/2026-06/2f1ca2312bf3c1265fe4b48c61a6c991/bf9dc3114fdc2b1e8169ca9150db0274.jpg";

fs.mkdirSync(OUT_DIR, { recursive: true });

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

const specialKinds = new Map([
  [1, "cover"],
  [2, "manifesto"],
  [3, "toc"],
  [4, "campaign"],
  [8, "definition"],
  [11, "stack"],
  [14, "orchestrator"],
  [29, "flow"],
  [30, "ledger"],
  [32, "approval"],
  [47, "comparison"],
  [49, "checklist"],
  [50, "migration"],
  [51, "metrics"],
  [52, "mesh"],
  [53, "risk"],
  [60, "closing"]
]);

function slideKind(slide) {
  if (specialKinds.has(slide.page)) return specialKinds.get(slide.page);
  if (/第一层|第二层|第三层|第四层|第五层|第六层|第七层|第八层/.test(slide.title)) return "pillars";
  if (/幻觉|问题线|原则|坑/.test(slide.title)) return "field";
  if (/架构|闭环|Runtime|Router|MCP|Skill|Channel|Profile|SessionDB|Approval/.test(slide.title)) return "diagram";
  if (/路线|阶段|迁移|下一阶段/.test(slide.title)) return "timeline";
  return slide.page % 3 === 0 ? "poster" : "brief";
}

function splitLabel(text) {
  const [head, ...rest] = String(text).split("：");
  return { head: head.trim(), body: rest.join("：").trim() || text };
}

function stripLabel(text) {
  return splitLabel(text).head || text;
}

function bulletList(items, limit = 5) {
  return `<ul class="bullet-list">${items.slice(0, limit).map((item, index) => `
    <li class="reveal" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(item)}</span>
    </li>`).join("")}</ul>`;
}

function stampGrid(items, limit = 4) {
  return `<div class="stamp-grid">${items.slice(0, limit).map((item, index) => `
    <article class="stamp-card reveal ${index % 2 ? "blue-card" : ""}" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(item)}</span>
    </article>`).join("")}</div>`;
}

function tableRows(rows) {
  return rows.map((row, index) => `
    <div class="table-row reveal" style="--d:${index}">
      ${row.map((cell) => `<span>${esc(cell)}</span>`).join("")}
    </div>`).join("");
}

function flow(nodes) {
  return `<div class="flow-line">${nodes.map((node, index) => `
    <div class="flow-node reveal" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(node)}</span>
    </div>${index < nodes.length - 1 ? '<i class="flow-arrow"></i>' : ""}`).join("")}</div>`;
}

function sourceBadgeRow() {
  return `<div class="source-badges reveal">
    <span>HERMES</span><span>OPENCLAW</span><span>FIITX</span><span>PI CODING-AGENT</span>
  </div>`;
}

function body(slide, note, kind) {
  if (kind === "cover") {
    const poster = dataUrl(EVENT_POSTER_PATH, "image/jpeg");
    const logo = dataUrl(LOGO_PATH, "image/png");
    return `<div class="cover-layout">
      <div class="cover-copy">
        <div class="label reveal">GIAC 2026 / AGENT ARCHITECTURE</div>
        <h1 class="cover-title reveal">LLM<br><span>TO</span><br>DIGITAL<br>WORKER</h1>
        <p class="script-note reveal">make the model accountable</p>
        <div class="cover-meta reveal">
          <span>白朋飞 / FIIT.AI</span><span>OPENCLAW</span><span>50 MIN + Q&amp;A</span>
        </div>
      </div>
      <div class="cover-poster reveal">
        ${poster ? `<img src="${poster}" alt="GIAC poster">` : ""}
        <div class="poster-footer">${logo ? `<img src="${logo}" alt="Fiitx">` : ""}<b>WORKER PLATFORM</b></div>
      </div>
    </div>`;
  }

  if (kind === "closing") {
    return `<div class="closing-layout">
      <div class="script-note reveal">Q&amp;A</div>
      <h1 class="closing-title reveal">THANK<br>YOU</h1>
      <p class="closing-kicker reveal">${esc(slide.kicker || note?.takeaway || "")}</p>
    </div>`;
  }

  if (kind === "toc") {
    const rows = slide.bullets.slice(0, 4).map((item, index) => [
      String(index + 1).padStart(2, "0"),
      item.replace(/^第.段：/, ""),
      `${index < 2 ? "ARCH" : "FIELD"}`
    ]);
    return `<div class="toc-layout">
      <aside class="toc-note reveal"><b>50 MINUTES</b><span>one loud map, four acts</span></aside>
      <div class="toc-table">${tableRows(rows)}</div>
    </div>`;
  }

  if (kind === "manifesto" || kind === "campaign") {
    return `<div class="manifesto-layout">
      <div class="poster-statement reveal">${esc(slide.subtitle || slide.kicker)}</div>
      ${stampGrid(slide.bullets, 4)}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "definition") {
    const items = slide.bullets.slice(0, 5).map(splitLabel);
    return `<div class="definition-layout">
      <div class="worker-core reveal">DIGITAL<br>WORKER</div>
      ${items.map((item, index) => `<div class="radial radial-${index} reveal" style="--d:${index}">
        <b>${esc(item.head)}</b><span>${esc(item.body)}</span>
      </div>`).join("")}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "stack") {
    const rows = slide.bullets.slice(0, 4).map((item, index) => {
      const label = splitLabel(item);
      return [String(index + 1).padStart(2, "0"), label.head, label.body];
    });
    return `<div class="stack-layout">
      <div class="layer-table">${tableRows(rows)}</div>
      <div class="poster-callout reveal">INPUT → DECISION → EXECUTION → VERIFY → REVIEW</div>
    </div>`;
  }

  if (kind === "orchestrator") {
    return `<div class="orchestrator-layout">
      <div class="hub reveal">AGENT<br>ORCH</div>
      ${["Research", "Coding", "Artifact", "Chat"].map((label, index) => `
        <div class="agent-node agent-${index} reveal" style="--d:${index}">
          <b>${esc(label)}</b><span>${esc(slide.bullets[index] || "")}</span>
        </div>`).join("")}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "flow") {
    return `<div class="flow-layout">
      ${flow(["一句话", "Intent", "Context", "Tool", "File Stat", "Artifact"])}
      <div class="poster-callout reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "ledger") {
    const rows = [
      ["THREAD", "长期上下文", "用户目标、历史摘要、结构化记忆"],
      ["SESSION", "一次执行账本", "工具调用、审批、错误、trace"],
      ["ARTIFACT", "可交付结果", "文件、预览、导出物、验证记录"]
    ];
    return `<div class="ledger-layout">
      <div class="ledger-table">${tableRows(rows)}</div>
      <aside class="big-stamp reveal">SESSION<br>DB</aside>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "approval") {
    return `<div class="flow-layout">
      ${flow(["REQUEST", "RISK", "HUMAN", "RESUME", "AUDIT"])}
      <div class="two-lane reveal"><span>APPROVE → CONTINUE</span><span>REJECT → EXPLAIN / ROLLBACK</span></div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "comparison") {
    const rows = [
      ["OPENCLAW", "AGENT FRAMEWORK", "把模型能力组织成可运行、可记忆、可连接外部世界的系统"],
      ["HERMES", "LIFECYCLE RUNTIME", "daemon、scheduler、channels、session search、profile isolation"],
      ["PI", "AGENT KERNEL", "面向编码任务的工具协议、文件编辑、验证闭环"],
      ["FIITX", "LOCAL WORKBENCH", "把这些思想落到桌面、workspace、审批、MCP/Skill 与模型路由"]
    ];
    return `<div class="comparison-layout">
      <div class="comparison-table">${tableRows(rows)}</div>
      ${sourceBadgeRow()}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "checklist") {
    const items = [
      "目标与完成标准", "上下文与记忆边界", "工具协议与错误分类", "审批 / 审计 / 回滚",
      "模型能力矩阵", "Channel 身份隔离", "Session 可检索", "交付物可验证", "失败可恢复", "经验沉淀为 Skill"
    ];
    return `<div class="checklist-grid">${items.map((item, index) => `
      <div class="check-card reveal ${index % 3 === 1 ? "orange-card" : ""}" style="--d:${index}">
        <b>${String(index + 1).padStart(2, "0")}</b><span>${esc(item)}</span>
      </div>`).join("")}</div>`;
  }

  if (kind === "migration") {
    return `<div class="migration-layout">
      ${["高频场景", "可验证交付", "低风险工具", "审批闭环", "复盘数据", "技能市场"].map((item, index) => `
        <div class="step step-${index} reveal" style="--d:${index}">
          <b>${String(index + 1).padStart(2, "0")}</b><span>${esc(item)}</span>
        </div>`).join("")}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "metrics") {
    const rows = [["交付成功率", 92], ["人工打断率", 34], ["可复盘覆盖", 78], ["工具失败恢复", 63], ["Skill 复用", 52]];
    return `<div class="metrics-layout">
      <div class="bar-chart">${rows.map(([label, value], index) => `
        <div class="bar-row reveal" style="--d:${index}">
          <span>${esc(label)}</span><i><b style="width:${value}%"></b></i><em>${value}%</em>
        </div>`).join("")}</div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "mesh") {
    return `<div class="mesh-layout">
      <div class="mesh-core reveal">WORKER<br>MESH</div>
      ${["Workbench", "Skill Market", "Channel", "Policy", "Telemetry", "Workflow OS"].map((item, index) => `
        <div class="mesh-node mesh-${index} reveal" style="--d:${index}">${esc(item)}</div>`).join("")}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "risk") {
    const rows = [
      ["长期稳定", "任务级调度、重试和崩溃恢复"],
      ["评测体系", "覆盖系统行为，而不是只看回答质量"],
      ["技能治理", "版本、权限、回滚、依赖还要产品化"],
      ["组织采用", "从单点闭环扩展到跨部门工作流"]
    ];
    return `<div class="risk-layout">
      <div class="risk-table">${tableRows(rows)}</div>
      <div class="poster-statement reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "field") {
    return `<div class="field-layout">
      <aside class="field-note reveal"><b>FIELD NOTE / ${String(slide.page).padStart(2, "0")}</b><span>${esc(note?.note || slide.subtitle)}</span></aside>
      ${stampGrid(slide.bullets, 4)}
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
    </div>`;
  }

  if (kind === "pillars" || kind === "diagram" || kind === "timeline") {
    return `<div class="split-layout">
      <div>
        ${bulletList(slide.bullets, 5)}
        <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
      </div>
      <div class="mini-flow reveal">${flow(slide.bullets.slice(0, 5).map(stripLabel))}</div>
    </div>`;
  }

  if (kind === "poster") {
    return `<div class="poster-layout">
      <div class="poster-statement reveal">${esc(slide.kicker || slide.subtitle)}</div>
      ${stampGrid(slide.bullets, 4)}
    </div>`;
  }

  return `<div class="split-layout">
    <div class="poster-statement reveal">${esc(slide.kicker || slide.subtitle)}</div>
    <div>
      ${bulletList(slide.bullets, 5)}
      <div class="script-tag reveal">build the worker, not just the chat</div>
    </div>
  </div>`;
}

function renderSlide(slide, note, total) {
  const kind = slideKind(slide);
  const active = slide.page === 1 ? " active visible" : "";
  return `<section class="slide s-${kind}${active}" data-slide="${slide.page}" data-kind="${kind}">
    <div class="paper-grain"></div>
    <div class="inset-frame"></div>
    <div class="topbar">
      <span>FIIT.AI / OPENCLAW</span>
      <span>${String(slide.page).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
    </div>
    <div class="page-number">${String(slide.page).padStart(2, "0")}</div>
    <div class="slide-frame">
      ${kind !== "cover" && kind !== "closing" ? `<header class="slide-header">
        <div class="label reveal">FROM LLM TO DIGITAL WORKER</div>
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
@import url('https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Archivo+Narrow:wght@400;500;600;700&family=Caveat+Brush&family=DM+Mono:wght@400;500&family=Noto+Serif+SC:wght@600;700;900&display=swap');

/* === THEME TOKENS === */
:root {
  --blue: #2C2CDC;
  --blue-deep: #1B1BB0;
  --orange: #F2A03A;
  --orange-deep: #E89321;
  --red: #E83A2A;
  --red-deep: #B7281C;
  --cream: #F4E9D6;
  --paper: #F5F2EA;
  --ink: #0E0E14;
  --stage-bg: #101014;
  --slide-bg: var(--paper);
  --display: 'Alfa Slab One', 'Noto Serif SC', serif;
  --body: 'Archivo Narrow', 'Noto Serif SC', sans-serif;
  --script: 'Caveat Brush', cursive;
  --mono: 'DM Mono', monospace;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* === RESET AND FIXED VIEWPORT === */
* { box-sizing: border-box; }
${viewportCss}

/* === BASE POSTER SURFACE === */
body { font-family: var(--body); color: var(--ink); }
.slide { background: var(--paper); color: var(--ink); }
.paper-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .58;
  mix-blend-mode: multiply;
  background-image:
    radial-gradient(rgba(0,0,0,.08) 1px, transparent 1px),
    radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px);
  background-size: 3px 3px, 5px 5px;
  background-position: 0 0, 1px 2px;
}
.inset-frame {
  position: absolute;
  inset: 48px;
  border: 6px solid var(--ink);
  pointer-events: none;
}
.topbar {
  position: absolute;
  left: 48px;
  right: 48px;
  top: 48px;
  height: 90px;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 42px;
  color: var(--cream);
  background: var(--blue);
  border-bottom: 6px solid var(--ink);
  font: 500 22px/1 var(--mono);
  letter-spacing: .18em;
}
.slide-frame {
  position: relative;
  z-index: 2;
  height: 100%;
  padding: 178px 96px 80px;
}
.page-number {
  position: absolute;
  right: 86px;
  top: 150px;
  z-index: 1;
  color: var(--orange);
  opacity: .26;
  font: 400 170px/.8 var(--display);
  text-shadow: 7px 7px 0 var(--red);
}
.label {
  color: var(--red);
  font: 500 24px/1 var(--mono);
  letter-spacing: .22em;
}
.slide-header h2 {
  margin: 24px 0 12px;
  max-width: 1420px;
  color: var(--blue);
  font: 900 78px/1.02 'Noto Serif SC', serif;
  text-shadow: 5px 5px 0 rgba(232, 58, 42, .42);
}
.slide-header p {
  margin: 0;
  max-width: 1050px;
  color: var(--ink);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.18;
}
.slide-main { margin-top: 46px; }

/* === ANIMATION SYSTEM === */
.reveal {
  opacity: 0;
  transform: translateY(28px) rotate(-.4deg);
  transition: opacity 620ms var(--ease-out-expo), transform 620ms var(--ease-out-expo);
  transition-delay: calc(80ms + var(--d, 0) * 70ms);
}
.slide.visible .reveal {
  opacity: 1;
  transform: translateY(0) rotate(0);
}

/* === POSTER COMPONENTS === */
.takeaway, .poster-callout, .poster-statement {
  background: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 10px 10px 0 var(--red);
}
.takeaway {
  margin-top: 34px;
  padding: 24px 30px;
  color: var(--ink);
  font: 900 30px/1.22 'Noto Serif SC', serif;
}
.poster-statement {
  padding: 34px 42px;
  color: var(--blue);
  font: 900 48px/1.1 'Noto Serif SC', serif;
}
.poster-callout {
  padding: 28px 34px;
  color: var(--blue);
  font: 400 42px/1.05 var(--display);
  text-transform: uppercase;
}
.script-note, .script-tag {
  color: var(--red);
  font: 400 76px/1 var(--script);
  transform: rotate(-4deg);
}
.source-badges, .cover-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.source-badges span, .cover-meta span {
  padding: 12px 18px;
  color: var(--cream);
  background: var(--blue);
  border: 4px solid var(--ink);
  box-shadow: 5px 5px 0 var(--red);
  font: 500 18px/1 var(--mono);
  letter-spacing: .12em;
}

/* === COVER === */
.s-cover {
  background: var(--blue);
  color: var(--cream);
}
.s-cover .inset-frame { border-color: var(--cream); }
.s-cover .topbar { background: var(--orange); color: var(--ink); }
.cover-layout {
  height: 820px;
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 74px;
  align-items: center;
}
.cover-title {
  margin: 18px 0 0;
  color: var(--orange);
  font: 400 116px/.86 var(--display);
  letter-spacing: .005em;
  text-transform: uppercase;
  text-shadow: 9px 9px 0 var(--red), 18px 18px 0 var(--red-deep);
}
.cover-title span {
  display: inline-block;
  color: var(--cream);
  font-size: 82px;
  transform: rotate(-3deg);
}
.cover-copy .script-note { margin: 20px 0 30px; color: var(--cream); }
.cover-poster {
  background: var(--cream);
  border: 8px solid var(--ink);
  box-shadow: 18px 18px 0 var(--red);
  transform: rotate(1.2deg);
}
.cover-poster > img {
  display: block;
  width: 100%;
  height: 620px;
  object-fit: cover;
  object-position: top center;
  filter: saturate(.92) contrast(1.05);
}
.poster-footer {
  height: 92px;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 0 28px;
  color: var(--ink);
  font: 400 28px/1 var(--display);
}
.poster-footer img { width: 118px; height: auto; object-fit: contain; }

/* === LAYOUTS === */
.split-layout, .toc-layout, .ledger-layout, .risk-layout {
  display: grid;
  grid-template-columns: .92fr 1.08fr;
  gap: 54px;
  align-items: start;
}
.brief-layout, .poster-layout, .manifesto-layout, .metrics-layout {
  display: grid;
  gap: 34px;
}
.bullet-list {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 18px;
  list-style: none;
}
.bullet-list li {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 20px;
  align-items: start;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}
.bullet-list b {
  display: grid;
  place-items: center;
  width: 58px;
  height: 54px;
  color: var(--cream);
  background: var(--blue);
  border: 4px solid var(--ink);
  box-shadow: 4px 4px 0 var(--red);
  font: 400 24px/1 var(--display);
}
.stamp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 22px;
}
.stamp-card {
  min-height: 176px;
  padding: 24px;
  color: var(--ink);
  background: var(--orange);
  border: 6px solid var(--ink);
  box-shadow: 8px 8px 0 var(--red);
}
.stamp-card.blue-card {
  color: var(--cream);
  background: var(--blue);
}
.stamp-card b {
  display: block;
  margin-bottom: 18px;
  color: var(--red);
  font: 400 42px/1 var(--display);
}
.stamp-card.blue-card b { color: var(--orange); }
.stamp-card span {
  display: block;
  font: 900 27px/1.15 'Noto Serif SC', serif;
}

/* === TABLES AND FLOWS === */
.toc-note {
  padding: 34px;
  background: var(--blue);
  color: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 10px 10px 0 var(--red);
}
.toc-note b {
  display: block;
  color: var(--orange);
  font: 400 58px/1 var(--display);
  text-shadow: 4px 4px 0 var(--red);
}
.toc-note span {
  display: block;
  margin-top: 18px;
  font: 400 62px/1 var(--script);
}
.toc-table, .layer-table, .ledger-table, .comparison-table, .risk-table {
  display: grid;
  gap: 14px;
}
.table-row {
  display: grid;
  grid-template-columns: 120px 300px 1fr;
  gap: 20px;
  align-items: center;
  padding: 20px 24px;
  background: var(--cream);
  border: 5px solid var(--ink);
  box-shadow: 7px 7px 0 var(--red);
  font-size: 25px;
  font-weight: 700;
  line-height: 1.15;
}
.table-row span:first-child {
  color: var(--orange);
  font: 400 40px/1 var(--display);
  text-shadow: 3px 3px 0 var(--red);
}
.table-row span:nth-child(2) {
  color: var(--blue);
  font: 400 28px/1.05 var(--display);
  text-transform: uppercase;
}
.comparison-layout {
  display: grid;
  gap: 18px;
}
.comparison-table {
  gap: 12px;
}
.comparison-table .table-row {
  grid-template-columns: 210px 300px 1fr;
  padding: 16px 20px;
  font-size: 23px;
  line-height: 1.12;
}
.comparison-table .table-row span:first-child {
  font-size: 29px;
}
.comparison-table .table-row span:nth-child(2) {
  font-size: 24px;
}
.comparison-layout .source-badges span {
  padding: 10px 14px;
  font-size: 17px;
}
.comparison-layout .takeaway {
  margin-top: 4px;
  padding: 18px 24px;
  font-size: 24px;
  line-height: 1.12;
}
.risk-table .table-row { grid-template-columns: 220px 1fr; }
.flow-line {
  display: flex;
  align-items: center;
  justify-content: center;
}
.flow-node {
  width: 205px;
  min-height: 145px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 18px;
  background: var(--orange);
  border: 6px solid var(--ink);
  box-shadow: 7px 7px 0 var(--red);
}
.flow-node b {
  color: var(--red);
  font: 400 30px/1 var(--display);
}
.flow-node span {
  color: var(--ink);
  font: 900 30px/1.05 'Noto Serif SC', serif;
}
.flow-arrow {
  width: 50px;
  height: 7px;
  background: var(--ink);
}
.mini-flow .flow-line { flex-wrap: wrap; gap: 16px; justify-content: flex-start; }
.mini-flow .flow-arrow { display: none; }
.mini-flow .flow-node { width: 170px; min-height: 118px; }

/* === SPECIAL SLIDES === */
.definition-layout, .orchestrator-layout, .migration-layout, .mesh-layout {
  position: relative;
  height: 610px;
}
.worker-core, .hub, .mesh-core, .big-stamp {
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--cream);
  background: var(--blue);
  border: 7px solid var(--ink);
  box-shadow: 12px 12px 0 var(--red);
  font: 400 42px/.95 var(--display);
}
.worker-core {
  position: absolute;
  left: 670px;
  top: 180px;
  width: 280px;
  height: 210px;
}
.radial, .agent-node, .step, .mesh-node, .check-card {
  position: absolute;
  background: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 8px 8px 0 var(--red);
}
.radial {
  width: 340px;
  min-height: 130px;
  padding: 22px;
}
.radial b, .agent-node b {
  display: block;
  color: var(--blue);
  font: 400 34px/1 var(--display);
}
.radial span, .agent-node span {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.16;
}
.radial-0 { left: 120px; top: 0; }
.radial-1 { right: 120px; top: 0; }
.radial-2 { left: 30px; top: 245px; }
.radial-3 { right: 30px; top: 245px; }
.radial-4 { left: 610px; bottom: 0; }
.definition-layout .takeaway { position: absolute; left: 440px; right: 440px; bottom: 0; font-size: 24px; }
.hub {
  position: absolute;
  left: 700px;
  top: 196px;
  width: 250px;
  height: 170px;
}
.agent-node {
  width: 390px;
  min-height: 145px;
  padding: 24px;
}
.agent-0 { left: 100px; top: 36px; }
.agent-1 { right: 100px; top: 36px; }
.agent-2 { left: 100px; bottom: 88px; }
.agent-3 { right: 100px; bottom: 88px; }
.orchestrator-layout .takeaway { position: absolute; left: 500px; right: 500px; bottom: 0; font-size: 23px; }
.field-layout { display: grid; grid-template-columns: 420px 1fr; gap: 38px; }
.field-layout .stamp-grid { grid-template-columns: repeat(2, 1fr); }
.field-layout .takeaway { grid-column: 1 / -1; }
.field-note {
  padding: 28px;
  background: var(--blue);
  color: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 8px 8px 0 var(--red);
}
.field-note b {
  display: block;
  color: var(--orange);
  font: 500 22px/1.1 var(--mono);
  letter-spacing: .12em;
  margin-bottom: 20px;
}
.field-note span {
  font-size: 28px;
  line-height: 1.22;
  font-weight: 700;
}
.big-stamp {
  min-height: 260px;
  color: var(--orange);
  font-size: 82px;
  text-shadow: 6px 6px 0 var(--red);
}
.ledger-layout .takeaway { grid-column: 1 / -1; }
.two-lane {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 34px;
}
.two-lane span {
  padding: 20px 28px;
  color: var(--cream);
  background: var(--blue);
  border: 5px solid var(--ink);
  box-shadow: 7px 7px 0 var(--red);
  font: 500 24px var(--mono);
}
.checklist-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
}
.check-card {
  position: relative;
  min-height: 160px;
  padding: 22px;
}
.check-card.orange-card { background: var(--orange); }
.check-card b {
  display: block;
  color: var(--red);
  font: 400 34px/1 var(--display);
  margin-bottom: 16px;
}
.check-card span {
  color: var(--ink);
  font: 900 28px/1.12 'Noto Serif SC', serif;
}
.migration-layout .step {
  width: 210px;
  height: 140px;
  padding: 20px;
}
.step b {
  color: var(--red);
  font: 400 30px/1 var(--display);
}
.step span {
  display: block;
  margin-top: 14px;
  color: var(--blue);
  font: 900 30px/1.08 'Noto Serif SC', serif;
}
.step-0 { left: 120px; top: 350px; }
.step-1 { left: 360px; top: 310px; }
.step-2 { left: 600px; top: 270px; }
.step-3 { left: 840px; top: 230px; }
.step-4 { left: 1080px; top: 190px; }
.step-5 { left: 1320px; top: 150px; }
.migration-layout .takeaway { position: absolute; left: 170px; right: 170px; bottom: 0; }
.bar-chart {
  display: grid;
  gap: 24px;
  padding: 42px;
  background: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 10px 10px 0 var(--red);
}
.bar-row {
  display: grid;
  grid-template-columns: 260px 1fr 90px;
  gap: 24px;
  align-items: center;
  font-size: 30px;
  font-weight: 900;
}
.bar-row i {
  display: block;
  height: 34px;
  background: rgba(14, 14, 20, .18);
  border: 4px solid var(--ink);
}
.bar-row i b {
  display: block;
  height: 100%;
  background: var(--blue);
}
.bar-row em {
  color: var(--red);
  font: 400 34px/1 var(--display);
  font-style: normal;
}
.mesh-core {
  position: absolute;
  left: 670px;
  top: 190px;
  width: 270px;
  height: 180px;
}
.mesh-node {
  width: 210px;
  height: 110px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 16px;
  color: var(--blue);
  font: 400 25px/1 var(--display);
}
.mesh-0 { left: 210px; top: 50px; }
.mesh-1 { right: 230px; top: 50px; }
.mesh-2 { left: 110px; top: 260px; }
.mesh-3 { right: 120px; top: 260px; }
.mesh-4 { left: 300px; bottom: 40px; }
.mesh-5 { right: 320px; bottom: 40px; }
.mesh-layout .takeaway { position: absolute; left: 540px; right: 540px; bottom: 0; font-size: 23px; }
.mesh-layout { height: 550px; }
.mesh-layout .takeaway {
  left: 520px;
  right: 520px;
  bottom: 4px;
  padding: 16px 20px;
  font-size: 21px;
  line-height: 1.12;
}
.closing-layout {
  height: 760px;
  display: grid;
  place-items: center;
  text-align: center;
}
.closing-title {
  margin: 0;
  color: var(--blue);
  font: 400 150px/.86 var(--display);
  text-shadow: 10px 10px 0 var(--red), 18px 18px 0 var(--orange);
}
.closing-kicker {
  max-width: 1040px;
  padding: 26px 34px;
  background: var(--cream);
  border: 6px solid var(--ink);
  box-shadow: 9px 9px 0 var(--red);
  font: 900 30px/1.2 'Noto Serif SC', serif;
}
`;
}

function js(total) {
  return `
/* === SLIDE PRESENTATION CONTROLLER === */
class SlidePresentation {
  constructor() {
    this.slides = Array.from(document.querySelectorAll('.slide'));
    this.currentSlide = 0;
    this.stage = document.getElementById('deckStage');
    this.setupStageScale();
    this.setupKeyboardNav();
    this.setupTouchNav();
    this.setupWheelNav();
    const fromHash = Number(location.hash.replace('#', ''));
    this.showSlide(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0);
  }
  setupStageScale() {
    const scale = () => {
      const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const x = (window.innerWidth - 1920 * factor) / 2;
      const y = (window.innerHeight - 1080 * factor) / 2;
      this.stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + factor + ')';
    };
    scale();
    window.addEventListener('resize', scale);
  }
  setupKeyboardNav() {
    document.addEventListener('keydown', (event) => {
      if (event.target?.isContentEditable) return;
      if (['ArrowRight', ' ', 'PageDown'].includes(event.key)) this.showSlide(this.currentSlide + 1);
      if (['ArrowLeft', 'PageUp'].includes(event.key)) this.showSlide(this.currentSlide - 1);
      if (event.key === 'Home') this.showSlide(0);
      if (event.key === 'End') this.showSlide(this.slides.length - 1);
    });
  }
  setupTouchNav() {
    let startX = 0;
    window.addEventListener('touchstart', (event) => { startX = event.changedTouches[0].clientX; }, { passive: true });
    window.addEventListener('touchend', (event) => {
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 60) this.showSlide(this.currentSlide + (delta < 0 ? 1 : -1));
    }, { passive: true });
  }
  setupWheelNav() {
    let lock = false;
    window.addEventListener('wheel', (event) => {
      if (lock || Math.abs(event.deltaY) < 40) return;
      lock = true;
      this.showSlide(this.currentSlide + (event.deltaY > 0 ? 1 : -1));
      setTimeout(() => { lock = false; }, 520);
    }, { passive: true });
  }
  showSlide(index) {
    this.currentSlide = Math.max(0, Math.min(index, this.slides.length - 1));
    this.slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === this.currentSlide);
      slide.classList.toggle('visible', i === this.currentSlide);
    });
    history.replaceState(null, '', '#' + (this.currentSlide + 1));
  }
}

/* === INLINE EDITING === */
class InlineEditor {
  constructor() {
    this.isActive = false;
    this.key = 'fiitx-peoples-platform-edits';
    this.edits = JSON.parse(localStorage.getItem(this.key) || '{}');
    this.applySavedEdits();
  }
  applySavedEdits() {
    document.querySelectorAll('[data-edit-id]').forEach((node) => {
      if (this.edits[node.dataset.editId]) node.innerHTML = this.edits[node.dataset.editId];
    });
  }
  toggleEditMode() {
    this.isActive = !this.isActive;
    document.body.classList.toggle('editing', this.isActive);
    document.querySelectorAll('.slide h1, .slide h2, .slide p, .slide span, .slide b, .takeaway, .poster-statement').forEach((node, index) => {
      if (!node.dataset.editId) node.dataset.editId = 'edit-' + index;
      node.contentEditable = this.isActive ? 'true' : 'false';
      node.addEventListener('input', () => {
        this.edits[node.dataset.editId] = node.innerHTML;
        localStorage.setItem(this.key, JSON.stringify(this.edits));
      });
    });
  }
}

window.__SLIDE_COUNT__ = ${total};
window.deck = new SlidePresentation();
window.showSlide = (index) => window.deck.showSlide(index);
window.editor = new InlineEditor();
document.addEventListener('keydown', (event) => {
  if ((event.key === 'e' || event.key === 'E') && !event.target?.isContentEditable) window.editor.toggleEditMode();
});
`;
}

const outline = parseOutline(readMaybe(OUTLINE_PATH));
const notes = parseNotes(readMaybe(NOTES_PATH));
const viewportCss = readMaybe(VIEWPORT_CSS_PATH);
const slides = outline.map((slide) => renderSlide(slide, notes.get(slide.page), outline.length)).join("\n");
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fiitx OpenClaw Agent Talk - People's Platform</title>
  <style>${css(viewportCss)}</style>
</head>
<body>
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage">
      ${slides}
    </main>
  </div>
  <script>${js(outline.length)}</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
fs.writeFileSync(path.join(OUT_DIR, "build-summary.json"), JSON.stringify({
  slideCount: outline.length,
  style: "People's Platform: activist poster energy, blue/orange/red on cream, Alfa Slab + Caveat Brush",
  generatedAt: new Date().toISOString()
}, null, 2));
console.log(`Built ${outline.length} HTML slides at ${path.join(OUT_DIR, "index.html")}`);
