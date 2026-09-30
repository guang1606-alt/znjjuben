/**
 * staff-billing.ts —— 内部账户（超管手机号硬命中 + 杨光指定的副管理员）0 元计费通道
 * ------------------------------------------------------------------
 * 设计口径（与 generate.ts /episodes、/fix 完全一致）：
 *  · 身份短路只依赖 User.phone/isAdmin（middleware/admin.isAdminUser），不查余额、不依赖
 *    Membership 赠送额度、不做写库充值兜底——内部账户可以没有 PointsAccount；
 *  · 不向用户收费（amount=0），但写 LedgerEntry 审计流水（STAFF_FREE / STAFF_FREE:REFUND 配对），
 *    真实模型成本仍由 ModelCallLog 正常入账观测（priceFen=0、costFen 照常）；
 *  · 幂等计数与付费路径同构：同 refId 下 OUT 数 > REFUND 数即"进行中/已完成"→ 409；
 *    下游失败写 0 元 REFUND 后，同 refId 允许以 aN+1 再次尝试。
 */
import { isAdminUser } from '../middleware/admin';

/** 内部账户判定（与各路由 isStaff 同源）；prisma 可注入内存测试桩 */
export async function staffOf(prisma: any, userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, isAdmin: true },
  });
  return isAdminUser(u as { phone?: string | null; isAdmin?: boolean } | null);
}

/**
 * 0 元扣费（必须在 withBillingTransaction 事务内调用）。
 * @param idemPrefix 业务前缀，如 'staff-va' / 'staff-td' / 'staff-room' / 'staff-iv'
 * @returns charged=false 表示幂等撞车（调用方返 409，不得再服务/退款）
 */
export async function staffChargeTx(tx: any, userId: string, refId: string, idemPrefix: string): Promise<{ charged: boolean; idem: string }> {
  const raw = tx.raw as any;
  const charges = await raw.ledgerEntry.findMany({ where: { userId, reason: 'STAFF_FREE', refType: 'value_added', refId } });
  const refunds = await raw.ledgerEntry.findMany({ where: { userId, reason: 'STAFF_FREE:REFUND', refType: 'value_added', refId } });
  if (charges.length > refunds.length) return { charged: false, idem: '' };
  const idem = `${idemPrefix}:${refId}:a${charges.length + 1}`;
  if (await tx.ledgerExists(idem)) return { charged: false, idem: '' };
  const acc = await tx.getAccount(userId).catch(() => null);
  await tx.writeLedger({
    userId, direction: 'OUT', bucket: 'RECHARGE', amount: 0,
    reason: 'STAFF_FREE', refType: 'value_added', refId,
    idempotencyKey: idem, balanceAfter: acc?.balance ?? 0,
  });
  return { charged: true, idem };
}

/** 0 元退款（必须在 withBillingTransaction 事务内调用）：只写配对 IN 流水，不回补余额 */
export async function staffRefundTx(tx: any, userId: string, refId: string, idem: string): Promise<void> {
  const refundKey = `refund:${idem}`;
  if (await tx.ledgerExists(refundKey)) return;
  const acc = await tx.getAccount(userId).catch(() => null);
  await tx.writeLedger({
    userId, direction: 'IN', bucket: 'RECHARGE', amount: 0,
    reason: 'STAFF_FREE:REFUND', refType: 'value_added', refId,
    idempotencyKey: refundKey, balanceAfter: acc?.balance ?? 0,
  });
}
