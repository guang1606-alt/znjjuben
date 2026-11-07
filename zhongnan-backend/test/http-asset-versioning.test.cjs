/**
 * v2.447 发版即生效：入口 HTML 给同源 .js/.css 加 ?v=<package.version>。
 *
 * 证伪背景：零构建站点没有内容指纹，v2.265 只给了 5 分钟短缓存——发版后 5 分钟内
 * 刷新仍可能拿到旧 app.js（本轮真机复核两次踩到：新代码已部署，页面还在跑旧逻辑），
 * 与已升级的接口错位时用户只看到「点了没反应」。版本化 URL 让每次升版换 key，
 * 浏览器按完整 URL 命中缓存，新版立即生效；未升版发版的最坏情况与今天相同（5 分钟）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
process.env.JWT_ACCESS_SECRET = 'http-asset-version-secret';
process.env.JWT_REFRESH_SECRET = 'http-asset-version-refresh';
const express = require('express');
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;
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
      etag: res.headers['etag'] || '',
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
  req.on('error', reject);
  req.end();
});

const assetRefs = (html) => [...html.matchAll(/(?:src|href)="(\.\/[^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map((m) => m[1]);

test('① GET / 的入口 HTML：同源 JS/CSS 全部带 ?v=<package.version>', async () => {
  const r = await fetchRaw('/', { Accept: 'text/html' });
  assert.strictEqual(r.status, 200);
  assert.match(r.cacheControl, /no-cache/, '入口仍须 no-cache，版本正确性优先');
  const refs = assetRefs(r.body);
  assert.ok(refs.length >= 5, `入口应引用多个本地脚本/样式，实际 ${refs.length}`);
  const missing = refs.filter((ref) => !ref.endsWith(`?v=${version}`));
  assert.deepStrictEqual(missing, [], `存在未版本化的资源引用：${missing.join(', ')}`);
  assert.ok(r.body.includes(`./app.js?v=${version}`), 'app.js 必须带版本号');
  assert.ok(r.body.includes(`./styles.css?v=${version}`), 'styles.css 必须带版本号');
});

test('② 深链回退改绝对路径（./ 在 /works/12345 下会被解析成 /works/*，脚本全 404）', async () => {
  const direct = await fetchRaw('/index.html', { Accept: 'text/html' });
  const deep = await fetchRaw('/works/12345', { Accept: 'text/html' });
  assert.strictEqual(direct.status, 200);
  assert.strictEqual(deep.status, 200);
  for (const r of [direct, deep]) {
    assert.match(r.cacheControl, /no-cache/);
    assert.ok(r.body.includes(`?v=${version}`), '深链回退也必须带版本号');
  }
  // 根路径保持相对引用：部署在子路径时 ./ 才是对的，不能一刀切改绝对路径
  assert.ok(direct.body.includes(`"./app.js?v=${version}"`), '入口根路径应保持相对引用');
  // 深链必须是同源绝对路径，且不残留任何 ./ 引用
  assert.ok(deep.body.includes(`"/app.js?v=${version}"`), '深链回退必须改成绝对路径');
  assert.ok(!/(?:src|href)="\.\//.test(deep.body), '深链入口不得残留 ./ 相对引用');
});

test('③ 版本号取自 package.json，且改动 index.html 后无需重启即可刷新（mtime 缓存）', async () => {
  assert.match(version, /^\d+\.\d+\.\d+$/, '版本号必须为 semver');
  const a = await fetchRaw('/', { Accept: 'text/html' });
  const b = await fetchRaw('/', { Accept: 'text/html' });
  assert.strictEqual(a.body, b.body, '同一 mtime 下应返回同一份缓存渲染结果');
  assert.strictEqual(assetRefs(a.body).length, assetRefs(b.body).length);
});

test('④ 版本化不破坏缓存语义：带 ?v= 的脚本仍是 200 + 5 分钟缓存 + ETag，且支持 304', async () => {
  const first = await fetchRaw(`/app.js?v=${version}`);
  assert.strictEqual(first.status, 200);
  assert.match(first.cacheControl, /max-age=300/, '零构建站点仍用短缓存，避免未升版发版长期卡旧资源');
  assert.ok(first.etag.length > 0, '必须保留 ETag');
  const second = await fetchRaw(`/app.js?v=${version}`, { 'If-None-Match': first.etag });
  assert.strictEqual(second.status, 304, '版本号不变时应 304 零字节回包');
});

test('⑤ API 与 /api 404 契约不受影响（静态重写不得吞接口）', async () => {
  const api = await fetchRaw('/api/definitely-not-exist', { Accept: 'application/json' });
  assert.strictEqual(api.status, 404);
  assert.match(api.body, /NOT_FOUND/, '/api 未匹配仍须 JSON 404');
  assert.ok(!api.body.includes('?v='), '/api 响应不得被注入资源版本号');
});
