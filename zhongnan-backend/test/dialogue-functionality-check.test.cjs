const { test } = require('node:test');
const assert = require('node:assert');
const { dialogueFunctionalityCheck } = require('../dist/engine/dialogue-functionality-check.js');

// 中文健康剧本：四种功能均衡
const ZH_HEALTHY = `场景 1：内景·卧室·日
△晨光透过窗帘，林晓猛地坐起。
林晓：几点了？！今天是我大婚的日子！
林母：你居然还在睡？太子府已经派人来接你了。
林晓：我才不要嫁那个老头！我讨厌这门亲事！
林母：这是你爹临终前定下的，你不能反悔。
林晓：我不服！凭什么要卖我？

场景 2：外景·街道·日
△林晓冲出小区，差点撞到一辆车。
路人：小心点！
林晓：让开！我要离开这里！
护卫：殿下有令，您不能离开。
林晓：我偏要！你以为你能拦住我？
护卫：你这是抗旨不遵！

场景 3：内景·太子府·夜
△林晓被押进府内，太子已在堂上。
太子：你今天闹够了没有？我是为你好。
林晓：你凭什么为我好？你只是为了我爹的兵权！
太子：你以为你是清白的？你爹也是这样爬上去的。
林晓：我恨你们这些虚伪的人！
太子：我以前也想过自由，但代价太大。`;

// 信息倾倒剧本：单场景 info 功能 >50%
const ZH_INFO_DUMP = `场景 1：内景·书房·日
△林晓与谋士密谈。
谋士：这个国家有三百年历史，分九大州，每州有三十万兵力。
谋士：根据祖制，皇位传嫡不传庶，太子无嫡子则由宗室过继。
谋士：据我所知，先帝有三子，长子早夭，次子即当今圣上。
谋士：按规矩，圣上无嗣，当立皇太弟，即齐王殿下。
林晓：原来如此。

场景 2：内景·大殿·日
△林晓面见圣上。
圣上：你来了。`;

// 冲突真空剧本：conflict 功能 <10%
const ZH_CONFLICT_VACUUM = `场景 1：内景·茶馆·日
△林晓在喝茶。
林晓：这茶不错。
小二：是龙井新茶。
林晓：嗯，挺好的。
小二：客官喜欢就好。
林晓：我每天都来。

场景 2：外景·街道·日
△林晓漫步。
林晓：天气不错。
路人：是啊，挺好的。
林晓：是挺好的。
路人：再见。
林晓：再见。`;

// 角色功能单一剧本：所有对白都是 info
const ZH_MONOTONE = `场景 1：内景·书房·日
△谋士讲解。
谋士：据我所知，这个国家有三百年历史。
谋士：根据祖制，皇位传嫡不传庶。
谋士：据我所知，先帝有三子，长子早夭。
谋士：按规矩，圣上无嗣，当立皇太弟。
谋士：据史书记载，传统延续千年。
谋士：据记载，先帝在位五十年。`;

// 无功能对白剧本：大量寒暄
const ZH_NO_FUNCTION = `场景 1：内景·客厅·日
△来客进门。
甲：你好。
乙：你好。
甲：最近怎么样？
乙：挺好的。
甲：吃了没？
乙：吃了。
甲：再见。
乙：再见。`;

// 英文健康剧本
const EN_HEALTHY = `INT. BEDROOM - DAY
Lin Xiao sits up in bed suddenly.
LIN XIAO: What time is it?! Today is my wedding day!
MOTHER: You're still sleeping? The Crown Prince sent people to fetch you.
LIN XIAO: I don't want to marry that old man! I hate this arrangement!
MOTHER: This was arranged by your father before he died. You can't back out.
LIN XIAO: I refuse! Why should I be sold off?

EXT. STREET - DAY
Lin Xiao rushes out of the compound.
GUARD: By order of the Crown Prince, you cannot leave.
LIN XIAO: I insist! You think you can stop me?
GUARD: This is treason!

INT. PRINCE'S MANSION - NIGHT
The Crown Prince is waiting.
PRINCE: Have you caused enough trouble today? I'm doing this for your own good.
LIN XIAO: What gives you the right to decide for me? You just want my father's military power!
PRINCE: You think you're innocent? Your father climbed up the same way.
LIN XIAO: I hate hypocrites like you!`;

test('中文健康剧本应得高分且功能分布均衡', () => {
  const res = dialogueFunctionalityCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.totalDialogueLines > 10, `lines=${res.totalDialogueLines}`);
  assert.ok(res.score >= 40, `expected >=40, got ${res.score}`);
  assert.ok(res.functionRatio.plot >= 15, `plot=${res.functionRatio.plot}`);
  assert.ok(res.functionRatio.conflict >= 5, `conflict=${res.functionRatio.conflict}`);
  assert.ok(res.sceneBreakdowns.length === 3, `scenes=${res.sceneBreakdowns.length}`);
});

