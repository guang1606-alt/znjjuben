/**
 * 全站定价单一事实源（Single Source of Truth）—— v1.31 最终综合定价
 * 价格只在这里定义，服务端下发；前端传的任何价格都不被信任。
 *
 * 设计逻辑（综合会员权益/真实模型成本/隐性成本分摊/锚点/不赔钱铁底）：
 *   1 元 = 10 积分；铁底：任何售卖组合 售价 ≥ 真实成本×2（assertNoLoss 启动自检）。
 *   引擎单集真实成本(分)：经济12 / 标准35 / 旗舰110。
 *   引擎单集“积分价”按会员等级矩阵 EP_PRICE 定价：
 *     · 经济档对齐制式锚点——基础1元(10积分)/高级0.8元(8)/专业0.5元(5)，100集=1000积分=100元；
 *     · 标准/旗舰按成本×2 向上取友好价，等级越高越便宜但不破铁底；
 *   “每月赠送集数”用低成本经济档兑现（专业送1000集经济档成本仅约12元），让用户觉得超值而平台不亏；
 *   旗舰多模型是高价值用户的利润来源，绝不因赠送而倒贴（assertNoLoss 锁死）。
 */
export const POINTS_PER_YUAN = 10;
export const FEN_PER_POINT = 10; // 1 积分 = 0.1 元 = 10 分
export enum MemberLevel { FREE = 'FREE', BASIC = 'BASIC', ADVANCED = 'ADVANCED', PRO = 'PRO' }
export enum EngineTier { ECONOMY = 'ECONOMY', STANDARD = 'STANDARD', FLAGSHIP = 'FLAGSHIP', OVERSEAS = 'OVERSEAS' }

/** 预留档位：成本已登记但暂不售卖。必须同时不出现在任何 MEMBERSHIP.engines 与 EP_PRICE 中。
 *  v2.487 起由 pricingMatrixErrors()（启动自检）与 scripts/guard-pricing-matrix.cjs（提交前）双向锁死：
 *  「engines 有价无目」= 用户可选却算不出价（0 积分白跑），「有价目未授权」= 死价目，两者都是名实不符。 */
export const RESERVED_TIERS: EngineTier[] = [EngineTier.OVERSEAS];

/** 引擎单集积分价矩阵（积分/集）—— 最终定价权威表 */
export const EP_PRICE: Record<MemberLevel, Partial<Record<EngineTier, number>>> = {
  FREE:     { ECONOMY: 12 },                                  // 零售 1.2 元/集（每日2集补贴内不扣）
  BASIC:    { ECONOMY: 10, STANDARD: 15 },                    // 1元 / 1.5元
  ADVANCED: { ECONOMY: 8,  STANDARD: 12, FLAGSHIP: 28 },      // 0.8 / 1.2 / 2.8元
  PRO:      { ECONOMY: 5,  STANDARD: 9,  FLAGSHIP: 24 },      // 0.5 / 0.9 / 2.4元（旗舰≥成本×2铁底22积分）
};
/** 锚点：基础会员·经济引擎 100 集 = 100 元 */
export const ANCHOR_PACKAGE = { episodes: 100, points: 1000, yuan: 100, note: '基础会员经济引擎100集=100元锚点' };

/** 会员（单位：分 / 集 / 积分）。quotaMonthly=每月赠送“经济档等价集数”；overagePerEp=经济档单集积分(兼容字段) */
export const MEMBERSHIP = {
  FREE: {
    monthlyFen: 0, freeEpsPerDay: 2, overagePerEp: EP_PRICE.FREE.ECONOMY, quotaMonthly: 0, commission: 0,
    engines: [EngineTier.ECONOMY], label: '免费版', maxActiveProjects: 2,
  },
  BASIC: {
    monthlyFen: 3900, yearlyFen: 36500, quotaMonthly: 0, package100Fen: 10000,
    overagePerEp: EP_PRICE.BASIC.ECONOMY, commission: 15, // 1 元/集（经济档）
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD], label: '基础会员', maxActiveProjects: 10,
  },
  ADVANCED: {
    monthlyFen: 9900, yearlyFen: 99900, quotaMonthly: 300,
    overagePerEp: EP_PRICE.ADVANCED.ECONOMY, commission: 10, // 0.8 元/集，每月赠300集经济档
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: '高级会员', maxActiveProjects: 30,
  },
  PRO: {
    monthlyFen: 29900, yearlyFen: 299900, quotaMonthly: 1000,
    overagePerEp: EP_PRICE.PRO.ECONOMY, commission: 5, // 0.5 元/集，每月赠1000集经济档
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: '专业会员', maxActiveProjects: 100,
  },
} as const;

