/**
 * v2.80 反派下场账本（Villain Fate Ledger）
 * ------------------------------------------------------------------
 * 查重分工（四个近邻引擎）：
 *  - character-state-ledger（v2.80）：跨集"大状态"（状态维度、不分人名：
 *    被捕/重伤/流亡是状态字段，诈死/失踪合法套路只提醒）
 *  - death-ledger（v2.80）：跨集"确认死亡"人名级连续性（咽气/身亡入死亡名册）
 *  - villain-threat（v2.80）：反派威胁升压（动作分档跨集节奏，非连续性监控）
 *  - 本引擎：跨集"非死下场"的人名级连续性——具名角色本集被处置下场
 *    （入狱/落网/被逐/下台/身败名裂/抄家…）入下场名册，后续集同名角色
 *    再次开口/行动且无豁免交代 = 下场凭空消失穿帮（high）；
 *    豁免：越狱/平反/翻身/洗白/化敌为友交代（与下场同集出现即不入册）
 *
 * 记账模型（与死亡账本同构，纯确定性）：
 *   每集摘要 { ep, name, removed, exempted, active }（具名角色逐个提取）：
 *   信号 = 名字与信号词共现（zh 下场/豁免词前后 6 字符窗口，"差点/险些"
 *   前缀跳过；en 双向窄窗 + almost/nearly 前缀跳过）；
 *   死亡行不收下场（同角色同行命中死亡词 → 归 death-ledger 管，防双册双报）；
 *   active = 台词行（名字+冒号）或动作行（△ 行名字在主语位）；纯叙述提及不算。
 *   按集升序过账：removed && !exempted 入册；exempted 出册；册中者后续集
 *   active（该行未同时命中下场/豁免）→ 下场穿帮（每名字只报 1 次即出册）。
 * 输出：下场名册 + 穿帮 issue + 架构师"下场维持"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名按原名透传）。
 */

export interface FateRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 本集被处置下场（入狱/被逐/下台/身败名裂…与名字共现） */
  removed: boolean;
  /** 本集豁免交代（越狱/平反/翻身/洗白…与名字共现） */
  exempted: boolean;
  /** 本集有台词/动作活动（叙述提及不算） */
  active: boolean;
}

export interface VillainFateIssue {
  severity: 'high';
  type: 'fated_but_active';
  evidence: string;
  advice: string;
}

export interface VillainFateLedgerResult {
  /** 当前下场名册：已处置且未豁免（跨集下场维持监控池） */
  felled: { name: string; fateEp: number }[];
  issues: VillainFateIssue[];
}

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;
/** 名字最短长度（防单字误伤） */
const MIN_NAME = 2;
/** 名字最长长度（防整段设定误当人名） */
const MAX_NAME = 24;
/** zh 信号词与人名的共现窗口（字符） */
const WINDOW_ZH = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 非死下场信号词（处置性结果：牢狱/流放/驱逐/失势/抄没/名裂）——
const FATE_ZH_G = /(入狱|收监|下狱|坐牢|蹲了大牢|锒铛入狱|落网|归案|被抓|被捕|被擒|擒获|抓获|关押|囚禁|流放|发配|充军|逐出|被逐|赶出|扫地出门|下台|倒台|垮台|被罢免|被免职|身败名裂|声名扫地|名誉扫地|废掉|被废(?!弃|置|料)|抄家|查抄)/g;

// —— 豁免交代信号词（越狱/平反/翻身/洗白/化敌为友）——
const EXEMPT_ZH_G = /(越狱|劫狱|逃狱|平反|翻案|昭雪|洗冤|翻身|东山再起|重出江湖|复出|卷土重来|洗白|化敌为友|弃暗投明|投诚|招安|被释放|获释|无罪释放|放了出来|特赦)/g;

