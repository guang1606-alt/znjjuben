import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 空心动作调度检测（Hollow Stage Business）
 * -------------------------------------------------
 * 创作能力类引擎：AI/新手剧本最爱用无意义舞台调度填节奏——
 * 站起来、坐下、转身、踱步、叹气、深呼吸、沉默片刻。
 * 这些动作"可演但没戏"：不改变关系、不传递新信息、不暴露心理。
 *
 * 判空心的两个条件：
 *  1) 整行只有调度动作（主语+水副词+动作+句号），无后续具体行为/物件/意图；
 *  2) 不含强能量意图词（冲/夺/摔/拍/吼/猛地/一把/转身就走……）——有能量的站起不算。
 * 另外统计各动作词的全片出现次数，同一种调度重复 ≥4 次额外扣分
 * （点头/摇头本身可当应答，只在"重复"维度计数，不判空心行）。
 *
 * 查重：scene-padding 管前情复述注水（对白向）、craft-lint 只有个别被动词、
 * show-dont-tell 管情绪标签；均不检测纯调度动作行，无重叠。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface HollowActionHit {
  line: number;
  gesture: string;
  snippet: string;
}

export interface HollowActionResult {
  score: number;
  hits: HollowActionHit[];
  actionSentences: number;
  gestureCounts: Record<string, number>;
  repeatedGestures: string[];
  densityPer10: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 水副词（允许出现在整行模板里）
const WATER_ADV_ZH = '(?:缓缓|慢慢|默默|轻轻|静静|静静|又|重新|随即|这才|便|就)?';
// 整行即空心的调度动作（行首允许0-6字主语/状语）
const STANDALONE_ZH: { re: RegExp; gesture: string }[] = [
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:长长地?)?(?:叹了口气|叹了一口气|长叹一声|叹息一声|轻叹一声)[。！]?$`), gesture: '叹气' },
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:深吸一口气|深呼吸|深吸了口气|吸了口气)[。！]?$`), gesture: '深呼吸' },
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:站了起来|站起身来|站起身|站起来|站起)[。！]?$`), gesture: '站起' },
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:坐了下来|坐回.{0,4}|坐了下去|坐下)[。！]?$`), gesture: '坐下' },
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:踱来踱去|来回踱步|走来走去|来回走了走|在房间里踱步)[。！]?$`), gesture: '踱步' },
  { re: new RegExp(`^[^，。；]{0,6}${WATER_ADV_ZH}(?:转过身|转过身来|转回身|转身回来)[。！]?$`), gesture: '转身' },
  { re: new RegExp(`^[^，。；]{0,6}(?:沉默了?(?:片刻|半晌|一会儿|一会)|半晌不语|半天没说话|没有说话|没说话|沉默不语|不语)[。！]?$`), gesture: '沉默' },
];

// 强能量意图：有这些词说明动作带戏，不判空心
const ENERGY_ZH = /(?:猛地|腾地|霍地|一把|冲|夺|摔|拍|踹|踢|吼|薅|拽|砸|掀|转身就走|扭头就走|拂袖|夺门|摔门|大步|拔腿|拔腿就|往外|冲出|跑向|揪住|抓起|拍桌|起身离)/;

// 全片手势计数（含嵌在长句里的）
const COUNT_RE_ZH: { re: RegExp; gesture: string }[] = [
  { re: /叹了[口一]?气|长叹|叹息|轻叹/g, gesture: '叹气' },
  { re: /深吸[一了口]?口气|深呼吸/g, gesture: '深呼吸' },
  { re: /站[了起]+来|站起身/g, gesture: '站起' },
  { re: /坐[了下]+来|坐下/g, gesture: '坐下' },
  { re: /踱[来步]|走来走去/g, gesture: '踱步' },
  { re: /转过身|转身/g, gesture: '转身' },
  { re: /点了?点头/g, gesture: '点头' },
  { re: /摇了?摇头/g, gesture: '摇头' },
];

// —— EN ——
const STANDALONE_EN: { re: RegExp; gesture: string }[] = [
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:(?:lets?|let) out a sigh|sighs?|sighed|heaves?|heaved a(?: long| deep| weary)? sigh)[.,]?$/i, gesture: 'sigh' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:(?:takes?|took|draws?|drew) a(?: deep| long| slow)? breath|inhales? deeply)[.,]?$/i, gesture: 'breath' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:slowly |quietly |then )?(?:stands?|stood) up(?: from the chair)?[.,]?$/i, gesture: 'stand' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:slowly |quietly |then )?(?:sits?|sat) (?:back )?down[.,]?$/i, gesture: 'sit' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:paces?|paced)(?: back and forth| the room)?[.,]?$/i, gesture: 'pace' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:turns?|turned) (?:back )?around[.,]?$/i, gesture: 'turn' },
  { re: /^(?:he|she|they|[A-Z][a-z]{0,10}) (?:(?:says?|said) nothing|(?:goes?|went|falls?|fell) silent|doesn'?t say a word)[.,]?$/i, gesture: 'silence' },
];
const ENERGY_EN = /\b(snatch|snatching|slam|slamming|grab|grabbing|storm|storming|march|marching|shove|shoving|kick|kicking|pound|pounding|slaps?|whirls? around and|bolts?|lunges?|jabs?|barks?|snaps? at|storms? out)\b/i;
const COUNT_RE_EN: { re: RegExp; gesture: string }[] = [
  { re: /\b(?:lets?|let|heaves?|heaved) out a sigh|\bsighs?\b|\bsighed\b/gi, gesture: 'sigh' },
  { re: /\b(?:takes?|took) a(?: deep| long| slow)? breath\b/gi, gesture: 'breath' },
  { re: /\b(?:stands?|stood) up\b/gi, gesture: 'stand' },
  { re: /\b(?:sits?|sat) (?:back )?down\b/gi, gesture: 'sit' },
  { re: /\bpac(?:es|ing|ed)\b/gi, gesture: 'pace' },
  { re: /\b(?:turns?|turned) (?:back )?around\b/gi, gesture: 'turn' },
  { re: /\bnods?\b|\bnodded\b/gi, gesture: 'nod' },
  { re: /\bshakes?|shook\b (?:his|her|their)? ?head\b/gi, gesture: 'head shake' },
];

function isDialogueLine(line: string): boolean {
  return /^[^\s：:]{1,12}\s*[：:]\s*.+$/.test(line.trim());
}

export function hollowAction(draft: string): HollowActionResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], actionSentences: 0, gestureCounts: {}, repeatedGestures: [], densityPer10: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const standalone = isZh ? STANDALONE_ZH : STANDALONE_EN;
  const countRes = isZh ? COUNT_RE_ZH : COUNT_RE_EN;
  const energy = isZh ? ENERGY_ZH : ENERGY_EN;

  const gestureCounts: Record<string, number> = {};
  const hits: HollowActionHit[] = [];
  let actionSentences = 0;

  const lines = draft.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line) || isDialogueLine(line)) return;
    // 动作行按句切
    const sentences = line
      .split(isZh ? /[。！？；]/ : /[.!?;](?:\s|$)/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of sentences) {
      actionSentences++;
      for (const { re, gesture } of countRes) {
        const m = s.match(re);
        if (m) gestureCounts[gesture] = (gestureCounts[gesture] ?? 0) + m.length;
      }
      if (energy.test(s)) continue;
      for (const { re, gesture } of standalone) {
        if (re.test(s)) {
          hits.push({ line: idx + 1, gesture, snippet: s.length > 30 ? `${s.slice(0, 30)}…` : s });
          break;
        }
      }
    }
  });

  const repeatedGestures = Object.entries(gestureCounts)
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  const densityPer10 = actionSentences ? Math.round((hits.length / actionSentences) * 1000) / 100 : 0;
  const repeatPenalty = repeatedGestures.reduce((a, g) => a + (gestureCounts[g] - 3) * 3, 0);
  const score = Math.max(0, 100 - hits.length * 8 - repeatPenalty);

  const issues = [
    ...hits.slice(0, 8).map((h) =>
      isZh ? `第${h.line}行空心调度「${h.snippet}」：动作可演但没戏，换成暴露心理或推进关系的具体行为` : `Line ${h.line} hollow blocking "${h.snippet}": actable but empty — replace with behavior that reveals intent or shifts the relationship`),
    ...repeatedGestures.map((g) =>
      isZh ? `「${g}」全片${gestureCounts[g]}次：调度词被当成节奏拐杖，删半或换成角色专属小动作` : `"${g}" appears ${gestureCounts[g]}x: blocking used as a pacing crutch — cut half or give the character a signature micro-action`),
  ];

  const advice = isZh
    ? hits.length > 0 || repeatedGestures.length > 0
      ? '每个动作必须三选一：①暴露他不想让人看见的心理；②改变他与对方/环境的关系；③埋/收一个具体物件。纯生理动作（站坐/叹气/深呼吸）每集最多留一两个，并给它人物辨识度。'
      : '动作行都带戏，没有纯调度填充，保持。'
    : hits.length > 0 || repeatedGestures.length > 0
      ? 'Every action must do one of three things: reveal something the character wants hidden, shift their relationship to the other person or room, or plant/pay off a concrete object. Keep at most one or two pure physiological beats (sit/stand/sigh/breath) per episode, and make them character-specific.'
      : 'Action lines carry drama, no empty blocking; keep it.';

  return { score, hits, actionSentences, gestureCounts, repeatedGestures, densityPer10, issues, advice };
}
