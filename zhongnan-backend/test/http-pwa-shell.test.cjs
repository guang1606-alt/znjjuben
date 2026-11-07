/**
 * v2.441 产品化：PWA 安装壳（manifest / 图标 / 品牌元信息）。
 *
 * 证伪背景：web/index.html 此前无 theme-color、无 manifest、无 apple-touch-icon，
 * 移动端无法「添加到主屏幕」，浏览器地址栏色也与三主题脱节。
 * 本文件锁死：清单可访问且字段完整、图标可访问、index.html 三件套齐全。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = 'pwa-secret';
process.env.JWT_REFRESH_SECRET = 'pwa-refresh';
const { createApp } = require('../dist/server/app.js');

const app = createApp();
let base;
const server = app.listen(0);
test.before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

test('PWA 清单可访问，且安装必需字段完整', async () => {
  const r = await fetch(`${base}/manifest.webmanifest`);
  assert.strictEqual(r.status, 200, 'manifest 必须可访问');
  assert.match(r.headers.get('content-type') || '', /manifest\+json/, 'webmanifest 必须按 manifest+json 下发');
  const m = await r.json();
  assert.match(m.name, /终南集/, 'name 必须含产品名');
  assert.ok(m.short_name && m.short_name.length > 0, 'short_name 必填');
  assert.strictEqual(m.start_url, './', 'start_url 必须同源相对路径');
  assert.strictEqual(m.scope, './');
  assert.strictEqual(m.display, 'standalone', '需独立窗口显示，脱离浏览器地址栏');
  assert.match(m.theme_color, /^#[0-9a-fA-F]{6}$/);
  assert.match(m.background_color, /^#[0-9a-fA-F]{6}$/);
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 1, '至少一个图标，否则不可安装');
  const png = m.icons.filter((i) => i.type === 'image/png');
  assert.ok(png.some((i) => i.sizes === '192x192'), 'Android 主屏需要 192x192 PNG');
  assert.ok(png.some((i) => i.sizes === '512x512'), '启动画面与商店需要 512x512 PNG');
  assert.ok(png.some((i) => /maskable/.test(i.purpose || '')), 'Android 自适应图标需要 maskable');
  assert.ok(m.icons.some((i) => i.type === 'image/svg+xml'), '保留矢量图标，高分屏不糊');
  m.icons.forEach((i) => assert.match(i.src, /^\.\/icon[-\w]*\.(png|svg)$/, '图标路径需与仓库内文件一致'));
});

test('应用图标可访问且为合法 SVG', async () => {
  const r = await fetch(`${base}/icon.svg`);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
  const body = await r.text();
  assert.match(body, /<svg[\s>]/, '必须是 SVG 根元素');
  assert.match(body, /viewBox=/, 'SVG 需 viewBox 才能自适应缩放');
});

test('index.html 下发 PWA 引用与品牌元信息（三件套）', async () => {
  const html = await (await fetch(`${base}/`, { headers: { Accept: 'text/html' } })).text();
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/, '缺 manifest 引用');
  assert.match(html, /<meta name="theme-color" content="#[0-9a-fA-F]{6}"/, '缺 theme-color');
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icon-192\.png"/, '缺 iOS 主屏图标（iOS 仅认 PNG）');
  assert.match(html, /<meta name="description" content="[^"]+"/, '缺检索/分享摘要');
});
