const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/config/model-catalog.js');
const L = require('../dist/config/pricing.js');
const LEVELS = ['FREE', 'BASIC', 'ADVANCED', 'PRO'];
const TIERS = ['economy', 'standard', 'flagship'];

test('四档引擎组合（v2.54：3档全国产+海外档预留）：引用合法、多岗异构、岗位≥6、成本严格递增', () => {
  const tiers = C.buildTiers();
  assert.strictEqual(tiers.length, 4);
  let prev = -1;
  for (const t of tiers) {
    assert.ok(t.picks.length >= 6);
    for (const p of t.picks) if (p.modelId !== 'LOCAL') assert.ok(C.findModel(p.modelId), `非法模型 ${p.modelId}`);
    assert.ok(new Set(t.picks.map((p) => p.modelId)).size >= 3, '退化成单一模型');
    assert.ok(t.costFen > prev, '成本应随档位严格递增');
    prev = t.costFen;
  }
});

test('【不亏损铁底】每个会员×其可用档位，EP_PRICE实付价≥裸成本×2', () => {
  for (const lv of LEVELS) {
    for (const tid of TIERS) {
      if (!C.canUseTier(L.MemberLevel[lv], tid)) continue;
      const p = C.priceForTier(L.MemberLevel[lv], tid);
      assert.ok(p.chargedFen >= p.costFen * 2, `${lv}用${tid}亏本: 付${p.chargedFen} 裸成本${p.costFen}`);
      assert.ok(p.ok);
    }
  }
});

test('会员等级越高默认引擎越强；专业默认旗舰', () => {
  const rank = { economy: 0, standard: 1, flagship: 2 };
  let prev = -1;
  for (const lv of LEVELS) {
    const d = C.defaultTierForLevel(L.MemberLevel[lv]);
    assert.ok(rank[d] >= prev); prev = rank[d];
  }
  assert.strictEqual(C.defaultTierForLevel(L.MemberLevel.PRO), 'flagship');
});

test('引擎按会员等级逐级解锁（v1.32：高级即可用旗舰，基础不可）', () => {
  assert.strictEqual(C.canUseTier(L.MemberLevel.FREE, 'standard'), false);
  assert.strictEqual(C.canUseTier(L.MemberLevel.BASIC, 'flagship'), false);
  assert.strictEqual(C.canUseTier(L.MemberLevel.ADVANCED, 'flagship'), true);
  assert.strictEqual(C.canUseTier(L.MemberLevel.PRO, 'flagship'), true);
  assert.strictEqual(C.canUseTier(L.MemberLevel.BASIC, 'economy'), true);
});

test('旗舰档全国产顶配（v2.54：原海外组合迁移到 OVERSEAS，FLAGSHIP 不含 GPT-5/Claude/Gemini）', () => {
  const flag = C.buildTiers().find((x) => x.id === 'flagship');
  const ids = flag.picks.map((p) => p.modelId);
  assert.ok(!ids.includes('gpt_5flag') && !ids.includes('claude_sonnet5') && !ids.includes('gemini_3pro'),
    '旗舰档已全国产化，不应含海外模型');
  assert.ok(ids.includes('deepseek_v4pro') && ids.includes('doubao_seed2pro'),
    '旗舰档应含 DeepSeek-V4-Pro + 豆包 Seed2.0-Pro（国产顶配）');
  assert.ok(!ids.some((id) => id.includes('opus')), 'Opus 每集会击穿铁底，不应进每集组合');
  const p = C.priceForTier(L.MemberLevel.PRO, 'flagship');
  assert.ok(p.chargedFen >= p.costFen * 2);
  assert.ok(p.margin >= 0.5, `专业旗舰毛利偏低 ${p.margin}`);
});

test('海外档异构最强（v2.54 预留：GPT-5+Claude Sonnet5+DeepSeek-V4+豆包Seed2.0），EP_PRICE 未列→拒售', () => {
  const ovs = C.buildTiers().find((x) => x.id === 'overseas');
  assert.ok(ovs, '海外档必须存在（预留）');
  const ids = ovs.picks.map((p) => p.modelId);
  assert.ok(ids.includes('gpt_5flag') && ids.includes('claude_sonnet5') && ids.includes('deepseek_v4pro') && ids.includes('doubao_seed2pro'),
    '海外档应含 GPT-5 + Claude Sonnet5 + DeepSeek-V4-Pro + 豆包 Seed2.0-Pro');
  // EP_PRICE 未列 OVERSEAS → priceForTier 返回 chargedFen=0 + margin=-1 + ok=false（自然拒售，无需额外守卫代码）
  const p = C.priceForTier(L.MemberLevel.PRO, 'overseas');
  assert.ok(!p.ok, '海外档预留期：EP_PRICE 未列 OVERSEAS，必须拒售');
  assert.strictEqual(p.chargedFen, 0, 'EP_PRICE 未列 OVERSEAS → 实付价应为 0');
  assert.strictEqual(p.margin, -1, '未定价档位 margin 应为 -1（拒售标记）');
});

test('LOCAL零成本；图片模型≥8家含GPT-image；文本模型都带BaseUrl；组合建议覆盖8岗', () => {
  assert.strictEqual(C.findModel('LOCAL'), undefined);
  assert.strictEqual(C.estimateComboCostFen([{ role: 'writer', modelId: 'LOCAL', backupIds: [] }]), 0);
  assert.ok(C.IMAGE_MODELS.length >= 8 && C.IMAGE_MODELS.some((m) => m.id === 'gpt_image'));
  C.TEXT_MODELS.forEach((m) => assert.ok(/^https?:\/\//.test(m.defaultBaseUrl)));
  const adv = C.portfolioAdvice();
  assert.strictEqual(adv.length, 8);
  adv.forEach((a) => assert.ok(a.primary && a.rule));
});
