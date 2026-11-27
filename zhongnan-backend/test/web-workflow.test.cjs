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
    // v2.471 loadCatalog 的会员权益改为由 I18N.MODES 派生数量与名单，浏览器里 I18N 是全局，这里同源注入
    I18N: require('../web/i18n.js'),
    // v2.489 resumeAdaptationProject 用 clampEngineTier 回落当前档可用的引擎档，需要档位真源与账号档位
    ENGINE_TIERS: [
      { id: 'ECONOMY', zh: '经济（高性价比）', en: 'Economy (best value)', min: 'free' },
      { id: 'STANDARD', zh: '标准（均衡）', en: 'Standard (balanced)', min: 'basic' },
      { id: 'FLAGSHIP', zh: '旗舰（顶配组合）', en: 'Flagship (top mix)', min: 'advanced' },
    ],
    _RANK: { free: 0, basic: 1, advanced: 2, pro: 3, paid: 3 },
    // v2.667 续写轨道判定依赖模式真源；测试内给最小键集，未知模式走 spark 回落
    MODE_BRIEF: { spark: {}, novel: {}, adapt: {}, tag: {} },
    worksListDirty: false,
    meCache: null, isStaffAcct: () => false,
    capturePrivateSession: () => ({ owner: 'fixture', epoch: 0 }), isPrivateSessionCurrent: () => true,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], removeEventListener() {}, createElement: () => $('created') },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    t: x => x, escapeHtml: x => String(x ?? ''), toastError() {}, xnSay() {},
    renderTaskQueue() {}, renderProgress() {}, resetPanels() {}, refreshListenBtn() {},
    loadMe() {}, loadWorks() {}, loadCatalog() {}, loadFeed() {}, loadListings() {}, enterAdmin() {},
    // v2.446 switchView 内同步 #/<view>；本 harness 不提供 location/history，地址栏契约由
    // test/web-view-router.test.cjs 覆盖，这里置空只验证视图与面板切换
    writeRoute() {},
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
    // v2.688 切语言显隐守卫：syncModeBrief/syncTagBench 读取模块级 let，逐函数求值需预置
    _langSyncing: false,
    // v2.329 三维契约：剧本类型 + 输出语种为模块级 let/const，逐函数求值需预置
    selectedScriptType: 'live_action_drama', outputLangValue: () => 'zh', renderScriptTypes() {},
    renderAigcDash() {}, renderLiveProdDash() {}, loadDiagnosis: async () => {}, loadEmotionWave: async () => {}, loadInvestorLens: async () => {},
    _uiLangEn: () => ((typeof extra.lang === 'string' ? extra.lang : 'zh') === 'en'),
    // v2.501 onAuthRequired 回调内调用 currentView() 判断是否在首页；沙箱预置非 home 视图
    currentView: () => 'studio',
    ...extra };
  vm.createContext(context);
  // v2.221 加载/空态统一：被抽取函数（openProject/switchSession 等）依赖 znSkeleton/znEmpty*，先注入真实实现
  for (const name of ['_znEsc', 'znSkeletonHtml', 'znSkeleton', 'znEmptyHtml', 'znEmpty', 'clampEngineTier', 'acctRank', 'engineLabel',
    // v2.689 会员单价/年卡省文案 helper：loadCatalog→renderPlans 调用，逐函数求值需预置
    '_fmtYuanFromPoints', 'formatPerEpPerk', 'formatYearSave',
    // v2.668 集数口径单一真源
    'normalizeEpisodeCount',
    // v2.667 作品详情头概况/续写入口
    'platformLabel', 'workModeLabel', 'nextEpisodeNo', 'worksDetailMetaHtml', 'renderWorksDetailHead', 'projectContinuationMode', 'draftProjectMatchesMode', 'resumeProjectForContinuation']) if (functions.has(name)) vm.runInContext(functions.get(name), context);
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
  const { context: c, $ } = setup(['renderResult', 'renderResultNext', 'nextEpisodeNo'], { refreshResultScripts() { return []; } });
  await c.renderResult({ antiAi: { antiAiScore: 83 }, market: { scores: {}, overall: 76, advice: [] }, audience: { cravingScore: 91, riskPoints: [], wantNext: '追更' } }, 'p1');
  assert.match($('scoreGrid').innerHTML, /<b>76<\/b>/);
  assert.match($('scoreGrid').innerHTML, /<b>91<\/b>/);
  assert.doesNotMatch($('scoreGrid').innerHTML, /\[object Object\]/);
});

