/**
 * v2.80 关系线保鲜台账（pair-bond-ledger）测试
 * 覆盖：空输入、derivePairBits 交集/去重/组合/无交集不保留/cap 80、
 *       coGap<4 不报、4=mid/8=high 边界、一方 lastIn≤lastCo 跳过、
 *       一方不在场位表跳过、coGap 降序与 cap 5、
 *       zh/en 指令内容、en 层零中文（角色名透传例外）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  derivePairBits, pairBondLedger, pairBondDirective,
  PAIR_GAP_MID, PAIR_GAP_HIGH,
} = require('../dist/engine/pair-bond-ledger.js');

test('空输入：无 issue、tracked=0，双语指令均为空串', () => {
  const r = pairBondLedger([], [], 10);
  assert.strictEqual(r.tracked, 0);
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(pairBondDirective([], [], 10).zh, '');
  assert.strictEqual(pairBondDirective([], [], 10).en, '');
});

test('derivePairBits：交集去重升序、i<j 稳定组合、无交集不成对', () => {
  const bits = [
    { name: 'A', presentIn: [3, 1, 2, 2] }, // 去重升序 [1,2,3]
    { name: 'B', presentIn: [3, 2, 4] },    // [2,3,4]
    { name: 'C', presentIn: [4, 5] },       // 与 A 无交集
  ];
  const pairs = derivePairBits(bits);
  assert.deepStrictEqual(pairs, [
    { a: 'A', b: 'B', coIn: [2, 3] },
    { a: 'B', b: 'C', coIn: [4] },
  ]);
});

test('derivePairBits：同对只出现一次、同名/空名不成对、总数 cap 80', () => {
  // 14 个名字两两组合 91 对 > 80 → 截断为 80
  const bits = Array.from({ length: 14 }, (_, i) => ({ name: `角色${i}`, presentIn: [1] }));
  const pairs = derivePairBits(bits);
  assert.strictEqual(pairs.length, 80);
  // 空名与同名不参与组合
  assert.deepStrictEqual(derivePairBits([
    { name: '  ', presentIn: [1] },
    { name: '甲', presentIn: [1, 2] },
    { name: '甲', presentIn: [3] },
  ]).length, 0);
});

test('未同场 <4 集不报；双方任一 lastIn≤lastCo 跳过（退场方属配角在场问题）', () => {
  const pairs = [{ a: 'A', b: 'B', coIn: [1, 7] }]; // lastCo=7, coGap=9-7=2 <4
  assert.deepStrictEqual(pairBondLedger(pairs, [
    { name: 'A', presentIn: [1, 7, 8] },
    { name: 'B', presentIn: [1, 7, 9] },
  ], 10).issues, []);
  // coGap 足够但 B 最后同场后未再出场 → 跳过
  const pairs2 = [{ a: 'A', b: 'B', coIn: [1, 2] }];
  assert.deepStrictEqual(pairBondLedger(pairs2, [
    { name: 'A', presentIn: [1, 2, 5] },
    { name: 'B', presentIn: [1, 2] },
  ], 10).issues, []);
});

test('阈值边界：coGap=4 → mid、coGap=8 → high', () => {
  assert.strictEqual(PAIR_GAP_MID, 4);
  assert.strictEqual(PAIR_GAP_HIGH, 8);
  const mid = pairBondLedger([{ a: 'A', b: 'B', coIn: [1, 5] }], [
    { name: 'A', presentIn: [1, 5, 8] },
    { name: 'B', presentIn: [1, 5, 9] },
  ], 10); // lastCo=5, coGap=4
  assert.strictEqual(mid.issues.length, 1);
  assert.strictEqual(mid.issues[0].severity, 'mid');
  assert.strictEqual(mid.issues[0].coGap, 4);
  const high = pairBondLedger([{ a: 'A', b: 'B', coIn: [1] }], [
    { name: 'A', presentIn: [1, 3, 4] },
    { name: 'B', presentIn: [1, 5, 6] },
  ], 10); // lastCo=1, coGap=8
  assert.strictEqual(high.issues.length, 1);
  assert.strictEqual(high.issues[0].severity, 'high');
  assert.strictEqual(high.issues[0].lastCo, 1);
});

test('任一方不在场位表（含 presentIn 为空）→ 跳过', () => {
  const pairs = [{ a: 'A', b: 'B', coIn: [1, 2] }];
  // B 完全不在 presence
  assert.deepStrictEqual(pairBondLedger(pairs, [{ name: 'A', presentIn: [1, 2, 9] }], 10).issues, []);
  // B presentIn 为空
  assert.deepStrictEqual(pairBondLedger(pairs, [
    { name: 'A', presentIn: [1, 2, 9] },
    { name: 'B', presentIn: [] },
  ], 10).issues, []);
});

test('排序：coGap 降序，issue 数 cap 5', () => {
  const pairs = [
    { a: 'A', b: 'B', coIn: [1] },     // gap=8 high
    { a: 'A', b: 'C', coIn: [2] },     // gap=7 mid
    { a: 'A', b: 'D', coIn: [3] },     // gap=6 mid
    { a: 'A', b: 'E', coIn: [4] },     // gap=5 mid
    { a: 'A', b: 'F', coIn: [5] },     // gap=4 mid
    { a: 'A', b: 'G', coIn: [6] },     // gap=3 不报
  ];
  const presence = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => ({ name: n, presentIn: [7, 8, 9] }));
  const r = pairBondLedger(pairs, presence, 10);
  assert.strictEqual(r.issues.length, 5);
  assert.deepStrictEqual(r.issues.map((i) => i.b), ['B', 'C', 'D', 'E', 'F']);
});

test('zh 指令：头行+条目格式齐备', () => {
  const d = pairBondDirective([{ a: '林晚', b: '沈砚', coIn: [1] }], [
    { name: '林晚', presentIn: [1, 3, 4] },
    { name: '沈砚', presentIn: [1, 5, 6] },
  ], 10);
  assert.ok(d.zh.startsWith('【关系线保鲜·同场调度】'));
  assert.ok(d.zh.includes('「林晚」与「沈砚」'));
  assert.ok(d.zh.includes('已 8 集未同场'));
  assert.ok(d.zh.includes('最后同场第1集'));
  assert.ok(d.zh.includes('本集安排一场对手戏'));
  assert.ok(d.zh.endsWith('\n'));
});

test('en 指令：英文名下系统文案零中文', () => {
  const d = pairBondDirective([{ a: 'Elena', b: 'Marcus', coIn: [1] }], [
    { name: 'Elena', presentIn: [1, 3, 4] },
    { name: 'Marcus', presentIn: [1, 5, 6] },
  ], 10);
  assert.ok(d.en.startsWith('[Pair-bond freshness guard'));
  assert.ok(d.en.includes('"Elena" and "Marcus"'));
  assert.ok(d.en.includes("haven't shared a scene for 8 episodes"));
  assert.ok(d.en.includes('last together ep1'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en), `en 层含中文: ${d.en}`);
});

test('en 指令：中文名按圣经标识符透传，系统文案（除名外）零中文', () => {
  const d = pairBondDirective([{ a: '林晚', b: '沈砚', coIn: [1] }], [
    { name: '林晚', presentIn: [1, 3, 4] },
    { name: '沈砚', presentIn: [1, 5, 6] },
  ], 10);
  const body = d.en.split('"林晚"').join('').split('"沈砚"').join('');
  assert.ok(!/[\u4e00-\u9fff]/.test(body), `en 系统文案含中文: ${body}`);
});
