/**
 * 不赔钱·穷尽式总账巡检（每轮自动跑）
 * 目的：把全站所有"收钱点 / 花钱点"聚到一处做不赔钱证明，任一组合击穿"售价≥成本×2"即红灯。
 * 覆盖：引擎档位×会员、增值服务、图片海报、会员月费摊薄赠送集、免费补贴上界、邀请兑付上界、X剧本。
 */
const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/config/pricing.js');
const C = require('../dist/config/model-catalog.js');
const { MemberLevel: LV, EngineTier: TIER, EP_PRICE, VALUE_ADDED, MEMBERSHIP, ENGINE, INVITE, X_SCRIPT, FEN_PER_POINT } = P;

test('【总账1】启动自检 assertNoLoss 必须零错误（引擎+增值全部≥成本×2）', () => {
  assert.deepStrictEqual(P.assertNoLoss(), []);
});

test('【总账2】每个会员×其【已开放】引擎档：实付价≥真实裸成本×2（用逐岗现算成本，非估算常量）', () => {
  for (const lv of [LV.FREE, LV.BASIC, LV.ADVANCED, LV.PRO]) {
    for (const id of ['economy', 'standard', 'flagship']) {
      const r = C.priceForTier(lv, id);
      if (r.chargedFen === 0) continue; // 未开放组合跳过
      assert.ok(r.ok, `${lv}+${id} 售价${r.chargedFen}分 未达成本${r.costFen}×2（毛利率${(r.margin * 100).toFixed(1)}%）`);
      assert.ok(r.chargedFen >= r.costFen * 2);
    }
  }
});

test('【总账3】增值服务逐项：售价积分×10 ≥ 成本分×2（含海报/PK/小南/精修/版权/TTS/存储）', () => {
  for (const [k, it] of Object.entries(VALUE_ADDED)) {
    const priceFen = it.points * FEN_PER_POINT;
    assert.ok(priceFen >= it.costFen * 2,
      `${k}: 售价${priceFen}分 < 成本${it.costFen}×2=${it.costFen * 2}分`);
  }
});

test('【总账4】图片海报：4张真实成本与定价costFen精确对齐，且售价≥该成本×2（图片无免费）', () => {
  // model-proxy.callImage：旗舰140分/张、标准10分/张，各出4张
  const stdCost = 10 * 4, flagCost = 140 * 4;
  assert.strictEqual(VALUE_ADDED.POSTER_STANDARD.costFen, stdCost);
  assert.strictEqual(VALUE_ADDED.POSTER_FLAGSHIP.costFen, flagCost);
  assert.ok(VALUE_ADDED.POSTER_STANDARD.points * FEN_PER_POINT >= stdCost * 2);
  assert.ok(VALUE_ADDED.POSTER_FLAGSHIP.points * FEN_PER_POINT >= flagCost * 2);
  // 分享梗概海报也不亏
  assert.ok(VALUE_ADDED.SHARE_POSTER.points * FEN_PER_POINT >= VALUE_ADDED.SHARE_POSTER.costFen * 2);
});

test('【总账5】会员月费 ≥ 当月赠送集全部用经济档兑完的真实成本（赠送只抵经济档，绝不倒贴）', () => {
  for (const lv of [LV.ADVANCED, LV.PRO]) {
    const m = MEMBERSHIP[lv];
    const quotaCostFen = (m.quotaMonthly ?? 0) * ENGINE.ECONOMY.costFenPerEp; // 用保守成本常量12分/集
    assert.ok(m.monthlyFen >= quotaCostFen,
      `${lv} 月费${m.monthlyFen}分 < 赠送${m.quotaMonthly}集经济成本${quotaCostFen}分`);
  }
});

test('【总账6】免费补贴有上界：单账号每日免费集×经济成本为有限值，不构成无限成本', () => {
  const dailyCostFen = MEMBERSHIP.FREE.freeEpsPerDay * ENGINE.ECONOMY.costFenPerEp;
  assert.ok(dailyCostFen > 0 && Number.isFinite(dailyCostFen));
  assert.ok(dailyCostFen <= 30, `单账号每日免费补贴成本应≤30分，实际${dailyCostFen}`);
});

test('【总账7】邀请奖励有累计封顶；封顶积分按最便宜引擎兑付的真实成本有上界（防刷穿）', () => {
  assert.ok(INVITE.BONUS_GRANT_CAP > 0);
  // 最便宜单集价=专业经济5积分；封顶积分最多可兑集数 × 经济真实成本(保守12分)=补贴真实成本上界
  const cheapestPointsPerEp = Math.min(...[LV.BASIC, LV.ADVANCED, LV.PRO].map((l) => EP_PRICE[l].ECONOMY));
  const maxEps = Math.floor(INVITE.BONUS_GRANT_CAP / cheapestPointsPerEp);
  const maxRealCostFen = maxEps * ENGINE.ECONOMY.costFenPerEp;
  assert.ok(Number.isFinite(maxRealCostFen) && maxRealCostFen > 0);
  // 单个用户累计获赠积分的真实兑付成本上界必须小于其积分面值（平台不会因赠送积分倒贴现金等价物）
  assert.ok(maxRealCostFen <= INVITE.BONUS_GRANT_CAP * FEN_PER_POINT);
});

test('【总账8】X剧本：定价为正、带授权gating（模型成本待接入后在此追加×2断言，暂不假设已覆盖）', () => {
  assert.ok(X_SCRIPT.monthlyFen > 0);
  assert.ok(X_SCRIPT.perEpPoints > 0);
  assert.ok(/授权|问卷|责任/.test(X_SCRIPT.gating));
});

test('【总账9】所有引擎单集售价为正且成本为正（不存在0元收费或负成本的异常配置）', () => {
  for (const t of C.buildTiers()) {
    assert.ok(t.costFen > 0, `${t.id} 成本必须为正`);
  }
  for (const lv of [LV.BASIC, LV.ADVANCED, LV.PRO]) {
    for (const tier of [TIER.ECONOMY, TIER.STANDARD, TIER.FLAGSHIP]) {
      const pts = EP_PRICE[lv][tier];
      if (pts != null) assert.ok(pts > 0, `${lv}.${tier} 售价必须为正`);
    }
  }
});
