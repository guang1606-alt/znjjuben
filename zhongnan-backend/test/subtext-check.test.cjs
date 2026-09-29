'use strict';
// v2.135 台词潜台词/信息直给检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { subtextCheck } = require('../dist/engine/subtext-check.js');

// —— 中文健康：信息裹在试探里，情绪靠回避演，≥8 行对白 ——
const ZH_HEALTHY = `场景一 茶室
林晚：材料看完了？
赵天成：你深夜叫我来，不会只为了寒暄。
林晚：茶凉了。
赵天成：少绕弯子，那份东西在哪。
林晚：没什么。
赵天成：三年没见，你倒学会说闲话了。
林晚：随便。
赵天成：上市晚宴，你最好别出现。
林晚：那要看我心情。
赵天成：你会后悔的。
林晚：我累了。`;

// —— 底牌直给：把真实目的和全盘安排原原本本念出口 ——
const ZH_ON_NOSE = `场景一 密室
赵天成：我告诉你一个秘密，我从来没有告诉过任何人。
林晚：你说。
赵天成：我接近你就是为了拿回赵家的股份。
林晚：你……
赵天成：这一切都是我安排的，连那场车祸也在计划里。
苏晴：你疯了。
赵天成：现在你什么都知道了。
林晚：为什么要告诉我这些。
赵天成：因为你已经没有翻盘的机会了。`;

// —— 反派自曝：当面给仇人讲计划 ——
const ZH_VILLAIN = `场景一 仓库
赵天成：你想知道为什么你爸的公司会破产吗？
林晚：是你。
赵天成：既然你输定了，我不妨告诉你，那份合同是我找人伪造的。
林晚：你这个畜生。
赵天成：让我来告诉你，你现在签字还能留一条活路。
林晚：我死也不会签。
赵天成：警察赶到还要二十分钟，足够了。
林晚：你会遭报应的。
赵天成：你是不是一直很好奇我为什么留你到现在？
林晚：我不想听。`;

// —— 向知情者科普：句首"你也知道/我们认识…年/别忘了" ——
const ZH_AYK = `场景一 办公室
周助理：你也知道，我们公司下个月就要上市了，材料不能出任何差错。
林晚：我知道。
周助理：我们认识二十年了，你总该信我一次。
林晚：正是因为认识你，我才不敢信。
周助理：别忘了，当年是我把你从派出所捞出来的。
林晚：所以呢。
周助理：你还记得当年我们挤地下室吗？
林晚：别提了。`;

// —— 问答式喂信息：假提问 + 配合背诵 ——
const ZH_QA = `场景一 老屋
小芳：你知道明天是什么日子吗？
小夏：当然，是妈的忌日，整整十年了。
小芳：你还记得我们第一次来这座城市吗？
小夏：嗯，那时候我们穷得兜里只剩三百块。
小芳：你知道爸是怎么走的吗？
小夏：对，爸是被他们活活逼死的。
小芳：这十年你过得好吗。
小夏：挺好的。`;

// —— 情绪直报：张口就是情绪名 ——
const ZH_NAMED = `场景一 客厅
林晚：我真的好难过，可是我哭不出来。
赵天成：你别这样。
林晚：你让我太失望了，我那么信任你。
赵天成：我也是身不由己。
林晚：我好害怕，害怕醒来以后你不在了。
赵天成：不会的。
林晚：我心里好痛，像被人挖空了一样。
赵天成：跟我回家。`;

// —— 英文健康：回避/嘴硬，无直给 ——
const EN_HEALTHY = `SCENE 1. TEA ROOM
Emma: You're late.
Jack: You didn't call me here for the weather.
Emma: Tea's gone cold.
Jack: Cut the games. Where is it?
Emma: Nothing.
Jack: Three years and you've learned to stall.
Emma: Whatever.
Jack: Don't show up at the IPO dinner.
Emma: Maybe I will, maybe I won't.
Jack: You'll regret this.
Emma: I'm tired.`;

// —— 英文反派自曝 ——
const EN_VILLAIN = `SCENE 1. WAREHOUSE
Jack: You want to know why your father's company went bankrupt?
Emma: It was you.
Jack: Since you're done for, I'll tell you — I forged those signatures myself.
Emma: You monster.
Jack: Did you really think all of this was a coincidence?
Emma: I'll never sign.
Jack: Allow me to explain how this ends.
Emma: Stop.
Jack: Shall I tell you how your father really died?`;

// —— 英文问答喂信息 ——
const EN_QA = `SCENE 1. OLD HOUSE
Amy: Do you know what day tomorrow is?
Bea: Of course, it's mom's anniversary, ten years now.
Amy: Do you know how dad died?
Bea: Yes, they drove him to his grave.
Amy: Don't you remember that night at the hospital?
Bea: Yeah, nobody would let us in.
Amy: I miss them.
Bea: Me too.`;

const CJK = /[一-龥]/;

test('中文健康对白应无问题且识别出潜台词正信号', () => {
  const r = subtextCheck(ZH_HEALTHY, 'zh');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.strictEqual(r.score, 100);
  assert.ok(r.dialogueLineCount >= 8, `对白应≥8行，实际 ${r.dialogueLineCount}`);
  assert.ok(r.deflectionCount >= 3, `回避信号应≥3，实际 ${r.deflectionCount}`);
});

test('两句以上底牌直给应触发 on_the_nose_declaration（high）', () => {
  const r = subtextCheck(ZH_ON_NOSE, 'zh');
  assert.ok(r.onTheNoseCount >= 2, `直给应≥2，实际 ${r.onTheNoseCount}`);
  const o = r.issues.find((i) => i.type === 'on_the_nose_declaration');
  assert.ok(o, '应有 on_the_nose_declaration');
  assert.strictEqual(o.severity, 'high');
  assert.ok(r.score < 85, `应重扣，实际 ${r.score}`);
  // 不应同时误判反派自曝
  assert.ok(!r.issues.some((i) => i.type === 'villain_exposition'));
});

