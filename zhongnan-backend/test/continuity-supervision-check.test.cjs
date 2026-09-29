'use strict';
// v2.139 场记连续性/物理状态穿帮检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { continuitySupervisionCheck } = require('../dist/engine/continuity-supervision-check.js');

// —— 伤势无痕 ——
const ZH_INJURY = `场景一 地下车库 夜
林晚被推到墙上，胳膊中了一刀，鲜血直流。
赵天成：你跑不掉了。
林晚一把推开赵天成，拔腿就追，狂奔出车库。`;

// —— 两处伤势无痕：第二处升级 high ——
const ZH_INJURY_TWICE = `场景一 车库 夜
林晚中了一刀，流着血。
林晚一把推开他，狂奔出去。
场景二 天台 夜
林晚头破血流瘫在地上。
赵天成刚走近，她腾地跳起，拔腿就跑。`;

// —— 跳时后恢复：合法 ——
const ZH_HEAL_SKIP = `场景一 车库 夜
林晚中了一刀，流着血倒在地上。
赵天成：等着。
三天后。
场景二 公寓 日
林晚已经痊愈，活动自如地走到窗前。`;

// —— 同场养伤桥接：合法 ——
const ZH_HEAL_LINE = `场景一 公寓 日
林晚胳膊中了一刀，缠着绷带。
赵天成：伤势如何。
林晚：伤口已经愈合，我活动自如了。`;

// —— 毁物复原 ——
const ZH_OBJECT = `场景一 客厅 日
林晚把那份合同撕得粉碎，纸屑撒了一地。
赵天成：你疯了。
场景二 会议室 日
林晚拿起那份合同，在合同上签了字递给赵天成。`;

// —— 复印件桥接：合法 ——
const ZH_OBJECT_COPY = `场景一 客厅 日
林晚把那份合同撕得粉碎。
赵天成：没用的。
场景二 会议室 日
林晚：我早留了备份件。
林晚拿起复印件，在复印件上签了字。`;

// —— 手机复活 1 次：low ——
const ZH_PHONE = `场景一 天台 夜
赵天成的手机被摔烂，成了两半。
林晚：没人能救你。
场景二 走廊 日
赵天成拿起手机拨通了电话。`;

// —— 手机复活 2 次：第二次 mid ——
const ZH_PHONE_TWICE = `场景一 天台 夜
赵天成的手机被摔烂。
赵天成拿起手机拨通了电话。
场景二 走廊 日
林晚的手机也没电关机了。
林晚的手机突然响了。`;

// —— 换新手机：合法 ——
const ZH_PHONE_NEW = `场景一 天台 夜
赵天成的手机被摔烂。
场景二 走廊 日
赵天成换了一部新手机，拿起手机拨通了电话。`;

// —— 束缚消失 1 次：low ——
const ZH_RESTRAINT = `场景一 仓库 夜
林晚被绑在椅子上，手脚被绑，动弹不得。
赵天成：好好反省。
场景二 宴会厅 夜
林晚大摇大摆地走进宴会厅，出现在发布会现场。`;

// —— 束缚消失 3 次：第三次升级 mid ——
const ZH_RESTRAINT_THREE = `场景一 仓库 夜
林晚被绑在椅子上。
林晚出现在门口。
场景二 地下室 日
林晚被关在地下室里。
林晚已经坐在咖啡厅等人。
场景三 公寓 夜
林晚被反锁在屋里。
林晚推门而入走进会场。`;

// —— 挣脱桥接：合法 ——
const ZH_ESCAPE = `场景一 仓库 夜
林晚被绑在椅子上。
赵天成：等着。
林晚挣脱了绳子，破门而出。
场景二 宴会厅 夜
林晚大摇大摆地走进宴会厅。`;

// —— 英文健康 ——
const EN_HEALTHY = `Scene 1. Garage - Night
Anna clutched her bleeding arm, stabbed in the struggle, and collapsed.
Victor: You are not going anywhere.
Three days later.
Scene 2. Apartment - Day
Anna, fully recovered, moved freely about the kitchen.`;

const EN_INJURY = `Scene 1. Garage - Night
Anna was stabbed in the arm, bleeding heavily, and collapsed on the floor.
Victor: Stay down.
Anna shoved him hard aside and sprinted after him at full speed.`;

const EN_OBJECT = `Scene 1. Office - Day
Anna tore up the contract and burned the pieces.
Victor: You are insane.
Scene 2. Boardroom - Day
Anna picked up the contract and signed the contract with a calm smile.`;

const EN_PHONE = `Scene 1. Rooftop - Night
Victor's phone was smashed, dead, in pieces on the ground.
Anna: No one can save you.
Scene 2. Hallway - Day
Victor picked up his phone and dialed her number.`;

const EN_RESTRAINT = `Scene 1. Warehouse - Night
Anna was tied up to the chair, hands tied behind her.
Victor: Reflect on that.
Scene 2. Ballroom - Night
Anna strolled right into the ballroom and showed up at the venue.`;

test('ZH 伤势无痕：injury_vanish mid', () => {
  const r = continuitySupervisionCheck(ZH_INJURY, 'zh');
  assert.strictEqual(r.stateChangeCount, 1);
  assert.strictEqual(r.injuryVanishCount, 1);
  assert.strictEqual(r.issues[0].type, 'injury_vanish');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.ok(r.score < 100);
});

test('ZH 两处伤势无痕：第二处升级 high', () => {
  const r = continuitySupervisionCheck(ZH_INJURY_TWICE, 'zh');
  assert.strictEqual(r.injuryVanishCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'injury_vanish' && i.severity === 'high'));
});

