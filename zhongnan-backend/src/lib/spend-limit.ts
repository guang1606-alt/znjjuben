/**
 * 测试期模型消费硬限额：调用前预留、成功按实际成本结算、失败释放。
 * 总额与每个 API Key 分账；Key 只存 SHA-256 身份，不落明文。总阀开启后台账不可用时 fail-closed。
 */
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { loadSpendLimit } from './model-config';
import { logInternal } from './http-errors';

interface SpendControl { prisma: any; enabled: boolean; totalLimitYuan: number }
let __controlForTest: SpendControl | null = null;
export function __setSpendControlForTest(c: SpendControl | null): void { __controlForTest = c; }

export interface SpendReservation {
  prisma: any;
  reserveFen: number;
  keyId: string | null;
}

function fen(yuan: number): number {
  return Math.max(0, Math.ceil((Number.isFinite(yuan) ? yuan : 0) * 100 - 1e-9));
}
function keyId(apiKey: string): string {
  // v2.566 去首尾空白再哈希：粘贴带空格的 Key 不得脱离干净 Key 的分账，
  // 否则后台按 Key 回读用量永远配不上（卡片永远「尚未产生消费」）。
  return 'key_' + createHash('sha256').update(String(apiKey).trim()).digest('hex');
}
function limitError(kind: 'TOTAL' | 'KEY'): Error {
  return new Error(`MODEL_SPEND_LIMIT_${kind} ${kind === 'TOTAL' ? '测试期总额度已不足' : '该 API Key 的消费额度已不足'}`);
}

/** 行存在则保留消费台账；额度调整按差额原子修正可用量，并发预留只认 availableFen 条件扣减。
 *  建行必须用 ON CONFLICT DO NOTHING（createMany.skipDuplicates）：PG 里 create 撞唯一键会把整个事务标成 aborted，
 *  后续 findUnique 直接 25P02，真实调用会被误判为台账不可用。 */
async function ensureRow(p: any, id: string, limitFen: number): Promise<void> {
  await p.modelSpendBudget.createMany({
    data: [{ id, limitFen, availableFen: limitFen, reservedFen: 0, spentFen: 0 }],
    skipDuplicates: true,
  });
  const old = await p.modelSpendBudget.findUnique({ where: { id } });
  if (!old) throw new Error('MODEL_SPEND_LIMIT_UNAVAILABLE 预算行创建失败');
  if (old.limitFen === limitFen) return;
  await p.modelSpendBudget.updateMany({
    where: { id, limitFen: old.limitFen },
    data: { limitFen, availableFen: { increment: limitFen - old.limitFen } },
  });
}

async function reserveOne(p: any, id: string, limitFen: number, reserveFen: number, kind: 'TOTAL' | 'KEY'): Promise<void> {
  await ensureRow(p, id, limitFen);
  const r = await p.modelSpendBudget.updateMany({
    where: { id, availableFen: { gte: reserveFen } },
    data: { availableFen: { decrement: reserveFen }, reservedFen: { increment: reserveFen } },
  });
  if (r.count !== 1) throw limitError(kind);
}

/** 测试进程不连真实库：未显式注入控制面时默认关闭，否则开发库里遗留的限额配置会把无关用例全部阻断。 */
async function resolveControl(): Promise<SpendControl> {
  if (process.env.NODE_ENV === 'test') return { prisma, enabled: false, totalLimitYuan: 0 };
  return { prisma, ...(await loadSpendLimit(prisma)) };
}

export async function reserveModelSpend(input: { apiKey: string; keyLimitYuan: number; reserveFen: number }): Promise<SpendReservation | null> {
  const control: SpendControl = __controlForTest ?? (await resolveControl());
  if (!control.enabled) return null;
  const reserveFen = Math.max(0, Math.ceil(input.reserveFen));
  const totalLimitFen = fen(control.totalLimitYuan);
  const keyLimitFen = fen(input.keyLimitYuan);
  const kid = keyLimitFen > 0 ? keyId(input.apiKey) : null;
  try {
    return await control.prisma.$transaction(async (tx: any) => {
      await reserveOne(tx, 'total', totalLimitFen, reserveFen, 'TOTAL');
      if (kid) await reserveOne(tx, kid, keyLimitFen, reserveFen, 'KEY');
      return { prisma: control.prisma, reserveFen, keyId: kid };
    });
  } catch (e) {
    if (e instanceof Error && /^MODEL_SPEND_LIMIT_(TOTAL|KEY)/.test(e.message)) throw e;
    throw new Error('MODEL_SPEND_LIMIT_UNAVAILABLE 消费限额台账不可用，已阻止模型调用');
  }
}

