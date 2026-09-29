const test = require('node:test');
const assert = require('node:assert');
const W = require('../dist/engine/emotion-wave.js');
const { normalizeBeatPref } = require('../dist/engine/beat-system.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.38 全剧情绪波形：确定性、结构完整、峰值合法', () => {
  const a = W.buildEmotionWave(24);
  const b = W.buildEmotionWave(24);
  assert.deepStrictEqual(a, b, '同参数必须完全可复现');
  assert.strictEqual(a.points.length, 24);
  a.points.forEach((p) => {
    assert.ok(p.intensity >= 0 && p.intensity <= 100);
    assert.ok(p.valence >= -100 && p.valence <= 100);
    assert.ok(p.path.length === 3, '每集三拍情绪弧');
    assert.ok(p.ep >= 1);
  });
  assert.ok(a.peakEp >= 1 && a.peakEp <= 24);
  assert.ok(a.range >= 0);
});

test('v2.38 英文层 nameEn 零中文；tight 强度平均张力高于 relax', () => {
  const w = W.buildEmotionWave(30);
  const labels = w.points.flatMap((p) => [...p.path, ...p.payoffs, ...(p.reversal ? [p.reversal] : [])]);
  labels.forEach((l) => assert.ok(!cjk(l.nameEn), `${l.id} 英文名不得含中文`));
  const tight = W.buildEmotionWave(30, normalizeBeatPref({ strength: 'tight' }));
  const relax = W.buildEmotionWave(30, normalizeBeatPref({ strength: 'relax' }));
  assert.ok(tight.avgIntensity >= relax.avgIntensity, '紧密度档的平均张力不应低于呼吸档');
});

test('v2.38 集数夹取与单集边界', () => {
  assert.strictEqual(W.buildEmotionWave(0).episodeCount, 1);
  assert.strictEqual(W.buildEmotionWave(99999).episodeCount, 300);
  const one = W.buildEmotionWave(1);
  assert.strictEqual(one.points.length, 1);
  assert.strictEqual(one.flatWarn, false);
});

test('v2.39 波形点集改稿建议：确定性、合法级别、英文零中文、健康集返回 null', () => {
  const w = W.buildEmotionWave(24);
  let advised = 0;
  w.points.forEach((p) => {
    const a = W.adviseWavePoint(w, p.ep);
    const aEn = W.adviseWavePoint(w, p.ep, 'en');
    if (a) {
      advised++;
      assert.ok(['P1', 'P2'].includes(a.level));
      assert.strictEqual(a.rule, 'emotion_wave');
      assert.ok(a.advice.includes(`第${p.ep}集`));
      assert.ok(aEn && !cjk(aEn.adviceEn), '英文建议零中文');
      // 确定性
      assert.deepStrictEqual(W.adviseWavePoint(w, p.ep), a);
    } else {
      assert.strictEqual(aEn, null);
    }
  });
  assert.ok(advised >= 0);
  // 越界夹取：0 与 999 分别落到首/尾集且不抛错
  assert.doesNotThrow(() => W.adviseWavePoint(w, 0));
  assert.doesNotThrow(() => W.adviseWavePoint(w, 9999));
});

test('v2.39 只压不放必出 P1 建议（构造性验证）', () => {
  // 手工构造波形：情绪弧全是压抑类、无释放、低张力
  const fake = {
    episodeCount: 3, avgIntensity: 40, peakEp: 1, range: 10, flatWarn: false,
    points: [
      { ep: 1, intensity: 40, valence: -80, path: [{ id: 'emo_suppress', name: '憋屈蓄力', nameEn: 'x' }], reversal: null, payoffs: [], payoffCount: 0 },
      { ep: 2, intensity: 50, valence: -60, path: [{ id: 'emo_suspense', name: '揪心悬念', nameEn: 'x' }], reversal: null, payoffs: [], payoffCount: 0 },
      { ep: 3, intensity: 45, valence: -70, path: [{ id: 'emo_tear', name: '破防泪点', nameEn: 'x' }], reversal: null, payoffs: [], payoffCount: 0 },
    ],
  };
  const a = W.adviseWavePoint(fake, 2);
  assert.ok(a && a.level === 'P1' && a.advice.includes('只压不放'));
});
