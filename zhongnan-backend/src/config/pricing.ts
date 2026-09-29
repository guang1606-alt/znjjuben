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
  // 启用时只需在 EP_PRICE 各 MemberLevel 加 OVERSEAS 列 + MEMBERSHIP.engines 加 OVERSEAS 即可
  OVERSEAS: { costFenPerEp: 200, label: '海外API创作引擎（预留·未开放购买）' },
} as const;

/** 增值服务价目（points=售价积分，costFen=真实采购成本，分）；全部满足 售价≥成本×2 */
export const VALUE_ADDED = {
  SCRIPT_EP_ECONOMY: { points: 20, costFen: 12, desc: '生成1集·经济引擎(零售)' },
  POSTER_STANDARD: { points: 39, costFen: 40, desc: '标准剧本海报(国产引擎4选1)' },
  POSTER_FLAGSHIP: { points: 199, costFen: 560, desc: '精品海报(旗舰GPT-image引擎4选1)' },
  SHARE_POSTER: { points: 12, costFen: 10, desc: '分享海报(梗概,1张)' },
  PK_BATTLE: { points: 20, costFen: 2, desc: '剧本PK一次(小游戏)' },
  XIAONAN_DEEP: { points: 10, costFen: 2, desc: '小南深度共创(每次)' },
  EVAL_REPORT: { points: 590, costFen: 30, desc: '市场价值深度评估' },
  AI_POLISH: { points: 990, costFen: 200, desc: 'AI精修去AI化(按本)' },
  STORYBOARD: { points: 690, costFen: 100, desc: '分镜工单转换' },
  COPYRIGHT: { points: 490, costFen: 1500, desc: '区块链版权存证(第三方成本高)' },
  STORAGE_10G: { points: 50, costFen: 12, desc: '存储空间扩容10G/月' },
  LISTEN_SCRIPT: { points: 39, costFen: 13, desc: '听剧本TTS(按本,高级会员含额度)' },
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

/** 某会员档用某引擎生成一集的积分价（未授权组合返回0，由 engines 权限在调用前拦截） */
export function episodePoints(level: MemberLevel, tier: EngineTier): number {
  return EP_PRICE[level]?.[tier] ?? 0;
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
      ([EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP] as EngineTier[])
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
