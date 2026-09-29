const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'honor-secret';
process.env.JWT_REFRESH_SECRET = 'honor-refresh';
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

(async () => {
  // 高价值在售剧本（应进好评榜）
  await mem.listing.create({ data: { id: 'hi_val', sellerId: 'seller', scriptId: 's1', title: '高价值剧', priceFen: 8000, sample: 'x', commissionPct: 5, status: 'ON_SHELF', valueIndex: 92, valueGrade: 'S', valueEpisodes: 20 } });
  // 低价值在售剧本（无价值认证，不进好评榜）
  await mem.listing.create({ data: { id: 'lo_val', sellerId: 'seller', scriptId: 's2', title: '低价值剧', priceFen: 1000, sample: 'y', commissionPct: 5, status: 'ON_SHELF', valueIndex: null, valueGrade: 'NA', valueEpisodes: 2 } });
  // 已售剧本（应进热销榜）
  await mem.listing.create({ data: { id: 'sold_one', sellerId: 'seller', scriptId: 's3', title: '已售剧', priceFen: 5000, sample: 'z', commissionPct: 5, status: 'SOLD', valueIndex: 70, valueGrade: 'A', valueEpisodes: 10 } });
  await mem.purchase.create({ data: { id: 'p1', listingId: 'sold_one', buyerId: 'buyer', sellerId: 'seller', priceFen: 5000, sellerGainPoints: 475, commissionPoints: 25, status: 'SETTLED' } });
})();

describe('v2.78 卖家上榜荣誉', { concurrency: 1 }, () => {
  it('卖家工作台返回honors字段，高价值剧本在好评榜', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.ok(Array.isArray(d.honors));
    const hi = d.items.find((x) => x.id === 'hi_val');
    assert.ok(hi.onBoard && hi.onBoard.includes('rating'));
  });

  it('已售剧本在热销榜', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    const sold = d.items.find((x) => x.id === 'sold_one');
    assert.ok(sold.onBoard && sold.onBoard.includes('hot'));
  });

  it('低价值剧本不在任何榜单', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    const lo = d.items.find((x) => x.id === 'lo_val');
    assert.strictEqual(lo.onBoard, null);
  });

  it('honors汇总包含在榜剧本', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    const honorTitles = d.honors.map((h) => h.title);
    assert.ok(honorTitles.includes('高价值剧'));
    assert.ok(honorTitles.includes('已售剧'));
  });

  it('未登录返回401', async () => {
    const r = await fetch(base + M + '/seller-dashboard');
    assert.strictEqual(r.status, 401);
  });

  it('stats字段保持兼容', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    assert.strictEqual(d.stats.totalListings, 3);
    assert.strictEqual(d.stats.onShelf, 2);
    assert.strictEqual(d.stats.sold, 1);
    assert.strictEqual(d.stats.totalRevenuePoints, 475);
  });
});
