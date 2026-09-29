'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { accidentalSpark } = require('../dist/engine/accidental-spark.js');

/* ============ 中文 ============ */

test('zh: 首次事故豁免，第2次起命中', () => {
  const draft = [
    '场1：夜·天台',
    '△她脚下一滑，整个人摔进了他的怀里。',
    '△两人四目相对。',
    '场2：日·走廊',
    '△她被绊了一下，撞进他怀中。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 5);
  assert.strictEqual(r.score, 70);
});

test('zh: 单次事故豁免不扣分', () => {
  const r = accidentalSpark('场1：夜\n△她脚下一滑，摔进了他的怀里。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 三次事故 → n=2 → 50', () => {
  const draft = [
    '场1：夜', '△她滑倒，摔进他怀里。',
    '场2：日', '△她转身太急，跌入他怀抱。',
    '场3：夜', '△楼梯上她踩空，扑进他胸膛。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('地心引力'));
  assert.ok(r.advice[0].includes('火花必须来自选择'));
});

test('zh: 事故后写拒绝/尴尬 → rescued 不扣分', () => {
  const draft = [
    '场1：夜',
    '△她滑倒，摔进他怀里。',
    '△她立刻推开他，退后两步整理衣裙。',
    '场2：日',
    '△她转身太急，跌入他怀抱。',
    '△两人尴尬地跳开，谁都没说话。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 意外之吻双向语序均命中', () => {
  const draft = [
    '场1：夜', '△车突然刹车，两人的唇不偏不倚碰在了一起。',
    '场2：日', '△他弯腰捡文件，意外吻上了她。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 跨行拆写（滑倒→栽进怀里）靠前一行窗口命中', () => {
  const draft = [
    '场1：夜',
    '△她脚下一滑。',
    '△整个人栽进他的怀中。',
    '场2：夜',
    '△她被绊了一下。',
    '△扑进了他怀里。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 6);
});

test('zh: cue 台词自嘲提及不判', () => {
  const draft = [
    '场1：夜',
    '林晚：又摔进你怀里，这都第三次了。',
    '沈致：地板太滑。',
    '场2：日',
    '林晚：上次那个意外之吻不算。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯摔倒/纯接住（无怀里无吻）不判', () => {
  const draft = [
    '场1：夜',
    '△她摔倒在地，膝盖渗血。',
    '△他一把接住她手里的杯子。',
    '△他摔倒，怀里还抱着文件箱。',
    '△她跌坐在地。',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 封底 20（6 次事故 → 5 hits）', () => {
  const beats = ['场1：夜', '△她滑倒，摔进他怀里。', '场2：日', '△她撞进他怀中。', '场3：夜', '△她跌入他怀抱。', '场4：日', '△她扑进他胸膛。', '场5：夜', '△她栽进他怀里。', '场6：日', '△她撞上他胸膛。'].join('\n');
  const r = accidentalSpark(beats);
  assert.strictEqual(r.hitCount, 6);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 空稿与无事故稿', () => {
  assert.strictEqual(accidentalSpark('').score, 100);
  assert.strictEqual(accidentalSpark('  \n ').score, 100);
  const r = accidentalSpark('场1：夜\n△她把伞递给他。\n林晚：走吧。');
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: first accident exempt, second counted with line', () => {
  const draft = [
    'INT. HALL - NIGHT',
    'She stumbles and falls right into his arms.',
    'INT. OFFICE - DAY',
    'She trips and crashes against his chest.',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('en: accidental kiss in both word orders', () => {
  const draft = [
    'INT. ARCHIVE - NIGHT',
    'They reach for the same file and their lips accidentally meet.',
    'INT. LAB - DAY',
    'An accidental kiss lands in the dark.',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('en: push-away rescue keeps the score clean', () => {
  const draft = [
    'INT. STAIRS - DAY',
    'She slips and falls against his chest.',
    'She pulls away immediately, straightening her jacket.',
    'INT. LAB - DAY',
    'She lurches forward into his arms.',
    'Both step back, awkward.',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cue-line mention and non-spark falls ignored', () => {
  const draft = [
    'INT. CAFE - DAY',
    'LINA: That is the second time you fell into my arms.',
    'MARK: Wet floor.',
    'INT. STREET - NIGHT',
    'He falls to his knees on the pavement.',
    'She slips on the ice and grabs the railing.',
  ].join('\n');
  const r = accidentalSpark(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(accidentalSpark('').score, 100);
  assert.strictEqual(accidentalSpark('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = accidentalSpark([
    'INT. HALL - NIGHT',
    'She stumbles and falls right into his arms.',
    'INT. OFFICE - DAY',
    'She trips and crashes against his chest.',
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
