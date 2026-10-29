/**
 * aigc-kernel-issues.ts —— AIGC 修复轮的真人内核诊断消费 + 修复后内核重扫（v2.347）
 * ------------------------------------------------------------------
 * 勘察发现的两个结构性缺口：
 *  缺口 1：pipeline 里 42+ 真人内核引擎（爽点/冲突/潜台词/场尾软收尾…）的
 *    场级 high 诊断只进了「打回重写」提示词，没进「AIGC 版式修复轮」的
 *    issueList。打回重写最多 2 轮，2 轮没修完的场级硬伤，AIGC 修复轮看不到
 *    → 只扫不修的尾部漏洞。
 *  缺口 2：AIGC 版式修复循环结束后不重扫内核指标，无法确认版式修复是否
 *    破坏了爽点/冲突/钩子（例如发声比兜底把爽点台词改成了内心独白）。
 *    修完没验证 → "版式修好了、爽点修没了"无从察觉。
 *
 * 本文件提供两个纯函数（确定性、双语、零 IO）：
 *  collectSceneKernelIssues(named) —— 把各内核引擎的 high 级诊断汇总成
 *    带来源前缀的字符串数组，供 AIGC 修复轮追加进 issueList（缺口 1）。
 *  aigcKernelRescan(draft, lang) —— 修复后对爽点/冲突/集尾钩子做一次轻量
 *    重扫，返回 {engine,severity,message}[] 供 SSE warnings 通道（缺口 2）。
 */

import { coolMomentScore } from './cool-moment-score';
import { conflictDensityCheck } from './conflict-density-check';
import { cliffhangerScore } from './cliffhanger-score';

export type KernelLang = 'zh' | 'en';

/** 内核引擎诊断的两种真实形态：对象（{severity,type|message|advice}）或纯字符串 */
export interface KernelIssueObj {
  severity?: string;
  message?: string;
  type?: string;
  advice?: string;
  evidence?: string;
}
export interface NamedKernelIssues {
  name: string;
  issues: Array<KernelIssueObj | string> | undefined | null;
}

/** 引擎中文名映射（修复提示词里的来源前缀，中英链路都用中文标签以保持尺子一致） */
const ENGINE_LABEL: Record<string, string> = {
  sceneSoftEnding: '场尾软收尾',
  scenePadding: '场景注水',
  scenePurpose: '场景目的',
  coolMoment: '爽点密度',
  conflictDensity: '冲突密度',
  subtext: '潜台词',
  cliffhanger: '集尾钩子',
  suspenseTension: '悬念张力',
  payoffRhythm: '憋爽节奏',
  conflictEscalation: '冲突升级',
  twistDensity: '反转密度',
  punchlineDensity: '金句密度',
  informationDensity: '信息密度',
  causalLogic: '因果逻辑',
  antagonistQuality: '反派质量',
  protagonistGoal: '主角目标',
};

/** 默认封顶：修复提示词不能无限长，取影响最大的前 N 条 */
const DEFAULT_CAP = 8;

function issueText(it: KernelIssueObj | string): string {
  if (typeof it === 'string') return it;
  return it.message || it.advice || it.type || it.evidence || '';
}

function isHigh(it: KernelIssueObj | string): boolean {
  // 纯字符串形态没有 severity 元数据，视为需要关注（场级诊断进来即为 high 等价物）
  if (typeof it === 'string') return true;
  return it.severity === 'high';
}

/**
 * 收集各内核引擎的 high 级场级诊断，汇总为带来源前缀的字符串数组。
 * 供 pipeline 的 AIGC 修复轮追加进 issueList，让修复模型看到与打回重写同一份诊断。
 */
export function collectSceneKernelIssues(
  named: NamedKernelIssues[],
  cap: number = DEFAULT_CAP,
): string[] {
  if (!Array.isArray(named) || named.length === 0) return [];
  if (cap <= 0) return []; // 显式上限边界：cap=0 不收集任何诊断
  const out: string[] = [];
  for (const n of named) {
    if (!n || !Array.isArray(n.issues)) continue;
    const label = ENGINE_LABEL[n.name] ?? n.name;
    for (const it of n.issues) {
      if (!isHigh(it)) continue;
      const txt = issueText(it).trim();
      if (!txt) continue;
      out.push(`【${label}】${txt}`);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/** 内核重扫的单一告警结构（SSE warnings 通道消费） */
export interface KernelRescanWarning {
  engine: string;
  severity: 'high' | 'mid' | 'low';
  message: string;
}

interface RawIssue { severity?: string; type?: string; advice?: string; evidence?: string }

function toWarnings(engine: string, issues: RawIssue[] | undefined | null): KernelRescanWarning[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((i) => i && (i.severity === 'high' || i.severity === 'mid'))
    .map((i) => ({
      engine,
      severity: (i.severity === 'high' ? 'high' : 'mid') as 'high' | 'mid',
      message: (i.advice || i.type || i.evidence || '').trim() || engine,
    }));
}

/**
 * AIGC 版式修复后的内核轻量重扫（缺口 2）。
 * 只对「修复动作最容易破坏」的三条生死线重扫：爽点密度 / 冲突密度 / 集尾钩子。
 * 返回告警数组（可为空），调用方据此进 SSE warnings，不阻塞流程只显性化。
 */
export function aigcKernelRescan(draft: string, lang: KernelLang = 'zh'): KernelRescanWarning[] {
  if (!draft || !draft.trim()) return [];
  const warnings: KernelRescanWarning[] = [];
  warnings.push(...toWarnings('coolMoment', coolMomentScore(draft, lang).issues as unknown as RawIssue[]));
  warnings.push(...toWarnings('conflictDensity', conflictDensityCheck(draft, lang).issues as unknown as RawIssue[]));
  warnings.push(...toWarnings('cliffhanger', cliffhangerScore(draft, lang).issues as unknown as RawIssue[]));
  return warnings;
}
