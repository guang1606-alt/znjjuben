/**
 * 自主进化·自动闭环服务（不依赖外部 cron 库；可被定时器或管理员手动触发，幂等可重复执行）
 * ------------------------------------------------------------------
 * runDailyLearningCycle：采集(榜单/平台规则/站内高分剧本) → 去重 → 自主学习决策 → 落库
 *                        → 自主淘汰过时/相悖技能 → 生成并留存学习报告；
 * runWeeklyModelAudit  ：跑每周 API 全面盘点（铁底/异构/代际/价格），留存报告，作为每周修正依据。
 * 诚信原则：榜单/政策采集器由 deps 注入（官方接口/RSS/运营录入/合规采集），无注入则该来源为空，绝不编造市场数据。
 */
import { BLOCK_RULES } from '../lib/content-safety';
import { runSelfLearning, pruneKnowledge, buildLearningReport, StoredKnowledge } from '../engine/self-learning';
import {
  collectAllSignals, onlyNewSignals, KeyedLearnSignal, PolicyDoc, TopScriptLike,
} from '../engine/signal-sources';
import { auditPortfolio, ModelAuditReport, AuditInput } from '../engine/model-audit';
import type { BoardItem } from '../engine/context-personalization';

export interface AutoDeps {
  collectBoards?: () => Promise<BoardItem[]>;
  collectPolicy?: () => Promise<PolicyDoc[]>;
}
export type SourceReason = 'OK' | 'NO_COLLECTOR' | 'EMPTY_COLLECTOR' | 'COLLECTOR_ERROR' | 'EMPTY_TABLE' | 'QUERY_ERROR';
export interface SourceStatus {
  count: number;
  reason: SourceReason;
  error?: string;
}
export interface CycleSources {
  boards: SourceStatus;
  policy: SourceStatus;
  topScripts: SourceStatus;
}
export interface DailyCycleResult {
  collected: number; fresh: number; skippedKnown: number;
  report: ReturnType<typeof buildLearningReport>;
  created: { id: string; title: string; decision: string; confidence: number }[];
  archived: { id: string; title: string; reason: string }[];
  reportId?: string;
  /** v2.186：三类采集源的可见性诊断，让"采集0"的原因可定位（避免静默回退） */
  sources: CycleSources;
}

function parseJson<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return null; } }
  return v as T;
}
/** 当前合规 BLOCK 导向词，供自主淘汰：已生效技能若含违规导向，立即下架复核 */
export function currentPolicyBlockWords(): string[] {
  return BLOCK_RULES.flatMap((r) => r.patterns);
}

/**
 * v2.186：显式记录每类采集源的可见性状态。
 * 诚信原则不变：采集器缺失返回空，绝不编造；但要让"空"的原因可定位。
 * - NO_COLLECTOR：deps 未注入该采集器
 * - EMPTY_COLLECTOR：注入了但返回 []
 * - COLLECTOR_ERROR：注入了但抛错（带原始 message）
 * - EMPTY_TABLE：站内 script 表无 qcPassed=true 行
 * - QUERY_ERROR：script.findMany 抛错（带原始 message）
 * - OK：正常采集到 ≥1 条
 */
async function collectBoardsSafe(fn?: () => Promise<BoardItem[]>): Promise<{ data: BoardItem[]; status: SourceStatus }> {
  if (!fn) return { data: [], status: { count: 0, reason: 'NO_COLLECTOR' } };
  try {
    const data = await fn();
    return { data, status: { count: data.length, reason: data.length === 0 ? 'EMPTY_COLLECTOR' : 'OK' } };
  } catch (e) {
    return { data: [], status: { count: 0, reason: 'COLLECTOR_ERROR', error: (e as Error).message } };
  }
}
async function collectPolicySafe(fn?: () => Promise<PolicyDoc[]>): Promise<{ data: PolicyDoc[]; status: SourceStatus }> {
  if (!fn) return { data: [], status: { count: 0, reason: 'NO_COLLECTOR' } };
  try {
    const data = await fn();
    return { data, status: { count: data.length, reason: data.length === 0 ? 'EMPTY_COLLECTOR' : 'OK' } };
  } catch (e) {
    return { data: [], status: { count: 0, reason: 'COLLECTOR_ERROR', error: (e as Error).message } };
  }
}
async function collectTopScriptsSafe(prisma: any): Promise<{ data: TopScriptLike[]; status: SourceStatus }> {
  let topRaw: any[];
  try {
    topRaw = await prisma.script.findMany({
      where: { qcPassed: true }, orderBy: { createdAt: 'desc' }, take: 50,
    });
  } catch (e) {
    return { data: [], status: { count: 0, reason: 'QUERY_ERROR', error: (e as Error).message } };
  }
  const data: TopScriptLike[] = topRaw.map((s: any) => ({
    id: s.id, synopsis: s.synopsis ?? '', qcReport: parseJson<NonNullable<TopScriptLike['qcReport']>>(s.qcReport),
  })).filter((s: TopScriptLike) => s.synopsis);
  return { data, status: { count: data.length, reason: data.length === 0 ? 'EMPTY_TABLE' : 'OK' } };
}

