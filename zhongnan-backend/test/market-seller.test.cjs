const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'sd-secret';
process.env.JWT_REFRESH_SECRET = 'sd-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const M = '/api/market';
mem._seedUser({ id: 'seller', level: 'PRO' });
mem._seedUser({ id: 'buyer', level: 'BASIC' });
const H = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });

// 种子：卖家2个上架（1在售1已售），1笔已成交
(async () => {
  await mem.listing.create({ data: { id: 'ls_on', sellerId: 'seller', scriptId: 's1', title: '在售剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ON_SHELF', valueIndex: 60, valueGrade: 'B', valueEpisodes: 5 } });
  await mem.listing.create({ data: { id: 'ls_sold', sellerId: 'seller', scriptId: 's2', title: '已售剧', priceFen: 5000, sample: 'y', commissionPct: 5, status: 'SOLD', valueIndex: 80, valueGrade: 'A', valueEpisodes: 10 } });
  await mem.purchase.create({ data: { id: 'pu_1', buyerId: 'buyer', sellerId: 'seller', listingId: 'ls_sold', pricePoints: 500, commissionPoints: 25, sellerGainPoints: 475, status: 'SETTLED' } });
})();

describe('v2.75 卖家工作台', { concurrency: 1 }, () => {
  it('返回卖家统计：上架数/在售/已售/累计实得/待结算', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.stats.totalListings, 2);
    assert.strictEqual(d.stats.onShelf, 1);
    assert.strictEqual(d.stats.sold, 1);
    assert.strictEqual(d.stats.totalRevenuePoints, 475);
    assert.strictEqual(d.stats.pendingPoints, 0);
    assert.strictEqual(d.stats.commissionPoints, 25);
    assert.strictEqual(d.stats.avgSalePoints, 475);
  });

  it('返回我的上架列表，含状态/价值徽章/成交实得', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    assert.strictEqual(d.items.length, 2);
    const sold = d.items.find((x) => x.id === 'ls_sold');
    assert.strictEqual(sold.status, 'SOLD');
    assert.strictEqual(sold.sellerGainPoints, 475);
    assert.ok(sold.soldAt);
    const on = d.items.find((x) => x.id === 'ls_on');
    assert.strictEqual(on.status, 'ON_SHELF');
    assert.strictEqual(on.sellerGainPoints, null);
    assert.strictEqual(on.valueGrade, 'B');
  });

  it('待结算统计正确：ESCROW 订单计入 pending', async () => {
    await mem.listing.create({ data: { id: 'ls_esc', sellerId: 'seller', scriptId: 's3', title: '托管中剧', priceFen: 2000, sample: 'z', commissionPct: 5, status: 'ESCROW' } });
    await mem.purchase.create({ data: { id: 'pu_2', buyerId: 'buyer', sellerId: 'seller', listingId: 'ls_esc', pricePoints: 200, commissionPoints: 10, sellerGainPoints: 190, status: 'ESCROW' } });
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    assert.strictEqual(d.stats.totalListings, 3);
    assert.strictEqual(d.stats.inEscrow, 1);
    assert.strictEqual(d.stats.pendingPoints, 190);
    assert.strictEqual(d.stats.totalRevenuePoints, 475); // 已结算不变
  });

  it('未登录返回 401', async () => {
    const r = await fetch(base + M + '/seller-dashboard');
    assert.strictEqual(r.status, 401);
  });

  it('无上架的卖家返回空列表与零统计', async () => {
    mem._seedUser({ id: 'newbie', level: 'BASIC' });
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('newbie', 'BASIC') });
    const d = await r.json();
    assert.strictEqual(d.stats.totalListings, 0);
    assert.strictEqual(d.stats.totalRevenuePoints, 0);
    assert.strictEqual(d.items.length, 0);
  });
});
