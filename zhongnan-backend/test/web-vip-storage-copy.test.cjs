/**
 * v2.689 会员页与作品页文案/排版走查修复
 *  ① 会员单价权益：旧 `${t('perEp')} 1.2` 渲染成「单集低至 1.2」/「from /ep 1.2」
 *     ——缺货币符号与「/集」「/ep」后缀，英文语序也错。改为纯函数 formatPerEpPerk 统一拼。
 *  ② 年卡节省比例：旧 `${lang==='en'?'save':'省'}${savePct}%` → 英文「save16%」缺空格。
 *  ③ 存储用量 fmtBytes：10 GB 配额显示「10240.0 MB」，多余 .0 且不转 GB，390 下断两行。
 *  ④ 一键修正按钮隐藏时仍写 textContent → DOM 里残留「Write null free ep first」。
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

function load(names) {
  const context = { console, lang: 'zh' };
  vm.createContext(context);
  for (const n of names) if (functions.has(n)) vm.runInContext(functions.get(n), context);
  return context;
}

test('v2.689 formatPerEpPerk：中英带货币与后缀，英文语序正确', () => {
  const c = load(['formatPerEpPerk', '_fmtYuanFromPoints']);
  // FREE 经济档 12 积分 = ¥1.2
  assert.equal(c.formatPerEpPerk(12, false), '单集低至 ¥1.2/集');
  assert.equal(c.formatPerEpPerk(12, true), 'from ¥1.2/ep');
  // BASIC 经济档 10 积分 = ¥1 → 不带多余 .0
  assert.equal(c.formatPerEpPerk(10, false), '单集低至 ¥1/集');
  assert.equal(c.formatPerEpPerk(10, true), 'from ¥1/ep');
  // 不再出现裸数字 / 错位的 from /ep
  assert.doesNotMatch(c.formatPerEpPerk(12, true), /from \/ep/);
});

test('v2.689 formatYearSave：英文 save 与数字之间有空格，中文紧贴', () => {
  const c = load(['formatYearSave']);
  assert.equal(c.formatYearSave(16, true), 'save 16%');
  assert.equal(c.formatYearSave(16, false), '省16%');
  assert.equal(c.formatYearSave(20, true), 'save 20%');
});

test('v2.689 fmtBytes：整数不带 .0，≥1024MB 转 GB', () => {
  const c = load(['fmtBytes']);
  assert.equal(c.fmtBytes(0), '0 MB');
  // 1 MB 整 → 不带 .0
  assert.equal(c.fmtBytes(1024 * 1024), '1 MB');
  // 1.5 MB
  assert.equal(c.fmtBytes(Math.round(1.5 * 1024 * 1024)), '1.5 MB');
  // 10 GB 配额 → 转 GB，不显示 10240.0 MB
  assert.equal(c.fmtBytes(10 * 1024 * 1024 * 1024), '10 GB');
  // 不足 1 MB → KB
  assert.equal(c.fmtBytes(500 * 1024), '500 KB');
});

// v2.689 一键修正按钮隐藏时不得残留「Write null free ep first」
function setupCostSync(extra = {}) {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      id, value: '', textContent: 'OLD', dataset: {}, style: {},
      classList: { add() {}, remove() {}, contains: () => false, toggle(v, f) { /* 记录最近一次结果 */ this._last = f; return f; } },
      setAttribute() {}, removeAttribute() {},
    });
    return nodes.get(id);
  };
  const context = {
    $, lang: 'en', console,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    Api: { getUser: () => ({ id: 'u1', level: 'PRO' }), isAuthed: () => true },
    meCache: null, _plansCache: [{ level: 'PRO', freeEpsPerDay: 0, epPrice: { ECONOMY: 5 } }],
    ...extra,
  };
  vm.createContext(context);
  for (const n of ['tierZh', 'tierEn', 'myPlan', 'normalizeEpisodeCount', 'episodeCostShort', 'episodeCostHint',
    'isFreeQuotaBlocked', '_costParams', 'syncEpisodeCostHint']) {
    if (functions.has(n)) vm.runInContext(functions.get(n), context);
  }
  return { context, nodes };
}

test('v2.689 genCostFix 隐藏态不渲染 null 文案', () => {
  const { context } = setupCostSync();
  // 先造出按钮节点，再预置一段脏文案，模拟上一次渲染残留
  const fix = context.$('genCostFix');
  fix.textContent = 'Write null free ep first';
  context.syncEpisodeCostHint();
  // 隐藏时不得残留旧文案，更不得出现 null
  assert.equal(fix.textContent, '');
  assert.doesNotMatch(String(fix.textContent), /null/);
});
