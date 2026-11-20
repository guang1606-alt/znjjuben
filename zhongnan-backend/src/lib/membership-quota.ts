/**
 * v2.576 会员「每月赠送集数」惰性周期重置。
 *
 * 背景：购买/续费时只把 quotaUsed 清零一次，年卡用户（12 个月）在第一个月用完后，
 * 第 2~12 个月再也没有赠送集——会员页写的「每月赠 N 集」与实际不符。
 *
 * 方案：不引入定时任务（多实例/无状态部署下不可靠），在真正消费额度的入口惰性检查：
 * 距本周期起点满 30 天即把 quotaUsed 清零并把周期起点推进到最近的周期边界。
 * 写入用「读到的 quotaUsed + quotaCycleStart」做条件原子更新：
 *  - 并发下另一次请求已占用赠送集（quotaUsed 变了）→ 本次不重置，回读最新行按最新额度计费，
 *    宁可少送一集也绝不把已占用的那一集清零后重复送（防超发）；
 *  - 旧数据无 quotaCycleStart 时回退 startedAt/createdAt，升级后老会员也能拿到后续周期额度。
 */
import { nextQuotaCycleStart } from '../config/pricing';

export interface MembershipQuotaRow {
  id: string;
  quotaTotal?: number | null;
  quotaUsed?: number | null;
  quotaCycleStart?: Date | string | null;
  startedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

function asDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 当前周期剩余的赠送集（只读展示用） */
export function quotaRemainOf(m: MembershipQuotaRow | null | undefined): number {
  if (!m) return 0;
  return Math.max(0, (Number(m.quotaTotal) || 0) - (Number(m.quotaUsed) || 0));
}

/**
 * 若已跨周期则重置 quotaUsed。返回「可用于本次计费」的会员行（可能是重置后的新值或回读的最新行）。
 * db 接受 PrismaClient 或测试内存桩（只需 membership.updateMany / findUnique）。
 */
export async function ensureQuotaCycle<T>(
  db: any, m: T | null | undefined, now: Date = new Date(),
): Promise<T | null | undefined> {
  if (!m) return m;
  const row = m as unknown as MembershipQuotaRow;
  const anchor = asDate(row.quotaCycleStart) ?? asDate(row.startedAt) ?? asDate(row.createdAt);
  if (!anchor) return m;
  const cycleStart = nextQuotaCycleStart(anchor, now);
  if (!cycleStart) return m;
  const usedBefore = Number(row.quotaUsed) || 0;
  const rawStart = row.quotaCycleStart ?? null;
  const r = await db.membership.updateMany({
    where: { id: row.id, quotaUsed: usedBefore, quotaCycleStart: rawStart },
    data: { quotaUsed: 0, quotaCycleStart: cycleStart },
  });
  if (r && r.count > 0) return { ...(m as any), quotaUsed: 0, quotaCycleStart: cycleStart } as T;
  // 并发改变（别处已占用/已重置）：回读最新行，按最新额度计费，不做无条件覆盖
  const fresh = await db.membership.findUnique({ where: { id: row.id } });
  return (fresh as T | null) ?? m;
}
