const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/opportunity-radar.js');
const P = require('../dist/config/platform-playbook.js');

test('稀缺题材识别：非遗/国风命中 heritage', () => {
  const hit = P.matchScarce(['非遗', '国风', '手艺']);
  assert.ok(hit.some((x) => x.id === 'heritage'));
  assert.strictEqual(P.matchScarce(['霸总']).length, 0);
});

test('系列化健康度：缺项列出、补齐通过；增量阶梯与真情感可检验', () => {
  const empty = P.seriesDesignCheck({});
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.missing.length, 3);
  const full = P.seriesDesignCheck({ hasRecurringCharacters: true, worldExpandable: true, mainlineEscalates: true, season: 2 });
  assert.strictEqual(full.ok, true);
  assert.ok(P.INNOVATION_LADDER.length === 4);
  assert.ok(P.innovationPaths([]).length >= 3);
  assert.strictEqual(P.trueEmotionCheck({}).ok, false);
  assert.strictEqual(P.trueEmotionCheck({ groundedInPlight: true, hasForeshadow: true, restrained: true }).ok, true);
});

test('机会雷达：稀缺+系列化+真情感+高激励 → 蓝海高分', () => {
  const r = R.opportunityRadar({
    tags: ['非遗', '国风', '文旅'],
    seriesSeason: 3,
    series: { hasRecurringCharacters: true, worldExpandable: true, mainlineEscalates: true },
    emotion: { groundedInPlight: true, hasForeshadow: true, restrained: true },
    incentive: { categoryBoostPct: 20, seriesSeason: 3 },
  });
  assert.ok(r.opportunityScore >= 72, `应蓝海，实际${r.opportunityScore}`);
  assert.strictEqual(r.ocean, '蓝海机会');
  assert.ok(r.incentiveTotalPct === 50); // 20品类 + 30续季S3
  assert.ok(r.seriesOk && r.emotionOk);
  assert.ok(r.verdict.includes('不代表成交承诺'));
});

test('机会雷达：无差异化且撞高热度榜单 → 红海谨慎', () => {
  const now = new Date('2026-08-29T00:00:00Z');
  const board = Array.from({ length: 4 }, (_, i) => ({ title: `剧${i}`, platform: '红果', tags: ['霸总甜宠'], heat: 100, date: now, region: 'domestic' }));
  const r = R.opportunityRadar({ tags: ['霸总甜宠'], board, now });
  assert.ok(r.competition >= 80, `竞争应高，实际${r.competition}`);
  assert.strictEqual(r.ocean, '红海谨慎');
  assert.strictEqual(r.dataLimited, false);
});

test('机会雷达：空输入安全降级为中性，不白送蓝海', () => {
  const r = R.opportunityRadar({ tags: [] });
  assert.strictEqual(r.dataLimited, true);
  assert.ok(r.opportunityScore >= 50 && r.opportunityScore < 72);
  assert.strictEqual(r.ocean, '细分机会');
});
