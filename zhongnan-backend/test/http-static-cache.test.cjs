/**
 * v2.265.0 静态资源短缓存 + ETag 条件请求（HTTP 层端到端）：
 * 背景 —— express.static 此前无 maxAge，每次访问全量回源 web/ ~1.1MB（app.js 658KB 等），
 * 304 条件请求可让重复访问零传输。零构建站点无指纹，故用「短缓存 + ETag」折中：
 *   ① JS/CSS：Cache-Control: public, max-age=300（5 分钟短缓存，平衡省流量与版本更新时效）；
 *   ② index.html：Cache-Control: no-cache（必须每次回源验证，防版本失配后入口 HTML 被缓存）；
 *   ③ 命中缓存时 304 Not Modified 零字节回包（ETag 条件请求）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
process.env.JWT_ACCESS_SECRET = 'http-cache-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-cache-test-refresh';
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

// 静态缓存头检查与 gzip 无关，但仍用 node:http 原生请求保证行为可预测（见 http-compression.test.cjs 踩坑）
const fetchRaw = (p, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request(base + p, { headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({
      status: res.statusCode,
      cacheControl: res.headers['cache-control'] || '',
      etag: res.headers['etag'] || '',
      bodyLen: Buffer.concat(chunks).length,
    }));
  });
  req.on('error', reject);
  req.end();
});

test('① 静态 JS（app.js）：Cache-Control 短缓存 + ETag 存在', async () => {
  const r = await fetchRaw('/app.js');
  assert.strictEqual(r.status, 200);
  assert.match(r.cacheControl, /max-age=300/, 'JS 应有 5 分钟短缓存');
  assert.match(r.cacheControl, /public/, 'JS 应可被共享缓存');
  assert.ok(r.etag.length > 0, 'JS 必须有 ETag（条件请求前提）');
});

test('② 静态 CSS（styles.css）：同 JS 短缓存策略', async () => {
  const r = await fetchRaw('/styles.css');
  assert.strictEqual(r.status, 200);
  assert.match(r.cacheControl, /max-age=300/, 'CSS 应有 5 分钟短缓存');
  assert.ok(r.etag.length > 0, 'CSS 必须有 ETag');
});

test('③ index.html：Cache-Control no-cache（必须每次回源验证，防版本失配）', async () => {
  const r = await fetchRaw('/', { Accept: 'text/html' });
  assert.strictEqual(r.status, 200);
  assert.match(r.cacheControl, /no-cache/, 'index.html 必须 no-cache（入口版本正确性优先）');
  assert.ok(!/max-age=\d{3,}/.test(r.cacheControl), 'index.html 不得有分钟级以上 max-age');
});

test('④ ETag 条件请求命中：If-None-Match → 304 零字节回包（省流量核心）', async () => {
  const first = await fetchRaw('/app.js');
  assert.strictEqual(first.status, 200);
  const second = await fetchRaw('/app.js', { 'If-None-Match': first.etag });
  assert.strictEqual(second.status, 304, 'ETag 未变时应 304 零字节回包');
  assert.strictEqual(second.bodyLen, 0, '304 回包体必须为 0 字节（全量回源的对立面）');
});
