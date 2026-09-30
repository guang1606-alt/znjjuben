const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const jwt = require('jsonwebtoken');

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

test('刷新轮换：/refresh 返回新 refreshToken 且与旧值不同', async () => {
  const reg = await register('13990001001');
  const r = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.ok(j.accessToken, '应有新 accessToken');
  assert.ok(j.refreshToken, '应有新 refreshToken（轮换）');
  assert.notStrictEqual(j.refreshToken, reg.refreshToken, '新 refreshToken 必须与旧值不同');
});

test('重放防护：旧 refreshToken 第二次使用 401', async () => {
  const reg = await register('13990001002');
  const first = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(first.status, 200);
  const replay = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(replay.status, 401, '已消费的 refresh token 重放必须拒绝');
});

test('链式有效：新 refreshToken 可继续刷新并再次轮换', async () => {
  const reg = await register('13990001003');
  const r1 = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  const j1 = await r1.json();
  const r2 = await post('/api/auth/refresh', { refreshToken: j1.refreshToken });
  assert.strictEqual(r2.status, 200);
  const j2 = await r2.json();
  assert.ok(j2.refreshToken && j2.refreshToken !== j1.refreshToken, '第二轮换继续出新 token');
});

test('平滑过渡：无 jti 的旧格式 refresh token 仍可刷新并升级为轮换 token', async () => {
  const reg = await register('13990001004');
  const legacy = jwt.sign({ sub: reg.user.id, level: 'FREE' }, 'http-test-refresh', { expiresIn: 86400 });
  const r = await post('/api/auth/refresh', { refreshToken: legacy });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.ok(j.refreshToken, '旧 token 刷新后应拿到带轮换的新 token');
  // 旧格式 token 无 jti，无法追踪消费，再次使用也应拒绝（升级后不再放行裸旧 token 反复刷新）
  const again = await post('/api/auth/refresh', { refreshToken: legacy });
  assert.strictEqual(again.status, 401, '无 jti 旧 token 一次性使用，防止长期重放');
});

test('封禁用户刷新 401', async () => {
  const reg = await register('13990001005');
  mem.user.update({ where: { id: reg.user.id }, data: { banned: true } });
  const r = await post('/api/auth/refresh', { refreshToken: reg.refreshToken });
  assert.strictEqual(r.status, 401);
});
