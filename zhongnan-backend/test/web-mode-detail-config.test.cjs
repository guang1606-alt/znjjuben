const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// v2.344 一级界面瘦身回归测试：
// 一级界面 = 纯模式选择（剧本类型/生成配置/钩子编排默认隐藏）；
// showModeDetail 把它们挂进二级界面侧栏并按模式过滤字段，backToGrid 还原并重新隐藏。
// 沙箱形态与 web-workbench-navigation.test.cjs 一致：AST 抽取函数 + 迷你 DOM。

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map(), initializers = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && node.initializer) initializers.set(node.name.getText(ast), node.initializer.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);

function makeEl(id = '') {
  const classes = new Set();
  const node = {
    id, children: [], parentNode: null, dataset: {}, attrs: {}, className: '',
    style: { setProperty() {} },
    textContent: '', value: '', scrollTop: 0,
    addEventListener() {}, removeEventListener() {},
    setAttribute(k, v) { node.attrs[k] = v; },
    getAttribute: (k) => node.attrs[k],
    removeAttribute: (k) => { delete node.attrs[k]; },
    focus() {},
    getBoundingClientRect: () => ({ bottom: 78, top: 0, height: 0 }),
    classList: {
      contains: (n) => classes.has(n),
      add: (...ns) => ns.forEach((n) => classes.add(n)),
      remove: (...ns) => ns.forEach((n) => classes.delete(n)),
      toggle(n, on) { const next = on ?? !classes.has(n); if (next) classes.add(n); else classes.delete(n); return next; },
    },
    _classes: classes,
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return node._html || ''; },
    set(v) { if (v === '') { node.children.forEach((c) => { c.parentNode = null; }); node.children = []; } node._html = v; },
  });
  Object.defineProperty(node, 'nextSibling', {
    get() {
      if (!node.parentNode) return null;
      const i = node.parentNode.children.indexOf(node);
      return i >= 0 && i < node.parentNode.children.length - 1 ? node.parentNode.children[i + 1] : null;
    },
  });
  node.appendChild = (c) => { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = node; node.children.push(c); return c; };
  node.insertBefore = (c, ref) => {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? node.children.indexOf(ref) : -1;
    if (i < 0) node.children.push(c); else node.children.splice(i, 0, c);
    c.parentNode = node; return c;
  };
  node.removeChild = (c) => { const i = node.children.indexOf(c); if (i >= 0) node.children.splice(i, 1); c.parentNode = null; return c; };
  const walk = (n, pred, acc) => { for (const c of n.children) { if (pred(c)) acc.push(c); walk(c, pred, acc); } return acc; };
  node.querySelectorAll = (sel) => {
    const m = /^\.([\w-]+)$/.exec(sel);
    if (m) return walk(node, (c) => c._classes.has(m[1]) || c.className.split(' ').includes(m[1]), []);
    return [];
  };
  node.querySelector = (sel) => {
    if (sel === '[id]') return walk(node, (c) => !!c.id, [])[0] || null;
    return null;
  };
  return node;
}

