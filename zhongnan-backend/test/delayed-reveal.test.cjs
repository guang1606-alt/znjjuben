/**
 * delayed-reveal 信息容器延迟开启 单测（块91）
 * 覆盖：首次豁免 / 第2次命中 / 相邻合并 / 当场拆开 rescue /
 *      ±2行 rescue / 无容器裸 defer 放行 / 裸容器无 defer 放行 /
 *      跨场不重置 / 等以后再说+U盘 / 体检报告容器 / 封底 /
 *      en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { delayedReveal } = require('../dist/engine/delayed-reveal.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = delayedReveal('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次犹豫豁免（同句容器+defer）', () => {
  const d = [
    '内景 书房 夜',
    '妈妈的遗书，他三个月没敢拆。',
    '△信压在抽屉最底层。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次延迟开启命中 70', () => {
  const d = [
    '内景 书房 夜',
    '妈妈的遗书，他三个月没敢拆。',
    '△信压在抽屉最底层。',
    '',
    '内景 卧室 夜',
    '录音笔就放在枕边，她一直不敢听。',
    '△夜色沉沉。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex04 相邻犹豫合并为同一拍（跨场景头则不合并）', () => {
  const d = [
    '内景 书房 夜',
    '那封信我没敢拆。',
    '等我想好了再说。',
    '',
    '内景 车库 夜',
    '那盘磁带他一直不敢听。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 当场拆开 rescue（OPEN 在下一行）', () => {
  const d = [
    '内景 书房 夜',
    '妈妈的遗书，他三个月没敢拆。',
    '',
    '内景 卧室 夜',
    '那封信她一直没敢看。',
    '第二天，她拆开了信封。',
    '',
    '内景 车库 夜',
    '录音笔他还没敢听，塞进抽屉锁上。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.hits[1].rescued, false);
});

test('ex06 无容器裸 defer 放行（不敢看他的眼睛）', () => {
  const d = [
    '内景 客厅 夜',
    '他不敢看她的眼睛。',
    '△低头不语。',
    '等以后再谈吧。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex07 裸容器无 defer 放行（只是拿着信）', () => {
  const d = [
    '内景 书房 日',
    '她手里攥着那封信。',
    '△信封都磨毛了边角。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 跨场景不重置（3场各1次 → 50 而非 70）', () => {
  const d = [
    '内景 场景1 日',
    '妈妈的遗书，他没敢拆。',
    '',
    '内景 场景2 日',
    '那盘磁带她一直不敢听。',
    '',
    '内景 场景3 日',
    'U盘他还没打开，塞在书架深处。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex09 等以后再说+U盘（同句共现，单次豁免）', () => {
  const d = [
    '内景 卧室 夜',
    '她把U盘塞进抽屉，等以后再说。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex10 体检报告容器（同句命中+marker 提取）', () => {
  const d = [
    '内景 医院 走廊 日',
    '体检报告他一直没敢看。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 0);
  const d2 = [
    '内景 医院 走廊 日',
    '体检报告他一直没敢看。',
    '',
    '内景 家中 夜',
    '那份化验单她也没敢看。',
  ].join('\n');
  const r2 = delayedReveal(d2);
  assert.strictEqual(r2.hitCount, 2);
  assert.strictEqual(r2.score, 70);
  assert.strictEqual(r2.hits[0].marker, '没敢');
});

test('ex11 ±2行 rescue（OPEN 在延迟后第2行）', () => {
  const d = [
    '内景 书房 夜',
    '妈妈的遗书，他三个月没敢拆。',
    '',
    '内景 卧室 夜',
    '那盘磁带她一直没敢听。',
    '△房间里只剩钟摆声。',
    '深夜，她终于按下了播放。',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('妈妈的遗书，他一直没敢拆。');
  }
  const r = delayedReveal(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 多次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('那盘磁带她一直不敢听。');
  }
  const r = delayedReveal(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70（hasn\'t dared）', () => {
  const d = [
    'INT. STUDY - NIGHT',
    "He hasn't dared to open the letter for three months.",
    '',
    'INT. BEDROOM - NIGHT',
    "She can't bring herself to listen to the recording on the tape.",
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex15 en rescue（pressed play 在 ±2 行内）', () => {
  const d = [
    'INT. STUDY - NIGHT',
    "He hasn't dared to open the letter for three months.",
    '',
    'INT. BEDROOM - NIGHT',
    "She hasn't dared to play the tape.",
    'The room goes quiet.',
    'Late that night, she pressed play.',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 无容器裸 defer 放行', () => {
  const d = [
    'INT. HALL - NIGHT',
    "He can't bring himself to face her.",
    'He waits in silence.',
  ].join('\n');
  const r = delayedReveal(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. STUDY - NIGHT',
    "He hasn't dared to open the letter for three months.",
    '',
    'INT. BEDROOM - NIGHT',
    "She can't bring herself to listen to the recording on the tape.",
  ].join('\n');
  const r = delayedReveal(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
