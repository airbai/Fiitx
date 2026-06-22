#!/usr/bin/env node

/**
 * Solar Agent — 全网搜别墅户型图 → 太阳能实景图 → 报价 → 自动发邮件
 * ====================================================================
 *
 * Pipeline:
 *   [Searcher]  →  [Analyzer]  →  [Renderer]  →  [Pricer]  →  [Emailer]
 *   全网搜别墅      户型图分析      生成实景图      计算报价      发送邮件
 *
 * 用法:
 *   node agent.mjs --mode=demo              # 演示模式（无需外部API）
 *   node agent.mjs --city=上海 --max=5       # 真实模式
 *   node agent.mjs --resume                  # 从上次 checkpoint 继续
 *   node agent.mjs --help                    # 查看完整参数
 */

import { config } from 'dotenv';
config();

import { Searcher } from './modules/searcher.mjs';
import { Analyzer } from './modules/analyzer.mjs';
import { Renderer } from './modules/renderer.mjs';
import { Pricer } from './modules/pricer.mjs';
import { Emailer } from './modules/emailer.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_FILE = path.join(__dirname, '.checkpoint.json');
const RESULTS_DIR = path.join(__dirname, 'results');

// ─── 参数解析 ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: 'real',        // 'demo' | 'real'
    city: '上海',
    maxResults: 3,
    resume: false,
    headless: true,
    skipEmail: false,
    skipRender: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') return showHelp();
    if (arg === '--demo' || arg === '--mode=demo') opts.mode = 'demo';
    if (arg.startsWith('--city=')) opts.city = arg.split('=')[1];
    if (arg.startsWith('--max=')) opts.maxResults = parseInt(arg.split('=')[1]) || 3;
    if (arg === '--resume') opts.resume = true;
    if (arg === '--no-headless') opts.headless = false;
    if (arg === '--skip-email') opts.skipEmail = true;
    if (arg === '--skip-render') opts.skipRender = true;
  }

  return opts;
}

function showHelp() {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║         Solar Agent — 太阳能别墅勘察官            ║
  ╚════════════════════════════════════════════════════╝

  用法:
    node agent.mjs [选项]

  选项:
    --mode=demo       演示模式（用模拟数据，无需真实API）
    --city=上海       指定搜索城市（默认: 上海）
    --max=5           最多处理的别墅数量（默认: 3）
    --resume          从上次 checkpoint 继续
    --skip-email      跳过发送邮件步骤
    --skip-render     跳过图像生成步骤
    --no-headless     显示浏览器窗口（调试用）
    --help, -h        显示帮助

  环境变量 (.env):
    SEARCH_API_KEY      房产搜索API密钥（可选，默认用爬虫）
    OPENAI_API_KEY      OpenAI/图像生成API密钥
    MAIL_HOST= smtp.qq.com        邮件SMTP服务器
    MAIL_PORT= 465                 SMTP端口
    MAIL_USER= xxx@qq.com         发件邮箱
    MAIL_PASS= xxxx                SMTP授权码（非登录密码）
    EMAIL_QUOTA_DAILY= 50          每日发送上限

  示例:
    node agent.mjs --mode=demo
    node agent.mjs --city=北京 --max=5
    node agent.mjs --resume
  `);
  process.exit(0);
}

// ─── Checkpoint 持久化 ──────────────────────────────────────────────────────

async function saveCheckpoint(state) {
  state._timestamp = new Date().toISOString();
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(state, null, 2));
  console.log(`  💾 Checkpoint saved: step=${state.step}, processed=${state.processedCount}`);
}

async function loadCheckpoint() {
  try {
    const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function ensureResultsDir() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

// ─── 报告生成 ────────────────────────────────────────────────────────────────

async function generateReport(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(RESULTS_DIR, `report-${timestamp}.md`);

  let md = `# ☀️ Solar Agent 勘察报告\n\n`;
  md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
  md += `**城市**: ${results.city}\n`;
  md += `**处理别墅数**: ${results.properties.length}\n`;
  md += `**模式**: ${results.mode}\n\n`;
  md += `---\n\n`;

  for (const prop of results.properties) {
    md += `## 🏠 ${prop.title}\n\n`;
    md += `- **地址**: ${prop.address || '未知'}\n`;
    md += `- **来源**: ${prop.source || '未知'}\n`;
    md += `- **户型面积**: ${prop.area || '未知'} ㎡\n`;
    md += `- **户型图**: ${prop.floorPlanUrl || '无'}\n`;
    md += `- **估测屋顶面积**: ${prop.roofArea ? prop.roofArea + ' ㎡' : '未估算'}\n\n`;

    if (prop.solarRenderPath) {
      md += `### 太阳能板实景效果图\n\n`;
      md += `![太阳能实景图](${prop.solarRenderPath})\n\n`;
    }

    if (prop.quote) {
      md += `### 💰 报价单\n\n`;
      md += `| 项目 | 数量 | 单价 | 小计 |\n`;
      md += `|------|------|------|------|\n`;
      for (const item of prop.quote.items) {
        md += `| ${item.name} | ${item.qty} | ¥${item.unitPrice} | ¥${item.subtotal} |\n`;
      }
      md += `| **合计** | | | **¥${prop.quote.total}** |\n\n`;
      md += `> *每年预估发电: ${prop.quote.estimatedAnnualKwh} kWh*  \n`;
      md += `> *预估年收益: ¥${prop.quote.estimatedAnnualIncome}*  \n`;
      md += `> *预计回本周期: ${prop.quote.paybackYears} 年*\n\n`;
    }

    if (prop.emailStatus) {
      md += `### 📧 邮件发送\n\n`;
      md += `- **收件人**: ${prop.emailStatus.to || '未找到邮箱'}\n`;
      md += `- **状态**: ${prop.emailStatus.success ? '✅ 已发送' : '❌ 发送失败'}\n`;
      md += `- **时间**: ${prop.emailStatus.sentAt || '-'}\n\n`;
    }

    md += `---\n\n`;
  }

  md += `> *由 Solar Agent 自动生成 — ${new Date().toLocaleString('zh-CN')}*\n`;

  await fs.writeFile(reportPath, md, 'utf-8');
  console.log(`  📄 报告已生成: ${reportPath}`);
  return reportPath;
}

