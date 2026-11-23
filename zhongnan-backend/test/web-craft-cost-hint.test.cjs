/**
 * v2.663 创作端「生成前预计扣费」
 * 缺口：二级界面 #modeDetailCost 读 mode.cost（模式表无此字段）→ 永远空白；
 * 用户在点「生成剧本」前看不到预计扣费，只能等 SSE 冻结阶段第一次见到数字。
 * 契约：单集价来自 /api/order/catalog 的 epPrice（由 EP_PRICE 派生），前端只拼文案、不抄价格。
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

function setup(names, extra = {}) {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set(['hidden']);
      nodes.set(id, {
        id, value: '', textContent: '', innerHTML: '', dataset: {}, style: {},
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        setAttribute() {}, remove() {},
      });
    }
    return nodes.get(id);
  };
  const context = { $, lang: 'zh', console, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    Api: { getUser: () => null, isAuthed: () => false }, meCache: null, _modeDetailOpen: true,
    ...extra };
  vm.createContext(context);
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { context, $ };
}

const FREE = { level: 'FREE', freeEpsPerDay: 2, epPrice: { ECONOMY: 12 } };
const ADV = { level: 'ADVANCED', freeEpsPerDay: 0, epPrice: { ECONOMY: 8, STANDARD: 12, FLAGSHIP: 28 } };
const PRO = { level: 'PRO', freeEpsPerDay: 0, epPrice: { ECONOMY: 5, STANDARD: 9, FLAGSHIP: 24 } };

test('v2.663 免费档：提示每日免费集 + 超出单价 + 本单总额', () => {
  const { context: c } = setup(['episodeCostHint', 'tierZh', 'tierEn']);
  const s = c.episodeCostHint({ episodes: 20, tier: 'ECONOMY', plan: FREE, authed: true, quotaRemain: 0, en: false });
  assert.match(s, /每日前 2 集免积分/);
  assert.match(s, /12 积分\/集/);
  assert.match(s, /约 240 积分/);
});

test('v2.663 付费档有赠送集：优先说明抵扣，再给超出单价', () => {
  const { context: c } = setup(['episodeCostHint', 'tierZh', 'tierEn']);
  const s = c.episodeCostHint({ episodes: 20, tier: 'ECONOMY', plan: ADV, authed: true, quotaRemain: 300, en: false });
  assert.match(s, /优先抵扣本月赠送集（剩 300 集）/);
  assert.match(s, /超出按 8 积分\/集/);
});

test('v2.663 标准/旗舰档按所选引擎计价，总额=单价×集数', () => {
  const { context: c } = setup(['episodeCostHint', 'tierZh', 'tierEn']);
  const zh = c.episodeCostHint({ episodes: 20, tier: 'STANDARD', plan: PRO, authed: true, quotaRemain: 0, en: false });
  assert.match(zh, /标准引擎 9 积分\/集 × 20 集 ≈ 180 积分/);
  const en = c.episodeCostHint({ episodes: 20, tier: 'FLAGSHIP', plan: PRO, authed: true, quotaRemain: 0, en: true });
  assert.match(en, /Flagship engine 24 pts\/ep × 20 eps ≈ 480 pts/);
});

test('v2.663 未登录/目录未到：给诚实兜底，不编价格', () => {
  const { context: c } = setup(['episodeCostHint', 'tierZh', 'tierEn']);
  assert.match(c.episodeCostHint({ episodes: 20, tier: 'ECONOMY', plan: FREE, authed: false, en: false }), /登录后可查看预计扣费/);
  assert.match(c.episodeCostHint({ episodes: 20, tier: 'ECONOMY', plan: null, authed: true, en: false }), /按所选引擎与会员档位结算，生成前不扣费/);
});

test('v2.663 标题短版与完整提示同源同口径', () => {
  const { context: c } = setup(['episodeCostShort']);
  assert.equal(c.episodeCostShort({ tier: 'ECONOMY', plan: FREE, authed: true, quotaRemain: 0, en: false }), '每日 2 集免费 · 超出 12 积分/集');
  assert.equal(c.episodeCostShort({ tier: 'ECONOMY', plan: ADV, authed: true, quotaRemain: 300, en: false }), '赠送集优先 · 超出 8 积分/集');
  assert.equal(c.episodeCostShort({ tier: 'STANDARD', plan: PRO, authed: true, quotaRemain: 0, en: false }), '9 积分/集');
  assert.equal(c.episodeCostShort({ tier: 'ECONOMY', plan: null, authed: false, en: false }), '登录后可见');
});

test('v2.663 接线后标题与按钮上方同时更新（金额随集数变化）', () => {
  const { context: c, $ } = setup(['syncEpisodeCostHint', 'episodeCostHint', 'episodeCostShort', 'tierZh', 'tierEn', 'myPlan', '_costParams'], {
    Api: { getUser: () => ({ id: 'u1', level: 'ADVANCED' }), isAuthed: () => true },
    meCache: { id: 'u1', quota: { remain: 0 } },
    _plansCache: [FREE, ADV, PRO],
  });
  $('episodes').value = '10';
  $('engine').value = 'STANDARD';
  c.syncEpisodeCostHint();
  assert.equal($('modeDetailCost').textContent, '12 积分/集');
  assert.equal($('genCostHint').textContent, '标准引擎 12 积分/集 × 10 集 ≈ 120 积分（以结算为准）');
});

test('v2.663 换号后旧账号额度不得串进新账号估算', () => {
  const { context: c, $ } = setup(['syncEpisodeCostHint', 'episodeCostHint', 'episodeCostShort', 'tierZh', 'tierEn', 'myPlan', '_costParams'], {
    Api: { getUser: () => ({ id: 'u2', level: 'ADVANCED' }), isAuthed: () => true },
    meCache: { id: 'u1', quota: { remain: 300 } }, // 上一位登录者的额度
    _plansCache: [FREE, ADV, PRO],
  });
  $('episodes').value = '20';
  $('engine').value = 'ECONOMY';
  c.syncEpisodeCostHint();
  assert.doesNotMatch($('genCostHint').textContent, /赠送集/);
  assert.match($('genCostHint').textContent, /经济引擎 8 积分\/集 × 20 集 ≈ 160 积分/);
});

test('v2.663 静态契约：目录下发单集价、按钮上方有成本位、集数/引擎有委派监听', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const order = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'order.ts'), 'utf8');
  assert.match(html, /id="genCostHint"/, '生成按钮上方应有成本提示位');
  assert.ok(order.includes('epPrice: EP_PRICE[lv]'), '目录必须从定价矩阵下发单集价');
  assert.ok(source.includes("e.target.id === 'episodes'"), '集数变化应触发重算');
  assert.ok(source.includes("e.target.id === 'engine'"), '引擎变化应触发重算');
  assert.ok(source.includes('primeEpisodeCostHint()'), '打开二级界面应初始化成本提示');
});
