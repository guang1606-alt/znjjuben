const test = require('node:test');
const assert = require('node:assert');
const B = require('../dist/engine/aigc-beat.js');

test('planAigcBeats：默认90s切3个30s单元、区间连续无重叠、无尾拍', () => {
  const p = B.planAigcBeats();
  assert.strictEqual(p.totalSeconds, 90);
  assert.strictEqual(p.beatCount, 3);
  assert.deepStrictEqual(p.beats.map((b) => [b.startSec, b.endSec]), [[0, 30], [30, 60], [60, 90]]);
  assert.ok(p.beats.every((b) => b.isTail === false));
  // 区间首尾相接
  p.beats.forEach((b, i) => { if (i) assert.strictEqual(b.startSec, p.beats[i - 1].endSec); });
});

test('planAigcBeats：非整30倍数，末拍为不足30s的收尾拍', () => {
  const p = B.planAigcBeats(100);
  assert.strictEqual(p.beatCount, 4);
  const tail = p.beats[3];
  assert.deepStrictEqual([tail.startSec, tail.endSec], [90, 100]);
  assert.strictEqual(tail.isTail, true);
  assert.ok(/集钩子/.test(tail.productionHints.join('')));
});

test('planAigcBeats：正好30s只切1拍；首拍带黄金3秒/口型提示', () => {
  const p = B.planAigcBeats(30);
  assert.strictEqual(p.beatCount, 1);
  assert.ok(/黄金3秒/.test(p.beats[0].productionHints.join('')));
  assert.ok(/口型/.test(p.beats[0].productionHints.join('')));
});

test('planAigcBeats：非法/非正输入兜底90s不抛错', () => {
  for (const bad of [undefined, 0, -5, NaN]) {
    const p = B.planAigcBeats(bad);
    assert.strictEqual(p.beatCount, 3);
    assert.strictEqual(p.totalSeconds, 90);
  }
});

test('每拍都带微叙事弧；制作规范恰为5条且brief含30秒单元与口型', () => {
  const p = B.planAigcBeats(60);
  assert.ok(p.beats.every((b) => /小目标.*小阻碍.*小结果/.test(b.arcPrompt)));
  assert.strictEqual(B.AIGC_PRODUCTION_RULES.length, 5);
  const brief = B.aigcProductionBrief(p);
  assert.ok(/30秒/.test(brief));
  assert.ok(/口型/.test(brief));
  assert.ok(/局部/.test(brief));
});

test('aigcProductionBrief 不传参也能安全生成', () => {
  const b = B.aigcProductionBrief();
  assert.ok(b.includes('微叙事单元'));
});