/** 引擎单集成本估算（分）与说明 */
export const ENGINE = {
  ECONOMY: { costFenPerEp: 12, label: '经济引擎（高性价比多模型组合）' },
  STANDARD: { costFenPerEp: 35, label: '标准引擎（均衡强组合）' },
  FLAGSHIP: { costFenPerEp: 110, label: '旗舰引擎（顶配多模型协同）' },
  // v2.54 海外档：预留不开放购买；EP_PRICE 未列 OVERSEAS → assertMargin 自动拒售。
  // v2.487 启用步骤收紧为三处同改（缺一即被 pricingMatrixErrors / guard-pricing-matrix 拦下）：
  //   ①EP_PRICE 各 MemberLevel 加 OVERSEAS 单价（并满足 ≥成本×2）；②对应 MEMBERSHIP.engines 加 OVERSEAS；
  //   ③从 RESERVED_TIERS 移除。
  OVERSEAS: { costFenPerEp: 200, label: '海外API创作引擎（预留·未开放购买）' },
} as const;

/** 增值服务价目（points=售价积分，costFen=真实采购成本，分）；全部满足 售价≥成本×2
 *  v2.485 只保留「真有收费代码引用」的项：零售单集已由 EP_PRICE 表达（免费档经济 12 积分），
 *  市场价值评估/分镜附录/听剧本均已改为权益内或免费实现，版权存证/存储扩容从无路由实现——
 *  这些价目若留在表里，会被下一轮当成真实现状引用（名实不符），故删除；
 *  新增任何一项前必须同时有收费代码，`scripts/guard-pricing-billing.cjs` 会拦。 */
export const VALUE_ADDED = {
  POSTER_STANDARD: { points: 39, costFen: 40, desc: '标准剧本海报(国产引擎4选1)' },
  POSTER_FLAGSHIP: { points: 199, costFen: 560, desc: '精品海报(旗舰GPT-image引擎4选1)' },
  PK_BATTLE: { points: 20, costFen: 2, desc: '剧本PK一次(小游戏)' },
  XIAONAN_DEEP: { points: 10, costFen: 2, desc: '小南深度共创(每次)' },
  PITCH_MEETING: { points: 20, costFen: 4, desc: '选题会·一轮多角色AI共创评估' },
  TABLE_READ: { points: 30, costFen: 8, desc: '剧本围读·一轮多立场AI围读与修改清单' },
  TEARDOWN_ANALYZE: { points: 30, costFen: 8, desc: '拆爆款·拆解为什么爆+标签池+可取技法' },
  TEARDOWN_OUTLINE: { points: 20, costFen: 6, desc: '拆爆款·生成改编方向与改编大纲' },
  TARGETED_FIX: { points: 15, costFen: 12, desc: '针对一条诊断问题自动定位最差集并重写(单集新版本)' },
  INTERVIEW_TURN: { points: 5, costFen: 2, desc: '采访式创作·一轮追问（素材提炼+下一问）' },
} as const;
export type ValueAddedKey = keyof typeof VALUE_ADDED;

/** 会员等级决定“同时可进行的项目数”上限（企业定制版不限，走单独开通） */
export function activeProjectLimit(level: MemberLevel | string | undefined | null): number {
  const k = (level || MemberLevel.FREE) as MemberLevel;
  return (MEMBERSHIP[k]?.maxActiveProjects as number) ?? MEMBERSHIP.FREE.maxActiveProjects;
}

/** 剧本交易（集市上架）最低档位：免费版只能买不能卖。
 *  v2.483 门控单一事实源——此前 market.ts 硬编码 'FREE'，而 vip 页按 commission=0 渲染出
 *  「交易佣金 0%」权益，用户看到的是「免费档不抽成」，实际点进去直接被 403 拦下（名实不符）。 */
export const MIN_TRADE_LEVEL = MemberLevel.BASIC;
export function canTrade(level: MemberLevel | string | undefined | null): boolean {
  const order = [MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO];
  const i = order.indexOf((level || MemberLevel.FREE) as MemberLevel);
  return i >= order.indexOf(MIN_TRADE_LEVEL); // 未知档位 indexOf=-1 → 拒绝
}

