'use strict';
// v2.137 场景目的效率检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { scenePurposeCheck } = require('../dist/engine/scene-purpose-check.js');

// —— 中文健康：三场各干一件事，且推进都落在场尾 ——
const ZH_HEALTHY = `场景一 书房
林晚：你凭什么动我的合同。
赵天成：你胡说什么。
林晚：我今天就是来质问你的。
赵天成：你给我滚出去。
林晚：你拍桌子也没用。
赵天成：他冷笑一声，瞪着她。
林晚：今天必须把账算清楚。
场景二 密室
林晚：你看这是什么。
赵天成：一份文件而已。
林晚：这是亲子鉴定。
赵天成：你从哪弄到的。
林晚：监控录像也在我手上。
赵天成：真相竟然是这样。
场景三 走廊
林晚：我决定了。
赵天成：你想干什么。
林晚：现在就去报警。
赵天成：有话好商量。
林晚：律师函今天就发，我拒绝和解。
赵天成：他瘫坐在椅子上。`;

// —— 单场五目的大杂烩（短场、多簇浅尝）：multi mid ——
const ZH_MULTI_ONE = `场景一 天台
林晚：当年的事我一直没敢告诉你。
赵天成：你凭什么骗我。
林晚：我喜欢你很久了。
赵天成：我决定退婚。
林晚：这是录音证据。
赵天成：别说了。`;

// —— 两个多目的稀释场：multi high ——
const ZH_MULTI_TWO = `场景一 天台
林晚：当年的事我一直没敢告诉你。
赵天成：你凭什么骗我。
林晚：我喜欢你很久了。
赵天成：我决定退婚。
林晚：这是录音证据。
赵天成：别说了。
场景二 门口
赵天成：当年那场车祸另有隐情。
林晚：你胡说，闭嘴。
赵天成：我辞职，我决定离开这里。
林晚：我喜欢你。
赵天成：监控录像在我手里。
林晚：你别说了。`;

// —— 两场薄戏重复交代"遗嘱"：duplicate mid ——
const ZH_DUP_ONE = `场景一 老屋
小芳：奶奶当年立过一份遗嘱。
小夏：真的假的。
小芳：这事我只跟你说。
小夏：还有呢。
小芳：时候到了你会知道。
小夏：别卖关子。
场景二 饭桌
小夏：我后来想了想奶奶的遗嘱。
小芳：你怎么又提。
小夏：那份遗嘱到底留给谁。
小芳：我说了别问。
小夏：我心里不踏实。
小芳：等头七过了再说。`;

// —— 三场薄戏重复"遗嘱"：3 对重复 high ——
const ZH_DUP_THREE = `场景一 老屋
小芳：奶奶当年立过一份遗嘱。
小夏：真的假的。
小芳：这事我只跟你说。
小夏：别急。
小芳：时候到了你会知道。
小夏：别卖关子。
场景二 饭桌
小夏：我后来想了想奶奶的遗嘱。
小芳：你怎么又提。
小夏：那份遗嘱到底留给谁。
小芳：先吃饭。
小夏：我心里不踏实。
小芳：头七过了再说。
场景三 灵堂
小夏：遗嘱的事不能再拖了。
小芳：你小声点。
小夏：我就想知道遗嘱内容。
小芳：不怕遭报应吗。
小夏：我等不了了。
小芳：随你的便。`;

// —— 目的迟到：寒暄铺垫到 70% 才进戏 ——
const ZH_LATE = `场景一 客厅
管家：你好，小姐回来了。
林晚：嗯。
管家：先坐下，喝杯茶吧。
林晚：爸爸呢。
管家：董事长在书房。
林晚：今天天气不错。
管家：是啊是啊。
林晚：我决定了，我要退婚，现在就去说。
管家：小姐三思。
林晚：让开。`;

// —— 软收尾：前面有揭晓，场尾落在客套上 ——
const ZH_WEAK_EXIT = `场景一 办公室
林晚：这份亲子鉴定你自己看。
赵总：这不可能。
林晚：真相就在报告上。
赵总：你想怎么样。
林晚：你先想清楚。
赵总：今天先这样，改天再聊。
林晚：你好自为之。`;

