'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tearBait } = require('../dist/engine/tear-bait.js');

/* ============ 中文 ============ */

test('zh: 前两次豁免，第3次起命中', () => {
  const draft = [
    '场1：夜',
    '△她眼眶一红。',
    '场2：日',
    '△他鼻子一酸。',
    '场3：夜',
    '△泪水在她眼眶里打转。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 6);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 仅两次泪点豁免不扣分', () => {
  const draft = [
    '场1：夜',
    '△她眼眶一红。',
    '场2：日',
    '△他鼻子一酸。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 四次泪点 → n=2 → 50', () => {
  const draft = [
    '场1：夜', '△她眼眶一红。',
    '场2：日', '△他鼻子一酸。',
    '场3：夜', '△泪水在她眼眶里打转。',
    '场4：日', '△她噙着泪别过脸。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 4);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('泪点开关'));
  assert.ok(r.advice[0].includes('眼泪贵在稀有'));
});

test('zh: 相邻两行泪点合并为同一次情绪', () => {
  const draft = [
    '场1：夜',
    '△她眼睛一酸。',
    '△眼泪掉了下来。',
    '场2：日',
    '△泪水在眼眶里打转。',
    '场3：夜',
    '△他噙着泪。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 7);
});

test('zh: 擦干眼泪收起来算 rescue', () => {
  const draft = [
    '场1：夜',
    '△她眼眶一红。',
    '场2：日',
    '△他鼻子一酸。',
    '场3：夜',
    '△泪水在她眼眶里打转。',
    '△她擦干眼泪，拿起电话。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 逼回泪/止住泪也是 rescue', () => {
  const draft = [
    '场1：夜', '△她眼眶一红。',
    '场2：日', '△他鼻子一酸。',
    '场3：夜', '△泪水在她眼眶里打转。',
    '△他把泪逼回去，继续念合同条款。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: 台词行泪点跳过（叙述+台词混合只计叙述）', () => {
  const draft = [
    '场1：夜',
    '林晚（眼眶一红）：我没事。',
    '△她把文件推过去。',
    '场2：日',
    '沈致：你眼眶红了。',
    '△他鼻子一酸。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不与上一场合并', () => {
  const draft = [
    '场1：夜',
    '△她眼眶一红。',
    '场2：日',
    '△他鼻子一酸。',
  ].join('\n');
  /* 行距恰好 ≤2，但场景头重置后必须算两次独立泪点 */
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 2);
});

test('zh: 强档宣泄不收（归 emotion-vent-cliche）', () => {
  const draft = [
    '场1：夜',
    '△她失声痛哭。',
    '场2：日',
    '△他嚎啕大哭。',
    '场3：夜',
    '△眼泪夺眶而出。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 封底 20（7 次泪点 → 5 hits）', () => {
  const beats = [
    '场1：夜', '△她眼眶一红。',
    '场2：日', '△他鼻子一酸。',
    '场3：夜', '△泪水在她眼眶里打转。',
    '场4：日', '△她噙着泪。',
    '场5：夜', '△眼底泛起水光。',
    '场6：日', '△一滴泪滑了下来。',
    '场7：夜', '△他眼圈红了。',
  ].join('\n');
  const r = tearBait(beats);
  assert.strictEqual(r.hitCount, 7);
  assert.strictEqual(r.hits.length, 5);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 空稿与无泪稿', () => {
  assert.strictEqual(tearBait('').score, 100);
  assert.strictEqual(tearBait('  \n ').score, 100);
  const r = tearBait('场1：夜\n△她把伞递给他。\n林晚：走吧。');
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 多种弱档变体均命中', () => {
  const draft = [
    '场1：夜', '△她眼眶微红。',
    '场2：日', '△他眼底泛着泪。',
    '场3：夜', '△她眼眶蒙上一层水雾。',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
});

/* ============ English ============ */

test('en: first two exempt, third counted with line', () => {
  const draft = [
    'INT. A - NIGHT',
    'Her eyes well up.',
    'INT. B - DAY',
    'His eyes grew misty.',
    'INT. C - NIGHT',
    'Tears pooled in her eyes.',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 6);
  assert.strictEqual(r.score, 70);
});

test('en: wipes her tears is a rescue', () => {
  const draft = [
    'INT. A - NIGHT',
    'Her eyes well up.',
    'INT. B - DAY',
    'His eyes grew misty.',
    'INT. C - NIGHT',
    'Tears pooled in her eyes.',
    'She wipes her tears and picks up the phone.',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: strong crying not collected (vent engine territory)', () => {
  const draft = [
    'INT. A - NIGHT',
    'She burst into tears.',
    'INT. B - DAY',
    'He broke down sobbing.',
    'INT. C - NIGHT',
    'Tears streamed down her face.',
  ].join('\n');
  const r = tearBait(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(tearBait('').score, 100);
  assert.strictEqual(tearBait('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = tearBait([
    'INT. A - NIGHT',
    'Her eyes well up.',
    'INT. B - DAY',
    'His eyes grew misty.',
    'INT. C - NIGHT',
    'Tears pooled in her eyes.',
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
