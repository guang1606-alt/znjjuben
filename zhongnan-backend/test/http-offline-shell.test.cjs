/**
 * v2.448.0 离线壳静态资源契约（HTTP 层）：
 * Service Worker 脚本必须可被浏览器按「每次回源」获取——若沿用其它 .js 的 5 分钟短缓存，
 * 发版后 SW 更新会被拖住，用户装着旧壳继续跑旧逻辑（与 v2.447 同族的失败模式）。
 * 另：sw.js 不属于页面脚本，不能被入口版本化改写、也不该在 index.html 里出现。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
process.env.JWT_ACCESS_SECRET = 'http-offline-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-offline-test-refresh';
const express = require('express');
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) }, express.Router());
const server = app.listen(0);
let base;
test.before(() => new Promise((r) => server.once('listening', () => {
  base = `http://127.0.0.1:${server.address().port}`;
  r();
})));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const fetchRaw = (p, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request(base + p, { headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({
      status: res.statusCode,
      cacheControl: res.headers['cache-control'] || '',
      contentType: res.headers['content-type'] || '',
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
  req.on('error', reject);
  req.end();
});

test('① /sw.js 可访问且 no-cache（SW 更新不得被短缓存拖住）', async () => {
  const r = await fetchRaw('/sw.js');
  assert.strictEqual(r.status, 200, '/sw.js 必须能直接取到');
  assert.match(r.contentType, /javascript/, 'Content-Type 应为 javascript');
  assert.match(r.cacheControl, /no-cache/, '/sw.js 必须每次回源验证');
  assert.ok(!/max-age=\d{3,}/.test(r.cacheControl), '/sw.js 不得带分钟级 max-age');
  assert.match(r.body, /addEventListener\('fetch'/, '返回的必须是真实 SW 脚本');
});

test('② /sw.js?v=<version> 与裸路径等价（注册时带版本查询不 404）', async () => {
  const plain = await fetchRaw('/sw.js');
  const versioned = await fetchRaw('/sw.js?v=2.448.0');
  assert.strictEqual(versioned.status, 200);
  assert.strictEqual(versioned.body.length, plain.body.length);
});

test('③ index.html 不引用 sw.js（SW 由 app.js 注册，不能当普通脚本版本化）', async () => {
  const r = await fetchRaw('/', { Accept: 'text/html' });
  assert.strictEqual(r.status, 200);
  assert.ok(!/sw\.js/.test(r.body), '入口 HTML 不应出现 sw.js 引用');
});
