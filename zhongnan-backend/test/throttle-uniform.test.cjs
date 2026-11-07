/**
 * v2.453 限流口径统一（HTTP 层端到端）：
 * v2.452 只把「登录」的 429 可读化，注册与改密仍回「请稍后再试」——三处限流同一套
 * login-throttle，文案却一半可读一半黑盒，属于同名场景口径漂移。
 * 本用例把「429 必须给真实时长 + Retry-After 头」的契约钉在三处：注册 / 登录 / 改密。
 * （登录的逐次剩余次数已由 test/login-throttle-ux.test.cjs 覆盖，此处不重复。）
 *
 * 注：注册限流按 IP 计数，若与改密用例共用同一 app，注册用例的 5 次成功会先把 IP 锁住、
 * 让后面的注册前置步骤 429；因此两条用例各用独立路由实例（throttle 在 createAuthRouter 内）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

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

function assertThrottledReadable(r, body, label) {
  assert.strictEqual(r.status, 429, `${label}：达到上限必须 429`);
  const ra = r.headers.get('retry-after');
  assert.ok(ra && Number(ra) >= 1, `${label}：必须写 Retry-After 头，实际：${ra}`);
  assert.strictEqual(body.retryAfter, Number(ra), `${label}：body.retryAfter 应与头一致（单一真相）`);
  assert.ok(body.retryAfter >= 890 && body.retryAfter <= 900, `${label}：刚锁定时应接近满窗口 900 秒，实际：${body.retryAfter}`);
  assert.ok(/(秒|分钟)/.test(body.error), `${label}：提示应含具体时长，实际：${JSON.stringify(body.error)}`);
}

test('注册限流 429：给真实时长 + Retry-After 头（不能只说"稍后再试"）', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await post(regServer, '/api/auth/register', { phone: `1350000100${i}`, password: 'password123' });
    assert.strictEqual(r.status, 200, `第 ${i + 1} 个成功注册不应被限`);
  }
  const r = await post(regServer, '/api/auth/register', { phone: '13500001009', password: 'password123' });
  assertThrottledReadable(r, await r.json(), '注册');
});

test('改密限流 429：给真实时长 + Retry-After 头（不能只说"稍后再试"）', async () => {
  const reg = await (await post(pwServer, '/api/auth/register', { phone: '13700009876', password: 'oldpass123' })).json();
  assert.ok(reg.accessToken, '前置注册应返回 accessToken');
  for (let i = 0; i < 5; i++) {
    const r = await post(pwServer, '/api/auth/change-password', { currentPassword: 'wrongpass9', newPassword: 'newpass456' }, reg.accessToken);
    assert.strictEqual(r.status, 400, `第 ${i + 1} 次当前密码错误应仍为 400`);
  }
  const r = await post(pwServer, '/api/auth/change-password', { currentPassword: 'oldpass123', newPassword: 'newpass456' }, reg.accessToken);
  assertThrottledReadable(r, await r.json(), '改密');
});
