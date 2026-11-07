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

test('安装引导：Chromium 走安装事件，iOS 给可走通的路径', () => {
  const btn = indexHtml.match(/<button class="chip hidden" id="installBtn"[^>]*>/);
  assert.ok(btn, '安装入口必须默认隐藏，等浏览器事件或设备判定再露出');
  assert.match(btn[0], /data-i="installApp"/, '入口文案需走 i18n');
  const fn = appJs.match(/function initInstallPrompt\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, '缺 initInstallPrompt');
  assert.match(fn[0], /beforeinstallprompt/, '需接住 Chromium 的可安装事件');
  assert.match(fn[0], /preventDefault\(\)/, '需暂缓浏览器默认气泡，改用顶栏入口');
  assert.match(fn[0], /display-mode: standalone/, '已独立窗口运行时不再引导');
  assert.match(fn[0], /appinstalled/, '安装成功后收起入口');
  assert.match(appJs, /initInstallPrompt\(\)/, '必须在启动时接线');
});

test('iOS 安装路径：判定到位、入口露出、点击给指引而非死按钮', () => {
  const detect = appJs.match(/function isIOSDevice\(\)[\s\S]*?\n  \}/);
  assert.ok(detect, '缺 isIOSDevice 判定');
  assert.match(detect[0], /iPad\|iPhone\|iPod/, '需按 UA 识别 iPhone/iPad/iPod');
  assert.match(detect[0], /MacIntel[\s\S]*maxTouchPoints/, 'iPadOS 13+ 伪装桌面 UA，需补 MacIntel + 多点触控判定');
  const fn = appJs.match(/function initInstallPrompt\(\)[\s\S]*?\n  \}/)[0];
  assert.match(fn, /_iosInstallHint = isIOSDevice\(\)/, '需在初始化时判定设备');
  assert.match(fn, /if \(_iosInstallHint\) btn\.classList\.remove\('hidden'\)/, 'iOS 无安装事件，入口要主动露出');
  // 点击分支：iOS 先返回指引，不隐藏入口、不依赖 _installEvt
  const clickBody = fn.slice(fn.indexOf("btn.addEventListener('click'"));
  assert.match(clickBody, /if \(_iosInstallHint\) \{ toastInfo\(t\('installIosHint'\)\); return; \}/, 'iOS 点击应给「分享 → 添加到主屏幕」指引');
  const iosReturnIdx = clickBody.indexOf('toastInfo(t(\'installIosHint\'))');
  const hideIdx = clickBody.indexOf("btn.classList.add('hidden')");
  assert.ok(iosReturnIdx > 0 && iosReturnIdx < hideIdx, 'iOS 分支必须在隐藏入口之前返回');
});

test('iOS 主屏元信息齐备（manifest 的 display 在旧版 iOS 不生效）', () => {
  assert.match(indexHtml, /name="apple-mobile-web-app-capable" content="yes"/, '缺 apple-mobile-web-app-capable，旧版 iOS 无法独立窗口运行');
  assert.match(indexHtml, /name="mobile-web-app-capable" content="yes"/, '缺标准前缀的 mobile-web-app-capable');
  assert.match(indexHtml, /name="apple-mobile-web-app-title" content="终南集"/, '主屏名称需用短名，否则完整 <title> 被截断');
  assert.doesNotMatch(indexHtml, /<meta name="apple-mobile-web-app-status-bar-style"/, '不得设 status-bar-style：black-translucent 会把顶栏压到刘海下');
});

test('新增文案中英齐备', () => {
  ['netOffline', 'netOnline', 'installApp', 'installDone', 'installDismissed', 'installIosHint'].forEach((k) => {
    const hits = i18nJs.match(new RegExp(`\\b${k}:`, 'g')) || [];
    assert.strictEqual(hits.length, 2, `${k} 必须中英各一条，当前 ${hits.length} 条`);
  });
});

test('v2.445 全局异常兜底：漏 catch 的异常要有可读出口', () => {
  const fn = appJs.match(/function initGlobalErrorGuard\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, '缺 initGlobalErrorGuard');
  assert.match(fn[0], /addEventListener\('unhandledrejection'/, '需接住未处理的 Promise 拒绝');
  assert.match(fn[0], /addEventListener\('error'/, '需接住运行时异常');
  assert.match(fn[0], /window\._znErrGuard/, '需幂等守卫，重复接线不叠加监听');
  assert.match(fn[0], /_last/, '需节流，避免循环报错刷屏');
  assert.match(fn[0], /5000/, '同类异常 5s 内只提示一次');
  assert.match(fn[0], /toastInfo\(t\('globalErrorHint'\)\)/, '必须给用户可读提示');
  assert.match(fn[0], /Failed to fetch\|NetworkError\|Load failed/i, '网络失败由 api.js 统一提示，需跳过避免双 toast');
  assert.match(fn[0], /AbortError/, '主动取消不应打扰用户');
  assert.match(fn[0], /e\.target\.tagName/, '资源加载失败（离线图片）不应弹提示');
  const boot = appJs.match(/initNetWatch\(\); initInstallPrompt\(\);[\s\S]{0,200}if \(Api\.isAuthed\(\)\) loadMe\(\);/);
  assert.ok(boot, '缺启动段');
  assert.match(boot[0], /initGlobalErrorGuard\(\)/, '必须在启动时接线');
  const hits = i18nJs.match(/\bglobalErrorHint:/g) || [];
  assert.strictEqual(hits.length, 2, `globalErrorHint 必须中英各一条，当前 ${hits.length} 条`);
});