// v2.677 出本后衔接：生成完成停在结果页时，用户此前只能靠顶部小任务卡或手动切「作品库」
// 才能看到分集/版本/单集体检/续写下一集。结果页必须自带「下一步」交接条。
test('result page shows a next-step handoff to episodes and the next episode', async () => {
  const records = [{ epNo: 1, version: 1, title: '一', content: '第一集正文' }];
  const project = { id: 'p1', title: '成稿作品', totalEps: 20 };
  const calls = {};
  const { context: c, $ } = setup(['renderResult', 'renderResultNext', 'latestScriptsByEpisode', 'refreshResultScripts', 'nextEpisodeNo'], {
    Api: {
      request: async (url) => ({ url }),
      jsonOrThrow: async (res) => (String(res.url).endsWith('/scripts') ? records : project),
    },
    t: (k, p) => (k === 'nextStepContinue' ? `继续写第${p.n}集` : k),
    openProject: async (p) => { calls.opened = p.id; },
    switchView(v) { calls.view = v; },
  });
  // setup 会预载真实 resumeProjectForContinuation，这里在求值后替换为探针，验证交接条传参。
  c.resumeProjectForContinuation = (p, n) => { calls.resume = [p.id, n]; };
  await c.renderResult({ antiAi: { antiAiScore: 83 }, market: { overall: 76 }, audience: { cravingScore: 91 } }, 'p1');
  assert.equal($('resultNextBar').classList.contains('hidden'), false, '结果页应显示下一步交接条');
  assert.match($('resultNextContinue').textContent, /第2集/, '续写按钮应指向第 2 集');
  await $('resultNextContinue').onclick();
  assert.deepEqual(calls.resume, ['p1', 2], '续写应带真实项目与下一集集号');
  await $('resultNextWorks').onclick();
  assert.equal(calls.view, 'works', '查看分集应切到作品库');
  assert.equal(calls.opened, 'p1', '查看分集应直接打开该项目详情');
});

