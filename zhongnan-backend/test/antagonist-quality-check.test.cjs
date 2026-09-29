const { test } = require('node:test');
const assert = require('node:assert');
const { antagonistQualityCheck } = require('../dist/engine/antagonist-quality-check.js');

// 中文高质量反派：有施压、有布局、有动机、有筹码、正面对撞、有层次
const ZH_HEALTHY = `场景1：内景·办公室·日
陈总冷笑，把一份转让合同甩在桌上。
陈总：你被开除了，签了这份协议，我逼你今天就把股权过户。
林夏：你这是威胁！
陈总：当年你爸害得我身败名裂，为了吞下整个公司，我设局三年，早就买通了董事会，律师和黑料都在我手里。

场景2：内景·车库·夜
△两个保安拦住林夏，陈总步步逼近，把支票摁在她胸口。
陈总：规矩就是弱肉强食，我当年也是从跪着爬过来的。
林夏：那我就掀了你的局。
陈总：你敢动一下，我立刻把你全家赶出去。`;

// 反派缺席：温情日常，无任何施压者
const ZH_ABSENT = `场景1：内景·花店·日
△林夏细心修剪着向日葵，阳光洒进店里。
顾客：这花真好看，帮我包起来吧，再配一张卡片。
林夏：好的，送你一张手写卡片。

场景2：外景·公园·黄昏
△孩子们在草地上放风筝，林夏坐在长椅上微笑。
林夏：今天真是平静的一天。`;

// 纸老虎反派：只有暴力咆哮，零布局
const ZH_STUPID = `场景1：内景·客厅·日
张磊冲进门，一巴掌扇在林夏脸上。
张磊：废物！给我拿钱来！
林夏：我没有钱。
张磊：我逼你今天必须拿出来，不然把你东西全扔出去！

场景2：内景·客厅·夜
△张磊揪住林夏的胳膊把她按在墙上。
林夏：你放手！
张磊：为了还赌债，我什么都干得出来。
△他摔碎桌上的杯子，碎玻璃溅了一地。`;

// 无动机反派：高压、有布局、正面对撞，但一句动机都没有
const ZH_MOTIVELESS = `场景1：内景·办公室·日
陈总冷笑，拿起钢笔一下下戳着桌面。
陈总：你被开除了，保安，把人请出去。
△保安上前，林夏被死死按在办公桌上。

场景2：内景·会议室·日
△陈总设局栽赃，把伪造的合同甩到林夏面前。
陈总：这份黑料足以让你在行业内消失，保镖就在门外。
△他凑近林夏，眼神阴冷。
陈总：我威胁你？我手里的证据能让你身败名裂。
△他摔门而去。`;

// 幕后反派：只在转述/电话里施压，从不当面对撞
const ZH_OFFSTAGE = `场景1：内景·咖啡馆·日
闺蜜：陈总又放话了，他威胁说要冻结你所有账户。
林夏：他还做了什么？
闺蜜：他设局陷害你，早就收买了你公司的财务，还请了顶级律师。
林夏：他为什么要这样对我？
闺蜜：为了那份股权，他什么都做得出来，听说他手里还有你的黑料。

场景2：内景·林夏家·夜
△林夏接到电话，对面只传来一句：再不收手，开除你的通告明天就见报。
△电话挂断，林夏握着手机，指节发白。
闺蜜：他还逼你主动辞职，否则下次就不是警告了。`;

// 英文高质量反派
const EN_HEALTHY = `INT. OFFICE - DAY
CHEN sneered and slammed a transfer contract on the desk.
CHEN: You're fired. Sign this agreement, or I'll have your mother's treatment stopped.
LIN XIA: This is blackmail!
CHEN: Your father ruined me years ago. In order to swallow this company, I planned everything, bribed the board, and my lawyers hold the shares and the footage.

INT. PARKING GARAGE - NIGHT
Two guards blocked her way. Chen stepped close and pinned the check to her chest.
CHEN: The rules are simple: the weak get eaten. I once crawled up from nothing.
LIN XIA: Then I'll burn your whole game down.
CHEN: Get out of my building, or I'll destroy you and your entire family.`;

// 英文缺席反派
const EN_ABSENT = `INT. FLOWER SHOP - DAY
Lin Xia trimmed sunflowers in the warm sunlight.
CUSTOMER: These are lovely, wrap one for me please.
LIN XIA: Of course, with a free card.

EXT. PARK - DUSK
Children flew kites on the lawn. Lin Xia sat smiling on a bench.`;

// 英文纸老虎反派（用于校验英文输出无中文）
const EN_STUPID = `INT. LIVING ROOM - NIGHT
Zhang grabbed Lin Xia by the collar and slapped her.
ZHANG: You trash! Where is the money!
He shoved her against the wall and raised his fist.
ZHANG: Get out of my sight!
LIN XIA: Stop it!
ZHANG: I want those funds tonight, or things will get ugly.`;

