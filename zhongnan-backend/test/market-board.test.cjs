const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mb-secret';
process.env.JWT_REFRESH_SECRET = 'mb-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const M = '/api/market';
mem._seedUser({ id: 'seller1', level: 'PRO' });
mem._seedUser({ id: 'buyer1', level: 'BASIC' });

// 种子：3个在售剧本（不同价值指数）+ 1个已成交
(async () => {
  await mem.listing.create({ data: { id: 'ls_a', sellerId: 'seller1', scriptId: 's1', title: 'A级高分剧', priceFen: 5000, sample: '样章A', commissionPct: 5, status: 'ON_SHELF', valueIndex: 88, valueGrade: 'A', valueEpisodes: 10 } });
  await mem.listing.create({ data: { id: 'ls_b', sellerId: 'seller1', scriptId: 's2', title: 'B级中位剧', priceFen: 3000, sample: '样章B', commissionPct: 5, status: 'ON_SHELF', valueIndex: 55, valueGrade: 'C', valueEpisodes: 5 } });
  await mem.listing.create({ data: { id: 'ls_new', sellerId: 'seller1', scriptId: 's3', title: '最新上架剧', priceFen: 2000, sample: '样章新', commissionPct: 10, status: 'ON_SHELF', valueIndex: null, valueGrade: null } });
  await mem.listing.create({ data: { id: 'ls_sold', sellerId: 'seller1', scriptId: 's4', title: '已成交爆款', priceFen: 8000, sample: '样章爆', commissionPct: 5, status: 'SOLD', valueIndex: 92, valueGrade: 'S', valueEpisodes: 20 } });
  await mem.purchase.create({ data: { id: 'pu_1', buyerId: 'buyer1', sellerId: 'seller1', listingId: 'ls_sold', pricePoints: 800, commissionPoints: 40, sellerGainPoints: 760, status: 'SETTLED' } });
})();

describe('v2.74 交易广场三榜体系', { concurrency: 1 }, () => {
  it('新品榜：返回在售剧本，按上架时间倒序，不含已售出', async () => {
    const r = await fetch(base + M + '/board?type=new');
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.type, 'new');
    assert.ok(d.items.length >= 2);
    const ids = d.items.map((x) => x.id);
    assert.ok(ids.includes('ls_a'));
    assert.ok(ids.includes('ls_b'));
    assert.ok(ids.includes('ls_new'));
    assert.ok(!ids.includes('ls_sold'));
    assert.ok(d.items.every((x) => typeof x.pricePoints === 'number'));
  });

  it('好评榜：仅含价值指数非空的在售剧本，按指数降序', async () => {
    const r = await fetch(base + M + '/board?type=rating');
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.type, 'rating');
    assert.ok(d.items.length >= 2);
    const ids = d.items.map((x) => x.id);
    assert.ok(!ids.includes('ls_new')); // 无价值认证的不进好评榜
    assert.ok(!ids.includes('ls_sold'));
    // 降序
    for (let i = 1; i < d.items.length; i++) {
      assert.ok(d.items[i - 1].valueIndex >= d.items[i].valueIndex);
    }
    assert.strictEqual(d.items[0].id, 'ls_a'); // 88 最高
  });

  it('热销榜：返回已成交剧本，按成交时间倒序，状态为 SOLD', async () => {
    const r = await fetch(base + M + '/board?type=hot');
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.type, 'hot');
    assert.ok(d.items.length >= 1);
    const item = d.items.find((x) => x.id === 'ls_sold');
    assert.ok(item);
    assert.strictEqual(item.status, 'SOLD');
    assert.strictEqual(item.title, '已成交爆款');
    assert.strictEqual(item.pricePoints, 800);
    assert.ok(item.soldAt);
  });

  it('默认 type=new，limit 参数生效', async () => {
    const r = await fetch(base + M + '/board?limit=2');
    const d = await r.json();
    assert.strictEqual(d.type, 'new');
    assert.ok(d.items.length <= 2);
  });

  it('榜单公开访问，无需登录', async () => {
    const r = await fetch(base + M + '/board?type=rating');
    assert.strictEqual(r.status, 200);
  });
});
