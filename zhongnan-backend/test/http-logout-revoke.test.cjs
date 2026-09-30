const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

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
const login = async (phone) => post('/api/auth/login', { phone, password: 'password123' }).then((r) => r.json());
const register = async (phone) => post('/api/auth/register', { phone, password: 'password123' }).then((r) => r.json());

test('登出即吊销：logout 后原 refreshToken 刷新 401', async () => {
  await register('13980001001');
  const s = await login('13980001001');
  // 登出前可正常刷新
  assert.strictEqual((await post('/api/auth/refresh', { refreshToken: s.refreshToken })).status, 200);
  // 轮换后的新 token 再次登出 → 吊销
  const s2j = await (await post('/api/auth/refresh', { refreshToken: (await post('/api/auth/login', { phone: '13980001001', password: 'password123' })).json().then((j) => j.refreshToken) })).json();
  const r = await post('/api/auth/logout', { refreshToken: s2j.refreshToken });
  assert.strictEqual(r.status, 200);
  const replay = await post('/api/auth/refresh', { refreshToken: s2j.refreshToken });
  assert.strictEqual(replay.status, 401, '登出后的 refresh token 必须被吊销');
});

test('logout 幂等：无效 token / 空 body 均返回 200 且不泄露信息', async () => {
  assert.strictEqual((await post('/api/auth/logout', { refreshToken: 'garbage' })).status, 200);
  assert.strictEqual((await post('/api/auth/logout', {})).status, 200);
  assert.strictEqual((await post('/api/auth/logout', undefined)).status, 200);
});

test('登出后重新登录不受影响', async () => {
  await register('13980001002');
  const s1 = await login('13980001002');
  await post('/api/auth/logout', { refreshToken: s1.refreshToken });
  const s2 = await login('13980001002');
  assert.ok(s2.accessToken && s2.refreshToken, '重新登录应下发全新凭证');
  assert.strictEqual((await post('/api/auth/refresh', { refreshToken: s2.refreshToken })).status, 200);
});
