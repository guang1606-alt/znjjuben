'use strict';
// v2.670 创作端「长列表看得清 + 长表单不失控」：
// 1) 递招 43 张方法卡搜索后，命中词在标题/公式里就地高亮（此前只过滤不解释，用户不知道为何留下）；
// 2) 所有带 maxlength 的长文本框（原文 5 万字、人设 200 字等）实时显示「已用 / 上限」，
//    90% 转琥珀、到顶转朱砂并轻弹一次；短字段（≤200 的 input）不打扰；
// 3) 表单聚焦：边框/光环过渡柔和，当前字段标签转鎏金，用户一眼知道在填哪一格；
// 4) 方法卡悬停细抬 1px，43 卡长栅格有触感。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = read('web/app.js');
const css = read('web/styles.css');

const ast = ts.createSourceFile('app.js', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function makeSpan() {
  const classes = new Set();
  return {
    className: '', textContent: '', attrs: {},
    classList: {
      add: (...xs) => xs.forEach((x) => classes.add(x)),
      remove: (...xs) => xs.forEach((x) => classes.delete(x)),
      contains: (x) => classes.has(x),
      toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
  };
}

function setup(names, extra = {}) {
  const context = {
    lang: 'zh', console,
    escapeHtml: esc,
    document: { createElement: () => makeSpan() },
    ...extra,
  };
  vm.createContext(context);
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return context;
}

function fakeField({ value = '', maxLength = 200, tagName = 'TEXTAREA' } = {}) {
  const host = { children: [], querySelector: () => null, appendChild(el) { host.children.push(el); } };
  const el = { tagName, value, maxLength, parentElement: host, closest: () => host };
  return { el, host };
}

test('静态契约：命中高亮接入方法卡、字数计接入启动、样式与降动效齐备', () => {
  for (const name of ['highlightNeedle', 'formatCharCount', 'charCountState', 'syncCharCounter', 'initCharCounters']) {
    assert.ok(functions.has(name), `缺少函数声明 ${name}`);
  }
  const render = functions.get('renderCraftCards');
  assert.match(render, /highlightNeedle\(c\.title, q\)/);
  assert.match(render, /highlightNeedle\(c\.formula \|\| '', q\)/);
  assert.match(app, /initCharCounters\(\);/);
  assert.match(app, /addEventListener\('input'/);

  for (const cls of ['.zn-hit', '.char-count', '.char-count.is-warn', '.char-count.is-limit']) {
    assert.ok(css.includes(cls), `styles.css 缺少 ${cls}`);
  }
  assert.match(css, /\.craft-card:not\(\.on\):hover\{[^}]*transform:translateY\(-1px\)/);
  assert.match(css, /\.field:focus-within > label\s*\{[^}]*color:\s*var\(--gold-deep\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.char-count\.is-limit\{animation:none\}\}/);
});

test('highlightNeedle：无关键词等价转义，命中加 mark，大小写不敏感且原样保留', () => {
  const c = setup(['highlightNeedle']);
  assert.equal(c.highlightNeedle('反转 <冷开场>', ''), '反转 &lt;冷开场&gt;');
  assert.equal(c.highlightNeedle(null, 'x'), '');
  const out = c.highlightNeedle('三秒反转开场', '反转');
  assert.match(out, /<mark class="zn-hit">反转<\/mark>/);
  assert.match(out, /^三秒/);
  // 英文大小写不敏感，但展示保留原文大小写
  assert.equal(c.highlightNeedle('Cold Open Hook', 'cold'), '<mark class="zn-hit">Cold</mark> Open Hook');
  // 一次命中多处
  const twice = c.highlightNeedle('反转再反转', '反转');
  assert.equal((twice.match(/<mark class="zn-hit">/g) || []).length, 2);
});

test('highlightNeedle：正则元字符按字面处理，不抛错也不误伤', () => {
  const c = setup(['highlightNeedle']);
  assert.equal(c.highlightNeedle('成本 a+b 方案', 'a+b'), '成本 <mark class="zn-hit">a+b</mark> 方案');
  assert.equal(c.highlightNeedle('括号(开场)', '(开场)'), '括号<mark class="zn-hit">(开场)</mark>');
  assert.equal(c.highlightNeedle('无命中', '.*'), '无命中');
  assert.doesNotThrow(() => c.highlightNeedle('abc', '['));
});

test('formatCharCount 与 charCountState：千分位、90% 预警、到顶封顶', () => {
  const c = setup(['formatCharCount', 'charCountState']);
  assert.equal(c.formatCharCount(0), '0');
  assert.equal(c.formatCharCount(999), '999');
  assert.equal(c.formatCharCount(1234567), '1,234,567');
  assert.equal(c.formatCharCount(-5), '0');
  assert.equal(c.charCountState(0, 200), 'ok');
  assert.equal(c.charCountState(179, 200), 'ok');
  assert.equal(c.charCountState(180, 200), 'warn');
  assert.equal(c.charCountState(199, 200), 'warn');
  assert.equal(c.charCountState(200, 200), 'limit');
  assert.equal(c.charCountState(5, -1), 'ok');
});

test('syncCharCounter：长文本框挂出「已用 / 上限」，预警/到顶换色；短 input 不打扰', () => {
  const c = setup(['formatCharCount', 'charCountState', 'syncCharCounter']);
  const ok = fakeField({ value: 'abc', maxLength: 200 });
  assert.equal(c.syncCharCounter(ok.el), 'ok');
  assert.equal(ok.host.children.length, 1, '应创建计数器');
  assert.equal(ok.host.children[0].textContent, '3 / 200');
  assert.equal(ok.host.children[0].attrs['aria-hidden'], 'true');

  const warn = fakeField({ value: 'x'.repeat(190), maxLength: 200 });
  assert.equal(c.syncCharCounter(warn.el), 'warn');
  assert.ok(warn.host.children[0].classList.contains('is-warn'), '90% 应转预警色');

  const limit = fakeField({ value: 'x'.repeat(200), maxLength: 200 });
  assert.equal(c.syncCharCounter(limit.el), 'limit');
  assert.ok(limit.host.children[0].classList.contains('is-limit'), '到顶应转提示色');

  const big = fakeField({ value: 'x'.repeat(50000), maxLength: 50000 });
  assert.equal(c.syncCharCounter(big.el), 'limit');
  assert.equal(big.host.children[0].textContent, '50,000 / 50,000');

  const short = fakeField({ value: '名字', maxLength: 20, tagName: 'INPUT' });
  assert.equal(c.syncCharCounter(short.el), null, '短 input 不挂计数器');
  assert.equal(short.host.children.length, 0);

  const noMax = fakeField({ value: 'abc', maxLength: -1 });
  assert.equal(c.syncCharCounter(noMax.el), null, '无上限字段不挂计数器');
});
