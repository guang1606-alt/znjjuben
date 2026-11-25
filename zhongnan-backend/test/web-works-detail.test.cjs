'use strict';
// v2.667 作品详情「可续写驾驶舱」契约：
// 1) 详情头部补项目概况（模式/集数/引擎/制式/平台/更新时间/归档态），点进详情不再丢上下文；
// 2) 详情页可就地重命名/归档恢复，回列表时列表不残留旧标题与旧状态；
// 3) 有成稿的项目也能「继续创作 · 第 N+1 集」，沿用项目模式与项目级参数，避免另起孤儿项目；
// 4) 续写不再限定 spark：任何模式都带着 draftProject 走 episodes 追加，手动切模式才放弃续写；
// 5) 每集可一键复制全文，方便编剧把单集内容带进别的工具。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ProgressView = require('../web/progress-view.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const source = read('web/app.js');
const html = read('web/index.html');
const css = read('web/styles.css');
const i18nSource = read('web/i18n.js');

const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

function setup(names, extra = {}) {
  const nodes = new Map();
  const timers = [];
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set(['hidden']);
      nodes.set(id, { id, value: '', checked: false, textContent: '', innerHTML: '', dataset: {}, style: {},
        classList: { add: (...xs) => xs.forEach((x) => classes.add(x)), remove: (...xs) => xs.forEach((x) => classes.delete(x)), contains: (x) => classes.has(x), toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); } },
        setAttribute() {}, appendChild() {}, focus() {}, remove() {}, scrollIntoView() {}, querySelector: () => null, querySelectorAll: () => [],
        addEventListener() {}, dispatchEvent() {} });
    }
    return nodes.get(id);
  };
  const says = [];
  const context = {
    $, lang: 'zh', console, AbortController, TextDecoder, Event, CustomEvent,
    PV: () => ProgressView,
    I18N: require('../web/i18n.js'),
    MODE_BRIEF: { auto: {}, tag: {}, spark: {}, novel: {}, adapt: {}, film: {} },
    SELECT_OPTS: { platform: { zh: [['douyin', '抖音']], en: [['douyin', 'Douyin']] } },
    ENGINE_TIERS: [
      { id: 'ECONOMY', zh: '经济', en: 'Economy', min: 'free' },
      { id: 'STANDARD', zh: '标准', en: 'Standard', min: 'basic' },
      { id: 'FLAGSHIP', zh: '旗舰', en: 'Flagship', min: 'advanced' },
    ],
    _RANK: { free: 0, basic: 1, advanced: 2, pro: 3, paid: 3 },
    meCache: null, isStaffAcct: () => false,
    capturePrivateSession: () => ({ owner: 'fixture', epoch: 0 }), isPrivateSessionCurrent: () => true,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { contains: () => true }, removeEventListener() {}, createElement: () => $('created') },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
    t: (key, vars) => `${key}${vars ? ':' + Object.values(vars).join(',') : ''}`,
    escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    toastError() {}, toastInfo() {}, xnSay: (m) => says.push(m),
    renderTaskQueue() {}, renderProgress() {}, resetPanels() {}, refreshListenBtn() {},
    loadMe() {}, loadWorks: extra.loadWorks || (() => {}), loadCatalog() {}, loadFeed() {},
    writeRoute() {}, VIEWS: ['studio', 'works'], _switchAnimToken: 0, _workbenchHideTimer: null, _workbenchPrevFocus: null, _navStack: null,
    _WORKBENCH_PANEL_IDS: ['sourceTextPanel', 'teardownPanel', 'interviewPanel', 'resultPanel'],
    currentWorksProject: null, currentWorksDiagnosis: null, currentScripts: [], currentProjectId: null,
    activeSessionId: null, genSessions: [],
    draftProject: null, selectedMode: 'spark', selectedTrack: 'material_rewrite', selectedScriptType: 'live_action_drama',
    worksListDirty: false, worksStatusFilter: 'all', worksBulkMode: false,
    worksStatusById: new Map(), worksSelectedIds: new Set(),
    _uiLangEn: () => false, currentView: () => 'works',
    switchView() {}, renderModes() {}, renderScriptTypes() {}, syncTagBench() {}, syncModeBrief() {},
    closeWorkbench() {}, applyScriptTypeFormat() {}, openWorkbench() {},
    runWorkAction: async (btn, busy, task) => task(),
    uiPrompt: async () => '', uiConfirm: async () => true,
    Api: extra.Api || { request: async () => ({}), jsonOrThrow: async () => [] },
    ...extra.sandbox,
  };
  vm.createContext(context);
  for (const name of ['_znEsc', 'znSkeletonHtml', 'znSkeleton', 'znEmptyHtml', 'znEmpty', 'clampEngineTier', 'acctRank', 'engineLabel', 'platformLabel', 'clearDraftProject', 'syncDraftProject', 'normalizeEpisodeCount']) {
    if (functions.has(name)) vm.runInContext(functions.get(name), context);
  }
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { context, $, says, flush: () => { while (timers.length) timers.shift()(); } };
}

