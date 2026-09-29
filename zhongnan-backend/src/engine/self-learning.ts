/**
 * 自主学习引擎（学习窗口·仅管理员；用户侧不可见）
 * ------------------------------------------------------------------
 * 在“手动上传知识”之外，让工具能：
 *   1) 自主学习：从内部高价值信号（高分剧本、被采用的钩子/节拍、市场热榜、政策更新）提炼候选知识；
 *   2) 自主优化/迭代：高置信、无冗余、无相悖的创作技巧自动生效（标记 AUTO_LEARNED，留抽检）；
 *   3) 自主淘汰：过时（长期未被引用/被新版替代）或与最新法规相悖的已生效技能自动归档（可恢复、不物理删）；
 *   4) 出学习报告：本轮采集/去重/相悖挂起/自动生效/待审/淘汰，全程可追溯。
 * 安全红线：合规/政策类知识永不自动生效，必须人工核（政策不能让机器自行拍板）。
 * 纯函数、可离线对拍；IO 由 routes/knowledge.ts 负责。
 */
import { reconcileKnowledge, ExistingKnowledge } from '../lib/knowledge-dedup';

export const LEARN_CATEGORIES = ['character', 'plot', 'payoff', 'reversal', 'scene', 'dialogue', 'av', 'compliance'] as const;
export type LearnCategory = (typeof LEARN_CATEGORIES)[number];

export type SignalKind = 'HIGH_SCORE_SCRIPT' | 'ADOPTED_PATTERN' | 'MARKET_TREND' | 'POLICY_UPDATE' | 'ADMIN_TEXT';
export interface LearnSignal {
  kind: SignalKind;
  title: string;
  content: string;
  category?: LearnCategory;
  score?: number;       // 信号质量分 0-100（如剧本六维均分、采用次数折算）
  source?: string;      // 来源描述（榜单名/作品id/政策出处）
}
export interface StoredKnowledge {
  id?: string; title: string; content: string; category: string;
  status: string; version?: number; source?: string | null;
  confidence?: number | null; lastReferencedAt?: Date | string | null; approvedAt?: Date | string | null;
  createdAt?: Date | string | null;
}
export interface CandidateKnowledge {
  title: string; content: string; category: LearnCategory;
  source: 'AUTO'; confidence: number;
  decision: 'AUTO_APPROVE' | 'PENDING' | 'DROP';
  reasons: string[];
  conflictNote: string | null;
  key?: string; // 来自学习信号的稳定去重key（signal-sources 透传）
}
export interface LearningCycleResult {
  scanned: number;
  candidates: CandidateKnowledge[];
  autoApproved: CandidateKnowledge[];
  pending: CandidateKnowledge[];
  dropped: { title: string; reason: string }[];
}

const CATEGORY_HINTS: Record<LearnCategory, RegExp> = {
  character: /人设|人物|角色|性格|弧光|声口|动机/,
  plot: /剧情|结构|大纲|节奏|伏笔|主线|转折|叙事/,
  payoff: /爽点|打脸|逆袭|满足|回报|解压/,
  reversal: /反转|翻盘|真相|身份错位/,
  scene: /场景|道具|环境|细节|烟火|氛围|镜头/,
  dialogue: /台词|对白|口语|语气|方言|对话/,
  av: /景别|运镜|光影|分镜|视听|AIGC|画面/,
  compliance: /合规|审核|违禁|法规|办法|平台规则|尺度|备案/,
};
/** 自动归类：hint 优先，其次关键词扫描，兜底 plot */
export function classifyCategory(text: string, hint?: LearnCategory): LearnCategory {
  if (hint && LEARN_CATEGORIES.includes(hint)) return hint;
  let best: LearnCategory = 'plot'; let bestHits = 0;
  (Object.keys(CATEGORY_HINTS) as LearnCategory[]).forEach((c) => {
    const hits = (text.match(new RegExp(CATEGORY_HINTS[c].source, 'g')) || []).length;
    if (hits > bestHits) { bestHits = hits; best = c; }
  });
  return best;
}

