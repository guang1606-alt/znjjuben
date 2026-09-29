'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { fidgetProp } = require('../dist/engine/fidget-prop.js');

/* ============ 中文 ============ */

test('zh: 同一闲玩道具未兑现 ≥3 次扣分，行号准确', () => {
  const draft = [
    '场1：日·办公室',
    '△沈志国指尖转着钢笔，不说话。',
    '沈志国：条件不变。',
    '场2：日·会议室',
    '△他又转起那支钢笔，神色平静。',
    '场3：夜·书房',
    '△钢笔在他指节间转了一圈又一圈。',
    '场4：日',
    '△他指尖转着签字笔，望着窗外。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 4);
  assert.strictEqual(r.familyCounts.pen, 4);
  assert.ok(r.overusedFamilies.includes('转笔'));
  assert.ok(r.score < 100 && r.score >= 20);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [2, 5, 7, 9]);
  assert.ok(r.hits.every((h) => h.family === 'pen'));
  assert.ok(r.hits.map((h) => h.occurrence).join(',') === '1,2,3,4');
});

test('zh: 前两次出现不罚（excess 从第 3 次起）', () => {
  const draft = [
    '场1：日',
    '△他指尖转着钢笔。',
    '场2：日',
    '△他又转起那支钢笔。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.familyCounts.pen, 2);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.overusedFamilies.length, 0);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 道具参与情节（拍在合同上）rescued，不计依赖', () => {
  const draft = [
    '场1：日',
    '△沈志国转着钢笔，忽然把笔拍在合同上。',
    '沈志国：签。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 1);
  assert.strictEqual(r.familyCounts.pen, undefined);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: 戒指摘下推还（宾语前置语序）rescued', () => {
  const draft = [
    '场1：日',
    '△她摩挲着婚戒，半晌，把戒指摘下推了过去。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.familyCounts.ring, undefined);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('zh: 同窗口签字兑现 rescued', () => {
  const r = fidgetProp('场1：日\n△沈志国转着钢笔，半晌在文件上签了字。');
  assert.strictEqual(r.hits[0].rescued, true);
});

test('zh: 跨场做功不救（窗口不越场景）', () => {
  const draft = [
    '场1：日',
    '△他转着钢笔，神色平静。',
    '场2：日',
    '△他在合同上签了字。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.familyCounts.pen, 1);
});

test('zh: 打火机/婚戒/核桃三件各 1 次不构成依赖，且打火机不自匹配救援', () => {
  const draft = [
    '场1：夜',
    '△他转着打火机。',
    '△她摩挲着婚戒。',
    '△老爷子盘着核桃。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 3);
  assert.ok(r.hits.every((h) => h.rescued === false));
  assert.strictEqual(r.score, 100);
});

test('zh: 打火机点燃文件 rescued', () => {
  const draft = [
    '场1：夜',
    '△他转着打火机，咔哒一声，把合同点燃了。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.hits[0].family, 'lighter');
  assert.strictEqual(r.hits[0].rescued, true);
});

test('zh: 台词里提"转笔"不判（只扫叙述行）', () => {
  const draft = [
    '场1：日',
    '林晚：你别老转笔了。',
    '沈志国：习惯。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 封底 20：多家族全部超标', () => {
  const draft = [
    '场1：日', '△他转着钢笔。', '△她摩挲着婚戒。', '△老爷子盘着核桃。',
    '场2：日', '△他转着钢笔。', '△她摩挲着婚戒。', '△老爷子盘着核桃。',
    '场3：日', '△他转着钢笔。', '△她摩挲着婚戒。', '△老爷子盘着核桃。',
    '场4：日', '△他转着钢笔。', '△她摩挲着婚戒。', '△老爷子盘着核桃。',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.ok(r.score >= 20);
  assert.ok(r.overusedFamilies.length >= 3);
  assert.ok(r.issues[0].includes('闲玩道具依赖'));
  assert.ok(r.advice[0].includes('道具要么干事要么删'));
});

/* ============ English ============ */

test('en: same idle pen ≥3 unpayed penalizes with line numbers', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'VICTOR twirled his pen in silence.',
    'VICTOR: The terms stand.',
    'INT. BOARDROOM - DAY',
    'He spun the pen again, perfectly calm.',
    'INT. STUDY - NIGHT',
    'The fountain pen rolled between his fingers, round and round.',
    'INT. OFFICE - DAY',
    'He kept turning the pen and stared out the window.',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 4);
  assert.strictEqual(r.familyCounts.pen, 4);
  assert.ok(r.score < 100);
  assert.deepStrictEqual(r.hits.map((h) => h.line), [2, 5, 7, 9]);
  assert.ok(r.hits.every((h) => h.rescued === false));
});

test('en: prop does plot work (slammed it down) rescued', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'VICTOR twirled the pen, then slammed it down on the contract.',
    'VICTOR: Sign it.',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.familyCounts.pen, undefined);
});

test('en: three families once each is fine; "flipped the lighter" not self-rescued', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'He flipped the lighter open and shut.',
    'She worried the wedding band on her finger.',
    'The old man worked his prayer beads.',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 3);
  assert.ok(r.hits.every((h) => h.rescued === false));
  assert.strictEqual(r.score, 100);
});

test('en: lighter ignites document rescued', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'He flipped the lighter and lit the contract.',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.hits[0].family, 'lighter');
  assert.strictEqual(r.hits[0].rescued, true);
});

test('en: dialogue mention not counted', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'LINNA: Stop twirling that pen.',
    'VICTOR: Habit.',
  ].join('\n');
  const r = fidgetProp(draft);
  assert.strictEqual(r.fidgetCount, 0);
});

test('en: empty / whitespace draft is a clean 100', () => {
  assert.strictEqual(fidgetProp('').score, 100);
  assert.strictEqual(fidgetProp('   \n  ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = fidgetProp([
    'INT. OFFICE - DAY',
    'VICTOR twirled his pen.',
    'He spun the pen.',
    'The fountain pen rolled between his fingers.',
    'He kept turning the pen.',
  ].join('\n'));
  const blob = JSON.stringify(r);
  assert.ok(!/[一-鿿]/.test(blob), 'English result must contain no CJK');
});
