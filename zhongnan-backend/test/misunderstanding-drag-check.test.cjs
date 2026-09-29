'use strict';
// v2.140 误会拖延/拒绝沟通检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { misunderstandingDragCheck } = require('../dist/engine/misunderstanding-drag-check.js');

// —— ZH 拒绝沟通 1 次：mid ——
const ZH_REFUSAL = `场景一 客厅 夜
林晚：事情不是你想的那样，你听我解释！
赵天成：我不想听！
赵天成摔门而去。
林晚瘫坐在地。`;

// —— ZH 拒绝沟通 2 次：第二次 high ——
const ZH_REFUSAL_TWICE = `场景一 客厅 夜
林晚：你听我解释！
赵天成：我不听！
赵天成摔门而去。
场景二 公司 日
林晚：不是你想的那样，让我解释。
赵天成：没什么好说的，挂断了电话。`;

// —— ZH 下一场即澄清：合法，resolvedCount=1 ——
const ZH_FAST_CLEAR = `场景一 客厅 夜
林晚：你听我解释！
赵天成：我不想听！摔门而去。
场景二 书房 夜
赵天成看到监控录像证明林晚清白，终于相信她。
赵天成：我错怪你了。`;

// —— ZH 当场澄清：合法 ——
const ZH_SAME_SCENE_CLEAR = `场景一 客厅 夜
林晚：你听我解释，这是个误会。
赵天成：我不想听！
林晚把录像投到屏幕上，证据证明林晚清白，真相大白。
赵天成：我错怪你了，误会终于解除。`;

// —— ZH 误会跨 3 场不解：mid ——
const ZH_REPEAT = `场景一 客厅 夜
赵天成：你误会了。
林晚：我不想再提这件事。
场景二 走廊 日
赵天成：这场误会总得解开。
林晚转身离开。
场景三 办公室 日
赵天成：你还在错怪我。
林晚：别再说了。
场景四 餐厅 夜
赵天成独自喝着闷酒。`;

// —— ZH 误会 2 场即解开：不报 repeat ——
const ZH_REPEAT_CLEARED = `场景一 客厅 夜
赵天成：你误会了。
林晚冷着脸不说话。
场景二 走廊 日
赵天成：这场误会该结束了。
场景三 办公室 日
赵天成放出录音，真相大白。
林晚：我错怪你了。`;

// —— ZH 有嘴不说 2 次：low ——
const ZH_SILENCE = `场景一 病房 夜
林晚看着病床上的母亲，话到嘴边又咽了回去。
赵天成：你想说什么？
场景二 走廊 日
林晚张了张嘴，最终什么都没说。
赵天成默默离开。`;

// —— ZH 欲言又止仅 1 次：不报 ——
const ZH_SILENCE_ONCE = `场景一 病房 夜
林晚看着病床上的母亲，欲言又止。
赵天成：不想说就先休息吧，我给你倒水去。
场景二 走廊 日
赵天成独自站在窗边思考着接下来的安排。`;

// —— ZH 偷听半句定罪：low ——
const ZH_HALF = `场景一 书房外 夜
林晚在门外只听到半句"孩子不是他的"，转身就走。
赵天成在书房里继续打电话谈合作。`;

// —— ZH 偷听 3 处：issues 只记前 2 ——
const ZH_HALF_CAP = `场景一 书房外 夜
林晚在门外只听到半句，转身就走。
赵天成还在打电话。
场景二 卧室外 夜
林晚在门外听到一半就跑开了。
赵天成毫无察觉。
场景三 楼梯间 夜
林晚在门外只听到后半句，扭头就走。
赵天成挂掉了电话。`;

// —— ZH 健康：有解释有倾听有澄清 ——
const ZH_HEALTHY = `场景一 客厅 夜
林晚：你听我解释，这是误会。
赵天成：你说。
林晚递上监控录像，证据证明林晚清白。
赵天成：我错怪你了，误会终于解除。`;

