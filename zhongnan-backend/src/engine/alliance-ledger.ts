/**
 * v2.80 联盟账本（Alliance Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - relationship-ledger：管人名对情感关系翻转（决裂/修复/亲密）；
 *  - affiliation-ledger：管人名×组织名阵营归属（脱离/回归/效忠）；
 *  - debt-ledger：管施恩/报恩/背叛的人情债；
 *  - 本引擎：管**利益联盟**的建立/瓦解连续性——
 *    A 与 B 结盟（结盟/联手/合作/同盟…）建立联盟状态；
 *    瓦解（翻脸/拆伙/决裂/反目成仇…）解除；
 *    结盟状态下无交代却敌对（攻击/陷害/对立）= 联盟穿帮（high）。
 *    注：联盟本就可能因利益反转而瓦解，仅在"结盟状态下无任何瓦解交代直接敌对"时报。
 *
 * 提取（纯确定性，人名配对）：
 *  - allied：句内两人名 + 结盟动词（结盟/联手/合作/同盟/站在同一阵线…）→ 建立联盟
 *  - dissolved：句内两人名 + 瓦解动词（翻脸/拆伙/决裂/反目成仇/分道扬镳…）→ 解除联盟
 *  - hostile：句内两人名 + 敌对动词（攻击/陷害/对立/为敌/对付…）→ 检测穿帮
 *
 * 记账模型（与人情债账本同构，纯确定性）：
 *   每集摘要 { ep, a, b, allied, dissolved, hostile }：
 *   按集升序过账：
 *     ① dissolved 解除联盟；
 *     ② allied 建立联盟；
 *     ③ hostile 行：若 a-b 仍结盟且本集无 dissolved → alliance_breach（high，同对只报1次）。
 * 输出：当前联盟名册 + issue + 架构师"联盟"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface AllianceRow {
  /** 集号 */
  ep: number;
  /** 角色 A */
  a: string;
  /** 角色 B */
  b: string;
  /** 本集 A 与 B 结盟 */
  allied: boolean;
  /** 本集 A 与 B 联盟瓦解 */
  dissolved: boolean;
  /** 本集 A 与 B 敌对 */
  hostile: boolean;
}

export interface AllianceIssue {
  severity: 'high';
  type: 'alliance_breach';
  evidence: string;
  advice: string;
}

export interface AllianceLedgerResult {
  /** 当前联盟名册 */
  alliances: { a: string; b: string; sinceEp: number }[];
  issues: AllianceIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 结盟动词 ——
const ALLY_ZH: string[] = ['结盟', '联手', '合作', '同盟', '站在同一阵线', '同舟共济', '并肩作战', '统一战线', '合伙', '联手对付'];
// —— 瓦解动词 ——
const BREAK_ZH: string[] = ['翻脸', '拆伙', '决裂', '反目成仇', '分道扬镳', '撕破脸', '散伙', '割席', '绝交'];
// —— 敌对动词 ——
const HOSTILE_ZH: string[] = ['攻击', '陷害', '对立', '为敌', '对付', '反目', '倒戈相向', '兵戎相见', '围剿'];

const ALLY_EN: string[] = ['allied', 'teamed up', 'joined forces', 'cooperated', 'formed an alliance', 'united', 'stood together', 'partnered', 'joined hands'];
const BREAK_EN: string[] = ['fell out', 'split up', 'broke off', 'turned against each other', 'parted ways', 'had a falling out', 'severed ties'];
const HOSTILE_EN: string[] = ['attacked', 'betrayed', 'turned against', 'fought', 'opposed', 'set up', 'framed', 'sabotaged'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

/**
 * 从单集终稿提取本集联盟行（allied / dissolved / hostile）。
 */
export function deriveAllianceRows(draft: string, names: string[]): Omit<AllianceRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<AllianceRow, 'ep'>[] = [];
  const allyW = isZh ? ALLY_ZH : ALLY_EN;
  const breakW = isZh ? BREAK_ZH : BREAK_EN;
  const hostileW = isZh ? HOSTILE_ZH : HOSTILE_EN;

  const pushRow = (a: string, b: string, allied: boolean, dissolved: boolean, hostile: boolean) => {
    if (a === b) return;
    const key = pairKey(a, b);
    const existing = out.find((x) => pairKey(x.a, x.b) === key);
    if (existing) {
      existing.allied = existing.allied || allied;
      existing.dissolved = existing.dissolved || dissolved;
      existing.hostile = existing.hostile || hostile;
    } else {
      out.push({ a, b, allied, dissolved, hostile });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh))
      .sort((a, b) => sent.indexOf(a) - sent.indexOf(b))
      .slice(0, MAX_NAMES_PER_SENT);
    if (hitNames.length < 2) continue;
    const a = hitNames[0];
    const b = hitNames[1];

    if (allyW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, true, false, false);
    if (breakW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, false, true, false);
    if (hostileW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, false, false, true);
  }
  return out;
}

/** 规范化落库摘要 */
export function normalizeAllianceRow(raw: Record<string, unknown>): AllianceRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const a = typeof raw.a === 'string' ? raw.a : '';
  const b = typeof raw.b === 'string' ? raw.b : '';
  if (!Number.isFinite(ep) || !a || !b) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, a, b,
    allied: bl(raw.allied),
    dissolved: bl(raw.dissolved),
    hostile: bl(raw.hostile),
  };
}

/**
 * 跨集联盟记账。
 */
export function allianceLedger(rows: AllianceRow[], currentEp: number): AllianceLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)));
  // 联盟状态：pairKey → sinceEp
  const state = new Map<string, number>();
  const alliances: { a: string; b: string; sinceEp: number }[] = [];
  const issues: AllianceIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, AllianceRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① dissolved 解除联盟
    for (const r of epRows) {
      if (r.dissolved) state.delete(pairKey(r.a, r.b));
    }
    // ② allied 建立联盟
    for (const r of epRows) {
      if (r.allied) state.set(pairKey(r.a, r.b), ep);
    }
    // ③ hostile 检测
    for (const r of epRows) {
      if (!r.hostile) continue;
      const key = pairKey(r.a, r.b);
      const since = state.get(key);
      const hasDissolved = epRows.some((x) => pairKey(x.a, x.b) === key && x.dissolved);
      if (since !== undefined && !hasDissolved) {
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            severity: 'high',
            type: 'alliance_breach',
            evidence: `${r.a} 与 ${r.b} 自第 ${since} 集结盟，本集却敌对（无瓦解交代）`,
            advice: `补充 ${r.a} 与 ${r.b} 联盟瓦解的交代（利益冲突/误会/背叛），或先安排拆伙再敌对`,
          });
        }
      }
    }
  }

  for (const [key, sinceEp] of state) {
    const [a, b] = key.split('::');
    alliances.push({ a, b, sinceEp });
  }
  alliances.sort((x, y) => x.sinceEp - y.sinceEp);

  return { alliances, issues };
}

/** 架构师"联盟"指令（双语，en 零中文；接收 rows 内部调 ledger，与阵营账本同构） */
export function allianceDirective(rows: AllianceRow[]): { en: string; zh: string } {
  const result = allianceLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【联盟约束】'];
  const en: string[] = ['[Alliance Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
