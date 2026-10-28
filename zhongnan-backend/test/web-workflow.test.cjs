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
        setAttribute() {}, appendChild() {}, focus() {}, remove() {}, querySelector: () => null,
        addEventListener(ev, fn) { (this._listeners ||= {})[ev] = fn; }, dispatchEvent() {} });
    }
    return nodes.get(id);
  };
  const context = { $, lang: 'zh', console, AbortController, TextDecoder, Event, CustomEvent, PV: () => ProgressView,
    capturePrivateSession: () => ({ owner: 'fixture', epoch: 0 }), isPrivateSessionCurrent: () => true,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], removeEventListener() {}, createElement: () => $('created') },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    t: x => x, escapeHtml: x => String(x ?? ''), toastError() {}, xnSay() {},
    renderTaskQueue() {}, renderProgress() {}, resetPanels() {}, refreshListenBtn() {},
    loadMe() {}, loadWorks() {}, loadCatalog() {}, loadFeed() {}, loadListings() {}, enterAdmin() {},
    VIEWS: ['studio', 'works', 'vip', 'square', 'market', 'admin'], _switchAnimToken: 0, _workbenchHideTimer: null,
    // v2.242 焦点进出：_hideWorkbenchLayer 的 setTimeout 回调读取该变量
    _workbenchPrevFocus: null,
    // 合并（剧本1）后 switchView 引用导航栈；null 走应用自身的降级守卫（与浏览器缺 nav-stack.js 一致）
    _navStack: null,
    _WORKBENCH_PANEL_IDS: ['sourceTextPanel', 'teardownPanel', 'interviewPanel', 'resultPanel'],
    currentWorksProject: null, currentWorksDiagnosis: null, currentScripts: [], currentProjectId: null,
    lastFiling: null, pendingWarnings: null, activeSessionId: null, genSessions: [],
    // v2.276/v2.277 模块级 let（逐函数 vm 求值需在 context 预置，否则 startGenerate 入口 ReferenceError）
    _genStarting: false, _retryProject: null, _retryBrief: null,
    // v2.329 三维契约：剧本类型 + 输出语种为模块级 let/const，逐函数求值需预置
    selectedScriptType: 'live_action_drama', outputLangValue: () => 'zh', renderScriptTypes() {},
    renderAigcDash() {}, loadDiagnosis: async () => {}, loadEmotionWave: async () => {}, loadInvestorLens: async () => {},
    _uiLangEn: () => ((typeof extra.lang === 'string' ? extra.lang : 'zh') === 'en'),
    ...extra };
  vm.createContext(context);
  // v2.221 加载/空态统一：被抽取函数（openProject/switchSession 等）依赖 znSkeleton/znEmpty*，先注入真实实现
  for (const name of ['_znEsc', 'znSkeletonHtml', 'znSkeleton', 'znEmptyHtml', 'znEmpty']) if (functions.has(name)) vm.runInContext(functions.get(name), context);
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

test('opening an adaptation draft offers a resume action with the saved brief and restores sourceText (v2.319 / v2.329 spark)', async () => {
  const project = { id: 'draft1', title: '改编草稿', mode: 'spark', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION',
    bible: { sourceText: '承接时持久化的爆款原文内容，足够十个字', adaptationDraft: { brief: '保存的改编人物和主线', recordId: 'td1' } } };
  const { context: c, $ } = setup(['openProject', 'resumeAdaptationProject', 'syncDraftProject', 'clearDraftProject'], {
    draftProject: null, Api: { request: async () => ({}), jsonOrThrow: async () => [] },
    closeWorkbench() {}, switchView() {}, renderModes() {}, syncTagBench() {}, syncModeBrief() {},
  });
  await c.openProject(project);
  assert.match($('epsList').innerHTML, /worksResumeDraft/);
  $('worksResumeDraft').onclick();
  assert.equal(c.selectedMode, 'spark', 'v2.329 改编/小说/名场面统一并入灵感式（素材改编轨道）');
  assert.equal($('modeBrief').value, '保存的改编人物和主线');
  assert.equal($('sourceText').value, '承接时持久化的爆款原文内容，足够十个字', '恢复改编草稿必须回填原文，续写版权闸门不中断');
  assert.equal(c.draftProject.id, 'draft1');
  assert.equal($('episodes').value, 20);
  assert.equal($('episodes').disabled, true);
});

