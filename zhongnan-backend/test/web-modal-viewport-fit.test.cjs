/**
 * v2.462 横屏/低高度视口下弹层可达性守卫 —— TDD 先红后绿
 *
 * 实测缺陷（844×390 真机尺寸，Playwright + 真实 dist）：
 *   登录弹层 `.modal` 在宽度 >560px 时没有任何 max-height（`max-height: none`、`overflow-y: visible`），
 *   卡片高 396.8px，而遮罩 padding 20px 后可用高度只有 390-40=350px；
 *   遮罩是 `position: fixed`，滚动页面（scrollY 0→600）卡片位置纹丝不动，
 *   提交按钮纵向落在 387→430，**底部 40px 永久在视口外**，横屏手机上无法登录/注册。
 *   唯一的 max-height 只写在 `@media(max-width:560px)` 里，横屏（844 宽、390 高）命中不到。
 *
 * 守卫口径（结构不变量，不是魔法数）：
 *   1) `.modal` 基础规则（媒体查询之外）必须声明视口相对的 max-height 与 overflow-y: auto；
 *   2) max-height 的 calc 减数必须等于遮罩上下 padding 之和（可用高度算对，否则仍会溢出）；
 *   3) 低高度横屏（max-height 媒体查询）必须存在压缩档，避免每屏都要滚。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_RAW = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
// 注释里可能含选择器字样（如「.modal 的 max-height」），先剥掉注释再解析，避免选择器串被注释污染
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');

// 去掉 @media / @supports 等条件块，只留无条件规则（基础样式）
function stripConditionalBlocks(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at < 0) { out += css.slice(i); break; }
    out += css.slice(i, at);
    const open = css.indexOf('{', at);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return out;
}

function rulesOf(css) {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean),
    body: m[2],
  }));
}

// 返回同名属性的**最后一条**声明：浏览器按最后一条生效（如 100vh 回退 + 100dvh 覆盖），
// 只校验第一条会漏掉真正生效的那条。
function decl(body, prop) {
  const all = Array.from(body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'gi')));
  return all.length ? all[all.length - 1][1].trim() : null;
}

const baseCss = stripConditionalBlocks(CSS);
const baseRules = rulesOf(baseCss);
// 同一选择器可能出现在多条规则里（如 `.modal,.modal-wide{animation}`），按「必须含某属性」定位目标规则
function findRule(selector, prop) {
  return baseRules.find((r) => r.selectors.includes(selector) && new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(r.body)) || null;
}
const modalRule = findRule('.modal', 'max-height');
const maskRule = findRule('.modal-mask', 'padding');

describe('v2.462 弹层在低高度视口可达（横屏登录不被截断）', () => {
  it('基础 .modal 必须声明视口相对的 max-height 与 overflow-y:auto（不能只写在 ≤560px 媒体查询里）', () => {
    assert.ok(modalRule, '.modal 基础规则缺少 max-height：横屏/低高度视口下卡片会溢出且无法滚动');
    const maxH = decl(modalRule.body, 'max-height');
    assert.ok(maxH, '.modal 基础规则缺少 max-height：横屏/低高度视口下卡片会溢出且无法滚动');
    assert.match(maxH, /100d?vh|100vh|100dvh/, `.modal 的 max-height 必须跟视口高度挂钩，当前为 ${maxH}`);
    assert.strictEqual(decl(modalRule.body, 'overflow-y'), 'auto', '.modal 基础规则必须 overflow-y:auto，否则溢出内容无法滚动到');
  });

  it('max-height 的 calc 减数必须等于遮罩上下 padding 之和（可用高度算对）', () => {
    const maxH = decl(modalRule.body, 'max-height') || '';
    const calc = maxH.match(/calc\(\s*100d?vh\s*-\s*(\d+)px\s*\)/);
    assert.ok(calc, `.modal 的 max-height 应写成 calc(100vh - Npx)，当前为 ${maxH}`);
    const pad = decl(maskRule ? maskRule.body : '', 'padding') || '';
    const first = pad.trim().split(/\s+/)[0];
    const px = parseFloat(first);
    assert.ok(Number.isFinite(px), `无法从 .modal-mask padding 解析上下留白：${pad}`);
    assert.strictEqual(Number(calc[1]), px * 2, `max-height 减数 ${calc[1]}px 应等于遮罩上下 padding 之和 ${px * 2}px`);
  });

  it('存在低高度横屏（max-height 媒体查询）压缩档，且确实压缩了弹层留白', () => {
    const blocks = Array.from(CSS.matchAll(/@media[^{]*\(max-height:\s*\d+px\)[^{]*\{/g));
    assert.ok(blocks.length > 0, '缺少 max-height 媒体查询：横屏/小屏应压缩弹层留白，避免必须滚动才能看到提交按钮');
    // 取第一个低高度块的完整花括号内容
    const at = blocks[0].index + blocks[0][0].length - 1;
    let depth = 1;
    let j = at + 1;
    while (j < CSS.length && depth > 0) {
      if (CSS[j] === '{') depth++;
      else if (CSS[j] === '}') depth--;
      j++;
    }
    const blockRules = rulesOf(CSS.slice(at + 1, j - 1));
    const lowMask = blockRules.find((r) => r.selectors.includes('.modal-mask'));
    const lowModal = blockRules.find((r) => r.selectors.includes('.modal'));
    assert.ok(lowMask && lowModal, '低高度媒体查询必须同时覆盖 .modal-mask 与 .modal');
    const pxOf = (body) => parseFloat(String(decl(body, 'padding') || '').split(/\s+/)[0]);
    const baseMaskPad = pxOf(maskRule.body);
    const baseModalPad = pxOf(modalRule.body);
    assert.ok(Number.isFinite(baseMaskPad) && Number.isFinite(baseModalPad), '无法解析基础留白');
    assert.ok(pxOf(lowMask.body) < baseMaskPad, `低高度档的遮罩留白应小于基础值 ${baseMaskPad}px，当前为 ${pxOf(lowMask.body)}px`);
    assert.ok(pxOf(lowModal.body) < baseModalPad, `低高度档的卡片留白应小于基础值 ${baseModalPad}px，当前为 ${pxOf(lowModal.body)}px`);
  });

  it('_syncTopbarOffset 不得再给 .modal-mask 写 paddingTop（横屏会写成 143px 把卡片顶出视口）', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
    const start = app.indexOf('function _syncTopbarOffset()');
    assert.ok(start > 0, '未找到 _syncTopbarOffset');
    const end = app.indexOf('\n  }', start);
    const body = app.slice(start, end);
    assert.ok(!/modal-mask/.test(body), '_syncTopbarOffset 不应再操作 .modal-mask：遮罩 z-index 高于 topbar，无需让位');
    assert.ok(/workbenchLayer/.test(body), '_syncTopbarOffset 仍须负责工作台顶部让位');
    // 前置条件：遮罩必须真的盖在 topbar 之上，否则去掉让位会被浮岛压住
    // 取「只含该选择器」的最后一条声明（`.topbar, .wrap…{z-index:1}` 这类组合规则不算）
    const zOf = (sel) => {
      const rs = baseRules.filter((r) => r.selectors.length === 1 && r.selectors[0] === sel);
      for (let i = rs.length - 1; i >= 0; i--) {
        const v = decl(rs[i].body, 'z-index');
        if (v) return Number(v);
      }
      return NaN;
    };
    const maskZ = zOf('.modal-mask');
    const topZ = zOf('.topbar');
    assert.ok(Number.isFinite(maskZ) && Number.isFinite(topZ), '无法解析 .modal-mask / .topbar 的 z-index');
    assert.ok(maskZ > topZ, `.modal-mask 的 z-index(${maskZ}) 必须高于 .topbar(${topZ})，否则卡片会被浮岛压住`);
  });
});
