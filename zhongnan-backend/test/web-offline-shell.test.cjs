/**
 * v2.448.0 离线壳（Service Worker）行为契约：
 * 背景 —— v2.441/v2.443 已给出 manifest 与 iOS 主屏元信息，用户可以把站点装到主屏，
 * 但 web/ 下没有 sw.js、app.js 也没有注册，断网/弱网时主屏图标点开只是浏览器错误页，
 * 「可安装」的承诺名实不符。这里用假 self/caches/fetch 在 vm 里跑真实 sw.js，
 * 只验证行为契约，不依赖真浏览器：
 *   ① install 预缓存入口及其同源 .js/.css/.png/.svg/.webmanifest，缓存桶名带版本号；
 *   ② 导航请求网络优先，断网回落缓存入口（离线可打开）；
 *   ③ 断网时静态资源走缓存命中（不只是入口 HTML 能开，脚本样式也得在）；
 *   ④ /api/* 一律不拦截（接口带token与时效性，缓存会串号/串数据）；
 *   ⑤ activate 清理旧版本桶，只保留当前版本；
 *   ⑥ app.js 只在安全上下文注册，并把入口的 ?v= 带给 sw.js（升版即换桶）；
 *   ⑦ 注册地址必须以「脚本自身 URL」为基准解析：深链文档下不能退化成 /<一级路径>/sw.js。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../web');
const ORIGIN = 'https://znj.example';
const VERSION = '2.448.0';
const INDEX_HTML = [
  '<!DOCTYPE html><html><head>',
  '<link rel="stylesheet" href="./styles.css">',
  '<link rel="manifest" href="./manifest.webmanifest">',
  '<link rel="icon" href="./icon-192.png">',
  '</head><body><main id="mainContent"></main>',
  '<script src="./i18n.js?v=' + VERSION + '"></script>',
  '<script src="./app.js?v=' + VERSION + '"></script>',
  '</body></html>',
].join('\n');

function makeResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    body,
    clone() { return makeResponse(body, ok); },
    async text() { return body; },
  };
}

/** 最小 Service Worker 运行时：够跑 sw.js 的 install/activate/fetch 三个事件 */
function mountSw({ version = VERSION } = {}) {
  const buckets = new Map(); // name -> Map<url, response>
  let offline = false;
  const fetched = [];

  const cacheOf = (name) => {
    if (!buckets.has(name)) buckets.set(name, new Map());
    const store = buckets.get(name);
    const norm = (k) => (typeof k === 'string' ? k : k.url);
    return {
      async put(key, res) { store.set(new URL(norm(key), ORIGIN).href, res); },
      async match(key) { return store.get(new URL(norm(key), ORIGIN).href); },
      async add(key) {
        const href = new URL(norm(key), ORIGIN).href;
        const res = await fetchImpl(href);
        store.set(href, res);
      },
    };
  };

  const caches = {
    async open(name) { return cacheOf(name); },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); },
  };

  async function fetchImpl(input) {
    const url = typeof input === 'string' ? new URL(input, ORIGIN).href : input.url;
    fetched.push(url);
    if (offline) throw new TypeError('Failed to fetch');
    if (/\/index\.html$/.test(url) || url === ORIGIN + '/') return makeResponse(INDEX_HTML);
    return makeResponse('/* asset ' + url + ' */');
  }

  const handlers = {};
  const self = {
    location: { href: ORIGIN + '/sw.js?v=' + version, origin: ORIGIN },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    async skipWaiting() {},
    clients: { async claim() {} },
  };

  const ctx = {
    self, caches, fetch: fetchImpl,
    // new Response(html, {headers}) 在 sw.js 里用于落库改写后的入口副本
    Response: Object.assign(
      function Response(body) { return makeResponse(String(body == null ? '' : body)); },
      { error: () => makeResponse('', false) },
    ),
    Request: class { constructor(url) { this.url = new URL(url, ORIGIN).href; } },
    URL, Promise, Error, TypeError, console,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx);

  const dispatch = async (type, extra = {}) => {
    const waits = [];
    const ev = Object.assign({
      waitUntil(p) { waits.push(p); },
      respondWith(p) { this.__responded = p; waits.push(p); },
    }, extra);
    (handlers[type] || []).forEach((fn) => fn(ev));
    await Promise.all(waits);
    return ev.__responded ? await ev.__responded : undefined;
  };

  return {
    buckets, dispatch, fetched,
    setOffline(v) { offline = v; },
    nav: (p) => ({ request: { method: 'GET', mode: 'navigate', url: ORIGIN + p } }),
    asset: (p) => ({ request: { method: 'GET', mode: 'cors', url: ORIGIN + p } }),
  };
}

test('① install 预缓存入口与同源静态资源，缓存桶名带版本', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  const name = `zhongnan-shell-${VERSION}`;
  assert.ok(sw.buckets.has(name), '缓存桶必须按版本命名: ' + [...sw.buckets.keys()].join(','));
  const keys = [...sw.buckets.get(name).keys()];
  for (const want of ['/index.html', '/styles.css', '/manifest.webmanifest', '/icon-192.png',
    `/i18n.js?v=${VERSION}`, `/app.js?v=${VERSION}`]) {
    assert.ok(keys.includes(ORIGIN + want), '预缓存缺少 ' + want + '，实际: ' + keys.join(','));
  }
});

