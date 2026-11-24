'use strict';
// v2.671 长面板回顶 + 方法卡空态引导 + 表单到顶温和拒绝：
// 1) 全局回顶悬浮：滚到阈值内隐藏，超过出现，点一下平滑滚顶；
// 2) 方法卡搜索空态走图标 znEmpty + hint「清空可看全部」，搜索框带清空按钮；
// 3) textarea/input 到 maxlength 时抖一下 + 朱砂色提示，让用户知道"到顶了"。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = read('web/app.js');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');

const ast = ts.createSourceFile('app.js', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

function makeBtn() {
  const s = new Set();
  return {
    classList: {
      add: (...xs) => xs.forEach((x) => s.add(x)),
      remove: (...xs) => xs.forEach((x) => s.delete(x)),
      contains: (x) => s.has(x),
      toggle(x, on) { if (on ?? !s.has(x)) s.add(x); else s.delete(x); },
    },
    style: {}, hidden: true,
  };
}

function makeEl({ value = '', maxLength = 50000, tagName = 'TEXTAREA' } = {}) {
  const s = new Set();
  return {
    tagName, value, maxLength,
    classList: {
      add: (...xs) => xs.forEach((x) => s.add(x)),
      remove: (...xs) => xs.forEach((x) => s.delete(x)),
      contains: (x) => s.has(x),
    },
    dataset: {},
  };
}

function setup(names, extra = {}) {
  const timers = [];
  const context = {
    lang: 'zh', console,
    document: { createElement: () => ({}) },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    ...extra,
  };
  vm.createContext(context);
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return context;
}

test('静态契约：回顶悬浮/方法卡空态/表单到顶 三接线齐备', () => {
  for (const name of ['initBackToTop', 'updateBackToTop', 'scrollToTop', 'triggerMaxLimitShake']) {
    assert.ok(functions.has(name), `缺少函数声明 ${name}`);
  }
  // 方法卡空态：搜索无结果要走 znEmptyHtml 并带 hint
  const render = functions.get('renderCraftCards');
  assert.match(render, /znEmptyHtml/);
  assert.match(render, /craftSearchEmptyHint/);
  // 搜索框清空按钮：接线在 renderCraftCards 函数外，直接扫整个 app.js
  assert.match(app, /craftSearchClear/);

  // 回顶按钮 id 存在于 index.html
  const html = read('web/index.html');
  assert.match(html, /id="backToTop"/);
  // 回顶按钮 + 空态提示 + 到顶抖动 + 搜索清空 样式
  for (const cls of ['.back-to-top', '.zn-empty-hint', '.is-at-limit', '.tag-empty', '.search-clear']) {
    assert.ok(css.includes(cls), `styles.css 缺少 ${cls}`);
  }
  assert.match(css, /@keyframes ep-shake/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('静态契约：中英双语文案键齐备', () => {
  for (const key of ['backToTop', 'craftSearchEmptyHint']) {
    const hits = i18n.match(new RegExp(`${key}\\s*:`, 'g')) || [];
    assert.equal(hits.length, 2, `${key} 必须在中英两份 DICT 中各出现一次`);
  }
});

test('updateBackToTop：阈值以下隐藏，超过显示，点一下平滑滚顶', () => {
  const btn = makeBtn();
  const c = setup(['updateBackToTop', 'scrollToTop'], {
    document: { getElementById: () => btn },
    window: { scrollY: 0, scrollTo() {} },
  });

  c.window.scrollY = 0;
  c.updateBackToTop();
  assert.equal(btn.classList.contains('show'), false);

  c.window.scrollY = 119;
  c.updateBackToTop();
  assert.equal(btn.classList.contains('show'), false);

  c.window.scrollY = 120;
  c.updateBackToTop();
  assert.ok(btn.classList.contains('show'), '滚动超过 120px 应显示回顶按钮');

  // 顶到阈值以下后自动隐藏
  c.window.scrollY = 80;
  c.updateBackToTop();
  assert.equal(btn.classList.contains('show'), false);
});

test('triggerMaxLimitShake：textarea/input 到顶时抖一下 + 朱砂色，短 input 不抖', () => {
  const c = setup(['triggerMaxLimitShake']);
  const ta = makeEl({ tagName: 'TEXTAREA', maxLength: 50000, value: 'x'.repeat(50000) });
  c.triggerMaxLimitShake(ta);
  assert.ok(ta.classList.contains('is-at-limit'), '到顶应加 is-at-limit');
  assert.ok(ta.classList.contains('ep-shake'), '到顶应抖动');

  const short = makeEl({ tagName: 'INPUT', maxLength: 11, value: '12345' });
  c.triggerMaxLimitShake(short);
  assert.equal(short.classList.contains('is-at-limit'), false, '短字段到顶不打扰');
  assert.equal(short.classList.contains('ep-shake'), false);
});
