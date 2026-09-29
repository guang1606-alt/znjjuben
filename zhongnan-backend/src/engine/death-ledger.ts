/**
 * v2.80 死亡穿帮账本（Death Ledger）
 * ------------------------------------------------------------------
 * 查重分工（四个近邻引擎）：
 *  - character-presence-check（v2.147）：单集内亡者复活——同一集文本里刚咽气又开口
 *  - character-state-ledger（v2.80）：跨集"生死不明/坠崖下落不明"大状态（状态维度、
 *    不分人名、未确认死亡），诈死是合法套路只提醒不拦截
 *  - plot-armor-check（v2.141）：单集翻盘时刻主角无伤（中枪坠崖拍灰就跑）
 *  - 本引擎：跨集"确认死亡"的人名级连续性——具名角色本集确认死亡（咽气/身亡/断气…）
 *    入死亡名册，后续集同名角色再次开口/行动 = 复活穿帮（high）；
 *    豁免：假死/还魂/重生/复活/替身交代（与死亡同集出现即不入册）
 *
 * 记账模型（与代价/时间线账本同构，纯确定性）：
 *   每集摘要 { ep, name, dead, revived, active }（人物卡具名角色逐个提取）：
 *   信号 = 名字与信号词共现（zh 死亡词前后 6 字符窗口；en 收死者自方谓语 + 被动窄窗，
 *   规避 "Zhang killed Wang" 主宾误伤）；
 *   active = 台词行（名字+冒号）或动作行（△ 行含名字）；纯叙述提及不算活动。
 *   按集升序过账：dead && !revived 入册；revived 出册；册中死者后续集 active
 *   （且该行未同时命中死亡/豁免）→ 复活穿帮（每名字只报 1 次即出册）。
 * 输出：死亡名册 + 穿帮 issue + 架构师"复活预警"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名除外）。
 */

export interface DeathRow {
  /** 集号 */
  ep: number;
  /** 角色名（人物卡具名，≥2 字符） */
  name: string;
  /** 本集确认死亡（名字与死亡信号词共现） */
  dead: boolean;
  /** 本集复活豁免（假死/还魂/替身…与名字共现） */
  revived: boolean;
  /** 本集有台词/动作活动（叙述提及不算） */
  active: boolean;
}

export interface DeathLedgerIssue {
  severity: 'high';
  type: 'resurrected_after_death';
  evidence: string;
  advice: string;
}

export interface DeathLedgerResult {
  /** 当前死亡名册：确认死亡且未豁免（跨集复活监控池） */
  dead: { name: string; deathEp: number }[];
  issues: DeathLedgerIssue[];
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

// —— 确认死亡信号词（死者自方谓语，从严不收裸"死了"，防"心死了"误伤）——
const DEATH_ZH_G = /(咽(?:了)?气|断气|气绝|毙命|身亡|丧命|殒命|命丧|一命呜呼|不治身亡|当场死亡|确认死亡|已经死了|真的死了|去世|离世|与世长辞|撒手人寰|香消玉殒|死于非命|中弹身亡|倒地身亡)/g;

// —— 复活豁免信号词 ——
const REVIVE_ZH_G = /(假死|诈死|还魂|还阳|重生|复活|死而复生|起死回生|金蝉脱壳|诈尸|根本没死|其实没死|并没有死|替身)/g;

// —— 英文：死者自方谓语（名字在前）+ 被动窄窗（名字在后）——
const DEAD_FWD_EN = /\b(?:died|has died|is dead|was dead|perished|passed away|was slain|breathed (?:his|her|their) last|took (?:his|her) last breath|dead on arrival)\b/i;
const DEAD_PASSIVE_EN = /\b(?:was|got|had been)\s+(?:killed|slain)\b/i;
const REVIVE_EN = /\b(?:faked (?:his|her|their) death|faked death|resurrected|resurrection|reborn|came back to life|brought back to life|alive after all|never died|body double)\b/i;

/** zh 共现判定：信号词每个命中位置取前后窗口测人名；"差点/险些"前缀的命中跳过（没死成） */
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

/** en 死亡判定：死者自方谓语（名字在前/紧邻）或被动/主动窄窗（killed 后紧跟名字），规避主宾误伤 */
function enDeadHit(line: string, name: string): boolean {
  const nm = `\\b${escapeRe(name)}\\b`;
  if (new RegExp(`${nm}[^.!?\\n]{0,12}${DEAD_FWD_EN.source}`, 'i').test(line)) return true;
  if (new RegExp(`${nm}[^.!?\\n]{0,12}${DEAD_PASSIVE_EN.source}`, 'i').test(line)) return true;
  // 主动语态 "Zhang killed Wang"：killed 后紧跟的才是死者；almost/nearly 没杀成跳过
  const ka = /\b(?:killed|slain)\b/gi;
  let km: RegExpExecArray | null;
  while ((km = ka.exec(line)) !== null) {
    if (/almost|nearly/i.test(line.slice(Math.max(0, km.index - 7), km.index))) continue;
    if (new RegExp(`^[,\\s]{0,6}${nm}`, 'i').test(line.slice(km.index + km[0].length, km.index + km[0].length + 6))) return true;
  }
  return false;
}

/** en 豁免判定：名字 + 窗口 + 豁免词（双向） */
function enReviveHit(line: string, name: string): boolean {
  const nm = `\\b${escapeRe(name)}\\b`;
  const w = '[^.!?\\n]{0,12}';
  return new RegExp(`${nm}${w}${REVIVE_EN.source}`, 'i').test(line)
    || new RegExp(`${REVIVE_EN.source}${w}${nm}`, 'i').test(line);
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
 * 单集单角色死亡信号提取：死亡/豁免（共现窗口）+ 活动（台词/动作行）。
 * @returns { dead, revived, active }；空文本/超短名字安全返回三 false。
 */
export function deriveDeathSignal(text: string, name: string): { dead: boolean; revived: boolean; active: boolean } {
  const n = (name ?? '').trim();
  if (!text || text.trim().length < MIN_TEXT || n.length < MIN_NAME || n.length > MAX_NAME) {
    return { dead: false, revived: false, active: false };
  }
  const isZh = isZhText(text);
  let dead = false;
  let revived = false;
  let active = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!active && isActiveLine(line, n, isZh)) active = true;
    if (!dead && (isZh ? cooccurZh(line, n, DEATH_ZH_G) : enDeadHit(line, n))) dead = true;
    if (!revived && (isZh ? cooccurZh(line, n, REVIVE_ZH_G) : enReviveHit(line, n))) revived = true;
    if (dead && revived && active) break;
  }
  return { dead, revived, active };
}

