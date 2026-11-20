/**
 * v2.590 取消运行中任务不得把数据库故障谎报成「任务不存在」：
 * 旧实现 POST /api/generate/tasks/:id/cancel：
 *   const task = await prisma.generationTask.findUnique({...}).catch(() => null);
 *   if (!task || ...) return res.status(404).json({ error: '任务不存在' });
 * findUnique 因数据库瞬时抖动抛错时，被 .catch(() => null) 吞成「任务不存在」——
 * 用户正在取消一个扣费中的运行中任务，却看到「任务不存在」，既无法停止扣费也无从重试，
 * 服务端还无日志。与 v2.582 知识归档修复同族：必须区分「记录不存在（404）」与「数据库故障（500 可重试 + 留痕）」。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'cancel-truth-secret';
process.env.JWT_REFRESH_SECRET = 'cancel-truth-refresh';
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

mem._seedUser({ id: 'u_cancel', level: 'FREE', balance: 0 });
mem._seedUser({ id: 'u_other', level: 'FREE', balance: 0 });
mem._projects.set('p_cancel', { id: 'p_cancel', userId: 'u_cancel', title: '可取消项目', mode: 'novel', status: 'active', bible: {}, createdAt: new Date(), updatedAt: new Date() });
mem._projects.set('p_other', { id: 'p_other', userId: 'u_other', title: '他人项目', mode: 'novel', status: 'active', bible: {}, createdAt: new Date(), updatedAt: new Date() });

function seedTask(id, projectId, status = 'RUNNING') {
  mem._tasks.set(id, { id, projectId, status, createdAt: new Date(), updatedAt: new Date() });
  return id;
}

function patch(model, method, impl) {
  const orig = mem[model][method];
  mem[model][method] = impl(orig);
  return () => { mem[model][method] = orig; };
}

async function cancel(taskId, uid = 'u_cancel') {
  const resp = await fetch(`${base}/api/generate/tasks/${taskId}/cancel`, { method: 'POST', headers: auth(uid, 'FREE') });
  return { status: resp.status, body: await resp.json() };
}

describe('取消任务真实性（v2.590）', { concurrency: 1 }, () => {
  it('正常：本人 RUNNING 任务取消成功', async () => {
    seedTask('t_run', 'p_cancel', 'RUNNING');
    const r = await cancel('t_run');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
    assert.strictEqual(r.body.taskId, 't_run');
  });

  it('不存在 / 他人任务：404「任务不存在」（与库故障严格区分）', async () => {
    const missing = await cancel('t_not_exist');
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.error, '任务不存在');

    seedTask('t_other', 'p_other', 'RUNNING');
    const other = await cancel('t_other');
    assert.strictEqual(other.status, 404, '他人任务按不存在处理');
    assert.strictEqual(other.body.error, '任务不存在');
  });

  it('非运行中：409「任务不在运行中」（既有行为守护）', async () => {
    seedTask('t_done', 'p_cancel', 'DONE');
    const r = await cancel('t_done');
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error, '任务不在运行中');
  });

  it('findUnique 数据库故障：500 可重试 + 留痕，绝不谎报「任务不存在」', async () => {
    seedTask('t_db', 'p_cancel', 'RUNNING');
    const restore = patch('generationTask', 'findUnique', (orig) => async (arg) => {
      if (arg?.where?.id === 't_db') throw new Error('DB_DOWN');
      return orig.call(mem.generationTask, arg);
    });
    try {
      const r = await cancel('t_db');
      assert.strictEqual(r.status, 500, '库故障不得被吞成 404');
      assert.strictEqual(r.body.error, '取消失败，请重试');
      assert.ok(r.body.taskId === undefined, '失败响应不得携带成功载荷');
    } finally { restore(); }
  });

  it('故障恢复后立即可取消（不污染后续请求）', async () => {
    seedTask('t_after', 'p_cancel', 'RUNNING');
    const r = await cancel('t_after');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
  });
});