function setup() {
  const nodes = new Map();
  const scrollCalls = [];
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, makeEl(id)); return nodes.get(id); };

  const viewStudio = makeEl('view-studio');
  const sectionTitle = makeEl('sectionTitle');
  const modeGrid = makeEl('modeGrid');
  const modeDetail = makeEl('modeDetail'); modeDetail.classList.add('hidden');
  // v2.685 进入二级界面须把 modeDetail 头部滚到吸顶导航下方：给出可断言的文档坐标
  modeDetail.getBoundingClientRect = () => ({ top: 400, bottom: 2600, height: 2200, left: 0, right: 800, width: 800 });
  const modeDetailBody = makeEl('modeDetailBody');
  modeDetail.appendChild(modeDetailBody);
  ['modeDetailName', 'modeDetailDesc', 'modeDetailCost', 'modeBackBtn'].forEach((id) => nodes.set(id, makeEl(id)));

  // 三个出本配置：一级界面初始隐藏
  const scriptTypeBar = makeEl('scriptTypeBar'); scriptTypeBar.classList.add('hidden');
  const genConfigBar = makeEl('genConfigBar'); genConfigBar.classList.add('hidden');
  const fEngine = makeEl(''); fEngine.classList.add('field'); fEngine.appendChild(makeEl('engine'));
  const fEpisodes = makeEl(''); fEpisodes.classList.add('field'); fEpisodes.appendChild(makeEl('episodes'));
  const fCast = makeEl('castAssetField'); fCast.classList.add('field');
  genConfigBar.appendChild(fEngine); genConfigBar.appendChild(fEpisodes); genConfigBar.appendChild(fCast);
  const hookConsole = makeEl('hookConsole'); hookConsole.classList.add('hidden');

  [sectionTitle, modeGrid, modeDetail, scriptTypeBar, genConfigBar, hookConsole].forEach((el) => viewStudio.appendChild(el));
  nodes.set('view-studio', viewStudio);
  nodes.set('modeDetail', modeDetail); nodes.set('modeDetailBody', modeDetailBody);
  nodes.set('scriptTypeBar', scriptTypeBar); nodes.set('genConfigBar', genConfigBar); nodes.set('hookConsole', hookConsole);

  // 既有 panel 初始都住在 workbenchBody
  const wb = makeEl('workbenchBody');
  ['tagBench', 'interviewPanel', 'trendPanel', 'modeBriefPanel', 'sourceTextPanel'].forEach((id) => {
    const p = makeEl(id); p.classList.add('hidden'); wb.appendChild(p); nodes.set(id, p);
  });
  nodes.set('workbenchBody', wb);
  nodes.set('workbenchLayer', makeEl('workbenchLayer'));

  const topbar = makeEl('topbar');
  topbar.getBoundingClientRect = () => ({ top: 0, bottom: 78, height: 78, left: 0, right: 390, width: 390 });
  const documentMock = {
    querySelectorAll: (sel) => (String(sel).startsWith('#view-studio') ? [sectionTitle, modeGrid] : []),
    querySelector: (sel) => (sel === '.topbar' ? topbar : null),
    addEventListener() {}, removeEventListener() {},
    createElement: () => makeEl(),
    activeElement: null,
  };
  const windowMock = {
    scrollY: 1200,
    scrollTo: (arg, y2) => { scrollCalls.push(arg && typeof arg === 'object' ? { ...arg } : { top: arg, left: y2 }); },
    I18N: {
      MODES: [{ id: 'tag', name: '标签创建', cost: '30积分' }, { id: 'auto', name: '全自动', cost: '50积分' }],
      DICT: { zh: { mode: { tag: '标签创建', auto: '全自动' }, modeDesc: { tag: '四维标签定向出本', auto: '系统替你选模式' } } },
    },
    matchMedia: (q) => ({ matches: q.includes('prefers-reduced-motion') || q.includes('pointer: fine') }), // reduced-motion：backToGrid 同步完成；桌面视口非窄屏
  };

  const code = `
    let _modeDetailOpen = false;
    let _modeDetailMode = null;
    let _studioGridScrollY = 0;
    let _workbenchHideTimer = null;
    let _workbenchPrevFocus = null;
    const _WORKBENCH_PANEL_IDS = ${initializers.get('_WORKBENCH_PANEL_IDS')};
    const _MODE_PANEL_MAP = ${initializers.get('_MODE_PANEL_MAP')};
    const _LEVEL2_CONFIG_IDS = ${initializers.get('_LEVEL2_CONFIG_IDS')};
    const _level2Homes = ${initializers.get('_level2Homes')};
    const _MODE_CONFIG_HIDE = ${initializers.get('_MODE_CONFIG_HIDE')};
    const _renderModeBody = ${initializers.get('_renderModeBody')};
    ${functions.get('_level2Remember')}
    ${functions.get('_applyModeConfigFilter')}
    ${functions.get('_restoreLevel2Config')}
    ${functions.get('_workbenchEsc')}
    ${functions.get('_hideWorkbenchLayer')}
    ${functions.get('closeWorkbench')}
    ${functions.get('_sideBlocks')}
    ${functions.get('_prefersReducedMotion')}
    ${functions.get('_scrollModeDetailIntoView')}
    ${functions.get('_restoreStudioScroll')}
    ${functions.get('showModeDetail')}
    ${functions.get('backToGrid')}
    this.__api = { showModeDetail, backToGrid, isOpen: () => _modeDetailOpen };
  `;
  const ctx = vm.createContext({
    lang: 'zh',
    $, document: documentMock, window: windowMock,
    setTimeout: () => 0, clearTimeout: () => {},
    xnSay() {}, renderModes() {}, renderScriptTypes() {}, syncTagBench() {}, syncModeBrief() {},
    Promise,
  });
  vm.runInContext(code, ctx);
  return { api: ctx.__api, $, viewStudio, modeDetail, modeDetailBody, scriptTypeBar, genConfigBar, hookConsole, modeGrid, fEngine, scrollCalls, windowMock };
}

const inDetail = (modeDetailBody, el) => {
  let n = el;
  while (n) { if (n === modeDetailBody) return true; n = n.parentNode; }
  return false;
};

test('一级界面默认纯净：三个出本配置隐藏且挂在 view-studio 原位', () => {
  const { scriptTypeBar, genConfigBar, hookConsole, viewStudio } = setup();
  for (const el of [scriptTypeBar, genConfigBar, hookConsole]) {
    assert.ok(el.classList.contains('hidden'), `${el.id} 应默认隐藏`);
    assert.equal(el.parentNode, viewStudio, `${el.id} 应挂在 view-studio`);
  }
});