test('ZH 跳时后恢复：零穿帮', () => {
  const r = continuitySupervisionCheck(ZH_HEAL_SKIP, 'zh');
  assert.strictEqual(r.contradictionCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ZH 同场养伤桥接：零穿帮，bridgedCount≥1', () => {
  const r = continuitySupervisionCheck(ZH_HEAL_LINE, 'zh');
  assert.strictEqual(r.contradictionCount, 0);
  assert.ok(r.bridgedCount >= 1);
});

test('ZH 毁物复原：object_restored mid，定位到合同', () => {
  const r = continuitySupervisionCheck(ZH_OBJECT, 'zh');
  assert.strictEqual(r.objectRestoredCount, 1);
  const issue = r.issues.find((i) => i.type === 'object_restored');
  assert.strictEqual(issue.severity, 'mid');
  assert.strictEqual(issue.key, '合同');
});

test('ZH 复印件/备份桥接：零穿帮', () => {
  const r = continuitySupervisionCheck(ZH_OBJECT_COPY, 'zh');
  assert.strictEqual(r.contradictionCount, 0);
});

test('ZH 手机复活 1 次：low', () => {
  const r = continuitySupervisionCheck(ZH_PHONE, 'zh');
  assert.strictEqual(r.deviceResurrectionCount, 1);
  assert.strictEqual(r.issues[0].severity, 'low');
});

test('ZH 手机复活 2 次：升级 mid', () => {
  const r = continuitySupervisionCheck(ZH_PHONE_TWICE, 'zh');
  assert.strictEqual(r.deviceResurrectionCount, 2);
  assert.ok(r.issues.some((i) => i.type === 'device_resurrection' && i.severity === 'mid'));
});

test('ZH 换新手机：零穿帮，bridgedCount≥1', () => {
  const r = continuitySupervisionCheck(ZH_PHONE_NEW, 'zh');
  assert.strictEqual(r.contradictionCount, 0);
  assert.ok(r.bridgedCount >= 1);
});

test('ZH 束缚消失 1 次：low', () => {
  const r = continuitySupervisionCheck(ZH_RESTRAINT, 'zh');
  assert.strictEqual(r.restraintVanishCount, 1);
  assert.strictEqual(r.issues[0].severity, 'low');
});

test('ZH 束缚消失 3 次：出现 mid', () => {
  const r = continuitySupervisionCheck(ZH_RESTRAINT_THREE, 'zh');
  assert.strictEqual(r.restraintVanishCount, 3);
  assert.ok(r.issues.some((i) => i.type === 'restraint_vanish' && i.severity === 'mid'));
});

test('ZH 挣脱桥接：零穿帮，bridgedCount≥1', () => {
  const r = continuitySupervisionCheck(ZH_ESCAPE, 'zh');
  assert.strictEqual(r.contradictionCount, 0);
  assert.ok(r.bridgedCount >= 1);
});

test('EN 健康：受伤+跳时+痊愈，零穿帮', () => {
  const r = continuitySupervisionCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.stateChangeCount, 1);
  assert.strictEqual(r.contradictionCount, 0);
  assert.strictEqual(r.score, 100);
});

test('EN 伤势无痕：injury_vanish', () => {
  const r = continuitySupervisionCheck(EN_INJURY, 'en');
  assert.strictEqual(r.injuryVanishCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'injury_vanish'));
});

test('EN 毁物复原：object_restored 定位 contract', () => {
  const r = continuitySupervisionCheck(EN_OBJECT, 'en');
  assert.strictEqual(r.objectRestoredCount, 1);
  const issue = r.issues.find((i) => i.type === 'object_restored');
  assert.strictEqual(issue.key, 'contract');
});

test('EN 手机复活：device_resurrection low', () => {
  const r = continuitySupervisionCheck(EN_PHONE, 'en');
  assert.strictEqual(r.deviceResurrectionCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'device_resurrection'));
});

test('EN 束缚消失：restraint_vanish', () => {
  const r = continuitySupervisionCheck(EN_RESTRAINT, 'en');
  assert.strictEqual(r.restraintVanishCount, 1);
  assert.ok(r.issues.some((i) => i.type === 'restraint_vanish'));
});

test('跳时治得了伤、治不了毁物：合同复原仍判穿帮', () => {
  const t = `场景一 客厅 日
林晚中了一刀流着血，把那份合同撕得粉碎。
赵天成：你完了。
三天后。
场景二 会议室 日
林晚活动自如地走进来，拿起那份合同签了字。`;
  const r = continuitySupervisionCheck(t, 'zh');
  assert.strictEqual(r.injuryVanishCount, 0);
  assert.strictEqual(r.objectRestoredCount, 1);
});

test('豁免与字段边界：空文本/超短文本/无标题/分数/排序/scene 序号', () => {
  assert.strictEqual(continuitySupervisionCheck('', 'zh').score, 100);
  assert.strictEqual(continuitySupervisionCheck('短短一句', 'zh').score, 100);
  // 无标题仍按单场扫描
  const noHeader = continuitySupervisionCheck(
    '林晚中了一刀流着血倒在地上。\n赵天成：别装了。\n林晚一把推开他狂奔出去。', 'zh');
  assert.strictEqual(noHeader.sceneCount, 1);
  assert.strictEqual(noHeader.injuryVanishCount, 1);
  // 分数与排序
  const r = continuitySupervisionCheck(ZH_INJURY_TWICE, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
  for (const s of r.scenes) {
    assert.strictEqual(s.index >= 1, true);
    assert.strictEqual(typeof s.contradictionCount, 'number');
  }
  assert.strictEqual(r.contradictionCount, r.injuryVanishCount + r.objectRestoredCount + r.deviceResurrectionCount + r.restraintVanishCount);
});
