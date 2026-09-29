/**
 * villain-stall 反派拖刀 单测（块138）
 * 覆盖：首次豁免 / 第2次命中 / 相邻控制合并 / 跨场景头不合并 /
 *      理由 rescue / 打断 rescue / 自救 rescue / 无控制放行 /
 *      无拖延放行 / ±2 行共现 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { villainStall } = require('../dist/engine/villain-stall.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = villainStall('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次控局拖延豁免（一次拖延是压迫感节拍）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上。',
    '他：急什么，让我把话说完。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次反派拖刀命中 70', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上。',
    '他：急什么，让我把话说完。',
    '',
    '内景 天台 夜',
    '△枪顶着他的太阳穴。',
    '他：先带下去，明天再处理。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻控制行合并为同一事件', () => {
  const d = [
    '内景 仓库 夜',
    '△她被五花大绑。',
    '△刀架在她脖子上。',
    '他：急什么，让我把话说完。',
    '',
    '内景 天台 夜',
    '△枪顶太阳穴，被团团围住。',
    '他：看住他，我先走了。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子。他：急什么，让我把话说完。',
    '内景 天台 夜',
    '△枪顶太阳穴。他：先带下去，明天再处理。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex06 理由 rescue 放行（问出口供再动手）', () => {
  const d = [
    '内景 审讯室 夜',
    '△枪顶着他的太阳穴。',
    '他：急什么，慢慢来。',
    '',
    '内景 密室 夜',
    '△她被五花大绑。',
    '他：不急，先审她一夜，问出下落再动手。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 无控制的拖延放行（日常闲谈）', () => {
  const d = [
    '内景 公司 日',
    '她：明天再说吧，不急。',
    '他：好，回头再聊。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯控制无拖延放行（处决本身是戏）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在小舟脖子上。',
    '他一刀挥下。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 打断 rescue 放行（拖延刚起警笛响起）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子。他：急什么，让我把话说完。',
    '',
    '内景 密室 夜',
    '△刀已架上她的脖子。',
    '他：不急，先让她看清楚。',
    '△话音未落，警笛响起，正门被踹开。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 控制与拖延 ±2 行共现成事件', () => {
  const d = [
    '内景 仓库 夜',
    '△枪顶着他的太阳穴。',
    '△雨点打在铁皮屋顶上。',
    '他：急什么，让我把话说完。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（控制后隔4行才拖延）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架在她脖子上。',
    '△窗外起风。',
    '△灯闪了一下。',
    '△水管滴水。',
    '他：急什么，让我把话说完。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△刀架脖子。他：急什么，先带下去，明天再处理。');
  }
  const r = villainStall(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('△枪顶太阳穴。他：看住他，我先走了。');
  }
  const r = villainStall(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 自救 rescue 放行（拖延期间磨绳挣脱）', () => {
  const d = [
    '内景 仓库 夜',
    '△刀架脖子。他：急什么，让我把话说完。',
    '',
    '内景 密室 夜',
    '△她被五花大绑。',
    '△他背身接电话，她悄悄磨着绳索，手腕磨出血，挣脱开扑向门边。',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* ---------- en ---------- */

test('ex15 en 第2次命中 70', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'The gun pressed to her temple. "Any last words?" he smiled.',
    '',
    'INT. BASEMENT - NIGHT',
    'He was tied to the chair. "Take him away. We\'ll deal with him tomorrow."',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex16 en 理由 rescue 放行（need him to talk first）', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'The gun pressed to her temple. "Any last words?" he smiled.',
    '',
    'INT. BASEMENT - NIGHT',
    'He was tied to the chair. "Keep him alive. I need him to talk first."',
  ].join('\n');
  const r = villainStall(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'The gun pressed to her temple. "Any last words?" he smiled.',
    '',
    'INT. BASEMENT - NIGHT',
    'He was tied to the chair. "Take him away. We\'ll deal with him tomorrow."',
  ].join('\n');
  const r = villainStall(d);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
