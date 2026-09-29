const test = require('node:test');
const assert = require('node:assert');
const W = require('../dist/engine/wave-i18n.js');
const EW = require('../dist/engine/emotion-wave.js');

test('v2.49 波形 4 类建议 × 4 语模板 + 维度标签全覆盖', () => {
  const cov = W.waveI18nCoverage();
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 4 * 4 * 2);
});

test('localizeEmotionWave：节拍名四语、zh 原样、en 取 nameEn', () => {
  const wave = EW.buildEmotionWave(6);
  const ja = W.localizeEmotionWave(wave, 'ja');
  assert.strictEqual(ja.points.length, 6);
  const named = ja.points.flatMap((p) => p.path);
  assert.ok(named.length > 0);
  assert.ok(named.every((b) => b.name && b.id));
  const zh = W.localizeEmotionWave(wave, 'zh');
  assert.strictEqual(zh, wave);
  const en = W.localizeEmotionWave(wave, 'en');
  assert.ok(en.points.some((p) => p.path.every((q) => !/[一-鿿]/.test(q.name))));
});

test('localizeWaveAdviceList：建议按 ruleKind 渲染占位，非法 lang 回退 zh', () => {
  const wave = EW.buildEmotionWave(14);
  const raw = wave.points.map((p) => EW.adviseWavePoint(wave, p.ep, 'zh')).filter(Boolean);
  assert.ok(raw.length >= 1, '14 集波形至少触发一条建议');
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const list = W.localizeWaveAdviceList(raw, wave, l);
    list.forEach((a) => {
      assert.ok(a.advice.length > 15, `${l} 建议过短`);
      assert.ok(a.advice.includes(String(a.ep)), `${l} 未渲染集数`);
      assert.ok(!/\{(ep|intensity|path)\}/.test(a.advice), `${l} 占位未替换`);
    });
  }
  const bad = W.localizeWaveAdviceList(raw, wave, 'fr');
  assert.strictEqual(bad[0].advice, raw[0].advice);
});
