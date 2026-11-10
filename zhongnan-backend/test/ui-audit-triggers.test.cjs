/**
 * v2.475 弹窗巡检覆盖守卫（test/ui-audit-triggers.test.cjs）
 *
 * 为什么需要：ui-audit.cjs --deep 过去对按需渲染的弹窗只能强开，读到空壳就跳过，
 * 「16 个弹窗没被真正检查过」这件事只写在注释里，下一轮很容易忘。本测试把覆盖要求
 * 变成机械断言：
 *   T1 页面里每个 .modal-mask[id] 都必须在 REAL_TRIGGERS 里出现（新增弹窗不能静默漏检）
 *   T2 REAL_TRIGGERS 不得残留页面里不存在的弹窗 id（避免目录腐化）
 *   T3 有真实入口的条目，其 #id 选择器必须真实存在于 index.html（防止入口改名后静默失效）
 *   T4 没有真实入口的条目必须写 needsData 说明盲区原因（"没覆盖"要显式，不许沉默）
 *   T5 巡检报告必须真的区分 triggeredBy / needsData / emptyModal（防止接线被删）
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ui-audit.cjs');
const HTML = path.join(ROOT, 'web', 'index.html');

const html = fs.readFileSync(HTML, 'utf8');
const src = fs.readFileSync(SCRIPT, 'utf8');

// 页面内全部 modal-mask 的 id（同一标签里 class/id 顺序无关）
const modalIds = [...html.matchAll(/<div[^>]*\bmodal-mask\b[^>]*>/g)]
  .map((m) => (m[0].match(/\bid="([^"]+)"/) || [])[1])
  .filter(Boolean);

// 解析 REAL_TRIGGERS 对象字面量（每行一个条目）
function parseTriggers() {
  const start = src.indexOf('const REAL_TRIGGERS = {');
  assert.ok(start >= 0, 'ui-audit.cjs 必须有 REAL_TRIGGERS 目录');
  const body = src.slice(start, src.indexOf('\n};', start));
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^\s{2}([A-Za-z0-9_]+):\s*\{(.*)\},?\s*$/);
    if (!m) continue;
    const [, id, rest] = m;
    // sel 数组里可能含 [attr] 形式的选择器，方括号需按「到数组右界」非贪婪匹配
    const selBlock = (rest.match(/sel:\s*\[(.*?)\]\s*(?:,|$)/) || [])[1] || '';
    out[id] = {
      sels: [...selBlock.matchAll(/'([^']+)'/g)].map((x) => x[1]),
      needsData: (rest.match(/needsData:\s*'([^']*)'/) || [])[1] || '',
      pres: [...((rest.match(/pre:\s*(\[[^\]]*\]|'[^']*')/) || [])[1] || '').matchAll(/'([^']+)'/g)].map((x) => x[1]),
    };
  }
  return out;
}

const triggers = parseTriggers();
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

// v2.478 运行时动态挂载的弹窗（如 wireQuickSwitcher 造的 qsMask）不在 index.html 里，
// 但巡检确实会枚举到它们；这类 id 由「变量.className='modal-mask…' + 变量.id='x'」推导，
// 否则给它们登记真实入口会被 T2 误判成「目录腐化」。
const appSrc = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const dynamicModalIds = [...appSrc.matchAll(/(\w+)\.className\s*=\s*'modal-mask[^']*'/g)]
  .map((m) => ((new RegExp('\\b' + m[1] + '\\.id\\s*=\\s*[\'"]([A-Za-z0-9_]+)[\'"]')).exec(appSrc) || [])[1])
  .filter(Boolean);
const knownModalIds = new Set([...modalIds, ...dynamicModalIds]);

test('T1 每个弹窗都必须有巡检策略（真实入口或 needsData 盲区登记）', () => {
  assert.ok(modalIds.length >= 18, '应能解析出全部弹窗，实际 ' + modalIds.length);
  const missing = modalIds.filter((id) => !triggers[id]);
  assert.deepStrictEqual(missing, [], '这些弹窗既无真实入口也无 needsData，属静默漏检：' + missing.join(','));
});

test('T2 REAL_TRIGGERS 不得残留页面里不存在的弹窗', () => {
  const stale = Object.keys(triggers).filter((id) => !knownModalIds.has(id));
  assert.deepStrictEqual(stale, [], '目录里有过期弹窗 id：' + stale.join(','));
});

test('T3 真实入口选择器必须能在 index.html 命中', () => {
  const bad = [];
  for (const [id, t] of Object.entries(triggers)) {
    for (const sel of t.sels) {
      if (sel.startsWith('#')) {
        if (!htmlIds.has(sel.slice(1))) bad.push(`${id} → ${sel}`);
      } else if (sel.startsWith('[')) {
        const attr = sel.replace(/^\[|\]$/g, '').split('=')[0];
        // v2.492 行内动态入口（如 [data-listen-id] / [data-view-purchase]）由 app.js 按需渲染，
        // 选择器校验必须同时覆盖 index.html 与 app.js，否则动态入口被误报「不存在」。
        const re = new RegExp('\\b' + attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (!re.test(html) && !re.test(appSrc)) bad.push(`${id} → ${sel}`);
      }
    }
    // 前置入口（pre，可为数组）里的 #id 同样必须存在
    for (const pre of t.pres) {
      const head = pre.trim().split(/\s+/)[0];
      if (head.startsWith('#') && !htmlIds.has(head.slice(1))) bad.push(`${id} → pre ${head}`);
    }
  }
  assert.deepStrictEqual(bad, [], '入口改名/删除后巡检会静默失效：' + bad.join(', '));
});

test('T4 无真实入口的弹窗必须显式登记 needsData', () => {
  const bad = Object.entries(triggers)
    .filter(([, t]) => t.sels.length === 0 && !t.needsData.trim())
    .map(([id]) => id);
  assert.deepStrictEqual(bad, [], '这些弹窗没有真实入口却没写盲区原因：' + bad.join(','));
});

test('T5 巡检报告必须接线 triggeredBy / needsData / emptyModal', () => {
  assert.match(src, /data\.triggeredBy\s*=\s*by/, '真实入口来源要写进报告');
  assert.match(src, /data\.needsData\s*=\s*spec\.needsData/, '盲区原因要写进报告');
  assert.match(src, /kind:\s*'emptyModal'/, '真实入口打开后空白必须判缺陷');
  // 脚本语法自检，避免守卫自身坏掉
  execFileSync(process.execPath, ['--check', SCRIPT], { stdio: 'ignore' });
});

// T6 防止「空数据被误判空壳」与「加载中未等待」两类假缺陷回归：
// 空壳判据必须单一入口 + 真实入口要等骨架消失，否者每轮都要人工复核噪声。
test('T6 空壳判据单一入口且真实入口等待内容渲染', () => {
  assert.match(src, /function isShell\(data, realTriggered\)/, '空壳判据必须集中为一个函数');
  assert.match(src, /data\.shell = isShell\(data, true\)/, '真实入口分支必须复用 isShell');
  assert.match(src, /data\.shell = isShell\(data, false\)/, '强开兜底分支必须复用 isShell');
  assert.match(src, /sk-list\[aria-busy="true"\]/, '必须能识别加载骨架');
  assert.match(src, /overlayEmptyState|overlayReady/, '必须采样空态/已渲染标记，避免空数据误报');
});

// T7 v2.482 深链形态必须进入巡检：v2.480 的离线壳失效只在深链文档下出现，
// 而旧巡检只从 /#/<view> 进站，永远踩不到。这里锁死「深链地址被真正访问 + 启动完整性被判定」。
test('T7 深链形态（路径/多级/哈希/查询串）必须被真实访问并判定启动完整性', () => {
  assert.match(src, /const DEEP_LINKS = \[/, '必须有深链地址目录 DEEP_LINKS');
  const block = src.slice(src.indexOf('const DEEP_LINKS = ['), src.indexOf('];', src.indexOf('const DEEP_LINKS = [')));
  for (const p of ['/works/12345', '/market/a/b', '/#/works/12345', '/market?id=123', '/#/works?id=123']) {
    assert.ok(block.includes("'" + p + "'"), '深链目录缺少 ' + p + '（覆盖路径/多级/哈希/查询串四类）');
  }
  assert.match(src, /async function auditDeepLinks\(/, '必须有深链巡检函数');
  assert.match(src, /auditDeepLinks\(browser, base, \{ width: 1280/, '桌面巡检必须接线深链检查');
  assert.match(src, /data\.assetFailures = assetFailures/, '必须记录深链下的资源加载失败');
  assert.match(src, /data\.appBooted = /, '必须判定应用是否启动');
  assert.match(src, /data\.navReady = /, '必须判定导航是否就绪');
  assert.match(src, /kind: 'deepLinkAssetFail'/, '资源 4xx 必须判缺陷');
  assert.match(src, /kind: 'deepLinkNotBooted'/, '未启动必须判缺陷');
  // v2.490 查询串形态：只启动不算通过，哈希段是白名单视图时必须落到该视图
  assert.match(src, /data\.expectedView = expectedViewOf\(p\)/, '必须推导期望落点');
  assert.match(src, /data\.landedView = /, '必须记录实际落点');
  assert.match(src, /kind: 'deepLinkViewMismatch'/, '落点不符必须判缺陷');
  // 深链不得被「落地视图 = 请求视图」的权限页豁免误跳过
  assert.match(src, /if \(!r\.isModal && !r\.deepLink\)/, '深链结果不得走 gated 跳过分支');
});

// T8 v2.492 九个原 needsData 盲区弹窗必须全部升级为真实入口。
// dev-server 已种演示内容（demo_proj_1 成稿 / demo_ls_1 在架 / demo_purchase_1 已购结算），
// 作品详情页补齐了 PK/价值证书/导演交付包/物料的回访入口，studio 补了成熟授权管理入口，
// 再标 needsData 等于把「已覆盖」登记成「盲区」，巡检报告会直接撒谎。
const FORMER_BLIND = ['pkModal', 'valueModal', 'detailModal', 'listModal', 'listenModal', 'fullModal', 'dpModal', 'matModal', 'xMatureModal'];
test('T8 九个原盲区弹窗必须有真实入口，且不得再标 needsData', () => {
  const bad = FORMER_BLIND.filter((id) => {
    const t = triggers[id];
    return !t || !t.sels.length || t.needsData.trim();
  });
  assert.deepStrictEqual(bad, [], '这些弹窗仍未真实覆盖（缺 sel 或仍标 needsData）：' + bad.join(','));
});

test('T9 dev-server 必须种演示内容（项目+成稿+在架 listing+已购订单）', () => {
  const dev = fs.readFileSync(path.join(ROOT, 'src', 'dev-server.ts'), 'utf8');
  for (const k of ['seedDemoContent', 'demo_proj_1', 'demo_script_1', 'demo_ls_1', 'demo_purchase_1']) {
    assert.ok(dev.includes(k), 'dev-server 缺演示种子：' + k + '（真实入口巡检的数据地基）');
  }
});

// T10 真实入口的前端半边：作品详情页必须有回访可用的增值工具按钮，studio 必须有成熟授权管理入口；
// 且接线必须复用创作台原 open 函数（先锁定 currentProjectId），不得另造平行实现。
test('T10 作品详情增值工具与成熟授权管理入口必须存在并正确接线', () => {
  for (const id of ['worksPkBtn', 'worksValueBtn', 'worksDpBtn', 'worksMatBtn', 'matureManageBtn']) {
    assert.ok(htmlIds.has(id), 'index.html 缺入口 #' + id);
  }
  assert.match(appSrc, /currentProjectId = currentWorksProject\.id/,
    '回访老作品必须先锁定项目上下文，否则 openPk/openValueCard 等读不到 currentProjectId 直接弹「先生成剧本」');
  for (const [btn, fn] of [['worksPkBtn', 'openPk'], ['worksValueBtn', 'openValueCard'], ['worksDpBtn', 'openDirectorPack'], ['worksMatBtn', 'openMaterials']]) {
    assert.ok(appSrc.includes(`$('${btn}').onclick = withWorksProject(${fn})`), `${btn} 必须经 withWorksProject 接 ${fn}`);
  }
  assert.match(appSrc, /\$\('matureManageBtn'\)\.onclick = \(\) => openXMature\(\)/, 'matureManageBtn 必须接 openXMature');
  assert.match(appSrc, /worksVaRow'\)\.classList\.toggle\('hidden', !eps\.length\)/, '无成稿项目不得显示增值工具行');
});

// v2.493 弹窗层级守卫：全站 17 个弹窗都写在 #view-market 里、又被 .wrap 包围，
// .wrap 一旦重新带上 z-index 就会创建层叠上下文，把遮罩的 z-index 困在层级 1 内，
// sticky 顶栏（40）与页脚会盖住关闭键/保存键（实测 feedbackModal × 与 listModal 保存被吃）。
// 这条守卫把「遮罩必须压在页面常驻栏之上」钉成静态约束，避免以后调样式时静默回归。
test('T11 弹窗遮罩层级必须高于顶栏与页脚，.wrap 不得创建层叠上下文', () => {
  const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
  const maskZ = Number((css.match(/\.modal-mask\{[^}]*z-index:\s*(\d+)/) || [])[1]);
  const topZ = Number((css.match(/\.topbar\s*\{[^}]*z-index:\s*(\d+)/) || [])[1]);
  assert.ok(maskZ > 0 && topZ > 0, '未解析到 .modal-mask / .topbar 的 z-index');
  assert.ok(maskZ > topZ, `遮罩 z-index(${maskZ}) 必须高于顶栏(${topZ})`);
  const wrapRule = (css.match(/\.wrap\{[^}]*\}/g) || []).join(' ');
  assert.match(wrapRule, /z-index:\s*auto/, '.wrap 必须保持 z-index:auto，否则会把遮罩困在自身层叠上下文内');
});

// v2.494 可访问性与锚点跳转守卫：
// 1) #xnFloat 是纯 emoji（🐼）悬浮球，title 在部分读屏下不被当作可访问名，必须显式 aria-label；
// 2) html 必须有 scroll-padding-top，否则 skip-link（href="#mainContent"）跳转后主内容被 sticky 顶栏盖住。
test('T12 悬浮球必须有 aria-label，html 必须有 scroll-padding-top 防止锚点跳转被顶栏遮挡', () => {
  const xnFloat = html.match(/<button[^>]*\bid="xnFloat"[^>]*>/);
  assert.ok(xnFloat, 'index.html 缺 #xnFloat 悬浮球');
  assert.match(xnFloat[0], /\saria-label="[^"]+"/, '#xnFloat 必须有非空 aria-label（纯 emoji 按钮，title 不足以覆盖读屏）');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
  const htmlRule = (css.match(/html\s*\{[^}]*\}/) || [])[0] || '';
  assert.match(htmlRule, /scroll-padding-top:\s*\d+/, 'html 必须有 scroll-padding-top，否则 skip-link 跳到 #mainContent 时被 sticky 顶栏盖住');
});

