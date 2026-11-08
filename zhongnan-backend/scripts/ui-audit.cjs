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
 *   node scripts/ui-audit.cjs --deep          # 追加登录态巡检（PRO + 超管账号）与全部弹窗内部巡检
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
 *
 * --deep 追加（登录态 + 弹窗）：
 *   用 dev-server 预置账号（PRO / 超管，密码 demo123456）经 /api/auth/login 拿令牌，
 *   按 web/api.js 的 store 口径（JSON.stringify）写入 localStorage 后重跑全部视图；
 *   并动态枚举页面内全部 `.modal-mask[id]` 巡检。v2.475 起按 REAL_TRIGGERS 走真实入口，
 *   让按需渲染的弹窗进入内容态后再审计；无法由演示数据到达的入口显式登记 needsData，
 *   不允许静默遗漏（新增弹窗若既无真实入口也无 needsData，静态守卫测试会失败）。
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
const DEEP = !!arg('--deep', false);
const JSON_ONLY = !!arg('--json', false);
const KEEP_SERVER = !!arg('--keep', false);
// dev-server 预置演示账号（见 src/dev-server.ts）：PRO 与超管，密码统一 demo123456
const DEMO = {
  pro: { phone: '13900000004', password: 'demo123456' },
  admin: { phone: '18891995171', password: 'demo123456' },
};

// v2.475 真实触发器目录：按需渲染的弹窗强开只会读到空壳，必须走真实入口让 open 函数把内容渲出来。
// 字段：view=先切到的路由；pre=先点的前置入口（可传数组，按序点）；sel=触发入口（按序取第一个可见的）；
//       needsAuth=需登录态才可触发；guestOnly=仅未登录态；needsData=演示数据不足时的显式盲区说明。
// 约定：有 sel 的必须能真实打开；没有 sel 的必须写 needsData —— 不允许"静默未覆盖"。
// 注意：二级配置栏（资产库/系统默认提示）默认 hidden，需先点一张模式卡（#modeGrid .mode-card）才挂载。
const REAL_TRIGGERS = {
  authModal: { view: 'home', sel: ['#loginBtn'], guestOnly: true },
  sampleModal: { view: 'home', sel: ['#homeSampleBtn', '#sampleEntryBtn'] },
  feedbackModal: { view: 'home', sel: ['#feedbackEntryBtn'] },
  castLibModal: { view: 'studio', pre: '#modeGrid .mode-card', sel: ['#castLibBtn'] },
  propLibModal: { view: 'studio', pre: '#modeGrid .mode-card', sel: ['#propLibBtn'] },
  sceneLibModal: { view: 'studio', pre: '#modeGrid .mode-card', sel: ['#sceneLibBtn'] },
  smartModal: { view: 'studio', pre: '#modeGrid .mode-card', sel: ['#smartDefaultBtn'], needsAuth: true },
  xnChatModal: { view: 'home', sel: ['#xnFloat'], needsAuth: true },
  mineModal: { view: 'market', sel: ['#mkMineBtn'], needsAuth: true },
  // 资产看板按钮嵌在资产库弹窗内：先选模式 → 开库 → 点看板（看板本身需登录，游客只能看到 needLogin）
  assetDashboardModal: { view: 'studio', pre: ['#modeGrid .mode-card', '#castLibBtn'], sel: ['[data-open-dash]'], needsAuth: true },
  // 以下入口依赖已生成剧本/已购交易，演示账号无从到达 → 显式登记，等有数据再自动升级为真实入口
  pkModal: { view: 'studio', sel: [], needsData: '需先生成剧本（openPk 无 currentProjectId 直接提示）' },
  valueModal: { view: 'studio', sel: [], needsData: '需先生成剧本（openValueCard 无 projectId 直接提示）' },
  detailModal: { view: 'market', sel: [], needsData: '交易广场无上架作品（演示库为空）' },
  listModal: { view: 'market', sel: [], needsAuth: true, needsData: '账号无自己的剧本可上架' },
  listenModal: { view: 'works', sel: [], needsData: '账号无成稿项目可听' },
  fullModal: { view: 'market', sel: [], needsData: '无已购剧本全文' },
  dpModal: { view: 'studio', sel: [], needsData: '无生成项目（需先跑一集）' },
  matModal: { view: 'studio', sel: [], needsData: '无生成项目（需先跑一集）' },
  xMatureModal: { view: 'studio', sel: [], needsData: '需触发成熟题材拦截（生成前）' },
};

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
  // 只检查罩内控件，避免整页误报。嵌套弹窗（如资产库上叠资产看板）必须取 DOM 最后的可见层，
  // 否则会拿被压在下面的弹窗当遮罩，把"上层正常覆盖下层"误判成点击被吃。
  const overlays = [...document.querySelectorAll('.modal-mask:not(.hidden), .modal.open, .overlay.open, .ui-dlg-overlay, #workbenchLayer:not(.hidden)')];
  const overlay = overlays.length ? overlays[overlays.length - 1] : null;
  const overlayOpen = overlay ? desc(overlay) : '';
  let overlayControls = 0;
  let overlayTextLen = 0;
  let overlayVisibleNodes = 0;
  // 内容态 ≠ 内容丰富：空数据弹窗（无购买/无上架/无素材）本身就只有几行空态文字，
  // 用纯文本长度判空壳会误报。真正的「空壳」只有两种：①仍停在加载骨架；②什么都没渲染。
  // 因此额外采样骨架与空态标记，并允许 open 函数用 data-content-ready 显式声明「已渲染完成」。
  let overlaySkeleton = false;
  let overlayEmptyState = false;
  let overlayReady = false;
  if (overlay) {
    overlayControls = nodes.filter((el) => overlay.contains(el) && painted(el)).length;
    // 内容态判定不能只看交互控件：看板/统计类弹窗可能整屏是图表文字、只有一个关闭按钮。
    // 用可见文本长度 + 可见节点数作为「有没有渲染出内容」的判据。
    overlayTextLen = (overlay.innerText || '').replace(/\s+/g, ' ').trim().length;
    overlayVisibleNodes = [...overlay.querySelectorAll('*')].filter((el) => painted(el)).length;
    overlaySkeleton = !!overlay.querySelector('.sk-list[aria-busy="true"], .skeleton');
    overlayEmptyState = !!overlay.querySelector('.zn-empty, .muted, [class*="empty"]');
    overlayReady = overlay.getAttribute('data-content-ready') === '1';
  }

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

  // 被可滚动祖先裁到可视区外（如弹窗底部按钮需滚动才能看到）：视口坐标仍在页内，
  // 但该点命中的是容器/遮罩而非按钮本身，属"滚动可达"，不是点击被吃，必须跳过。
  const clippedByAncestor = (el, r) => {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let n = el.parentElement;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      const scrollY = s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll';
      const scrollX = s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll';
      if (scrollY || scrollX) {
        const nr = n.getBoundingClientRect();
        if (scrollY && (cy < nr.top || cy > nr.bottom)) return true;
        if (scrollX && (cx < nr.left || cx > nr.right)) return true;
      }
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
    if (clippedByAncestor(el, r)) continue; // 滚动容器裁切，滚动可达
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
    overlayControls,
    overlayTextLen,
    overlayVisibleNodes,
    activeNavHidden,
    view: (location.hash || '').replace(/^#\/?/, '') || 'home',
  };
}

