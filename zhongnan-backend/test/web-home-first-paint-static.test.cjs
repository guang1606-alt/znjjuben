/**
 * v2.461 首屏零位移：首页「快捷创作 / 创作工具箱」必须在 HTML 里就有静态卡片。
 *
 * 证伪数据（Playwright + CDP 网络/CPU 节流，390×844）：
 *   首帧 t≈933：#view-home 高 663，#homeQuickGrid 子节点 0；
 *   app.js 到达后 t≈2365：view 高 2154，卡片 6 张 → CLS 0.159（t=2397）。
 *   位移源即「空网格被 JS 填满」把下方内容整体推走；同时 #langBtn 旁的
 *   `home-more` 静态文案（全部 12 种模式）与 i18n zh（全部 8 种模式 + 自动匹配）
 *   不一致，renderStaticText 替换后按钮宽度 131→195。
 *
 * 修复策略：静态 HTML 直接给出 6 张快捷卡 + 4 张工具卡（与 renderHome 生成的
 *          结构、文案完全一致），并把 #view-home 内 data-i 静态文案校正到 i18n zh，
 *          使 app.js 迟到执行时重建 DOM 不产生任何尺寸变化。
 * 本文件静态断言收口：只要静态卡片与 i18n 漂移，这里立刻红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const I18N = require(path.join(WEB, 'i18n.js'));

function loadConstants() {
  const code = fs.readFileSync(path.join(WEB, 'data', 'constants.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.ZN_DATA;
}
const DATA = loadConstants();
// vm 里 newContext 出来的数组原型不属于宿主 realm，deepStrictEqual 会因原型不同报
// "same structure but not reference-equal"；这里转回宿主数组，只做取值比较。
const HOME_TOOLS = Array.from(DATA.HOME_TOOLS);
// 与 app.js HOME_QUICK_MODES 同源（app.js 内联，这里按产品口径固定）
const HOME_QUICK_MODES = ['tag', 'interview', 'diary', 'spark', 'hot', 'duel'];

function sliceBetween(startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  assert.ok(i >= 0, `index.html 缺少定位标记：${startMarker}`);
  const j = html.indexOf(endMarker, i);
  assert.ok(j > i, `index.html 缺少结束标记：${endMarker}`);
  return html.slice(i, j);
}

function parseCards(block, cardClass, fields) {
  const re = new RegExp(`<button[^>]*class="${cardClass}"[^>]*>([\\s\\S]*?)</button>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(block))) {
    const inner = m[1];
    const item = {};
    for (const [key, pattern] of Object.entries(fields)) {
      const r = pattern.exec(inner);
      item[key] = r ? r[1].trim() : null;
    }
    out.push(item);
  }
  return out;
}

const zh = I18N.DICT.zh;

describe('v2.461 首页首屏静态卡片（消除空网格填充导致的 CLS）', () => {
  it('① 快捷创作：静态即有 6 张卡，顺序与文案与 renderHome 完全一致', () => {
    const block = sliceBetween('id="homeQuickGrid"', '</section>');
    const cards = parseCards(block, 'home-quick-card', {
      title: /<b>([\s\S]*?)<\/b>/,
      desc: /<span>([\s\S]*?)<\/span>/,
    });
    assert.deepStrictEqual(cards.map((c) => c.title), HOME_QUICK_MODES.map((id) => zh.mode[id]),
      '静态快捷卡的标题必须与 i18n zh 逐字一致（否则 app.js 重建时高度变化 → 位移）');
    assert.deepStrictEqual(cards.map((c) => c.desc), HOME_QUICK_MODES.map((id) => zh.modeDesc[id]),
      '静态快捷卡的描述必须与 i18n zh 逐字一致（描述参与两行截断，换字会改高度）');
  });

  it('② 创作工具箱：静态即有 4 张卡，标题/描述/费用与 i18n zh 一致', () => {
    const block = sliceBetween('id="homeToolGrid"', '</details>');
    const cards = parseCards(block, 'home-tool-card', {
      title: /<h3[^>]*>([\s\S]*?)<\/h3>/,
      desc: /<p[^>]*>([\s\S]*?)<\/p>/,
      cost: /<span class="tool-cost"[^>]*>([\s\S]*?)<\/span>/,
    });
    assert.strictEqual(cards.length, HOME_TOOLS.length, '静态工具卡数量应与 HOME_TOOLS 一致');
    assert.deepStrictEqual(cards.map((c) => c.title), HOME_TOOLS.map((x) => zh[x.key]));
    assert.deepStrictEqual(cards.map((c) => c.desc), HOME_TOOLS.map((x) => zh[x.desc]));
    assert.deepStrictEqual(cards.map((c) => c.cost), HOME_TOOLS.map((x) => zh[x.cost]));
  });

  it('③ #view-home 内静态 data-i 文案必须等于 i18n zh（防 renderStaticText 二次改文案触发重排）', () => {
    const block = sliceBetween('<div id="view-home">', '<div id="view-toolbox"');
    const re = /<([a-z0-9]+)\b[^>]*\bdata-i="([^"]+)"[^>]*>([^<]*)</gi;
    const drift = [];
    let m;
    while ((m = re.exec(block))) {
      const tag = m[1];
      const key = m[2];
      const text = m[3].trim();
      const expect = typeof zh[key] === 'string' ? zh[key] : null;
      if (!expect) { drift.push(`${tag}[data-i=${key}] i18n 缺键`); continue; }
      if (text !== expect) drift.push(`${tag}[data-i=${key}] 静态「${text}」≠ i18n「${expect}」`);
    }
    assert.deepStrictEqual(drift, [], '静态文案与 i18n zh 漂移会让首屏二次替换文案并重排：\n' + drift.join('\n'));
  });

  it('④ 首页快捷卡不再依赖 JS：无卡片时首屏高度只有标题行（回归即红）', () => {
    const block = sliceBetween('id="homeQuickGrid"', '</section>');
    assert.match(block, /home-quick-card/, '#homeQuickGrid 必须在 HTML 中带静态卡片');
    const tool = sliceBetween('id="homeToolGrid"', '</details>');
    assert.match(tool, /home-tool-card/, '#homeToolGrid 必须在 HTML 中带静态卡片');
  });
});
