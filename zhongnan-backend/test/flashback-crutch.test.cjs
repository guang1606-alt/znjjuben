'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { flashbackCrutch } = require('../dist/engine/flashback-crutch.js');

/* ============ 中文 ============ */

test('zh: 两个互不相同的短闪回不判', () => {
  const draft = [
    '场1：夜·林宅',
    '【闪回】',
    '△母亲把玉镯塞进她手里。',
    '林晚：妈。',
    '场2：夜',
    '（回忆）',
    '△他在雨夜撕碎了婚书。',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 同一闪回整段重播 → 第2次即命中，行号/重复标记准确', () => {
  const draft = [
    '场1：夜',
    '【闪回】',
    '△雨夜，她跪在沈家门口。',
    '△婚书摔在她脸上。',
    '△宾客哄笑着散开。',
    '场2：夜',
    '△她攥紧了拳头。',
    '【闪回】',
    '△雨夜，她跪在沈家门口。',
    '△婚书摔在她脸上。',
    '△宾客哄笑着散开。',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].repeated, true);
  assert.strictEqual(r.hits[0].line, 8);
  assert.strictEqual(r.score, 70);
});

test('zh: 三个互异长闪回 → 第3个长蒙太奇命中（n=1 → 70）', () => {
  const blocks = ['A', 'B', 'C'].map((t, i) => [
    `场${i + 1}：夜`,
    '【闪回】',
    `△${t}1`,
    `△${t}2`,
    `△${t}3`,
    `△${t}4`,
  ].join('\n')).join('\n');
  const r = flashbackCrutch(blocks);
  assert.strictEqual(r.flashbackCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].repeated, false);
  assert.strictEqual(r.hits[0].line, 14);
  assert.strictEqual(r.score, 70);
});

test('zh: 四个互异长闪回 → n=2 → 50', () => {
  const blocks = ['A', 'B', 'C', 'D'].map((t, i) => [
    `场${i + 1}：夜`,
    '【闪回】',
    `△${t}1`,
    `△${t}2`,
    `△${t}3`,
    `△${t}4`,
  ].join('\n')).join('\n');
  const r = flashbackCrutch(blocks);
  assert.strictEqual(r.hits.length, 2);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [14, 20]);
  assert.strictEqual(r.score, 50);
});

test('zh: 长蒙太奇后切场接当下动作 → rescued，不扣分', () => {
  const draft = [
    '场1：夜', '【闪回】', '△A1', '△A2', '△A3', '△A4',
    '场2：日', '【闪回】', '△B1', '△B2', '△B3', '△B4',
    '场3：夜', '【闪回】', '△C1', '△C2', '△C3', '△C4',
    '场4：日·律师楼',
    '△她当晚拨通了律师的电话。',
    '林晚：周五递交材料。',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount ?? r.hits.filter((h) => !h.rescued).length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 长蒙太奇后无动作 → 命中 70', () => {
  const draft = [
    '场1：夜', '【闪回】', '△A1', '△A2', '△A3', '△A4',
    '场2：日', '【闪回】', '△B1', '△B2', '△B3', '△B4',
    '场3：夜', '【闪回】', '△C1', '△C2', '△C3', '△C4',
    '场4：日',
    '△她望着窗外。',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('zh: 重复播片 + 长蒙太奇叠加 → n=2 → 50', () => {
  const draft = [
    '场1：夜', '【闪回】', '△A1', '△A2', '△A3', '△A4',
    '场2：夜', '【闪回】', '△A1', '△A2', '△A3', '△A4',
    '场3：夜', '【闪回】', '△C1', '△C2', '△C3', '△C4',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.hits[0].repeated, true);
  assert.strictEqual(r.hits[1].repeated, false);
  assert.strictEqual(r.score, 50);
});

test('zh: 场景头截断块；（闪回结束）与△闪回：单行不误判', () => {
  const draft = [
    '场1：夜',
    '△闪回：三年前的雨夜婚礼。',
    '△宾客的笑声犹在耳边。',
    '（闪回结束）',
    '△她回到当下。',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 无闪回普通稿', () => {
  const r = flashbackCrutch('场1：夜\n林晚：你到底想干什么？\n△摔门而出。');
  assert.strictEqual(r.flashbackCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 封底 20（同一闪回播 5 次 → 4 hits）', () => {
  const seg = ['【闪回】', '△雨夜，她跪在门口。', '△婚书摔在她脸上。'].join('\n');
  const draft = [seg, '场2：夜', seg, '场3：夜', seg, '场4：夜', seg, '场5：夜', seg].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.hits.length, 4);
  assert.strictEqual(r.score, 20);
  assert.ok(r.issues[0].includes('空转'));
  assert.ok(r.advice[0].includes('扳机'));
});

test('zh: 空稿 100', () => {
  assert.strictEqual(flashbackCrutch('').score, 100);
  assert.strictEqual(flashbackCrutch('  \n ').score, 100);
});

/* ============ English ============ */

test('en: same FLASHBACK block replayed → 70 with correct line', () => {
  const draft = [
    'INT. MANSION - NIGHT',
    'FLASHBACK - RAIN - WEDDING',
    'She kneels at the Shen family gate.',
    'The contract hits the ground.',
    'Guests laugh and scatter.',
    'INT. MANSION - NIGHT',
    'She clenches her fist.',
    'FLASHBACK - RAIN - WEDDING',
    'She kneels at the Shen family gate.',
    'The contract hits the ground.',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatCount, 1);
  assert.strictEqual(r.hits[0].repeated, true);
  assert.strictEqual(r.hits[0].line, 8);
  assert.strictEqual(r.score, 70);
});

test('en: four distinct long flashbacks → 50', () => {
  const blocks = ['A', 'B', 'C', 'D'].map((t, i) => [
    `INT. ROOM ${i + 1} - NIGHT`,
    'FLASHBACK',
    `${t} one line of memory.`,
    `${t} another line.`,
    `${t} a third line.`,
    `${t} a fourth line.`,
  ].join('\n')).join('\n');
  const r = flashbackCrutch(blocks);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.score, 50);
});

test('en: flashback word inside cue lines ignored; INT. FLASHBACK header recognized', () => {
  const draft = [
    'INT. OFFICE - NIGHT',
    'LINA: I keep having flashbacks of that night.',
    'VICTOR: You call this a FLASHBACK?',
    'INT. FLASHBACK - CHURCH - NIGHT',
    'She signs the papers with a shaking hand.',
    'The candles gutter.',
    'INT. PRESENT - OFFICE - NIGHT',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: FLASHBACK END terminates a block', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'FLASHBACK',
    'She kneels.',
    'The rain pours.',
    'FLASHBACK END',
    'She stands up.',
    'FLASHBACK',
    'She kneels.',
    'The rain pours.',
    'FLASHBACK END',
  ].join('\n');
  const r = flashbackCrutch(draft);
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatCount, 1);
  assert.strictEqual(r.score, 70);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(flashbackCrutch('').score, 100);
  assert.strictEqual(flashbackCrutch('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = flashbackCrutch([
    'INT. MANSION - NIGHT',
    'FLASHBACK - RAIN',
    'She kneels at the gate.',
    'The contract hits the ground.',
    'INT. MANSION - NIGHT',
    'FLASHBACK - RAIN',
    'She kneels at the gate.',
    'The contract hits the ground.',
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
