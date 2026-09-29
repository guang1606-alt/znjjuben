/**
 * v2.145 emotional-aftermath-check 单测（情绪余波连续性，中英双语离线启发式）
 * 覆盖：空短满分 / 无创伤日常满分 / instant_reset（跨场、余波豁免、时间豁免、冷笑苦笑排除、
 *       装死演戏梦豁免、相邻复述聚类、贴结尾不苛求、三连 push≤2 升 high）/
 *       unprocessed_loss（无消化 mid、葬礼豁免、时间标记豁免、后文不足不苛求）/
 *       quick_comfort（low、二次升 mid、健康劝慰豁免、同场连续崩溃去重）/
 *       排序 / key 唯一 / scenes 旗标 / 中英各版 / 语言隔离
 */
const test = require('node:test');
const assert = require('node:assert');
const { emotionalAftermathCheck } = require('../dist/engine/emotional-aftermath-check.js');

const sum = (r) => r.scenes.reduce((a, s) => a + s.flagCount, 0);
const sevOf = (r, type) => r.issues.filter((i) => i.type === type).map((i) => i.severity);
const sevs = (r) => r.issues.map((i) => i.severity);

// ---------- 基础 ----------
test('空文本与短文本：满分空对象', () => {
  for (const t of ['', '   \n  \n', '短短十几个字对白']) {
    const r = emotionalAftermathCheck(t, 'zh');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.issueCount, 0);
    assert.strictEqual(r.scenes.length, 0);
    assert.strictEqual(r.signalCount, 0);
    assert.strictEqual(r.issues.length, 0);
  }
});

