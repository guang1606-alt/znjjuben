const { test } = require('node:test');
const assert = require('node:assert');
const { payoffRhythmCheck } = require('../dist/engine/payoff-rhythm-check.js');

// 健康憋爽剧：开场快速受压 → 30%内首次反击 → 中段再压再翻盘 → 尾段强兑付（同场合打脸+跪求）
const ZH_HEALTHY = `场景1：内景·宴会厅·日
△宴会厅里，陈家当众退婚：废物，给我滚出去！

场景2：外景·酒店门口·日
△她甩出审计报告：做假账的证据都在。
△记者蜂拥而上，她扳回一局，占了上风。

场景3：内景·会议室·日
△陈总伪造证据诬陷，她的账户被冻结。林夏将计就计当场报警，同时亮出集团授权书——她才是真正的大股东。

场景4：内景·宴会厅·夜
△收购完成，陈总扑通一声跪倒在地：我错了，求你放过陈家！
△全场死寂，所有人目瞪口呆，当初踩她的人眼睁睁看着她转身离场。`;

// 只虐不爽：全集受气包，零翻盘
const ZH_NO_RELEASE = `场景1：内景·家里·日
△婆婆把林夏的行李扔出门外。
婆婆：废物！给我滚出去！
△林夏含泪收拾，被推搡着摔倒在地。

场景2：内景·公司·日
△主管当众羞辱她，把文件甩在她脸上。
主管：你被开除了，立刻消失！
△林夏委屈地站着，同事们嘲笑她，她走投无路。

场景3：外景·街头·夜
△大雨里林夏痛哭，账户被冻结，身无分文，绝望地蹲在路边。
△电话响了，是催债的，她只能哭着挂断。`;

// 一路平推：零受压，主角到处碾压
const ZH_CHEAP = `场景1：内景·会议室·日
△林夏走进来，高管们全体起立。
林夏：这家公司，我收购了。
△对手当场落网，警察铐上了他，全场震惊。

场景2：内景·拍卖行·日
△林夏亮出黑卡，碾压所有竞争者，完胜拿下地块。
众人：原来是首富本人！

场景3：内景·宴会厅·夜
△渣男跪地求饶，林夏冷笑，真相大白，她扬眉吐气地离开。`;

// 憋太久：前 55% 全是受压，第一次翻盘拖到后半
const ZH_DROUGHT = `场景1：内景·家中·日
△林夏被退婚，未婚夫骂她废物。

场景2：内景·公司·日
△她被开除，被同事嘲笑，走投无路。

场景3：外景·街头·日
△账户被冻结，她含泪打零工，又被工头当众羞辱。
△她身无分文，在雨中痛哭，绝望到极点。

场景4：内景·宴会厅·夜
△直到订婚宴当晚，林夏才第一次反击，亮出证据翻盘。
△她当场揭穿阴谋，恶有恶报，对手被抓走，全场哗然。`;

// 羞辱欠账：埋了多个雷，只有一次小赢，没有强兑付
const ZH_UNPAID = `场景1：内景·宴会厅·日
△前夫当众撕毁婚约：废物，你会后悔的！等着瞧！
△婆婆把蛋糕扣在她头上：穷鬼，给我滚出去！

场景2：内景·办公室·日
△林夏拿出录音，和经理对峙，勉强保住了工作。
经理：这次算你占了点理，下不为例。

场景3：内景·家中·夜
△前夫又发来信息嘲讽，林夏只是关掉手机，默默流泪。
△她决定再忍忍，日子还长。`;

// 尾段烂尾：中段有小胜，但尾段又被压回去且无强释放
const ZH_WEAK_TAIL = `场景1：内景·公司·日
△林夏被上司栽赃、被当众羞辱，她调出监控自证清白，占了上风。

场景2：内景·茶水间·日
△同事被挑唆着嘲笑她，林夏甩出业绩数据回击，扳回一局。

场景3：内景·地下车库·夜
△下班时老板带人堵住她，夺过合同撕得粉碎，逼她跪下认错。
△她的手机被摔在地上，人被推倒在地，老板撂下狠话：敢举报，就让你消失。
△她只能眼睁睁看着对方扬长而去，车库里只剩她一个人。`;

