import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 焊点承接检测（Opening Continuity Check）——跨集结尾焊点的"检测"半边
 * ------------------------------------------------------------------
 * 缺口：continuity-brief 已把前集结尾原句（endingBlock）注入架构师/撰写师，
 * 指令是"开场必须从此瞬间无缝接起"，但成稿后没有任何质检验证本集开场
 * 是否真的承接了——生成侧承诺、检测侧失明，焊点断了也无人知晓。
 * 本引擎在【成稿后】做确定性验证：
 *   1) speaker_missing  前集结尾的说话人（台词行"名字（情绪）："模式提取）
 *                       在本集开场块内全部消失 → 高危（连一个共同词都没有）
 *                       或中危（有零星词汇重叠但人物没接住）；
 *   2) cold_open        结尾无台词可提取（纯动作行）且开场块与结尾零 2-gram
 *                       重叠 → 中危（词汇层面完全另起炉灶）；
 *   3) delayed_open     开场直接打时间跳变标记（次日/三天后…）→ 低危
 *                       （跳时间可以，但先给结尾瞬间半句收束再跳）。
 * 开场块界定：正文开头到第二个场标之间（首个场景即开场），cap 800 字。
 * 纯确定性、零 LLM、零 IO；中英双语，en 层系统文案零中文（引文按原样透传）。
 */

export type OcLang = 'zh' | 'en';

export interface OpeningContinuityIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'speaker_missing' | 'cold_open' | 'delayed_open';
  evidence: string;
  advice: string;
  key: string;
}

export interface OpeningContinuityResult {
  score: number;
  /** prevEnding 有效（≥20 字）才真正检测；无效时 score=100 且零 issue */
  checked: boolean;
  prevEndingChars: number;
  /** 前集结尾提取到的说话人（去重，保持出场顺序） */
  speakers: string[];
  /** 结尾最后一句台词的说话人（正信号锚点，无则为 ''） */
  lastSpeaker: string;
  /** 开场块与结尾的词汇重叠数（zh=2-gram / en=实词 token） */
  overlapCount: number;
  issueCount: number;
  issues: OpeningContinuityIssue[];
}

// —— 场标识别（与 location-continuity-check 同约定，独立持有防耦合）——
// —— 时间跳变标记（delayed_open 信号）——
const TIME_JUMP_ZH = /次日|第二天|隔日|三(?:天|日)后|几(?:天|日)后|数(?:天|日)后|[一二三四五六七八九十两\d]+个?月后|一周后|数周后|半年后|一年后|多年后|翌日/;
const TIME_JUMP_EN = /\b(?:the next day|the following day|days later|three days later|a week later|weeks later|months later|a year later|years later)\b/i;

// —— 说话人提取排除表：非人名的高频冒号行 ——
const SPEAKER_STOP_ZH = new Set(['旁白', '画外音', '字幕', '内心', '独白', '闪回', '回忆', '插叙', '屏幕', '众人', '全體', '全体', '手机', '电话', '备注', '场景', '画面', '手机屏幕', '特写', '空镜', '黑屏', '转场', '标题', '画外']);
const SPEAKER_STOP_EN = new Set(['cut', 'cut to', 'fade', 'fade in', 'fade out', 'int', 'ext', 'scene', 'note', 'title', 'smash cut', 'time cut', 'continued']);

