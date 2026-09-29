/**
 * 热点追更·结构化热点简报引擎（v2.94）
 * 设计目标：把用户结构化填写的热点要素作为「事实源」确定性注入管线——
 *   ① 四种借法（同人设衍生/同背景改编/同套路复刻/反向反差）各自有独立的「借什么、禁什么」指令；
 *   ② 生成前做侵权/舆情风险确定性预检：个人隐私硬信息（手机/身份证）命中即拦截、不扣费；
 *      灾难悲剧/未定性案件/直接引用原台词等高危信号只预警，转成强制虚构化指令注入各岗位；
 *   ③ 热点信号 3 秒可识别，但故事脱离热点独立成立（热度退了剧不废）。
 * 约束：纯函数 · 双语 · 零 IO · 不改变既有版式与字数闸门。
 */

export type TrendLang = 'zh' | 'en';
export type TrendKind = 'film' | 'social' | 'festival' | 'industry';
export type TrendApproach = 'persona_spin' | 'setting_remix' | 'formula_clone' | 'reversal';

export interface TrendBriefInput {
  trendName: string;       // 热点名称/出处（必填）
  trendKind: TrendKind;    // 热点类型
  approach: TrendApproach; // 借法
  heatCore: string;        // 为什么爆/情绪母题（必填）
  userAngle: string;       // 我的切入角度/故事落点
  avoidElements: string;   // 主动规避元素（角色名/标志台词/细节）
}

export type TrendBriefRaw = Partial<Record<keyof Omit<TrendBriefInput, 'trendKind' | 'approach'>, unknown>> & {
  trendKind?: unknown;
  approach?: unknown;
};

const FIELD_MAX: Record<Exclude<keyof TrendBriefInput, 'trendKind' | 'approach'>, number> = {
  trendName: 60, heatCore: 200, userAngle: 200, avoidElements: 200,
};
const KINDS: TrendKind[] = ['film', 'social', 'festival', 'industry'];
const APPROACHES: TrendApproach[] = ['persona_spin', 'setting_remix', 'formula_clone', 'reversal'];

export class TrendBriefError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'TrendBriefError';
    this.field = field;
  }
}

function str(v: unknown, field: keyof typeof FIELD_MAX, label: string, required: false | number = false): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && s.length < required) throw new TrendBriefError(field, label);
  return s.slice(0, FIELD_MAX[field]).trim();
}

export function normalizeTrendBrief(raw: TrendBriefRaw | null | undefined): TrendBriefInput {
  const r = raw ?? {};
  const trendName = str(r.trendName, 'trendName', '热点名称不能为空', 2);
  const heatCore = str(r.heatCore, 'heatCore', '请至少用 4 个字写清热点为什么爆/情绪点是什么', 4);
  return {
    trendName,
    trendKind: KINDS.includes(r.trendKind as TrendKind) ? (r.trendKind as TrendKind) : 'social',
    approach: APPROACHES.includes(r.approach as TrendApproach) ? (r.approach as TrendApproach) : 'formula_clone',
    heatCore,
    userAngle: str(r.userAngle, 'userAngle', ''),
    avoidElements: str(r.avoidElements, 'avoidElements', ''),
  };
}

export function hasTrendBrief(b: TrendBriefInput | null | undefined): b is TrendBriefInput {
  return !!b && b.trendName.length >= 2 && b.heatCore.length >= 4;
}

/* ------------------------------------------------------------------ */
/* 侵权/舆情风险确定性预检                                              */
/* ------------------------------------------------------------------ */

export interface TrendRiskSignal {
  level: 'high';
  type: 'disaster' | 'unresolved_case' | 'identifiable_person' | 'direct_quote';
  label: string;
  advice: string;
}
export interface TrendRiskReport {
  piiBlocks: string[];   // 硬信息类型（不回显原文，只回类别）
  signals: TrendRiskSignal[];
  level: 'low' | 'high'; // 有任一高危信号即 high（预警不拦截）
}

// 任何创作简报里都不应出现的个人隐私硬信息（命中即拦截）
const PII_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(?<!\d)1[3-9]\d{9}(?!\d)/, label: '手机号' },
  { re: /(?<!\d)\d{17}[\dXx](?!\d)/, label: '身份证号' },
];

