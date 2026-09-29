/**
 * 因果逻辑链检测器（PRD 2.1.24 短剧剧情可信度过硬线）
 * ------------------------------------------------------------------
 * 短剧可以夸张，但不能"逻辑放假"。观众弃剧的头号原因之一：
 *  1) 巧合依赖：剧情靠"恰好/碰巧/没想到"推进，而不是人物选择
 *  2) 机械降神：结尾救兵/真相/贵人凭空出现解决问题（deus ex machina）
 *  3) 因果稀薄：通篇"突然/忽然/于是"，几乎没有"因为/为了/所以"的动机交代
 *  4) 誓言烂尾："我一定要/你给我等着"立了一堆 flag，后文无兑付
 *  5) 信息空降：角色突然掌握他不可能知道的信息（无来源获知）
 *
 * 与现有引擎的分工：
 *  - foreshadow-ledger: 检测"伏笔是否回收"（作者埋设的钩子）
 *  - character-logic: 检测"人物行为是否符合人设"（人设崩塌）
 *  - causal-logic-check (本引擎): 检测"事件之间是否有可信因果"（剧情链断裂）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type ClLang = 'zh' | 'en';

export interface CausalLogicIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'coincidence_overload'      // 巧合信号过多
    | 'coincidence_resolution'    // 靠巧合在尾段解决剧情
    | 'deus_ex_machina'           // 机械降神
    | 'thin_causation'            // 因果链稀薄（突然多、动机少）
    | 'unresolved_oath'           // 誓言/威胁无兑付
    | 'unsourced_knowledge';      // 信息空降
  evidence: string;
  advice: string;
}

export interface CoincidenceHit {
  marker: string;
  snippet: string;
  position: number;
  inTail: boolean;
}

export interface DeusHit {
  snippet: string;
  position: number;
}

export interface CausalLogicResult {
  /** 因果逻辑分 0-100（越高越可信） */
  score: number;
  /** 巧合信号数 */
  coincidenceCount: number;
  coincidenceHits: CoincidenceHit[];
  /** 机械降神命中 */
  deusExMachinaHits: DeusHit[];
  /** 突发信号数（突然/忽然/suddenly） */
  suddenCount: number;
  /** 因果动机信号数（因为/为了/所以/because/in order to） */
  causationCount: number;
  /** 顺承连接词数（于是/然后/接着/then）——只有顺承没有因果是危险信号 */
  sequenceCount: number;
  /** 强宣言数（我发誓/我一定要/I swear） */
  oathCount: number;
  /** 兑付信号数（做到了/成功/兑现/payoff） */
  payoffCount: number;
  /** 信息空降信号数 */
  unsourcedCount: number;
  issues: CausalLogicIssue[];
}

// —— 中文信号库 ——
const COINCIDENCE_ZH = /(恰好|恰巧|碰巧|凑巧|巧合|无巧不成书|鬼使神差|阴差阳错|说时迟那时快|刚好撞见|正好赶上|正巧|赶巧|可巧|天助我也|命不该绝|绝处逢生(?!.*(?:自己|亲手|硬|拼)))/g;
const SUDDEN_ZH = /(突然|忽然|猛然|骤然|忽地|乍然|毫无预兆|没有预兆|凭空)/g;
const CAUSATION_ZH = /(因为|由于|为了|为的是|所以|因此|因而|故而|以便|以免|目的是|动机是|就是要|我必须|我得|不能让|绝不允许|都是为了)/g;
const SEQUENCE_ZH = /(于是|然后|接着|随后|紧接着|之后|事后)/g;
const OATH_ZH = /(我发誓|我发誓一定|我一定要|我非要|我非得|我绝饶不了|你给我等着|你等着|我会让你付出代价|此仇不报|不报此仇|我对天发誓|我保证|我承诺)/g;
const PAYOFF_ZH = /(终于做到|成功了|报仇了|大仇得报|兑现了|做到了|得手|得偿所愿|心愿已了|说到做到|履行了承诺|赢了|拿下了|反杀|翻盘)/g;
const DEUS_ZH = /(救兵(?:赶到|来了|突然)|救星(?:出现|降临|来了)|贵人(?:相助|出现)|援兵(?:赶到|杀到)|突然出现一[队群拨帮]|带人赶到|率兵赶到|亲自带人|天降|有人(?:突然)?(?:出手|相救|拦住).{0,8}(?:救下|救了)|神秘人(?:出现|出手)|一封圣旨.{0,6}(?:救下|解围)|电话(?:突然)?响了.{0,10}(?:救|解围))/g;
// 信息空降：角色无来源地获知——"我已经知道了"且无前置调查/告知信号
const UNROURCED_ZH = /(我早知道|我早就知道|我已经知道了|我全都知道|我什么都知道|其实我一直知道|我查到了|我调查过了|我摸清了(?!.*底细))/g;

