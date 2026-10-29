const test = require('node:test');
const assert = require('node:assert');

// v2.352 单场群戏超载检测引擎（Scene Crowd Check）
// 盲区坐实：全引擎零覆盖「单场 distinct 说话人数」。
//  - round-robin-dialogue：管群戏"读稿感"（轮转形式），不管人数多少；
//  - character-balance-check：管全剧戏份比例，不管单场；
//  - information-density-score：管单场信息推进数≥4，不管人数；
//  - dialogue-functionality-check：管信息倾倒，不管人数；
//  - character-presence-check：管全稿不同说话人个数（speakerCount），不切场。
// 边界：同一场 5+ 个角色都开口抢话，观众分不清谁是谁，镜头乱成一锅粥；
// 短剧竖屏尤甚——单屏容不下 5 张脸，AIGC 多角色同框一致性更是灾难。
// 判定（确定性，零 LLM）：
//  - 场切分复用 script-scenes.splitScriptScenes（单一事实源）；
//  - 每场用 character-logic.parseDialogue 提取 distinct 说话人；
//  - 群体标签（众人/群众/同学们/大家/crowd/everyone 等）算 1 个说话人；
//  - 旁白/解说/画外音不计入；
//  - 单场 5-6 人 → mid crowded_scene；≥7 人 → high crowded_scene_overload；
//  - 多场超限累计扣分：score = max(0, 100 - 22×high数 - 10×mid数)；
//  - 空稿/畸形输入 checked=false 满分放行；EN 链路系统文案零中文。

const { sceneCrowdCheck } = require('../dist/engine/scene-crowd-check');

// —— 样例：健康稿（2-3 人/场）——
const HEALTHY = `场景1：医院走廊
△林晚攥着诊断书，医生迎面走来。
医生（叹气）：手术费要五十万，一周内交齐。
林晚（坚定）：我想办法，一定凑齐。
△她转身走进电梯。

场景2：病房
△母亲躺在病床上，林晚削苹果。
母亲（心疼）：孩子，别太累。
林晚（笑）：妈，我不累。
△窗外夕阳西下。`;

// —— 样例：5 人 mid 稿（同场 5 人开口）——
const FIVE_SPEAKERS = `场景1：家庭会议
△林家客厅，五人围坐。
父亲（拍桌）：这事必须今天定！
母亲（急）：你小声点，孩子在里屋。
大哥（冷笑）：怕什么，早晚要知道。
二姐（讥讽）：就是，装什么装。
林晚（平静）：都别吵了，听我说。
△众人安静下来。`;

// —— 样例：7 人 high 稿（同场 7 人开口）——
const SEVEN_SPEAKERS = `场景1：董事会
△会议室，长桌两侧坐满。
董事长（威严）：今天必须有个结果。
总经理（谄媚）：董事长说得对。
副总（不服）：我反对这个方案。
财务（翻文件）：账目有问题。
法务（推眼镜）：合同条款要重看。
秘书（小声）：茶凉了，要换吗？
林晚（站起来）：我有证据。
△众人哗然。`;

// —— 样例：4 人边界不报——
const FOUR_SPEAKERS = `场景1：咖啡厅
△四人围桌而坐。
林晚（搅咖啡）：最近怎么样？
苏晴（笑）：老样子，忙。
陈默（点头）：我也是。
周凯（看手机）：群里又炸了。
△四人沉默。`;

// —— 样例：无场头全文按单场（7 人 high）——
const NO_HEADER_OVERLOAD = `△林家客厅，七人吵成一团。
父亲：必须分家！
母亲：不行！
大哥：我同意。
二姐：我反对。
三弟：随便。
四妹：听妈的。
林晚：都闭嘴！
△众人愣住。`;

// —— 样例：群体标签算 1 人（同学们+林晚+老师=3 人，不报）——
const GROUP_AS_ONE = `场景1：教室
△同学们围成一圈。
同学们（齐声）：老师好！
老师（点头）：同学们好。
林晚（举手）：老师，我有个问题。
△老师示意她坐下。`;

// —— 样例：旁白不计入（旁白+5 角色=5 说话人但旁白剔除→4 人，不报）——
const NARRATOR_EXCLUDED = `场景1：天台
△林晚站在天台边缘。
旁白（低沉）：她不知道，身后有五双眼睛。
苏晴（喊）：别跳！
陈默（冲过去）：抓住她！
周凯（报警）：喂，110吗？
保安（拉人）：冷静点！
△林晚被拉回安全区。`;