function confidenceOf(s: LearnSignal): number {
  // 来源基础分 + 质量分加权；政策更新给中高置信但仍需人工，故不据此自动生效
  const base = s.kind === 'ADOPTED_PATTERN' ? 70 : s.kind === 'HIGH_SCORE_SCRIPT' ? 65 : s.kind === 'POLICY_UPDATE' ? 55 : s.kind === 'MARKET_TREND' ? 50 : 50;
  const score = typeof s.score === 'number' ? Math.max(0, Math.min(100, s.score)) : 50;
  const textBonus = Math.min(10, Math.floor(s.content.length / 50)); // 信息越完整小幅加分，封顶
  return Math.max(0, Math.min(99, Math.round(base * 0.45 + score * 0.5 + textBonus)));
}
const AUTO_APPROVE_MIN = 72; // 达到该置信且非合规类、无冲突，才自动生效

/** 从单条信号提炼候选：去冗/相悖 → 决策（自动生效/待审/丢弃） */
export function mineOne(s: LearnSignal, existing: ExistingKnowledge[]): CandidateKnowledge {
  const category = classifyCategory(`${s.title}\n${s.content}`, s.category);
  const recon = reconcileKnowledge(s.content, category, existing);
  const confidence = confidenceOf(s);
  const reasons: string[] = [];
  let decision: CandidateKnowledge['decision'] = 'PENDING';
  let conflicted = false;
  let conflictNote: string | null = null;

  if (recon.status === 'DUPLICATE') {
    return { title: s.title, content: s.content, category, source: 'AUTO', confidence, decision: 'DROP', reasons: [recon.note], conflictNote: null, key: (s as { key?: string }).key };
  }
  if (recon.status === 'CONFLICT') {
    conflictNote = [...recon.conflicts, recon.note].join('；');
    reasons.push('与既有知识相悖，挂起待人工裁决，不自动生效');
    decision = 'PENDING'; conflicted = true;
  }
  const isCompliance = category === 'compliance' || s.kind === 'POLICY_UPDATE';
  if (!conflicted) {
    if (isCompliance) {
      decision = 'PENDING'; reasons.push('合规/政策类知识必须人工核验，禁止自动生效');
    } else if (confidence >= AUTO_APPROVE_MIN) {
      decision = 'AUTO_APPROVE'; reasons.push(`创作技巧置信度${confidence}≥${AUTO_APPROVE_MIN}、无冗余无相悖，自动生效（标记AUTO_LEARNED待抽检）`);
    } else {
      decision = 'PENDING'; reasons.push(`置信度${confidence}<${AUTO_APPROVE_MIN}，进入待审队列`);
    }
  }
  if (s.source) reasons.push(`来源:${s.source}`);
  return { title: s.title, content: s.content, category, source: 'AUTO', confidence, decision, reasons, conflictNote, key: (s as { key?: string }).key };
}

/** 跑一轮自主学习：批量提炼并分桶 */
export function runSelfLearning(signals: LearnSignal[], stored: StoredKnowledge[]): LearningCycleResult {
  const existing: ExistingKnowledge[] = stored
    .filter((k) => k.status === 'APPROVED' || k.status === 'PENDING')
    .map((k) => ({ content: k.content, category: k.category }));
  const candidates: CandidateKnowledge[] = [];
  const autoApproved: CandidateKnowledge[] = [];
  const pending: CandidateKnowledge[] = [];
  const dropped: { title: string; reason: string }[] = [];
  // 本轮内部也去重：同一内容只留置信度最高的一条
  const seen = new Map<string, CandidateKnowledge>();
  for (const s of signals) {
    if (!s.content || s.content.trim().length < 8) { dropped.push({ title: s.title || '(空)', reason: '内容过短，信息不足' }); continue; }
    const c = mineOne(s, existing);
    if (c.decision === 'DROP') { dropped.push({ title: c.title, reason: c.reasons[0] }); continue; }
    const key = c.content.slice(0, 60);
    const prev = seen.get(key);
    if (prev) { if (c.confidence > prev.confidence) seen.set(key, c); else dropped.push({ title: c.title, reason: '本轮内重复，保留更高置信版本' }); continue; }
    seen.set(key, c);
  }
  seen.forEach((c) => {
    candidates.push(c);
    if (c.decision === 'AUTO_APPROVE') autoApproved.push(c); else pending.push(c);
  });
  return { scanned: signals.length, candidates, autoApproved, pending, dropped };
}