// v2.678 作品库单集体检：体检面板此前只吃正文，不带「来自哪部作品第几集」，
// 多集交替体检时「本集」指代不清，体检完也找不到回哪一集改稿。
// 从分集进入时必须标明来源，并提供一键回到该集（关闭工作台 + 滚到分集卡片并高亮）。
test('single-episode checkup carries its source and offers a way back', async () => {
  const records = [{ id: 's1', epNo: 1, version: 1, title: '一', content: '第一集正文' }];
  const project = { id: 'p1', title: '成稿作品', totalEps: 20 };
  const calls = { workbench: [], closed: 0, scrolled: null, flashed: null };
  const item = {
    classList: { add: (x) => { calls.flashed = x; }, remove() {}, contains: () => false },
    scrollIntoView: (o) => { calls.scrolled = o; },
  };
  const { context: c, $ } = setup(
    ['openProject', 'setLintOrigin', 'returnToLintOrigin'],
    {
      Api: { request: async () => ({}), jsonOrThrow: async () => records },
      openWorkbench: (id) => calls.workbench.push(id),
      closeWorkbench: () => { calls.closed += 1; },
      document: {
        getElementById: () => null, querySelector: () => item, querySelectorAll: () => [],
        removeEventListener() {}, createElement: () => $('created'),
      },
      t: (k, vars) => {
        let s = require('../web/i18n.js').t('zh', k);
        if (vars) Object.entries(vars).forEach(([kk, vv]) => { s = s.split('{' + kk + '}').join(String(vv)); });
        return s;
      },
    }
  );
  const lintBtn = { getAttribute: () => '1', onclick: null };
  $('epsList').querySelectorAll = (sel) => (sel === '.ep-lint-btn' ? [lintBtn] : []);
  $('lintRunBtn').click = () => {};
  await c.openProject(project);
  assert.equal($('lintOrigin').classList.contains('hidden'), true, '未从分集进入体检时不应出现来源条');
  lintBtn.onclick({ stopPropagation() {} });
  assert.deepEqual(calls.workbench, ['lintPanel'], '分集体检应打开体检面板');
  assert.equal($('lintText').value, '第一集正文', '体检正文应带入当前集最新版');
  assert.equal($('lintOrigin').classList.contains('hidden'), false, '从分集进入体检必须显示来源条');
  assert.equal($('lintOriginText').textContent, '来自《成稿作品》· EP1', '来源条要写清作品名与集号');
  $('lintOriginBack').onclick();
  assert.equal(calls.closed, 1, '回到该集要先关闭体检工作台');
  assert.equal(calls.scrolled && calls.scrolled.block, 'center', '回到该集应把分集卡片滚到视野中央');
  assert.equal(calls.flashed, 'ep-flash', '回到该集应短暂高亮目标分集');
  c.setLintOrigin(null);
  assert.equal($('lintOrigin').classList.contains('hidden'), true, '离开分集入口后来源条必须收起');
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
      hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), modeInputPayload: () => ({}), outLocale: () => 'zh',
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

// v2.698 结构化三模式（角色自述 / 双人对撞 / 世界线推演）出本断链：
// 这三个模式的二级界面只挂结构化字段卡片，modeBriefPanel 留在隐藏的 workbenchBody 里（不可见、高度 0），
// startGenerate 却只认 modeBrief 文本 → 用户把四字段填满仍被拦在「先在上方输入框写清你的创意」，
// 而画面上根本没有那个输入框。字段就是这三个模式的全部创作事实源，简报应由字段合成。
for (const [mode, fields, expectText] of [
  ['persona', { personaIdentity: '32岁急诊医生', personaWant: '查清当年手术真相' }, '急诊医生'],
  ['duel', { duelAIdentity: '刚融资的CEO', duelBIdentity: '八年老员工' }, '八年老员工'],
  ['multiverse', { mvChoice: '保险单受益人不是她' }, '受益人不是她'],
]) {
  test(`v2.698 ${mode} 填满结构化字段即可出本（简报由字段合成，不再被不可见的输入框拦住）`, async () => {
    const posts = [];
    const { context: c, $ } = setup(['startGenerate', 'failGenerationSession', 'modeInputPayload', 'structuredModeBrief'], {
      selectedMode: mode, selectedTrack: 'material_rewrite', draftProject: null,
      loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
      brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
      hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}),
      castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}),
      sourceTextPayload: () => ({}), outLocale: () => 'zh', xnSay: () => {},
      PV: () => ({ createProgress: () => ({}) }), showBranchError() {}, showTrendError() {}, showBrandError() {},
      showFail() {}, closeWorkbench() {}, BRANCH_UI_DICT: () => ({}), TREND_UI_DICT: () => ({}),
      Api: {
        isAuthed: () => true,
        request: async (url, opts) => {
          posts.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
          return url.endsWith('/projects')
            ? { ok: true, json: async () => ({ id: 'p1', title: '测试', mode }) }
            : { ok: false, status: 400, text: async () => JSON.stringify({ error: 'TEST_STOP' }) };
        },
      },
    });
    for (const [id, v] of Object.entries(fields)) $(id).value = v;
    $('mvChoices').querySelectorAll = () => [];
    $('episodes').value = '20'; $('engine').value = 'STANDARD';
    await c.startGenerate();
    assert.equal(posts.length, 2, '填了结构化字段就必须真的发起立项与出本，而不是在建单前被拦下');
    assert.equal(posts[0].url, '/api/generate/projects');
    assert.equal(posts[1].url, '/api/generate/episodes');
    assert.ok(posts[1].body.brief && posts[1].body.brief.includes(expectText), '出本简报应包含用户填写的关键事实：' + posts[1].body.brief);
    assert.ok(posts[0].body.modeInput && posts[0].body.modeInput[mode], '结构化字段仍随立项落库（事实源不丢）');
    assert.ok(!/[；;]/.test(c.genSessions[0].title), '项目标题应停在完整首句，不得跨进第二个从句：' + c.genSessions[0].title);
  });

  test(`v2.698 ${mode} 字段全空时给出「先填上面的字段」而不是指向看不见的输入框`, async () => {
    const said = [];
    const { context: c, $ } = setup(['startGenerate', 'failGenerationSession', 'modeInputPayload', 'structuredModeBrief'], {
      selectedMode: mode, selectedTrack: 'material_rewrite', draftProject: null,
      loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
      xnSay: (m) => said.push(m),
      t: (k) => require('../web/i18n.js').t('zh', k),
      Api: { isAuthed: () => true, request: async () => { throw new Error('不应发起任何请求'); } },
    });
    $('mvChoices').querySelectorAll = () => [];
    $('episodes').value = '20'; $('engine').value = 'STANDARD';
    await c.startGenerate();
    assert.equal(said.length, 1, '空态应且仅应给出一条提示');
    assert.doesNotMatch(said[0], /上方输入框|type your idea above/i,
      '这三个模式的详情页没有可见的简报输入框，不能再把用户指向它');
    assert.match(said[0], /上面|above/i, '提示要指回详情页上方的可见字段区');
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
  assert.equal($('episodes').value, '20', 'v2.668 input.value 统一为字符串（与真实 DOM 一致）');
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
  assert.equal($('episodes').value, '20');
  assert.equal($('episodes').disabled, true);
});

