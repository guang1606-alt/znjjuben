/**
 * faint-on-cue 晕倒阀门/剧情病 单测（块94）
 * 覆盖：首次豁免 / 第2次命中 / 相邻晕倒合并 / 跨场景头不合并 /
 *      医学 rescue / 醒来代价 rescue / 纯晕倒无语境放行 /
 *      装晕豁免 / 距离超窗 / SELF+STATE 双档 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { faintOnCue } = require('../dist/engine/faint-on-cue.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = faintOnCue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次晕倒阀门豁免（一次昏厥是合法意外）', () => {
  const d = [
    '内景 祖宅 夜',
    '林秋：我查到了，当年的主谋其实是——',
    '△她话没说完，眼前一黑，晕倒在地。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次命中 70', () => {
  const d = [
    '内景 祖宅 夜',
    '林秋：当年的主谋其实是——',
    '△她话没说完，晕倒在地。',
    '',
    '内景 地牢 夜',
    '△沈乙刚要交代主谋，昏了过去。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex04 相邻晕倒行合并为同一事件', () => {
  const d = [
    '内景 客厅 夜',
    '△她话说到一半，突然晕倒。',
    '△昏迷不醒。',
    '',
    '内景 书房 夜',
    '△沈乙刚要说出证据，昏了过去。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头各自算一次）', () => {
  const d = [
    '内景 祖宅 夜',
    '△林秋话说到一半，眼前一黑，晕倒。',
    '内景 书房 夜',
    '△沈乙刚要说出地址，昏了过去。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 医学 rescue 放行（救护车送医抢救）', () => {
  const d = [
    '内景 祖宅 夜',
    '林秋：我查到了当年的真相——',
    '△她话没说完，晕倒在地。',
    '',
    '内景 客厅 夜',
    '△林秋话没说完，心口一疼晕倒。',
    '△救护车呼啸而至，送进医院抢救。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 醒来时间代价 rescue（再睁眼已是三天后）', () => {
  const d = [
    '内景 祖宅 夜',
    '林秋：主谋是他——',
    '△她话没说完晕了过去。',
    '',
    '内景 病房 夜',
    '△沈乙刚要交代主谋，昏了过去。',
    '△再睁眼已是三天后。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯晕倒无关键语境放行（体力不支）', () => {
  const d = [
    '内景 后厨 夜',
    '△她忙了一整天，体力不支，晕倒在地。',
    '△众人把她扶到椅子上休息。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 装晕豁免（角色计谋不判）', () => {
  const d = [
    '内景 客厅 夜',
    '△她假装晕倒，偷听门外的动静。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗放行（晕倒与关键信息隔4行）', () => {
  const d = [
    '内景 祖宅 夜',
    '△她晕倒在门口。',
    '△风雪灌进屋里。',
    '△灯笼熄了。',
    '△桌上的茶凉了。',
    '△真相还没说出口。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 STATE 档（±2行关键语境）+ SELF 档各计一次', () => {
  const d = [
    '内景 客厅 夜',
    '△林秋突然眼前一黑，晕了过去。',
    '△桌上的录音笔还在转。',
    '',
    '内景 地牢 夜',
    '△沈乙刚要交代主谋，昏了过去。',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△他刚要说出主谋，旧疾发作，昏了过去。');
  }
  const r = faintOnCue(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△他刚要说出真相，眼前一黑晕倒。');
  }
  const r = faintOnCue(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. MANSION - NIGHT',
    'ELENA was about to name the mastermind - and fainted.',
    '',
    'INT. STUDY - NIGHT',
    'MARCO was about to reveal the evidence when he passed out.',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex15 en rescue 放行（ambulance + hospital）', () => {
  const d = [
    'INT. MANSION - NIGHT',
    'ELENA was about to tell the truth and fainted.',
    '',
    'INT. WAREHOUSE - NIGHT',
    'MARCO was about to confess when he collapsed.',
    'An ambulance rushed him to the hospital.',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex16 en 纯晕倒无语境放行', () => {
  const d = [
    'INT. KITCHEN - NIGHT',
    'She fainted from exhaustion after the double shift.',
  ].join('\n');
  const r = faintOnCue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. MANSION - NIGHT',
    'ELENA was about to name the mastermind - and fainted.',
    '',
    'INT. STUDY - NIGHT',
    'MARCO was about to reveal the evidence when he passed out.',
  ].join('\n');
  const r = faintOnCue(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
