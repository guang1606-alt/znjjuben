/**
 * LLM 网关决策逻辑（纯函数、可离线对拍）
 * model-proxy 负责真实 HTTP；本模块把“成本核算 / 重试 / 主备降级 / 对用户脱敏 / 成本台账 /
 * 毛利双保险”这些不依赖网络的决策抽出来，用测试锁死，真实 Key 接入即稳。
 * 用户永远只见“引擎档位 + 七岗进度”，不见供应商/模型名/密钥/baseUrl（PRD：用户不知道由哪些API组成）。
 */

export type EngineTier = 'economy' | 'standard' | 'flagship';

/** 单次调用成本（分）。in/out 为 token 数，单价为元/百万token */
export function computeModelCostFen(
  tokensIn: number, tokensOut: number, inYuanPerMTok: number, outYuanPerMTok: number,
): number {
  const yuan = (tokensIn / 1e6) * inYuanPerMTok + (tokensOut / 1e6) * outYuanPerMTok;
  return Math.ceil(yuan * 100);
}

/** 可注入 sleep 的重试：失败重试 times 次（总调用 times+1），全失败抛最后一次错误 */
export async function retryWith<T>(
  fn: (attempt: number) => Promise<T>, times: number, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ value: T; attempts: number }> {
  let last: unknown;
  for (let i = 0; i <= times; i++) {
    try { return { value: await fn(i), attempts: i + 1 }; }
    catch (e) {
      last = e;
      if (i < times) await sleep(10 * (i + 1));
    }
  }
  throw last;
}

export interface ProviderHealth { name: string; healthy: boolean }
/** 主备降级：按优先级返回第一个健康 provider；都不健康则抛错，禁止带病放行 */
export function selectProvider(ordered: ProviderHealth[]): ProviderHealth {
  const pick = ordered.find((p) => p.healthy);
  if (!pick) throw new Error('ALL_PROVIDER_DOWN 主备模型均不可用');
  return pick;
}

const SENSITIVE_KEYS = ['model', 'provider', 'baseUrl', 'apiKey', 'key', 'secret', 'endpoint', 'deployment'];
/** 对用户/前端脱敏：剥离任何能推断出具体模型供应方的字段 */
export function redactForClient<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase() === s.toLowerCase())) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? redactForClient(v) : v;
  }
  return out as T;
}

/** 多岗位成本台账：逐岗累加 token 与成本（分），供订单/毛利核算 */
export class CostLedger {
  totalTokensIn = 0;
  totalTokensOut = 0;
  totalCostFen = 0;
  byRole: Record<string, { tokensIn: number; tokensOut: number; costFen: number; calls: number }> = {};
  add(role: string, tokensIn: number, tokensOut: number, inYuan: number, outYuan: number) {
    const costFen = computeModelCostFen(tokensIn, tokensOut, inYuan, outYuan);
    this.totalTokensIn += tokensIn;
    this.totalTokensOut += tokensOut;
    this.totalCostFen += costFen;
    const cur = this.byRole[role] || { tokensIn: 0, tokensOut: 0, costFen: 0, calls: 0 };
    cur.tokensIn += tokensIn; cur.tokensOut += tokensOut; cur.costFen += costFen; cur.calls += 1;
    this.byRole[role] = cur;
    return costFen;
  }
  snapshot() {
    return {
      totalTokensIn: this.totalTokensIn, totalTokensOut: this.totalTokensOut,
      totalCostFen: this.totalCostFen, byRole: JSON.parse(JSON.stringify(this.byRole)),
    };
  }
}

/** 网关侧毛利双保险：向用户售价（分）必须 ≥ 成本×2，否则熔断（与 billing 层互为冗余） */
export function assertGatewayMargin(priceFen: number, costFen: number) {
  if (priceFen < costFen * 2) throw new Error(`GATEWAY_MARGIN_BREACH 售价${priceFen}分 < 成本${costFen}分×2`);
}