test('v2.322 opening a novel project offers a resume action with the saved sourceText (v2.329 并入 spark)', async () => {
  const project = { id: 'novel1', title: '小说改短剧', mode: 'novel', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION',
    bible: { sourceText: '小说原文：第一章他离开了故乡，踏入陌生的城市，开始了新的生活。' } };
  const { context: c, $ } = setup(['openProject', 'resumeAdaptationProject', 'syncDraftProject', 'clearDraftProject'], {
    draftProject: null, Api: { request: async () => ({}), jsonOrThrow: async () => [] },
    closeWorkbench() {}, switchView() {}, renderModes() {}, syncTagBench() {}, syncModeBrief() {},
  });
  await c.openProject(project);
  assert.match($('epsList').innerHTML, /worksResumeDraft/, '小说项目立项后必须有「继续创作」入口（与改编对称）');
  $('worksResumeDraft').onclick();
  assert.equal(c.selectedMode, 'spark', '点继续创作后 selectedMode 必须切到灵感式（小说=素材改编轨道）');
  assert.equal(c.draftProject.id, 'novel1', 'draftProject 必须复用已立项项目，不再造孤儿');
  assert.equal($('sourceText').value, project.bible.sourceText, '持久化的小说原文必须回填，续写版权闸门不中断');
  assert.equal($('modeBrief').value, '', '小说模式无改编大纲，modeBrief 留空让用户写本集方向');
  assert.equal($('episodes').value, 20);
  assert.equal($('episodes').disabled, true);
});

test('submitting a resumed adaptation uses its project without creating a duplicate', async () => {
  const requests = [];
  const project = { id: 'draft1', title: '改编草稿', mode: 'spark', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION' };
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
    selectedMode: 'spark', selectedTrack: 'signature_scene', draftProject: project,
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

test('v2.319 tags mode creates the project with structured Chinese tags (not just a text brief)', async () => {
  const requests = [];
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
    selectedMode: 'tag', selectedTrack: '', draftProject: null,
    tagChosen: ['逆袭', '都市'], TAG_MAX: 14,
    loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
    buildTagBrief: () => '标签组合：逆袭、都市……的自然语言简报', tagProjectTitle: () => '标签剧标题', rememberPrefTags() {},
    brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
    hookPayload: () => ({}), beatPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), outLocale: () => 'zh',
    PV: () => ({ createProgress: () => ({}) }), closeWorkbench() {}, showFail() {},
    Api: { isAuthed: () => true, request: async (url, opts) => {
      requests.push({ url, data: JSON.parse(opts.body) });
      return url.endsWith('/projects') ? { ok: true, json: async () => ({ id: 'ptag', title: '标签剧标题', mode: 'tags' }) }
        : { ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }), cancel: async () => {} } };
    } },
  });
  $('tagBench').classList.remove('hidden');
  $('episodes').value = '20'; $('engine').value = 'STANDARD';
  await c.startGenerate();
  const create = requests.find(r => r.url === '/api/generate/projects');
  assert.ok(create, '标签模式必须走立项请求');
  assert.deepEqual(create.data.tags, ['逆袭', '都市'], '立项 payload 必须携带结构化中文标签');
  assert.equal(create.data.sourceText, undefined, '标签模式不得携带原文');
});

test('v2.319 spark mode persists sourceText at project creation so resume/regeneration keeps the copyright gate', async () => {
  const requests = [];
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession', 'sourceTextPayload'], {
    selectedMode: 'spark', selectedTrack: 'signature_scene', draftProject: null,
    loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
    brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
    hookPayload: () => ({}), beatPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), outLocale: () => 'zh',
    PV: () => ({ createProgress: () => ({}) }), closeWorkbench() {}, showFail() {},
    Api: { isAuthed: () => true, request: async (url, opts) => {
      requests.push({ url, data: JSON.parse(opts.body) });
      return url.endsWith('/projects') ? { ok: true, json: async () => ({ id: 'padapt', title: '改编创意', mode: 'adapt' }) }
        : { ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }), cancel: async () => {} } };
    } },
  });
  $('modeBrief').value = '改编创意'; $('episodes').value = '20'; $('engine').value = 'STANDARD';
  $('sourceText').value = '  这是用户粘贴的原创小说原文，长度足够启用 n-gram 闸门。  ';
  await c.startGenerate();
  const create = requests.find(r => r.url === '/api/generate/projects');
  assert.ok(create);
  assert.equal(create.data.sourceText, '这是用户粘贴的原创小说原文，长度足够启用 n-gram 闸门。', '立项即持久化 trim 后的原文');
  const gen = requests.find(r => r.url === '/api/generate/episodes');
  assert.equal(gen.data.sourceText, '这是用户粘贴的原创小说原文，长度足够启用 n-gram 闸门。', '生成请求继续透传原文');
});

