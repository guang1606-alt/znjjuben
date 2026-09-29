/**
 * v2.80 跨集钩型疲劳账本（Hook Fatigue Ledger）
 * ------------------------------------------------------------------
 * 缺口：cliffhanger-score 只判单集钩子"硬不硬"，device-fatigue 只管
 * 节拍装置（反转/爽点/情绪头），跨集维度"连续 N 集用同一型钩子收尾/
 * 同一型开场"的模式固化无人管——集尾连吊 3 集危机钩、开场连用 3 集
 * "耳光惊醒"，模式可预测=观众疲劳=划走。
 *
 * 记账模型（run-length 连续段，纯确定性）：
 *   每集摘要 { ep, openId(开场钩规划ID), endType(集尾实测钩型) }
 *   两通道独立算"截至最新集的连续同型长度"：
 *     集尾通道：qcReport.cliffhanger.type，仅六类实质钩入账
 *       （weak/none 断段——弱钩/无钩集不构成"同型连吊"）；
 *     开场通道：qcReport.openHook.id（规划 ID），空值断段。
 *   阈值：run ≥3 → mid issue；≥4 → high；指令预防式 run ≥2 即出话
 *   （第 3 集前提醒换型，比 issue 报告提前一集）。
 * 输出：疲劳结果 + 架构师"钩型轮换"指令（与悬念干旱注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * openId 为钩子内容 ID 按原样透传。
 */

export type HfLang = 'zh' | 'en';

export interface HookTypeRow {
  /** 集号 */
  ep: number;
  /** 开场钩规划 ID（''=无记录，断段） */
  openId: string;
  /** 集尾实测钩型（六类实质钩之一；''=weak/none/缺失，断段） */
  endType: string;
}

export interface HookFatigueIssue {
  severity: 'mid' | 'high';
  type: 'ending_hook_repeat' | 'opening_hook_repeat';
  evidence: string;
  advice: string;
}

export interface HookFatigueResult {
  /** 截至最新集的集尾同型连续段长（0=无入账行） */
  endRun: number;
  /** 截至最新集的开场同 ID 连续段长（0=无入账行） */
  openRun: number;
  /** none / mid / high（取两通道更严重者） */
  level: 'none' | 'mid' | 'high';
  /** 当前连续段集尾钩型（供指令引用） */
  endType: string;
  /** 当前连续段开场钩 ID（供指令引用） */
  openId: string;
  issues: HookFatigueIssue[];
}

/** 连续同型段长阈值：≥3 报 mid，≥4 升 high */
export const HF_RUN_MID = 3;
export const HF_RUN_HIGH = 4;
/** 指令预防式阈值：连续 ≥2 集同型即提醒换型（早 issue 一集拦住第 3 连） */
export const HF_DIRECTIVE_RUN = 2;

/** 集尾钩型：与 cliffhanger-score 六类实质钩一致（weak/none 不入账） */
export const FATIGUE_END_TYPES = ['reversal', 'crisis', 'reveal', 'mystery', 'emotional', 'action_cut'] as const;
export type FatigueEndType = (typeof FATIGUE_END_TYPES)[number];

const TYPE_LABEL_ZH: Record<FatigueEndType, string> = {
  reversal: '反转钩', crisis: '危机钩', reveal: '揭秘钩', mystery: '悬念钩', emotional: '情感钩', action_cut: '动作钩',
};
const TYPE_LABEL_EN: Record<FatigueEndType, string> = {
  reversal: 'Reversal', crisis: 'Crisis', reveal: 'Reveal', mystery: 'Mystery', emotional: 'Emotional', action_cut: 'Action cut',
};

/** qcReport.cliffhanger → 集尾实测钩型（仅六类实质钩；其余返回 null 断段） */
export function deriveEndHookType(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = (raw as Record<string, unknown>).type;
  if (typeof type !== 'string') return null;
  return (FATIGUE_END_TYPES as readonly string[]).includes(type) ? type : null;
}

/** qcReport.openHook → 开场钩规划 ID（非空字符串，≤40 字符；缺失返回 null 断段） */
export function deriveOpenHookId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = (raw as Record<string, unknown>).id;
  if (typeof id !== 'string') return null;
  const trimmed = id.trim().slice(0, 40);
  return trimmed.length >= 1 ? trimmed : null;
}

/** 落库摘要 → HookTypeRow（规范化容错：ep 非法 → null；两通道全空的行保留——空值本身断段，防止弱钩/无钩集被滤掉后 run 跨集延续） */
export function normalizeHookTypeRow(raw: unknown): HookTypeRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const openId = typeof r.openId === 'string' ? r.openId.trim().slice(0, 40) : '';
  const endType = typeof r.endType === 'string' && (FATIGUE_END_TYPES as readonly string[]).includes(r.endType) ? r.endType : '';
  return { ep, openId, endType };
}

