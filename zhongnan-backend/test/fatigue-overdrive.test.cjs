// v2.113 块121：fatigue-overdrive 疲劳透支开挂/精力阀门 单测
// 铁证：node test/fatigue-overdrive.test.cjs（改引擎后必须先 npm run build）
const test = require('node:test');
const assert = require('node:assert');
const { fatigueOverdrive } = require('../dist/engine/fatigue-overdrive.js');

/* 隔离行（不含任何词表锚，防跨用例窗口串染） */
const ISO_ZH1 = '△墙角堆着几个纸箱。';
const ISO_ZH2 = '△窗台上落着一层灰。';
const ISO_EN1 = 'Paint peeled from the window frame.';
const ISO_EN2 = 'A neon sign buzzed outside.';

const passthrough = (draft) => fatigueOverdrive(draft);

test('空稿：score 100 零命中', () => {
  const r = passthrough('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('中文单事件：首次豁免（hitCount 照计=1，hits 空，score 100）', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('中文两事件：首次豁免 + 第二事件未救（unrescued=1，score=70）', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '内景 案侦队 白天',
    '老陈：你水米未进两天了，先歇歇。',
    ISO_ZH1,
    '△他神采奕奕地走进会议室。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(r.hits.every((h) => !h.rescued));
});

test('中文多事件未救：3 事件→50，4 事件→30，封底 5 事件→20', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '内景 案侦队 白天',
    '老陈：你水米未进两天了，先歇歇。',
    ISO_ZH1,
    '△他神采奕奕地走进会议室。',
    ISO_ZH2,
    '内景 审讯室 夜',
    '搭档：你都筋疲力尽了。',
    '小舟：不用。',
    '△他中气十足地审了一夜嫌犯。',
  ].join('\n');
  const r3 = passthrough(draft);
  assert.strictEqual(r3.hitCount, 3);
  assert.strictEqual(r3.unrescuedCount, 2);
  assert.strictEqual(r3.score, 50);
  // 第 4 次未救 → 90-60=30
  const draft4 = `${draft}\n内景 顶楼 天台 夜\n法医：你体力透支了。\n△他健步如飞地追上了逃犯。`;
  const r4 = passthrough(draft4);
  assert.strictEqual(r4.hitCount, 4);
  assert.strictEqual(r4.score, 30);
  // 第 5 次未救 → 90-80=10 → 封底 20
  const r5 = passthrough(`${draft4}\n内景 仓库 夜\n队长：你都撑不住了。\n△他徒手攀上了水塔。`);
  assert.strictEqual(r5.hitCount, 5);
  assert.strictEqual(r5.score, 20);
});

test('rescue A 补给锚：第二事件窗口带"灌下浓茶"→ rescued，score 100', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '内景 案侦队 白天',
    '老陈：你水米未进两天了。',
    '△他灌下三杯浓茶，转身走进会议室。',
    '△他神采奕奕地宣布结案。',
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.ok(r.hits[0].rescued);
});

test('rescue B 代价锚与行动同行："一口气爬上六楼，眼前一黑扶住了墙"', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '内景 案侦队 白天',
    '老陈：你水米未进两天了。',
    ISO_ZH1,
    '△他一口气冲上顶楼，眼前一黑扶住了墙才站稳。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.ok(r.hits[0].rescued);
});

test('rescue C 接力锚："换我来开"', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '内景 城郊公路 夜',
    '搭档：你体力透支了，别硬撑。',
    '△搭档换我来开，他靠上椅背。',
    '△小舟照常办案，翻开了卷宗。',
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.ok(r.hits[0].rescued);
});

