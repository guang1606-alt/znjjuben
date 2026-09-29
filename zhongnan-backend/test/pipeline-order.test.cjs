const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/agents/pipeline-order.js');

test('默认流水线顺序自检通过（市场前置→…→双校验→合规→市场终评）', () => {
  assert.deepStrictEqual(P.validateOrder(), []);
  const os = P.orderedStages();
  assert.strictEqual(os.length, 10);
  const idx = Object.fromEntries(os.map((s) => [s.key, s.order]));
  assert.ok(idx.market_pre < idx.architect);
  assert.ok(idx.architect < idx.character && idx.character < idx.writer);
  assert.ok(idx.consistency < idx.compliance && idx.deai < idx.compliance);
  assert.strictEqual(idx.market_post, Math.max(...Object.values(idx)));
});

test('质量门声明了回退目标（v2.191：deai 已改为 local 评分维度，仅 consistency 是 gate）', () => {
  const g = Object.fromEntries(P.PIPELINE_ORDER.filter((s) => s.kind === 'gate').map((s) => [s.key, s.reworkTo]));
  assert.strictEqual(g.consistency, 'writer');
  assert.ok(!g.deai, 'deai 已改为 local 评分维度，不是 gate，无 reworkTo');
});

test('顺序被破坏时能自检出来', () => {
  const broken = P.PIPELINE_ORDER.map((s) => s.key === 'market_post' ? { ...s, order: 2 } : s);
  assert.ok(P.validateOrder(broken).some((e) => e.includes('最后')));
  // v2.191：deai 已改为 local 评分维度，不是 gate；测 consistency 的 reworkTo 缺失
  const noRework = P.PIPELINE_ORDER.map((s) => s.key === 'consistency' ? { ...s, reworkTo: undefined } : s);
  assert.ok(P.validateOrder(noRework).some((e) => e.includes('回退')));
});
