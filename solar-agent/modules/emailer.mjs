/**
 * 📧 Emailer — 自动发送太阳能报价邮件给房东
 *
 * 功能：
 *   1. 查找/生成房东邮箱地址
 *   2. 构建带实景图和报价的HTML邮件
 *   3. 通过 SMTP 发送
 *   4. 每日发送限额保护
 *
 * 邮件模版包含：
 *   - 房屋太阳能改造方案
 *   - 实景效果图（附件或嵌入）
 *   - 详细报价单
 *   - 收益预测
 *   - 联系电话/二维码
 */

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

export class Emailer {
  constructor(opts) {
    this.isDemo = opts.mode === 'demo';
    this.dailyQuota = parseInt(process.env.EMAIL_QUOTA_DAILY) || 50;
    this.sentToday = 0;
  }

  /**
   * 发送报价邮件
   * @param {object} property
   * @returns {Promise<{ to: string, success: boolean, messageId?: string }>}
   */
  async send(property) {
    if (this.isDemo) {
      return this._demoSend(property);
    }
    return this._realSend(property);
  }

  // ─── 演示发送 ──────────────────────────────────────────────────────────────

  async _demoSend(property) {
    const to = property.ownerEmail || `${property.id}@房东邮箱.待查找`;

    console.log(`     📧 准备发送给: ${to}`);

    // 模拟查找邮箱
    const email = await this._findOwnerEmail(property);
    if (!email) {
      console.log(`     ⚠️  未找到 ${property.title} 的房东邮箱，使用占位`);
    }

    // 构建邮件内容（演示模式只打印日志）
    const subject = `☀️ 【太阳能改造方案】${property.title} — 屋顶光伏安装报价`;
    console.log(`     主题: ${subject}`);
    console.log(`     收件人: ${email || '（邮箱未找到）'}`);

    // 模拟邮件预览
    const previewPath = path.join(process.cwd(), 'results', `${property.id}-email-preview.html`);
    const html = this._buildEmailHTML(property, subject);

    await fs.writeFile(previewPath, html, 'utf-8');
    console.log(`     ✅ 邮件预览已保存: ${previewPath}`);

    // 模拟发送延迟
    await new Promise(r => setTimeout(r, 500));

    console.log(`     📨 邮件已发送 ✓`);

    return {
      to: email || `${property.id}@unknown.com`,
      success: true,
      messageId: `demo-${Date.now()}-${property.id}`,
      previewPath,
    };
  }

  // ─── 真实发送 ──────────────────────────────────────────────────────────────