test('纯透支陈述（无超荷行动）：零命中', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    '小舟：水米未进两天，胃里空得发慌。',
    ISO_ZH1,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('纯行动无透支声明：零命中（健康人行动不归本引擎）', () => {
  const draft = [
    '内景 案侦队 白天',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    '△他神采奕奕地走进会议室。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('裸"累/有点困"与"没喝酒"拒绝语境不收：零命中', () => {
  const draft = [
    '内景 案侦队 白天',
    '小舟：我有点累，也有点困。',
    '同事：没喝酒吧？没喝酒就照常开车。',
    ISO_ZH1,
    '△他翻开了卷宗。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('跨场景头不合并：行动行隔场景头（dist≤2）→ 两事件', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    '△他一口气爬上了六楼。',
    '内景 楼道 夜',
    '△他神采奕奕地敲开了门。',
    '小舟：我两天没合眼了。',
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('相邻 ≤2 行行动行合并：透支+行动+行动（隔 1 行）→ 单事件', () => {
  const draft = [
    '内景 出租屋 夜',
    '小舟：我已经三天三夜没合眼了。',
    ISO_ZH1,
    '△他一口气爬上了六楼。',
    ISO_ZH2,
    '△他中气十足地喊开了门。',
    ISO_ZH1,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('场景头行不参与匹配：透支词落在场景头不触发', () => {
  const draft = [
    '内景 三天没合眼之后的天台 夜',
    ISO_ZH1,
    '△他翻开了卷宗。',
    ISO_ZH2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ───────── 英文 ───────── */

test('EN 两事件：首次豁免 + 第二事件未救（unrescued=1，score=70）', () => {
  const draft = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    ISO_EN1,
    'He sprinted up the stairs and pounded on the door.',
    ISO_EN2,
    'INT. PRECINCT - DAY',
    'CHEN: You have not eaten in two days.',
    ISO_EN1,
    'She went straight back to work, fresh as a daisy.',
    ISO_EN2,
  ].join('\n');
  const r = passthrough(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('EN 单事件豁免 + 纯透支零命中', () => {
  const solo = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    ISO_EN1,
    'He sprinted up the stairs.',
    ISO_EN2,
  ].join('\n');
  const r1 = passthrough(solo);
  assert.strictEqual(r1.hitCount, 1);
  assert.strictEqual(r1.hits.length, 0);
  assert.strictEqual(r1.score, 100);

  const pure = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    'She was running on fumes.',
    ISO_EN1,
  ].join('\n');
  const r2 = passthrough(pure);
  assert.strictEqual(r2.hitCount, 0);
  assert.strictEqual(r2.score, 100);
});

test('EN rescue：补给锚（caffeine pills）与代价锚（vision went dark 同行）', () => {
  const supply = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    ISO_EN1,
    'He sprinted up the stairs.',
    ISO_EN2,
    'INT. PRECINCT - DAY',
    'CHEN: You have not eaten in two days.',
    'He swallowed two caffeine pills and went straight back to work.',
    ISO_EN1,
  ].join('\n');
  const r1 = passthrough(supply);
  assert.strictEqual(r1.hitCount, 2);
  assert.strictEqual(r1.unrescuedCount, 0);
  assert.strictEqual(r1.score, 100);
  assert.ok(r1.hits[0].rescued);

  const cost = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    ISO_EN1,
    'He sprinted up the stairs.',
    ISO_EN2,
    'INT. PRECINCT - DAY',
    'CHEN: You have not eaten in two days.',
    ISO_EN1,
    'He went straight back to work until his vision went dark and he grabbed the doorframe to steady himself.',
    ISO_EN2,
  ].join('\n');
  const r2 = passthrough(cost);
  assert.strictEqual(r2.hitCount, 2);
  assert.strictEqual(r2.unrescuedCount, 0);
  assert.strictEqual(r2.score, 100);
  assert.ok(r2.hits[0].rescued);
});

test('EN rescue：接力锚（took over / in shifts）与 didn\'t break a sweat 触发', () => {
  const relief = [
    'INT. APARTMENT - NIGHT',
    'ZHOU: I have not slept in three days.',
    ISO_EN1,
    'He sprinted up the stairs.',
    ISO_EN2,
    'INT. HIGHWAY - NIGHT',
    'CHEN: You are dead on your feet. Pull over.',
    'He kept driving through the night anyway.',
    'She took over the wheel, and they drove in shifts.',
    ISO_EN1,
  ].join('\n');
  const r1 = passthrough(relief);
  assert.strictEqual(r1.hitCount, 2);
  assert.strictEqual(r1.unrescuedCount, 0);
  assert.strictEqual(r1.score, 100);
  assert.ok(r1.hits[0].rescued);

  const sweat = [
    'INT. WAREHOUSE - NIGHT',
    'ZHOU: Three days without sleep.',
    ISO_EN1,
    'He fought like new and did not break a sweat.',
    ISO_EN2,
    'INT. ROOFTOP - DAY',
    'CHEN: You are running on fumes.',
    ISO_EN1,
    'He kept working through the night anyway.',
    ISO_EN2,
  ].join('\n');
  const r2 = passthrough(sweat);
  assert.strictEqual(r2.hitCount, 2);
  assert.strictEqual(r2.unrescuedCount, 1);
  assert.strictEqual(r2.score, 70);
});
