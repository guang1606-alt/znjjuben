/**
 * instant-love 初见白给/爱情速热 单测（块96）
 * 覆盖：首次豁免 / 第2次命中 / 相邻承诺行合并 / 跨场景头不合并 /
 *      时间铺垫 rescue / 拒绝摩擦 rescue / selfQualified / 纯承诺无初见放行 /
 *      纯初见无承诺放行 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantLove } = require('../dist/engine/instant-love.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = instantLove('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次豁免（一次一见钟情是类型惯例）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '陆总：好。娶你。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次命中 70', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 天台 夜',
    '陈默：我们刚见面吧？',
    '林悦：可我已经爱上你了。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻承诺行合并为同一事件', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '△她仰起脸。',
    '苏晚：嫁给我，好吗？',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 初见信号不能跨场景走私（场景2无初见则不构成事件）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 天台 夜',
    '△她独自吹风。',
    '林悦：可我已经爱上你了。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex06 时间铺垫 rescue（感情有来路）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 医院走廊 日',
    '陈默：我们刚认识吧？',
    '△这些日子他在她病床边守了三个月。',
    '陈默：我已经认定你了，非你不娶。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 拒绝摩擦 rescue（有人替观众戳破）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 医院走廊 日',
    '周启：我们刚认识吧？',
    '周启：可我已经认定你了，非你不娶。',
    '林悦：你疯了，太快了。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex08 selfQualified（承诺行自带时间限定）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 咖啡馆 日',
    '周启：这是咱们第一次见面吧。',
    '林悦：可这些日子视频里聊下来，我认定你了。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex09 纯承诺无初见放行（正常恋爱告白）', () => {
  const d = [
    '内景 江边 黄昏',
    '△相恋三年，他们一起走过无数次这条江。',
    '他单膝跪地：嫁给我。',
    '她哭着点头：我爱你。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯初见无承诺放行（心动描写不算事件）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们第一次见面吧？',
    '△她心跳漏了一拍，多看了两眼。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗（初见与承诺隔4行不构成事件）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们刚认识吧？',
    '△她倒了一杯酒。',
    '△窗外落雨。',
    '△音乐响起。',
    '苏晚：我认定你了，非你不嫁。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 50', () => {
  const ev = (name, love) => [
    `内景 场地${name} 日`,
    `${name}：我们刚认识吧？`,
    `${name}：可我${love}。`,
  ].join('\n');
  const d = [ev('甲', '认定你了，非你不嫁'), ev('乙', '已经爱上你了'), ev('丙', '认定你了，此生非你不可')].join('\n\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const ev = (name, love) => [
    `内景 场地${name} 日`,
    `${name}：我们刚认识吧？`,
    `${name}：可我${love}。`,
  ].join('\n');
  const d = [ev('甲', '认定你了，非你不嫁'), ev('乙', '已经爱上你了'), ev('丙', '认定你了，此生非你不可'), ev('丁', '认定你了，非你不娶'), ev('戊', '已经爱上你了')].join('\n\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.score, 20);
});

test('ex17 zh 元数据（line/sceneIndex/marker/snippet）', () => {
  const d = [
    '内景 酒会 夜',
    '陆总：我们今天刚认识吧？',
    '苏晚：可我认定你了，非你不嫁。',
    '',
    '内景 天台 夜',
    '陈默：我们刚见面吧？',
    '林悦：可我已经爱上你了。',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].sceneIndex, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '内景 天台 夜');
  assert.ok(r.hits[0].marker.length > 0);
  assert.ok(r.hits[0].reason.length > 0);
});

/* ---------- en ---------- */

test('ex14 en 全链路：首次豁免+第2次70', () => {
  const d = [
    'INT. HOTEL BAR NIGHT',
    'RYAN: We just met, did we not?',
    'MIA: I know, but I am in love with you. Marry me.',
    '',
    'INT. ROOFTOP NIGHT',
    'JAKE: We only met this morning.',
    'KATE: And I love you already.',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('ex15 en 拒绝摩擦 rescue', () => {
  const d = [
    'INT. HOTEL BAR NIGHT',
    'RYAN: We just met, did we not?',
    'MIA: I know, but I am in love with you. Marry me.',
    '',
    'INT. ROOFTOP DAY',
    'JAKE: We only met this morning.',
    'JAKE: But I love you already.',
    'KATE: Too fast. We barely know each other.',
  ].join('\n');
  const r = instantLove(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex16 en 输出零 CJK', () => {
  const d = [
    'INT. HOTEL BAR NIGHT',
    'RYAN: We just met, did we not?',
    'MIA: I know, but I am in love with you. Marry me.',
    '',
    'INT. ROOFTOP NIGHT',
    'JAKE: We only met this morning.',
    'KATE: And I love you already.',
  ].join('\n');
  const r = instantLove(d);
  const cjk = /[\u4e00-\u9fff]/;
  assert.ok(!cjk.test(r.issues.join(' ') + r.advice.join(' ')));
  for (const h of r.hits) {
    assert.ok(!cjk.test(h.reason), `reason has CJK: ${h.reason}`);
  }
});
