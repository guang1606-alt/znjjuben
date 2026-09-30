/**
 * interview.ts —— 采访式创作路由（v2.92）
 * ------------------------------------------------------------------
 * 把「采访式创作」从"方法论注入的单次生成"升级为真正的多轮采访：
 *  · POST /sessions       开场：idea 即第一轮素材，返回第一个追问（扣 INTERVIEW_TURN）
 *  · POST /sessions/:id/turn   一轮一问：用户回答 → AI 提炼四维素材 + 下一问（扣 INTERVIEW_TURN）
 *  · GET  /sessions、/:id      会话列表/详情（免费）
 *  · POST /sessions/:id/brief  产出结构化创意简报（确定性拼装，免费）→ 前端回填 brief 走正常 SSE 生成
 *  · POST /sessions/:id/close  关闭会话
 * 计费：每轮追问 INTERVIEW_TURN（5积分，≥成本2倍）；服务失败自动退款；
 * 幂等：Idempotency-Key/clientToken + 5 分钟窗（与 room.ts 同源）；
 * 合规：用户输入先过机器拦截（与 /projects、/episodes 同一 scanWithStore）。
 */
import { createHash } from 'crypto';
import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { EngineTier, VALUE_ADDED, ValueAddedKey, FEN_PER_POINT } from '../config/pricing';
import { consumeValueAdded, refundValueAdded } from '../lib/billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { scanWithStore } from '../lib/safety-store';
import { prisma as defaultPrisma } from '../lib/prisma';
import { staffOf, staffChargeTx, staffRefundTx } from '../lib/staff-billing';
import {
  interviewTurn, buildBrief, emptyMaterials, readyCheck, gapReport,
  InterviewMaterials, Lang, TurnOutcome,
} from '../engine/interview';

type PrismaLike = any;

const normLang = (l: unknown): Lang => (l === 'en' ? 'en' : 'zh');

