/**
 * v2.553 作品库列表键集游标分页 —— 修复 take:200 静默截断
 *
 * 缺口（修复前实证）：GET /api/generate/projects 仍保留 take:200 硬上限，
 * 用户累计作品超过 200 时，第 201 个起全部不可见；且 offset 分页在并发插入时会重复/跳过（与 v2.551 海报同根因）。
 *
 * 修复：与海报游标同套路——(createdAt, id) 复合锚点；响应改 { items, nextCursor, hasMore, total }；
 * 保留 offset 兼容；脏游标安全退化第一页。前端 loadWorks 加「加载更多」按钮与回退游标逻辑。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
process.env.JWT_ACCESS_SECRET = 'proj-cursor-secret';
process.env.JWT_REFRESH_SECRET = 'proj-cursor-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const auth = (uid, level = 'FREE') => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}` });

function seedProject(id, userId, createdAt, extra = {}) {
  mem.project.create({ data: {
    id, userId, title: `项目-${id}`, mode: 'adapt', format: 'LIVE_ACTION',
    engineTier: 'STANDARD', totalEps: 10, status: 'active', tags: ['逆袭'],
    createdAt, updatedAt: createdAt, ...extra,
  }});
}

describe('v2.553 作品库列表键集游标分页', { concurrency: 1 }, () => {
  mem._seedUser({ id: 'u_cursor', level: 'ADVANCED', balance: 0 });

  // 构造 201 个项目，按 createdAt 降序排列时 p201 应该是最旧的
  const ids = [];
  for (let i = 1; i <= 201; i++) {
    const dt = new Date(`2026-11-01T00:00:00.000Z`);
    dt.setUTCDate(dt.getUTCDate() + Math.floor(i / 3)); // 有些同秒，靠 id 区分
    dt.setUTCMilliseconds(i);
    ids.push(`p${String(i).padStart(3, '0')}`);
    seedProject(ids[i - 1], 'u_cursor', dt);
  }

  it('take=200 旧上限下第 201 个项目在新游标分页下可见', async () => {
    const r1 = await fetch(base + '/api/generate/projects?limit=100', { headers: auth('u_cursor', 'ADVANCED') });
    assert.strictEqual(r1.status, 200);
    const p1 = await r1.json();
    assert.ok(Array.isArray(p1.items), '应为游标响应结构');
    assert.strictEqual(p1.items.length, 100);
    assert.ok(p1.hasMore, 'p1 之后应有更多');
    assert.ok(typeof p1.nextCursor === 'string' && p1.nextCursor.length > 0);
    assert.strictEqual(p1.total, 201);

    const r2 = await fetch(base + '/api/generate/projects?limit=100&cursor=' + encodeURIComponent(p1.nextCursor), { headers: auth('u_cursor', 'ADVANCED') });
    const p2 = await r2.json();
    assert.ok(p2.hasMore);
    assert.strictEqual(p2.items.length, 100);

    const r3 = await fetch(base + '/api/generate/projects?limit=100&cursor=' + encodeURIComponent(p2.nextCursor), { headers: auth('u_cursor', 'ADVANCED') });
    const p3 = await r3.json();
    assert.strictEqual(p3.hasMore, false, '末页 hasMore 应为 false');
    assert.strictEqual(p3.nextCursor, '', '末页 nextCursor 应为空');
    assert.strictEqual(p3.items.length, 1); // 201 - 200 = 1

    // 断言三个页码并集无重复、覆盖全部 201 个
    const seen = new Set();
    for (const list of [p1.items, p2.items, p3.items]) for (const it of list) seen.add(it.id);
    assert.strictEqual(seen.size, 201, '三页合并应覆盖全部 201 个项目（当前 ' + seen.size + '）');
    for (const id of ids) assert.ok(seen.has(id), '应包含 ' + id);
  });

  it('翻页期间新插入项目也不重复、不跳过（v2.551 海报同款并发回归）', async () => {
    const r1 = await fetch(base + '/api/generate/projects?limit=50', { headers: auth('u_cursor', 'ADVANCED') });
    const p1 = await r1.json();
    const anchorId = p1.items[p1.items.length - 1].id;
    // 翻页前在项目末尾再插入一条，翻页期间它应落在「锚点之后」的位置、不会影响已返回内容
    const oldTotal = p1.total;
    seedProject('p_new_one', 'u_cursor', new Date('2025-01-01T00:00:00.000Z')); // 更旧，会在翻页方向的最末端

    const seenIds = new Set(p1.items.map((x) => x.id));
    const r2 = await fetch(base + '/api/generate/projects?limit=50&cursor=' + encodeURIComponent(p1.nextCursor), { headers: auth('u_cursor', 'ADVANCED') });
    const p2 = await r2.json();
    // 断言锚点不在下一页（锚点是 p1 最后一条，下一页应全是 createdAt 更早或 createdAt 相等但 id 更小的）
    for (const it of p2.items) assert.notStrictEqual(it.id, anchorId, '翻页不应带回锚点自身');
    for (const it of p2.items) assert.ok(!seenIds.has(it.id), '翻页不应带回已返回项：' + it.id);
    assert.strictEqual(p2.total, oldTotal + 1); // 新增的那一条会被 total 统计
  });

  it('cursor 脏值 / 越界安全退化第一页', async () => {
    const r = await fetch(base + '/api/generate/projects?limit=5&cursor=' + encodeURIComponent('!@#$garbage'), { headers: auth('u_cursor', 'ADVANCED') });
    const p = await r.json();
    assert.strictEqual(p.items.length, 5);
    assert.ok(p.hasMore);
  });

  it('offset 参数保持兼容（limit/offset 路径未被破坏）', async () => {
    const r = await fetch(base + '/api/generate/projects?limit=10&offset=5', { headers: auth('u_cursor', 'ADVANCED') });
    const p = await r.json();
    assert.ok(Array.isArray(p.items) && p.items.length === 10);
  });
});

describe('v2.553 前端静态守卫（作品库游标分页）', () => {
  const js = read('web/app.js');
  it('后端响应改 { items, nextCursor, hasMore, total } 结构', () => {
    assert.match(read('src/routes/generate.ts'), /encodeProjectCursor|decodeProjectCursor/, '应有项目游标编解码函数');
  });
  it('前端 loadWorks 有翻页游标状态与「加载更多」入口', () => {
    assert.match(js, /myProjectsCursor/, '应有作品库游标状态变量');
    assert.match(js, /myProjectsHasMore/, '应有 hasMore 状态');
    assert.match(js, /myProjectsMore|worksMoreBtn|loadMoreWorks/, '应有「加载更多」按钮或函数');
  });
});
