'use strict';
// v2.692 投稿渠道推荐的两处不自洽：
// 1) 渠道库对科幻/机甲等冷门题材可能一个标签都命中不了，后端仍按综合分返回 Top N。
//    此前卡片与精准命中完全同款，用户会误以为这些平台与自己的题材高度契合 —— 现如实标「综合参考」并弱化。
// 2) 未选标签（创意/围读模式出本）时整个面板被静默隐藏，用户永远看不到「最后一公里」的渠道推荐 ——
//    现改为请求综合推荐，并在提示里说明「未选择题材标签」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const appSource = read('web/app.js');
const appAst = ts.createSourceFile('app.js', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let renderSubmissionSource = '';
let loadSubmissionMatchSource = '';
(function findFns(node) {
  if (ts.isFunctionDeclaration(node)) {
    if (node.name?.text === 'renderSubmission') renderSubmissionSource = node.getText(appAst);
    if (node.name?.text === 'loadSubmissionMatch') loadSubmissionMatchSource = node.getText(appAst);
  }
  ts.forEachChild(node, findFns);
})(appAst);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function makeCtx(matches = []) {
  const nodes = new Map();
  const urls = [];
  const makeNode = () => {
    const set = new Set();
    const attrs = new Map();
    return {
      innerHTML: '',
      textContent: '',
      attrs,
      setAttribute: (k, v) => attrs.set(k, v),
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
    escapeHtml: esc,
    znEmptyHtml: (m) => `<div class="empty">${m}</div>`,
    t: (k) => k,
    $: get,
    subMatchSeq: 0,
    Api: {
      request: async (u) => { urls.push(u); return {}; },
      jsonOrThrow: async () => ({ matches }),
    },
  };
  vm.createContext(ctx);
  assert.ok(renderSubmissionSource, '必须能抽取到真实 renderSubmission 实现');
  assert.ok(loadSubmissionMatchSource, '必须能抽取到真实 loadSubmissionMatch 实现');
  vm.runInContext(renderSubmissionSource, ctx);
  vm.runInContext(loadSubmissionMatchSource, ctx);
  return { ctx, nodes, urls };
}

test('renderSubmission：零命中渠道标「综合参考」并弱化，不再冒充精准匹配', () => {
  const { ctx, nodes } = makeCtx();
  ctx.renderSubmission([
    { name: '红果短剧', region: 'domestic', kinds: ['分账投稿'], matched: [], verified: false },
    { name: 'ReelShort', region: 'overseas', kinds: ['分账投稿'], matched: [], verified: false, highlight: 'x' },
  ]);
  const html = nodes.get('submissionList').innerHTML;
  assert.match(html, /sub-card--fallback/, '零命中卡片应带兜底弱化类');
  assert.match(html, /综合参考/, '零命中卡片应显示「综合参考」标签');
  assert.match(nodes.get('submissionNotice').textContent, /暂未命中/, '全部兜底时提示应说明标签未命中');
});

test('renderSubmission：有精准命中时不弱化，提示保持核验提醒', () => {
  const { ctx, nodes } = makeCtx();
  ctx.renderSubmission([
    { name: '红果短剧', region: 'domestic', kinds: ['分账投稿'], matched: ['情感'], verified: true },
    { name: '点众科技', region: 'domestic', kinds: ['分账投稿'], matched: [], verified: false },
  ]);
  const html = nodes.get('submissionList').innerHTML;
  assert.equal((html.match(/sub-card--fallback/g) || []).length, 1, '只有零命中那张卡弱化');
  assert.match(nodes.get('submissionNotice').textContent, /待核验/);
});

test('renderSubmission：未选标签的兜底提示明确说明来源', () => {
  const { ctx, nodes } = makeCtx();
  ctx.renderSubmission([{ name: '红果短剧', region: 'domestic', kinds: [], matched: [], verified: false }], { noTags: true });
  assert.match(nodes.get('submissionNotice').textContent, /未选择题材标签/);
});

test('renderSubmission：空结果给空态而不是残留旧卡片', () => {
  const { ctx, nodes } = makeCtx();
  nodes.set('submissionList', { innerHTML: 'old', textContent: '', classList: { add() {}, remove() {}, contains: () => false } });
  ctx.renderSubmission([]);
  assert.match(nodes.get('submissionList').innerHTML, /暂无匹配渠道/);
  assert.equal(nodes.get('submissionNotice').textContent, '', '空结果不应再挂「待核验」提示');
});

test('loadSubmissionMatch：未选标签不再静默隐藏，改走综合推荐', async () => {
  const { ctx, nodes, urls } = makeCtx([
    { name: '红果短剧', region: 'domestic', kinds: [], matched: [], verified: false },
  ]);
  await ctx.loadSubmissionMatch([]);
  assert.ok(urls[0], '应发出请求');
  assert.ok(!/tags=/.test(urls[0]), '未选标签时请求不应带空 tags 参数');
  assert.ok(nodes.get('submissionPanel') && !nodes.get('submissionPanel').classList.contains('hidden'), '面板必须展示');
  assert.match(nodes.get('submissionNotice').textContent, /未选择题材标签/);
});

test('loadSubmissionMatch：有标签时仍按标签匹配', async () => {
  const { ctx, urls } = makeCtx([{ name: '红果短剧', region: 'domestic', kinds: [], matched: ['情感'], verified: false }]);
  await ctx.loadSubmissionMatch(['情感', '逆袭']);
  assert.match(urls[0], /tags=/);
  assert.match(urls[0], /count=6/);
});

test('面板副标题随来源切换：未选标签改用 subFreeGeneral，选标签后复原 subFree', async () => {
  const { ctx, nodes } = makeCtx([{ name: '红果短剧', region: 'domestic', kinds: [], matched: [], verified: false }]);
  await ctx.loadSubmissionMatch([]);
  assert.equal(nodes.get('submissionSub').getAttribute('data-i'), 'subFreeGeneral', '未选标签时副标题键应切换');
  ctx.renderSubmission([{ name: '红果短剧', region: 'domestic', kinds: [], matched: ['情感'], verified: false }], { noTags: false });
  assert.equal(nodes.get('submissionSub').getAttribute('data-i'), 'subFree', '选标签后应复原');
});

// v2.692 集数单位：作品卡此前写死 `${n} eps`，中文界面冒出英文单位，英文下 1 集显示 "1 eps"。
let epCountInit = '';
(function findEpCount(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'epCount') {
    epCountInit = node.getText(appAst);
  }
  ts.forEachChild(node, findEpCount);
})(appAst);

test('epCount：中文补「集」，英文按单复数，缺省不出现 undefined', () => {
  assert.ok(epCountInit, '必须能抽取到 epCount 实现');
  const { ctx } = makeCtx();
  vm.runInContext(epCountInit, ctx);
  ctx.lang = 'zh';
  assert.equal(ctx.epCount(1), '1 集');
  assert.equal(ctx.epCount(12), '12 集');
  assert.equal(ctx.epCount(undefined), '0 集');
  ctx.lang = 'en';
  assert.equal(ctx.epCount(1), '1 ep');
  assert.equal(ctx.epCount(2), '2 eps');
  assert.equal(ctx.epCount(undefined), '0 eps');
});

test('作品卡与剧本下拉不再写死 "N eps"', () => {
  assert.ok(!/\$\{p\.totalEps \|\| 0\} eps/.test(appSource), '不得再出现 `${p.totalEps || 0} eps`');
  const uses = (appSource.match(/epCount\(p\.totalEps\)/g) || []).length;
  assert.ok(uses >= 3, `作品卡/下拉/对局选择器都应走 epCount，实际 ${uses} 处`);
});

test('切语言后作品库可见时按新语言重拉，隐藏时不发请求', () => {
  assert.ok(
    appSource.includes("if (!$('view-works').classList.contains('hidden') && window.Api && Api.isAuthed()) {"),
    'renderStaticText 必须先判作品库可见再刷新',
  );
  const block = appSource.slice(appSource.indexOf("if (!$('view-works').classList.contains('hidden') && window.Api"));
  assert.match(block.slice(0, 300), /loadWorks\(\)\.catch/, '可见时应重拉作品列表');
});

// v2.692 CSS：兜底卡片弱化 + 窄屏触控目标。作品页筛选片 29px / 操作片 25px 实测低于 30px。
const css = read('web/styles.css');
const ruleBody = (selector) => {
  const escSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(escSel + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
};

test('CSS：兜底渠道卡片用虚线描边与次级底纹，与精准命中区分', () => {
  const body = ruleBody('.sub-card--fallback');
  assert.ok(body, '缺少 .sub-card--fallback 规则');
  assert.match(body, /border-style:\s*dashed/);
  assert.match(css, /\.sub-fallback-chip\s*\{/);
});

test('CSS：640px 内作品筛选片与操作片抬到 ≥32px 触控高度', () => {
  for (const sel of ['.works-filter-btn', '.work-action-btn']) {
    const at = css.indexOf(sel + ' { min-height');
    assert.ok(at > 0, `${sel} 缺少窄屏 min-height 规则`);
    const mediaAt = css.lastIndexOf('@media (max-width: 640px)', at);
    assert.ok(mediaAt > 0 && mediaAt < at, `${sel} 的触控高度必须限定在 640px 媒体查询内`);
    const body = css.slice(at, css.indexOf('}', at));
    const m = body.match(/min-height:\s*(\d+)px/);
    assert.ok(m && Number(m[1]) >= 32, `${sel} 触控高度应 ≥32px，实际：${m && m[1]}`);
  }
});
