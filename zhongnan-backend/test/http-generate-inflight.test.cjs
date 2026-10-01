/**
 * v2.292 守卫：/api/generate/episodes 同项目并发重复提交防线（在途单项目串行）。
 *
 * 缺口（修复前实证）：同一项目双发创作请求，两请求各自建 task、各自冻结积分、
 * 各自读同一 max(epNo)、各自跑完整条 LLM 流水线（分钟级、真实成本 ×2，且连续性
 * 注入互相读不到对方）→ 落库撞 @@unique([projectId, epNo, version])，败者 P2002
 * 才走 catch 退款。资金虽最终退回，但败者白烧整条流水线成本、用户白等几分钟后
 * 才收到失败。修复：同项目「在途检查 + 建单」收进账户行锁事务（同用户请求在
 * 行锁上串行，封死 TOCTOU），在途即 409，零冻结零模型调用；35 分钟窗口自愈
 * 进程崩溃残留的 RUNNING 行（全局硬超时 30 分钟 + 收尾余量），绝不永久锁死项目。
 *
 * 独立成文件：与 http-generate.test.cjs 同路由但聚焦并发面，避免大文件继续膨胀。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'inflight-test-secret';
process.env.JWT_REFRESH_SECRET = 'inflight-test-refresh';
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

const seed = (id, level = 'FREE', balance = 0) => {
  mem._seedUser({ id, level, balance });
  mem._projects.set(`proj_${id}`, { id: `proj_${id}`, userId: id, bible: null });
  return `proj_${id}`;
};
const headers = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';

async function call(uid, level, body) {
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers: headers(uid, level), body: JSON.stringify(body) });
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
      }
    }
    return { status: resp.status, events };
  }
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

describe('v2.292 同项目创作在途防线（串行）', { concurrency: 1 }, () => {
  it('并发双发同项目：A 在途期间 B 409，零重复冻结、零重复建单、A 正常落库', async () => {
    const pid = seed('u_conc', 'BASIC', 1000);
    // 确定性在途窗口：闸门卡住 A 的落库（script.create 是流水线终点前的最后一步），
    // 保证 B 的守卫检查时 A 必然 RUNNING，不靠时序运气
    const origCreate = mem.script.create;
    let releaseScript;
    const gate = new Promise((res) => { releaseScript = res; });
    mem.script.create = (args) => gate.then(() => origCreate(args));
    let respB = null; let sawFrozen = false; const eventsA = [];
    const respA = await fetch(base + '/api/generate/episodes', { method: 'POST', headers: headers('u_conc', 'BASIC'), body: JSON.stringify({ projectId: pid, brief }) });
    assert.strictEqual(respA.status, 200);
    const reader = respA.body.getReader(); const dec = new TextDecoder(); let buf = '';
    // 先读到 frozen 帧（此刻 A 必然 RUNNING），发 B 拿到响应后立刻放闸让 A 落库收尾
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) eventsA.push(JSON.parse(l.slice(6))); });
      }
      if (sawFrozen) continue;
      if (eventsA.some((e) => e.stage === 'frozen')) {
        sawFrozen = true;
        respB = await fetch(base + '/api/generate/episodes', { method: 'POST', headers: headers('u_conc', 'BASIC'), body: JSON.stringify({ projectId: pid, brief }) });
        releaseScript(); // B 已有结论，放闸让 A 跑完（闸只用来保证 B 检查时 A 在途）
        mem.script.create = origCreate;
      }
    }
    assert.ok(sawFrozen, 'A 必须进入 frozen（任务已 RUNNING）');
    assert.strictEqual(respB.status, 409, '在途期间第二发必须 409，不得再建单再冻结再烧流水线');
    assert.strictEqual(respB.headers.get('content-type')?.includes('application/json'), true, '409 必须是 JSON（前端按非 SSE 分支展示）');
    const jb = await respB.json();
    assert.strictEqual(jb.code, 'PROJECT_GENERATION_IN_FLIGHT');
    assert.ok(jb.error && jb.error.length > 0, 'error 必须是可直接展示的中文文案（前端通用分支读 j.error）');
    // A 正常完成
    assert.ok(eventsA.find((e) => e.stage === 'done'), 'A 必须正常完成，不受 B 的 409 影响');
    // 资金：只扣一次（基础·经济=10 积分），无冻结残留
    assert.strictEqual(mem._accounts.get('u_conc').balance, 990, '只允许一笔扣费，B 零冻结');
    assert.strictEqual(mem._accounts.get('u_conc').frozen, 0);
    // 只建 1 个任务、只落 1 集
    const tasks = await mem.generationTask.findMany({ where: { projectId: pid } });
    assert.strictEqual(tasks.length, 1, 'B 不得建 task');
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 1, '只允许落 1 集');
  });

  it('同项目串行放行：前一集 DONE 后下一集正常生成（epNo 递增）', async () => {
    const pid = seed('u_seq', 'BASIC', 1000);
    const r1 = await call('u_seq', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r1.status, 200);
    assert.ok(r1.events.find((e) => e.stage === 'done'));
    const r2 = await call('u_seq', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r2.status, 200, '前一集完成后必须放行');
    assert.ok(r2.events.find((e) => e.stage === 'done'));
    const eps = mem._scripts.filter((s) => s.projectId === pid).map((s) => s.epNo).sort();
    assert.deepStrictEqual(eps, [1, 2], '串行两集 epNo 必须递增');
    assert.strictEqual(mem._accounts.get('u_seq').balance, 980);
  });

  it('终态不占坑：FAILED / CANCELLED 任务不阻塞新创作', async () => {
    const pid = seed('u_terminal', 'BASIC', 1000);
    await mem.generationTask.create({ data: { projectId: pid, status: 'FAILED' } });
    await mem.generationTask.create({ data: { projectId: pid, status: 'CANCELLED' } });
    const r = await call('u_terminal', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 200, 'FAILED/CANCELLED 必须释放占坑，允许重试');
    assert.ok(r.events.find((e) => e.stage === 'done'));
  });

  it('崩溃残留自愈：35 分钟前的 RUNNING 行不阻塞；新鲜 RUNNING 行拦截 409', async () => {
    // 进程崩溃来不及走 catch，RUNNING 行残留——至多阻塞 35 分钟（全局硬超时 30 分钟 + 余量）即自愈
    const pidStale = seed('u_stale', 'BASIC', 1000);
    await mem.generationTask.create({ data: { projectId: pidStale, status: 'RUNNING', createdAt: new Date(Date.now() - 40 * 60_000) } });
    const rStale = await call('u_stale', 'BASIC', { projectId: pidStale, brief });
    assert.strictEqual(rStale.status, 200, '陈旧 RUNNING（崩溃残留）必须自愈放行，不得永久锁死项目');
    assert.ok(rStale.events.find((e) => e.stage === 'done'));

    const pidFresh = seed('u_fresh_run', 'BASIC', 1000);
    await mem.generationTask.create({ data: { projectId: pidFresh, status: 'RUNNING' } });
    const rFresh = await call('u_fresh_run', 'BASIC', { projectId: pidFresh, brief });
    assert.strictEqual(rFresh.status, 409, '新鲜 RUNNING 必须拦截');
    assert.strictEqual(rFresh.json.code, 'PROJECT_GENERATION_IN_FLIGHT');
    assert.strictEqual(mem._accounts.get('u_fresh_run').balance, 1000, '被拦截请求零扣费零冻结');
  });

  it('跨项目并行放行：项目 A 在途不阻塞同用户的项目 B', async () => {
    const pidA = seed('u_multi', 'BASIC', 1000);
    mem._projects.set('proj_u_multi_b', { id: 'proj_u_multi_b', userId: 'u_multi', bible: null });
    await mem.generationTask.create({ data: { projectId: pidA, status: 'RUNNING' } });
    const rB = await call('u_multi', 'BASIC', { projectId: 'proj_u_multi_b', brief });
    assert.strictEqual(rB.status, 200, '防线粒度是单项目，跨项目并行创作是合法场景');
    assert.ok(rB.events.find((e) => e.stage === 'done'));
    // 顺带验证：项目 A 此时再发仍 409
    const rA = await call('u_multi', 'BASIC', { projectId: pidA, brief });
    assert.strictEqual(rA.status, 409);
  });

  it('QUEUED 在途同样拦截（建单后未开跑窗口）', async () => {
    const pid = seed('u_queued', 'BASIC', 1000);
    await mem.generationTask.create({ data: { projectId: pid, status: 'QUEUED' } });
    const r = await call('u_queued', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 409, 'QUEUED 也是在途，必须拦截');
    assert.strictEqual(r.json.code, 'PROJECT_GENERATION_IN_FLIGHT');
  });
});
