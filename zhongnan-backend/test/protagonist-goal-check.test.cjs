const { test } = require('node:test');
const assert = require('node:assert');
const { protagonistGoalCheck } = require('../dist/engine/protagonist-goal-check.js');

// 中文健康剧本：开场有欲望、全程有障碍与行动、中段目标在、尾段兑付
const ZH_HEALTHY = `场景1：内景·医院走廊·日
△林夏攥着欠费单站在病房外。
林夏：我必须在三天内凑齐十万，否则我妈就得停药。
医生：院里已经下了最后通牒，钱不到账就停药。
林夏：我决定去找陈志强，当年他欠我们家一条命。

场景2：内景·陈氏集团大厅·日
△保安伸手拦住她。
△林夏推开保安，冲进电梯，按下顶层按钮。
助理：陈总不见客，你再闹我叫人了。
林夏：那我就在会议室门口等他出现。

场景3：内景·会议室·日
△林夏冲到陈志强面前，掏出欠条拍在桌上。
林夏：为了我妈，我一定要拿到这笔钱。
陈志强：保安！把她赶出去！
△两个保安扑上来，林夏侧身躲过，把录好的录音笔按在桌上。

场景4：内景·医院病房·夜
△陈志强带着支票来到病房，在缴费单上签了字。
林夏：我终于拿到手术费了，我妈有救了。`;

// 欲望隐形：没有任何第一人称目标
const ZH_INVISIBLE = `场景1：内景·出租屋·日
△林夏坐在床边，看着窗外发呆。
电话响了。
房东：明天再不交租，就搬出去。
△林夏挂了电话，什么也没说。

场景2：外景·街头·日
△她在街上游荡，路人来来往往。
△天开始下雨，她被雨淋湿了。

场景3：内景·便利店·夜
△她盯着货架上的便当，站了很久。`;

// 被动主角：被逼/只好/被迫/眼睁睁/无奈/只能
const ZH_PASSIVE = `场景1：内景·公司·日
经理：你被开除了，现在就走。
△她被逼收拾工位，只好抱着纸箱离开。

场景2：外景·公司门口·日
△男友发来分手短信，她被迫接受这个结果。
△保安把她的东西扔出门，她眼睁睁看着，什么也做不了。

场景3：内景·出租屋·夜
林夏：为什么所有人都要这样对我……
△她无奈地坐在地上，只能等明天再说。`;

// 有目标无障碍：两次欲望，零阻力，有行动
const ZH_NO_OBSTACLE = `场景1：内景·练功房·日
林夏：我要拿到这次的主角名额。
△她冲到把杆前，一遍遍练习旋转。
林夏：我必须成为舞台上最好的那一个。

场景2：外景·剧场舞台·夜
△她跑到舞台中央，掏出音乐碟片放进机器。
△音乐响起，她旋转、起跳、落地，一气呵成。

场景3：内景·后台·日
△评委微笑点头，递来合约。
林夏：谢谢各位老师给我机会。`;

// 有目标无行动：两次欲望，有障碍，零强动作
const ZH_NO_ACTION = `场景1：内景·客厅·日
林夏：我要离婚。
张磊：休想！我绝不会签字。
林夏：我必须离开这个家。

场景2：内景·客厅·夜
△两人沉默对坐，墙上的钟滴答作响。
林夏：这样的日子我一天也过不下去了。
张磊：你哪儿也去不了，老实待着。

场景3：内景·卧室·夜
△林夏和衣躺下，睁着眼直到天亮。`;

// 中段失焦：欲望只在开头和结尾，黄金中段零欲望
const ZH_MID_GAP = `场景1：内景·天台·日
△林夏站在天台边缘，手里攥着一份验伤报告。
林夏：我一定要查清我爸坠楼的真相。

场景2：内景·公司档案室·夜
△保安伸手拦住去路，她侧身溜进消防通道。
△她撬开通风口翻进档案室，翻遍整柜文件，用手机逐页拍照。

场景3：外景·地下车库·夜
△一辆黑色轿车驶入，她蹲守在柱子后面举起相机连拍三张。
△车灯猛地扫过来，车轮贴着她的鞋尖碾过，她一动不动。

场景4：内景·老旧居民楼·日
△她冲上楼敲门，门开了一条缝，她掏出照片举到对方面前。
对方：别问了，知道越多越危险。
△门砰地关上，她站在门外指节攥得发白。

场景5：内景·天台·夜
△城市灯火在她脚下铺开。
林夏：我发誓，绝不会让害他的人逍遥法外。`;

