'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { drunkTruth } = require('../dist/engine/drunk-truth.js');

/* ============ 中文 ============ */

test('zh: 首次酒局豁免，第2次起命中', () => {
  const draft = [
    '场1：夜·酒馆',
    '△她把沈致灌醉，他说出了当年转账的真相。',
    '场2：夜·包厢',
    '△几杯下肚，证人松了口，交出了账本的下落。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('zh: 单次酒局豁免不扣分', () => {
  const r = drunkTruth('场1：夜·酒馆\n△她把沈致灌醉，他说出了当年转账的真相。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 三次酒桌 → n=2 → 50', () => {
  const draft = [
    '场1：夜', '△她把他灌醉，他说出了实情。',
    '场2：日', '△酒过三巡，对方和盘托出。',
    '场3：夜', '△他喝醉了，把藏了十年的秘密全说了。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('酒桌钥匙'));
  assert.ok(r.advice[0].includes('筹码'));
});

test('zh: 灌酒失败/拒酒 → rescued 不扣分', () => {
  const draft = [
    '场1：夜',
    '△她把沈致灌醉，他说出了当年转账的真相。',
    '场2：夜·包厢',
    '△她连敬三杯，对方死活不开口，越灌越清醒。',
    '场3：夜',
    '△他又喝多了，把仓库的地址全说了。',
    '△可惜他根本没醉，全是演的。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻行同场酒局（三杯下肚+醉眼朦胧）只计1次', () => {
  const draft = [
    '场1：夜·酒馆',
    '△三杯下肚，他的舌头就松了。',
    '△醉眼朦胧间，他吐出了真相。',
    '场2：夜·大排档',
    '△几杯啤酒下肚，证人松了口。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 纯醉酒戏（无泄露）不判', () => {
  const draft = [
    '场1：夜·路边',
    '△他喝醉了，躺在长椅上睡着了。',
    '△她把外套盖在他身上。',
    '场2：夜·家中',
    '△她喝得酩酊大醉，吐了一地。',
    '△他默默收拾着狼藉。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 醉与泄露超过2行窗口不判', () => {
  const draft = [
    '场1：夜',
    '△他喝高了，趴在桌上。',
    '△她收拾着杯盏。',
    '△窗外起了风。',
    '△第二天上午，他清醒后找到她。',
    '△他坦白了所有事。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 情绪道具划界——灌醉自己（自我麻醉）不判', () => {
  const draft = [
    '场1：夜',
    '△她灌醉自己，想忘掉那个名字。',
    '△眼泪掉进酒杯里。',
    '场2：夜',
    '△他又喝多了，抱着婚戒睡去。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: villainConfession 划界——无酒主动坦白不判', () => {
  const draft = [
    '场1：夜·办公室',
    '沈致：你到底想问什么？钱是我挪的，账也是我做的。',
    '△林晚盯着他，没有碰面前的酒杯。',
    '场2：日',
    '沈致：我坦白，事情是我做的。',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 封底 20（6 次酒桌）', () => {
  const beats = [
    '场1：夜', '△她把他灌醉，他说出了实情。',
    '场2：日', '△酒过三巡，对方和盘托出。',
    '场3：夜', '△他喝醉了，把秘密全说了。',
    '场4：日', '△几杯下肚，证人松了口。',
    '场5：夜', '△她劝酒三巡，他吐了真言。',
    '场6：日', '△对方喝得烂醉，竹筒倒豆子全招了。',
  ].join('\n');
  const r = drunkTruth(beats);
  assert.strictEqual(r.hitCount, 6);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 空稿与无酒局稿', () => {
  assert.strictEqual(drunkTruth('').score, 100);
  assert.strictEqual(drunkTruth('  \n ').score, 100);
  const r = drunkTruth('场1：夜\n△两人对坐喝茶。\n林晚：账本在哪？\n沈致：在我律师那里。');
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: first drink exempt, second counted with line', () => {
  const draft = [
    'INT. BAR - NIGHT',
    'She plies him with whiskey and he spills the whole secret.',
    'INT. KARAOKE ROOM - NIGHT',
    'After a few drinks, the witness confesses the location.',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('en: refuses the drink keeps the score clean', () => {
  const draft = [
    'INT. BAR - NIGHT',
    'She plies him with whiskey and he spills the whole secret.',
    'INT. KARAOKE ROOM - NIGHT',
    'He refuses the drink and stays sober all night.',
    'INT. DINER - DAY',
    'He is drunk enough to talk, and he confesses everything.',
    'But she pours the drink out before he can.',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: plain drunk scene without leak ignored', () => {
  const draft = [
    'EXT. STREET - NIGHT',
    'He is drunk and asleep on the bench.',
    'She covers him with her coat.',
    'INT. APARTMENT - NIGHT',
    'Drunk enough to cry, she breaks a glass.',
  ].join('\n');
  const r = drunkTruth(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(drunkTruth('').score, 100);
  assert.strictEqual(drunkTruth('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = drunkTruth([
    'INT. BAR - NIGHT',
    'She plies him with whiskey and he spills the whole secret.',
    'INT. KARAOKE ROOM - NIGHT',
    'After a few drinks, the witness confesses the location.',
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