// —— 英文健康：冲突场单目的落地 ——
const EN_HEALTHY = `Scene 1. Study
Anna: How dare you touch my contract.
Victor: That's nonsense.
Anna: I'm here to confront you.
Victor: Get out of my office.
Anna: Slamming the table won't help.
Victor: He glared at her and sneered.
Anna: We settle this today.
Scene 2. Corridor
Anna: I've decided.
Victor: What are you doing.
Anna: I'm calling the police now.
Victor: Let's talk about this.
Anna: The lawyers hear from me today; I refuse any deal.
Victor: He collapsed into the chair.`;

// —— 英文两场薄戏重复 "years ago" 同一交代 ——
const EN_DUP_ONE = `Scene 1. Porch
Beth: It happened years ago.
Carl: Tell me.
Beth: I can't say more now.
Carl: Come on.
Beth: You'll know when the time comes.
Carl: You're impossible.
Scene 2. Kitchen
Carl: He left years ago, remember.
Beth: Why bring that up.
Carl: I just keep thinking about it.
Beth: Stop asking.
Carl: I need to know.
Beth: Let it rest.`;

// —— 英文目的迟到：寒暄过半才报决定 ——
const EN_LATE = `Scene 1. Living Room
Butler: Good evening, welcome home.
Nina: Hey.
Butler: Please sit, would you like some tea.
Nina: Where is father.
Butler: In the study.
Nina: Lovely weather today.
Butler: Quite.
Nina: I've decided to call off the wedding, right now.
Butler: Miss, please reconsider.
Nina: Step aside.`;

test('ZH 健康三场景：单目的+场尾落地，零 issue，正信号回补', () => {
  const r = scenePurposeCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.sceneCount, 3);
  assert.ok(r.focusedLandedCount >= 3, '三场都应判为干净落地场');
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.multiPurposeCount, 0);
  assert.strictEqual(r.duplicatePairCount, 0);
  assert.strictEqual(r.score, 100);
  const s1 = r.scenes[0];
  assert.deepStrictEqual(s1.purposes, ['conflict']);
  assert.strictEqual(s1.dominant, 'conflict');
  assert.strictEqual(s1.lands, true);
});

test('ZH 单场五目的浅尝：multi_purpose_scene mid', () => {
  const r = scenePurposeCheck(ZH_MULTI_ONE, 'zh');
  assert.strictEqual(r.multiPurposeCount, 1);
  const issue = r.issues.find((i) => i.type === 'multi_purpose_scene');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(r.scenes[0].purposes.length >= 3);
});

test('ZH 两个稀释场：multi high 闸门', () => {
  const r = scenePurposeCheck(ZH_MULTI_TWO, 'zh');
  assert.strictEqual(r.multiPurposeCount, 2);
  const issue = r.issues.find((i) => i.type === 'multi_purpose_scene');
  assert.strictEqual(issue.severity, 'high');
});

test('ZH 两场重复遗嘱：duplicate_purpose 1 对 mid', () => {
  const r = scenePurposeCheck(ZH_DUP_ONE, 'zh');
  assert.strictEqual(r.duplicatePairCount, 1);
  const issue = r.issues.find((i) => i.type === 'duplicate_purpose');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 三场重复遗嘱：3 对 duplicate high', () => {
  const r = scenePurposeCheck(ZH_DUP_THREE, 'zh');
  assert.strictEqual(r.duplicatePairCount, 3);
  const issue = r.issues.find((i) => i.type === 'duplicate_purpose');
  assert.strictEqual(issue.severity, 'high');
});

test('ZH 目的迟到：首信号 55% 后 + 前置寒暄，late_purpose mid', () => {
  const r = scenePurposeCheck(ZH_LATE, 'zh');
  assert.strictEqual(r.latePurposeCount, 1);
  assert.ok(r.scenes[0].firstPurposeRatio > 0.55);
  const issue = r.issues.find((i) => i.type === 'late_purpose');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 软收尾：weak_exit low，且不误判为拖堂/稀释', () => {
  const r = scenePurposeCheck(ZH_WEAK_EXIT, 'zh');
  assert.strictEqual(r.weakExitCount, 1);
  const issue = r.issues.find((i) => i.type === 'weak_exit');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'low');
  assert.strictEqual(r.multiPurposeCount, 0);
  assert.strictEqual(r.latePurposeCount, 0);
});