// 高危题材信号：出现即要求强制虚构化（不拦截，转指令+预警）
const HIGH_ZH: Array<{ words: string[]; type: TrendRiskSignal['type']; label: string; advice: string }> = [
  { type: 'disaster', words: ['地震', '海啸', '洪水', '火灾', '坠亡', '遇难', '车祸', '自杀', '跳楼', '遇害', '身亡', '灭门', '惨案', '矿难', '空难', '遇难者', '灾难', '悲剧', '灾后', '灾后重建'],
    label: '灾难/悲剧/死亡事件', advice: '涉及灾难悲剧：只借公众情绪与公共议题，严禁还原灾难细节、消费遇难者痛苦，当事人全部虚构。' },
  { type: 'unresolved_case', words: ['嫌疑人', '被捕', '刑拘', '立案', '命案', '凶手', '在逃', '投案', '案情', '判决前'],
    label: '未定性/司法进行中案件', advice: '司法未定性事件：不得指认真实嫌疑人、不预设罪名与案情，改为完全虚构的平行故事并声明虚构。' },
  { type: 'identifiable_person', words: ['真名', '真实当事人', '本人经历', '身份证', '家庭住址', '真人真事还原'],
    label: '可识别的真实个人', advice: '含可识别私人信息：真实人物须改名换身份换关系链，避免让现实个人被对号入座。' },
];
const HIGH_EN: Array<{ words: string[]; type: TrendRiskSignal['type']; label: string; advice: string }> = [
  { type: 'disaster', words: ['earthquake victim', 'died in', 'suicide', 'mass shooting', 'fatal crash', 'killed in', 'disaster', 'tragedy', 'after the disaster'],
    label: 'disaster / tragedy / death', advice: 'Disaster or tragedy: borrow only the public emotion and issue; never recreate disaster details or exploit victims; all people fictional.' },
  { type: 'unresolved_case', words: ['suspect arrested', 'ongoing investigation', 'charged with murder', 'manhunt'],
    label: 'unresolved / ongoing legal case', advice: 'Ongoing case: do not identify real suspects or presume guilt; use a fully fictional parallel story.' },
  { type: 'identifiable_person', words: ['real name', 'based on the actual victim', 'real person'],
    label: 'identifiable real person', advice: 'Identifiable person: rename and rebuild identity/relations so no real individual is recognizable.' },
];

/** 直接引用原热点/原作台词：中文「」/“”或英文引号内含 ≥6 字内容，视为搬运表达风险 */
function directQuoteSignals(text: string, lang: TrendLang): TrendRiskSignal | null {
  const quoted = text.match(/[「“]([^」”]{6,})[」”]/g)
    || (lang === 'en' ? text.match(/"([^"]{6,})"/g) : null);
  if (!quoted || !quoted.length) return null;
  return {
    level: 'high', type: 'direct_quote',
    label: lang === 'en' ? 'direct quote from the source' : '直接引用原热点/原作文句',
    advice: lang === 'en'
      ? 'A 6+ character direct quote was pasted: never reuse original lines; rewrite the same beat entirely in your own dialogue.'
      : '检测到 6 字以上的直接引用：原热点/原作文句一句不可沿用，请把该节拍全部改写成自己的台词。',
  };
}

export function scanTrendRisk(b: TrendBriefInput, lang: TrendLang = 'zh'): TrendRiskReport {
  const joined = [b.trendName, b.heatCore, b.userAngle, b.avoidElements].filter(Boolean).join(' / ');
  const piiBlocks = PII_PATTERNS.filter((p) => p.re.test(joined)).map((p) => p.label);
  const dict = lang === 'en' ? HIGH_EN : HIGH_ZH;
  const lower = joined.toLowerCase();
  const signals: TrendRiskSignal[] = [];
  for (const h of dict) {
    if (h.words.some((w) => lower.includes(w.toLowerCase()))) {
      signals.push({ level: 'high', type: h.type, label: h.label, advice: h.advice });
    }
  }
  const q = directQuoteSignals(joined, lang);
  if (q) signals.push(q);
  return { piiBlocks, signals, level: piiBlocks.length ? 'high' : (signals.length ? 'high' : 'low') };
}

/* ------------------------------------------------------------------ */
/* 管线指令拼装（架构师 / 撰写师 / 打回重写共用同一份事实源）            */
/* ------------------------------------------------------------------ */

const KIND_ZH: Record<TrendKind, string> = {
  film: '影视综热点', social: '社会话题', festival: '节日/时令节点', industry: '行业事件',
};
const KIND_EN: Record<TrendKind, string> = {
  film: 'film/TV/show trend', social: 'social topic', festival: 'festival / seasonal moment', industry: 'industry event',
};

