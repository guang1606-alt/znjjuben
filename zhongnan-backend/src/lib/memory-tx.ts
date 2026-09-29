/**
 * 内存版 Tx —— 仅用于本地联调/单测，不依赖数据库即可验证计费闭环。
 * 生产替换为 PrismaTx：每个方法放进 prisma.$transaction，lockAccount 用 SELECT ... FOR UPDATE。
 */
import { Tx, LedgerWrite } from './billing';

interface Acc { balance: number; frozen: number; bonusGranted: number }

export class InMemoryTx implements Tx {
  private accs = new Map<string, Acc>();
  private ledgers: (LedgerWrite & { balanceAfter: number })[] = [];
  private quotaUsed = new Map<string, number>();

  seed(userId: string, balance: number) {
    this.accs.set(userId, { balance, frozen: 0, bonusGranted: 0 });
  }

  async getAccount(userId: string) {
    return this.accs.get(userId) ?? { balance: 0, frozen: 0, bonusGranted: 0 };
  }
  async lockAccount(_userId: string) { /* 内存版无需行锁 */ }
  async updateAccount(userId: string, patch: Partial<Acc>) {
    const a = await this.getAccount(userId);
    this.accs.set(userId, { ...a, ...patch });
  }
  async ledgerExists(key: string) {
    return this.ledgers.some((l) => l.idempotencyKey === key);
  }
  async writeLedger(e: LedgerWrite & { balanceAfter: number }) {
    this.ledgers.push(e);
  }
  async takeQuota(membershipId: string, quotaTotal: number) {
    const u = this.quotaUsed.get(membershipId) ?? 0;
    if (u < quotaTotal) { this.quotaUsed.set(membershipId, u + 1); return true; }
    return false;
  }
  async returnQuota(membershipId: string) {
    const u = this.quotaUsed.get(membershipId) ?? 0;
    if (u > 0) this.quotaUsed.set(membershipId, u - 1);
  }
  dump(userId: string) {
    return { account: this.accs.get(userId), ledger: this.ledgers.filter((l) => l.userId === userId) };
  }
}