// —— 死亡词（同行共现则不收下场，死亡归 death-ledger 管）——
const DEATH_OVERLAP_ZH_G = /(咽(?:了)?气|断气|气绝|毙命|身亡|丧命|殒命|命丧|不治身亡|当场死亡|去世|离世|死于非命|中弹身亡|倒地身亡)/g;

// —— 英文：下场词（双向窄窗）——
const FATE_EN_G = /\b(?:captured|arrested|taken into custody|imprisoned|jailed|sent to prison|behind bars|locked up|exiled|banished|cast out|deposed|dethroned|disgraced|ruined|fell from power)\b/gi;
// —— 英文：豁免词 ——
const EXEMPT_EN_G = /\b(?:escaped (?:prison|jail|custody)|jailbreak|broke out|escaped|exonerated|acquitted|pardoned|released|set free|made a comeback|switched sides|turned ally|redeemed)\b/gi;
// —— 英文：死亡重叠词 ——
const DEATH_OVERLAP_EN = /\b(?:died|perished|killed|slain|passed away)\b/i;

/** zh 共现判定：信号词每个命中位置取前后窗口测人名；"差点/险些"前缀的命中跳过（没成） */
function cooccurZh(line: string, name: string, sig: RegExp): boolean {
  const nameRe = new RegExp(escapeRe(name));
  sig.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = sig.exec(line)) !== null) {
    if (/差点|险些|几乎|没能/.test(line.slice(Math.max(0, m.index - 4), m.index))) continue;
    const start = Math.max(0, m.index - WINDOW_ZH);
    const end = Math.min(line.length, m.index + m[0].length + WINDOW_ZH);
    if (nameRe.test(line.slice(start, end))) return true;
  }
  return false;
}

/** en 双向窄窗命中：名字在前（允许 was/got 等助动词隔开："Wang was arrested"）或在后（"They arrested Wang"）；almost/nearly 前缀跳过 */
function enSignalHit(line: string, name: string, sig: RegExp): boolean {
  const nm = `\\b${escapeRe(name)}\\b`;
  sig.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = sig.exec(line)) !== null) {
    if (/almost|nearly/i.test(line.slice(Math.max(0, m.index - 7), m.index))) continue;
    const before = line.slice(Math.max(0, m.index - 12), m.index);
    if (new RegExp(`${nm}\\s*(?:was|were|got|had\\s+been|is|are|been)?\\s*$`, 'i').test(before)) return true;
    const after = line.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (new RegExp(`^[,\\s]{0,6}${nm}`, 'i').test(after)) return true;
  }
  return false;
}

/** 死亡重叠判定：该行死亡词与人名共现 → 下场信号让位（死亡归 death-ledger 管） */
function deathOverlap(line: string, name: string, isZh: boolean): boolean {
  return isZh ? cooccurZh(line, name, DEATH_OVERLAP_ZH_G) : DEATH_OVERLAP_EN.test(line) && new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(line);
}

/** 台词/动作活动判定：名字+冒号（台词行）或 △ 后主语位名字（动作行）；叙述/遗物提及不算 */
function isActiveLine(line: string, name: string, isZh: boolean): boolean {
  const esc = escapeRe(name);
  const paren = isZh ? '(?:（[^）]*）|\\([^)]*\\))?' : '(?:\\([^)]*\\))?';
  const speechRe = new RegExp(`^(?:△\\s*)?${esc}\\s*${paren}\\s*[:：]`, isZh ? '' : 'i');
  if (speechRe.test(line)) return true;
  // △ 行：名字须紧跟 △（动作主语位），且不是"林晚的遗物/林晚's body"这类提及
  const actionRe = isZh
    ? new RegExp(`^△\\s*${esc}(?!的)`)
    : new RegExp(`^△\\s*${esc}\\b(?!'s)`, 'i');
  return actionRe.test(line);
}

/**
 * 单集单角色下场信号提取：下场/豁免（共现窗口）+ 活动（台词/动作行）。
 * @returns { removed, exempted, active }；空文本/超短名字安全返回三 false。
 */
