/**
 * v2.457 改密成功不再强制登出：服务端签发新令牌 + 吊销调用方旧 refresh token。
 *
 * 证伪背景：v2.214 改密成功后前端 Api.clearSession() + 1s 后弹登录框，用户被迫重输刚设置的新密码；
 * 而服务端只更新 passwordHash，并未吊销任何令牌——本地清会话是单方面行为，旧 refresh token 在服务端仍可续期。
 * 本轮把「改密 = 换凭据」做正：成功即下发新 access/refresh，客户端原地替换；调用方上报的旧 refresh token
 * 一次性消费（防被窃后继续续期），其他设备的存量 refresh token 仍需 TTL 自然过期（无 token 版本号机制，见日报取舍）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { verifyAccess, verifyRefresh } = require('../dist/lib/auth.js');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem) });
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

let tok;
let rt;
test('准备：注册并登录，拿到 access/refresh', async () => {
  assert.strictEqual((await req('POST', '/api/auth/register', null, { phone: '13800003333', password: 'oldpass123' })).status, 200);
  const r = await req('POST', '/api/auth/login', null, { phone: '13800003333', password: 'oldpass123' });
  assert.strictEqual(r.status, 200);
  tok = r.json.accessToken;
  rt = r.json.refreshToken;
});

test('① 当前密码错误时不得下发任何令牌（失败路径不泄凭据）', async () => {
  const bad = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'wrongpass9', newPassword: 'newpass456' });
  assert.strictEqual(bad.status, 400);
  assert.ok(!bad.json.accessToken, '失败响应绝不能带 accessToken');
  assert.ok(!bad.json.refreshToken, '失败响应绝不能带 refreshToken');
});

test('② 改密成功即换凭据：返回新 access/refresh，本机无需重新登录', async () => {
  const ok = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'oldpass123', newPassword: 'newpass456', refreshToken: rt });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.json.ok, true);
  assert.ok(ok.json.accessToken, '成功必须返回新 accessToken，客户端才能保持登录态');
  assert.ok(ok.json.refreshToken, '成功必须返回新 refreshToken（轮换，不复用旧值）');
  assert.notStrictEqual(ok.json.refreshToken, rt, '新 refresh token 不得与旧值相同');
  const payload = verifyAccess(ok.json.accessToken);
  assert.ok(payload.sub, '新 access token 必须能验签并带 sub');
  assert.ok(verifyRefresh(ok.json.refreshToken).jti, '新 refresh token 必须是带 jti 的轮换形态');
});

test('③ 调用方上报的旧 refresh token 被一次性消费，不能继续续期', async () => {
  const replay = await req('POST', '/api/auth/refresh', null, { refreshToken: rt });
  assert.strictEqual(replay.status, 401, '旧 refresh token 改密后必须失效');
  assert.strictEqual(replay.json.error, 'REFRESH_REUSED');
});

test('④ 新 refresh token 可正常续期（会话延续，不是把用户踢下线）', async () => {
  const login = await req('POST', '/api/auth/login', null, { phone: '13800003333', password: 'newpass456' });
  assert.strictEqual(login.status, 200);
  const ok = await req('POST', '/api/auth/change-password', login.json.accessToken,
    { currentPassword: 'newpass456', newPassword: 'newpass789', refreshToken: login.json.refreshToken });
  assert.strictEqual(ok.status, 200);
  const refreshed = await req('POST', '/api/auth/refresh', null, { refreshToken: ok.json.refreshToken });
  assert.strictEqual(refreshed.status, 200, '新 refresh token 必须可用');
  assert.ok(refreshed.json.accessToken);
});

test('⑤ 旧客户端不上报 refreshToken 仍拿到新令牌（向后兼容）', async () => {
  const login = await req('POST', '/api/auth/login', null, { phone: '13800003333', password: 'newpass789' });
  assert.strictEqual(login.status, 200);
  const ok = await req('POST', '/api/auth/change-password', login.json.accessToken,
    { currentPassword: 'newpass789', newPassword: 'newpass999' });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.json.accessToken, '未上报 refreshToken 也必须返回新 accessToken');
  assert.ok(ok.json.refreshToken, '未上报 refreshToken 也必须返回新 refreshToken');
});