/** 某引擎档位最低开放会员档（v2.489：从 MEMBERSHIP.engines 反查，新增档位不必改这里）。
 *  立项接口与生成接口共用同一口径，避免「能建立项、每一集都 403」的死项目。 */
export function engineMinLevel(tier: EngineTier): MemberLevel {
  const order = [MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO];
  for (const lv of order) if ((MEMBERSHIP[lv].engines as readonly EngineTier[]).includes(tier)) return lv;
  return order[order.length - 1];
}
/** 当前会员档是否可用该引擎档（未知档位一律拒绝） */
export function engineAvailable(tier: EngineTier, level: MemberLevel | string | undefined | null): boolean {
  const lv = (level || MemberLevel.FREE) as MemberLevel;
  return ((MEMBERSHIP[lv]?.engines as readonly EngineTier[]) || []).includes(tier);
}

/** 消耗 token 的增值功能按会员等级差异化定价：等级越高越优惠，但永不跌破“成本×2”铁底 */
export const VA_LEVEL_RATE: Record<MemberLevel, number> = {
  [MemberLevel.FREE]: 1, [MemberLevel.BASIC]: 1, [MemberLevel.ADVANCED]: 0.8, [MemberLevel.PRO]: 0.6,
};
export function vaPointsForLevel(key: ValueAddedKey, level: MemberLevel | string | undefined | null): number {
  const item = VALUE_ADDED[key];
  const lv = (level || MemberLevel.FREE) as MemberLevel;
  const floor = Math.ceil((item.costFen * 2) / FEN_PER_POINT); // 不赔钱下限（积分）
  return Math.max(floor, Math.round(item.points * (VA_LEVEL_RATE[lv] ?? 1)));
}

/** X剧本（第11模式，分级/成人向）：问卷授权后额外开通，独立月费+单集计费，仅在当地法规允许范围内提供 */
export const X_SCRIPT = { monthlyFen: 9900, perEpPoints: 15, gating: '实名问卷+责任承诺+授权后开通', note: '按用户所在法域分级管控，违规内容一律拦截' };

/** 邀请裂变 */
export const INVITE = {
  BOTH_REWARD_POINTS: 30,  // v1.80定稿：注册双方各30积分（=3集经济档，成本约0.36元），只给积分不给现金
  FIRST_PAY_REWARD_PCT: 10,
  PARTNER_COMMISSION_PCT: 10,
  BONUS_GRANT_CAP: 300,
  BONUS_VALID_DAYS: 90,
};

/** 某会员档用某引擎生成一集的积分价（未授权组合返回 0，由 engines 权限在调用前拦截） */
export function episodePoints(level: MemberLevel, tier: EngineTier): number {
  return EP_PRICE[level]?.[tier] ?? 0;
}

/** 定价矩阵一致性（v2.487）：可售引擎与单集价必须双向一一对应。
 *  背景：generate.ts 的门控只查 MEMBERSHIP[level].engines，计费走 episodePoints()（缺价返回 0）。
 *  一旦「授权了某引擎但漏配单价」，用户能选、能跑整条 LLM 流水线、却扣 0 积分——不报错、不红测试，
 *  只在账单上悄悄漏营收；反向「配了价但没授权」则是死价目，会员页会写出用户永远选不到的档位。
 *  纯函数、零 IO，启动自检与守卫脚本共用同一口径。 */
export function pricingMatrixErrors(): string[] {
  const errors: string[] = [];
  const levels = [MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO];
  const allTiers = Object.keys(ENGINE) as EngineTier[];
  const reserved = new Set<EngineTier>(RESERVED_TIERS);
  for (const lv of levels) {
    const engines = MEMBERSHIP[lv].engines as readonly EngineTier[];
    const priced = Object.keys(EP_PRICE[lv] || {}) as EngineTier[];
    for (const tier of engines) {
      if (reserved.has(tier)) errors.push(`${lv}: 预留档 ${tier} 不得出现在 engines（尚未开放售卖）`);
      const pts = EP_PRICE[lv][tier];
      if (pts == null || pts <= 0) errors.push(`${lv}+${tier}: 已授权但无有效单集价（用户可选却算不出价，0 积分白跑）`);
    }
    for (const tier of priced) {
      if (!engines.includes(tier)) errors.push(`${lv}+${tier}: 有单集价但未授权（死价目，用户永远选不到）`);
    }
  }
  for (const tier of allTiers) {
    const soldSomewhere = levels.some((lv) => (MEMBERSHIP[lv].engines as readonly EngineTier[]).includes(tier));
    const pricedSomewhere = levels.some((lv) => EP_PRICE[lv][tier] != null);
    if (reserved.has(tier)) {
      if (soldSomewhere) errors.push(`${tier}: 已列 RESERVED_TIERS 却出现在 MEMBERSHIP.engines`);
      if (pricedSomewhere) errors.push(`${tier}: 已列 RESERVED_TIERS 却出现在 EP_PRICE`);
    } else if (!soldSomewhere) {
      errors.push(`${tier}: 非预留档却没有任何会员可售（整档静默下架/漏配 engines）`);
    }
  }
  return errors;
}

