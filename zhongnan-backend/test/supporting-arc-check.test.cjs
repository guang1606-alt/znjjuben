'use strict';
// v2.136 配角弧光/群像变化检测测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { supportingArcCheck } = require('../dist/engine/supporting-arc-check.js');

// —— 中文健康弧光：老陈从怀疑到力挺，翻转前有"监控+真相"事件铺垫 ——
const ZH_HEALTHY_ARC = `场景一 办公室
林晚：你先看完再说。
老陈：鬼才信他，这种人我见多了。
林晚：东西都在这。
老陈：谁信你，演得跟真的一样。
林晚：你慢慢看。
老陈：可笑，一张嘴就是故事。
△老陈看完监控录像，画面里是赵天成篡改合同的真相，他攥紧了拳头。
老陈：我错怪你了。
老陈：我信你，这份东西我帮你递上去。
林晚：现在你信了？`;

// —— 双人无铺垫倒戈：阿珍、大刘前半敌对，结尾两句突然力挺，中间无任何转折事件 ——
const ZH_ABRUPT_TWO = `场景一 客厅
苏晚：时间会证明。
阿珍：你撒谎，我绝不相信你。
大刘：骗子，休想让我签字。
阿珍：鬼才信你，假惺惺的。
大刘：可笑，荒唐至极。
苏晚：随便你们怎么想。
阿珍：自作多情，谁要你管。
大刘：白眼狼，还敢回来。
苏晚：我问心无愧。
阿珍：我信你，以后都听你的。
阿珍：谢谢你，我站你这边。
大刘：对不起，是我不好。
大刘：我支持你，都听你的。
苏晚：你们迟早会知道。`;

// —— 单个跟班全程一个温度（信任帮衬到底）：mid ——
const ZH_STATIC_POS = `场景一 公司
林晚：这次的事很麻烦。
周晴：我信你，你一定行的。
林晚：可能会连累你。
周晴：谢谢你愿意告诉我。
林晚：我先去准备材料。
周晴：我支持你，加油。
林晚：熬了两个通宵。
周晴：辛苦你了，先喝口水。
林晚：明天还得跑一趟。
周晴：我陪你一起去。`;

// —— 硬对手位豁免：报警/起诉/抓人的对手全程敌对是本分 ——
const ZH_HARD_OPPONENT = `场景一 别墅
林晚：听我解释。
赵天成：我已经报警了，你等着坐牢吧。
林晚：事情不是你想的那样。
赵天成：法庭上见，我一定起诉你。
林晚：你会后悔的。
赵天成：再不滚我叫保安了。
林晚：我走。
赵天成：抓起来，别让他跑了。
赵天成：送你进去反省十年。`;

// —— 纯应答配角：全集只有短应答，没做过一次选择 ——
const ZH_PASSIVE = `场景一 店里
老板：明天早点来。
小夏：好。
老板：账本放桌上。
小夏：嗯。
老板：这批货退回去。
小夏：行吧。
老板：听见没有。
小夏：知道了。
老板：别出差错。
小夏：明白。`;

// —— 软怀疑派零变化：从头到尾嘲讽怀疑，没被任何事实改变 ——
const ZH_SOFT_NEG_STATIC = `场景一 村口
林晚：我真的把钱带回来了。
老吴：鬼才信，肯定有猫腻。
林晚：你看存折。
老吴：可笑，这种话也说得出口。
林晚：账一笔一笔都对得上。
老吴：谁信你，假惺惺的。
林晚：村长也可以作证。
老吴：骗子吧，演得跟真的一样。
林晚：你们迟早会明白。
老吴：荒唐，太阳从西边出来了。`;

// —— 单个无铺垫倒戈：mid（不拦稿）——
const ZH_ABRUPT_ONE = `场景一 病房
林晚：你听我说完。
阿强：我不信，你走。
林晚：我不求你信。
阿强：鬼才信你的话。
林晚：那我走了。
阿强：可笑至极。
阿强：我信你，都听你的。
阿强：谢谢你，我支持你。`;

// —— 两个零变化配角（一个全捧、一个全酸）：static high ——
const ZH_STATIC_TWO = `场景一 茶楼
林晚：项目下周启动。
阿花：我信你。
老钱：鬼才信。
林晚：资金已经到位。
阿花：我支持你。
老钱：可笑。
林晚：合同都签了。
阿花：谢谢你。
老钱：谁信你。
林晚：明天动工。
阿花：辛苦你了。
老钱：假惺惺。
林晚：大家等着看结果。
阿花：我陪你去。
老钱：荒唐。`;

