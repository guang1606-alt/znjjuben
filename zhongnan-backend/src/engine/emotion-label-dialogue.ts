import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 台词情绪点名检测（Emotion-Label Dialogue）
 * -----------------------------------------------------------
 * 创作能力类引擎：真人吵架/崩溃时几乎不会平报情绪名，
 * AI 写的角色却总给自己开情绪说明书——
 *   "我对你太失望了。"
 *   "我现在真的很难过。"
 *   "你让我很生气。"
 * 情绪被"告知"而不是被"发射"：真正的台词把情绪压进具体指控、
 * 要挟、翻旧账、刻薄话里——"失望"两个字一出口，戏就瘪了。
 *
 * 边界：
 *  - show-dont-tell 的 TELL_EMOTION 只匹配叙述行"他/她很失望"，
 *    正则锚第三人称且不进台词；本引擎专管【台词里第一/二人称报情绪名】。
 *  - dialogue-ai-taste 管排比/说教/金句/书面腔，不看情绪直述。
 *  - 带具体所指的长句豁免（"我生气是因为你瞒着我签了合同"——有事实）。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface EmotionLabelHit {
  line: number;
  speaker?: string;
  emotion: string;
  snippet: string;
}

export interface EmotionLabelDialogueResult {
  score: number;
  hits: EmotionLabelHit[];
  dialogueLines: number;
  rate: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


const EMOTIONS_ZH = '生气|愤怒|恼火|难过|伤心|失望|绝望|害怕|恐惧|紧张|焦虑|尴尬|委屈|心寒|寒心|心痛|心碎|崩溃|不开心|不高兴|无语|心累';
const EMOTIONS_EN = 'angry|furious|upset|disappointed|sad|hurt|afraid|scared|frightened|nervous|anxious|embarrassed|ashamed|heartbroken|exhausted';

// 第一人称直述：我（很/真的/好…）+ 情绪名（程度副词允许叠加：我现在真的很难过）
const LABEL_SELF_ZH = new RegExp(`我(?:现在|心里|很|好|真的|非常|特别|有点|有些|挺|太|超|也|一直|老|总){0,4}(?:${EMOTIONS_ZH})`);
// 第二人称指控式点名：你让我失望 / 我对你太失望
const LABEL_OTHER_ZH = new RegExp(`(?:你(?:真)?(?:让|令|使)我(?:很|好|真的|太|非常|特别|有点|有些|挺){0,3}(?:${EMOTIONS_ZH}))|(?:我?对?你(?:太|很|好|真的|有些){0,2}(?:失望|寒心|无语|冷淡))`);
const LABEL_SELF_EN = new RegExp(`\\bi(?:'m| am| feel| feel so)\\b[^.,!?\\n]{0,18}\\b(?:${EMOTIONS_EN})\\b`, 'i');
const LABEL_OTHER_EN = new RegExp(`\\byou make me feel?(?: so)?\\b[^.,!?\\n]{0,12}\\b(?:${EMOTIONS_EN})\\b|\\byou'?ve disappointed me\\b`, 'i');

// 带因果事实即豁免：情绪有了具体落点，不是空报
const SPECIFIC_ZH = /因为|你上次|你昨天|你答应|你承诺|你说过|你瞒着|你偷偷|合同|化验单|亲子鉴定|手机|支票|遗嘱/;
const SPECIFIC_EN = /\b(because|you promised|you lied about|you told me|behind my back|the contract|the report|last night)\b/i;

const stripPunct = (s: string): string => s.replace(/[，。！？、…：；""''（）()\s,.!?:;'"()-]/g, '');

export function emotionLabelDialogue(draft: string): EmotionLabelDialogueResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], dialogueLines: 0, rate: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const selfRe = isZh ? LABEL_SELF_ZH : LABEL_SELF_EN;
  const otherRe = isZh ? LABEL_OTHER_ZH : LABEL_OTHER_EN;
  const specificRe = isZh ? SPECIFIC_ZH : SPECIFIC_EN;
  const emotionList = (isZh ? EMOTIONS_ZH : EMOTIONS_EN).split('|');

  const hits: EmotionLabelHit[] = [];
  let dialogueLines = 0;
  const snippet = (s: string) => (s.length > 20 ? `${s.slice(0, 20)}…` : s);

  draft.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    const dm = line.match(/^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/);
    if (!dm) return;
    dialogueLines++;
    const speaker = dm[1].trim();
    const text = dm[2].trim();
    const len = isZh ? stripPunct(text).length : text.split(/\s+/).filter(Boolean).length;
    // 短台词且无具体所指，情绪名本身就是全部 payload —— 才判
    const maxLen = isZh ? 16 : 11;
    if (len > maxLen) return;
    if (specificRe.test(text)) return;
    const selfM = text.match(selfRe);
    const otherM = text.match(otherRe);
    const m = selfM || otherM;
    if (!m) return;
    const found = emotionList.find((e) => (isZh ? text.includes(e) : new RegExp(`\\b${e}\\b`, 'i').test(text)));
    hits.push({ line: idx + 1, speaker, emotion: found || (isZh ? '情绪' : 'emotion'), snippet: snippet(text) });
  });

  const rate = dialogueLines > 0 ? hits.length / dialogueLines : 0;
  const score = Math.max(20, 100 - hits.length * 10);

  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.speaker}」直接报情绪名「${h.snippet}」——删掉情绪标签，把「${h.emotion}」压进具体指控、刻薄话或动作里`
      : `Line ${h.line} "${h.speaker}" labels the emotion outright: "${h.snippet}" — cut the label and load "${h.emotion}" into a specific accusation, a cutting remark, or an action`);

  const advice = isZh
    ? hits.length > 0
      ? '情绪不能靠角色自我介绍。别让人物说"我很失望"，让他说最扎人的那句事实，或者直接动手。'
      : '台词均通过具体内容承载情绪，无情绪点名，保持。'
    : hits.length > 0
      ? 'Never let a character announce the emotion. Don\'t write "I\'m disappointed" — write the one fact that cuts deepest, or make them act.'
      : 'Emotion rides on specifics throughout, no labels; keep it.';

  return { score, hits, dialogueLines, rate, issues, advice };
}
