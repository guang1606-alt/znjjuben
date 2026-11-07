/* 终南集离线壳（v2.448）
 * v2.441 / v2.443 已让站点可安装到主屏，但没有 Service Worker 时断网点开只是浏览器错误页。
 * 这里只缓存「应用外壳」：入口 HTML + 同源 js/css/png/svg/webmanifest。
 *  - /api/* 一律放行：接口带 token 与时效性，缓存会造成串号与过期数据；
 *  - 缓存桶按 ?v= 版本隔离（版本来自入口 HTML 的资源版本号），升版即换桶，旧桶 activate 清理；
 *  - 导航与静态资源都「网络优先、断网回落缓存」：离线可用，同时不把 v2.447 的发版即生效拖回旧版本。
 */
const CACHE_PREFIX = 'zhongnan-shell-';
const VERSION = (() => {
  try { return new URL(self.location.href).searchParams.get('v') || '0'; } catch (e) { return '0'; }
})();
const CACHE = CACHE_PREFIX + VERSION;
const SHELL_KEY = './index.html';
const SHELL_ASSET = /\.(?:js|css|png|svg|webmanifest)(?:\?|$)/;

// 深链离线回退时，./app.js 会被解析成 /<一级路径>/app.js 而全部失败；
// 缓存副本统一改成同源绝对路径（服务器在线时返回的原文不动，只改 SW 自己存的那份）。
function absolutize(html) {
  return String(html).replace(/((?:src|href)=")\.\//g, '$1/');
}
function htmlResponse(html) {
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch(SHELL_KEY, { cache: 'reload' });
    // 入口拿不到就不要装出半个壳：宁可本次不装，也不要让用户离线打开空白页
    if (!res || !res.ok) throw new Error('shell index unavailable');
    const html = await res.clone().text();
    await cache.put(SHELL_KEY, htmlResponse(absolutize(html)));
    // 资源清单直接从入口 HTML 解析：URL 已由服务端加 ?v=，无需在 SW 里硬编码文件名
    const urls = [];
    const re = /(?:src|href)="(\.\/[^"]+\.(?:js|css|png|svg|webmanifest)[^"]*)"/g;
    let m;
    while ((m = re.exec(html))) urls.push(m[1]);
    urls.push('./');
    await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (!req || req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // 跨域资源不接管
  if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return; // 接口不缓存
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          // 在线时顺手刷新壳；改写绝对路径，保证下次离线深链能加载脚本
          cache.put(SHELL_KEY, htmlResponse(absolutize(await fresh.clone().text())));
        }
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(SHELL_KEY);
        return hit || Response.error();
      }
    })());
    return;
  }
  if (!SHELL_ASSET.test(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      // 只有网络失败才回缓存：不让「缓存优先」把 v2.447 的发版即生效重新拖成旧版本
      const hit = await cache.match(req);
      return hit || Response.error();
    }
  })());
});
