import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { prisma as defaultPrisma } from '../lib/prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { MemberLevel, MEMBERSHIP, X_SCRIPT } from '../config/pricing';

type PrismaLike = typeof defaultPrisma;
/** 商品目录：金额只认服务端，前端只传 sku（绝不信前端传的金额） */
const SKU: Record<string, { kind: 'MEMBER' | 'POINTS' | 'VALUE_ADDED'; amountFen: number; points?: number; level?: MemberLevel; months?: number; remark?: string }> = {
  BASIC_M: { kind: 'MEMBER', amountFen: MEMBERSHIP.BASIC.monthlyFen, level: MemberLevel.BASIC, months: 1 },
  BASIC_Y: { kind: 'MEMBER', amountFen: MEMBERSHIP.BASIC.yearlyFen, level: MemberLevel.BASIC, months: 12 },
  ADVANCED_M: { kind: 'MEMBER', amountFen: MEMBERSHIP.ADVANCED.monthlyFen, level: MemberLevel.ADVANCED, months: 1 },
  ADVANCED_Y: { kind: 'MEMBER', amountFen: MEMBERSHIP.ADVANCED.yearlyFen, level: MemberLevel.ADVANCED, months: 12 },
  PRO_M: { kind: 'MEMBER', amountFen: MEMBERSHIP.PRO.monthlyFen, level: MemberLevel.PRO, months: 1 },
  PRO_Y: { kind: 'MEMBER', amountFen: MEMBERSHIP.PRO.yearlyFen, level: MemberLevel.PRO, months: 12 },
  // 积分包（v1.80 定稿）：1元=10积分；越大额越赠送，但经济档单集永不低于成本×2，锚点100集=100元不破
  PT_10: { kind: 'POINTS', amountFen: 1000, points: 100 },     // 10元=100积分
  PT_199: { kind: 'POINTS', amountFen: 19900, points: 1990 },   // 199元=1990积分（≈199集经济档，1元/集）
  PT_599: { kind: 'POINTS', amountFen: 59900, points: 6200 },   // 599元=6200，赠约3.5%
  PT_1999: { kind: 'POINTS', amountFen: 199900, points: 22000 },// 1999元=22000，赠约10.5%（锁重度）
  XSCRIPT_M: { kind: 'VALUE_ADDED', amountFen: X_SCRIPT.monthlyFen, remark: 'X_SCRIPT' }, // X剧本成年向分级功能月开通（问卷授权另走 /generate/mature/consent）
};
/** 按订单的 level+实付金额精确反查 SKU 周期（避免年卡被误发成月卡） */
function skuOfOrder(o: { kind: string; level?: MemberLevel | null; amountFen: number }) {
  return Object.values(SKU).find((s) => s.kind === o.kind && s.level === o.level && s.amountFen === o.amountFen);
}

