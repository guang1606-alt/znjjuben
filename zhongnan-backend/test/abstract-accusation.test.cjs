'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abstractAccusation } = require('../dist/engine/abstract-accusation.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(abstractAccusation('').score, 100);
});

test('zh: 五句全称零事实 → 封底 20', () => {
  const draft = '场1：日·客厅\n林晚：你从来都这样！\n沈志国：我哪样了？\n林晚：你心里只有公司，每次都是我让步。\n沈志国：我没有。\n林晚：你永远不会改，说过多少遍了。';
  const r = abstractAccusation(draft);
  assert.ok(r.unrescuedCount >= 5);
  assert.equal(r.score, 20);
  assert.ok(r.issues.length > 0);
  assert.ok(r.advice.length > 0);
});

test('zh: 单次全称指控不判（情绪上头的生活话）', () => {
  const r = abstractAccusation('场1：日\n林晚：你从来都这样！\n沈志国：对不起，我改。\n林晚：行了，吃饭吧。');
  assert.equal(r.unrescuedCount, 1);
  assert.equal(r.score, 100);
});

test('rescue zh: 甩具体事实（上周三家长会+医院签字）→ anchored 豁免', () => {
  const draft = '场1：日·客厅\n林晚：你从来都不管这个家！\n沈志国：我哪有？\n林晚：上周三家长会，座位上又是空的。那晚在医院签字的只有我。\n沈志国：那天我在见客户。';
  const r = abstractAccusation(draft);
  assert.equal(r.unrescuedCount, 0);
  assert.equal(r.score, 100);
});

test('rescue zh: 被指责方用事实回击（同窗口锚点）→ 豁免', () => {
  const draft = '场1：日\n林晚：你总是不信我！\n沈志国：监控里上周二晚上九点，进门的人就是你，你让我怎么信？\n林晚：那不是我。';
  const r = abstractAccusation(draft);
  assert.equal(r.score, 100);
});

test('neg zh: 叙述行"她从来没有……"不算第二人称指控', () => {
  const r = abstractAccusation('场1：日\n△她从来没有像现在这样平静过。\n林晚：把合同给我。\n沈志国：好。');
  assert.equal(r.universalCount, 0);
});

test('zh: n=2 起判 70 分', () => {
  const r = abstractAccusation('场1：日\n林晚：你总是不听人说话。\n沈志国：我听了。\n林晚：你根本不懂我。\n沈志国：别闹了。');
  assert.equal(r.unrescuedCount, 2);
  assert.equal(r.score, 70);
});

test('zh: 四句无锚指控 → 30 分中档', () => {
  const draft = '场1：日\n林晚：你从来不疼我。\n沈志国：胡说。\n林晚：你一直不在乎我。\n沈志国：够了。\n林晚：你永远不懂我。\n沈志国：住口。\n林晚：每次都是我低头。';
  const r = abstractAccusation(draft);
  assert.equal(r.unrescuedCount, 4);
  assert.equal(r.score, 30);
});

test('zh: 五句以上封底 20', () => {
  const draft = '场1：日\n林晚：你从来不疼我。\n沈志国：胡说。\n林晚：你一直不在乎我。\n沈志国：够了。\n林晚：你永远不懂我。\n沈志国：住口。\n林晚：你就知道工作。\n沈志国：滚。\n林晚：每次都是我低头。';
  const r = abstractAccusation(draft);
  assert.ok(r.unrescuedCount >= 5);
  assert.equal(r.score, 20);
});

test('zh: 锚点跨场不生效（场2 的事实救不了场1 的空吵架）', () => {
  const draft = '场1：日\n林晚：你从来都这样！\n沈志国：我没有。\n林晚：你总是这样。\n场2：日\n林晚：上周三家长会你没来。';
  const r = abstractAccusation(draft);
  assert.equal(r.unrescuedCount, 2);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(abstractAccusation('').score, 100);
});

test('en: never/always/all you ever/every time 零事实 → floor 20', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'LINNA: You never care about me!',
    'VICTOR: That is not true.',
    'LINNA: All you ever care about is work. Every single time!',
    'VICTOR: I do my best.',
    'LINNA: You always have an excuse, and you never change.',
  ].join('\n');
  const r = abstractAccusation(draft);
  assert.equal(r.score, 20);
  assert.ok(r.hits.every((h) => h.anchored === false));
});

test('rescue en: concrete facts (last Wednesday, recital, hospital, signed alone) → exempt', () => {
  const draft = [
    'INT. ROOM - DAY',
    'LINNA: You never care about this family!',
    'VICTOR: What?',
    'LINNA: Last Wednesday at the recital, your seat was empty again. That night at the hospital, I signed the papers alone.',
    'VICTOR: I was with a client that evening.',
  ].join('\n');
  const r = abstractAccusation(draft);
  assert.equal(r.unrescuedCount, 0);
  assert.equal(r.score, 100);
});

test('neg en: single universal line scores 100', () => {
  const r = abstractAccusation('INT. ROOM - DAY\nLINNA: You never listen to me!\nVICTOR: Sorry.\nLINNA: Forget it.');
  assert.equal(r.unrescuedCount, 1);
  assert.equal(r.score, 100);
});

test('rescue en: opponent fires back with date and object evidence', () => {
  const draft = [
    'INT. ROOM - DAY',
    'LINNA: You always doubt me!',
    'VICTOR: The CCTV at 9 p.m. last Tuesday shows you walking in. How am I supposed to believe you?',
    'LINNA: That was not me.',
  ].join('\n');
  const r = abstractAccusation(draft);
  assert.equal(r.score, 100);
});

/* ============================ 结构 ============================ */

test('struct: hit 携带行号/场景/snippet/marker', () => {
  const r = abstractAccusation('场1：日·客厅\n林晚：你从来都这样！\n沈志国：嗯。\n林晚：你永远不会改。');
  const h = r.hits[0];
  assert.equal(h.line, 2);
  assert.equal(h.sceneIndex, 0);
  assert.ok(h.snippet.includes('从来'));
  assert.ok(h.marker.includes('从来'));
});

test('struct: 英文输出零中文', () => {
  const r = abstractAccusation('INT. ROOM - DAY\nLINNA: You never help me!\nVICTOR: I do.\nLINNA: You always refuse, you never even try.\nVICTOR: Enough.');
  const joined = JSON.stringify(r);
  assert.equal(/[一-鿿]/.test(joined), false);
});
