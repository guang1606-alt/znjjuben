/**
 * v2.136 配角弧光/群像变化检测器（Supporting Arc Check）
 *
 * 竖屏短剧群像的时间维度暗病：配角从头到尾"一个温度"，或最后一场毫无铺垫地倒戈。
 * 与 v2.133 的分工（两者互补、横截面 vs 时间线）：
 * - v2.133 supporting-character-check：配角"有没有欲望"（捧哏/播报员/保姆，单场横截面）
 * - v2.136 supporting-arc-check（本引擎）：配角"有没有变化"（before→after 弧光，全集时间线）
 *
 * 三类问题：
 * 1. static_supporting（mid，≥2 人 high）零变化配角：戏份 ≥5 句，态度极性全程单一。
 *    两种典型：①跟班/盟友全程一个温度（帮/信/夸到底）；②本可被争取的中间派
 *    （只有怀疑/嘲讽/失望）到结局也没变。真正的对手位（报警/起诉/杀/坐牢）豁免——
 *    对手不转变是本分，转变了才需要理由。
 * 2. abrupt_conversion（mid，≥2 人 high）突变式倒戈：前半 ≥60% 同一极性，末两句突然
 *    全面翻转，而翻转点之前的文本里没有任何转折事件（救人/证据/真相/监控/误会揭开）。
 *    经典烂尾：仇人临终"其实我一直把你当亲儿子"、闺蜜毫无铺垫突然站主角。
 * 3. no_choice_passive（low）纯应答无选择：≥4 句台词，75% 以上是 ≤8 字/≤6 词的短应答，
 *    全程零自我主张——没做过任何决定的人，谈不上弧光。
 *
 * 正信号：arc（有铺垫的转变）每个配角回补 2 分，奖励"写出变化过程"的剧本。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
import type { CastMap } from './character-logic';
import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源

export type SaLang = 'zh' | 'en';

export interface SupportingArcIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'static_supporting' | 'abrupt_conversion' | 'no_choice_passive';
  evidence: string;
  advice: string;
}

export type ArcVerdict = 'arc' | 'static' | 'abrupt' | 'passive' | 'opponent' | 'neutral' | 'minor';
export type Polarity = 'pos' | 'neg' | 'neu';

/** 单个配角的弧光画像 */
export interface ArcCharReport {
  name: string;
  lineCount: number;
  /** 正向态度台词数（信任/支持/感激/歉意） */
  posLines: number;
  /** 负向态度台词数（怀疑/嘲讽/敌对/失望） */
  negLines: number;
  /** 自我主张/选择信号数（我要/我决定/我拒绝/I want/I choose） */
  agencyHits: number;
  /** 首段主导态度 */
  firstAttitude: Polarity;
  /** 末段主导态度 */
  lastAttitude: Polarity;
  /** 转变前文本区间命中的转折事件词（无则空串） */
  turnTrigger: string;
  verdict: ArcVerdict;
}

export interface SupportingArcResult {
  score: number;
  speakingChars: number;
  protagonist: string;
  /** 参检配角数（≥4 句且非主角） */
  supportingChars: number;
  /** 有铺垫转变的配角数（正信号） */
  arcChars: number;
  staticChars: number;
  abruptChars: number;
  passiveChars: number;
  characters: ArcCharReport[];
  issues: SupportingArcIssue[];
}

interface ALine {
  name: string;
  emotion: string;
  text: string;
  order: number;
  scene: number;
  /** 该行在全文中的起始字符位置 */
  start: number;
  /** 台词正文在全文中的起始字符位置 */
  textStart: number;
}

