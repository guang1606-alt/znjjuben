'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { emptyVow } = require('../dist/engine/empty-vow.js');

/* ============ 中文 ============ */

test('zh: ≥2 句无打法誓言扣分，行号/场景准确', () => {
  const draft = [
    '场1：夜·卧室',
    '△林晚望着窗外。',
    '林晚：我要让他付出代价。',
    '场2：夜·灵堂',
    '△她盯着遗像。',
    '林晚：此仇不报，誓不为人。',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 70);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [3, 6]);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.strictEqual(r.hits[1].sceneIndex, 1);
  assert.strictEqual(r.hits[0].speaker, '林晚');
  assert.ok(r.hits.every((h) => h.rescued === false));
});

test('zh: 单次誓言不罚（集尾合法情绪锤）', () => {
  const r = emptyVow('场1：夜\n林晚：我失去的，会亲手一件件拿回来。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 跨逗号誓言整条 cue 命中', () => {
  const r = emptyVow('场1：夜\n林晚：我失去的，会亲手一件件拿回来。');
  assert.ok(r.hits[0].marker.includes('拿回来'));
});

test('zh: 誓言带具体筹码（律师/录音）rescued', () => {
  const draft = [
    '场1：夜',
    '林晚：我要让他身败名裂。',
    '△她把录音备份发给了律师。',
    '林晚：明天董事会，我亲自放。',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 同句自带打法锚点 rescued（亲子鉴定+开庭）', () => {
  const r = emptyVow('场1：夜\n林晚：我不会放过他。亲子鉴定我已经拿到了，周五开庭。');
  assert.strictEqual(r.hits[0].rescued, true);
});

test('zh: 第二人称当面威胁不判（归 empty-threat）', () => {
  const draft = [
    '场1：日',
    '沈志国：你给我等着！',
    '林晚：你会后悔的。',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 生活发誓（不再喝奶茶）不判', () => {
  const r = emptyVow('场1：夜\n林晚：我发誓我再也不喝奶茶了。');
  assert.strictEqual(r.hitCount, 0);
});

test('zh: 第三人称多样誓言均命中', () => {
  const draft = [
    '场1：夜', '林晚：血债必须血偿。',
    '场2：夜', '林晚：总有一天，我要让他跪着求我。',
    '场3：夜', '林晚：这笔账，我要他加倍奉还。',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.ok(r.score < 70); // n=3 → 50
  assert.ok(r.issues[0].includes('空转誓言'));
  assert.ok(r.advice[0].includes('删掉口号'));
});

test('zh: 封底 20（≥5 句空转）', () => {
  const draft = [
    '场1：夜', '林晚：我要让他付出代价。',
    '场2：夜', '林晚：此仇不报誓不为人。',
    '场3：夜', '林晚：我要亲手报仇。',
    '场4：夜', '林晚：血债血偿。',
    '场5：夜', '林晚：我不会放过他们。',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 叙述行写誓言不判（只管 cue 台词）', () => {
  const r = emptyVow('场1：夜\n△她在心里发誓，要让他付出代价。');
  assert.strictEqual(r.hitCount, 0);
});

/* ============ English ============ */

test('en: two plan-less vows penalized with line numbers', () => {
  const draft = [
    'INT. BEDROOM - NIGHT',
    'Lina stares out the window.',
    'LINA: I will make him pay.',
    'INT. HALL - NIGHT',
    'LINA: Revenge will be mine.',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [3, 5]);
  assert.strictEqual(r.hits[0].speaker, 'LINA');
});

test('en: single vow exempt', () => {
  const r = emptyVow("INT. ROOM - NIGHT\nLINA: This time, I will take back everything that is mine.");
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('en: vow grounded by concrete next move rescued', () => {
  const draft = [
    'INT. OFFICE - NIGHT',
    'LINA: I am going to destroy him.',
    'She seals the DNA report in an envelope.',
    'LINA: Tomorrow at the board meeting.',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('en: second-person threats not counted (empty-threat territory)', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'VICTOR: You will regret this.',
    'LINA: Mark my words.',
  ].join('\n');
  const r = emptyVow(draft);
  assert.strictEqual(r.hitCount, 0);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(emptyVow('').score, 100);
  assert.strictEqual(emptyVow('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = emptyVow([
    'INT. ROOM - NIGHT',
    'LINA: I will make him pay.',
    'INT. ROOM - NIGHT',
    'LINA: Revenge will be mine.',
  ].join('\n'));
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
