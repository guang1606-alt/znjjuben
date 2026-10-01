/**
 * v2.291 守卫：/api/auth/refresh 跨标签页并发续期竞态修复（服务端在途单飞）。
 *
 * 缺口（修复前实证）：同一 rt 双请求并发（双标签页同次登录 access 同时到期、后台页与前台页
 * 同时在边界后发请求的真实场景）→ 首个 200、次个 401 REFRESH_REUSED → 前端 refreshSession
 * 返回 null → clearSession 清的是共享 localStorage → 两个标签页一起被踢下线。
 * 修复：refresh-rotate 增加 withRefreshFlight 在途单飞——同 key 并发共享首个 flight 的结果；
 * 只合并「在途」，不留时间窗，既有顺序重放 401 语义（重放防护）完全不破。
 *
 * 独立成文件的原因：既有 http-refresh-rotation.test.cjs 已用满注册限流预算
 * （同 IP 15 分钟 5 个成功注册，v2.217），本文件独立进程自带全新配额。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { withRefreshFlight, resetRefreshRotate } = require('../dist/lib/refresh-rotate.js');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem) });

let base;
const server = app.listen(0);
test.before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((res) => server.close(res));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const register = async (phone) => post('/api/auth/register', { phone, password: 'password123' }).then((r) => r.json());

// 内存桩全微任务会快过并发次请求的到达，无法形成在途窗口；
// 打 30ms 延迟补丁模拟真实库 I/O（实测 loopback 双连接请求到达抖动 ~3ms，setImmediate 不够宽），
// 让首个请求的在途窗口确定性地盖住次请求到达（生产侧真实 PG 查询同为 ms 级窗口）。
const withIoDelay = () => {
  const orig = mem.user.findUnique;
  mem.user.findUnique = (args) => new Promise((res) => setTimeout(() => res(orig(args)), 30));
  return () => { mem.user.findUnique = orig; };
};

test('v2.291 并发单飞：同一 refreshToken 并发续期共享首次结果（双 200 同对 token）', async () => {
  const reg = await register('13990002001');
  assert.ok(reg.refreshToken, '注册必须成功（注册限流预算内）');
  const restore = withIoDelay();
  const [ra, rb] = await Promise.all([
    post('/api/auth/refresh', { refreshToken: reg.refreshToken }),
    post('/api/auth/refresh', { refreshToken: reg.refreshToken }),
  ]);
  restore();
  assert.strictEqual(ra.status, 200, '并发请求 A 必须成功');
  assert.strictEqual(rb.status, 200, '并发请求 B 必须共享在途结果（不得 401 误踢全端）');
  const ja = await ra.json();
  const jb = await rb.json();
  assert.strictEqual(ja.refreshToken, jb.refreshToken, '并发方必须拿到同一对轮换 token，双标签页收敛到同一会话');
  assert.ok(ja.refreshToken && ja.refreshToken !== reg.refreshToken, '共享结果仍是已轮换的新 token');
  // 共享到的新 rt 可继续链式刷新（结果可用性）
  const r2 = await post('/api/auth/refresh', { refreshToken: ja.refreshToken });
  assert.strictEqual(r2.status, 200, '并发共享得到的新 rt 必须可继续链式刷新');
});

test('v2.291 重放防护不破：并发窗口结束后旧 rt 顺序重放仍 401', async () => {
  const reg = await register('13990002002');
  const restore = withIoDelay();
  const [ra, rb] = await Promise.all([
    post('/api/auth/refresh', { refreshToken: reg.refreshToken }),
    post('/api/auth/refresh', { refreshToken: reg.refreshToken }),
  ]);
  restore();
  assert.strictEqual(ra.status, 200);
  assert.strictEqual(rb.status, 200);
  const replay = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(replay.status, 401, '在途窗口结束后重放仍须拒绝（单飞只合并在途，不留时间窗）');
});

test('v2.291 单飞不串号：不同用户并发续期各自独立', async () => {
  const regA = await register('13990002003');
  const regB = await register('13990002004');
  const [ra, rb] = await Promise.all([
    post('/api/auth/refresh', { refreshToken: regA.refreshToken }),
    post('/api/auth/refresh', { refreshToken: regB.refreshToken }),
  ]);
  assert.strictEqual(ra.status, 200);
  assert.strictEqual(rb.status, 200);
  const ja = await ra.json();
  const jb = await rb.json();
  assert.notStrictEqual(ja.refreshToken, jb.refreshToken, '不同 key 不得共享 flight');
});

// lib 级确定性守卫（deferred 控制时序，不依赖网络）
test('v2.291 lib：withRefreshFlight 并发同 key 共享结果，fn 只执行一次', async () => {
  resetRefreshRotate();
  let release;
  const gate = new Promise((res) => { release = res; });
  let calls = 0;
  const fn = async () => { calls++; await gate; return { pair: 'p1' }; };
  const pa = withRefreshFlight('unit:k1', 999999, fn);
  const pb = withRefreshFlight('unit:k1', 999999, fn);
  release();
  const [va, vb] = await Promise.all([pa, pb]);
  assert.strictEqual(calls, 1, '并发同 key 时 fn 只能执行一次');
  assert.deepStrictEqual(va, { ok: true, value: { pair: 'p1' } });
  assert.deepStrictEqual(vb, { ok: true, value: { pair: 'p1' } });
});

test('v2.291 lib：flight 完成后同 key 重放 ok:false（消费语义不破）', async () => {
  resetRefreshRotate();
  const first = await withRefreshFlight('unit:k2', 999999, async () => ({ pair: 'p2' }));
  assert.strictEqual(first.ok, true);
  const replay = await withRefreshFlight('unit:k2', 999999, async () => ({ pair: 'p3' }));
  assert.strictEqual(replay.ok, false, 'flight 已完成后同 key 重放必须拒绝');
});

test('v2.291 lib：fn 抛错时并发方同收异常且不残留在途登记', async () => {
  resetRefreshRotate();
  let reject;
  const gate = new Promise((_, rej) => { reject = rej; });
  const fn = async () => { await gate; throw new Error('boom'); };
  const pa = withRefreshFlight('unit:k3', 999999, fn).then(() => 'resolved', (e) => e.message);
  const pb = withRefreshFlight('unit:k3', 999999, fn).then(() => 'resolved', (e) => e.message);
  reject(new Error('boom'));
  assert.deepStrictEqual(await Promise.all([pa, pb]), ['boom', 'boom'], '并发方须共享同一失败');
  const after = await withRefreshFlight('unit:k3', 999999, async () => ({ pair: 'p4' }));
  assert.strictEqual(after.ok, false, '失败后 key 已消费，后续仍按重放拒绝（不留可重试窟窿）');
});
