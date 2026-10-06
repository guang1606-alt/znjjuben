/**
 * v2.318 制作中管理台（统一查看+干预）HTTP 行为测试
 *  - 查看：scope 过滤（active/failed/all）+ live 实时句柄标记 + 详情含岗位级 ModelCallLog 时间线
 *  - 干预：cancel（活跃句柄）/ force-fail 清僵尸（幂等解冻钩子，先退款后翻状态）
 *  - 鉴权：未登录 401 / 普通用户与副管理员 403 / 仅超管主账号可过
 *  - 回归修复：generate.ts 取消端点此前判 task.userId（GenerationTask 无此字段）恒 404，改判 project.userId
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'pc-test-access-secret-3180';
process.env.JWT_REFRESH_SECRET = 'pc-test-refresh-secret-3180';
const { createApp } = require('../dist/server/app.js');
const { createProductionConsoleRouter } = require('../dist/routes/production-console.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const AT = require('../dist/lib/active-tasks.js');

/** 专用内存桩：只实现管理台与取消端点用到的最小接口 */
function makeStub() {
  const users = new Map();
  const projects = new Map();
  const tasks = new Map();
  const callLogs = [];
  const withProj = (t) => ({ ...t, project: projects.get(t.projectId) ?? null });
  return {
    users, projects, tasks, callLogs,
    prisma: {
      user: {
        async findUnique({ where, select } = {}) {
          const u = users.get(where?.id);
          if (!u) return null;
          return select ? Object.fromEntries(Object.keys(select).filter((k) => u[k] !== undefined).map((k) => [k, u[k]])) : { ...u };
        },
      },
      generationTask: {
        async findMany({ where = {}, orderBy, take } = {}) {
          let r = [...tasks.values()];
          if (where.status?.in) r = r.filter((t) => where.status.in.includes(t.status));
          else if (where.status) r = r.filter((t) => t.status === where.status);
          if (orderBy?.createdAt === 'desc') r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (take != null) r = r.slice(0, take);
          return r.map(withProj);
        },
        async findUnique({ where } = {}) { const t = tasks.get(where?.id); return t ? withProj(t) : null; },
        async update({ where, data } = {}) {
          const t = tasks.get(where?.id);
          if (!t) throw new Error('P2025');
          Object.assign(t, data);
          return withProj(t);
        },
      },
      modelCallLog: {
        async findMany({ where = {}, orderBy, take } = {}) {
          let r = callLogs.filter((l) => !where.taskId || l.taskId === where.taskId);
          if (orderBy?.createdAt === 'desc') r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (take != null) r = r.slice(0, take);
          return r.map((l) => ({ ...l }));
        },
      },
    },
  };
}

const mem = makeStub();
mem.users.set('admin1', { id: 'admin1', phone: '18891995171', level: 'PRO' });
mem.users.set('subadm', { id: 'subadm', phone: '13000000009', level: 'PRO', isAdmin: true });
mem.users.set('u1', { id: 'u1', phone: '13900000001', level: 'PRO', nickname: '杨光' });
mem.projects.set('p1', { id: 'p1', title: '重生之我掌管全宇宙', mode: 'interview', userId: 'u1' });
mem.tasks.set('t_run', { id: 't_run', projectId: 'p1', stage: 'draft', engineTier: 'STANDARD', status: 'RUNNING', pointsCost: 30, errorMsg: null, createdAt: new Date(Date.now() - 120000), finishedAt: null });
mem.tasks.set('t_queued', { id: 't_queued', projectId: 'p1', stage: 'outline', engineTier: 'ECONOMY', status: 'QUEUED', pointsCost: 10, errorMsg: null, createdAt: new Date(Date.now() - 3600000), finishedAt: null });
mem.tasks.set('t_zombie', { id: 't_zombie', projectId: 'p1', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10, errorMsg: null, createdAt: new Date(Date.now() - 7200000), finishedAt: null });
mem.tasks.set('t_zombie2', { id: 't_zombie2', projectId: 'p1', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10, errorMsg: null, createdAt: new Date(Date.now() - 7000000), finishedAt: null });
mem.tasks.set('t_failed', { id: 't_failed', projectId: 'p1', stage: 'polish', engineTier: 'ECONOMY', status: 'FAILED', pointsCost: 10, errorMsg: 'MODEL_TIMEOUT', createdAt: new Date(Date.now() - 172800000), finishedAt: new Date(Date.now() - 172700000) });
mem.tasks.set('t_done', { id: 't_done', projectId: 'p1', stage: 'finalize', engineTier: 'STANDARD', status: 'DONE', pointsCost: 30, errorMsg: null, createdAt: new Date(Date.now() - 86400000), finishedAt: new Date(Date.now() - 86300000) });
mem.callLogs.push(
  { id: 'c1', taskId: 't_run', role: 'architect', engineTier: 'STANDARD', modality: 'text', tokensIn: 1000, tokensOut: 2000, costFen: 8, priceFen: 20, createdAt: new Date(Date.now() - 60000) },
  { id: 'c2', taskId: 't_run', role: 'designer', engineTier: 'STANDARD', modality: 'text', tokensIn: 1500, tokensOut: 3000, costFen: 12, priceFen: 30, createdAt: new Date(Date.now() - 30000) },
);

