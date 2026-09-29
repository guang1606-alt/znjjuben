'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exitCliche } = require('../dist/engine/exit-cliche.js');

// 多场拼接（场标题独占行）
const mk = (scenes, prefix = '场') =>
  scenes.map((s, i) => (i === 0 ? s : `${prefix}${i}：日·客厅\n${s}`)).join('\n');
const emk = (scenes) =>
  scenes.map((s, i) => (i === 0 ? s : `INT. ROOM ${i + 1} - DAY\n${s}`)).join('\n');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  const r = exitCliche('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 两场非末场末拍都是强离场（摔门/夺门）→ 70', () => {
  const r = exitCliche(mk([
    '林晚：我不签。\n沈志国：你会后悔。\n△林晚抓起包，摔门而去。',
    '林晚：把文件给我。\n△沈志国冷笑，夺门而出。',
    '林晚：我们谈谈。\n△两人在桌边坐下。',
  ]));
  assert.equal(r.sceneCount, 3);
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[0].closer, '摔门而去');
  assert.equal(r.score, 70);
});

test('zh: 三场强离场（摔门/头也不回冲出/转身就走+砰）→ 45', () => {
  const r = exitCliche(mk([
    'A：滚。\n△她摔门而去。',
    'B：随便。\n△他头也不回地冲出办公室。',
    'C：够了。\n△她转身就走，门在身后砰地关上。',
    'D：结束。\n△他点了点头。',
  ]));
  assert.equal(r.hits.length, 3);
  assert.equal(r.score, 45);
});

test('zh: 仅一次强离场 → 100（单次可能是情绪最高点）', () => {
  const r = exitCliche(mk([
    '林晚：我不签。\n△林晚摔门而去。',
    '林晚：好。\n△两人坐下谈。',
    '林晚：嗯。\n△继续喝茶。',
  ]));
  assert.equal(r.hits.length, 1);
  assert.equal(r.score, 100);
});

test('rescue zh: 末场摔门跳过（归 cliffhanger），不构两场依赖', () => {
  const r = exitCliche(mk([
    '林晚：谈吧。\n△两人坐下。',
    '林晚：好。\n△继续谈。',
    '林晚：走着瞧。\n△她摔门而去。',
  ]));
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('rescue zh: 摔门后最后一行落在钩子（手机亮+未读短信）→ 该场不判', () => {
  const r = exitCliche(mk([
    'A：滚。\n△她摔门而去。',
    'B：随便。\n△他夺门而出。',
    'C：你完了。\n△她摔门而去。\n林晚的手机突然亮起，一条未读短信跳在锁屏上。',
  ]));
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 70);
});

test('neg zh: 软离场（轻轻带门/叹气/默默离开）归 soft-ending，不判', () => {
  const r = exitCliche(mk([
    '林晚：我没事。\n△她轻轻带上房门。',
    '沈志国：随她。\n△他叹了口气。',
    '林晚：走吧。\n△她默默离开。',
  ]));
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 同款"摔门而去"跨场复用 → 70 再降 10 = 60', () => {
  const r = exitCliche(mk([
    'A：滚。\n△她摔门而去。',
    'B：走。\n△他想了想，也摔门而去。',
    'C：谈。\n△两人坐下。',
  ]));
  assert.equal(r.hits.length, 2);
  assert.ok(r.hits.every((h) => h.repeatedPhrase));
  assert.equal(r.score, 60);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(exitCliche('').score, 100);
});

test('en: two non-final scenes end stormed/marched out → 70', () => {
  const r = exitCliche(emk([
    'LINNA: I am not signing.\nShe stormed out and slammed the door.',
    'VICTOR: Enough.\nHe marched out without a backward glance.',
    'LINNA: Sit.\nThey sat down.',
  ]));
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 70);
});

test('en: single hard exit → 100', () => {
  const r = exitCliche(emk([
    'VICTOR: Get out.\nShe stormed out.',
    'They spoke quietly.\nHe nodded.',
    'She poured tea.\nThe room stayed calm.',
  ]));
  assert.equal(r.hits.length, 1);
  assert.equal(r.score, 100);
});

test('rescue en: last line is a phone hook after the exit → not counted', () => {
  const r = exitCliche(emk([
    'VICTOR: Leave.\nShe stormed out.',
    'LINNA: No.\nHe marched out.',
    'VICTOR: Done.\nShe slammed the door.\nHer phone buzzed with an unread text message.',
  ]));
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 70);
});

test('neg en: quiet exits (softly closed door/sighed) → 100', () => {
  const r = exitCliche(emk([
    'LINNA: Fine.\nShe closed the door softly behind her.',
    'He sighed and looked away.\nThe room was quiet.',
    'She sat back down slowly.\nNothing moved.',
  ]));
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

/* ============================ 封底 ============================ */

test('score: 五场强离场封底 20', () => {
  const r = exitCliche(mk([
    'A：一。\n△她摔门而去。',
    'B：二。\n△他夺门而出。',
    'C：三。\n△她转身就走。',
    'D：四。\n△他拂袖而去。',
    'E：五。\n△她冲出门。',
    'F：六。\n△他点了点头。',
  ]));
  assert.equal(r.hits.length, 5);
  assert.equal(r.score, 20);
});
