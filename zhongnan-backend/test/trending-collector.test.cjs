const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/trending-collector.js');
const P = require('../dist/engine/context-personalization.js');

const SRC = { id: 't1', name: '测试源', region: 'domestic', kinds: ['热度榜'] };
const SRC2 = { id: 't2', name: '源二', region: 'overseas', kinds: ['Trending'] };

test('normalizeTags：字符串按分隔符拆、数组去空去重保序', () => {
  assert.deepStrictEqual(C.normalizeTags('逆袭,甜宠/复仇、逆袭'), ['逆袭', '甜宠', '复仇']);
  assert.deepStrictEqual(C.normalizeTags([' 战神', '', '战神', '赘婿']), ['战神', '赘婿']);
  assert.deepStrictEqual(C.normalizeTags(undefined), []);
});

test('normalizeEntry：缺热度按名次反推、都缺给1、无效日期落到now、继承地区、空标题丢弃', () => {
  const now = new Date('2026-08-30T00:00:00Z');
  const a = C.normalizeEntry(SRC, { title: '榜首', rank: 1 }, now);
  assert.strictEqual(a.heat, 100);
  assert.strictEqual(a.region, 'domestic');
  const b = C.normalizeEntry(SRC, { title: '无名次无热度' }, now);
  assert.strictEqual(b.heat, 1);
  assert.strictEqual(b.date.getTime(), now.getTime());
  const c = C.normalizeEntry(SRC, { title: '坏日期', date: 'not-a-date' }, now);
  assert.strictEqual(c.date.getTime(), now.getTime());
  assert.strictEqual(C.normalizeEntry(SRC, { title: '  ' }, now), null);
});

test('mergeBoards：同源同标题去重保留高热度并合并标签，按热度排序', () => {
  const merged = C.mergeBoards([
    { title: 'X', platform: '测试源', tags: ['a'], heat: 10, date: new Date('2026-08-29'), region: 'domestic' },
    { title: 'X', platform: '测试源', tags: ['b'], heat: 50, date: new Date('2026-08-28'), region: 'domestic' },
    { title: 'Y', platform: '测试源', tags: [], heat: 5, date: new Date('2026-08-30'), region: 'domestic' },
  ]);
  assert.strictEqual(merged.length, 2);
  const x = merged.find((m) => m.title === 'X');
  assert.strictEqual(x.heat, 50);
  assert.deepStrictEqual(x.tags.sort(), ['a', 'b']);
});

test('collectBoards：单源失败/超时被隔离，成功源照常归一，失败如实记录', async () => {
  const fetcher = async (s) => {
    if (s.id === 't1') return [{ title: '好剧A', tags: '逆袭,复仇', rank: 2 }];
    if (s.id === 't2') throw new Error('源挂了');
    return [];
  };
  const r = await C.collectBoards(fetcher, { sources: [SRC, SRC2], now: new Date('2026-08-30') });
  assert.strictEqual(r.okCount, 1);
  assert.strictEqual(r.failures.length, 1);
  assert.strictEqual(r.failures[0].id, 't2');
  assert.strictEqual(r.items.length, 1);
  assert.strictEqual(r.items[0].heat, 99); // rank2 → 99
});

test('collectBoards：超时源进failures；全部失败时items为空不抛错', async () => {
  const hang = () => new Promise(() => {});
  const r = await C.collectBoards(hang, { sources: [SRC], timeoutMs: 20, now: new Date() });
  assert.strictEqual(r.items.length, 0);
  assert.strictEqual(r.okCount, 0);
  assert.ok(r.failures[0].reason.includes('超时'));
});

test('端到端类型贯通：采集结果可直接喂 trendingSignals', () => {
  const now = new Date('2026-08-30T00:00:00Z');
  const items = C.manualEntries(SRC, [{ title: '剧', tags: '逆袭,战神', heat: 90 }], now);
  const sig = P.trendingSignals(items, now, 5, 'all');
  assert.ok(sig.some((x) => x.tag === '逆袭'));
});