// —— 样例：多场超限累计（场1 五人 mid + 场2 七人 high）——
const MULTI_SCENE = `场景1：客厅
△五人争吵。
父亲：分！
母亲：不分！
大哥：分！
二姐：不分！
林晚：投票。

场景2：门外
△七人堵住门口。
邻居甲：怎么回事？
邻居乙：吵架了？
邻居丙：报警吧？
邻居丁：别多事。
邻居戊：拍下来。
邻居己：发群里。
林晚：让开！
△她挤出门。`;

// —— 样例：EN 7 人 high 稿——
const EN_OVERLOAD = `SCENE 1: BOARDROOM
The conference room is packed.
CHAIRMAN (stern): We need a decision today.
CEO (flattering): The chairman is right.
VP (defiant): I oppose this plan.
CFO (flipping papers): The accounts are wrong.
LEGAL (adjusting glasses): The contract needs review.
SECRETARY (whispering): The tea is cold.
LIN WAN (standing): I have evidence.
Everyone gasps.`;

test('v2.352 健康稿（2-3 人/场）不误报', () => {
  const r = sceneCrowdCheck(HEALTHY, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.crowdedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
  assert.ok(r.sceneCount >= 2, `sceneCount ${r.sceneCount} should >= 2`);
  assert.ok(r.maxSpeakers <= 3, `maxSpeakers ${r.maxSpeakers} should <= 3`);
});

test('v2.352 5 人/场报 mid crowded_scene', () => {
  const r = sceneCrowdCheck(FIVE_SPEAKERS, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.score, 90); // 100 - 10
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.strictEqual(r.issues[0].type, 'crowded_scene');
  assert.ok(r.issues[0].evidence.includes('5'));
});

test('v2.352 7 人/场报 high crowded_scene_overload', () => {
  const r = sceneCrowdCheck(SEVEN_SPEAKERS, 'zh');
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.score, 78); // 100 - 22
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[0].type, 'crowded_scene_overload');
  assert.ok(r.issues[0].evidence.includes('7'));
});

