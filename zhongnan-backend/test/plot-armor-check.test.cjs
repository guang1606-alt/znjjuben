'use strict';
// v2.141 反派降智/主角光环检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { plotArmorCheck } = require('../dist/engine/plot-armor-check.js');

// —— ZH 放人 1 次：mid ——
const ZH_SPARES = `场景一 仓库 夜
赵天成把林晚绑在椅子上，枪抵着她的头。
赵天成：处理掉他，做得干净点。
赵天成转身离开，带上了仓库大门。
林晚拼命挣扎。`;

// —— ZH 放人 2 场：第二次 high ——
const ZH_SPARES_TWICE = `场景一 仓库 夜
赵天成把林晚绑在椅子上，枪抵着她的头。
赵天成：处理掉他。赵天成转身离开。
场景二 别墅 夜
林晚再次被擒，跪在他面前无路可退。
赵天成：留你一条狗命，让你多活几天。赵天成拂袖而去。`;

// —— ZH 放人有硬理由：豁免 ——
const ZH_REASON = `场景一 仓库 夜
赵天成把林晚绑在椅子上，刀架在她脖子上。
赵天成：杀了她。
赵天成：不行，需要她亲自签字股权才能过户，留活口，当人质，这里有监控。
赵天成带人离开了仓库。`;

// —— ZH 长篇自白：mid ——
const ZH_MONO = `场景一 密室 夜
赵天成枪指着跪在面前的林晚，她手无寸铁。
赵天成：你知道你为什么会输吗？我不妨告诉你，这一切都是我安排的。
赵天成越说越激动。
林晚趁其不备，一把夺过手枪，猛地撞开他逃走。`;

// —— ZH 自白 2 场：第二次 high ——
const ZH_MONO_TWICE = `场景一 密室 夜
赵天成枪指着跪在面前的林晚。
赵天成：让你死个明白，我告诉你为什么。
林晚趁其不备夺过枪逃走。
场景二 书房 夜
林晚再次被控制，刀架在脖子上。
赵天成：在你死之前，你不是一直想知道真相吗？
林晚猛地挣脱，抄起酒瓶砸过去，逃了出去。`;

// —— ZH 自白但主角没逃成（无逃脱）：不报 ——
const ZH_MONO_NO_ESCAPE = `场景一 密室 夜
赵天成枪指着跪在面前的林晚，她无路可退。
赵天成：让你死个明白，我不妨告诉你这一切。
赵天成说完直接扣下扳机，林晚倒在血泊里。`;

// —— ZH 看守法儿戏：low，连续描写一场只计 1 次 ——
const ZH_RESTRAINT = `场景一 仓库 夜
林晚被绑在椅子上，看守只有一个。
看守喝醉，歪在门边打呼噜。
林晚轻易挣脱绳子，踹开大门逃了出去。`;

// —— ZH 看守 2 场：第二次 mid ——
const ZH_RESTRAINT_TWICE = `场景一 仓库 夜
林晚被绑在椅子上，门没锁。
林晚轻易挣脱，逃了出去。
场景二 地下室 夜
林晚再次被捆住，钥匙还插在锁上。
林晚没费劲就解开，夺门而逃。`;

// —— ZH 智取翻盘：豁免 spares/restraint ——
const ZH_CLEVER = `场景一 仓库 夜
赵天成把林晚绑在椅子上，枪抵着她的头。
赵天成：处理掉他。赵天成转身离开。
林晚用袖中暗藏的刀片划开绳子，将计就计，买通了看守逃走。`;

// —— ZH 主角光环：mid ——
const ZH_ARMOR = `场景一 山道 夜
林晚连中数枪，从山崖滚了下去。
林晚爬起来就跑，拍拍身上的土，像个没事人一样。
赵天成的追兵在后。`;

// —— ZH 主角光环 2 次：第二次 high ——
const ZH_ARMOR_TWICE = `场景一 山道 夜
林晚中了一枪，掉下悬崖。
林晚毫发无伤地站起来，一点事都没有。
场景二 停车场 夜
车子猛地撞在林晚身上。
林晚爬起来就跑，拍拍衣服像没事人一样。`;

// —— ZH 有代价：豁免 armor ——
const ZH_COST = `场景一 山道 夜
林晚连中数枪，从山崖滚了下去。
林晚当场昏迷，抢救了三天，骨折加内脏受伤，住院一个月。`;

// —— ZH 防弹衣：豁免 armor ——
const ZH_VEST = `场景一 仓库 夜
林晚中了一枪，重重摔在地上。
林晚里面穿了件防弹衣，但剧痛让她昏迷了三天，住院手术才保住命。`;

// —— ZH 健康：被抓靠智取脱身 ——
const ZH_HEALTHY = `场景一 密室 夜
赵天成把林晚绑在椅子上。
林晚早就料到这一步，提前在袖口藏好刀片，假意投降。
林晚用刀片磨断绳子，趁看守换班里应外合，反将一军夺门而走。
赵天成发现时只看到空椅子。`;

