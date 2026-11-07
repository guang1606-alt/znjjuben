/**
 * v2.452 登录限流可读化（HTTP 层端到端）：
 * 1. 失败仍 401，但带 attemptsLeft，前端可提示「还可尝试 N 次」——用户不会毫无预警地被锁
 * 2. 达到上限后 429 必须给真实解锁时间：滑动窗口下锁定不一定满 15 分钟，
 *    固定文案「请稍后再试」是名不副实（可能只需等几秒，也可能要等满窗口）
 * 3. 429 同时写 Retry-After 头（HTTP 语义标准，代理/客户端都能直接消费）
 * 4. 计数按 IP+手机号组合，与账号是否存在无关，不引入账号枚举面
 *
 * 注：每个用例用独立手机号自建状态，不依赖前一个用例已累积的失败次数——
 * 用例内断言失败会提前 return，跨用例共享计数会让后续用例变成假红/假绿。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
const server = app.listen(0);
test.before(() => new Promise((res) => server.once('listening', res)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const post = (p, body) => fetch(`http://127.0.0.1:${server.address().port}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function seed(phone) {
  const r = await post('/api/auth/register', { phone, password: 'goodpass123' });
  assert.strictEqual(r.status, 200, `前置注册 ${phone} 应成功`);
}
const failLogin = (phone) => post('/api/auth/login', { phone, password: 'wrongpass9' });

test('前 4 次密码错误：仍 401，attemptsLeft 从 4 递减到 1', async () => {
  const phone = '13600001234';
  await seed(phone);
  const seen = [];
  for (const _ of [1, 2, 3, 4]) {
    const r = await failLogin(phone);
    const j = await r.json();
    assert.strictEqual(r.status, 401, '未达上限仍是 401（不是 429）');
    assert.ok(/还可尝试|上限/.test(j.error), `提示应含剩余次数，实际：${JSON.stringify(j.error)}`);
    seen.push(j.attemptsLeft);
  }
  assert.deepStrictEqual(seen, [4, 3, 2, 1], `剩余次数应递减，实际：${JSON.stringify(seen)}`);
});

test('第 5 次错误：attemptsLeft 归零并明确告知已达上限（不能只说"密码错误"）', async () => {
  const phone = '13600005678';
  await seed(phone);
  let last = null;
  for (const _ of [1, 2, 3, 4, 5]) last = await (await failLogin(phone)).json();
  assert.strictEqual(last.attemptsLeft, 0);
  assert.ok(/上限/.test(last.error), `第 5 次应提示已达上限，实际：${JSON.stringify(last.error)}`);
});

test('锁定后 429：给真实解锁秒数 + Retry-After 头，不能只写"稍后再试"', async () => {
  const phone = '13600009012';
  await seed(phone);
  for (const _ of [1, 2, 3, 4, 5]) await failLogin(phone);
  const r = await post('/api/auth/login', { phone, password: 'goodpass123' });
  const j = await r.json();
  assert.strictEqual(r.status, 429, '即使密码正确也必须拒绝');
  const ra = r.headers.get('retry-after');
  assert.ok(ra && Number(ra) >= 1, `必须写 Retry-After 头，实际：${ra}`);
  assert.strictEqual(j.retryAfter, Number(ra), 'body.retryAfter 应与 Retry-After 头一致（单一真相）');
  assert.ok(j.retryAfter <= 900, `滑动窗口下解锁时间不得超过窗口 900 秒，实际：${j.retryAfter}`);
  // 最早那次失败就发生在几毫秒前，解锁时刻≈满窗口；若实现回固定窗口或 0，这条会咬红
  assert.ok(j.retryAfter >= 890, `刚锁定时应接近满窗口 900 秒，实际：${j.retryAfter}`);
  assert.ok(/(秒|分钟)/.test(j.error), `提示应含具体时长，实际：${JSON.stringify(j.error)}`);
});

test('滑动窗口语义：解锁时刻按"最早失败滑出窗口"算，不是固定满窗口', () => {
  const { createLoginThrottle } = require('../dist/lib/login-throttle.js');
  let clock = 0;
  const th = createLoginThrottle({ maxFailures: 2, windowMs: 1000, now: () => clock });
  clock = 0; th.recordFailure('k');
  clock = 100; th.recordFailure('k');
  assert.strictEqual(th.isLocked('k'), true);
  clock = 150;
  // 最早失败(t=0)滑出窗口即解锁 → t=1000-150=850ms
  assert.strictEqual(th.retryAfterMs('k'), 850, '应按最早失败算真实解锁时刻');
  clock = 1000;
  assert.strictEqual(th.retryAfterMs('k'), 0, '最早失败滑出后即解锁');
  assert.strictEqual(th.isLocked('k'), false);
  assert.strictEqual(th.remaining('k'), 1, '滑出一条后剩 1 次机会');
});
