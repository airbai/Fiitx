const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = __dirname;
const OUTLINE_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/outline.txt");
const NOTES_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/speaker_notes.txt");
const VIEWPORT_CSS_PATH = "/Users/botbotbot/.codex/skills/frontend-slides/viewport-base.css";
const LOGO_PATH = path.join(ROOT, "outputs/fiitx-openclaw-agent-talk/assets/fiitx-logo.png");

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

function parseOutline(text) {
  const blocks = text.split(/\n(?=# Page \d+\.)/g).filter(Boolean);
  return blocks.map((block) => {
    const pageMatch = block.match(/^# Page\s+(\d+)\.\s*(.+)$/m);
    const titleMatch = block.match(/^- Title:\s*(.+)$/m);
    const subTitleMatch = block.match(/^- SubTitle:\s*(.+)$/m);
    const kickerMatch = block.match(/^\s+- Kicker:\s*(.+)$/m);
    const bullets = [];
    const contentMatch = block.match(/^- Content:\n([\s\S]*?)(?:\n- Design:|\n# Page|\s*$)/m);
    if (contentMatch) {
      for (const line of contentMatch[1].split("\n")) {
        const match = line.match(/^\s+-\s+(.+)$/);
        if (match && !match[1].startsWith("Kicker:")) bullets.push(match[1].trim());
      }
    }
    return {
      page: Number(pageMatch?.[1] || 0),
      heading: (pageMatch?.[2] || titleMatch?.[1] || "").trim(),
      title: (titleMatch?.[1] || pageMatch?.[2] || "").trim(),
      subtitle: (subTitleMatch?.[1] || "").trim(),
      bullets,
      kicker: (kickerMatch?.[1] || "").trim()
    };
  });
}

function parseNotes(text) {
  const notes = new Map();
  const regex = /^(\d{2})\.\s+\[[^\]]+\]\s+(.+?)\n\s+(.+?)\n\s+Takeaway:\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(text))) {
    notes.set(Number(match[1]), {
      title: match[2].trim(),
      note: match[3].trim(),
      takeaway: match[4].trim()
    });
  }
  return notes;
}

function logoDataUrl() {
  try {
    const data = fs.readFileSync(LOGO_PATH).toString("base64");
    return `data:image/png;base64,${data}`;
  } catch {
    return "";
  }
}

function slideKind(slide) {
  if (slide.page === 1) return "cover";
  if (slide.page === 3) return "roadmap";
  if (slide.page === 4 || slide.title.includes("结论") || slide.title.includes("核心洞察")) return "manifesto";
  if (slide.page === 11 || slide.title.includes("架构") || slide.title.includes("闭环")) return "architecture";
  if (/第一层|第二层|第三层|第四层|第五层|第六层|第七层|第八层/.test(slide.title)) return "layer";
  if (slide.title.includes("问题线") || slide.title.includes("幻觉") || slide.title.includes("坑")) return "case";
  if (slide.title.includes("路线图") || slide.title.includes("阶段") || slide.title.includes("下一阶段")) return "timeline";
  if (slide.title.includes("建议") || slide.title.includes("Q&A")) return "cards";
  if (slide.page === 60) return "closing";
  return slide.page % 5 === 0 ? "diagram" : "editorial";
}

function pillList(items, limit = 6) {
  return items.slice(0, limit).map((item, index) => `<span class="pill" style="--i:${index}">${esc(item)}</span>`).join("");
}

function bulletList(items, limit = 5) {
  return `<ul class="bullet-list">${items.slice(0, limit).map((item, index) => `<li class="reveal" style="--d:${index}"><span>${esc(item)}</span></li>`).join("")}</ul>`;
}

function flowDiagram(items) {
  const visible = items.slice(0, 5);
  return `<div class="flow-diagram">${visible.map((item, index) => `
    <div class="flow-node reveal" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(item.replace(/：.*/, ""))}</span>
    </div>
  `).join('<div class="flow-arrow">→</div>')}</div>`;
}

function orbitDiagram(items) {
  const visible = items.slice(0, 6);
  return `<div class="orbit-diagram">
    <div class="orbit-core">
      <span>Digital</span>
      <strong>Worker</strong>
    </div>
    ${visible.map((item, index) => `<div class="orbit-item orbit-${index}"><span>${esc(item.replace(/：.*/, ""))}</span></div>`).join("")}
  </div>`;
}

function timeline(items) {
  return `<div class="timeline">${items.slice(0, 5).map((item, index) => `
    <div class="timeline-row reveal" style="--d:${index}">
      <b>${String(index + 1).padStart(2, "0")}</b>
      <span>${esc(item)}</span>
    </div>
  `).join("")}</div>`;
}

function slideBody(slide, note, kind) {
  if (kind === "cover") {
    return `
      <div class="cover-grid">
        <div class="cover-copy">
          <div class="eyebrow reveal">GIAC 2026 · Agent Architecture</div>
          <h1 class="cover-title reveal">${esc(slide.title)}</h1>
          <p class="cover-subtitle reveal">${esc(slide.subtitle)}</p>
          <div class="cover-meta reveal">
            <span>白朋飞 · FIIT.AI</span>
            <span>50 min talk + 10 min Q&amp;A</span>
          </div>
        </div>
        <div class="cover-art reveal">
          <div class="editorial-window">
            <div class="window-dots"><i></i><i></i><i></i></div>
            <div class="worker-map">
              <span>LLM</span><span>Runtime</span><span>Policy</span><span>Skill</span><span>Channel</span><span>Worker</span>
            </div>
          </div>
        </div>
      </div>`;
  }
  if (kind === "closing") {
    return `
      <div class="closing-card reveal">
        <img src="${logoDataUrl()}" alt="Fiitx" />
        <h2>${esc(slide.title)}</h2>
        <p>${esc(slide.subtitle)}</p>
        <blockquote>${esc(slide.kicker)}</blockquote>
      </div>`;
  }
  if (kind === "architecture") {
    return `
      <div class="split-layout">
        <div>
          ${bulletList(slide.bullets, 5)}
          <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
        </div>
        ${orbitDiagram(slide.bullets)}
      </div>`;
  }
  if (kind === "roadmap" || kind === "timeline") {
    return `
      <div class="split-layout wide-right">
        <div>
          <div class="section-number">${String(slide.page).padStart(2, "0")}</div>
          <p class="speaker-note">${esc(note?.note || slide.subtitle)}</p>
          <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
        </div>
        ${timeline(slide.bullets)}
      </div>`;
  }
  if (kind === "layer" || kind === "diagram") {
    return `
      <div class="diagram-layout">
        ${flowDiagram(slide.bullets)}
        <div class="diagram-caption reveal">
          <span>Architecture Lens</span>
          <strong>${esc(slide.kicker || note?.takeaway || "")}</strong>
        </div>
      </div>`;
  }
  if (kind === "manifesto") {
    return `
      <div class="manifesto">
        <blockquote class="reveal">${esc(slide.subtitle || slide.kicker)}</blockquote>
        <div class="manifesto-grid">${slide.bullets.slice(0, 5).map((item, index) => `
          <div class="manifesto-card reveal" style="--d:${index}">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <span>${esc(item)}</span>
          </div>`).join("")}</div>
      </div>`;
  }
  if (kind === "case") {
    return `
      <div class="case-layout">
        <div class="case-label reveal">Field Note / ${String(slide.page).padStart(2, "0")}</div>
        <div class="case-board">
          ${slide.bullets.slice(0, 4).map((item, index) => `
            <div class="sticky sticky-${index} reveal" style="--d:${index}">
              <b>${index % 2 ? "How" : "Why"}</b>
              <span>${esc(item)}</span>
            </div>`).join("")}
        </div>
        <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>
      </div>`;
  }
  if (kind === "cards") {
    return `
      <div class="card-grid">
        ${slide.bullets.slice(0, 6).map((item, index) => `
          <article class="content-card reveal" style="--d:${index}">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <p>${esc(item)}</p>
          </article>`).join("")}
      </div>
      <div class="takeaway reveal">${esc(slide.kicker || note?.takeaway || "")}</div>`;
  }
  return `
    <div class="editorial-layout">
      <div class="pull-quote reveal">${esc(slide.kicker || slide.subtitle)}</div>
      <div>
        ${bulletList(slide.bullets, 5)}
        <div class="chip-row reveal">${pillList(slide.bullets, 4)}</div>
      </div>
    </div>`;
}

function renderSlide(slide, note, total) {
  const kind = slideKind(slide);
  const active = slide.page === 1 ? " active visible" : "";
  return `
    <!-- Slide ${slide.page}: ${esc(slide.title)} -->
    <section class="slide slide-${kind}${active}" data-slide="${slide.page}" data-kind="${kind}">
      <div class="paper-grain"></div>
      <div class="slide-chrome">
        <span>Fiitx / OpenClaw</span>
        <span>${String(slide.page).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
      </div>
      <div class="page-mark">${String(slide.page).padStart(2, "0")}</div>
      <div class="slide-frame">
        ${kind !== "cover" && kind !== "closing" ? `
          <header class="slide-header">
            <div class="eyebrow reveal">From LLM to Digital Worker</div>
            <h2 class="reveal">${esc(slide.title)}</h2>
            <p class="reveal">${esc(slide.subtitle)}</p>
          </header>` : ""}
        <main class="slide-main">
          ${slideBody(slide, note, kind)}
        </main>
      </div>
      ${note?.note ? `<!-- speaker-note: ${esc(note.note)} -->` : ""}
    </section>`;
}

function css(viewportCss) {
  return `
    /* === THEME TOKENS === */
    :root {
      --stage-bg: #2a0912;
      --slide-bg: #f6e8c7;
      --paper: #f6e8c7;
      --paper-deep: #ecd49a;
      --dusty-pink: #d9a2a7;
      --pink-soft: #f0c5c8;
      --mustard: #e0aa45;
      --mustard-cream: #f6e8c7;
      --burgundy: #4a0d1d;
      --burgundy-deep: #2a0912;
      --ink: #35101a;
      --muted: #7f5860;
      --line: rgba(74, 13, 29, 0.18);
      --shadow: rgba(74, 13, 29, 0.18);
      --font-display: "Instrument Serif", serif;
      --font-body: "Bricolage Grotesque", sans-serif;
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --duration-normal: 760ms;
    }

    /* === RESET AND FIXED VIEWPORT === */
    * { box-sizing: border-box; }
    ${viewportCss}

    /* === BASE SLIDE SURFACE === */
    body { font-family: var(--font-body); color: var(--ink); }
    .slide {
      background:
        radial-gradient(circle at 86% 10%, rgba(217, 162, 167, 0.45), transparent 28%),
        radial-gradient(circle at 6% 88%, rgba(224, 170, 69, 0.33), transparent 31%),
        linear-gradient(135deg, #f8ecd0 0%, #f4dfae 56%, #eec0c5 100%);
    }
    .paper-grain {
      position: absolute;
      inset: 0;
      opacity: 0.23;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
      mix-blend-mode: multiply;
    }
    .slide::before {
      content: "";
      position: absolute;
      inset: 52px;
      border: 2px solid rgba(74, 13, 29, 0.2);
      border-radius: 34px;
      pointer-events: none;
    }
    .slide::after {
      content: "";
      position: absolute;
      right: 90px;
      top: 106px;
      width: 330px;
      height: 330px;
      background: var(--dusty-pink);
      opacity: 0.22;
      border-radius: 54% 46% 62% 38%;
      transform: rotate(-15deg);
      pointer-events: none;
    }
    .slide-frame { position: relative; z-index: 2; width: 100%; height: 100%; padding: 88px 106px; }
    .slide-chrome {
      position: absolute;
      left: 106px;
      right: 106px;
      bottom: 48px;
      z-index: 4;
      display: flex;
      justify-content: space-between;
      color: rgba(74, 13, 29, 0.56);
      font-size: 22px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .page-mark {
      position: absolute;
      right: 112px;
      top: 82px;
      z-index: 3;
      font-family: var(--font-display);
      font-size: 108px;
      line-height: 0.9;
      color: rgba(74, 13, 29, 0.11);
    }

    /* === TYPOGRAPHY === */
    .eyebrow {
      font-size: 22px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--mustard);
      font-weight: 800;
    }
    .slide-header { max-width: 1260px; }
    .slide-header h2 {
      margin: 16px 0 8px;
      font-family: var(--font-display);
      font-size: 84px;
      line-height: 0.94;
      font-weight: 400;
      color: var(--burgundy);
      letter-spacing: -0.015em;
    }
    .slide-header p {
      max-width: 940px;
      color: var(--muted);
      font-size: 34px;
      line-height: 1.24;
      font-weight: 520;
    }
    .slide-main { position: relative; margin-top: 54px; }
    .takeaway {
      margin-top: 36px;
      padding: 28px 34px;
      border-left: 10px solid var(--mustard);
      background: rgba(255, 255, 255, 0.34);
      border-radius: 0 28px 28px 0;
      font-family: var(--font-display);
      font-size: 34px;
      line-height: 1.18;
      color: var(--burgundy);
      box-shadow: 0 16px 36px var(--shadow);
    }

    /* === ANIMATION SYSTEM === */
    .reveal {
      opacity: 0;
      transform: translateY(26px);
      transition:
        opacity var(--duration-normal) var(--ease-out-expo),
        transform var(--duration-normal) var(--ease-out-expo),
        filter var(--duration-normal) var(--ease-out-expo);
      transition-delay: calc(90ms + var(--d, 0) * 90ms);
      filter: blur(4px);
    }
    .slide.visible .reveal {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }

    /* === COVER === */
    .slide-cover::after { width: 580px; height: 580px; right: 126px; top: 174px; opacity: 0.34; }
    .cover-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 70px; align-items: center; height: 880px; }
    .cover-title {
      margin: 26px 0 26px;
      font-family: var(--font-display);
      font-size: 128px;
      line-height: 0.86;
      font-weight: 400;
      letter-spacing: -0.035em;
      color: var(--burgundy);
    }
    .cover-subtitle { font-size: 46px; line-height: 1.15; max-width: 780px; color: var(--ink); }
    .cover-meta { margin-top: 58px; display: flex; gap: 22px; flex-wrap: wrap; }
    .cover-meta span {
      border: 2px solid var(--line);
      background: rgba(255, 255, 255, 0.32);
      border-radius: 999px;
      padding: 16px 24px;
      color: var(--burgundy);
      font-weight: 800;
      font-size: 24px;
    }
    .editorial-window {
      width: 690px;
      height: 650px;
      padding: 54px;
      border-radius: 42px;
      background: linear-gradient(145deg, var(--burgundy) 0%, #6e1f32 100%);
      box-shadow: 0 40px 100px rgba(42, 9, 18, 0.42);
      color: var(--mustard-cream);
      transform: rotate(-2deg);
    }
    .window-dots { display: flex; gap: 14px; margin-bottom: 54px; }
    .window-dots i { width: 22px; height: 22px; border-radius: 50%; background: var(--dusty-pink); }
    .worker-map { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
    .worker-map span {
      min-height: 106px;
      display: grid;
      place-items: center;
      border: 2px solid rgba(246, 232, 199, 0.28);
      border-radius: 26px;
      font-size: 31px;
      font-weight: 900;
      background: rgba(246, 232, 199, 0.06);
    }

    /* === COMMON LAYOUTS === */
    .split-layout { display: grid; grid-template-columns: 0.95fr 1.05fr; gap: 70px; align-items: center; }
    .split-layout.wide-right { grid-template-columns: 0.72fr 1.28fr; }
    .editorial-layout { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 72px; align-items: start; }
    .pull-quote {
      font-family: var(--font-display);
      font-size: 58px;
      line-height: 1.02;
      color: var(--burgundy);
      padding: 46px;
      border-radius: 34px;
      background: rgba(217, 162, 167, 0.32);
      box-shadow: 0 24px 70px rgba(74, 13, 29, 0.18);
    }
    .bullet-list { list-style: none; display: grid; gap: 22px; margin: 0; padding: 0; }
    .bullet-list li {
      display: grid;
      grid-template-columns: 42px 1fr;
      gap: 20px;
      align-items: start;
      color: var(--ink);
      font-size: 34px;
      line-height: 1.22;
      font-weight: 650;
    }
    .bullet-list li::before {
      content: "";
      width: 24px;
      height: 24px;
      margin-top: 9px;
      border-radius: 50%;
      background: var(--burgundy);
      box-shadow: 0 0 0 12px rgba(217, 162, 167, 0.34);
    }
    .chip-row { margin-top: 38px; display: flex; flex-wrap: wrap; gap: 12px; }
    .pill {
      padding: 12px 18px;
      border-radius: 999px;
      background: rgba(74, 13, 29, 0.08);
      border: 1px solid rgba(74, 13, 29, 0.14);
      color: var(--burgundy);
      font-size: 20px;
      font-weight: 800;
      max-width: 360px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* === DIAGRAMS === */
    .orbit-diagram {
      position: relative;
      width: 720px;
      height: 610px;
      margin: 0 auto;
      border-radius: 50%;
      border: 2px dashed rgba(74, 13, 29, 0.25);
    }
    .orbit-diagram::before, .orbit-diagram::after {
      content: "";
      position: absolute;
      border-radius: 50%;
      border: 2px solid rgba(224, 170, 69, 0.45);
      inset: 86px;
    }
    .orbit-diagram::after { inset: 168px; border-color: rgba(217, 162, 167, 0.56); }
    .orbit-core {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 250px;
      height: 250px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      align-content: center;
      background: var(--burgundy);
      color: var(--mustard-cream);
      box-shadow: 0 28px 70px rgba(74, 13, 29, 0.32);
      z-index: 2;
    }
    .orbit-core span { font-size: 26px; color: var(--dusty-pink); text-transform: uppercase; letter-spacing: 0.12em; }
    .orbit-core strong { font-family: var(--font-display); font-size: 58px; font-weight: 400; }
    .orbit-item {
      position: absolute;
      width: 210px;
      min-height: 84px;
      display: grid;
      place-items: center;
      padding: 14px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.46);
      border: 2px solid rgba(74, 13, 29, 0.18);
      box-shadow: 0 16px 40px rgba(74, 13, 29, 0.13);
      font-size: 24px;
      font-weight: 900;
      color: var(--burgundy);
      text-align: center;
    }
    .orbit-0 { left: 255px; top: -42px; }
    .orbit-1 { right: -18px; top: 118px; }
    .orbit-2 { right: 24px; bottom: 90px; }
    .orbit-3 { left: 255px; bottom: -38px; }
    .orbit-4 { left: -20px; bottom: 96px; }
    .orbit-5 { left: -18px; top: 118px; }
    .diagram-layout { display: grid; gap: 52px; }
    .flow-diagram { display: flex; align-items: stretch; gap: 18px; }
    .flow-node {
      flex: 1;
      min-height: 230px;
      padding: 26px 22px;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.42);
      border: 2px solid rgba(74, 13, 29, 0.18);
      box-shadow: 0 20px 48px rgba(74, 13, 29, 0.13);
    }
    .flow-node b { display: block; font-family: var(--font-display); font-size: 62px; color: var(--dusty-pink); font-weight: 400; }
    .flow-node span { display: block; margin-top: 24px; font-size: 28px; line-height: 1.15; font-weight: 900; color: var(--burgundy); }
    .flow-arrow { display: grid; place-items: center; color: var(--mustard); font-size: 40px; font-weight: 900; }
    .diagram-caption {
      padding: 34px 44px;
      border-radius: 32px;
      background: var(--burgundy);
      color: var(--mustard-cream);
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 34px;
      align-items: center;
      box-shadow: 0 28px 70px rgba(74, 13, 29, 0.25);
    }
    .diagram-caption span { color: var(--dusty-pink); font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
    .diagram-caption strong { font-family: var(--font-display); font-size: 40px; line-height: 1.1; font-weight: 400; }

    /* === TIMELINE AND CARDS === */
    .section-number { font-family: var(--font-display); font-size: 150px; line-height: 0.8; color: rgba(74, 13, 29, 0.18); }
    .speaker-note { margin-top: 36px; max-width: 560px; font-size: 29px; line-height: 1.32; color: var(--muted); font-weight: 600; }
    .timeline { display: grid; gap: 20px; }
    .timeline-row {
      min-height: 94px;
      display: grid;
      grid-template-columns: 96px 1fr;
      align-items: center;
      gap: 24px;
      padding: 22px 28px;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.42);
      border: 2px solid rgba(74, 13, 29, 0.14);
    }
    .timeline-row b { font-family: var(--font-display); font-size: 50px; color: var(--mustard); font-weight: 400; }
    .timeline-row span { font-size: 31px; line-height: 1.18; font-weight: 760; color: var(--burgundy); }
    .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
    .content-card {
      min-height: 206px;
      padding: 26px;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.42);
      border: 2px solid rgba(74, 13, 29, 0.15);
      box-shadow: 0 16px 40px rgba(74, 13, 29, 0.1);
    }
    .content-card b { display: block; font-family: var(--font-display); font-size: 50px; color: var(--dusty-pink); font-weight: 400; }
    .content-card p { margin-top: 12px; font-size: 26px; line-height: 1.2; font-weight: 720; color: var(--burgundy); }

    /* === CASE STUDY STICKIES === */
    .case-layout { display: grid; grid-template-columns: 1fr 1.1fr; gap: 54px; align-items: start; }
    .case-label {
      grid-column: 1 / -1;
      width: fit-content;
      padding: 12px 22px;
      background: var(--burgundy);
      color: var(--mustard-cream);
      border-radius: 999px;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .case-board {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 22px;
    }
    .sticky {
      min-height: 260px;
      padding: 30px;
      border-radius: 24px;
      background: var(--paper-deep);
      border: 2px solid rgba(74, 13, 29, 0.18);
      box-shadow: 0 20px 46px rgba(74, 13, 29, 0.16);
      transform: rotate(calc((var(--d, 0) - 1.5) * 1.5deg));
    }
    .sticky-1, .sticky-3 { background: var(--pink-soft); }
    .sticky b { display: block; color: var(--burgundy); font-size: 22px; text-transform: uppercase; letter-spacing: 0.14em; }
    .sticky span { display: block; margin-top: 26px; color: var(--ink); font-size: 30px; line-height: 1.18; font-weight: 820; }
    .case-layout .takeaway { grid-column: 1 / -1; margin-top: 2px; }

    /* === MANIFESTO === */
    .manifesto blockquote {
      max-width: 1280px;
      font-family: var(--font-display);
      color: var(--burgundy);
      font-size: 74px;
      line-height: 0.98;
      font-weight: 400;
    }
    .manifesto-grid { margin-top: 60px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
    .manifesto-card {
      min-height: 210px;
      padding: 24px;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.39);
      border: 2px solid rgba(74, 13, 29, 0.15);
    }
    .manifesto-card b { font-family: var(--font-display); font-size: 52px; color: var(--mustard); font-weight: 400; }
    .manifesto-card span { display: block; margin-top: 18px; color: var(--burgundy); font-size: 27px; line-height: 1.13; font-weight: 820; }

    /* === CLOSING === */
    .closing-card {
      width: 940px;
      margin: 42px auto 0;
      padding: 52px 72px;
      text-align: center;
      border-radius: 44px;
      background: rgba(255, 255, 255, 0.44);
      border: 2px solid rgba(74, 13, 29, 0.17);
      box-shadow: 0 30px 86px rgba(74, 13, 29, 0.24);
    }
    .closing-card img { width: 142px; height: auto; object-fit: contain; margin-bottom: 18px; }
    .closing-card h2 { font-family: var(--font-display); font-size: 96px; font-weight: 400; color: var(--burgundy); }
    .closing-card p { margin-top: 8px; font-size: 31px; font-weight: 800; color: var(--muted); }
    .closing-card blockquote { margin-top: 30px; font-family: var(--font-display); font-size: 40px; line-height: 1.08; color: var(--burgundy); }

    /* === CONTROLS AND EDITING === */
    .deck-controls {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(42, 9, 18, 0.76);
      color: var(--mustard-cream);
      font-family: var(--font-body);
      font-size: 14px;
      backdrop-filter: blur(12px);
      opacity: 0.34;
      transition: opacity 0.2s ease;
    }
    .deck-controls:hover { opacity: 1; }
    .deck-controls button {
      border: 0;
      border-radius: 999px;
      background: rgba(246, 232, 199, 0.15);
      color: inherit;
      padding: 8px 12px;
      font: inherit;
      cursor: pointer;
    }
    .edit-hotzone { position: fixed; top: 0; left: 0; width: 80px; height: 80px; z-index: 10000; }
    .edit-toggle {
      position: fixed;
      top: 18px;
      left: 18px;
      z-index: 10001;
      opacity: 0;
      pointer-events: none;
      border: 0;
      border-radius: 999px;
      background: var(--burgundy);
      color: var(--mustard-cream);
      padding: 10px 14px;
      font: 700 14px var(--font-body);
      transition: opacity 0.24s ease;
    }
    .edit-toggle.show, .edit-toggle.active { opacity: 1; pointer-events: auto; }
    body.editing [data-editable] {
      outline: 2px dashed rgba(74, 13, 29, 0.45);
      outline-offset: 6px;
      cursor: text;
    }

    @media (prefers-reduced-motion: reduce) {
      .reveal { transition-duration: 0.01ms !important; }
    }
  `;
}

function script(total) {
  return `
    /* === SLIDE PRESENTATION CONTROLLER === */
    class SlidePresentation {
      constructor() {
        this.slides = Array.from(document.querySelectorAll(".slide"));
        this.stage = document.getElementById("deckStage");
        this.currentSlide = 0;
        this.setupStageScale();
        this.setupKeyboardNav();
        this.setupWheelNav();
        this.setupTouchNav();
        this.setupControls();
        this.setupEditor();
        const hashIndex = Number(location.hash.replace("#", "")) - 1;
        this.showSlide(Number.isFinite(hashIndex) && hashIndex >= 0 ? hashIndex : 0);
      }
      setupStageScale() {
        const scale = () => {
          const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
          const x = (window.innerWidth - 1920 * factor) / 2;
          const y = (window.innerHeight - 1080 * factor) / 2;
          this.stage.style.transform = \`translate(\${x}px, \${y}px) scale(\${factor})\`;
        };
        scale();
        window.addEventListener("resize", scale);
      }
      setupKeyboardNav() {
        document.addEventListener("keydown", (event) => {
          if (event.target?.getAttribute?.("contenteditable") === "true") return;
          if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(event.key)) {
            event.preventDefault();
            this.next();
          }
          if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
            event.preventDefault();
            this.prev();
          }
        });
      }
      setupWheelNav() {
        let last = 0;
        window.addEventListener("wheel", (event) => {
          const now = Date.now();
          if (now - last < 650 || Math.abs(event.deltaY) < 24) return;
          last = now;
          event.deltaY > 0 ? this.next() : this.prev();
        }, { passive: true });
      }
      setupTouchNav() {
        let startX = 0;
        window.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; }, { passive: true });
        window.addEventListener("touchend", (event) => {
          const dx = event.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 50) dx < 0 ? this.next() : this.prev();
        }, { passive: true });
      }
      setupControls() {
        document.getElementById("prevBtn").addEventListener("click", () => this.prev());
        document.getElementById("nextBtn").addEventListener("click", () => this.next());
      }
      setupEditor() {
        const hotzone = document.querySelector(".edit-hotzone");
        const toggle = document.getElementById("editToggle");
        let hideTimeout = null;
        const editor = {
          isActive: false,
          toggle: () => {
            editor.isActive = !editor.isActive;
            document.body.classList.toggle("editing", editor.isActive);
            toggle.classList.toggle("active", editor.isActive);
            document.querySelectorAll("[data-editable]").forEach((node) => {
              node.setAttribute("contenteditable", editor.isActive ? "true" : "false");
            });
          }
        };
        hotzone.addEventListener("mouseenter", () => {
          clearTimeout(hideTimeout);
          toggle.classList.add("show");
        });
        hotzone.addEventListener("mouseleave", () => {
          hideTimeout = setTimeout(() => { if (!editor.isActive) toggle.classList.remove("show"); }, 400);
        });
        toggle.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
        toggle.addEventListener("mouseleave", () => {
          hideTimeout = setTimeout(() => { if (!editor.isActive) toggle.classList.remove("show"); }, 400);
        });
        hotzone.addEventListener("click", editor.toggle);
        toggle.addEventListener("click", editor.toggle);
        document.addEventListener("keydown", (event) => {
          if ((event.key === "e" || event.key === "E") && event.target?.getAttribute?.("contenteditable") !== "true") editor.toggle();
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            localStorage.setItem("fiitx-frontend-slides-edits", document.getElementById("deckStage").innerHTML);
          }
        });
      }
      showSlide(index) {
        this.currentSlide = Math.max(0, Math.min(index, this.slides.length - 1));
        this.slides.forEach((slide, i) => {
          slide.classList.toggle("active", i === this.currentSlide);
          slide.classList.toggle("visible", i === this.currentSlide);
        });
        document.getElementById("counter").textContent = \`\${this.currentSlide + 1} / ${total}\`;
        history.replaceState(null, "", \`#\${this.currentSlide + 1}\`);
      }
      next() { this.showSlide(this.currentSlide + 1); }
      prev() { this.showSlide(this.currentSlide - 1); }
    }
    new SlidePresentation();
  `;
}

const viewportCss = readMaybe(VIEWPORT_CSS_PATH);
const slides = parseOutline(readMaybe(OUTLINE_PATH));
const notes = parseNotes(readMaybe(NOTES_PATH));
const total = slides.length;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>从 LLM 到 Digital Worker · Fiitx / OpenClaw</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,520;12..96,650;12..96,800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
${css(viewportCss)}
  </style>
</head>
<body>
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage">
      ${slides.map((slide) => renderSlide(slide, notes.get(slide.page), total)).join("\n")}
    </main>
  </div>
  <div class="deck-controls">
    <button id="prevBtn" type="button">Prev</button>
    <span id="counter">1 / ${total}</span>
    <button id="nextBtn" type="button">Next</button>
  </div>
  <div class="edit-hotzone"></div>
  <button class="edit-toggle" id="editToggle" type="button">Edit</button>
  <script>
${script(total)}
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
console.log(path.join(OUT_DIR, "index.html"));