/**
 * 钩型疲劳记账：按集升序，两通道各算截至最新集的连续同型段长
 * （值变化或空值断段重置）。
 * @param rows    前集钩型摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function hookFatigueLedger(rows: HookTypeRow[], curEpNo: number): HookFatigueResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizeHookTypeRow)
    .filter((r): r is HookTypeRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let endRun = 0;
  let prevEnd = '';
  let openRun = 0;
  let prevOpen = '';
  let endType = '';
  let openId = '';
  for (const r of sorted) {
    if (r.endType) {
      endRun = r.endType === prevEnd ? endRun + 1 : 1;
      prevEnd = r.endType;
      endType = r.endType;
    } else {
      endRun = 0;
      prevEnd = '';
      endType = '';
    }
    if (r.openId) {
      openRun = r.openId === prevOpen ? openRun + 1 : 1;
      prevOpen = r.openId;
      openId = r.openId;
    } else {
      openRun = 0;
      prevOpen = '';
      openId = '';
    }
  }
  const level: 'none' | 'mid' | 'high' = Math.max(endRun, openRun) >= HF_RUN_HIGH ? 'high' : Math.max(endRun, openRun) >= HF_RUN_MID ? 'mid' : 'none';
  const issues: HookFatigueIssue[] = [];
  if (endRun >= HF_RUN_MID) {
    issues.push({
      severity: endRun >= HF_RUN_HIGH ? 'high' : 'mid',
      type: 'ending_hook_repeat',
      evidence: `集尾钩型连续 ${endRun} 集同为「${TYPE_LABEL_ZH[endType as FatigueEndType] ?? endType}」`,
      advice: '集尾钩型轮换：反转/危机/揭秘/悬念/情感/动作六类交替，同型连吊=模式可预测=观众划走；本集必须换型',
    });
  }
  if (openRun >= HF_RUN_MID) {
    issues.push({
      severity: openRun >= HF_RUN_HIGH ? 'high' : 'mid',
      type: 'opening_hook_repeat',
      evidence: `开场钩连续 ${openRun} 集同为「${openId}」`,
      advice: '黄金三秒开场钩型轮换：同一种开场方式连用=审美疲劳；本集必须换开场钩型（打脸/惊醒/倒计时/悬念切入轮换）',
    });
  }
  return { endRun, openRun, level, endType, openId, issues };
}

/**
 * 钩型疲劳调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 预防式：任一通道连续 ≥2 集同型即出话（拦住第 3 连）；无重复返回空串。
 */
export function hookFatigueDirective(rows: HookTypeRow[]): { zh: string; en: string } {
  const r = hookFatigueLedger(rows, Number.MAX_SAFE_INTEGER);
  const build = (isEn: boolean): string => {
    const lines: string[] = [];
    if (r.endRun >= HF_DIRECTIVE_RUN) {
      const label = isEn ? (TYPE_LABEL_EN[r.endType as FatigueEndType] ?? r.endType) : (TYPE_LABEL_ZH[r.endType as FatigueEndType] ?? r.endType);
      lines.push(isEn
        ? `[Hook-type fatigue — rotate the ending hook]\n  - The last ${r.endRun} episodes all ended on a ${label} hook — this episode must switch hook type (rotate: reversal / crisis / reveal / mystery / emotional / action); a predictable pattern = viewers swipe away.`
        : `【钩型疲劳·集尾换型】\n  - 最近 ${r.endRun} 集集尾都用「${label}」收尾——本集必须换钩型（反转/危机/揭秘/悬念/情感/动作六类轮换）；同型连吊=模式可预测=观众划走。`);
    }
    if (r.openRun >= HF_DIRECTIVE_RUN) {
      lines.push(isEn
        ? `[Hook-type fatigue — rotate the opening hook]\n  - The last ${r.openRun} episodes all opened with "${r.openId}" — this episode must switch to a different opening hook (rotate: face-slap / rude awakening / countdown / mystery cut-in); variety keeps the golden three seconds alive.`
        : `【钩型疲劳·开场换型】\n  - 最近 ${r.openRun} 集开场都用「${r.openId}」——本集必须换开场钩型（打脸/惊醒/倒计时/悬念切入轮换）；黄金三秒要常换常新。`);
    }
    return lines.length ? lines.join('\n') + '\n' : '';
  };
  return { zh: build(false), en: build(true) };
}