// 活跃句柄：t_run 视为「正在跑」，t_zombie/t_zombie2/t_queued 为孤儿（进程重启悬挂）
const ctrlRun = new AbortController();
AT.setActiveAbort('t_run', ctrlRun);

const refundCalls = [];
let refundFailMode = false;
const refundTask = async (t) => {
  if (refundFailMode) throw new Error('LEDGER_DOWN');
  refundCalls.push({ id: t.id, pointsCost: t.pointsCost });
};

const app = createApp({ productionConsole: createProductionConsoleRouter(mem.prisma, { refundTask }) });
let base;
let server;
before(() => new Promise((res) => {
  server = app.listen(0);
  server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); });
}));
after(async () => {
  server?.closeAllConnections?.();
  await new Promise((r) => server?.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const H = (uid, level = 'PRO') => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const get = async (p, uid) => { const r = await fetch(base + p, { headers: uid ? H(uid) : {} }); return { s: r.status, j: await r.json().catch(() => null) }; };
const post = async (p, uid) => { const r = await fetch(base + p, { method: 'POST', headers: H(uid), body: '{}' }); return { s: r.status, j: await r.json().catch(() => null) }; };

describe('制作中管理台·鉴权', { concurrency: 1 }, () => {
  it('未登录 GET /tasks 401', async () => assert.strictEqual((await get('/api/admin/production/tasks')).s, 401));
  it('普通用户 403（项目主人也不行，管理台仅超管）', async () => assert.strictEqual((await get('/api/admin/production/tasks', 'u1')).s, 403));
  it('副管理员 isAdmin=true 403（后台操作仅主账号）', async () => assert.strictEqual((await get('/api/admin/production/tasks', 'subadm')).s, 403));
  it('副管理员干预也 403：cancel 与 force-fail 均需超管（变异3暴露盲区，补咬合）', async () => {
    assert.strictEqual((await post('/api/admin/production/tasks/t_run/cancel', 'subadm')).s, 403);
    assert.strictEqual((await post('/api/admin/production/tasks/t_zombie/force-fail', 'subadm')).s, 403);
  });
});

describe('制作中管理台·查看', { concurrency: 1 }, () => {
  it('scope=active（默认）：只含 QUEUED/RUNNING，live 标记区分真实句柄与孤儿，带出项目', async () => {
    const { s, j } = await get('/api/admin/production/tasks', 'admin1');
    assert.strictEqual(s, 200);
    const ids = j.tasks.map((t) => t.id).sort();
    assert.deepStrictEqual(ids, ['t_queued', 't_run', 't_zombie', 't_zombie2']);
    const byId = Object.fromEntries(j.tasks.map((t) => [t.id, t]));
    assert.strictEqual(byId.t_run.live, true);
    assert.strictEqual(byId.t_zombie.live, false);
    assert.strictEqual(byId.t_queued.live, false);
    assert.strictEqual(byId.t_run.project.title, '重生之我掌管全宇宙');
    assert.strictEqual(byId.t_run.project.userId, 'u1');
    assert.strictEqual(byId.t_run.status, 'RUNNING');
    assert.ok(byId.t_queued.durationMs > 3600000 - 60000);
    assert.strictEqual(byId.t_failed, undefined, 'DONE/FAILED 不得混入 active 视图');
  });

  it('scope=failed：只含 FAILED/CANCELED', async () => {
    const { s, j } = await get('/api/admin/production/tasks?scope=failed', 'admin1');
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j.tasks.map((t) => t.id), ['t_failed']);
    assert.strictEqual(j.tasks[0].errorMsg, 'MODEL_TIMEOUT');
  });

  it('scope=all：全量六条，按创建时间倒序', async () => {
    const { s, j } = await get('/api/admin/production/tasks?scope=all&limit=200', 'admin1');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.tasks.length, 6);
    const times = j.tasks.map((t) => new Date(t.createdAt).getTime());
    for (let i = 1; i < times.length; i++) assert.ok(times[i - 1] >= times[i], 'createdAt 倒序');
  });

  it('详情：任务全字段 + owner + 岗位级调用日志倒序', async () => {
    const { s, j } = await get('/api/admin/production/tasks/t_run', 'admin1');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.task.id, 't_run');
    assert.strictEqual(j.task.live, true);
    assert.strictEqual(j.task.owner.phone, '13900000001');
    assert.strictEqual(j.task.owner.nickname, '杨光');
    assert.strictEqual(j.task.callLogs.length, 2);
    assert.strictEqual(j.task.callLogs[0].id, 'c2', '最新调用在前');
    assert.strictEqual(j.task.callLogs[1].role, 'architect');
  });

  it('详情：不存在的任务 404', async () => assert.strictEqual((await get('/api/admin/production/tasks/nope', 'admin1')).s, 404));
});