test('showModeDetail 把出本配置挂进二级界面侧栏并显示，模式 panel 进主栏', () => {
  const s = setup();
  s.api.showModeDetail('tag');
  assert.ok(s.api.isOpen());
  assert.equal(s.modeDetail.attrs['data-mode'], 'tag');
  assert.ok(!s.modeDetail.classList.contains('hidden'));
  for (const el of [s.scriptTypeBar, s.genConfigBar, s.hookConsole]) {
    assert.ok(!el.classList.contains('hidden'), `${el.id} 在二级界面应显示`);
    assert.ok(inDetail(s.modeDetailBody, el), `${el.id} 应在 modeDetailBody 内`);
  }
  // 剧本类型在侧栏最前（side 的第一个 configbar 孩子）
  const side = s.scriptTypeBar.parentNode;
  assert.ok(side.children.indexOf(s.scriptTypeBar) < side.children.indexOf(s.genConfigBar), '剧本类型应在生成配置之前');
  // tag 模式的既有 panel 被移进主栏
  const tagBench = s.$('tagBench');
  assert.ok(!tagBench.classList.contains('hidden'));
  assert.ok(inDetail(s.modeDetailBody, tagBench));
  // 侧栏渲染了 side-block 说明
  assert.ok(side.children.some((c) => c.children.length > 0), '侧栏应有说明块');
  assert.equal(s.$('modeDetailName').textContent, '标签创建');
  // 一级网格被隐藏
  assert.ok(s.modeGrid.classList.contains('hidden'));
});

test('backToGrid 还原配置到一级界面原位并重新隐藏', () => {
  const s = setup();
  s.api.showModeDetail('tag');
  s.api.backToGrid();
  assert.ok(!s.api.isOpen());
  for (const el of [s.scriptTypeBar, s.genConfigBar, s.hookConsole]) {
    assert.ok(el.classList.contains('hidden'), `${el.id} 返回后应重新隐藏`);
    assert.equal(el.parentNode, s.viewStudio, `${el.id} 应还原到 view-studio`);
  }
  // 顺序还原：scriptTypeBar 在 genConfigBar 前，genConfigBar 在 hookConsole 前
  const ids = s.viewStudio.children.map((c) => c.id);
  assert.ok(ids.indexOf('scriptTypeBar') < ids.indexOf('genConfigBar'));
  assert.ok(ids.indexOf('genConfigBar') < ids.indexOf('hookConsole'));
  assert.ok(!s.modeGrid.classList.contains('hidden'), '一级网格应恢复显示');
  // panel 回到 workbenchBody 并隐藏
  const tagBench = s.$('tagBench');
  assert.ok(tagBench.classList.contains('hidden'));
  assert.equal(tagBench.parentNode, s.$('workbenchBody'));
});

test('按模式过滤字段：auto 模式隐藏引擎档，返回后过滤态清除', () => {
  const s = setup();
  s.api.showModeDetail('auto');
  assert.ok(s.fEngine.classList.contains('mode-hidden'), 'auto 模式应隐藏引擎档');
  s.api.backToGrid();
  assert.ok(!s.fEngine.classList.contains('mode-hidden'), '返回后 mode-hidden 应清除');
  // tag 模式不过滤
  s.api.showModeDetail('tag');
  assert.ok(!s.fEngine.classList.contains('mode-hidden'), 'tag 模式不应隐藏引擎档');
});

test('连续切换两个模式不丢配置元素（innerHTML 清空前已还原）', () => {
  const s = setup();
  s.api.showModeDetail('tag');
  s.api.showModeDetail('auto'); // 不经 backToGrid 直接再开
  assert.ok(inDetail(s.modeDetailBody, s.genConfigBar), '配置应在新模式的侧栏里');
  assert.ok(!s.genConfigBar.classList.contains('hidden'));
  s.api.backToGrid();
  assert.equal(s.genConfigBar.parentNode, s.viewStudio);
});

// v2.685 进入/退出二级界面的落点：旧实现先在 syncModeBrief 里按「panel 挂载前」的位置平滑滚动，
// showModeDetail 随后把 panel 移到主栏，滚动目标变成过期坐标，用户落在侧栏半截、左侧空白。
test('进入二级界面把 modeDetail 滚到吸顶导航下方（用当前视口 + 实时 rect 计算）', () => {
  const s = setup();
  s.api.showModeDetail('tag');
  assert.ok(s.scrollCalls.length > 0, '进入二级界面必须滚动一次（否则用户停在卡片网格的旧位置）');
  const call = s.scrollCalls[s.scrollCalls.length - 1];
  // scrollY 1200 + detail.top 400 - topbar 78 - 10 = 1512
  assert.equal(call.top, 1512, '落点应为 modeDetail 顶部对齐吸顶导航下方 10px');
  assert.equal(call.behavior, 'auto', 'reduced-motion 下应为即时滚动');
});

test('返回卡片网格恢复进入前的滚动位置', () => {
  const s = setup();
  s.api.showModeDetail('tag');
  s.windowMock.scrollY = 0; // 模拟用户在二级界面里滚动过
  s.api.backToGrid();
  const call = s.scrollCalls[s.scrollCalls.length - 1];
  assert.equal(call.top, 1200, '返回后应回到进入二级界面前的网格位置，而不是停在半截页面');
});