// —— EN refusal mid ——
const EN_REFUSAL = `Scene 1. Living Room - Night
Anna: It's not what you think, let me explain.
Victor: I don't want to hear it!
Victor slammed the door and left.`;

// —— EN refusal twice: second high ——
const EN_REFUSAL_TWICE = `Scene 1. Living Room - Night
Anna: Let me explain, please.
Victor: Save it. He stormed out.
Scene 2. Office - Day
Anna: Hear me out for one minute.
Victor: Nothing to say. He hung up the phone.`;

// —— EN next-scene clarification: bridged ——
const EN_FAST_CLEAR = `Scene 1. Living Room - Night
Anna: Let me explain, please.
Victor: I don't want to hear it. He stormed out.
Scene 2. Study - Night
Victor watched the footage, and the truth finally came out.
Victor: I was wrong about her after all.`;

// —— EN misunderstanding across 3 scenes（避免 explain/refuse 配对）——
const EN_REPEAT = `Scene 1. Hall - Night
Victor: This is one big misunderstanding.
Anna turned her face away in silence.
Scene 2. Corridor - Day
Victor: The misunderstanding between us has lasted too long.
Anna stared out the window quietly.
Scene 3. Office - Day
Victor: You are still mistaken about everything.
Anna kept her eyes on the floor.
Scene 4. Cafe - Night
Victor sat alone with his cold coffee.`;

// —— EN forced silence twice: low ——
const EN_SILENCE = `Scene 1. Ward - Night
Anna swallowed her words and looked at her mother in the bed.
Victor: What is it?
Scene 2. Corridor - Day
Anna bit her tongue and held back the truth.
Victor walked down the corridor alone.`;

// —— EN half truth: low ——
const EN_HALF = `Scene 1. Outside the Study - Night
Anna only heard half of the sentence and ran off into the dark.
Victor kept talking on the phone inside.`;

test('ZH 拒绝沟通 1 次：refusal_to_listen mid', () => {
  const r = misunderstandingDragCheck(ZH_REFUSAL, 'zh');
  assert.strictEqual(r.refusalCount, 1);
  assert.strictEqual(r.issues[0].type, 'refusal_to_listen');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.strictEqual(r.issues[0].scene, 1);
  assert.ok(r.score < 100);
});

test('ZH 拒绝沟通 2 次：出现 high，high 排在前', () => {
  const r = misunderstandingDragCheck(ZH_REFUSAL_TWICE, 'zh');
  assert.strictEqual(r.refusalCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'refusal_to_listen' && i.severity === 'high'));
  assert.strictEqual(r.issues[0].severity, 'high');
});

