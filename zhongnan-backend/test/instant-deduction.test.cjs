/**
 * instant-deduction 看一眼破案 单测（块87）
 * 覆盖：首次豁免 / 相邻合并 / CLUE 物证放行 / rescue / 跨场景重置 /
 *      情感领悟不判 / 同句共现 / 纯观察纯结论放行 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantDeduction } = require('../dist/engine/instant-deduction.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = instantDeduction('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次观察+结论豁免（一次灵光合法）', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗，眉头拧起。',
    '陆沉：我明白了，凶手就是他。',
    '△他起身走向门口。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次零成本破案命中 70', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '陆沉：我明白了，凶手就是他。',
    '',
    '内景 档案室 日',
    '△她环视一圈满墙的照片。',
    '苏黎：全都对上了。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex04 相邻2行观察合并为同一次', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '△目光又掠过相框。',
    '陆沉：我知道了。',
    '',
    '内景 档案室 日',
    '△她打量着墙上的地图，忽然停住。',
    '苏黎：真相就是他。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 窗口内有具体物证（指纹）放行', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '陆沉：我明白了，凶手就是他。',
    '',
    '内景 档案室 日',
    '△她翻看着检验报告。',
    '苏黎：指纹对上了，我知道了。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex06 rescue：不下结论去核实', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '陆沉：我知道了——不对，还得查。光凭这些下不了结论。',
    '',
    '内景 档案室 日',
    '△她环视一圈照片墙。',
    '苏黎：都串起来了……不，没有证据，先别下结论。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex07 跨场景头重置（两场各算一次）', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼卷宗。',
    '陆沉：我知道了。',
    '内景 档案室 日',
    '△她打量着地图。',
    '苏黎：全都对上了。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex08 情感领悟不判（明白了他的苦心）', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '△她看了一眼他的背影，明白了他的苦心。',
    '△他扫视全场，读懂了她的沉默。',
    '△她端详着旧信，理解了母亲的挣扎。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 同句共现（观察+结论一行）', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼现场：我明白了。',
    '',
    '内景 走廊 夜',
    '△她看了一眼尸体，答案就是他。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex10 纯观察无结论放行', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '△她环视四周。',
    '陆沉：这房间真大。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 纯结论无观察放行（线索铺垫在场外）', () => {
  const d = [
    '内景 审讯室 日',
    '陆沉：我知道了。',
    '苏黎：真相就是他。',
    '△两人对视。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 多次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('△他扫了一眼现场的物证袋。');
    beats.push('陆沉：我知道了，凶手就是他。');
  }
  const r = instantDeduction(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 观察与结论距离超窗放行', () => {
  const d = [
    '内景 书房 夜',
    '△他扫了一眼桌上的卷宗。',
    '△窗外起风了。',
    '△雨点砸在玻璃上。',
    '△他起身倒了杯水。',
    '陆沉：我明白了，凶手就是他。',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. STUDY - NIGHT',
    'He glanced around the room.',
    'DETECTIVE: I know who did it.',
    '',
    'INT. ARCHIVE - DAY',
    'She looked the photos over.',
    'MARSH: It all makes sense.',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex15 en 物证破案不计数（有据推理非零成本）', () => {
  const d = [
    'INT. LAB - DAY',
    'She glanced at the lab report on the desk.',
    'MARSH: It all makes sense now.',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en rescue（need to check）', () => {
  const d = [
    'INT. STUDY - NIGHT',
    'He glanced around the room.',
    'DETECTIVE: I know who did it. No - I need to check the records first.',
    '',
    'INT. ARCHIVE - DAY',
    'She surveyed the evidence wall.',
    'MARSH: It all adds up. Not enough evidence, though.',
  ].join('\n');
  const r = instantDeduction(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. STUDY - NIGHT',
    'He glanced around the room.',
    'DETECTIVE: I know who did it.',
    '',
    'INT. ARCHIVE - DAY',
    'She studied the map on the wall.',
    'MARSH: So that is it. The killer is the butler.',
  ].join('\n');
  const r = instantDeduction(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
