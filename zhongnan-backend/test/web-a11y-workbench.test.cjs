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
