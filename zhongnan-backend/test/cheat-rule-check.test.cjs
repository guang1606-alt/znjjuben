'use strict';
// v2.143 金手指规则一致性检测测试（中英双语离线启发式；题材门控 system / rebirth / none）
const test = require('node:test');
const assert = require('node:assert');
const { cheatRuleCheck } = require('../dist/engine/cheat-rule-check.js');

const sum = (r) => r.scenes.reduce((a, s) => a + s.flagCount, 0);
const types = (r) => r.issues.map((i) => i.type);
const sev = (r) => r.issues.map((i) => i.severity);

// —— 1. 空文本 / 超短文本：门控 none 满分 ——
test('empty / short text: gate none full score', () => {
  for (const t of ['', '   ', '太短了']) {
    const r = cheatRuleCheck(t, 'zh');
    assert.strictEqual(r.gate, 'none');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.issueCount, 0);
  }
});

// —— 2. 现实题材（无外挂信号）：门控放行，绝不误伤 ——
test('zh: realistic drama is gated out', () => {
  const txt = `场景一 顾家客厅 夜
顾曼把离婚协议拍在桌上，顾景琛冷笑一声撕得粉碎。
她转身就走，门外大雨滂沱，她连伞都没有回去拿。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.gate, 'none');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.sceneCount, 1);
});

// —— 3. ZH 先立规后使用：无 issue + ruleFirst 正信号 ——
test('zh: rule stated before use is fair', () => {
  const txt = `场景一 酒店套房 夜
系统提示：天眼每天只能使用三次，使用一次会虚脱三分钟。
林晚发动天眼，扫过桌面的合同，果然看见背面的隐藏条款。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.gate, 'system');
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.ruleFirstCount, 1);
  assert.strictEqual(r.useCount, 1);
  assert.strictEqual(r.score, 100);
});

// —— 4. ZH 先用后立规：单次 mid -12 ——
test('zh: ability used before any rule is mid', () => {
  const txt = `场景一 走廊 夜
林晚意念一动，发动异能，门锁应声而开。
她闪身进去，心跳如擂鼓。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.score, 88);
  assert.strictEqual(r.issues[0].type, 'unestablished_cheat');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.match(r.issues[0].evidence, /^第1场：/);
  assert.ok(r.issues[0].advice.length > 20);
});

// —— 5. ZH 先用后立规两次：第二条升 high ——
test('zh: second unestablished use escalates to high', () => {
  const txt = `场景一 走廊 夜
林晚意念一动，发动异能，门锁应声而开。
场景二 档案室 夜
她再次发动异能，档案柜的锁齐齐弹开。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.deepStrictEqual(sev(r), ['high', 'mid']);
  assert.ok(types(r).every((t) => t === 'unestablished_cheat'));
  assert.strictEqual(r.issues[0].scene, 2);
});

// —— 6. 同行事后补规不算（严格更早行铁律）——
test('zh: same-line retroactive rule does not count', () => {
  const txt = `场景一 走廊 夜
林晚发动了异能，这能力每天只能用三次。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].type, 'unestablished_cheat');
  assert.strictEqual(r.ruleFirstCount, 0);
});

// —— 7. ZH 零代价万能外挂：3-4 次 low ——
test('zh: costless cheat used 3 times is low', () => {
  const txt = `场景一 办公室 日
系统规则是：天眼只能查看物品，不能直接查看活人。
林晚发动天眼，看清了合同背面的小字。
她又发动天眼，扫过抽屉里的录音笔。
午后她第三次发动天眼，盯住了保险柜的密码盘。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.useCount, 3);
  assert.strictEqual(r.costCount, 0);
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].type, 'costless_overuse');
  assert.strictEqual(r.issues[0].severity, 'low');
  assert.strictEqual(r.ruleFirstCount, 3);
  assert.strictEqual(r.score, 99);
});