export async function runDailyLearningCycle(prisma: any, deps: AutoDeps = {}, createdById?: string): Promise<DailyCycleResult> {
  // 1) 采集三类信号（v2.186：显式记录每类源的状态，避免静默回退）
  const [boardsR, policyR, topR] = await Promise.all([
    collectBoardsSafe(deps.collectBoards),
    collectPolicySafe(deps.collectPolicy),
    collectTopScriptsSafe(prisma),
  ]);
  const boards = boardsR.data; const policyUpdates = policyR.data; const topScripts = topR.data;
  const signals: KeyedLearnSignal[] = collectAllSignals({ boards, policyUpdates, topScripts });
  const sources: CycleSources = { boards: boardsR.status, policy: policyR.status, topScripts: topR.status };

  // 2) 跨轮去重：已学过的 learnKey 不再重复入库
  const learned = await prisma.knowledgeItem.findMany({
    where: { source: 'AUTO', NOT: { learnKey: null } }, select: { learnKey: true },
  }).catch(() => [] as { learnKey: string | null }[]);
  const learnedKeys = new Set(learned.map((x: { learnKey: string | null }) => x.learnKey).filter(Boolean) as string[]);
  const { fresh, skipped } = onlyNewSignals(signals, learnedKeys);

  // 3) 自主学习决策
  const stored: StoredKnowledge[] = await prisma.knowledgeItem.findMany().catch(() => [] as any[]);
  const cycle = runSelfLearning(fresh as unknown as Parameters<typeof runSelfLearning>[0], stored);

  // 4) 落库（自动生效/待审，带 learnKey 与置信度）
  const created: DailyCycleResult['created'] = [];
  for (const c of cycle.candidates) {
    const item = await prisma.knowledgeItem.create({
      data: {
        kind: 'TEXT', title: c.title.slice(0, 200), content: c.content.slice(0, 500_000),
        category: c.category, status: c.decision === 'AUTO_APPROVE' ? 'APPROVED' : 'PENDING',
        source: 'AUTO', confidence: c.confidence, conflictNote: c.conflictNote, learnKey: c.key ?? null,
        approvedAt: c.decision === 'AUTO_APPROVE' ? new Date() : null, uploadedById: createdById ?? null,
      },
    });
    created.push({ id: item.id, title: c.title, decision: c.decision, confidence: c.confidence });
  }

  // 5) 自主淘汰：过时/被替代/与最新合规相悖 → 归档
  const prune = pruneKnowledge(stored, { blockedByPolicy: currentPolicyBlockWords() });
  const archived: DailyCycleResult['archived'] = [];
  for (const a of prune.archived) {
    await prisma.knowledgeItem.update({
      where: { id: a.id }, data: { status: 'ARCHIVED', pruneReason: a.reason, archivedAt: new Date() },
    }).catch(() => null);
    archived.push(a);
  }

  // 6) 学习报告留痕
  const report = buildLearningReport(cycle, prune);
  const row = await prisma.learningReport.create({
    data: { kind: 'DAILY_LEARN', summary: report.summary, text: report.text, createdById: createdById ?? null },
  }).catch(() => null);

  return { collected: signals.length, fresh: fresh.length, skippedKnown: skipped, report, created, archived, reportId: row?.id, sources };
}

export interface WeeklyAuditResult { report: ModelAuditReport; reportId?: string }
export async function runWeeklyModelAudit(prisma: any, input: AuditInput = {}, createdById?: string): Promise<WeeklyAuditResult> {
  const report = auditPortfolio(input);
  const row = await prisma.learningReport.create({
    data: { kind: 'WEEKLY_MODEL', summary: report.summary as unknown as object, text: report.text, createdById: createdById ?? null },
  }).catch(() => null);
  return { report, reportId: row?.id };
}