test('submitting a resumed adaptation uses its project without creating a duplicate', async () => {
  const requests = [];
  const project = { id: 'draft1', title: '改编草稿', mode: 'spark', totalEps: 20, engineTier: 'STANDARD', format: 'LIVE_ACTION' };
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
    selectedMode: 'spark', selectedTrack: 'signature_scene', draftProject: project,
    loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
    brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
    hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), modeInputPayload: () => ({}), outLocale: () => 'zh',
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
    hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), modeInputPayload: () => ({}), outLocale: () => 'zh',
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
    hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), modeInputPayload: () => ({}), outLocale: () => 'zh',
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

// v2.661 递招选择可信化：面板承诺「将自动注入出本创意」，但此前只有标签模式注入，
// 灵感式/采访/热点等模式的出本 brief 完全丢弃所选手法；且选择只在内存，刷新/切页即丢。
const CRAFT_LINE = '创作手法：钩子[集尾钩]；方法[先抑后扬]';

function craftGenerateHarness({ mode = 'spark', brief = '一个关于复仇的故事', craftLine = CRAFT_LINE, extra = {} } = {}) {
  const requests = [];
  const { context: c, $ } = setup(['startGenerate', 'failGenerationSession'], {
    selectedMode: mode, selectedTrack: 'signature_scene', draftProject: null,
    loadCastAssets: async () => {}, loadPropAssets: async () => {}, loadSceneAssets: async () => {},
    brandBriefPayload: () => ({}), trendBriefPayload: () => ({}), branchBriefPayload: () => ({}),
    hookPayload: () => ({}), beatPayload: () => ({}), scenesPayload: () => ({}), platformPayload: () => ({}), castAssetPayload: () => ({}), propAssetPayload: () => ({}), sceneAssetPayload: () => ({}), aigcPayload: () => ({}), sourceTextPayload: () => ({}), modeInputPayload: () => ({}), outLocale: () => 'zh',
    craftBriefLine: () => craftLine,
    PV: () => ({ createProgress: () => ({}) }), closeWorkbench() {}, showFail() {}, toastInfo() {},
    Api: { isAuthed: () => true, request: async (url, opts) => {
      requests.push({ url, data: opts && opts.body ? JSON.parse(opts.body) : null });
      return url.endsWith('/projects') ? { ok: true, json: async () => ({ id: 'p1', title: brief.slice(0, 40), mode }) }
        : { ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }), cancel: async () => {} } };
    } },
    ...extra,
  });
  $('modeBrief').value = brief; $('episodes').value = '20'; $('engine').value = 'STANDARD';
  return { c, $, requests };
}

