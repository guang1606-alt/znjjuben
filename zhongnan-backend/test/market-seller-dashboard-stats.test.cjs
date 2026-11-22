/**
 * v2.649 卖家工作台统计口径：旧实现 /api/market/seller-dashboard 仅取最近 50 条 listing
 * 再在内存里数 ON_SHELF / SOLD / length——卖家累计上架超过 50 个后，统计卡数字会静默失真
 * （最老的在售/已成交被窗口挤掉），而同一接口的 items 也只有 50 条且无任何截断提示。
 * 本用例锁定：
 *   1) totalListings/onShelf/sold 走全库 count，不受 50 条窗口影响；
 *   2) items 仍按 createdAt 倒序取 50，但必须显式回传 itemsHasMore，供前端诚实标注；
 *   3) 不足 50 个时 itemsHasMore=false，统计与 items 一致；
 *   4) 统计仅限本人：他人上架不计入；
 *   5) 故障 500 + 可重试文案 + logInternal 留痕。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'sd-stats-secret';
process.env.JWT_REFRESH_SECRET = 'sd-stats-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const auth = (uid) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const T0 = Date.UTC(2026, 10, 22, 0, 0, 0);

mem._seedUser({ id: 'u_big', level: 'BASIC' });
mem._seedUser({ id: 'u_small', level: 'BASIC' });
mem._seedUser({ id: 'u_other', level: 'BASIC' });

// u_big：60 个上架，createdAt 递增。最终 1..40 在售、41..55 已成交、56..60 已下架——
// 最近 50 条窗口（11..60）只含 30 个在售，旧实现必然把最老的 10 个在售漏掉。
for (let i = 1; i <= 60; i++) {
  mem.listing.create({
    data: {
      id: `ls_big_${String(i).padStart(2, '0')}`, sellerId: 'u_big', title: `剧本${i}`,
      priceFen: 1000, status: 'ON_SHELF', createdAt: new Date(T0 + i * 60000),
    },
  });
}
for (let i = 56; i <= 60; i++) {
  mem.listing.update({ where: { id: `ls_big_${String(i).padStart(2, '0')}` }, data: { status: 'OFF_SHELF' } });
}
for (let i = 41; i <= 55; i++) {
  mem.listing.update({ where: { id: `ls_big_${String(i).padStart(2, '0')}` }, data: { status: 'SOLD' } });
}
// 他人上架 7 个，不得计入
for (let i = 1; i <= 7; i++) {
  mem.listing.create({ data: { id: `ls_other_${i}`, sellerId: 'u_other', title: `他人${i}`, priceFen: 1000, status: 'ON_SHELF' } });
}
// u_small：12 个在售
for (let i = 1; i <= 12; i++) {
  mem.listing.create({ data: { id: `ls_small_${i}`, sellerId: 'u_small', title: `小${i}`, priceFen: 1000, status: 'ON_SHELF' } });
}
// u_big 成交两笔：1 托管（待结算 90）+ 1 已结算（实得 180）
mem.purchase.create({ data: { id: 'pu_escrow', sellerId: 'u_big', buyerId: 'u_other', listingId: 'ls_big_41', pricePoints: 100, commissionPoints: 10, sellerGainPoints: 90, status: 'ESCROW' } });
mem.purchase.create({ data: { id: 'pu_settled', sellerId: 'u_big', buyerId: 'u_other', listingId: 'ls_big_42', pricePoints: 200, commissionPoints: 20, sellerGainPoints: 180, status: 'SETTLED' } });

const getDash = async (uid = 'u_big') => {
  const r = await fetch(`${base}/api/market/seller-dashboard`, { headers: auth(uid) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

describe('卖家工作台统计（v2.649）', { concurrency: 1 }, () => {
  it('超过 50 个上架：统计走全库 count，不因窗口截断而失真', async () => {
    const r = await getDash();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.stats.totalListings, 60, '上架总数应为全库 60，而不是窗口内 50');
    assert.strictEqual(r.body.stats.onShelf, 40, '在售数必须包含被窗口挤掉的最老 10 个');
    assert.strictEqual(r.body.stats.sold, 15);
    assert.strictEqual(r.body.stats.inEscrow, 1);
    assert.strictEqual(r.body.stats.totalRevenuePoints, 180);
    assert.strictEqual(r.body.stats.pendingPoints, 90);
  });

  it('items 仍取最近 50 条，并显式回传截断信号', async () => {
    const r = await getDash();
    assert.strictEqual(r.body.items.length, 50);
    assert.strictEqual(r.body.items[0].id, 'ls_big_60', '按 createdAt 倒序');
    assert.strictEqual(r.body.itemsHasMore, true, '>50 时必须告知前端还有未展示的上架');
  });

  it('不超过 50 个上架：itemsHasMore=false，统计与列表自洽', async () => {
    const r = await getDash('u_small');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.stats.totalListings, 12);
    assert.strictEqual(r.body.stats.onShelf, 12);
    assert.strictEqual(r.body.items.length, 12);
    assert.strictEqual(r.body.itemsHasMore, false);
  });

  it('统计天然按本人隔离，他人上架不混入', async () => {
    const other = await getDash('u_other');
    assert.strictEqual(other.body.stats.totalListings, 7);
    assert.strictEqual(other.body.stats.onShelf, 7);
    assert.strictEqual(other.body.stats.sold, 0);
  });

  it('查询故障：500 + 可重试文案 + logInternal 留痕', async () => {
    const orig = mem.listing.count;
    mem.listing.count = async () => { throw new Error('DB_DOWN'); };
    const origErr = console.error;
    const calls = [];
    console.error = (...args) => calls.push(args.map((a) => String(a)).join(' '));
    try {
      const r = await getDash();
      assert.strictEqual(r.status, 500, '统计失败不得照常 200 返回错误数字');
      assert.strictEqual(r.body.error, '工作台统计加载失败，请重试');
    } finally {
      console.error = origErr;
      mem.listing.count = orig;
    }
    assert.ok(calls.some((c) => c.includes('[market.sellerDashboard]')), '故障必须留痕，实际：' + calls.join(' | '));
  });
});