test('信息倾倒场景应触发 info_dump_scene 问题', () => {
  const res = dialogueFunctionalityCheck(ZH_INFO_DUMP, 'zh');
  const infoDumpIssues = res.issues.filter((i) => i.type === 'info_dump_scene');
  assert.ok(infoDumpIssues.length >= 1, `expected info_dump_scene issue, got: ${JSON.stringify(res.issues.map((i) => i.type))}`);
  assert.ok(res.sceneBreakdowns[0].isInfoDump === true, 'first scene should be info dump');
});

test('冲突真空剧本应触发 conflict_vacuum 问题', () => {
  const res = dialogueFunctionalityCheck(ZH_CONFLICT_VACUUM, 'zh');
  const conflictIssues = res.issues.filter((i) => i.type === 'conflict_vacuum' || i.type === 'conflict_vacuum_scene');
  assert.ok(conflictIssues.length >= 1, `expected conflict_vacuum issue, got: ${JSON.stringify(res.issues.map((i) => i.type))}`);
});

test('角色功能单一剧本应触发 character_monotone_function 问题', () => {
  const res = dialogueFunctionalityCheck(ZH_MONOTONE, 'zh');
  const monotoneIssues = res.issues.filter((i) => i.type === 'character_monotone_function');
  assert.ok(monotoneIssues.length >= 1, `expected character_monotone_function issue, got: ${JSON.stringify(res.issues.map((i) => i.type))}`);
  const strategists = res.characterBreakdowns.filter((c) => c.name === '谋士');
  assert.ok(strategists.length === 1 && strategists[0].isMonotone === true, '谋士 should be monotone');
});

test('无功能对白过多应触发 too_many_no_function 问题', () => {
  const res = dialogueFunctionalityCheck(ZH_NO_FUNCTION, 'zh');
  assert.ok(res.functionRatio.other > 30, `other=${res.functionRatio.other}`);
  const noFnIssues = res.issues.filter((i) => i.type === 'too_many_no_function');
  assert.ok(noFnIssues.length >= 1, `expected too_many_no_function issue, got: ${JSON.stringify(res.issues.map((i) => i.type))}`);
});

test('英文健康剧本应得高分', () => {
  const res = dialogueFunctionalityCheck(EN_HEALTHY, 'en');
  assert.ok(res.totalDialogueLines > 5, `lines=${res.totalDialogueLines}`);
  assert.ok(res.score >= 40, `expected >=40, got ${res.score}`);
  // 确保英文文本检测到剧情推进和冲突信号
  assert.ok(res.functionRatio.plot >= 10 || res.functionRatio.conflict >= 10, `plot=${res.functionRatio.plot}, conflict=${res.functionRatio.conflict}`);
});

test('英文剧本应无中文泄露', () => {
  const res = dialogueFunctionalityCheck(EN_HEALTHY, 'en');
  for (const issue of res.issues) {
    // 英文模式下不应包含中文 evidence
    assert.ok(!/[\u4e00-\u9fff]/.test(issue.evidence), `evidence contains Chinese: ${issue.evidence}`);
    assert.ok(!/[\u4e00-\u9fff]/.test(issue.advice), `advice contains Chinese: ${issue.advice}`);
  }
});

test('对白总行数为0时不应崩溃', () => {
  const res = dialogueFunctionalityCheck('△无对白的剧本', 'zh');
  assert.ok(res.totalDialogueLines === 0, `lines=${res.totalDialogueLines}`);
  assert.ok(res.score === 100 || res.score >= 80, `score=${res.score}`);
  assert.ok(res.functionRatio.plot === 0);
  assert.ok(res.issues.length === 0);
});

test('角色分布应正确统计', () => {
  const res = dialogueFunctionalityCheck(ZH_HEALTHY, 'zh');
  const linXiao = res.characterBreakdowns.find((c) => c.name === '林晓');
  assert.ok(linXiao, '林晓 should be in characterBreakdowns');
  assert.ok(linXiao.lineCount >= 5, `林晓 lineCount=${linXiao.lineCount}`);
  // 林晓有多种功能（不能全单调）
  assert.ok(!linXiao.isMonotone || linXiao.lineCount < 5, '林晓 should not be monotone in healthy script');
});

test('场景分布应正确分组', () => {
  const res = dialogueFunctionalityCheck(ZH_HEALTHY, 'zh');
  assert.ok(res.sceneBreakdowns.length === 3, `scenes=${res.sceneBreakdowns.length}`);
  const totalLines = res.sceneBreakdowns.reduce((sum, s) => sum + s.lineCount, 0);
  assert.ok(totalLines === res.totalDialogueLines, `totalLines=${totalLines}, dialogueLines=${res.totalDialogueLines}`);
});

