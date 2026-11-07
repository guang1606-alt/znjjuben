/**
 * v2.459 HTTP 层实证：pv 守卫真的接在 /api 上，且资料接口不再豁免。
 *
 * 与 banned-guard-pv.test.cjs（纯函数单测）互补——这里走真实 Express 应用 + 内存 Prisma：
 * 1) 令牌 pv 与库中一致时 /api/auth/me 正常 200；无 pv 的历史令牌兼容放行；
 * 2) 本机改密走完整 API：改密后**立刻**用新令牌请求 /me 必须 200——守卫缓存须被改密主动失效，
 *    否则客户端会撞上旧 pv 缓存被判 SESSION_REVOKED、清会话跳登录（v2.457 修掉的回归）；
 * 3) 同一时刻旧 access token 必须立刻 401 SESSION_REVOKED（不必等 15 分钟 access TTL）；
 * 4) 密码在别处被改（这里直接改库模拟管理员重置）后，旧 access token 也在下次请求即 401；
 * 5) PATCH /profile 与 GET /me 同口径（不是只守一个端点）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess, passwordVersion } = require('../dist/lib/auth.js');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem) }, undefined, { prisma: mem });
const server = app.listen(0);
test.before(() => new Promise((r) => server.once('listening', r)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const req = async (method, path, token, body) => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
};

async function registerAndLogin(phone, password) {
  const reg = await req('POST', '/api/auth/register', null, { phone, password });
  assert.strictEqual(reg.status, 200, `注册应 200，实际 ${reg.status} ${JSON.stringify(reg.json)}`);
  const r = await req('POST', '/api/auth/login', null, { phone, password });
  assert.strictEqual(r.status, 200);
  return { access: r.json.accessToken, refresh: r.json.refreshToken, userId: r.json.user.id };
}

test('密码未变：带 pv 的 access token 调 /api/auth/me 200；无 pv 历史令牌兼容放行', async () => {
  const a = await registerAndLogin('13800004590', 'oldpass123');
  const ok = await req('GET', '/api/auth/me', a.access);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.json.phone, '138****4590');

  const legacy = signAccess({ sub: a.userId, level: 'FREE' });
  assert.strictEqual((await req('GET', '/api/auth/me', legacy)).status, 200);
});

test('本机改密：新令牌立刻可用（缓存被主动失效），旧 access token 立刻 401', async () => {
  const b = await registerAndLogin('13800004591', 'oldpass123');
  // 先请求一次 /me，确保守卫已为该用户缓存旧 pv（模拟真实用户页面停留）
  assert.strictEqual((await req('GET', '/api/auth/me', b.access)).status, 200);

  const chg = await req('POST', '/api/auth/change-password', b.access, { currentPassword: 'oldpass123', newPassword: 'newpass123' });
  assert.strictEqual(chg.status, 200, `改密应 200，实际 ${chg.status} ${JSON.stringify(chg.json)}`);
  assert.ok(chg.json.accessToken && chg.json.refreshToken, '改密应下发新令牌');

  const fresh = await req('GET', '/api/auth/me', chg.json.accessToken);
  assert.strictEqual(fresh.status, 200, '改密后新令牌必须立刻可用（否则用户被自己的改密踢下线）');

  const stale = await req('GET', '/api/auth/me', b.access);
  assert.strictEqual(stale.status, 401);
  assert.strictEqual(stale.json.error, 'SESSION_REVOKED');
});

test('密码在别处被改（管理员重置）：旧 access token 立刻 401，写接口同口径', async () => {
  const c = await registerAndLogin('13800004592', 'oldpass123');
  const before = mem._users.get(c.userId);
  const newHash = 'hash_after_external_reset';
  assert.notStrictEqual(passwordVersion(newHash), passwordVersion(before.passwordHash));
  await mem.user.update({ where: { id: c.userId }, data: { passwordHash: newHash } });

  const r = await req('GET', '/api/auth/me', c.access);
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.json.error, 'SESSION_REVOKED');

  const p = await req('PATCH', '/api/auth/profile', c.access, { nickname: '应被拒' });
  assert.strictEqual(p.status, 401);
  assert.strictEqual(p.json.error, 'SESSION_REVOKED');

  const token = signAccess({ sub: c.userId, level: 'FREE', pv: passwordVersion(newHash) });
  assert.strictEqual((await req('GET', '/api/auth/me', token)).status, 200);
});
