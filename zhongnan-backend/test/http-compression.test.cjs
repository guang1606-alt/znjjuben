/**
 * v2.264.0 静态资源/API 响应 gzip 压缩（HTTP 层端到端）：
 * 背景 —— web/ 静态资源 ~1.1MB（app.js 658KB / styles.css 150KB / index.html 97KB / i18n.js 62KB），
 * express.static 与 sendFile 直出无任何压缩中间件，首屏传输量是 gzip 后的 3~4 倍。
 * 新行为 —— 全局 compression 中间件：
 *   ① JS/CSS/HTML 与 >1KB 的 JSON 响应在客户端声明 Accept-Encoding: gzip 时压缩，带 Vary: Accept-Encoding；
 *   ② SSE（text/event-stream）显式排除——压缩缓冲会破坏逐帧推送，生成进度必须逐帧到达；
 *   ③ 未声明 Accept-Encoding 的客户端拿到原始未压缩响应（向后兼容）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
process.env.JWT_ACCESS_SECRET = 'http-test-secret';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh';
const express = require('express');
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 注入扩展路由：一个 >1KB 的大 JSON（验证 API 压缩），一个 SSE 流（验证排除）
const extra = express.Router();
extra.get('/_test/big-json', (_req, res) => res.json({ blob: 'x'.repeat(4096) }));
extra.get('/_test/sse', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.write('data: one\n\n');
  setTimeout(() => { res.write('data: two\n\n'); res.end(); }, 80);
});

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) }, extra);
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

const gunzip = (buf) => zlib.gunzipSync(buf).toString('utf8');
// 必须用 node:http 原生请求：undici fetch 会自动追加 Accept-Encoding 并自动解压，
// 既测不到「未声明不压缩」，也拿不到线上真实传输字节。
const fetchRaw = (p, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request(base + p, { headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({
      status: res.statusCode,
      enc: res.headers['content-encoding'] || '',
      vary: res.headers['vary'] || '',
      buf: Buffer.concat(chunks),
    }));
  });
  req.on('error', reject);
  req.end();
});

test('① 静态 JS（app.js 658KB）gzip：Content-Encoding+Vary，解压与磁盘一致，传输字节显著下降', async () => {
  const r = await fetchRaw('/app.js', { 'Accept-Encoding': 'gzip' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.enc, 'gzip', 'app.js 应 gzip 压缩');
  assert.ok(/Accept-Encoding/i.test(r.vary), '必须带 Vary: Accept-Encoding（缓存正确性）');
  const disk = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
  assert.strictEqual(gunzip(r.buf), disk, '解压后内容必须与磁盘文件一致');
  assert.ok(r.buf.length < disk.length * 0.5, `压缩率应 >50%（原始 ${disk.length}，传输 ${r.buf.length}）`);
});

test('② 浏览器导航 /（index.html 97KB）gzip：解压含 <!DOCTYPE html', async () => {
  const r = await fetchRaw('/', { 'Accept-Encoding': 'gzip', Accept: 'text/html' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.enc, 'gzip', 'index.html 应 gzip 压缩');
  assert.ok(gunzip(r.buf).includes('<!DOCTYPE html'));
});

test('③ >1KB JSON 响应 gzip：解压 JSON 正确', async () => {
  const r = await fetchRaw('/_test/big-json', { 'Accept-Encoding': 'gzip' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.enc, 'gzip', '大 JSON 应压缩');
  assert.strictEqual(JSON.parse(gunzip(r.buf)).blob.length, 4096);
});

test('④ SSE 流显式排除：无 Content-Encoding，且首帧在连接关闭前到达（流式不被缓冲）', async () => {
  const res = await fetch(base + '/_test/sse', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-encoding'), null, 'SSE 绝不可压缩（缓冲会破坏逐帧推送）');
  const reader = res.body.getReader();
  const first = await reader.read();
  assert.strictEqual(first.done, false, '首帧必须在连接关闭前到达（若被压缩缓冲，首 read 即 done 或一次性到底）');
  assert.ok(Buffer.from(first.value).toString('utf8').includes('data: one'));
  await reader.cancel().catch(() => {});
});

test('⑤ 未声明 Accept-Encoding：原始未压缩响应（向后兼容）', async () => {
  const r = await fetchRaw('/app.js');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.enc, '', '无 Accept-Encoding 不得压缩');
  const disk = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
  assert.strictEqual(r.buf.toString('utf8'), disk);
});