test('ZH 下一场澄清：零 issue，resolvedCount=1，score=100', () => {
  const r = misunderstandingDragCheck(ZH_FAST_CLEAR, 'zh');
  assert.strictEqual(r.refusalCount, 0);
  assert.strictEqual(r.resolvedCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ZH 当场澄清：零 issue', () => {
  const r = misunderstandingDragCheck(ZH_SAME_SCENE_CLEAR, 'zh');
  assert.strictEqual(r.issueCount, 0);
  assert.ok(r.resolvedCount >= 1);
});

test('ZH 误会跨 3 场不解：misunderstanding_repeat mid，定位末场', () => {
  const r = misunderstandingDragCheck(ZH_REPEAT, 'zh');
  assert.strictEqual(r.repeatCount, 1);
  const issue = r.issues.find((i) => i.type === 'misunderstanding_repeat');
  assert.strictEqual(issue.severity, 'mid');
  assert.strictEqual(issue.scene, 3);
});

test('ZH 误会 2 场后解开：不报 repeat', () => {
  const r = misunderstandingDragCheck(ZH_REPEAT_CLEARED, 'zh');
  assert.strictEqual(r.repeatCount, 0);
  assert.strictEqual(r.issues.filter((i) => i.type === 'misunderstanding_repeat').length, 0);
});

test('ZH 有嘴不说 2 次：forced_silence low，定位首场', () => {
  const r = misunderstandingDragCheck(ZH_SILENCE, 'zh');
  assert.strictEqual(r.forcedSilenceCount, 2);
  const issue = r.issues.find((i) => i.type === 'forced_silence');
  assert.strictEqual(issue.severity, 'low');
  assert.strictEqual(issue.scene, 1);
});

test('ZH 欲言又止仅 1 次：不报', () => {
  const r = misunderstandingDragCheck(ZH_SILENCE_ONCE, 'zh');
  assert.strictEqual(r.forcedSilenceCount, 1);
  assert.strictEqual(r.issues.filter((i) => i.type === 'forced_silence').length, 0);
});

test('ZH 偷听半句：half_truth_conviction low', () => {
  const r = misunderstandingDragCheck(ZH_HALF, 'zh');
  assert.strictEqual(r.halfTruthCount, 1);
  assert.strictEqual(r.issues[0].type, 'half_truth_conviction');
  assert.strictEqual(r.issues[0].severity, 'low');
});

test('ZH 偷听 3 处：只记前 2 处', () => {
  const r = misunderstandingDragCheck(ZH_HALF_CAP, 'zh');
  assert.strictEqual(r.issues.filter((i) => i.type === 'half_truth_conviction').length, 2);
});

test('ZH 健康沟通：满分零 issue', () => {
  const r = misunderstandingDragCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
});

test('EN 拒绝沟通：mid', () => {
  const r = misunderstandingDragCheck(EN_REFUSAL, 'en');
  assert.strictEqual(r.refusalCount, 1);
  assert.strictEqual(r.issues[0].type, 'refusal_to_listen');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

test('EN 拒绝沟通 2 次：high', () => {
  const r = misunderstandingDragCheck(EN_REFUSAL_TWICE, 'en');
  assert.strictEqual(r.refusalCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'refusal_to_listen' && i.severity === 'high'));
});

test('EN 下一场澄清：resolvedCount=1，零 issue', () => {
  const r = misunderstandingDragCheck(EN_FAST_CLEAR, 'en');
  assert.strictEqual(r.resolvedCount, 1);
  assert.strictEqual(r.issueCount, 0);
});

test('EN 误会跨 3 场：misunderstanding_repeat，不误判为 refusal', () => {
  const r = misunderstandingDragCheck(EN_REPEAT, 'en');
  assert.strictEqual(r.repeatCount, 1);
  assert.strictEqual(r.refusalCount, 0);
});

test('EN 有嘴不说 2 次：low', () => {
  const r = misunderstandingDragCheck(EN_SILENCE, 'en');
  assert.strictEqual(r.forcedSilenceCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'forced_silence' && i.severity === 'low'));
});

test('EN 偷听半句：low', () => {
  const r = misunderstandingDragCheck(EN_HALF, 'en');
  assert.strictEqual(r.halfTruthCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'half_truth_conviction'));
});

test('豁免与字段边界：空文本/超短/无标题/分数/排序/scene 计数/统计自洽', () => {
  assert.strictEqual(misunderstandingDragCheck('', 'zh').score, 100);
  assert.strictEqual(misunderstandingDragCheck('短短一句', 'zh').score, 100);
  const noHeader = misunderstandingDragCheck(
    '林晚：你听我解释！\n赵天成：我不听！\n赵天成摔门而去，夜色把他吞没。', 'zh');
  assert.strictEqual(noHeader.sceneCount, 1);
  assert.strictEqual(noHeader.refusalCount, 1);
  // 分数与排序
  const r = misunderstandingDragCheck(ZH_REFUSAL_TWICE, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
  // scene 报告与统计自洽
  const sumByScenes = r.scenes.reduce((a, s) => a + s.contradictionCount, 0);
  assert.strictEqual(sumByScenes, r.issueCount);
  for (const s of r.scenes) {
    assert.strictEqual(s.index >= 1, true);
    assert.strictEqual(typeof s.header, 'string');
  }
  assert.ok(r.signalCount >= r.issueCount);
});
