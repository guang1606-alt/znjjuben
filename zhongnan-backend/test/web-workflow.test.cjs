const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ProgressView = require('../web/progress-view.js');

// Run the real closure functions; replace only browser primitives and network IO.
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
let authHook;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'Api.onAuthRequired') authHook = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);

function setup(names, extra = {}) {
  const nodes = new Map(), timers = [];
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set(['hidden']);
      nodes.set(id, { id, value: '', checked: false, textContent: '', innerHTML: '', dataset: {}, style: {},
        classList: { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); } },
        setAttribute() {}, appendChild() {}, focus() {}, remove() {}, querySelector: () => null });
    }
    return nodes.get(id);
  };
  const context = { $, lang: 'zh', console, AbortController, TextDecoder, PV: () => ProgressView,
    capturePrivateSession: () => ({ owner: 'fixture', epoch: 0 }), isPrivateSessionCurrent: () => true,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], removeEventListener() {}, createElement: () => $('created') },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    t: x => x, escapeHtml: x => String(x ?? ''), toastError() {}, xnSay() {},
    renderTaskQueue() {}, renderProgress() {}, resetPanels() {}, refreshListenBtn() {},
    loadMe() {}, loadWorks() {}, loadCatalog() {}, loadFeed() {}, loadListings() {}, enterAdmin() {},
    VIEWS: ['studio', 'works', 'vip', 'square', 'market', 'admin'], _switchAnimToken: 0, _workbenchHideTimer: null,
    // 合并（剧本1）后 switchView 引用导航栈；null 走应用自身的降级守卫（与浏览器缺 nav-stack.js 一致）
    _navStack: null,
    _WORKBENCH_PANEL_IDS: ['sourceTextPanel', 'teardownPanel', 'interviewPanel', 'resultPanel'],
    currentWorksProject: null, currentWorksDiagnosis: null, currentScripts: [], currentProjectId: null,
    lastFiling: null, pendingWarnings: null, activeSessionId: null, genSessions: [],
    renderAigcDash() {}, loadDiagnosis: async () => {}, loadEmotionWave: async () => {}, loadInvestorLens: async () => {},
    ...extra };
  vm.createContext(context);
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { context, $, flush: () => { while (timers.length) timers.shift()(); } };
}

test('completed task opens its real project in Works and removes the workbench overlay', async () => {
  const urls = [];
  const project = { id: 'p1', title: '成稿作品', totalEps: 20 };
  const { context: c, $, flush } = setup(['switchSession', 'openProject', 'switchView', 'closeWorkbench', '_hideWorkbenchLayer', '_workbenchEsc'], {
    Api: { request: async url => { urls.push(url); return {}; }, jsonOrThrow: async () => [] },
    genSessions: [{ id: 's1', status: 'done', projectId: project.id, title: project.title, project }],
  });
  $('workbenchLayer').classList.remove('hidden');
  $('workbenchLayer').dataset.current = 'sourceTextPanel';
  await c.switchSession('s1');
  flush();
  assert.deepEqual(urls, ['/api/generate/projects/p1/scripts']);
  assert.equal($('worksDetailTitle').textContent, '成稿作品');
  assert.equal($('view-works').classList.contains('hidden'), false);
  assert.equal($('workbenchLayer').classList.contains('hidden'), true);
});

test('closing a workbench also closes a newly shown panel before its observer runs', () => {
  const { context: c, $, flush } = setup(['closeWorkbench', '_hideWorkbenchLayer', '_workbenchEsc']);
  $('workbenchLayer').dataset.current = 'teardownPanel';
  for (const id of ['workbenchLayer', 'teardownPanel', 'sourceTextPanel']) $(id).classList.remove('hidden');
  c.closeWorkbench();
  assert.equal($('sourceTextPanel').classList.contains('hidden'), true);
  assert.equal($('teardownPanel').classList.contains('hidden'), true);
  flush();
  assert.equal($('workbenchLayer').classList.contains('hidden'), true);
});

test('result refresh displays one latest version per episode, sorted for copy and TXT export', async () => {
  const records = [
    { epNo: 2, version: 1, title: '二', content: '第二集正文' },
    { epNo: 1, version: 3, title: '一', content: '改写最终稿' },
    { epNo: 1, version: 1, title: '一', content: '旧稿不要导出' },
    { epNo: 1, version: 2, title: '一', content: '中间稿不要导出' },
  ];
  const { context: c, $ } = setup(['latestScriptsByEpisode', 'refreshResultScripts'], { Api: { request: async () => ({}), jsonOrThrow: async () => records } });
  await c.refreshResultScripts('p1');
  assert.equal($('scriptText').textContent, '第1集 一\n改写最终稿\n\n第2集 二\n第二集正文');
  assert.equal(c.currentScripts.length, 2);
});