test('静态契约：详情头骨架、概况容器、就地管理按钮与续写入口齐备', () => {
  assert.match(html, /class="works-detail-head"/);
  assert.match(html, /id="worksDetailMeta"[^>]*aria-live="polite"/);
  assert.match(html, /id="worksDetailContinue"/);
  assert.match(html, /id="worksDetailRename"/);
  assert.match(html, /id="worksDetailArchive"/);
  for (const name of ['nextEpisodeNo', 'projectContinuationMode', 'draftProjectMatchesMode', 'workModeLabel', 'worksDetailMetaHtml', 'renderWorksDetailHead', 'resumeProjectForContinuation']) {
    assert.ok(functions.has(name), `缺少函数声明 ${name}`);
  }
  const open = functions.get('openProject');
  assert.match(open, /renderWorksDetailHead\(p, detailNextEp\)/);
  assert.match(open, /data-copy-ep=/);
  assert.match(open, /worksDetailContinue/);
  assert.match(open, /worksDetailRename/);
  assert.match(open, /worksDetailArchive/);
  assert.match(open, /worksListDirty = true/);
  // 续写不再只在 spark 下生效
  const start = functions.get('startGenerate');
  assert.match(start, /const generationDraft = draftProject;/);
  assert.doesNotMatch(start, /selectedMode === 'spark' \? draftProject/);
  assert.match(start, /const useTagBench = !generationDraft &&/);
  // 手动切模式仍会放弃续写：守卫按「模式是否与项目一致」判定
  const sync = functions.get('syncModeBrief');
  assert.match(sync, /draftProjectMatchesMode\(draftProject, selectedMode\)/);
  assert.doesNotMatch(sync, /draftProject && selectedMode !== 'spark'/);
  // 回列表时若详情内改过标题/归档态，必须重载列表，避免残留旧数据
  const close = functions.get('closeWorksDetail');
  assert.match(close, /worksListDirty/);
  assert.match(close, /loadWorks\(\)/);
});

test('静态契约：新增文案中英双语且被消费，样式含详情头/概况片/复制按钮与降动效守卫', () => {
  for (const key of ['worksDetailContinue', 'worksDetailEps', 'worksDetailUpdated', 'worksDetailRename', 'worksDetailArchive', 'worksDetailRestore', 'worksDetailCopyEp', 'worksDetailCopied', 'worksDetailCopyFail', 'worksDetailMetaAria']) {
    const hits = i18nSource.match(new RegExp(`${key}\\s*:`, 'g')) || [];
    assert.equal(hits.length, 2, `${key} 必须在中英两份 DICT 中各出现一次`);
  }
  for (const cls of ['.works-detail-head', '.works-detail-meta', '.wd-chip', '.ep-copy-btn']) {
    assert.ok(css.includes(cls), `styles.css 缺少 ${cls}`);
  }
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.works-detail-head\s*\{\s*animation:\s*none/);
});

test('nextEpisodeNo：取现有最大集号 +1，空/非法输入回落第 1 集', () => {
  const { context: c } = setup(['nextEpisodeNo']);
  assert.equal(c.nextEpisodeNo([]), 1);
  assert.equal(c.nextEpisodeNo(null), 1);
  assert.equal(c.nextEpisodeNo([{ epNo: 1 }, { epNo: 3 }, { epNo: 2 }]), 4);
  assert.equal(c.nextEpisodeNo([{ epNo: '7' }, {}]), 8);
});

