/**
 * 知识自进化的“去冗 · 相悖”机制（PRD 第五章 + 用户要求：去除相悖和冗余，形成机制）
 * 新知识点入库前自动：
 *   1) 查重：与既有知识高度重合 → 判冗余，建议合并/驳回，不重复占用
 *   2) 查悖：同维度下数值区间矛盾 / “必须禁止”与“可以允许”对立 → 判相悖，不生效待裁决
 *   3) 干净知识 → 通过
 * 与学习中心对接：相悖即 PENDING 并写 conflictNote，绝不让互相打架的知识同时生效。
 */
import { textSimilarity } from '../engine/creativity';

export interface ExistingKnowledge { content: string; category: string }
export type ReconcileStatus = 'OK' | 'DUPLICATE' | 'CONFLICT';
export interface ReconcileResult {
  status: ReconcileStatus;
  duplicateOf?: string;
  conflicts: string[];
  note: string;
}

const DUP_THRESHOLD = 0.72; // 允许“换连接词/加语气词”的轻微改写仍被判为冗余

/** 提取“800-1000字 / 1200到1500字”这类数值区间 */
function rangeOf(text: string): [number, number] | null {
  const m = text.match(/(\d{2,5})\s*[-到至~～]\s*(\d{2,5})\s*字/);
  if (!m) return null;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  return [Math.min(a, b), Math.max(a, b)];
}
function rangesOverlap(r1: [number, number], r2: [number, number]): boolean {
  return !(r1[1] < r2[0] || r2[1] < r1[0]);
}
const BAN = /(必须|禁止|不得|严禁|不能)/;
const ALLOW = /(可以|允许|无需|不必|能够)/;

export function reconcileKnowledge(next: string, category: string, existing: ExistingKnowledge[]): ReconcileResult {
  const conflicts: string[] = [];
  let duplicateOf: string | undefined;

  for (const old of existing) {
    const sim = textSimilarity(next, old.content);
    if (sim >= DUP_THRESHOLD && !duplicateOf) {
      duplicateOf = old.content.slice(0, 40);
    }
    if (old.category === category) {
      // 数值区间矛盾（如“单集800-1000字” vs “单集2000-3000字”）
      const rN = rangeOf(next), rO = rangeOf(old.content);
      if (rN && rO && !rangesOverlap(rN, rO)) {
        conflicts.push(`与既有规则“${old.content.slice(0, 30)}…”数值区间不重叠`);
      }
      // 情态对立（同一对象一个禁止、一个允许）
      if (BAN.test(next) !== BAN.test(old.content) && (ALLOW.test(next) || ALLOW.test(old.content))) {
        // 仅当都提到同一关键词时才判，避免误伤
        const topic = (next.match(/[\u4e00-\u9fa5]{2,6}(?=必须|禁止|不得|严禁|可以|允许)/) || [])[0];
        if (topic && old.content.includes(topic)) conflicts.push(`与既有规则在“${topic}”上态度对立`);
      }
    }
  }

  if (conflicts.length) return { status: 'CONFLICT', conflicts, note: '检测到与既有知识相悖，已挂起待裁决，不直接生效' };
  if (duplicateOf) return { status: 'DUPLICATE', duplicateOf, conflicts: [], note: '与既有知识高度重复，建议合并而非新增' };
  return { status: 'OK', conflicts: [], note: '通过：无冗余、无相悖' };
}
