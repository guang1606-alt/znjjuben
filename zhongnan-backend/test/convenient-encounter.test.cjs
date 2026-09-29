/**
 * convenient-encounter 转角偶遇 / 世界太小 单测（块97）
 * 覆盖：首次豁免 / 第2次命中 / 相邻相遇行合并 / 跨场景头不合并 /
 *      安排锚 rescue / 合理性锚 rescue / 纯撞路人放行 / 纯关系陈述放行 /
 *      距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { convenientEncounter } = require('../dist/engine/convenient-encounter.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = convenientEncounter('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次偶遇豁免（一次转角是缘分）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进一个男人怀里，抬头竟是前任。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次偶遇命中 70', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进一个男人怀里，抬头竟是前任。',
    '',
    '内景 咖啡店 日',
    '苏晚：前夫，这么巧？',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex04 相邻相遇行合并为同一事件', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进一个男人怀里，抬头竟是前任。',
    '苏晚：冤家路窄。',
    '',
    '内景 咖啡店 日',
    '△居然在这里碰上初恋。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（相遇行窗口内仍算事件）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进怀里，竟是前任。',
    '内景 电梯 日',
    '△冤家路窄。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 rescue 安排锚（跟踪蹲守）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进怀里，竟是前任。',
    '',
    '内景 咖啡店 日',
    '苏晚：前夫，这么巧？',
    '顾言：我打听了你的行程，在这里等了你三天。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 rescue 合理性锚（同公司同事）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进怀里，竟是前任。',
    '',
    '内景 咖啡店 日',
    '苏晚：前夫，这么巧？',
    '顾言：我们同一家公司，同一栋楼，低头不见抬头见。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex08 纯撞路人放行（无旧关系）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进一个男人怀里，咖啡洒了一身。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯关系陈述放行（无相遇方式）', () => {
  const d = [
    '内景 办公室 夜',
    '苏晚：我和前夫离婚三年了。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗放行（方式与关系隔3行）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进一个男人怀里。',
    '△她道歉连连。',
    '△各自离开。',
    '△街道恢复平静。',
    '老陈：那可是她的前任。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('△她转角撞进怀里，竟是前任，这么巧。');
  }
  const r = convenientEncounter(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('△她转角撞进怀里，竟是前任，这么巧。');
  }
  const r = convenientEncounter(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex13 en 第2次命中 70', () => {
  const d = [
    'INT. CORNER - DAY',
    'She ran right into her ex-husband at the corner.',
    '',
    'INT. CAFE - DAY',
    'MARA: Small world. My old flame, of all coffee shops.',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex14 en rescue（waited outside）', () => {
  const d = [
    'INT. CORNER - DAY',
    'She ran right into her ex-husband at the corner.',
    '',
    'INT. CAFE - DAY',
    'MARA: Small world. My old flame, of all coffee shops.',
    'JOHN: I waited outside your office for three hours. This was not fate.',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex15 en 纯相撞放行（无旧关系）', () => {
  const d = [
    'INT. CORNER - DAY',
    'She ran right into a stranger and spilled the coffee.',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 结果对象零 CJK', () => {
  const d = [
    'INT. CORNER - DAY',
    'She ran right into her ex-husband at the corner.',
    '',
    'INT. CAFE - DAY',
    'MARA: Small world. My old flame, of all coffee shops.',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});

/* ---------- 元数据 ---------- */

test('ex17 zh 结果元数据（场景索引/建议/advice）', () => {
  const d = [
    '内景 街角 日',
    '△她转角撞进怀里，竟是前任，这么巧。',
    '',
    '内景 咖啡店 日',
    '△居然在这里碰上初恋，冤家路窄。',
  ].join('\n');
  const r = convenientEncounter(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 1);
  assert.ok(r.issues.length >= 1);
  assert.ok(r.advice.length >= 1);
  assert.ok(/偶遇/.test(r.advice[0]));
});
