/**
 * v2.458 改密后旧 refresh token 立即失效（密码版本指纹 pv）。
 *
 * 证伪背景：v2.457 只消费「调用方上报的那一个」refresh token；其他设备手里的 refresh token
 * 仍可用到 TTL（默认 30 天）——改密后丢失的旧设备会话依然能无限续期，这是真实安全缺口。
 * 方案：JWT 载荷带 pv（passwordHash 的 sha256 前 12 位）；/refresh 校验 pv 与库中当前 hash 一致，
 * 不一致即 401 SESSION_REVOKED。密码一变 pv 就变，不需要迁移、不需要每请求查库
 * （access token 仍是 15 分钟短时效，过期后走 refresh 即被拦）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { verifyRefresh, signRefresh } = require('../dist/lib/auth.js');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem) });
const server = app.listen(0);
test.before(() => new Promise((r) => server.once('listening', r)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
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

const login = async (phone, password) => {
  const r = await req('POST', '/api/auth/login', null, { phone, password });
  assert.strictEqual(r.status, 200, `login 失败：${JSON.stringify(r.json)}`);
  return r.json;
};

test('准备：注册两个账号', async () => {
  assert.strictEqual((await req('POST', '/api/auth/register', null, { phone: '13800004441', password: 'oldpass123' })).status, 200);
  assert.strictEqual((await req('POST', '/api/auth/register', null, { phone: '13800004442', password: 'oldpass123' })).status, 200);
});

test('① 登录签发的令牌带 pv 指纹（12 位十六进制）', async () => {
  const t = await login('13800004441', 'oldpass123');
  const pv = verifyRefresh(t.refreshToken).pv;
  assert.strictEqual(typeof pv, 'string');
  assert.match(pv, /^[0-9a-f]{12}$/, 'pv 必须是 passwordHash 的 12 位摘要');
});

test('② 改密后，未被上报的旧 refresh token 也不能再续期（其他设备被踢）', async () => {
  const a = await login('13800004442', 'oldpass123');
  const changed = await req('POST', '/api/auth/change-password', a.accessToken,
    { currentPassword: 'oldpass123', newPassword: 'newpass456' }); // 刻意不上报 refreshToken
  assert.strictEqual(changed.status, 200);
  const replay = await req('POST', '/api/auth/refresh', null, { refreshToken: a.refreshToken });
  assert.strictEqual(replay.status, 401, '改密后旧 refresh token 必须失效，否则 30 天有效期内会话无法收回');
  assert.strictEqual(replay.json.error, 'SESSION_REVOKED');
});

test('③ 改密后新 refresh token 正常续期，且 pv 与旧值不同', async () => {
  const a = await login('13800004442', 'newpass456');
  const changed = await req('POST', '/api/auth/change-password', a.accessToken,
    { currentPassword: 'newpass456', newPassword: 'newpass789', refreshToken: a.refreshToken });
  assert.strictEqual(changed.status, 200);
  assert.notStrictEqual(verifyRefresh(changed.json.refreshToken).pv, verifyRefresh(a.refreshToken).pv, '改密必须换 pv');
  const ok = await req('POST', '/api/auth/refresh', null, { refreshToken: changed.json.refreshToken });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.json.accessToken);
});

test('④ 旧版无 pv 的令牌仍可续期（上线兼容，不误踢存量会话）', async () => {
  const legacy = signRefresh({ sub: (await login('13800004441', 'oldpass123')).user.id, level: 'FREE' });
  const r = await req('POST', '/api/auth/refresh', null, { refreshToken: legacy });
  assert.strictEqual(r.status, 200, '无 pv 的历史令牌不能因为升级而被判失效');
});

test('⑤ 改密失败（当前密码错）不得吊销旧 refresh token', async () => {
  const a = await login('13800004441', 'oldpass123');
  const bad = await req('POST', '/api/auth/change-password', a.accessToken,
    { currentPassword: 'wrongpass9', newPassword: 'newpass111' });
  assert.strictEqual(bad.status, 400);
  const r = await req('POST', '/api/auth/refresh', null, { refreshToken: a.refreshToken });
  assert.strictEqual(r.status, 200, '失败的改密不能产生副作用');
});