test('中文高质量反派应得高分且无问题', () => {
  const res = antagonistQualityCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.issues.length === 0, `issues: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.pressureCount >= 4, `pressure=${res.pressureCount}`);
  assert.ok(res.competenceCount >= 2, `competence=${res.competenceCount}`);
  assert.ok(res.motiveCount >= 1, `motive=${res.motiveCount}`);
  assert.ok(res.leverageCount >= 3, `leverage=${res.leverageCount}`);
  assert.ok(res.confrontationCount >= 2, `confrontation=${res.confrontationCount}`);
  assert.ok(res.layerCount >= 1, `layer=${res.layerCount}`);
  assert.ok(res.hasDirectConfrontation === true);
});

test('反派缺席应触发 absent_antagonist（high）', () => {
  const res = antagonistQualityCheck(ZH_ABSENT, 'zh');
  const issues = res.issues.filter((i) => i.type === 'absent_antagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
  assert.ok(res.pressureCount === 0, `pressure=${res.pressureCount}`);
  assert.ok(res.score < 80, `score=${res.score}`);
});

test('纸老虎反派应触发 stupid_antagonist（mid）', () => {
  const res = antagonistQualityCheck(ZH_STUPID, 'zh');
  const issues = res.issues.filter((i) => i.type === 'stupid_antagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'mid');
  assert.ok(res.pressureCount >= 3, `pressure=${res.pressureCount}`);
  assert.ok(res.competenceCount === 0, `competence=${res.competenceCount}`);
  assert.ok(res.motiveCount >= 1, `motive=${res.motiveCount}`);
});

test('无动机反派应触发 motiveless_villain（mid）', () => {
  const res = antagonistQualityCheck(ZH_MOTIVELESS, 'zh');
  const issues = res.issues.filter((i) => i.type === 'motiveless_villain');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.pressureCount >= 4, `pressure=${res.pressureCount}`);
  assert.ok(res.competenceCount >= 1, `competence=${res.competenceCount}`);
  assert.ok(res.motiveCount === 0, `motive=${res.motiveCount}`);
});

test('幕后反派应触发 offstage_villain（mid）且不触发其他mid', () => {
  const res = antagonistQualityCheck(ZH_OFFSTAGE, 'zh');
  const offstage = res.issues.filter((i) => i.type === 'offstage_villain');
  assert.ok(offstage.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.pressureCount === 3, `pressure=${res.pressureCount}`);
  assert.ok(res.confrontationCount === 0, `confrontation=${res.confrontationCount}`);
  assert.ok(res.hasDirectConfrontation === false);
  assert.ok(res.motiveCount >= 1);
  assert.ok(res.competenceCount >= 1);
  assert.ok(res.leverageCount >= 1);
});

test('空文本不应崩溃且返回满分', () => {
  const res = antagonistQualityCheck('', 'zh');
  assert.ok(res.score === 100, `score=${res.score}`);
  assert.ok(res.issues.length === 0);
  assert.ok(res.hasDirectConfrontation === false);
});

test('英文高质量反派应得高分且无问题', () => {
  const res = antagonistQualityCheck(EN_HEALTHY, 'en');
  assert.ok(res.score >= 70, `score=${res.score}`);
  assert.ok(res.issues.length === 0, `issues: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.pressureCount >= 4, `pressure=${res.pressureCount}`);
  assert.ok(res.competenceCount >= 2, `competence=${res.competenceCount}`);
  assert.ok(res.confrontationCount >= 2, `confrontation=${res.confrontationCount}`);
});

test('英文缺席反派应触发 absent_antagonist', () => {
  const res = antagonistQualityCheck(EN_ABSENT, 'en');
  const issues = res.issues.filter((i) => i.type === 'absent_antagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
});

test('英文纸老虎反派应触发 stupid_antagonist', () => {
  const res = antagonistQualityCheck(EN_STUPID, 'en');
  const issues = res.issues.filter((i) => i.type === 'stupid_antagonist');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.competenceCount === 0, `competence=${res.competenceCount}`);
});

test('英文模式输出不得含中文', () => {
  const res = antagonistQualityCheck(EN_STUPID, 'en');
  assert.ok(res.issues.length > 0, 'should have issues to verify');
  for (const issue of res.issues) {
    assert.ok(!/[一-龥]/.test(issue.evidence), `evidence: ${issue.evidence}`);
    assert.ok(!/[一-龥]/.test(issue.advice), `advice: ${issue.advice}`);
  }
});

