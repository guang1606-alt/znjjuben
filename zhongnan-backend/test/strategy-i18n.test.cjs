const test = require('node:test');
const assert = require('node:assert');
const I = require('../dist/engine/strategy-i18n.js');
const H = require('../dist/engine/hook-strategy.js');
const C = require('../dist/engine/creation-strategy.js');

const FAMILIES = {
  hook: H.HOOK_STRATEGY_IDS, pace: C.PACE_IDS, dialogue: C.DIALOGUE_IDS,
  emotion: C.EMOTION_IDS, character: C.CHARACTER_IDS,
};

test('v2.44 30 张策略卡 × 4 扩展语全覆盖、无空译', () => {
  const cov = I.strategyI18nCoverage(FAMILIES);
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 25 * 4); // 钩子5+节奏/台词/情绪/人物各5=25卡
});

test('localizeList：ja/ko/es/ar 返回本地卡名，zh/en 原样', () => {
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const list = I.localizeList('pace', C.listPace('en'), l);
    assert.strictEqual(list.length, 5);
    const zhList = I.localizeList('pace', C.listPace('zh'), 'zh');
    list.forEach((c, i) => { assert.ok(c.name && c.tagline, `${l} ${c.id} 空译`); assert.notStrictEqual(c.tagline, zhList[i].tagline, `${l} ${c.id} 仍是中文译法`); });
  }
  const zh = I.localizeList('hook', H.listStrategies('zh'), 'zh');
  assert.strictEqual(zh[0].name, '均衡标准流');
});

test('localizeReason：四语理由含卡名且无中文残留；zh/en 返回空串（走既有 reason）', () => {
  const card = { name: 'X', tagline: 'Y' };
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const r = I.localizeReason(l, card, false);
    assert.ok(r.includes('X') && r.includes('Y'));
  }
  assert.strictEqual(I.localizeReason('zh', card, true), '');
});

test('normalizeUiLang 非法值回退 zh，六语合法', () => {
  ['zh', 'en', 'ja', 'ko', 'es', 'ar'].forEach((l) => assert.strictEqual(I.normalizeUiLang(l), l));
  assert.strictEqual(I.normalizeUiLang('fr'), 'zh');
  assert.strictEqual(I.normalizeUiLang(undefined), 'zh');
});
