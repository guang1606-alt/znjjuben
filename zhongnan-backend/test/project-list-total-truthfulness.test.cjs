/**
 * v2.589 作品库列表 total 不得在 count 失败时伪造为 0：
 * 旧实现 GET /api/generate/projects 中
 *   const total = cursor ? null : await prisma.project.count({...}).catch(() => 0);
 * 而 findMany 没有 .catch（失败会正确抛 500）。两者口径不一致：
 * 当 count 查询抖动失败、但 findMany 成功时，接口照常 200，返回真实 items 却带 total=0。
 * 前端依赖 total 渲染分页/「共 N 部」与「加载更多」阈值，会出现「列表有作品但总数为 0」的自相矛盾，
 * 且服务端无任何日志，用户与客服都无从定位。
 * 本用例锁定：count 失败必须 500 + 可重试提示 + 留痕；正常读取与游标翻页（跳过 count）不受影响。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'proj-total-secret';
process.env.JWT_REFRESH_SECRET = 'proj-total-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

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
const T0 = Date.UTC(2026, 10, 19);

function seedProject(id, userId, offsetMs = 0, extra = {}) {
  mem._projects.set(id, {
    id, userId, title: `作品-${id}`, mode: 'novel', format: 'LIVE_ACTION',
    engineTier: 'STANDARD', totalEps: 12, status: 'active', tags: [],
    createdAt: new Date(T0 + offsetMs), updatedAt: new Date(T0 + offsetMs),
    bible: {}, ...extra,
  });
  return id;
}

function patch(model, method, impl) {
  const orig = mem[model][method];
  mem[model][method] = impl(orig);
  return () => { mem[model][method] = orig; };
}

async function getProjects(query = '') {
  const resp = await fetch(`${base}/api/generate/projects${query}`, { headers: auth('u_total', 'FREE') });
  return { status: resp.status, body: await resp.json() };
}

mem._seedUser({ id: 'u_total', level: 'FREE', balance: 0 });
seedProject('p_a', 'u_total', 3000);
seedProject('p_b', 'u_total', 2000);
seedProject('p_c', 'u_total', 1000);

describe('作品库列表 total 真实性（v2.589）', { concurrency: 1 }, () => {
  it('正常读取：total 与 items 数量一致', async () => {
    const r = await getProjects();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.items.length, 3);
    assert.strictEqual(r.body.total, 3, 'total 必须等于 count 真值');
  });

  it('count 故障：500 + 可重试提示，绝不 200 带 total=0 谎报', async () => {
    const restore = patch('project', 'count', (orig) => async (arg) => {
      if (arg?.where?.userId === 'u_total') throw new Error('DB_DOWN');
      return orig.call(mem.project, arg);
    });
    try {
      const r = await getProjects();
      assert.strictEqual(r.status, 500, 'count 失败不得照常 200');
      assert.strictEqual(r.body.error, '作品列表加载失败，请重试');
      assert.strictEqual(r.body.items, undefined, '失败响应不得携带 items');
      assert.strictEqual(r.body.total, undefined, '失败响应不得携带伪造 total');
    } finally { restore(); }
  });

  it('findMany 故障：同样 500（与 count 口径一致），不返回半截列表', async () => {
    const restore = patch('project', 'findMany', (orig) => async (arg) => {
      if (arg?.where?.userId === 'u_total') throw new Error('DB_DOWN');
      return orig.call(mem.project, arg);
    });
    try {
      const r = await getProjects();
      assert.strictEqual(r.status, 500);
      assert.strictEqual(r.body.error, '作品列表加载失败，请重试');
    } finally { restore(); }
  });

  it('游标翻页跳过 count：即使 count 抛错，cursor 路径仍正常返回 total=null', async () => {
    // 取最近一条之后的游标：p_b（中间那条）作为 cursor，应只返回更旧的 p_c
    const cursor = Buffer.from(`${new Date(T0 + 2000).toISOString()}|p_b`, 'utf8').toString('base64url');
    const restore = patch('project', 'count', () => async () => { throw new Error('DB_DOWN'); });
    try {
      const r = await getProjects(`?cursor=${cursor}`);
      assert.strictEqual(r.status, 200, 'cursor 路径不调 count，不应被 count 故障波及');
      assert.strictEqual(r.body.total, null, 'cursor 路径 total 约定为 null');
      assert.deepStrictEqual(r.body.items.map((x) => x.id), ['p_c']);
    } finally { restore(); }
  });

  it('故障恢复后立即可读，total 真值回归', async () => {
    const r = await getProjects();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.total, 3);
    assert.strictEqual(r.body.items.length, 3);
  });
});