/** 启动自检：任何售卖组合 售价(分) < 成本(分)×2 即拒绝启动 */
export function assertNoLoss(): string[] {
  const errors: string[] = [];
  (Object.keys(VALUE_ADDED) as ValueAddedKey[]).forEach((k) => {
    const it = VALUE_ADDED[k];
    if (it.points * FEN_PER_POINT < it.costFen * 2)
      errors.push(`${k}: 售价${it.points * FEN_PER_POINT}分 < 成本${it.costFen}×2`);
  });
  ([MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO] as MemberLevel[])
    .forEach((lv) => {
      // v2.487 遍历全部 ENGINE 档（不再手抄三档）：新增档位一旦进 EP_PRICE 就会自动纳入铁底检查，
      // 不会因为忘了改这行而绕开「售价≥成本×2」。
      (Object.keys(ENGINE) as EngineTier[])
        .forEach((tier) => {
          const pts = EP_PRICE[lv][tier];
          if (pts == null) return; // 未开放组合
          const priceFen = pts * FEN_PER_POINT;
          const costFen = ENGINE[tier].costFenPerEp;
          if (priceFen < costFen * 2)
            errors.push(`${lv}+${tier}: 单集售价${priceFen}分 < 成本${costFen}×2`);
        });
    });
  return errors;
}


/** 本集收费决策（不赔钱铁律）：每月"赠送集"只能抵扣【经济档】；标准/旗舰必须扣积分，
 *  杜绝用赠送额度去跑高成本多模型组合而倒贴。纯函数、零IO、可离线对拍。 */
export interface ChargeMembership { level: MemberLevel; quotaTotal: number; quotaUsed: number; expireAt?: Date | null; }
export interface EpisodeCharge { useQuota: boolean; points: number; quotaRemainBefore: number; }
export function resolveEpisodeCharge(
  level: MemberLevel, tier: EngineTier, m: ChargeMembership | null | undefined, now: Date = new Date(),
): EpisodeCharge {
  const listPoints = episodePoints(level, tier) ?? 0;
  const remain = m ? Math.max(0, (m.quotaTotal|0) - (m.quotaUsed|0)) : 0;
  const memberValid = !!m && m.level === level && (!m.expireAt || new Date(m.expireAt).getTime() > now.getTime()) && remain > 0;
  // 仅付费会员 + 经济档 + 会员有效 + 有赠送余额 → 消耗1个赠送集、不扣积分；其余（含标准/旗舰）一律走积分
  const useQuota = level !== MemberLevel.FREE && tier === EngineTier.ECONOMY && memberValid;
  return { useQuota, points: useQuota ? 0 : listPoints, quotaRemainBefore: remain };
}

/** 会员「每月赠送集数」的周期长度（天）。与购买时按月叠加的 30 天口径一致。 */
export const MEMBERSHIP_QUOTA_CYCLE_DAYS = 30;
const QUOTA_CYCLE_MS = MEMBERSHIP_QUOTA_CYCLE_DAYS * 864e5;

/**
 * v2.576 月赠送额度周期推进（纯函数、零 IO）：
 * 返回「当前应处的周期起点」——未满一个周期返回 null（不需要重置）。
 * 跨多个周期时对齐到最近一个周期起点（不是 now），避免用户隔了 3 个月才来，
 * 下次再访问又立刻重置一次；同时保留其周期节奏（每 30 天一个自然周期）。
 */
export function nextQuotaCycleStart(anchor: Date, now: Date = new Date()): Date | null {
  const a = new Date(anchor).getTime();
  const n = new Date(now).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(n) || n < a) return null;
  const cycles = Math.floor((n - a) / QUOTA_CYCLE_MS);
  if (cycles < 1) return null;
  return new Date(a + cycles * QUOTA_CYCLE_MS);
}