// —— EN spares mid ——
const EN_SPARES = `Scene 1. Warehouse - Night
Victor had Anna tied to a chair at gunpoint, on her knees and helpless.
Victor: Deal with him. Make it clean.
Victor turned and left the room with his men.
Anna struggled against the ropes.`;

// —— EN spares twice: second high ——
const EN_SPARES_TWICE = `Scene 1. Warehouse - Night
Anna was tied up at gunpoint, at his mercy.
Victor: Take care of him. Victor walked away and left the room.
Scene 2. Villa - Night
Anna was held at gunpoint again, on her knees with no way out.
Victor: Save her for later, let her live a little longer. He strode out.`;

// —— EN hard reason: exempt ——
const EN_REASON = `Scene 1. Warehouse - Night
Victor had Anna tied to a chair with a knife at her throat.
Victor: Finish her off.
Victor: No. I need her alive to sign the shares, keep her as hostage, there are cameras.
Victor led his men out.`;

// —— EN monologue mid ——
const EN_MONO = `Scene 1. Back Room - Night
Victor held Anna at gunpoint on her knees, helpless.
Victor: Before you die, let me tell you why. You want to know why all this happened?
Victor leaned in closer, talking faster.
Anna took the chance, snatched the gun and slammed into him, then escaped.`;

// —— EN restraint low ——
const EN_RESTRAINT = `Scene 1. Warehouse - Night
Anna was tied to a chair. The guard was the only one watching.
The guard was drunk and asleep by the door.
Anna easily broke free, kicked the door open and fled.`;

// —— EN clever escape: exempt ——
const EN_CLEVER = `Scene 1. Warehouse - Night
Anna was tied to a chair at gunpoint.
Victor: Deal with him. He turned and left.
Anna had planned for this, cut through the ropes with a hidden blade and bribed the guard to escape.`;

// —— EN plot armor mid ——
const EN_ARMOR = `Scene 1. Mountain Road - Night
Anna took a bullet and fell off the cliff into the dark.
Anna got up and ran, brushed the dust off as if nothing had happened.
The pursuers were right behind her.`;

// —— EN armor second high ——
const EN_ARMOR_TWICE = `Scene 1. Mountain Road - Night
Anna was shot and fell off the cliff.
Anna stood up unharmed without a scratch.
Scene 2. Parking Lot - Night
A violent car crash threw Anna across the ground.
She got up as if nothing and walked it off.`;

// —— EN cost: exempt ——
const EN_COST = `Scene 1. Mountain Road - Night
Anna took a bullet and fell off the cliff.
She lay unconscious for three days with broken ribs and internal bleeding, straight into surgery.`;

// —— EN healthy: outsmart ——
const EN_HEALTHY = `Scene 1. Back Room - Night
Anna was tied to a chair.
She had planned ahead: a concealed blade in her sleeve, and she feigned surrender.
She cut through the ropes while the bribed guard looked away, one step ahead, and fled through the back door.
Victor found only an empty chair.`;

test('ZH 放人 1 次：villain_spares_hero mid', () => {
  const r = plotArmorCheck(ZH_SPARES, 'zh');
  assert.strictEqual(r.sparesCount, 1);
  assert.strictEqual(r.issues[0].type, 'villain_spares_hero');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.strictEqual(r.issues[0].scene, 1);
});

test('ZH 放人 2 场：出现 high 且排首位', () => {
  const r = plotArmorCheck(ZH_SPARES_TWICE, 'zh');
  assert.strictEqual(r.sparesCount, 2);
  assert.strictEqual(r.issues[0].type, 'villain_spares_hero');
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[0].scene, 2);
});