// —— 8. ZH 零代价万能外挂：≥5 次 mid ——
test('zh: costless cheat used 5 times is mid', () => {
  const txt = `场景一 办公室 日
系统规则是：天眼只能查看物品，不能直接查看活人。
林晚发动天眼，看清了合同背面的小字。
她又发动天眼，扫过抽屉里的录音笔。
午后她第三次发动天眼，盯住了保险柜的密码盘。
电梯里她发动天眼，看清对方包里的假证件。
地库她再发动天眼，确认车里没有定位器。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.useCount, 5);
  assert.strictEqual(r.issues[0].type, 'costless_overuse');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

// —— 9. ZH 规则内含代价：豁免零代价 ——
test('zh: cost written into the rule exempts overuse', () => {
  const txt = `场景一 办公室 日
系统提示：天眼每天只能用三次，用一次就会虚脱三分钟。
林晚发动天眼，看清合同背面的小字。
她又发动天眼，扫过抽屉里的录音笔。
午后她第三次发动天眼，盯住了保险柜的密码盘。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 10. ZH 代价兑付：豁免零代价 + costPaid 正信号 ——
test('zh: backlash payout exempts overuse and gives bonus', () => {
  const txt = `场景一 办公室 日
系统提示：天眼只能查看死物留下的痕迹，对活人无效。
林晚发动天眼，看清合同背面的小字。
她又发动天眼，扫过抽屉里的录音笔。
午后她第三次发动天眼，盯住了保险柜的密码盘。
一阵虚脱袭来，她扶着墙缓缓滑坐到地。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.costCount, 1);
  assert.strictEqual(r.costPaidCount, 1);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 11. ZH 临时觉醒无规则：mid ——
test('zh: last-minute unlock without rules is mid', () => {
  const txt = `场景一 天台 夜
匕首已经刺到眼前，情急之下，她突然觉醒了读心术。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.gate, 'system');
  assert.strictEqual(r.unlockCount, 1);
  assert.strictEqual(r.issues[0].type, 'last_minute_unlock');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

// —— 12. ZH 临时觉醒两次：第二条 high ——
test('zh: second ungrounded unlock escalates to high', () => {
  const txt = `场景一 天台 夜
匕首已经刺到眼前，情急之下，她突然觉醒了读心术。
场景二 停车场 夜
危急关头，她陡然觉醒了隔空控物的异能。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.deepStrictEqual(sev(r), ['high', 'mid']);
  assert.ok(types(r).every((t) => t === 'last_minute_unlock'));
});

// —— 13. ZH 有规则无预告的升级：low ——
test('zh: in-system upgrade without foreshadowing is low', () => {
  const txt = `场景一 安全屋 夜
系统规则是：异能只能用于自保，不能主动伤人。
几场恶战之后，她突然激活了新的治愈功能。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].type, 'last_minute_unlock');
  assert.strictEqual(r.issues[0].severity, 'low');
  assert.strictEqual(r.foreseeCount, 0);
});

// —— 14. ZH 有预告的升级：正信号 fairUnlock ——
test('zh: foreshadowed upgrade is fair', () => {
  const txt = `场景一 安全屋 夜
系统规则是：异能只能用于自保，不能主动伤人。
系统提示：只要完成这个任务，就能解锁治愈技能。
三天后任务完成，她激活了新的治愈功能。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.foreseeCount, 1);
  assert.strictEqual(r.fairUnlockCount, 1);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 15. ZH 许愿机：无规则能力同行终结危机 mid ——
test('zh: ungoverned cheat ending the crisis is mid', () => {
  const txt = `场景一 宴会厅 夜
林晚一个念头，发动金手指，冲进来的黑衣人纷纷倒地。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.finishCount, 1);
  assert.strictEqual(r.issues[0].type, 'cheat_solves_all');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.strictEqual(r.score, 89);
  // 同一行不重复计入 unestablished
  assert.ok(!types(r).includes('unestablished_cheat'));
});

// —— 16. ZH 许愿机两次：第二条 high ——
test('zh: second cheat-solves-all escalates to high', () => {
  const txt = `场景一 宴会厅 夜
林晚一个念头，发动金手指，冲进来的黑衣人纷纷倒地。
场景二 地下车库 夜
追兵举起钢管，她意念一动，动用金手指，打手们一排排倒地。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.deepStrictEqual(sev(r), ['high', 'mid']);
  assert.ok(types(r).every((t) => t === 'cheat_solves_all'));
});

// —— 17. ZH 先立规的碾压：豁免许愿机 ——
test('zh: rule-governed crush is exempt', () => {
  const txt = `场景一 宴会厅 夜
系统提示：精神冲击每天只能用一次，用完立刻高烧昏迷。
林晚一个念头，发动金手指，冲进来的黑衣人纷纷倒地。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.finishCount, 1);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 18. ZH 纯重生门控 + 全知零误差：low ——
test('zh: flawless foreknowledge in rebirth story is low', () => {
  const txt = `场景一 婚礼现场 日
重生回到三年前，林晚站在婚礼现场。
上一世的记忆告诉她，这个男人正在撒谎。
她清楚地记得，今天下午三点父亲会接到那通电话。
凭着前世的经验，她提前把股权代持协议锁进了保险柜。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.gate, 'rebirth');
  assert.strictEqual(r.rebirthUseCount, 3);
  assert.strictEqual(r.fluxCount, 0);
  assert.strictEqual(r.issues[0].type, 'flawless_foreknowledge');
  assert.strictEqual(r.issues[0].severity, 'low');
  assert.strictEqual(r.score, 93);
});

// —— 19. ZH 重生 + 蝴蝶效应：豁免全知 ——
test('zh: butterfly effects exempt flawless foreknowledge', () => {
  const txt = `场景一 婚礼现场 日
重生回到三年前，林晚站在婚礼现场。
上一世的记忆告诉她，这个男人正在撒谎。
她清楚地记得，今天下午三点父亲会接到那通电话。
凭着前世的经验，她提前把股权代持协议锁进了保险柜。
可这一世，那个本该出现的律师没有来，历史已经偏离了她知道的轨迹。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.fluxCount, 1);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 20. ZH 纯重生门控 + 新觉醒异能：重生声明不能充当异能规则 ——
test('zh: rebirth declaration is not a rule for a newly awakened power', () => {
  const txt = `场景一 火场 夜
重生回到三年前，林晚一睁眼就看见满屋浓烟。
危急关头，她体内突然涌出一股暖流，觉醒了治愈能力。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.gate, 'rebirth');
  assert.strictEqual(r.ruleCount, 1);
  assert.strictEqual(r.issues[0].type, 'last_minute_unlock');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

// —— 21. EN 门控：现实题材放行 ——
test('en: realistic drama is gated out', () => {
  const txt = `Scene 1. Living Room. Night.
She threw the divorce papers on the table. He tore them up without a word.
She walked out into the rain and did not look back.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.gate, 'none');
  assert.strictEqual(r.score, 100);
});

// —— 22. EN 先立规后使用 ——
test('en: rule stated before use is fair', () => {
  const txt = `Scene 1. Hotel Suite. Night.
The system prompt read: telepathy can only be used three times per day, and every use costs ten health points.
She activated telepathy and read his mind.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.gate, 'system');
  assert.strictEqual(r.ruleFirstCount, 1);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

// —— 23. EN 先用后立规 mid ——
test('en: ability used before any rule is mid', () => {
  const txt = `Scene 1. Corridor. Night.
He used the cheat ability and the safe swung open before anyone could stop him.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.issues[0].type, 'unestablished_cheat');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.match(r.issues[0].evidence, /^Scene 1: /);
});

