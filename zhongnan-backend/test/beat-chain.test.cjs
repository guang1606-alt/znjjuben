'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildBeatChain, formatBeatChainLines, payoffFlavorDistribution } = require('../dist/lib/beat-chain.js');

test('计数自洽：逐集反转/爽点之和等于总览', () => {
  const c = buildBeatChain(10, 4);
  let r = 0, p = 0;
  c.episodes.forEach((e) => { if (e.reversalZh) r++; p += e.payoffsZh.length; });
  assert.strictEqual(r, c.stats.reversalCount);
  assert.strictEqual(p, c.stats.payoffCount);
  const fc = Object.values(c.stats.flavorCounts).reduce((a, b) => a + b, 0);
  assert.strictEqual(fc, p);
});

test('确定性：同参两次完全一致', () => {
  assert.strictEqual(JSON.stringify(buildBeatChain(12, 4)), JSON.stringify(buildBeatChain(12, 4)));
});

test('跨集轮换：反转不会每集同型连续', () => {
  const c = buildBeatChain(16, 4);
  const names = c.episodes.map((e) => e.reversalZh).filter(Boolean);
  let dup = 0;
  for (let i = 1; i < names.length; i++) if (names[i] === names[i - 1]) dup++;
  assert.ok(dup <= 1, '允许极少数，基本不连续同型');
});

test('中文行结构：总览/逐集/体检', () => {
  const lines = formatBeatChainLines(buildBeatChain(8, 4), 'zh');
  assert.match(lines[0], /^兑现链总览：共8集/);
  assert.match(lines[1], /^第1集/);
  assert.match(lines[1], /情绪弧：.+→.+→/);
  assert.ok(lines.some((l) => l.startsWith('兑现体检')));
});

test('英文行零中文', () => {
  const lines = formatBeatChainLines(buildBeatChain(8, 4), 'en');
  lines.forEach((l) => assert.ok(!/[一-鿿]/.test(l), l));
  assert.match(lines[0], /^Payoff chain: 8 eps/);
});

test('超长截断：40集=总览1+前10+省略1+后4+体检2', () => {
  const lines = formatBeatChainLines(buildBeatChain(40, 4), 'zh');
  assert.strictEqual(lines.length, 1 + 10 + 1 + 4 + 2);
  assert.match(lines[lines.length - 3], /第40集/);
});

test('夹值：集数1-300、场景1-8', () => {
  assert.strictEqual(buildBeatChain(0, 4).episodeCount, 1);
  assert.strictEqual(buildBeatChain(999, 4).episodeCount, 300);
  assert.strictEqual(buildBeatChain(6, 99).episodes[0].ep, 1);
});

test('风味分布字符串与计数一致', () => {
  const c = buildBeatChain(8, 4);
  const s = payoffFlavorDistribution(c, 'zh');
  const shown = [...s.matchAll(/×(\d+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  const total = Object.values(c.stats.flavorCounts).reduce((a, b) => a + b, 0);
  assert.strictEqual(shown, total);
});