test('② 导航请求网络优先；断网时回落缓存入口（离线仍可打开）', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  sw.setOffline(true);
  const res = await sw.dispatch('fetch', sw.nav('/works/12345'));
  assert.ok(res, '离线导航必须有响应（不得直接返回网络错误）');
  assert.ok(res.ok, '离线导航应回落到缓存入口');
  assert.match(await res.text(), /mainContent/, '回落的必须是应用入口 HTML');
});

test('③ 断网时静态资源命中缓存（脚本样式也要能离线启动）', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  sw.setOffline(true);
  const res = await sw.dispatch('fetch', sw.asset(`/app.js?v=${VERSION}`));
  assert.ok(res && res.ok, '离线时 app.js 必须命中缓存');
  assert.match(res.body, /asset/);
});

test('④ /api/* 不拦截：接口不得进缓存（串号 / 过期数据风险）', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  // 故意用「看起来像静态资源」的接口路径：只有 api 守卫能拦住它，
  // 否则会落进静态缓存分支，把带 token 的响应写进用户机器。
  let hit = false;
  await sw.dispatch('fetch', {
    request: { method: 'GET', mode: 'cors', url: ORIGIN + '/api/export/preview.js' },
    respondWith() { hit = true; },
  });
  assert.ok(!hit, '/api 请求必须原样放行，不得 respondWith');
  assert.ok(!sw.fetched.some((u) => u.includes('/api/')), 'SW 不应主动抓 /api');
});

test('⑤ activate 清理旧版本桶，只保留当前版本', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  sw.buckets.set('zhongnan-shell-2.447.0', new Map());
  sw.buckets.set('someone-else-cache', new Map());
  await sw.dispatch('activate');
  assert.ok(sw.buckets.has(`zhongnan-shell-${VERSION}`), '当前版本桶必须保留');
  assert.ok(!sw.buckets.has('zhongnan-shell-2.447.0'), '旧版本桶必须清掉，否则磁盘无限增长');
  assert.ok(sw.buckets.has('someone-else-cache'), '非本应用前缀的缓存不得误删');
});

test('⑦ 离线回退的入口已改写绝对路径（否则深链下 ./app.js 变 /works/app.js 全 404）', async () => {
  const sw = mountSw();
  await sw.dispatch('install');
  sw.setOffline(true);
  const res = await sw.dispatch('fetch', sw.nav('/works/12345'));
  assert.ok(res && res.ok, '离线导航必须回落缓存入口');
  const html = await res.text();
  assert.ok(!/(?:src|href)="\.\//.test(html), '缓存入口不得残留 ./ 引用: ' + html.slice(0, 160));
  assert.ok(html.includes(`"/app.js?v=${VERSION}"`), '应改写为同源绝对路径');
});

test('⑥ app.js 仅在安全上下文注册，并把入口 ?v= 传给 sw.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const pick = (name) => {
    const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)[\\s\\S]*?\\n  \\}'));
    assert.ok(m, 'app.js 缺少 ' + name + '()');
    return m[0];
  };
  const fn = pick('initOfflineShell');
  assert.match(fn, /'serviceWorker' in navigator/, '必须先探测能力');
  assert.match(fn, /https:/, '必须判断 https');
  assert.match(fn, /localhost|127\.0\.0\.1/, 'localhost 属安全上下文，需放行');
  assert.match(fn, /sw\.js/, '必须注册 sw.js');
  assert.match(fn, /searchParams\.get\('v'\)|searchParams\.get\("v"\)/, '版本号要取自入口资源 URL 的 ?v=');
  assert.match(fn, /catch/, '注册失败（隐私模式/策略禁用）不得打断主流程');
  assert.match(src, /initOfflineShell\(\);/, '启动段必须接线 initOfflineShell');
});

test('⑦ SW 注册地址相对「脚本自身 URL」解析，深链文档下不得退化成 /<一级路径>/sw.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const m = src.match(/function initOfflineShell\([^)]*\)[\s\S]*?\n  \}/);
  assert.ok(m, 'app.js 缺少 initOfflineShell()');
  const fn = m[0];
  // 语义自证：为什么必须换基准——文档地址解析会把深链的一级路径当成目录
  assert.equal(new URL('./sw.js', ORIGIN + '/works/12345').href, ORIGIN + '/works/sw.js',
    '文档基准会把 ./sw.js 解析到一级路径下（记录真实失败模式）');
  assert.equal(new URL('./sw.js?v=2.480.0', new URL('/app.js?v=2.480.0', ORIGIN)).href,
    ORIGIN + '/sw.js?v=2.480.0', '脚本基准在深链文档下仍应落到同源根目录');
  // 结构约束：必须先解析脚本 URL，再以它为基准解析 sw.js
  assert.match(fn, /scriptUrl\s*=\s*new URL\(/, '必须先解析出 app.js 自身的 URL 作为基准');
  assert.match(fn, /new URL\([^)]*,\s*scriptUrl\)/, 'sw.js 必须以脚本 URL 为基准解析');
  assert.ok(!/register\(\s*'\.\/sw\.js/.test(fn), '不得把 ./sw.js 直接交给 register（会按文档 URL 解析）');
});
