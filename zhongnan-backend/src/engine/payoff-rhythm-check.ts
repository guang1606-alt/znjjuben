/**
 * 压抑-释放节奏检测器（PRD 2.1.27 短剧憋爽节奏过硬线）v2.130
 * ------------------------------------------------------------------
 * 短剧的心跳是"憋→爽"周期：让主角先吃亏、受辱、被逼到墙角，
 * 再在几十秒内翻盘打脸。节奏崩的五种死法：
 *  1) 只虐不爽：全集受气包，零翻盘（high，虐主弃剧）
 *  2) 一路平推：主角没吃过亏就赢，爽点没有支点（赢得廉价，观众无感）
 *  3) 憋得太久：首个翻盘拖到 40% 以后，或两次释放间干旱超 35% 篇幅（划走）
 *  4) 羞辱欠账：当众退婚/骂废物/撂狠话埋了雷，结尾没有对等强兑付
 *  5) 尾段烂尾：前段有爽，但最后 30% 又压回去且无强释放收尾
 *
 * 与现有引擎的分工：
 *  - cool-moment-score: 爽点"数量/分布/类型多样性"（爽点侧盘点，hasBuildup 仅布尔）
 *  - suspense-tension-curve: 张力曲线形态（悬念侧）
 *  - antagonist-quality-check: 反派施压力度（对手侧）
 *  - payoff-rhythm-check (本引擎): 受压与释放的"配对关系/时间间隔/兑付对等"（双边节奏）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type PrLang = 'zh' | 'en';

export interface PayoffRhythmIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'no_release'           // 只虐不爽
    | 'cheap_win'            // 一路平推（无受压的胜利）
    | 'suppression_drought'  // 憋太久（释放干旱）
    | 'humiliation_unpaid'   // 羞辱欠账
    | 'weak_tail_release';   // 尾段烂尾
  evidence: string;
  advice: string;
}

export interface RhythmSignal {
  marker: string;
  snippet: string;
  position: number; // 0-1
  strong: boolean;
}

export interface PayoffRhythmResult {
  /** 憋爽节奏分 0-100 */
  score: number;
  /** 受压信号数 */
  suppressCount: number;
  /** 释放信号数 */
  releaseCount: number;
  /** 强释放数（翻盘/打脸/身份揭晓/跪求等） */
  strongReleaseCount: number;
  /** 具体羞辱/狠话埋雷数 */
  humiliationCount: number;
  /** 已兑付的羞辱数（其后存在强释放） */
  humiliationPaidCount: number;
  /** 首个释放位置 0-1，无释放为 null */
  firstReleasePosition: number | null;
  /** 最长"纯憋段"占全文比例 0-1（首释放前/两释放间/尾段） */
  maxSuppressionStretch: number;
  /** 有效憋爽周期数（释放前 20% 篇幅内有受压铺垫） */
  paidCycles: number;
  /** 尾段（后30%）受压数 */
  tailSuppressionCount: number;
  /** 尾段强释放数 */
  tailStrongReleaseCount: number;
  suppressHits: RhythmSignal[];
  releaseHits: RhythmSignal[];
  issues: PayoffRhythmIssue[];
}

