/**
 * v2.212 密码策略落地（M 轮）：passwordStrength 从死代码变为三入口统一守门。
 * 覆盖：公开注册、超管开设账号、超管重置密码 —— 弱口令黑名单 / 必须字母+数字 / 长度下限；
 * 修复 admin 重置密码 min(6) 与注册 min(8) 的不一致。登录不校验强度（存量用户不受影响）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16'; // ≥16 位：直跑（不经 run-tests 包装设 NODE_ENV=test）也不会触发生产密钥 fail-fast
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createAdminRouter } = require('../dist/routes/admin.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess, verifyPassword } = require('../dist/lib/auth.js');

const mem = createMemoryPrisma();
mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
mem._seedUser({ id: 'u1', level: 'BASIC', balance: 100, nickname: '张三' });
const app = createApp({ auth: createAuthRouter(mem), admin: createAdminRouter(mem) });
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
const adminTok = signAccess({ sub: 'admin', level: 'FREE' });

test('公开注册：弱口令/纯字母/纯数字全部 400，合法密码通过', async () => {
  const weak = await req('POST', '/api/auth/register', null, { phone: '13800001001', password: '12345678' });
  assert.strictEqual(weak.status, 400);
  assert.ok(/弱口令/.test(weak.json.error), `应提示弱口令，实际：${weak.json.error}`);

  const letters = await req('POST', '/api/auth/register', null, { phone: '13800001002', password: 'abcdefgh' });
  assert.strictEqual(letters.status, 400);
  assert.ok(/数字/.test(letters.json.error), `应提示需包含数字，实际：${letters.json.error}`);

  const digits = await req('POST', '/api/auth/register', null, { phone: '13800001003', password: '1234567890' });
  assert.strictEqual(digits.status, 400);
  assert.ok(/字母/.test(digits.json.error), `应提示需包含字母，实际：${digits.json.error}`);

  const ok = await req('POST', '/api/auth/register', null, { phone: '13800001004', password: 'abcd1234' });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.json.accessToken);
});

test('超管开设账号：初始密码同样过强度策略', async () => {
  const weak = await req('POST', '/api/admin/users', adminTok, {
    phone: '13800002001', initialPassword: '11111111', level: 'BASIC',
  });
  assert.strictEqual(weak.status, 400, '黑名单纯数字初始密码必须 400');

  const ok = await req('POST', '/api/admin/users', adminTok, {
    phone: '13800002002', initialPassword: 'staff2026', level: 'BASIC', nickname: '编剧乙',
  });
  assert.strictEqual(ok.status, 200);
  assert.ok(await verifyPassword(mem._users.get(ok.json.id).passwordHash, 'staff2026'));
});

test('超管重置密码：min(6) 修复为统一策略，黑名单拒绝，合法可登录验证', async () => {
  const short = await req('POST', '/api/admin/users/u1/reset-password', adminTok, { newPassword: 'abc123' });
  assert.strictEqual(short.status, 400, '6 位密码原规则竟能通过，修复后必须 400');

  const weak = await req('POST', '/api/admin/users/u1/reset-password', adminTok, { newPassword: 'qwerty123' });
  assert.strictEqual(weak.status, 400);
  assert.ok(/弱口令/.test(weak.json.error), `应提示弱口令，实际：${weak.json.error}`);

  const ok = await req('POST', '/api/admin/users/u1/reset-password', adminTok, { newPassword: 'goodpass88' });
  assert.strictEqual(ok.status, 200);
  assert.ok(await verifyPassword(mem._users.get('u1').passwordHash, 'goodpass88'), '重置后新哈希可验证');
});
