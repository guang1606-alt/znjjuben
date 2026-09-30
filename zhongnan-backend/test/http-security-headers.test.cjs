/**
 * v2.208 安全加固（HTTP 层端到端）：
 * 1. 安全响应头中间件——所有响应携带 nosniff/DENY/Referrer-Policy/Permissions-Policy，/api 追加 no-store
 * 2. 登录失败限流——同 IP+手机号 15 分钟窗口内累计 5 次失败即 429 锁定；成功登录清零；不同手机号互不影响
 *
 * v2.236 CSP 上线（先红后绿）：
 * 背景：v2.208 注释「不设 CSP：web 端大量内联样式」仅覆盖 style 维度，把 script 维度也一并放弃了。
 * 本轮勘察实证：web/ 全部 13 个 JS 0 处 eval/new Function、0 处内联事件处理器，index.html 0 内联
 * <script>/<style>/onclick（156 处内联 style= 属性仅存于 style 维度），无 @font-face/<form>/<base>，
 * 脚本与样式全部同源 ./xxx.js/css——script-src 'self'（不含 unsafe-inline）可直接强制，注入型 XSS
 * 的内联脚本执行面被真正封死（unsafe-inline 只留在 style-src，不殃及 script）。
 * 策略：仅非 /api 响应携带 CSP（文档与静态资产；JSON API 无需文档策略、避免噪音），值为：
 *   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
 *   img-src 'self' data: https: blob:; connect-src 'self'; font-src 'self';
 *   object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
 * （img-src 放行 https: 供广告位用户图、data: 供 CSS 内联 SVG 噪点底纹、blob: 供本地下载预览。）
 */
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createLoginThrottle } = require('../dist/lib/login-throttle.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
// 独立实例专测限流，避免与安全头断言互相干扰
const throttleApp = createApp({ auth: createAuthRouter(createMemoryPrisma()) });

let base;
const server = app.listen(0);
let throttleBase;
const throttleServer = throttleApp.listen(0);
test.before(() => new Promise((res) => {
  let n = 0;
  const done = () => { n += 1; if (n === 2) res(); };
  server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
  throttleServer.once('listening', () => { throttleBase = `http://127.0.0.1:${throttleServer.address().port}`; done(); });
}));
test.after(async () => {
  server.closeAllConnections?.();
  throttleServer.closeAllConnections?.();
  await Promise.all([new Promise((res) => server.close(res)), new Promise((res) => throttleServer.close(res))]);
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const post = (origin, p, body) => fetch(origin + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('安全响应头：健康检查与登录接口均携带 nosniff/DENY/Referrer-Policy/Permissions-Policy', async () => {
  for (const url of [`${base}/health`, `${base}/api/auth/login`]) {
    const r = await fetch(url, url.endsWith('/login')
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: 'x', password: 'y' }) }
      : {});
    assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff', `${url} 缺 nosniff`);
    assert.strictEqual(r.headers.get('x-frame-options'), 'DENY', `${url} 缺 DENY`);
    assert.strictEqual(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', `${url} 缺 Referrer-Policy`);
    assert.strictEqual(r.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()', `${url} 缺 Permissions-Policy`);
  }
});

test('安全响应头：/api 响应携带 Cache-Control: no-store，静态与健康检查不受影响', async () => {
  const api = await post(base, '/api/auth/login', { phone: 'x', password: 'y' });
  assert.strictEqual(api.headers.get('cache-control'), 'no-store');
  const health = await fetch(`${base}/health`);
  assert.notStrictEqual(health.headers.get('cache-control'), 'no-store');
});

// v2.236 CSP：预期策略全文（改策略必须同步改这里与 app.ts 注释，防止静默放松）
const EXPECTED_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
  + 'img-src \'self\' data: https: blob:; connect-src \'self\'; font-src \'self\'; '
  + "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

test('安全响应头：SPA 导航与静态资源携带 CSP，script-src 不含 unsafe-inline', async () => {
  // 浏览器导航（Accept: text/html → 回退 index.html）与同源静态资产
  const nav = await fetch(`${base}/`, { headers: { Accept: 'text/html' } });
  assert.match(await nav.text(), /<html/, '导航应回退到 index.html');
  assert.strictEqual(nav.headers.get('content-security-policy'), EXPECTED_CSP, '导航响应 CSP 不符');
  const css = await fetch(`${base}/styles.css`);
  assert.strictEqual(css.headers.get('content-security-policy'), EXPECTED_CSP, '静态资源 CSP 不符');
  // script-src 明确不含 unsafe-inline（注入型 XSS 的内联脚本执行面必须封死）
  const scriptSrc = EXPECTED_CSP.match(/script-src ([^;]+)/)[1];
  assert.ok(!scriptSrc.includes('unsafe-inline'), 'script-src 不得放行 unsafe-inline');
  assert.ok(EXPECTED_CSP.includes("object-src 'none'"), 'object/embed 必须整体禁用');
  assert.ok(EXPECTED_CSP.includes("frame-ancestors 'none'"), 'frame-ancestors 与 X-Frame-Options:DENY 对齐');
});

test('安全响应头：/api JSON 响应不携带 CSP（文档策略不污染 API），/health 非 API 按规则携带', async () => {
  const api = await post(base, '/api/auth/login', { phone: 'x', password: 'y' });
  assert.strictEqual(api.headers.get('content-security-policy'), null, '/api 不应携带 CSP');
  const nf = await fetch(`${base}/api/no-such-route`);
  assert.strictEqual(nf.headers.get('content-security-policy'), null, '/api 404 不应携带 CSP');
  const health = await fetch(`${base}/health`);
  assert.strictEqual(health.headers.get('content-security-policy'), EXPECTED_CSP, '/health 非 /api 路径应携带 CSP');
});

test('登录限流：同手机号连续 5 次失败后第 6 次被 429 锁定', async () => {
  const phone = '13500009999', password = 'wrong-password';
  for (let i = 0; i < 5; i++) {
    assert.strictEqual((await post(throttleBase, '/api/auth/login', { phone, password })).status, 401, `第 ${i + 1} 次失败应仍为 401`);
  }
  const locked = await post(throttleBase, '/api/auth/login', { phone, password });
  assert.strictEqual(locked.status, 429);
  assert.strictEqual((await locked.json()).error, '尝试过于频繁，请稍后再试');
});

test('登录限流：不同手机号不受同一 IP 上他人锁定影响', async () => {
  const r = await post(throttleBase, '/api/auth/login', { phone: '13500008888', password: 'wrong-password' });
  assert.strictEqual(r.status, 401);
});

test('登录限流：成功登录清零计数——失败 3 次→正确登录→再失败 4 次仍为 401 而非 429', async () => {
  const phone = '13500007777';
  for (let i = 0; i < 3; i++) await post(throttleBase, '/api/auth/login', { phone, password: 'wrong-password' });
  // 注册真实账号后用正确密码登录（成功即清零）
  const reg = await post(throttleBase, '/api/auth/register', { phone, password: 'password123' });
  assert.strictEqual(reg.status, 200);
  const ok = await post(throttleBase, '/api/auth/login', { phone, password: 'password123' });
  assert.strictEqual(ok.status, 200, '失败 3 次后正确密码仍可登录');
  for (let i = 0; i < 4; i++) {
    assert.strictEqual((await post(throttleBase, '/api/auth/login', { phone, password: 'wrong-password' })).status, 401,
      `清零后第 ${i + 1} 次失败不应触发 429`);
  }
});

test('登录限流纯函数：窗口过期自动解锁、recordFailure 返回窗口内次数、clear 清零', () => {
  let now = 1_000_000;
  const t = createLoginThrottle({ maxFailures: 3, windowMs: 1_000, now: () => now });
  const key = 'ip:13800000000';
  assert.strictEqual(t.isLocked(key), false);
  assert.strictEqual(t.recordFailure(key), 1);
  now += 900;
  assert.strictEqual(t.recordFailure(key), 2);
  assert.strictEqual(t.isLocked(key), false);
  assert.strictEqual(t.recordFailure(key), 3);
  assert.strictEqual(t.isLocked(key), true, '达到上限后锁定');
  now += 1_001; // 最早的失败滑出窗口
  assert.strictEqual(t.isLocked(key), false, '窗口过期自动解锁');
  t.clear(key);
  assert.strictEqual(t.isLocked(key), false);
  // 旧失败过期后新失败重新计数
  now += 2_000;
  assert.strictEqual(t.recordFailure(key), 1, '窗口滑出后重新计数');
});