// —— 中文态度信号库（只收多字词，裸单字不收——v2.134「血」误伤教训）——
// 负向：怀疑/嘲讽/反对/决裂（本可被争取或本就亲近者的态度，转变才有戏）
const NEG_ZH = /(?:我不信|绝不相信|鬼才信|谁信你|骗子|你撒谎|你骗我|休想|做梦|我反对|不同意|不答应|我恨你|恨死你|失望透顶|太失望|不要脸|无耻|废物|绝交|断绝关系|划清界限|退婚|离婚|自作多情|癞蛤蟆|假惺惺|虚情假意|猫哭耗子|鳄鱼的眼泪|装什么|演得真好|可笑|荒唐|神经病|疯了吧|你别过来|不许碰|怎么可能|太阳从西边出来|良心被狗吃|白眼狼)/;
// 正向：信任/支持/感激/歉意/亲近
const POS_ZH = /(?:我信你|我相信你|我信任你|对不起|抱歉|谢谢你|谢谢|我支持你|我站你|站你这边|我帮你|我陪你|原谅你|我原谅|辛苦你|委屈你了|我错怪你|是我不好|我不好|多亏你|谢谢你救|感激|大恩不言谢|以后跟你|听你的|都听你的|我挺你|对不起你)/;
// 情绪标签（括号内）极性
const NEG_EMO_ZH = /(?:冷笑|嘲讽|嘲弄|讥笑|不屑|轻蔑|鄙夷|愤怒|恼怒|怒斥|厌恶|嫌弃|冰冷|铁青|失望|寒心|怨恨)/;
const POS_EMO_ZH = /(?:感激|感动|愧疚|惭愧|羞愧|心疼|温柔|歉意|热泪|哽咽|含泪)/;
// 自我主张/选择：角色"做出决定"的证据
const AGENCY_ZH = /(?:我要|我想|我打算|我决定|我选择|我拒绝|我答应|我保证|我绝不|我偏|我必须|我辞职|我退出|我同意|我反对|让我来|我来处理|我来想办法|我查到|我发现|我调查过|我选择|该我了)/g;
// 硬对手位：报警/起诉/动手——这类角色全程敌对是常态，豁免 static
const HARD_OPPONENT_ZH = /(?:报警|抓起来|抓起他|告发|检举|法庭(?:上|见)?|起诉|坐牢|监狱|弄死|打死|打残|废了你|杀了你|开枪|叫保安|送你进|告你)/;
// 转折事件（必须是"事件"而非态度；只在翻转点之前的文本区间命中才算铺垫）
const TURN_ZH = /(?:救下|救了|救命之恩|[^\n。！？!?]{0,6}替[^\n。！？!?]{0,6}挡|挡(?:了)?(?:一)?(?:刀|枪|棍|拳)|真相(?:大白|揭开)?|证据|监控(?:录像|画面|里)?|录音|亲子鉴定|诊断书|病危通知|车祸|遗书|坦白一切|自首|误会(?:解开|消除|解除)?|原来[^\n。！？!?]{0,10}(?:是|就是)|亲眼(?:看见|看到|撞见)|错怪(?:了)?|查出(?:了)?(?:真相|问题|实情)?|账本|合同里(?:写|藏)|跪在.{0,6}求)/;

