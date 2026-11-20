/**
 * v2.593 「我的拆解记录」分页：旧实现 GET /api/teardown/mine 固定 take:50 且回传 { list }，
 * 用户累计超过 50 条拆解记录后，较早记录在库里依然存在、但界面永远看不到（不能恢复续作），
 * 与 v2.591 我的工单、v2.543 海报静默截断同族缺口。
 * 本用例锁定：
 *   1) 首屏返回 { items, hasMore, nextCursor }，默认 20 条，不回传 total（保持轻量）；
 *   2) 游标翻页返回剩余记录，两页并集 = 全部且无重复 id（键集游标不重不漏）；
 *   3) 到底时 hasMore=false、nextCursor 为空；
 *   4) findMany 故障必须 500 + 可重试提示 + logInternal 留痕，不得裸抛成无业务文案的通用 500；
 *   5) limit 参数生效；故障恢复后立即可读。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'td-page-secret';
process.env.JWT_REFRESH_SECRET = 'td-page-refresh';
const { createApp } = require('../dist/server/app.js');
const { createTeardownRouter } = require('../dist/routes/teardown.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ teardown: createTeardownRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const auth = (uid, level = 'FREE') => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const T0 = Date.UTC(2026, 10, 19, 0, 0, 0);

// 种子 25 条：按时间升序创建，id 与时间同向递增（最新 = 最大 id），createdAt 各不相同
mem._seedUser({ id: 'u_td_page', level: 'FREE' });
const ALL_IDS = [];
for (let i = 0; i < 25; i++) {
  const id = `td_page_${String(i + 1).padStart(2, '0')}`;
  ALL_IDS.push(id);
  mem.teardownRecord.create({
    data: {
      id, userId: 'u_td_page', title: `拆解记录-${i + 1}`, sourceType: 'text',
      wordCount: 1000 + i, state: i % 3 === 0 ? 'TO_PROJECT' : (i % 3 === 1 ? 'OUTLINED' : 'ANALYZED'),
      pointsCost: 5, pickedTags: [], createdAt: new Date(T0 + i * 60000),
    },
  });
}
// 最新在前 → 首屏应是 td_page_25 .. td_page_06（20 条）
const EXPECTED_FIRST = ALL_IDS.slice(5).reverse(); // 25..06
const EXPECTED_SECOND = ALL_IDS.slice(0, 5).reverse(); // 05..01

function patch(method, impl) {
  const orig = mem.teardownRecord[method];
  mem.teardownRecord[method] = impl(orig);
  return () => { mem.teardownRecord[method] = orig; };
}
function captureErrors() {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => { calls.push(args.map((a) => String(a)).join(' ')); };
  return () => { console.error = orig; return calls; };
}

async function getMine(query = '') {
  const resp = await fetch(`${base}/api/teardown/mine${query}`, { headers: auth('u_td_page', 'FREE') });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}

describe('我的拆解记录分页（v2.593）', { concurrency: 1 }, () => {
  it('首屏：默认 20 条 + hasMore + nextCursor，不回传 total', async () => {
    const r = await getMine();
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.items), '响应必须是 { items } 形状');
    assert.strictEqual(r.body.items.length, 20, '默认页大小应为 20');
    assert.deepStrictEqual(r.body.items.map((x) => x.id), EXPECTED_FIRST, '最新 20 条在前');
    assert.strictEqual(r.body.hasMore, true, '还有 5 条未返回，hasMore 必须为 true');
    assert.ok(typeof r.body.nextCursor === 'string' && r.body.nextCursor.length > 0, 'nextCursor 必须非空');
    assert.strictEqual(r.body.total, undefined, '保持轻量：不回传 total');
    assert.strictEqual(r.body.list, undefined, '旧 { list } 字段已退役');
  });

  it('游标翻页：返回剩余 5 条，hasMore=false，两页并集不重不漏', async () => {
    const first = await getMine();
    const cursor = first.body.nextCursor;
    const second = await getMine(`?cursor=${encodeURIComponent(cursor)}`);
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.items.length, 5);
    assert.deepStrictEqual(second.body.items.map((x) => x.id), EXPECTED_SECOND, '剩余 5 条为最旧的 5 条');
    assert.strictEqual(second.body.hasMore, false, '到底后 hasMore 必须为 false');
    assert.strictEqual(second.body.nextCursor, '', '到底后 nextCursor 必须为空串');
    const seen = new Set();
    [...first.body.items, ...second.body.items].forEach((x) => seen.add(x.id));
    assert.strictEqual(seen.size, 25, '两页并集必须恰好覆盖全部 25 条，无重复无遗漏');
    assert.deepStrictEqual([...seen].sort(), [...ALL_IDS].sort());
  });

  it('limit 参数生效：limit=10 返回 10 条且仍有更多', async () => {
    const r = await getMine('?limit=10');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.items.length, 10);
    assert.strictEqual(r.body.hasMore, true);
  });

  it('findMany 故障：500 + 可重试提示 + logInternal 留痕，不得裸抛成通用 500', async () => {
    const restore = patch('findMany', () => async () => { throw new Error('DB_DOWN'); });
    const stopCap = captureErrors();
    let calls = [];
    try {
      const r = await getMine();
      assert.strictEqual(r.status, 500, '查询失败不得照常 200');
      assert.strictEqual(r.body.error, '拆解记录加载失败，请重试');
      assert.strictEqual(r.body.items, undefined, '失败响应不得携带 items');
      assert.strictEqual(r.body.hasMore, undefined, '失败响应不得携带 hasMore');
    } finally {
      calls = stopCap();
      restore();
    }
    assert.ok(
      calls.some((c) => c.includes('[teardown.mine.list]')),
      '故障必须 logInternal 留痕（可观测可归因），实际：' + calls.join(' | '),
    );
  });

  it('故障恢复后立即可读', async () => {
    const r = await getMine();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.items.length, 20);
    assert.strictEqual(r.body.hasMore, true);
  });
});