async function auditViewport(browser, base, label, viewport, views, cred) {
  const ctx = cred
    ? await newAuthedContext(browser, base, cred, viewport)
    : await browser.newContext({ viewport, deviceScaleFactor: 1 });
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

// 登录拿令牌：写进 localStorage 前必须与 web/api.js 的 store 同口径（JSON.stringify）
async function login(base, cred) {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cred),
  });
  if (!r.ok) throw new Error('登录失败 ' + cred.phone + ' → HTTP ' + r.status);
  return r.json();
}

async function newAuthedContext(browser, base, cred, viewport) {
  const s = await login(base, cred);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([a, rf, u]) => {
    try {
      localStorage.setItem('zn_token', JSON.stringify(a));
      localStorage.setItem('zn_refresh', JSON.stringify(rf));
      localStorage.setItem('zn_user', JSON.stringify(u));
    } catch { /* 隐私模式忽略，巡检退化为未登录 */ }
  }, [s.accessToken, s.refreshToken, s.user]);
  return ctx;
}

/**
 * 空壳判据（单一入口，避免两处阈值漂移）：
 * - 真实入口打开的弹窗：由 open 函数自己渲染，若已声明 data-content-ready 或已渲染空态/正常内容，
 *   即算内容态；只有仍停留骨架才算空壳。空数据弹窗（无购买/无上架/无素材）文本天然很短，
 *   不能用统一文本阈值判空壳。
 * - 强开兜底：没有 open 函数执行，只有阈值可依。
 */
function isShell(data, realTriggered) {
  if (realTriggered && (data.overlayReady || data.overlayEmptyState) && !data.overlaySkeleton) return false;
  if (realTriggered && data.overlaySkeleton) return true;
  return data.overlayControls <= 1 && data.overlayTextLen < 60 && data.overlayVisibleNodes < 12;
}