// —— 24. EN 零代价 low（规则不含代价）——
test('en: costless overuse is low', () => {
  const txt = `Scene 1. Office. Day.
System rule: the ability can only target objects, never people.
She used the ability on the contract and read the fine print.
She used the ability on the drawer holding the recorder.
In the afternoon she used the ability on the safe dial.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.useCount, 3);
  assert.strictEqual(r.issues[0].type, 'costless_overuse');
  assert.strictEqual(r.issues[0].severity, 'low');
});

// —— 25. EN 临时觉醒 mid ——
test('en: last-minute unlock is mid', () => {
  const txt = `Scene 1. Rooftop. Night.
The blade was inches away; at the critical moment, a hidden power suddenly awakened within her.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.issues[0].type, 'last_minute_unlock');
  assert.strictEqual(r.issues[0].severity, 'mid');
});

// —— 26. EN 重生全知零误差 low ——
test('en: flawless foreknowledge is low', () => {
  const txt = `Scene 1. Wedding. Day.
Reborn five years earlier, she stood at the altar again.
In her past life she remembered this exact wedding day.
Past-life memories told her the call would come at three.
Thanks to the rebirth, she knew in advance how the contract would read.`;
  const r = cheatRuleCheck(txt, 'en');
  assert.strictEqual(r.gate, 'rebirth');
  assert.strictEqual(r.rebirthUseCount, 3);
  assert.strictEqual(r.issues[0].type, 'flawless_foreknowledge');
  assert.strictEqual(r.issues[0].severity, 'low');
});

// —— 27. 排序 high→mid→low、scene flagCount 与 issue 数一致 ——
test('sorting and per-scene flag counts are consistent', () => {
  const txt = `场景一 宴会厅 夜
林晚一个念头，发动金手指，冲进来的黑衣人纷纷倒地。
场景二 走廊 夜
她又一个念头，动用金手指，追来的保镖全部倒地。
场景三 天台 夜
匕首刺到眼前，情急之下，她突然觉醒了读心术。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.deepStrictEqual(sev(r), ['high', 'mid', 'mid']);
  assert.deepStrictEqual(types(r), ['cheat_solves_all', 'cheat_solves_all', 'last_minute_unlock']);
  assert.strictEqual(sum(r), r.issues.length);
  assert.strictEqual(r.scenes[0].flagCount, 1);
  assert.strictEqual(r.scenes[1].flagCount, 1);
  assert.strictEqual(r.scenes[2].flagCount, 1);
});

// —— 28. 信号计数自洽：signalCount 覆盖各类命中行 ——
test('signal counts stay consistent', () => {
  const txt = `场景一 套房 夜
系统提示：天眼每天只能使用三次，使用一次会虚脱三分钟。
林晚发动天眼，扫过桌面的合同。
一阵虚脱袭来，她扶住桌沿。`;
  const r = cheatRuleCheck(txt, 'zh');
  assert.strictEqual(r.ruleCount, 1);
  assert.strictEqual(r.useCount, 1);
  assert.strictEqual(r.costCount, 1);
  assert.strictEqual(r.signalCount, 3);
  assert.strictEqual(r.issueCount, 0);
});
