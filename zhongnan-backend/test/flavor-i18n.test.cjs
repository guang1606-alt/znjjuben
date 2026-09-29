const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/flavor-i18n.js');

test('v2.45 20 项四轴风味 × 4 语全覆盖', () => {
  const cov = F.flavorI18nCoverage();
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 20 * 4);
});

test('localizeFlavor：四语有译，zh/en 原样回传，未知 id 回退英文', () => {
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const v = F.localizeFlavor('micro', 'action', l, { name: 'Action hook', desc: 'x' });
    assert.ok(v.name && v.desc);
  }
  assert.strictEqual(F.localizeFlavor('payoff', 'face_slap', 'zh', { name: '打脸现报', desc: 'z' }).name, '打脸现报');
  assert.strictEqual(F.localizeFlavor('emotion', 'nope', 'ja', { name: 'Fallback', desc: 'd' }).name, 'Fallback');
});

test('框架标签：层/模式/强度/节拍类 四语齐全且 zh/en 原样', () => {
  for (const tbl of ['layer', 'cueMode', 'strength', 'beatKind']) {
    const ids = tbl === 'layer' ? ['open', 'episode', 'scene', 'micro']
      : tbl === 'cueMode' ? ['auto', 'manual', 'hybrid']
      : tbl === 'strength' ? ['relax', 'balanced', 'tight']
      : ['reversal', 'payoff', 'emotion'];
    for (const id of ids) for (const l of ['ja', 'ko', 'es', 'ar']) {
      const v = F.localizeLabel(tbl, id, l, { name: 'ZH' });
      assert.ok(v.name && v.name !== 'ZH', `${tbl}:${id}/${l} 未译`);
    }
  }
  assert.strictEqual(F.localizeLabel('layer', 'open', 'en', { name: 'Opening' }).name, 'Opening');
});