// —— 中文信号库 ——
// 受压：主角侧的吃亏/受辱/被逼（"被"字结构优先，避免与反派施压、主角打脸动作混淆）
const SUPPRESS_ZH = /(被退婚|退婚|被甩|被赶(?:出|走|下)|扫地出门|被开除|被解雇|被冤枉|冤枉|被嘲笑|被嘲讽|被当众(?:羞辱|奚落|出丑)|被踩(?:在|到)?脚下|被骗|走投无路|被逼到?绝境|绝望(?:地|地)?|含泪|眼泪(?:掉|流|夺眶)|哭着|痛哭|委屈(?:地)?|难堪|下不来台|身无分文|破产|欠下?巨债|负债累累|被送进|被抓(?:住|进|走)?|被关(?:进|起来)?|被绑(?:架|住)?|被推(?:倒|开)|被扇|挨了?一?巴掌|挨耳光|打在(?:我|她|他)脸|被泼|账户被冻结|被冻结|被裁|给我跪下|逼(?:我|她|他)跪|被迫下跪|喝令.{0,4}跪|废物|穷鬼|你配吗|配不上|高攀不起|给我滚出去|滚出|当众退婚|撕毁(?:婚约|合同)|解除婚约|离婚协议甩)/g;
// 释放（含强弱）：翻盘打脸/真相/碾压/跪求/全场震惊/身份曝光
const RELEASE_STRONG_ZH = /(反杀|绝地反击|逆风翻盘|翻盘|当场打脸|啪啪打脸|打脸|真相大白|揭穿|戳穿|拆穿|露馅|狐狸尾巴|碾压|吊打|完胜|夺回|赢回|扬眉吐气|大仇得报|自食其果|恶有恶报|跪地求饶|跪下求(?:饶|我)|跪倒|下跪道歉|扑通一声.{0,4}跪|全场(?:震惊|哗然|死寂|安静|倒吸)|所有人(?:都)?(?:震惊|傻了|呆住|目瞪口呆)|倒吸一?口?凉气|亮出?(?:黑卡|股份|合同|证据|授权书)|身份(?:揭晓|曝光|揭开)|原来是?(?:总裁|董事长|首富|大佬|继承人)|恢复身份|收购(?:了|公司|对方)|撤资|当场(?:逮捕|抓走|铐上)|警察.{0,6}(?:抓|铐|带走))/g;
const RELEASE_WEAK_ZH = /(反击|还击|回击|赢了|获胜|反将一军|将计就计|扳回一?局|占了?上风|转危为安|松了口气|报警|拿出证据|合同签(?:下|了)|保住了|守住了)/g;
// 具体羞辱/狠话埋雷（兑付检测专用）
const HUMILIATION_ZH = /(退婚|撕毁(?:婚约|合同)|甩在(?:脸|地|桌)|扔在(?:脸|地)|废物|穷鬼|你配吗|高攀不起|给我滚出去|你会后悔|等着瞧|让你付出代价|后悔的日?子?|当众(?:羞辱|出丑|退婚|打脸)|解除(?:婚约|关系)|离婚协议|当场开除)/g;