// 全部弹窗内部巡检：动态枚举页面里的 .modal-mask（不硬编码 id，新增弹窗自动覆盖）。
// v2.475 起先走真实入口（REAL_TRIGGERS）让按需渲染的弹窗进入内容态再审计；
// 没有真实入口可走的强开兜底，空壳标 shell，演示数据不足的按 needsData 登记盲区。
async function auditModals(browser, base, cred, viewport) {
  const ctx = cred
    ? await newAuthedContext(browser, base, cred, viewport)
    : await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 200)));

  await page.goto(base + '/#/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);

  const results = [];
  // 可靠收起：先点弹窗内关闭键走正常路径，再强制补 hidden ——
  // 只靠 [data-close] 时有的弹窗关闭键是异步/改状态，没真正隐藏会让下一个弹窗叠在上面，
  // 制造"点击被吃"整批假象（实测 xnChat/资产库叠在 auth 上）。
  const hideAllModals = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-mask').forEach((m) => m.classList.add('hidden'));
    });
    await page.waitForTimeout(80);
  };
  const closeModal = async (mid) => {
    await page.evaluate((id) => {
      const m = document.getElementById(id);
      if (!m) return;
      const c = m.querySelector('[data-close]');
      if (c) c.click();
    }, mid);
    await page.waitForTimeout(150);
    await hideAllModals();
  };

  // 1) 真实入口：内容态审计
  for (const [id, spec] of Object.entries(REAL_TRIGGERS)) {
    const guest = !cred;
    if (spec.guestOnly && !guest) continue; // 登录后登录按钮已换成用户菜单
    if (spec.needsAuth && guest) continue;  // 未登录会被引导去登录，入口无法到达内容态
    if (!spec.sel || !spec.sel.length) continue;

    await hideAllModals(); // 每个入口前先回到干净状态，避免上一个弹窗叠着挡住命中测试
    if (spec.view) {
      await page.evaluate((v) => { location.hash = '#/' + v; }, spec.view);
      await page.waitForTimeout(500);
    }
    const pres = Array.isArray(spec.pre) ? spec.pre : (spec.pre ? [spec.pre] : []);
    for (const pre of pres) {
      await page.evaluate((s) => {
        // 同一选择器可能命中多个（如三个资产库各自的看板按钮），取第一个可见的
        const el = [...document.querySelectorAll(s)].find((n) => {
          const r = n.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (el) el.click();
      }, pre);
      await page.waitForTimeout(450);
    }

    let by = '';
    for (const sel of spec.sel) {
      // 入口可能是异步渲染/请求拉数据后才出内容：元素晚挂载或弹窗晚打开都重试一轮，
      // 避免把"还没渲染"误判成"不可达"。
      for (let attempt = 0; attempt < 3 && !by; attempt++) {
        const clicked = await page.evaluate((s) => {
          const el = [...document.querySelectorAll(s)].find((n) => {
            const r = n.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (!el) return false;
          el.click();
          return true;
        }, sel);
        await page.waitForTimeout(attempt ? 900 : 650);
        const shown = await page.evaluate((mid) => {
          const m = document.getElementById(mid);
          return !!m && !m.classList.contains('hidden');
        }, id);
        if (shown) by = sel;
        if (!clicked && attempt >= 1) break; // 连续两轮都找不到可见入口才放弃
      }
      if (by) break;
    }
    if (!by) continue; // 打不开就退回强开兜底，由 needsData/shell 说明

    // 弹窗已打开 ≠ 内容已渲染：多数 open 函数先 openModal 再请求数据，
    // 骨架还没换成内容时抽样会把"正在加载"误判成空壳。等骨架消失（最多 4s）再审计。
    for (let w = 0; w < 8; w++) {
      const busy = await page.evaluate((mid) => {
        const m = document.getElementById(mid);
        return !!m && !!m.querySelector('.sk-list[aria-busy="true"]');
      }, id);
      if (!busy) break;
      await page.waitForTimeout(500);
    }

    const data = await page.evaluate(inPageAudit);
    data.requested = 'modal:' + id;
    data.isModal = true;
    data.triggeredBy = by;
    data.shell = isShell(data, true);
    results.push(data);
    await closeModal(id);
  }

  const done = new Set(results.map((r) => r.requested.replace('modal:', '')));

  // 2) 其余弹窗：强开兜底（内容按需渲染的标 shell；演示数据不足的标 needsData）
  const ids = await page.evaluate(() => [...document.querySelectorAll('.modal-mask[id]')].map((m) => m.id));
  for (const id of ids) {
    if (done.has(id)) continue;
    // 登录态下 authModal 无法由真实入口打开（登录按钮已换成用户菜单），强开只会读到空标签
    if (id === 'authModal' && cred) continue;
    await hideAllModals();
    const shown = await page.evaluate((mid) => {
      const m = document.getElementById(mid);
      if (!m) return false;
      m.classList.remove('hidden');
      return true;
    }, id);
    if (!shown) continue;
    await page.waitForTimeout(150);
    const data = await page.evaluate(inPageAudit);
    data.requested = 'modal:' + id;
    data.isModal = true;
    const spec = REAL_TRIGGERS[id] || {};
    data.needsData = spec.needsData || '';
    // 空壳（只有标题+关闭键）：内容由各自 open 函数按需渲染，强开无意义，标记跳过
    data.shell = isShell(data, false);
    results.push(data);
    await closeModal(id);
  }
  await ctx.close();
  return { label: cred ? 'modals:pro' : 'modals', viewport, results, consoleErrors };
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
    if (DEEP) {
      // 登录态：PRO 覆盖全部 8 视图（含作品/市场/后台入口），超管单独看后台
      report.passes.push(await auditViewport(browser, base, 'deep:pro', { width: 1280, height: 900 }, VIEWS, DEMO.pro));
      report.passes.push(await auditViewport(browser, base, 'deep:admin', { width: 1280, height: 900 }, ['admin'], DEMO.admin));
      if (MOBILE) {
        report.passes.push(await auditViewport(browser, base, 'deep:pro-mobile', { width: 390, height: 844 }, PUBLIC_VIEWS, DEMO.pro));
      }
      // 全部弹窗内部：未登录态用真实登录入口打开 authModal；其余强开，空壳（内容按需渲染）标记跳过
      report.passes.push(await auditModals(browser, base, null, { width: 1280, height: 900 }));
      report.passes.push(await auditModals(browser, base, DEMO.pro, { width: 1280, height: 900 }));
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
      // 权限页未登录会被弹窗拦截（requested=admin → landed=home），不是缺陷；弹窗巡检不看落地视图
      if (!r.isModal) {
        r.gated = r.requested !== r.view;
        if (r.gated) continue;
      }
      // 真实入口打不开内容（点了入口却仍只有关闭键）= 点击无效/空白弹窗，是真缺陷不是盲区
      if (r.triggeredBy && r.shell) issues.push({ pass: pass.label, view: r.requested, kind: 'emptyModal', detail: '真实入口 ' + r.triggeredBy + ' 打开后无内容控件' });
      if (r.shell) continue; // 空壳弹窗（内容由 open 函数按需渲染）不强判
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
        if (r.needsData) { log(`- ${r.requested.padEnd(22)} 需数据未覆盖：${r.needsData}`); continue; }
        if (r.shell) { log(`- ${r.requested.padEnd(22)} 空壳弹窗（内容按需渲染，跳过）`); continue; }
        const bad = (r.horizontalOverflow > 0 ? 1 : 0) + r.clickStolen.length + r.unnamedControls.length + r.offscreenX.length
          + (r.activeNavHidden ? 1 : 0) + (pass.label === 'mobile' ? r.tinyTargets.length : 0) + (r.motion === 0 ? 1 : 0);
        log(`${bad ? '✗' : '✓'} ${r.requested.padEnd(8)} 控件=${String(r.visibleControls).padStart(3)} 动效=${String(r.motion).padStart(3)} 横向溢出=${r.horizontalOverflow} 点击被吃=${r.clickStolen.length} 无名称=${r.unnamedControls.length} 越界=${r.offscreenX.length} 导航裁切=${r.activeNavHidden ? 1 : 0}${pass.label === 'mobile' ? ' 小目标=' + r.tinyTargets.length : ''}${r.triggeredBy ? ' 入口=' + r.triggeredBy : ''}`);
        r.clickStolen.slice(0, 6).forEach((x) => log(`    · 点击被吃：${x.el} ← ${x.hit} @${x.rect.join(',')}`));
        r.unnamedControls.slice(0, 6).forEach((x) => log(`    · 无名称：${x}`));
        r.offscreenX.slice(0, 6).forEach((x) => log(`    · 越界：${x.el} left=${x.left} right=${x.right}`));
        if (pass.label === 'mobile') r.tinyTargets.slice(0, 6).forEach((x) => log(`    · 小目标：${x.el} ${x.size.join('x')}`));
      }
      pass.consoleErrors.slice(0, 8).forEach((t) => log('    ! console: ' + t));
    }
    log('\nreduced-motion 声明: ' + (report.reducedMotionDeclared ? '有' : '**无**'));
    if (issues.length) {
      log('\n问题明细：');
      issues.forEach((x) => {
        const detail = typeof x.detail === 'string' ? x.detail : JSON.stringify(x.detail);
        log(`  ✗ [${x.pass}] ${x.view || '-'} ${x.kind}：${detail}`);
      });
    }
    log('问题合计: ' + issues.length);
  }
  process.exit(issues.length ? 1 : 0);
})().catch((e) => {
  console.error('✗ 巡检异常：', e && e.stack || e);
  process.exit(2);
});
