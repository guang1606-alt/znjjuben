/**
 * v2.213 未知路由 404 统一 JSON 化（N 轮）：
 * 旧行为 —— /api/* 未匹配路由穿透到 Express 默认 404（HTML "Cannot GET"），与 JSON API 契约不一致，
 * 前端 fetch 误删/改名的端点时拿到 HTML，报错语义混乱。
 * 新行为 —— /api/* 一律 JSON {error:'NOT_FOUND'}；非 API 路径：浏览器导航仍回退 SPA 单页，
 * 程序化 fetch（Accept 任意通配）与其余方法回 JSON 404。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16'; // ≥16 位：直跑不触发生产密钥 fail-fast
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
const server = app.listen(0);
test.before(() => new Promise((r) => server.once('listening', r)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const req = async (method, path, accept) => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: accept ? { Accept: accept } : {},
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, type: res.headers.get('content-type') || '', text, json };
};

test('/api 未知路由：GET/POST 均 JSON 404，不再返回 HTML "Cannot GET"', async () => {
  const get = await req('GET', '/api/definitely-not-exist');
  assert.strictEqual(get.status, 404);
  assert.strictEqual(get.json.error, 'NOT_FOUND');
  assert.ok(get.type.includes('application/json'), `应回 JSON，实际 ${get.type}`);

  const post = await req('POST', '/api/generate/definitely-not-exist', 'application/json');
  assert.strictEqual(post.status, 404);
  assert.strictEqual(post.json.error, 'NOT_FOUND');
  assert.ok(!/Cannot GET|<html/i.test(post.text), '不得出现 Express 默认 HTML 404');
});

test('非 API 未知路径：程序化 fetch 仍 404（状态码语义不变），浏览器导航仍回退 SPA 单页', async () => {
  const programmatic = await req('GET', '/not-a-page');
  assert.strictEqual(programmatic.status, 404, '程序化 fetch 未知页面路径状态码仍为 404');

  const browser = await req('GET', '/not-a-page', 'text/html');
  assert.strictEqual(browser.status, 200, 'text/html 导航应回退 index.html（SPA 自行渲染视图）');
});

test('既有行为不受影响：/health 正常、已知 API 正常匹配', async () => {
  assert.strictEqual((await req('GET', '/health')).status, 200);
  const login = await req('POST', '/api/auth/login', 'application/json');
  assert.strictEqual(login.status, 400, '已知端点的参数校验照常工作，未被 404 兜底吞掉');
});
