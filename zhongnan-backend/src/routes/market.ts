/**
 * 剧本交易广场（PRD 7.3）—— 担保交易
 *  状态机：ON_SHELF --买家付款(扣款托管)--> ESCROW --买家确认/到期放款--> SOLD
 *                                          └--24h内退款--> REFUNDED(退回上架, 买家失全本, 不可复购)
 *  - 免费用户不可上架；佣金按会员等级 15%/10%/5%，放款时才结算
 *  - 数字商品付款即解锁全本；退款即收回访问权，平台全程不垫资
 */
import { asyncRouter } from '../lib/async-router';
import { prisma as defaultPrisma } from '../lib/prisma';
import { parsePageParams } from '../lib/pagination';
import { authRequired, AuthRequest } from '../middleware/auth';
import { withBillingTransaction } from '../lib/prisma-tx';
import { MEMBERSHIP, FEN_PER_POINT, MemberLevel } from '../config/pricing';
import { settlePurchase, withinRefund, ESCROW_WINDOW_MS } from '../lib/escrow';
import { investorLens, investorOneLiner } from '../engine/investor-lens';
import { buildScriptValue, type ScriptValueResult } from '../lib/script-value';
import { latestScripts } from '../lib/latest-scripts';
import { normalizeBibleDoc } from '../lib/script-doc'; // v2.193 c193：timeline synopsis 同源归一（集市买家可见，防字符串形态首字符污染）
export { withinRefund, ESCROW_WINDOW_MS }; // 供测试复用

type PrismaLike = typeof defaultPrisma;
const MIN_PRICE_FEN = 100;                 // 最低 1 元
function commissionOf(level?: string): number {
  return MEMBERSHIP[(level as MemberLevel) ?? 'FREE']?.commission ?? 0;
}
/** 担保交易分账（纯函数，可单测） */
export function splitTrade(pricePoints: number, commissionPct: number) {
  const commission = Math.round(pricePoints * commissionPct / 100);
  return { commission, sellerGain: pricePoints - commission };
}

