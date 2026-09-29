'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeChoice } = require('../dist/engine/fake-choice.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(fakeChoice('').score, 100);
});

test('zh: 秒答标记+我签（孩子和公司只能保一个）→ 假选择 65', () => {
  const r = fakeChoice('场1：日·书房\n沈志国：孩子和公司，你只能保一个。\n林晚：（毫不犹豫）我签。\n沈志国：算你识相。');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].instant, true);
  assert.equal(r.hits[0].gapLines, 0);
  assert.equal(r.hits[0].answerLine, 3);
  assert.equal(r.score, 65);
});

test('zh: 要么…要么 + 零间隔我签（无秒答词，gap≤2）→ 假选择', () => {
  const r = fakeChoice('场1：日\n沈志国：要么签字，要么你弟弟今晚就进看守所。\n林晚：我签。\n△她转身离开。');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].instant, false);
  assert.equal(r.hits[0].gapLines, 0);
});

test('rescue zh: 中间有挣扎（沉默良久+攥到发白）→ 豁免', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司，你只能保一个。\n△林晚沉默良久，指节攥得发白。\n林晚：……我签。\n△深夜，她翻出女儿演出的录像，一个人看到天亮。');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('rescue zh: 代价兑付（空病房/没赶到）→ 豁免', () => {
  const r = fakeChoice('场1：日\n医生：孩子和手术费，只能先顾一头。\n林晚：我签放弃治疗的单子。\n△她到底没赶到见最后一面，病床前空着。');
  assert.equal(r.hits.length, 0);
});

test('rescue zh: 第三条路（我两个都要/凭什么只能我选）→ 豁免', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司，你只能保一个。\n林晚：我两个都要。\n沈志国：什么？\n林晚：凭什么只能我选？');
  assert.equal(r.hits.length, 0);
});

test('rescue zh: 悬而未决（窗口内没有答复）→ 豁免', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司，你只能保一个。\n△林晚盯着桌上的笔，没有动。\n△窗外天色黑了下去。');
  assert.equal(r.hits.length, 0);
});

test('neg zh: 咖啡还是茶（无利害词）不是两难', () => {
  const r = fakeChoice('场1：日\n秘书：您是喝咖啡还是茶？\n林晚：咖啡。');
  assert.equal(r.hits.length, 0);
});

test('neg zh: 间隔 3 行以上且无秒答词 → 存疑不判', () => {
  const r = fakeChoice('场1：日\n沈志国：签字，或者你弟弟坐牢。\n△林晚看着合同。\n△沈志国端起茶。\n△风把纸吹起一角。\n林晚：我签。');
  assert.equal(r.hits.length, 0);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(fakeChoice('').score, 100);
});

test('en: Sign, or brother goes to jail + Fine I will sign → fake choice', () => {
  const r = fakeChoice('INT. STUDY - DAY\nVICTOR: Sign, or your brother goes to jail tonight. Choose.\nLINNA: Fine. I will sign.');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].gapLines, 0);
  assert.equal(r.score, 65);
});

test('en: either company or son + (without hesitation) I choose → fake choice', () => {
  const r = fakeChoice('INT. OFFICE - DAY\nVICTOR: It is either the company or your son. You have two choices.\nLINNA (without hesitation): I choose the company.');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].instant, true);
});

test('rescue en: long silence + knuckles whitened + cost (empty hospital bed) → exempt', () => {
  const r = fakeChoice('INT. STUDY - DAY\nVICTOR: Sign, or your brother goes to jail tonight.\nA long silence. Linna stared at the pen, knuckles whitened.\nLINNA: I will sign.\nThat night she sat alone beside an empty hospital bed she never reached.');
  assert.equal(r.hits.length, 0);
});

test('rescue en: third option (I will take both) → exempt', () => {
  const r = fakeChoice('INT. STUDY - DAY\nVICTOR: It is either the company or your son.\nLINNA: I will take both.\nVICTOR: What?\nLINNA: Why should I have to choose?');
  assert.equal(r.hits.length, 0);
});

test('rescue en: unresolved, pen stays on table → exempt', () => {
  const r = fakeChoice('INT. STUDY - DAY\nVICTOR: Choose: the company or your son.\nShe did not speak. The pen stayed on the table.\nCUT TO BLACK.');
  assert.equal(r.hits.length, 0);
});

test('neg en: coffee or tea has no stakes → not a dilemma', () => {
  const r = fakeChoice('INT. ROOM - DAY\nSECRETARY: Coffee or tea?\nLINNA: Coffee, thanks.');
  assert.equal(r.hits.length, 0);
});

/* ============================ 封底与结构 ============================ */

test('score: 三个假选择封底 20', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司只能保一个。\n林晚：我签。\n场2：日\n沈志国：要么自首要么他死。\n林晚：我去自首。\n场3：日\n沈志国：钱和婚只能留一样。\n林晚：我签离婚。\n场4：日\n△天晴了。');
  assert.equal(r.hits.length, 3);
  assert.equal(r.score, 20);
});

test('boundary: 窗口遇场景头截断，答复在下一场不算秒答', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司只能保一个。\n场2：日\n林晚：我签。');
  assert.equal(r.hits.length, 0);
});

test('struct: hit 携带 dilemma/answer/speaker 切片', () => {
  const r = fakeChoice('场1：日\n沈志国：孩子和公司，你只能保一个。\n林晚：我签。');
  assert.ok(r.hits[0].dilemma.includes('只能保一个'));
  assert.ok(r.hits[0].answer.includes('我签'));
  assert.equal(r.hits[0].speaker, '林晚');
});