// ─── 主流程 ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  await ensureResultsDir();

  console.log(`
  ╔═══════════════════════════════════════════╗
  ║     ☀️  Solar Agent  —  太阳能勘察官     ║
  ║     全网搜别墅 → 实景图 → 报价 → 发邮件   ║
  ╚═══════════════════════════════════════════╝
  `);
  console.log(`  模式: ${opts.mode === 'demo' ? '🎪 演示模式' : '🌐 真实模式'}`);
  console.log(`  城市: ${opts.city}`);
  console.log(`  最大处理数: ${opts.maxResults}`);
  console.log('');

  // ── 初始化模块 ──
  const searcher = new Searcher(opts);
  const analyzer = new Analyzer(opts);
  const renderer = new Renderer(opts);
  const pricer = new Pricer(opts);
  const emailer = new Emailer(opts);

  // ── Checkpoint 恢复 ──
  let state;
  if (opts.resume) {
    state = await loadCheckpoint();
    if (!state) {
      console.log('  ⚠️  未找到 checkpoint，从头开始。\n');
      state = { step: 'search', city: opts.city, processedCount: 0, properties: [] };
    } else {
      console.log(`  🔄 从 checkpoint 恢复: step=${state.step}, 已处理 ${state.processedCount} 套\n`);
    }
  } else {
    state = { step: 'search', city: opts.city, processedCount: 0, properties: [] };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: 搜索
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'search') {
    console.log('  ── Step 1/5: 🔍 全网搜索有户型图的别墅 ──\n');

    const properties = await searcher.search({
      city: opts.city,
      maxResults: opts.maxResults,
    });

    if (properties.length === 0) {
      console.log('  ❌ 未找到符合条件的别墅。退出。');
      return;
    }

    state.properties = properties;
    state.step = 'analyze';
    await saveCheckpoint(state);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: 分析户型图
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'analyze') {
    console.log('\n  ── Step 2/5: 📐 分析户型图 & 估算屋顶面积 ──\n');

    for (const prop of state.properties) {
      if (prop._analyzed) {
        console.log(`  ⏭️  跳过已分析: ${prop.title}`);
        continue;
      }
      console.log(`  🏠 分析: ${prop.title}`);
      try {
        const analysis = await analyzer.analyze(prop);
        prop.roofArea = analysis.roofArea;
        prop.roofShape = analysis.roofShape;
        prop.orientation = analysis.orientation;
        prop.estimatedPanels = analysis.estimatedPanels;
        prop._analyzed = true;
        state.processedCount++;
        await saveCheckpoint(state);
      } catch (err) {
        console.error(`  ⚠️  分析失败: ${err.message}`);
        prop._analyzed = false;
        prop.roofArea = 50; // fallback
      }
    }
    state.step = 'render';
    await saveCheckpoint(state);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: 生成太阳能板实景图
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'render' && !opts.skipRender) {
    console.log('\n  ── Step 3/5: 🎨 生成太阳能板实景效果图 ──\n');

    for (const prop of state.properties) {
      if (prop._rendered) {
        console.log(`  ⏭️  跳过已渲染: ${prop.title}`);
        continue;
      }
      console.log(`  🖼️  生成: ${prop.title}`);
      try {
        const renderPath = await renderer.render(prop, RESULTS_DIR);
        prop.solarRenderPath = renderPath;
        prop._rendered = true;
        await saveCheckpoint(state);
      } catch (err) {
        console.error(`  ⚠️  渲染失败: ${err.message}`);
        prop._rendered = false;
      }
    }
    state.step = 'price';
    await saveCheckpoint(state);
  } else if (opts.skipRender) {
    console.log('\n  ⏭️  跳过 Step 3 (--skip-render)\n');
    state.step = 'price';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: 报价
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'price') {
    console.log('\n  ── Step 4/5: 💰 计算太阳能安装报价 ──\n');

    for (const prop of state.properties) {
      if (prop._priced) {
        console.log(`  ⏭️  跳过已报价: ${prop.title}`);
        continue;
      }
      console.log(`  💵 报价: ${prop.title} (屋顶 ${prop.roofArea || 50} ㎡)`);
      try {
        const quote = await pricer.calculate(prop);
        prop.quote = quote;
        prop._priced = true;
        await saveCheckpoint(state);
      } catch (err) {
        console.error(`  ⚠️  报价失败: ${err.message}`);
        prop._priced = false;
      }
    }
    state.step = 'email';
    await saveCheckpoint(state);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 5: 发送邮件
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'email' && !opts.skipEmail) {
    console.log('\n  ── Step 5/5: 📧 自动发送报价邮件给房东 ──\n');

    for (const prop of state.properties) {
      if (prop._emailed) {
        console.log(`  ⏭️  跳过已发送: ${prop.title}`);
        continue;
      }
      console.log(`  📨 发送给: ${prop.title}`);
      try {
        const result = await emailer.send(prop);
        prop.emailStatus = {
          to: result.to,
          success: result.success,
          sentAt: new Date().toLocaleString('zh-CN'),
          messageId: result.messageId,
        };
        prop._emailed = true;
        await saveCheckpoint(state);
      } catch (err) {
        console.error(`  ⚠️  邮件发送失败: ${err.message}`);
        prop.emailStatus = { to: prop.ownerEmail || '未知', success: false, error: err.message };
        prop._emailed = false;
      }
    }
    state.step = 'done';
    await saveCheckpoint(state);
  } else if (opts.skipEmail) {
    console.log('\n  ⏭️  跳过 Step 5 (--skip-email)\n');
    state.step = 'done';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Done: 生成报告
  // ──────────────────────────────────────────────────────────────────────────
  if (state.step === 'done') {
    console.log('\n  ── ✅ 全流程完成 ──\n');
    const reportPath = await generateReport({
      city: opts.city,
      mode: opts.mode,
      properties: state.properties,
    });

    // 打印摘要
    console.log('\n  📊 处理摘要:\n');
    for (const prop of state.properties) {
      console.log(`  ${prop._analyzed ? '✅' : '❌'} ${prop.title}`);
      if (prop.roofArea) console.log(`     屋顶面积: ${prop.roofArea} ㎡`);
      if (prop.quote) console.log(`     报价: ¥${prop.quote.total}`);
      if (prop.emailStatus) console.log(`     邮件: ${prop.emailStatus.success ? `✅ ${prop.emailStatus.to}` : '❌ 失败'}`);
      console.log('');
    }

    console.log(`  📄 完整报告: ${reportPath}`);
    console.log(`  💾 Checkpoint: ${CHECKPOINT_FILE}`);
    console.log('\n  🎉 完成!\n');
  }

  // 清理 checkpoint（全部成功后）
  if (state.step === 'done') {
    try {
      await fs.unlink(CHECKPOINT_FILE);
    } catch {}
  }
}

main().catch(err => {
  console.error('\n  ❌ Agent 异常退出:', err.message);
  console.error(err.stack);
  process.exit(1);
});
