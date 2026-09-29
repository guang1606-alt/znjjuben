const test = require('node:test');
const assert = require('node:assert');
const H = require('../dist/engine/hit-reverse.js');

const eps = [
  { text: '赘婿林川被当众羞辱扫地出门，没想到他竟是隐藏身份的首富继承人，当场打脸众人，全场震惊。' },
  { text: '三年隐忍，他一路碾压，霸气反杀，揭穿阴谋完成复仇。' },
  { text: '真相大白，他翻盘清算，扬眉吐气，谁知幕后还有一人。' },
];

test('黄金三秒钩子类型识别', () => {
  const a = H.analyzeHit(eps);
  assert.strictEqual(a.hookType, '身份错位');
  assert.ok(a.hookEvidence.includes('赘婿'));
});

test('爽点密度与排布统计正确', () => {
  const a = H.analyzeHit(eps);
  assert.deepStrictEqual(a.coolPoints.perEpisode, [2, 5, 4]);
  assert.strictEqual(a.coolPoints.total, 11);
  assert.ok(a.coolPoints.densityPer100 > 0);
  assert.deepStrictEqual(a.coolPoints.episodeGaps, [1, 1]);
});

test('反转节点定位到集', () => {
  const a = H.analyzeHit(eps);
  assert.ok(a.reversals.some((r) => r.episode === 0));
  assert.ok(a.reversals.some((r) => r.episode === 2));
});

test('节奏曲线：高爽点集张力高于纯铺垫', () => {
  const a = H.analyzeHit(eps);
  assert.ok(a.tensionCurve[1] >= a.tensionCurve[0] || a.tensionCurve[1] > 40);
  assert.ok(a.tensionCurve.every((v) => v >= 0 && v <= 100));
});

test('人设反差模型识别', () => {
  const a = H.analyzeHit(eps);
  assert.ok(a.personaContrast.includes('扮猪吃虎'));
});

test('抽象骨架不携带原文整句', () => {
  const a = H.analyzeHit(eps);
  const sk = JSON.stringify(a.skeleton);
  assert.ok(!sk.includes('林川'));
  assert.ok(!sk.includes('当众羞辱'));
  assert.ok(Array.isArray(a.skeleton.coolRhythm));
});

test('侵权校验：照抄判高风险、重写判安全', () => {
  const original = '她攥紧那份离婚协议站在暴雨里，发誓三年后一定要让所有人跪着求饶';
  const copy = '她攥紧那份离婚协议站在暴雨里，发誓要回来'; // 连续照抄
  assert.strictEqual(H.plagiarismCheck(original, copy).risk, 'high');
  const fresh = '少年背着旧剑走出山门，决定去京城讨一个公道';
  assert.strictEqual(H.plagiarismCheck(original, fresh).risk, 'safe');
});

test('逻辑复用：三项必须替换，且新brief与原文文字隔离', () => {
  const a = H.analyzeHit(eps);
  assert.throws(() => H.reuseBrief(a.skeleton, { persona: '', setting: 'x', world: 'y' }));
  const brief = H.reuseBrief(a.skeleton, { persona: '落魄女法医', setting: '滨海老城', world: '近未来悬疑' });
  assert.deepStrictEqual(brief.coolRhythm, a.skeleton.coolRhythm);
  const check = H.plagiarismCheck(eps.map((e) => e.text).join(''), JSON.stringify(brief));
  assert.strictEqual(check.risk, 'safe');
});

test('v1.90 lang=en：analyzeHit/reuseBrief 英文输出；默认中文不变', () => {
  const eps = [{ text: 'She was kicked out, betrayed and humiliated, little did they know she was the hidden billionaire heir, then a comeback, twist and reckoning. '.repeat(4) }];
  const a = H.analyzeHit(eps, 'en');
  assert.ok(/[A-Za-z]/.test(a.hookType));
  assert.ok(!/[一-龥]/.test(JSON.stringify(a.skeleton)));
  const b = H.reuseBrief(a.skeleton, { persona: 'P', setting: 'S', world: 'W' }, 'en');
  assert.ok(!/[一-龥]/.test(b.logline + b.hookPlan + b.isolationNote));
  const zh = H.analyzeHit([{ text: '她被背叛羞辱，谁知她是隐藏继承人，反转逆袭清算。'.repeat(4) }]);
  assert.strictEqual(typeof zh.hookType, 'string');
});
