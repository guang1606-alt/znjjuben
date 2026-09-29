'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { subtextErase } = require('../dist/engine/subtext-erase.js');

const pad = (n) =>
  Array.from({ length: n }, (_, i) => `△林晚看着窗外，指尖在扶手上轻轻敲了一下${i + 1}。`);
const epad = (n) =>
  Array.from({ length: n }, (_, i) => `Linna stares out the window, her fingers tapping the armrest (${i + 1}).`);

/* ============================ 中文：旁白翻译机 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(subtextErase('').score, 100);
});

test('zh: "这话分明是在警告她"紧邻台词 → 命中，77', () => {
  const r = subtextErase(['沈志国：你最近还是少出门。', '△这话分明是在警告她。'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].anchorLine, 1);
  assert.equal(r.hits[0].line, 2);
  assert.match(hitsMarker(r), /警告/);
  assert.equal(r.score, 77);
});

test('zh: "她听出了话里的逐客令" → 命中', () => {
  const r = subtextErase([...pad(4), '林晚：茶凉了。', '△她听出了话里的逐客令。'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].anchorLine, 5);
});

test('zh: "这话是说给她一个人听的" → 命中', () => {
  const r = subtextErase(['婆婆：既然回来了，就守顾家的规矩。', '△这话是说给她一个人听的。'].join('\n'));
  assert.equal(r.hits.length, 1);
});

test('zh: "意思再明白不过……逐客令" → 命中', () => {
  const r = subtextErase(['沈志国：门在那边。', '△意思再明白不过，他在下逐客令。'].join('\n'));
  assert.equal(r.hits.length, 1);
});

/* ============================ 中文：豁免与边界 ============================ */

test('neg zh: 台词后跟可演的动作反应，不判', () => {
  const r = subtextErase(['林晚：我没事。', '△她端起茶杯，吹了吹浮沫。'].join('\n'));
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('neg zh: 角色内心抽象宣判归 mind-reading 域，不判', () => {
  const r = subtextErase([...pad(4), '△她知道，这一走就是永别。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 隔两行以上无台词锚点（中间隔场/隔戏），不判', () => {
  const r = subtextErase(['林晚：茶凉了。', ...pad(2), '△这话像是在说天气。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 普通铺垫叙述无翻译框架词，不判', () => {
  const r = subtextErase([...pad(4), '沈志国：把合同拿来。', '△林晚起身走向书柜。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 台词自身含"意思"不属叙述行，不判', () => {
  const r = subtextErase(['林晚：你这话什么意思？', '沈志国：没什么意思。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(subtextErase('').score, 100);
});

test('en: "His words were a warning..." anchored to dialogue → 77', () => {
  const r = subtextErase(['VICTOR: Be careful who you trust.', 'His words were a warning she did not need spelled out.'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].anchorLine, 1);
  assert.equal(r.score, 77);
});

test('en: "could hear the ice underneath her voice" → hit', () => {
  const r = subtextErase(['LINNA: Stay as long as you like.', 'She could hear the ice underneath her voice.'].join('\n'));
  assert.equal(r.hits.length, 1);
});

test('en: "His meaning was clear" → hit', () => {
  const r = subtextErase(['VICTOR: The door is right there.', 'His meaning was clear: leave.'].join('\n'));
  assert.equal(r.hits.length, 1);
});

test('neg en: actable reaction narration → 100', () => {
  const r = subtextErase(['LINNA: I am fine.', 'She lifted the cup and blew on the tea.'].join('\n'));
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('neg en: plain pad narration → 100', () => {
  const r = subtextErase(epad(4).join('\n'));
  assert.equal(r.hits.length, 0);
});

/* ============================ 多次命中封底 ============================ */

test('score: 三处翻译机 → 31，四处及以上封底 25', () => {
  const three = [
    'VICTOR: Be careful.',
    'His words were a warning.',
    'LINNA: Tea is cold.',
    'The message was clear.',
    'VICTOR: Stay then.',
    'His meaning was clear to everyone.',
  ].join('\n');
  const r3 = subtextErase(three);
  assert.equal(r3.hits.length, 3);
  assert.equal(r3.score, 31);

  const four = three + '\nLINNA: I will see myself out.\nThe unspoken message was a declaration of war.';
  const r4 = subtextErase(four);
  assert.ok(r4.hits.length >= 4);
  assert.equal(r4.score, 25);
});

function hitsMarker(r) {
  return r.hits.map((h) => h.marker).join('|');
}