/** zh 台词行："名字（情绪）：台词" / "名字：台词"；名字 2-10 位中英数字 */
const SPEAKER_ZH = /^([^\s：:（）()【】△]{2,10})\s*(?:（[^）]{1,14}）|\([^)]{1,20}\))?\s*[：:]/;
/** en 台词行："ELENA (angry): line" / "Elena: line" */
const SPEAKER_EN = /^([A-Za-z][A-Za-z .'\u2019-]{1,24})\s*(?:\([^)]{1,28}\))?\s*:\s/;

/** en 实词判定用的虚词表（3+ 字母仍高频无区分度的） */
const EN_STOPWORDS = new Set(['the', 'and', 'was', 'her', 'his', 'she', 'him', 'with', 'that', 'this', 'from', 'into', 'were', 'they', 'then', 'but', 'for', 'are', 'you', 'your', 'had', 'has', 'not', 'all', 'out', 'off', 'get', 'got', 'when', 'what', 'who', 'why', 'how', 'its', 'their', 'there', 'have', 'one', 'just', 'like', 'over', 'than', 'them', 'will', 'would', 'could', 'been', 'being', 'did', 'does', 'done', 'onto', 'upon', 'about', 'after', 'before', 'while', 'where', 'again', 'still', 'even', 'only', 'very', 'some', 'any', 'can']);

/** 提取前集结尾台词说话人（保持出场顺序去重，取末尾 4 个） */
function extractSpeakers(ending: string, lang: OcLang): string[] {
  const out: string[] = [];
  for (const raw of ending.split('\n')) {
    const line = raw.trim().replace(/^△\s*/, '');
    if (!line) continue;
    const m = lang === 'zh' ? line.match(SPEAKER_ZH) : line.match(SPEAKER_EN);
    if (!m) continue;
    const name = m[1].trim();
    if (name.length < 2 || name.length > 12) continue;
    if (/\d/.test(name)) continue;
    const stop = lang === 'zh' ? SPEAKER_STOP_ZH : SPEAKER_STOP_EN;
    if (stop.has(lang === 'zh' ? name : name.toLowerCase())) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out.slice(-4);
}

/** 规范化：去空白与标点，仅留字母数字（zh 用 2-gram、en 用实词 token） */
function normalizeText(s: string): string {
  return (s ?? '').replace(/[^\p{L}\p{N}]+/gu, '');
}

/** 词汇重叠数：zh=结尾 2-gram 在开场块中的命中数；en=结尾实词 token 命中数 */
function lexicalOverlap(ending: string, opening: string, lang: OcLang): number {
  if (lang === 'en') {
    const tokens = (ending.toLowerCase().match(/[a-z']{3,}/g) ?? [])
      .map((t) => t.replace(/'/g, ''))
      .filter((t) => !EN_STOPWORDS.has(t));
    const openLow = opening.toLowerCase();
    return [...new Set(tokens)].filter((t) => openLow.includes(t)).length;
  }
  const e = normalizeText(ending);
  const o = normalizeText(opening);
  if (e.length < 2 || !o) return 0;
  let hit = 0;
  const seen = new Set<string>();
  for (let i = 0; i + 1 < e.length; i += 1) {
    const g = e.slice(i, i + 2);
    if (seen.has(g)) continue;
    seen.add(g);
    if (o.includes(g)) hit += 1;
  }
  return hit;
}

const ADVICE = {
  speaker_missing: {
    zh: '前集结尾的说话人在本集开场集体消失：开场先让 TA 接话或给反应镜头承接上一瞬，再用一句台词交代 TA 的即时去向；严禁当成无事发生另起炉灶。',
    en: "The previous episode's final speakers vanish from this opening: have one of them speak or react first to carry the moment, then establish their whereabouts via a line; never pretend nothing happened.",
  },
  cold_open: {
    zh: '开场与前集结尾零词汇衔接（无共同人物/道具/地点词）：从结尾瞬间的同一动作、同一场地或下一句对话接起，先落定再推进。',
    en: 'The opening shares zero lexical continuity with the previous ending (no shared character/prop/place words): pick up from the same beat — same action, same place, or the very next line — before moving on.',
  },
  delayed_open: {
    zh: '开场直接跳时间：先给前集结尾瞬间的收束半句（余音、反应或动作结果）再跳，不要观众一睁眼就已换了天。',
    en: 'The opening cuts time immediately: close the previous beat first (an afterbeat, a reaction, the result of the final action) before the time jump.',
  },
};

export function openingContinuityCheck(prevEnding: string, draft: string, lang: OcLang = 'zh'): OpeningContinuityResult {
  const isZh = lang === 'zh';
  const ending = (prevEnding ?? '').trim();
  const empty: OpeningContinuityResult = {
    score: 100, checked: false, prevEndingChars: 0, speakers: [], lastSpeaker: '',
    overlapCount: 0, issueCount: 0, issues: [],
  };
  if (ending.length < 20) return empty;

  const text = (draft ?? '').replace(/\r\n?/g, '\n');
  if (text.trim().length < 20) return { ...empty, checked: true, prevEndingChars: ending.length };

  // 开场块：开头到第二个场标之间（首个场景即开场），cap 800 字
  // c214 修复：开头剧名行（第N集…/Episode N…）不是场标——旧逻辑把它计为第 1 个场标，
  // 开场块被截成"剧名行+首个场标"两行空壳（真实开场内容全在界外），speaker_missing 必误报、
  // delayed_open 必漏报。剧名行仅在开头位置跳过（场/幕级标题仍是真场标，不误伤）。
  let boundary = text.length;
  let headerCount = 0;
  const lines = text.split('\n');
  let charCursor = 0;
  let leadChecked = false;
  for (const raw of lines) {
    const t = raw.trim();
    charCursor += raw.length + 1;
    if (!t) continue;
    if (!leadChecked) {
      leadChecked = true;
      if (/^第\s*[0-9一二三四五六七八九十百千两]+\s*集/.test(t) || /^episode\s+\d+/i.test(t)) continue;
    }
    if (isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      headerCount += 1;
      if (headerCount >= 2) { boundary = charCursor; break; }
    }
    if (charCursor >= 800) { boundary = Math.min(boundary, 800); break; }
  }
  if (headerCount < 2) boundary = Math.min(boundary, 800);
  const openingBlock = text.slice(0, boundary);

  const speakers = extractSpeakers(ending, lang);
  const lastSpeaker = speakers.length ? speakers[speakers.length - 1] : '';
  const overlapCount = lexicalOverlap(ending, openingBlock, lang);

  const issues: OpeningContinuityIssue[] = [];
  const speakersInOpening = speakers.filter((n) => openingBlock.includes(n));

  // ① 说话人全部消失：零重叠 → high；有零星重叠 → mid
  if (speakers.length > 0 && speakersInOpening.length === 0) {
    issues.push({
      severity: overlapCount === 0 ? 'high' : 'mid',
      type: 'speaker_missing',
      evidence: isZh
        ? `前集结尾说话人：${speakers.join('、')}，本集开场未见`
        : `Previous ending speakers: ${speakers.join(', ')} — none in this opening`,
      advice: isZh ? ADVICE.speaker_missing.zh : ADVICE.speaker_missing.en,
      key: 'weld_speaker_missing',
    });
  } else if (speakers.length === 0 && overlapCount === 0) {
    // ② 纯动作结尾 + 零词汇衔接
    issues.push({
      severity: 'mid',
      type: 'cold_open',
      evidence: isZh
        ? `前集结尾（${ending.length}字）与本集开场零词汇重叠`
        : `Previous ending (${ending.length} chars) shares zero lexical overlap with this opening`,
      advice: isZh ? ADVICE.cold_open.zh : ADVICE.cold_open.en,
      key: 'weld_cold_open',
    });
  }
  // ③ 开场直接跳时间
  const TIME_JUMP = isZh ? TIME_JUMP_ZH : TIME_JUMP_EN;
  if (TIME_JUMP.test(openingBlock.slice(0, 300))) {
    issues.push({
      severity: 'low',
      type: 'delayed_open',
      evidence: isZh ? '本集开场含时间跳变标记' : 'Time-jump marker in this opening',
      advice: isZh ? ADVICE.delayed_open.zh : ADVICE.delayed_open.en,
      key: 'weld_delayed_open',
    });
  }

  let penalty = 0;
  for (const it of issues) penalty += it.severity === 'high' ? 18 : it.severity === 'mid' ? 10 : 5;
  let bonus = 0;
  if (lastSpeaker && openingBlock.includes(lastSpeaker)) bonus += 2; // 结尾说话人开场即接住
  if (overlapCount >= 3) bonus += 1;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)));

  return {
    score, checked: true, prevEndingChars: ending.length,
    speakers, lastSpeaker, overlapCount,
    issueCount: issues.length, issues,
  };
}

/**
 * v2.367 跨集开场焊点前置教学（与 openingContinuityCheck 同文件=同源铁律）
 * ------------------------------------------------------------------
 * 三类断焊口径（说话人全灭 high 扣 18 / 零星重叠 mid 扣 10、冷开场 mid 扣 10、
 * 跳时间 low 扣 5；开场块 800 字上限、跳时 300 字窗口、前集结尾 20 字有效线、
 * 说话人取末尾 4 位；接住末位说话人 +2、2-gram 重叠 ≥3 +1）反向前置到
 * 撰写师首轮与润色师首轮，避免「先写错再打回重写」白付 retry token（v2.157）。
 * 纯函数·中英双语·零 IO·确定性；LIVE/AIGC 按制式分发版式口径。
 */
export function buildOpeningContinuityDirective(mode: 'LIVE' | 'AIGC' = 'LIVE', lang: OcLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[PRE-WRITING RULE · Cross-episode opening weld — catch the last beat before moving on] This list mirrors the openingContinuityCheck three-class checks, so write it right the first time. Only episode 2 onward: with no previous ending, or one under 20 characters, the check does not run and this rule does not apply.',
      'The previous ending is a weld: the opening block (from the first line up to the second scene header, capped at 800 characters) must catch the final beat of the last episode before advancing this one. Three broken welds are scored after the draft:',
      '1) Speaker missing: the speaker labels of the previous ending\'s dialogue lines (the name before the colon, deduplicated, last 4 kept) appear nowhere in the opening block — high, 18 points off when lexical overlap with the ending is zero, still mid, 10 points off when a few words overlap. Have the last speaker answer or react first, then establish their immediate whereabouts in one line; never pretend nothing happened and start fresh.',
      '2) Cold open: the previous ending yields no dialogue line at all (pure action or image) and the opening block shares zero 2-gram overlap with it — mid, 10 points off. Pick up from the same action, the same place or the very next line, settle the beat, then move on.',
      '3) Time jump: a time-jump marker (the next day, days later, a week later, months later, a year later) lands in the first 300 characters of the opening — low, 5 points off. Close the previous beat with half a line first (an afterbeat, a reaction, the result of the final action), then jump; never let the audience open their eyes to another day.',
      'Positive signals: catching the last speaker in the opening earns 2 points back; 2-gram overlap of 3 or more earns 1 more.',
      'Boundary: an opening line that dissolves last episode\'s strong hook ("just kidding / it was a misunderstanding") belongs to the cliffhanger-dissolve quality check; cross-episode time anchors running backwards or going dry belong to the timeline ledger; place continuity belongs to the location check; repeating last episode\'s lines belongs to the replay check; hook types for the episode opening belong to the hook system. This list only covers whether the opening block catches the people, connects the words, and closes the beat before jumping time.',
      'LIVE format: write the pickup and the reaction as separate lines starting with a triangle marker, catch the last beat in one action line, then land the first line of dialogue.',
      'AIGC format: no triangle markers in the body, catch the last beat in flowing prose, and route inner thought through the parenthetical (inner: ...) convention.',
    ].join('\n');
  }
  return [
    '[撰写前置铁律 · 跨集开场焊点——先接住上一瞬，再推进本集] 本清单与 openingContinuityCheck 的三类检测同源，第一遍就写对。仅第 2 集及以后生效：第 1 集或前集结尾不足 20 字时不检测，本规则直接跳过。',
    '前集结尾是焊点：本集开场块（正文开头到第二个场标之前，上限 800 字）必须先接住上一集最后那一瞬，再推进本集。三类断焊在成稿后计分，第一遍就避开：',
    '1）说话人全灭：前集结尾台词行（"名字（情绪）：台词"）里的说话人（去重取末尾 4 位）在本集开场块里一个都没出现——与结尾零词汇重叠时 high 扣 18，有零星重叠仍 mid 扣 10。先让最后一位说话人接话或给反应镜头，再用一句台词交代 TA 的即时去向；严禁当无事发生另起炉灶。',
    '2）冷开场：前集结尾没有可提取的台词行（纯动作/纯画面）且开场块与结尾零 2-gram 重叠——mid 扣 10。从结尾瞬间的同一动作、同一场地或下一句对话接起，先落定再推进本集。',
    '3）跳时间：开场前 300 字直接出现时间跳变标记（次日/第二天/三天后/几天后/一周后/数月后/半年后/一年后/翌日）——low 扣 5。先给结尾瞬间的收束半句（余音、反应或动作结果）再跳，别让观众一睁眼就换了天。',
    '正信号：结尾最后一位说话人在开场就被接住 +2；开场与结尾 2-gram 重叠 ≥3 处 +1。',
    '边界：开场一句话把上集强钩消解（"逗你玩的/原来是误会"）归接钩质量检测（cliffhanger-dissolve）；跨集时间锚点倒流或干旱归时间线账本；场景地点连续归地点一致性；上集原话复述归跨集复读；集首承接的钩子类型归 hook-system 集钩。本清单只管开场块内"人物是否接住、词汇是否连上、有没有先收束再跳时"。',
    mode === 'AIGC'
      ? 'AIGC 制式：正文不加 △，用流畅自然段接住上一瞬；人物内心走（内心：…）。'
      : 'LIVE 制式：接话与反应镜头都写成独占 △ 行，先用一行 △ 承接上一瞬，再落人物第一句台词。',
  ].join('\n');
}
