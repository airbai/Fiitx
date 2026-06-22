/**
 * 💰 Pricer — 太阳能安装报价计算
 *
 * 报价模型：
 *   - 标准单晶硅板：1.7m × 1.0m，每块 400Wp
 *   - 综合单价（含安装/逆变器/支架/线缆）：¥3.5~4.5 / Wp
 *   - 年发电量估算：1kWp ≈ 1100 kWh/年（上海地区）
 *   - 上网电价：¥0.415 / kWh（余电上网）
 *   - 自用电价节省：¥0.6 / kWh（抵充市电）
 *   - 国家补贴：暂无（2024年后）
 *
 * 参考价格（2025年行业水平）：
 *   - 光伏板：¥0.8~1.2 / Wp
 *   - 逆变器：¥0.3~0.5 / Wp
 *   - 支架+线缆+安装：¥1.5~2.0 / Wp
 *   - 综合：¥3.0~4.5 / Wp
 */

export class Pricer {
  constructor(opts) {
    this.isDemo = opts.mode === 'demo';
    // 价格参数（可配置）
    this.pricePerWp = parseFloat(process.env.SOLAR_PRICE_PER_WP) || 3.8;    // ¥/Wp 综合单价
    this.annualKwhPerKwp = parseFloat(process.env.SOLAR_KWH_PER_KWP) || 1100; // kWh/kWp/年
    this.gridPrice = parseFloat(process.env.SOLAR_GRID_PRICE) || 0.415;      // 上网电价 ¥/kWh
    this.selfUsePrice = parseFloat(process.env.SOLAR_SELF_PRICE) || 0.60;    // 自用节省 ¥/kWh
    this.panelWp = 400;  // 每块板瓦数
  }

  /**
   * 计算完整报价
   * @param {object} property
   * @returns {Promise<object>} quote
   */
  async calculate(property) {
    if (this.isDemo) {
      return this._demoQuote(property);
    }
    return this._realQuote(property);
  }

  // ─── 演示报价 ──────────────────────────────────────────────────────────────

  async _demoQuote(property) {
    const roofArea = property.roofArea || 50;
    const panels = property.estimatedPanels || Math.floor((roofArea * 0.75) / 1.7);
    const totalWp = panels * this.panelWp / 1000; // kWp
    const totalPrice = Math.round(totalWp * this.pricePerWp * 10000); // ¥

    // 明细
    const items = [
      {
        name: '单晶硅太阳能板',
        qty: panels,
        unit: '块',
        unitPrice: this.panelWp / 1000 * 1.0 * 10000 / panels,
        subtotal: Math.round(totalWp * 1.0 * 10000),
      },
      {
        name: '组串式逆变器',
        qty: Math.ceil(totalWp / 10),
        unit: '台',
        unitPrice: Math.round(totalWp * 0.4 * 10000 / Math.ceil(totalWp / 10)),
        subtotal: Math.round(totalWp * 0.4 * 10000),
      },
      {
        name: '支架系统 + 安装施工',
        qty: 1,
        unit: '项',
        unitPrice: Math.round(totalWp * 1.2 * 10000),
        subtotal: Math.round(totalWp * 1.2 * 10000),
      },
      {
        name: '线缆 + 配电 + 并网',
        qty: 1,
        unit: '项',
        unitPrice: Math.round(totalWp * 0.6 * 10000),
        subtotal: Math.round(totalWp * 0.6 * 10000),
      },
      {
        name: '运维服务（5年）',
        qty: 1,
        unit: '项',
        unitPrice: Math.round(totalWp * 0.3 * 10000),
        subtotal: Math.round(totalWp * 0.3 * 10000),
      },
    ];

    // 最终合计
    const subtotalSum = items.reduce((s, i) => s + i.subtotal, 0);
    // 确保合计与 totalPrice 一致
    if (Math.abs(subtotalSum - totalPrice) > 100) {
      items[items.length - 1].subtotal += (totalPrice - subtotalSum);
    }

    // 年发电量
    const estimatedAnnualKwh = Math.round(totalWp * this.annualKwhPerKwp);
    // 年收益（50%自用，50%上网）
    const annualIncome = Math.round(
      estimatedAnnualKwh * 0.5 * this.selfUsePrice +
      estimatedAnnualKwh * 0.5 * this.gridPrice
    );
    // 回本周期
    const paybackYears = Math.round((totalPrice / annualIncome) * 10) / 10;

    await new Promise(r => setTimeout(r, 300));

    console.log(`     💵 报价: ¥${totalPrice.toLocaleString()} | 装机 ${totalWp.toFixed(1)} kWp | 年发电 ${estimatedAnnualKwh.toLocaleString()} kWh | 回本 ${paybackYears} 年`);

    return {
      items,
      total: totalPrice,
      totalWp: Math.round(totalWp * 100) / 100,
      panelCount: panels,
      estimatedAnnualKwh,
      estimatedAnnualIncome: annualIncome,
      paybackYears,
      selfUseRatio: '50%',
      gridFeedRatio: '50%',
      co2ReductionTons: Math.round(totalWp * 0.8 * 10) / 10,
      disclaimer: '以上报价为估算参考，实际价格需根据现场勘测确定。',
    };
  }

  // ─── 真实报价（更精细的模型） ──────────────────────────────────────────────

  async _realQuote(property) {
    // 使用相同的核心逻辑，但可以接入更精确的定价API
    const quote = await this._demoQuote(property);

    // 可以添加：实时电价查询、补贴政策、地区系数等
    // 例如接入国家电网API查询当地上网电价
    try {
      const regionFactor = await this._getRegionFactor(property);
      quote.estimatedAnnualKwh = Math.round(quote.totalWp * this.annualKwhPerKwp * regionFactor);
      quote.estimatedAnnualIncome = Math.round(
        quote.estimatedAnnualKwh * 0.5 * this.selfUsePrice +
        quote.estimatedAnnualKwh * 0.5 * this.gridPrice
      );
      quote.paybackYears = Math.round((quote.total / quote.estimatedAnnualIncome) * 10) / 10;
      quote.regionFactor = regionFactor;
    } catch {
      // 使用默认值
    }

    return quote;
  }

  /**
   * 获取地区光照系数
   */
  async _getRegionFactor(property) {
    // 简单地区系数映射（中国主要城市）
    const factors = {
      '上海': 1.0,
      '北京': 1.05,
      '广州': 0.95,
      '深圳': 0.95,
      '杭州': 0.98,
      '成都': 0.90,
      '昆明': 1.15,
      '拉萨': 1.30,
      '乌鲁木齐': 1.10,
      '哈尔滨': 0.95,
    };

    for (const [city, factor] of Object.entries(factors)) {
      if (property.title?.includes(city) || property.address?.includes(city)) {
        return factor;
      }
    }
    return 1.0;
  }
}
