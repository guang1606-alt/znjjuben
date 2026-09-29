const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/beat-catalog-i18n.js');
const B = require('../dist/engine/beat-system.js');

test('v2.47 26 节拍 × 4 语 × 3 字段全覆盖', () => {
  const all = [...B.BEAT_LIBRARY.reversal, ...B.BEAT_LIBRARY.payoff, ...B.BEAT_LIBRARY.emotion].map((b) => b.id);
  assert.strictEqual(all.length, 26);
  assert.deepStrictEqual(C.BEAT_CATALOG_IDS.sort(), all.sort());
  const cov = C.beatCatalogCoverage(all);
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 26 * 4 * 3);
});

test('localizeBeatCatalogList：四语字段齐全、technique/bestFor 保留；zh/en 原样', () => {
  const en = B.BEAT_LIBRARY.reversal;
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const list = C.localizeBeatCatalogList(en, l);
    assert.strictEqual(list.length, en.length);
    list.forEach((b) => {
      assert.ok(b.id && b.name && b.definition && b.example, `${l} ${b.id} 缺字段`);
      assert.ok(b.technique, `${l} ${b.id} technique 丢失`);
    });
  }
  const zh = B.BEAT_LIBRARY.emotion;
  assert.strictEqual(C.localizeBeatCatalogList(zh, 'zh'), zh);
});

test('未知 id 回退 enFallback 不空', () => {
  const v = C.localizeBeatEntry('nope', 'ko', { name: 'Fb', definition: 'd', example: 'e' });
  assert.deepStrictEqual(v, { name: 'Fb', definition: 'd', example: 'e' });
});
