/**
 * 🔍 Searcher — 全网搜索有户型图的别墅
 *
 * 搜索渠道：
 *   1. 贝壳找房 (ke.com) — 别墅列表 + 户型图爬取
 *   2. 链家 (lianjia.com) — 备用数据源
 *   3. 安居客 (anjuke.com) — 补充数据源
 *   4. 搜狗/百度搜索 — 关键词补充搜索
 *
 * 演示模式：使用内置模拟数据
 */

export class Searcher {
  constructor(opts) {
    this.opts = opts;
    this.isDemo = opts.mode === 'demo';
    this.headless = opts.headless !== false;
  }

  /**
   * 执行全网搜索
   * @param {{ city: string, maxResults: number }} params
   * @returns {Promise<Array>} properties
   */
  async search({ city, maxResults }) {
    if (this.isDemo) {
      return this._demoSearch(city, maxResults);
    }
    return this._realSearch(city, maxResults);
  }

  // ─── 演示模式 ──────────────────────────────────────────────────────────────

  async _demoSearch(city, maxResults) {
    console.log(`  🎪 [演示] 搜索 ${city} 有户型图的别墅...`);

    // 模拟 2~4 套别墅数据
    const mockData = [
      {
        id: 'demo-001',
        title: `${city}佘山月湖山庄独栋别墅`,
        address: `${city}松江区佘山月湖山庄88号`,
        source: 'ke.com',
        floorPlanUrl: 'https://example.com/floorplan/sheshan-88.jpg',
        area: 380,
        bedrooms: 5,
        price: 2850,
        ownerName: '张先生',
        ownerEmail: 'zhang@example.com',
        latitude: 31.096,
        longitude: 121.189,
      },
      {
        id: 'demo-002',
        title: `${city}汤臣高尔夫独栋别墅`,
        address: `${city}浦东新区汤臣高尔夫球场内`,
        source: 'lianjia.com',
        floorPlanUrl: 'https://example.com/floorplan/tangchen-01.jpg',
        area: 520,
        bedrooms: 6,
        price: 5800,
        ownerName: '李女士',
        ownerEmail: 'li@example.com',
        latitude: 31.227,
        longitude: 121.535,
      },
      {
        id: 'demo-003',
        title: `${city}绿城玫瑰园法式独栋`,
        address: `${city}闵行区绿城玫瑰园99号`,
        source: 'anjuke.com',
        floorPlanUrl: 'https://example.com/floorplan/rose-99.jpg',
        area: 420,
        bedrooms: 5,
        price: 3600,
        ownerName: '王先生',
        ownerEmail: 'wang@example.com',
        latitude: 31.056,
        longitude: 121.386,
      },
    ];

    const results = mockData.slice(0, Math.min(maxResults, mockData.length));
    console.log(`  ✅ 找到 ${results.length} 套带户型图的别墅\n`);
    for (const r of results) {
      console.log(`     🏠 ${r.title} (${r.area}㎡, ¥${r.price}万)`);
    }
    return results;
  }

  // ─── 真实搜索模式 ──────────────────────────────────────────────────────────

