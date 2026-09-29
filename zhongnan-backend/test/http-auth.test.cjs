const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const express = require('express');
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { authRequired } = require('../dist/middleware/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const P = require('../dist/config/pricing.js');

const { asyncRouter } = require('../dist/lib/async-router.js');
const mem = createMemoryPrisma();
// 扩展位路由：验证 async 抛错被统一 JSON 错误中间件兜底（必须挂在错误中间件之前）
const extra = asyncRouter();
extra.get('/_test/ar/boom', async () => { throw new Error('模拟内部异常'); });
const app = createApp({ auth: createAuthRouter(mem) }, extra);
// 受保护样例路由，用于验证 JWT 中间件的真实 HTTP 行为
app.get('/_test/me', authRequired, (req, res) => res.json({ uid: req.userId, level: req.level }));

let base;
const server = app.listen(0);
test.before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
test.after(async () => {
  server.closeAllConnections?.(); // 断开 undici keep-alive，避免 close 永久等待
  await new Promise((res) => server.close(res));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); // 释放真实默认路由实例化的客户端句柄
});

const post = (p, body, token) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
const get = (p, token) => fetch(base + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('健康检查 200', async () => {
  const r = await fetch(base + '/health'); const j = await r.json();
  assert.strictEqual(r.status, 200); assert.strictEqual(j.ok, true);
});

test('注册入参校验：坏手机号/短密码 400', async () => {
  assert.strictEqual((await post('/api/auth/register', { phone: '123', password: 'abcdefgh' })).status, 400);
  assert.strictEqual((await post('/api/auth/register', { phone: '13800001111', password: 'short' })).status, 400);
});

test('正常注册 200 并下发双 token', async () => {
  const r = await post('/api/auth/register', { phone: '13800001111', password: 'password123' });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.ok(j.accessToken && j.refreshToken);
  assert.strictEqual(j.user.level, 'FREE');
});

test('重复注册 409', async () => {
  assert.strictEqual((await post('/api/auth/register', { phone: '13800001111', password: 'password123' })).status, 409);
});

test('登录防枚举：用户不存在与密码错都返回相同 401 文案', async () => {
  const noUser = await post('/api/auth/login', { phone: '13900000000', password: 'password123' });
  const wrongPw = await post('/api/auth/login', { phone: '13800001111', password: 'wrongpassword' });
  assert.strictEqual(noUser.status, 401); assert.strictEqual(wrongPw.status, 401);
  assert.strictEqual((await noUser.json()).error, (await wrongPw.json()).error);
});

test('正确密码登录 200', async () => {
  const r = await post('/api/auth/login', { phone: '13800001111', password: 'password123' });
  assert.strictEqual(r.status, 200);
  assert.ok((await r.json()).accessToken);
});

test('封禁账号登录 403', async () => {
  mem._setBanned('13800001111', true);
  assert.strictEqual((await post('/api/auth/login', { phone: '13800001111', password: 'password123' })).status, 403);
  mem._setBanned('13800001111', false);
});

test('受保护接口：无 token 401、伪造 token 401、合法 token 200', async () => {
  assert.strictEqual((await get('/_test/me')).status, 401);
  assert.strictEqual((await get('/_test/me', 'garbage.token.here')).status, 401);
  const login = await (await post('/api/auth/login', { phone: '13800001111', password: 'password123' })).json();
  const ok = await get('/_test/me', login.accessToken);
  assert.strictEqual(ok.status, 200);
  const j = await ok.json(); assert.ok(j.uid);
});

test('refresh：坏 refresh 401，合法 refresh 换新 access 200', async () => {
  assert.strictEqual((await post('/api/auth/refresh', { refreshToken: 'bad' })).status, 401);
  const reg = await (await post('/api/auth/register', { phone: '13700002222', password: 'password123' })).json();
  const r = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(r.status, 200);
  assert.ok((await r.json()).accessToken);
});

test('邀请注册：双方各得注册奖励积分（资金链路经 HTTP 跑通）', async () => {
  const inviter = [...mem._users.values()].find((u) => u.phone === '13800001111');
  assert.ok(inviter.inviteCode);
  const before = mem._accounts.get(inviter.id).balance;
  const r = await post('/api/auth/register', { phone: '13600003333', password: 'password123', inviteCode: inviter.inviteCode });
  assert.strictEqual(r.status, 200);
  const after = mem._accounts.get(inviter.id).balance;
  // 账户余额以“积分”计：邀请人到账 BOTH_REWARD_POINTS 积分
  assert.ok(after - before === P.INVITE.BOTH_REWARD_POINTS, `邀请奖励到账异常 ${before}->${after}`);
});

test('async 路由抛错被全局兜底为 500，而不是让请求永久挂起', async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000); // 若未兜底会一直挂起直到这里 abort
  const resp = await fetch(base + '/_test/ar/boom', { signal: ctrl.signal });
  clearTimeout(timer);
  assert.strictEqual(resp.status, 500);
  assert.strictEqual((await resp.json()).error, 'INTERNAL_ERROR');
});
