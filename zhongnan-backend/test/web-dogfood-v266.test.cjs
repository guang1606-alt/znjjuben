/**
 * v2.266 dogfood 首轮收口（DEMO 8099 真实浏览器实证四处）—— 静态守卫 web/
 * 背景（证据见日报四十五段）：
 *  1. index.html 无 rel="icon"：每次加载 /favicon.ico 404（console 常驻错误）。
 *  2. /api/tags/dimensions 启动双发：applyLang 先调 syncTagBench()（内部 initTagBench
 *     首次取数并置 tagDimInited=true），随后 if (tagDimInited) 活读已置位的标志再取一次。
 *     修法：调用前捕获 const _tagDimWasInited = tagDimInited 快照，仅快照为真才补取
 *     （语言切换时仍需补取重填下拉，init 当轮不双发）。
 *  3. /api/updates/latest 双发：loadHomeUpdates（首页动态）与 initUpdateBanner（更新横幅）
 *     各自直取同端点同数据。修法：共享 fetchLatestAnnouncement（60s TTL + 在途合并），
 *     两处消费，全文件直调只剩帮助函数内部一处。
 *  4. nav 编剧室/递招/素材库断链（P1）：_showWorkbenchLayer 的 view-studio 守卫
 *    （aa95653 引入，本意拦后台任务迟到更新）把 openWorkbench 用户显式打开一并拦死——
 *     非创作专区视图点 nav 三个 data-open 按钮无任何反应（nav 高亮但面板被强制 re-hide）；
 *     首页 4 张工具卡（裸 openWorkbench）同死。修法：守卫下移到 MutationObserver 回调
 *    （只拦后台直达 classList 路径）+ 用户显式打开令牌 _workbenchOpenToken（openWorkbench
 *     设令牌，Observer 消费一次即放行；Promise.then 微任务排在 Observer 之后负责清除），
 *     且 Observer 先跳过 dataset.current === el.id（openWorkbench 同步兜底已打开）；
 *     _showWorkbenchLayer/openWorkbench 不再含守卫。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const srcRaw = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
// 剥行注释后再匹配代码形态（防注释文字击中断言造成假红）
const src = srcRaw.replace(/\/\/.*$/gm, '');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 2000));
}

describe('v2.266 dogfood：favicon 404 收口', () => {
  it('index.html 声明 rel="icon"（内联 SVG data URI，零额外请求）', () => {
    assert.ok(/<link[^>]+rel=["']icon["']/i.test(html),
      'index.html 应有 <link rel="icon">（否则每次加载 /favicon.ico 404）');
    assert.ok(/rel=["']icon["'][^>]+data:image\/svg\+xml/i.test(html) || /data:image\/svg\+xml[^>]+rel=["']icon["']/i.test(html),
      'favicon 应为内联 SVG data URI（不新增网络请求）');
  });
});

describe('v2.266 dogfood：/api/tags/dimensions 启动双发收口', () => {
  it('applyLang 在 syncTagBench() 之前固化 tagDimInited 快照，仅快照为真才补取', () => {
    const w = fnWindow('function applyLang', 'function renderStaticText');
    assert.ok(w, '应定位到 applyLang');
    const capPos = w.search(/const\s+_tagDimWasInited\s*=\s*tagDimInited/);
    assert.ok(capPos >= 0, 'applyLang 应声明 const _tagDimWasInited = tagDimInited 快照');
    const syncPos = w.indexOf('syncTagBench()');
    assert.ok(syncPos > capPos, '快照捕获必须在 syncTagBench() 调用之前（否则 init 当轮仍双发）');
    assert.ok(/if\s*\(\s*_tagDimWasInited\s*\)/.test(w),
      '补取条件应使用 _tagDimWasInited 快照而非活读 tagDimInited');
  });
});

describe('v2.266 dogfood：/api/updates/latest 双发收口', () => {
  it('存在共享 fetchLatestAnnouncement 帮助函数（60s TTL + 在途合并）', () => {
    assert.ok(/function\s+fetchLatestAnnouncement\s*\(/.test(src), '应定义 fetchLatestAnnouncement');
    const w = fnWindow('function fetchLatestAnnouncement', null, 1600);
    assert.ok(/_latestAnn/.test(w), '帮助函数应使用 _latestAnn* 缓存变量');
    assert.ok(/60000|60\s*\*\s*1000/.test(w), '帮助函数应有 60s TTL');
  });
  it('loadHomeUpdates 与 initUpdateBanner 均经共享帮助函数消费', () => {
    const w1 = fnWindow('async function loadHomeUpdates', null, 1200);
    assert.ok(/fetchLatestAnnouncement\(/.test(w1), 'loadHomeUpdates 应调 fetchLatestAnnouncement');
    const w2 = fnWindow('async function initUpdateBanner', null, 1200);
    assert.ok(/fetchLatestAnnouncement\(/.test(w2), 'initUpdateBanner 应调 fetchLatestAnnouncement');
  });
  it('全文件直调 /api/updates/latest 只剩帮助函数内部一处', () => {
    const direct = src.match(/Api\.request\(\s*'\/api\/updates\/latest'\s*\)/g) || [];
    assert.strictEqual(direct.length, 1, `直调 /api/updates/latest 应只剩 1 处（帮助函数内），实际 ${direct.length} 处`);
  });
});

describe('v2.266 dogfood：nav 编剧室/递招/素材库断链修复（守卫下移 Observer + 用户令牌）', () => {
  it('_showWorkbenchLayer 不再含 view-studio 守卫', () => {
    const w = fnWindow('function _showWorkbenchLayer', 'function _syncTopbarOffset');
    assert.ok(w, '应定位到 _showWorkbenchLayer');
    assert.ok(!/view-studio/.test(w),
      '_showWorkbenchLayer 内不应再有 view-studio 隐藏即 return 的守卫（会拦死用户点击）');
  });
  it('openWorkbench 不含 view-studio 守卫（用户显式打开不受拦）', () => {
    const w = fnWindow('function openWorkbench', 'function closeWorkbench');
    assert.ok(w, '应定位到 openWorkbench');
    assert.ok(!/view-studio/.test(w), 'openWorkbench 不应含 view-studio 守卫');
  });
  it('声明用户显式打开令牌 _workbenchOpenToken', () => {
    assert.ok(/let\s+_workbenchOpenToken\s*=\s*''/.test(src),
      "应声明 let _workbenchOpenToken = '';（openWorkbench 与 Observer 的一次性握手）");
  });
  it('openWorkbench 先设令牌再 remove hidden，且在 Promise.then 清令牌', () => {
    const w = fnWindow('function openWorkbench', 'function closeWorkbench');
    assert.ok(w, '应定位到 openWorkbench');
    const tokPos = w.indexOf('_workbenchOpenToken = id');
    assert.ok(tokPos >= 0, 'openWorkbench 应设 _workbenchOpenToken = id');
    const rmPos = w.indexOf("el.classList.remove('hidden')");
    assert.ok(rmPos > tokPos, '设令牌必须先于 remove hidden（Observer 凭令牌识别用户打开）');
    assert.ok(/Promise\.resolve\(\)\.then/.test(w),
      'openWorkbench 应在 Promise.resolve().then 清令牌（微任务排在 Observer 回调之后）');
  });
  it('Observer 回调独占 view-studio 守卫（拦后台直达 classList 路径）', () => {
    const w = fnWindow('new MutationObserver', '_WORKBENCH_PANEL_IDS.forEach((id) => {');
    assert.ok(w, '应定位到 MutationObserver 回调');
    assert.ok(/view-studio/.test(w), 'Observer 回调应含 view-studio 守卫（后台迟到更新不劫持其他视图）');
    assert.ok(/dataset\.current\s*===\s*el\.id/.test(w),
      'Observer 应先跳过 dataset.current === el.id（openWorkbench 同步兜底已打开，不再重复处理）');
    assert.ok(/_workbenchOpenToken\s*===\s*el\.id/.test(w),
      'Observer 应消费 _workbenchOpenToken 令牌放行用户显式打开（无令牌的后台路径才受守卫拦）');
  });
});
