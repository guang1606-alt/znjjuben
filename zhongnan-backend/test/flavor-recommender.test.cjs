const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/flavor-recommender.js');
const B = require('../dist/engine/beat-system.js');
const H = require('../dist/engine/hook-system.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.04 悬疑题材 → 真相/认知反转 + 氛围信息差伏笔微钩 + 揪心情绪', () => {
  const p = R.recommendFlavorProfile({ tags: ['悬疑', '刑侦破案', '高能反转'] });
  assert.ok(p.reversalFlavors.includes('truth_cause'));
  assert.ok(p.reversalFlavors.includes('cognition_overturn'));
  assert.ok(p.microFlavors.some((x) => ['atmos', 'gap', 'foreshadow'].includes(x)));
  assert.ok(p.emotionFlavors.includes('suspense_tug'));
  assert.ok(p.matched.includes('mystery'));
  assert.ok(p.reasons.length >= 1 && p.reasons[0].zh.length > 0);
});

test('v2.04 甜宠爱情 → 甜暖爽点 + 温情治愈情绪 + 语言/情绪微钩', () => {
  const p = R.recommendFlavorProfile({ tags: ['现代爱情', '先婚后爱', '高甜撒糖'] });
  assert.ok(p.payoffFlavors.includes('sweet_warm'));
  assert.ok(p.emotionFlavors.includes('tender_heal'));
  assert.ok(p.microFlavors.some((x) => ['line', 'emotion'].includes(x)));
});

test('v2.04 逆袭打脸综合题材 → 打脸/压制爽点 + 身份反转 + 压抑释放', () => {
  const p = R.recommendFlavorProfile({ tags: ['逆袭成长', '草根逆袭', '扮猪吃虎打脸'], brief: '上门赘婿被羞辱后亮明身份' });
  assert.ok(p.payoffFlavors.includes('face_slap'));
  assert.ok(p.payoffFlavors.includes('status_crush'));
  assert.ok(p.reversalFlavors.includes('identity_shift'));
  assert.ok(p.emotionFlavors.includes('press_release'));
});

test('v2.04 英文输入同样命中（sweet romance），英文理由零中文', () => {
  const p = R.recommendFlavorProfile({ tags: ['sweet romance', 'fluff'], brief: 'contract marriage, mutual crush', locale: 'en' });
  assert.ok(p.payoffFlavors.includes('sweet_warm'));
  const en = R.recommendFlavorProfile({ tags: ['mystery', 'detective thriller'], locale: 'en' });
  en.reasons.forEach((r) => assert.ok(!cjk(r.en), '英文理由不得含中文'));
  assert.ok(en.reversalFlavors.includes('truth_cause'));
});

test('v2.04 空输入给通用均衡组合，四轴均非空', () => {
  const p = R.recommendFlavorProfile({});
  assert.deepStrictEqual(p.matched, []);
  assert.ok(p.microFlavors.length && p.payoffFlavors.length && p.reversalFlavors.length && p.emotionFlavors.length);
  assert.strictEqual(p.reasons.length, 1);
});

test('v2.04 纯函数确定性：同输入两次结果一致', () => {
  const inp = { tags: ['复仇', '悬疑', '职场晋升'], brief: '被陷害后归来' };
  assert.deepStrictEqual(R.recommendFlavorProfile(inp), R.recommendFlavorProfile(inp));
});

test('v2.04 所有输出风味 id 均合法，且不超各轴上限', () => {
  const samples = [[], ['喜剧搞笑', '沙雕解压'], ['玄幻仙侠', '修仙升级'], ['文旅短剧', '非遗文旅'], ['军旅谍战', '特种兵'], ['虐恋情深', '生离死别']];
  samples.forEach((tags) => {
    const p = R.recommendFlavorProfile({ tags });
    p.microFlavors.forEach((f) => assert.ok(H.VALID_FLAVORS.has(f)));
    p.payoffFlavors.forEach((f) => assert.ok(B.VALID_PAYOFF_FLAVORS.has(f)));
    p.reversalFlavors.forEach((f) => assert.ok(B.VALID_REVERSAL_FLAVORS.has(f)));
    p.emotionFlavors.forEach((f) => assert.ok(B.VALID_EMOTION_FLAVORS.has(f)));
    assert.ok(p.microFlavors.length <= 3 && p.payoffFlavors.length <= 3 && p.reversalFlavors.length <= 2 && p.emotionFlavors.length <= 2);
    assert.ok(p.microFlavors.length && p.payoffFlavors.length && p.reversalFlavors.length && p.emotionFlavors.length, '任何输入四轴都不空');
  });
});
