#!/usr/bin/env node
/* 模型成本日报（生产维护）：汇总 ModelCallLog 的真实采购成本/向用户计价/token 量，
 * 校验不赔钱铁律（priceFen >= 2*costFen），可做阈值告警。
 *
 * 用法：
 *   node scripts/cost-report.cjs                 # 今天（服务器本地时区 0 点起）
 *   DAYS=7 node scripts/cost-report.cjs          # 最近 7 天，按天分组
 *   node scripts/cost-report.cjs --json
 *   WARN_FEN=2000 node scripts/cost-report.cjs   # 区间总成本（分）超过阈值则退出码 2（cron 接告警）
 * 依赖：.env 中 DATABASE_URL；先 npm i 且 npx prisma generate。
 */
'use strict';
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const DAYS = Math.max(1, parseInt(process.env.DAYS || '1', 10));
const WARN_FEN = process.env.WARN_FEN ? parseInt(process.env.WARN_FEN, 10) : null;
const AS_JSON = process.argv.includes('--json');

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function yuan(fen) { return (fen / 100).toFixed(2); }

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('缺少 DATABASE_URL（从 .env 读取）'); process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DAYS - 1));
    const logs = await prisma.modelCallLog.findMany({
      where: { createdAt: { gte: since } },
      select: { role: true, engineTier: true, modality: true, tokensIn: true, tokensOut: true, costFen: true, priceFen: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const days = {};
    let totalCost = 0, totalPrice = 0, totalIn = 0, totalOut = 0, marginBreaches = [];
    for (const l of logs) {
      const k = dayKey(l.createdAt);
      const d = days[k] || (days[k] = { calls: 0, costFen: 0, priceFen: 0, tokensIn: 0, tokensOut: 0, byTier: {} });
      d.calls += 1; d.costFen += l.costFen; d.priceFen += l.priceFen;
      d.tokensIn += l.tokensIn; d.tokensOut += l.tokensOut;
      const t = d.byTier[l.engineTier] || (d.byTier[l.engineTier] = { calls: 0, costFen: 0, priceFen: 0 });
      t.calls += 1; t.costFen += l.costFen; t.priceFen += l.priceFen;
      totalCost += l.costFen; totalPrice += l.priceFen; totalIn += l.tokensIn; totalOut += l.tokensOut;
      // price=0 常见于免费额度赠送，不计违约；成本>0 且计价不足 2 倍才是铁律破坏
      if (l.costFen > 0 && l.priceFen < l.costFen * 2) marginBreaches.push(l);
    }

    const report = {
      range: { from: since.toISOString(), days: DAYS, generatedAt: new Date().toISOString() },
      totals: { calls: logs.length, costYuan: Number(yuan(totalCost)), priceYuan: Number(yuan(totalPrice)), tokensIn: totalIn, tokensOut: totalOut, margin: totalCost ? Number((totalPrice / totalCost).toFixed(2)) : null },
      byDay: Object.fromEntries(Object.entries(days).map(([k, d]) => [k, {
        calls: d.calls, costYuan: Number(yuan(d.costFen)), priceYuan: Number(yuan(d.priceFen)),
        tokensIn: d.tokensIn, tokensOut: d.tokensOut,
        byTier: Object.fromEntries(Object.entries(d.byTier).map(([t, x]) => [t, { calls: x.calls, costYuan: Number(yuan(x.costFen)), priceYuan: Number(yuan(x.priceFen)) }])),
      }])),
      marginBreaches: marginBreaches.length,
      breachesSample: marginBreaches.slice(0, 5).map((l) => ({ role: l.role, tier: l.engineTier, modality: l.modality, costFen: l.costFen, priceFen: l.priceFen, at: l.createdAt })),
    };

    if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); }
    else {
      console.log(`=== 模型成本报告（近 ${DAYS} 天，自 ${report.range.from.slice(0, 10)}）===`);
      for (const [k, d] of Object.entries(report.byDay)) {
        console.log(`${k}  调用 ${d.calls}  成本 ¥${d.costYuan}  计价 ¥${d.priceYuan}  tokens ${d.tokensIn}/${d.tokensOut}`);
        for (const [t, x] of Object.entries(d.byTier)) console.log(`    ${t.padEnd(9)} 调用 ${String(x.calls).padStart(5)}  成本 ¥${x.costYuan}  计价 ¥${x.priceYuan}`);
      }
      console.log(`合计：调用 ${report.totals.calls}，成本 ¥${report.totals.costYuan}，计价 ¥${report.totals.priceYuan}，毛利倍数 ${report.totals.margin ?? '—'}`);
      console.log(`毛利违约（cost>0 且 price<2×cost）：${marginBreaches.length} 条` + (marginBreaches.length ? '（示例已在 --json 输出）' : ''));
    }

    if (marginBreaches.length) process.exitCode = 1;
    if (WARN_FEN != null && totalCost > WARN_FEN) {
      console.error(`[告警] 区间模型成本 ${yuan(totalCost)} 元超过阈值 ${yuan(WARN_FEN)} 元`);
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
