/**
 * 计费引擎 —— 全站积分/余额唯一入口
 * 关键设计：
 *  - 生成类消费走“先冻结 → 成功实扣 / 失败解冻”，绝不出现做了不扣或扣了没做
 *  - 每笔流水带幂等键，重试/网络抖动不会重复扣
 *  - 赠送积分累计超 BONUS_GRANT_CAP 即拒，保证获客补贴不超支
 *  - 数据库操作通过 Tx 接口注入，便于单测与替换 ORM
 */
import {
  FEN_PER_POINT,
  INVITE,
  VALUE_ADDED,
  ValueAddedKey,
} from '../config/pricing';

/** 流水方向与桶 */
export type Direction = 'IN' | 'OUT' | 'FROZEN' | 'UNFROZEN';
export type Bucket = 'RECHARGE' | 'BONUS' | 'COMMISSION';

export interface LedgerWrite {
  userId: string;
  direction: Direction;
  bucket: Bucket;
  amount: number;
  reason: string;
  refType?: string;
  refId?: string;
  idempotencyKey: string;
  expireAt?: Date | null;
}

/** 事务抽象：实现方用 Prisma $transaction 保证原子性 */
export interface Tx {
  getAccount(userId: string): Promise<{ balance: number; frozen: number; bonusGranted: number } | null>;
  lockAccount(userId: string): Promise<void>;
  updateAccount(userId: string, patch: Partial<{ balance: number; frozen: number; bonusGranted: number }>): Promise<void>;
  ledgerExists(idempotencyKey: string): Promise<boolean>;
  writeLedger(e: LedgerWrite & { balanceAfter: number }): Promise<void>;
  /** 原子占用1个每月赠送集（条件 quotaUsed<quotaTotal，防并发超发）；占用成功返回 true */
  takeQuota(membershipId: string, quotaTotal: number): Promise<boolean>;
  /** 退还1个已占用赠送集（生成失败时，条件 decrement 防减成负数） */
  returnQuota(membershipId: string): Promise<void>;
  /**
   * 同事务底层客户端（生产为 Prisma TransactionClient，内存桩为其 tx 对象）。
   * 仅用于必须与资金同事务提交的多表写入（如扣款同时建托管单、翻转订单状态）。
   * 单测用 InMemoryTx 不提供该句柄。
   */
  readonly raw?: unknown;
}

export class BillingError extends Error {
  constructor(public code: 'INSUFFICIENT' | 'BONUS_CAP' | 'IDEMPOTENT' | 'NO_LOSS' | 'NO_CHARGE', msg: string) {
    super(msg);
  }
}

/** 冻结积分（生成任务开始时） */
export async function freeze(tx: Tx, userId: string, points: number, refId: string, key: string) {
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(key)) return; // 幂等
  const acc = await tx.getAccount(userId);
  if (!acc || acc.balance < points) throw new BillingError('INSUFFICIENT', '积分不足');
  await tx.updateAccount(userId, { balance: acc.balance - points, frozen: acc.frozen + points });
  await tx.writeLedger({
    userId, direction: 'FROZEN', bucket: 'RECHARGE', amount: points,
    reason: 'FREEZE', refType: 'task', refId, idempotencyKey: key,
    balanceAfter: acc.balance - points,
  });
}

/** 实扣冻结额（任务成功） */
export async function settle(tx: Tx, userId: string, points: number, refId: string, key: string) {
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(key)) return;
  const acc = await tx.getAccount(userId);
  if (!acc || acc.frozen < points) throw new BillingError('INSUFFICIENT', '冻结额不足');
  await tx.updateAccount(userId, { frozen: acc.frozen - points });
  await tx.writeLedger({
    userId, direction: 'OUT', bucket: 'RECHARGE', amount: points,
    reason: 'CONSUME', refType: 'task', refId, idempotencyKey: key, balanceAfter: acc.balance,
  });
}

/** 解冻退回（任务失败）。必须有对应冻结额，防止错序/重复调用凭空加钱 */
export async function unfreeze(tx: Tx, userId: string, points: number, refId: string, key: string) {
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(key)) return;
  const acc = await tx.getAccount(userId);
  if (!acc) return;
  // 与 settle 对称：冻结额不足说明原冻结不存在或已结算，严禁无条件 balance+points（否则凭空造钱）
  if (acc.frozen < points) throw new BillingError('NO_LOSS', '冻结额不足，无法解冻');
  await tx.updateAccount(userId, { balance: acc.balance + points, frozen: acc.frozen - points });
  await tx.writeLedger({
    userId, direction: 'UNFROZEN', bucket: 'RECHARGE', amount: points,
    reason: 'REFUND', refType: 'task', refId, idempotencyKey: key, balanceAfter: acc.balance + points,
  });
}

/** 直接消费增值服务（海报/PK/小南等），价格由服务端 key 决定，前端只传 key。
 * 返回 true=本次真实扣款；false=幂等命中（同键已扣过，调用方必须短路，不得再提供服务） */
