import { isSceneHeaderLine } from './script-scenes';
/**
 * 假选择检测（v2.80 块76，创作能力类）
 * ------------------------------------------------------------------
 * 病象：编剧郑重摆出一个两难，本该让观众和角色一起疼，结果角色零
 * 犹豫秒答，被放弃的那条路再没出现过——选择没有重量：
 *   沈志国：孩子和公司，你只能保一个。
 *   林晚：（毫不犹豫）我签。
 *   英文：VICTOR: Sign, or your brother goes to jail tonight. Choose.
 *        LINNA: Fine. I will sign.
 * 两难的本质是"怎么选都要失去"。没有停顿、没有挣扎、没有代价，
 * 两难就只是编剧假装让角色选了一下，观众看见的是作者的手。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - webnovel-craft.showByChoice：管"用杀伐果断形容词代替选择"，不查
 *    两难被秒答；
 *  - supporting-arc.no_choice_passive：管配角全程短应答、没有能动性；
 *  - cheap-forgiveness：管谅解无代价，本引擎管"取舍无代价"；
 *  - stance-flip：管立场无因横跳，本引擎管单次决定无重量。
 *
 * 判定（必须先有带利害词的两难框架，再看 10 行窗口）：
 *  - 窗口内出现答复 + 中间零挣扎 + 答复后无代价 + 无第三条路
 *  - 且（答复带秒答标记 或 与两难间隔 ≤2 行）→ 假选择
 * 豁免（选择有重量的写法）：
 *  - 挣扎节拍：沉默/攥紧/手抖/闭眼/深吸/hesitated/long silence；
 *  - 代价兑付：答复后窗口内出现失去/错过/对不起/give up/lost/missed；
 *  - 第三条路：两个都要/凭什么只能我选/both/neither/make my own；
 *  - 悬而未决：窗口内没有答复（留到钩子，是好写法）。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FakeChoiceHit {
  line: number;
  answerLine: number;
  speaker: string;
  dilemma: string;
  answer: string;
  gapLines: number;
  instant: boolean;
  reason: string;
}

export interface FakeChoiceResult {
  score: number;
  hits: FakeChoiceHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const SPEAKER_RE_ZH = /^([一-鿿A-Za-z0-9·]{1,6})(?:（([^）]{0,24})）)?\s*[：:]\s*(.+)$/;
const SPEAKER_RE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\(([^()]{0,40})\))?\s*:\s*(.+)$/;

/* 两难框架：必须带利害词，"咖啡还是茶"不算两难 */
const STAKES_ZH = /(?:命|死|救|保|签|离婚|结婚|嫁|娶|孩子|儿子|女儿|公司|集团|钱|股权|股份|合同|放弃|离开|走|留下|自首|举报|报警|抓|坐牢|监狱|撤案|谅解书|抵押|房子|留学|手术|肾|血|肚子里|怀孕)/;
const DILEMMA_ZH = /(?:二选一|两条路|只能(?:选|救|保|要|留|顾)|给你两个?选择|要么[^\n。！？!?]{0,18}要么|(?:[一-鿿]{1,6}(?:和|跟|与|还是)[一-鿿]{1,8}(?:，|,)?\s*你?只能(?:选|救|保|要|挑|留|顾))|选[^\n。！？!?]{0,10}还是[^\n。！？!?]{0,10}|(?:是|要)[^\n。！？!?]{0,12}还是[^\n。！？!?]{0,12})/;
const STAKES_EN = /\b(?:life|die|dead|death|save|sign|divorce|marry|kid|child|son|daughter|brother|sister|company|money|shares|contract|give up|leave|stay|turn (?:him|her|yourself) in|call the cops|jail|prison|drop the charges|surgery|kidney|pregnant|wedding|funeral|inheritance)\b/i;
const DILEMMA_EN = /\b(?:choose between|you have two choices|two options|it(?:'s| is) either|either [^\n.!?]{2,40} or [^\n.!?]{2,40}|one of (?:you|them)|(?:save|pick|choose) [^\n.!?]{1,24} or [^\n.!?]{1,24}|sign(?:[,.])?\s+or|(?:marry him|take the deal|say yes|drop the charges|swallow this)(?:[,.])?\s+or|give me [^\n.!?]{1,20} or [^\n.!?]{1,30} (?:dies|goes to jail)|decide(?: (?:now|tonight|right now|before))?)\b/i;

/* 秒答标记 */
const INSTANT_ZH = /(?:毫不犹豫|毫不迟疑|想都没?想|不假思索|没有(?:一丝|半点|任何)?犹豫|连犹豫都|当即|当场|立刻|马上就?|没有(?:丝毫)?停顿|一秒都没|一口(?:答应|应下)|斩钉截铁)/;
const INSTANT_EN = /\b(?:without (?:a |another |a second of |a moment of )?hesitation|didn(?:'t| not) even hesitate|without thinking(?: twice)?|without a second thought|instantly|immediately|right away|on the spot|decided instantly|didn(?:'t| not) flinch|not a moment(?:'s)? hesitation)\b/i;

/* 挣扎节拍（选择的重量） */
const STRUGGLE_ZH = /(?:犹豫|迟疑|踌躇|咬紧(?:牙关|唇)|攥紧|握紧|指尖泛白|手抖|手在抖|闭上眼|闭上眼睛|沉默|静默|停顿|良久|许久|很久|深吸(?:一口气)?|屏住呼吸|眼眶红|眼泪|泪|咬住|吞咽|喉头|心一紧|像被抽走|没说话|不说话|盯着)/;
const STRUGGLE_EN = /\b(?:hesitat(?:e|ed|ion)|long silence|silence stretched|closed his eyes|closed her eyes|grip tightened|knuckles whitened|hand shook|swallowed hard|swallowed the lump|breath caught|took a (?:deep|shaky) breath|held her breath|held his breath|eyes burned|tears|stared(?: down| at)? without speaking|said nothing|didn(?:'t| not) speak|long beat|beat passed)\b/i;

/* 代价兑付（答复之后） */
const COST_ZH = /(?:代价|失去|放弃了?|错过|没去成|没赶到|没接到|没见(?:到|上)|对不起|遗憾|一个人|空(?:着|荡)|再也没|注销|变卖|收拾行李|撕了|录像|演(?:出|奏会)|家长会|病床前|墓)/;
const COST_EN = /\b(?:sacrifice|give up|gave up|lose|lost|losing|missed the|never saw again|empty|alone|apolog(y|ize|ized)|I(?:'m| am) sorry|price to pay|cost (?:her|him)|sold off|packed (?:his|her) bags|recital|parent-teacher|funeral|hospital bed|grave|did not make it)\b/i;

/* 第三条路（角色不接两难，是好写法） */
const THIRD_ZH = /(?:两个都要|全都要|我都要|凭什么(?:只能|要我选)|第三条路|我自己来|我偏不|撕(?:掉|了)|那我谁都不选|都不选|鱼和熊掌|反将)/;
const THIRD_EN = /\b(?:both|neither|I(?:'ll| will) take both|a third (?:option|way)|why (?:do|should) I have to choose|I make my own (?:rules|choice)|like hell I(?: (?:'m| am))? choosing|the hell with both|tear it in half|I refuse to choose)\b/i;

/* 答复（两难之后真正的拍板） */
const ANSWER_ZH = /(?:我签|我答应|我同意|我选|我保|我救|那就[签离走]|成交|好[，,]?\s*我(?:签|答应|同意|选|保|救|做)|按你说的(?:办)?|行[，,]?\s*(?:我)?(?:签|答应|同意|选|保|救|办)|我走|我留|我放弃|离婚吧|自首|我嫁|我娶|一言为定|我答应你)/;
const ANSWER_EN = /\b(?:I(?:'ll| will) sign|I(?:'ll| will) do it|I choose|I(?:'ll| will) save|it(?:'s| is) a deal|deal|fine[,.]? I(?:'ll| will)|okay[,.]? I(?:'ll| will)|agreed|I agree|then I(?:'ll| will) (?:leave|stay|go)|I(?:'ll| will) give (?:it|him|her) up|I(?:'m| am) leaving|I(?:'m| am) staying|turn(?:ing)? (?:him|her|myself) in|I(?:'ll| will) marry|you got yourself a deal)\b/i;

interface Line {
  no: number;
  text: string;
}

export function fakeChoice(draft: string): FakeChoiceResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(draft);
  const dilemmaRe = zh ? DILEMMA_ZH : DILEMMA_EN;
  const stakesRe = zh ? STAKES_ZH : STAKES_EN;
  const instantRe = zh ? INSTANT_ZH : INSTANT_EN;
  const struggleRe = zh ? STRUGGLE_ZH : STRUGGLE_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const thirdRe = zh ? THIRD_ZH : THIRD_EN;
  const answerRe = zh ? ANSWER_ZH : ANSWER_EN;
  const speakerRe = zh ? SPEAKER_RE_ZH : SPEAKER_RE_EN;

  const lines: Line[] = draft.split(/\r?\n/).map((t, i) => ({ no: i + 1, text: t.trim() }))
    .filter((l) => l.text.length > 0);

  const hits: FakeChoiceHit[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!dilemmaRe.test(lines[i].text)) continue;
    if (!stakesRe.test(lines[i].text)) continue; // "咖啡还是茶"豁免

    // 窗口：两难后 10 个非空行，遇场景头截断
    const window: Line[] = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      if (isSceneHeaderLine(lines[j].text)) break;
      window.push(lines[j]);
    }

    // 找答复行
    let answerIdx = -1;
    for (let k = 0; k < window.length; k += 1) {
      const speech = window[k].text.match(speakerRe)?.[3] ?? window[k].text;
      if (answerRe.test(speech)) { answerIdx = k; break; }
    }
    // 悬而未决 → 好写法，不判
    if (answerIdx === -1) continue;

    const between = window.slice(0, answerIdx);
    const after = window.slice(answerIdx + 1);
    const betweenText = between.map((l) => l.text).join('\n');
    const answerRaw = window[answerIdx].text;
    const answerSpeech = answerRaw.match(speakerRe)?.[3] ?? answerRaw;
    const answerSpeaker = answerRaw.match(speakerRe)?.[1] ?? '';
    const answerAll = `${answerRaw}\n${after.map((l) => l.text).join('\n')}`;

    // 秒答标记优先：它本身就是对"犹豫"的否定（毫不犹豫/without hesitation），
    // 不能再被挣扎正则里的"犹豫/hesitate"子串反向救回
    const instant = instantRe.test(betweenText) || instantRe.test(answerRaw);

    // 第三条路：窗口任意位置出现即豁免（角色掀了棋盘）
    if (thirdRe.test(`${betweenText}\n${answerAll}`)) continue;
    // 挣扎节拍：两难与答复之间出现即豁免（秒答标记在场时不适用此豁免）
    if (!instant && struggleRe.test(betweenText)) continue;
    if (!instant && struggleRe.test(answerRaw)) continue;
    // 代价兑付：答复行及其后窗口出现失去/错过即豁免
    if (costRe.test(answerAll)) continue;

    const gapLines = answerIdx; // 间隔非空行数（0=秒接）
    if (!instant && gapLines > 2) continue;

    const dilemmaSnippet = lines[i].text.replace(speakerRe, '$3').slice(0, 36);
    hits.push({
      line: lines[i].no,
      answerLine: window[answerIdx].no,
      speaker: answerSpeaker,
      dilemma: dilemmaSnippet,
      answer: answerSpeech.slice(0, 28),
      gapLines,
      instant,
      reason: zh
        ? `第${lines[i].no}行摆出两难"${dilemmaSnippet}"，第${window[answerIdx].no}行${instant ? '带着"毫不犹豫"标记' : `仅隔 ${gapLines} 行`}就拍板"${answerSpeech.slice(0, 20)}"——中间无挣扎、之后无代价，被放弃的选项没有重量`
        : `Dilemma at L${lines[i].no} "${dilemmaSnippet}" is answered at L${window[answerIdx].no} ${instant ? 'with an explicit no-hesitation marker' : `only ${gapLines} line(s) later`}: "${answerSpeech.slice(0, 28)}" — no struggle between, no cost after; the road not taken weighs nothing`,
    });

    // 跳过已覆盖窗口
    i += answerIdx + 1;
  }

  const score = hits.length === 0 ? 100 : Math.max(20, 100 - hits.length * 35);

  const issues = hits.map((h) => (zh
    ? `假选择：${h.reason}`
    : `Fake choice: ${h.reason}`));

  const advice = zh
    ? [
        '两难要"怎么选都疼"——拍板前给一个挣扎节拍：长久的沉默、攥到发白的手、闭上眼、把笔放下又拿起，让观众看见代价在身上过了一遍',
        '拍板后必须兑付失去：没赶到的家长会、空着的另一半床、注销的公司名——被放弃的选项至少回来咬角色一次',
        '高一级写法是掀棋盘：让角色拒绝二选一（"我两个都要""凭什么只能我选？"），用第三条路暴露出题人的算计',
        '实在不想当场答，就让场景在两难上断掉——把选择悬成钩子，好过一句轻飘飘的"我签"',
      ]
    : [
        'A dilemma must hurt both ways — before the answer, stage one beat of struggle: a long silence, whitened knuckles, eyes closing, the pen set down then picked up, so the audience feels the cost pass through the body',
        'After the choice, pay the loss: the recital missed, the empty side of the bed, the company name struck off — the road not taken must come back to bite at least once',
        'The higher move is to flip the board: let the character refuse the binary ("I will take both", "Why do I have to choose?") and expose the person who framed the choice',
        'If you cannot answer it in-scene, cut on the dilemma — hanging the choice as a hook beats a weightless "Fine, I will sign"',
      ];

  return { score, hits, issues, advice };
}