export interface PruneResult { archived: { id: string; title: string; reason: string }[]; kept: number }
export interface PruneOptions {
  now?: Date;
  staleDays?: number;          // 已生效但多少天未被引用即判过时（合规类不据此淘汰）
  blockedByPolicy?: string[];  // 最新合规 BLOCK 命中词，命中即下架
}
/** 自主淘汰：过时/被替代/与最新法规相悖 → ARCHIVED（可恢复，不物理删除）；合规政策类不因“没被引用”而删 */
export function pruneKnowledge(items: StoredKnowledge[], o: PruneOptions = {}): PruneResult {
  const now = o.now ?? new Date();
  const staleDays = o.staleDays ?? 180;
  const archived: PruneResult['archived'] = [];
  // 同标题取最高 version，作为“被新版本替代”的依据
  const latestVer = new Map<string, number>();
  items.forEach((i) => latestVer.set(i.title, Math.max(latestVer.get(i.title) ?? 0, i.version ?? 1)));
  const keptList: StoredKnowledge[] = [];
  for (const it of items) {
    if (it.status !== 'APPROVED') { keptList.push(it); continue; }
    // 1) 与最新合规导向相悖：立即下架（任何类都适用，合规优先）
    const hit = (o.blockedByPolicy ?? []).find((w) => w && it.content.includes(w));
    if (hit) { archived.push({ id: it.id ?? it.title, title: it.title, reason: `与最新法规/平台规则「${hit}」相悖，自动下架待复核` }); continue; }
    // 2) 被新版本替代
    if ((it.version ?? 1) < (latestVer.get(it.title) ?? 1)) { archived.push({ id: it.id ?? it.title, title: it.title, reason: '已被更高版本技能替代，旧版归档' }); continue; }
    // 3) 长期未被引用判过时（合规/政策类豁免——政策不能因冷门而丢）
    if (it.category !== 'compliance' && it.lastReferencedAt) {
      const last = new Date(it.lastReferencedAt); const days = (now.getTime() - last.getTime()) / 86400000;
      if (days > staleDays) { archived.push({ id: it.id ?? it.title, title: it.title, reason: `已${Math.floor(days)}天未被创作链路引用，判为过时归档（可恢复）` }); continue; }
    }
    keptList.push(it);
  }
  return { archived, kept: keptList.length };
}

export interface LearningReport {
  generatedAt: string;
  summary: { scanned: number; autoApproved: number; pending: number; dropped: number; archived: number };
  byCategory: Record<string, number>;
  autoApprovedTitles: string[];
  pendingNeedHuman: string[];
  archivedList: PruneResult['archived'];
  nextActions: string[];
  text: string;
}
/** 汇总一轮学习+淘汰，产出结构化与文本学习报告 */
export function buildLearningReport(cycle: LearningCycleResult, prune: PruneResult): LearningReport {
  const byCategory: Record<string, number> = {};
  cycle.candidates.forEach((c) => { byCategory[c.category] = (byCategory[c.category] ?? 0) + 1; });
  const next: string[] = [];
  if (cycle.pending.length) next.push(`${cycle.pending.length}条待人工裁决（含合规/政策与相悖项），请在学习窗口逐条通过或驳回`);
  if (prune.archived.length) next.push(`${prune.archived.length}条已自动归档，可在归档列表复核或恢复`);
  next.push('对自动生效(AUTO_LEARNED)技能做抽检，用标准测试用例对拍更新前后质量分，退步则回滚');
  const text = [
    `【自主学习报告 ${new Date().toLocaleString('zh-CN')}】`,
    `本轮扫描信号 ${cycle.scanned} 条：自动生效 ${cycle.autoApproved.length}、待人工审 ${cycle.pending.length}、去重/丢弃 ${cycle.dropped.length}、自动淘汰归档 ${prune.archived.length}`,
    `新增分布：${Object.entries(byCategory).map(([k, v]) => `${k}:${v}`).join(' / ') || '无'}`,
    ...next.map((n) => `· ${n}`),
  ].join('\n');
  return {
    generatedAt: new Date().toISOString(),
    summary: { scanned: cycle.scanned, autoApproved: cycle.autoApproved.length, pending: cycle.pending.length, dropped: cycle.dropped.length, archived: prune.archived.length },
    byCategory,
    autoApprovedTitles: cycle.autoApproved.map((c) => c.title),
    pendingNeedHuman: cycle.pending.map((c) => `${c.title}（${c.confidence}分${c.conflictNote ? '｜' + c.conflictNote : ''}）`),
    archivedList: prune.archived,
    nextActions: next,
    text,
  };
}
