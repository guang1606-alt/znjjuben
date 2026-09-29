const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'rl-secret';
process.env.JWT_REFRESH_SECRET = 'rl-refresh';
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
mem._seedUser({ id: 'other', level: 'BASIC' });
const H = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });

(async () => {
  await mem.listing.create({ data: { id: 'ls_off', sellerId: 'seller', scriptId: 's1', title: '已下架剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'OFF_SHELF', valueIndex: 60, valueGrade: 'B', valueEpisodes: 5 } });
  await mem.listing.create({ data: { id: 'ls_on', sellerId: 'seller', scriptId: 's2', title: '在售剧', priceFen: 5000, sample: 'y', commissionPct: 5, status: 'ON_SHELF' } });
})();

describe('v2.77 剧本重新上架', { concurrency: 1 }, () => {
  it('卖家重新上架已下架剧本成功', async () => {
    const r = await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.ok, true);
    assert.strictEqual(d.status, 'ON_SHELF');
    assert.strictEqual(d.priceFen, 3000); // 保持原价
  });

  it('重新上架后出现在广场列表', async () => {
    const r = await fetch(base + M + '/listings');
    const list = await r.json();
    const ids = list.map((x) => x.id);
    assert.ok(ids.includes('ls_off'));
  });

  it('重新上架时可改价', async () => {
    // 先下架
    await fetch(base + M + '/listings/ls_off/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    const r = await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH', headers: H('seller', 'PRO'), body: JSON.stringify({ priceFen: 4500 }) });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.priceFen, 4500);
  });

  it('改价低于1元返回400', async () => {
    await fetch(base + M + '/listings/ls_off/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    const r = await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH', headers: H('seller', 'PRO'), body: JSON.stringify({ priceFen: 50 }) });
    assert.strictEqual(r.status, 400);
  });

  it('非卖家不能重新上架他人剧本（403）', async () => {
    const r = await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH', headers: H('other', 'BASIC') });
    assert.strictEqual(r.status, 403);
  });

  it('在售剧本不可重新上架（409）', async () => {
    const r = await fetch(base + M + '/listings/ls_on/relist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 409);
  });

  it('未登录返回401', async () => {
    const r = await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH' });
    assert.strictEqual(r.status, 401);
  });

  it('不存在的剧本返回404', async () => {
    const r = await fetch(base + M + '/listings/nonexistent/relist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 404);
  });

  it('卖家工作台显示重新上架后的状态', async () => {
    await fetch(base + M + '/listings/ls_off/relist', { method: 'PATCH', headers: H('seller', 'PRO') });
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    const off = d.items.find((x) => x.id === 'ls_off');
    assert.strictEqual(off.status, 'ON_SHELF');
    assert.strictEqual(d.stats.onShelf, 2);
  });
});
