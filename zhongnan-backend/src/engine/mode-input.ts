/**
 * 四模式表单事实源引擎（v2.345）
 * 设计目标：把 persona/duel/multiverse/diary 四模式的用户表单字段作为「事实源」确定性注入管线——
 *   ① 立项时随项目落库 project.bible.modeInput（与 castAssets 同构，续写/重生成沿用）；
 *   ② 按模式命名空间隔离（persona 模式只收 persona 键，夹带的其他模式字段一律剥离）；
 *   ③ 生成时编译成架构师/撰写师双岗强约束指令（与 brand-brief 同范式，双语）；
 *   ④ diary 授权档（summary/selected/full）落库即边界，非法档位不落库、缺省按最严档。
 * 约束：纯函数 · 双语 · 零 IO · 不改变既有版式与字数闸门。
 */

export type ModeInputLang = 'zh' | 'en';
export type DiaryAuth = 'summary' | 'selected' | 'full';

export interface PersonaInput { identity: string; want: string; fear: string; lie: string }
export interface DuelSideInput { identity: string; want: string; line: string }
export interface DuelInput { a?: DuelSideInput; b?: DuelSideInput }
export interface WorldlineInput { route: string; cost: string }
export interface MultiverseInput { choice: string; lines: WorldlineInput[] }
export interface DiaryInput { auth: DiaryAuth }

export interface ModeInput {
  persona?: PersonaInput;
  duel?: DuelInput;
  multiverse?: MultiverseInput;
  diary?: DiaryInput;
}

const DIARY_AUTHS: DiaryAuth[] = ['summary', 'selected', 'full'];
const ID_MAX = 120;   // 身份/关键选择类短字段
const TXT_MAX = 200;  // 欲望/恐惧/谎言/路线/代价类长字段

function s(v: unknown, max: number): string {
  return (typeof v === 'string' ? v.trim().slice(0, max).trim() : '');
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function sanitizePersona(raw: unknown): PersonaInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  const p: PersonaInput = { identity: s(r.identity, ID_MAX), want: s(r.want, TXT_MAX), fear: s(r.fear, TXT_MAX), lie: s(r.lie, TXT_MAX) };
  return (p.identity || p.want || p.fear || p.lie) ? p : undefined;
}

function sanitizeDuelSide(raw: unknown): DuelSideInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  const d: DuelSideInput = { identity: s(r.identity, ID_MAX), want: s(r.want, TXT_MAX), line: s(r.line, TXT_MAX) };
  return (d.identity || d.want || d.line) ? d : undefined;
}

function sanitizeDuel(raw: unknown): DuelInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  const a = sanitizeDuelSide(r.a);
  const b = sanitizeDuelSide(r.b);
  if (!a && !b) return undefined;
  return { ...(a ? { a } : {}), ...(b ? { b } : {}) };
}

function sanitizeMultiverse(raw: unknown): MultiverseInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  const choice = s(r.choice, TXT_MAX);
  const lines: WorldlineInput[] = [];
  if (Array.isArray(r.lines)) {
    for (const item of r.lines) {
      const row = obj(item);
      if (!row) continue;
      const route = s(row.route, TXT_MAX);
      if (!route) continue; // 空路线行剔除（代价不能脱离路线独立存在）
      lines.push({ route, cost: s(row.cost, TXT_MAX) });
      if (lines.length >= 4) break; // 与前端「2-4 条世界线」同帽
    }
  }
  if (!choice && !lines.length) return undefined;
  return { choice, lines };
}

function sanitizeDiary(raw: unknown): DiaryInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  // 授权档非法不落库：下游缺省按最严档 summary 消费（授权只能显式放宽，不能显式收紧失败后被默许）
  return DIARY_AUTHS.includes(r.auth as DiaryAuth) ? { auth: r.auth as DiaryAuth } : undefined;
}

