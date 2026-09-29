/**
 * v2.135 台词潜台词/信息直给检测器（Subtext Check）
 *
 * 好台词是"嘴上说一件事，心里演另一件事"。短剧观众最出戏的瞬间，
 * 就是角色不跟人说话，而是转过头来替编剧给观众"念说明书"。
 *
 * 与现有引擎分工：
 * - show-dont-tell：叙述文本里的"他很生气/她很难过"（叙述行抽象直报）
 * - dialogue-functionality-check：一场戏对白有没有功能、信息是否塞太满（场景级结构）
 * - dialogue-water-check：对白注水/废话（信息密度为零）
 * - subtext-check（本引擎）：对白"怎么说"——该藏的底牌有没有藏、
 *   该演的情绪有没有演、有没有拿同伴当信息播报道具（写法级）
 *
 * 五类硬伤：
 * 1. on_the_nose_declaration 底牌直给：角色把自己不可告人的目的/秘密/计划
 *    原原本本念出口（"我接近你就是为了拿回公司""这一切都是我安排的"）——
 *    1 处 mid，≥2 处 high（潜文本全被毁，重写级）
 * 2. villain_exposition 反派自曝：反派必胜局突然给仇人讲解自己的全套计划
 *    （"你想知道为什么吗""既然你输定了，我不妨告诉你"）——经典低级写法
 * 3. as_you_know 向知情者科普：对着比你还清楚的人背诵双方已知事实
 *    （"你也知道，我们公司下个月就要上市""我们认识二十年了"）
 * 4. qa_exposition 问答式喂信息：一个人假装不知道地提问，另一个人配合背诵
 *    （"你知道明天什么日子吗？""当然，是爸的忌日……"）——双人念说明书
 * 5. named_emotion 情绪直报：张口就是"我好难过/我很生气/你让我失望"，
 *    情绪靠喊名不靠演（≥3 处才报，给告白/高潮的合理直抒留空间）
 *
 * 潜台词正信号 DEFLECTION：回避/嘴硬/答非所问（"没什么""随便""我累了"），
 * 作为"这剧本会写潜台词"的证据，少量回补扣分。
 *
 * 纯文本启发式，中英双语，中文层为单一事实源。
 */

import { parseDialogue } from './character-logic';

export type SbLang = 'zh' | 'en';

export interface SubtextIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'on_the_nose_declaration' | 'villain_exposition' | 'as_you_know' | 'qa_exposition' | 'named_emotion';
  evidence: string;
  advice: string;
}

export interface SubtextResult {
  score: number;
  dialogueLineCount: number;
  onTheNoseCount: number;
  villainExpoCount: number;
  asYouKnowCount: number;
  qaExpoCount: number;
  namedEmotionCount: number;
  /** 潜台词正面信号（回避/嘴硬/答非所问）数 */
  deflectionCount: number;
  issues: SubtextIssue[];
}

