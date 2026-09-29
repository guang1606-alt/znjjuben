/**
 * 有限存储空间（用户最新需求）
 *  - 空间有限：按会员等级给基础配额，可自行删除内容释放，也可用积分充值扩容（创收）
 *  - 配额 = 等级基础额度 + 累计购买的扩容包；上传/生成前校验，超限拒绝并引导升级/扩容
 */
import { MemberLevel } from '../config/pricing';

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const BASE_QUOTA_BYTES: Record<MemberLevel, number> = {
  [MemberLevel.FREE]: 100 * MB,
  [MemberLevel.BASIC]: 500 * MB,
  [MemberLevel.ADVANCED]: 2 * GB,
  [MemberLevel.PRO]: 10 * GB,
};

// 扩容包（积分定价；存储边际成本极低，定价覆盖成本且盈利）
export const STORAGE_PACKS = [
  { id: 'pack_5g', gb: 5, points: 199 },
  { id: 'pack_20g', gb: 20, points: 599 },
  { id: 'pack_100g', gb: 100, points: 1999 },
] as const;

export function quotaBytes(level: MemberLevel, extraBytes = 0): number {
  return (BASE_QUOTA_BYTES[level] ?? BASE_QUOTA_BYTES[MemberLevel.FREE]) + extraBytes;
}

export interface StoreCheck {
  ok: boolean;
  quota: number;
  used: number;
  after: number;
  free: number;
  reason?: string;
}

export function canStore(
  level: MemberLevel, usedBytes: number, addBytes: number, extraBytes = 0,
): StoreCheck {
  const quota = quotaBytes(level, extraBytes);
  const after = usedBytes + addBytes;
  return {
    ok: after <= quota,
    quota, used: usedBytes, after, free: Math.max(0, quota - usedBytes),
    reason: after > quota ? '存储空间不足，请删除内容、升级会员或购买扩容包' : undefined,
  };
}

export function usagePercent(usedBytes: number, quota: number): number {
  if (quota <= 0) return 100;
  return Math.min(100, Math.round((usedBytes / quota) * 100));
}

export function humanBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1)}GB`;
  if (n >= MB) return `${Math.round(n / MB)}MB`;
  return `${Math.max(0, Math.round(n / 1024))}KB`;
}