/** 立项入参清洗：只保留当前模式命名空间，其余模式字段一律剥离；全空返回 undefined（不写 bible） */
export function sanitizeModeInput(raw: unknown, canonMode: string): ModeInput | undefined {
  const r = obj(raw);
  if (!r) return undefined;
  let out: ModeInput | undefined;
  if (canonMode === 'persona') {
    const persona = sanitizePersona(r.persona);
    if (persona) out = { persona };
  } else if (canonMode === 'duel') {
    const duel = sanitizeDuel(r.duel);
    if (duel) out = { duel };
  } else if (canonMode === 'multiverse') {
    const multiverse = sanitizeMultiverse(r.multiverse);
    if (multiverse) out = { multiverse };
  } else if (canonMode === 'diary') {
    const diary = sanitizeDiary(r.diary);
    if (diary) out = { diary };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 管线指令拼装（架构师 / 撰写师双岗共用同一份事实源）                    */
/* ------------------------------------------------------------------ */

const DIARY_AUTH_ZH: Record<DiaryAuth, string> = {
  summary: '仅摘要：系统只提炼梗概与情绪走向，禁止逐字引用日记原文任何句子',
  selected: '指定段落：仅日记中「// 纳入」标记的段落可进入剧本，其余段落同样只提炼不引用',
  full: '全部放行：日记可完整进入剧本，但真实人名/地名/单位一律化名，可识别细节做文学变形',
};
const DIARY_AUTH_EN: Record<DiaryAuth, string> = {
  summary: 'Summary only: distill gist and emotional arc; NEVER quote any verbatim sentence from the diary',
  selected: 'Selected passages: only paragraphs marked “// include” may enter the script; everything else is gist-only',
  full: 'Full release: the diary may enter the script in full, but all real names/places/orgs must be fictionalized and identifying details transformed',
};

function personaDirective(p: PersonaInput, lang: ModeInputLang): string {
  const lines: string[] = [];
  if (lang === 'en') {
    lines.push('[PERSONA MONLOGUE · narrator fact sheet — hard facts, follow verbatim]');
    if (p.identity) lines.push(`· Narrator identity: ${p.identity} (the first-person “I” must stay consistent with this)`);
    if (p.want) lines.push(`· What they want most: ${p.want} (the desire engine — every action this episode must trace back to it)`);
    if (p.fear) lines.push(`· What they fear most: ${p.fear} (the midpoint must touch this nerve at least once)`);
    if (p.lie) lines.push(`· The lie they tell themselves: ${p.lie} (let them self-deceive with it in the first half; tear it open in the second)`);
    lines.push('· Unreliable narration: concealment and selective memory are allowed early, but the lie must start collapsing once the fear is touched.');
    return lines.join('\n');
  }
  lines.push('【角色自述·叙述者事实源·必须严格遵守】');
  if (p.identity) lines.push(`◆ 叙述者身份：${p.identity}（第一人称「我」的言行必须与此一致）`);
  if (p.want) lines.push(`◆ 最想要：${p.want}（全剧欲望发动机，本集每个行动都要能追溯到此）`);
  if (p.fear) lines.push(`◆ 最怕：${p.fear}（中段必须触碰这条神经至少一次）`);
  if (p.lie) lines.push(`◆ 对自己撒的谎：${p.lie}（前半段让 TA 以此自欺，后半段撕开）`);
  lines.push('◆ 不可靠叙述：前半段允许隐瞒/选择性记忆，但谎言必须在「最怕」被触碰时开始崩解。');
  return lines.join('\n');
}

function duelDirective(d: DuelInput, lang: ModeInputLang): string {
  const lines: string[] = [];
  const side = (tag: string, v?: DuelSideInput): string | null => {
    if (!v) return null;
    const parts = [v.identity, v.want, v.line].filter(Boolean);
    return parts.length ? `${tag}: ${parts.join(lang === 'en' ? ' | ' : '｜')}` : null;
  };
  if (lang === 'en') {
    lines.push('[TWO-HANDER DUEL · both sides’ fact sheet — hard facts, follow verbatim]');
    const a = side('A', d.a); const b = side('B', d.b);
    if (a) lines.push(`· ${a} (identity | want | why they cannot back down)`);
    if (b) lines.push(`· ${b} (identity | want | why they cannot back down)`);
    lines.push('· Duel rules: BOTH sides must be right in their own terms; alternate moves with escalation each round; never write either side as a pure villain.');
    return lines.join('\n');
  }
  lines.push('【双人对撞·双方事实源·必须严格遵守】');
  const a = side('A', d.a); const b = side('B', d.b);
  if (a) lines.push(`◆ ${a}（身份｜要什么｜为什么不能退）`);
  if (b) lines.push(`◆ ${b}（身份｜要什么｜为什么不能退）`);
  lines.push('◆ 对撞铁律：A 和 B 都必须有自己的道理；轮流出招、每轮加码；不得把任一方写成纯粹坏人。');
  return lines.join('\n');
}

function multiverseDirective(m: MultiverseInput, lang: ModeInputLang): string {
  const lines: string[] = [];
  if (lang === 'en') {
    lines.push('[WORLD-LINE DEDUCTION · fork fact sheet — hard facts, follow verbatim]');
    if (m.choice) lines.push(`· The pivotal choice: ${m.choice} (every world-line forks from this single point)`);
    m.lines.forEach((l, i) => {
      lines.push(`· World-line ${String.fromCharCode(65 + i)}: route — ${l.route}${l.cost ? `; cost — ${l.cost}` : ''}`);
    });
    lines.push('· Each line must be self-consistent: the route is what the character chooses; the cost is what that choice irreversibly changes. By default every line’s lesson merges back into the mainline ending.');
    return lines.join('\n');
  }
  lines.push('【世界线推演·分叉事实源·必须严格遵守】');
  if (m.choice) lines.push(`◆ 关键选择：${m.choice}（所有世界线从此一点分叉）`);
  m.lines.forEach((l, i) => {
    lines.push(`◆ 世界线 ${String.fromCharCode(65 + i)}：路线 ${l.route}${l.cost ? `｜代价 ${l.cost}` : ''}`);
  });
  lines.push('◆ 每条线必须自洽：路线是人物的选择，代价是这个选择不可逆地改变了什么；缺省把各线教训合并回主线结局。');
  return lines.join('\n');
}

function diaryDirective(d: DiaryInput, lang: ModeInputLang): string {
  if (lang === 'en') {
    return [
      '[DIARY MODE · authorization boundary — hard constraint]',
      `· Authorization tier: ${DIARY_AUTH_EN[d.auth]}`,
      '· Beyond the authorized scope the diary does not exist for you; never infer or fabricate diary passages.',
    ].join('\n');
  }
  return [
    '【日记式创作·授权边界·必须严格遵守】',
    `◆ 授权档位：${DIARY_AUTH_ZH[d.auth]}`,
    '◆ 授权范围之外的日记对你不存在；禁止推测、虚构授权范围外的日记内容。',
  ].join('\n');
}

/** 编译双岗强约束指令；模式与命名空间不匹配、输入为空时返回空串（不注入） */
export function buildModeInputDirective(canonMode: string | null | undefined, input: ModeInput | null | undefined, lang: ModeInputLang = 'zh'): string {
  if (!input || !canonMode) return '';
  if (canonMode === 'persona' && input.persona) return personaDirective(input.persona, lang);
  if (canonMode === 'duel' && input.duel) return duelDirective(input.duel, lang);
  if (canonMode === 'multiverse' && input.multiverse) return multiverseDirective(input.multiverse, lang);
  if (canonMode === 'diary' && input.diary) return diaryDirective(input.diary, lang);
  return '';
}