export async function consumeValueAdded(
  tx: Tx, userId: string, key: ValueAddedKey, refId: string, idem: string,
): Promise<boolean> {
  const item = VALUE_ADDED[key];
  const priceFen = item.points * FEN_PER_POINT;
  // 不赔钱硬校验（双保险，启动时也会校验一次）
  if (priceFen < item.costFen * 2) {
    throw new BillingError('NO_LOSS', `${key} 售价低于成本2倍，已熔断`);
  }
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(idem)) return false;
  const acc = await tx.getAccount(userId);
  if (!acc || acc.balance < item.points) throw new BillingError('INSUFFICIENT', '积分不足');
  await tx.updateAccount(userId, { balance: acc.balance - item.points });
  await tx.writeLedger({
    userId, direction: 'OUT', bucket: 'RECHARGE', amount: item.points,
    reason: key, refType: 'value_added', refId, idempotencyKey: idem, balanceAfter: acc.balance - item.points,
  });
  return true;
}

/**
 * 增值服务失败退款（幂等回补）。
 * 与 consumeValueAdded 配对：传入与扣款相同的 idem，本函数内部自管退款键 refund:${idem}。
 * 安全铁律：①原扣款流水不存在绝不退款（防重放/错序凭空造钱）；②退款键已存在幂等返回。
 */
export async function refundValueAdded(
  tx: Tx, userId: string, key: ValueAddedKey, refId: string, idem: string,
): Promise<void> {
  const refundKey = `refund:${idem}`;
  const item = VALUE_ADDED[key];
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(refundKey)) return; // 已退过，幂等返回
  if (!(await tx.ledgerExists(idem))) {
    throw new BillingError('NO_CHARGE', `未找到 ${key} 的原扣款流水，拒绝退款`);
  }
  const acc = await tx.getAccount(userId);
  if (!acc) return;
  await tx.updateAccount(userId, { balance: acc.balance + item.points });
  await tx.writeLedger({
    userId, direction: 'IN', bucket: 'RECHARGE', amount: item.points,
    reason: `${key}:REFUND`, refType: 'value_added', refId, idempotencyKey: refundKey,
    balanceAfter: acc.balance + item.points,
  });
}
/** 赠送积分（签到/任务/邀请奖励）—— 受累计上限约束，保证补贴不赔钱 */
/**
 * 按“指定积分数”灵活扣费（用于按会员等级差异化定价的 token 类增值功能，如拆爆款）。
 * 同样锁死不赔钱：售价积分(×FEN_PER_POINT) ≥ 真实成本×2，否则熔断。幂等。
 */
export async function consumeFlexible(
  tx: Tx, userId: string, points: number, costFen: number, reason: string, refId: string, idem: string,
): Promise<boolean> {
  const priceFen = points * FEN_PER_POINT;
  if (priceFen < costFen * 2) throw new BillingError('NO_LOSS', `${reason} 售价低于成本2倍，已熔断`);
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(idem)) return false;
  const acc = await tx.getAccount(userId);
  if (!acc || acc.balance < points) throw new BillingError('INSUFFICIENT', '积分不足');
  await tx.updateAccount(userId, { balance: acc.balance - points });
  await tx.writeLedger({
    userId, direction: 'OUT', bucket: 'RECHARGE', amount: points,
    reason, refType: 'value_added', refId, idempotencyKey: idem, balanceAfter: acc.balance - points,
  });
  return true;
}
/**
 * 灵活扣费的失败退款，与 consumeFlexible 配对。
 * 传入与扣款相同的 idem，退款键内部固定为 refund:${idem}；
 * 原扣款流水不存在则拒绝退款（防 /fix 重放类套利：未扣分的请求不得退分）。
 */
export async function refundFlexible(tx: Tx, userId: string, points: number, reason: string, refId: string, idem: string) {
  const refundKey = `refund:${idem}`;
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(refundKey)) return;
  if (!(await tx.ledgerExists(idem))) {
    throw new BillingError('NO_CHARGE', `未找到 ${reason} 的原扣款流水，拒绝退款`);
  }
  const acc = await tx.getAccount(userId);
  if (!acc) return;
  await tx.updateAccount(userId, { balance: acc.balance + points });
  await tx.writeLedger({
    userId, direction: 'IN', bucket: 'RECHARGE', amount: points,
    reason: `${reason}:REFUND`, refType: 'value_added', refId, idempotencyKey: refundKey, balanceAfter: acc.balance + points,
  });
}
export async function grantBonus(tx: Tx, userId: string, points: number, reason: string, idem: string) {
  await tx.lockAccount(userId);
  if (await tx.ledgerExists(idem)) return;
  const acc = await tx.getAccount(userId);
  if (!acc) return;
  if (acc.bonusGranted + points > INVITE.BONUS_GRANT_CAP) {
    throw new BillingError('BONUS_CAP', `赠送上限${INVITE.BONUS_GRANT_CAP}分，需付费/邀请解锁`);
  }
  await tx.updateAccount(userId, {
    balance: acc.balance + points, bonusGranted: acc.bonusGranted + points,
  });
  const expire = new Date(Date.now() + INVITE.BONUS_VALID_DAYS * 864e5);
  await tx.writeLedger({
    userId, direction: 'IN', bucket: 'BONUS', amount: points, reason,
    idempotencyKey: idem, balanceAfter: acc.balance + points, expireAt: expire,
  });
}
