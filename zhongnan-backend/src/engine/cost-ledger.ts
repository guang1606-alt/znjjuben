/**
 * v2.80 代价跨集账本（Cost Ledger）
 * ------------------------------------------------------------------
 * 查重分工：cheat-rule.ts 管集内"金手指要有代价"规则校验（单集视角）；
 * 本引擎管跨集"零代价胜利连胜"——主角连续几集开挂/逆转却零代价
 * （未受伤/未失去/未暴露），金手指通胀、爽点贬值（跨集视角）。
 * 集内规则 + 跨集连胜，双视角互补（与反派威胁/时间线账本的分工先例一致）。
 *
 * 记账模型（与时间线账本同构，纯确定性）：
 *   每集摘要 { ep, won(本集有胜利信号), paid(本集有代价信号) }
 *   信号提取：整段文本按词表匹配（中英双语，en 忽略大小写）。
 *   按集升序过账：won && !paid → streak + 1（零代价连胜）；
 *     任一集 paid（付过代价）或 !won（没赢/没写胜利）→ streak 归 0。
 *   streak ≥2 → mid；≥3 → high。
 * 输出：连胜结果 + 架构师"跨集代价校准/本集先付代价"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文。
 */

export interface CostRow {
  /** 集号 */
  ep: number;
  /** 本集命中胜利信号（赢了/得手/翻盘…） */
  won: boolean;
  /** 本集命中代价信号（受伤/失去/暴露…） */
  paid: boolean;
}

export interface CostLedgerIssue {
  severity: 'mid' | 'high';
  type: 'cost_free_streak';
  evidence: string;
  advice: string;
}

export interface CostLedgerResult {
  /** 当前尾部零代价连胜集数 */
  streak: number;
  /** 连胜起点集号（0=无连胜） */
  fromEp: number;
  /** none / mid / high */
  level: 'none' | 'mid' | 'high';
  issues: CostLedgerIssue[];
}

/** 零代价连胜阈值：≥2 报 mid，≥3 升 high */
export const COST_STREAK_MID = 2;
export const COST_STREAK_HIGH = 3;

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;

// —— 胜利信号词（长词在前防误配）——
const WIN_ZH = /(大获全胜|一战成名|名利双收|化险为夷|翻盘|逆转|反杀|得手|得逞|赢了|胜了|大胜|完胜|击败|打败|击溃|斩杀|拿下|扳回|碾压|到手)/;
const WIN_EN = /\b(won|victory|defeated|triumphed|prevailed|outsmarted|pulled off|turned the tables|got away|escaped|succeeded|came out on top)\b/i;

// —— 代价信号词（偏保守方向：多算"付过代价"只会少报连胜，不会误伤）——
const PAID_ZH = /(代价|吐血|呕血|重伤|受伤|伤了|折损|暴露|败露|失去|损失|赔上|豁出|透支|反噬|耗尽|献祭|断了|废了|残了|瞎了|丧命|掏空)/;
const PAID_EN = /\b(paid a price|at a cost|the cost|a price|sacrificed|sacrifice|injured|injury|wounded|exposed|exposure|lost|losing|bled|crippled|exhausted|scarred)\b/i;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

/**
 * 单集代价信号提取：胜利词与代价词各测一次。
 * @returns { won, paid }；空文本/超短文本安全返回双 false。
 */
export function deriveCostSignal(text: string): { won: boolean; paid: boolean } {
  if (!text || text.trim().length < MIN_TEXT) return { won: false, paid: false };
  const zh = isZhText(text);
  return {
    won: zh ? WIN_ZH.test(text) : WIN_EN.test(text),
    paid: zh ? PAID_ZH.test(text) : PAID_EN.test(text),
  };
}

/** 落库摘要 → CostRow（规范化容错：ep 非法丢弃、won/paid 仅认布尔 true） */
export function normalizeCostRow(raw: unknown): CostRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  return { ep, won: r.won === true, paid: r.paid === true };
}

/**
 * 代价跨集记账：按集升序，won&&!paid 连胜 +1，付代价/没赢即清零。
 * @param rows    前集代价摘要序列（乱序安全，内部按 ep 升序，同集重复以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function costLedger(rows: CostRow[], curEpNo: number): CostLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byEp = new Map<number, CostRow>();
  for (const raw of rows ?? []) {
    const r = normalizeCostRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byEp.set(r.ep, r);
  }
  const sorted = [...byEp.values()].sort((a, b) => a.ep - b.ep);
  let streak = 0;
  let fromEp = 0;
  for (const r of sorted) {
    if (r.won && !r.paid) {
      streak += 1;
      if (streak === 1) fromEp = r.ep;
    } else {
      streak = 0;
      fromEp = 0;
    }
  }
  const level: 'none' | 'mid' | 'high' = streak >= COST_STREAK_HIGH ? 'high' : streak >= COST_STREAK_MID ? 'mid' : 'none';
  const issues: CostLedgerIssue[] = [];
  if (level !== 'none') {
    issues.push({
      severity: level,
      type: 'cost_free_streak',
      evidence: `从第 ${fromEp} 集起已连续 ${streak} 集得手却零代价（未受伤/未失去/未暴露）`,
      advice: '金手指通胀、爽点贬值：本集若再胜，必须先付代价——受伤/暴露/折损/失去至少一项，落到人、物或关系上，且本集内不可回血挽回',
    });
  }
  return { streak, fromEp, level, issues };
}

/**
 * 代价调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 无连胜/无输入返回空串。
 */
export function costDirective(rows: CostRow[]): { zh: string; en: string } {
  const r = costLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode cost — free-win streak]'] : ['【跨集代价·零代价连胜】'];
    lines.push(isEn
      ? `  - Since ep ${r.fromEp}, the lead has won ${r.streak} episodes straight without paying any price — the golden finger is inflating and every win is losing value. If the lead wins again this episode, make them pay first: injury, exposure, loss, or sacrifice — at least one, landing on a person, an asset, or a relationship, irreversible within this episode.`
      : `  - 从第 ${r.fromEp} 集起，主角已连续 ${r.streak} 集开挂得手却零代价——金手指正在通胀、爽点正在贬值：本集若再胜，必须先付代价（受伤/暴露/折损/失去至少一项，落到人、物或关系上，且本集内不可回血挽回）。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
