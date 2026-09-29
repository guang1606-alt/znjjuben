const { test } = require('node:test');
const assert = require('node:assert');
const { causalLogicCheck } = require('../dist/engine/causal-logic-check.js');

// 中文健康剧本：动机充分、选择驱动、有兑付
const ZH_HEALTHY = `场景 1：内景·客厅·日
△林晚攥着辞退通知，眼神冰冷。
林晚：因为他掏空了公司，我必须拿回证据，为了我爸留下的产业。
陈总：你一个保洁滚出去！
林晚：我不是来吵架的，所以我带了律师函。

场景 2：外景·地下车库·夜
△林晚蹲守三晚，为的是拍到陈总转移账本的画面。
林晚：就是要等他亲手把证据送出来。
△陈总的车出现，林晚按下录像键。

场景 3：内景·董事会·日
林晚：由于你们签了字，现在这份股权协议生效，我占股51%。
董事：你什么时候……
林晚：我查到了账本，因此今天我才能站在这里。
△众人哗然，陈总瘫坐在椅子上。
林晚：我终于做到了，大仇得报。`;

// 巧合依赖剧本：四处巧合
const ZH_COINCIDENCE = `场景 1：外景·街道·日
△林晚走投无路。
林晚：恰好这时，她捡到了一份合同。
路人：碰巧我认识董事长！
林晚：凑巧董事长今天也在公司。
△董事长正好赶上电梯，看了她一眼。
董事长：我看好你，你当总经理吧。
林晚：谢谢董事长！`;

// 机械降神剧本：结尾救兵凭空出现
const ZH_DEUS = `场景 1：内景·仓库·夜
△林晚被绑在椅子上，陈总拿着刀逼近。
陈总：没人会来救你。
林晚：我必须自己想办法。
△门被撞开。
旁白：救兵赶到，一群警察冲了进来。
陈总：怎么可能！
林晚：我得救了。`;

// 因果稀薄剧本：通篇突然/于是，几乎无动机
const ZH_THIN = `场景 1：内景·房间·日
△林晚突然站起来。
林晚：我走了。
△于是她冲出门。
△然后她突然跑到街上。
△接着她忽然停下。
△随后她突然哭了。
陈总：你干什么？
林晚：我也不知道。`;

// 誓言烂尾剧本
const ZH_OATH = `场景 1：内景·灵堂·夜
△林晚跪在父亲遗像前。
林晚：我发誓，一定要让仇人付出代价！
林晚：你给我等着，陈振东！
陈总：哼。
林晚：此仇不报，誓不为人！
△她转身离开，消失在夜色里。`;

// 信息空降剧本
const ZH_UNSOURCED = `场景 1：内景·书房·日
陈总：你怎么进来的？
林晚：我早知道你会把账本藏在这里。
陈总：不可能！
林晚：我已经知道了你的全部计划。
陈总：你……
林晚：我什么都知道，签字吧。`;

// 英文健康剧本
const EN_HEALTHY = `INT. OFFICE - DAY
LIN WAN: Because he drained the company, I must get the evidence in order to save my father's legacy.
BOSS: Get out, cleaner!
LIN WAN: I didn't come to argue, so I brought a subpoena.

EXT. PARKING GARAGE - NIGHT
Lin Wan waits three nights to film the boss moving the ledgers.
LIN WAN: I have to catch him in the act.
She presses record as the car arrives.

INT. BOARDROOM - DAY
LIN WAN: Since you all signed, this equity agreement now gives me 51%.
DIRECTOR: How did you...
LIN WAN: I found the ledgers, therefore I stand here today.
The boss collapses into his chair.
LIN WAN: I finally did it. I got my revenge.`;

test('中文健康剧本因果逻辑应得高分且无high级问题', () => {
  const res = causalLogicCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.causationCount >= 4, `causation=${res.causationCount}`);
  assert.ok(res.coincidenceCount === 0, `coincidence=${res.coincidenceCount}`);
  assert.ok(res.deusExMachinaHits.length === 0, `deus=${res.deusExMachinaHits.length}`);
  assert.ok(res.payoffCount >= 1, `payoff=${res.payoffCount}`);
  const highs = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highs.length === 0, `highs: ${highs.map((i) => i.type).join(',')}`);
});

test('巧合过载应触发 coincidence_overload', () => {
  const res = causalLogicCheck(ZH_COINCIDENCE, 'zh');
  const issues = res.issues.filter((i) => i.type === 'coincidence_overload');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.coincidenceCount >= 3, `coincidence=${res.coincidenceCount}`);
  assert.ok(res.score < 70, `score=${res.score}`);
});

test('机械降神应触发 deus_ex_machina', () => {
  const res = causalLogicCheck(ZH_DEUS, 'zh');
  const issues = res.issues.filter((i) => i.type === 'deus_ex_machina');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.deusExMachinaHits.length >= 1);
  assert.ok(issues[0].severity === 'high');
});

test('因果稀薄应触发 thin_causation', () => {
  const res = causalLogicCheck(ZH_THIN, 'zh');
  const issues = res.issues.filter((i) => i.type === 'thin_causation');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.suddenCount + res.sequenceCount >= 4, `suddenSeq=${res.suddenCount + res.sequenceCount}`);
});

test('誓言烂尾应触发 unresolved_oath', () => {
  const res = causalLogicCheck(ZH_OATH, 'zh');
  const issues = res.issues.filter((i) => i.type === 'unresolved_oath');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.oathCount >= 2, `oath=${res.oathCount}`);
  assert.ok(res.payoffCount === 0, `payoff=${res.payoffCount}`);
});

test('信息空降应触发 unsourced_knowledge', () => {
  const res = causalLogicCheck(ZH_UNSOURCED, 'zh');
  const issues = res.issues.filter((i) => i.type === 'unsourced_knowledge');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.unsourcedCount >= 2, `unsourced=${res.unsourcedCount}`);
});

test('空文本不应崩溃且不产生问题', () => {
  const res = causalLogicCheck('', 'zh');
  assert.ok(res.score === 100, `score=${res.score}`);
  assert.ok(res.issues.length === 0);
  assert.ok(res.coincidenceCount === 0);
});

test('英文健康剧本应得高分', () => {
  const res = causalLogicCheck(EN_HEALTHY, 'en');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.causationCount >= 3, `causation=${res.causationCount}`);
  assert.ok(res.coincidenceCount === 0, `coincidence=${res.coincidenceCount}`);
  const highs = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highs.length === 0, `highs: ${highs.map((i) => i.type).join(',')}`);
});

test('英文模式输出不得含中文', () => {
  const res = causalLogicCheck(EN_HEALTHY, 'en');
  for (const issue of res.issues) {
    assert.ok(!/[一-龥]/.test(issue.evidence), `evidence: ${issue.evidence}`);
    assert.ok(!/[一-龥]/.test(issue.advice), `advice: ${issue.advice}`);
  }
});

test('分数应在0-100之间', () => {
  for (const [txt, lang] of [[ZH_HEALTHY, 'zh'], [ZH_COINCIDENCE, 'zh'], [ZH_DEUS, 'zh'], [EN_HEALTHY, 'en']]) {
    const res = causalLogicCheck(txt, lang);
    assert.ok(res.score >= 0 && res.score <= 100, `score out of range: ${res.score}`);
  }
});
