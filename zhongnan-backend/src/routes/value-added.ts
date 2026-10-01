import { asyncRouter } from '../lib/async-router';
import { createHash } from 'crypto';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { prisma as defaultPrisma } from '../lib/prisma';
import { consumeValueAdded, refundValueAdded } from '../lib/billing';
import { staffOf, staffChargeTx, staffRefundTx } from '../lib/staff-billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { VALUE_ADDED, ValueAddedKey, EngineTier } from '../config/pricing';
import { callImage, callText, STABILITY_SUFFIX } from '../lib/model-proxy';
import { buildVisualStylePrompt } from '../engine/visual-style-library'; // v2.148 视觉画风编码库（海报画风编码注入）
import { runPk } from '../lib/script-pk';
import { buildRankBoard, nextTierProgress } from '../lib/pk-rank';
import { uploadImageToTos } from '../lib/tos';

type PrismaLike = typeof defaultPrisma;

/** 平台标杆本：内置确定性参考剧本，用于"无对手时的默认PK对象"，不依赖外部数据、不泄露他人内容 */
const BENCHMARK_SCRIPT = [
  '【第1场·夜·写字楼地下车库·内景】',
  '林晚攥着刚打印的离职证明，指尖发白。三年了，她从实习生熬到项目主管，最后却被关系户顶了位置。',
  '电梯门开，董事长周振邦走出来，看见她手里的纸，顿了顿：“林晚，跟我上来一趟。”',
  '林晚：（声音发紧）周总，我已经签完字了。',
  '周振邦：（目光锐利）签的是离职，不是解约。你手里那个被毙掉的方案，我看了——是他们偷了你的创意，还反咬一口。',
  '林晚猛地抬头，眼眶红了。',
  '【第2场·董事长办公室·夜·内景】',
  '周振邦把一份合同推到她面前：“公司新成立短剧事业部，你来当负责人。三个月，做不出爆款，你自己走。”',
  '林晚：（颤抖）您为什么选我？',
  '周振邦：（淡淡）因为被踩到底的人，最知道怎么爬起来。',
  '林晚深吸一口气，拿起笔，签下名字。窗外城市灯火通明，她的眼神从委屈变成了冷硬。',
  '（本集完）',
].join('\n');

