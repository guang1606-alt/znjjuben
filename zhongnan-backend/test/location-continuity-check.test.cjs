/**
 * v2.146 location-continuity-check 单测（空间位移连续性，中英双语离线启发式）
 * 覆盖：空短满分 / 无地点日常满分 /
 *       instant_travel（跨城 mid、二次 high、三对 push≤2、飞机桥接豁免、场标时间跳变豁免、
 *         同城不报、在途场标豁免、跨国、无城市不报、evidence 格式）/
 *       location_jump（同场 low、二次 mid、转场行豁免、到达行豁免、病床同类不报、
 *         门口否定词、远距离不报、每场1条、跨场合法、无标题单场）/
 *       set_conflict（内景外动作、外景内动作、隔窗观望豁免、无声明不报、多场 cap）/
 *       信号计数 / 旗标自洽 / 排序 / key 唯一 / EN 四主路径 / 语言隔离
 */
const test = require('node:test');
const assert = require('node:assert');
const { locationContinuityCheck } = require('../dist/engine/location-continuity-check.js');

const sum = (r) => r.scenes.reduce((a, s) => a + s.flagCount, 0);
const sevOf = (r, type) => r.issues.filter((i) => i.type === type).map((i) => i.severity);
const sevs = (r) => r.issues.map((i) => i.severity);

// ---------- 基础 ----------
test('空文本与短文本：满分空对象', () => {
  for (const t of ['', '   \n  \n', '短短十几个字对白']) {
    const r = locationContinuityCheck(t, 'zh');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.issueCount, 0);
    assert.strictEqual(r.scenes.length, 0);
    assert.strictEqual(r.signalCount, 0);
  }
});

