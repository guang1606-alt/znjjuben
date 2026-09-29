/**
 * v2.80 反派威胁升级账本（Villain Threat Ledger）
 * ------------------------------------------------------------------
 * 缺口：antagonist-quality-check 管单集反派质量（缺席/蠢/无动机/无筹码）、
 * conflict-escalation-check 管单集烈度爬坡，但"跨集压迫感递进"无人管——
 *   1) 反派连续几集没动作 = 观众忘了恨谁，压迫感半衰期耗尽 = 反派工具人化；
 *   2) 反派每集都用同一档手段（只会口头威胁/只会摔东西）= 威胁不升级
 *      = 观众免疫，后面真下杀手也不怕了。
 *
 * 记账模型（与承诺欠账同构，纯确定性）：
 *   每集摘要 { ep, line(反派动作代表词), acted(本集有反派动作), level(0-3 威胁档) }
 *   威胁档：L1 口头威胁（威胁/放狠话/最后通牒）→ L2 行动威胁（抓/绑/烧/毁/开除）
 *          → L3 生死威胁（杀/灭口/血洗/弄死）。
 *   按集升序过账：
 *     有动作且档位高于前次 → 升级：silent/stagnant 双清零；
 *     有动作但档位 ≤ 前次  → 同档复用：silent 清零，stagnant + 1；
 *     无动作              → 反派缺席：silent + 1（stagnant 挂起保持）。
 *   silent ≥2 → mid；≥3 → high（连续缺席 2 集即警示）。
 *   stagnant ≥3 → mid；≥4 → high（同档复用 3 集观众开始免疫）。
 * 输出：威胁结果 + 架构师"反派回场施压/威胁升档"指令（与承诺欠账注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * line 为动作词按原样透传（≤20 字截断）。
 */

export type VtLang = 'zh' | 'en';

export interface VillainRow {
  /** 集号 */
  ep: number;
  /** 本集反派动作代表词（''=本集无反派动作） */
  line: string;
  /** 本集正文是否有反派威胁动作 */
  acted: boolean;
  /** 威胁档 0-3（0=无动作；1=口头；2=行动；3=生死） */
  level: number;
}

export interface VillainThreatIssue {
  severity: 'mid' | 'high';
  type: 'villain_silent' | 'villain_stagnant';
  evidence: string;
  advice: string;
}

export interface VillainThreatResult {
  /** 反派连续无动作的集数 */
  silentRun: number;
  /** 反派连续复用同档手段（未升级）的集数 */
  stagnantRun: number;
  /** none / mid / high（silent 与 stagnant 取重者） */
  level: 'none' | 'mid' | 'high';
  /** 最近一次反派动作代表词（供指令引用） */
  line: string;
  issues: VillainThreatIssue[];
}

/** 反派缺席阈值：≥2 报 mid，≥3 升 high */
export const VILLAIN_SILENT_MID = 2;
export const VILLAIN_SILENT_HIGH = 3;
/** 同档复用阈值：≥3 报 mid，≥4 升 high */
export const VILLAIN_STAGNANT_MID = 3;
export const VILLAIN_STAGNANT_HIGH = 4;

/** 动作词截断长度（控台账/提示词预算） */
const LINE_MAX = 20;

// —— 威胁动作词典：L3 生死 > L2 行动 > L1 口头（zh 词组级；en 小写短语级）——
const THREAT_L1_ZH: string[] = [
  '威胁', '恐吓', '放狠话', '放话', '警告', '最后通牒', '给我等着', '你等着', '不会让你好过', '走着瞧', '给我小心点', '有你好受',
];
const THREAT_L2_ZH: string[] = [
  '逼债', '逼婚', '逼签', '逼宫', '抓走', '抓了', '绑走', '绑架', '下毒', '追杀', '烧了', '烧掉', '砸了', '砸场', '毁了', '废了', '废掉',
  '开除', '解雇', '赶走', '赶出去', '逐出', '冻结', '封杀', '查封', '抢走', '夺走', '撕毁', '堵门', '泼了', '泼在', '上门',
];
const THREAT_L3_ZH: string[] = [
  '杀了', '杀了他', '杀了你', '灭口', '灭门', '血洗', '活埋', '枪毙', '弄死', '做掉', '干掉', '陪葬', '埋了他', '见血',
];
const THREAT_L1_EN: string[] = [
  'threaten', 'threat', 'warned', 'warning', 'ultimatum', "you'll regret", 'you will regret', 'make you pay', 'watch your back', 'remember this', 'or else',
];
const THREAT_L2_EN: string[] = [
  'kidnapped', 'kidnap', 'poisoned', 'poison', 'burned down', 'burn down', 'burned', 'destroy', 'destroyed', 'ruined', 'ruin',
  'fired', 'evicted', 'evict', 'blacklist', 'framed', 'ambush', 'hunt you down', 'come after you', 'take everything', 'seized', 'smashed',
];
const THREAT_L3_EN: string[] = [
  'kill', 'killed', 'murder', 'murdered', 'dead man', 'bury you', 'make you disappear', 'bloodbath', 'put a bullet', 'end you',
];

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

/**
 * 反派威胁动作检测：按 L3 → L2 → L1 逐档扫描（重档优先），
 * 命中返回 { line: 代表词, level: 档位 }；无命中 → { line: '', level: 0 }。
 * 空文本安全；zh 与 en 各自词表（en 小写匹配）。
 */
