/**
 * v2.662 递招方法卡搜索 + 数量单一真源
 * 背景：递招面板「浏览全部 43 张方法卡」展开后是 4 组长栅格，找特定手法只能肉眼扫；
 * 同时块头「43张方法卡 / 10类钩子」是写死的静态文案，而 details 已按分类库总量动态渲染——
 * 同一面板两个真源，库一增删头部立刻失真（v2.525 只修了 summary，此轮补上头部与搜索）。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

function setup(names, extra = {}) {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set(['hidden']);
      nodes.set(id, {
        id, value: '', checked: false, textContent: '', innerHTML: '', dataset: {}, style: {},
        classList: {
          add: (...xs) => xs.forEach((x) => classes.add(x)),
          remove: (...xs) => xs.forEach((x) => classes.delete(x)),
          contains: (x) => classes.has(x),
          toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); },
        },
        setAttribute() {}, appendChild() {}, focus() {}, remove() {},
        querySelector: () => null, querySelectorAll: () => [],
      });
    }
    return nodes.get(id);
  };
  const context = { $, lang: 'zh', console, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    // 与 index.html 静态兜底同口径：测试里只验证「库内真值被传进模板」
    t: (k, vars) => (vars ? `免费 · ${vars.cards}张方法卡 / ${vars.hooks}类钩子` : k),
    escapeHtml: (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    ...extra };
  vm.createContext(context);
  for (const name of ['highlightNeedle', 'znEmptyHtml', '_znEsc', ...names]) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { context, $ };
}

const TAXONOMY = {
  hooks: [{ id: 'episode_hook', name: '集尾钩' }, { id: 'scene_hook', name: '场景钩' }],
  cardGroups: [
    { name: '叙事装置', count: 2, cards: [
      { id: 'c_rev', title: '身份反转', formula: '先给假身份再翻牌' },
      { id: 'c_cold', title: '冷开场', formula: '从结局倒叙' },
    ] },
    { name: '关系', count: 1, cards: [{ id: 'c_dual', title: '双雄对峙', formula: '两人互为目标' }] },
  ],
  totals: { hooks: 2, cards: 3 },
};

function cardsHarness(extra = {}) {
  return setup(['renderCraftCards', 'craftCardMatches'], {
    craftTaxonomy: TAXONOMY,
    craftRecCards: [{ id: 'c_cold', title: '冷开场', formula: '从结局倒叙' }],
    craftSelCards: [],
    craftCardQuery: '',
    ...extra,
  });
}

test('v2.662 无搜索词：推荐区与全部卡照常渲染，details 默认收起', () => {
  const { context: c, $ } = cardsHarness();
  c.renderCraftCards();
  const html = $('craftCards').innerHTML;
  assert.match(html, /最贴你创意的方法/, '无搜索词时推荐区应可见');
  assert.match(html, /浏览全部 3 张方法卡/, '全部卡入口应显示库内总量');
  assert.match(html, /<details class="craft-all">/, '无搜索词时 details 不应强制展开');
});

test('v2.662 搜索词命中标题或公式：只渲染匹配卡并自动展开', () => {
  const { context: c, $ } = cardsHarness({ craftCardQuery: '反转' });
  c.renderCraftCards();
  const html = $('craftCards').innerHTML;
  assert.match(html, /身份.*反转/, '命中标题的卡应保留（命中词可被 <mark> 包裹）');
  assert.doesNotMatch(html, /冷开场/, '不匹配的卡不应出现');
  assert.doesNotMatch(html, /双雄对峙/, '不匹配的卡不应出现');
  assert.match(html, /<details class="craft-all" open>/, '搜索时应自动展开，否则用户看不到结果');
  assert.match(html, /搜索结果（1 张）/, '搜索时应告知命中张数');
  assert.doesNotMatch(html, /最贴你创意的方法/, '搜索时应隐藏推荐区，避免与结果混杂');
});

test('v2.662 搜索匹配公式字段（不止标题）', () => {
  const { context: c, $ } = cardsHarness({ craftCardQuery: '倒叙' });
  c.renderCraftCards();
  const html = $('craftCards').innerHTML;
  assert.match(html, /冷开场/, '公式命中的卡也应保留');
  assert.doesNotMatch(html, /身份反转/, '公式不匹配的卡不应出现');
});

test('v2.662 搜索无命中：给空态而不是空白，且提示回显关键词', () => {
  const { context: c, $ } = cardsHarness({ craftCardQuery: '不存在的词' });
  c.renderCraftCards();
  const html = $('craftCards').innerHTML;
  assert.match(html, /没有匹配/, '无命中应有空态提示');
  assert.match(html, /不存在的词/, '空态应回显关键词，便于核对输入');
  assert.doesNotMatch(html, /class="craft-card /, '无命中时不应渲染任何卡');
});

test('v2.662 清空搜索词后恢复推荐区与全部卡', () => {
  const { context: c, $ } = cardsHarness({ craftCardQuery: '反转' });
  c.renderCraftCards();
  assert.doesNotMatch($('craftCards').innerHTML, /最贴你创意的方法/);
  c.craftCardQuery = '';
  c.renderCraftCards();
  const html = $('craftCards').innerHTML;
  assert.match(html, /最贴你创意的方法/, '清空后推荐区应恢复');
  assert.match(html, /浏览全部 3 张方法卡/, '清空后全部卡入口应恢复');
});

test('v2.662 匹配函数：空词全通过、大小写不敏感、仅匹配标题与公式', () => {
  const { context: c } = setup(['craftCardMatches']);
  assert.equal(c.craftCardMatches({ title: '冷开场', formula: '' }, ''), true, '空搜索词应全部通过');
  assert.equal(c.craftCardMatches({ title: 'Cold open', formula: 'start at the end' }, 'COLD'), true, '标题匹配应大小写不敏感');
  assert.equal(c.craftCardMatches({ title: 'Cold open', formula: 'start at the end' }, 'END'), true, '公式匹配应大小写不敏感');
  assert.equal(c.craftCardMatches({ title: '冷开场', formula: '从结局倒叙' }, '双雄'), false, '无关词不应命中');
});

test('v2.662 块头数量跟随分类库，不再写死 43/10', () => {
  const { context: c, $ } = setup(['syncCraftFreeCount'], { craftTaxonomy: TAXONOMY });
  c.syncCraftFreeCount();
  assert.equal($('craftFree').textContent, '免费 · 3张方法卡 / 2类钩子', '块头数量应取分类库 totals');
});

test('v2.662 分类库未加载时不得用空值覆盖块头兜底文案', () => {
  const { context: c, $ } = setup(['syncCraftFreeCount'], { craftTaxonomy: null });
  $('craftFree').textContent = '免费 · 43张方法卡 / 10类钩子';
  c.syncCraftFreeCount();
  assert.equal($('craftFree').textContent, '免费 · 43张方法卡 / 10类钩子', '库未加载时应保留静态兜底');
});

test('v2.662 搜索框与块头 id 已接线（静态契约）', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'test', 'web-ui-contract.test.cjs'), 'utf8');
  const i18n = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');
  assert.match(html, /id="craftCardSearch"/, 'index.html 应有方法卡搜索框');
  assert.match(html, /data-ph="craftCardSearchPh"/, '搜索框占位符应走 i18n');
  assert.match(html, /id="craftFree"/, '块头数量文案需要有可更新的 id');
  assert.ok(source.includes('craftCardSearch.oninput'), 'app.js 应把搜索框 input 接到重渲染');
  assert.ok(i18n.includes('craftCardSearchPh:'), 'i18n 缺搜索框占位符键');
  assert.ok(i18n.includes('craftFreeCount:'), 'i18n 缺块头数量模板键');
  void ui;
});