export function createValueAddedRouter(prisma: PrismaLike | any) {
  const vaRouter = asyncRouter();
  /**
   * 确定性幂等扣费（杜绝 Date.now() 当幂等键导致的重复扣费）：
   * refId = 业务动作 + 实体 + 参数哈希 + 5分钟时间窗。窗内重复提交（双击/重试）返回 charged=false；
   * 窗内上次扣费已退款（下游失败/校验未过）时放行并以 aN 递增尝试号；窗外重新计费。
   */
  const IDEM_WINDOW_MS = 5 * 60 * 1000;
  const idemWindow = () => `w${Math.floor(Date.now() / IDEM_WINDOW_MS)}`;
  const contentHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 20);
  /**
   * 客户端幂等令牌：Idempotency-Key 头或 body.clientToken。
   * 同令牌重试/双击 → 去重不重复扣费；刻意再次操作（如再打一局 PK）换新令牌 → 正常计费。
   * 无令牌时返回空串，调用方退化为「参数哈希+时间窗」兜底。
   */
  const nonceOf = (req: AuthRequest): string => {
    const h = (req.get?.('idempotency-key') as string | undefined) || (req.headers?.['idempotency-key'] as string | undefined);
    const b = (req.body as any)?.clientToken != null ? String((req.body as any).clientToken) : '';
    const v = (typeof h === 'string' ? h.trim() : '') || b.trim();
    return v ? `t${contentHash(v.slice(0, 200))}` : '';
  };
  async function charge(userId: string, key: ValueAddedKey, refId: string, staff: boolean): Promise<{ charged: boolean; idem: string }> {
    return await withBillingTransaction(prisma, userId, async (tx) => {
      if (staff) return staffChargeTx(tx, userId, refId, 'staff-va');
      const raw = tx.raw as any;
      const charges = await raw.ledgerEntry.findMany({ where: { userId, reason: key, refType: 'value_added', refId } });
      const refunds = await raw.ledgerEntry.findMany({ where: { userId, reason: `${key}:REFUND`, refType: 'value_added', refId } });
      if (charges.length > refunds.length) return { charged: false, idem: '' };
      const idem = `va:${refId}:a${charges.length + 1}`;
      await consumeValueAdded(tx, userId, key, refId, idem);
      return { charged: true, idem };
    });
  }
  /** 仅在“确实扣成功后、下游服务失败”时退款；余额不足等扣费阶段失败不退（本就没扣）。
   *  传与 charge 相同的 refId/idem，refund: 前缀由 billing 内部统一管理。 */
  async function refund(userId: string, key: ValueAddedKey, refId: string, idem: string, staff: boolean) {
    if (staff) {
      await withBillingTransaction(prisma, userId, (tx) => staffRefundTx(tx, userId, refId, idem));
      return;
    }
    await withBillingTransaction(prisma, userId, (tx) => refundValueAdded(tx, userId, key, refId, idem));
  }

  const posterSchema = z.object({
    projectId: z.string(),
    tier: z.enum(['STANDARD', 'FLAGSHIP']),
    style: z.string().max(200).optional(),
    clientToken: z.string().max(200).optional(),
  });
  /** 剧本海报：无免费，标准39积分/旗舰199积分（定价以 VALUE_ADDED 为准，已保≥2倍毛利），4张选1，前端须明示价格 */
  vaRouter.post('/poster', authRequired, async (req: AuthRequest, res) => {
    const p = posterSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '参数错误' });
    const key: ValueAddedKey = p.data.tier === 'FLAGSHIP' ? 'POSTER_FLAGSHIP' : 'POSTER_STANDARD';
    // v2.296：已删=不存在——补 status 过滤（v2.295 修 PK 面时本面漏网；否则已删项目穿透到计费阶段，花 39/199 积分生成海报）
    const project = await prisma.project.findFirst({ where: { id: p.data.projectId, userId: req.userId!, status: { not: 'deleted' } } });
    if (!project) return res.status(404).json({ error: '项目不存在' });
    const refId = `poster:${req.userId}:${project.id}:${p.data.tier}:${idemWindow()}:${nonceOf(req) || contentHash(p.data.style ?? '')}`;
    const staff = await staffOf(prisma, req.userId!);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(req.userId!, key, refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同海报请求刚已提交，请勿重复操作' });
      idem = r0.idem; charged = true;
      // v2.148 画风编码注入：项目 bible 存有画风编号时，把英文画风 prompt 段置前（比自由文本 style 更稳的画风一致性）
      const posterStyleId = (() => { try { const b = project.bible as { visualStyleId?: unknown } | null; return typeof b?.visualStyleId === 'string' ? b.visualStyleId : undefined; } catch { return undefined; } })();
      const styleFragment = posterStyleId ? buildVisualStylePrompt(posterStyleId) : '';
      const prompt = `竖屏短剧海报，9:16，电影级质感。${styleFragment ? styleFragment + '。' : ''}剧名《${project.title}》。${project.tags.join('、')}。${p.data.style ?? ''}。只渲染画面氛围与人物，不生成任何文字。${STABILITY_SUFFIX}`;
      const { images, costFen } = await callImage(p.data.tier === 'FLAGSHIP' ? EngineTier.FLAGSHIP : EngineTier.STANDARD, prompt, 4);
      // 模型返回的 URL 可能临时过期，转存 TOS 拿永久地址（未配置 TOS 时原样返回）
      const permanentImages = await Promise.all(images.map((img) => uploadImageToTos(img)));
      const poster = await prisma.poster.create({
        data: { projectId: project.id, tier: p.data.tier, imageUrl: permanentImages[0] ?? null, pointsCost: staff ? 0 : VALUE_ADDED[key].points },
      });
      res.json({ ok: true, posterId: poster.id, images: permanentImages, realCostFen: costFen, points: staff ? 0 : VALUE_ADDED[key].points, staff });
    } catch (e) {
      if (charged) await refund(req.userId!, key, refId, idem, staff).catch(() => {}); // 下游失败：付费退积分 / staff 落 0 元 REFUND
      res.status(400).json({ error: (e as Error).message });
    }
  });

  const pkSchema = z.object({
    scriptAId: z.string().optional(),
    scriptBId: z.string().optional(),
    projectAId: z.string().optional(),
    projectBId: z.string().optional(),
    clientToken: z.string().max(200).optional(),
  });
  /**
   * 剧本PK（v2.67 升级）：明确消耗20积分(2元)，返回六维结构化对比与胜者，前端须明示价格。
   * 支持两种入参：
   *  - 项目级（推荐）：projectAId + projectBId，聚合全部已生成集；B 缺省则对阵"平台标杆本"。
   *  - 单集级（兼容旧版）：scriptAId + scriptBId。
   * A 必须归属当前用户；B 可为自己的其他项目或平台标杆（不泄露他人全文）。
   */
  vaRouter.post('/pk', authRequired, async (req: AuthRequest, res) => {
    const p = pkSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '参数错误' });
    const useProject = !!(p.data.projectAId);
    const refId = `pk:${req.userId}:${idemWindow()}:${nonceOf(req) || contentHash(JSON.stringify({ ...p.data, clientToken: undefined }))}`;
    const staff = await staffOf(prisma, req.userId!);
    let idem = '';
    let charged = false;
    const giveBack = () => { if (charged) return refund(req.userId!, 'PK_BATTLE', refId, idem, staff).catch(() => {}); };
    try {
      const r0 = await charge(req.userId!, 'PK_BATTLE', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同PK请求刚已提交，请勿重复操作' });
      idem = r0.idem; charged = true;

      let titleA = '', titleB = '', contentsA: string[] = [], contentsB: string[] = [];

      if (useProject) {
        const projA = await prisma.project.findFirst({ where: { id: p.data.projectAId, userId: req.userId!, status: { not: 'deleted' } } });
        if (!projA) { await giveBack(); res.status(404).json({ error: '项目不存在或不属于你' }); return; }
        titleA = projA.title;
        const epsA = await prisma.script.findMany({ where: { projectId: projA.id }, orderBy: { epNo: 'asc' } });
        contentsA = epsA.map((s: any) => s.content);
        if (p.data.projectBId) {
          const projB = await prisma.project.findFirst({ where: { id: p.data.projectBId, userId: req.userId!, status: { not: 'deleted' } } });
          if (!projB) { await giveBack(); res.status(404).json({ error: '对手项目不存在或不属于你' }); return; }
          titleB = projB.title;
          const epsB = await prisma.script.findMany({ where: { projectId: projB.id }, orderBy: { epNo: 'asc' } });
          contentsB = epsB.map((s: any) => s.content);
        } else {
          // 平台标杆本：内置确定性参考文本，不依赖外部数据，不泄露他人内容
          titleB = '平台标杆本·都市逆袭';
          contentsB = [BENCHMARK_SCRIPT];
        }
      } else {
        if (!p.data.scriptAId || !p.data.scriptBId) { await giveBack(); res.status(400).json({ error: '请提供 scriptAId/scriptBId 或 projectAId' }); return; }
        const [a, b] = await Promise.all([
          prisma.script.findFirst({ where: { id: p.data.scriptAId }, include: { project: true } }),
          prisma.script.findFirst({ where: { id: p.data.scriptBId }, include: { project: true } }),
        ]);
        // v2.295：已删=不存在——已删项目的剧本按不存在处理（与归属校验同层的软删除穿透补漏）
        if (!a || !b || a.project?.status === 'deleted' || b.project?.status === 'deleted') { await giveBack(); res.status(404).json({ error: '剧本不存在' }); return; }
        // A、B 都必须属于当前用户：否则花20积分即可分析/套取任意他人剧本全文（IDOR）
        if (!a.project || a.project.userId !== req.userId || !b.project || b.project.userId !== req.userId) {
          await giveBack();
          res.status(403).json({ error: '只能PK自己的剧本' }); return;
        }
        titleA = a.title; titleB = b.title;
        contentsA = [a.content]; contentsB = [b.content];
      }

      if (!contentsA.length) { await giveBack(); res.status(400).json({ error: '你的项目还没有生成剧本，先写一集再来PK' }); return; }

      const result = runPk(contentsA, contentsB);
      const battle = await prisma.pkBattle.create({
        data: {
          userId: req.userId!,
          scriptAId: p.data.scriptAId || null,
          scriptBId: p.data.scriptBId || null,
          projectAId: p.data.projectAId || null,
          projectBId: p.data.projectBId || null,
          result: { structured: result, titleA, titleB, mode: useProject ? 'project' : 'script' } as any,
          pointsCost: staff ? 0 : VALUE_ADDED.PK_BATTLE.points,
        },
      });
      // 即时回传最新段位/排名（v2.68）：让用户每局都看到战力成长
      const [allBattles, me] = await Promise.all([
        prisma.pkBattle.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.user.findUnique({ where: { id: req.userId! } }),
      ]);
      const board = buildRankBoard(allBattles as any, req.userId!, { [req.userId!]: { penName: (me as any)?.penName ?? null, nickname: (me as any)?.nickname ?? null } }, 20);
      const nextTier = board.mine ? nextTierProgress(board.mine.power) : null;
      res.json({ ok: true, battleId: battle.id, titleA, titleB, result, analysis: result.xiaonanCommentZh, points: staff ? 0 : VALUE_ADDED.PK_BATTLE.points, staff, mine: board.mine, nextTier });
    } catch (e) {
      await giveBack();
      res.status(400).json({ error: (e as Error).message });
    }
  });

  /**
   * PK 战力榜（v2.68）：查看免费（不扣分），聚合全部 PkBattle → 赛季段位/战力/Top榜。
   * 只展示笔名/昵称，不泄露剧本全文；没有对战记录的用户 mine=null，前端引导"先PK一局上榜"。
   */
  vaRouter.get('/pk/leaderboard', authRequired, async (req: AuthRequest, res) => {
    try {
      const [battles, users] = await Promise.all([
        prisma.pkBattle.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.user.findMany(),
      ]);
      const metaMap: Record<string, { penName?: string; nickname?: string }> = {};
      for (const u of users as any[]) {
        metaMap[u.id] = { penName: u.penName ?? null, nickname: u.nickname ?? null };
      }
      const board = buildRankBoard(battles as any, req.userId!, metaMap, 20);
      const progress = board.mine ? nextTierProgress(board.mine.power) : null;
      res.json({ ok: true, board, nextTier: progress });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  /** 小南深度共创：10积分(1元)/次（基础引导免费，深度咨询扣费，前端须明示） */
  vaRouter.post('/xiaonan', authRequired, async (req: AuthRequest, res) => {
    const question = String(req.body?.question ?? '').slice(0, 2000);
    if (!question) return res.status(400).json({ error: '请输入问题' });
    const refId = `xn:${req.userId}:${idemWindow()}:${nonceOf(req) || contentHash(question)}`;
    const staff = await staffOf(prisma, req.userId!);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(req.userId!, 'XIAONAN_DEEP', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同问题刚已提交，请勿重复发送' });
      idem = r0.idem; charged = true;
      const r = await callText(EngineTier.STANDARD, 'designer', `你是短剧编剧策划小南，专业、口语化地回答：${question}`);
      res.json({ ok: true, answer: r.text, points: staff ? 0 : VALUE_ADDED.XIAONAN_DEEP.points, staff });
    } catch (e) {
      if (charged) await refund(req.userId!, 'XIAONAN_DEEP', refId, idem, staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message });
    }
  });

  return vaRouter;
}

export const vaRouter = createValueAddedRouter(defaultPrisma);