test('result scores display numeric fields from the generation response', async () => {
  const { context: c, $ } = setup(['renderResult'], { refreshResultScripts() {} });
  await c.renderResult({ antiAi: { antiAiScore: 83 }, market: { scores: {}, overall: 76, advice: [] }, audience: { cravingScore: 91, riskPoints: [], wantNext: '追更' } }, 'p1');
  assert.match($('scoreGrid').innerHTML, /<b>76<\/b>/);
  assert.match($('scoreGrid').innerHTML, /<b>91<\/b>/);
  assert.doesNotMatch($('scoreGrid').innerHTML, /\[object Object\]/);
});

for (const [kind, render, required] of [['cast', 'renderCastLibEditor', 'Persona'], ['prop', 'renderPropLibEditor', 'Meaning'], ['scene', 'renderSceneLibEditor', 'Meaning']]) {
  test(`${kind} edit keeps the source ID when the user renames the asset`, async () => {
    let saved;
    const { context: c, $ } = setup([render], { libSourceRow: () => '', alert() {},
      Api: { request: async (_url, opts) => { saved = JSON.parse(opts.body); return { ok: true }; } },
      loadCastAssets() {}, loadPropAssets() {}, loadSceneAssets() {}, openCastLibrary() {}, openPropLibrary() {}, openSceneLibrary() {},
    });
    c[render]({ id: 'original-id', name: '原名' });
    $(`${kind}LibEditName`).value = '新名';
    $(`${kind}LibEdit${required}`).value = '保留内容';
    await $(`${kind}LibEditSave`).onclick();
    assert.equal(saved.id, 'original-id');
    assert.equal(saved.name, '新名');
  });
  for (const outcome of ['success', 'failure']) {
    test(`${kind} save blocks duplicate submissions and re-enables after ${outcome}`, async () => {
      let resolveRequest, requests = 0;
      const pending = new Promise(resolve => { resolveRequest = resolve; });
      const { context: c, $ } = setup([render], { libSourceRow: () => '', alert() {},
        Api: { request: async () => { requests++; return pending; } },
        loadCastAssets() {}, loadPropAssets() {}, loadSceneAssets() {}, openCastLibrary() {}, openPropLibrary() {}, openSceneLibrary() {},
      });
      c[render]({ name: '新资产' });
      $(`${kind}LibEditName`).value = '新资产';
      $(`${kind}LibEdit${required}`).value = '有效设定';
      const button = $(`${kind}LibEditSave`);
      const first = button.onclick();
      assert.equal(button.disabled, true);
      await button.onclick();
      assert.equal(requests, 1);
      resolveRequest(outcome === 'success' ? { ok: true } : { ok: false, json: async () => ({ message: '已有同名资产' }) });
      await first;
      assert.equal(button.disabled, false);
    });
  }
}

for (const error of ['BRANCH_VALIDATION_FAILED', 'TREND_PII_BLOCKED', 'AD_CLAIM_BLOCKED']) {
  test(`${error} leaves a failed, removable task instead of a running task`, async () => {
    const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
      selectedMode: 'adapt', selectedTrack: 'signature_scene', draftProject: null,
      loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
      brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
      hookPayload: () => ({}), beatPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), outLocale: () => 'zh',
      PV: () => ({ createProgress: () => ({}) }), showBranchError() {}, showTrendError() {}, showBrandError() {},
      showFail() {}, closeWorkbench() {}, BRANCH_UI_DICT: () => ({}), TREND_UI_DICT: () => ({}),
      Api: { isAuthed: () => true, request: async url => url.endsWith('/projects') ? { ok: true, json: async () => ({ id: 'p1', title: '测试', mode: 'adapt' }) } : { ok: false, status: 400, text: async () => JSON.stringify({ error, message: '预检拒绝' }) } },
    });
    $('modeBrief').value = '有效创意'; $('episodes').value = '20'; $('engine').value = 'STANDARD';
    await c.startGenerate();
    assert.equal(c.genSessions.length, 1);
    assert.equal(c.genSessions[0].status, 'failed');
    assert.ok(c.genSessions[0].error);
    assert.equal($('progressPanel').classList.contains('hidden'), true);
  });
}

test('expired authentication opens the real login modal', () => {
  const { context: c, $ } = setup(['openAuth'], { authMode: '', syncAuthTabs() {}, renderAuthButton() {}, switchView() {}, openModal(id) { $(id).classList.remove('hidden'); } });
  c.window = {};
  vm.runInContext(`(${authHook})()`, c);
  assert.equal($('authModal').classList.contains('hidden'), false);
  assert.equal(c.authMode, 'login');
});