const APPROACH_ZH: Record<TrendApproach, string> = {
  persona_spin: '借法=同人设衍生：只借「人物关系原型与身份反差」的骨架；全部人物改名、换职业换城市，不得沿用原作角色名、绰号、标志性造型、口头禅或招牌动作；换皮后情节必须重新生长，不复演名场面。',
  setting_remix: '借法=同背景改编：只借「情境母题/世界观设定」（一类职场、一类关系困境）；具体事件链、场景与结局全部原创，不复用原作专有地名、组织名与独特情节序列。',
  formula_clone: '借法=同套路复刻：只借抽象结构——钩子类型、反转节点、节奏与情绪兑付逻辑；原台词一句不沿用，人设/背景/核心冲突全换，成稿不得与原热点出现连续 8 字以上相同表达。',
  reversal: '借法=反向反差：先立大众对热点的共识预期，再在转折处给出相反答案；翻的是认知不是苦难，严禁消费灾难、悲剧与当事人痛苦，结局给建设性出口。',
};
const APPROACH_EN: Record<TrendApproach, string> = {
  persona_spin: 'Approach = persona spin: borrow only the skeleton of relationship archetypes and identity contrast; rename every character and change jobs/city; never reuse original names, nicknames, signature looks, catchphrases or moves; after re-skinning the plot must grow anew — never re-stage signature scenes.',
  setting_remix: 'Approach = setting remix: borrow only the situational motif / world premise (a workplace type, a relationship dilemma); all event chains, scenes and endings are original; never reuse the source’s proper place/org names or distinctive plot sequences.',
  formula_clone: 'Approach = formula clone: borrow only the abstract structure — hook type, reversal nodes, pacing and payoff logic; not a single source line is reused; persona/setting/core conflict fully swapped; no 8+ character run may match the source.',
  reversal: 'Approach = reversal: first establish the crowd’s consensus expectation, then deliver the opposite answer at the turn; overturn a belief, never someone’s suffering — do not exploit disasters, tragedies or victims; end on a constructive way out.',
};

export function buildTrendDirective(b: TrendBriefInput, risk: TrendRiskReport | null, lang: TrendLang = 'zh'): string {
  if (lang === 'en') {
    const lines = [
      '[TREND-CHASING BRIEF — source of truth, follow verbatim]',
      `· Trend: ${b.trendName} (${KIND_EN[b.trendKind]})`,
      `· Why it is hot / emotional core: ${b.heatCore}`,
    ];
    if (b.userAngle) lines.push(`· Your angle / landing point: ${b.userAngle}`);
    lines.push(`· ${APPROACH_EN[b.approach]}`);
    if (b.avoidElements) lines.push(`· Explicitly avoid: ${b.avoidElements}`);
    lines.push('· Common rules: borrow only verified public facts; fictionalize all real orgs/brands/names; never use the trend’s signature lines; the story MUST stand on its own without the trend (no expiry-date drama); signal the trend within the opening 3 seconds; one conflict per episode, at most 3 principal characters.');
    if (risk?.signals.length) {
      lines.push('· MANDATORY FICTIONALIZATION (risk pre-check hit):');
      risk.signals.forEach((s) => lines.push(`  - [${s.label}] ${s.advice}`));
    }
    return lines.join('\n');
  }
  const lines = [
    '【热点追更 · 热点简报·必须严格遵守】（以下为事实源，逐字使用）',
    `◆ 热点：${b.trendName}（${KIND_ZH[b.trendKind]}）`,
    `◆ 爆点/情绪母题：${b.heatCore}`,
  ];
  if (b.userAngle) lines.push(`◆ 我的切入角度/故事落点：${b.userAngle}`);
  lines.push(`◆ ${APPROACH_ZH[b.approach]}`);
  if (b.avoidElements) lines.push(`◆ 明确规避：${b.avoidElements}`);
  lines.push('◆ 通用风控：只借已证实的公共事实，真实机构/品牌/人名一律虚化；不用原热点标志性台词；故事脱离热点本身也必须成立（热度退了剧不废）；开篇 3 秒内给出热点信号；单集只解决一个冲突、主要人物不超过 3 个。');
  if (risk?.signals.length) {
    lines.push('◆ 强制虚构化要求（生成前风险预检命中，必须逐条落实）：');
    risk.signals.forEach((s) => lines.push(`  - 【${s.label}】${s.advice}`));
  }
  return lines.join('\n');
}
