const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/config/platform-playbook.js');

test('五大激励通道自动叠加、不设上限，优质剧标注150万封顶', () => {
  const empty = P.incentiveStack({});
  assert.strictEqual(empty.totalPct, 0);
  const r = P.incentiveStack({ categoryBoostPct: 20, seriesSeason: 3, qualityBoostPct: 10, filmIpSLevel: true, nativeBoostPct: 25 });
  // 20 + 30 + 10 + 17.5 + 25 = 102.5
  assert.strictEqual(r.totalPct, 102.5);
  assert.strictEqual(r.lines.length, 5);
  assert.ok(r.capNote.includes('150万'));
  const s2 = P.incentiveStack({ seriesSeason: 2 });
  assert.strictEqual(s2.totalPct, 20);
});

test('男频四要点检查：缺项列出、全有通过', () => {
  const miss = P.maleFrequencyCheck({ sellingPoint: true });
  assert.strictEqual(miss.ok, false);
  assert.strictEqual(miss.missing.length, 3);
  assert.ok(miss.advice.includes('规则与主线'));
  const full = P.maleFrequencyCheck({ sellingPoint: true, clearGoal: true, emotionPayoff: true, visualizedSetting: true });
  assert.strictEqual(full.ok, true);
});

test('七要素完备度 + 女频升级方向 + 情绪深度说明', () => {
  const r = P.sevenElementCheck(['题材', '核心关系', '情绪回报']);
  assert.strictEqual(r.covered.length, 3);
  assert.strictEqual(r.completenessPct, Math.round(3 / 7 * 100));
  assert.ok(r.missing.includes('主角路径'));
  assert.ok(P.femaleUpgradeBrief().includes('大女主'));
  assert.ok(P.EMOTION_DEPTH_NOTE.includes('深度'));
});
