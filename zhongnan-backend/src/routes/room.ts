/**
 * room.ts —— 编剧室路由：选题会 + 剧本围读（创作工具箱协作功能）
 *  - 选题会：用户与小南（多席位）开创作会，三硬维度判断 + 选题决议
 *  - 围读四模式：me_xn / user_user / me_other_xn / xn_xn，异步围读室 + 邀请码
 *  - 小南多席位发言按增值服务扣积分（PITCH_MEETING / TABLE_READ），前端须明示价格；服务失败自动退款
 */
import { randomBytes, createHash } from 'crypto';
import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { prisma as defaultPrisma } from '../lib/prisma';
import { consumeValueAdded, refundValueAdded } from '../lib/billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { VALUE_ADDED, ValueAddedKey, MemberLevel } from '../config/pricing';
import { staffOf, staffChargeTx, staffRefundTx } from '../lib/staff-billing';
import { assistantGate, fixActionByDim } from '../config/assistant-capability';
import {
  openPitchMeeting, decidePitch, PITCH_SEATS, pitchSeats,
  aiTableRead, buildReadRewritePacks, READ_SEATS, READ_MODES, readSeats, readModes, ReadMode, WrLang,
} from '../engine/writers-room';
const normLang = (l: any): WrLang => (l === 'en' ? 'en' : 'zh');

type PrismaLike = typeof defaultPrisma;

/** 邀请码：8位、去除易混字符（0/O/1/I/L），配合 join 失败计数防爆破 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genInviteCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** 邀请码尝试限流：同 IP+码 连续失败 5 次后锁定 15 分钟（内存计数，重启清空；生产可换 Redis） */
const joinFail = new Map<string, { count: number; until: number }>();
function joinThrottleKey(ip: string, code: string) { return `${ip}:${code}`; }
function joinAttemptBlocked(ip: string, code: string): boolean {
  const rec = joinFail.get(joinThrottleKey(ip, code));
  return !!rec && Date.now() < rec.until && rec.count >= 5;
}
function noteJoinFail(ip: string, code: string) {
  const k = joinThrottleKey(ip, code);
  const rec = joinFail.get(k) ?? { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 5) rec.until = Date.now() + 15 * 60 * 1000;
  joinFail.set(k, rec);
}
function clearJoinFail(ip: string, code: string) { joinFail.delete(joinThrottleKey(ip, code)); }