// 英文健康剧本
const EN_HEALTHY = `INT. HOSPITAL CORRIDOR - DAY
LIN XIA: I must raise a hundred thousand in three days, or they stop my mother's treatment.
DOCTOR: The hospital gave a final warning.
LIN XIA: I'm going to find Chen Zhiqiang today. He owes my family.

INT. LOBBY - DAY
A guard blocked my way at the elevator.
Lin Xia pushed through the doors and ran to the stairwell.

INT. BOARDROOM - DAY
She grabbed the IOU and confronted Chen face to face.
LIN XIA: I want that money today, no excuses.
CHEN: Security! Get her out!
She pressed record on the recorder hidden in her pocket.

INT. HOSPITAL WARD - NIGHT
Chen arrived with a signed check.
LIN XIA: I finally got the surgery fee. My mother is saved.`;

// 英文被动主角
const EN_PASSIVE = `INT. OFFICE - DAY
MANAGER: You are fired. Clean your desk now.
Lin Xia was forced to pack her things. She had no choice but to leave.

EXT. STREET - DAY
She watched helplessly as the rain poured down.
A text arrived: we are done.
She was told never to come back. She could only stand there, powerless.`;

test('中文健康剧本应得高分、闭环成立、无high级问题', () => {
  const res = protagonistGoalCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.desireCount >= 3, `desire=${res.desireCount}`);
  assert.ok(res.headDesireCount >= 1, `headDesire=${res.headDesireCount}`);
  assert.ok(res.obstacleCount >= 1, `obstacle=${res.obstacleCount}`);
  assert.ok(res.actionCount >= 3, `action=${res.actionCount}`);
  assert.ok(res.passiveCount === 0, `passive=${res.passiveCount}`);
  assert.ok(res.tailPayoffCount >= 1, `tailPayoff=${res.tailPayoffCount}`);
  assert.ok(res.hasGoalObstacleActionChain === true, 'chain should be true');
  assert.ok(res.agencyRatio === 1, `agency=${res.agencyRatio}`);
  const highs = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highs.length === 0, `highs: ${highs.map((i) => i.type).join(',')}`);
});

test('欲望隐形应触发 invisible_desire（high）', () => {
  const res = protagonistGoalCheck(ZH_INVISIBLE, 'zh');
  const issues = res.issues.filter((i) => i.type === 'invisible_desire');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
  assert.ok(res.headDesireCount === 0);
});

test('被动主角应触发 passive_protagonist（high）且分数低于70', () => {
  const res = protagonistGoalCheck(ZH_PASSIVE, 'zh');
  const issues = res.issues.filter((i) => i.type === 'passive_protagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
  assert.ok(res.passiveCount >= 3, `passive=${res.passiveCount}`);
  assert.ok(res.agencyRatio === 0, `agency=${res.agencyRatio}`);
  assert.ok(res.score < 70, `score=${res.score}`);
});

test('有目标无障碍应触发 goal_no_obstacle（mid）', () => {
  const res = protagonistGoalCheck(ZH_NO_OBSTACLE, 'zh');
  const issues = res.issues.filter((i) => i.type === 'goal_no_obstacle');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.desireCount >= 2, `desire=${res.desireCount}`);
  assert.ok(res.obstacleCount === 0, `obstacle=${res.obstacleCount}`);
  assert.ok(res.actionCount >= 1, `action=${res.actionCount}`);
});

test('有目标无行动应触发 goal_no_action（mid）', () => {
  const res = protagonistGoalCheck(ZH_NO_ACTION, 'zh');
  const issues = res.issues.filter((i) => i.type === 'goal_no_action');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.desireCount >= 2, `desire=${res.desireCount}`);
  assert.ok(res.actionCount === 0, `action=${res.actionCount}`);
  assert.ok(res.obstacleCount >= 1, `obstacle=${res.obstacleCount}`);
});

test('中段目标消失应触发 midpoint_goal_gap（mid）', () => {
  const res = protagonistGoalCheck(ZH_MID_GAP, 'zh');
  const issues = res.issues.filter((i) => i.type === 'midpoint_goal_gap');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  const mid = res.desireHits.filter((h) => h.inMid);
  assert.ok(mid.length === 0, `midDesire=${mid.length}`);
  assert.ok(res.headDesireCount >= 1);
});

test('空文本不应崩溃且返回满分', () => {
  const res = protagonistGoalCheck('', 'zh');
  assert.ok(res.score === 100, `score=${res.score}`);
  assert.ok(res.issues.length === 0);
  assert.ok(res.agencyRatio === 1);
});

test('英文健康剧本应得高分且无high级问题', () => {
  const res = protagonistGoalCheck(EN_HEALTHY, 'en');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.desireCount >= 3, `desire=${res.desireCount}`);
  assert.ok(res.actionCount >= 3, `action=${res.actionCount}`);
  assert.ok(res.hasGoalObstacleActionChain === true);
  const highs = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highs.length === 0, `highs: ${highs.map((i) => i.type).join(',')}`);
});