test('无创伤日常稿：满分放行', () => {
  const t = '第1场 江边\n林晚：今天天气真好。\n顾琛：嗯，去散散步吧。\n△两人沿着江边慢慢走。\n第2场 奶茶店\n△他们买了两杯奶茶，开心地聊天。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

// ---------- ① instant_reset ----------
test('① 跨场秒清零：mid，score=88，evidence 落在 reset 行', () => {
  const t = '第1场 病房\n林母躺在病床上，心电图拉成一条直线，她死了。\n第2场 商场\n△第二天林晚挽着闺蜜逛街，哈哈大笑，开心得很。\n闺蜜：这家奶茶真好喝！\n△两人吃着火锅有说有笑。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 1);
  assert.strictEqual(r.lossCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_reset'), ['mid']);
  assert.strictEqual(r.score, 88);
  assert.match(r.issues[0].evidence, /^第2场：/);
  assert.strictEqual(sum(r), r.issues.length);
});

test('① 两次秒清零（跨场两事件）：第二次升 high，score=78', () => {
  const t = '第1场\n母亲死了。\n△她哈哈大笑，约闺蜜逛街。\n第2场\n父亲出车祸当场身亡。\n△她哼着小歌喝奶茶。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.instantResetCount, 2);
  assert.deepStrictEqual(sevs(r), ['high', 'mid']);
  assert.strictEqual(r.score, 78);
});

test('① 三次秒清零：计数=3 但只 push 2 条（penalty 封顶 22）', () => {
  const t = '第1场\n母亲死了。\n△她哈哈大笑，约闺蜜逛街。\n第2场\n父亲出车祸当场身亡。\n△她哼着小歌喝奶茶。\n第3场\n弟弟坠楼了。\n△她兴奋地买新衣服。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.instantResetCount, 3);
  assert.strictEqual(sevOf(r, 'instant_reset').length, 2);
  assert.strictEqual(r.score, 78);
});

test('① 事件行+反应行相邻复述"死去"：聚类为一个锚点，不重复计数', () => {
  const t = '第1场\n林母躺在病床上，她死了。\n△林晚看着母亲死去，一动不动。\n第2场\n△第二天她逛街哈哈大笑，开心得很。\n闺蜜：奶茶好喝。\n△两人吃着火锅。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 1);
  assert.strictEqual(r.instantResetCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_reset'), ['mid']);
});

test('① 笑之前有悲伤余波（红眼/哽咽）：griefCarry 正信号，豁免', () => {
  const t = '第1场 抢救室\n林母死在抢救台上。\n△林晚红着眼眶，死死攥着母亲的手，哽咽着一句话也说不出。\n△她失魂落魄地坐了一整夜。\n第2场 餐厅\n△第二天中午，她被闺蜜硬拉去吃饭，席间勉强跟着笑了一下。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.instantResetCount, 0);
  assert.ok(r.griefCarryCount >= 1);
  assert.strictEqual(r.score, 100);
});

test('① 时间流逝后恢复：timeHeal 正信号，豁免', () => {
  const t = '第1场\n林父出车祸当场身亡。\n△林晚办完手续，独自走出医院大门。\n第2场\n△三个月后，林晚重回公司上班，和同事淡淡笑了笑。\n同事：欢迎回来。\n林晚：谢谢，我没事了。\n△她安静地处理文件直到下班。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.instantResetCount, 0);
  assert.ok(r.timeHealCount >= 1);
  assert.strictEqual(r.score, 100);
});

test('① 反派冷笑/得意/嗤笑不算情绪清零', () => {
  const t = '第1场 灵堂\n△父亲当场咽了气。\n△继母在一旁冷笑，得意地转过身。\n管家：太太，公司的人来了。\n△继母嗤笑一声，踩着高跟鞋走了。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 1);
  assert.strictEqual(r.resetCount, 0);
  assert.strictEqual(r.instantResetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 苦笑/含泪笑本身是余波，不算清零', () => {
  const t = '第1场\n林母咽了气。\n△林晚扯出一个苦笑，眼泪无声地往下掉。\n△她整夜没睡，声音沙哑，只是含泪笑了笑。\n△第二天她仍旧红着眼，盯着母亲的照片发呆。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.instantResetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 装死：±1 行内有"装死"标记，整事件豁免', () => {
  const t = '第1场 破庙\n△他口吐鲜血倒在地上装死，想骗过追兵。\n追兵：这下死了吧！\n第2场 集市\n△追兵一走，他立刻跳起来拍拍灰，笑着和同伴去吃火锅，开心得很。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.instantResetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 拍戏：相邻行出现导演/拍戏语境，豁免', () => {
  const t = '第1场 片场\n导演：这场戏男主中枪倒地身亡，准备。\n△演员中弹倒在血泊里，演得十分逼真。\n第2场 休息区\n△导演一喊卡，他立刻蹦起来哈哈大笑，和大家去吃火锅。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('① 恶作剧玩笑：相邻行揭穿是恶作剧，豁免', () => {
  const t = '第1场 教室\n同学大喊：你妈妈出车祸死了，哈哈！\n同学：骗你的啦，恶作剧！\n△他松了口气，立刻哈哈大笑，和同学逛街喝奶茶去了。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.instantResetCount, 0);
});

test('① 梦中事件（行内有"梦里"）：豁免', () => {
  const t = '第1场 深夜\n△梦里他浑身是血，中弹身亡。\n△她哭着扑了过去。\n第2场 卧室\n△她从梦中惊醒，原来是一场梦。\n△第二天她开心逛街，哈哈大笑喝奶茶。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 事件贴结尾，故事没继续：不苛求余波', () => {
  const t = '第1场 医院\n林父出车祸当场身亡。\n△林晚冲到病房门口，不敢相信地站住。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 1);
  assert.strictEqual(r.instantResetCount, 0);
  assert.strictEqual(r.unprocessedLossCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 无标题稿按单场处理，旗标落在第 1 场', () => {
  const t = '林母死了。\n△第二天林晚挽着闺蜜逛街，哈哈大笑，开心得很。\n闺蜜：奶茶真好喝。\n△两人吃着火锅有说有笑。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.scenes.length, 1);
  assert.strictEqual(r.scenes[0].index, 1);
  assert.strictEqual(r.scenes[0].flagCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_reset'), ['mid']);
});

// ---------- ② unprocessed_loss ----------
test('② 丧亡后文≥8行全无悲伤/悼念/时间标记：mid，score=86，全文 1 条', () => {
  const t = '第1场 客厅\n林父在车祸中当场身亡。\n林晚：知道了。\n第2场 公司\n△她回到公司继续上班。\n同事递来一份合同让她签字。\n她平静地签完字合上文件。\n下午她出门去见一个客户。\n两个人在办公室谈得很顺利。\n晚上她开车回到自己的公寓。\n她洗完澡早早躺下睡了。\n第二天她照常早起出门跑步。\n早餐时她还和阿姨聊了几句天气。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.lossCount >= 1, true);
  assert.deepStrictEqual(sevOf(r, 'unprocessed_loss'), ['mid']);
  assert.strictEqual(r.unprocessedLossCount, 1);
  assert.strictEqual(r.score, 86);
});

test('② 后文有葬礼/黑纱/哽咽：豁免', () => {
  const t = '第1场 殡仪馆\n林父在车祸中当场身亡。\n△葬礼上林晚一身黑纱，跪在墓碑前哽咽，红着眼烧纸。\n△此后数日她夜夜失眠，摸着父亲遗物发呆。\n第2场 公司\n△一个月后，林晚重回公司，淡淡笑了笑继续工作。\n同事递来文件，她安静接过。\n她一页页核对合同条款。\n下午她独自留在工位整理资料。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.unprocessedLossCount, 0);
  assert.strictEqual(r.instantResetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('② 后文有时间流逝标记（三天后）：豁免 unprocessed', () => {
  const t = '第1场\n林父在车祸中当场身亡。\n△三天后，她回到公司继续上班。\n同事递来一份合同让她签字。\n她安静地签完字合上文件。\n下午她出门去见一个客户。\n两个人在办公室谈事。\n晚上她开车回到公寓。\n她洗完澡躺下休息。\n第二天她照常早起出门。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.unprocessedLossCount, 0);
  assert.strictEqual(r.score, 100);
});

// ---------- ③ quick_comfort ----------
test('③ 崩溃→4行内鸡汤→3行内秒振作：low，score=94', () => {
  const t = '第1场 雨夜\n林晚：为什么是我……\n△林晚崩溃了，瘫倒在地嚎啕大哭，哭得撕心裂肺。\n顾琛：别哭了，都会过去的，有我在。\n△林晚抬起头，露出了笑容，重新振作起来。\n顾琛：这就对了。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.breakdownCount, 1);
  assert.strictEqual(r.comfortCount >= 1, true);
  assert.strictEqual(r.recoverCount >= 1, true);
  assert.deepStrictEqual(sevOf(r, 'quick_comfort'), ['low']);
  assert.strictEqual(r.score, 94);
});

test('③ 劝慰与振作之间有真实余波：healthyComfort，豁免', () => {
  const t = '第1场\n△林晚崩溃了，瘫倒在地嚎啕大哭。\n△她哭了很久，双眼红肿，声音沙哑。\n顾琛：别哭了，都会过去的，有我在。\n△她仍旧哽咽着，只是红着眼点了点头。\n△三天后，她重新振作，露出淡淡的笑容。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.quickComfortCount, 0);
  assert.ok(r.healthyComfortCount >= 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('③ 同一场连续崩溃行（行距≤3）只算一次', () => {
  const t = '第1场\n△林晚崩溃了，双腿一软跪在地上。\n△她歇斯底里地捶着地板。\n顾琛：别哭了，都会过去的，有我在。\n△林晚立刻露出笑容，重新振作。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.breakdownCount, 2);
  assert.strictEqual(r.quickComfortCount, 1);
  assert.deepStrictEqual(sevOf(r, 'quick_comfort'), ['low']);
});

test('③ 跨场两次秒治愈：第二次升 mid，score=86', () => {
  const t = '第1场\n△林晚崩溃了，瘫倒在地嚎啕大哭。\n顾琛：别哭了，都会过去的，有我在。\n△林晚立刻露出笑容，重新振作。\n第2场\n△得知真相她再次崩溃，歇斯底里地哭喊。\n闺蜜：坚强点，都会好的。\n△她马上想通了，眼神坚定地笑了。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.quickComfortCount, 2);
  assert.deepStrictEqual(sevs(r), ['mid', 'low']);
  assert.strictEqual(r.score, 86);
});

test('③ 崩溃后隔 6 行以上才振作（中间有承接）：不报秒治愈', () => {
  const t = '第1场\n△林晚崩溃了，瘫倒在地嚎啕大哭。\n△她哭到失声，整夜未眠。\n△第二天她仍旧双眼红肿，吃不下东西。\n顾琛：都会过去的，有我在。\n△她没有回答，只是哽咽着转头看向窗外。\n△又过了几日，她一点点缓了过来。\n△这天早上，她重新振作，眼神坚定地推开公司大门。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.quickComfortCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

// ---------- 排序 / key / 旗标 / 计数 ----------
test('issues 排序：high→mid→low，同类型高严重度在前', () => {
  const t = '第1场\n母亲死了。\n△她哈哈大笑，约闺蜜逛街。\n第2场\n父亲出车祸当场身亡。\n△她哼着小歌喝奶茶。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.deepStrictEqual(sevs(r), ['high', 'mid']);
});

test('instant(mid) 与 comfort(low) 混排：mid 在 low 前，score=82', () => {
  const t = '第1场\n林母死了。\n△第二天林晚挽着闺蜜逛街，哈哈大笑，开心得很。\n第2场\n△她突然崩溃，瘫倒在地嚎啕大哭。\n顾琛：别哭了，都会过去的，有我在。\n△林晚立刻露出笑容，重新振作。';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.deepStrictEqual(sevs(r), ['mid', 'low']);
  assert.strictEqual(r.score, 82);
});

test('key 全局唯一；scenes.flagCount 之和 = issues 数；计数自洽', () => {
  const t = '第1场\n林母死了。\n△第二天林晚挽着闺蜜逛街，哈哈大笑，开心得很。\n第2场\n△她突然崩溃，瘫倒在地嚎啕大哭。\n顾琛：别哭了，都会过去的，有我在。\n△林晚立刻露出笑容，重新振作。';
  const r = emotionalAftermathCheck(t, 'zh');
  const keys = r.issues.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.strictEqual(sum(r), r.issues.length);
  assert.strictEqual(r.issueCount, r.issues.length);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.sceneCount === r.scenes.length);
});

// ---------- 英文版 ----------
test('EN 跨场秒清零：mid，score=88，evidence 前缀 Scene N:', () => {
  const t = 'Scene 1 Hospital\nHer mother died in the hospital bed, the flatline echoing.\nScene 2 Mall\nThe next day she went shopping with her friend, laughing out loud over bubble tea, cheerful and giddy.\nFriend: This hot pot is so delicious!';
  const r = emotionalAftermathCheck(t, 'en');
  assert.strictEqual(r.traumaCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_reset'), ['mid']);
  assert.strictEqual(r.score, 88);
  assert.match(r.issues[0].evidence, /^Scene \d+: /);
});

test('EN faked death：豁免', () => {
  const t = 'Scene 1 Warehouse\nHe faked his own death, lying in fake blood to fool the pursuers.\nPursuer: Haha, he is dead!\nScene 2 Street\nOnce they left, he jumped up grinning and went for hot pot, cheerful and lighthearted.';
  const r = emotionalAftermathCheck(t, 'en');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.score, 100);
});

test('EN 丧亡无消化：mid，score=86', () => {
  const t = 'Scene 1 Living room\nHer father had died in a car crash that morning.\nShe nodded quietly at the door.\nScene 2 Office\nShe returned to the office to keep working.\nA colleague handed her a contract to sign.\nShe signed the papers and closed the file.\nIn the afternoon she went out to meet a client.\nThe negotiation went smoothly in the room.\nThat evening she drove back to her apartment.\nShe took a shower and went to bed early.\nNext morning she went jogging as usual.\nAt breakfast she chatted about the weather with the maid.';
  const r = emotionalAftermathCheck(t, 'en');
  assert.deepStrictEqual(sevOf(r, 'unprocessed_loss'), ['mid']);
  assert.strictEqual(r.score, 86);
});

test('EN 鸡汤秒治愈：low，score=94', () => {
  const t = 'Scene 1 Rain\nShe broke down sobbing and collapsed to the floor, hysterical.\nHe held her shoulder: Do not cry, time heals everything, I am here.\nShe pulled herself together and smiled again, her eyes firm.\nHe nodded at her.';
  const r = emotionalAftermathCheck(t, 'en');
  assert.deepStrictEqual(sevOf(r, 'quick_comfort'), ['low']);
  assert.strictEqual(r.score, 94);
});

test('EN 健康劝慰（中间有哭红双眼/沙哑）：豁免', () => {
  const t = 'Scene 1\nShe broke down sobbing on the floor.\nShe cried for hours, eyes red and swollen, her voice hoarse.\nHe said softly: Do not cry, I am here.\nShe kept weeping and just nodded at him.\nThree days later, she pulled herself together and smiled faintly.';
  const r = emotionalAftermathCheck(t, 'en');
  assert.strictEqual(r.quickComfortCount, 0);
  assert.ok(r.healthyComfortCount >= 1);
  assert.strictEqual(r.score, 100);
});

test('EN 反派 smirk/sneer/gloat 不算清零', () => {
  const t = 'Scene 1 Hall\nHer father died right in front of her.\nThe stepmother smirked and sneered coldly, gloating over the body.\nThe butler brought the company documents.\nShe gave a cold mocking laugh and walked away.';
  const r = emotionalAftermathCheck(t, 'en');
  assert.strictEqual(r.traumaCount, 1);
  assert.strictEqual(r.resetCount, 0);
  assert.strictEqual(r.score, 100);
});

// ---------- 语言隔离 ----------
test('语言隔离：中文稿传 en 不触发中文规则', () => {
  const t = '林母死了。\n△第二天林晚哈哈大笑逛街，开心得很，还约了奶茶。';
  const r = emotionalAftermathCheck(t, 'en');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.resetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('语言隔离：英文稿传 zh 不触发英文规则', () => {
  const t = 'Her mother died yesterday.\nToday she went shopping, laughing out loud over bubble tea.';
  const r = emotionalAftermathCheck(t, 'zh');
  assert.strictEqual(r.traumaCount, 0);
  assert.strictEqual(r.score, 100);
});
