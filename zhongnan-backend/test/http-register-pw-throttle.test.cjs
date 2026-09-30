/**
 * v2.217 注册与改密暴力防护（HTTP 层端到端）：
 * 1. 注册限流——同 IP 15 分钟窗口内成功注册达 5 个即 429（成功才计数：失败探测无收益，刷邀请积分必须成功注册）
 * 2. 改密节流——当前密码验证失败 5 次即 429 锁定（防持有 access token 的攻击者暴力猜当前密码）；
 *    成功改密清零。窗口滑动/解锁语义复用 login-throttle（纯函数已在 http-security-headers 测过，不重复）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 两个独立 app 实例：注册限流与改密节流互不共享计数（throttle 在 createAuthRouter 内，每实例独立）
const regApp = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
const pwApp = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
const regServer = regApp.listen(0);
const pwServer = pwApp.listen(0);
test.before(() => new Promise((res) => {
  let n = 0;
  const done = () => { n += 1; if (n === 2) res(); };
  regServer.once('listening', done);
  pwServer.once('listening', done);
}));
test.after(async () => {
  regServer.closeAllConnections?.();
  pwServer.closeAllConnections?.();
  await Promise.all([regServer, pwServer].map((s) => new Promise((r) => s.close(r))));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const post = (server, p, body, token) => fetch(`http://127.0.0.1:${server.address().port}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

test('注册限流：弱口令失败不计数——4 次 400 后仍可正常注册', async () => {
  for (let i = 0; i < 4; i++) {
    const r = await post(regServer, '/api/auth/register', { phone: `1390000000${i + 1}`, password: 'short' });
    assert.strictEqual(r.status, 400, `第 ${i + 1} 次弱口令应 400`);
  }
  const ok = await post(regServer, '/api/auth/register', { phone: '13900000005', password: 'password123' });
  assert.strictEqual(ok.status, 200, '失败尝试不计入注册限流');
});

test('注册限流：同 IP 成功注册 5 个后第 6 个被 429 锁定（防批量刷邀请积分）', async () => {
  for (let i = 0; i < 4; i++) {
    const r = await post(regServer, '/api/auth/register', { phone: `1390000001${i + 1}`, password: 'password123' });
    assert.strictEqual(r.status, 200, `第 ${i + 2} 个成功注册不应被限`);
  }
  const locked = await post(regServer, '/api/auth/register', { phone: '13900000020', password: 'password123' });
  assert.strictEqual(locked.status, 429, '同 IP 第 6 个成功注册必须 429');
  assert.strictEqual((await locked.json()).error, '注册过于频繁，请稍后再试');
});

test('改密节流：当前密码连续错 5 次后第 6 次即使密码正确也 429 锁定', async () => {
  const reg = await (await post(pwServer, '/api/auth/register', { phone: '13700004567', password: 'oldpass123' })).json();
  const tok = reg.accessToken;
  for (let i = 0; i < 5; i++) {
    const r = await post(pwServer, '/api/auth/change-password', { currentPassword: 'wrongpass9', newPassword: 'newpass456' }, tok);
    const j = await r.json();
    assert.strictEqual(r.status, 400, `第 ${i + 1} 次当前密码错误应仍为 400`);
    assert.ok(/当前密码/.test(j.error), `应提示当前密码错误，实际：${JSON.stringify(j)}`);
  }
  const locked = await post(pwServer, '/api/auth/change-password', { currentPassword: 'oldpass123', newPassword: 'newpass456' }, tok);
  assert.strictEqual(locked.status, 429, '5 次失败后锁定：正确密码也不放行');
  assert.strictEqual((await locked.json()).error, '尝试过于频繁，请稍后再试');
});
