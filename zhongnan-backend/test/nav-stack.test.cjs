/**
 * 导航栈 + 面包屑 —— TDD 先红后绿
 * 目标：解决 switchView 平级切换无层级、无返回链的问题。
 *       维护一个导航栈，每次进入视图压栈，pop 返回上一级，
 *       跳到已存在层级时截断后面（避免栈无限增长）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { createNavStack } = require('../web/nav-stack.js');

describe('导航栈 · 基本行为', () => {
  it('初始栈为空 / peek 返回 null', () => {
    const ns = createNavStack();
    assert.deepStrictEqual(ns.list(), []);
    assert.strictEqual(ns.peek(), null);
  });

  it('push 单个视图后 list/peek 正确', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home']);
    assert.strictEqual(ns.peek().view, 'home');
  });

  it('push 多个视图形成栈链', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    ns.push({ view: 'studio', label: '创作' });
    ns.push({ view: 'works', label: '我的作品' });
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home', 'studio', 'works']);
  });

  it('pop 返回最后压入的视图并出栈', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    ns.push({ view: 'studio', label: '创作' });
    const popped = ns.pop();
    assert.strictEqual(popped.view, 'studio');
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home']);
  });

  it('pop 在只剩根视图时返回根视图且不出栈（防止空栈）', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    const popped = ns.pop();
    assert.strictEqual(popped.view, 'home');
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home']);
  });

  it('pop 在空栈时返回 null 不崩', () => {
    const ns = createNavStack();
    const popped = ns.pop();
    assert.strictEqual(popped, null);
    assert.deepStrictEqual(ns.list(), []);
  });

  it('push 已存在层级的视图时截断后面（避免栈无限增长）', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    ns.push({ view: 'studio', label: '创作' });
    ns.push({ view: 'works', label: '作品' });
    // 栈：home → studio → works，再 push home 应截断为只剩 home
    ns.push({ view: 'home', label: '首页' });
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home']);
  });

  it('push 不同视图正常追加', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    ns.push({ view: 'studio', label: '创作' });
    ns.push({ view: 'toolbox', label: '工具箱' });
    assert.deepStrictEqual(ns.list().map((x) => x.view), ['home', 'studio', 'toolbox']);
  });

  it('canPop：栈深 > 1 可返回，否则不可', () => {
    const ns = createNavStack();
    assert.strictEqual(ns.canPop(), false);
    ns.push({ view: 'home', label: '首页' });
    assert.strictEqual(ns.canPop(), false);
    ns.push({ view: 'studio', label: '创作' });
    assert.strictEqual(ns.canPop(), true);
  });
});

describe('导航栈 · 面包屑渲染', () => {
  // 极简 fake DOM：渲染只用到 children/innerHTML/textContent
  function makeFakeCrumb() {
    return {
      _html: '',
      set innerHTML(v) { this._html = String(v); },
      get innerHTML() { return this._html; },
      children: [],
    };
  }

  it('渲染面包屑：每级一个 chip，最后一级高亮 active', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    ns.push({ view: 'studio', label: '创作' });
    ns.push({ view: 'works', label: '作品' });
    const el = makeFakeCrumb();
    ns.renderBreadcrumb(el);
    const html = el.innerHTML;
    assert.match(html, /首页/);
    assert.match(html, /创作/);
    assert.match(html, /作品/);
    assert.match(html, /active/);
  });

  it('渲染空栈：返回空串不崩', () => {
    const ns = createNavStack();
    const el = makeFakeCrumb();
    ns.renderBreadcrumb(el);
    assert.strictEqual(el.innerHTML, '');
  });

  it('渲染单层栈：只有一个 chip 且 active', () => {
    const ns = createNavStack();
    ns.push({ view: 'home', label: '首页' });
    const el = makeFakeCrumb();
    ns.renderBreadcrumb(el);
    assert.match(el.innerHTML, /首页/);
    assert.match(el.innerHTML, /active/);
  });
});
