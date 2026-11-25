/**
 * v2.688 切语言不得偷换工作台面板
 * 缺口：用户打开素材库（novelSrcBench）后点「中 / EN」，applyLang 内的 syncTagBench /
 * syncModeBrief 仍会 classList.toggle('hidden', ...)，把标签台或创作前简报显出来；
 * MutationObserver 随即把 layer.dataset.current 改成那个面板，用户眼前的内容被整块顶掉。
 * 契约：语言同步期间只刷新文案，不改任何工作台面板显隐、不主动 openWorkbench。
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

test('v2.688 applyLang 在同步期间置位/复位 _langSyncing，且覆盖两个同步函数', () => {
  assert.ok(source.includes('let _langSyncing = false;'), '必须声明切语言显隐守卫');
  const start = source.indexOf('_langSyncing = true;');
  const end = source.indexOf('_langSyncing = false;');
  assert.ok(start > 0 && end > start, 'applyLang 必须置位并在结束后复位 _langSyncing');
  const window = source.slice(start, end);
  assert.ok(window.includes('syncTagBench()'), '标签台同步必须在守卫区间内');
  assert.ok(window.includes('syncModeBrief()'), '创作前简报同步必须在守卫区间内');
});

test('v2.688 syncTagBench 切语言时跳过 hidden 切换与 openWorkbench', () => {
  const fn = functions.get('syncTagBench');
  assert.ok(fn, 'syncTagBench 必须存在');
  assert.match(fn, /if \(!_langSyncing\) bench\.classList\.toggle\('hidden', !show\);/, '显隐切换必须受守卫保护');
  assert.match(fn, /!_initSyncing && !_langSyncing\) openWorkbench\('tagBench'\)/, '守卫期间不得主动打开面板');
});

test('v2.688 syncModeBrief 所有工作台面板显隐都走守卫，且窗口内不打开 layer', () => {
  const fn = functions.get('syncModeBrief');
  assert.ok(fn, 'syncModeBrief 必须存在');
  assert.match(fn, /const _toggle = \(el, hide\) => \{ if \(el && !_langSyncing\) el\.classList\.toggle\('hidden', hide\); \}/, '显隐必须收口到带守卫的 _toggle');
  const bareToggles = fn.match(/(\w+|\$?\([^)]*\)?)\.classList\.toggle\('hidden'/g) || [];
  // 只允许 _toggle 内部那一处 toggle；其余面板不得裸调
  assert.equal(bareToggles.length, 1, `只应保留 _toggle 内部一处 hidden 切换，实际 ${bareToggles.length} 处`);
  assert.match(fn, /!_initSyncing && !_langSyncing\) \{/, '切语言期间不得主动 openWorkbench');
});

test('v2.688 行为：语言同步期间 syncModeBrief 对任何面板都不切 hidden、不打开工作台', () => {  const toggles = [];
  const opened = [];
  const element = (id) => ({
    id, hidden: true, textContent: '', innerHTML: '', placeholder: '', dataset: {}, children: [],
    classList: {
      contains: () => false,
      toggle(name, on) { toggles.push([id, name, on]); },
      add() {}, remove() {},
    },
    appendChild(child) { this.children.push(child); },
  });
  const nodes = new Map();
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const context = {
    $, console, lang: 'en', selectedMode: 'spark', selectedTrack: 'material_rewrite',
    selectedScriptType: 'vertical_drama', _langSyncing: true, _initSyncing: false,
    draftProject: null, tagChosen: [], _RANK: { FREE: 1, BASIC: 1, ADVANCED: 2, PRO: 3 },
    MODE_BRIEF: { spark: { zh: ['灵感', '提示'], en: ['Spark', 'Tip'] }, default: { zh: ['默认', '提示'], en: ['Default', 'Tip'] } },
    acctRank: () => 1, isInteractiveType: () => false,
    draftProjectMatchesMode: () => true, clearDraftProject() {},
    initBriefUpload() {}, initInterviewPanel() {}, renderBrandPanel() {}, renderTrendPanel() {},
    renderBranchPanel() {}, renderSourceTextPanel() {},
    openWorkbench: (id) => opened.push(id),
    document: { createElement: () => element('btn'), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  };
  vm.createContext(context);
  vm.runInContext(functions.get('syncModeBrief'), context);
  context.syncModeBrief();
  assert.deepEqual(toggles, [], `切语言不得改任何面板显隐，实际：${JSON.stringify(toggles)}`);
  assert.deepEqual(opened, [], '切语言不得主动打开工作台');
  assert.equal($('modeBriefLabel').textContent, 'Spark', '文案仍应刷新为英文');
});

test('v2.688 自动补标签不再弹 toast，递招空灵感提示也只在递招台可见时出现', () => {
  assert.ok(functions.has('smartRandomTags'), 'smartRandomTags 必须存在');
  assert.match(functions.get('smartRandomTags'), /if \(!silent && lines\[0\]\) xnSay\(/, 'silent 自动补标签不得弹「组合已就绪」');
  const craft = functions.get('craftGo');
  assert.ok(craft, 'craftGo 必须存在');
  assert.match(craft, /const craftVisible = \$\('craftBench'\) && !\$\('craftBench'\)\.classList\.contains\('hidden'\)/, '空灵感提示须先看递招台是否可见');
  assert.match(craft, /if \(craftVisible\) \{ xnSay\(t\('craftNeedIdea'\)\);/, '不可见时不得弹跨面板 toast');
});

test('v2.688 二级界面隐藏品牌 hero、返回时还回，顶部不再露出半截大标题', () => {
  const show = functions.get('showModeDetail');
  const back = functions.get('backToGrid');
  assert.match(show, /#view-studio > \.hero'\)/, '进入二级界面必须隐藏 studio hero');
  assert.match(back, /#view-studio > \.hero'\)\s*\n?\s*\.forEach\(el => el\.classList\.remove\('hidden'\)\)/, '返回一级界面必须恢复 hero');
});

test('v2.688 切语言后工作台标题跟着换：只改标题，不改显隐', () => {
  assert.ok(functions.has('syncWorkbenchTitle'), '必须有工作台标题同步函数');
  const after = source.slice(source.indexOf('_langSyncing = false;'));
  assert.ok(after.includes('syncWorkbenchTitle()'), 'applyLang 复位守卫后必须刷新工作台标题');
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, { id, textContent: '', dataset: {}, classList: { contains: () => false }, querySelector: () => null });
    return nodes.get(id);
  };
  const context = {
    $, console, lang: 'en',
    WORKBENCH_TITLES: { novelSrcBench: { zh: '免费合法小说素材库', en: 'Novel Sources' } },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  };
  vm.createContext(context);
  vm.runInContext(functions.get('syncWorkbenchTitle'), context);
  $('workbenchLayer').dataset.current = 'novelSrcBench';
  context.syncWorkbenchTitle();
  assert.equal($('workbenchTitle').textContent, 'Novel Sources');
});

