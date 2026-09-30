/**
 * v2.214 自助修改密码（O 轮）：POST /api/auth/change-password
 * 填补功能缺口 —— 此前用户改密码只能找管理员（admin reset）。
 * 契约：登录态必需；当前密码错误 400；新密码过统一强度策略（v2.212）；无密码账号（纯 oauth）400；
 * 成功后旧密码立即失效（重哈希落库），前端负责清会话重新登录。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16'; // ≥16 位：直跑不触发生产密钥 fail-fast
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess } = require('../dist/lib/auth.js');

const mem = createMemoryPrisma();
mem._seedUser({ id: 'uo', phone: '13800002222', nickname: '第三方账号' }); // 无 passwordHash：纯 oauth 形态
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
const login = async (phone, password) => (await req('POST', '/api/auth/login', null, { phone, password }));

let tok; // u1 的登录令牌
test('准备：注册带密码账号并登录', async () => {
  assert.strictEqual((await req('POST', '/api/auth/register', null, { phone: '13800001111', password: 'oldpass123' })).status, 200);
  const r = await login('13800001111', 'oldpass123');
  assert.strictEqual(r.status, 200);
  tok = r.json.accessToken;
});

test('未登录 401；当前密码错误 400；新密码弱口令 400', async () => {
  assert.strictEqual((await req('POST', '/api/auth/change-password', null, { currentPassword: 'oldpass123', newPassword: 'newpass456' })).status, 401);

  const wrong = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'wrongpass9', newPassword: 'newpass456' });
  assert.strictEqual(wrong.status, 400);
  assert.ok(/当前密码/.test(wrong.json.error), `应提示当前密码错误，实际：${wrong.json.error}`);

  const weak = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'oldpass123', newPassword: '12345678' });
  assert.strictEqual(weak.status, 400);
  assert.ok(/弱口令/.test(weak.json.error), `应复用统一密码策略提示，实际：${weak.json.error}`);

  const short = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'oldpass123', newPassword: 'ab12' });
  assert.strictEqual(short.status, 400, '新密码不足 8 位必须 400');
});

test('成功修改：旧密码立即失效，新密码可登录', async () => {
  const ok = await req('POST', '/api/auth/change-password', tok, { currentPassword: 'oldpass123', newPassword: 'newpass456' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.json.ok, true);
  assert.strictEqual((await login('13800001111', 'oldpass123')).status, 401, '旧密码必须立即失效');
  assert.strictEqual((await login('13800001111', 'newpass456')).status, 200, '新密码可登录');
});

test('无密码账号（纯第三方登录）改密 400 不哈希空值', async () => {
  const r = await req('POST', '/api/auth/change-password', signAccess({ sub: 'uo', level: 'FREE' }),
    { currentPassword: 'irrelevant', newPassword: 'whatever12' });
  assert.strictEqual(r.status, 400);
  assert.ok(/未设置密码/.test(r.json.error), `应提示账号未设置密码，实际：${r.json.error}`);
  assert.strictEqual(mem._users.get('uo').passwordHash, null, '绝不给 oauth 账号落密码哈希');
});