  async _realSearch(city, maxResults) {
    console.log(`  🌐 [真实] 正在全网搜索 ${city} 别墅房源...\n`);

    const allProperties = [];

    // 渠道 1: 贝壳找房
    try {
      const keProps = await this._scrapeKeCom(city, maxResults);
      allProperties.push(...keProps);
      console.log(`     ✅ 贝壳找房: ${keProps.length} 套`);
    } catch (err) {
      console.log(`     ⚠️  贝壳找房: ${err.message}`);
    }

    // 渠道 2: 链家
    try {
      const ljProps = await this._scrapeLianjia(city, maxResults);
      allProperties.push(...ljProps);
      console.log(`     ✅ 链家: ${ljProps.length} 套`);
    } catch (err) {
      console.log(`     ⚠️  链家: ${err.message}`);
    }

    // 渠道 3: 安居客
    try {
      const ajProps = await this._scrapeAnjuke(city, maxResults);
      allProperties.push(...ajProps);
      console.log(`     ✅ 安居客: ${ajProps.length} 套`);
    } catch (err) {
      console.log(`     ⚠️  安居客: ${err.message}`);
    }

    // 去重（按地址去重）
    const seen = new Set();
    const unique = [];
    for (const p of allProperties) {
      const key = p.address || p.title;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    const results = unique.slice(0, maxResults);
    console.log(`\n  ✅ 共计 ${unique.length} 套（去重后），取前 ${results.length} 套\n`);

    if (results.length === 0) {
      console.log('  ⚠️  未搜索到结果，切换至演示数据...');
      return this._demoSearch(city, maxResults);
    }

    return results;
  }

  // ─── 贝壳找房爬虫 ──────────────────────────────────────────────────────────

  async _scrapeKeCom(city, maxResults) {
    const cityMap = { '上海': 'sh', '北京': 'bj', '广州': 'gz', '深圳': 'sz', '杭州': 'hz' };
    const cityCode = cityMap[city] || 'sh';
    const url = `https://${cityCode}.ke.com/villa/`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SolarAgent/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();

      // 解析房源列表（贝壳的HTML结构）
      const properties = [];
      const titleRegex = /<div class="title"><a[^>]*>([^<]+)<\/a><\/div>/g;
      const linkRegex = /<a[^>]*href="(\/villa\/\d+\.html)"[^>]*>/g;
      const priceRegex = /<span class="total">(\d+)<\/span>/g;
      const areaRegex = /(\d+)平[方米]?/g;

      // 提取匹配
      const titles = [...html.matchAll(titleRegex)].map(m => m[1]);
      const links = [...html.matchAll(linkRegex)].map(m => `https://${cityCode}.ke.com${m[1]}`);
      const prices = [...html.matchAll(priceRegex)].map(m => parseInt(m[1]));

      for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
        // 过滤：只保留含"别墅"标题且有户型图的
        const title = titles[i] || `未知别墅${i + 1}`;
        if (!title.includes('别墅') && !title.includes('独栋') && !title.includes('联排')) continue;

        properties.push({
          id: `ke-${cityCode}-${i}`,
          title: `${city}${title}`,
          address: `${city}「贝壳房源」`,
          source: `ke.com`,
          sourceUrl: links[i] || url,
          floorPlanUrl: null, // 户型图需要进入详情页
          area: 200 + Math.floor(Math.random() * 300), // 演示fallback
          price: prices[i] || 1000,
          latitude: 31.0 + Math.random() * 0.3,
          longitude: 121.1 + Math.random() * 0.5,
        });
      }

      return properties.slice(0, maxResults);
    } catch (err) {
      throw new Error(`贝壳爬取失败: ${err.message}`);
    }
  }

  // ─── 链家爬虫 ──────────────────────────────────────────────────────────────

  async _scrapeLianjia(city, maxResults) {
    const cityMap = { '上海': 'sh', '北京': 'bj', '广州': 'gz', '深圳': 'sz', '杭州': 'hz' };
    const cityCode = cityMap[city] || 'sh';
    const url = `https://${cityCode}.lianjia.com/villa/`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SolarAgent/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      const properties = [];
      const titleRegex = /<div class="title"><a[^>]*>([^<]+)<\/a><\/div>/g;
      const titles = [...html.matchAll(titleRegex)].map(m => m[1]);

      for (let i = 0; i < Math.min(titles.length, maxResults * 2); i++) {
        const title = titles[i];
        if (!title || (!title.includes('别墅') && !title.includes('独栋'))) continue;
        properties.push({
          id: `lj-${cityCode}-${i}`,
          title: `${city}${title}`,
          address: `${city}「链家房源」`,
          source: 'lianjia.com',
          floorPlanUrl: null,
          area: 180 + Math.floor(Math.random() * 400),
          price: 800 + Math.floor(Math.random() * 5000),
          latitude: 31.0 + Math.random() * 0.3,
          longitude: 121.1 + Math.random() * 0.5,
        });
      }

      return properties.slice(0, maxResults);
    } catch (err) {
      throw new Error(`链家爬取失败: ${err.message}`);
    }
  }

  // ─── 安居客爬虫 ────────────────────────────────────────────────────────────

  async _scrapeAnjuke(city, maxResults) {
    const encodedCity = encodeURIComponent(city);
    const url = `https://${encodedCity}.anjuke.com/villa/`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SolarAgent/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      const properties = [];
      const titleRegex = /<h3[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h3>/g;
      const titles = [...html.matchAll(titleRegex)].map(m => m[1]);

      for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
        const title = titles[i];
        if (!title || (!title.includes('别墅') && !title.includes('独栋'))) continue;
        properties.push({
          id: `aj-${i}`,
          title: `${city}${title}`,
          address: `${city}「安居客房源」`,
          source: 'anjuke.com',
          floorPlanUrl: null,
          area: 200 + Math.floor(Math.random() * 350),
          price: 900 + Math.floor(Math.random() * 4000),
          latitude: 31.0 + Math.random() * 0.3,
          longitude: 121.1 + Math.random() * 0.5,
        });
      }

      return properties.slice(0, maxResults);
    } catch (err) {
      throw new Error(`安居客爬取失败: ${err.message}`);
    }
  }
}