// —— 底牌直给：把秘密/真实目的/全盘计划主动念出口 ——
const ON_NOSE_ZH = /(我告诉你一个?秘密|从来没(?:有)?告诉过任何人|我.*?真正的目的|我接近你.{0,10}就是?为了|我嫁给你.{0,10}就是?为了|这一切都是我(?:安排|策划|设计)的|(?:所有|这一切|整件事).{0,4}都是我(?:干|做|安排)的|我做这一切都是为了|让我告诉你真相|实话告诉你.{0,12}(?:目的|计划|真相|布局)|我.*?的计划就是|我从来没(?:有)?爱过你|我一直在利用你|我图的就是)/;
const ON_NOSE_EN = /\b(?:i(?:['’]ll| will) tell you a secret|never told anyone|my real (?:goal|purpose|agenda)|i got close to you (?:just )?to|i married you (?:just )?to|i arranged (?:all of|every bit of) this|everything (?:was|is) me|i did (?:all of )?this (?:just )?to|let me tell you the truth|the truth is,? i(?:['’]ve| have)? never loved you|i(?:['’]ve| have) been using you|my plan was to)\b/i;

// —— 反派自曝：必胜局/仇人当面的讲解式独白 ——
const VILLAIN_ZH = /(你想知道为什么|想知道(?:真相|原因|为什么)吗|让我来告诉你|你以为(?:这一切|这些).{0,8}(?:巧合|意外|偶然)|既然你(?:快死|要死|输定|完了)|我不妨告诉你|你知道(?:你|自己).{0,10}怎么输的吗|你是不是(?:一直|很好奇).{0,10}为什么|等你到了(?:地下|黄泉|牢里).{0,8}就(?:会|能)明白)/;
const VILLAIN_EN = /\b(?:you want to know why|shall i tell you (?:why|how)|did you really think (?:all of|any of) this was (?:a )?(?:coincidence|accident)|i arranged (?:everything|all of this)(?: myself)?|since you(?:['’]re| are) (?:going to die|already a dead|done for)|allow me to (?:explain|enlighten you)|you know how you lost|you(?:['’]ve| have) been wondering why)\b/i;

// —— 向知情者科普：句首引导词（配合最小行长，过滤口语短句"你知道的"） ——
const AS_YOU_KNOW_ZH = /^(?:哎，?|唉，?)?(?:你也知道|你是知道的|你知道的，|众所周知|正如你所知|我们都(?:知道|清楚)|你不会不知道|别忘了，?|你还记得(?:吗|当年|那天)|想当年|咱们?认识.{0,6}年了?|我们(?:公司|集团).{0,4}(?:下个月|马上就要|即将).{0,6}(?:上市|融资|收购|破产))/;
const AS_YOU_KNOW_EN = /^(?:as you know|you know (?:perfectly|damn) well|need i remind you|you(?:['’]ll| will) recall|you remember (?:that|when)|remember when|we(?:['’]ve| have) known each other for|it(?:['’]s| has) been (?:over )?\d+ years|don(?:['’]t| not) forget (?:that)?)/i;

// —— 问答喂信息：假提问（下一行配合背诵事实） ——
const QA_PROMPT_ZH = /(你知道(?:明天|今天|后天|那天).{0,10}(?:是什么|什么日子)|你还记得.{0,14}吗|难道你不知道|你不会(?:真的)?忘了?吧|知道我今天为什么(?:找你|来)|你知道(?:他|她|爸|妈|我们).{0,10}是怎么(?:死|走|离开)的(?:吗)?)/;
const QA_PROMPT_EN = /\b(?:do you know what (?:day|date) (?:tomorrow|today) is|you remember (?:that|what happened)|don(?:['’]t| not) you remember|you didn(?:['’]t| not) forget|you know why i(?:['’]m| am) here|do you know how (?:he|she|dad|mom) (?:died|left))\b/i;
// 配合背诵的答句：肯定词开头 + 事实，或长句 + 事实信号
const AFFIRM_ZH = /^(?:对[，。、]?|嗯[，。、]?|没错|是的|当然|你记得就好|你没忘就好|那还用说)/;
const AFFIRM_EN = /^(?:yes[,.]?|yeah[,.]?|that(?:['’]s| is) right|of course|you remember(?: correctly)?|how could i forget)/i;
const FACT_ZH = /(\d{4}年|\d+年(?:前|了)|爸|妈|爷爷|奶奶|公司|集团|上市|破产|去世|忌日|离开|赶走|遗嘱|股份)/;
const FACT_EN = /\b(?:\d{4}|\d+ years? ago|dad|mom|father|mother|company|ipo|bankrupt|died|death|anniversary|left|kicked out|will|shares)\b/i;

// —— 情绪直报（台词里喊情绪名） ——
const NAMED_EMOTION_ZH = /(我(?:很|好|真的好?|非常|特别)(?:生气|难过|伤心|失望|害怕|担心|委屈|痛苦|开心|高兴|幸福|恨你)|我(?:爱|恨)(?:死)?你|我心里(?:好|很)(?:难受|痛|委屈)|你让我(?:很|太|真的很)(?:失望|生气|难过|伤心))/;
const NAMED_EMOTION_EN = /\b(?:i(?:['’]m| am) (?:so |very |really )?(?:angry|sad|hurt|disappointed|afraid|scared|miserable|heartbroken)|i feel (?:so |very |really )?(?:angry|sad|hurt|disappointed|afraid)|i love you so much|you (?:make|made) me (?:so |really )?(?:angry|sad|disappointed|hurt))\b/i;

// —— 潜台词正信号：回避/嘴硬/答非所问的短句 ——
const DEFLECTION_ZH = /^(?:没什么|没事|没什么。?$|不知道|随便|无所谓|你管|你管不着|再说吧|别问了|我累了|不想说|没怎么|挺好的?|不用你管|与你无关|不关你事|我先回去了?|茶凉了?|吃饭了吗)$/;
const DEFLECTION_EN = /^(?:nothing|nothing\.$|i(?:['’]m| am) fine|it(?:['’]s| is) fine|never mind|doesn(?:['’]t| not) matter|whatever|i don(?:['’]t| not) (?:wanna|want to) talk (?:about it)?|leave it|none of your business|mind your own|i(?:['’]m| am) tired|i(?:['’]m| am) good|don(?:['’]t| not) ask)$/i;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * v2.135 台词潜台词检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function subtextCheck(text: string, lang: SbLang): SubtextResult {
  const empty: SubtextResult = {
    score: 100,
    dialogueLineCount: 0,
    onTheNoseCount: 0,
    villainExpoCount: 0,
    asYouKnowCount: 0,
    qaExpoCount: 0,
    namedEmotionCount: 0,
    deflectionCount: 0,
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const lines = parseDialogue(text);
  if (lines.length < 8) return { ...empty, dialogueLineCount: lines.length };

  const ON_NOSE = isZh ? ON_NOSE_ZH : ON_NOSE_EN;
  const VILLAIN = isZh ? VILLAIN_ZH : VILLAIN_EN;
  const AYK = isZh ? AS_YOU_KNOW_ZH : AS_YOU_KNOW_EN;
  const QA = isZh ? QA_PROMPT_ZH : QA_PROMPT_EN;
  const AFFIRM = isZh ? AFFIRM_ZH : AFFIRM_EN;
  const FACT = isZh ? FACT_ZH : FACT_EN;
  const NAMED = isZh ? NAMED_EMOTION_ZH : NAMED_EMOTION_EN;
  const DEFLECT = isZh ? DEFLECTION_ZH : DEFLECTION_EN;
  // 中文按字数，英文按词数；回避判定先剥句末标点（"没什么。"/"Nothing."）
  const lenOf = (s: string) => (isZh ? s.length : s.trim().split(/\s+/).filter(Boolean).length);
  const stripTail = (s: string) => s.replace(/[。！!？?….,~～\s]+$/u, '');

  let onNose = 0;
  let villain = 0;
  let ayk = 0;
  let qaPairs = 0;
  let named = 0;
  let deflection = 0;
  // 证据（用于 evidence 摘要，只记行文本）
  const onNoseEv: string[] = [];
  const villainEv: string[] = [];
  const aykEv: string[] = [];
  const qaEv: string[] = [];
  const namedEv: string[] = [];
  // 被 qa 组占用的行索引，不再参与单行判定，避免双罚
  const occupied = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text.trim();
    if (!t) continue;

    // 先识别问答喂信息组（跨行，i 与 i+1）
    if (!occupied.has(i) && QA.test(t) && i + 1 < lines.length) {
      const ans = lines[i + 1].text.trim();
      const recited = (AFFIRM.test(ans) && lenOf(ans) > (isZh ? 10 : 6))
        || (lenOf(ans) > (isZh ? 16 : 12) && FACT.test(ans));
      if (recited) {
        qaPairs++;
        qaEv.push(`${t.slice(0, 18)} → ${ans.slice(0, 22)}`);
        occupied.add(i);
        occupied.add(i + 1);
        continue;
      }
    }
    if (occupied.has(i)) continue;

    // 优先级：反派自曝 > 底牌直给 > 知情者科普 > 情绪直报
    if (VILLAIN.test(t)) {
      villain++;
      villainEv.push(t.slice(0, 30));
    } else if (ON_NOSE.test(t)) {
      onNose++;
      onNoseEv.push(t.slice(0, 30));
    } else if (AYK.test(t) && lenOf(t) > (isZh ? 12 : 7)) {
      ayk++;
      aykEv.push(t.slice(0, 30));
    }
    if (NAMED.test(t)) {
      named++;
      namedEv.push(t.slice(0, 24));
    }
    const bare = stripTail(t);
    if (DEFLECT.test(bare) && lenOf(bare) <= (isZh ? 8 : 6)) deflection++;
  }

  const issues: SubtextIssue[] = [];
  let penalty = 0;

  // 1) 底牌直给：1 处 mid，≥2 处 high（重写级）
  if (onNose >= 2) {
    penalty += Math.min(20, 16 + (onNose - 2) * 4);
    issues.push({
      severity: 'high',
      type: 'on_the_nose_declaration',
      evidence: isZh
        ? `${onNose} 句台词把不可告人的目的/秘密/计划直接念出口（如"${onNoseEv[0]}"）——潜台词被台词全部说破`
        : `${onNose} lines spell out the secret agenda/plan word for word (e.g. "${onNoseEv[0]}") — subtext is spoken aloud`,
      advice: isZh
        ? '底牌只能让观众"看出来"，不能让角色"说出来"。真实目的要拆成三样东西演出来：一个反常的动作（对仇人莫名温柔）、一句失言后立刻收回的话、一个只有观众看到的眼神。让观众比剧中人先猜到真相，又不敢确定——弹幕会替你把潜台词刷满，角色自己说破的那一刻，戏就死了。'
        : 'An agenda must be deduced, never announced. Play the truth through three channels instead: an unexplainable action (tenderness toward an enemy), a slip immediately taken back, a glance only the audience catches. Let viewers guess the truth one beat ahead of the characters — and still doubt it. The chat will write your subtext for you; the second a character says it out loud, the scene dies.',
    });
  } else if (onNose === 1) {
    penalty += 9;
    issues.push({
      severity: 'mid',
      type: 'on_the_nose_declaration',
      evidence: isZh
        ? `1 句台词把真实目的/秘密直接说破："${onNoseEv[0]}"`
        : `One line spells out the hidden agenda directly: "${onNoseEv[0]}"`,
      advice: isZh
        ? '这句自白改成"差一点说出口"：让对方先逼问，他答的是另一件事；或者让他说完上半句自己停住，用一个动作把下半句咽回去。承认的话越短、越绕，观众越信。'
        : 'Turn the confession into an almost-confession: under pressure, have the character answer a different question — or start the sentence and swallow the rest behind an action. The shorter and more evasive the admission, the more the audience believes it.',
    });
  }

  // 2) 反派自曝：一次就是硬伤
  if (villain >= 1) {
    penalty += Math.min(16, 10 + (villain - 1) * 4);
    issues.push({
      severity: 'mid',
      type: 'villain_exposition',
      evidence: isZh
        ? `${villain} 处反派在仇人当面讲解自己的计划/动机（如"${villainEv[0]}"）——必胜局突然给对手递讲义`
        : `${villain} villain monologue(s) explaining the scheme to the victim's face (e.g. "${villainEv[0]}") — handing the enemy the playbook`,
      advice: isZh
        ? '反派的计划永远不能从反派嘴里讲全。让主角自己"查"出来：一张撕剩的快递单、一句只有内鬼才知道的话、一个时间对不上的监控。反派在场时只说赢家的消遣——"你猜我为什么留你到现在"，答案永远不给。计划越靠证据拼出来，主角翻盘就越爽；反派自己讲明白，等于替主角写完了翻盘攻略。'
        : 'A villain never explains the plan — the hero must assemble it: a torn shipping label, a phrase only the mole could know, CCTV timestamps that don\'t fit. On stage the villain gets only the winner\'s tease — "guess why I kept you alive" — and never the answer. A plan pieced together from evidence makes the comeback earned; a villain who lectures hands the hero the winning strategy.',
    });
  }

  // 3) 向知情者科普：≥2 处
  if (ayk >= 2) {
    penalty += Math.min(12, ayk * 4);
    issues.push({
      severity: 'mid',
      type: 'as_you_know',
      evidence: isZh
        ? `${ayk} 句台词向本该知情的人背诵双方已知事实（如"${aykEv[0]}"）——拿对手当观众的耳朵`
        : `${ayk} lines lecture someone who already knows the fact (e.g. "${aykEv[0]}") — using a character as the audience's ear`,
      advice: isZh
        ? '两个知情人之间不需要介绍背景，只需要在背景上"过招"。把已知事实改成冲突筹码：不说"我们公司下个月上市"，而说"上市材料里要是多一份合同，你猜会怎样"。事实不直接出现，而是裹在威胁、试探、讨价还价里漏出来——观众偷听到的信息，比被喂到嘴里的香十倍。'
        : 'Two people in the know never brief each other — they fence over what they know. Recast the fact as leverage: not "our company IPOs next month," but "guess what one extra contract in the filing would do." Let facts leak only inside threats, probes, and bargains. Information an audience overhears tastes ten times better than information it is spoon-fed.',
    });
  }

  // 4) 问答喂信息：≥2 组
  if (qaPairs >= 2) {
    penalty += Math.min(10, qaPairs * 4);
    issues.push({
      severity: 'mid',
      type: 'qa_exposition',
      evidence: isZh
        ? `${qaPairs} 组"假提问+背诵答案"式对白（如"${qaEv[0]}"）——一问一答配合着给观众念说明书`
        : `${qaPairs} fake-Q&A exposition pairs (e.g. "${qaEv[0]}") — one character prompts while the other recites the handout`,
      advice: isZh
        ? '知情者之间的提问必须带刺，不能带答案。让提问变成质问（"你每年这个时候都出去，到底去见谁？"），让回答变成闪躲或反问；非要交代的信息，塞进争吵里半句带过，或者让不知情的第三方（孩子、新人、记者）来问，并且让知情人拒答——拒答比回答交代得更多。'
        : 'Questions between people in the know must carry a sting, never an answer slot. Turn the prompt into an accusation ("you disappear this week every year — who is it?") and the reply into a dodge or a counter-question. When exposition is unavoidable, give it to a genuine outsider (a kid, a rookie, a reporter) — and make the insider refuse to answer. A refusal reveals more than an answer ever could.',
    });
  }

  // 5) 情绪直报：≥3 处（给告白/高潮的合理直抒留空间）
  if (named >= 3) {
    penalty += Math.min(8, 6 + Math.floor((named - 3) / 2));
    issues.push({
      severity: 'low',
      type: 'named_emotion',
      evidence: isZh
        ? `${named} 句台词直接喊出情绪名（如"${namedEv[0]}"）——情绪靠报名不靠演`
        : `${named} lines announce the emotion by name (e.g. "${namedEv[0]}") — labeling instead of performing`,
      advice: isZh
        ? '情绪名是观众看完之后自己总结的词，不能是角色嘴里的词。"我很难过"改成具体到硌人的细节：把他的牙刷又摆回杯里、点餐习惯性点了两份、说"没事"却把筷子拿反了。越是大情绪越要绕开情绪词——观众自己涌上鼻子的酸，比角色喊一百句"难过"都管用。'
        : 'An emotion word is what the audience concludes afterward — never dialogue. Replace "I\'m so sad" with a grating detail: putting his toothbrush back in the cup, ordering two portions out of habit, saying "I\'m fine" while holding the chopsticks backwards. The bigger the feeling, the more it must avoid its own name. The lump that rises in the viewer\'s throat beats a hundred lines announcing the grief.',
    });
  }

  // 潜台词正信号缓冲：每 3 处回避/嘴硬回补 1 分（最多 3 分），奖励"会藏"的剧本
  if (deflection >= 3) penalty -= Math.min(3, Math.floor(deflection / 3));

  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty),
    dialogueLineCount: lines.length,
    onTheNoseCount: onNose,
    villainExpoCount: villain,
    asYouKnowCount: ayk,
    qaExpoCount: qaPairs,
    namedEmotionCount: named,
    deflectionCount: deflection,
    issues,
  };
}
