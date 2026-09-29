import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import crypto from 'crypto';
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
        const acc = await tx.pointsAccount.findUnique({ where: { userId: o.userId } });
        const balanceAfter = (acc?.balance ?? 0) + o.points;
        await tx.pointsAccount.update({ where: { userId: o.userId }, data: { balance: balanceAfter } });
        await tx.ledgerEntry.create({
          data: {
            userId: o.userId, direction: 'IN', bucket: 'RECHARGE', amount: o.points,
            balanceAfter, reason: 'RECHARGE', refType: 'order', refId: o.id, idempotencyKey: `pay:${o.id}`,
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
    res.json({ items, plans, xScript: X_SCRIPT, pointsPerYuan: 10 });
  });
  const deliverPaidOrder = createDeliver(prisma);
  const createSchema = z.object({ sku: z.string().min(1).max(40) });

  orderRouter.post('/create', authRequired, async (req: AuthRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: '商品参数无效' });
    const sku = SKU[parsed.data.sku];
    if (!sku) return res.status(400).json({ error: '商品不存在' });
    const order = await prisma.order.create({
      data: {
        userId: req.userId!, kind: sku.kind, level: sku.level,
        amountFen: sku.amountFen, points: sku.points ?? 0, status: 'PENDING', remark: sku.remark,
      },
    });
    // 生产：此处调用微信 Native/JSAPI 或支付宝下单，返回 codeUrl/payForm；沙箱先返回订单号
    res.json({ orderId: order.id, amountFen: order.amountFen, payParams: 'TODO_CALL_PROVIDER' });
  });

  /** 微信支付回调：生产用商户证书验签（wechatpay-node-v3），此处给出验签骨架 */
  orderRouter.post('/notify/wechat', async (req, res) => {
    try {
      const signature = req.headers['wechatpay-signature'] as string;
      if (!signature || !verifyWechatSignature(JSON.stringify(req.body), signature))
        return res.status(401).json({ code: 'FAIL', message: '验签失败' });
      const orderId = req.body?.out_trade_no;
      const tradeNo = req.body?.transaction_id;
      if (req.body?.event_type === 'TRANSACTION.SUCCESS') await deliverPaidOrder(orderId, tradeNo);
      res.json({ code: 'SUCCESS' });
    } catch {
      res.status(500).json({ code: 'FAIL' });
    }
  });

  /** 支付宝回调：生产用支付宝公钥验签（alipay-sdk） */
  orderRouter.post('/notify/alipay', async (req, res) => {
    if (!verifyAlipaySign(req.body)) return res.send('fail');
    if (req.body.trade_status === 'TRADE_SUCCESS')
      await deliverPaidOrder(req.body.out_trade_no, req.body.trade_no);
    res.send('success');
  });

  return orderRouter;
}

// —— 支付回调验签（fail-closed）——
// ⚠️ 安全红线：回调是“收款发货”的唯一触发点，验签必须默认拒绝。以下为本地占位实现，
//   生产上线务必替换为官方 SDK：
//   - 微信：wechatpay-node-v3，用微信支付平台证书做 RSA-SHA256 验签（校验 Wechatpay-Serial/时间戳/随机串），
//     不是用 APIv3 密钥对 body 做 HMAC；
//   - 支付宝：alipay-sdk 的 checkNotifySign，用支付宝公钥做 RSA2 验签（即下方 ALIPAY_PUBLIC_KEY 分支）。
//   绝不能仅凭配了 APPID/MCHID 就放行（旧逻辑可被任意外部请求伪造“支付成功”白嫖发货）。
function verifyWechatSignature(raw: string, sig: string): boolean {
  const secret = process.env.WECHAT_API_V3_KEY;
  if (!secret) return false; // 未配置密钥：一律拒绝（测试 http-order 依赖此行为）
  try { return crypto.createHmac('sha256', secret).update(raw).digest('hex') === sig; } catch { return false; }
}

/** 支付宝回调参数按 key 排序拼接待验签串（与官方 RSA2 规则一致：剔除 sign/sign_type 与空值） */
function alipaySignBase(params: Record<string, unknown>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}
function verifyAlipaySign(params: unknown): boolean {
  if (!params || typeof params !== 'object') return false;
  const p = params as Record<string, unknown>;
  const sign = String(p.sign || '');
  if (!sign) return false;
  // 生产路径：配置支付宝公钥 → RSA2(非对称) 验签
  const pubKey = process.env.ALIPAY_PUBLIC_KEY;
  if (pubKey) {
    try {
      return crypto.createVerify('RSA-SHA256').update(alipaySignBase(p)).verify(pubKey, sign, 'base64');
    } catch { return false; }
  }
  // 本地/联调占位：仅当显式配置 ALIPAY_NOTIFY_SECRET 时才做 HMAC 校验；
  // 注意：只配 ALIPAY_APPID 绝不构成验签通过条件。
  const secret = process.env.ALIPAY_NOTIFY_SECRET;
  if (!secret) return false;
  try { return crypto.createHmac('sha256', secret).update(alipaySignBase(p)).digest('hex') === sign; } catch { return false; }
}

export const orderRouter = createOrderRouter(defaultPrisma);
export const deliverPaidOrder = createDeliver(defaultPrisma);
