#!/usr/bin/env node
/**
 * v2.472 UI 真机巡检（可复用）
 *
 * 为什么需要：每轮 dogfood 都靠手写 /tmp 临时脚本打开无头 Chrome 逐视图扫
 * 「遮挡 / 点击被吃掉 / 横向溢出 / 图标按钮无名称」，用完即弃，下一轮重新摸索。
 * 本脚本把这类检查固化成一条命令，避免重复劳动与 token 浪费。
 *
 * 用法：
 *   node scripts/ui-audit.cjs                 # 自动起服务（默认 8130）→ 桌面 1280x900 全视图巡检
 *   node scripts/ui-audit.cjs --mobile        # 追加 390x844 移动端巡检（公共视图）
 *   node scripts/ui-audit.cjs --base http://127.0.0.1:8122   # 复用已启动服务
 *   node scripts/ui-audit.cjs --json          # 只输出 JSON（便于外部消费）
 *   CHROME_PATH=/path/to/chrome node scripts/ui-audit.cjs
 *
 * 退出码：0 = 无问题；1 = 发现问题（明细见输出）；2 = 环境不可用（无 Chrome / 服务起不来）。
 *
 * 检查项（逐视图）：
 *   horizontalOverflow  文档左右横向溢出（横向滚动条）
 *   clickStolen         可见交互控件中心点被其他元素命中（点击无效/被遮挡）
 *   unnamedControls     可见图标按钮无文本/aria-label/title（读屏与自动化不可达）
 *   tinyTargets         移动端触控目标 < 24x24（WCAG 2.2 AA target size）
 *   offscreenX          元素横向越界（越出视口左右边缘；可横滑容器内的不算）
 *   activeNavHidden     当前激活栏被导航滚动容器裁出可视区（切视图后找不到"我在哪"）
 *   motion              可见元素带 transition/animation 的数量（0 视为页面无动效）
 *   reducedMotion       styles.css 是否声明 prefers-reduced-motion 降级
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const VIEWS = ['home', 'studio', 'toolbox', 'works', 'vip', 'square', 'market', 'admin'];
// 未登录时 admin 会被路由器拦回 home（权限页），巡检不把它算失败
const PUBLIC_VIEWS = ['home', 'studio', 'toolbox', 'vip', 'square', 'market', 'works'];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

const PORT = Number(arg('--port', process.env.UI_AUDIT_PORT || 8130));
const BASE = typeof arg('--base', '') === 'string' ? arg('--base', '') : '';
const MOBILE = !!arg('--mobile', false);
const JSON_ONLY = !!arg('--json', false);
const KEEP_SERVER = !!arg('--keep', false);

function log(...a) { if (!JSON_ONLY) console.log(...a); }

function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || '';
}

async function waitUp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return true;
    } catch { /* 还没起 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function ensureServer() {
  if (BASE) return { base: BASE.replace(/\/$/, ''), child: null };
  const base = 'http://127.0.0.1:' + PORT;
  // 已有服务就直接复用，避免端口冲突
  if (await waitUp(base + '/', 600)) {
    log('· 复用已运行服务 ' + base);
    return { base, child: null };
  }
  const entry = path.join(ROOT, 'dist', 'dev-server.js');
  if (!fs.existsSync(entry)) {
    console.error('✗ 缺少 ' + entry + '，先执行 npm run build');
    process.exit(2);
  }
  log('· 启动本地服务 ' + base + ' …');
  const child = spawn(process.execPath, [entry], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DISABLE_AUTO_SCHEDULER: '1', DEMO: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let tail = '';
  child.stdout.on('data', (d) => { tail = (tail + d).slice(-2000); });
  child.stderr.on('data', (d) => { tail = (tail + d).slice(-2000); });
  const ok = await waitUp(base + '/', 25000);
  if (!ok) {
    child.kill('SIGKILL');
    console.error('✗ 服务 25s 未就绪。输出尾部：\n' + tail);
    process.exit(2);
  }
  return { base, child };
}

// —— 页面内执行的巡检函数（必须自包含，不能引用 Node 作用域） ——
function inPageAudit() {
  const vw = innerWidth;
  const vh = innerHeight;
  const de = document.documentElement;
  const horizontalOverflow = Math.max(0, de.scrollWidth - de.clientWidth);

  const SEL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [data-view], [data-view-go], [data-open], [data-tab]';
  const nodes = [...document.querySelectorAll(SEL)];

  const desc = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16);
    return el.tagName.toLowerCase() + id + cls + (txt ? '「' + txt + '」' : '');
  };
  const painted = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
    return { r, cs };
  };

  const clickStolen = [];
  const unnamedControls = [];
  const offscreenX = [];
  const tinyTargets = [];

  // 有遮罩/对话框打开时，罩外控件被挡住是设计使然（如未登录进管理后台弹登录框），
  // 只检查罩内控件，避免整页误报。
  const overlay = document.querySelector('.modal-mask:not(.hidden), .modal.open, .overlay.open, .ui-dlg-overlay, #workbenchLayer:not(.hidden)');
  const overlayOpen = overlay ? desc(overlay) : '';

  // 横向可滚动容器内的元素（如窄屏导航条）越界是"滑动可达"，不算布局溢出
  const scrollableAncestor = (el) => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
      n = n.parentElement;
    }
    return false;
  };

  for (const el of nodes) {
    const p = painted(el);
    if (!p) continue;
    const { r, cs } = p;
    // 完全在视口外的元素（如屏外跳转链接 skip-link）不算横向溢出
    const fullyOff = r.right <= 0 || r.left >= vw;
    if (!fullyOff && !scrollableAncestor(el) && (r.right > vw + 1 || r.left < -1)) {
      offscreenX.push({ el: desc(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
    if (cs.pointerEvents === 'none') continue; // 穿透层本身不可点，不算被遮挡
    if (overlay && !overlay.contains(el)) continue; // 遮罩外的控件按设计被挡
    if (r.top < 0 || r.bottom > vh || r.left < 0 || r.right > vw) continue; // 视口外不做命中测试
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) continue;
    if (hit === el || el.contains(hit)) continue;
    const hcs = getComputedStyle(hit);
    if (hcs.pointerEvents === 'none') continue;
    clickStolen.push({ el: desc(el), hit: desc(hit), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
  }

  // 命中区域外扩判定：伪元素 ::before/inset:-12px 这类做法让视觉尺寸小而触控尺寸大，
  // 用 4 点探针还原真实可点范围，避免把「小图标大热区」判成小目标。
  const expandedHit = (el, r) => {
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const pts = [[cx, r.top - 9], [cx, r.bottom + 9], [r.left - 9, cy], [r.right + 9, cy]];
    return pts.some(([x, y]) => {
      if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h));
    });
  };

  for (const el of nodes) {
    const p = painted(el);
    if (!p) continue;
    // 可访问名：aria-label / aria-labelledby / title / 文本 / placeholder / 关联 <label for>
    const name = (el.getAttribute('aria-label') || '').trim()
      || (el.getAttribute('aria-labelledby') ? 'aria-labelledby' : '')
      || (el.getAttribute('title') || '').trim()
      || (el.textContent || '').trim()
      || (el.getAttribute('placeholder') || '').trim()
      || (el.labels && el.labels.length ? 'label-for' : '');
    if (!name) unnamedControls.push(desc(el));
    const { r } = p;
    if ((r.width < 24 || r.height < 24) && !expandedHit(el, r)) {
      tinyTargets.push({ el: desc(el), size: [Math.round(r.width), Math.round(r.height)] });
    }
  }

  // 动效存在性：统计可见元素中带 transition/animation 的数量
  let animCount = 0;
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.getBoundingClientRect().width <= 0) continue;
    const cs = getComputedStyle(el);
    const t = cs.transitionDuration && cs.transitionDuration !== '0s';
    const a = cs.animationName && cs.animationName !== 'none';
    if (t || a) animCount++;
  }

  // 当前激活导航项是否被滚动容器裁在可视区外（窄屏切到靠右栏目后不自动滚动的典型症状）
  let activeNavHidden = false;
  const activeNav = document.querySelector('.nav .nav-item.active');
  if (activeNav && activeNav.parentElement) {
    const nr = activeNav.parentElement.getBoundingClientRect();
    const ar = activeNav.getBoundingClientRect();
    activeNavHidden = ar.left < nr.left - 1 || ar.right > nr.right + 1;
  }

  return {
    viewport: [vw, vh],
    horizontalOverflow,
    clickStolen,
    unnamedControls: [...new Set(unnamedControls)],
    offscreenX: offscreenX.slice(0, 20),
    tinyTargets: tinyTargets.slice(0, 20),
    motion: animCount,
    visibleControls: nodes.filter((el) => painted(el)).length,
    overlayOpen,
    activeNavHidden,
    view: (location.hash || '').replace(/^#\/?/, '') || 'home',
  };
}

async function auditViewport(browser, base, label, viewport, views) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 200)));

  const results = [];
  for (const v of views) {
    await page.goto(base + '/#/' + v, { waitUntil: 'domcontentloaded' });
    // 等首屏渲染 + 视图进场动画（360ms）+ 可能的异步列表渲染
    await page.waitForTimeout(1100);
    const data = await page.evaluate(inPageAudit);
    data.requested = v;
    results.push(data);
  }
  await ctx.close();
  return { label, viewport, results, consoleErrors };
}

(async () => {
  const chrome = findChrome();
  if (!chrome) {
    console.error('✗ 未找到 Chrome/Chromium，可用 CHROME_PATH 指定');
    process.exit(2);
  }
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch {
    console.error('✗ 缺少 playwright-core（npm i -D playwright-core）');
    process.exit(2);
  }

  const { base, child } = await ensureServer();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  let report;
  try {
    const desktop = await auditViewport(browser, base, 'desktop', { width: 1280, height: 900 }, VIEWS);
    report = { base, chrome, passes: [desktop] };
    if (MOBILE) {
      const mobile = await auditViewport(browser, base, 'mobile', { width: 390, height: 844 }, PUBLIC_VIEWS);
      report.passes.push(mobile);
    }
  } finally {
    await browser.close().catch(() => {});
    if (child && !KEEP_SERVER) child.kill('SIGKILL');
  }

  const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
  report.reducedMotionDeclared = /@media[^{]*prefers-reduced-motion/.test(css);

  const issues = [];
  for (const pass of report.passes) {
    for (const r of pass.results) {
      // 权限页未登录会被弹窗拦截（requested=admin → landed=home），不是缺陷
      r.gated = r.requested !== r.view;
      if (r.gated) continue;
      if (r.horizontalOverflow > 0) issues.push({ pass: pass.label, view: r.requested, kind: 'horizontalOverflow', detail: r.horizontalOverflow + 'px' });
      r.clickStolen.forEach((x) => issues.push({ pass: pass.label, view: r.requested, kind: 'clickStolen', detail: x }));
      r.unnamedControls.forEach((x) => issues.push({ pass: pass.label, view: r.requested, kind: 'unnamedControls', detail: x }));
      r.offscreenX.forEach((x) => issues.push({ pass: pass.label, view: r.requested, kind: 'offscreenX', detail: x }));
      if (r.activeNavHidden) issues.push({ pass: pass.label, view: r.requested, kind: 'activeNavHidden', detail: '当前栏目被导航滚动容器裁出可视区' });
      if (pass.label === 'mobile') r.tinyTargets.forEach((x) => issues.push({ pass: pass.label, view: r.requested, kind: 'tinyTargets', detail: x }));
      if (r.motion === 0) issues.push({ pass: pass.label, view: r.requested, kind: 'motion', detail: '该视图可见元素无任何 transition/animation' });
    }
    pass.consoleErrors.forEach((t) => issues.push({ pass: pass.label, kind: 'consoleError', detail: t }));
  }
  report.issues = issues;

  if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const pass of report.passes) {
      log('\n===== ' + pass.label + ' ' + pass.viewport.width + 'x' + pass.viewport.height + ' =====');
      for (const r of pass.results) {
        if (r.gated) { log(`- ${r.requested.padEnd(8)} 权限页，未登录被拦回 ${r.view}（跳过）`); continue; }
        const bad = (r.horizontalOverflow > 0 ? 1 : 0) + r.clickStolen.length + r.unnamedControls.length + r.offscreenX.length
          + (r.activeNavHidden ? 1 : 0) + (pass.label === 'mobile' ? r.tinyTargets.length : 0) + (r.motion === 0 ? 1 : 0);
        log(`${bad ? '✗' : '✓'} ${r.requested.padEnd(8)} 控件=${String(r.visibleControls).padStart(3)} 动效=${String(r.motion).padStart(3)} 横向溢出=${r.horizontalOverflow} 点击被吃=${r.clickStolen.length} 无名称=${r.unnamedControls.length} 越界=${r.offscreenX.length} 导航裁切=${r.activeNavHidden ? 1 : 0}${pass.label === 'mobile' ? ' 小目标=' + r.tinyTargets.length : ''}`);
        r.clickStolen.slice(0, 6).forEach((x) => log(`    · 点击被吃：${x.el} ← ${x.hit} @${x.rect.join(',')}`));
        r.unnamedControls.slice(0, 6).forEach((x) => log(`    · 无名称：${x}`));
        r.offscreenX.slice(0, 6).forEach((x) => log(`    · 越界：${x.el} left=${x.left} right=${x.right}`));
        if (pass.label === 'mobile') r.tinyTargets.slice(0, 6).forEach((x) => log(`    · 小目标：${x.el} ${x.size.join('x')}`));
      }
      pass.consoleErrors.slice(0, 8).forEach((t) => log('    ! console: ' + t));
    }
    log('\nreduced-motion 声明: ' + (report.reducedMotionDeclared ? '有' : '**无**'));
    log('问题合计: ' + issues.length);
  }
  process.exit(issues.length ? 1 : 0);
})().catch((e) => {
  console.error('✗ 巡检异常：', e && e.stack || e);
  process.exit(2);
});