test('opening an adaptation draft offers a resume action with the saved brief', async () => {
  const project = { id: 'draft1', title: '改编草稿', mode: 'adapt', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION', bible: { adaptationDraft: { brief: '保存的改编人物和主线', recordId: 'td1' } } };
  const { context: c, $ } = setup(['openProject', 'resumeAdaptationProject', 'syncDraftProject', 'clearDraftProject'], {
    draftProject: null, Api: { request: async () => ({}), jsonOrThrow: async () => [] },
    closeWorkbench() {}, switchView() {}, renderModes() {}, syncTagBench() {}, syncModeBrief() {},
  });
  await c.openProject(project);
  assert.match($('epsList').innerHTML, /worksResumeDraft/);
  $('worksResumeDraft').onclick();
  assert.equal($('modeBrief').value, '保存的改编人物和主线');
  assert.equal(c.draftProject.id, 'draft1');
  assert.equal($('episodes').value, 20);
  assert.equal($('episodes').disabled, true);
});

test('submitting a resumed adaptation uses its project without creating a duplicate', async () => {
  const requests = [];
  const project = { id: 'draft1', title: '改编草稿', mode: 'adapt', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION' };
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
    selectedMode: 'adapt', selectedTrack: 'signature_scene', draftProject: project,
    loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
    brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
    hookPayload: () => ({}), beatPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), outLocale: () => 'zh',
    PV: () => ({ createProgress: () => ({}) }), closeWorkbench() {}, clearDraftProject() {}, showFail() {},
    Api: { isAuthed: () => true, request: async (url, opts) => {
      requests.push({ url, data: JSON.parse(opts.body) });
      return url.endsWith('/projects') ? { ok: true, json: async () => ({ ...project, id: 'duplicate' }) }
        : { ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) } };
    } },
  });
  $('modeBrief').value = '编辑后的改编简报'; $('episodes').value = '20'; $('engine').value = 'STANDARD';
  await c.startGenerate();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/generate/episodes');
  assert.equal(requests[0].data.projectId, 'draft1');
  assert.equal(requests[0].data.brief, '编辑后的改编简报');
});

test('switching from a saved draft to another mode unlocks the project settings', () => {
  const { context: c, $ } = setup(['syncModeBrief', 'clearDraftProject', 'syncDraftProject'], {
    selectedMode: 'tags', draftProject: { id: 'draft1', title: '草稿', totalEps: 20 },
  });
  $('episodes').disabled = true;
  c.syncModeBrief();
  assert.equal(c.draftProject, null);
  assert.equal($('episodes').disabled, false);
});

test('unavailable payments are explained before purchase and all catalog buttons are disabled', async () => {
  const { context: c, $ } = setup(['loadCatalog'], {
    LEVEL_ZH: { BASIC: '基础会员' }, Api: { getUser: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ paymentAvailable: false,
      plans: [{ level: 'BASIC', monthlyFen: 3900 }],
      items: [{ sku: 'BASIC_Y', amountFen: 39000, amountYuan: 390 }, { sku: 'PT_10', kind: 'POINTS', amountYuan: 10, points: 100 }],
    }) }),
  });
  await c.loadCatalog();
  assert.equal($('paymentNotice').classList.contains('hidden'), false);
  assert.match($('paymentNotice').textContent, /在线支付暂未开通/);
  const buttons = ($('plansGrid').innerHTML + $('skuGrid').innerHTML).match(/<button\b[^>]*data-sku=[^>]*>/g);
  assert.equal(buttons.length, 3);
  buttons.forEach(button => assert.match(button, /\bdisabled\b/));
});

test('teardown hands the persisted project to the editor with the selected generation settings', async () => {
  const teardownSource = fs.readFileSync(path.join(__dirname, '../web/teardown-view.js'), 'utf8');
  const teardownAst = ts.createSourceFile('teardown-view.js', teardownSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let toProjectSource;
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'toProject') toProjectSource = node.getText(teardownAst);
    ts.forEachChild(node, find);
  }
  find(teardownAst);
  const project = { id: 'draft1', bible: { adaptationDraft: { brief: '已保存的改编简报' } } };
  const requests = [], events = [];
  let restored = false;
  const { context: c, $ } = setup([], {
    state: { recordId: 'td1' }, btn: () => () => { restored = true; },
    raw: async (url, body) => { requests.push({ url, body }); return { ok: true, data: { project } }; },
    T: () => ({ projOk: '草稿已保存' }), toast() {}, alert: assert.fail, needLogin: () => false, failMsg: e => e.message,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { dispatchEvent: event => events.push(event) },
  });
  $('episodes').value = '12'; $('engine').value = 'ECONOMY'; $('scriptFormatSel').value = 'LIVE_ACTION';
  vm.runInContext(toProjectSource, c);
  await c.toProject();
  assert.equal(requests[0].url, '/api/teardown/td1/to-project');
  assert.equal(requests[0].body.totalEps, 12);
  assert.equal(requests[0].body.engineTier, 'ECONOMY');
  assert.equal(events[0].type, 'zn-adaptation-project');
  assert.equal(events[0].detail.project, project);
  assert.equal(restored, true);
});
