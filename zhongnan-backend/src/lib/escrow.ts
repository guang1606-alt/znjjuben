/**
 * 担保交易托管结算（PRD 7.3 平台担保交易）
 *  - 买家付款后货款托管 24h；买家主动确认 或 托管到期 → 自动放款给卖家
 *  - 路由与定时任务共用 settlePurchase，保证“手动确认 / 自动放款”同一套幂等逻辑
 */
import { prisma } from './prisma';
import { withBillingTransaction } from './prisma-tx';

export const ESCROW_WINDOW_MS = 24 * 3600 * 1000;

type PurchaseLike = { id: string; status: string; createdAt: Date };
/** 是否仍在24h退款窗口内 */
export function withinRefund(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs >= 0 && nowMs - createdAtMs <= ESCROW_WINDOW_MS;
}
/** 托管是否已到期（超过24h），到期应自动放款 */
export function isEscrowDue(p: PurchaseLike, nowMs = Date.now()): boolean {
  return p.status === 'ESCROW' && nowMs - p.createdAt.getTime() > ESCROW_WINDOW_MS;
}

/**
 * 对一笔托管订单放款：卖家加税后款、订单完结、商品售出。
 * 并发安全（v2.78.1 修复双赔）：
 *  退款与放款此前锁不同账户、幂等键不同，Serializable 不互斥，确认与退款并发可双赔。
 *  现在“状态翻转”本身作为抢占锁：事务内条件 updateMany ESCROW→SETTLING，
 *  只有一个并发事务 count===1；抢占失败立即短路。卖家加款/置 SETTLED/置 SOLD 全部同事务提交。
 *  退款侧（market.ts）对称使用 ESCROW→REFUNDED 抢占，两个方向只有一个能赢。
 * 幂等：SETTLING/SETTLED 状态下重复调用返回 null。
 */
export async function settlePurchase(p: {
  id: string; buyerId: string; sellerId: string; listingId: string;
  status: string; sellerGainPoints: number; commissionPoints: number;
}, db: any = prisma) {
  if (p.status !== 'ESCROW') return null;
  const idem = `settle:${p.id}`;
  const gain = await withBillingTransaction(db, p.sellerId, async (tx) => {
    const raw = tx.raw as any;
    // 1) 状态抢占：仅当前仍为 ESCROW 才能翻成 SETTLING（行条件更新，并发唯一胜者）
    const claimed = await raw.purchase.updateMany({
      where: { id: p.id, status: 'ESCROW' }, data: { status: 'SETTLING' },
    });
    if (!claimed || claimed.count === 0) return null; // 已被退款抢占或已结算
    // 2) 卖家加款（抢占成功保证只执行一次）
    await tx.lockAccount(p.sellerId);
    const acc = await tx.getAccount(p.sellerId);
    const base = acc?.balance ?? 0;
    await tx.updateAccount(p.sellerId, { balance: base + p.sellerGainPoints });
    await tx.writeLedger({
      userId: p.sellerId, direction: 'IN', bucket: 'COMMISSION', amount: p.sellerGainPoints,
      reason: 'SCRIPT_SALE', refType: 'listing', refId: p.listingId,
      idempotencyKey: idem, balanceAfter: base + p.sellerGainPoints,
    });
    // 3) 同事务落终态：订单 SETTLED + 商品 SOLD
    await raw.purchase.update({ where: { id: p.id }, data: { status: 'SETTLED' } });
    await raw.listing.updateMany({ where: { id: p.listingId, status: 'ESCROW' }, data: { status: 'SOLD' } });
    return { sellerGainPoints: p.sellerGainPoints, platformCommission: p.commissionPoints };
  });
  return gain ?? null;
}

/** 定时任务：把所有托管到期订单批量放款，返回放款笔数 */
export async function settleDueEscrows(nowMs = Date.now(), db: any = prisma): Promise<number> {
  const due = await db.purchase.findMany({
    where: { status: 'ESCROW', createdAt: { lt: new Date(nowMs - ESCROW_WINDOW_MS) } },
  });
  let n = 0;
  for (const p of due) {
    try {
      if (await settlePurchase(p, db)) n++;
    } catch (e) {
      // 单笔失败不阻断整批，等下一轮重试（幂等）
      console.error('[escrow] settle failed', p.id, (e as Error).message);
    }
  }
  return n;
}
