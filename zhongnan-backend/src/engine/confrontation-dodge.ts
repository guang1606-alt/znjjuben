import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 关键时刻打断逃场检测（Confrontation Dodge）
 * -----------------------------------------------------------
 * 创作能力类引擎：冲突是戏的发动机，最怕"刚要摊牌就有人敲门"。
 *   她刚要说出真相，敲门声突然响起。
 *   林棠正要质问，电话响了。
 *   话还没说完，助理推门冲了进来。
 * 一次是钩子；同一集里反复用"外部信号掐断关键对话"，且打断后这个
 * 冲突在本场再不回来，就是编剧在逃这场戏——不敢把对峙写到底，靠
 * 敲门声替人物做撤退，观众的情绪一次次被放空。
 *
 * 判定（需同时满足）：
 *  1) "即将爆发"信号（刚要说/正要质问/话到嘴边/about to reveal…）
 *     与"打断信号"（敲门/门铃/电话响/闯入/被打断…）同行或相邻行共现；
 *  2) rescue：打断后 6 行内、换场之前，人物把这场对话捡回来继续
 *     （继续质问/接着说/不依不饶/pressed on…）——打断只是节外生枝，
 *     冲突打满了，记 rescued 不扣分；
 *  3) 豁免：打断就是全稿最后一拍、其后再无任何戏（那是集尾钩子，
 *     归 cliffhanger）。
 *
 * 计分：0 次满分；1 次未回收 70 分（提醒，单次可能是过场）；
 *  ≥2 次 structural dodge，max(25, 100-(n-1)*30)。
 *
 * 边界：
 *  - plot-armor 管反派刀架脖子自白/放水（对手给窗口），本引擎管
 *    "外部信号替对峙双方踩刹车"（编剧给撤退）；
 *  - misunderstanding-drag 管"我不听我不听"式拒听离场，本引擎管
 *    想说说不出、被外力掐断；
 *  - cliffhanger 管集尾钩子，场末/全稿末打断不判。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DodgeHit {
  line: number;
  imminent: string;
  interrupt: string;
  snippet: string;
  /** 打断后冲突是否在本场被捡回来继续（捡回则不扣分） */
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface ConfrontationDodgeResult {
  score: number;
  sceneCount: number;
  hits: DodgeHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 冲突即将爆发：话到嘴边、正要摊牌
const IMMINENT_ZH = /(刚要(?:说|开口|质问|问|摊牌|公布|拿出|解释|提)|正要(?:说|开口|质问|问|摊牌|公布|解释)|刚开口|刚说出|话到嘴边|话还没(?:说完|出口)|还没来得及(?:说|解释|开口|问)|还没说完|没等(?:她|他|对方)(?:说完|开口)|准备(?:说出|摊牌|质问|公布)|差点(?:说出口|问出来)|真相(?:就在嘴边|险些脱口而出)|质问(?:的话|声)(?:已经)?(?:冲到|堵在)|张开?嘴(?:正要|刚要)|深吸一口气刚要)/;
const IMMINENT_EN = /\b(?:was (?:just )?about to (?:say|tell|ask|reveal|explain|confront|speak|answer)|just as (?:she|he) (?:opened (?:her|his) mouth|was about to (?:speak|say|ask))|opened (?:her|his) mouth to (?:speak|say|ask|protest|answer)|before (?:she|he) could (?:finish|say|answer|explain|ask|respond)|(?:she|he) hadn'?t finished|words (?:were )?on the tip of (?:her|his) tongue|mouth opened (?:to|but)|started to (?:speak|protest|explain)|nearly (?:said|blurted))\b/i;

// 外部打断信号
const INTERRUPT_ZH = /(敲门声|门铃(?:突然)?(?:响|大作)|门铃(?:声)?(?:突然)?响起|门(?:被|给)?(?:推开|撞开|踹开|猛地拉开|砰地打开|突然开了)|有人(?:推门|敲门|砸门|闯|冲|跑)|推门而入|推门进来|闯了?进来|冲了?进来|跑了?进来|电话(?:突然)?(?:响了?|铃声)|手机(?:突然)?(?:响了?|震动|亮起)|铃声(?:突然)?响起|被[^\n。！？]{0,6}(?:打断|截住)|打断了?(?:她|他|对方|这句话|话头)|匆匆(?:跑|冲|闯)进|不合时宜地响起|一阵急促的(?:敲门|电话|铃声))/;
const INTERRUPT_EN = /\b(?:knock(?:ed|ing)? at the door|knock on the door|doorbell(?: rang| buzzed)?|door (?:burst|flew|slammed) open|burst (?:in|through the door|into the room)|rushed in|stormed in|(?:phone|cell(?:\s?phone)?) (?:suddenly )?(?:rang|buzzed|started ringing|lit up)|phone ringing cut|\bcut (?:him|her) short\b|interrupted (?:him|her)|(?:him|her) off|didn'?t let (?:him|her) finish)\b/i;

// rescue：打断后人物把对话捡回来继续（冲突打满）
const RESUME_ZH = /(继续(?:说|问|质|讲|开口|摊牌|追问)|接着(?:说|问|质问|讲)|回到(?:刚才|正题|这个问题)|我刚才(?:说到|问)|你先别(?:走|挂|岔开)|不依不饶|不肯(?:罢休|放过|松手)|执意(?:要问|追问|问个清楚)|(?:追|拦|堵)(?:上|住|到)[^。！？\n]{0,8}(?:问|说)|不听(?:他|她|对方)(?:解释|说完)|(?:追问|质问)道|重新(?:开口|质问道))/;
const RESUME_EN = /\b(?:pressed (?:on|him|her)|went on|continued(?:\s+(?:speaking|asking|him|her))?|finished (?:her|his) sentence|wasn'?t done|was not done|demanded again|asked again|picked up where|insisted|chased (?:after )?(?:him|her)|blocked the door|refused to (?:let it go|drop it)|wouldn'?t (?:let it go|drop it)|didn'?t (?:let him|let her) leave|grabbed (?:his|her) arm and (?:asked|said|demanded))\b/i;

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function confrontationDodge(draft: string): ConfrontationDodgeResult {
  if (!draft || !draft.trim()) {
    return { score: 100, sceneCount: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const imminentRe = isZh ? IMMINENT_ZH : IMMINENT_EN;
  const interruptRe = isZh ? INTERRUPT_ZH : INTERRUPT_EN;
  const resumeRe = isZh ? RESUME_ZH : RESUME_EN;

  const lines = draft.split(/\r?\n/);
  const lastContentLine = (() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) return i + 1; // 1-based
    }
    return 0;
  })();
  let sceneCount = 0;
  const hits: DodgeHit[] = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneCount++; return; }
    if (DIALOGUE_RE.test(line)) {
      // 台词里也会写"我刚要说就被他打断"——同样算叙述信号，但只扫台词内容
    }

    const im = line.match(imminentRe);
    if (!im) return;
    // 打断信号在同行或下一非空行
    const here = interruptRe.exec(line);
    let interruptText = '';
    let interruptLine = -1;
    if (here) {
      interruptText = here[0];
      interruptLine = i + 1;
    } else {
      for (let k = i + 1; k <= i + 1 && k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        const nm = near.match(interruptRe);
        if (nm) { interruptText = nm[0]; interruptLine = k + 1; break; }
      }
    }
    if (!interruptText) return;

    // 集尾钩子豁免：打断点就是全稿最后一拍（后面再无任何戏，那才叫钩子）
    if (interruptLine === lastContentLine) return;

    // rescue：打断后 6 行内、换场之前捡回冲突
    let rescued = false;
    let rescueLine: number | undefined;
    for (let k = interruptLine; k <= interruptLine + 5 && k < lines.length; k++) {
      const near = lines[k].trim();
      if (!near) continue;
      if (isSceneHeaderLine(near)) break;
      if (resumeRe.test(near)) { rescued = true; rescueLine = k + 1; break; }
    }

    hits.push({
      line: i + 1,
      imminent: im[0],
      interrupt: interruptText,
      snippet: snippet(line),
      rescued,
      ...(rescueLine ? { rescueLine } : {}),
      reason: isZh
        ? '关键对峙刚起势就被外部信号掐断，冲突没打到底——一次是钩子，反复用且本场不回收就是逃戏'
        : 'a confrontation is killed by an external cue the instant it rises, and the beat never resumes — once is a hook; repeated and unresolved it dodges the scene',
    });
  });

  const badHits = hits.filter((h) => !h.rescued);
  const score = badHits.length === 0 ? 100 : badHits.length === 1 ? 70 : Math.max(25, 100 - (badHits.length - 1) * 30);

  const issues = badHits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」"${h.imminent}"被"${h.interrupt}"掐断——让这场对峙当场打满：打断的人要么被一句话顶回去（"出去，没看见我在说话？"），要么带进来的新情报当场把冲突升级，而不是让戏散场`
      : `L${h.line} "${h.snippet}" — "${h.imminent}" gets killed by "${h.interrupt}". Play the confrontation out: the intruder is waved off ("Get out, we're talking."), or the news they bring escalates the fight on the spot — never let the scene dissolve.`);

  const advice = isZh
    ? badHits.length > 0
      ? '关键对话不许靠敲门声撤退。把"差点说出口"改成已经顶到对方面前：质问要问到答案，真相要砸到人身上；外部闯入只能给冲突添柴（带来更坏的消息/被当场利用），不能替人物喊停。真想留白，一场只准用一次，且打断后本场必须捡回来。'
      : '中断信号都在同场被捡回，冲突打满了，保持。'
    : badHits.length > 0
      ? 'Never let a knock on the door retreat from a crucial exchange. Turn "almost said it" into a demand pressed to the other person\'s face; an intrusion can only add fuel (worse news delivered, exploited on the spot), never call timeout for the characters. If you need a pause, use it once per scene and return to the beat before the scene ends.'
      : 'Interruptions return to the beat in the same scene; the conflict plays out. Keep it.';

  return { score, sceneCount, hits, issues, advice };
}
