/**
 * v2.648 「我的交易」游标翻页：旧实现 GET /api/market/my 对 sales/buys 各固定 take:50，
 * 且不返回任何「还有更多」的元信息——交易超过 50 笔后，较早的买卖记录在库里仍在、
 * 但界面永远不可达（与 v2.591 我的工单、v2.593 我的拆解、v2.543 海报、v2.647 作品库同族）。
 * 本用例锁定：
 *   1) 首屏保持旧字段 sales/buys 数组（老缓存前端不炸），追加 hasMore/nextCursor 元信息；
 *   2) ?kind=sales|buys&cursor= 单侧翻页返回 { items, hasMore, nextCursor }，两页并集不重不漏；
 *   3) 同一 createdAt 的多笔交易按 id 倒序续页（键集游标第二子句，不能整组漏掉）；
 *   4) limit 生效并封顶 100；kind 非法 400；
 *   5) 查询故障 500 + 可重试文案 + logInternal 留痕，不得裸抛成通用 500。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'my-page-secret';
process.env.JWT_REFRESH_SECRET = 'my-page-refresh';
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

const auth = (uid, level = 'BASIC') => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const T0 = Date.UTC(2026, 10, 20, 0, 0, 0);

mem._seedUser({ id: 'u_my', level: 'BASIC' });
mem._seedUser({ id: 'u_peer', level: 'BASIC' });
mem._seedUser({ id: 'u_tie', level: 'BASIC' });

const SALE_IDS = [];
const BUY_IDS = [];
for (let i = 1; i <= 55; i++) {
  const sid = `sale_${String(i).padStart(2, '0')}`;
  const bid = `buy_${String(i).padStart(2, '0')}`;
  SALE_IDS.push(sid); BUY_IDS.push(bid);
  mem.purchase.create({
    data: {
      id: sid, sellerId: 'u_my', buyerId: 'u_peer', listingId: `ls_s_${i}`,
      pricePoints: 100, commissionPoints: 5, sellerGainPoints: 95, status: 'SETTLED',
      createdAt: new Date(T0 + i * 60000),
    },
  });
  mem.purchase.create({
    data: {
      id: bid, buyerId: 'u_my', sellerId: 'u_peer', listingId: `ls_b_${i}`,
      pricePoints: 200, commissionPoints: 10, sellerGainPoints: 190, status: 'SETTLED',
      createdAt: new Date(T0 + i * 60000),
    },
  });
}
// 同一 createdAt 的 3 笔（id 倒序 tie_c > tie_b > tie_a）：limit=2 时第 2 页必须只补 tie_a
const T_TIE = Date.UTC(2026, 10, 21, 0, 0, 0);
for (const id of ['tie_a', 'tie_b', 'tie_c']) {
  mem.purchase.create({
    data: {
      id, buyerId: 'u_tie', sellerId: 'u_peer', listingId: `ls_${id}`,
      pricePoints: 10, commissionPoints: 0, sellerGainPoints: 10, status: 'SETTLED',
      createdAt: new Date(T_TIE),
    },
  });
}

const EXPECTED_FIRST_SALES = [...SALE_IDS].reverse().slice(0, 50); // 55..06
const EXPECTED_LAST_SALES = [...SALE_IDS].reverse().slice(50); // 05..01
const EXPECTED_FIRST_BUYS = [...BUY_IDS].reverse().slice(0, 50);
const EXPECTED_LAST_BUYS = [...BUY_IDS].reverse().slice(50);

async function getMy(query = '', uid = 'u_my') {
  const r = await fetch(`${base}/api/market/my${query}`, { headers: auth(uid) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

function captureErrors() {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => { calls.push(args.map((a) => String(a)).join(' ')); };
  return () => { console.error = orig; return calls; };
}

describe('我的交易分页（v2.648）', { concurrency: 1 }, () => {
  it('首屏：旧字段 sales/buys 各 50 + hasMore + nextCursor 元信息', async () => {
    const r = await getMy();
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.sales) && Array.isArray(r.body.buys), '旧字段必须保留（老缓存前端兼容）');
    assert.strictEqual(r.body.sales.length, 50);
    assert.strictEqual(r.body.buys.length, 50);
    assert.deepStrictEqual(r.body.sales.map((x) => x.id), EXPECTED_FIRST_SALES, '卖出记录按时间倒序');
    assert.deepStrictEqual(r.body.buys.map((x) => x.id), EXPECTED_FIRST_BUYS, '买入记录按时间倒序');
    assert.strictEqual(r.body.salesHasMore, true, '还有 5 笔卖出未返回');
    assert.strictEqual(r.body.buysHasMore, true, '还有 5 笔买入未返回');
    assert.ok(typeof r.body.salesNextCursor === 'string' && r.body.salesNextCursor.length > 0);
    assert.ok(typeof r.body.buysNextCursor === 'string' && r.body.buysNextCursor.length > 0);
  });

  it('卖出续页：kind=sales 返回剩余 5 笔，两页并集不重不漏', async () => {
    const first = await getMy();
    const r = await getMy(`?kind=sales&cursor=${encodeURIComponent(first.body.salesNextCursor)}`);
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.items), '单侧翻页返回 { items }');
    assert.deepStrictEqual(r.body.items.map((x) => x.id), EXPECTED_LAST_SALES);
    assert.strictEqual(r.body.hasMore, false);
    assert.strictEqual(r.body.nextCursor, '');
    const seen = new Set([...first.body.sales, ...r.body.items].map((x) => x.id));
    assert.strictEqual(seen.size, 55);
  });

  it('买入续页：kind=buys 返回剩余 5 笔，与卖出列表互不串数据', async () => {
    const first = await getMy();
    const r = await getMy(`?kind=buys&cursor=${encodeURIComponent(first.body.buysNextCursor)}`);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.items.map((x) => x.id), EXPECTED_LAST_BUYS);
    assert.strictEqual(r.body.hasMore, false);
    assert.ok(r.body.items.every((x) => BUY_IDS.includes(x.id)), '买入翻页不得混入卖出记录');
  });

  it('同一 createdAt 的并列交易：键集游标第二子句保证不漏', async () => {
    const p1 = await getMy('?kind=buys&limit=2', 'u_tie');
    assert.strictEqual(p1.status, 200);
    assert.deepStrictEqual(p1.body.items.map((x) => x.id), ['tie_c', 'tie_b'], '同刻按 id 倒序');
    assert.strictEqual(p1.body.hasMore, true);
    const p2 = await getMy(`?kind=buys&limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`, 'u_tie');
    assert.strictEqual(p2.status, 200);
    assert.deepStrictEqual(p2.body.items.map((x) => x.id), ['tie_a'], '同刻未返回的交易必须能在续页拿到');
    assert.strictEqual(p2.body.hasMore, false);
  });

  it('limit 生效且封顶 100；kind 非法返回 400', async () => {
    const small = await getMy('?limit=10');
    assert.strictEqual(small.status, 200);
    assert.strictEqual(small.body.sales.length, 10);
    assert.strictEqual(small.body.buys.length, 10);
    assert.strictEqual(small.body.salesHasMore, true);
    const huge = await getMy('?kind=buys&limit=999');
    assert.strictEqual(huge.status, 200);
    assert.strictEqual(huge.body.items.length, 55, 'limit 封顶 100，仍应取到全部 55 笔');
    const bad = await getMy('?kind=other');
    assert.strictEqual(bad.status, 400);
    assert.match(String(bad.body.error), /sales|buys/);
  });

  it('查询故障：500 + 可重试文案 + logInternal 留痕，不得裸抛通用 500', async () => {
    const orig = mem.purchase.findMany;
    mem.purchase.findMany = async () => { throw new Error('DB_DOWN'); };
    const stopCap = captureErrors();
    let calls = [];
    try {
      const r = await getMy();
      assert.strictEqual(r.status, 500, '查询失败不得照常 200');
      assert.strictEqual(r.body.error, '交易记录加载失败，请重试');
      assert.strictEqual(r.body.sales, undefined, '失败响应不得携带半份数据');
    } finally {
      calls = stopCap();
      mem.purchase.findMany = orig;
    }
    assert.ok(calls.some((c) => c.includes('[market.my.list]')), '故障必须留痕，实际：' + calls.join(' | '));
  });

  it('故障恢复后立即可读', async () => {
    const r = await getMy();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.sales.length, 50);
    assert.strictEqual(r.body.buysHasMore, true);
  });
});
