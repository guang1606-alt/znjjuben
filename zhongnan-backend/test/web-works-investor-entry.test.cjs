'use strict';
// v2.693 存量作品「最后一公里」不可达：
// 资方体检与投稿渠道只在当次生成完成后渲染，用户从作品库打开旧项目，想再看一眼「能不能投」
// 只能重新生成一集。现作品详情（有成稿时）给出「投稿体检」入口，以仅体检模式进入结果页，
// 顶部交代在看哪部作品并可一键返回；生成/恢复会话时必须摘掉该临时模式，否则新结果只露出两块。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const appSource = read('web/app.js');
const html = read('web/index.html');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');
const ast = ts.createSourceFile('app.js', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const pick = (name) => {
  let out = '';
  (function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) out = node.getText(ast);
    ts.forEachChild(node, walk);
  })(ast);
  return out;
};

function makeCtx() {
  const nodes = new Map();
  const calls = [];
  const makeNode = () => {
    const set = new Set();
    const attrs = new Map();
    return {
      textContent: '',
      attrs,
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      classList: {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        _set: set,
      },
    };
  };
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); };
  const ctx = {
    lang: 'zh',
    $: get,
    currentProjectId: 'generation-project',
    switchView: (v) => calls.push(['switchView', v]),
    loadInvestorLens: async (id) => { calls.push(['loadInvestorLens', id]); },
    openProject: async (p) => { calls.push(['openProject', p && p.id]); },
  };
  vm.createContext(ctx);
  for (const name of ['openInvestorFromWorks', 'closeInvestorFromWorks']) {
    const src = pick(name);
    assert.ok(src, `必须能抽取到真实 ${name} 实现`);
    vm.runInContext(src, ctx);
  }
  return { ctx, nodes, calls };
}

test('openInvestorFromWorks：进入仅体检模式并记住上一个项目上下文', () => {
  const { ctx, nodes, calls } = makeCtx();
  ctx.openInvestorFromWorks({ id: 'p-old', title: '旧项目' });
  const panel = nodes.get('resultPanel');
  assert.equal(panel.getAttribute('data-mode'), 'investor', '必须挂上仅体检模式');
  assert.equal(panel.classList.contains('hidden'), false, '结果页必须可见');
  assert.equal(panel.classList.contains('hidden'), false);
  assert.equal(nodes.get('investorWorksHead').classList.contains('hidden'), false, '作品交代条必须露出');
  assert.equal(nodes.get('investorWorksTitle').textContent, '旧项目');
  assert.equal(ctx.currentProjectId, 'p-old', '必须锁定作品上下文供体检取数');
  assert.deepEqual(calls.find((c) => c[0] === 'switchView'), ['switchView', 'studio']);
  assert.deepEqual(calls.find((c) => c[0] === 'loadInvestorLens'), ['loadInvestorLens', 'p-old']);
});

test('closeInvestorFromWorks：摘掉临时模式、收起三块、还原项目上下文并回作品库', () => {
  const { ctx, nodes, calls } = makeCtx();
  ctx.openInvestorFromWorks({ id: 'p-old', title: '旧项目' });
  ctx.closeInvestorFromWorks(true);
  const panel = nodes.get('resultPanel');
  assert.equal(panel.getAttribute('data-mode'), null, '临时模式必须摘掉，否则下次生成只露两块');
  assert.equal(panel.classList.contains('hidden'), true);
  for (const id of ['investorPanel', 'submissionPanel', 'investorWorksHead']) {
    assert.equal(nodes.get(id).classList.contains('hidden'), true, `${id} 必须收起`);
  }
  assert.equal(ctx.currentProjectId, 'generation-project', '必须还原进入前的项目上下文');
  assert.deepEqual(calls[calls.length - 1], ['openProject', 'p-old'], '必须还原同一部作品详情，而不是把用户丢回列表');
  assert.deepEqual(calls[calls.length - 2], ['switchView', 'works']);
});

test('closeInvestorFromWorks(false)：不强制切视图（供页内返回使用）', () => {
  const { ctx, calls } = makeCtx();
  ctx.openInvestorFromWorks({ id: 'p-old', title: '旧项目' });
  const before = calls.filter((c) => c[0] === 'switchView').length;
  ctx.closeInvestorFromWorks(false);
  assert.equal(calls.filter((c) => c[0] === 'switchView').length, before, '不应额外切视图');
});

test('resetPanels：生成/恢复会话时清掉仅体检模式', () => {
  const src = pick('resetPanels');
  assert.ok(src, '必须能抽取到真实 resetPanels 实现');
  assert.match(src, /removeAttribute\('data-mode'\)/, 'resetPanels 必须摘掉 data-mode');
  assert.match(src, /investorWorksHead/, 'resetPanels 必须收起作品交代条');
});

test('workbenchTitleOf：仅体检模式下标题写「投稿体检」，退出后回到创作结果', () => {
  const src = pick('workbenchTitleOf');
  assert.ok(src, '必须能抽取到真实 workbenchTitleOf 实现');
  const ctx = {
    lang: 'zh',
    WORKBENCH_TITLES: { resultPanel: { zh: '创作结果', en: 'Result' } },
    t: (k) => (k === 'worksLens' ? '投稿体检' : k),
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const investorEl = { getAttribute: (k) => (k === 'data-mode' ? 'investor' : null), querySelector: () => null };
  const plainEl = { getAttribute: () => null, querySelector: () => null };
  assert.equal(ctx.workbenchTitleOf('resultPanel', investorEl), '投稿体检');
  assert.equal(ctx.workbenchTitleOf('resultPanel', plainEl), '创作结果');
  assert.match(appSource, /titleEl\.textContent = workbenchTitleOf\(id, el\)/, '工作台打开时必须走标题真源');
});

test('入口与样式契约：作品详情按钮、交代条、仅体检裁剪规则、中英文案齐备', () => {
  assert.match(html, /id="worksLensBtn"[^>]*data-i="worksLens"/, '作品详情缺少「投稿体检」按钮');
  assert.match(html, /id="investorWorksHead"/, '结果页缺少作品交代条');
  assert.match(html, /id="investorWorksBack"[^>]*data-i="invWorksBack"/, '交代条缺少返回入口');
  assert.match(css, /#resultPanel\[data-mode="investor"\]\s*>\s*:not\(#investorWorksHead\)/, '缺少仅体检模式的裁剪规则');
  assert.match(i18n, /worksLens: '投稿体检'/, '缺少中文按钮文案');
  assert.match(i18n, /worksLens: 'Pitch check'/, '缺少英文按钮文案');
  assert.ok(/worksLensBtn[\s\S]{0,160}openInvestorFromWorks\(currentWorksProject\)/.test(appSource), '按钮未接到真实入口');
  assert.ok(/investorWorksBack[\s\S]{0,120}closeInvestorFromWorks\(true\)/.test(appSource), '返回按钮未接线');
});
