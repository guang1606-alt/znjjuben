const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/flavor-reason-i18n.js');
const FR = require('../dist/engine/flavor-recommender.js');

test('v2.48 14 条风味推荐理由 × 4 语全覆盖', () => {
  assert.strictEqual(R.FLAVOR_REASON_KEYS.length, 14);
  const cov = R.flavorReasonCoverage();
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 14 * 4);
});

test('命中规则：理由与 matched 对齐，四语本地化、zh/en 原样', () => {
  const p = FR.recommendFlavorProfile({ tags: ['复仇', '悬疑'] });
  assert.ok(p.matched.includes('revenge'));
  const ja = R.localizeFlavorReasons(p.matched, p.reasons, 'ja');
  assert.strictEqual(ja.length, p.reasons.length);
  assert.ok(ja[0].includes('復讐'));
  const zh = R.localizeFlavorReasons(p.matched, p.reasons, 'zh');
  assert.strictEqual(zh[0], p.reasons[0].zh);
  const en = R.localizeFlavorReasons(p.matched, p.reasons, 'en');
  assert.strictEqual(en[0], p.reasons[0].en);
});

test('无命中走 fallback 四语；非法 lang 回退 zh', () => {
  const p = FR.recommendFlavorProfile({ tags: ['无关标签xyz'] });
  assert.deepStrictEqual(p.matched, []);
  const es = R.localizeFlavorReasons(p.matched, p.reasons, 'es');
  assert.strictEqual(es.length, 1);
  assert.ok(es[0].includes('equilibrada'));
  const bad = R.localizeFlavorReasons(p.matched, p.reasons, 'fr');
  assert.strictEqual(bad[0], p.reasons[0].zh);
});