test('v2.661 非标签模式也要把所选手法注入出本创意（此前只在标签模式生效）', async () => {
  const { c, requests } = craftGenerateHarness();
  await c.startGenerate();
  const create = requests.find(r => r.url === '/api/generate/projects');
  const gen = requests.find(r => r.url === '/api/generate/episodes');
  assert.ok(create && gen, '灵感式仍走立项 + 生成两段');
  assert.equal(create.data.title, '一个关于复仇的故事', '标题只取用户创意，不得混入手法串');
  assert.equal(gen.data.brief, '一个关于复仇的故事\n' + CRAFT_LINE, '所选手法必须随出本 brief 提交，不能只存在内存里');
});

test('v2.661 用户创意里已含手法串时不得重复注入', async () => {
  const { c, requests } = craftGenerateHarness({ brief: '一个关于复仇的故事\n' + CRAFT_LINE });
  await c.startGenerate();
  const gen = requests.find(r => r.url === '/api/generate/episodes');
  assert.equal((gen.data.brief.match(/创作手法：/g) || []).length, 1, '手法串只能出现一次');
});

test('v2.661 递招选择持久化：增删选与刷新恢复，且库内已删的幽灵项被过滤', () => {
  const store = new Map();
  const LS = { g: (k, d) => (store.has(k) ? store.get(k) : d), s: (k, v) => store.set(k, v) };
  const taxonomy = { hooks: [{ id: 'episode_hook', name: '集尾钩' }], cardGroups: [{ name: '组', cards: [{ id: 'c1', title: '先抑后扬' }] }] };
  const { context: c } = setup(['addCraftHook', 'removeCraftHook', 'toggleCraftCard', 'restoreCraftPick', 'saveCraftPick', 'findHook'], {
    LS, CRAFT_PICK_KEY: 'zn:craftPick', craftSelHooks: [], craftSelCards: [], craftRecCards: [], craftTaxonomy: taxonomy, craftTaxonomyLang: 'zh',
    renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {},
  });
  c.addCraftHook('episode_hook');
  c.toggleCraftCard({ id: 'c1', title: '先抑后扬' });
  assert.equal(store.size, 1, '选择变更必须落盘，刷新才不丢');
  const key = [...store.keys()][0];
  const saved = JSON.parse(store.get(key));
  assert.deepEqual(saved.hooks.map(h => h.id), ['episode_hook']);
  assert.deepEqual(saved.cards.map(x => x.id), ['c1']);

  c.craftSelHooks = []; c.craftSelCards = [];
  c.restoreCraftPick();
  assert.equal(Array.from(c.craftSelHooks, h => h.id).join(','), 'episode_hook', '刷新后恢复已选钩子');
  assert.equal(Array.from(c.craftSelCards, x => x.id).join(','), 'c1', '刷新后恢复已选方法卡');

  c.removeCraftHook('episode_hook');
  assert.deepEqual(JSON.parse(store.get(key)).hooks, [], '取消选择也要落盘');

  store.set(key, JSON.stringify({ hooks: [{ id: 'ghost', name: '旧钩子' }], cards: [{ id: 'ghost2', title: '已删卡' }] }));
  c.craftSelHooks = []; c.craftSelCards = [];
  c.restoreCraftPick();
  assert.equal(c.craftSelHooks.length, 0, '分类库已删的钩子不得作为幽灵项复活');
  assert.equal(c.craftSelCards.length, 0, '分类库已删的方法卡不得作为幽灵项复活');
});

