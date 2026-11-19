/**
 * v2.559 TOS 模式的「下载原图」闭环。
 * 背景：v2.558 给字节直出分支补了 Content-Disposition，但 TOS 模式的元数据行没有字节，
 * `/media/:id?download=1` 走 302 跳到对象地址——跨域重定向会把 <a download> 的附件语义丢掉，
 * 生产模式下「下载原图」实际只是在新标签打开图片。这里断言服务端在 download=1 时代理本桶对象字节，
 * 并补附件头；非本桶外链与上游异常一律回退 302，避免把站内路由变成任意 URL 代理。
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

let upstream;
let upPort;
let app;
let server;
let base;
let mem;
const savedEnv = {};

before(async () => {
  upstream = http.createServer((req, res) => {
    if (req.url === '/a.png') {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': PNG_BYTES.length });
      res.end(PNG_BYTES);
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('boom');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  upPort = upstream.address().port;
  // isOwnTosObjectUrl 以 `${TOS_BUCKET}.${TOS_ENDPOINT}` 判定「本桶对象」，这里让上游正好等于该 host
  // （'127.0.0' + '.' + '1:<port>' = 127.0.0.1:<port>）
  for (const k of ['TOS_REGION', 'TOS_BUCKET', 'TOS_ENDPOINT', 'TOS_ACCESS_KEY_ID', 'TOS_ACCESS_KEY_SECRET']) savedEnv[k] = process.env[k];
  process.env.TOS_BUCKET = '127.0.0';
  process.env.TOS_ENDPOINT = '1:' + upPort;
  delete process.env.TOS_REGION;
  delete process.env.TOS_ACCESS_KEY_ID;
  delete process.env.TOS_ACCESS_KEY_SECRET;

  const { createApp } = require('../dist/server/app.js');
  const { createMediaRouter } = require('../dist/routes/media.js');
  const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
  mem = createMemoryPrisma();
  app = createApp({ media: createMediaRouter(mem) });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); }));
});

after(async () => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  server?.closeAllConnections?.();
  if (server) await new Promise((r) => server.close(r));
  upstream?.closeAllConnections?.();
  if (upstream) await new Promise((r) => upstream.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

test('TOS 模式 download=1：服务端代理本桶对象字节并补附件头，不带参数仍 302', async () => {
  const obj = `http://127.0.0.1:${upPort}/a.png`;
  const asset = await mem.mediaAsset.create({ data: { kind: 'poster', mime: 'image/png', size: PNG_BYTES.length, externalUrl: obj } });

  const dl = await fetch(`${base}/media/${asset.id}?download=1`);
  assert.equal(dl.status, 200, '下载必须由本站直接回字节，不能再 302 到跨域对象');
  assert.match(dl.headers.get('content-disposition') || '', new RegExp(`^attachment; filename="poster-${asset.id}\\.png"$`));
  assert.match(dl.headers.get('content-type') || '', /^image\/png/);
  const got = Buffer.from(await dl.arrayBuffer());
  assert.deepEqual(got, PNG_BYTES, '代理必须原样回传对象字节');

  const inline = await fetch(`${base}/media/${asset.id}`, { redirect: 'manual' });
  assert.equal(inline.status, 302);
  assert.equal(inline.headers.get('location'), obj, '内联渲染保持 302，前端地址结构不变');
});

test('非本桶外链不做代理，仍 302（站内路由不是任意 URL 代理）', async () => {
  // 故意指向同一台可达上游、但 host 不是本桶域名：若缺少本桶守卫，代理会真的取回 200，
  // 用不可达地址测不出「有没有代理」——只有可达的非本桶地址才能区分。
  const obj = `http://localhost:${upPort}/a.png`;
  const asset = await mem.mediaAsset.create({ data: { kind: 'poster', mime: 'image/png', size: 10, externalUrl: obj } });
  const r = await fetch(`${base}/media/${asset.id}?download=1`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), obj);
  assert.equal(r.headers.get('content-disposition'), null);
});

test('上游异常时回退 302，不把下载变成 500', async () => {
  const obj = `http://127.0.0.1:${upPort}/missing.png`;
  const asset = await mem.mediaAsset.create({ data: { kind: 'poster', mime: 'image/png', size: 10, externalUrl: obj } });
  const r = await fetch(`${base}/media/${asset.id}?download=1`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), obj);
});
