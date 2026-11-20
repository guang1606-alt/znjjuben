/**
 * v2.588 我的海报列表读取失败不得伪装成"还没有海报"：
 * 旧实现 findMany `.catch(() => [])`、count `.catch(() => 0)`——数据库抖动时接口照常 200，
 * 返回 items=[]/total=0/hasMore=false：付费生成的海报看起来全部丢失，用户无从重试，服务端也无日志。
 * 本用例锁定：查询失败必须 500 并给出可重试提示；正常读取与游标翻页不受影响。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'gen-test-secret';
process.env.JWT_REFRESH_SECRET = 'gen-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const T0 = Date.UTC(2026, 0, 1);

mem._seedUser({ id: 'u_poster', level: 'BASIC', balance: 0 });
mem._mediaAssets.set('ma_1', { id: 'ma_1', userId: 'u_poster', kind: 'POSTER', size: 120, createdAt: new Date(T0 + 2000) });
mem._mediaAssets.set('ma_2', { id: 'ma_2', userId: 'u_poster', kind: 'POSTER', size: 80, createdAt: new Date(T0 + 1000) });

async function getPosters(query = '') {
  const resp = await fetch(`${base}/api/va/posters${query}`, {
    headers: { Authorization: `Bearer ${signAccess({ sub: 'u_poster', level: 'BASIC' })}` },
  });
  return { status: resp.status, body: await resp.json() };
}

function patch(model, method, impl) {
  const orig = mem[model][method];
  mem[model][method] = impl(orig);
  return () => { mem[model][method] = orig; };
}

describe('我的海报列表读取真实性（v2.588）', { concurrency: 1 }, () => {
  it('正常读取：按时间倒序返回本人海报', async () => {
    const r = await getPosters();
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.items.map((x) => x.id), ['ma_1', 'ma_2']);
    assert.strictEqual(r.body.total, 2);
  });

  it('列表查询故障：500 + 可重试提示，绝不返回空列表冒充「没有海报」', async () => {
    const restore = patch('mediaAsset', 'findMany', (orig) => async (arg) => {
      if (arg?.where?.userId === 'u_poster') throw new Error('DB_DOWN');
      return orig.call(mem.mediaAsset, arg);
    });
    try {
      const r = await getPosters();
      assert.strictEqual(r.status, 500);
      assert.strictEqual(r.body.error, '海报列表加载失败，请重试');
      assert.strictEqual(r.body.items, undefined, '不得返回空 items');
    } finally { restore(); }
  });

  it('总数查询故障：同样 500，避免 hasMore 被静默算成 false 导致旧海报不可达', async () => {
    const restore = patch('mediaAsset', 'count', (orig) => async (arg) => {
      if (arg?.where?.userId === 'u_poster') throw new Error('DB_DOWN');
      return orig.call(mem.mediaAsset, arg);
    });
    try {
      const r = await getPosters();
      assert.strictEqual(r.status, 500);
      assert.strictEqual(r.body.error, '海报列表加载失败，请重试');
    } finally { restore(); }
  });

  it('恢复后立即可读（故障不污染后续请求）', async () => {
    const r = await getPosters();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.items.length, 2);
  });
});