test('EN 健康两场景：单目的落地零 issue', () => {
  const r = scenePurposeCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.sceneCount, 2);
  assert.ok(r.focusedLandedCount >= 2);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.scenes[0].dominant, 'conflict');
  assert.strictEqual(r.scenes[1].dominant, 'decision');
});

test('EN 两场重复 years ago：duplicate mid', () => {
  const r = scenePurposeCheck(EN_DUP_ONE, 'en');
  assert.strictEqual(r.duplicatePairCount, 1);
  const issue = r.issues.find((i) => i.type === 'duplicate_purpose');
  assert.strictEqual(issue.severity, 'mid');
});

test('EN 目的迟到：late_purpose mid', () => {
  const r = scenePurposeCheck(EN_LATE, 'en');
  assert.strictEqual(r.latePurposeCount, 1);
  assert.ok(r.scenes[0].firstPurposeRatio > 0.55);
  assert.ok(r.issues.some((i) => i.type === 'late_purpose'));
});

test('长高潮场豁免多目的：≥3 簇但行长 ≥14 不判稀释', () => {
  const lines = ['场景一 宴会厅'];
  // 14 行以上，揭晓+冲突+决定反复强命中（高潮汇流）
  lines.push('林晚：这是亲子鉴定，也是监控录像。');
  lines.push('赵天成：你胡说，闭嘴，你给我滚。');
  lines.push('林晚：我质问你，今天必须算账。');
  lines.push('赵天成：他拍桌子，瞪着她，冷笑。');
  lines.push('林晚：录音证据也在这里。');
  lines.push('赵天成：真相不可能，你伪造的。');
  lines.push('林晚：我决定了，现在就去报警。');
  lines.push('赵天成：你敢，我拒绝接受。');
  lines.push('林晚：律师函已经在路上。');
  lines.push('赵天成：他怒吼，摔门，又停下。');
  lines.push('林晚：签字吧，我拒绝和解。');
  lines.push('赵天成：你凭什么赶尽杀绝。');
  lines.push('林晚：揭穿你只是开始。');
  lines.push('赵天成：他瘫坐，盯着亲子鉴定。');
  const r = scenePurposeCheck(lines.join('\n'), 'zh');
  assert.strictEqual(r.multiPurposeCount, 0, '长高潮场不应判目的稀释');
});

test('无场景标题/空文本/单场健康：满分豁免', () => {
  assert.strictEqual(scenePurposeCheck('', 'zh').score, 100);
  const noHeader = '林晚：我决定了，现在就去报警。\n赵天成：你会后悔的。\n林晚：我拒绝和解。';
  const r0 = scenePurposeCheck(noHeader, 'zh');
  assert.strictEqual(r0.sceneCount, 0);
  assert.strictEqual(r0.score, 100);
  const oneScene = '场景一 书房\n林晚：你凭什么动我的合同。\n赵天成：你胡说。\n林晚：我是来质问你的。\n赵天成：你给我滚。\n林晚：今天必须算账。';
  const r1 = scenePurposeCheck(oneScene, 'zh');
  assert.strictEqual(r1.sceneCount, 1);
  assert.strictEqual(r1.duplicatePairCount, 0);
  assert.strictEqual(r1.issues.length, 0);
});

test('英文文本不被中文信号命中', () => {
  const r = scenePurposeCheck(EN_DUP_ONE, 'zh');
  // 以中文模式解析英文：years ago 不命中任何中文簇，不应产生重复对
  assert.strictEqual(r.duplicatePairCount, 0);
  assert.strictEqual(r.purposefulSceneCount, 0);
});

test('字段边界：分数 0-100、issues 按 severity 排序、scenes 序号连续', () => {
  const r = scenePurposeCheck(ZH_MULTI_TWO, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
  r.scenes.forEach((s, i) => assert.strictEqual(s.index, i + 1));
  for (const s of r.scenes) {
    for (const k of ['exposition', 'conflict', 'decision', 'romance', 'reveal']) {
      assert.ok(typeof s.hits[k] === 'number');
    }
    assert.ok(s.firstPurposeRatio >= 0 && s.firstPurposeRatio <= 1);
    assert.strictEqual(typeof s.lands, 'boolean');
  }
});