// —— 英文信号库 ——
const SUPPRESS_EN = /(jilted(?: him| her| me)?|called off the (?:wedding|engagement)|humiliat(?:ed|ing)|kicked (?:me|him|her) out|evicted|wrongfully accused|framed for|betrayed|cheated on|nowhere to (?:go|turn)|desperate|in despair|devastat(?:ed|ing)|tears (?:streamed|fell|welled)|burst into tears|sobbed|bankrupt|drowned in debt|slapped (?:me|her|him) across|hit (?:me|her|him) across the face|forced to (?:kneel|leave)|get on your knees|ordered (?:me|her|him) to kneel|you('re| are) (?:nothing|trash|worthless|a loser|nobody)|you don't deserve|get out (?:of my|of here)|froze (?:my|his|her) accounts|fired (?:me|him|her) on the spot|divorce papers)/gi;
const RELEASE_STRONG_EN = /(counterattack(?:ed)?|fought back and (?:won|crushed)|turned the tables|made a comeback|revenge was (?:hers|his|mine)|face-slap|slapped (?:him|her|them) (?:back|across)|humiliated (?:him|her|them) (?:in|back)|the truth came out|truth was revealed|exposed (?:him|her|them)|unmasked|caught red-handed|crushed (?:him|her|them)|destroyed (?:him|her|them) (?:in|completely)|outsmarted|won it all back|reclaimed|vindicated|begged for mercy|dropped to (?:his|her|the) knees (?:begging|and begged)|knelt and begged|everyone (?:was|went) (?:shocked|stunned|silent)|the whole room (?:gasped|fell silent)|stunned silence|gasped in shock|revealed (?:his|her|the) (?:true )?identity|turned out to be the (?:CEO|chairman|billionaire|heir)|acquired the company|pulled (?:his|her|their) funding|arrested on the spot|handcuffed)/gi;
const RELEASE_WEAK_EN = /(fought back|pushed back|retaliated|got the upper hand|turn(?:ed)? the tide|breathed a sigh of relief|called the cops|showed the evidence|signed the deal|held on|fought back)/gi;
const HUMILIATION_EN = /(called off (?:the wedding|the engagement)|tore up the|threw (?:it|the contract) (?:in|at) (?:his|her|my) face|you('re| are) (?:nothing|trash|worthless|a loser|nobody)|you('ll| will) regret (?:this|it)|you('ll| will) pay|get out (?:of my|here)|you don't deserve|divorce papers|fired (?:me|him|her) on the spot|publicly humiliated)/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function collect(text: string, strongRe: RegExp, weakRe: RegExp | null): RhythmSignal[] {
  const hits: RhythmSignal[] = [];
  const scan = (re: RegExp, strong: boolean) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      hits.push({
        marker: m[0],
        snippet: text.slice(Math.max(0, m.index - 8), m.index + m[0].length + 12).replace(/\s+/g, ' ').trim(),
        position: m.index / Math.max(1, text.length),
        strong,
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  };
  scan(strongRe, true);
  if (weakRe) scan(weakRe, false);
  hits.sort((a, b) => a.position - b.position);
  return hits;
}

function collectSuppression(text: string, re: RegExp): RhythmSignal[] {
  const hits: RhythmSignal[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      marker: m[0],
      snippet: text.slice(Math.max(0, m.index - 8), m.index + m[0].length + 12).replace(/\s+/g, ' ').trim(),
      position: m.index / Math.max(1, text.length),
      strong: false,
    });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits.sort((a, b) => a.position - b.position);
}

/**
 * 压抑-释放节奏检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function payoffRhythmCheck(text: string, lang: PrLang): PayoffRhythmResult {
  if (!text || text.trim().length < 20) {
    return {
      score: 100,
      suppressCount: 0,
      releaseCount: 0,
      strongReleaseCount: 0,
      humiliationCount: 0,
      humiliationPaidCount: 0,
      firstReleasePosition: null,
      maxSuppressionStretch: 0,
      paidCycles: 0,
      tailSuppressionCount: 0,
      tailStrongReleaseCount: 0,
      suppressHits: [],
      releaseHits: [],
      issues: [],
    };
  }

  const isZh = lang === 'zh';
  const issues: PayoffRhythmIssue[] = [];

  const suppressHits = collectSuppression(text, isZh ? SUPPRESS_ZH : SUPPRESS_EN);
  const releaseHits = collect(text, isZh ? RELEASE_STRONG_ZH : RELEASE_STRONG_EN, isZh ? RELEASE_WEAK_ZH : RELEASE_WEAK_EN);
  const humiliationPos: number[] = [];
  {
    const re = isZh ? HUMILIATION_ZH : HUMILIATION_EN;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      humiliationPos.push(m.index / text.length);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  const suppressCount = suppressHits.length;
  const releaseCount = releaseHits.length;
  const strongHits = releaseHits.filter((h) => h.strong);
  const strongReleaseCount = strongHits.length;
  const firstReleasePosition = releaseHits.length ? releaseHits[0].position : null;

  const suppressPos = suppressHits.map((h) => h.position);
  const releasePos = releaseHits.map((h) => h.position);

  // —— 最长纯憋段：首释放前 / 相邻释放之间（区间内受压≥2才算憋段）/ 末释放到结尾 ——
  let maxSuppressionStretch = 0;
  if (releaseCount >= 1) {
    const first = releasePos[0];
    if (suppressPos.filter((p) => p < first).length >= 2) maxSuppressionStretch = Math.max(maxSuppressionStretch, first);
    for (let i = 1; i < releasePos.length; i++) {
      const a = releasePos[i - 1];
      const b = releasePos[i];
      if (suppressPos.filter((p) => p > a && p < b).length >= 2) maxSuppressionStretch = Math.max(maxSuppressionStretch, b - a);
    }
    const last = releasePos[releasePos.length - 1];
    if (suppressPos.filter((p) => p > last).length >= 2) maxSuppressionStretch = Math.max(maxSuppressionStretch, 1 - last);
  }

  // —— 有效憋爽周期：释放前 20% 窗口内有受压 ——
  const paidCycles = releaseHits.reduce((n, r) => {
    const windowLo = r.position - 0.2;
    return suppressPos.some((p) => p < r.position && p >= windowLo) ? n + 1 : n;
  }, 0);

  // —— 羞辱兑付：埋雷之后存在强释放 ——
  const strongPos = strongHits.map((h) => h.position);
  const humiliationPaidCount = humiliationPos.reduce((n, hp) => (strongPos.some((sp) => sp > hp) ? n + 1 : n), 0);

  const TAIL = 0.7;
  const tailSuppressionCount = suppressPos.filter((p) => p >= TAIL).length;
  const tailStrongReleaseCount = strongPos.filter((p) => p >= TAIL).length;

  let penalty = 0;

  // 1) 只虐不爽：压了至少 4 次，一次释放都没有
  if (suppressCount >= 4 && releaseCount === 0) {
    penalty += 30;
    issues.push({
      severity: 'high',
      type: 'no_release',
      evidence: isZh ? `${suppressCount} 处受压，0 处释放（全集虐主无翻盘）` : `${suppressCount} suppression beats, 0 releases (all suffering, no comeback)`,
      advice: isZh
        ? '观众忍辱是为了等翻盘，全集只虐不爽等于让观众白憋。必须在 40% 之前给出第一次实质反击（哪怕小赢），并在尾段安排一次彻底打脸/真相揭晓/反派跪求。先给痛，更要给药。'
        : 'Audiences endure the humiliation only to collect the comeback. Suffering with zero release makes them bail. Deliver a real counter-move before the 40% mark (even a small win), and end on a decisive face-slap, truth reveal, or the villain begging. Give the pain — then give the medicine.',
    });
  }

  // 2) 一路平推：零受压却多次"赢"——胜利没有支点
  if (suppressCount === 0 && releaseCount >= 3) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'cheap_win',
      evidence: isZh ? `${releaseCount} 处胜利/高光，0 处受压铺垫` : `${releaseCount} victory/highlight beats, 0 suppression before them`,
      advice: isZh
        ? '主角没吃过亏，赢再多也不爽——爽感来自落差，不来自碾压本身。在每次大胜前先压一拍：被轻视、被设局、被逼到墙角，再让他翻过来。先把弹簧按下去，弹起来才有劲。'
        : 'A protagonist who never loses gets no thrill from winning — pleasure comes from the gap, not the steamroll. Before each big win, compress one beat: underestimated, framed, cornered — then flip it. Press the spring down before it snaps.',
    });
  }

  // 3) 憋太久：首翻盘晚于 40%（此前已压≥2次），或释放干旱窗口超 35%
  if (releaseCount >= 1 && (firstReleasePosition! > 0.4 && suppressPos.filter((p) => p < firstReleasePosition!).length >= 2 || maxSuppressionStretch > 0.35)) {
    penalty += 18;
    issues.push({
      severity: 'high',
      type: 'suppression_drought',
      evidence: isZh
        ? `首个释放位置 ${firstReleasePosition !== null ? (firstReleasePosition * 100).toFixed(0) : '-'}%，最长纯憋段占全文 ${(maxSuppressionStretch * 100).toFixed(0)}%`
        : `First release at ${firstReleasePosition !== null ? (firstReleasePosition * 100).toFixed(0) : '-'}%, longest dry stretch ${(maxSuppressionStretch * 100).toFixed(0)}% of script`,
      advice: isZh
        ? '短剧观众的耐心以秒计，憋超过约三分之一篇幅不给一次还手就划走。把第一次小反击提前到前 40% 内；大爽点之间每 30% 篇幅至少插一次小还手或盟友撑腰，让观众带着"快了快了"的期待往下看，而不是干等。'
        : 'Short-drama patience is measured in seconds: a dry stretch beyond roughly a third of the script sends them swiping away. Move the first counter-move inside the first 40%; between big payoffs, insert a small counter or ally save every ~30% so the audience leans in expecting "soon", instead of waiting in the dark.',
    });
  }

  // 4) 羞辱欠账：埋了≥2 个具体羞辱/狠话，却没有在其后强兑付（有释放但不够对等）
  if (humiliationPos.length >= 2 && releaseCount >= 1) {
    const lastHumiliation = humiliationPos[humiliationPos.length - 1];
    const lastStrong = strongPos.length ? strongPos[strongPos.length - 1] : -1;
    if (lastStrong < lastHumiliation) {
      penalty += 12;
      issues.push({
        severity: 'mid',
        type: 'humiliation_unpaid',
        evidence: isZh
          ? `${humiliationPos.length} 处羞辱/狠话埋雷，仅 ${humiliationPaidCount} 处后有强兑付（最后埋雷在 ${(lastHumiliation * 100).toFixed(0)}%）`
          : `${humiliationPos.length} humiliation/grudge markers, only ${humiliationPaidCount} answered by a strong payoff (last marker at ${(lastHumiliation * 100).toFixed(0)}%)`,
        advice: isZh
        ? '当众退婚、骂"废物"、撂下"你会后悔的"都是给观众的欠条，欠了必须加倍还：让施辱者亲自下跪、当众认错，或被他最看不起的东西反杀。兑付要和羞辱同一场合、同一批观众，场面要大于当初的难堪。'
        : 'A public jilting, the word "loser", a hissed "you\'ll regret this" — each is an IOU to the audience, and it must be repaid with interest: the humiliator kneels in person, apologizes in public, or is destroyed by exactly what he disdained. Repay in the same venue, before the same crowd, bigger than the original insult.',
    });
    }
  }

  // 5) 尾段烂尾：前段有爽，但后 30% 又压回去且没有强释放收尾
  if (releaseCount >= 1 && tailSuppressionCount >= 1 && tailStrongReleaseCount === 0) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'weak_tail_release',
      evidence: isZh ? `尾段（后30%）${tailSuppressionCount} 处受压、0 个强释放收尾` : `Final 30% has ${tailSuppressionCount} suppression beats, 0 strong release to close`,
      advice: isZh
        ? '短剧的最后一口必须是甜的。尾段又把主角压下去却不翻盘，观众会带着憋屈退出、不给下一集。用一次对等强反制收尾：当场抓捕/身份压人/反杀成功，或至少留一个"下集即爆"的强钩子，但本集必须先给一次明确的小胜。'
        : 'The last taste of a short drama must be sweet. If the final act pins the protagonist down again without a flip, the viewer exits frustrated and never returns. Close on an equal-or-greater counter: an on-the-spot arrest, an identity flex, a successful counter-kill — or at least a small, unambiguous win before the next-episode hook.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    suppressCount,
    releaseCount,
    strongReleaseCount,
    humiliationCount: humiliationPos.length,
    humiliationPaidCount,
    firstReleasePosition,
    maxSuppressionStretch: Math.round(maxSuppressionStretch * 100) / 100,
    paidCycles,
    tailSuppressionCount,
    tailStrongReleaseCount,
    suppressHits,
    releaseHits,
    issues,
  };
}