test('反派讲解计划应触发 villain_exposition（mid）且无 high', () => {
  const r = subtextCheck(ZH_VILLAIN, 'zh');
  assert.ok(r.villainExpoCount >= 2, `自曝应≥2，实际 ${r.villainExpoCount}`);
  const v = r.issues.find((i) => i.type === 'villain_exposition');
  assert.ok(v, '应有 villain_exposition');
  assert.strictEqual(v.severity, 'mid');
  assert.ok(!r.issues.some((i) => i.severity === 'high'), JSON.stringify(r.issues));
});

test('向知情者科普应触发 as_you_know（mid），且未被问答组双罚', () => {
  const r = subtextCheck(ZH_AYK, 'zh');
  assert.ok(r.asYouKnowCount >= 2, `科普句应≥2，实际 ${r.asYouKnowCount}`);
  const a = r.issues.find((i) => i.type === 'as_you_know');
  assert.ok(a, '应有 as_you_know');
  assert.strictEqual(a.severity, 'mid');
  // "你还记得当年…吗"虽像提问，但答句不背诵，不应计入 qa 组
  assert.strictEqual(r.qaExpoCount, 0);
});

test('问答式喂信息应触发 qa_exposition（mid）', () => {
  const r = subtextCheck(ZH_QA, 'zh');
  assert.ok(r.qaExpoCount >= 2, `问答组应≥2，实际 ${r.qaExpoCount}`);
  const q = r.issues.find((i) => i.type === 'qa_exposition');
  assert.ok(q, '应有 qa_exposition');
  assert.strictEqual(q.severity, 'mid');
  assert.ok(!r.issues.some((i) => i.type === 'as_you_know'), '问答行不应再判科普');
});

test('多处情绪直报应触发 named_emotion（low）且无更高级别问题', () => {
  const r = subtextCheck(ZH_NAMED, 'zh');
  assert.ok(r.namedEmotionCount >= 3, `直报应≥3，实际 ${r.namedEmotionCount}`);
  const n = r.issues.find((i) => i.type === 'named_emotion');
  assert.ok(n, '应有 named_emotion');
  assert.strictEqual(n.severity, 'low');
  assert.ok(!r.issues.some((i) => i.severity !== 'low'), JSON.stringify(r.issues));
});

test('空文本与对白不足8行应满分豁免', () => {
  const r1 = subtextCheck('', 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.issues.length, 0);
  const r2 = subtextCheck('林晚：我告诉你一个秘密，千万别告诉别人。\n赵天成：你说。', 'zh');
  assert.strictEqual(r2.score, 100);
  assert.strictEqual(r2.dialogueLineCount, 2);
  assert.strictEqual(r2.issues.length, 0);
});

test('英文健康对白应无问题', () => {
  const r = subtextCheck(EN_HEALTHY, 'en');
  assert.strictEqual(r.issues.length, 0, `不应有问题，实际：${JSON.stringify(r.issues)}`);
  assert.strictEqual(r.score, 100);
  assert.ok(r.deflectionCount >= 3, `回避信号应≥3，实际 ${r.deflectionCount}`);
});

test('英文反派自曝应触发 villain_exposition', () => {
  const r = subtextCheck(EN_VILLAIN, 'en');
  assert.ok(r.villainExpoCount >= 2, `自曝应≥2，实际 ${r.villainExpoCount}`);
  assert.ok(r.issues.some((i) => i.type === 'villain_exposition'), JSON.stringify(r.issues));
});

test('英文问答喂信息应触发 qa_exposition', () => {
  const r = subtextCheck(EN_QA, 'en');
  assert.ok(r.qaExpoCount >= 2, `问答组应≥2，实际 ${r.qaExpoCount}`);
  assert.ok(r.issues.some((i) => i.type === 'qa_exposition'), JSON.stringify(r.issues));
});

test('英文模式输出不得含中文', () => {
  for (const fx of [EN_VILLAIN, EN_QA]) {
    const r = subtextCheck(fx, 'en');
    for (const i of r.issues) {
      assert.ok(!CJK.test(i.evidence), `evidence 含中文：${i.evidence}`);
      assert.ok(!CJK.test(i.advice), `advice 含中文：${i.advice}`);
    }
  }
});

test('单句底牌直给应为 mid 而非 high（给单次失言留余地）', () => {
  const txt = `场景一 天台
林晚：你找我。
赵天成：我做这一切都是为了我妈。
林晚：什么意思。
赵天成：没什么好说的了。
林晚：你站住。
赵天成：路是你自己选的。
林晚：我不信。
赵天成：随你。`;
  const r = subtextCheck(txt, 'zh');
  assert.strictEqual(r.onTheNoseCount, 1);
  const o = r.issues.find((i) => i.type === 'on_the_nose_declaration');
  assert.ok(o && o.severity === 'mid', JSON.stringify(r.issues));
});

test('字段边界合法', () => {
  const r = subtextCheck(ZH_HEALTHY, 'zh');
  assert.ok(Number.isFinite(r.score) && r.score >= 0 && r.score <= 100);
  for (const k of ['onTheNoseCount', 'villainExpoCount', 'asYouKnowCount', 'qaExpoCount', 'namedEmotionCount', 'deflectionCount']) {
    assert.ok(Number.isInteger(r[k]) && r[k] >= 0, `${k} 应为非负整数`);
  }
  for (const i of r.issues) {
    assert.ok(['high', 'mid', 'low'].includes(i.severity));
    assert.ok(i.evidence.length > 0 && i.advice.length > 0);
  }
});