test('projectContinuationMode：历史改编族归 spark，普通模式原样续写', () => {
  const { context: c } = setup(['projectContinuationMode']);
  const bare = (o) => ({ mode: o.mode, track: o.track });
  assert.deepEqual(bare(c.projectContinuationMode({ mode: 'adapt' })), { mode: 'spark', track: 'material_rewrite' });
  assert.deepEqual(bare(c.projectContinuationMode({ mode: 'novel' })), { mode: 'spark', track: 'material_rewrite' });
  assert.deepEqual(bare(c.projectContinuationMode({ mode: 'hit_lab', track: 'signature_scene' })), { mode: 'spark', track: 'signature_scene' });
  assert.deepEqual(bare(c.projectContinuationMode({ mode: 'tag' })), { mode: 'tag', track: '' });
  assert.deepEqual(bare(c.projectContinuationMode({ mode: 'film' })), { mode: 'film', track: '' });
  // 未知/缺失模式回落灵感式，至少不把项目写坏
  assert.equal(c.projectContinuationMode({ mode: 'mature_x' }).mode, 'spark');
  assert.equal(c.projectContinuationMode({}).mode, 'spark');
});

test('draftProjectMatchesMode：只有模式与项目一致才保留续写草稿', () => {
  const { context: c } = setup(['projectContinuationMode', 'draftProjectMatchesMode']);
  assert.equal(c.draftProjectMatchesMode(null, 'tag'), true);
  assert.equal(c.draftProjectMatchesMode({ mode: 'tag' }, 'tag'), true);
  assert.equal(c.draftProjectMatchesMode({ mode: 'tag' }, 'hot'), false);
  assert.equal(c.draftProjectMatchesMode({ mode: 'adapt' }, 'spark'), true);
  assert.equal(c.draftProjectMatchesMode({ mode: 'novel' }, 'spark'), true);
  assert.equal(c.draftProjectMatchesMode({ mode: 'novel' }, 'tag'), false);
});

test('worksDetailMetaHtml：概况片覆盖模式/集数/引擎/制式/平台/更新时间/归档态，并对注入内容转义', () => {
  const { context: c } = setup(['workModeLabel', 'worksDetailMetaHtml']);
  const zhMode = c.I18N.DICT.zh.mode;
  const oldTag = zhMode.tag;
  zhMode.tag = '<b>标签</b>';
  let out;
  try {
    out = c.worksDetailMetaHtml({
      title: '项目A', mode: 'tag', totalEps: 12, engineTier: 'STANDARD', format: 'AIGC',
      platform: 'douyin', updatedAt: '2026-11-22T10:00:00.000Z', status: 'archived',
    });
  } finally { zhMode.tag = oldTag; }
  assert.ok(out.includes('&lt;b&gt;标签&lt;/b&gt;'), '模式文案必须转义');
  assert.match(out, /worksDetailEps:12/);
  assert.ok(out.includes('标准'));
  assert.ok(out.includes('Z-AIGC'));
  assert.ok(out.includes('抖音'));
  assert.match(out, /worksDetailUpdated:2026/);
  assert.match(out, /wd-chip--archived/);
  assert.ok(out.includes('worksArchivedBadge'));
  // 无更新时间时不出时间片，避免「更新于 undefined」
  const bare = c.worksDetailMetaHtml({ mode: 'tag', totalEps: 1, format: 'LIVE_ACTION' });
  assert.doesNotMatch(bare, /worksDetailUpdated/);
});

test('resumeProjectForContinuation：写着第 N 集方向，锁定项目级参数并回填原文/平台', () => {
  const project = {
    id: 'p-tag', title: '标签项目', mode: 'tag', totalEps: 20, engineTier: 'STANDARD', format: 'AIGC',
    bible: { sourceText: '这是一个足够长的原文片段用于回填校验。', platform: 'douyin', scenesPerEp: 18, scriptType: 'live_action_drama' },
  };
  const { context: c, $, says } = setup(['projectContinuationMode', 'resumeProjectForContinuation']);
  c.selectedMode = 'hot';
  c.resumeProjectForContinuation(project, 4);
  assert.equal(c.draftProject.id, 'p-tag');
  assert.equal(c.draftProject._nextEp, 4);
  assert.equal(c.selectedMode, 'tag');
  assert.equal($('modeBrief').value, '', '续写新一集时简报留空，让用户写这一集方向');
  assert.equal($('episodes').value, '20');
  assert.equal($('episodes').disabled, true, '项目级参数在续写时必须锁定');
  assert.equal($('sourceText').value, project.bible.sourceText);
  assert.equal($('platform').value, 'douyin');
  assert.equal($('scenesPerEp').value, '18');
  assert.equal($('scriptFormatSel').value, 'AIGC');
  assert.ok(says.some((m) => m.includes('4')), '提示必须点明本次生成第 4 集');
});