// —— 英文信号库 ——
const COINCIDENCE_EN = /(coincidentally|by coincidence|luckily|fortunately|as luck would have it|by chance|happened to|just in time|conveniently|of all (?:the )?(?:people|places|times))/gi;
const SUDDEN_EN = /(suddenly|all of a sudden|out of nowhere|without warning|abruptly)/gi;
const CAUSATION_EN = /(because|since|so that|in order to|therefore|thus|in order for|for the sake of|to (?:protect|save|stop|prevent|get|find|prove|avenge|escape|survive)|i must|i have to|i need to|so i)/gi;
const SEQUENCE_EN = /(then|afterwards|after that|subsequently|next)/gi;
const OATH_EN = /(i swear|i vow|i promise|i will make (?:you|them) pay|you('ll| will) pay|i will never forgive|i will have my revenge|mark my words|i must (?:have|get) revenge)/gi;
const PAYOFF_EN = /(finally did it|succeeded|got (?:my|his|her|their) revenge|avenged|kept (?:my|his|her) promise|made it|won|pulled it off|turn(?:ed)? the tables|fought back)/gi;
const DEUS_EN = /(rescue (?:arrives|came|party)|reinforcements (?:arrive|came)|cavalry(?: arrives| came| shows up)?|saved by|shows up just in time|arrives just in time|mysterious stranger (?:appears|steps in)|a mysterious (?:figure|savior))/gi;
const UNSOURCED_EN = /(i already knew|i('ve| have) known all along|i know everything|i found out(?!.*(?:because|after|when))|i discovered(?!.*(?:because|after|when)))/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function countMatches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

function snippetAt(text: string, idx: number, len = 24): string {
  const start = Math.max(0, idx - 6);
  const end = Math.min(text.length, idx + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * 因果逻辑链检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function causalLogicCheck(text: string, lang: ClLang): CausalLogicResult {
  const issues: CausalLogicIssue[] = [];
  const total = text.length || 1;
  const isZh = lang === 'zh';

  const coincRe = isZh ? COINCIDENCE_ZH : COINCIDENCE_EN;
  const suddenRe = isZh ? SUDDEN_ZH : SUDDEN_EN;
  const causRe = isZh ? CAUSATION_ZH : CAUSATION_EN;
  const seqRe = isZh ? SEQUENCE_ZH : SEQUENCE_EN;
  const oathRe = isZh ? OATH_ZH : OATH_EN;
  const payoffRe = isZh ? PAYOFF_ZH : PAYOFF_EN;
  const deusRe = isZh ? DEUS_ZH : DEUS_EN;
  const unsourcedRe = isZh ? UNROURCED_ZH : UNSOURCED_EN;

  // —— 巧合命中（记录位置，用于尾段判定） ——
  const coincidenceHits: CoincidenceHit[] = [];
  let m: RegExpExecArray | null;
  coincRe.lastIndex = 0;
  while ((m = coincRe.exec(text)) !== null) {
    const position = m.index / total;
    coincidenceHits.push({
      marker: m[0],
      snippet: snippetAt(text, m.index),
      position,
      inTail: position >= 0.6,
    });
    if (m.index === coincRe.lastIndex) coincRe.lastIndex++;
  }

  // —— 机械降神 ——
  const deusExMachinaHits: DeusHit[] = [];
  deusRe.lastIndex = 0;
  while ((m = deusRe.exec(text)) !== null) {
    deusExMachinaHits.push({ snippet: snippetAt(text, m.index, 30), position: m.index / total });
    if (m.index === deusRe.lastIndex) deusRe.lastIndex++;
  }

  const suddenCount = countMatches(text, suddenRe).length;
  const causationCount = countMatches(text, causRe).length;
  const sequenceCount = countMatches(text, seqRe).length;
  const oathCount = countMatches(text, oathRe).length;
  const payoffCount = countMatches(text, payoffRe).length;
  const unsourcedMarkers = countMatches(text, unsourcedRe);
  const unsourcedCount = unsourcedMarkers.length;

  let penalty = 0;

  // 1) 巧合过载：>2 个巧合信号，每个额外巧合扣 12 分
  if (coincidenceHits.length >= 3) {
    penalty += (coincidenceHits.length - 2) * 12;
    const tailMarkers = coincidenceHits.filter((h) => h.inTail).map((h) => h.marker);
    issues.push({
      severity: 'high',
      type: 'coincidence_overload',
      evidence: coincidenceHits.slice(0, 3).map((h) => `「${h.marker}」@${(h.position * 100) | 0}%`).join('；'),
      advice: isZh
        ? `全文出现 ${coincidenceHits.length} 处巧合信号（${tailMarkers.length} 处在尾段）。剧情必须由人物选择驱动，把至少一处巧合改为主角主动布局/付出代价换来的结果。`
        : `Script relies on ${coincidenceHits.length} coincidences (${tailMarkers.length} in the final act). Plot must be driven by character choices; replace at least one coincidence with the protagonist's deliberate action or sacrifice.`,
    });
  }

  // 2) 巧合解决：尾段出现巧合且全文兑付信号少 → 靠运气收尾
  const tailCoincidences = coincidenceHits.filter((h) => h.inTail);
  if (tailCoincidences.length >= 1 && (payoffCount === 0 || causationCount <= 2)) {
    penalty += 20;
    issues.push({
      severity: 'high',
      type: 'coincidence_resolution',
      evidence: tailCoincidences[0].snippet,
      advice: isZh
        ? '故事在后 40% 靠巧合（"恰好/碰巧/幸好"）解决冲突，且缺少人物主动兑付或动机交代。让主角在结尾前做一个艰难选择，用行动而非运气赢得结局。'
        : 'Conflict is resolved by coincidence in the final act with little character agency or motivation. Give the protagonist a hard choice before the climax; the ending must be earned through action, not luck.',
    });
  }

  // 3) 机械降神：结尾救兵/贵人凭空出现
  if (deusExMachinaHits.length > 0) {
    penalty += 25;
    issues.push({
      severity: 'high',
      type: 'deus_ex_machina',
      evidence: deusExMachinaHits[0].snippet,
      advice: isZh
        ? `检测到 ${deusExMachinaHits.length} 处"救兵/贵人凭空解围"。救援力量必须在前文提前铺垫（一通电话、一个人情、一笔布局），否则观众会觉得作者作弊。`
        : `Detected ${deusExMachinaHits.length} deus ex machina rescue(s). Any rescue force must be set up earlier (a call, a favor owed, a planted scheme), or the audience feels cheated.`,
    });
  }

  // 4) 因果链稀薄：突发+顺承远多于因果动机
  // 健康剧本因果信号至少能覆盖突发+顺承的 40%；低于 25% 说明"事情只是发生"而非"因为所以发生"
  const suddenSeq = suddenCount + sequenceCount;
  const causalRatio = suddenSeq > 0 ? causationCount / suddenSeq : 1;
  if (suddenSeq >= 4 && causalRatio < 0.25) {
    penalty += 15;
    issues.push({
      severity: 'mid',
      type: 'thin_causation',
      evidence: isZh
        ? `突发/顺承 ${suddenCount + sequenceCount} 次（突然${suddenCount}/于是${sequenceCount}），因果动机 ${causationCount} 次`
        : `${suddenCount + sequenceCount} sudden/sequential transitions vs ${causationCount} causal motivations`,
      advice: isZh
        ? '事件靠"突然/于是"硬接，缺少"因为/为了"的动机交代。在关键转折前补一句人物的目的或理由，让观众明白他为什么这么做。'
        : 'Events are joined with "suddenly/then" but few "because/in order to" motivations. Add a line of purpose before key turns so the audience understands why the character acts.',
    });
  }

  // 5) 誓言烂尾：立了 ≥2 个强宣言但零兑付信号
  if (oathCount >= 2 && payoffCount === 0) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'unresolved_oath',
      evidence: isZh ? `${oathCount} 处誓言/威胁，0 处兑付` : `${oathCount} oaths/threats, 0 payoffs`,
      advice: isZh
        ? `角色立了 ${oathCount} 个"我一定要/你等着"的 flag，但本集看不到任何兑付动作。至少让誓言推动一次具体行动（哪怕失败），否则宣言变成噪音。`
        : `Characters make ${oathCount} strong oaths with zero payoff actions. Let at least one oath drive a concrete move this episode (even a failed one), or the declarations become noise.`,
    });
  }

  // 6) 信息空降：≥2 处"我早就知道"且无调查/告知类因果
  if (unsourcedCount >= 2 && causationCount < 2) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'unsourced_knowledge',
      evidence: isZh ? `${unsourcedCount} 处"我早知道/我查到了"，无获知来源` : `${unsourcedCount} "already knew/found out" without a source`,
      advice: isZh
        ? '角色多次表现出"我早就知道"，但没有展示他如何得知（调查、线人、偷听）。补一场获知信息的戏，或改为当场推理得出。'
        : 'Characters repeatedly "already know" things without showing the source (investigation, informant, eavesdropping). Add a discovery scene or convert it to on-the-spot deduction.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    coincidenceCount: coincidenceHits.length,
    coincidenceHits: coincidenceHits.slice(0, 8),
    deusExMachinaHits,
    suddenCount,
    causationCount,
    sequenceCount,
    oathCount,
    payoffCount,
    unsourcedCount,
    issues,
  };
}
