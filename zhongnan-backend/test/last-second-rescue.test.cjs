/**
 * last-second-rescue 救兵天降 单测（块137）
 * 覆盖：首次豁免 / 第2次命中 / 相邻绝境合并 / 跨场景头不合并 /
 *      铺垫 rescue / 求救 rescue / 代价 rescue / 无绝境放行 /
 *      无救兵放行 / ±2 行共现 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { lastSecondRescue } = require('../dist/engine/last-second-rescue.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = lastSecondRescue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次绝境获救豁免（一次千钧一发是类型片高光）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上，她被逼到墙角。',
    '△门被踹开，老陈冲进来一把将她拉开。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次救兵天降命中 70', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上。',
    '△门被踹开，老陈冲进来救下她。',
    '',
    '内景 天台 夜',
    '△枪顶着他的太阳穴，退无可退。',
    '△救兵及时赶到，把他拉回边缘。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex04 相邻绝境行合并为同一事件', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在她脖子上。',
    '△她被逼到绝境，无路可退。',
    '△门被踹开，老陈冲进来救下她。',
    '',
    '内景 天台 夜',
    '△枪顶太阳穴，团团围住。',
    '△援兵赶到解围。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子，门被踹开救下她。',
    '内景 天台 夜',
    '△枪顶太阳穴，救兵赶到。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex06 铺垫 rescue 放行（他一直暗中跟着）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子。',
    '△门被踹开救下她。',
    '',
    '内景 天台 夜',
    '△枪顶太阳穴，退无可退。',
    '△老陈冲来解围。他一直暗中跟着她。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 无绝境的救场放行（日常搭救）', () => {
  const d = [
    '内景 公司 日',
    '△她差点滑倒，他一把将她拉开。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯绝境无救兵放行（危机铺垫本身是戏）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上，她被逼到墙角。',
    '小舟：今天我认栽。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 求救 rescue 放行（她提前按了报警器）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子。门被踹开救下她。',
    '',
    '内景 天台 夜',
    '△被打手团团围住。',
    '△她进门时悄悄按下了报警器，救兵这时冲了进来。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 绝境与救兵 ±2 行共现成事件', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在她脖子上。',
    '△她闭上眼。',
    '△门被踹开。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（绝境后隔4行才救）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在她脖子上。',
    '△窗外起风。',
    '△灯闪了一下。',
    '△水管滴水。',
    '△门被踹开，老陈冲进来。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△刀架脖子，门被踹开，救兵冲进来救下她。');
  }
  const r = lastSecondRescue(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△枪顶太阳穴，救兵及时赶到解围。');
  }
  const r = lastSecondRescue(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 代价 rescue 放行（替她挡了一刀）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子，门被踹开救下她。',
    '',
    '内景 天台 夜',
    '△被逼到绝境，团团围住。',
    '△老陈扑过来护住她，替她挡了一刀，倒在血泊里。',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* ---------- en ---------- */

test('ex15 en 第2次命中 70', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'A knife is at her throat. The door is kicked down and he pulls her away.',
    '',
    'INT. ROOFTOP - NIGHT',
    'A gun to his temple, backed into a corner. Reinforcements arrive just in time.',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex16 en 铺垫 rescue 放行（backup was already called）', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'A knife at her throat. The door bursts open and he saves her.',
    '',
    'INT. ROOFTOP - NIGHT',
    'Cornered, surrounded by men, no way out.',
    'Backup arrives - backup was already called before she walked in.',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'A knife is at her throat. The door is kicked down and he pulls her away.',
    '',
    'INT. ROOFTOP - NIGHT',
    'A gun to his temple, backed into a corner. Reinforcements arrive just in time.',
  ].join('\n');
  const r = lastSecondRescue(d);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
