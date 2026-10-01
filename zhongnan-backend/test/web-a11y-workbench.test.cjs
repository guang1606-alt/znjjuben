const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.242 a11y 第三梯队：工作台面板 dialog 语义 + 焦点进出管理
// 现状：workbenchLayer 已有 aria-hidden 切换，但缺 role="dialog"/aria-modal/aria-labelledby；
// 打开时焦点留在触发按钮（或 body），关闭后焦点不回退——键盘/读屏用户迷失位置。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const sliceBetween = (s, a, b) => { const i = s.indexOf(a); const j = i >= 0 ? s.indexOf(b, i) : -1; return i >= 0 && j > i ? s.slice(i, j) : ''; };

describe('v2.242 a11y：工作台面板 dialog 语义与焦点进出', () => {
  it('workbenchLayer 有 role="dialog" + aria-modal="true" + aria-labelledby="workbenchTitle"', () => {
    const m = html.match(/<div id="workbenchLayer"[^>]*>/);
    assert.ok(m, '应存在 #workbenchLayer');
    assert.match(m[0], /role="dialog"/, '缺 role="dialog"');
    assert.match(m[0], /aria-modal="true"/, '缺 aria-modal="true"');
    assert.match(m[0], /aria-labelledby="workbenchTitle"/, '缺 aria-labelledby="workbenchTitle"（标题元素已存在）');
  });

  it('openWorkbench 存储触发时的焦点元素（_workbenchPrevFocus）', () => {
    const region = sliceBetween(appSrc, 'function openWorkbench(id)', 'function _workbenchEsc');
    assert.ok(region.length > 0, '应定位到 openWorkbench');
    assert.match(region, /_workbenchPrevFocus\s*=/, 'openWorkbench 未存 _workbenchPrevFocus');
  });

  it('_hideWorkbenchLayer 恢复焦点到 _workbenchPrevFocus（若存在且可聚焦）', () => {
    const region = sliceBetween(appSrc, 'function _hideWorkbenchLayer', 'function openWorkbench');
    assert.ok(region.length > 0, '应定位到 _hideWorkbenchLayer');
    assert.match(region, /_workbenchPrevFocus/, '_hideWorkbenchLayer 未引用 _workbenchPrevFocus');
    assert.match(region, /focus\(\)/, '_hideWorkbenchLayer 未调用 focus() 恢复');
  });

  it('workbenchTitle 元素存在于 index.html（aria-labelledby 目标）', () => {
    assert.match(html, /id="workbenchTitle"/, '缺 #workbenchTitle（aria-labelledby 目标）');
  });
});

// v2.243 a11y 第三梯队续：工作台焦点 trap（Tab 循环限制在面板内，复用 modal 已有 _uiTrapTab 先例）
// + 打开时焦点移入面板（键盘/读屏用户立即可操作，焦点不在 layer 内才移动防打字偷焦）
// + 8 个 JS 侧已有必填校验的输入补 aria-required（bbBrand/bbSelling/tbName/tbHeat/brMain/brChoice/authPhone/authPwd）
describe('v2.243 a11y：工作台焦点 trap 与焦点移入', () => {
  it('_workbenchEsc 同时处理 Tab：调用 _uiTrapTab(e, layer) 把焦点循环限制在面板内', () => {
    const m = appSrc.match(/function _workbenchEsc\(e\)\s*\{[\s\S]*?\n\s*\}/);
    assert.ok(m, '应定位到 _workbenchEsc');
    assert.match(m[0], /e\.key === 'Tab'/, '_workbenchEsc 未处理 Tab 键');
    assert.match(m[0], /_uiTrapTab\(e, layer\)/, '_workbenchEsc 未调用 _uiTrapTab(e, layer)（应复用 modal 焦点 trap 先例）');
  });

  it('_showWorkbenchLayer 打开时焦点移入面板（#workbenchBack），且仅在焦点不在 layer 内时移动', () => {
    const region = sliceBetween(appSrc, 'function _showWorkbenchLayer(id)', 'function _syncTopbarOffset');
    assert.ok(region.length > 0, '应定位到 _showWorkbenchLayer');
    assert.match(region, /workbenchBack/, '_showWorkbenchLayer 未引用 #workbenchBack 作为焦点落点');
    assert.match(region, /workbenchBack'\)\?\.focus\(\)|workbenchBack"\)\?\.focus\(\)|workbenchBack'\)\.focus\(\)|workbenchBack"\)\.focus\(\)/, '_showWorkbenchLayer 未调用 #workbenchBack focus()');
    assert.match(region, /layer\.contains\(/, '焦点移入缺 layer.contains 守卫（防打字中被偷焦）');
  });

  it('_uiTrapTab 先例仍存在（modal 焦点循环工具，workbench 复用的前提）', () => {
    assert.match(appSrc, /function _uiTrapTab\(e, modal\)/, '_uiTrapTab 定义不存在');
  });
});

describe('v2.243 a11y：必填输入 aria-required（JS 侧已有必填校验，语义层补齐）', () => {
  const REQUIRED_IDS = ['bbBrand', 'bbSelling', 'tbName', 'tbHeat', 'brMain', 'brChoice', 'authPhone', 'authPwd'];
  for (const id of REQUIRED_IDS) {
    it(`#${id} 带 aria-required="true"`, () => {
      const m = html.match(new RegExp('<(input|textarea)[^>]*\\bid="' + id + '"[^>]*>'));
      assert.ok(m, `应存在 #${id} 输入控件`);
      assert.match(m[0], /aria-required="true"/, `#${id} 缺 aria-required="true"`);
    });
  }
});