export function createMarketRouter(prisma: PrismaLike | any) {
  const marketRouter = asyncRouter();
  // 资方视角评估：纯本地确定性分析、零token成本，免费只读开放（让用户知道剧本值不值钱、怎么才好卖）
  marketRouter.post('/investor-lens', (req, res) => {
    const { text, tags, episodes } = req.body as { text?: string; tags?: string[]; episodes?: number };
    const content = String(text ?? '').slice(0, 6000);
    if (!content.trim() && !(Array.isArray(tags) && tags.length))
      return res.status(400).json({ error: '请提供剧本梗概、简介或标签' });
    const r = investorLens({ text: content, tags: Array.isArray(tags) ? tags.map(String) : [], episodes: Number(episodes) || undefined });
    res.json({ ok: true, ...r, oneLiner: investorOneLiner(r) });
  });

  // v2.72 上架前价值预览：确定性零 token、免费。给卖家定价参考（价值指数/等级/单集区间/全集区间），不强制按此定价
  async function computeValueForProject(project: any): Promise<{ card: ScriptValueResult; episodes: number } | null> {
    if (!project) return null;
    const scripts = latestScripts<any>(await prisma.script.findMany({ where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }] }));
    const contents = scripts.map((s: any) => s.content || '').filter((c: string) => c && c.trim());
    if (!contents.length) return null;
    const me = await prisma.user.findUnique({ where: { id: project.userId }, select: { penName: true } });
    const bible = (project as any).bible;
    const synopsis = normalizeBibleDoc(bible).timeline[0] || scripts[0]?.synopsis || null; // v2.193 c193：字符串/数组双形态安全
    const card = buildScriptValue({ title: project.title, penName: me?.penName ?? null, tags: project.tags ?? [], contents, synopsis });
    return { card, episodes: contents.length };
  }
  async function purchasedContent(db: any, scriptId: string, title: string) {
    const anchor = await db.script.findUnique({ where: { id: scriptId } });
    if (!anchor) return null;
    const scripts = latestScripts<any>(await db.script.findMany({
      where: { projectId: anchor.projectId },
      orderBy: [{ epNo: 'asc' }, { version: 'desc' }],
    }));
    const episodes = scripts
      .filter((script: any) => typeof script.content === 'string' && script.content.trim())
      .map((script: any) => ({
        epNo: script.epNo ?? 1,
        title: script.title || `第${script.epNo ?? 1}集`,
        content: script.content,
      }));
    if (!episodes.length) return null;
    return {
      title,
      episodes,
      fullText: episodes
        .map((episode: any) => `第${episode.epNo}集${episode.title ? ` · ${episode.title}` : ''}\n\n${episode.content}`)
        .join('\n\n──────────\n\n'),
    };
  }
  marketRouter.post('/listings/value-preview', authRequired, async (req: AuthRequest, res) => {
    const level = (req.level ?? 'FREE') as MemberLevel;
    const r = await resolveScript(req.body as { scriptId?: string; projectId?: string });
    if (!r) return res.status(400).json({ error: '请选择有分集的剧本' });
    // 归属校验：不得对他人剧本生成价值分析（含全文喂给评估器）
    if (r.script.project.userId !== req.userId) return res.status(403).json({ error: '只能评估自己的剧本' });
    const vr = await computeValueForProject(r.script.project);
    if (!vr) return res.json({ ok: true, value: null, suggested: null, commissionPct: commissionOf(level), note: '该剧本还没有分集，暂无法生成价值参考；可先创作分集后再上架' });
    const { card, episodes } = vr;
    const suggested = card.band ? {
      perEpLowYuan: card.band.perEpLow, perEpHighYuan: card.band.perEpHigh,
      totalLowYuan: card.band.perEpLow * episodes, totalHighYuan: card.band.perEpHigh * episodes, episodes,
    } : null;
    res.json({ ok: true, value: card, suggested, commissionPct: commissionOf(level), projectId: r.script.project.id });
  });

  // v2.73 兼容入参：前端可能传 projectId（项目id）或 scriptId（单集id），统一解析到"该项目最新一版第一集"作为上架锚点
  async function resolveScript(body: { scriptId?: string; projectId?: string }): Promise<{ script: any; scriptId: string } | null> {
    const sid = body.scriptId || body.projectId;
    if (!sid) return null;
    let script = await prisma.script.findFirst({ where: { id: sid }, include: { project: true } });
    if (!script) {
      // 当作 projectId 处理：取该项目 epNo 最小、version 最大的一集，再用 findFirst 挂 project（兼容内存桩 findMany 不支持 include）
      const scripts = await prisma.script.findMany({ where: { projectId: sid }, orderBy: [{ epNo: 'asc' }, { version: 'desc' }] });
      if (scripts[0]) script = await prisma.script.findFirst({ where: { id: scripts[0].id }, include: { project: true } });
    }
    if (!script || !script.project) return null;
    return { script, scriptId: script.id };
  }

  /** 价格校验：≥1元(100分) 且为 10 分的整数倍（1积分=10分），避免分账/退款出现小数积分 */
  function validatePriceFen(priceFen: unknown): number | null {
    const pf = Number(priceFen);
    if (!Number.isFinite(pf)) return null;
    const rounded = Math.round(pf);
    if (rounded < MIN_PRICE_FEN || rounded % FEN_PER_POINT !== 0) return null;
    return rounded;
  }

  // 上架
  marketRouter.post('/listings', authRequired, async (req: AuthRequest, res) => {
    const { scriptId, projectId, priceFen, sample } = req.body as { scriptId?: string; projectId?: string; priceFen?: number; sample?: string };
    const level = (req.level ?? 'FREE') as MemberLevel;
    if (level === 'FREE') return res.status(403).json({ error: '免费用户暂不可交易，升级会员后即可上架出售剧本' });
    if (!(scriptId || projectId)) return res.status(400).json({ error: '请选择剧本' });
    const validPrice = validatePriceFen(priceFen);
    if (validPrice === null)
      return res.status(400).json({ error: '价格不低于 1 元，且需为 0.1 元(1积分)的整数倍' });
    const resolved = await resolveScript({ scriptId, projectId });
    if (!resolved) return res.status(404).json({ error: '剧本不存在' });
    const { script, scriptId: realScriptId } = resolved;
    // 归属校验：只能上架自己的剧本（resolveScript 不自带鉴权，此前任意会员可挂他人作品）
    if (script.project.userId !== req.userId) return res.status(403).json({ error: '只能上架自己的剧本' });
    // v2.72 上架时自动生成价值证书快照（确定性零成本），作为定价参考与买家信任徽章；无分集则为 null
    const vr = await computeValueForProject(script.project);
    const snap: Record<string, unknown> = { valueIndex: null, valueGrade: null, valueBandLow: null, valueBandHigh: null, valueEpisodes: null, valueAt: null };
    if (vr) {
      snap.valueIndex = Math.round(vr.card.valueIndex);
      snap.valueGrade = vr.card.grade;
      snap.valueBandLow = vr.card.band?.perEpLow ?? null;
      snap.valueBandHigh = vr.card.band?.perEpHigh ?? null;
      snap.valueEpisodes = vr.episodes;
      snap.valueAt = new Date();
    }
    const listing = await prisma.listing.create({
      data: {
        sellerId: req.userId!, scriptId: realScriptId, title: script.project?.title || script.title || '未命名剧本',
        priceFen: validPrice, sample: String(sample ?? '').slice(0, 600),
        commissionPct: commissionOf(level), ...snap,
      },
    });
    res.json({ ok: true, id: listing.id, commissionPct: listing.commissionPct, value: vr ? { index: vr.card.valueIndex, grade: vr.card.grade, episodes: vr.episodes } : null });
  });

  // 列表/筛选（只给样章）
  // v2.215 分页统一契约：裸数组升级为 { items, total, page, pageSize, limit, offset }；
  // 默认 50 保持前端橱窗观感、上限 100；全量窄 select 后路由层分页（total=真总数，不再静默截断 50）
  marketRouter.get('/listings', async (req, res) => {
    const { limit, offset, page, pageSize } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 100 });
    const { section, sort } = req.query as Record<string, string>;
    const all = await prisma.listing.findMany({
      where: { status: { in: ['ON_SHELF', 'ESCROW'] }, ...(section ? { title: { contains: section } } : {}) },
      orderBy: sort === 'price_asc' ? { priceFen: 'asc' } : { createdAt: 'desc' },
      select: { id: true, title: true, priceFen: true, sample: true, commissionPct: true, status: true, createdAt: true, valueIndex: true, valueGrade: true, valueEpisodes: true, seller: { select: { nickname: true } } },
    });
    const total = all.length;
    const items = all.slice(offset, offset + limit).map((l: any) => ({ ...l, pricePoints: l.priceFen / FEN_PER_POINT }));
    res.json({ items, total, page, pageSize, limit, offset });
  });

  // v2.73 买家详情页：公开浏览，返回价值证书维度+样章+价格，绝不返回全本；价值为确定性零成本重算
  marketRouter.get('/listings/:id', async (req, res) => {
    const listing = await prisma.listing.findFirst({
      where: { id: req.params.id, status: { in: ['ON_SHELF', 'ESCROW'] } },
      include: { seller: { select: { nickname: true, penName: true } } },
    });
    if (!listing) return res.status(404).json({ error: '剧本不存在或已售出' });
    const anchor = await prisma.script.findFirst({ where: { id: listing.scriptId }, include: { project: true } });
    const vr = anchor && anchor.project ? await computeValueForProject(anchor.project) : null;
    const card = vr ? vr.card : null;
    res.json({
      id: listing.id, title: listing.title, sample: listing.sample, priceFen: listing.priceFen,
      pricePoints: listing.priceFen / FEN_PER_POINT, commissionPct: listing.commissionPct,
      status: listing.status, createdAt: listing.createdAt,
      seller: { nickname: listing.seller?.nickname ?? '—', penName: listing.seller?.penName ?? null },
      valueSnapshot: listing.valueGrade ? { grade: listing.valueGrade, index: listing.valueIndex, episodes: listing.valueEpisodes, bandLow: listing.valueBandLow, bandHigh: listing.valueBandHigh } : null,
      value: card, // 完整维度（六维+资方视角），仅分数与建议，不含全本
      disclaimer: '价值指数与区间为算法文本信号估算，非成交承诺；实际价值由对接、平台过审与市场表现决定。',
    });
  });

  // v2.74 交易广场三榜：热销榜(最近成交·社交证明) / 新品榜(最新上架) / 好评榜(价值指数最高)，公开只读零成本
  marketRouter.get('/board', async (req, res) => {
    const type = String(req.query.type || 'new');
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    // v2.215 total 真总数语义：limit 只裁 items，total=过滤后总数（take 500 截断硬帽，家族铁律）
    if (type === 'hot') {
      // 热销榜：最近已成交(SETTLED)的剧本，作为社交证明；每件剧本唯一成交一次，按成交时间倒序
      const purchases = await prisma.purchase.findMany({ where: { status: 'SETTLED' }, orderBy: { createdAt: 'desc' }, take: 500 });
      const rows = await Promise.all(purchases.map(async (p: any) => {
        const listing = await prisma.listing.findUnique({ where: { id: p.listingId } });
        const seller = listing ? await prisma.user.findUnique({ where: { id: listing.sellerId }, select: { nickname: true } }) : null;
        return {
          id: p.listingId, title: listing?.title ?? '—', pricePoints: p.pricePoints,
          sellerNickname: seller?.nickname ?? '—', valueGrade: listing?.valueGrade ?? null,
          valueIndex: listing?.valueIndex ?? null, soldAt: p.createdAt, status: 'SOLD',
        };
      }));
      return res.json({ type: 'hot', total: rows.length, items: rows.slice(0, limit) });
    }
    if (type === 'rating') {
      // 好评榜：在售中按价值指数降序（无价值认证的自然靠后）
      const all = await prisma.listing.findMany({ where: { status: 'ON_SHELF' }, orderBy: [{ valueIndex: 'desc' }, { createdAt: 'desc' }], take: 500, select: { id: true, title: true, priceFen: true, sample: true, commissionPct: true, createdAt: true, valueIndex: true, valueGrade: true, valueEpisodes: true, seller: { select: { nickname: true } } } });
      const rows = all.filter((l: any) => l.valueIndex != null).map((l: any) => ({ ...l, pricePoints: l.priceFen / FEN_PER_POINT, status: 'ON_SHELF' }));
      return res.json({ type: 'rating', total: rows.length, items: rows.slice(0, limit) });
    }
    // 默认新品榜：在售中按上架时间倒序
    const all = await prisma.listing.findMany({ where: { status: 'ON_SHELF' }, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, title: true, priceFen: true, sample: true, commissionPct: true, createdAt: true, valueIndex: true, valueGrade: true, valueEpisodes: true, seller: { select: { nickname: true } } } });
    const rows = all.map((l: any) => ({ ...l, pricePoints: l.priceFen / FEN_PER_POINT, status: 'ON_SHELF' }));
    res.json({ type: 'new', total: rows.length, items: rows.slice(0, limit) });
  });

  // ① 付款 → 托管（扣买家钱，但不给卖家），付款即解锁全本
  // 并发安全：商品抢占、买家扣款、托管建单在同一个 Serializable 事务内，任一失败整体回滚，
  // 杜绝“扣了钱没建单 / 建了单没扣钱”。
  marketRouter.post('/listings/:id/buy', authRequired, async (req: AuthRequest, res) => {
    const buyerId = req.userId!;
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: '剧本不存在或已售出' });
    if (listing.sellerId === buyerId) return res.status(400).json({ error: '不能购买自己的剧本' });
    // 先判本人是否已买（含已退款不可复购），再判商品是否被他人抢走：给同一买家更准确的 409 提示
    const before = await prisma.purchase.findFirst({ where: { buyerId, listingId: listing.id } });
    if (before) return res.status(409).json({ error: before.status === 'REFUNDED' ? '该剧本你已退款，不能再次购买' : '你已购买过该剧本' });
    if (listing.status !== 'ON_SHELF') return res.status(409).json({ error: '手慢了，剧本刚被买走' });
    const pricePoints = listing.priceFen / FEN_PER_POINT;
    const { commission, sellerGain } = splitTrade(pricePoints, listing.commissionPct);
    const idem = `buy:${buyerId}:${listing.id}`;
    class BuyError extends Error { constructor(public kind: 'DUP' | 'GONE' | 'INSUFFICIENT' | 'EMPTY') { super(kind); } }
    let purchase: any;
    try {
      purchase = await withBillingTransaction(prisma, buyerId, async (tx) => {
        const raw = tx.raw as any;
        // 事务内复查重复购买（防两个并发请求同时穿过前置检查）
        const dup = await raw.purchase.findFirst({ where: { buyerId, listingId: listing.id } });
        if (dup) throw new BuyError('DUP');
        if (await tx.ledgerExists(idem)) throw new BuyError('GONE'); // 同键已扣款但走到这里属异常，宁可取消
        await tx.lockAccount(buyerId);
        const acc = await tx.getAccount(buyerId);
        if (!acc || acc.balance < pricePoints) throw new BuyError('INSUFFICIENT');
        const content = await purchasedContent(raw, listing.scriptId, listing.title);
        if (!content) throw new BuyError('EMPTY');
        // 条件抢占商品 ON_SHELF→ESCROW：并发买家只有一个 count===1
        const grab = await raw.listing.updateMany({ where: { id: listing.id, status: 'ON_SHELF' }, data: { status: 'ESCROW' } });
        if (grab.count === 0) throw new BuyError('GONE');
        await tx.updateAccount(buyerId, { balance: acc.balance - pricePoints });
        await tx.writeLedger({ userId: buyerId, direction: 'OUT', bucket: 'RECHARGE', amount: pricePoints, reason: 'BUY_HOLD', refType: 'listing', refId: listing.id, idempotencyKey: idem, balanceAfter: acc.balance - pricePoints });
        // 扣款与建单同事务：提交则两者同时生效，回滚则同时消失
        return await raw.purchase.create({ data: { buyerId, sellerId: listing.sellerId, listingId: listing.id, pricePoints, commissionPoints: commission, sellerGainPoints: sellerGain, status: 'ESCROW', contentSnapshot: content } });
      });
    } catch (e) {
      const kind = (e as BuyError).kind;
      if (kind === 'INSUFFICIENT') return res.status(402).json({ error: '积分余额不足' });
      if (kind === 'EMPTY') return res.status(409).json({ error: '该剧本暂无可交付的正文，请联系卖家' });
      if (kind === 'DUP') return res.status(409).json({ error: '你已购买过该剧本' });
      if (kind === 'GONE') return res.status(409).json({ error: '手慢了，剧本刚被买走' });
      return res.status(500).json({ error: '支付失败，已取消' });
    }
    res.json({ ok: true, purchaseId: purchase.id, escrow: true, status: purchase.status, spentPoints: pricePoints, refundableWithinHours: 24, ...purchase.contentSnapshot });
  });

  // 已购内容可在刷新后重取；退款订单和其他用户一律不可读取。
  marketRouter.get('/purchases/:id/content', authRequired, async (req: AuthRequest, res) => {
    const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id } });
    if (!purchase || purchase.buyerId !== req.userId || !['ESCROW', 'SETTLED'].includes(purchase.status))
      return res.status(404).json({ error: '已购剧本不存在或无权查看' });
    let content = purchase.contentSnapshot;
    if (!content) {
      const listing = await prisma.listing.findUnique({ where: { id: purchase.listingId } });
      if (listing) content = await purchasedContent(prisma, listing.scriptId, listing.title);
    }
    if (!content) return res.status(404).json({ error: '剧本正文已不可用，请联系客服' });
    res.json({ ok: true, purchaseId: purchase.id, status: purchase.status, ...content });
  });

  // ② 确认收货（或到期）→ 放款给卖家、平台抽佣
  marketRouter.post('/purchases/:id/confirm', authRequired, async (req: AuthRequest, res) => {
    const p = await prisma.purchase.findUnique({ where: { id: req.params.id } });
    if (!p || p.buyerId !== req.userId) return res.status(404).json({ error: '订单不存在' });
    if (p.status !== 'ESCROW') return res.status(409).json({ error: '订单当前状态不可确认' });
    try {
      const r = await settlePurchase(p, prisma); // 与定时自动放款共用同一套幂等/抢占逻辑
      if (!r) return res.status(409).json({ error: '订单状态刚发生变化（可能已退款或已放款），请刷新' });
      res.json({ ok: true, ...r });
    } catch {
      res.status(500).json({ error: '放款失败，请重试' });
    }
  });

  // ③ 24h 内退款 → 全额退买家、剧本重新上架、买家失全本且不可复购
  // 与放款对称：事务内先条件翻转 purchase ESCROW→REFUNDED 抢占，抢到才退款+重新上架，
  // 保证“退款/放款”并发时只有一个方向生效，不会既退款给买家又放款给卖家（双赔）。
  marketRouter.post('/purchases/:id/refund', authRequired, async (req: AuthRequest, res) => {
    const p = await prisma.purchase.findUnique({ where: { id: req.params.id } });
    if (!p || p.buyerId !== req.userId) return res.status(404).json({ error: '订单不存在' });
    if (p.status !== 'ESCROW') return res.status(409).json({ error: '订单已完结，无法退款' });
    if (!withinRefund(p.createdAt.getTime(), Date.now()))
      return res.status(409).json({ error: '已超过24小时退款窗口，货款已打给卖家' });
    const idem = `refund:${p.id}`;
    try {
      await withBillingTransaction(prisma, p.buyerId, async (tx) => {
        const raw = tx.raw as any;
        // 1) 状态抢占：仅 ESCROW 可翻 REFUNDED；若放款事务已抢先（SETTLING/SETTLED），count=0
        const claimed = await raw.purchase.updateMany({ where: { id: p.id, status: 'ESCROW' }, data: { status: 'REFUNDED' } });
        if (!claimed || claimed.count === 0) {
          const e = new Error('RACE_LOST'); (e as any).code = 'RACE_LOST'; throw e;
        }
        // 2) 原扣款流水必须存在（buy:buyer:listing）才允许退款，防无扣退款
        const chargeKey = `buy:${p.buyerId}:${p.listingId}`;
        if (!(await tx.ledgerExists(chargeKey))) {
          const e = new Error('NO_CHARGE'); (e as any).code = 'NO_CHARGE'; throw e;
        }
        // 3) 退款幂等 + 买家加款
        if (await tx.ledgerExists(idem)) return;
        await tx.lockAccount(p.buyerId);
        const acc = await tx.getAccount(p.buyerId);
        const base = acc?.balance ?? 0;
        await tx.updateAccount(p.buyerId, { balance: base + p.pricePoints });
        await tx.writeLedger({ userId: p.buyerId, direction: 'IN', bucket: 'RECHARGE', amount: p.pricePoints, reason: 'REFUND', refType: 'listing', refId: p.listingId, idempotencyKey: idem, balanceAfter: base + p.pricePoints });
        // 4) 同事务重新上架
        await raw.listing.updateMany({ where: { id: p.listingId, status: 'ESCROW' }, data: { status: 'ON_SHELF' } });
      });
      res.json({ ok: true, refundPoints: p.pricePoints, notice: '退款已原路退回，全本访问权已收回，该剧本不可再次购买' });
    } catch (e: any) {
      // 内存桩无回滚：NO_CHARGE 时补偿把抢占恢复为 ESCROW（生产事务已回滚，该更新匹配0行）
      if (e?.code === 'NO_CHARGE') {
        await prisma.purchase.updateMany({ where: { id: p.id, status: 'REFUNDED' }, data: { status: 'ESCROW' } }).catch(() => {});
        return res.status(500).json({ error: '未找到原扣款流水，已拒绝退款' });
      }
      if (e?.code === 'RACE_LOST') return res.status(409).json({ error: '订单状态刚发生变化（可能已放款），请刷新' });
      res.status(500).json({ error: '退款失败，请重试' });
    }
  });

  // v2.75 卖家工作台：我的上架+销量+收入统计，让卖家直观看到"剧本值多少钱"
  marketRouter.get('/seller-dashboard', authRequired, async (req: AuthRequest, res) => {
    const uid = req.userId!;
    const listings = await prisma.listing.findMany({ where: { sellerId: uid }, orderBy: { createdAt: 'desc' }, take: 50 });
    const purchases = await prisma.purchase.findMany({ where: { sellerId: uid } });
    const settled = purchases.filter((p: any) => p.status === 'SETTLED');
    const escrow = purchases.filter((p: any) => p.status === 'ESCROW');
    const totalRevenue = settled.reduce((s: number, p: any) => s + p.sellerGainPoints, 0);
    const pendingRevenue = escrow.reduce((s: number, p: any) => s + p.sellerGainPoints, 0);
    const onShelf = listings.filter((l: any) => l.status === 'ON_SHELF').length;
    const sold = listings.filter((l: any) => l.status === 'SOLD').length;
    const stats = {
      totalListings: listings.length, onShelf, sold, inEscrow: escrow.length,
      totalRevenuePoints: totalRevenue, pendingPoints: pendingRevenue,
      commissionPoints: settled.reduce((s: number, p: any) => s + p.commissionPoints, 0),
      avgSalePoints: settled.length ? Math.round(totalRevenue / settled.length) : 0,
    };
    // v2.78 上榜荣誉检测：好评榜（在售按valueIndex降序前10）、热销榜（已成交按时间降序前10）
    const allRatedOnShelf = (await prisma.listing.findMany({ where: { status: 'ON_SHELF', valueIndex: { not: null } }, orderBy: { valueIndex: 'desc' }, take: 50 })) as any[];
    const ratingRank = new Map<string, number>();
    allRatedOnShelf.forEach((l, i) => ratingRank.set(l.id, i + 1));
    const allSettledPurchases = (await prisma.purchase.findMany({ where: { status: 'SETTLED' }, orderBy: { createdAt: 'desc' }, take: 50 })) as any[];
    const hotRank = new Map<string, number>();
    allSettledPurchases.forEach((p, i) => { if (!hotRank.has(p.listingId)) hotRank.set(p.listingId, i + 1); });
    const honors: any[] = [];
    // 每个上架剧本附带成交信息（若已售）
    const purchaseByListing = new Map<string, any>();
    purchases.forEach((p: any) => purchaseByListing.set(p.listingId, p));
    const items = listings.map((l: any) => {
      const p = purchaseByListing.get(l.id);
      const boards: string[] = [];
      if (l.status === 'ON_SHELF') {
        const rr = ratingRank.get(l.id);
        if (rr && rr <= 10) boards.push('rating');
      }
      const hr = hotRank.get(l.id);
      if (hr && hr <= 10) boards.push('hot');
      if (boards.length) honors.push({ id: l.id, title: l.title, boards, ratingRank: ratingRank.get(l.id) || null, hotRank: hr || null });
      return {
        id: l.id, title: l.title, pricePoints: l.priceFen / FEN_PER_POINT,
        status: l.status, valueGrade: l.valueGrade, valueIndex: l.valueIndex, valueEpisodes: l.valueEpisodes,
        createdAt: l.createdAt,
        soldAt: p && p.status === 'SETTLED' ? p.createdAt : null,
        sellerGainPoints: p && p.status === 'SETTLED' ? p.sellerGainPoints : null,
        onBoard: boards.length ? boards : null,
      };
    });
    res.json({ stats, items, honors });
  });

  // v2.76 卖家下架：仅本人在售中剧本可下架，下架后从广场/榜单消失，保留记录
  marketRouter.patch('/listings/:id/delist', authRequired, async (req: AuthRequest, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: '上架记录不存在' });
    if (listing.sellerId !== req.userId) return res.status(403).json({ error: '只能下架自己的剧本' });
    if (listing.status !== 'ON_SHELF') return res.status(409).json({ error: '仅在售中剧本可下架，托管中/已成交/已下架不可操作' });
    await prisma.listing.update({ where: { id: listing.id }, data: { status: 'OFF_SHELF' } });
    res.json({ ok: true, id: listing.id, status: 'OFF_SHELF' });
  });

  // v2.77 卖家重新上架：仅本人已下架剧本可重新上架，可选改价
  marketRouter.patch('/listings/:id/relist', authRequired, async (req: AuthRequest, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: '上架记录不存在' });
    if (listing.sellerId !== req.userId) return res.status(403).json({ error: '只能操作自己的剧本' });
    if (listing.status !== 'OFF_SHELF') return res.status(409).json({ error: '仅已下架剧本可重新上架' });
    const { priceFen } = req.body || {};
    const data: any = { status: 'ON_SHELF' };
    if (priceFen != null) {
      const pf = validatePriceFen(priceFen);
      if (pf === null) return res.status(400).json({ error: '价格不低于 1 元，且需为 0.1 元(1积分)的整数倍' });
      data.priceFen = pf;
    }
    await prisma.listing.update({ where: { id: listing.id }, data });
    res.json({ ok: true, id: listing.id, status: 'ON_SHELF', priceFen: data.priceFen ?? listing.priceFen });
  });

  // 我的销售/购买
  marketRouter.get('/my', authRequired, async (req: AuthRequest, res) => {
    const select = { id: true, listingId: true, pricePoints: true, status: true, createdAt: true };
    const [sales, buys] = await Promise.all([
      prisma.purchase.findMany({ where: { sellerId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 50, select }),
      prisma.purchase.findMany({ where: { buyerId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 50, select }),
    ]);
    res.json({ sales, buys });
  });

  return marketRouter;
}

export const marketRouter = createMarketRouter(defaultPrisma);
