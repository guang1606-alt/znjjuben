const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ProgressView = require('../web/progress-view.js');

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map(), initializers = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && node.initializer) initializers.set(node.name.getText(ast), node.initializer.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);

// Model browser mutation delivery between promise continuations, with cancellable
// animation timers. The app's observer, navigation, queue renderer and project
// renderer run unchanged; only DOM primitives and network IO are replaced.
function setup() {
  const nodes = new Map(), observers = [], timers = new Map();
  let timerId = 0, observerScheduled = false;
  function notify(target) {
    for (const observer of observers) {
      if (observer.targets.has(target)) observer.records.push({ attributeName: 'class', target });
    }
    if (observerScheduled) return;
    observerScheduled = true;
    queueMicrotask(() => {
      observerScheduled = false;
      for (const observer of observers) {
        const records = observer.records.splice(0);
        if (records.length) observer.callback(records);
      }
    });
  }
  function element(id, hidden = true) {
    const classes = new Set(hidden ? ['hidden'] : []), attrs = {};
    const node = { id, dataset: {}, style: { setProperty() {} }, innerHTML: '', textContent: '', children: [],
      getBoundingClientRect: () => ({ bottom: 78, top: 0, height: 0 }),
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      setAttribute: (key, value) => { attrs[key] = value; }, getAttribute: key => attrs[key],
      removeAttribute: key => { delete attrs[key]; },
      appendChild(child) { child.parentElement = node; node.children.push(child); },
      classList: {
        contains: name => classes.has(name),
        add(...names) { for (const name of names) classes.add(name); notify(node); },
        remove(...names) { for (const name of names) classes.delete(name); notify(node); },
        toggle(name, on) { const next = on ?? !classes.has(name); if (next) this.add(name); else this.remove(name); return next; },
      },
    };
    return node;
  }
  const $ = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const views = ['studio', 'works', 'vip', 'square', 'market', 'admin'];
  const nav = views.map(view => { const el = element('nav-' + view, false); el.setAttribute('data-view', view); if (view === 'studio') el.classList.add('active'); return el; });
  $('view-studio').classList.remove('hidden');
  const urls = [], errors = [];
  let resolveScripts;
  const scriptsResponse = new Promise(resolve => { resolveScripts = resolve; });
  const context = {
    $, console, lang: 'zh', _switchAnimToken: 0, PV: () => ProgressView,
    capturePrivateSession: () => ({ owner: 'fixture', epoch: 0 }), isPrivateSessionCurrent: () => true,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.records = []; this.targets = new Set(); observers.push(this); }
      observe(node) { this.targets.add(node); }
    },
    document: {
      querySelector: selector => selector === '.nav-item.active' ? nav.find(el => el.classList.contains('active')) : views.map(view => $('view-' + view)).find(el => !el.classList.contains('hidden')),
      querySelectorAll: selector => selector === '.nav [data-view]' ? nav : [],
      getElementById: () => null, addEventListener() {}, removeEventListener() {},
    },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    Api: { request: async url => { urls.push(url); return scriptsResponse; }, jsonOrThrow: async response => response },
    t: text => text, escapeHtml: text => String(text ?? ''), toastError: text => errors.push(text), xnSay() {},
    loadMe() {}, loadWorks() {}, loadCatalog() {}, loadFeed() {}, loadListings() {}, enterAdmin() {},
    currentWorksProject: null, currentWorksDiagnosis: null, currentProjectId: null,
    pendingWarnings: null, lastFiling: null, progress: null, abortCtrl: null, lastDone: null,
    activeSessionId: 's1', genSessions: [{ id: 's1', status: 'done', projectId: 'p1', title: '完整作品' }],
  };
  vm.createContext(context);
  for (const name of ['VIEWS', '_WORKBENCH_PANEL_IDS', 'WORKBENCH_TITLES', '_workbenchInited', '_workbenchHideTimer', '_workbenchPrevHidden', '_workbenchOpenToken', '_GENERATIVE_PANELS', '_navStack', '_workbenchPrevFocus']) {
    vm.runInContext(`let ${name} = ${initializers.get(name)};`, context);
  }
  // _syncTopbarOffset（v2.612 topbar 避让）为 _showWorkbenchLayer 依赖；_navStack 的初始化器自带
  // ZnNavStack 存在性守卫，在 vm 中自然降级为 null，与浏览器缺 nav-stack.js 时的行为一致
  // v2.221 加载/空态统一：openProject 依赖 znSkeleton/znEmpty*，一并注入真实实现
  for (const name of ['_znEsc', 'znSkeletonHtml', 'znSkeleton', 'znEmptyHtml', 'znEmpty', '_syncTopbarOffset', '_syncWorkbenchTopInset', '_initWorkbenchLayer', '_showWorkbenchLayer', '_hideWorkbenchLayer', 'openWorkbench', 'closeWorkbench', '_workbenchEsc', 'switchView', 'switchSession', 'renderTaskQueue', 'openProject', 'resetPanels', 'showFail', 'genClickGuard']) {
    vm.runInContext(functions.get(name), context);
  }
  context._initWorkbenchLayer();
  const flushMutations = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const finishAnimations = async () => {
    await flushMutations();
    for (const [id, timer] of [...timers].sort((a, b) => a[1].delay - b[1].delay)) {
      if (!timers.has(id)) continue;
      timers.delete(id); timer.fn(); await flushMutations();
    }
  };
  return { c: context, $, urls, errors, resolveScripts, flushMutations, finishAnimations };
}