// 英文健康憋爽剧（前段压缩，首反击在 40% 前）
const EN_HEALTHY = `INT. BANQUET HALL - DAY
The Chen family called off the wedding publicly: "You're nothing. Get out!"
Lin Xia stood her ground, eyes cold.

EXT. HOTEL ENTRANCE - DAY
Lin Xia produced an audit report and fought back: your cooked books are all in here.
Reporters swarmed, she got the upper hand at last.

INT. BOARDROOM - DAY
Chen framed her and froze her accounts. She called the cops and revealed her true identity: the majority shareholder.

INT. BANQUET HALL - NIGHT
The company was acquired. Chen dropped to his knees, begging for mercy.
The whole room fell silent, everyone was stunned.`;

// 英文只虐不爽
const EN_NO_RELEASE = `INT. HOUSE - DAY
Her mother-in-law kicked her out and called her trash.
She was shoved to the floor, tears streamed down her face.

INT. OFFICE - DAY
Her boss publicly humiliated her and fired her on the spot.
Coworkers laughed. Nowhere to go, she stood there in despair.

EXT. STREET - NIGHT
Her accounts were frozen. She was bankrupt, sobbed in the rain, devastated.`;

// 英文平推（用于零中文校验）
const EN_CHEAP = `INT. OFFICE - DAY
Lin Xia walked in and announced she acquired the company.
Her rival was arrested on the spot, handcuffed, the whole room gasped.

INT. AUCTION - DAY
She crushed every bidder and won it all back with a black card.

INT. BALLROOM - NIGHT
The scumbag dropped to his knees begging. She exposed everything and walked out vindicated.`;

test('中文健康憋爽剧应得高分且无问题', () => {
  const res = payoffRhythmCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 70, `score=${res.score}, issues=${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.issues.length === 0, `issues: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.suppressCount >= 3, `suppress=${res.suppressCount}`);
  assert.ok(res.releaseCount >= 3, `release=${res.releaseCount}`);
  assert.ok(res.strongReleaseCount >= 2, `strong=${res.strongReleaseCount}`);
  assert.ok(res.firstReleasePosition !== null && res.firstReleasePosition < 0.4, `first=${res.firstReleasePosition}`);
  assert.ok(res.tailStrongReleaseCount >= 1, `tailStrong=${res.tailStrongReleaseCount}`);
  assert.ok(res.paidCycles >= 1, `cycles=${res.paidCycles}`);
});

test('只虐不爽应触发 no_release（high）', () => {
  const res = payoffRhythmCheck(ZH_NO_RELEASE, 'zh');
  const issues = res.issues.filter((i) => i.type === 'no_release');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
  assert.ok(res.suppressCount >= 4, `suppress=${res.suppressCount}`);
  assert.ok(res.releaseCount === 0, `release=${res.releaseCount}`);
  assert.ok(res.firstReleasePosition === null);
  assert.ok(res.score <= 75, `score=${res.score}`);
});

test('一路平推应触发 cheap_win（mid）且不触发 no_release', () => {
  const res = payoffRhythmCheck(ZH_CHEAP, 'zh');
  const cheap = res.issues.filter((i) => i.type === 'cheap_win');
  assert.ok(cheap.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(cheap[0].severity === 'mid');
  assert.ok(res.suppressCount === 0, `suppress=${res.suppressCount}`);
  assert.ok(res.releaseCount >= 3, `release=${res.releaseCount}`);
  assert.ok(!res.issues.some((i) => i.type === 'no_release'));
});

test('憋太久应触发 suppression_drought（high）', () => {
  const res = payoffRhythmCheck(ZH_DROUGHT, 'zh');
  const issues = res.issues.filter((i) => i.type === 'suppression_drought');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
  assert.ok(res.firstReleasePosition !== null && res.firstReleasePosition > 0.4, `first=${res.firstReleasePosition}`);
  // 尾段有强兑付，不应触发 no_release
  assert.ok(!res.issues.some((i) => i.type === 'no_release'));
});

test('羞辱欠账应触发 humiliation_unpaid（mid）', () => {
  const res = payoffRhythmCheck(ZH_UNPAID, 'zh');
  const issues = res.issues.filter((i) => i.type === 'humiliation_unpaid');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.humiliationCount >= 2, `humiliation=${res.humiliationCount}`);
  assert.ok(res.releaseCount >= 1, `release=${res.releaseCount}`);
  assert.ok(res.strongReleaseCount === 0, `strong=${res.strongReleaseCount}`);
});