test('ZH 放人有硬理由（签字/人质/监控）：零 issue', () => {
  const r = plotArmorCheck(ZH_REASON, 'zh');
  assert.strictEqual(r.sparesCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ZH 长篇自白：monologue_delay mid', () => {
  const r = plotArmorCheck(ZH_MONO, 'zh');
  assert.strictEqual(r.monologueCount, 1);
  assert.strictEqual(r.issues[0].type, 'monologue_delay');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

test('ZH 自白 2 场：第二次 high', () => {
  const r = plotArmorCheck(ZH_MONO_TWICE, 'zh');
  assert.strictEqual(r.monologueCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'monologue_delay' && i.severity === 'high'));
});

test('ZH 只自白不逃脱（反派真动手）：不报 monologue', () => {
  const r = plotArmorCheck(ZH_MONO_NO_ESCAPE, 'zh');
  assert.strictEqual(r.monologueCount, 0);
  assert.strictEqual(r.issues.filter((i) => i.type === 'monologue_delay').length, 0);
});

test('ZH 看守法儿戏：low，一场连续描写只计 1 次', () => {
  const r = plotArmorCheck(ZH_RESTRAINT, 'zh');
  assert.strictEqual(r.restraintCount, 1);
  assert.strictEqual(r.issues[0].type, 'incompetent_restraint');
  assert.strictEqual(r.issues[0].severity, 'low');
});

test('ZH 看守 2 场：第二次 mid', () => {
  const r = plotArmorCheck(ZH_RESTRAINT_TWICE, 'zh');
  assert.strictEqual(r.restraintCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'incompetent_restraint' && i.severity === 'mid'));
});

test('ZH 智取翻盘（刀片/将计就计/买通看守）：豁免且加分', () => {
  const r = plotArmorCheck(ZH_CLEVER, 'zh');
  assert.strictEqual(r.sparesCount, 0);
  assert.strictEqual(r.restraintCount, 0);
  assert.ok(r.cleverEscapeCount >= 1);
  assert.strictEqual(r.score, 100);
});

test('ZH 主角光环：plot_armor mid', () => {
  const r = plotArmorCheck(ZH_ARMOR, 'zh');
  assert.strictEqual(r.armorCount, 1);
  assert.strictEqual(r.issues[0].type, 'plot_armor');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

test('ZH 主角光环 2 次：第二次 high', () => {
  const r = plotArmorCheck(ZH_ARMOR_TWICE, 'zh');
  assert.strictEqual(r.armorCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'plot_armor' && i.severity === 'high'));
});

test('ZH 伤害有代价（昏迷/骨折/住院）：豁免 armor', () => {
  const r = plotArmorCheck(ZH_COST, 'zh');
  assert.strictEqual(r.armorCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ZH 提前穿防弹衣 + 剧痛昏迷：豁免 armor', () => {
  const r = plotArmorCheck(ZH_VEST, 'zh');
  assert.strictEqual(r.armorCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ZH 健康剧本（智取脱身）：满分零 issue', () => {
  const r = plotArmorCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
});

test('EN 放人：mid', () => {
  const r = plotArmorCheck(EN_SPARES, 'en');
  assert.strictEqual(r.sparesCount, 1);
  assert.strictEqual(r.issues[0].type, 'villain_spares_hero');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

test('EN 放人 2 场：high', () => {
  const r = plotArmorCheck(EN_SPARES_TWICE, 'en');
  assert.strictEqual(r.sparesCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'villain_spares_hero' && i.severity === 'high'));
});

test('EN 放人有理由（need alive/hostage/cameras）：零 issue', () => {
  const r = plotArmorCheck(EN_REASON, 'en');
  assert.strictEqual(r.sparesCount, 0);
  assert.strictEqual(r.score, 100);
});

test('EN 长篇自白：mid', () => {
  const r = plotArmorCheck(EN_MONO, 'en');
  assert.strictEqual(r.monologueCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'monologue_delay' && i.severity === 'mid'));
});

test('EN 看守法儿戏：low', () => {
  const r = plotArmorCheck(EN_RESTRAINT, 'en');
  assert.strictEqual(r.restraintCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'incompetent_restraint' && i.severity === 'low'));
});

test('EN 智取（planned/hidden blade/bribed）：豁免', () => {
  const r = plotArmorCheck(EN_CLEVER, 'en');
  assert.strictEqual(r.sparesCount, 0);
  assert.strictEqual(r.score, 100);
});

test('EN 主角光环：mid', () => {
  const r = plotArmorCheck(EN_ARMOR, 'en');
  assert.strictEqual(r.armorCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'plot_armor' && i.severity === 'mid'));
});

test('EN 主角光环 2 次：high', () => {
  const r = plotArmorCheck(EN_ARMOR_TWICE, 'en');
  assert.strictEqual(r.armorCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'plot_armor' && i.severity === 'high'));
});

test('EN 伤害代价（unconscious/broken ribs/surgery）：豁免', () => {
  const r = plotArmorCheck(EN_COST, 'en');
  assert.strictEqual(r.armorCount, 0);
  assert.strictEqual(r.score, 100);
});

test('EN 健康剧本：满分', () => {
  const r = plotArmorCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
});

test('豁免与字段边界：空文本/超短/无标题/分数/排序/scene 统计自洽', () => {
  assert.strictEqual(plotArmorCheck('', 'zh').score, 100);
  assert.strictEqual(plotArmorCheck('短短一句', 'zh').score, 100);
  const noHeader = plotArmorCheck(
    '赵天成把林晚绑住，枪抵着她的头，说：处理掉他。赵天成转身离开，夜色吞没仓库。', 'zh');
  assert.strictEqual(noHeader.sceneCount, 1);
  assert.strictEqual(noHeader.sparesCount, 1);
  const r = plotArmorCheck(ZH_SPARES_TWICE, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
  const sumByScenes = r.scenes.reduce((a, s) => a + s.flagCount, 0);
  assert.strictEqual(sumByScenes, r.issueCount);
  for (const s of r.scenes) {
    assert.ok(s.index >= 1);
    assert.strictEqual(typeof s.header, 'string');
  }
  assert.ok(r.signalCount >= r.issueCount);
});
