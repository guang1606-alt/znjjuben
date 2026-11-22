/**
 * v2.651 超管知识审核队列续页：旧实现固定 take:100 且只按 createdAt 排序，
 * 第 101 条及更早知识永远无法进入人工审核；同刻条目还可能因无第二排序键而漏审。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'kn-page-secret';
process.env.JWT_REFRESH_SECRET = 'kn-page-refresh';
const { createApp } = require('../dist/server/app.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ knowledge: createKnowledgeRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'admin', phone: '18891995171' });
const headers = { Authorization: `Bearer ${signAccess({ sub: 'admin', level: 'PRO' })}` };
const get = async (query = '') => {
  const r = await fetch(`${base}/api/admin/knowledge${query}`, { headers });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const T0 = Date.UTC(2026, 10, 22, 4, 0, 0);
const IDS = [];
for (let i = 1; i <= 105; i++) {
  const id = `kn_pg_${String(i).padStart(3, '0')}`;
  IDS.push(id);
  mem.knowledgeItem.create({ data: {
    id, kind: 'TEXT', title: `待审知识${i}`, content: `内容${i}`, category: 'plot', status: 'PENDING',
    conflictNote: null, approvedAt: null, skillVersion: null, uploadedById: 'admin', createdAt: new Date(T0 + i * 60000),
  } });
}
const NEWEST_FIRST = [...IDS].reverse();
for (const [id, minute] of [['kn_rejected_mid', 52.5], ['kn_rejected_old', 2.5]]) {
  mem.knowledgeItem.create({ data: {
    id, kind: 'TEXT', title: id, content: id, category: 'plot', status: 'REJECTED',
    conflictNote: null, approvedAt: null, skillVersion: null, uploadedById: 'admin', createdAt: new Date(T0 + minute * 60000),
  } });
}
const TIE = new Date(T0 + 200 * 60000);
for (const id of ['kn_tie_a', 'kn_tie_b', 'kn_tie_c']) {
  mem.knowledgeItem.create({ data: {
    id, kind: 'TEXT', title: id, content: id, category: 'plot', status: 'APPROVED',
    conflictNote: null, approvedAt: TIE, skillVersion: null, uploadedById: 'admin', createdAt: TIE,
  } });
}

describe('超管知识审核队列续页（v2.651）', { concurrency: 1 }, () => {
  it('首屏返回最近 50 条、hasMore 与 nextCursor，不再裸数组静默截断', async () => {
    const r = await get('?status=PENDING');
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.items), '响应必须带 items 分页信封');
    assert.deepStrictEqual(r.body.items.map((x) => x.id), NEWEST_FIRST.slice(0, 50));
    assert.strictEqual(r.body.hasMore, true);
    assert.ok(typeof r.body.nextCursor === 'string' && r.body.nextCursor.length > 0);
  });

  it('连续翻页后 105 条待审全部可达，状态筛选在续页中不丢失', async () => {
    const seen = [];
    let cursor = '';
    let hasMore = true;
    let pages = 0;
    for (; pages < 5 && hasMore; pages++) {
      const q = new URLSearchParams({ status: 'PENDING', limit: '50' });
      if (cursor) q.set('cursor', cursor);
      const r = await get(`?${q}`);
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.items.every((x) => x.status === 'PENDING'), '续页不得混入已驳回条目');
      seen.push(...r.body.items.map((x) => x.id));
      hasMore = r.body.hasMore;
      cursor = r.body.nextCursor;
      if (hasMore) assert.ok(cursor, '还有更多时必须给出续页游标');
    }
    assert.strictEqual(pages, 3);
    assert.strictEqual(hasMore, false);
    assert.strictEqual(cursor, '');
    assert.strictEqual(new Set(seen).size, 105, '不得重复');
    assert.deepStrictEqual(seen, NEWEST_FIRST, '第 101～105 条也必须不重不漏地到达');
  });

  it('同一 createdAt 按 id 倒序排列并续页，键集第二子句不漏审', async () => {
    const p1 = await get('?status=APPROVED&limit=2');
    assert.deepStrictEqual(p1.body.items.map((x) => x.id), ['kn_tie_c', 'kn_tie_b']);
    assert.strictEqual(p1.body.hasMore, true);
    const p2 = await get(`?status=APPROVED&limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`);
    assert.deepStrictEqual(p2.body.items.map((x) => x.id), ['kn_tie_a']);
    assert.strictEqual(p2.body.hasMore, false);
    assert.strictEqual(p2.body.nextCursor, '');
  });

  it('limit 生效并封顶 100；非法游标退化为首屏', async () => {
    const one = await get('?status=PENDING&limit=1');
    assert.strictEqual(one.body.items.length, 1);
    const huge = await get('?status=PENDING&limit=999');
    assert.strictEqual(huge.body.items.length, 100);
    assert.strictEqual(huge.body.hasMore, true);
    const bad = await get('?status=PENDING&cursor=not-a-cursor');
    assert.strictEqual(bad.status, 200);
    assert.deepStrictEqual(bad.body.items.map((x) => x.id), NEWEST_FIRST.slice(0, 50));
  });

  it('空结果同样返回完整分页元信息', async () => {
    const r = await get('?status=ARCHIVED');
    assert.deepStrictEqual(r.body, { items: [], hasMore: false, nextCursor: '' });
  });
});