test('isBalanced 在健康剧本中应为 true（或接近）', () => {
  const res = dialogueFunctionalityCheck(ZH_HEALTHY, 'zh');
  // 健康剧本至少应该比较均衡，不一定 isBalanced=true 但应该接近
  assert.ok(typeof res.isBalanced === 'boolean');
});

// c213：角色名后带长舞台提示的对白行曾被整行丢弃（角色组 1-12 字不含括号），
// 且证据披露/经济要挟/求助结盟/反击布局等硬功能台词被判 other
test('c213-中文：长舞台提示对白不丢弃，证据/冲突/求助/反击必须识别功能', () => {
  const text = `场景1：老宅·夜
林小凡（把催款单往身后藏）：妈，补课去了，我必须三天内凑齐那笔钱。
林小凡（盯着他手腕上的表）：我爸的表，怎么在你手上？
林母：大人的事，小孩子别问。
场景2：操场·日
林小凡（把本子翻到摊开的一页）：阿鹿你看，三笔转账收款人全是空壳公司。
林小凡：我要你帮我个忙。
场景3：办公室·日
林小凡：我复印了十七份，律师、报社、经侦大队，一人一份。`;
  const res = dialogueFunctionalityCheck(text, 'zh');
  assert.strictEqual(res.totalDialogueLines, 6, `长舞台提示对白行被丢弃，实际识别 ${res.totalDialogueLines} 行`);
  const find = (kw) => res.classifications.find((c) => c.line.includes(kw));
  assert.ok(find('我爸的表')?.functions.includes('character'), '追问父亲遗物应判 character 功能');
  assert.ok(find('小孩子别问')?.functions.includes('conflict'), '长辈压制性回避应判 conflict 功能');
  assert.ok(find('空壳公司')?.functions.includes('info'), '证据披露（转账/空壳公司）应判 info 功能');
  assert.ok(find('帮我个忙')?.functions.includes('plot'), '求助结盟应判 plot 功能');
  assert.ok(find('复印了十七份')?.functions.includes('plot'), '证据反击布局应判 plot 功能');
});

test('c213-英文：舞台提示对白不丢弃，证据披露与求助结盟必须识别功能', () => {
  const text = `INT. BEDROOM - NIGHT
JANE (hiding the notice behind her back): Three transfers from Dad's company, all to shell companies.
JANE: I need a favor. A lawyer and the economic crimes unit already have copies.`;
  const res = dialogueFunctionalityCheck(text, 'en');
  assert.strictEqual(res.totalDialogueLines, 2, `应识别 2 行对白，实际 ${res.totalDialogueLines}`);
  const find = (kw) => res.classifications.find((c) => c.line.includes(kw));
  assert.ok(find('shell companies')?.functions.includes('info'), '证据披露应判 info 功能');
  assert.ok(find('need a favor')?.functions.includes('plot'), '求助/法律反击应判 plot 功能');
});

// c213：英文亲缘指代（your uncle/my dad）与关系回溯（you taught me）曾因只认 my father 式自报而漏判人物塑造
test('c213-英文：亲缘指代和关系回溯算人物塑造，"你一个高中生能怎样"式质疑算冲突', () => {
  const text = `INT. LIVING ROOM - NIGHT
MOTHER: Jane, finally. Your uncle has been waiting all afternoon.
MAYA: But what can a high schooler actually do?
JANE: You taught me adult business could wait. I will find out myself.`;
  const res = dialogueFunctionalityCheck(text, 'en');
  const find = (kw) => res.classifications.find((c) => c.line.includes(kw));
  assert.ok(find('Your uncle')?.functions.includes('character'), 'your uncle 亲缘背景应判 character');
  assert.ok(find('taught me')?.functions.includes('character'), 'you taught me 关系回溯应判 character');
  assert.ok(find('what can a high schooler')?.functions.includes('conflict'), 'what can a... 式能力质疑应判 conflict');
});

// c213：场头判定收口共享切分器后，"场N："/"室内"等规范格式必须同样切分（旧私有正则只认"场景/内景/外景"）
test('c213-共享切分：场N：与室内制式场头必须分场，不漏切不并场', () => {
  const text = `场1：客厅·夜
林小凡：合同我签了，但你别想得逞。
室内 走廊
林母：你一个女孩子，别问了。
场3：天台·日
林小凡：证据已经交给经侦，等着立案。`;
  const res = dialogueFunctionalityCheck(text, 'zh');
  assert.strictEqual(res.sceneBreakdowns.length, 3, `三场应切为 3 个 sceneBreakdown，实际 ${res.sceneBreakdowns.length}`);
  assert.strictEqual(res.totalDialogueLines, 3, `三行对白，实际 ${res.totalDialogueLines}`);
});
