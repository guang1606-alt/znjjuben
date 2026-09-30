const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'dl-secret';
process.env.JWT_REFRESH_SECRET = 'dl-refresh';
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
  await mem.listing.create({ data: { id: 'ls_on', sellerId: 'seller', scriptId: 's1', title: '可下架剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ON_SHELF' } });
  await mem.listing.create({ data: { id: 'ls_sold', sellerId: 'seller', scriptId: 's2', title: '已售剧', priceFen: 5000, sample: 'y', commissionPct: 5, status: 'SOLD' } });
})();

describe('v2.76 剧本下架', { concurrency: 1 }, () => {
  it('卖家下架在售剧本成功，状态变为 OFF_SHELF', async () => {
    const r = await fetch(base + M + '/listings/ls_on/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.ok, true);
    assert.strictEqual(d.status, 'OFF_SHELF');
  });

  it('下架后从广场列表消失', async () => {
    const r = await fetch(base + M + '/listings');
    const list = (await r.json()).items;
    const ids = list.map((x) => x.id);
    assert.ok(!ids.includes('ls_on'));
  });

  it('下架后从新品榜消失', async () => {
    const r = await fetch(base + M + '/board?type=new');
    const d = await r.json();
    const ids = d.items.map((x) => x.id);
    assert.ok(!ids.includes('ls_on'));
  });

  it('非卖家不能下架他人剧本', async () => {
    // 先恢复 ls_on 为 ON_SHELF
    await mem.listing.update({ where: { id: 'ls_on' }, data: { status: 'ON_SHELF' } });
    const r = await fetch(base + M + '/listings/ls_on/delist', { method: 'PATCH', headers: H('other', 'BASIC') });
    assert.strictEqual(r.status, 403);
  });

  it('已售剧本不可下架（409）', async () => {
    const r = await fetch(base + M + '/listings/ls_sold/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 409);
  });

  it('已下架剧本不可重复下架（409）', async () => {
    await mem.listing.update({ where: { id: 'ls_on' }, data: { status: 'OFF_SHELF' } });
    const r = await fetch(base + M + '/listings/ls_on/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 409);
  });

  it('未登录返回 401', async () => {
    const r = await fetch(base + M + '/listings/ls_on/delist', { method: 'PATCH' });
    assert.strictEqual(r.status, 401);
  });

  it('不存在的剧本返回 404', async () => {
    const r = await fetch(base + M + '/listings/nonexistent/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 404);
  });

  it('卖家工作台显示已下架状态', async () => {
    const r = await fetch(base + M + '/seller-dashboard', { headers: H('seller', 'PRO') });
    const d = await r.json();
    const off = d.items.find((x) => x.id === 'ls_on');
    assert.strictEqual(off.status, 'OFF_SHELF');
  });
});