export function createDeliver(prisma: PrismaLike | any) {
  /**
   * 支付成功发货（事务 + 原子幂等）。只有“验签通过的支付渠道回调”能调用，绝不能由前端直接调。
   * 用条件更新 UPDATE ... WHERE status='PENDING' 做并发幂等（数据库行锁天然串行，且不依赖原生 SQL 方言）。
   */
  return async function deliverPaidOrder(orderId: string, channelTradeNo: string) {
    return prisma.$transaction(async (tx: any) => {
      const before = await tx.order.findUnique({ where: { id: orderId } });
      if (!before) throw new Error('ORDER_NOT_FOUND');
      if (before.status !== 'PENDING') return { skipped: true };
      const upd = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'PAID', payTradeNo: channelTradeNo, paidAt: new Date() },
      });
      if (upd.count === 0) return { skipped: true }; // 并发回调：已被另一路发货，绝不重复发货
      const o = await tx.order.findUnique({ where: { id: orderId } });
      await tx.payment.create({ data: { orderId, channel: 'provider', amountFen: o.amountFen, success: true } });

      if (o.kind === 'POINTS' && o.points > 0) {
        // v2.314：原子增量入账（UPDATE balance=balance+$1，语句级行锁），不得先 findUnique 再整体覆盖——
        // 裸 $transaction 默认 Read Committed 不串行账户读改写，两笔充值（或充值与 billing 扣款）并发时
        // 后写覆盖先写，一笔充值蒸发；increment 基于最新已提交值，与 prisma-tx.updateAccount 同范式。
        await tx.pointsAccount.update({
          where: { userId: o.userId },
          data: { balance: { increment: o.points } },
        });
        // 流水余额快照取增量落库后的回读值（含交错中已先提交的其他入账），不允许用预读快照推算
        const accAfter = await tx.pointsAccount.findUnique({ where: { userId: o.userId } });
        await tx.ledgerEntry.create({
          data: {
            userId: o.userId, direction: 'IN', bucket: 'RECHARGE', amount: o.points,
            balanceAfter: accAfter.balance, reason: 'RECHARGE', refType: 'order', refId: o.id, idempotencyKey: `pay:${o.id}`,
          },
        });
      }
      if (o.kind === 'MEMBER' && o.level) {
        const months = skuOfOrder(o)?.months ?? 1;
        const addMs = months * 30 * 864e5;
        const quotaMonthly = (MEMBERSHIP as Record<string, { quotaMonthly?: number }>)[String(o.level)]?.quotaMonthly ?? 0;
        const now = new Date();
        // 修复①时长叠加：同等级未过期会员续期，从“现有到期时间”往后加，而不是从现在重算（否则剩余天数蒸发）
        const sameLevel = await tx.membership.findFirst({
          where: { userId: o.userId, level: o.level, expireAt: { gt: now } },
          orderBy: { expireAt: 'desc' },
        });
        // 跨等级：用户持有更晚到期的任意会员时，也应在其剩余时长基础上叠加（购买更长期低价档不亏时长）
        const anyActive = sameLevel ? null : await tx.membership.findFirst({
          where: { userId: o.userId, expireAt: { gt: now } },
          orderBy: { expireAt: 'desc' },
        });
        const baseDate = sameLevel ? new Date(sameLevel.expireAt) : (anyActive ? new Date(anyActive.expireAt) : now);
        const expireAt = new Date(baseDate.getTime() + addMs);
        if (sameLevel) {
          // 修复③复用同一等级进行中的会员行（延期+额度重置），避免每单新建一行导致额度被重复计算
          await tx.membership.updateMany({
            where: { id: sameLevel.id },
            data: { expireAt, quotaTotal: quotaMonthly, quotaUsed: 0, orderId: o.id },
          });
        } else {
          await tx.membership.create({ data: { userId: o.userId, level: o.level, expireAt, quotaTotal: quotaMonthly, orderId: o.id } });
        }
        // 修复②付费只升不降：当前等级高于新购等级且仍在有效期时，保留当前高级身份
        // （其到期后的降级由会员到期处理逻辑负责）；新购等级≥当前或当前已过期才切换。
        const LEVEL_RANK: Record<string, number> = { FREE: 0, BASIC: 1, ADVANCED: 2, PRO: 3 };
        const u = await tx.user.findUnique({ where: { id: o.userId } });
        const curLevel: string = u?.level ?? 'FREE';
        const curActive = !!(u?.levelExpireAt && new Date(u.levelExpireAt) > now);
        if (!curActive || LEVEL_RANK[o.level] >= LEVEL_RANK[curLevel]) {
          await tx.user.update({ where: { id: o.userId }, data: { level: o.level, levelExpireAt: expireAt } });
        }
      }
      return { skipped: false };
    });
  };
}

export function createOrderRouter(prisma: PrismaLike | any) {
  const orderRouter = asyncRouter();
  // 商品目录（公开）：价格/权益只认服务端，前端定价页只渲染、绝不自行定价
  orderRouter.get('/catalog', (_req, res) => {
    const items = Object.entries(SKU).map(([sku, s]) => ({
      sku, kind: s.kind, level: s.level ?? null, months: s.months ?? null,
      points: s.points ?? null, amountFen: s.amountFen, amountYuan: Math.round(s.amountFen) / 100,
    }));
    const plans = (['FREE', 'BASIC', 'ADVANCED', 'PRO'] as MemberLevel[]).map((lv) => ({
      level: lv, ...MEMBERSHIP[lv],
    }));
    res.json({ items, plans, xScript: X_SCRIPT, pointsPerYuan: 10, paymentAvailable: false });
  });
  const createSchema = z.object({ sku: z.string().min(1).max(40) });

  orderRouter.post('/create', authRequired, async (req: AuthRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: '商品参数无效' });
    const sku = SKU[parsed.data.sku];
    if (!sku) return res.status(400).json({ error: '商品不存在' });
    // 接入真实渠道下单及回调核验前，不创建无法支付的待支付订单。
    return res.status(503).json({ code: 'PAYMENT_NOT_CONFIGURED', error: '在线支付暂未开通，请联系管理员处理充值或会员开通。' });
  });

  // 渠道下单、官方签名/资源解密及订单金额核验尚未接通，回调必须保持关闭。
  orderRouter.post('/notify/wechat', (_req, res) => {
    res.status(401).json({ code: 'FAIL', message: '支付渠道暂未开通' });
  });
  orderRouter.post('/notify/alipay', (_req, res) => { res.send('fail'); });
  return orderRouter;
}

export const orderRouter = createOrderRouter(defaultPrisma);
export const deliverPaidOrder = createDeliver(defaultPrisma);
