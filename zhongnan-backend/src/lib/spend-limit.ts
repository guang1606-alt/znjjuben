/**
 * 测试期模型消费硬限额：调用前预留、成功按实际成本结算、失败释放。
 * 总额与每个 API Key 分账；Key 只存 SHA-256 身份，不落明文。总阀开启后台账不可用时 fail-closed。
 */
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { loadSpendLimit } from './model-config';

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
  return 'key_' + createHash('sha256').update(apiKey).digest('hex');
}
function limitError(kind: 'TOTAL' | 'KEY'): Error {
  return new Error(`MODEL_SPEND_LIMIT_${kind} ${kind === 'TOTAL' ? '测试期总额度已不足' : '该 API Key 的消费额度已不足'}`);
}

/** 行存在则保留消费台账；额度调整按差额原子修正可用量，并发预留只认 availableFen 条件扣减。 */
async function ensureRow(p: any, id: string, limitFen: number): Promise<void> {
  const data = { id, limitFen, availableFen: limitFen, reservedFen: 0, spentFen: 0 };
  try {
    await p.modelSpendBudget.create({ data });
    return;
  } catch (e: any) {
    if (e?.code !== 'P2002') {
      const old = await p.modelSpendBudget.findUnique({ where: { id } });
      if (!old) throw e;
      if (old.limitFen === limitFen) return;
      await p.modelSpendBudget.updateMany({
        where: { id, limitFen: old.limitFen },
        data: { limitFen, availableFen: { increment: limitFen - old.limitFen } },
      });
      return;
    }
  }
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

export async function reserveModelSpend(input: { apiKey: string; keyLimitYuan: number; reserveFen: number }): Promise<SpendReservation | null> {
  const control: SpendControl = __controlForTest ?? { prisma, ...(await loadSpendLimit(prisma)) };
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
  } catch {
    throw new Error('MODEL_SPEND_LIMIT_UNAVAILABLE 消费限额结算失败');
  }
}

export function isSpendLimitError(e: unknown, kind?: 'TOTAL' | 'KEY' | 'UNAVAILABLE'): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes(`MODEL_SPEND_LIMIT_${kind || ''}`);
}
