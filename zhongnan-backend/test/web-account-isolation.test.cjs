const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ProgressView = require('../web/progress-view.js');

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    functions.set(node.name.text, `var ${node.name.text} = ${node.initializer.getText(ast)};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const response = data => ({ ok: true, status: 200, json: async () => data });
const project = (id, title = id) => ({ id, title, mode: 'original', totalEps: 1, createdAt: '2026-01-01' });
const script = (id, content = id) => ({ id, epNo: 1, version: 1, title: id, content });

// Run the actual account transition, private renderers and stream handler. Only
// DOM primitives, network IO and unrelated UI widgets are substituted.
function setup(handler = async () => response([])) {
  const nodes = new Map(), requests = [], calls = [], events = new Map();
  let user = { id: 'alice', level: 'FREE' }, token = 'alice-token';
  function element(id = '') {
    const classes = new Set();
    let html = '', text = '';
    const node = {
      id, value: '', style: {}, dataset: {}, children: [], disabled: false, checked: false,
      get innerHTML() { return html; },
      set innerHTML(value) { html = String(value); text = ''; this.children = []; },
      get textContent() { return text || this.children.map(child => child.textContent).join(''); },
      set textContent(value) { text = String(value); html = ''; this.children = []; },
      appendChild(child) { child.parentElement = this; this.children.push(child); },
      querySelector: () => null, querySelectorAll: () => [], listeners: new Map(), focus() {},
      addEventListener(name, fn) { this.listeners.set(name, fn); },
      contains: () => true, click() { return this.onclick?.(); },
      remove() { nodes.delete(id); }, setAttribute() {}, getAttribute: () => null,
      classList: {
        add(...values) { values.forEach(value => classes.add(value)); },
        remove(...values) { values.forEach(value => classes.delete(value)); },
        contains: value => classes.has(value),
        toggle(value, on) { const next = on ?? !classes.has(value); if (next) classes.add(value); else classes.delete(value); return next; },
      },
    };
    return node;
  }
  const $ = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const c = {
    $, console, AbortController, TextDecoder, lang: 'zh', ivInited: false,
    privateAccountOwner: undefined, privateAccountEpoch: 0,
    genSessions: [], activeSessionId: null, progress: null, lastDone: null, abortCtrl: null,
    currentProjectId: null, pendingWarnings: null, lastFiling: null, currentScripts: [],
    currentWorksProject: null, currentWorksDiagnosis: null, lastDiagnosis: null,
    lastWave: null, waveProjectId: null, meCache: null, capsCache: null,
    castAssetsLoaded: false, propAssetsLoaded: false, sceneAssetsLoaded: false,
    dashJumpTarget: null, dashConflictScroll: null,
    castThinActive: false, propThinActive: false, sceneThinActive: false,
    rrFixedKeys: new Map(), draftProject: null, listenTts: { data: null }, listenSeries: { list: [], auto: true },
    tagChosen: [], dpPages: [], dpActive: 0, dpEpisodeCount: 0, matData: null,
    curPurchase: null, purchaseViewSeq: 0,
    // v2.274：loadWorks 同会话搜索请求序号（产品侧模块级 let，harness 逐函数 vm 求值需在此预置，同 purchaseViewSeq）
    worksReqSeq: 0,
    // v2.275：作品卡片写操作在途锁（模块级 let），runWorkAction 内读写，需在 context 预置
    _workActionBusy: false,
    // v2.276/v2.277 startGenerate 模块级 let（逐函数 vm 求值需在 context 预置，否则入口 ReferenceError）
    _genStarting: false, _retryProject: null, _retryBrief: null,
    selectedMode: 'original', LEVEL_ZH: { FREE: '免费' }, LEVEL_EN: { FREE: 'Free' },
    document: {
      createElement: () => element(), getElementById: id => nodes.get(id) || null,
      querySelectorAll: () => [], querySelector: () => null, body: { contains: () => true },
    },
    t: (key, args) => args ? `${key}:${args.n}` : key,
    escapeHtml: value => String(value ?? ''), fmtBytes: value => String(value),
    Api: {
      getUser: () => user, isAuthed: () => !!token, getToken: () => token,
      auth: { logout() { user = null; token = null; } },
      request: async (url, options = {}) => {
        requests.push({ url, options, owner: user?.id });
        return handler(url, options);
      },
      jsonOrThrow: async result => result.json(),
    },
    window: { addEventListener: (name, fn) => events.set(name, fn), confirm: () => true },
    PV: () => ({
      ...ProgressView,
      createProgress: () => ({}),
      reduceProgress(previous, event) { calls.push(['reduceProgress', event]); return { ...previous, stage: event.stage }; },
      parseSseChunk: () => [],
    }),
  };
  c.window.Api = c.Api;
  c.councilHints = {}; // v2.330 模块级 let：resetPrivateAccountState 会清空它
  for (const name of [
    'syncDraftProject', 'stopWaitTips', 'listenFinish', 'listenBumpReqSeq', 'closeWorkbench',
    'renderTaskQueue', 'refreshListenBtn', 'refreshAdminNav', 'renderModes', 'initInterviewPanel',
    // v2.329 退出登录后按新等级刷新下拉/剧本类型锁定态（测试内以记录桩替代）
    // v2.330 多方评议理由预取：测试内以记录桩替代，不发网络
    'loadCouncilHints', 'renderSelects', 'renderScriptTypes',
    'openAuth', 'xnSay', 'renderProgress', 'renderResult', 'showFail', 'renderAigcDash',
    // v2.340 制片可行性面板：refreshResultScripts 末尾按最新集 format 复现，逐函数求值需注入桩
    'renderLiveProdDash',
    'populateProfileOptions', 'loadCaps', 'openListen', 'openListenSeries', 'resetPanels',
    'failGenerationSession', 'alert', 'openModal', 'renderDpPage', 'renderDpSummary',
    'toastError', 'toastOk', 'toastInfo',
  ]) c[name] = (...args) => { calls.push([name, ...args]); };
  // v2.202 交互统一：原生 confirm/prompt 已替换为 uiConfirm/uiPrompt，注入等价 stub（确认=true、输入='x'）
  c.uiConfirm = async () => true;
  c.uiPrompt = async () => 'x';
  for (const name of [
    'brandBriefPayload', 'trendBriefPayload', 'branchBriefPayload', 'hookPayload', 'beatPayload',
    'castAssetPayload', 'propAssetPayload', 'sceneAssetPayload', 'aigcPayload', 'sourceTextPayload',
  ]) c[name] = () => ({});
  c.outLocale = () => 'zh';
  // v2.329 三维契约：立项 payload 读取剧本类型与输出语种（测试内固定默认值）
  c.selectedScriptType = 'live_action_drama';
  c.outputLangValue = () => 'zh';
  c.strategyLocale = () => 'zh';
  c.buildDiagnosisHtml = () => ({ bars: 'diagnosis bars', fixHtml: 'diagnosis fixes' });
  c.buildQcReportHtml = () => 'quality report';
  c.diagColor = () => 'green';
  c.levelTag = value => value;
  vm.createContext(c);
  for (const name of [
    'privateAccountId', 'syncPrivateAccount', 'capturePrivateSession', 'isPrivateSessionCurrent',
    'resetPrivateAccountState', 'clearDraftProject', 'renderAuthButton', 'loadWorks', 'openProject',
    // v2.275：loadWorks 的卡片操作经 runWorkAction（在途锁+按钮态），注入真实实现以解析引用
    'runWorkAction',
    'viewPurchasedScript',
    // 合并（剧本1）后 renderAuthButton 依赖身份标签函数（v2.193），一并注入真实实现
    'userRoleLabel', 'isStaffAcct',
    // v2.221 加载/空态统一：loadWorks/openProject 等依赖 znSkeleton/znEmpty*，一并注入真实实现
    '_znEsc', 'znSkeletonHtml', 'znSkeleton', 'znEmptyHtml', 'znEmpty',
    'loadMe', 'loadCastAssets', 'loadPropAssets', 'loadSceneAssets', 'latestScriptsByEpisode',
    'refreshResultScripts', 'handleEvent', 'startGenerate', 'openDirectorPack', 'openMaterials',
  ]) {
    assert.ok(functions.has(name), `missing production function ${name}`);
    vm.runInContext(functions.get(name), c);
  }
  c.renderAuthButton();
  calls.length = 0;
  return {
    c, $, nodes, requests, calls, events,
    setUser(next, nextToken = next ? `${next.id || next.phone}-token` : null) { user = next; token = nextToken; },
    changeUser(next) { this.setUser(next); c.renderAuthButton(); },
  };
}

async function until(predicate) {
  for (let i = 0; i < 80 && !predicate(); i++) await Promise.resolve();
  assert.ok(predicate(), 'expected request was not reached');
}

test('a settled purchase reopens its script without offering settlement or refund', async () => {
  const h = setup(async () => response({ status: 'SETTLED', fullText: 'Purchased script body' }));
  await h.c.viewPurchasedScript('purchase-1');
  assert.equal(h.requests[0].url, '/api/market/purchases/purchase-1/content');
  assert.equal(h.$('fullText').textContent, 'Purchased script body');
  assert.equal(h.$('fullConfirm').classList.contains('hidden'), true);
  assert.equal(h.$('fullRefund').classList.contains('hidden'), true);
  assert.ok(h.calls.some(([name, id]) => name === 'openModal' && id === 'fullModal'));
});

test('reopening an escrowed purchase offers confirmation and refund', async () => {
  const h = setup(async () => response({ status: 'ESCROW', fullText: 'Escrowed script body' }));
  h.$('fullConfirm').classList.add('hidden');
  h.$('fullRefund').classList.add('hidden');
  await h.c.viewPurchasedScript('purchase-2');
  assert.equal(h.$('fullText').textContent, 'Escrowed script body');
  assert.equal(h.$('fullConfirm').classList.contains('hidden'), false);
  assert.equal(h.$('fullRefund').classList.contains('hidden'), false);
});

test('a purchase response cannot expose its script after switching accounts', async () => {
  const pending = deferred();
  const h = setup(async () => pending.promise);
  const opening = h.c.viewPurchasedScript('alice-purchase');
  await until(() => h.requests.length === 1);
  h.changeUser({ id: 'bob' });
  pending.resolve(response({ status: 'SETTLED', fullText: 'Alice private script' }));
  await opening;
  assert.equal(h.$('fullText').textContent, '');
  assert.equal(h.c.curPurchase, null);
  assert.equal(h.$('fullModal').classList.contains('hidden'), true);
  assert.equal(h.calls.some(([name, id]) => name === 'openModal' && id === 'fullModal'), false);
});

test('a slower purchase response cannot replace the latest opened script', async () => {
  const old = deferred();
  const h = setup(async url => url.includes('/old/') ? old.promise : response({ status: 'SETTLED', fullText: 'Current script' }));
  const opening = h.c.viewPurchasedScript('old');
  await h.c.viewPurchasedScript('new');
  old.resolve(response({ status: 'ESCROW', fullText: 'Older script' }));
  await opening;
  assert.equal(h.$('fullText').textContent, 'Current script');
  assert.equal(h.c.curPurchase.id, 'new');
  assert.equal(h.$('fullConfirm').classList.contains('hidden'), true);
  assert.equal(h.$('fullRefund').classList.contains('hidden'), true);
});

test('an older failed purchase request cannot interrupt the current script', async () => {
  const old = deferred();
  const h = setup(async url => url.includes('/old/') ? old.promise : response({ status: 'SETTLED', fullText: 'Current script' }));
  const opening = h.c.viewPurchasedScript('old');
  await h.c.viewPurchasedScript('new');
  const messageCount = h.calls.filter(([name]) => name === 'xnSay').length;
  old.reject(new Error('old request failed'));
  await opening;
  assert.equal(h.$('fullText').textContent, 'Current script');
  assert.equal(h.calls.filter(([name]) => name === 'xnSay').length, messageCount);
});

test('the real logout button aborts work and clears private DOM, references and loaded flags', () => {
  const h = setup(), { c, $ } = h;
  const controller = new AbortController();
  c.genSessions = [{ id: 'old-task', abortCtrl: controller, privateSession: c.capturePrivateSession() }];
  c.activeSessionId = 'old-task'; c.abortCtrl = controller;
  c.currentProjectId = 'old-project'; c.currentWorksProject = project('old-project');
  c.currentScripts = [script('old-script')]; c.draftProject = project('old-draft');
  c.meCache = { nickname: 'Alice' }; c.capsCache = { private: true };
  c.castAssetsLoaded = c.propAssetsLoaded = c.sceneAssetsLoaded = true;
  c.listenTts.data = { private: true }; c.listenSeries.list = [script('old-audio')];
  c.dpPages = [{ lines: ['private export'] }]; c.matData = { private: true };
  c.rrFixedKeys.set('old-project:1:fix', 2);
  for (const id of ['worksGrid', 'epsList', 'scriptText', 'taskQueue', 'castLibGrid', 'propLibGrid', 'sceneLibGrid']) $(id).innerHTML = 'Alice private content';
  for (const id of ['modeBrief', 'sourceText', 'inNickname', 'inBio', 'castLibSearch']) $(id).value = 'Alice private input';
  for (const family of ['cast', 'prop', 'scene']) $(family + 'AssetSelect').innerHTML = '<option>Alice private asset</option>';
  $('loginBtn').onclick();
  assert.equal(controller.signal.aborted, true);
  assert.equal(c.genSessions.length, 0);
  for (const name of ['activeSessionId', 'currentProjectId', 'currentWorksProject', 'draftProject', 'meCache', 'capsCache', 'matData']) assert.equal(c[name], null, name);
  assert.equal(c.currentScripts.length, 0); assert.equal(c.listenSeries.list.length, 0); assert.equal(c.dpPages.length, 0);
  assert.equal(c.listenTts.data, null); assert.equal(c.rrFixedKeys.size, 0);
  for (const name of ['castAssetsLoaded', 'propAssetsLoaded', 'sceneAssetsLoaded']) assert.equal(c[name], false, name);
  for (const id of ['worksGrid', 'epsList', 'scriptText', 'taskQueue', 'castLibGrid', 'propLibGrid', 'sceneLibGrid']) {
    assert.equal($(id).innerHTML, '', id); assert.equal($(id).textContent, '', id);
  }
  for (const id of ['modeBrief', 'sourceText', 'inNickname', 'inBio', 'castLibSearch']) assert.equal($(id).value, '', id);
  for (const family of ['cast', 'prop', 'scene']) assert.doesNotMatch($(family + 'AssetSelect').innerHTML, /Alice/);
  for (const id of ['worksDetail', 'resultPanel', 'taskQueuePanel', 'listenModal', 'castLibModal', 'dpModal', 'matModal']) assert.equal($(id).classList.contains('hidden'), true, id);
  assert.equal($('profileCard').style.display, 'none');
  assert.equal($('worksEmpty').textContent, 'needLogin');
  assert.equal(h.requests.length, 0, 'logout must not delete server-side work');
});

test('ordinary auth rendering and a refreshed token preserve the same account work', () => {
  const h = setup(), snapshot = h.c.capturePrivateSession();
  h.$('scriptText').textContent = 'still editing';
  h.c.genSessions.push({ id: 'still-running' });
  h.setUser({ id: 'alice', level: 'PRO', nickname: 'updated profile' }, 'refreshed-token');
  h.c.renderAuthButton();
  assert.equal(h.$('scriptText').textContent, 'still editing');
  assert.equal(h.c.genSessions.length, 1);
  assert.equal(h.c.isPrivateSessionCurrent(snapshot), true);
  assert.equal(h.calls.some(([name]) => name === 'closeWorkbench'), false);
});

test('logging out and back into the same ID invalidates the old session generation', () => {
  const h = setup(), before = h.c.capturePrivateSession();
  h.changeUser(null); h.changeUser({ id: 'alice' });
  const after = h.c.capturePrivateSession();
  assert.equal(before.owner, after.owner);
  assert.ok(after.epoch > before.epoch);
  assert.equal(h.c.isPrivateSessionCurrent(before), false);
  assert.equal(h.c.isPrivateSessionCurrent(after), true);
  h.setUser(null);
  assert.equal(h.c.isPrivateSessionCurrent(after), false, 'storage changes must invalidate a snapshot before the render hook runs');
});

test('legacy phone-only identity is stable and signed-out snapshots never authorize private work', () => {
  const h = setup();
  h.changeUser({ phone: '13800000000' });
  const phone = h.c.capturePrivateSession();
  assert.equal(h.c.isPrivateSessionCurrent(phone), true);
  h.changeUser({ phone: '13800000001' });
  assert.equal(h.c.isPrivateSessionCurrent(phone), false);
  h.changeUser(null);
  assert.equal(h.c.isPrivateSessionCurrent(h.c.capturePrivateSession()), false);
});

for (const reenterSameAccount of [false, true]) {
  test(`late Works response cannot replace the current account list (${reenterSameAccount ? 'logout then same ID' : 'different ID'})`, async () => {
    const old = deferred(); let calls = 0;
    const h = setup(async () => ++calls === 1 ? old.promise : response([project('new', 'Current saved work')]));
    const loading = h.c.loadWorks();
    h.changeUser(null); h.changeUser({ id: reenterSameAccount ? 'alice' : 'bob' });
    await h.c.loadWorks();
    old.resolve(response([project('old', 'Alice private work')]));
    await loading;
    assert.equal(h.$('worksGrid').children.length, 1);
    assert.match(h.$('worksGrid').children[0].innerHTML, /Current saved work/);
    assert.doesNotMatch(h.$('worksGrid').children[0].innerHTML, /Alice private/);
  });
}

test('signing in again reloads saved Works and scripts from the server', async () => {
  const h = setup(async url => response(url.endsWith('/scripts') ? [script('saved-ep', 'Saved episode body')] : [project('saved', 'Saved title')]));
  await h.c.loadWorks();
  h.$('loginBtn').onclick();
  assert.equal(h.$('worksGrid').children.length, 0);
  h.changeUser({ id: 'alice' });
  await h.c.loadWorks();
  assert.equal(h.$('worksGrid').children.length, 1);
  h.$('worksGrid').children[0].onclick();
  await until(() => h.$('epsList').innerHTML.includes('Saved episode body'));
  assert.match(h.$('epsList').innerHTML, /Saved episode body/);
  assert.equal(h.$('worksDetailTitle').textContent, 'Saved title');
  assert.equal(h.requests.filter(item => item.url === '/api/generate/projects').length, 2);
  assert.ok(h.requests.every(item => !item.options.method || item.options.method === 'GET'));
});

test('old project scripts cannot repopulate the page after logout while JSON is pending', async () => {
  const body = deferred();
  const h = setup(async () => response(body.promise));
  const opening = h.c.openProject(project('alice-project', 'Alice title'));
  await Promise.resolve(); await Promise.resolve();
  h.changeUser(null);
  body.resolve([script('secret', 'Alice private body')]);
  await opening;
  assert.equal(h.$('epsList').innerHTML, '');
  assert.equal(h.$('worksDetailTitle').textContent, '');
  assert.equal(h.$('worksDetail').classList.contains('hidden'), true);
  assert.equal(h.c.currentWorksProject, null);
});

test('opening a second project rejects an earlier project response in the same account', async () => {
  const old = deferred();
  const h = setup(async url => url.includes('/old/') ? old.promise : response([script('new', 'New project body')]));
  const opening = h.c.openProject(project('old'));
  await h.c.openProject(project('new'));
  old.resolve(response([script('old', 'Old project body')]));
  await opening;
  assert.match(h.$('epsList').innerHTML, /New project body/);
  assert.doesNotMatch(h.$('epsList').innerHTML, /Old project body/);
  assert.equal(h.$('worksDetailTitle').textContent, 'new');
});

for (const [family, loader, flag] of [
  ['cast', 'loadCastAssets', 'castAssetsLoaded'],
  ['prop', 'loadPropAssets', 'propAssetsLoaded'],
  ['scene', 'loadSceneAssets', 'sceneAssetsLoaded'],
]) {
  test(`late ${family} assets cannot replace the new account options or poison its loaded flag`, async () => {
    const old = deferred(); let calls = 0;
    const h = setup(async () => ++calls === 1 ? response(old.promise) : response({ assets: [{ id: 'bob-asset', name: 'Bob asset' }] }));
    const loading = h.c[loader]();
    await Promise.resolve(); await Promise.resolve();
    h.changeUser({ id: 'bob' });
    await h.c[loader]();
    old.resolve({ assets: [{ id: 'alice-secret', name: 'Alice private asset' }] });
    await loading;
    assert.equal(h.c[flag], true);
    assert.deepEqual(h.$(family + 'AssetSelect').children.map(node => node.value), ['bob-asset']);
    await h.c[loader]();
    assert.equal(calls, 2, 'current account may reuse its own loaded options');
  });
}

test('a late profile cannot restore private information after logout', async () => {
  const pending = deferred(), h = setup(async () => response(pending.promise));
  const loading = h.c.loadMe();
  await Promise.resolve(); await Promise.resolve();
  h.changeUser(null);
  pending.resolve({ nickname: 'Alice private nickname', level: 'FREE', points: { balance: 99 } });
  await loading;
  assert.equal(h.c.meCache, null);
  assert.equal(h.$('meNickname').textContent, '');
  assert.equal(h.$('profileCard').style.display, 'none');
});

test('a late result refresh cannot overwrite the new account script cache or text', async () => {
  const old = deferred();
  const h = setup(async url => url.includes('/old/') ? old.promise : response([script('new', 'New account script')]));
  h.c.currentProjectId = 'old';
  const loading = h.c.refreshResultScripts('old');
  h.changeUser({ id: 'bob' });
  h.c.currentProjectId = 'new';
  await h.c.refreshResultScripts('new');
  old.resolve(response([script('old', 'Alice private script')]));
  await loading;
  assert.equal(h.c.currentScripts[0].id, 'new');
  assert.match(h.$('scriptText').textContent, /New account script/);
  assert.doesNotMatch(h.$('scriptText').textContent, /Alice private/);
});

test('a late failed result refresh cannot erase the new account script', async () => {
  const old = deferred();
  const h = setup(async url => url.includes('/old/') ? old.promise : response([script('new', 'New account script')]));
  h.c.currentProjectId = 'old';
  const loading = h.c.refreshResultScripts('old');
  h.changeUser({ id: 'bob' }); h.c.currentProjectId = 'new';
  await h.c.refreshResultScripts('new');
  old.reject(new Error('old request failed'));
  await loading;
  assert.match(h.$('scriptText').textContent, /New account script/);
});

test('SSE ignores detached and old-account sessions while a new session still completes', () => {
  const h = setup(), { c } = h;
  const old = { id: 'old', projectId: 'old-project', account: c.capturePrivateSession(), progress: {}, status: 'running' };
  c.genSessions.push(old); c.activeSessionId = old.id;
  h.changeUser(null); h.changeUser({ id: 'alice' });
  h.calls.length = 0;
  c.handleEvent({ stage: 'done', secret: 'old account data' }, old);
  assert.equal(old.status, 'running');
  assert.equal(c.lastDone, null);
  assert.equal(h.calls.length, 0);
  const next = { id: 'new', projectId: 'new-project', account: c.capturePrivateSession(), progress: {}, status: 'running' };
  c.handleEvent({ stage: 'done' }, next);
  assert.equal(next.status, 'running', 'a session removed from the task queue cannot render');
  c.genSessions.push(next); c.activeSessionId = next.id;
  c.handleEvent({ stage: 'done', script: 'current result' }, next);
  assert.equal(next.status, 'done');
  assert.equal(c.lastDone.script, 'current result');
  assert.equal(h.calls.filter(([name]) => name === 'renderResult').length, 1);
});

test('logout during asset prefetch prevents generation from creating a project', async () => {
  const old = deferred(), h = setup(async () => old.promise);
  h.$('modeBrief').value = 'Alice private idea';
  const generating = h.c.startGenerate();
  await until(() => h.requests.length > 0);
  h.changeUser({ id: 'bob' });
  old.resolve(response({ assets: [] }));
  await generating;
  assert.equal(h.requests.some(item => item.options.method === 'POST'), false);
  assert.equal(h.c.genSessions.length, 0);
});

test('logout while project creation JSON is pending prevents the paid generation request', async () => {
  const created = deferred();
  const h = setup(async url => url === '/api/generate/projects' ? response(created.promise) : response({ assets: [] }));
  h.$('modeBrief').value = 'Alice private idea'; h.$('episodes').value = '1'; h.$('engine').value = 'STANDARD';
  const generating = h.c.startGenerate();
  await until(() => h.requests.some(item => item.url === '/api/generate/projects'));
  h.changeUser({ id: 'bob' });
  created.resolve(project('alice-project'));
  await generating;
  assert.equal(h.requests.some(item => item.url === '/api/generate/episodes'), false);
  assert.equal(h.c.genSessions.length, 0);
  assert.equal(h.c.currentProjectId, null);
});

for (const switchAccount of [false, true]) {
  const transition = switchAccount ? 'account switch' : 'project switch';
  for (const failure of [false, true]) {
    test(`late full-script diagnosis cannot replace current diagnosis after ${transition} (${failure ? 'error' : 'success'})`, async () => {
      const old = deferred();
      const currentDiagnosis = { scorecard: { total: 88 }, counts: { episodeCount: 1 } };
      const h = setup(async url => {
        if (url.includes('/old/diagnosis')) return old.promise;
        if (url.includes('/diagnosis')) return response(currentDiagnosis);
        return response([script('saved', 'Saved script')]);
      });
      await h.c.openProject(project('old'));
      const diagnosing = h.$('worksDiagBtn').onclick();
      await until(() => h.requests.some(item => item.url.includes('/old/diagnosis')));
      if (switchAccount) h.changeUser({ id: 'bob' });
      await h.c.openProject(project('new'));
      await h.$('worksDiagBtn').onclick();
      const currentHtml = h.$('worksDiag').innerHTML;
      assert.match(currentHtml, /88/);
      if (failure) old.reject(new Error('old diagnosis failed'));
      else old.resolve(response({ scorecard: { total: 12 }, counts: { episodeCount: 10 } }));
      await diagnosing;
      assert.equal(h.c.currentWorksDiagnosis, currentDiagnosis);
      assert.equal(h.$('worksDiag').innerHTML, currentHtml);
    });
  }

  for (const [family, resource] of [['cast', 'character'], ['prop', 'prop'], ['scene', 'scene']]) {
    test(`late ${family} harvest does not refresh or clear current assets after ${transition}`, async () => {
      const old = deferred();
      const h = setup(async url => url.includes('-assets/from-project/') ? response(old.promise) : response([script('saved')]));
      await h.c.openProject(project('old'));
      const harvesting = h.$(family + 'HarvestBtn').onclick();
      await until(() => h.requests.some(item => item.url.includes('/' + resource + '-assets/from-project/old')));
      if (switchAccount) h.changeUser({ id: 'bob' });
      await h.c.openProject(project('new'));
      h.c[family + 'AssetsLoaded'] = true;
      h.$(family + 'HarvestNote').textContent = 'current project note';
      const requestCount = h.requests.length;
      old.resolve({ created: 1, updated: 0 });
      await harvesting;
      assert.equal(h.requests.length, requestCount, 'old harvest must not launch a new account asset request');
      assert.equal(h.c[family + 'AssetsLoaded'], true);
      assert.equal(h.$(family + 'HarvestNote').textContent, 'current project note');
    });
  }

  for (const [opener, family, data] of [
    ['openDirectorPack', 'dp', { pages: [{ title: 'Current director page', lines: ['current content'] }], episodeCount: 1 }],
    ['openMaterials', 'mat', { title: 'Current material sheet', episodeCount: 1, stats: {} }],
  ]) {
    for (const outcome of ['success', 'http error', 'network error']) {
      test(`late ${family} preview ${outcome} cannot alter current preview after ${transition}`, async () => {
        const old = deferred();
        const h = setup(async url => url.includes('/old/') ? old.promise : response(data));
        h.c.currentProjectId = 'old';
        const opening = h.c[opener]();
        await until(() => h.requests.length === 1);
        if (switchAccount) h.changeUser({ id: 'bob' });
        h.c.currentProjectId = 'new';
        await h.c[opener]();
        h.$(family + 'Body').textContent = 'current preview';
        const currentData = family === 'dp' ? h.c.dpPages : h.c.matData;
        const currentSummary = h.$(family + 'Summary').textContent;
        const renderCount = h.calls.length;
        if (outcome === 'network error') old.reject(new Error('old request failed'));
        else if (outcome === 'http error') old.resolve({ ok: false, json: async () => ({ error: 'old error' }) });
        else old.resolve(response(family === 'dp' ? { pages: [{ title: 'Old page' }], episodeCount: 99 } : { title: 'Old materials', episodeCount: 99 }));
        await opening;
        assert.equal(family === 'dp' ? h.c.dpPages : h.c.matData, currentData);
        assert.equal(h.$(family + 'Body').textContent, 'current preview');
        assert.equal(h.$(family + 'Summary').textContent, currentSummary);
        assert.equal(h.calls.length, renderCount);
      });
    }
  }

  for (const stage of ['fix response', 'script refresh']) {
    test(`QC fix cannot reopen the old project after ${transition} during ${stage}`, async () => {
      const old = deferred(); let scriptReads = 0;
      const fixResponse = { ok: true, text: async () => JSON.stringify({ epNo: 1, newVersion: 2, pointsCharged: 5 }) };
      const h = setup(async url => {
        if (url.endsWith('/fix')) return stage === 'fix response' ? old.promise : fixResponse;
        if (url.endsWith('/old/scripts') && ++scriptReads > 1) return old.promise;
        return response([script('saved')]);
      });
      await h.c.openProject(project('old'));
      h.c.currentProjectId = 'old';
      const attributes = { 'data-ep': '1', 'data-rule': 'hook', 'data-dim': '钩子', 'data-advice': '加强悬念' };
      const chip = { style: {}, getAttribute: name => attributes[name] };
      const fixing = h.$('worksDiag').listeners.get('click')({ target: { closest: () => chip } });
      await until(() => stage === 'fix response' ? h.requests.some(item => item.url.endsWith('/fix')) : scriptReads > 1);
      if (switchAccount) h.changeUser({ id: 'bob' });
      await h.c.openProject(project('new'));
      h.c.currentProjectId = 'new';
      const requestCount = h.requests.length;
      const callCount = h.calls.length;
      old.resolve(stage === 'fix response' ? fixResponse : response([script('old-revised', 'Old revised body')]));
      await fixing;
      assert.equal(h.c.currentWorksProject.id, 'new');
      assert.equal(h.$('worksDetailTitle').textContent, 'new');
      assert.equal(h.requests.length, requestCount, 'old fix must not reopen or diagnose the old project');
      assert.equal(h.calls.length, callCount, 'old fix must not announce a result in the new context');
    });
  }
}
