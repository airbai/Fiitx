/**
 * 📐 Analyzer — 户型图分析 & 屋顶面积估算
 *
 * 功能：
 *   1. 下载/读取户型图
 *   2. 用 OpenCV / AI 识别建筑轮廓
 *   3. 估算屋顶可用面积（考虑朝向、坡度）
 *   4. 估算可安装太阳能板数量
 *
 * 演示模式：基于建筑面积估算（屋顶面积 ≈ 建筑面积 × 0.7）
 * 真实模式：调用 AI 视觉 API 分析户型图
 */

export class Analyzer {
  constructor(opts) {
    this.isDemo = opts.mode === 'demo';
  }

  /**
   * 分析别墅户型图，估算屋顶信息
   * @param {object} property
   * @returns {Promise<{ roofArea: number, roofShape: string, orientation: string, estimatedPanels: number }>}
   */
  async analyze(property) {
    if (this.isDemo) {
      return this._demoAnalyze(property);
    }
    return this._realAnalyze(property);
  }

  // ─── 演示分析 ──────────────────────────────────────────────────────────────

  async _demoAnalyze(property) {
    console.log(`     📐 分析户型: ${property.title}`);

    // 模拟分析延迟
    await new Promise(r => setTimeout(r, 500));

    // 建筑面积 → 屋顶面积估算
    const buildingArea = property.area || 300;
    const roofArea = Math.round(buildingArea * (0.6 + Math.random() * 0.2));

    // 屋顶形状
    const shapes = ['平顶', '坡顶（单坡）', '坡顶（双坡）', '四坡顶', '不规则'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    // 朝向
    const orientations = ['朝南', '朝东南', '朝西南', '朝东'];
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];

    // 每块板 1.7m x 1.0m ≈ 1.7㎡，考虑安装间距利用率 ~80%
    const panelArea = 1.7;
    const usableRatio = 0.75;
    const estimatedPanels = Math.floor((roofArea * usableRatio) / panelArea);

    console.log(`     ✅ 屋顶面积: ${roofArea} ㎡ | 形状: ${shape} | 朝向: ${orientation} | 可装 ${estimatedPanels} 块板`);

    return {
      roofArea,
      roofShape: shape,
      orientation,
      estimatedPanels,
    };
  }

  // ─── 真实分析（AI视觉） ────────────────────────────────────────────────────

  async _realAnalyze(property) {
    console.log(`     🖼️ [AI] 分析户型图: ${property.floorPlanUrl || '无户型图链接'}`);

    // 如果有户型图URL，尝试下载分析
    if (property.floorPlanUrl && !property.floorPlanUrl.startsWith('https://example.com')) {
      try {
        const analysisResult = await this._callVisionAPI(property.floorPlanUrl);
        return analysisResult;
      } catch (err) {
        console.log(`     ⚠️  AI视觉分析失败: ${err.message}，使用建筑面积估算`);
      }
    }

    // Fallback: 建筑面积法
    const buildingArea = property.area || 300;
    const roofArea = Math.round(buildingArea * 0.7);
    const estimatedPanels = Math.floor((roofArea * 0.75) / 1.7);

    return {
      roofArea,
      roofShape: '平顶（估算）',
      orientation: '朝南（假设）',
      estimatedPanels,
    };
  }

  /**
   * 调用视觉AI API分析户型图
   * 支持 OpenAI Vision / 本地模型
   */
  async _callVisionAPI(imageUrl) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('需要 OPENAI_API_KEY 环境变量');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `你是一个建筑屋顶分析专家。分析户型图/建筑平面图，输出：
1. 估算屋顶面积（平方米）
2. 屋顶形状（平顶/坡顶/不规则）
3. 最佳安装朝向
4. 估算可安装太阳能板数量（标准板1.7m×1.0m）

以JSON格式输出，不要有其他文字。`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '分析这张户型图的屋顶安装太阳能条件：' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // 解析JSON
    try {
      const parsed = JSON.parse(text);
      return {
        roofArea: parsed.roofArea || 100,
        roofShape: parsed.roofShape || '平顶',
        orientation: parsed.orientation || '朝南',
        estimatedPanels: parsed.estimatedPanels || 20,
      };
    } catch {
      // 从文本中提取数字
      const areaMatch = text.match(/屋顶面积[：:]\s*(\d+)/);
      const panelMatch = text.match(/可安装[：:]\s*(\d+)/);
      return {
        roofArea: areaMatch ? parseInt(areaMatch[1]) : 100,
        roofShape: '未知',
        orientation: '朝南',
        estimatedPanels: panelMatch ? parseInt(panelMatch[1]) : 20,
      };
    }
  }
}
