/**
 * v2.80 屈辱-打脸跨集账本（Humiliation Ledger）
 * ------------------------------------------------------------------
 * 缺口：payoff-rhythm-check 的 humiliation_unpaid 只查单集内
 * "埋雷→兑付"配对；跨集链路（上集受辱、隔集打脸还账）无人管——
 * 观众憋了几集的屈辱没处还，只虐不还=弃剧。
 *
 * 记账模型（纯计数，零内容配对，确定性）：
 *   每集摘要 { ep, planted(新埋羞辱雷数), paid(当集兑付数), strong(强释放数), markers(雷词) }
 *   按集升序过账：debt = max(0, debt + planted - paid - strong)；
 *     paid=当集内兑付；strong=强释放（含跨集打脸——无新雷的爽集
 *     同样让观众的屈辱情绪得到释放，统一抵扣）。
 *   欠账 debt ≥3 → mid；≥5 → high。
 * 输出：欠账结果 + 架构师"对等还账"指令（与 hookPayoff 注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * markers 为剧本内容词按原样透传。
 */

export type HumLang = 'zh' | 'en';

export interface HumiliationBit {
  /** 埋雷集号 */
  ep: number;
  /** 羞辱词（原文命中片段，≤12 字符） */
  marker: string;
  /** 在全文中的位置 0-1 */
  position: number;
}

export interface DebtEpInput {
  /** 集号 */
  ep: number;
  /** 本集新埋羞辱雷数 */
  planted: number;
  /** 本集内兑付数（payoff-rhythm 的 humiliationPaidCount） */
  paid: number;
  /** 本集强释放数（payoff-rhythm 的 strongReleaseCount，含跨集打脸） */
  strong: number;
  /** 本集新埋雷词（去重，cap 5，供指令引用） */
  markers: string[];
}

export interface HumiliationDebtIssue {
  severity: 'mid' | 'high';
  type: 'humiliation_debt';
  evidence: string;
  advice: string;
}

export interface HumiliationDebtResult {
  /** 截至 lastDone 集的累计欠账（未兑付羞辱雷数） */
  debt: number;
  /** none / mid / high */
  level: 'none' | 'mid' | 'high';
  /** 最近未还雷词（最多 3 个，供指令引用） */
  lastMarkers: string[];
  issues: HumiliationDebtIssue[];
}

/** 欠账阈值：≥3 报 mid，≥5 升 high */
export const HUM_DEBT_MID = 3;
export const HUM_DEBT_HIGH = 5;

/** 每集雷词 cap */
const MARKERS_CAP = 5;
/** marker 最长字符 */
const MARKER_MAX = 12;

// —— 羞辱雷信号（双语同时扫，marker 为内容词透传）——
const HUMILIATION_ZH = /(当众退婚|退婚|撕毁(?:婚约|合同)|解除婚约|离婚协议|扫地出门|赶出家门|滚出去|滚出(?:去|家门)|废物|穷鬼|你配吗|配不上|高攀不起|你会后悔|等着瞧|让你付出代价|当众(?:羞辱|出丑|奚落)|当场开除|扇了?一?巴掌|一记耳光|逼(?:我|他|她)跪|给我跪下|下跪道歉)/g;
const HUMILIATION_EN = /(called off the (?:wedding|engagement)|tore up the (?:contract|agreement)|you'?re (?:nothing|trash|worthless|a loser)|you don'?t deserve|you'?ll (?:regret|pay)|get out (?:of my|of here)|publicly humiliat\w+|fired \w+ on the spot|slapped \w+ across|on your knees|beg for forgiveness|divorce papers)/gi;

const clampCount = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * 正文 → 羞辱雷位（双语同时扫描；同词去重、每集 cap 5）。
 * 供生成侧落库本集摘要 + 管线终稿观测。
 */
export function extractHumiliationBits(text: string, epNo: number): HumiliationBit[] {
  const ep = Math.round(Number(epNo));
  if (!Number.isFinite(ep) || ep < 1 || !text || text.trim().length < 20) return [];
  const out: HumiliationBit[] = [];
  const seen = new Set<string>();
  for (const re of [HUMILIATION_ZH, HUMILIATION_EN]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const marker = m[0].slice(0, MARKER_MAX);
      if (!seen.has(marker)) {
        seen.add(marker);
        out.push({ ep, marker, position: m.index / Math.max(1, text.length) });
      }
      if (m.index === re.lastIndex) re.lastIndex++;
      if (out.length >= MARKERS_CAP) return out;
    }
  }
  return out;
}

/** 落库摘要 → DebtEpInput（规范化容错：ep 非法丢弃，计数缺省 0，markers 过滤非字符串并 cap 5） */
export function normalizeDebtEp(raw: unknown): DebtEpInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const markers = (Array.isArray(r.markers) ? r.markers : [])
    .filter((x: unknown): x is string => typeof x === 'string' && x.length >= 1)
    .map((x) => x.slice(0, MARKER_MAX))
    .slice(0, MARKERS_CAP);
  return {
    ep,
    planted: clampCount(r.planted),
    paid: clampCount(r.paid),
    strong: clampCount(r.strong),
    markers,
  };
}

/**
 * 屈辱欠账记账：按集升序 debt = max(0, debt + planted - paid - strong)。
 * @param rows    前集摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function humiliationDebtLedger(rows: DebtEpInput[], curEpNo: number): HumiliationDebtResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizeDebtEp)
    .filter((r): r is DebtEpInput => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let debt = 0;
  let lastMarkers: string[] = [];
  for (const r of sorted) {
    debt = Math.max(0, debt + r.planted - r.paid - r.strong);
    if (r.planted > 0 && r.markers.length) lastMarkers = r.markers.slice(0, 3);
  }
  const level: 'none' | 'mid' | 'high' = debt >= HUM_DEBT_HIGH ? 'high' : debt >= HUM_DEBT_MID ? 'mid' : 'none';
  const issues: HumiliationDebtIssue[] = [];
  if (level !== 'none') {
    const marks = lastMarkers.map((m) => `「${m}」`).join('');
    issues.push({
      severity: level,
      type: 'humiliation_debt',
      evidence: `截至第${sorted[sorted.length - 1]?.ep ?? cur - 1}集累计 ${debt} 个未兑付羞辱雷${marks ? `（${marks}）` : ''}`,
      advice: '本集必须安排对等兑付：当众打脸/身份碾压/让对方自食其果，还账要还到当初羞辱人头上；只虐不还=弃剧',
    });
  }
  return { debt, level, lastMarkers, issues };
}

/**
 * 屈辱欠账调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 欠账达阈值才出话；无欠账/无输入返回空串。
 */
export function humiliationDirective(rows: DebtEpInput[]): { zh: string; en: string } {
  const r = humiliationDebtLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Humiliation debt — pay it back this episode]']
      : ['【屈辱欠账·对等还账】'];
    const marks = isEn
      ? r.lastMarkers.map((m) => `"${m}"`).join(', ')
      : r.lastMarkers.map((m) => `「${m}」`).join('');
    lines.push(isEn
      ? `  - Viewers are sitting on ${r.debt} unpaid humiliation beats${marks ? ` (${marks})` : ''} — this episode must deliver an equal payoff: a public face-slap, an identity crush, or make them reap what they sowed; pay it back to the very people who dished it out. Only misery without payback = viewers walk.`
      : `  - 观众已憋着 ${r.debt} 个未兑付的羞辱雷${marks ? `（${marks}）` : ''}——本集必须安排对等兑付：当众打脸/身份碾压/让对方自食其果，还账要还到当初羞辱人头上；只虐不还=弃剧。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