// —— 英文健康弧光：Mike 怀疑→看到监控真相→转变 ——
const EN_HEALTHY_ARC = `Scene 1. Office
Anna: Just watch this first.
Mike: I don't believe you. This is ridiculous.
Anna: It's all there.
Mike: As if. You're lying.
Anna: Take your time.
Mike: Yeah, right. I doubt it.
Mike watches the security footage and sees the truth - Victor forged the contract.
Mike: I misjudged you. I believe you now.
Mike: Thank you. I'm with you on this.
Anna: So?`;

// —— 英文单个无铺垫倒戈：mid ——
const EN_ABRUPT_ONE = `Scene 1. Hallway
Nina: Please listen.
Tom: You liar! I don't believe a word.
Nina: I know.
Tom: In your dreams. I disagree.
Nina: You'll see.
Tom: How dare you show up here.
Tom: I believe you. I trust you now.
Tom: Thank you. I'm on your side.`;

// —— 英文纯应答配角 ——
const EN_PASSIVE = `Scene 1. Store
Boss: Come early tomorrow.
Sam: Yeah.
Boss: Leave the ledger here.
Sam: Okay.
Boss: Send the stock back.
Sam: Sure.
Boss: Got it?
Sam: Got it.
Boss: No mistakes.
Sam: Fine.`;

// —— 英文硬对手豁免 ——
const EN_HARD_OPPONENT = `Scene 1. Mansion
Anna: Let me explain.
Victor: I'll call the police.
Anna: It's not what you think.
Victor: I'm going to sue you.
Anna: Please.
Victor: Get out of my house.
Anna: I'm leaving.
Victor: Arrest him, now.
Victor: You're going to jail.`;

test('ZH 健康弧光：有铺垫的怀疑→力挺，arc 正信号回补，零 issue', () => {
  const r = supportingArcCheck(ZH_HEALTHY_ARC, { 林晚: {} }, 'zh');
  const chen = r.characters.find((c) => c.name === '老陈');
  assert.strictEqual(r.protagonist, '林晚');
  assert.ok(chen, '老陈应参评');
  assert.strictEqual(chen.verdict, 'arc');
  assert.strictEqual(chen.firstAttitude, 'neg');
  assert.strictEqual(chen.lastAttitude, 'pos');
  assert.ok(chen.turnTrigger.length > 0, '应识别到转折事件');
  assert.strictEqual(r.arcChars, 1);
  assert.strictEqual(r.staticChars, 0);
  assert.strictEqual(r.abruptChars, 0);
  assert.strictEqual(r.issues.length, 0);
  assert.ok(r.score >= 95);
});

test('ZH 双人无铺垫倒戈：abrupt high 闸门', () => {
  const r = supportingArcCheck(ZH_ABRUPT_TWO, { 苏晚: {} }, 'zh');
  assert.strictEqual(r.abruptChars, 2);
  const issue = r.issues.find((i) => i.type === 'abrupt_conversion');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'high');
  for (const n of ['阿珍', '大刘']) {
    const c = r.characters.find((x) => x.name === n);
    assert.strictEqual(c.verdict, 'abrupt');
    assert.strictEqual(c.turnTrigger, '');
  }
});

test('ZH 单个跟班零变化：static mid，证据含"一个温度"', () => {
  const r = supportingArcCheck(ZH_STATIC_POS, { 林晚: {} }, 'zh');
  assert.strictEqual(r.staticChars, 1);
  const c = r.characters.find((x) => x.name === '周晴');
  assert.strictEqual(c.verdict, 'static');
  assert.strictEqual(c.posLines, 5);
  const issue = r.issues.find((i) => i.type === 'static_supporting');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 硬对手位豁免：报警/起诉/抓人不判 static', () => {
  const r = supportingArcCheck(ZH_HARD_OPPONENT, { 林晚: {} }, 'zh');
  const c = r.characters.find((x) => x.name === '赵天成');
  assert.ok(c);
  assert.strictEqual(c.verdict, 'opponent');
  assert.strictEqual(r.staticChars, 0);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ZH 纯应答配角：no_choice_passive low', () => {
  const r = supportingArcCheck(ZH_PASSIVE, { 老板: {} }, 'zh');
  assert.strictEqual(r.passiveChars, 1);
  const issue = r.issues.find((i) => i.type === 'no_choice_passive');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'low');
  const c = r.characters.find((x) => x.name === '小夏');
  assert.strictEqual(c.verdict, 'passive');
});

test('ZH 软怀疑派零变化（非硬对手）：static', () => {
  const r = supportingArcCheck(ZH_SOFT_NEG_STATIC, { 林晚: {} }, 'zh');
  const c = r.characters.find((x) => x.name === '老吴');
  assert.strictEqual(c.verdict, 'static');
  assert.strictEqual(c.negLines, 5);
  assert.strictEqual(r.staticChars, 1);
});

