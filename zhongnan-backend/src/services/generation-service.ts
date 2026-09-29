/**
 * 剧本生成应用服务（业务用例编排层）
 * 串起：鉴权 → 模式/等级 → 成年授权 → 冻结积分 → 生成 → 质检闸门 → 毛利校验 → 成功结算 / 失败全额退款。
 * 所有外部依赖（仓储/生成器/质检/事务）通过接口注入：离线用内存实现对拍，生产换 Prisma + 真实模型，业务逻辑零改动。
 * 铁律：只要没产出合格剧本，冻结积分必须退回，绝不让用户为失败/不合格买单。
 */
import { Tx, freeze, settle, unfreeze, BillingError } from '../lib/billing';
import { modeAvailable, ModeId } from '../config/modes';
import { MemberLevel, FEN_PER_POINT } from '../config/pricing';
import { assertGatewayMargin } from '../lib/llm-gateway';
import { requiresMatureConsent } from '../lib/auth-policy';

export interface GenUser { id: string; level: MemberLevel; banned: boolean }
export interface GenResult {
  content: string;
  wordCount: number;
  costFen: number;     // 真实采购成本（分）
  tokensIn: number;
  tokensOut: number;
}
export interface QcReport { pass: boolean; errors?: string[] }

export interface GenDeps {
  tx: Tx;
  getUser: (id: string) => Promise<GenUser | null>;
  hasMatureConsent: (id: string, now: number) => Promise<boolean>;
  generator: (req: GenRequest) => Promise<GenResult>;
  qc: (content: string, req: GenRequest) => QcReport;
  now?: number;
}
export interface GenRequest {
  userId: string;
  modeId: ModeId;
  chargePoints: number;   // 调用方已按免费额度/会员价算好的应收积分
  idem: string;           // 业务幂等键（同一任务固定）
  [k: string]: unknown;
}
export type GenErrorCode =
  | 'USER_NOT_FOUND' | 'USER_BANNED' | 'MODE_LOCKED' | 'MATURE_CONSENT_REQUIRED'
  | 'INSUFFICIENT' | 'GEN_FAILED' | 'QC_FAILED' | 'NO_MARGIN';
export class GenError extends Error { constructor(public code: GenErrorCode, msg: string) { super(msg); } }

export interface GenOk { ok: true; content: string; pointsCharged: number; costFen: number; qc: QcReport }
export interface GenFail { ok: false; code: GenErrorCode; refundedPoints: number }

export async function runGeneration(deps: GenDeps, req: GenRequest): Promise<GenOk | GenFail> {
  const now = deps.now ?? Date.now();
  const fail = (code: GenErrorCode, refunded = 0): GenFail => ({ ok: false, code, refundedPoints: refunded });

  // 1 鉴权
  const user = await deps.getUser(req.userId);
  if (!user) return fail('USER_NOT_FOUND');
  if (user.banned) return fail('USER_BANNED');

  // 2 模式/等级权限
  if (!modeAvailable(req.modeId, user.level)) return fail('MODE_LOCKED');

  // 3 成年向授权
  if (requiresMatureConsent(req.modeId) && !(await deps.hasMatureConsent(user.id, now))) {
    return fail('MATURE_CONSENT_REQUIRED');
  }

  const points = Math.max(0, Math.floor(req.chargePoints));
  const priceFen = points * FEN_PER_POINT;
  const taskRef = req.idem;

  // 4 冻结（积分不足直接拒，不进入生成）
  try {
    await freeze(deps.tx, user.id, points, taskRef, `${req.idem}:freeze`);
  } catch (e) {
    if (e instanceof BillingError && e.code === 'INSUFFICIENT') return fail('INSUFFICIENT');
    throw e;
  }

  // 5 生成 + 6 质检 + 毛利；任何一步失败都全额退款
  try {
    const gen = await deps.generator(req);
    const qc = deps.qc(gen.content, req);
    if (!qc.pass) throw new GenError('QC_FAILED', qc.errors?.join('；') || '质检未过');
    // 售价必须覆盖成本×2，否则熔断并退款（不做亏本生意）
    assertGatewayMargin(priceFen, gen.costFen);

    await settle(deps.tx, user.id, points, taskRef, `${req.idem}:settle`);
    return { ok: true, content: gen.content, pointsCharged: points, costFen: gen.costFen, qc };
  } catch (e) {
    await unfreeze(deps.tx, user.id, points, taskRef, `${req.idem}:refund`);
    if (e instanceof GenError) return fail(e.code, points);
    if (e instanceof Error && e.message.startsWith('GATEWAY_MARGIN_BREACH')) return fail('NO_MARGIN', points);
    return fail('GEN_FAILED', points);
  }
}
