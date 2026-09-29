/**
 * 悬念张力曲线检测器单元测试（v2.124）
 */
const test = require('node:test');
const assert = require('node:assert');
const { suspenseTensionCurve } = require('../dist/engine/suspense-tension-curve.js');

// —— 测试剧本 ——

// 中文：张力曲线健康（开场中等、中段高峰、末段中高潮）
const ZH_HEALTHY = `场景一：林晚办公室
林晚：你到底是谁？为什么要接近我？
陆泽：今天天气不错，我们出去走走吧。
林晚：好，我跟你走。

场景二：咖啡馆
苏婉：你到底想知道什么？难道你不知道真相吗？秘密就在你身边！
林晚：什么秘密？快说！时间不多了！
苏婉：原来你父亲才是真正的幕后黑手！这是阴谋！必须立刻行动！

场景三：医院
陆泽：他到底是什么人？为什么会这样？难道这一切都是阴谋吗？
林晚：时间不多了，必须赶紧联合起来。可是，没想到真相是这样。
苏婉：必须揭穿他！阴谋不可能得逞！`;

// 中文：开场弱悬念（前 2 场都无悬念）
const ZH_WEAK_OPENING = `场景一：办公室
林晚：今天天气真好，去散步吧。
陆泽：好啊，挺好的。
林晚：中午吃什么？
陆泽：随便吧。

场景二：咖啡馆
林晚：这菜味道不错。
陆泽：是啊，确实挺好吃的。
林晚：下次再来吧。
陆泽：好的。

场景三：医院
林晚：你到底是谁？为什么要接近我？秘密是什么？
陆泽：其实我是你父亲派来的！
苏婉：必须赶紧联合起来，阴谋要揭穿！`;

// 中文：收尾弱悬念
const ZH_WEAK_ENDING = `场景一：会议室
林晚：你到底是谁？为什么要接近我？秘密是什么？
陆泽：其实我是你父亲派来的。
林晚：这怎么可能？真相到底是什么？

场景二：咖啡馆
林晚：原来你是他的人！
陆泽：是的，但是没想到会这样。

场景三：公园
林晚：散步挺好的。
陆泽：好的。
林晚：回去吧。`;

// 中文：张力平铺
const ZH_FLAT = `场景一：办公室
林晚：天气不错。
陆泽：是的。
林晚：走吧。

场景二：餐厅
林晚：菜不错。
陆泽：是的。
林晚：走吧。

场景三：公园
林晚：散步挺好。
陆泽：是的。
林晚：走吧。`;

// 中文：张力跳跃（突变无过渡）
const ZH_JUMPY = `场景一：办公室
林晚：天气不错，今天挺好的。
陆泽：是的。

场景二：会议室
林晚：你到底是谁？为什么要接近我？秘密是什么？阴谋是什么？危险在哪里？时间不够了！必须赶紧！
陆泽：其实我是你父亲派来的！但是没想到会这样！这不可能！

场景三：公园
林晚：天气不错。
陆泽：是的。

场景四：会议室
林晚：你到底是谁？阴谋是什么？必须立刻行动！危险逼近了！
陆泽：时间不多了！`;

// 英文：张力曲线健康
const EN_HEALTHY = `Scene 1: Office
Lin: Who are you? Why did you approach me? What is the secret here?
Lu: Actually I am sent by your father to protect you.
Lin: What? Turns out you are his man! This is impossible!

Scene 2: Cafe
Su: From now on I am no longer your friend. You betrayed me.
Lin: What is the truth? Why? Is there a hidden conspiracy?
Su: Because your father killed my family three years ago!

Scene 3: Hospital
Lu: The reason I approached you is to expose your father. But, I never thought the truth would be this.
Lin: What kind of person is he? Must we continue? Impossible!
Su: We must cooperate immediately. Time is running out.`;

// 英文：张力平铺
const EN_FLAT = `Scene 1: Office
Lin: The weather is nice.
Lu: Yes.

Scene 2: Cafe
Lin: The food is good.
Lu: Yes.

Scene 3: Park
Lin: Walking is nice.
Lu: Yes.`;

