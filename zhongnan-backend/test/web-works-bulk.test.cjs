/**
 * v2.665 作品库批量管理
 * 背景（dogfood 复盘）：作品库只有逐卡「重命名/克隆/归档/删除」，做一批清理要点开 N 次弹窗；
 * 且归档与创作中的项目混在同一列表里，没有任何状态筛选；搜索无结果时还显示「还没有作品」——
 * 用户以为作品被删了。本版补齐：状态筛选（全部/创作中/已归档）、批量选择与批量归档/恢复/删除、
 * 选择随搜索与筛选自动清理（防「幽灵选中」批量误删）、搜索无结果与空库文案分流。
 * 批量操作复用既有单条接口（DELETE / archive），逐条执行并汇报成功/失败，不引入新后端契约。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const I18N = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');

const ast = ts.createSourceFile('app.js', APP, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

const ZH = {
  worksEmpty: '还没有作品，去创作专区生成第一个剧本吧',
  worksEmptyArchived: '还没有归档作品',
  worksSearchEmpty: '没有匹配「{q}」的作品',
  worksBulkCount: '已选 {n} 项',
  worksBulkHint: '点击作品卡片选择要处理的项',
  worksBulkArchive: '归档',
  worksBulkRestore: '恢复',
  worksBulkDelete: '删除',
  worksBulkSelectAll: '全选',
  worksBulkSelectNone: '取消全选',
  worksBulkAria: '批量操作，已选 {n} 项',
};

function makeNode() {
  return {
    values: {}, textContent: '', hidden: false,
    classList: {
      _s: new Set(),
      add(...xs) { xs.forEach((x) => this._s.add(x)); },
      remove(...xs) { xs.forEach((x) => this._s.delete(x)); },
      contains(x) { return this._s.has(x); },
      toggle(x, on) { if (on === undefined ? !this._s.has(x) : on) this._s.add(x); else this._s.delete(x); },
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    addEventListener() {},
  };
}

function setup(extra = {}) {
  const nodes = new Map();
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); };
  const ctx = {
    $, console,
    document: {
      getElementById: $,
      querySelectorAll: () => [],
      documentElement: { setAttribute() {}, style: { setProperty() {} } },
    },
    t: (k, vars) => {
      let s = ZH[k] || k;
      if (vars) Object.entries(vars).forEach(([a, b]) => { s = s.split('{' + a + '}').join(String(b)); });
      return s;
    },
    lang: 'zh',
    worksSelected: new Set(),
    worksStatusById: new Map(),
    worksStatusFilter: '',
    worksBulkMode: false,
    ...extra,
  };
  vm.createContext(ctx);
  for (const name of ['worksListUrl', 'toggleWorksSelected', 'clearWorksSelection', 'pruneWorksSelection',
    'worksBulkActionKind', 'worksEmptyCopy', 'paintWorkCard', 'selectAllVisibleWorks', 'syncWorksBulkBar']) {
    if (functions.has(name)) vm.runInContext(functions.get(name), ctx);
  }
  return { c: ctx, $ };
}

test('v2.665 列表 URL 统一构造：搜索词 / 状态筛选 / 游标都走同一入口', () => {
  const { c } = setup();
  assert.equal(c.worksListUrl('', '', ''), '/api/generate/projects?limit=50', '无参时只带分页上限');
  const searched = new URL('http://x' + c.worksListUrl('旧梦 & 归途', '', ''));
  assert.equal(searched.searchParams.get('q'), '旧梦 & 归途', '搜索词须正确编码');
  const filtered = new URL('http://x' + c.worksListUrl('', 'archived', ''));
  assert.equal(filtered.searchParams.get('status'), 'archived', '状态筛选须透传给后端');
  const paged = new URL('http://x' + c.worksListUrl('关键词', 'active', 'abc/def=='));
  assert.equal(paged.searchParams.get('q'), '关键词');
  assert.equal(paged.searchParams.get('status'), 'active');
  assert.equal(paged.searchParams.get('cursor'), 'abc/def==', '游标须原样保留并编码');
});

test('v2.665 勾选/取消勾选单项，空 id 不进入选择集', () => {
  const { c } = setup();
  assert.equal(c.toggleWorksSelected('p1'), true, '首次勾选应返回 true');
  assert.equal(c.worksSelected.has('p1'), true);
  assert.equal(c.toggleWorksSelected('p1'), false, '再点应取消并返回 false');
  assert.equal(c.worksSelected.has('p1'), false);
  assert.equal(c.toggleWorksSelected(''), false, '空 id 不得进入选择集');
  assert.equal(c.worksSelected.size, 0);
});

test('v2.665 清理选择：只保留当前列表里仍存在的项目（防幽灵选中批量误删）', () => {
  const { c } = setup();
  ['a', 'b', 'c'].forEach((id) => c.worksSelected.add(id));
  const dropped = c.pruneWorksSelection(['a', 'c', 'd']);
  assert.equal(dropped, 1, 'b 已不在当前列表，应被清理');
  assert.deepEqual([...c.worksSelected].sort(), ['a', 'c']);
  assert.equal(c.pruneWorksSelection(['a']), 1);
  assert.deepEqual([...c.worksSelected], ['a']);
});

test('v2.665 批量归档/恢复意图：全为已归档→恢复，否则→归档，空选择默认归档', () => {
  const { c } = setup();
  assert.equal(c.worksBulkActionKind(), 'archive', '空选择默认归档（按钮不出现，仅是安全默认）');
  c.worksSelected.add('a'); c.worksStatusById.set('a', 'archived');
  c.worksSelected.add('b'); c.worksStatusById.set('b', 'archived');
  assert.equal(c.worksBulkActionKind(), 'restore', '选中的全是已归档 → 恢复');
  c.worksStatusById.set('b', 'active');
  assert.equal(c.worksBulkActionKind(), 'archive', '混入创作中 → 归档');
});

test('v2.665 空态文案分流：搜索无结果 ≠ 作品库为空 ≠ 归档为空', () => {
  const { c } = setup();
  assert.match(c.worksEmptyCopy(''), /还没有作品/, '空库文案保持不变');
  c.worksStatusFilter = 'archived';
  assert.match(c.worksEmptyCopy(''), /还没有归档作品/, '归档筛选下应说「还没有归档作品」');
  c.worksStatusFilter = '';
  const searched = c.worksEmptyCopy('  旧梦  ');
  assert.match(searched, /没有匹配「旧梦」的作品/, '搜索无结果须回显关键词并去空格');
});

function makeCard(id) {
  const cls = new Set();
  return {
    dataset: { pid: id }, attrs: {},
    classList: {
      toggle(c, on) { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); },
      contains(c) { return cls.has(c); },
      add(c) { cls.add(c); }, remove(c) { cls.delete(c); },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector: () => null,
  };
}

test('v2.665 全选可见卡片，再点一次取消全选', () => {
  const cards = [makeCard('a'), makeCard('b')];
  const { c } = setup({
    document: { getElementById: () => makeNode(), querySelectorAll: () => cards, documentElement: { setAttribute() {}, style: { setProperty() {} } } },
  });
  c.worksBulkMode = true;
  assert.equal(c.selectAllVisibleWorks(), 2, '应返回本次影响的可见卡片数');
  assert.deepEqual([...c.worksSelected].sort(), ['a', 'b']);
  cards.forEach((card) => assert.equal(card.classList.contains('is-selected'), true, '卡片须立即呈现选中态'));
  assert.equal(c.selectAllVisibleWorks(), 2);
  assert.equal(c.worksSelected.size, 0, '全员已选中时再点全选 = 取消全选');
  cards.forEach((card) => assert.equal(card.classList.contains('is-selected'), false));
});

test('v2.665 单卡选中态绘制：选中加 is-selected，取消即撤下', () => {
  const { c } = setup();
  const card = makeCard('x');
  c.worksSelected.add('x');
  c.paintWorkCard(card, 'x');
  assert.equal(card.classList.contains('is-selected'), true);
  assert.equal(card.attrs['aria-selected'], 'true', '读屏可感知选中态');
  c.worksSelected.delete('x');
  c.paintWorkCard(card, 'x');
  assert.equal(card.classList.contains('is-selected'), false);
  assert.equal(card.attrs['aria-selected'], 'false');
});

test('v2.665 静态契约：状态筛选、批量栏、批量执行接线与选择清理', () => {
  // 页面骨架
  assert.match(HTML, /id="worksFilter"[\s\S]{0,400}data-status=""[\s\S]{0,200}data-status="active"[\s\S]{0,200}data-status="archived"/,
    '必须有 全部/创作中/已归档 三档筛选');
  assert.match(HTML, /id="worksBulkBtn"/, '缺批量管理入口');
  assert.match(HTML, /id="worksBulkBar"[\s\S]{0,200}role="region"/, '批量操作栏须为可感知区域');
  assert.match(HTML, /id="worksBulkCount"[^>]*role="status"[^>]*aria-live="polite"/, '已选数量变化须被读屏播报');
  for (const id of ['worksBulkAll', 'worksBulkArchive', 'worksBulkDelete', 'worksBulkExit']) {
    assert.ok(HTML.includes(`id="${id}"`), '批量栏缺 ' + id);
  }

  // 列表取数：筛选与搜索同入口；进列表先清选择
  assert.match(APP, /function worksListUrl\(/, '缺统一的列表 URL 构造函数');
  const loadWin = APP.slice(APP.indexOf('async function loadWorks() {'), APP.indexOf('async function loadMoreWorks('));
  assert.match(loadWin, /clearWorksSelection\(\)/, '重新拉取列表（换搜索/筛选）须先清空选择，防止选中不可见项目');
  assert.match(loadWin, /worksListUrl\(q, worksStatusFilter, ''\)/, 'loadWorks 须带状态筛选');
  assert.match(loadWin, /pruneWorksSelection\(/, '列表落地后须按当前可见 id 收敛选择集');
  const moreWin = APP.slice(APP.indexOf('async function loadMoreWorks('), APP.indexOf('// c202 版本逐行对比'));
  assert.match(moreWin, /worksListUrl\(q, worksStatusFilter, myProjectsCursor\)/, '加载更多须沿用当前筛选，不能混入其它状态');

  // 卡片：勾选圆点 + 归档徽章 + 批量态点击切换而非打开
  assert.match(APP, /class="work-pick"[^`]*aria-pressed=/, '卡片须有可访问的勾选圆点');
  assert.match(APP, /c\.dataset\.pid\s*=\s*p\.id/, '卡片须带 data-pid 供全选/选择集对齐');
  assert.match(APP, /worksArchivedBadge/, '归档项目须有可见徽章，而不是只能从按钮文字猜');
  assert.match(APP, /if \(worksBulkMode\)/, '批量态下点卡片应是选择，不得直接打开项目');

  // 批量执行：二次确认 → 逐条执行 → 进度 → 汇总 → 刷新
  const bulkWin = APP.slice(APP.indexOf('async function runWorksBulk('), APP.indexOf('async function runWorksBulk(') + 3500);
  assert.match(bulkWin, /worksBulkDeleteConfirm/, '批量删除必须先确认数量');
  assert.match(bulkWin, /worksBulkRunning/, '逐条执行须显示进度');
  assert.match(bulkWin, /for \(let i = 0; i < ids\.length; i\+\+\)/, '须逐条执行（单条失败不影响其余）');
  assert.match(bulkWin, /catch \{ fail\+\+; \}/, '单条失败须计入失败数而不是整体中断');
  assert.match(bulkWin, /loadWorks\(\)/, '批量完成后须刷新列表与计数');

  // 文案双语
  for (const key of ['worksBulk', 'worksBulkCount', 'worksBulkArchive', 'worksBulkRestore', 'worksBulkDelete',
    'worksBulkRunning', 'worksBulkDeleteConfirm', 'worksBulkPartial', 'worksFilterAll', 'worksFilterActive',
    'worksFilterArchived', 'worksSearchEmpty', 'worksSearchEmptyHint', 'worksEmptyArchived', 'worksArchivedBadge']) {
    const hits = I18N.match(new RegExp('\\b' + key + ':', 'g')) || [];
    assert.ok(hits.length >= 2, `${key} 须同时有中英两份文案，实际 ${hits.length}`);
  }

  // 视觉与动效
  assert.match(CSS, /\.works-bulkbar\{/, '缺批量操作栏样式');
  assert.match(CSS, /\.work-card\.is-selected/, '缺卡片选中态样式');
  assert.match(CSS, /\.works-grid--bulk \.work-actions\{display:none\}/, '批量态下须隐藏逐卡操作，避免误触');
  assert.match(CSS, /@keyframes zn-pick-pop/, '勾选圆点需有弹入动效');
  assert.match(CSS, /prefers-reduced-motion[^}]*}[^@]*works-bulkbar|works-bulkbar[\s\S]{0,200}prefers-reduced-motion|prefers-reduced-motion[\s\S]{0,300}work-pick/,
    '须尊重减弱动效偏好');
});
