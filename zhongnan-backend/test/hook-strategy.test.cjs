const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/engine/hook-strategy.js');
const H = require('../dist/engine/hook-system.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.27 五套钩子策略齐全、字段完整、英文层零中文', () => {
  assert.deepStrictEqual(S.HOOK_STRATEGY_IDS, ['balanced', 'dense', 'suspense', 'emotion', 'premium']);
  S.HOOK_STRATEGIES.forEach((s) => {
    ['name', 'nameEn', 'tagline', 'taglineEn', 'fit', 'fitEn'].forEach((k) => assert.ok(s[k] && s[k].length >= 2, `${s.id}.${k}`));
    assert.ok(['relax', 'balanced', 'tight'].includes(s.strength));
    assert.ok(!cjk(s.nameEn + s.taglineEn + s.fitEn), `${s.id} 英文层含中文`);
    s.microFlavors.forEach((f) => assert.ok(H.VALID_FLAVORS.has(f), `非法风味 ${f}`));
  });
});

test('v2.27 策略里所有 preferred/avoid 都是合法四层钩 id（绝不发明钩子）', () => {
  const valid = new Set(H.ALL_HOOKS.map((h) => h.id));
  S.HOOK_STRATEGIES.forEach((s) => [...s.preferred, ...s.avoid].forEach((id) => assert.ok(valid.has(id), `${s.id} 引用非法钩 ${id}`)));
});

test('v2.27 系统智能默认：题材关键词确定性命中对应策略，无信号回退均衡', () => {
  assert.strictEqual(S.recommendStrategy({ text: '刑侦法医悬疑烧脑探案' }).id, 'suspense');
  assert.strictEqual(S.recommendStrategy({ text: 'a spy thriller crime mystery' }).id, 'suspense');
  assert.strictEqual(S.recommendStrategy({ tags: ['赘婿', '逆袭打脸'] }).id, 'dense');
  assert.strictEqual(S.recommendStrategy({ text: '女性群像亲情治愈' }).id, 'emotion');
  assert.strictEqual(S.recommendStrategy({ text: '精品电影感慢热文艺' }).id, 'premium');
  const none = S.recommendStrategy({ text: '普通职场故事' });
  assert.strictEqual(none.id, 'balanced'); assert.ok(none.auto);
  // 同输入两次结果一致（确定性）
  assert.strictEqual(S.recommendStrategy({ text: '谍战' }).id, S.recommendStrategy({ text: '谍战' }).id);
});

test('v2.27 推荐理由双语可读、英文零中文', () => {
  const r = S.recommendStrategy({ text: '悬疑推理' });
  assert.ok(r.reason.includes('悬念牵引流') && r.reason.includes('你也可以随时切换'));
  const re = S.recommendStrategy({ text: 'a crime detective mystery' });
  assert.ok(/suspense/i.test(re.reasonEn) && !cjk(re.reasonEn));
});

test('v2.27 strategyToCuePref：强度/风味/偏好正确落地，非法策略回退均衡', () => {
  const dense = S.strategyToCuePref('dense');
  assert.strictEqual(dense.strength, 'tight');
  assert.deepStrictEqual(dense.microFlavors, ['action', 'gap']);
  assert.ok(dense.preferred.includes('ep_cliff_danger'));
  const bad = S.strategyToCuePref('不存在');
  assert.strictEqual(bad.strength, 'balanced');
  // premium 显式禁用隐忍卖惨钩
  assert.ok(S.strategyToCuePref('premium').avoid.includes('open_endure'));
});

test('v2.27 策略产出的 CuePref 能驱动 planHooks：密集流每场景微钩数≥2', () => {
  let seed = 7; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const densePlan = H.planHooks(2, 4, S.strategyToCuePref('dense'), rng);
  densePlan.episodes.forEach((ep) => ep.scenes.forEach((sc) => assert.ok(sc.microHookIds.length >= 2, 'tight 应每场≥2微钩')));
  let s2 = 7; const rng2 = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
  const premPlan = H.planHooks(2, 4, S.strategyToCuePref('premium'), rng2);
  // relax 流允许 0-1 微钩、且不是每场都有场末钩
  const totalMicro = premPlan.episodes.flatMap((e) => e.scenes).reduce((a, x) => a + x.microHookIds.length, 0);
  assert.ok(totalMicro < densePlan.episodes.flatMap((e) => e.scenes).reduce((a, x) => a + x.microHookIds.length, 0));
});

test('v2.27 举一反三：节拍风味建议只含合法值，均衡流不强行注入', () => {
  const h = S.strategyBeatHints('dense');
  assert.deepStrictEqual(h.payoffFlavors, ['face_slap', 'comeback', 'status_crush']);
  assert.deepStrictEqual(h.emotionFlavors, ['hype_burn']);
  const sus = S.strategyBeatHints('suspense');
  assert.deepStrictEqual(sus.reversalFlavors, ['truth_cause', 'cognition_overturn']);
  assert.deepStrictEqual(S.strategyBeatHints('balanced'), { payoffFlavors: [], reversalFlavors: [], emotionFlavors: [] });
});

test('v2.27 策略说明卡/listStrategies 双语一致、isValidHookStrategy 守非法值', () => {
  assert.strictEqual(S.describeStrategy('emotion', 'zh').name, '情绪沉浸流');
  assert.strictEqual(S.describeStrategy('emotion', 'en').name, 'Emotion-immersion');
  assert.strictEqual(S.listStrategies('en').length, 5);
  assert.ok(S.isValidHookStrategy('suspense') && !S.isValidHookStrategy('nope'));
});
