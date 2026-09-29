/**
 * instant-kinship 认亲白给 单测（块93）
 * 覆盖：首次豁免 / 第2次命中 / 相邻揭露合并 / 跨场景头不合并 /
 *      求证 rescue / 挣扎 rescue / 揭露行自带求证 rescue /
 *      悬置钩子放行 / 无揭露放行 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantKinship } = require('../dist/engine/instant-kinship.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = instantKinship('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次认亲白给豁免（一次速认是类型惯例）', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈父：当年我把你放在福利院门口，我找了你二十三年。',
    '沈知夏：爸！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次认亲白给命中 70', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈父：当年我把你放在福利院门口。',
    '沈知夏：爸！',
    '',
    '内景 弄堂 夜',
    '林秋：你是我亲妈？',
    '林母：当年把你送走了。',
    '林秋：妈！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 8);
});

test('ex04 相邻揭露行合并为同一事件', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈母：我是你妈啊！',
    '沈知夏：爸！',
    '',
    '内景 医院 夜',
    '林秋：你是我亲哥？',
    '林秋：哥！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 医院 夜',
    '（林母抱住了林秋）',
    '林秋：你是我亲妈？',
    '内景 弄堂 夜',
    '沈乙：你是我亲爹？',
    '沈乙：爹！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex06 揭露行自带求证放行（DNA 报告）', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈知夏：爸！',
    '',
    '内景 医院 夜',
    '林秋：DNA报告出来了，你是我女儿。',
    '林母：我的孩子！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 悬置的认亲钩子放行（揭露后无接纳动作）', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈父：（沉默，手里捏着半张照片。）',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 无血缘揭露的亲情拥抱放行', () => {
  const d = [
    '内景 家中 夜',
    '母亲：路上冷吧，快进来。',
    '儿子：妈，我回来了。（抱住了母亲）',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 挣扎摩擦放行（我不信+怎么证明）', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈知夏：爸！',
    '',
    '内景 医院 夜',
    '林秋：你是我亲妈？',
    '林母：当年把你送走了。',
    '林秋：我不信……你怎么证明？',
    '（林母抱住了林秋）',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex10 揭露与接纳 ±2 行共现成事件', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '沈父：当年我把你放在门口。',
    '沈知夏：爸——！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（揭露后隔4行才接纳）', () => {
  const d = [
    '内景 祖宅 夜',
    '沈知夏：你是我爸爸？',
    '△两人对视。',
    '△风吹动门帘。',
    '△雨声渐大。',
    '沈知夏：爸——！',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('沈甲：你是我爸爸？');
    beats.push('沈甲：爸！');
  }
  const r = instantKinship(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('沈甲：你是我爸爸？');
    beats.push('沈甲：爸！');
  }
  const r = instantKinship(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. MANSION - NIGHT',
    "ELENA: You're my father?",
    'ELENA: Dad!',
    '',
    'INT. WAREHOUSE - NIGHT',
    "MARCO: You're my mother?",
    'MARCO: Mom!',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex15 en 揭露行自带求证放行（DNA results）', () => {
  const d = [
    'INT. MANSION - NIGHT',
    "ELENA: You're my father?",
    'ELENA: Dad!',
    '',
    'INT. WAREHOUSE - NIGHT',
    "MARCO: The DNA results are in - you're my mother.",
    'MARCO: Mom!',
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex16 en 无血缘揭露放行', () => {
  const d = [
    'INT. HOME - NIGHT',
    'MOTHER: You look cold. Come in.',
    "SON: I'm home, Mom.",
  ].join('\n');
  const r = instantKinship(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. MANSION - NIGHT',
    "ELENA: You're my father?",
    'ELENA: Dad!',
    '',
    'INT. WAREHOUSE - NIGHT',
    "MARCO: You're my mother?",
    'MARCO: Mom!',
  ].join('\n');
  const r = instantKinship(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
