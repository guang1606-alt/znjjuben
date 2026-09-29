/**
 * 会员定价 / 盈利测算器（v1.79）
 * 纯函数、零 IO、可离线对拍。用途：
 *  1) 任意调价方案（月费/赠送集/超量价/引擎用量结构）实时算「收入-模型成本-毛利-毛利率」，
 *     辅助最终定价决策，绝不靠感觉定价；
 *  2) 单点定价校验：任一售卖组合 售价分 是否 ≥ 成本分×2（与 pricing.assertNoLoss 同铁底，口径一致）；
 *  3) 所有用量假设必须由调用方显式传入，不臆造用户行为；不填则用「显式标注的中性默认场景」。
 */
import { EngineTier, FEN_PER_POINT, ENGINE } from './pricing';

/** 单集某引擎真实成本（分） */
export function epCostFen(tier: EngineTier): number {
  return ENGINE[tier].costFenPerEp;
}

/** 不赔钱下限：某引擎单集至少要卖多少积分（成本×2 向上取整到整积分） */
export function priceFloorPoints(tier: EngineTier): number {
  return Math.ceil((epCostFen(tier) * 2) / FEN_PER_POINT);
}

export interface PriceCheck {
  tier: EngineTier;
  sellPoints: number;
  sellFen: number;
  costFen: number;
  multiple: number;     // 售价 / 成本 倍数
  pass: boolean;        // ≥2 倍铁底
  floorPoints: number;  // 不赔钱下限积分
}
/** 校验某会员档某引擎单集售价是否满足 ≥成本×2 */
export function checkEpPrice(tier: EngineTier, sellPoints: number): PriceCheck {
  const costFen = epCostFen(tier);
  const sellFen = sellPoints * FEN_PER_POINT;
  const floorPoints = priceFloorPoints(tier);
  return {
    tier, sellPoints, sellFen, costFen,
    multiple: costFen > 0 ? Number((sellFen / costFen).toFixed(3)) : Infinity,
    pass: sellFen >= costFen * 2,
    floorPoints,
  };
}

/** 一个月内各引擎「付费超量生成」的集数（赠送额度只兑现经济档，故此处不含赠送部分） */
export interface TierEps { ECONOMY?: number; STANDARD?: number; FLAGSHIP?: number; OVERSEAS?: number; }  // v2.54：加 OVERSEAS 可选键（预留档不开放购买，值恒 undefined）
export interface MonthlyPlanInput {
  level: string;
  monthlyFen: number;        // 月费（分），按量付费用户可传 0
  quotaEps?: number;         // 每月赠送集数（按经济档成本兑现）
  paidEps?: TierEps;         // 超量/付费生成各引擎集数
  /** 各引擎超量单集售价（积分），缺省由调用方给，避免隐式假设 */
  overagePoints?: Partial<Record<EngineTier, number>>;
  /** 非模型刚性成本（服务器/带宽/存储/支付通道/分摊，分/月/用户），显式传入；不填按0只算模型毛利 */
  otherCostFen?: number;
}
export interface MonthlyPlanResult {
  level: string;
  subscriptionFen: number;                 // 月费收入
  overageRevenueFen: number;               // 超量积分折算收入
  revenueFen: number;                      // 合计收入
  quotaModelCostFen: number;               // 赠送集模型成本
  paidModelCostFen: number;                // 付费集模型成本
  modelCostFen: number;
  otherCostFen: number;
  grossFen: number;                        // 收入-模型-其他
  modelGrossMarginPct: number;             // 仅扣模型成本的毛利率
  netGrossMarginPct: number;               // 扣模型+其他成本的毛利率
  anyFloorBreach: PriceCheck[];            // 哪个引擎超量售价破了2倍铁底
  healthy: boolean;                        // 收入覆盖模型成本且无破底
}

const TIERS: EngineTier[] = [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP];

/** 测算单个会员档单月盈利模型 */
export function simulateMonthlyPlan(input: MonthlyPlanInput): MonthlyPlanResult {
  const quotaEps = Math.max(0, input.quotaEps ?? 0);
  const paid = input.paidEps ?? {};
  const over = input.overagePoints ?? {};
  const otherCostFen = Math.max(0, input.otherCostFen ?? 0);

  const quotaModelCostFen = quotaEps * epCostFen(EngineTier.ECONOMY);
  let overageRevenueFen = 0;
  let paidModelCostFen = 0;
  const breaches: PriceCheck[] = [];
  for (const tier of TIERS) {
    const eps = Math.max(0, paid[tier] ?? 0);
    if (eps <= 0) continue;
    paidModelCostFen += eps * epCostFen(tier);
    const pts = over[tier];
    if (pts == null) {
      // 未给超量售价则无法计收入，记为破底提醒（避免漏算悄悄亏钱）
      breaches.push({ tier, sellPoints: 0, sellFen: 0, costFen: epCostFen(tier), multiple: 0, pass: false, floorPoints: priceFloorPoints(tier) });
      continue;
    }
    overageRevenueFen += eps * pts * FEN_PER_POINT;
    const chk = checkEpPrice(tier, pts);
    if (!chk.pass) breaches.push(chk);
  }
  const subscriptionFen = Math.max(0, input.monthlyFen);
  const revenueFen = subscriptionFen + overageRevenueFen;
  const modelCostFen = quotaModelCostFen + paidModelCostFen;
  const grossFen = revenueFen - modelCostFen - otherCostFen;
  const pct = (n: number) => (revenueFen > 0 ? Number(((n / revenueFen) * 100).toFixed(2)) : 0);
  return {
    level: input.level,
    subscriptionFen, overageRevenueFen, revenueFen,
    quotaModelCostFen, paidModelCostFen, modelCostFen, otherCostFen, grossFen,
    modelGrossMarginPct: pct(revenueFen - modelCostFen),
    netGrossMarginPct: pct(grossFen),
    anyFloorBreach: breaches,
    healthy: grossFen >= 0 && breaches.length === 0,
  };
}

export interface FullPricingScenario {
  plans: MonthlyPlanInput[];
}
/** 一次测算整套会员体系，返回各档结果 + 合计（用于横向比价与年卡折算） */
export function simulatePricing(scenario: FullPricingScenario): {
  results: MonthlyPlanResult[];
  totalRevenueFen: number;
  totalModelCostFen: number;
  blendedModelGrossMarginPct: number;
  allHealthy: boolean;
} {
  const results = scenario.plans.map(simulateMonthlyPlan);
  const totalRevenueFen = results.reduce((s, r) => s + r.revenueFen, 0);
  const totalModelCostFen = results.reduce((s, r) => s + r.modelCostFen, 0);
  return {
    results,
    totalRevenueFen,
    totalModelCostFen,
    blendedModelGrossMarginPct: totalRevenueFen > 0
      ? Number((((totalRevenueFen - totalModelCostFen) / totalRevenueFen) * 100).toFixed(2)) : 0,
    allHealthy: results.every((r) => r.healthy),
  };
}