export function createRoomRouter(prisma: PrismaLike | any) {
  const router = asyncRouter();

  /**
   * 确定性幂等扣费（杜绝 Date.now() 当幂等键导致的重复扣费）：
   * refId = 业务动作 + 实体 + 参数哈希 + 5分钟时间窗。窗内重复提交（双击/重试）直接 409；
   * 窗内上次扣费已退款（下游失败）时放行并以 aN 递增尝试号；窗外重新计费（允许再次消费）。
   * 返回 charged=false 表示幂等撞车，调用方应短路 409。
   */
  const IDEM_WINDOW_MS = 5 * 60 * 1000;
  const idemWindow = () => `w${Math.floor(Date.now() / IDEM_WINDOW_MS)}`;
  const contentHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 20);
  /** 客户端幂等令牌（Idempotency-Key 头或 body.clientToken）：同令牌重试不重复扣费，换新令牌允许再次消费 */
  const nonceOf = (req: AuthRequest): string => {
    const h = (req.get?.('idempotency-key') as string | undefined) || (req.headers?.['idempotency-key'] as string | undefined);
    const b = (req.body as any)?.clientToken != null ? String((req.body as any).clientToken) : '';
    const v = (typeof h === 'string' ? h.trim() : '') || b.trim();
    return v ? `t${contentHash(v.slice(0, 200))}` : '';
  };
  async function charge(userId: string, key: ValueAddedKey, refId: string, staff: boolean): Promise<{ charged: boolean; idem: string }> {
    return await withBillingTransaction(prisma, userId, async (tx) => {
      if (staff) return staffChargeTx(tx, userId, refId, 'staff-room');
      const raw = tx.raw as any;
      const charges = await raw.ledgerEntry.findMany({ where: { userId, reason: key, refType: 'value_added', refId } });
      const refunds = await raw.ledgerEntry.findMany({ where: { userId, reason: `${key}:REFUND`, refType: 'value_added', refId } });
      if (charges.length > refunds.length) return { charged: false, idem: '' };
      const idem = `room:${refId}:a${charges.length + 1}`;
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
  async function addMsg(roomId: string, m: { speakerType: 'USER' | 'XN'; speakerUserId?: string | null; seat?: string | null; speakerName?: string | null; content: string; meta?: any }) {
    return prisma.roomMessage.create({ data: { roomId, ...m } });
  }
  /**
   * c197：汇总本房全部历史真人发言（按时间正序、去重、截断 8000 字）。
   * 多轮会议产品的判定（主持追问 / 最终决议）必须消费全量讨论，而不是只看当前帧，
   * 否则用户第 1 轮交代的关键信息在第 2 轮和决议里全部丢失——"开会讨论"就成了表演。
   */
  async function userDiscussion(roomId: string): Promise<string> {
    const msgs = await prisma.roomMessage.findMany({
      where: { roomId, speakerType: 'USER' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const m of msgs as Array<{ content?: string | null }>) {
      const c = String(m.content || '').trim();
      if (c && !seen.has(c)) { seen.add(c); parts.push(c); }
    }
    return parts.join('\n').slice(0, 8000);
  }
  /** 仅房主或被邀请参与者可访问 */
  async function accessibleRoom(id: string, userId: string) {
    const room = await prisma.writersRoom.findUnique({ where: { id } });
    if (!room) return { error: 404 as const };
    if (room.ownerId !== userId && !(room.participantIds || []).includes(userId)) return { error: 403 as const };
    return { room };
  }

  /* ---------------- 选题会 ---------------- */

  // 开场：生成议程与各席位关键问题（扣一次选题会费）
  router.post('/pitch/open', authRequired, async (req: AuthRequest, res) => {
    const schema = z.object({
      idea: z.string().min(2).max(4000),
      audience: z.string().max(100).optional(),
      medium: z.string().max(40).optional(),
      tags: z.array(z.string().max(40)).max(30).optional(),
      title: z.string().max(120).optional(),
      lang: z.enum(['zh', 'en']).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '创意描述过短或参数不合法' });
    const userId = req.userId!;
    const lang = normLang(p.data.lang);
    const refId = `pitchopen:${userId}:${idemWindow()}:${nonceOf(req) || contentHash(JSON.stringify(p.data))}`;
    const staff = await staffOf(prisma, userId);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(userId, 'PITCH_MEETING', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同请求正在处理或刚已提交，请勿重复操作' });
      idem = r0.idem; charged = true;
      const opened = openPitchMeeting(p.data, lang);
      const seats = pitchSeats(lang);
      let code = genInviteCode();
      for (let i = 0; i < 5; i++) {
        const exist = await prisma.writersRoom.findUnique({ where: { inviteCode: code } });
        if (!exist) break;
        code = genInviteCode();
      }
      const room = await prisma.writersRoom.create({
        data: {
          ownerId: userId, kind: 'PITCH', title: p.data.title || p.data.idea.slice(0, 20),
          scriptText: p.data.idea, state: 'ACTIVE', inviteCode: code,
          participantIds: [userId], pointsCost: staff ? 0 : VALUE_ADDED.PITCH_MEETING.points,
          payload: { audience: p.data.audience, medium: p.data.medium, tags: p.data.tags, opened, lang },
        },
      });
      await addMsg(room.id, { speakerType: 'XN', seat: 'host', speakerName: lang === 'en' ? 'Xiaonan (host)' : '小南(主持)', content: lang === 'en' ? `Pitch meeting started. Agenda:\n${opened.agenda.join('\n')}` : `选题会开始。流程：\n${opened.agenda.join('\n')}` });
      for (const q of opened.questions) {
        const seat = seats.find((s) => s.role === q.seat);
        await addMsg(room.id, { speakerType: 'XN', seat: q.seat, speakerName: seat?.name || q.seat, content: lang === 'en' ? `${q.question}\n(Why I ask: ${q.why})` : `${q.question}\n（为什么问：${q.why}）` });
      }
      for (const h of opened.hints) await addMsg(room.id, { speakerType: 'XN', seat: 'host', speakerName: lang === 'en' ? 'Xiaonan (host)' : '小南(主持)', content: h });
      res.json({ ok: true, roomId: room.id, inviteCode: code, points: staff ? 0 : VALUE_ADDED.PITCH_MEETING.points, staff, opened });
    } catch (e) {
      if (charged) await refund(userId, 'PITCH_MEETING', refId, idem, staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // 用户在会上发言，主持人小南回应（每轮扣一次）
  router.post('/pitch/:id/speak', authRequired, async (req: AuthRequest, res) => {
    const content = String(req.body?.content ?? '').trim().slice(0, 4000);
    if (!content) return res.status(400).json({ error: '请先说点什么' });
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '会议不存在' : '无权访问' });
    const userId = req.userId!;
    const refId = `pitchspeak:${userId}:${got.room.id}:${idemWindow()}:${nonceOf(req) || contentHash(content)}`;
    const staff = await staffOf(prisma, userId);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(userId, 'PITCH_MEETING', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同发言刚已提交，请勿重复发送' });
      idem = r0.idem; charged = true;
      await addMsg(got.room.id, { speakerType: 'USER', speakerUserId: userId, content });
      // 主持人结合当前信息判断还缺哪些关键判断（规则确定性产出，无模型也能主持）
      const lang = normLang((got.room.payload || {}).lang);
      // c197：combined 必须包含全部历史发言（当前这条已在上面入库，会被一并拉出），而非只有当前帧
      const combined = `${got.room.scriptText || ''}\n${await userDiscussion(got.room.id)}`;
      const fa = openPitchMeeting({ idea: combined }, lang);
      const missing: string[] = [];
      if (lang === 'en') {
        if (!/(want|take back|decide|find out|prove|escape|scheme|fight back|goal|plan)/i.test(combined)) missing.push('The lead’s active goal at the opening is still unclear');
        if (!/(who|boss|rival|antagonist|ex-|creditor|mother-in-law|opponent)/i.test(combined)) missing.push('The main opposing party / relationships are not named yet');
        if (!/(episode|scene|cost|medium|live-action|AIGC|motion-comic)/i.test(combined)) missing.push('Episode scale and production medium/cost not estimated yet');
      } else {
        if (!/(想要|夺回|决定|查清|证明|逃离|布局|反抗|目标)/.test(combined)) missing.push('主角开场的主动目标还不够清楚');
        if (!/(谁|对手|婆婆|老板|反派|对方|债主)/.test(combined)) missing.push('主要对抗方/人物关系还没点明');
        if (!/(集|场景|成本|载体|真人|AI|漫剧)/.test(combined)) missing.push('集数规模与制作载体/成本还没估');
      }
      const reply = missing.length
        ? (lang === 'en'
          ? `Got it. To reach a reliable verdict we still need:\n${missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\nKeep adding, or tap “Form pitch verdict” and I’ll give green-light/hold/reject on current info.`
          : `收到。要形成可靠决议，还差：\n${missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n你可以继续补充，或直接点“形成选题决议”，我会按现有信息给立项/缓议/否决判断。`)
        : (lang === 'en'
          ? 'Key information is fairly complete — tap “Form pitch verdict” for the call and an executable pitch card.'
          : '关键信息已经比较齐了，建议点“形成选题决议”，我来出立项判断和可执行选题卡。');
      const msg = await addMsg(got.room.id, { speakerType: 'XN', seat: 'host', speakerName: '小南(主持)', content: reply, meta: { missing } });
      res.json({ ok: true, reply, messageId: msg.id, points: staff ? 0 : VALUE_ADDED.PITCH_MEETING.points, staff, questions: fa.questions });
    } catch (e) {
      if (charged) await refund(userId, 'PITCH_MEETING', refId, idem, staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // 形成选题决议（扣一次）
  router.post('/pitch/:id/decide', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '会议不存在' : '无权访问' });
    const userId = req.userId!;
    const refId = `pitchdecide:${userId}:${got.room.id}:${idemWindow()}:${nonceOf(req) || contentHash(JSON.stringify(req.body ?? {}))}`;
    const staff = await staffOf(prisma, userId);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(userId, 'PITCH_MEETING', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '决议刚已生成，请勿重复提交' });
      idem = r0.idem; charged = true;
      const prev = got.room.payload || {};
      const lang = normLang(prev.lang);
      // c197：决议必须消费会上全部历史发言，否则用户讨论出的主动目标/对抗方在决议卡中全部消失
      const discussion = await userDiscussion(got.room.id);
      const ideaText = [got.room.scriptText || '', discussion, String(req.body?.extra || '')]
        .map((s) => String(s || '').trim()).filter(Boolean).join('\n').slice(0, 8000);
      const verdict = decidePitch({
        idea: ideaText,
        audience: req.body?.audience || prev.audience,
        medium: req.body?.medium || prev.medium,
        relation: req.body?.relation, conflict: req.body?.conflict, scenes: req.body?.scenes,
        episodes: req.body?.episodes ? Number(req.body.episodes) : undefined,
      }, lang);
      await prisma.writersRoom.update({ where: { id: got.room.id }, data: { state: 'DECIDED', payload: { ...prev, verdict } } });
      const text = lang === 'en'
        ? `[Pitch verdict · ${verdict.decisionText}]\nLogline: ${verdict.logline}\nRelationships: ${verdict.relations}\nConflict space: ${verdict.conflictSpace}\nSuggested episodes: ${verdict.episodes} | Audience: ${verdict.audience} | Medium: ${verdict.medium} | Difficulty: ${verdict.difficulty}\nScores: Market ${verdict.scores.market} Story ${verdict.scores.story} Feasibility ${verdict.scores.feasibility} Novelty ${verdict.scores.novelty} (overall ${verdict.scores.total})\nRisks: ${(verdict.risks.length ? verdict.risks : ['No obvious hard flaw']).join('; ')}\nFixes: ${verdict.fixes.join('; ')}`
        : `【选题决议·${verdict.decisionText}】\n一句话卖点：${verdict.logline}\n人物关系：${verdict.relations}\n冲突空间：${verdict.conflictSpace}\n建议集数：${verdict.episodes}集｜受众：${verdict.audience}｜载体：${verdict.medium}｜制作难度：${verdict.difficulty}\n评分：市场${verdict.scores.market} 故事${verdict.scores.story} 可行${verdict.scores.feasibility} 新颖${verdict.scores.novelty}（综合${verdict.scores.total}）\n风险：${(verdict.risks.length ? verdict.risks : ['无明显硬伤']).join('；')}\n修改建议：${verdict.fixes.join('；')}`;
      await addMsg(got.room.id, { speakerType: 'XN', seat: 'host', speakerName: lang === 'en' ? 'Xiaonan (host)' : '小南(主持)', content: text, meta: { verdict } });
      res.json({ ok: true, verdict, points: staff ? 0 : VALUE_ADDED.PITCH_MEETING.points, staff });
    } catch (e) {
      if (charged) await refund(userId, 'PITCH_MEETING', refId, idem, staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message });
    }
  });

  /* ---------------- 剧本围读 ---------------- */

  // 建围读室（不扣费，选模式；user_user/me_other_xn 靠邀请码拉人）
  router.post('/read/open', authRequired, async (req: AuthRequest, res) => {
    const schema = z.object({
      readMode: z.enum(['me_xn', 'user_user', 'me_other_xn', 'xn_xn']),
      title: z.string().max(120).optional(),
      scriptId: z.string().optional(),
      scriptText: z.string().max(200000).optional(),
      mode: z.enum(['LIVE', 'AIGC']).optional(),
      lang: z.enum(['zh', 'en']).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '参数不合法' });
    if (!p.data.scriptId && !(p.data.scriptText || '').trim()) return res.status(400).json({ error: '请选择作品或粘贴剧本文本' });
    let scriptText = p.data.scriptText || '';
    if (p.data.scriptId) {
      // 必须校验剧本归属：否则任意登录用户凭 scriptId 即可把他人全文存入围读室再取回（IDOR）
      const sc = await prisma.script.findFirst({ where: { id: p.data.scriptId }, include: { project: true } });
      // v2.295：已删=不存在——已删项目的剧本不得复活进围读室（否则全文入房并可凭邀请码外溢）
      if (!sc || sc.project?.status === 'deleted') return res.status(404).json({ error: '所选剧本不存在' });
      if (!sc.project || sc.project.userId !== req.userId) return res.status(403).json({ error: '只能围读自己的剧本' });
      scriptText = sc.content;
    }
    const lang = normLang(p.data.lang);
    let code = genInviteCode();
    for (let i = 0; i < 5; i++) {
      const exist = await prisma.writersRoom.findUnique({ where: { inviteCode: code } });
      if (!exist) break;
      code = genInviteCode();
    }
    const modeName = readModes(lang).find((m) => m.id === p.data.readMode)?.name;
    const room = await prisma.writersRoom.create({
      data: {
        ownerId: req.userId!, kind: 'READ', readMode: p.data.readMode, title: p.data.title || (lang === 'en' ? 'Untitled read' : '未命名围读'),
        scriptId: p.data.scriptId, scriptText, state: 'ACTIVE', inviteCode: code,
        participantIds: [req.userId!], payload: { scriptMode: p.data.mode || 'LIVE', lang },
      },
    });
    await addMsg(room.id, { speakerType: 'XN', seat: 'host', speakerName: lang === 'en' ? 'Xiaonan notes' : '小南记录', content: lang === 'en'
      ? `Read room created (mode: ${modeName}). Editor/Director/Producer/Audience will raise issues by stance and form a fix list.${p.data.readMode === 'xn_xn' ? ' This is an automatic Xiaonan read — tap “Start AI read” for unattended output.' : ` Invite code: ${code}, share it to invite others.`}`
      : `围读室已建立（模式：${modeName}）。责编/导演/制片/观众将逐立场提问题并形成修改清单。${p.data.readMode === 'xn_xn' ? '本模式为小南自动围读，点“开始AI围读”即可无人值守产出。' : `邀请码：${code}，可邀请他人加入。`}` });
    res.json({ ok: true, roomId: room.id, inviteCode: code, readModes: readModes(lang), seats: readSeats(lang) });
  });

  // 凭邀请码加入（user_user / me_other_xn）
  router.post('/read/join', authRequired, async (req: AuthRequest, res) => {
    const code = String(req.body?.inviteCode || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: '请输入邀请码' });
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (joinAttemptBlocked(ip, code)) return res.status(429).json({ error: '尝试次数过多，请15分钟后再试' });
    const room = await prisma.writersRoom.findUnique({ where: { inviteCode: code } });
    if (!room || room.kind !== 'READ') { noteJoinFail(ip, code); return res.status(404).json({ error: '邀请码无效' }); }
    // c203：私人模式不接受拉人——me_xn（我与小南私密围读）与 xn_xn（无人值守自动围读）从设计上就没有
    // “邀请他人”语义（open 注释明示只有 user_user/me_other_xn 靠邀请码拉人）。若放行，join 者经
    // accessibleRoom 即被 GET /:id/messages 放行，而消息流响应携带整个 room 对象（含 scriptText 剧本
    // 全文）——私密剧本会随邀请码泄漏被整本端走。故此处 403 切断，不计入爆破失败计数（码本身有效）。
    if (room.readMode !== 'user_user' && room.readMode !== 'me_other_xn') {
      return res.status(403).json({ error: '该围读模式不支持邀请加入（仅“双人围读/我与他人小南”可拉人）' });
    }
    clearJoinFail(ip, code);
    // c203：重复 join 幂等——已是参与者直接返回成功，不再重复写“进入围读室”消息刷屏
    if ((room.participantIds || []).includes(req.userId!)) {
      return res.json({ ok: true, roomId: room.id, readMode: room.readMode });
    }
    const ids = [...(room.participantIds || []), req.userId!];
    await prisma.writersRoom.update({ where: { id: room.id }, data: { participantIds: ids } });
    await addMsg(room.id, { speakerType: 'USER', speakerUserId: req.userId!, content: (room.payload as any)?.lang === 'en' ? 'Joined the read room' : '进入围读室' });
    res.json({ ok: true, roomId: room.id, readMode: room.readMode });
  });

  // 真人发言（user_user 异步讨论，不扣AI费）
  router.post('/read/:id/speak', authRequired, async (req: AuthRequest, res) => {
    const content = String(req.body?.content ?? '').trim().slice(0, 8000);
    if (!content) return res.status(400).json({ error: '请输入发言' });
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '围读室不存在' : '无权访问' });
    const msg = await addMsg(got.room.id, { speakerType: 'USER', speakerUserId: req.userId!, content });
    res.json({ ok: true, messageId: msg.id });
  });

  // AI 围读：四立场扫描 + 修改清单（扣一次围读费；触发者付费，owner/参与者均可）
  router.post('/read/:id/ai-read', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '围读室不存在' : '无权访问' });
    const userId = req.userId!;
    const refId = `readai:${userId}:${got.room.id}:${idemWindow()}:${nonceOf(req) || contentHash(JSON.stringify(req.body ?? {}))}`;
    const staff = await staffOf(prisma, userId);
    let idem = '';
    let charged = false;
    try {
      const r0 = await charge(userId, 'TABLE_READ', refId, staff);
      if (!r0.charged) return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '围读刚已提交，请勿重复操作' });
      idem = r0.idem; charged = true;
      const lang = normLang((got.room.payload || {}).lang);
      // c199：重跑围读允许换制式（LIVE/AIGC 字数尺子不同，用户在面板切换 select 后必须生效，
      // 不能被开房时的 payload 永久覆盖成死控件）；白名单外的值容错忽略，并把有效选择回写 payload。
      const prevPayload = got.room.payload || {};
      const askedMode = req.body?.mode === 'AIGC' || req.body?.mode === 'LIVE' ? req.body.mode : null;
      const scriptMode = (askedMode || prevPayload.scriptMode || 'LIVE') as 'LIVE' | 'AIGC';
      // c198：围读结论必须消费本房真人讨论（c197 userDiscussion 已做全量历史/去重/截断）；
      // xn_xn 无人模式引擎内部不消费，传空串省一次无意义查询。
      const discussion = got.room.readMode === 'xn_xn' ? '' : await userDiscussion(got.room.id);
      const result = aiTableRead({ script: got.room.scriptText || '', title: got.room.title, mode: scriptMode, modeRead: got.room.readMode as ReadMode, discussion }, lang);
      // 每个席位一条发言（同席位多条合并，避免刷屏）
      const bySeat = new Map<string, typeof result.notes>();
      for (const n of result.notes) {
        if (!bySeat.has(n.seat)) bySeat.set(n.seat, []);
        bySeat.get(n.seat)!.push(n);
      }
      for (const [seat, list] of bySeat) {
        const seatName = list[0].seatName;
        const body = list.map((n) => lang === 'en'
          ? `[${n.priority}][${n.kind} @ ${n.location}] ${n.problem}\n→Fix: ${n.suggestion}`
          : `[${n.priority}][${n.kind}@${n.location}] ${n.problem}\n→改法：${n.suggestion}`).join('\n');
        await addMsg(got.room.id, { speakerType: 'XN', seat, speakerName: seatName, content: body || (lang === 'en' ? 'No hard flaw from this seat — keep it up.' : '本席暂无硬伤，继续保持。'), meta: { notes: list } });
      }
      const discussionLine = result.discussionPoints.length
        ? (lang === 'en'
          ? `\nLive discussion:\n${result.discussionPoints.map((p) => `- [${p.seatName}] ${p.adopted ? 'converged' : 'new flag'}: ${p.point}`).join('\n')}`
          : `\n真人讨论采纳：\n${result.discussionPoints.map((p) => `- [${p.seatName}]${p.adopted ? '已采纳' : '新增关注'}：${p.point}`).join('\n')}`)
        : '';
      const hostText = lang === 'en'
        ? `[Read conclusion] ${result.summary}\nScene cost: ${result.sceneCost.sceneCount} scenes, level "${result.sceneCost.level}"${result.sceneCost.highCostHits.length ? ` (high-cost: ${result.sceneCost.highCostHits.join(', ')})` : ''}\nScores: Rhythm ${result.scores.rhythm} De-AI ${result.scores.deAi} Grounded ${result.scores.grounded} (overall ${result.scores.overall})\nFix list:\n${result.actionItems.join('\n') || 'No P0/P1 items'}${discussionLine}`
        : `【围读结论】${result.summary}\n场景成本：${result.sceneCost.sceneCount}个场景，成本等级「${result.sceneCost.level}」${result.sceneCost.highCostHits.length ? `（高成本元素：${result.sceneCost.highCostHits.join('、')}）` : ''}\n评分：节奏${result.scores.rhythm} 去AI${result.scores.deAi} 落地${result.scores.grounded}（综合${result.scores.overall}）\n修改清单：\n${result.actionItems.join('\n') || '无P0/P1项'}${discussionLine}`;
      await addMsg(got.room.id, { speakerType: 'XN', seat: 'host', speakerName: lang === 'en' ? 'Xiaonan notes' : '小南记录', content: hostText });
      await prisma.writersRoom.update({ where: { id: got.room.id }, data: { payload: { ...prevPayload, scriptMode, lastRead: result } } });
      res.json({ ok: true, result, points: staff ? 0 : VALUE_ADDED.TABLE_READ.points, staff });
    } catch (e) {
      if (charged) await refund(userId, 'TABLE_READ', refId, idem, staff).catch(() => {});
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // c200 围读结论 → 定点改写包（只读 / 零扣费 / 确定性）：把本房 lastRead 的 P0/P1 意见重建成 /fix 可消费的 pack，
  // 让围读结论能一键带去作品页改写，而不是只能手抄。
  //  - 粘贴文本房 scriptId 为空：linked=false（无项目落点，前端只保留复制出口，且不泄漏任何 projectId）；
  //  - 关联分集房：回 projectId/epNo/scriptTitle 落点；mine=false 给参与者（/fix 只认项目主人，前端据此禁用，避免点了才403）；
  //  - 权限与房内一致（accessibleRoom），只读不产生任何费用；老 payload.lastRead 缺字段时由纯函数容错为空包。
  router.get('/read/:id/rewrite-pack', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: got.error === 404 ? '围读室不存在' : '无权访问' });
    const room = got.room;
    const payload = (room.payload || {}) as Record<string, any>;
    if (!room.scriptId) {
      return res.json({ ok: true, linked: false, ready: false, packs: [], discussionPoints: [] });
    }
    const sc = await prisma.script.findFirst({ where: { id: room.scriptId }, include: { project: true } });
    if (!sc || !sc.project || sc.project.status === 'deleted') {
      // 分集或项目被删（含软删除，v2.295 名实相符）：退化为无落点，不报错（结论本身仍在房内可复制）
      return res.json({ ok: true, linked: false, ready: false, packs: [], discussionPoints: [] });
    }
    const mine = sc.project.userId === req.userId;
    // c201 版本漂移名实相符：房内 scriptId 冻结的是开房时那一版；/fix 永远按 epNo 改最新版。
    // 二者不一致时必须显性告知（前端提示“围读基于 vN，改写将作用于最新版 vM”），不许静默错版本。
    const epNo = (sc as any).epNo as number;
    const latest = await prisma.script.findFirst({
      where: { projectId: sc.projectId, epNo },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    const roomVersion = sc.version ?? 1;
    const currentVersion = latest?.version ?? roomVersion;
    const versionDrift = currentVersion > roomVersion;
    // c202：房主漂移后可“基于最新版重新围读”，需要最新版行的真实 id（/read/open 会再做归属校验）；
    // 仅随 mine 分支下发，参与者响应不含任何剧本 id。
    const latestScriptId = latest?.id ?? sc.id;
    const latestVersion = currentVersion;
    // c201 最小权限：参与者只需要意见内容本身（复制/旁观），不得拿到房主的 projectId/scriptId。
    const common = {
      ok: true, linked: true, mine,
      epNo: epNo ?? null, roomVersion, currentVersion, versionDrift,
      scriptTitle: (sc as any).title || sc.project.title || '',
      roomTitle: room.title || '', scriptMode: payload.scriptMode || 'LIVE',
    };
    const lastRead = payload.lastRead;
    if (!lastRead || typeof lastRead !== 'object') {
      return res.json(mine ? { ...common, projectId: sc.projectId, scriptId: sc.id, latestScriptId, latestVersion, ready: false, packs: [], discussionPoints: [] }
        : { ...common, ready: false, packs: [], discussionPoints: [] });
    }
    const rawPacks = buildReadRewritePacks(lastRead.notes, { lang: normLang(payload.lang) });
    const discussionPoints = Array.isArray(lastRead.discussionPoints) ? lastRead.discussionPoints : [];
    // c201 会员闸门元数据：等级只信服务端 DB（与 /fix 同一判定函数 fixActionByDim+assistantGate），
    // 前端据此提前置灰并标注所需等级；安全拦截仍在 /fix，这里只做引导，不改变任何扣费语义。
    let packs = rawPacks;
    if (mine) {
      const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
      const level = ((me?.level ?? MemberLevel.FREE) as MemberLevel);
      packs = rawPacks.map((pk) => {
        const gate = assistantGate(level, fixActionByDim(pk.fix.dimLabel || '', pk.fix.rule));
        return { ...pk, gate: { allowed: gate.allowed, needLevel: gate.needLevel } };
      });
    }
    res.json(mine
      ? { ...common, projectId: sc.projectId, scriptId: sc.id, latestScriptId, latestVersion, ready: true, packs, discussionPoints }
      : { ...common, ready: true, packs, discussionPoints });
  });

  // 我的编剧室列表（c196：摘要分层——scriptText 可达数千字、payload 含议程/决议/围读结果大 Json，
  // 100 条全量回包过重；完整房间与消息流走 GET /:id/messages。state 表达进度：ACTIVE/DECIDED/CLOSED。
  // c197：凭邀请码加入的参与房（user_user/me_other_xn）同样属于"我的编剧室"，OR 查 owner+参与者并回 role）
  router.get('/mine', authRequired, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const rows = await prisma.writersRoom.findMany({
      where: { OR: [{ ownerId: userId }, { participantIds: { has: userId } }] },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true, kind: true, readMode: true, title: true, state: true,
        inviteCode: true, pointsCost: true, createdAt: true, updatedAt: true, ownerId: true,
      },
    });
    // ownerId 仅用于服务端判定角色，随之下发剔除：列表保持 c196 九摘要白名单，不泄漏内部字段
    // c203 邀请码最小权限：inviteCode 是入场凭证，只随 owner 角色下发；member 拿不到码，
    // 切断“参与者背着房主无限链式拉人”的传播面（房主对房间成员保持控制）。
    const rooms = (rows as Array<Record<string, unknown>>).map((r) => {
      const role = r.ownerId === userId ? 'owner' : 'member';
      const { ownerId: _ownerId, ...rest } = r;
      if (role !== 'owner') delete (rest as Record<string, unknown>).inviteCode;
      return { ...rest, role };
    });
    res.json({ ok: true, rooms });
  });

  // 发言流
  router.get('/:id/messages', authRequired, async (req: AuthRequest, res) => {
    const got = await accessibleRoom(req.params.id, req.userId!);
    if ('error' in got) return res.status(got.error as 404 | 403).json({ error: '无权访问' });
    const msgs = await prisma.roomMessage.findMany({ where: { roomId: got.room.id }, orderBy: { createdAt: 'asc' }, take: 500 });
    const lang = normLang((got.room.payload || {}).lang);
    res.json({ ok: true, room: got.room, messages: msgs, seats: got.room.kind === 'READ' ? readSeats(lang) : pitchSeats(lang), readModes: readModes(lang) });
  });

  return router;
}

export const roomRouter = createRoomRouter(defaultPrisma);