test('v2.352 4 人/场边界不报', () => {
  const r = sceneCrowdCheck(FOUR_SPEAKERS, 'zh');
  assert.strictEqual(r.crowdedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('v2.352 无场头全文按单场判定（7 人 high）', () => {
  const r = sceneCrowdCheck(NO_HEADER_OVERLOAD, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.sceneCount, 1);
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[0].type, 'crowded_scene_overload');
});

test('v2.352 群体标签（同学们）算 1 人，不重复计', () => {
  const r = sceneCrowdCheck(GROUP_AS_ONE, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.maxSpeakers, 3); // 同学们+老师+林晚
  assert.strictEqual(r.crowdedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.352 旁白不计入说话人数', () => {
  const r = sceneCrowdCheck(NARRATOR_EXCLUDED, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.maxSpeakers, 4); // 苏晴/陈默/周凯/保安
  assert.strictEqual(r.crowdedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('v2.352 多场超限累计扣分（mid+high）', () => {
  const r = sceneCrowdCheck(MULTI_SCENE, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.sceneCount, 2);
  assert.strictEqual(r.crowdedCount, 2);
  assert.strictEqual(r.score, 68); // 100 - 10 - 22
  assert.strictEqual(r.issues.length, 2);
  const sev = r.issues.map((i) => i.severity).sort();
  assert.deepStrictEqual(sev, ['high', 'mid']);
});

test('v2.352 空稿满分放行（checked=false）', () => {
  const r = sceneCrowdCheck('', 'zh');
  assert.strictEqual(r.checked, false);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.sceneCount, 0);
  assert.strictEqual(r.crowdedCount, 0);
});

test('v2.352 畸形输入不崩溃（null/undefined/纯空白）', () => {
  const r1 = sceneCrowdCheck(null, 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.checked, false);
  const r2 = sceneCrowdCheck(undefined, 'zh');
  assert.strictEqual(r2.score, 100);
  const r3 = sceneCrowdCheck('   \n  \n  ', 'zh');
  assert.strictEqual(r3.checked, false);
  assert.strictEqual(r3.score, 100);
});

test('v2.352 结构字段齐全（score/checked/sceneCount/crowdedCount/maxSpeakers/issues）', () => {
  const r = sceneCrowdCheck(SEVEN_SPEAKERS, 'zh');
  assert.ok(typeof r.score === 'number');
  assert.ok(typeof r.checked === 'boolean');
  assert.ok(typeof r.sceneCount === 'number');
  assert.ok(typeof r.crowdedCount === 'number');
  assert.ok(typeof r.maxSpeakers === 'number');
  assert.ok(Array.isArray(r.issues));
  const it = r.issues[0];
  assert.ok(typeof it.severity === 'string');
  assert.ok(typeof it.type === 'string');
  assert.ok(typeof it.evidence === 'string' && it.evidence.length > 0);
  assert.ok(typeof it.advice === 'string' && it.advice.length > 0);
});

test('v2.352 score 恒在 0-100 区间', () => {
  const samples = [HEALTHY, FIVE_SPEAKERS, SEVEN_SPEAKERS, MULTI_SCENE, ''];
  for (const s of samples) {
    const r = sceneCrowdCheck(s, 'zh');
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of range`);
  }
});

test('v2.352 EN 链路报 high 且英文文案零中文', () => {
  const r = sceneCrowdCheck(EN_OVERLOAD, 'en');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.issues[0].type, 'crowded_scene_overload');
  assert.ok(!/[一-龥]/.test(r.issues[0].advice), 'EN advice must contain no Chinese');
  assert.ok(!/[一-龥]/.test(r.issues[0].evidence), 'EN evidence must contain no Chinese');
});

test('v2.352 evidence 含场号/场标与说话人名单', () => {
  const r = sceneCrowdCheck(SEVEN_SPEAKERS, 'zh');
  const ev = r.issues[0].evidence;
  assert.ok(ev.includes('场景1') || ev.includes('场'), 'evidence should carry scene info');
  assert.ok(ev.includes('董事长'), 'evidence should list speaker 董事长');
  assert.ok(ev.includes('林晚'), 'evidence should list speaker 林晚');
});

test('v2.352 群体归一豁免真实生效（5 个个体 + 同学们 + 大家 = 5 人 mid 而非 7 人 high）', () => {
  // 若无群体归一：父亲/母亲/大哥/二姐/林晚/同学们/大家 = 7 个 distinct 名字 → high
  // 有群体归一：5 个体 + __GROUP__ = 6 distinct → 仍 mid（不升档到 high）
  const GROUP_CROWD = `场景1：婚礼
△宴会厅人声鼎沸。
父亲（举杯）：感谢大家来。
母亲（笑）：招待不周。
大哥（敬酒）：新郎官来一个。
二姐（起哄）：亲一个！
林晚（害羞）：别闹了。
同学们（齐声）：百年好合！
大家（鼓掌）：好！
△新人鞠躬致谢。`;
  const r = sceneCrowdCheck(GROUP_CROWD, 'zh');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.maxSpeakers, 6, `maxSpeakers ${r.maxSpeakers} should be 6 (5 个体 + 群体)`);
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.strictEqual(r.issues[0].type, 'crowded_scene');
  assert.strictEqual(r.score, 90);
});

test('v2.352 场切分失效兜底（无场头 7 人 high 已覆盖，这里验证多场 split 边界）', () => {
  // 若 splitScriptScenes 失效（全部并入 1 场），场 1 (2 人) + 场 2 (7 人) 会被合并成 9 人 1 场
  // 正确：sceneCount=2、maxSpeakers=7、报 1 个 high
  const TWO_SCENE_BOUNDARY = `场景1：卧室
△林晚与母亲私语。
母亲（叹气）：你爸他……
林晚（握住手）：我知道。

场景2：客厅
△七人争吵爆发。
父亲：分家！
大哥：同意！
二姐：反对！
三弟：随便。
四妹：听妈的。
舅舅：我来说句公道话。
林晚：都闭嘴！
△众人愣住。`;
  const r = sceneCrowdCheck(TWO_SCENE_BOUNDARY, 'zh');
  assert.strictEqual(r.sceneCount, 2);
  assert.strictEqual(r.maxSpeakers, 7);
  assert.strictEqual(r.crowdedCount, 1);
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.ok(r.issues[0].evidence.includes('场景2'));
});
