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

/**
 * 前置教学：buildEmotionLabelDialogueDirective(_format='LIVE', lang='zh')
 * ----------------------------------------------------------------------
 * 同源铁律：教学函数与检测器 emotionLabelDialogue 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"短台词一二人称直报情绪名"的检测口径，
 *       避免写完被 prePolish emoLabelHint 与 craft/deai 复评打回。
 */
export function buildEmotionLabelDialogueDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Emotion-Label Dialogue Pre-Writing Briefing (same source as emotionLabelDialogue: short lines that name the emotion in first or second person; 10 points per hit; floor 20)】',
      '- Scope: only "speaker: line" lines (speaker 1-12 chars, optional parenthetical action, full-width or half-width colon); scene headers and action lines without a colon are ignored.',
      '- Length gate: judge only lines with 16 characters or fewer after stripping punctuation (11 words or fewer in English); long lines already carry specifics.',
      '- Labels in first-person or second-person voice: I am / I feel / I feel so + angry / furious / upset / disappointed / sad / hurt / afraid / scared / frightened / nervous / anxious / embarrassed / ashamed / heartbroken / exhausted, allowing up to 4 degree words in between.',
      '- Second-person accusation: you make me feel + emotion, or you have disappointed me / I am so disappointed in you.',
      '- Emotion list: angry / furious / upset / disappointed / sad / hurt / afraid / scared / frightened / nervous / anxious / embarrassed / ashamed / heartbroken / exhausted.',
      '- Exemption: any causal fact in the line (because / you promised / you lied about / you told me / behind my back / the contract / the report / last night) gives the emotion a concrete landing, so it is not judged.',
      '- One hit per line: multiple emotion words in one line are charged once, by the first match.',
      '- Score: max(20, 100 - hits x 10); empty draft = 100.',
      '- Diagnostics: rate = hits / dialogue lines, display-only, never charged.',
      '- Rewrite: delete the label and load the emotion into a specific accusation, a cutting remark, an old grudge or an action; say the one fact that cuts deepest instead of narrating your own state.',
      '- Division: show-dont-tell TELL_EMOTION only matches narration like "he was disappointed" in third person; this engine handles first- and second-person labels inside dialogue.',
      '- Division: dialogue-ai-taste covers parallelism, preaching, slogans and bookish register; it does not look at emotion labels.',
      '- Pipeline consumption: prePolish lists every hit into the polisher hint (emoLabelHint); craft initial, craft re-eval and deai rescan the same result.',
      '- Self-check: can this line be anything other than "I am disappointed"? Write down the one concrete thing that made you say it, and throw that thing at the other person instead.',
    ].join('\n');
  }
  return [
    '【台词情绪点名·前置教学（检测同源：emotionLabelDialogue 短台词一二人称直报情绪名，每条命中扣 10 分，20 分封底）】',
    '- 检测范围：只扫台词行——「说话人：台词」格式（说话人 1-12 字，可带（括号）动作提示，全/半角冒号均可）；场头与无冒号动作行不参与。',
    '- 长度门槛：去标点后中文 ≤16 字、英文 ≤11 词才判——长句通常已有具体内容，不判。',
    '- 第一人称：我 / 我现在 / 我心里 + 程度副词（很/好/真的/非常/特别/有点/有些/挺/太/超/也/一直/老/总，可叠 0-4 个）+ 情绪名（如 难过 / 失望 / 生气）。',
    '- 第二人称指控：你让我 / 你令我 / 你使我 + 程度副词 + 情绪名；或 我对你（太/很/好/真的/有些）失望 / 寒心 / 无语 / 冷淡。',
    '- 情绪词表：生气/愤怒/恼火/难过/伤心/失望/绝望/害怕/恐惧/紧张/焦虑/尴尬/委屈/心寒/寒心/心痛/心碎/崩溃/不开心/不高兴/无语/心累。',
    '- 因果事实豁免：台词里出现 因为/你上次/你昨天/你答应/你承诺/你说过/你瞒着/你偷偷/合同/化验单/亲子鉴定/手机/支票/遗嘱 —— 情绪有了具体落点，不判。',
    '- 一行只记一次：同句出现多个情绪词，只按首个命中扣一次。',
    '- 得分：score = max(20, 100 - 命中条数 × 10)；空稿 100。',
    '- 诊断字段：rate = 命中条数 ÷ 台词行数，只做展示，不参与扣分。',
    '- 改写方向：删掉情绪标签，压进具体指控、刻薄话、翻旧账或一个动作；让人物说最扎人的那句事实，而不是给自己的状态做旁白。',
    '- 与 show-dont-tell 分界：它的 TELL_EMOTION 只匹配叙述行「他/她很失望」且锚第三人称；本引擎专管台词里第一/二人称报情绪名。',
    '- 与 dialogue-ai-taste 分界：它管排比/说教/金句/书面腔，不看情绪直述。',
    '- pipeline 消费：prePolish 把命中逐条注入润色师（emoLabelHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 成稿自查：这句能不能换成「我很失望」之外的东西？写下让你说出这句话的那件具体的事（最扎人的那句事实），把那件事本身扔给对方。',
  ].join('\n');
}