test('中文健康剧本应得高分（≥70）', () => {
  const res = suspenseTensionCurve(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 70, `expected >=70, got ${res.score}`);
  assert.ok(res.totalSignals >= 6, `signals=${res.totalSignals}`);
  assert.ok(res.hasStrongOpening, 'opening should be strong');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `unexpected high issues: ${JSON.stringify(highIssues)}`);
});

test('开场弱悬念应触发 high 级问题', () => {
  const res = suspenseTensionCurve(ZH_WEAK_OPENING, 'zh');
  assert.strictEqual(res.hasStrongOpening, false);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'weak_opening'));
});

test('收尾弱悬念应触发 high 级问题', () => {
  const res = suspenseTensionCurve(ZH_WEAK_ENDING, 'zh');
  assert.strictEqual(res.hasStrongEnding, false);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'weak_ending'));
});

test('张力平铺应触发 high 级问题', () => {
  const res = suspenseTensionCurve(ZH_FLAT, 'zh');
  assert.ok(res.hasFlatStretch, 'should detect flat stretch');
  assert.ok(res.curveShape === 'flat', `expected flat, got ${res.curveShape}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'flat_stretch' || i.type === 'flat_curve'));
});

test('张力跳跃应被识别', () => {
  const res = suspenseTensionCurve(ZH_JUMPY, 'zh');
  assert.ok(res.curveShape === 'jumpy' || res.curveShape === 'wave', `expected jumpy/wave, got ${res.curveShape}`);
});

test('英文健康剧本应得高分', () => {
  const res = suspenseTensionCurve(EN_HEALTHY, 'en');
  assert.ok(res.score >= 65, `expected >=65, got ${res.score}`);
  assert.ok(res.totalSignals >= 5, `signals=${res.totalSignals}`);
});

test('英文张力平铺应触发问题', () => {
  const res = suspenseTensionCurve(EN_FLAT, 'en');
  assert.ok(res.curveShape === 'flat', `expected flat, got ${res.curveShape}`);
  assert.ok(res.score < 70, `expected <70, got ${res.score}`);
});

test('张力曲线应返回完整字段', () => {
  const res = suspenseTensionCurve(ZH_HEALTHY, 'zh');
  assert.ok(res.curve.length >= 3);
  assert.ok(typeof res.avgTension === 'number');
  assert.ok(typeof res.maxTension === 'number');
  assert.ok(typeof res.minTension === 'number');
  assert.ok(typeof res.tensionRange === 'number');
  assert.ok(typeof res.climaxSceneIndex === 'number');
  assert.ok(['rising', 'falling', 'wave', 'flat', 'jumpy'].includes(res.curveShape));
});

test('张力点应包含场景序号和命中类型', () => {
  const res = suspenseTensionCurve(ZH_HEALTHY, 'zh');
  for (const p of res.curve) {
    assert.ok(typeof p.sceneIndex === 'number');
    assert.ok(typeof p.tension === 'number');
    assert.ok(p.tension >= 0 && p.tension <= 100);
    assert.ok(Array.isArray(p.hitTypes));
  }
});

test('英文层零中文（advice 字段不得含中文，当 lang=en）', () => {
  const res = suspenseTensionCurve(EN_FLAT, 'en');
  const chineseRe = /[一-鿿]/;
  for (const issue of res.issues) {
    assert.ok(!chineseRe.test(issue.evidence), `evidence 含中文: ${issue.evidence}`);
    assert.ok(!chineseRe.test(issue.advice), `advice 含中文: ${issue.advice}`);
  }
});

test('悬念信号应识别六类', () => {
  const res = suspenseTensionCurve(ZH_HEALTHY, 'zh');
  const allTypes = new Set(res.curve.flatMap((p) => p.hitTypes));
  // 健康剧本至少识别到 3 类以上
  assert.ok(allTypes.size >= 3, `expected >=3 types, got ${allTypes.size}: ${[...allTypes].join(',')}`);
});