describe('制作中管理台·干预', { concurrency: 1 }, () => {
  it('cancel 活跃任务：abort 真实句柄，管线在下一岗位边界抛 CANCELLED', async () => {
    const { s, j } = await post('/api/admin/production/tasks/t_run/cancel', 'admin1');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(ctrlRun.signal.aborted, true, '必须 abort 真实注册的句柄');
  });

  it('cancel 无句柄的 RUNNING（僵尸）：409 并引导用强制失败', async () => {
    const { s, j } = await post('/api/admin/production/tasks/t_zombie/cancel', 'admin1');
    assert.strictEqual(s, 409);
    assert.ok(j.error.includes('强制失败'));
  });

  it('cancel 已结束任务：409', async () => assert.strictEqual((await post('/api/admin/production/tasks/t_done/cancel', 'admin1')).s, 409));

  it('force-fail 僵尸：先幂等解冻后翻 FAILED，errorMsg 标注清理来源', async () => {
    const { s, j } = await post('/api/admin/production/tasks/t_zombie/force-fail', 'admin1');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.ok, true);
    const t = mem.tasks.get('t_zombie');
    assert.strictEqual(t.status, 'FAILED');
    assert.ok(String(t.errorMsg).includes('僵尸'));
    assert.deepStrictEqual(refundCalls, [{ id: 't_zombie', pointsCost: 10 }], '冻结积分必须解冻退回');
  });

  it('force-fail 有活跃句柄的任务：409（走 cancel 保证退款闭环）', async () => {
    AT.setActiveAbort('t_queued', new AbortController());
    const r2 = await post('/api/admin/production/tasks/t_queued/force-fail', 'admin1');
    assert.strictEqual(r2.s, 409);
    assert.ok(r2.j.error.includes('取消'));
    AT.deleteActiveAbort('t_queued');
  });

  it('force-fail 已结束任务：409', async () => assert.strictEqual((await post('/api/admin/production/tasks/t_done/force-fail', 'admin1')).s, 409));

  it('退款钩子异常：500 且任务状态保持不变（先退款后翻状态，可安全重试）', async () => {
    refundFailMode = true;
    const { s } = await post('/api/admin/production/tasks/t_zombie2/force-fail', 'admin1');
    assert.strictEqual(s, 500);
    assert.strictEqual(mem.tasks.get('t_zombie2').status, 'RUNNING', '退款失败不得翻状态，否则用户永久丢失解冻机会');
    refundFailMode = false;
  });
});

describe('generate.ts 取消端点回归修复（task.userId → project.userId）', { concurrency: 1 }, () => {
  const gen = makeStub();
  gen.users.set('u1', { id: 'u1', level: 'PRO' });
  gen.users.set('u2', { id: 'u2', level: 'PRO' });
  gen.projects.set('gp1', { id: 'gp1', title: 'A', userId: 'u1' });
  gen.projects.set('gp2', { id: 'gp2', title: 'B', userId: 'u2' });
  gen.tasks.set('g1', { id: 'g1', projectId: 'gp1', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10, errorMsg: null, createdAt: new Date(), finishedAt: null });
  gen.tasks.set('g2', { id: 'g2', projectId: 'gp2', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10, errorMsg: null, createdAt: new Date(), finishedAt: null });
  const genApp = createApp({ generate: createGenerateRouter(gen.prisma) });
  let gbase;
  let gserver;
  // listen 必须在 before（运行阶段）发起：收集阶段 listen 的 listening 事件会在前置套件
  // 的 HTTP 往返期间触发完毕，届时才注册 once('listening') 将永远等不到（进程挂死教训）
  before(() => new Promise((res) => {
    gserver = genApp.listen(0);
    gserver.once('listening', () => { gbase = `http://127.0.0.1:${gserver.address().port}`; res(); });
  }));
  after(async () => { gserver?.closeAllConnections?.(); await new Promise((r) => gserver?.close(r)); });

  it('项目主人取消自己的 RUNNING 任务：200 且真实 abort、句柄出表', async () => {
    const c = new AbortController();
    AT.setActiveAbort('g1', c);
    const r = await fetch(gbase + '/api/generate/tasks/g1/cancel', { method: 'POST', headers: H('u1'), body: '{}' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(c.signal.aborted, true);
    assert.strictEqual(AT.getActiveAbort('g1'), undefined, '取消后句柄必须出表');
  });

  it('取消他人的任务：404', async () => {
    const c = new AbortController();
    AT.setActiveAbort('g2', c);
    const r = await fetch(gbase + '/api/generate/tasks/g2/cancel', { method: 'POST', headers: H('u1'), body: '{}' });
    assert.strictEqual(r.status, 404);
    assert.strictEqual(c.signal.aborted, false, '越权请求不得误伤他人任务');
  });
});