test('v2.661 一键递招的推荐结果同样持久化（刷新后仍是上次匹配组合）', async () => {
  const store = new Map();
  const LS = { g: (k, d) => (store.has(k) ? store.get(k) : d), s: (k, v) => store.set(k, v) };
  const { context: c, $ } = setup(['craftGo', 'restoreCraftPick', 'saveCraftPick', 'findHook', 'renderCraftOpeningAudit'], {
    LS, CRAFT_PICK_KEY: 'zn:craftPick', lang: 'zh', tagChosen: [], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [{ id: 'episode_hook', name: '集尾钩' }], cardGroups: [{ name: '组', cards: [{ id: 'c1', title: '先抑后扬' }] }] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    Api: { request: async () => ({ json: async () => ({ hooks: [{ id: 'episode_hook', name: '集尾钩' }], cards: [{ id: 'c1', title: '先抑后扬' }] }) }) },
  });
  $('tagIdea').value = '';
  $('craftIdea').value = '一个关于复仇的故事';
  await c.craftGo();
  const saved = JSON.parse([...store.values()][0] || '{}');
  assert.deepEqual(saved.hooks.map(h => h.id), ['episode_hook'], '递招推荐结果必须落盘');
  assert.deepEqual(saved.cards.map(x => x.id), ['c1'], '递招推荐卡必须落盘');
});

test('v2.675 独立递招只发送可见创意与开篇，不偷用隐藏标签，并留下持久审计', async () => {
  let sent;
  const { context: c, $ } = setup(['craftGo', 'renderCraftOpeningAudit', 'findHook', 'saveCraftPick'], {
    lang: 'zh', tagChosen: ['隐藏随机标签'], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [{ id: 'anticommon_hook', name: '反常钩' }], cardGroups: [] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    Api: { request: async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { json: async () => ({ hooks: [], cards: [], openingAudit: { used: ['anticommon_hook'], advice: '第二句再收紧。' } }) }; } },
  });
  $('craftIdea').value = '女医生回乡查出顶替真相';
  $('craftOpening').value = '她竟然在祖屋看见了自己的死亡证明。';
  await c.craftGo();
  assert.equal(sent.url, '/api/craft/recommend');
  assert.equal(sent.body.text, '女医生回乡查出顶替真相');
  assert.deepEqual(sent.body.tags, [], '独立递招不得携带隐藏标签');
  assert.equal(sent.body.opening, '她竟然在祖屋看见了自己的死亡证明。');
  assert.equal($('craftOpeningAudit').classList.contains('hidden'), false, '审计应留在面板上');
  assert.match($('craftOpeningAudit').innerHTML, /反常钩/);
  assert.match($('craftOpeningAudit').innerHTML, /第二句再收紧。/);
});

test('v2.675 标签台联动递招读取标签创意、已选标签与作品正文，不受独立底稿干扰', async () => {
  let sent;
  const { context: c, $ } = setup(['craftGo', 'renderCraftOpeningAudit', 'findHook', 'saveCraftPick'], {
    lang: 'zh', tagChosen: ['医生', '悬疑'], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [], cardGroups: [] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    Api: { request: async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { json: async () => ({ hooks: [], cards: [] }) }; } },
  });
  $('tagBench').classList.remove('hidden');
  $('tagIdea').value = '标签台专属创意';
  $('scriptText').textContent = '刀尖抵着她的喉咙。';
  $('craftIdea').value = '独立面板旧创意不得串入';
  $('craftOpening').value = '独立面板旧开篇不得串入';
  await c.craftGo();
  assert.equal(sent.url, '/api/craft/recommend');
  assert.equal(sent.body.text, '标签台专属创意');
  assert.deepEqual(sent.body.tags, ['医生', '悬疑']);
  assert.equal(sent.body.opening, '刀尖抵着她的喉咙。', '作品正文是 div，必须读取 textContent 而不是 value');
});

test('v2.675 独立递招出本走自动匹配，标题与简报都来自当前可见创意', async () => {
  const { c, $, requests } = craftGenerateHarness({ mode: 'tag', brief: '' });
  $('modeBrief').value = '';
  $('craftBench').classList.remove('hidden');
  $('craftIdea').value = '女医生回乡查出顶替真相';
  await c.startGenerate();
  const create = requests.find(r => r.url === '/api/generate/projects');
  const gen = requests.find(r => r.url === '/api/generate/episodes');
  assert.ok(create && gen, '独立递招应能直接立项并生成');
  assert.equal(create.data.mode, 'auto');
  assert.equal(create.data.brief, '女医生回乡查出顶替真相\n' + CRAFT_LINE);
  assert.equal(create.data.title, '女医生回乡查出顶替真相');
  assert.equal(create.data.tags, undefined, '不得伪装成隐藏标签创作');
  assert.equal(gen.data.brief, '女医生回乡查出顶替真相\n' + CRAFT_LINE);
});