test('resumeProjectForContinuation：空项目续写第 1 集时沿用保存的改编简报', () => {
  const project = {
    id: 'p-novel', title: '小说项目', mode: 'novel', totalEps: 12,
    bible: { sourceText: '小说原文足够长的一段文本内容。', adaptationDraft: { brief: '保留名场面，强钩子' } },
  };
  const { context: c, $ } = setup(['projectContinuationMode', 'resumeProjectForContinuation']);
  c.resumeProjectForContinuation(project, 1);
  assert.equal(c.selectedMode, 'spark');
  assert.equal(c.selectedTrack, 'material_rewrite');
  assert.equal($('modeBrief').value, '保留名场面，强钩子');
  assert.equal($('episodes').value, '12');
});

test('openProject：有成稿时显示「继续创作 · 第 N+1 集」，归档项目隐藏续写并标注归档态', async () => {
  const eps = [
    { epNo: 1, version: 1, title: '一', content: '第一集正文', wordCount: 5 },
    { epNo: 2, version: 1, title: '二', content: '第二集正文', wordCount: 5 },
  ];
  const { context: c, $ } = setup(['openProject', 'renderWorksDetailHead', 'worksDetailMetaHtml', 'workModeLabel', 'nextEpisodeNo', 'projectContinuationMode'], {
    Api: { request: async () => ({}), jsonOrThrow: async () => eps },
  });
  const project = { id: 'p1', title: '有成稿', mode: 'tag', totalEps: 20, engineTier: 'STANDARD', format: 'AIGC', platform: 'douyin', status: 'active', updatedAt: '2026-11-22T10:00:00.000Z' };
  await c.openProject(project);
  assert.equal($('worksDetailContinue').classList.contains('hidden'), false);
  assert.match($('worksDetailContinue').textContent, /worksDetailContinue:3/);
  assert.match($('worksDetailMeta').innerHTML, /worksDetailEps:20/);
  assert.equal(typeof $('worksDetailContinue').onclick, 'function');
  assert.equal(typeof $('worksDetailRename').onclick, 'function');
  assert.equal(typeof $('worksDetailArchive').onclick, 'function');

  const archived = { ...project, id: 'p2', status: 'archived' };
  await c.openProject(archived);
  assert.equal($('worksDetailContinue').classList.contains('hidden'), true, '归档项目只读，不给续写入口');
  assert.match($('worksDetailMeta').innerHTML, /wd-chip--archived/);
  assert.equal($('worksDetailArchive').textContent, 'worksDetailRestore');
});

test('v2.695 openProject：列表入口 reveal 时滚到详情头，普通重渲染不抢滚动', async () => {
  const eps = [{ epNo: 1, version: 1, title: '一', content: '第一集正文', wordCount: 5 }];
  const scrolls = [];
  const { context: c, $ } = setup(['openProject', 'renderWorksDetailHead', 'worksDetailMetaHtml', 'workModeLabel', 'nextEpisodeNo', 'projectContinuationMode'], {
    Api: { request: async () => ({}), jsonOrThrow: async () => eps },
  });
  $('worksDetail').scrollIntoView = (arg) => { scrolls.push(arg); };
  const project = { id: 'p1', title: '有成稿', mode: 'tag', totalEps: 1, engineTier: 'STANDARD', format: 'LIVE_ACTION', status: 'active' };
  await c.openProject(project, { reveal: true });
  assert.equal(scrolls.length, 1, '列表入口打开必须滚动一次');
  assert.equal(scrolls[0].block, 'start');
  await c.openProject(project);
  assert.equal(scrolls.length, 1, '刷新/重写后的重渲染不得再次滚动抢位');
});

test('closeWorksDetail：详情里改过标题/归档态时回列表自动重载，否则只滚回网格', () => {
  let loads = 0;
  const { context: c, $ } = setup(['closeWorksDetail'], { loadWorks: () => { loads++; } });
  c.worksListDirty = true;
  c.closeWorksDetail();
  assert.equal(loads, 1);
  assert.equal(c.worksListDirty, false);
  c.closeWorksDetail();
  assert.equal(loads, 1, '干净状态不重复拉列表');
  assert.equal($('worksDetail').classList.contains('hidden'), true);
});
