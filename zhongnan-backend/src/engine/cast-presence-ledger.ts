/**
 * v2.80 配角在场防遗忘台账（Cast Presence Ledger）
 * ------------------------------------------------------------------
 * 缺口：长篇连载（80-100 集）最常见的差评之一——有名有姓的配角连续多集
 * 消失，观众把他们忘了，再登场时突兀感拉满；或角色明明已退场却被凭空想起。
 * 此前 character-presence-check 只查单集内"报名字不办事"，跨集维度无人在场。
 *
 * 输入：圣经角色名 × 前集正文的确定性在场位（route 侧 includes 匹配，
 * ≥2 字名防单字误伤；场景标头含名属可接受启发式噪声）。
 * 规则：缺席连续段从"最后一个已完成集"往回数——
 *   ≥3 集 → mid（观众开始遗忘）；≥6 集 → high（基本已忘，回归必须铺台阶）。
 *   从未出场的角色不追踪（可能是圣经预留/后段登场的反派）。
 * 输出：在场问题清单 + 架构师"本集调度约束"指令（与 fatigueDirective 同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * 角色名为圣经标识符按原样透传（与 prevEpisode.summary 引用正文同例）。
 */

export interface PresenceBit {
  /** 圣经角色名（≥2 字） */
  name: string;
  /** 前集正文中出现过的集号列表（乱序/重复由引擎归一） */
  presentIn: number[];
}

export interface PresenceIssue {
  severity: 'mid' | 'high';
  name: string;
  /** 最后出场集号 */
  lastIn: number;
  /** 截至上个已完成集的连续缺席集数 */
  absentStreak: number;
}

export interface PresenceResult {
  tracked: number;
  issues: PresenceIssue[];
}

/** 缺席阈值：连续缺席 ≥3 集报 mid，≥6 集升 high */
export const PRESENCE_ABSENT_MID = 3;
export const PRESENCE_ABSENT_HIGH = 6;

export function castPresenceLedger(bits: PresenceBit[], curEpNo: number): PresenceResult {
  const lastDone = Math.max(0, (Math.round(curEpNo) || 1) - 1); // 最后一个已完成集
  const issues: PresenceIssue[] = [];
  for (const b of bits ?? []) {
    const name = (b?.name ?? '').trim();
    if (!name) continue;
    const eps = [...new Set((b?.presentIn ?? []).filter((n) => Number.isFinite(n)))].sort((x, y) => x - y);
    if (!eps.length) continue; // 从未出场：不追踪
    const lastIn = eps[eps.length - 1];
    if (lastIn >= lastDone) continue; // 最近完成集仍出场
    const absentStreak = lastDone - lastIn;
    if (absentStreak < PRESENCE_ABSENT_MID) continue;
    issues.push({ severity: absentStreak >= PRESENCE_ABSENT_HIGH ? 'high' : 'mid', name, lastIn, absentStreak });
  }
  issues.sort((a, b) => b.absentStreak - a.absentStreak || a.name.localeCompare(b.name));
  return { tracked: (bits ?? []).length, issues };
}

/**
 * 配角在场调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 有 issue 才出话；无问题/无输入返回空串。
 */
export function presenceDirective(bits: PresenceBit[], curEpNo: number): { zh: string; en: string } {
  const r = castPresenceLedger(bits, curEpNo);
  if (!r.issues.length) return { zh: '', en: '' };
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Supporting cast presence guard — keep recurring characters alive]']
      : ['【配角在场·防遗忘调度】'];
    for (const i of r.issues) {
      lines.push(isEn
        ? `  - "${i.name}" absent for ${i.absentStreak} consecutive episodes (last seen ep${i.lastIn}) — give them a scene this episode, or establish their whereabouts via dialogue; if they exited the story, stay consistent and never bring them back out of nowhere.`
        : `  - 「${i.name}」已连续 ${i.absentStreak} 集未出场（最后出现第${i.lastIn}集）——本集给一场戏，或借台词明确去向；若已退场请保持一致，不得凭空回归。`);
    }
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
