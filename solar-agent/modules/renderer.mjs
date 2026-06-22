/**
 * 🎨 Renderer — 生成太阳能板安装实景效果图
 *
 * 生成方式（按优先级）：
 *   1. DALL-E 3 / OpenAI 图像生成（真实模式，需 API Key）
 *   2. HTML Canvas 渲染（演示模式，生成简单合成图）
 *   3. 纯描述输出（无API时的fallback）
 *
 * 输出：results/{propertyId}-solar.jpg
 */

import fs from 'fs/promises';
import path from 'path';

export class Renderer {
  constructor(opts) {
    this.isDemo = opts.mode === 'demo';
  }

  /**
   * 生成太阳能板安装后的实景效果图
   * @param {object} property
   * @param {string} outputDir
   * @returns {Promise<string>} 图片路径
   */
  async render(property, outputDir) {
    if (this.isDemo) {
      return this._demoRender(property, outputDir);
    }
    return this._aiRender(property, outputDir);
  }

  // ─── 演示渲染：生成HTML预览 + 截图描述 ───────────────────────────────────

  async _demoRender(property, outputDir) {
    const id = property.id || 'demo';
    console.log(`     🎨 生成太阳能实景效果图: ${property.title}`);

    // 模拟渲染延迟
    await new Promise(r => setTimeout(r, 800));

    const roofArea = property.roofArea || 50;
    const panels = property.estimatedPanels || Math.floor((roofArea * 0.75) / 1.7);

    // 生成一个 HTML 预览文件（可在浏览器中打开查看）
    const htmlPath = path.join(outputDir, `${id}-solar-preview.html`);
    const title = property.title;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>太阳能板实景效果 - ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
  }
  .card {
    background: white;
    border-radius: 24px;
    padding: 40px;
    max-width: 900px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  .header {
    text-align: center;
    margin-bottom: 30px;
  }
  .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 8px; }
  .header p { color: #666; font-size: 14px; }
  .scene {
    position: relative;
    width: 100%;
    height: 400px;
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(180deg, #87CEEB 0%, #E0F7FA 40%, #90EE90 40.1%, #228B22 100%);
    margin-bottom: 24px;
  }
  /* 太阳 */
  .sun {
    position: absolute;
    top: 30px;
    right: 60px;
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, #FFD700, #FFA500);
    border-radius: 50%;
    box-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
    animation: pulse 3s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.6); }
    50% { box-shadow: 0 0 80px rgba(255, 215, 0, 0.9); }
  }
  /* 房屋主体 */
  .house {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    width: 70%;
    height: 180px;
  }
  .house-body {
    position: absolute;
    bottom: 0;
    left: 5%;
    width: 90%;
    height: 120px;
    background: linear-gradient(135deg, #D4A574, #C4956A);
    border-radius: 4px 4px 0 0;
    border: 2px solid #B8860B;
  }
  .roof {
    position: absolute;
    bottom: 120px;
    left: 0;
    width: 100%;
    height: 70px;
    background: linear-gradient(135deg, #8B4513, #A0522D);
    clip-path: polygon(0% 100%, 10% 0%, 90% 0%, 100% 100%);
  }
  /* 太阳能板 */
  .solar-panels {
    position: absolute;
    bottom: 140px;
    left: 15%;
    width: 70%;
    height: 45px;
    display: flex;
    gap: 4px;
    justify-content: center;
    z-index: 2;
  }
  .panel {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #1a237e, #283593, #1a237e);
    border: 2px solid #0d47a1;
    border-radius: 3px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg,
      rgba(255,255,255,0.2) 0%,
      rgba(255,255,255,0.05) 30%,
      transparent 50%,
      rgba(255,255,255,0.1) 70%
    );
  }
  .panel::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 10%;
    width: 80%;
    height: 2px;
    background: rgba(255,255,255,0.15);
  }
  .grid-line-v {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: rgba(255,255,255,0.1);
  }
  .grid-line-h {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: rgba(255,255,255,0.1);
  }
  /* 门窗 */
  .window {
    position: absolute;
    width: 30px;
    height: 40px;
    background: linear-gradient(135deg, #87CEEB, #B0E0E6);
    border: 2px solid #8B4513;
    border-radius: 2px;
  }
  .door {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 35px;
    height: 65px;
    background: linear-gradient(135deg, #8B4513, #654321);
    border-radius: 3px 3px 0 0;
  }
  /* 信息面板 */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .info-item {
    background: #f5f7fa;
    padding: 16px;
    border-radius: 12px;
    text-align: center;
  }
  .info-item .label { font-size: 12px; color: #888; margin-bottom: 4px; }
  .info-item .value { font-size: 22px; font-weight: 700; color: #1a237e; }
  .info-item .unit { font-size: 12px; color: #666; }
  .badge {
    display: inline-block;
    background: linear-gradient(135deg, #43a047, #66bb6a);
    color: white;
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 13px;
    margin-top: 8px;
  }
  .footer {
    text-align: center;
    color: #999;
    font-size: 12px;
    margin-top: 16px;
    border-top: 1px solid #eee;
    padding-top: 16px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>☀️ ${title} — 太阳能板安装效果</h1>
    <p>AI 实景模拟 · 装机容量 ${panels * 0.4} kWp · 年预估发电 ${Math.round(panels * 0.4 * 1100)} kWh</p>
  </div>

  <div class="scene">
    <div class="sun"></div>
    <div class="house">
      <div class="roof"></div>
      <div class="solar-panels">
        ${Array.from({length: Math.min(panels, 14)}, (_, i) => `
        <div class="panel">
          <div class="grid-line-v"></div>
          <div class="grid-line-h"></div>
        </div>`).join('')}
      </div>
      <div class="house-body">
        <div class="window" style="left:15%;top:25px;"></div>
        <div class="window" style="right:15%;top:25px;"></div>
        <div class="door"></div>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="label">屋顶面积</div>
      <div class="value">${roofArea}</div>
      <div class="unit">平方米</div>
    </div>
    <div class="info-item">
      <div class="label">安装板数</div>
      <div class="value">${panels}</div>
      <div class="unit">块</div>
    </div>
    <div class="info-item">
      <div class="label">装机容量</div>
      <div class="value">${(panels * 0.4).toFixed(1)}</div>
      <div class="unit">kWp</div>
    </div>
    <div class="info-item" style="grid-column: span 3;">
      <div class="label" style="font-size:14px;">💡 安装太阳能板后，预计每年减少碳排放约 <strong>${Math.round(panels * 0.4 * 0.8)}</strong> 吨</div>
    </div>
  </div>

  <div class="badge">✅ 已生成实景效果图</div>
  <div class="footer">
    Solar Agent · AI 太阳能勘察系统 · ${new Date().toLocaleString('zh-CN')}
  </div>
</div>
</body>
</html>`;

    await fs.writeFile(htmlPath, html, 'utf-8');
    console.log(`     ✅ HTML 效果图已生成: ${htmlPath}`);

    return htmlPath;
  }

  // ─── AI 图像生成（DALL-E 3） ──────────────────────────────────────────────

  async _aiRender(property, outputDir) {
    const id = property.id || 'house';
    const apiKey = process.env.OPENAI_API_KEY;
    const roofArea = property.roofArea || 50;
    const panels = property.estimatedPanels || 20;

    console.log(`     🤖 [AI] 调用 DALL-E 3 生成实景图...`);

    if (!apiKey) {
      console.log(`     ⚠️  无 OPENAI_API_KEY，使用 HTML 预览代替`);
      return this._demoRender(property, outputDir);
    }

    try {
      const prompt = `A photorealistic aerial view of a luxury villa with solar panels installed on the roof.
The villa is a modern ${property.title} style house with a ${property.roofShape || 'sloped'} roof.
There are ${panels} dark blue solar panels neatly arranged on the roof surface.
The scene is sunny daytime, blue sky, green garden surroundings, trees.
Professional real estate photography style, high quality, 4K, showing the solar panels clearly and beautifully.`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`DALL-E ${response.status}: ${err}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (imageUrl) {
        // 下载图片
        const imgResponse = await fetch(imageUrl);
        const imgBuffer = await imgResponse.arrayBuffer();
        const imgPath = path.join(outputDir, `${id}-solar-render.jpg`);
        await fs.writeFile(imgPath, Buffer.from(imgBuffer));
        console.log(`     ✅ AI实景图已生成: ${imgPath}`);
        return imgPath;
      }

      throw new Error('未获取到图片URL');
    } catch (err) {
      console.log(`     ⚠️  DALL-E 生成失败: ${err.message}，回退到 HTML 预览`);
      return this._demoRender(property, outputDir);
    }
  }
}

// 当直接运行时生成独立预览
if (process.argv[1]?.includes('renderer')) {
  const demo = {
    id: 'standalone-demo',
    title: '上海佘山月湖山庄独栋别墅',
    roofArea: 180,
    estimatedPanels: 68,
    roofShape: '坡顶（双坡）',
  };
  const r = new Renderer({ mode: 'demo' });
  r.render(demo, './').then(p => console.log('Done:', p));
}