test('completed task stays in Works after the real project fetch, queue redraw, observer and close timer', async () => {
  const { c, $, urls, errors, resolveScripts, flushMutations, finishAnimations } = setup();
  c.renderTaskQueue();
  await flushMutations();
  assert.equal($('workbenchLayer').dataset.current, 'taskQueuePanel');

  const navigation = c.switchSession('s1');
  await flushMutations();
  assert.equal($('view-works').classList.contains('hidden'), false);
  resolveScripts([{ id: 'ep1', epNo: 1, version: 1, title: '第一集', content: '真实作品正文', wordCount: 6 }]);
  await navigation;
  await finishAnimations();

  assert.deepEqual(errors, []);
  assert.deepEqual(urls, ['/api/generate/projects/p1/scripts']);
  assert.match($('epsList').innerHTML, /真实作品正文/);
  assert.equal($('worksDetailTitle').textContent, '完整作品');
  assert.equal($('view-works').classList.contains('hidden'), false);
  assert.equal($('workbenchLayer').classList.contains('hidden'), true);
  assert.equal($('workbenchLayer').getAttribute('aria-hidden'), 'true');
  assert.equal($('taskQueuePanel').classList.contains('hidden'), true);
});

for (const view of ['works', 'vip', 'square', 'market', 'admin']) {
  test(`background progress, result and failure mutations do not reopen the workbench over ${view}`, async () => {
    const { c, $, flushMutations, finishAnimations } = setup();
    c.openWorkbench('sourceTextPanel');
    await flushMutations();
    c.switchView(view);
    await flushMutations();
    for (const id of ['progressPanel', 'resultPanel', 'failPanel']) {
      $(id).classList.remove('hidden');
      await flushMutations();
      assert.equal($(id).classList.contains('hidden'), true);
    }
    c.renderTaskQueue();
    await finishAnimations();
    assert.equal($('view-' + view).classList.contains('hidden'), false);
    assert.equal($('workbenchLayer').classList.contains('hidden'), true);
  });
}

test('a user can explicitly reopen a workbench after returning to Studio', async () => {
  const { c, $, flushMutations, finishAnimations } = setup();
  c.openWorkbench('sourceTextPanel');
  await flushMutations();
  c.switchView('works');
  await finishAnimations();
  c.renderTaskQueue();
  await flushMutations();
  c.switchView('studio');
  c.openWorkbench('sourceTextPanel');
  await finishAnimations();
  assert.equal($('view-studio').classList.contains('hidden'), false);
  assert.equal($('workbenchLayer').classList.contains('hidden'), false);
  assert.equal($('workbenchLayer').dataset.current, 'sourceTextPanel');
  assert.equal($('sourceTextPanel').classList.contains('hidden'), false);
  assert.equal($('taskQueuePanel').classList.contains('hidden'), true);
});

test('opening a workbench hides every stale panel and removes the floating assistant', async () => {
  const { c, $, flushMutations, finishAnimations } = setup();
  $('tagBench').classList.remove('hidden');
  await flushMutations();

  c.openWorkbench('teardownPanel');
  await flushMutations();

  const visible = ['tagBench', 'craftBench', 'novelSrcBench', 'branchPanel',
    'branchBriefPanel', 'diversityPanel', 'roomPanel', 'teardownPanel',
    'interviewPanel', 'brandPanel', 'trendPanel', 'sourceTextPanel',
    'taskQueuePanel', 'progressPanel', 'resultPanel', 'failPanel']
    .filter(id => !$(id).classList.contains('hidden'));
  assert.deepEqual(visible, ['teardownPanel']);
  assert.equal($('workbenchLayer').dataset.current, 'teardownPanel');
  assert.equal($('xnFloat').classList.contains('workbench-hidden'), true);

  c.closeWorkbench();
  await finishAnimations();
  assert.equal($('xnFloat').classList.contains('workbench-hidden'), false);
});

test('observer-driven workbench updates also keep panels mutually exclusive', async () => {
  const { c, $, flushMutations } = setup();
  c.openWorkbench('tagBench');
  await flushMutations();
  $('resultPanel').classList.remove('hidden');
  await flushMutations();
  assert.equal($('workbenchLayer').dataset.current, 'resultPanel');
  assert.equal($('tagBench').classList.contains('hidden'), true);
  assert.equal($('resultPanel').classList.contains('hidden'), false);
});
