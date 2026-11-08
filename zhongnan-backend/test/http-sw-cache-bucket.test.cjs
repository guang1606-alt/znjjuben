/**
 * v2.482 Service Worker 缓存桶端到端校验（真 HTTP + 真 sw.js）
 *
 * 背景：v2.447 起入口 HTML 的 .js/.css 带 ?v=<package.version>，v2.448 起 SW 按该版本分桶。
 * 但过去的守卫是「静态读源码」：sw.js 里 `searchParams.get('v')` 一旦被改成硬编码/漏读，
 * 或服务端不再给入口注入 ?v=，静态断言仍全绿，而用户机器上会出现：
 *   ① 所有版本共用一个桶 → 升版后旧壳永不淘汰，新逻辑装不进去；
 *   ② 桶名与实际版本错位 → activate 清错桶；
 *   ③ 离线缓存里塞的是无版本号的旧资源 URL → 在线时拿不到新版。
 * 本用例起真实服务、实抓 `/sw.js?v=<版本>` 与 `/`，再把这份**真实脚本**放进最小 SW 运行时跑
 * install/activate，断言桶名与版本、缓存键与入口引用三者完全一致。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.JWT_ACCESS_SECRET = 'http-sw-bucket-secret';
process.env.JWT_REFRESH_SECRET = 'http-sw-bucket-refresh';
const express = require('express');
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;
const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) }, express.Router());
const server = app.listen(0);
let base;
let ORIGIN;
test.before(() => new Promise((r) => server.once('listening', () => {
  base = `http://127.0.0.1:${server.address().port}`;
  ORIGIN = base;
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
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
  req.on('error', reject);
  req.end();
});

const assetRefs = (html) => [...html.matchAll(/(?:src|href)="(\.\/[^"]+\.(?:js|css|png|svg|webmanifest)(?:\?[^"]*)?)"/g)].map((m) => m[1]);

/** 最小 SW 运行时：fetch 打真实服务，caches 落在内存 Map，与浏览器语义足够接近 */
function mountSw(script, version) {
  const buckets = new Map();
  const norm = (k) => new URL(typeof k === 'string' ? k : k.url, ORIGIN).href;
  const cacheOf = (name) => {
    if (!buckets.has(name)) buckets.set(name, new Map());
    const store = buckets.get(name);
    return {
      async put(key, res) { store.set(norm(key), res); },
      async match(key) { return store.get(norm(key)); },
      async add(key) {
        const res = await realFetch(norm(key));
        if (!res.ok) throw new Error('cache.add failed ' + res.status + ' ' + norm(key));
        store.set(norm(key), res);
      },
    };
  };
  const caches = {
    async open(name) { return cacheOf(name); },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); },
  };
  // 浏览器的 fetch 在 SW 里按脚本 URL 解析相对地址；Node fetch 只认绝对 URL，这里补齐语义
  const realFetch = async (input) => {
    const raw = typeof input === 'string' ? input : input.url;
    return fetch(new URL(raw, ORIGIN).href);
  };

  const handlers = {};
  const self = {
    location: { href: ORIGIN + '/sw.js' + (version == null ? '' : '?v=' + version), origin: ORIGIN },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    async skipWaiting() {},
    clients: { async claim() {} },
  };
  const ctx = {
    self, caches, fetch: realFetch, Response, URL, Promise, Error, TypeError, console,
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);

  const dispatch = async (type) => {
    const waits = [];
    const ev = {
      waitUntil(p) { waits.push(p); },
      respondWith(p) { this.__responded = p; waits.push(p); },
    };
    (handlers[type] || []).forEach((fn) => fn(ev));
    await Promise.all(waits);
    return ev.__responded ? await ev.__responded : undefined;
  };
  return { buckets, dispatch };
}

test('① 入口 HTML 的脚本/样式版本与 package.json 一致（SW 桶名的唯一来源）', async () => {
  const r = await fetchRaw('/', { Accept: 'text/html' });
  assert.strictEqual(r.status, 200);
  // 服务端只给 .js/.css 注入 ?v=（v2.447 口径）；图标与 manifest 走短缓存，不参与版本化
  const refs = assetRefs(r.body).filter((ref) => /\.(?:js|css)(?:\?|$)/.test(ref));
  assert.ok(refs.length >= 4, '入口应引用多个本地脚本/样式，实际 ' + refs.length);
  const versions = new Set(refs.map((ref) => (ref.match(/\?v=([^"&]+)/) || [])[1]));
  assert.deepStrictEqual([...versions], [VERSION], '入口资源版本必须全等于 package.json 版本，实际 ' + [...versions].join(','));
});

test('② 真抓 /sw.js?v=<版本> 跑 install：缓存桶名必须等于 zhongnan-shell-<版本>', async () => {
  const swRes = await fetchRaw('/sw.js?v=' + VERSION);
  assert.strictEqual(swRes.status, 200, '/sw.js?v= 必须可取到');
  const html = (await fetchRaw('/', { Accept: 'text/html' })).body;
  const sw = mountSw(swRes.body, VERSION);
  await sw.dispatch('install');
  const want = 'zhongnan-shell-' + VERSION;
  assert.deepStrictEqual([...sw.buckets.keys()], [want], '桶名漂移会让升版后新旧壳互相覆盖/旧壳永不清理');
  // 缓存键必须与入口引用一一对应（同版本号），否则在线时拿不到新版资源
  const cached = [...sw.buckets.get(want).keys()].map((u) => new URL(u).pathname + new URL(u).search);
  assert.ok(cached.includes('/index.html'), '必须缓存入口：' + cached.join(','));
  for (const ref of assetRefs(html)) {
    const p = new URL(ref, ORIGIN).pathname + new URL(ref, ORIGIN).search;
    assert.ok(cached.includes(p), '缓存键缺少入口引用的资源 ' + ref + '：' + cached.join(','));
  }
  for (const k of cached) {
    if (!/\.(?:js|css)$/.test(new URL(k, ORIGIN).pathname)) continue;
    assert.match(k, new RegExp('\\?v=' + VERSION.replace(/\./g, '\\.') + '$'), '脚本/样式缓存键必须带当前版本：' + k);
  }
});

test('③ activate 只清理旧版本桶：旧版本删、当前版本留、他人缓存不误删', async () => {
  const swRes = await fetchRaw('/sw.js?v=' + VERSION);
  const sw = mountSw(swRes.body, VERSION);
  await sw.dispatch('install');
  sw.buckets.set('zhongnan-shell-1.0.0', new Map());
  sw.buckets.set('other-app-cache', new Map());
  await sw.dispatch('activate');
  assert.ok(sw.buckets.has('zhongnan-shell-' + VERSION), '当前版本桶必须保留');
  assert.ok(!sw.buckets.has('zhongnan-shell-1.0.0'), '旧版本桶必须清掉');
  assert.ok(sw.buckets.has('other-app-cache'), '非本应用前缀的缓存不得误删');
});

test('④ 反证：SW 地址不带 ?v= 时桶退化为 zhongnan-shell-0（这正是必须透传版本的原因）', async () => {
  const swRes = await fetchRaw('/sw.js');
  const sw = mountSw(swRes.body, null);
  await sw.dispatch('install');
  assert.deepStrictEqual([...sw.buckets.keys()], ['zhongnan-shell-0'],
    '无版本时固定落 0 号桶：所有版本共用一桶，升版失效——记录该失败模式，防止有人把 ?v= 去掉');
});