  async _realSend(property) {
    const to = await this._findOwnerEmail(property);
    if (!to) {
      throw new Error(`未找到 ${property.title} 的房东邮箱地址`);
    }

    // 限额检查
    const sentFile = path.join(process.cwd(), 'results', '.email-sent-count');
    try {
      const count = parseInt(await fs.readFile(sentFile, 'utf-8')) || 0;
      if (count >= this.dailyQuota) {
        throw new Error(`已达每日发送上限 (${this.dailyQuota})`);
      }
      this.sentToday = count;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.sentToday = 0;
    }

    // 创建SMTP传输
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.qq.com',
      port: parseInt(process.env.MAIL_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const subject = `☀️ 【太阳能改造方案】${property.title} — 屋顶光伏安装报价`;
    const html = this._buildEmailHTML(property, subject);

    // 附件：实景图
    const attachments = [];
    if (property.solarRenderPath) {
      try {
        const ext = path.extname(property.solarRenderPath);
        attachments.push({
          filename: `solar-render${ext}`,
          path: property.solarRenderPath,
          cid: 'solar-render',
        });
      } catch {}
    }

    console.log(`     📨 发送中... (${to})`);

    const info = await transporter.sendMail({
      from: `"Solar Agent 太阳能勘察" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    });

    // 更新发送计数
    this.sentToday++;
    await fs.writeFile(sentFile, String(this.sentToday), 'utf-8');

    console.log(`     ✅ 发送成功: ${to} (messageId: ${info.messageId})`);

    return {
      to,
      success: true,
      messageId: info.messageId,
    };
  }

  // ─── 查找房东邮箱 ──────────────────────────────────────────────────────────

  async _findOwnerEmail(property) {
    // 1. 如果已有邮箱直接返回
    if (property.ownerEmail && property.ownerEmail.includes('@')) {
      return property.ownerEmail;
    }

    // 2. 演示模式用模拟数据
    if (this.isDemo) {
      const demoEmails = {
        'demo-001': 'zhang@example.com',
        'demo-002': 'li@example.com',
        'demo-003': 'wang@example.com',
      };
      return demoEmails[property.id] || null;
    }

    // 3. 真实模式：尝试多渠道查找
    const email = await this._searchOwnerEmail(property);
    return email;
  }

  /**
   * 多渠道搜索房东邮箱
   * 目前只实现了占位逻辑，实际可接入：
   *   - 房产网站经纪人联系方式
   *   - 企业工商信息API
   *   - 社交媒体搜索
   *   - 房产登记信息查询
   */
  async _searchOwnerEmail(property) {
    // 占位实现 — 需要接入真实数据源
    // 在实际产品中，这里会调用：
    // 1. 房产网站经纪人联系方式爬取
    // 2. 企查查/天眼查API查询产权公司
    // 3. 智能推测 (name@domain.com)

    console.log(`     🔍 正在搜索房东联系方式: ${property.title}`);

    // 基于房源信息推测
    const title = property.title || '';
    const address = property.address || '';

    // 如果有房东姓名
    if (property.ownerName) {
      const namePinyin = this._toPinyin(property.ownerName);
      // 常见邮箱模式
      const candidates = [
        `${namePinyin}@qq.com`,
        `${namePinyin}@163.com`,
        `${namePinyin}@gmail.com`,
        `${namePinyin}@sina.com`,
      ];
      console.log(`     推测邮箱: ${candidates[0]}（待验证）`);
      return candidates[0];
    }

    // 如果没有姓名，尝试从地址提取小区名作为域名
    const compoundMatch = address.match(/([\u4e00-\u9fa5]+(?:山庄|花园|别墅|公馆|庄园))/);
    if (compoundMatch) {
      const compound = compoundMatch[1];
      return `owner@${compound}.com`;
    }

    return null;
  }

  /**
   * 简单的中文转拼音（仅做邮箱推测用）
   */
  _toPinyin(chinese) {
    const map = {
      '张': 'zhang', '李': 'li', '王': 'wang', '陈': 'chen', '刘': 'liu',
      '赵': 'zhao', '周': 'zhou', '吴': 'wu', '徐': 'xu', '孙': 'sun',
      '马': 'ma', '朱': 'zhu', '胡': 'hu', '郭': 'guo', '林': 'lin',
      '何': 'he', '高': 'gao', '罗': 'luo', '郑': 'zheng', '梁': 'liang',
      '谢': 'xie', '宋': 'song', '唐': 'tang', '韩': 'han', '曹': 'cao',
      '许': 'xu', '邓': 'deng', '冯': 'feng', '萧': 'xiao', '程': 'cheng',
      '蔡': 'cai', '彭': 'peng', '潘': 'pan', '袁': 'yuan', '董': 'dong',
      '余': 'yu', '苏': 'su', '叶': 'ye', '吕': 'lv', '魏': 'wei',
      '蒋': 'jiang', '田': 'tian', '杜': 'du', '丁': 'ding', '沈': 'shen',
      '任': 'ren', '姚': 'yao', '卢': 'lu', '傅': 'fu', '钟': 'zhong',
      '崔': 'cui', '廖': 'liao', '谭': 'tan', '汪': 'wang', '范': 'fan',
      '金': 'jin', '方': 'fang', '石': 'shi', '夏': 'xia', '熊': 'xiong',
       '先生': '', '女士': '', '小姐': '',
    };
    let result = '';
    for (const char of chinese) {
      result += map[char] || char;
    }
    return result.toLowerCase() || 'owner';
  }

  // ─── 构建邮件HTML ──────────────────────────────────────────────────────────

  _buildEmailHTML(property, subject) {
    const quote = property.quote;
    const roofArea = property.roofArea || '待测';
    const panels = property.estimatedPanels || '待算';

    let quoteTable = '';
    if (quote && quote.items) {
      quoteTable = `
      <table style="width:100%; border-collapse: collapse; margin:16px 0;">
        <tr style="background:#1a237e; color:white;">
          <th style="padding:10px; text-align:left;">项目</th>
          <th style="padding:10px; text-align:center;">数量</th>
          <th style="padding:10px; text-align:right;">单价</th>
          <th style="padding:10px; text-align:right;">小计</th>
        </tr>
        ${quote.items.map(item => `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px;">${item.name}</td>
          <td style="padding:8px; text-align:center;">${item.qty} ${item.unit || ''}</td>
          <td style="padding:8px; text-align:right;">¥${item.unitPrice.toLocaleString()}</td>
          <td style="padding:8px; text-align:right;">¥${item.subtotal.toLocaleString()}</td>
        </tr>`).join('')}
        <tr style="background:#f5f7fa; font-weight:700;">
          <td style="padding:10px;" colspan="3">合计</td>
          <td style="padding:10px; text-align:right; color:#1a237e; font-size:18px;">¥${quote.total.toLocaleString()}</td>
        </tr>
      </table>`;
    }

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f5f7fa; font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:640px; margin:0 auto; background:white;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a237e,#283593); padding:32px 24px; text-align:center;">
      <div style="font-size:48px; margin-bottom:8px;">☀️</div>
      <h1 style="color:white; margin:0; font-size:22px;">太阳能屋顶改造方案</h1>
      <p style="color:rgba(255,255,255,0.8); margin:8px 0 0; font-size:14px;">${property.title}</p>
    </div>

    <div style="padding:24px;">

      <!-- 问候 -->
      <p style="font-size:16px; color:#333;">尊敬的业主您好，</p>
      <p style="color:#666; line-height:1.8;">
        我们通过 AI 分析贵别墅的户型图和屋顶条件，为您定制了以下太阳能光伏安装方案。
        利用闲置屋顶发电，不仅降低电费支出，还能为环保贡献力量。
      </p>

      <!-- 实景图 -->
      ${property.solarRenderPath ? `
      <div style="margin:20px 0; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <img src="cid:solar-render" alt="太阳能实景效果图" style="width:100%; display:block;">
        <div style="padding:8px; text-align:center; color:#999; font-size:12px; background:#fafafa;">
          AI 生成太阳能板安装实景效果图
        </div>
      </div>` : `
      <div style="margin:20px 0; padding:24px; background:linear-gradient(135deg,#e8f5e9,#c8e6c9); border-radius:12px; text-align:center;">
        <div style="font-size:32px;">🏠</div>
        <p style="color:#2e7d32; font-weight:600;">屋顶面积约 ${roofArea} ㎡，预计可安装 ${panels} 块太阳能板</p>
      </div>`}

      <!-- 方案参数 -->
      <h2 style="font-size:18px; color:#1a237e; margin:24px 0 12px; border-left:4px solid #1a237e; padding-left:12px;">📋 方案参数</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div style="background:#f5f7fa; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">屋顶面积</div>
          <div style="font-size:20px; font-weight:700; color:#1a237e;">${roofArea} ㎡</div>
        </div>
        <div style="background:#f5f7fa; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">装机容量</div>
          <div style="font-size:20px; font-weight:700; color:#1a237e;">${quote ? quote.totalWp : '?'} kWp</div>
        </div>
        <div style="background:#f5f7fa; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">太阳能板</div>
          <div style="font-size:20px; font-weight:700; color:#1a237e;">${panels} 块</div>
        </div>
        <div style="background:#f5f7fa; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">年发电量</div>
          <div style="font-size:20px; font-weight:700; color:#1a237e;">${quote ? quote.estimatedAnnualKwh.toLocaleString() : '?'} kWh</div>
        </div>
      </div>

      <!-- 报价单 -->
      <h2 style="font-size:18px; color:#1a237e; margin:24px 0 12px; border-left:4px solid #1a237e; padding-left:12px;">💰 报价明细</h2>
      ${quoteTable || '<p style="color:#999;">报价计算中...</p>'}

      ${quote ? `
      <!-- 收益分析 -->
      <h2 style="font-size:18px; color:#1a237e; margin:24px 0 12px; border-left:4px solid #1a237e; padding-left:12px;">📈 收益预测</h2>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div style="background:#e8f5e9; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">年预估收益</div>
          <div style="font-size:20px; font-weight:700; color:#2e7d32;">¥${quote.estimatedAnnualIncome.toLocaleString()}</div>
        </div>
        <div style="background:#e8f5e9; padding:12px; border-radius:8px;">
          <div style="font-size:12px; color:#888;">预计回本周期</div>
          <div style="font-size:20px; font-weight:700; color:#2e7d32;">${quote.paybackYears} 年</div>
        </div>
        <div style="background:#e8f5e9; padding:12px; border-radius:8px; grid-column:span 2;">
          <div style="font-size:12px; color:#888;">年减排 CO₂</div>
          <div style="font-size:20px; font-weight:700; color:#2e7d32;">${quote.co2ReductionTons} 吨</div>
        </div>
      </div>
      ` : ''}

      <!-- 资质与说明 -->
      <div style="margin:24px 0; padding:16px; background:#fff8e1; border-radius:8px; font-size:13px; color:#8d6e00; line-height:1.6;">
        <strong>📌 说明</strong><br>
        • 以上报价为AI初步估算，最终价格需现场勘测后确定<br>
        • 太阳能板质保 25 年，逆变器质保 10 年<br>
        • 免费提供并网申请代办服务<br>
        • 如有意向，请联系我们安排免费上门勘测
      </div>

      <!-- CTA -->
      <div style="text-align:center; margin:24px 0;">
        <a href="tel:400-888-8888" style="display:inline-block; background:linear-gradient(135deg,#43a047,#66bb6a); color:white; padding:14px 40px; border-radius:30px; text-decoration:none; font-size:16px; font-weight:600; box-shadow:0 4px 12px rgba(67,160,71,0.3);">
          📞 预约免费勘测 400-888-8888
        </a>
      </div>
      <p style="text-align:center; color:#999; font-size:12px; margin-top:8px;">
        或回复此邮件留下您的联系方式，我们将尽快与您联系
      </p>

      <!-- Footer -->
      <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eee; text-align:center; color:#bbb; font-size:11px;">
        <p>Solar Agent — AI 太阳能智能勘察系统</p>
        <p>此邮件由系统自动发送，请勿直接回复</p>
        <p>${new Date().toLocaleString('zh-CN')}</p>
      </div>

    </div>
  </div>
</body>
</html>`;
  }
}
