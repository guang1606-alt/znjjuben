'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { apologyLoop } = require('../dist/engine/apology-loop.js');

/* ============ 中文 ============ */

test('zh: 同场景 3 次道歉无赎罪 → 1 hit，行号/场景准确', () => {
  const draft = [
    '场1：夜·客厅',
    '周父：晚晚，爸爸对不起你。',
    '周父：是我错了，你原谅爸爸好不好？',
    '周父：爸爸给你赔不是了，你就别再怪我了。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 100); // n=1 首次豁免
  assert.strictEqual(r.hits[0].line, 4); // 第 3 次道歉行号
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.strictEqual(r.hits[0].speaker, '周父');
  assert.strictEqual(r.hits[0].rescued, false);
});

test('zh: 两场景各 3 次道歉 → 2 hit，score 70', () => {
  const draft = [
    '场1：夜·客厅',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
    '场2：日·厨房',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 70);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [4, 8]);
  assert.ok(r.issues[0].includes('道歉循环'));
  assert.ok(r.advice[0].includes('赎罪'));
});

test('zh: 三场景各 3 次道歉 → 3 hit，score 50', () => {
  const draft = [
    '场1：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场2：日', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场3：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 3);
  assert.strictEqual(r.score, 50);
});

test('zh: 5 场景各 3 次道歉 → 封底 20', () => {
  const draft = [
    '场1：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场2：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场3：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场4：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
    '场5：夜', '周父：对不起。', '周父：我错了。', '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 同场景 2 次道歉不判（人情正常）', () => {
  const draft = [
    '场1：夜',
    '周父：对不起。',
    '周父：我错了，你原谅我好不好？',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 同场景 4 次道歉仍计 1 hit（不翻倍）', () => {
  const draft = [
    '场1：夜',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
    '周父：赔不是了。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 100); // n=1 首次豁免
});

test('zh: 道歉带具体赎罪 ACT rescued（自首/赔偿/退股）', () => {
  const draft = [
    '场1：夜·客厅',
    '周父：对不起。',
    '周父：我错了。',
    '△他拿出一叠认罪声明。',
    '周父：我明天去派出所自首，股权全部退还给你。',
    '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: 道歉带时间跨度 TIME rescued（场景头含"五年后"）', () => {
  const draft = [
    '场1：夜·客厅',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
    '场2：日·医院病房（五年后）',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1); // 仅场1 未 rescue，场2 被 TIME rescue
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[1].rescued, true);
  assert.strictEqual(r.score, 100); // n=1 首次豁免
});

test('zh: 反例——复仇宣言（empty-vow 范围）不判', () => {
  const draft = [
    '场1：夜',
    '林晚：我要让他付出代价。',
    '林晚：此仇不报誓不为人。',
    '林晚：血债必须血偿。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 反例——受害人立刻原谅（cheap-forgiveness 范围）不判', () => {
  const draft = [
    '场1：夜',
    '周父：对不起。',
    '林晚：我原谅你了，你回去吧。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 0); // 道歉仅 1 次，且是 cheap-forgiveness 范围
  assert.strictEqual(r.score, 100);
});

test('zh: 反例——第二人称当面威胁（empty-threat 范围）不判', () => {
  const draft = [
    '场1：夜',
    '沈志国：你给我等着！',
    '沈志国：你会后悔的！',
    '沈志国：你给我记住！',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 0);
});

test('zh: 场景头行不算 cue，叙述行不算 cue', () => {
  const draft = [
    '场1：夜·客厅（三年后）',  // 场景头不算 cue
    '△周父满脸愧疚地说了一声对不起。',  // 叙述行不算 cue
    '△他又低声说我错了。',
    '△最后他小声说原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 混合——场1 ACT rescue，场2 无 rescue → 1 unrescued', () => {
  const draft = [
    '场1：夜·客厅',
    '周父：对不起。',
    '周父：我错了。',
    '△他拿出退股协议。',
    '周父：股权全部退还给你，原谅我。',
    '场2：日·病房',
    '周父：对不起。',
    '周父：我错了。',
    '周父：原谅我。',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1); // 场1 rescue，场2 未 rescue
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.hits[1].rescued, false);
  assert.strictEqual(r.score, 100); // n=1 首次豁免
});

/* ============ English ============ */

test('en: three apologies in one scene no atonement → 1 hit', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'FATHER: I\'m sorry, Lily.',
    'FATHER: I was wrong. Please forgive me.',
    'FATHER: I apologize. Can\'t we just move on?',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 100); // n=1 exempt
  assert.strictEqual(r.hits[0].line, 4); // third apology
  assert.strictEqual(r.hits[0].speaker, 'FATHER');
  assert.strictEqual(r.hits[0].rescued, false);
});

test('en: three apologies with concrete atonement rescued', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'FATHER: I\'m sorry.',
    'FATHER: I was wrong.',
    'He sets down a signed confession.',
    'FATHER: I\'ll turn myself in tomorrow. I\'ll return the shares.',
    'FATHER: Please forgive me.',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('en: three apologies with TIME rescue (scene header "Five years later")', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'FATHER: I\'m sorry.',
    'FATHER: I was wrong.',
    'FATHER: Please forgive me.',
    'INT. HOSPITAL ROOM - DAY (Five years later)',
    'FATHER: I\'m sorry.',
    'FATHER: I was wrong.',
    'FATHER: Please forgive me.',
  ].join('\n');
  const r = apologyLoop(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1); // only scene 1 unrescued
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[1].rescued, true);
  assert.strictEqual(r.score, 100); // n=1 exempt
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(apologyLoop('').score, 100);
  assert.strictEqual(apologyLoop('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = apologyLoop([
    'INT. ROOM - NIGHT',
    'FATHER: I\'m sorry.',
    'FATHER: I was wrong.',
    'FATHER: Please forgive me.',
  ].join('\n'));
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