export function deriveFateSignal(text: string, name: string): { removed: boolean; exempted: boolean; active: boolean } {
  const n = (name ?? '').trim();
  if (!text || text.trim().length < MIN_TEXT || n.length < MIN_NAME || n.length > MAX_NAME) {
    return { removed: false, exempted: false, active: false };
  }
  const isZh = isZhText(text);
  let removed = false;
  let exempted = false;
  let active = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!active && isActiveLine(line, n, isZh)) active = true;
    // 死亡行不收下场：同行死亡词与人名共现 → 该行信号让位给 death-ledger
    if (deathOverlap(line, n, isZh)) continue;
    if (!removed && (isZh ? cooccurZh(line, n, FATE_ZH_G) : enSignalHit(line, n, FATE_EN_G))) removed = true;
    if (!exempted && (isZh ? cooccurZh(line, n, EXEMPT_ZH_G) : enSignalHit(line, n, EXEMPT_EN_G))) exempted = true;
    if (removed && exempted && active) break;
  }
  return { removed, exempted, active };
}

/** 落库摘要 → FateRow（规范化容错：ep/name 非法丢弃、布尔仅认 true） */
export function normalizeFateRow(raw: unknown): FateRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  return { ep, name, removed: r.removed === true, exempted: r.exempted === true, active: r.active === true };
}

/**
 * 反派下场跨集记账：按集升序，下场入册 / 豁免出册 / 册中者再活动即穿帮。
 * @param rows    前集下场摘要序列（乱序安全，内部按 ep 升序，同集同名以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function villainFateLedger(rows: FateRow[], curEpNo: number): VillainFateLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, FateRow>();
  for (const raw of rows ?? []) {
    const r = normalizeFateRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; fateEp: number }>();
  const issues: VillainFateIssue[] = [];
  for (const r of sorted) {
    const held = pool.get(r.name);
    // ① 册中角色本集再活动（该行未同时命中下场/豁免——同集反转归集内引擎管）
    if (held && r.active && !r.removed && !r.exempted) {
      issues.push({
        severity: 'high',
        type: 'fated_but_active',
        evidence: `${r.name}（第 ${held.fateEp} 集已交代下场）在第 ${r.ep} 集再次开口/行动`,
        advice: '下场凭空消失是连续性穿帮：要么别让他行动，要么先补豁免交代（越狱/平反/翻身/洗白/化敌为友），再让他登场',
      });
      pool.delete(r.name); // 每名字只报 1 次
      continue;
    }
    // ② 豁免出册
    if (held && r.exempted) {
      pool.delete(r.name);
      continue;
    }
    // ③ 下场入册（同集 active 是下场前有戏，正常）
    if (r.removed && !r.exempted) {
      pool.set(r.name, { name: r.name, fateEp: r.ep });
    }
  }
  return { felled: [...pool.values()], issues };
}

/**
 * 反派下场调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名按原名透传）。
 */
export function fateDirective(rows: FateRow[]): { zh: string; en: string } {
  const r = villainFateLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.felled.length) return { zh: '', en: '' };
  const listZh = r.felled.map((d) => `${d.name}（第${d.fateEp}集）`).join('、');
  const listEn = r.felled.map((d) => `${d.name} (ep${d.fateEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode villain fate — enforce the comeuppance]'] : ['【跨集反派下场·下场维持】'];
    lines.push(isEn
      ? `  - Characters already fated with no exoneration on record: ${listEn} (jailed/banished/disgraced). They must NOT act or speak freely this episode; if the plot truly needs them back, show a prison-break / exoneration / redemption / allegiance-switch reveal BEFORE they reappear.`
      : `  - 以下角色已交代下场（入狱/被逐/下台/身败名裂等）且无豁免：${listZh}。本集严禁让他们自由行动或开口；若剧情确需回归，必须先给越狱/平反/翻身/洗白/化敌为友交代再登场。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
