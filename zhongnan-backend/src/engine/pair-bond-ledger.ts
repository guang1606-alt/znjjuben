/**
 * v2.80 关系线保鲜台账（Pair Bond Ledger）
 * ------------------------------------------------------------------
 * 缺口：连载剧常见差评——两个角色各自都在场，却连续多集没有同场，
 * 关系线在后台无声腐烂。relationship 推进检测是单集内的，
 * 跨集维度（"这对CP多久没对手戏了"）无人管理。
 *
 * 输入：route 侧从配角在场位（cast-presence-ledger 的 PresenceBit）
 * 两两组合出的同场位（PairBit：coIn=两人共同出场集号），
 * 以及在场位本身（用于判断双方近期是否仍各自在场）。
 * 规则：从"最后一个已完成集"往回数——
 *   未同场 ≥4 集 → mid；≥8 集 → high。
 *   仅当双方都在最后同场之后仍出场才报警（各自都在场却避开彼此
 *   =观众肉眼可见的失联；若一方已退场，属配角在场问题，不在本处重复报警）。
 * 输出：同场问题清单 + 架构师"关系线保鲜"指令（与 presenceDirective 同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * 角色名为圣经标识符按原样透传。
 */

import type { PresenceBit } from './cast-presence-ledger';

export interface PairBit {
  a: string;
  b: string;
  /** 两人共同出场集号（去重升序） */
  coIn: number[];
}

export interface PairBondIssue {
  severity: 'mid' | 'high';
  a: string;
  b: string;
  /** 截至上个已完成集未同场集数 */
  coGap: number;
  /** 最后同场集号 */
  lastCo: number;
}

export interface PairBondResult {
  tracked: number;
  issues: PairBondIssue[];
}

/** 未同场阈值：≥4 集报 mid，≥8 集升 high */
export const PAIR_GAP_MID = 4;
export const PAIR_GAP_HIGH = 8;

const normEps = (xs: number[] | undefined): number[] =>
  [...new Set((xs ?? []).filter((n) => Number.isFinite(n)))].sort((x, y) => x - y);

/**
 * 在场位 → 同场位：名字两两组合（稳定序 i<j），
 * coIn=双方 presentIn 交集（去重升序），无交集不成对，总数 cap 80。
 */
export function derivePairBits(bits: PresenceBit[]): PairBit[] {
  const list = (bits ?? [])
    .map((b) => ({ name: (b?.name ?? '').trim(), eps: normEps(b?.presentIn) }))
    .filter((b) => b.name);
  const out: PairBit[] = [];
  for (let i = 0; i < list.length && out.length < 80; i += 1) {
    for (let j = i + 1; j < list.length && out.length < 80; j += 1) {
      if (list[i].name === list[j].name) continue;
      const setA = new Set(list[i].eps);
      const coIn = list[j].eps.filter((n) => setA.has(n));
      if (!coIn.length) continue;
      out.push({ a: list[i].name, b: list[j].name, coIn });
    }
  }
  return out;
}

export function pairBondLedger(pairs: PairBit[], presence: PresenceBit[], curEpNo: number): PairBondResult {
  const lastDone = Math.max(0, (Math.round(curEpNo) || 1) - 1); // 最后一个已完成集
  const lastInOf = new Map<string, number>();
  for (const b of presence ?? []) {
    const name = (b?.name ?? '').trim();
    if (!name || lastInOf.has(name)) continue;
    const eps = normEps(b?.presentIn);
    if (eps.length) lastInOf.set(name, eps[eps.length - 1]);
  }
  const issues: PairBondIssue[] = [];
  for (const p of pairs ?? []) {
    if (!p?.coIn?.length) continue;
    const lastCo = p.coIn[p.coIn.length - 1];
    const coGap = lastDone - lastCo;
    if (coGap < PAIR_GAP_MID) continue;
    // 双方在场条件：任一方不在场位表或其后未再出场 → 跳过（一方退场属配角在场问题）
    const lastInA = lastInOf.get(p.a);
    const lastInB = lastInOf.get(p.b);
    if (lastInA === undefined || lastInB === undefined) continue;
    if (lastInA <= lastCo || lastInB <= lastCo) continue;
    issues.push({ severity: coGap >= PAIR_GAP_HIGH ? 'high' : 'mid', a: p.a, b: p.b, coGap, lastCo });
  }
  issues.sort((x, y) => y.coGap - x.coGap); // 稳定排序：同 gap 保持构造序
  return { tracked: (pairs ?? []).length, issues: issues.slice(0, 5) };
}

/**
 * 关系线保鲜调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 有 issue 才出话；无问题/无输入返回空串。
 */
export function pairBondDirective(pairs: PairBit[], presence: PresenceBit[], curEpNo: number): { zh: string; en: string } {
  const r = pairBondLedger(pairs, presence, curEpNo);
  if (!r.issues.length) return { zh: '', en: '' };
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Pair-bond freshness guard — keep relationships on screen]']
      : ['【关系线保鲜·同场调度】'];
    for (const i of r.issues) {
      lines.push(isEn
        ? `  - "${i.a}" and "${i.b}" haven't shared a scene for ${i.coGap} episodes (last together ep${i.lastCo}) despite both remaining on screen — stage a two-hander this episode, or establish where their relationship stands via dialogue; never let a relationship rot offscreen.`
        : `  - 「${i.a}」与「${i.b}」已 ${i.coGap} 集未同场（最后同场第${i.lastCo}集），两人近期各自都在场——本集安排一场对手戏，或借台词交代关系现状；关系线不许在后台无声腐烂。`);
    }
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