test('英文被动主角应触发 passive_protagonist', () => {
  const res = protagonistGoalCheck(EN_PASSIVE, 'en');
  const issues = res.issues.filter((i) => i.type === 'passive_protagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.passiveCount >= 3, `passive=${res.passiveCount}`);
});

test('英文模式输出不得含中文', () => {
  const res = protagonistGoalCheck(EN_PASSIVE, 'en');
  assert.ok(res.issues.length > 0, 'should have issues to verify');
  for (const issue of res.issues) {
    assert.ok(!/[一-龥]/.test(issue.evidence), `evidence: ${issue.evidence}`);
    assert.ok(!/[一-龥]/.test(issue.advice), `advice: ${issue.advice}`);
  }
});

test('分数应在0-100之间', () => {
  for (const [txt, lang] of [[ZH_HEALTHY, 'zh'], [ZH_PASSIVE, 'zh'], [ZH_MID_GAP, 'zh'], [EN_HEALTHY, 'en'], [EN_PASSIVE, 'en']]) {
    const res = protagonistGoalCheck(txt, lang);
    assert.ok(res.score >= 0 && res.score <= 100, `score out of range: ${res.score}`);
    assert.ok(res.agencyRatio >= 0 && res.agencyRatio <= 1, `agency out of range: ${res.agencyRatio}`);
  }
});

// c213：经济要挟（勾债/逼签/医药费/期限/抢夺证据）曾 obstacle=0；
// 主角实证反击（录音/复印/律师/经侦/护文件）曾因现在时与非暴力动词 action=0
test('c213-中文：经济要挟算障碍，实证反击算主动行动', () => {
  const text = `场景1：老宅·夜
林小凡：我必须三天内凑齐那笔钱。
林国栋：债一笔勾销，但你得签了它，医药费才到账，限你明天答复。
△林小凡悄悄按下手机录音键。
场景2：办公室·日
△林国栋伸手就要抢合同，林小凡把文件抱进怀里后退。
林小凡：我复印了十七份，律师和经侦一人一份。`;
  const res = protagonistGoalCheck(text, 'zh');
  assert.ok(res.obstacleCount >= 2, `经济要挟障碍应≥2，实际 ${res.obstacleCount}`);
  assert.ok(res.actionCount >= 3, `录音/护文件/复印/律师/经侦行动应≥3，实际 ${res.actionCount}`);
});

test('c213-英文：现在时剧本的抢夺/录音/证据投递算行动，债务合同逼签算障碍', () => {
  const text = `SCENE 1: HALLWAY - NIGHT
JANE: I must find the money within three days.
UNCLE TED: Sign it, or the medical bills are not paid. The debt stays until tomorrow.
(He reaches for the contract. Jane snatches it and steps back, recording his voice.)
JANE: A lawyer and the economic crimes unit already have copies.`;
  const res = protagonistGoalCheck(text, 'en');
  assert.ok(res.obstacleCount >= 2, `economic coercion obstacles should be >=2, got ${res.obstacleCount}`);
  assert.ok(res.actionCount >= 2, `snatches/recording/copies actions should be >=2, got ${res.actionCount}`);
});

// c213：执法到场是取证/复仇短剧的制度化兑付（坏人被带走），不应判 goal_unresolved
test('c213-中文：穿制服的人到场算尾段兑付', () => {
  const text = `场景1：老宅·夜
林小凡：我必须三天内凑齐那笔钱，我要查清我爸的账。
林国栋：签了它，不签就停水停药。
林小凡：我要复印证据，我要报案。
场景2：办公室·日
△两名穿制服的人站在玻璃门外，林国栋被带上了警车。`;
  const res = protagonistGoalCheck(text, 'zh');
  assert.ok(res.payoffCount >= 1, `执法到场应算兑付，实际 payoff=${res.payoffCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'goal_unresolved'), '执法到场兑付后不应判目标无兑付');
});

test('c213-英文：uniformed officers arriving counts as payoff', () => {
  const text = `SCENE 1: HALLWAY - NIGHT
JANE: I must find the money. I will find out who did it. I need the evidence.
SCENE 2: OFFICE - DAY
UNCLE TED: Sign it by tomorrow or I keep the collateral.
(Two uniformed officers stand outside the glass and Ted is led away by police.)`;
  const res = protagonistGoalCheck(text, 'en');
  assert.ok(res.payoffCount >= 1, `officers arriving should count as payoff, got ${res.payoffCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'goal_unresolved'));
});