test('无地点信号的日常对白稿：满分放行', () => {
  const t = '第1场\n林晚：今天天气真好。\n顾琛：嗯，去散散步吧。\n第2场\n林晚：那走吧。\n顾琛：好。';
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.citySceneCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

// ---------- ① 跨城瞬移 ----------
test('① 北京→上海无转场：mid，score=88，evidence 含两市', () => {
  const t = [
    '第1场 北京 国贸办公室 日',
    '△顾琛把文件摔在桌上。',
    '顾琛：这件事没完。',
    '△他转身看向窗外。',
    '第2场 上海 浦东酒店 夜',
    '△林晚端着酒杯站在落地窗前。',
    '林晚：你终于来了。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 1);
  assert.strictEqual(r.instantTravelCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_travel'), ['mid']);
  assert.strictEqual(r.score, 88);
  assert.match(r.issues[0].evidence, /北京/);
  assert.match(r.issues[0].evidence, /上海/);
  assert.strictEqual(sum(r), r.issues.length);
});

test('① 两对跨城无转场：第二次升 high，score=78', () => {
  const t = [
    '第1场 北京 办公室 日',
    '△他摔了文件。',
    '第2场 上海 酒店 夜',
    '△她端着酒杯。',
    '第3场 广州 餐厅 日',
    '△两人相对而坐。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 2);
  assert.deepStrictEqual(sevs(r), ['high', 'mid']);
  assert.strictEqual(r.score, 78);
});

test('① 三对跨城：计数=3 但只 push 2 条，penalty 封顶 22，score=78', () => {
  const t = [
    '第1场 北京 办公室 日', '△他摔了文件。',
    '第2场 上海 酒店 夜', '△她端着酒杯。',
    '第3场 广州 餐厅 日', '△两人相对而坐。',
    '第4场 深圳 会所 夜', '△灯光暧昧。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 3);
  assert.strictEqual(r.instantTravelCount, 3);
  assert.strictEqual(r.issues.length, 2);
  assert.strictEqual(r.score, 78);
});

test('① 前场末交代航班：fairTravel 豁免并加分，满分', () => {
  const t = [
    '第1场 北京 办公室 日',
    '△顾琛把文件摔在桌上。',
    '顾琛：这件事没完。',
    '△他直奔机场，搭上最晚一班航班飞赴上海。',
    '第2场 上海 浦东酒店 夜',
    '△林晚端着酒杯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 1);
  assert.strictEqual(r.fairTravelCount, 1);
  assert.strictEqual(r.instantTravelCount, 0);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 后场标自带时间跳变（次日）：豁免', () => {
  const t = [
    '第1场 北京 办公室 日', '△他摔了文件。',
    '第2场 次日 上海 酒店 夜', '△她端着酒杯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.fairTravelCount, 1);
  assert.strictEqual(r.issueCount, 0);
});

test('① 同城市换景（北京办公室→北京酒店）：不报', () => {
  const t = [
    '第1场 北京 国贸办公室 日', '△他摔了文件。',
    '第2场 北京 三里屯酒店 夜', '△她端着酒杯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('① 后场标为"飞机上"（在途）：豁免跨城', () => {
  const t = [
    '第1场 北京 办公室 日', '△他摔了文件。',
    '第2场 上海 飞机上 夜', '△他靠着舷窗闭眼。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.travelPairCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('① 跨国瞬移（北京→纽约）：mid', () => {
  const t = [
    '第1场 北京 公寓 夜', '△她挂了电话。',
    '第2场 纽约 豪宅 日', '△她端着咖啡。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.instantTravelCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_travel'), ['mid']);
});

test('① 场标均无城市（只有姓氏场所）：不报', () => {
  const t = [
    '第1场 林家别墅 夜', '△她挂了电话。',
    '第2场 顾氏大堂 日', '△他走出电梯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.citySceneCount, 0);
  assert.strictEqual(r.travelPairCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

// ---------- ② 同场房间瞬移 ----------
test('② 同场 家里床→工位无转场：low，score=94', () => {
  const t = [
    '第1场 夜',
    '△她躺在家里的床上发呆。',
    '△手机响了。',
    '△她坐在工位上翻文件。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.locationAnchorCount, 2);
  assert.strictEqual(r.jumpCount, 1);
  assert.deepStrictEqual(sevOf(r, 'location_jump'), ['low']);
  assert.strictEqual(r.score, 94);
  assert.match(r.issues[0].evidence, /^第1场：/);
});

test('② 两场各一次瞬移：第二次升 mid，score=86', () => {
  const t = [
    '第1场', '△她躺在家里的床上。', '△她坐在工位上翻文件。',
    '第2场', '△他在病房里输液。', '△他在餐厅里举杯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 2);
  assert.deepStrictEqual(sevs(r), ['mid', 'low']);
  assert.strictEqual(r.score, 86);
});

test('② 中间出现离开/到达转场行：豁免，transitionCount≥1', () => {
  const t = [
    '第1场 日',
    '△她躺在家里的床上发呆。',
    '△她冲出家门，连夜赶到公司。',
    '△她坐在工位上翻文件。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
  assert.ok(r.transitionCount >= 1);
  assert.strictEqual(r.issueCount, 0);
});

test('② 目标锚点行自带"走进办公室"：到达动作豁免', () => {
  const t = [
    '第1场 日',
    '△她躺在家里的床上发呆。',
    '△她走进办公室，把包扔在沙发上。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  // 末行同时命中 office 与 home（沙发），但自带到达转场词，整行豁免
  assert.strictEqual(r.jumpCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('② 病床/医院同类包含（医院→诊室）：不报', () => {
  const t = [
    '第1场 日',
    '△他躺在病床上输液。',
    '△医生走进诊室准备器械。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('② "公司门口"否定词：室内锚点撤销，不误报', () => {
  const t = [
    '第1场 日',
    '△她在家里做饭。',
    '△男人站在公司门口等她。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('② 同类锚点重复（家里床上→家里客厅）：不报', () => {
  const t = [
    '第1场 日',
    '△她躺在家里的床上。',
    '△她走到客厅倒水。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
});

test('② 锚点行距 >6：默认调度省略，不报', () => {
  const t = [
    '第1场 日',
    '△她躺在家里的床上。',
    '林晚：嗯。',
    '顾琛：好。',
    '林晚：走吧。',
    '顾琛：等等。',
    '画外音：天色渐晚。',
    '林晚：随便你。',
    '△她坐在工位上翻文件。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
});

test('② 同场三对矛盾：每场最多报 1 条', () => {
  const t = [
    '第1场 日',
    '△她躺在家里的床上。',
    '△她坐在工位上翻文件。',
    '△他在病房里输液。',
    '△他在餐厅里举杯。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 1);
  assert.strictEqual(r.issues.filter((i) => i.type === 'location_jump').length, 1);
});

test('② 跨场换地点（场标负责切空间）：无转场词也不报', () => {
  const t = [
    '第1场 林家 夜', '△她躺在家里的床上。',
    '第2场 顾氏 日', '△她坐在工位上翻文件。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.jumpCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('② 无标题按单场：同场瞬移仍可判', () => {
  const t = '△她躺在家里的床上发呆。\n△手机响了。\n△她坐在工位上翻文件。';
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.scenes.length, 1);
  assert.strictEqual(r.jumpCount, 1);
});

// ---------- ③ 内外景矛盾 ----------
test('③ 内景场标 + 室外强动作（雨中大街）：low，score=95', () => {
  const t = [
    '内景 林家卧室 夜',
    '△屋里只留一盏昏黄的灯。',
    '△她走在雨中的大街上放声大哭。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.intExtSceneCount, 1);
  assert.strictEqual(r.conflictCount, 1);
  assert.deepStrictEqual(sevOf(r, 'set_conflict'), ['low']);
  assert.strictEqual(r.score, 95);
});

test('③ 外景场标 + 室内强动作（钻进被窝）：low', () => {
  const t = [
    '外景 街边 夜',
    '△风很大。',
    '△她钻进被窝沉沉睡去。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.deepStrictEqual(sevOf(r, 'set_conflict'), ['low']);
});

test('③ 内景场标 + 隔窗望星空：窗外否定豁免', () => {
  const t = [
    '内景 林家卧室 夜',
    '△她抬头望着窗外的星空发呆。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('③ 无内/外景声明的场标：不查矛盾', () => {
  const t = [
    '第1场 林家卧室 夜',
    '△她走在雨中的大街上放声大哭。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.intExtSceneCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('③ 三场矛盾：count=3 但只 push 2 条，penalty 封顶 10，score=90', () => {
  const t = [
    '内景 卧室 夜', '△她走在雨中的大街上。',
    '内景 客厅 夜', '△他站在天台边缘吹风。',
    '内景 书房 夜', '△她在沙滩上奔跑。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.conflictCount, 3);
  assert.strictEqual(r.issues.filter((i) => i.type === 'set_conflict').length, 2);
  assert.strictEqual(r.score, 90);
});

// ---------- 汇总/排序/计数 ----------
test('信号计数：city/anchor/intExt 合计 signalCount，旗标自洽', () => {
  const t = [
    '第1场 内景 北京 医院病房 夜',
    '△她躺在病床上休息。',
    '第2场 外景 次日 上海 路边 日',
    '△他走在路边打电话。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.strictEqual(r.citySceneCount, 2);
  assert.strictEqual(r.intExtSceneCount, 2);
  assert.strictEqual(r.locationAnchorCount, 2);
  assert.strictEqual(r.signalCount, 6);
  assert.strictEqual(r.fairTravelCount, 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(sum(r), 0);
});

test('混合排序：high(travel) → mid(travel) → low(jump)', () => {
  const t = [
    '第1场 北京 公寓 夜',
    '△她躺在家里的床上发呆。',
    '△她坐在工位上翻文件。',
    '第2场 上海 酒店 夜',
    '△窗外霓虹闪烁。',
    '△她看着手机不说话。',
    '第3场 广州 餐厅 夜',
    '△屋内气氛凝重。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  assert.deepStrictEqual(sevs(r), ['high', 'mid', 'low']);
  assert.strictEqual(r.score, 72);
  assert.strictEqual(sum(r), r.issues.length);
});

test('key 全局唯一', () => {
  const t = [
    '第1场 北京 公寓 夜',
    '△她躺在家里的床上发呆。',
    '△她坐在工位上翻文件。',
    '第2场 上海 酒店 夜',
    '△她端着酒杯。',
    '内景 广州 卧室 夜',
    '△她走在雨中的大街上。',
  ].join('\n');
  const r = locationContinuityCheck(t, 'zh');
  const keys = r.issues.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length);
});

// ---------- 英文版 ----------
test('EN ① New York→London 无转场：mid，evidence 英文格式', () => {
  const t = [
    'SCENE 1  New York office - DAY',
    'He slammed the file on the desk.',
    'This is not over.',
    'SCENE 2  London hotel - NIGHT',
    'She held a glass by the window.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.travelPairCount, 1);
  assert.deepStrictEqual(sevOf(r, 'instant_travel'), ['mid']);
  assert.strictEqual(r.score, 88);
  assert.match(r.issues[0].evidence, /Scene 1 -> 2/);
});

test('EN ① "boarded the flight to London"：豁免 fairTravel', () => {
  const t = [
    'SCENE 1  New York office - DAY',
    'She boarded the flight to London that night.',
    'SCENE 2  London hotel - NIGHT',
    'She held a glass by the window.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.fairTravelCount, 1);
  assert.strictEqual(r.issueCount, 0);
});

test('EN ② 同场 in bed→office 无转场：low', () => {
  const t = [
    'SCENE 1  Night',
    'She lay in bed, staring at the ceiling.',
    'The phone rang.',
    'She sat in the office reading files.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.jumpCount, 1);
  assert.deepStrictEqual(sevOf(r, 'location_jump'), ['low']);
});

test('EN ② 自带到达动作（rushed to the office）：豁免', () => {
  const t = [
    'SCENE 1  Night',
    'She lay in bed, staring at the ceiling.',
    'She rushed to the office and opened her laptop.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.jumpCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('EN ③ INT 场标 + walking in the rain：low', () => {
  const t = [
    'INT. BEDROOM - NIGHT',
    'She sat on the edge of the bed.',
    'She was walking in the rain, sobbing.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.intExtSceneCount, 1);
  assert.deepStrictEqual(sevOf(r, 'set_conflict'), ['low']);
});

test('EN ③ 隔窗看星（through the window）：豁免', () => {
  const t = [
    'INT. BEDROOM - NIGHT',
    'She gazed up at the stars through the window.',
  ].join('\n');
  const r = locationContinuityCheck(t, 'en');
  assert.strictEqual(r.conflictCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('语言隔离：中文稿走 EN 检测 / 英文稿走 ZH 检测均不误报', () => {
  const zh = [
    '第1场 北京 公寓 夜', '△她躺在家里的床上。',
    '第2场 上海 酒店 夜', '△她端着酒杯。',
  ].join('\n');
  const en = [
    'SCENE 1  New York office - DAY', 'He slammed the file.',
    'SCENE 2  London hotel - NIGHT', 'She held a glass.',
  ].join('\n');
  assert.strictEqual(locationContinuityCheck(zh, 'en').issueCount, 0);
  assert.strictEqual(locationContinuityCheck(en, 'zh').issueCount, 0);
});