test('尾段烂尾应触发 weak_tail_release（mid）', () => {
  const res = payoffRhythmCheck(ZH_WEAK_TAIL, 'zh');
  const issues = res.issues.filter((i) => i.type === 'weak_tail_release');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.tailSuppressionCount >= 1, `tailSupp=${res.tailSuppressionCount}`);
  assert.ok(res.tailStrongReleaseCount === 0, `tailStrong=${res.tailStrongReleaseCount}`);
});

test('空文本不应崩溃且返回满分', () => {
  const res = payoffRhythmCheck('', 'zh');
  assert.ok(res.score === 100, `score=${res.score}`);
  assert.ok(res.issues.length === 0);
  assert.ok(res.firstReleasePosition === null);
  assert.ok(res.maxSuppressionStretch === 0);
});

test('英文健康憋爽剧应得高分且无问题', () => {
  const res = payoffRhythmCheck(EN_HEALTHY, 'en');
  assert.ok(res.score >= 70, `score=${res.score}, issues=${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.issues.length === 0, `issues: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(res.suppressCount >= 3, `suppress=${res.suppressCount}`);
  assert.ok(res.strongReleaseCount >= 2, `strong=${res.strongReleaseCount}`);
  assert.ok(res.tailStrongReleaseCount >= 1, `tailStrong=${res.tailStrongReleaseCount}`);
});

test('英文只虐不爽应触发 no_release', () => {
  const res = payoffRhythmCheck(EN_NO_RELEASE, 'en');
  const issues = res.issues.filter((i) => i.type === 'no_release');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
  assert.ok(issues[0].severity === 'high');
});

test('英文平推应触发 cheap_win', () => {
  const res = payoffRhythmCheck(EN_CHEAP, 'en');
  const issues = res.issues.filter((i) => i.type === 'cheap_win');
  assert.ok(issues.length === 1, `got: ${res.issues.map((i) => i.type).join(',')}`);
});

test('英文模式输出不得含中文', () => {
  const res = payoffRhythmCheck(EN_NO_RELEASE, 'en');
  assert.ok(res.issues.length > 0, 'should have issues to verify');
  for (const issue of res.issues) {
    assert.ok(!/[一-龥]/.test(issue.evidence), `evidence: ${issue.evidence}`);
    assert.ok(!/[一-龥]/.test(issue.advice), `advice: ${issue.advice}`);
  }
});

test('分数与字段边界合法', () => {
  for (const [txt, lang] of [[ZH_HEALTHY, 'zh'], [ZH_NO_RELEASE, 'zh'], [ZH_CHEAP, 'zh'], [ZH_DROUGHT, 'zh'], [ZH_UNPAID, 'zh'], [ZH_WEAK_TAIL, 'zh'], [EN_HEALTHY, 'en'], [EN_NO_RELEASE, 'en'], [EN_CHEAP, 'en']]) {
    const res = payoffRhythmCheck(txt, lang);
    assert.ok(res.score >= 0 && res.score <= 100, `score out of range: ${res.score}`);
    assert.ok(res.maxSuppressionStretch >= 0 && res.maxSuppressionStretch <= 1, `stretch: ${res.maxSuppressionStretch}`);
    assert.ok(res.paidCycles <= res.releaseCount, `cycles>releases: ${res.paidCycles}>${res.releaseCount}`);
    assert.ok(res.humiliationPaidCount <= res.humiliationCount);
  }
});
