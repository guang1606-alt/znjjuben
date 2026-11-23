/**
 * v2.664 剧本体检：结果与输入同步守卫
 * 背景：体检 / 原型选型的结果只对「提交那一刻的四段输入」成立，但此前正文、剧名、
 * 本集结尾、终局大纲任何一项改动后，结果区仍原样显示上一次的报告，复制问题单也一样——
 * 用户会把上一版结论当成本版正文的结论，照着改错地方。
 * 这里用「输入指纹」守卫：改了就出现常驻提示条 + 一键按新内容重跑，旧结果轻微降饱和。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const VIEW = fs.readFileSync(path.join(ROOT, 'web', 'lint-view.js'), 'utf8');
const ast = ts.createSourceFile('lint-view.js', VIEW, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

// 视图脚本里 $ / esc / T / en 等都是 IIFE 内的 const 箭头函数，测试无法提取，
// 这里按同一语义给出替身；isStale/syncStale/inputsKey/runLint/reRender 从源码真实提取。
const ZH = {
  needText: '请先粘贴一集正文（至少几十个字）', fail: '请求失败，请重试', checking: '正在体检…',
  staleHint: '正文或选填项已修改——下方结果对应修改前的内容。', staleRerun: '按新内容重跑',
  staleReportNote: '［注意］正文已修改，以下是修改前正文的体检结果。',
};

function makeBox() {
  const children = [];
  return {
    innerHTML: '', firstChild: null,
    classList: {
      _s: new Set(),
      add(...xs) { xs.forEach((x) => this._s.add(x)); },
      remove(...xs) { xs.forEach((x) => this._s.delete(x)); },
      contains(x) { return this._s.has(x); },
      toggle(x, on) { if (on === undefined ? !this._s.has(x) : on) this._s.add(x); else this._s.delete(x); },
    },
    insertBefore(el) { children.unshift(el); this.firstChild = el; },
    querySelector(sel) {
      if (sel !== '[data-lint-stale]') return null;
      return children.find((c) => c.attrs && c.attrs['data-lint-stale'] && !c.removed) || null;
    },
    _children: children,
  };
}

function setup(extra = {}) {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) {
      const node = id === 'lintResult' ? makeBox() : {
        id, value: '', disabled: false, textContent: '', innerHTML: '',
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
      };
      nodes.set(id, node);
    }
    return nodes.get(id);
  };
  const ctx = {
    $, console,
    window: { znLang: () => 'zh', Api: {} },
    localStorage: { getItem: () => 'zh' },
    document: {
      getElementById: $,
      createElement: () => ({
        className: '', innerHTML: '', attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        remove() { this.removed = true; },
      }),
    },
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    colon: () => '：', wrapGroup: (s) => `【${s}】`,
    en: () => false,
    T: () => ZH,
    xnErr: () => { ctx._errs = (ctx._errs || 0) + 1; },
    postJson: async () => ({}),
    renderLint: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
    renderArch: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
    last: null, lastKey: null,
    // 源码里是与函数同域的 const 清单，提取函数时须一并给出
    LINT_FIELDS: ['lintText', 'lintTitle', 'lintEnding', 'lintOutline'],
    ...extra,
  };
  vm.createContext(ctx);
  for (const name of ['inputsKey', 'isStale', 'syncStale', 'reRender', 'runLint', 'splitEpisodes']) {
    if (functions.has(name)) vm.runInContext(functions.get(name), ctx);
  }
  return { c: ctx, $ };
}

test('v2.664 没有结果时不出现同步提示', () => {
  const { c } = setup();
  c.syncStale();
  assert.equal(c.isStale(), false, '没有结果就谈不上过期');
});

test('v2.664 结果与输入一致时：无提示条、结果区不加降饱和类', () => {
  const { c, $ } = setup();
  $('lintText').value = '第一集正文内容足够长';
  c.last = { kind: 'lint', data: {}, eps: 1, meta: {} };
  c.lastKey = c.inputsKey();
  c.syncStale();
  const box = $('lintResult');
  assert.equal(c.isStale(), false);
  assert.equal(box.classList.contains('lint-stale'), false);
  assert.equal(box.querySelector('[data-lint-stale]'), null, '一致时不应插入提示条');
});

test('v2.664 正文改动后：立刻判定过期，插入带重跑按钮的提示条', () => {
  const { c, $ } = setup();
  $('lintText').value = '第一集正文';
  c.last = { kind: 'lint', data: {}, eps: 1, meta: {} };
  c.lastKey = c.inputsKey();
  $('lintText').value = '第二集正文（用户换了内容）';
  c.syncStale();
  const box = $('lintResult');
  assert.equal(c.isStale(), true);
  assert.equal(box.classList.contains('lint-stale'), true);
  const bar = box.querySelector('[data-lint-stale]');
  assert.ok(bar, '过期时须插入常驻提示条');
  assert.match(bar.innerHTML, /已修改/, '提示条须说明结果对应修改前内容');
  assert.match(bar.innerHTML, /data-lint-rerun/, '提示条须提供一键重跑入口');
});

test('v2.664 只改剧名 / 本集结尾 / 终局大纲，同样判定过期（三处选填都参与指纹）', () => {
  for (const id of ['lintTitle', 'lintEnding', 'lintOutline']) {
    const { c, $ } = setup();
    $('lintText').value = '正文';
    c.last = { kind: 'arch', data: {} };
    c.lastKey = c.inputsKey();
    $(id).value = '改了这一项';
    c.syncStale();
    assert.equal(c.isStale(), true, `${id} 改动后应判定过期`);
    assert.ok($('lintResult').querySelector('[data-lint-stale]'), `${id} 改动后应显示提示条`);
  }
});

test('v2.664 改回原文后提示条自动撤下（不会常驻吓人）', () => {
  const { c, $ } = setup();
  $('lintText').value = '原始正文';
  c.last = { kind: 'lint', data: {}, eps: 1, meta: {} };
  c.lastKey = c.inputsKey();
  $('lintText').value = '临时改动';
  c.syncStale();
  assert.ok($('lintResult').querySelector('[data-lint-stale]'));
  $('lintText').value = '原始正文';
  c.syncStale();
  assert.equal($('lintResult').querySelector('[data-lint-stale]'), null, '恢复原文后应撤下提示条');
  assert.equal($('lintResult').classList.contains('lint-stale'), false);
});

test('v2.664 repeat 调用 syncStale 不重复插入提示条', () => {
  const { c, $ } = setup();
  $('lintText').value = 'a'.repeat(30);
  c.last = { kind: 'lint', data: {} };
  c.lastKey = c.inputsKey();
  $('lintText').value = 'b'.repeat(30);
  c.syncStale(); c.syncStale(); c.syncStale();
  assert.equal($('lintResult')._children.length, 1, '提示条只能有一条');
});

test('v2.664 切语言重渲染后，过期提示仍然保留（reRender 须补回提示条）', () => {
  const { c, $ } = setup();
  $('lintText').value = '原始正文';
  c.last = { kind: 'lint', data: {}, eps: 1, meta: {} };
  c.lastKey = c.inputsKey();
  $('lintText').value = '改过的正文';
  // 模拟语言切换：结果区被重新渲染（innerHTML 清空），提示条随之丢失
  $('lintResult')._children.length = 0;
  $('lintResult').firstChild = null;
  c.reRender();
  assert.ok($('lintResult').querySelector('[data-lint-stale]'), '重渲染后仍应看到过期提示');
});

test('v2.664 runLint 成功后把当前输入记为指纹，之后再改才算过期', async () => {
  const { c, $ } = setup();
  $('lintText').value = 'x'.repeat(30);
  await c.runLint();
  assert.equal(c._rendered, 1, '成功渲染一次结果');
  assert.equal(c.lastKey, c.inputsKey(), '跑完须记录本次输入指纹');
  assert.equal(c.isStale(), false, '刚跑完不应判过期');
  $('lintText').value = 'y'.repeat(30);
  assert.equal(c.isStale(), true, '跑完后再改正文才应过期');
});

test('v2.664 正文过短：拦在本地，不发请求也不动指纹', async () => {
  const { c, $ } = setup({ postJson: async () => { c._posted = (c._posted || 0) + 1; return {}; } });
  $('lintText').value = '太短';
  c.lastKey = 'before';
  await c.runLint();
  assert.equal(c._errs, 1, '应提示先贴正文');
  assert.equal(c._posted || 0, 0, '不应发请求');
  assert.equal(c.lastKey, 'before', '被拦截时不得改写指纹');
});

test('v2.664 静态契约：输入接线、重跑委托、复制带过期说明、结果区可被读屏播报', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
  assert.match(VIEW, /const LINT_FIELDS = \['lintText', 'lintTitle', 'lintEnding', 'lintOutline'\]/, '四个输入须登记在同一清单里');
  assert.match(VIEW, /addEventListener\('input', syncStale\)/, '输入变化须触发过期判定');
  assert.match(VIEW, /closest\('\[data-lint-rerun\]'\)/, '重跑按钮须用事件委托');
  assert.match(VIEW, /const key = inputsKey\(\)/, '提交前须对输入取指纹（请求期间改动也算过期）');
  assert.match(VIEW, /lastKey = key/, '结果落地时须同步指纹');
  assert.match(VIEW, /isStale\(\) \? T\(\)\.staleReportNote/, '复制问题单时若已过期须在开头说明');
  for (const key of ['staleHint', 'staleRerun', 'staleReportNote']) {
    const hits = VIEW.match(new RegExp(key + ':', 'g')) || [];
    assert.ok(hits.length >= 2, `${key} 须同时有中英两份文案`);
  }
  assert.match(html, /<div id="lintResult" role="status" aria-live="polite">/, '结果区须可被读屏播报');
  assert.match(css, /\.lint-stale-bar\{/, '缺过期提示条样式');
  assert.match(css, /@keyframes zn-stale-pulse/, '缺提示圆点脉冲动画');
  assert.match(css, /prefers-reduced-motion[\s\S]{0,200}lint-stale/, '须尊重减弱动效偏好');
});
