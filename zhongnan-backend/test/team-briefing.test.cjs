/**
 * team-briefing 开会式推进 单测（块139）
 * 覆盖：首次豁免 / 第2次命中 / 相邻分派合并 / 跨场景头不合并 /
 *      异议 rescue / 赌注 rescue / 变数 rescue / 无分派放行 /
 *      无服从放行 / ±2 行共现 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { teamBriefing } = require('../dist/engine/team-briefing.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = teamBriefing('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次部署豁免（一次战前分派是类型片仪式感）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了。小舟你负责望风，大刘你带一队走后门。',
    '小舟：明白！',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次开会式推进命中 70', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '小舟：明白。',
    '',
    '内景 天台 夜',
    '老陈：分头行动，大刘你带一队走正门。',
    '大刘：收到，保证完成任务！',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻分派行合并为同一事件', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了。小舟你负责望风，你带一队走后门。',
    '老陈：我带老三走正门，行动代号破晓。',
    '小舟：明白！',
    '',
    '内景 天台 夜',
    '老陈：分头行动，都听我口令。',
    '众人：明白！',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了。小舟你负责望风。小舟：明白！',
    '内景 天台 夜',
    '老陈：分头行动，大刘你盯正门。大刘：收到！',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex06 异议 rescue 放行（凭什么我带一队）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '小舟：明白！',
    '',
    '内景 天台 夜',
    '老陈：分头行动，大刘你带一队。',
    '大刘：凭什么我带一队？……行，包在我身上。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 无分派的应答放行（日常交代不归本引擎）', () => {
  const d = [
    '内景 公司 日',
    '小舟：明天开会记得带方案。',
    '大刘：明白，收到。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯分派无服从放行（布置后直接跳行动是剪辑选择）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了。分头行动，小舟你负责望风。',
    '△众人散开，各自就位。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 赌注 rescue 放行（只有一次机会）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '小舟：明白！',
    '',
    '内景 天台 夜',
    '老陈：分头行动，大刘你带一队。',
    '大刘：收到。',
    '老陈：都记住，这次只有一次机会，谁掉链子谁留在里面。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex10 分派与服从 ±2 行共现成事件', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '△小舟点头。',
    '小舟：明白！',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（分派后隔4行才应答）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '△窗外起风。',
    '△灯闪了一下。',
    '△水管滴水。',
    '小舟：明白了。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('老陈：分头行动。小舟：明白！');
  }
  const r = teamBriefing(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 夜`);
    beats.push('老陈：分头行动。小舟：明白！');
  }
  const r = teamBriefing(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 变数 rescue 放行（计划赶不上变化）', () => {
  const d = [
    '内景 仓库 夜',
    '老陈：都听好了，小舟你负责望风。',
    '小舟：明白！',
    '',
    '内景 天台 夜',
    '老陈：分头行动，大刘你带一队。',
    '大刘：收到。',
    '△对讲机响了——警卫提前换班，计划赶不上变化。',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* ---------- en ---------- */

test('ex15 en 第2次命中 70', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'CHEN: Listen up. Zhou, you watch the door. Liu, you take point.',
    'ZHOU: Got it.',
    '',
    'INT. ROOFTOP - NIGHT',
    'CHEN: Split up. Liu, you\'re on the front entrance.',
    'LIU: Copy that. Mission accepted.',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex16 en 异议 rescue 放行（Why me）', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'CHEN: Listen up. Zhou, you watch the door.',
    'ZHOU: Got it.',
    '',
    'INT. ROOFTOP - NIGHT',
    'CHEN: Split up. Liu, you take point.',
    'LIU: Why me? ... Fine. On it.',
  ].join('\n');
  const r = teamBriefing(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. WAREHOUSE - NIGHT',
    'CHEN: Listen up. Zhou, you watch the door. Liu, you take point.',
    'ZHOU: Got it.',
    '',
    'INT. ROOFTOP - NIGHT',
    'CHEN: Split up. Liu, you\'re on the front entrance.',
    'LIU: Copy that. Mission accepted.',
  ].join('\n');
  const r = teamBriefing(d);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