// —— 英文信号库 ——
const NEG_EN = /\b(?:i don'?t believe you|i won'?t believe|never believed|in your dreams|over my dead body|i disagree|i object|i hate you|you liar|you'?re lying|you lied to me|disgusting|shameless|pathetic|ridiculous|absurd|how dare you|never speak to me|i'?m done with you|fake|hypocrite|as if|yeah,? right|i doubt it)\b/i;
const POS_EN = /\b(?:i believe you|i trust you|i'?m sorry|forgive me|i forgive you|thank you|thanks|i support you|i'?m with you|i'?ll help you|i owe you|thanks to you|i misjudged you|i was wrong about you|on your side|you saved me|i'?m on your side|i'?ll follow you)\b/i;
const AGENCY_EN = /\b(?:i want|i need|i'?m gonna|i am going to|i'?ve decided|i decided|i choose|i refuse|i promise|i won'?t|i quit|i agree|i disagree|let me (?:handle|do|take care)|i found out|i'?ll take care of it)\b/gi;
const HARD_OPPONENT_EN = /\b(?:call the police|press charges|sue you|sue him|arrest (?:him|her|them)|get out|life in prison|kill (?:you|him|her)|shoot (?:him|her|you)|i'?ll destroy you|you'?re going to jail)\b/i;
const TURN_EN = /\b(?:saved (?:my|his|her|their|the) (?:life|son|daughter)|took a (?:bullet|blow|knife) (?:for me|for him|for her)|the truth|the evidence|security footage|the recording|paternity test|diagnosis|(?:was|it was all) a misunderstanding|misunderstood|saw (?:it|him|her) (?:myself|with my own eyes)|confessed (?:everything)?|turned (?:himself|herself) in|turned out (?:to be|it was)|went down on (?:his|her|one) knee)\b/i;

const SHORT_REACT_ZH = /^(?:嗯+|嗯嗯|哦哦?|哦。?|啊。?|好。?|好的。?|好吧。?|行。?|行吧。?|知道了。?|明白。?|明白了。?|收到。?|嗯。?|是。?|对。?|在。?|来了。?|等等。?|等一下。?)$/;
const SHORT_REACT_EN = /^(?:yeah+|yep|yup|okay|ok|sure|fine|got it|gotcha|right|alright|uh-?huh|mhm|hmm+|wow|oh|yes|no|thanks)\.?$/i;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

// c213：场头判定收口共享切分器 script-scenes（旧正则把任意【 开头行当场头，误伤普通强调行）
const DIALOGUE_HEAD = /^([一-龥A-Za-z·]{1,6})(?:（([^）]*)）)?[：:](.+)$/;

function lineHits(line: string, re: RegExp): boolean {
  re.lastIndex = 0;
  return re.test(line);
}

function countMatches(text: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    n++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return n;
}

function stripTail(s: string): string {
  return s.replace(/[。！!？?….,~～\s]+$/u, '').trim();
}

interface Libs {
  neg: RegExp;
  pos: RegExp;
  negEmo: RegExp | null;
  posEmo: RegExp | null;
  agency: RegExp;
  hard: RegExp;
  turn: RegExp;
  shortReact: RegExp;
  isZh: boolean;
}

/**
 * v2.136 配角弧光/群像变化检测
 * @param text 剧本正文
 * @param cast 人物卡（可选，首位视为主角）
 * @param lang 语言
 */
export function supportingArcCheck(
  text: string,
  cast: CastMap | null | undefined,
  lang: SaLang = 'zh',
): SupportingArcResult {
  const empty: SupportingArcResult = {
    score: 100,
    speakingChars: 0,
    protagonist: '',
    supportingChars: 0,
    arcChars: 0,
    staticChars: 0,
    abruptChars: 0,
    passiveChars: 0,
    characters: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const libs: Libs = {
    neg: isZh ? NEG_ZH : NEG_EN,
    pos: isZh ? POS_ZH : POS_EN,
    negEmo: isZh ? NEG_EMO_ZH : null,
    posEmo: isZh ? POS_EMO_ZH : null,
    agency: isZh ? AGENCY_ZH : AGENCY_EN,
    hard: isZh ? HARD_OPPONENT_ZH : HARD_OPPONENT_EN,
    turn: isZh ? TURN_ZH : TURN_EN,
    shortReact: isZh ? SHORT_REACT_ZH : SHORT_REACT_EN,
    isZh,
  };

  // —— 逐行解析对白，附带时间序、场景号、字符位置 ——
  const lines: ALine[] = [];
  let scene = 0;
  let cursor = 0;
  for (const raw of text.split('\n')) {
    const lineStart = cursor;
    cursor += raw.length + 1;
    const line = raw.trim();
    if (!line) continue;
    if (isSceneHeaderLine(line)) {
      scene++;
      continue;
    }
    if (line.startsWith('△')) continue; // 内景/外景已由共享 isSceneHeaderLine 拦截（c213）
    const m = line.match(DIALOGUE_HEAD);
    if (!m) continue;
    const name = m[1];
    const emotion = m[2] || '';
    const dText = m[3].trim();
    // 行在 trim 后头部可能有空白，近似用 name 起点定位
    const headIdx = raw.indexOf(name);
    const textStart = lineStart + Math.max(0, headIdx) + name.length + (emotion ? emotion.length + 2 : 0) + 1;
    lines.push({ name, emotion, text: dText, order: lines.length, scene, start: lineStart, textStart });
  }
  if (lines.length < 6) return { ...empty };

  // —— 按角色聚合（保持时间序）——
  const byName = new Map<string, ALine[]>();
  for (const d of lines) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push(d);
  }
  const nameLineCount = new Map<string, number>();
  for (const [name, dLines] of byName) nameLineCount.set(name, dLines.length);
  const namesDesc = Array.from(nameLineCount.keys()).sort((a, b) => nameLineCount.get(b)! - nameLineCount.get(a)!);

  const declaredLead = cast && Object.keys(cast).length > 0 ? Object.keys(cast)[0] : null;
  const protagonist = declaredLead ?? namesDesc[0] ?? '';
  const speakingChars = byName.size;
  if (speakingChars < 2) return { ...empty, speakingChars, protagonist };

  const polarityOf = (d: ALine): Polarity => {
    const tNeg = lineHits(d.text, libs.neg);
    const tPos = lineHits(d.text, libs.pos);
    const eNeg = libs.negEmo ? lineHits(d.emotion, libs.negEmo) : false;
    const ePos = libs.posEmo ? lineHits(d.emotion, libs.posEmo) : false;
    const neg = tNeg || eNeg;
    const pos = tPos || ePos;
    if (neg && !pos) return 'neg';
    if (pos && !neg) return 'pos';
    return 'neu';
  };

  /** 在翻转点之前的文本区间寻找转折事件：旧立场末句结束 → 新立场首句行首，向前扩 300 字 */
  const findTurnTrigger = (lastOld: ALine, firstNew: ALine): string => {
    const oldEnd = lastOld.textStart + lastOld.text.length;
    const from = Math.max(0, oldEnd - 300);
    const to = firstNew.start;
    if (to <= from) return '';
    const segment = text.slice(from, to);
    libs.turn.lastIndex = 0;
    const m = libs.turn.exec(segment);
    return m ? m[0] : '';
  };

  const isShortReact = (d: ALine): boolean => {
    const bare = stripTail(d.text);
    if (lineHits(bare, libs.shortReact)) return true;
    if (isZh) return [...bare].length <= 8;
    return bare.split(/\s+/).filter(Boolean).length <= 6;
  };

  const reports: ArcCharReport[] = [];
  for (const name of namesDesc) {
    if (name === protagonist) continue;
    const dLines = byName.get(name)!;
    const n = dLines.length;
    if (n < 4) {
      reports.push({ name, lineCount: n, posLines: 0, negLines: 0, agencyHits: 0, firstAttitude: 'neu', lastAttitude: 'neu', turnTrigger: '', verdict: 'minor' });
      continue;
    }

    const pols = dLines.map(polarityOf);
    const posLines = pols.filter((p) => p === 'pos').length;
    const negLines = pols.filter((p) => p === 'neg').length;
    const allText = dLines.map((d) => d.text).join(' ');
    const agencyHits = countMatches(allText, libs.agency);
    const hardOpponent = lineHits(allText, libs.hard);

    const half = Math.ceil(n / 2);
    const firstSeg = pols.slice(0, half);
    const lastSeg = pols.slice(-2);
    const firstNeg = firstSeg.filter((p) => p === 'neg').length;
    const firstPos = firstSeg.filter((p) => p === 'pos').length;
    const dom = (seg: Polarity[]): Polarity => {
      const ng = seg.filter((p) => p === 'neg').length;
      const ps = seg.filter((p) => p === 'pos').length;
      if (ng === 0 && ps === 0) return 'neu';
      return ng >= ps ? 'neg' : 'pos';
    };
    const firstAttitude = dom(firstSeg);
    const lastAttitude = dom(lastSeg);

    let verdict: ArcVerdict = 'neutral';
    let turnTrigger = '';

    // —— 翻转检测：前段一边倒（≥2 行且 ≥60%），末两句全面倒向另一极 ——
    let flip: null | { from: Polarity; to: Polarity; lastOld: ALine; firstNew: ALine } = null;
    if (n >= 5) {
      if (firstNeg >= 2 && firstNeg / firstSeg.length >= 0.6 && lastSeg.length === 2 && lastSeg.every((p) => p === 'pos')) {
        // 找最后一条 neg 行与第一条（末段）pos 行
        const lastOldIdx = pols.lastIndexOf('neg');
        flip = { from: 'neg', to: 'pos', lastOld: dLines[lastOldIdx], firstNew: dLines[n - 2] };
      } else if (firstPos >= 2 && firstPos / firstSeg.length >= 0.6 && lastSeg.length === 2 && lastSeg.every((p) => p === 'neg')) {
        const lastOldIdx = pols.lastIndexOf('pos');
        flip = { from: 'pos', to: 'neg', lastOld: dLines[lastOldIdx], firstNew: dLines[n - 2] };
      }
    }

    if (flip) {
      turnTrigger = findTurnTrigger(flip.lastOld, flip.firstNew);
      verdict = turnTrigger ? 'arc' : 'abrupt';
    } else if (!hardOpponent && n >= 5 && negLines === 0 && posLines >= 3 && posLines / n >= 0.7) {
      // 全程一个温度的跟班/盟友：信任帮衬到底，零变化
      verdict = 'static';
    } else if (!hardOpponent && n >= 5 && posLines === 0 && negLines >= 3 && negLines / n >= 0.7) {
      // 从头到尾的怀疑者/嘲讽者：本可被真相改变却什么都没发生
      verdict = 'static';
    } else if (hardOpponent && n >= 5 && (posLines === 0 || negLines / n >= 0.7)) {
      // 硬对手位（报警/起诉/动手）：对手不转变是本分
      verdict = 'opponent';
    } else if (agencyHits === 0) {
      // 弧光维度的"没做过选择"：零主张 + 绝大多数短应答
      const shortRatio = dLines.filter(isShortReact).length / n;
      if (shortRatio >= 0.75) verdict = 'passive';
    }

    reports.push({ name, lineCount: n, posLines, negLines, agencyHits, firstAttitude, lastAttitude, turnTrigger, verdict });
  }

  const judged = reports.filter((r) => r.verdict !== 'minor');
  const arcChars = judged.filter((r) => r.verdict === 'arc');
  const staticChars = judged.filter((r) => r.verdict === 'static');
  const abruptChars = judged.filter((r) => r.verdict === 'abrupt');
  const passiveChars = judged.filter((r) => r.verdict === 'passive');

  const issues: SupportingArcIssue[] = [];
  let penalty = 0;
  const bonus = Math.min(arcChars.length * 2, 6);

  if (staticChars.length) {
    const high = staticChars.length >= 2;
    penalty += Math.min(9 * staticChars.length, 20);
    const detail = staticChars.map((c) => `「${c.name}」${c.posLines > 0 ? '全程帮衬/信任，一个温度到底' : '全程怀疑/嘲讽，到结局也没变'}`).join('；');
    issues.push({
      severity: high ? 'high' : 'mid',
      type: 'static_supporting',
      evidence: isZh
        ? `${detail}——配角有戏份没弧光，结束时和开场时是同一个人`
        : `${staticChars.map((c) => `"${c.name}" stays one-note (${c.posLines > 0 ? 'all support/trust' : 'all doubt/scorn'} from first scene to last')`).join('; ')} — these side characters end exactly where they began`,
      advice: isZh
        ? '给配角留一个"变点"：让铁杆盟友在一场戏里动摇过（哪怕只有一句犹豫），让嘲讽者亲眼看到一件打脸的小事、嘴上还硬但手已经动了。转变不必喊口号，温度差三度，观众就感到这人活着。'
        : 'Give each side character a turning beat: let the loyal ally waver for one line, let the mocker witness something that contradicts them — mouth still proud, hands already moving. A three-degree temperature shift is enough; the audience feels a living person.',
    });
  }

  if (abruptChars.length) {
    const high = abruptChars.length >= 2;
    penalty += Math.min(12 * abruptChars.length, 24);
    const detail = abruptChars.map((c) => `「${c.name}」(${c.firstAttitude === 'neg' ? '敌对→力挺' : '亲近→反目'})`).join('、');
    issues.push({
      severity: high ? 'high' : 'mid',
      type: 'abrupt_conversion',
      evidence: isZh
        ? `${detail}立场在结尾突然翻转，翻转前没有任何铺垫事件（无救人/证据/真相/误会揭开）——人物成了剧情需要的开关`
        : `${abruptChars.map((c) => `"${c.name}" (${c.firstAttitude === 'neg' ? 'hostile→devoted' : 'close→hostile'})`).join(', ')} flips at the end with zero triggering event before it (no rescue, evidence, reveal, or cleared misunderstanding)`,
      advice: isZh
        ? '倒戈不能发生在台词里，要发生在事件里。在翻转之前至少埋一场"不得不改"的戏：他亲眼看到证据、主角替他挡了一下、他自己查到相反的答案。先让观众信了这件事，再让他改口——顺序反了就是人设崩塌。'
        : 'A conversion must happen in an event, not in a line of dialogue. Plant at least one forcing scene before the flip: they see the evidence with their own eyes, the lead takes a blow for them, they uncover the opposite answer themselves. Convince the audience first, then let the character change — reverse the order and the character collapses.',
    });
  }

  if (passiveChars.length) {
    penalty += Math.min(4 * passiveChars.length, 8);
    const names = passiveChars.map((c) => `「${c.name}」`).join('、');
    issues.push({
      severity: 'low',
      type: 'no_choice_passive',
      evidence: isZh
        ? `${names} 多句台词几乎全是"好/嗯/行吧/知道了"式短应答，全集没有一次自己的主张或选择——没做过决定的人没有弧光`
        : `${passiveChars.map((c) => `"${c.name}"`).join(', ')} speaks mainly in short acknowledgments ("yeah/okay/sure/got it") and never makes a single choice or demand of their own`,
      advice: isZh
        ? '给他一次说"不"的机会，或一次主动的选择：同样是答应，让他先问一个只关乎自己利益的问题再点头。一个带条件的"行"，比十个乖巧的"好"更像活人。'
        : 'Give them one moment of refusal or one active choice: even when agreeing, let them first ask a question that serves their own interest. A conditional "fine" feels more human than ten obedient "okay"s.',
    });
  }

  reports.sort((a, b) => b.lineCount - a.lineCount);
  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty + bonus),
    speakingChars,
    protagonist,
    supportingChars: judged.length,
    arcChars: arcChars.length,
    staticChars: staticChars.length,
    abruptChars: abruptChars.length,
    passiveChars: passiveChars.length,
    characters: reports,
    issues,
  };
}