export function createInterviewRouter(prisma: PrismaLike) {
  const router = asyncRouter();

  /* ---------------- 扣退费（与 room.ts 同源范式） ---------------- */
  const IDEM_WINDOW_MS = 5 * 60 * 1000;
  const idemWindow = () => `w${Math.floor(Date.now() / IDEM_WINDOW_MS)}`;
  const contentHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 20);
  const nonceOf = (req: AuthRequest): string => {
    const h = (req.get?.('idempotency-key') as string | undefined) || (req.headers?.['idempotency-key'] as string | undefined);
    const b = (req.body as any)?.clientToken != null ? String((req.body as any).clientToken) : '';
    const v = (typeof h === 'string' ? h.trim() : '') || b.trim();
    return v ? `t${contentHash(v.slice(0, 200))}` : '';
  };
  async function charge(userId: string, key: ValueAddedKey, refId: string, staff: boolean): Promise<{ charged: boolean; idem: string }> {
    return await withBillingTransaction(prisma, userId, async (tx) => {
      if (staff) return staffChargeTx(tx, userId, refId, 'staff-iv');
      const raw = tx.raw as any;
      const charges = await raw.ledgerEntry.findMany({ where: { userId, reason: key, refType: 'value_added', refId } });
      const refunds = await raw.ledgerEntry.findMany({ where: { userId, reason: `${key}:REFUND`, refType: 'value_added', refId } });
      if (charges.length > refunds.length) return { charged: false, idem: '' };
      const idem = `interview:${refId}:a${charges.length + 1}`;
      await consumeValueAdded(tx, userId, key, refId, idem);
      return { charged: true, idem };
    });
  }
  async function refund(userId: string, key: ValueAddedKey, refId: string, idem: string, staff: boolean) {
    if (staff) {
      await withBillingTransaction(prisma, userId, (tx) => staffRefundTx(tx, userId, refId, idem));
      return;
    }
    await withBillingTransaction(prisma, userId, (tx) => refundValueAdded(tx, userId, key, refId, idem));
  }

  const asMaterials = (v: unknown): InterviewMaterials => {
    const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const arr = (k: string): string[] => (Array.isArray(m[k]) ? (m[k] as unknown[]).map((x) => String(x)) : []);
    return {
      relationships: arr('relationships'), timeline: arr('timeline'), scenes: arr('scenes'),
      quotes: arr('quotes'), rawNotes: arr('rawNotes'),
    };
  };
  const asTranscript = (v: unknown): { q: string; a: string }[] => {
    if (!Array.isArray(v)) return [];
    return v.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { q: String(o.q ?? ''), a: String(o.a ?? '') }; });
  };
  const pubSession = (s: Record<string, unknown>) => ({
    id: s.id, title: s.title, lang: s.lang, status: s.status,
    materials: asMaterials(s.materials), transcript: asTranscript(s.transcript),
    turnCount: s.turnCount, createdAt: s.createdAt, updatedAt: s.updatedAt,
  });

  async function accessibleSession(id: string, userId: string) {
    const s = await prisma.interviewSession.findUnique({ where: { id } });
    if (!s) return { error: 404 as const };
    if (s.userId !== userId) return { error: 403 as const };
    return { session: s };
  }

  /** 一轮采访的公共执行：扫描→扣费→AI→落库（含模型调用日志）；失败退款 */
  async function runTurn(
    req: AuthRequest, res: any,
    args: { userId: string; sessionId?: string; text: string; lang: Lang; tier: EngineTier; title?: string; staff: boolean },
    prev: { materials: InterviewMaterials; transcript: { q: string; a: string }[]; lastQuestion: string },
  ) {
    const refId = `iv:${args.userId}:${args.sessionId ?? 'new'}:${idemWindow()}:${nonceOf(req) || contentHash(args.text)}`;
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(args.userId, 'INTERVIEW_TURN', refId, args.staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同回答刚已提交，请勿重复发送' });
      idem = r0.idem; charged = true;

      const out: TurnOutcome = await interviewTurn(args.tier, args.text, prev.materials, prev.lastQuestion, prev.transcript, args.lang);

      // 模型调用观测（taskId 空 = 非剧集管线调用；priceFen 记增值定价，内部账户向用户收 0 → priceFen=0，真实 costFen 照常）
      if (out.costFen > 0) {
        await prisma.modelCallLog.create({
          data: { taskId: null, role: 'designer', engineTier: args.tier, costFen: Math.max(1, Math.round(out.costFen)), priceFen: args.staff ? 0 : VALUE_ADDED.INTERVIEW_TURN.points * FEN_PER_POINT },
        }).catch(() => {});
      }

      const transcript = [...prev.transcript, { q: prev.lastQuestion, a: args.text.slice(0, 4000) }];
      const turnCount = transcript.length;
      const data = {
        materials: out.materials as unknown as Record<string, unknown>,
        transcript: transcript as unknown as Record<string, unknown>[],
        turnCount,
      };
      let sid = args.sessionId;
      if (sid) {
        await prisma.interviewSession.update({ where: { id: sid }, data });
      } else {
        const created = await prisma.interviewSession.create({
          data: { userId: args.userId, title: (args.title ?? '').slice(0, 120) || args.text.slice(0, 40), lang: args.lang, status: 'ACTIVE', ...data },
        });
        sid = created.id;
      }
      return res.json({
        ok: true, sessionId: sid, question: out.question, materials: out.materials,
        transcript, turnCount, ready: readyCheck(out.materials, turnCount, args.lang),
        gaps: gapReport(out.materials, args.lang), aiExtract: out.aiExtract, aiQuestion: out.aiQuestion,
        points: args.staff ? 0 : VALUE_ADDED.INTERVIEW_TURN.points, staff: args.staff,
      });
    } catch (e) {
      if (charged) await refund(args.userId, 'INTERVIEW_TURN', refId, idem, args.staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message || (args.staff ? '采访服务暂不可用，请稍后重试' : '采访服务暂不可用，积分已退回') });
    }
  }

  /* ---------------- 开场：idea 即第一轮素材 ---------------- */
  const openSchema = z.object({
    idea: z.string().min(4, '先把你的想法聊两句（至少4个字）').max(4000),
    title: z.string().max(120).optional(),
    lang: z.enum(['zh', 'en']).optional(),
    engineTier: z.nativeEnum(EngineTier).optional(),
  });
  router.post('/sessions', authRequired, async (req: AuthRequest, res) => {
    const p = openSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '参数不合法' });
    const scan = await scanWithStore(p.data.idea, prisma);
    if (scan.level === 'block') return res.status(422).json({ error: scan.blockReason!, hits: scan.blocked });
    return runTurn(req, res, {
      userId: req.userId!, text: p.data.idea, lang: normLang(p.data.lang),
      tier: p.data.engineTier ?? EngineTier.STANDARD, title: p.data.title,
      staff: await staffOf(prisma, req.userId!),
    }, { materials: emptyMaterials(), transcript: [], lastQuestion: '' });
  });

  /* ---------------- 追问一轮 ---------------- */
  const turnSchema = z.object({
    text: z.string().min(1, '请先回答，或说“没有更多了”').max(4000),
    engineTier: z.nativeEnum(EngineTier).optional(),
  });
  router.post('/sessions/:id/turn', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleSession(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '采访会话不存在' : '无权访问该会话' });
    if (got.session.status !== 'ACTIVE') return res.status(409).json({ error: 'SESSION_CLOSED', message: '会话已结束，请新建采访' });
    const p = turnSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '参数不合法' });
    const scan = await scanWithStore(p.data.text, prisma);
    if (scan.level === 'block') return res.status(422).json({ error: scan.blockReason!, hits: scan.blocked });
    const s = got.session;
    return runTurn(req, res, {
      userId: req.userId!, sessionId: s.id, text: p.data.text,
      lang: normLang(s.lang), tier: p.data.engineTier ?? EngineTier.STANDARD,
      staff: await staffOf(prisma, req.userId!),
    }, { materials: asMaterials(s.materials), transcript: asTranscript(s.transcript), lastQuestion: asTranscript(s.transcript).slice(-1)[0]?.q ?? '' });
  });

  /* ---------------- 会话查询 ---------------- */
  router.get('/sessions', authRequired, async (req: AuthRequest, res) => {
    const list = await prisma.interviewSession.findMany({
      where: { userId: req.userId! }, orderBy: { updatedAt: 'desc' }, take: 20,
    });
    res.json({ ok: true, sessions: (list as Record<string, unknown>[]).map(pubSession) });
  });
  router.get('/sessions/:id', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleSession(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '采访会话不存在' : '无权访问该会话' });
    res.json({ ok: true, session: pubSession(got.session as Record<string, unknown>) });
  });

  /* ---------------- 结构化简报（免费 · 确定性拼装） ---------------- */
  router.post('/sessions/:id/brief', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleSession(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '采访会话不存在' : '无权访问该会话' });
    const s = got.session;
    const m = asMaterials(s.materials);
    const lang = normLang(s.lang);
    const ready = readyCheck(m, s.turnCount, lang);
    const brief = buildBrief(m, lang);
    // 就绪时归档：会话转入 CONVERTED，防重复消费；未就绪也允许拿简报（由用户自行决定是否直接生成）
    if (ready && s.status === 'ACTIVE') await prisma.interviewSession.update({ where: { id: s.id }, data: { status: 'CONVERTED' } }).catch(() => {});
    res.json({ ok: true, brief, ready, gaps: gapReport(m, lang), turnCount: s.turnCount, status: ready ? 'CONVERTED' : s.status });
  });

  /* ---------------- 关闭会话 ---------------- */
  router.post('/sessions/:id/close', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleSession(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '采访会话不存在' : '无权访问该会话' });
    await prisma.interviewSession.update({ where: { id: got.session.id }, data: { status: 'CLOSED' } });
    res.json({ ok: true, status: 'CLOSED' });
  });

  return router;
}

/** 生产默认实例（测试可注入内存桩 prisma） */
export const interviewRouter = createInterviewRouter(defaultPrisma);