test('ZH 单个无铺垫倒戈：abrupt mid 不拦稿', () => {
  const r = supportingArcCheck(ZH_ABRUPT_ONE, { 林晚: {} }, 'zh');
  assert.strictEqual(r.abruptChars, 1);
  const issue = r.issues.find((i) => i.type === 'abrupt_conversion');
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 两个零变化配角：static high', () => {
  const r = supportingArcCheck(ZH_STATIC_TWO, { 林晚: {} }, 'zh');
  assert.strictEqual(r.staticChars, 2);
  const issue = r.issues.find((i) => i.type === 'static_supporting');
  assert.strictEqual(issue.severity, 'high');
});

test('EN 健康弧光：security footage 铺垫后转变为 arc', () => {
  const r = supportingArcCheck(EN_HEALTHY_ARC, { Anna: {} }, 'en');
  const mike = r.characters.find((c) => c.name === 'Mike');
  assert.ok(mike);
  assert.strictEqual(mike.verdict, 'arc');
  assert.ok(mike.turnTrigger.length > 0);
  assert.strictEqual(r.arcChars, 1);
  assert.strictEqual(r.issues.length, 0);
});

test('EN 单个无铺垫倒戈：abrupt mid 且 turnTrigger 为空', () => {
  const r = supportingArcCheck(EN_ABRUPT_ONE, { Nina: {} }, 'en');
  const tom = r.characters.find((c) => c.name === 'Tom');
  assert.strictEqual(tom.verdict, 'abrupt');
  assert.strictEqual(tom.turnTrigger, '');
  assert.strictEqual(r.abruptChars, 1);
  assert.strictEqual(r.issues.find((i) => i.type === 'abrupt_conversion').severity, 'mid');
});

test('EN 纯应答：passive low', () => {
  const r = supportingArcCheck(EN_PASSIVE, { Boss: {} }, 'en');
  const sam = r.characters.find((c) => c.name === 'Sam');
  assert.strictEqual(sam.verdict, 'passive');
  assert.strictEqual(r.passiveChars, 1);
  assert.strictEqual(r.issues[0].type, 'no_choice_passive');
});

test('EN 硬对手豁免：call the police / sue / arrest 不判 static', () => {
  const r = supportingArcCheck(EN_HARD_OPPONENT, { Anna: {} }, 'en');
  const victor = r.characters.find((c) => c.name === 'Victor');
  assert.strictEqual(victor.verdict, 'opponent');
  assert.strictEqual(r.staticChars, 0);
  assert.strictEqual(r.score, 100);
});

test('空文本 / 对白不足 6 行 / 只有一个说话角色：满分豁免', () => {
  assert.strictEqual(supportingArcCheck('', null, 'zh').score, 100);
  const short = '张总：今天天气不错我们出去走走吧。\n李总：好的没问题我知道了这就办。\n张总：那就这么决定了。\n李总：行。\n张总：走吧。';
  const r1 = supportingArcCheck(short, null, 'zh');
  assert.strictEqual(r1.score, 100);
  assert.strictEqual(r1.issues.length, 0);
  const solo = ['主角：我一定要查清这件事的来龙去脉。', '主角：谁也别想拦住我前进的脚步。', '主角：从今天开始我要换一个活法。', '主角：所有欠了我的我都会拿回来。', '主角：你们等着看我的手段就好。', '主角：这条路我一个人也走到底。', '主角：哪怕粉身碎骨我也绝不回头。', '主角：明天太阳照常升起我照样来。'].join('\n');
  const r2 = supportingArcCheck(solo, null, 'zh');
  assert.strictEqual(r2.speakingChars, 1);
  assert.strictEqual(r2.issues.length, 0);
});

test('缺省 cast 时主角=台词最多者，主角本人不参评', () => {
  const r = supportingArcCheck(ZH_SOFT_NEG_STATIC, null, 'zh');
  assert.strictEqual(r.protagonist, '林晚');
  assert.ok(!r.characters.some((c) => c.name === '林晚'));
  assert.ok(r.characters.some((c) => c.name === '老吴'));
});

test('字段边界：分数钳制 0-100、issues 按 severity 降序、characters 按台词数降序', () => {
  const r = supportingArcCheck(ZH_ABRUPT_TWO, { 苏晚: {} }, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1].severity] <= order[r.issues[i].severity]);
  }
  for (let i = 1; i < r.characters.length; i++) {
    assert.ok(r.characters[i - 1].lineCount >= r.characters[i].lineCount);
  }
  for (const c of r.characters) {
    assert.ok(['arc', 'static', 'abrupt', 'passive', 'opponent', 'neutral', 'minor'].includes(c.verdict));
    assert.ok(['pos', 'neg', 'neu'].includes(c.firstAttitude));
    assert.ok(['pos', 'neg', 'neu'].includes(c.lastAttitude));
  }
});