test('分数应在0-100之间', () => {
  for (const [txt, lang] of [[ZH_HEALTHY, 'zh'], [ZH_ABSENT, 'zh'], [ZH_STUPID, 'zh'], [ZH_MOTIVELESS, 'zh'], [ZH_OFFSTAGE, 'zh'], [EN_HEALTHY, 'en'], [EN_ABSENT, 'en'], [EN_STUPID, 'en']]) {
    const res = antagonistQualityCheck(txt, lang);
    assert.ok(res.score >= 0 && res.score <= 100, `score out of range: ${res.score}`);
  }
});

// c213：经济要挟型反派（债务勾销/逼签/医药费/抵押/期限）曾因只有热暴力词典被误判 absent_antagonist
test('c213-中文：软性经济胁迫必须计入反派施压', () => {
  const text = `场景1：内景·老宅·夜
林国栋：只要你肯去我公司上班，债就一笔勾销。明天就报到，工资先还债。
场景2：内景·办公室·日
△林国栋把一份合同推到她面前。
林国栋：签了它，你妈的医药费明天到账。抵押物就是你家那套房子，保证人是你妈。
林国栋：限你明天答复，不签就停水停药。`;
  const res = antagonistQualityCheck(text, 'zh');
  assert.ok(res.pressureCount >= 3, `经济要挟施压应≥3，实际 ${res.pressureCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'absent_antagonist'), '经济要挟型反派不应被误判缺席');
});

test('c213-英文：软性经济胁迫必须计入反派施压', () => {
  const text = `SCENE 1: OFFICE - NIGHT
UNCLE TED slides a contract across the desk.
UNCLE TED: Sign it, and the medical bills are paid tomorrow. The debt is wiped clean. Sign by tomorrow or I keep the collateral.`;
  const res = antagonistQualityCheck(text, 'en');
  assert.ok(res.pressureCount >= 3, `经济要挟施压应≥3，实际 ${res.pressureCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'absent_antagonist'), 'economic-coercion antagonist must not be flagged absent');
  assert.ok(res.confrontationCount >= 1, `当面推合同（slides ... across the desk）应算正面对抗，实际 ${res.confrontationCount}`);
});

// c213：经济犯罪型反派的"聪明的狠"——空壳公司转移、预先代签保证人，不是只会咆哮的纸老虎
test('c213-中文：空壳公司+预先代签算布局，当面摊牌算对抗，被戳穿的失态算层次', () => {
  const text = `场景1：内景·老宅·夜
△林国栋把一摞合同推到她面前，又递来一支笔。
林小凡：我爸的表，怎么在你手上？
△林国栋脸上的笑僵住，下意识把袖口往下扯了扯。
场景2：内景·看台·日
林小凡：这三年我爸公司的三笔转账，收款人全是空壳公司。
场景3：内景·办公室·日
△合同最后一页，保证人一栏已经签了林母的名字，却没有手印。
林国栋脸色一变，伸手就要抢合同。
林国栋：签了它，你妈的医药费明天到账，不签就停水停药。`;
  const res = antagonistQualityCheck(text, 'zh');
  assert.ok(res.competenceCount >= 2, `空壳公司转移+预先代签应算布局≥2，实际 ${res.competenceCount}`);
  assert.ok(res.confrontationCount >= 1, `当面推合同/抢合同应算正面对抗，实际 ${res.confrontationCount}`);
  assert.ok(res.layerCount >= 1, `笑僵住/扯袖口/脸色一变应算人性缝隙，实际 ${res.layerCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'stupid_antagonist'), '有经济犯罪布局的反派不应被判纸老虎');
  assert.ok(!res.issues.some((i) => i.type === 'offstage_villain'), '当面摊牌的反派不应被判不登场');
  assert.ok(!res.issues.some((i) => i.type === 'flat_villain'), '被戳穿时失态的反派不应被判纸片人');
});

test('c213-英文：shell-company scheme + pre-signed guarantor count as strategy, on-stage crack counts as layer', () => {
  const text = `SCENE 1: LIVING ROOM - NIGHT
(Uncle Ted freezes, tugging his cuff down.)
JANE: Three transfers from Dad's company, all to shell companies.
SCENE 2: OFFICE - DAY
(Uncle Ted slides the contracts across the desk and reaches for the file when she hesitates.)
UNCLE TED: Sign it. Her name is already on the guarantor line. The collateral is the family home.`;
  const res = antagonistQualityCheck(text, 'en');
  assert.ok(res.competenceCount >= 1, `shell companies / pre-signed guarantor 应算布局，实际 ${res.competenceCount}`);
  assert.ok(res.confrontationCount >= 1, `slides across desk / reaches for file 应算正面对抗，实际 ${res.confrontationCount}`);
  assert.ok(res.layerCount >= 1, `freezes + tugging cuff 应算裂缝，实际 ${res.layerCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'stupid_antagonist'));
  assert.ok(!res.issues.some((i) => i.type === 'offstage_villain'));
});