async function settleRow(tx: any, id: string, reserveFen: number, actualFen: number): Promise<void> {
  await tx.modelSpendBudget.update({
    where: { id },
    data: {
      availableFen: { increment: reserveFen - actualFen },
      reservedFen: { decrement: reserveFen },
      spentFen: { increment: actualFen },
    },
  });
}

/** 成功传实际成本；失败/取消传 0，即完整释放预留。 */
export async function settleModelSpend(r: SpendReservation | null, actualFen: number): Promise<void> {
  if (!r) return;
  const actual = Math.max(0, Math.ceil(actualFen));
  try {
    await r.prisma.$transaction(async (tx: any) => {
      await settleRow(tx, 'total', r.reserveFen, actual);
      if (r.keyId) await settleRow(tx, r.keyId, r.reserveFen, actual);
    });
  } catch (e) {
    // v2.621 结算失败意味着资金台账没落平；直接替换异常会让 Prisma 事务失败/连接池耗尽
    // 全部退化成同一句话术，事后对账无入口。对外错误保持不变，原始异常先留痕。
    logInternal(e, 'spend.settle');
    throw new Error('MODEL_SPEND_LIMIT_UNAVAILABLE 消费限额结算失败');
  }
}

export function isSpendLimitError(e: unknown, kind?: 'TOTAL' | 'KEY' | 'UNAVAILABLE'): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes(`MODEL_SPEND_LIMIT_${kind || ''}`);
}

export interface SpendUsage {
  limitYuan: number;
  spentYuan: number;
  reservedYuan: number;
  availableYuan: number;
  keyCount: number;
  updatedAt: string | null;
}

/** 单本账的用量快照（总额与每个 Key 同形，Key 版不含 keyCount） */
export type SpendSnapshot = Omit<SpendUsage, 'keyCount'>;

function snapshot(row: any): SpendSnapshot {
  const yuan = (f: number) => Math.round(Number(f) || 0) / 100;
  return {
    limitYuan: yuan(row.limitFen),
    spentYuan: yuan(row.spentFen),
    reservedYuan: yuan(row.reservedFen),
    availableYuan: yuan(row.availableFen),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** v2.564 超管后台用量读数：台账才是真正决定放不放行的依据，配置额度只是下次预留时的目标值。
 *  从未产生真实调用（没建过 total 行）时返回 null，由界面提示「尚无消费记录」，
 *  不能伪装成「限额 0 / 可用 0」让管理员误以为已经耗尽。
 *  Key 分账只回数量，不暴露任何指纹。 */
export async function readSpendUsage(p: any = prisma): Promise<SpendUsage | null> {
  const rows: any[] = await p.modelSpendBudget.findMany();
  const total = rows.find((r) => r.id === 'total');
  if (!total) return null;
  return {
    ...snapshot(total),
    keyCount: rows.filter((r) => String(r.id).startsWith('key_')).length,
  };
}

/** v2.565 供应商卡片按 Key 回读用量：只配限额却看不到消耗，等于没配。
 *  Key 只以 SHA-256 身份作映射键，映射结果在服务端配对后仅回金额，指纹不出后端。 */
export async function readKeySpendUsage(p: any = prisma): Promise<Record<string, SpendSnapshot>> {
  const rows: any[] = await p.modelSpendBudget.findMany();
  const out: Record<string, SpendSnapshot> = {};
  for (const r of rows) if (String(r.id).startsWith('key_')) out[String(r.id)] = snapshot(r);
  return out;
}

/** 由 Key 明文推出账本 id（空 Key 返回 null：没有身份就没有分账） */
export function spendKeyId(apiKey: string): string | null {
  const k = String(apiKey || '').trim();
  return k ? keyId(k) : null;
}
