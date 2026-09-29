const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/config/pricing-sim.js');
const P = require('../dist/config/pricing.js');

test('单集售价不赔钱下限 = 成本×2 向上取整到整积分', () => {
  // 经济成本12分 → 24分 → 2.4→3积分；标准35分→70分→7积分；旗舰110分→220分→22积分
  assert.strictEqual(S.priceFloorPoints(P.EngineTier.ECONOMY), 3);
  assert.strictEqual(S.priceFloorPoints(P.EngineTier.STANDARD), 7);
  assert.strictEqual(S.priceFloorPoints(P.EngineTier.FLAGSHIP), 22);
});

test('现行各档单集售价全部 ≥ 成本×2（锚点不破）', () => {
  for (const lv of ['FREE', 'BASIC', 'ADVANCED', 'PRO']) {
    for (const t of ['ECONOMY', 'STANDARD', 'FLAGSHIP']) {
      const pts = P.EP_PRICE[lv][t];
      if (pts == null) continue;
      const chk = S.checkEpPrice(t, pts);
      assert.ok(chk.pass, `${lv}+${t} 售价${pts}积分 倍数${chk.multiple} 必须≥2`);
      assert.ok(chk.multiple >= 2);
    }
  }
  // 专业旗舰是最薄一档，仍需≥2
  assert.ok(S.checkEpPrice('FLAGSHIP', P.EP_PRICE.PRO.FLAGSHIP).multiple >= 2);
});

test('会员月费覆盖每月赠送集模型成本（高级/专业，只用完赠送集的下限场景）', () => {
  const adv = S.simulateMonthlyPlan({ level: 'ADVANCED', monthlyFen: 9900, quotaEps: 300 });
  assert.strictEqual(adv.quotaModelCostFen, 300 * 12); // 36元
  assert.ok(adv.grossFen > 0);
  assert.strictEqual(adv.healthy, true);
  const pro = S.simulateMonthlyPlan({ level: 'PRO', monthlyFen: 29900, quotaEps: 1000 });
  assert.strictEqual(pro.quotaModelCostFen, 1000 * 12); // 120元
  assert.ok(pro.grossFen === 29900 - 12000);
});

test('超量集未给售价→判破底提醒，防止漏算悄悄亏钱', () => {
  const r = S.simulateMonthlyPlan({ level: 'BASIC', monthlyFen: 3900, paidEps: { STANDARD: 10 } });
  assert.strictEqual(r.anyFloorBreach.length, 1);
  assert.strictEqual(r.healthy, false);
});

test('超量售价低于成本2倍→healthy=false 并指出档位', () => {
  const r = S.simulateMonthlyPlan({
    level: 'PRO', monthlyFen: 29900, quotaEps: 1000,
    paidEps: { FLAGSHIP: 5 }, overagePoints: { FLAGSHIP: 10 }, // 10积分=100分 < 110×2=220
  });
  assert.ok(r.anyFloorBreach.some((b) => b.tier === 'FLAGSHIP'));
  assert.strictEqual(r.healthy, false);
});

test('整套体系混合测算：合计收入/成本/综合毛利率自洽', () => {
  const out = S.simulatePricing({
    plans: [
      { level: 'ADVANCED', monthlyFen: 9900, quotaEps: 300, paidEps: { STANDARD: 20 }, overagePoints: { STANDARD: 12 } },
      { level: 'PRO', monthlyFen: 29900, quotaEps: 1000, paidEps: { FLAGSHIP: 10 }, overagePoints: { FLAGSHIP: 24 } },
    ],
  });
  assert.strictEqual(out.results.length, 2);
  assert.strictEqual(out.allHealthy, true);
  // 高级超量收入 20集×12积分×10分=2400；专业 10×24×10=2400
  assert.strictEqual(out.results[0].overageRevenueFen, 2400);
  assert.strictEqual(out.results[1].overageRevenueFen, 2400);
  assert.ok(out.blendedModelGrossMarginPct > 0);
});
