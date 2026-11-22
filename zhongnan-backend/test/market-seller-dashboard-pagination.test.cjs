/**
 * v2.650 卖家工作台上架列表续页：v2.649 已把统计修正为全库口径并诚实标注截断，
 * 但「我的上架」仍固定最近 50 条、没有任何续页入口——卖家的第 51 个及更早上架永远看不到。
 * 本用例锁定：
 *   1) 首屏 50 条 + itemsHasMore + itemsNextCursor，统计仍是全库口径；
 *   2) ?cursor= 续页返回剩余记录，两页并集不重不漏；
 *   3) 同一 createdAt 的并列上架按 id 倒序续页不漏（键集第二子句）；
 *   4) limit 生效并封顶 100；非法 cursor 退化为首屏而不是报错；
 *   5) 续页响应的统计与首屏一致（不因翻页漂移）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'sd-page-secret';
process.env.JWT_REFRESH_SECRET = 'sd-page-refresh';
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
const T0 = Date.UTC(2026, 10, 22, 3, 0, 0);

mem._seedUser({ id: 'u_seller', level: 'BASIC' });
mem._seedUser({ id: 'u_tie2', level: 'BASIC' });

const IDS = [];
for (let i = 1; i <= 60; i++) {
  const id = `ls_pg_${String(i).padStart(2, '0')}`;
  IDS.push(id);
  mem.listing.create({
    data: {
      id, sellerId: 'u_seller', title: `上架${i}`, priceFen: 1000,
      status: i <= 45 ? 'ON_SHELF' : i <= 58 ? 'SOLD' : 'OFF_SHELF',
      createdAt: new Date(T0 + i * 60000),
    },
  });
}
const NEWEST_FIRST = [...IDS].reverse();
const PAGE1 = NEWEST_FIRST.slice(0, 50);
const PAGE2 = NEWEST_FIRST.slice(50);

const T_TIE = Date.UTC(2026, 10, 22, 5, 0, 0);
for (const id of ['pg_a', 'pg_b', 'pg_c']) {
  mem.listing.create({
    data: { id, sellerId: 'u_tie2', title: id, priceFen: 1000, status: 'ON_SHELF', createdAt: new Date(T_TIE) },
  });
}

const getDash = async (query = '', uid = 'u_seller') => {
  const r = await fetch(`${base}/api/market/seller-dashboard${query}`, { headers: auth(uid) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

describe('卖家工作台上架续页（v2.650）', { concurrency: 1 }, () => {
  it('首屏：最近 50 条 + 游标元信息，统计保持全库口径', async () => {
    const r = await getDash();
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.items.map((x) => x.id), PAGE1);
    assert.strictEqual(r.body.itemsHasMore, true, '还有 10 个更早上架');
    assert.ok(typeof r.body.itemsNextCursor === 'string' && r.body.itemsNextCursor.length > 0);
    assert.strictEqual(r.body.stats.totalListings, 60, '统计仍须全库');
    assert.strictEqual(r.body.stats.onShelf, 45);
    assert.strictEqual(r.body.stats.sold, 13);
  });

  it('续页：剩余 10 条按时间倒序，两页并集不重不漏', async () => {
    const first = await getDash();
    const r = await getDash(`?limit=50&cursor=${encodeURIComponent(first.body.itemsNextCursor)}`);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.items.map((x) => x.id), PAGE2);
    assert.strictEqual(r.body.itemsHasMore, false);
    assert.strictEqual(r.body.itemsNextCursor, '');
    const union = new Set([...first.body.items, ...r.body.items].map((x) => x.id));
    assert.strictEqual(union.size, 60);
  });

  it('同一 createdAt 的并列上架：键集第二子句保证不漏', async () => {
    const p1 = await getDash('?limit=2', 'u_tie2');
    assert.deepStrictEqual(p1.body.items.map((x) => x.id), ['pg_c', 'pg_b'], '同刻按 id 倒序');
    assert.strictEqual(p1.body.itemsHasMore, true);
    const p2 = await getDash(`?limit=2&cursor=${encodeURIComponent(p1.body.itemsNextCursor)}`, 'u_tie2');
    assert.deepStrictEqual(p2.body.items.map((x) => x.id), ['pg_a'], '同刻剩余的必须能续到');
    assert.strictEqual(p2.body.itemsHasMore, false);
  });

  it('limit 封顶 100；非法 cursor 退化为首屏而非报错', async () => {
    const huge = await getDash('?limit=999');
    assert.strictEqual(huge.status, 200);
    assert.strictEqual(huge.body.items.length, 60);
    assert.strictEqual(huge.body.itemsHasMore, false, '已取全，不应再提示还有更多');
    const bad = await getDash('?cursor=not-a-cursor');
    assert.strictEqual(bad.status, 200, '坏游标不应把列表打成 500/400');
    assert.deepStrictEqual(bad.body.items.map((x) => x.id), PAGE1, '坏游标按首屏处理');
  });

  it('续页统计与首屏一致，不因翻页漂移', async () => {
    const first = await getDash();
    const p2 = await getDash(`?cursor=${encodeURIComponent(first.body.itemsNextCursor)}`);
    assert.deepStrictEqual(p2.body.stats, first.body.stats, '统计必须始终是全库口径');
  });
});
