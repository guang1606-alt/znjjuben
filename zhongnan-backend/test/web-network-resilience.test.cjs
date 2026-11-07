/**
 * v2.442 产品化：网络韧性 + 安装引导（静态契约）。
 *
 * 证伪背景：web/ 全目录 grep `navigator.onLine` / `beforeinstallprompt` 均为 0 命中——
 * 断网后 UI 无任何持续状态提示（只有一次性 toast，会自动消失）；PWA 虽可安装，
 * 但没有任何站内引导入口，用户不知道能装。
 * 本文件锁死：断网横幅可被读屏感知、断网/恢复状态机、安装入口只在可安装时出现。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const i18nJs = fs.readFileSync(path.join(webDir, 'i18n.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(webDir, 'styles.css'), 'utf8');

test('断网横幅具备无障碍语义，默认隐藏', () => {
  const m = indexHtml.match(/<div class="net-banner[^"]*"[^>]*id="netBanner"[^>]*>/);
  assert.ok(m, '缺 netBanner 节点');
  assert.match(m[0], /role="status"/, '持续状态需 role=status');
  assert.match(m[0], /aria-live="polite"/, '需 aria-live 让读屏感知状态变化');
  assert.match(m[0], /hidden/, '默认必须隐藏，断网才显示');
  assert.match(stylesCss, /\.net-banner\s*\{/, '缺横幅样式');
  assert.match(stylesCss, /data-theme="dark"[^\n]*\.net-banner/, '深色主题要有可读配色');
});

test('断网状态机：常驻横幅 + 仅恢复时弹一次 toast', () => {
  const fn = appJs.match(/function initNetWatch\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, '缺 initNetWatch');
  assert.match(fn[0], /addEventListener\('offline'/, '需监听 offline');
  assert.match(fn[0], /addEventListener\('online'/, '需监听 online');
  assert.match(fn[0], /_wasOffline/, '需记住断网前态，避免抖动反复提示');
  assert.match(fn[0], /toastOk\(/, '恢复时给一次成功提示');
  const sync = appJs.match(/function syncNetBanner\(\)[\s\S]*?\n  \}/);
  assert.ok(sync, '缺 syncNetBanner');
  assert.match(sync[0], /navigator\.onLine/, '必须读真实在线状态');
  assert.match(sync[0], /classList\.toggle\('hidden'/, '横幅显隐由浏览器在线状态驱动');
  assert.match(appJs, /initNetWatch\(\)/, '必须在启动时接线');
  assert.match(appJs.match(/function applyLang\(\)[\s\S]*?\n  \}/)[0], /syncNetBanner\(\)/, '切语言后横幅文案需重刷');
});

test('安装引导：只在可安装时露出，且不臆造 iOS 入口', () => {
  const btn = indexHtml.match(/<button class="chip hidden" id="installBtn"[^>]*>/);
  assert.ok(btn, '安装入口必须默认隐藏，等浏览器事件再露出');
  assert.match(btn[0], /data-i="installApp"/, '入口文案需走 i18n');
  const fn = appJs.match(/function initInstallPrompt\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, '缺 initInstallPrompt');
  assert.match(fn[0], /beforeinstallprompt/, '需接住 Chromium 的可安装事件');
  assert.match(fn[0], /preventDefault\(\)/, '需暂缓浏览器默认气泡，改用顶栏入口');
  assert.match(fn[0], /display-mode: standalone/, '已独立窗口运行时不再引导');
  assert.match(fn[0], /appinstalled/, '安装成功后收起入口');
  assert.match(appJs, /initInstallPrompt\(\)/, '必须在启动时接线');
});

test('新增文案中英齐备', () => {
  ['netOffline', 'netOnline', 'installApp', 'installDone', 'installDismissed'].forEach((k) => {
    const hits = i18nJs.match(new RegExp(`\\b${k}:`, 'g')) || [];
    assert.strictEqual(hits.length, 2, `${k} 必须中英各一条，当前 ${hits.length} 条`);
  });
});