export function detectVillainAction(text: string): { line: string; level: number } {
  if (!text || !text.trim()) return { line: '', level: 0 };
  const zh = isZhText(text);
  const hay = zh ? text : text.toLowerCase();
  const ladders: string[][] = zh ? [THREAT_L3_ZH, THREAT_L2_ZH, THREAT_L1_ZH] : [THREAT_L3_EN, THREAT_L2_EN, THREAT_L1_EN];
  for (let i = 0; i < ladders.length; i++) {
    const word = ladders[i].find((w) => hay.includes(w));
    if (word) return { line: word.slice(0, LINE_MAX), level: 3 - i };
  }
  return { line: '', level: 0 };
}

/** 落库摘要 → VillainRow（规范化容错：ep 非法丢弃、level clamp 0-3、acted 容错 true/1；acted=false 强制清 line/level） */
export function normalizeVillainRow(raw: unknown): VillainRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const acted = r.acted === true || r.acted === 1;
  const levelRaw = Math.round(Number(r.level));
  let level = Number.isFinite(levelRaw) ? Math.max(0, Math.min(3, levelRaw)) : 0;
  let line = typeof r.line === 'string' ? r.line.slice(0, LINE_MAX) : '';
  if (!acted) {
    line = '';
    level = 0;
  } else if (level < 1) {
    level = 1; // 容错：声明有动作但档位缺失 → 归入口头档
  }
  return { ep, line, acted, level };
}

/**
 * 反派威胁记账：按集升序，升级双清零 / 同档复用 stagnant+1 / 无动作 silent+1。
 * @param rows    前集反派摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function villainThreatLedger(rows: VillainRow[], curEpNo: number): VillainThreatResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizeVillainRow)
    .filter((r): r is VillainRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let silentRun = 0;
  let stagnantRun = 0;
  let prevLevel = 0;
  let prevLine = '';
  for (const r of sorted) {
    if (!r.acted) {
      silentRun += 1; // 反派缺席：压迫感每集衰减（stagnant 挂起保持——没动作谈不上复用）
      continue;
    }
    if (r.level > prevLevel) {
      silentRun = 0;
      stagnantRun = 0; // 威胁升级：压迫感重启
    } else {
      silentRun = 0;
      stagnantRun += 1; // 同档或降档复用：观众免疫累积
    }
    prevLevel = r.level;
    prevLine = r.line;
  }
  const silentLevel: 'none' | 'mid' | 'high' = silentRun >= VILLAIN_SILENT_HIGH ? 'high' : silentRun >= VILLAIN_SILENT_MID ? 'mid' : 'none';
  const stagnantLevel: 'none' | 'mid' | 'high' = stagnantRun >= VILLAIN_STAGNANT_HIGH ? 'high' : stagnantRun >= VILLAIN_STAGNANT_MID ? 'mid' : 'none';
  const rank = { none: 0, mid: 1, high: 2 };
  const level: 'none' | 'mid' | 'high' = rank[stagnantLevel] >= rank[silentLevel] ? stagnantLevel : silentLevel;
  const issues: VillainThreatIssue[] = [];
  if (silentLevel !== 'none') {
    issues.push({
      severity: silentLevel,
      type: 'villain_silent',
      evidence: `反派已连续 ${silentRun} 集无任何威胁动作（上次动作「${prevLine.slice(0, 10)}」）`,
      advice: '反派不能隐身：压迫感有半衰期，反派消失观众就忘了恨谁——本集让他回到台前亲自做一件狠事（当面下通牒/动手毁掉主角一样东西），重新点燃仇恨',
    });
  }
  if (stagnantLevel !== 'none') {
    issues.push({
      severity: stagnantLevel,
      type: 'villain_stagnant',
      evidence: `反派连续 ${stagnantRun} 集复用同档手段（${prevLine.slice(0, 10)}，威胁档 L${prevLevel}），威胁未升级`,
      advice: '同一档威胁连用几集观众就免疫了——给反派加码：更大筹码（能毁掉主角的证据/权柄）、更狠手段（口头→行动→生死逐级上），或换一条更阴毒的攻击线',
    });
  }
  return { silentRun, stagnantRun, level, line: prevLine, issues };
}

/**
 * 反派威胁调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * silent 与 stagnant 同时达标取更重者输出单块；无达标/无输入返回空串。
 */
export function villainThreatDirective(rows: VillainRow[]): { zh: string; en: string } {
  const r = villainThreatLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  // 最重档内含同档复用病 → 优先报升档（升级是更隐蔽的病）；否则报缺席
  const isStagnant = r.issues.filter((i) => i.severity === r.level).some((i) => i.type === 'villain_stagnant');
  const quote = r.line.slice(0, LINE_MAX);
  const build = (isEn: boolean): string => {
    const lines = isStagnant
      ? isEn ? ['[Villain threat — escalate this episode]'] : ['【反派威胁·本集升档】']
      : isEn ? ['[Villain threat — bring him back on stage]'] : ['【反派威胁·本集回场施压】'];
    lines.push(isStagnant
      ? isEn
        ? `  - The villain has recycled the same level of menace (${quote}) for ${r.stagnantRun} episodes — escalate now: bigger leverage, crueler method (verbal → physical → lethal), or a nastier attack line; recycled threats make the audience immune.`
        : `  - 反派已连续 ${r.stagnantRun} 集复用同档手段（${quote}）——本集升档：更大筹码（能毁掉主角的证据/权柄）、更狠手段（口头→行动→生死逐级上），或换一条更阴毒的攻击线。`
      : isEn
        ? `  - The antagonist has been offstage for ${r.silentRun} episodes with zero pressure moves — bring him back in person this episode with one ruthless, concrete action (a face-to-face ultimatum, destroying something of the protagonist's); a villain who goes quiet stops being scary.`
        : `  - 反派已连续 ${r.silentRun} 集无任何威胁动作——本集让他回到台前亲自做一件狠事（当面下通牒/动手毁掉主角一样东西），重新点燃仇恨；反派隐身=压迫感半衰期耗尽=观众忘了恨谁。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
