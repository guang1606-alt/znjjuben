const test = require('node:test');
const assert = require('node:assert');
const D = require('../dist/engine/diagnosis-i18n.js');
const FD = require('../dist/engine/full-diagnosis.js');

test('v2.50 诊断六维标签/评级/维度建议 × 4 语全覆盖（64 格）', () => {
  const cov = D.diagnosisI18nCoverage();
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 6 * 4 * 2 + 4 * 4);
});

test('zh 原样；en 英文化；ja 六维标签/评级日语化', () => {
  const eps = [{ epNo: 1, content: '他心中五味杂陈，一股莫名的情绪涌上心头，不禁暗自想，脑海里久久不能平静。'.repeat(6) }];
  const d = FD.diagnoseFull(eps);
  assert.strictEqual(D.localizeDiagnosis(d, 'zh'), d);
  const en = D.localizeDiagnosis(d, 'en');
  assert.deepStrictEqual(en.groups.map((g) => g.label), ['Character', 'Plot', 'Dialogue', 'Market', 'Format', 'De-AI']);
  assert.ok(['Excellent', 'Good', 'Pass', 'Needs work'].includes(en.scorecard.level));
  const ja = D.localizeDiagnosis(d, 'ja');
  assert.deepStrictEqual(ja.groups.map((g) => g.label), ['人物', '筋書き', '台詞', '市場性', 'フォーマット', 'AI除去']);
  assert.ok(ja.scorecard.dimensions.every((x) => x.advice && x.label));
});

test('非中文正文走英文检测；es/ar 结构标签本地化不炸', () => {
  const eps = [{ epNo: 1, content: 'She had mixed feelings and a wave of sadness washed over her; she could not calm down. '.repeat(8) }];
  const d = FD.diagnoseFull(eps, {}, 'en');
  assert.ok(d.topFixes.every((f) => !/[一-鿿]/.test(f.advice)));
  for (const l of ['es', 'ar', 'ko']) {
    const v = D.localizeDiagnosis(d, l);
    assert.strictEqual(v.groups.length, 6);
    assert.ok(v.scorecard.priorityActions.length >= 1);
  }
});
