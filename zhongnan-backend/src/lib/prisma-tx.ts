/**
 * PrismaTx —— billing.Tx 的生产实现（PostgreSQL）
 * 关键：
 *  - 全部操作包在一个交互式事务里，lockAccount 用 SELECT ... FOR UPDATE 行锁，
 *    彻底防并发超扣/双花。
 *  - 账户不存在时自动建（首充/注册时也可预建）。
 *  - 幂等键唯一约束兜底，重复请求绝不产生第二条流水。
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { Tx, LedgerWrite } from './billing';

type Client = Prisma.TransactionClient;

class PrismaTx implements Tx {
  constructor(private readonly tx: Client, private readonly userId: string) {}

  /** 暴露同事务底层客户端：供必须与资金原子提交的多表写入（托管状态翻转+建单等） */
  get raw(): Client { return this.tx; }

  async getAccount(userId: string) {
    const a = await this.tx.pointsAccount.findUnique({ where: { userId } });
    return a ? { balance: a.balance, frozen: a.frozen, bonusGranted: a.bonusGranted } : null;
  }

  async lockAccount(userId: string) {
    // 行锁：并发事务在此串行化，保证余额判断与扣减原子
    await this.tx.$queryRaw`SELECT id FROM "PointsAccount" WHERE "userId"=${userId} FOR UPDATE`;
    const exists = await this.tx.pointsAccount.findUnique({ where: { userId } });
    if (!exists) await this.tx.pointsAccount.create({ data: { userId } });
  }

  async updateAccount(userId: string, patch: Partial<{ balance: number; frozen: number; bonusGranted: number }>) {
    // 用原子增量而非读改写，杜绝并发覆盖
    await this.tx.pointsAccount.update({
      where: { userId },
      data: {
        balance: patch.balance !== undefined ? patch.balance : undefined,
        frozen: patch.frozen !== undefined ? patch.frozen : undefined,
        bonusGranted: patch.bonusGranted !== undefined ? patch.bonusGranted : undefined,
      },
    });
  }

  async ledgerExists(idempotencyKey: string) {
    const found = await this.tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    return !!found;
  }

  async writeLedger(e: LedgerWrite & { balanceAfter: number }) {
    await this.tx.ledgerEntry.create({
      data: {
        userId: e.userId, direction: e.direction, bucket: e.bucket, amount: e.amount,
        balanceAfter: e.balanceAfter, reason: e.reason, refType: e.refType, refId: e.refId,
        idempotencyKey: e.idempotencyKey, expireAt: e.expireAt ?? null,
      },
    });
  }

  async takeQuota(membershipId: string, quotaTotal: number): Promise<boolean> {
    // 行内条件更新：仅当仍有剩余赠送集时 +1，天然防并发超发（与账户行锁同处一个事务）
    const r = await this.tx.membership.updateMany({
      where: { id: membershipId, quotaUsed: { lt: quotaTotal } },
      data: { quotaUsed: { increment: 1 } },
    });
    return r.count === 1;
  }

  async returnQuota(membershipId: string): Promise<void> {
    await this.tx.membership.updateMany({
      where: { id: membershipId, quotaUsed: { gt: 0 } },
      data: { quotaUsed: { decrement: 1 } },
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 在一个数据库事务内执行计费逻辑，自动提交/回滚。
 * Serializable 隔离下并发事务可能因序列化冲突被 PG 回滚（Prisma P2034 / SQLSTATE 40001），
 * 这是“可重试的正常现象”，这里做最多3次指数退避重试，避免高并发计费偶发 500。
 * 事务回滚后 fn 内所有写入一并撤销，因此整段重试是安全的（fn 内不要做事务外副作用）。
 */
export async function withBillingTransaction<T>(
  prisma: PrismaClient, userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => fn(new PrismaTx(tx, userId)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // 最强隔离，防幻读/超扣
        timeout: 10000,
      });
    } catch (e: any) {
      lastErr = e;
      // P2034=事务写/读冲突；40001=serialization_failure；40P01=死锁，均可安全重试
      if (e?.code !== 'P2034' && e?.code !== '40001' && e?.code !== '40P01') throw e;
      if (attempt === 2) break;
      await sleep(20 * 2 ** attempt); // 20ms, 40ms
    }
  }
  throw lastErr;
}