test('v2.676 标签台递招结果原地回显，用户不必切到隐藏的递招面板', async () => {
  const { context: c, $ } = setup(['craftGo', 'renderCraftOpeningAudit', 'renderTagCraftEcho', 'findHook', 'saveCraftPick'], {
    lang: 'zh', tagChosen: ['医生', '悬疑'], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [{ id: 'anticommon_hook', name: '反常钩' }], cardGroups: [{ name: '组', cards: [{ id: 'c1', title: '先抑后扬' }] }] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    Api: { request: async () => ({ json: async () => ({ hooks: [{ id: 'anticommon_hook', name: '反常钩' }], cards: [{ id: 'c1', title: '先抑后扬' }], openingAudit: { used: ['anticommon_hook'], advice: '第二句再收紧。' } }) }) },
  });
  $('tagBench').classList.remove('hidden');
  $('tagIdea').value = '女医生回乡查出顶替真相';
  await c.craftGo();
  assert.equal($('tagCraftEcho').classList.contains('hidden'), false, '标签台必须原地展示递招结果');
  assert.match($('tagCraftEchoBody').innerHTML, /反常钩/, '钩子名要回显');
  assert.match($('tagCraftEchoBody').innerHTML, /先抑后扬/, '方法卡要回显');
  assert.match($('tagCraftEchoBody').innerHTML, /第二句再收紧。/, '开篇审计建议要回显');
});

test('v2.676 独立递招只在递招面板显示，不污染标签台回显', async () => {
  const { context: c, $ } = setup(['craftGo', 'renderCraftOpeningAudit', 'renderTagCraftEcho', 'findHook', 'saveCraftPick'], {
    lang: 'zh', tagChosen: [], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [], cardGroups: [] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    Api: { request: async () => ({ json: async () => ({ hooks: [{ id: 'anticommon_hook', name: '反常钩' }], cards: [{ id: 'c1', title: '先抑后扬' }] }) }) },
  });
  $('craftBench').classList.remove('hidden');
  $('craftIdea').value = '独立创意';
  await c.craftGo();
  assert.equal($('tagCraftEcho').classList.contains('hidden'), true, '独立递招不得在标签台留回显');
});

test('v2.676 标签或创意变化会立即作废旧递招回显，避免用旧手法出本', async () => {
  const { context: c, $ } = setup(['craftGo', 'renderCraftOpeningAudit', 'renderTagCraftEcho', 'findHook', 'saveCraftPick', 'addTag'], {
    lang: 'zh', tagChosen: ['医生'], TAG_MAX: 14, lastPool: [], craftSelHooks: [], craftSelCards: [], craftRecCards: [], _craftGoing: false,
    craftTaxonomy: { hooks: [], cardGroups: [] },
    loadCraftTaxonomy: async () => {}, renderCraftHooks() {}, renderCraftCards() {}, renderCraftPicked() {}, xnSay() {},
    renderTagChosen() {}, renderTagPool() {}, validateTagCombo() {},
    Api: { request: async () => ({ json: async () => ({ hooks: [{ id: 'anticommon_hook', name: '反常钩' }], cards: [] }) }) },
  });
  $('tagBench').classList.remove('hidden');
  $('tagIdea').value = '女医生回乡';
  await c.craftGo();
  assert.equal($('tagCraftEcho').classList.contains('hidden'), false);
  c.addTag('复仇');
  assert.equal($('tagCraftEcho').classList.contains('hidden'), false, '失效态要保持可见，否则重算按钮也没了');
  assert.equal($('tagCraftEcho').classList.contains('is-stale'), true, '失效态要有明确视觉区分');
  assert.match($('tagCraftEchoBody').innerHTML, /tagCraftEchoStale/, '失效态要提示重新递招');
  assert.doesNotMatch($('tagCraftEchoBody').innerHTML, /反常钩/, '旧手法内容不得残留');
});