test('switching from a saved draft to another mode unlocks the project settings', () => {
  const { context: c, $ } = setup(['syncModeBrief', 'clearDraftProject', 'syncDraftProject'], {
    selectedMode: 'tag', draftProject: { id: 'draft1', title: '草稿', totalEps: 20 },
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
    state: { recordId: 'td1', sourceText: '  拆爆款时粘贴的爆款原文，长度足够启用闸门。  ' }, btn: () => () => { restored = true; },
    raw: async (url, body) => { requests.push({ url, body }); return { ok: true, data: { project } }; },
    T: () => ({ projOk: '草稿已保存' }), toast() {}, toastErr() {}, toastOk() {}, alert: assert.fail, needLogin: () => false, failMsg: e => e.message,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { dispatchEvent: event => events.push(event) },
  });
  $('episodes').value = '12'; $('engine').value = 'ECONOMY'; $('scriptFormatSel').value = 'LIVE_ACTION';
  vm.runInContext(toProjectSource, c);
  await c.toProject();
  assert.equal(requests[0].url, '/api/teardown/td1/to-project');
  assert.equal(requests[0].body.totalEps, 12);
  assert.equal(requests[0].body.engineTier, 'ECONOMY');
  assert.equal(requests[0].body.sourceText, '拆爆款时粘贴的爆款原文，长度足够启用闸门。', 'v2.319 承接改编必须携带 trim 后原文');
  assert.equal(events[0].type, 'zn-adaptation-project');
  assert.equal(events[0].detail.project, project);
  assert.equal(restored, true);

  // v2.319 短于 10 字的残留文本不携带（后端 min 10 会拒，前端先净化）
  requests.length = 0;
  c.state.sourceText = '九个字啊啊啊啊';
  await c.toProject();
  assert.equal(requests[0].body.sourceText, undefined);
});

test('v2.319/v2.329 brief/document extraction routes spark text into the source box, tag into the brief box', async () => {
  class FakeFileReader {
    readAsDataURL(file) { this.result = file.dataUrl; this.onload(); }
  }
  const tick = () => new Promise(r => setImmediate(r));
  const run = async (mode, { existingSource = '' } = {}) => {
    const requests = [];
    const { context: c, $ } = setup(['initBriefUpload'], {
      briefUploadInited: false, selectedMode: mode, FileReader: FakeFileReader, xnSay() {},
      Api: { request: async (url, opts) => { requests.push({ url, opts }); return {}; }, jsonOrThrow: async () => ({ text: '提取出的正文内容', chars: 8 }) },
    });
    $('sourceText').value = existingSource;
    c.initBriefUpload();
    const input = $('briefFile');
    input.files = [{ name: '原稿.docx', size: 1024, dataUrl: 'data:application/octet-stream;base64,QUJDREU=' }];
    await input._listeners.change();
    await tick();
    return { $, requests };
  };
  const spark = await run('spark');
  assert.equal(spark.$('sourceText').value, '提取出的正文内容', '灵感式（素材改编）：提取正文进原文框，版权闸门可生效');
  assert.equal(spark.$('modeBrief').value, '');
  assert.equal(spark.requests[0].url, '/api/generate/extract-source');

  const withExisting = await run('spark', { existingSource: ' 已有原文内容 ' });
  assert.equal(withExisting.$('sourceText').value, '提取出的正文内容\n\n已有原文内容', '新提取内容置顶，旧原文保留');

  const tag = await run('tag');
  assert.equal(tag.$('modeBrief').value, '提取出的正文内容', '标签模式仍进创意简报框');
  assert.equal(tag.$('sourceText').value, '');
});
