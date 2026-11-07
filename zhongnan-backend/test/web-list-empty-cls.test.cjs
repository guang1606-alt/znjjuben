'use strict';
/* v2.465 列表页「骨架 → 空态」骤缩造成 CLS 的守口。
 * 真实节流实测 /#/market：6 张骨架卡 804px 被 113px 空态替换，页脚从视口外被拽进
 * 视口（CLS 0.114）。修法是让空态沿用「同一渲染周期量到的骨架高度」并居中。
 * 这里守三条结构不变量：高度必须实测（不写死像素）、必须先量后清、空态必须居中。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');

/** 截取一个函数的函数体（从 `function 名字` 到下一个顶层 `  }` 行）。 */
function fnBody(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到 function ' + name);
  const end = APP.indexOf('\n  }', start);
  assert.ok(end > start, '未找到 function ' + name + ' 的结尾');
  return APP.slice(start, end);
}

test('v2.465 空态高度占位来自实测高度（不写死像素），并按需居中', () => {
  assert.ok(/function reserveEmptyHeight\(emptyEl,\s*measuredHeight/.test(APP),
    'reserveEmptyHeight 必须接收实测高度参数');
  const body = fnBody('reserveEmptyHeight');
  assert.ok(/minHeight\s*=\s*[^;]*measuredHeight/.test(body), 'minHeight 必须由实测高度派生');
  assert.ok(/zn-empty-reserve/.test(body), 'reserveEmptyHeight 必须切换 .zn-empty-reserve 类（居中用）');
  assert.ok(!/\b\d{2,}\s*px\b/.test(body), 'reserveEmptyHeight 内不得写死像素高度（必须来自实测）');
});

test('v2.465 市场橱窗 / 榜单 / 交流广场三处空态都在清空容器之前量高度', () => {
  for (const name of ['loadListings', 'loadBoard', 'loadFeed']) {
    const body = fnBody(name);
    assert.ok(body.includes('reserveEmptyHeight('), name + ' 的完成路径必须调用 reserveEmptyHeight');
    const measureAt = body.search(/offsetHeight/);
    assert.ok(measureAt >= 0, name + ' 必须在清空容器前量骨架高度');
    // 只认列表容器（grid/feed）的清空；函数开头的「清空旧空态」不改变布局，不参与比较
    const clearAt = body.search(/(?:grid|feed)\.innerHTML\s*=\s*['"]{2}/);
    assert.ok(clearAt >= 0, name + ' 未找到清空容器语句');
    assert.ok(measureAt < clearAt, name + ' 必须在清空容器之前量高度，否则量到的是 0');
  }
});

test('v2.465 空态占位容器垂直居中（否则预留高度里文字贴顶，观感像页面坏了）', () => {
  const re = /\.zn-empty-reserve\s*\{([^}]*)\}/;
  const m = re.exec(CSS);
  assert.ok(m, 'styles.css 缺少 .zn-empty-reserve 规则');
  assert.ok(/justify-content\s*:\s*center/.test(m[1]), '.zn-empty-reserve 需要水平居中');
  assert.ok(/align-items\s*:\s*center/.test(m[1]), '.zn-empty-reserve 需要垂直居中');
});
