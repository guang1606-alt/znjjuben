'use strict';
/* v2.695 创作端走查守口：
 * ① 模式卡/引擎/剧本类型过去把内部「评议建议…共识 67%」直接挂成 tooltip，普通用户悬停即见内部黑话；
 *    改为仅内部账户可见评议摘要，普通用户的锁定项只给「需 X 会员」的直白提示。
 * ② 390px 二级界面头部把返回键/标题/成本徽标挤在一行，标题列只剩 ~140px，四字标题折成竖条；
 *    窄屏改为返回键独占首行、徽标贴右上、标题与说明独占整行。
 * ③ 作品列表点卡片后详情在首屏之外展开，手感等同「点了没反应」；列表入口须把详情头滚进视野。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const I18N = require(path.join(ROOT, 'web/i18n.js'));

function fnBody(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到 function ' + name);
  const end = APP.indexOf('\n  }', start);
  assert.ok(end > start, '未找到 function ' + name + ' 的结尾');
  return APP.slice(start, end + 4);
}

test('v2.695 councilText：普通用户不返回评议摘要，内部账户仍保留可审计说明', () => {
  const src = fnBody('councilText');
  const hints = { 'mode:tag': { zh: '评议建议「免费」，主席裁定维持（共识 100%）。', en: 'Council suggests Free (consensus 100%).' } };
  const normal = vm.runInNewContext(src + '\n; councilText;', { councilHints: hints, lang: 'zh', isStaffAcct: () => false });
  assert.equal(normal('mode:tag'), '', '普通用户不得看到内部评议口径');
  const staff = vm.runInNewContext(src + '\n; councilText;', { councilHints: hints, lang: 'en', isStaffAcct: () => true });
  assert.match(staff('mode:tag'), /Council suggests/, '内部账户保留英文审计说明');
});

test('v2.695 模式卡：普通用户悬停无内部黑话，锁定项给出「需 X 会员」', () => {
  const grid = { innerHTML: '', children: [], appendChild(el) { this.children.push(el); } };
  const cards = [];
  const ctx = {
    I18N, window: { I18N }, lang: 'zh', $: (id) => (id === 'modeGrid' ? grid : null), document: {
      getElementById: (id) => (id === 'modeGrid' ? grid : null),
      querySelector: () => ({ textContent: '' }),
      createElement: () => { const el = { className: '', innerHTML: '', title: '', onclick: null }; cards.push(el); return el; },
    },
    _RANK: { free: 0, basic: 1, advanced: 2, pro: 3, paid: 3 },
    meCache: { level: 'BASIC' }, isStaffAcct: () => false, acctRank: () => 1,
    councilHints: { 'mode:tag': { zh: '评议建议「免费」，与现行「免费」一致（共识 100%）。', en: 'x' } },
    znBindGrid() {}, modeAvailability: () => ({ available: 2, total: 9, locked: 7 }), t: (k) => k,
    selectedMode: 'tag', clearDraftProject() {}, syncTagBench() {}, syncModeBrief() {}, showModeDetail() {},
    openXMature() {}, escapeHtml: (s) => String(s), switchView() {}, xnSay() {},
  };
  vm.createContext(ctx);
  vm.runInContext(fnBody('councilText'), ctx);
  vm.runInContext(fnBody('renderModes'), ctx);
  ctx.renderModes();
  assert.equal(cards.length, I18N.MODES.length, '每个模式都应渲染一张卡');
  cards.forEach((c) => assert.ok(!/评议建议|共识|主席裁定|Council suggests/.test(c.title || ''), '普通用户卡片不得出现内部评议措辞'));
  const locked = cards.filter((c) => /tier-lock/.test(c.className));
  assert.ok(locked.length > 0, '基础档应有锁定模式');
  locked.forEach((c) => assert.match(c.title, /需.+会员/, '锁定卡须直白说明所需档位'));
  const staffCards = [];
  const staffCtx = { ...ctx, meCache: { staff: true }, isStaffAcct: () => true, acctRank: () => 3,
    document: { ...ctx.document, createElement: () => { const el = { className: '', innerHTML: '', title: '', onclick: null }; staffCards.push(el); return el; } } };
  vm.createContext(staffCtx);
  vm.runInContext(fnBody('councilText'), staffCtx);
  vm.runInContext(fnBody('renderModes'), staffCtx);
  staffCtx.renderModes();
  assert.ok(staffCards.some((c) => /评议建议/.test(c.title || '')), '内部账户仍可在卡片上看到评议摘要');
});

test('v2.695 窄屏二级界面头部：返回键与徽标共占首行，标题独占整行', () => {
  const idx = CSS.indexOf('.mode-back { flex: 1 1 auto; margin-top: 0; }');
  assert.ok(idx > 0, 'styles.css 缺少窄屏返回键让位规则');
  const before = CSS.slice(Math.max(0, idx - 700), idx);
  assert.match(before, /@media \(max-width: 560px\)/, '该规则必须落在 560px 断点内');
  assert.match(CSS, /\.mode-detail-cost \{ order: 2; margin: 0; \}/, '徽标须排在首行右侧');
  assert.match(CSS, /\.mode-detail-title \{ order: 3; flex: 1 1 100%; \}/, '标题须换到下一行并独占整行');
});

test('v2.695 作品列表入口打开详情时显式滚动，刷新路径不抢滚动', () => {
  assert.match(APP, /openProject\(p, \{ reveal: true \}\)/, '列表卡片点击须传 reveal');
  const open = APP.slice(APP.indexOf('async function openProject('));
  assert.match(open.slice(0, 1400), /if \(!opts\.reveal\) return;/, 'openProject 须按 reveal 决定是否滚动');
  assert.match(open.slice(0, 1400), /scrollIntoView\(\{ behavior: reduce \? 'auto' : 'smooth', block: 'start' \}\)/, '滚动到详情头并尊重降动效');
});

// v2.696 实测 390px 灵感式创作的生成按钮落在 y≈3277，桌面也落在两屏之后。
// 行动区只重组既有真实控件，不复制生成逻辑或费用真源。
test('v2.696 生成决策区聚合唯一费用、额度修正与生成控件', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
  const start = html.indexOf('<div class="gen-action-dock" id="genActionDock">');
  assert.ok(start >= 0, '缺少生成决策区容器');
  const dock = html.slice(start, html.indexOf('\n      </section>', start));
  const cost = dock.indexOf('id="genCostHint"');
  const fix = dock.indexOf('id="genCostFix"');
  const gen = dock.indexOf('id="genBtn"');
  assert.ok(cost >= 0 && fix > cost && gen > fix, '费用 → 额度修正 → 生成必须按决策顺序同组');
  for (const id of ['genCostHint', 'genCostFix', 'genBtn']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} 不得复制出第二套状态`);
  }
});

test('v2.696 桌面生成决策区 sticky 可达，配置栏本身仍不 sticky', () => {
  const start = CSS.indexOf('.gen-action-dock {');
  assert.ok(start >= 0, '缺少桌面生成决策区样式');
  const base = CSS.slice(start, CSS.indexOf('}', start) + 1);
  assert.match(base, /position: sticky;/, '桌面行动区应在首屏下缘吸附');
  assert.match(base, /bottom: 12px;/, '桌面行动区须留视口呼吸间距');
  assert.match(CSS, /\.mode-detail-side #genConfigBar \{ position: static; box-shadow: none; \}/, '不得恢复整条配置栏 sticky');
});

test('v2.696 窄屏生成决策区固定到拇指区，避让键盘/悬浮按钮并尊重降动效', () => {
  const base = CSS.indexOf('.gen-action-dock {');
  const start = CSS.indexOf('@media (max-width: 900px)', base);
  assert.ok(start > base, '窄屏规则须在桌面行动区之后覆盖');
  const mobileEnd = CSS.indexOf('@media (prefers-reduced-motion: reduce)', start);
  assert.ok(mobileEnd > start, '窄屏行动区规则须有明确终点，避免跨区误匹配');
  const mobile = CSS.slice(start, mobileEnd);
  assert.match(mobile, /position: fixed;/, '窄屏行动区必须脱离四屏长表单固定可达');
  assert.match(mobile, /right: 82px;/, '右侧须给现有小南与回顶按钮留工具轨道');
  assert.match(mobile, /width: auto;/, '固定行动区须解除 width:100%，否则 right 避让会被 CSS 过约束忽略');
  assert.match(mobile, /var\(--kb-inset, 0px\)/, '行动区须随真实键盘高度抬升');
  assert.match(mobile, /env\(safe-area-inset-bottom, 0px\)/, '行动区须避让底部安全区');
  assert.match(mobile, /min-height: 48px;/, '主生成按钮不得小于 48px 触控高度');
  assert.match(mobile, /#view-studio\.active[\s\S]*?animation: none/, '视图祖先的 transform 动画须关闭，否则 fixed 会相对视图定位');
  assert.match(mobile, /\.mode-detail-side > #genConfigBar[\s\S]*?animation: none/, '配置栏祖先的 transform 动画须关闭');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.gen-action-dock \{ animation: none; \} \}/, '行动区入场动效须尊重降动效');
});

// v2.697 灵感式创作 tip 文案曾承诺「点 AI 提案 → 多轮对话 → 你确认才落稿」，
// 但详情页根本没有 AI 提案按钮，真实 pitch 流程在编剧室（room-panel）。
// 文案只能写真实存在的三条轨道；chip 跳转走既有编剧室入口，不造第二套逻辑。
const APP_TEXT = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');
const CONST_TEXT = fs.readFileSync(path.join(ROOT, 'web/data/constants.js'), 'utf8');
const HTML_TEXT = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');

test('v2.697 灵感式创作 tip 文案不得承诺不存在的「AI 提案」路径', () => {
  const zhTip = /spark:\s*\{\s*zh:\s*\[.*?点.*?AI.*?提案/.test(CONST_TEXT) || /spark.*AI\s*提案/.test(APP_TEXT);
  const enTip = /spark.*AI\s*pitch/.test(APP_TEXT) || /spark.*AI\s*pitch/.test(CONST_TEXT);
  assert.equal(zhTip, false, '中文 spark tip 不得再出现「AI 提案」这类不存在的入口承诺');
  assert.equal(enTip, false, '英文 spark tip 不得再出现「AI pitch」这类不存在的入口承诺');
});

test('v2.697 灵感式创作 chip 存在且复用编剧室入口（不造第二套 pitch 逻辑）', () => {
  // chip 入口在 HTML 里，走 data-open="roomPanel" 复用既有编剧室
  assert.ok(/data-open="roomPanel"/.test(HTML_TEXT) || /openRoomPanel/.test(APP_TEXT),
    'chip 必须复用编剧室入口');
  // index.html 里有编剧室 panel 本身
  assert.ok(/id="roomPanel"/.test(HTML_TEXT), '真实编剧室入口 panel 必须存在，供 chip 跳转复用');
});