/** 落库摘要 → DeathRow（规范化容错：ep/name 非法丢弃、布尔仅认 true） */
export function normalizeDeathRow(raw: unknown): DeathRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  return { ep, name, dead: r.dead === true, revived: r.revived === true, active: r.active === true };
}

/**
 * 死亡跨集记账：按集升序，确认死亡入册 / 豁免出册 / 册中死者再活动即穿帮。
 * @param rows    前集死亡摘要序列（乱序安全，内部按 ep 升序，同集同名以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function deathLedger(rows: DeathRow[], curEpNo: number): DeathLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, DeathRow>();
  for (const raw of rows ?? []) {
    const r = normalizeDeathRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; deathEp: number }>();
  const issues: DeathLedgerIssue[] = [];
  for (const r of sorted) {
    const held = pool.get(r.name);
    // ① 册中死者本集再活动（该行未同时命中死亡/豁免——同集反转归集内引擎管）
    if (held && r.active && !r.dead && !r.revived) {
      issues.push({
        severity: 'high',
        type: 'resurrected_after_death',
        evidence: `${r.name}（第 ${held.deathEp} 集确认死亡）在第 ${r.ep} 集再次开口/行动`,
        advice: '死亡是最高级穿帮：要么删掉死者戏份，要么先补复活交代（假死/还魂/替身顶罪/金蝉脱壳），再让他登场',
      });
      pool.delete(r.name); // 每名字只报 1 次
      continue;
    }
    // ② 豁免出册
    if (held && r.revived) {
      pool.delete(r.name);
      continue;
    }
    // ③ 确认死亡入册（同集 active 是死前有戏，正常）
    if (r.dead && !r.revived) {
      pool.set(r.name, { name: r.name, deathEp: r.ep });
    }
  }
  return { dead: [...pool.values()], issues };
}

/**
 * 死亡调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名按原名透传）。
 */
export function deathDirective(rows: DeathRow[]): { zh: string; en: string } {
  const r = deathLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.dead.length) return { zh: '', en: '' };
  const listZh = r.dead.map((d) => `${d.name}（第${d.deathEp}集）`).join('、');
  const listEn = r.dead.map((d) => `${d.name} (ep${d.deathEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode death — resurrection watch]'] : ['【跨集死亡·复活预警】'];
    lines.push(isEn
      ? `  - Confirmed dead with no revival on record: ${listEn}. They must NOT speak or act this episode; if the plot truly needs them back, show a faked-death / soul-return / body-double reveal BEFORE they reappear.`
      : `  - 以下角色已确认死亡且无复活交代：${listZh}。本集严禁让他们开口或行动；若剧情确需登场，必须先给假死/还魂/替身顶罪交代再出场。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
