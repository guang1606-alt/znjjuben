import { isSceneHeaderLine } from './script-scenes';
/**
 * 萌宝泄密 / 童言无忌阀门检测（v2.99 块107，创作能力类）
 * ------------------------------------------------------------------
 * 病象：大人死守的秘密，孩子一句奶声奶气的话就当众拆封——
 *   "那个叔叔昨晚是不是睡在你房间了？"
 *   "王叔叔不是我亲爸爸！妈妈说你是坏人！"
 *   "奶奶，是他推的妈妈！"
 * 童言成了编剧的拆信刀：血缘、奸情、命案、阴谋，多难的真相都
 * 由一个四岁的娃免费宣读，满座大人当场采信、当场变色。第一次是
 * 天趣，第三次观众就看穿：孩子不是角色，是一台移动的真相广播。
 * 孩子的话可以当线头，不能当证词——来路要演，采信要付代价。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - drunkTruth：管"灌醉"解锁真话（手段是酒），本引擎管"年幼"
 *    解锁真话（手段是童言无忌）——免费真心话家族的同龄兄弟；
 *  - villainConfession：管成年人被空泛质问后不打自招，本引擎管
 *    无认知幼童当众泄密，锚点是孩子而非反派；
 *  - eavesdropDump：管成年人偷听白拿机密，本引擎管秘密从孩子嘴里
 *    自己跑出来；
 *  - witnessGratuity：管证人带证据上门（成年证人有诉求），本引擎
 *    管零诉求、零责任能力的孩童一句话定案；
 *  - instantKinship：管认亲后成年人零成本接纳，本引擎管血缘真相
 *    被孩子零成本宣布（宣布时刻的密度病，接纳归 instantKinship）；
 *  - infoDelivery：管设备/广播/信使把信息投喂给角色，本引擎管
 *    信息从幼童口中以"天真"的方式无成本流出。
 *
 * 判定：
 *  - 孩童锚（小孩/小男孩/小女孩/萌宝/宝宝/幼童/童言/奶声奶气/
 *    X岁的…/儿子女儿才X岁 + little kid/five-year-old/toddler/
 *    small child…）与秘密 payload 锚（血缘/奸情/阴谋转述/目击
 *    指认四族）±2 行窗口共现 → 构成一次"童言泄密"事件；双条件
 *    缺一不可——纯亲子戏放行（孩子要蛋糕），成人说同款秘密放行
 *    （成年女儿说"他不是我亲爸"不归本引擎，故 payload 只收
 *    爸/妈/爹/娘等幼童称谓，不收 父亲/母亲）；
 *  - rescue：①授意锚（教他这么说/事先交代/排练/故意让孩子宣布
 *    + coached/told him to say/rehearsed/put him up to）——孩子
 *    是传声筒，泄密是大人的行动；②不采信锚（没人当真/小孩子懂
 *    什么/童言无忌/以为瞎说/还要核实 + nobody believed/kid's
 *    imagination/making it up/laughed it off）——童言没当证词，
 *    真相没有零成本兑付；
 *  - rescue 扫描包含孩童/payload 行自身与事件 ±2 行（授意词天然
 *    与台词相邻——"是她事先教好的"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的孩童表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次童言天趣合法），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ChildBlurtHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有授意/不采信锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface ChildBlurtResult {
  score: number;
  /** 童言泄密事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: ChildBlurtHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 孩童锚：零词典人名源，只认年龄/称谓/声口，不认名字（"小宝/安安"归年龄行配对） */
const CHILD_ZH = /小孩(?:子|儿)?|小男孩|小女孩|男娃|女娃|萌宝|宝宝|幼童|幼(?:子|女)|童言|童声|奶声奶气|奶气|[一二两三四五六七八九十\d]岁(?:半|大)?的?(?:小家伙|男孩|女孩|孩子|娃|儿子|女儿)?|(?:儿子|女儿)(?:才|刚|今年)[^，。；！？\n]{0,4}[一二两三四五六七八九十\d]岁/;

const CHILD_EN = /\b(?:little (?:kid|child|boy|girl|one)s?|small (?:child|boy|girl)|young(?:er|est)? (?:kid|child|boy|girl|son|daughter)|the kid|a kid|kids?|toddler|pre-?schooler|kindergart(?:ener|en kid)|(?:\d+|five|four|three|six|seven|eight|nine|ten)[- ]year[- ]olds?|(?:his|her|their) (?:own )?(?:little )?(?:boy|girl)|in a (?:small|high|little) (?:child|kid)[’']?s (?:voice|pipe))\b/i;

/* 秘密 payload：四族——血缘 / 奸情 / 阴谋转述 / 目击指认（只用幼童称谓：爸/妈/爹/娘） */
const BLURT_ZH =
  // ① 血缘：不是亲爸爸/两个爸爸/新爸爸/后爸
  /不是[^，。；！？\n]{0,4}亲(?:生)?(?:爸|妈|爹|娘)|你不是我(?:亲)?(?:爸|妈|爹|娘)|两个(?:爸爸|妈妈|爹地|妈咪)|新(?:爸爸|妈妈|爹地|妈咪)|后爸|后妈/.source
  // ② 奸情：叔叔/那个男人 + 半夜/昨晚 + 睡/来 + 房间/床
  + '|' + /(?:叔叔|阿姨|那个男人|那个女人)[^，。；！？\n]{0,12}(?:半夜|昨晚|昨夜|昨天夜里|深夜)[^，。；！？\n]{0,12}(?:睡|躺|钻|来|进|在)[^，。；！？\n]{0,8}(?:房间|床上|被窝)|(?:妈妈|爸爸)的?房间[^，。；！？\n]{0,6}(?:叔叔|阿姨|男人|女人)|亲了?妈妈|抱了?妈妈/.source
  // ③ 阴谋转述：妈妈/爸爸说你是坏人/骗子/杀人/害死/坐牢/骗
  + '|' + /(?:妈妈|爸爸|奶奶|爷爷|外婆|外公|叔叔|阿姨)[^，。；！？\n]{0,2}说[^，。；！？\n]{0,14}(?:坏人|骗子|杀人|杀人犯|害死|杀了|坐牢|不是好人|骗了?(?:大家|所有人|你|他|她)|假的|冒牌)/.source
  // ④ 目击指认：是他推的/看见他藏/藏在床底
  + '|' + /(?:是|就是)他(?:们)?[^，。；！？\n]{0,4}(?:推|撞|打|杀|捅|害)的?|看见(?:他|她|那人|那个人)[^，。；！？\n]{0,10}(?:推|撞|打|杀|捅|藏|扔|塞|埋|烧)|藏在(?:床底下?|柜子里?|抽屉里?|枕头底下?|地毯下?|被子里?)/.source;

const BLURT_ZH_RE = new RegExp(BLURT_ZH);

const BLURT_EN =
  // ① bloodline
  /\b(?:you'?re|you are) not my real (?:daddy|mommy|dad|mom|papa|mama)|not (?:his|her|their) real (?:daddy|mommy|dad|mom|father|mother)|two daddies|two mommies|new (?:daddy|mommy)|step[- ]?daddy\b/.source
  // ② affair: that man ... slept ... mommy's room; uncle came last night; mommy kissed that man
  + '|' + /\bthat (?:man|uncle|guy)[^.\n!?]{0,26}(?:slept?|sleep|was|stayed|came)[^.\n!?]{0,18}(?:mommy'?s|mom'?s|your) (?:room|bed)|(?:uncle|that man|that guy)[^.\n!?]{0,16}(?:last night|at night|in mommy'?s (?:room|bed))|mommy (?:kissed|hugged|was with)[^.\n!?]{0,16}(?:that|the) (?:man|guy|uncle)\b/.source
  // ③ reported plot: mommy says you're a bad man / daddy said he killed
  + '|' + /\bmommy says? (?:you'?re|he'?s|she'?s) (?:a )?(?:bad man|liar|murderer|killer|fake)|mommy (?:told|said to) me[^.\n!?]{0,30}(?:killed|murdered|lied|stole|fake|bad man)|daddy says? (?:you|he)[^.\n!?]{0,24}(?:killed|murdered|lied|cheated|stole)\b/.source
  // ④ witness ID
  + '|' + /\bI saw (?:him|her|that man)[^.\n!?]{0,24}(?:push|hit|shoot|stab|hide|put|bury)|he (?:pushed|hit|stabbed|shot) (?:her|him|grandma|grandpa)|he hid (?:it|the gun|the knife|the bottle|the money)[^.\n!?]{0,16}(?:under|in|behind)|(?:that|it) was him!/.source;

const BLURT_EN_RE = new RegExp(BLURT_EN, 'i');

/* rescue A：授意锚——孩子是传声筒，词是大人喂的（泄密是行动不是阀门） */
const COACH_ZH = /教(?:他|她|孩子|宝宝|小宝|儿子|女儿)[^，。；！？\n]{0,8}(?:这样说|这么说|说的|说这些|喊)|事(?:先|前)[^，。；！？\n]{0,4}(?:交代|教|叮嘱|安排)|排练|练(?:了)?[^，。；！？\n]{0,3}遍|故意(?:让|叫|使)[^，。；！？\n]{0,6}(?:说|喊|讲|宣布)|串通(?:好)?|编好的?词|喂(?:好)?词|是我让(?:他|她)说的/;

const COACH_EN = /\b(?:coached|had coached|told (?:him|her|the kid|the child) to say|put (?:him|her|the kid|the child) up to|rehearsed|practiced (?:saying|the line)|made (?:him|her|the kid) say|drilled (?:him|her)|fed (?:him|her) the lines?|set (?:him|her) up to (?:say|tell))\b/i;

/* rescue B：不采信锚——童言没当证词，真相没有零成本兑付 */
const DISBELIEF_ZH = /没人把(?:一个)?(?:小孩|孩子)的?话当真|没人(?:信|当真)|都没当真|没人当真|当不得真|不当回事|以为(?:他|她|孩子|宝宝)?(?:在?)(?:瞎说|胡说|乱说|瞎讲|闹着玩|开玩笑|编故事)|小孩子(?:家家|的话|懂什么|乱说)|童言无忌|怎么能信(?:一个)?(?:小孩|孩子)|不能(?:凭|因为)(?:一个)?(?:小孩|孩子)的?话/;

const DISBELIEF_EN = /\b(?:nobody|no one) believed|didn'?t believe (?:him|her|it|a word|the kid|the child)|dismissed (?:it|the words?|the story)|(?:just|only|merely) (?:a )?kid'?s (?:imagination|fantasy|story)|making (?:it|things) up|can'?t believe (?:a |the )?(?:word of a )?(?:child|kid)|kid was (?:joking|making it up)|laughed it off|didn'?t take it seriously|not (?:take|taking) (?:a |the )?child'?s word|had to (?:verify|check|confirm (?:it )?(?:first|herself|himself))\b/i;


/**
 * 纯函数：检测"童言无忌式真相广播"密度病。
 */
export function childBlurt(draft: string): ChildBlurtResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const childRe = zh ? CHILD_ZH : CHILD_EN;
  const blurtRe = zh ? BLURT_ZH_RE : BLURT_EN_RE;
  const coachRe = zh ? COACH_ZH : COACH_EN;
  const disbeliefRe = zh ? DISBELIEF_ZH : DISBELIEF_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasChild: boolean[] = new Array(rawLines.length).fill(false);
  const hasBlurt: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasChild[i] = childRe.test(line);
    hasBlurt[i] = blurtRe.test(line);
  });

  /* pass2：孩童行与 ±2 行内的秘密 payload 配对成事件（相邻 ≤2 行孩童行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasChild[i]) return;
    const m = raw.match(childRe);
    const marker = (m?.[0] ?? '').replace(/^\s+/, '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的孩童表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasBlurt[j],
    );
    if (win.length === 0) return; /* 纯亲子戏放行（孩子要蛋糕不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（授意/不采信两路；窗口含事件自身 ±2 行，仅跳过场景头行） */
  const hits: ChildBlurtHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次童言天趣合法） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = coachRe.test(win) || disbeliefRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"童言无忌"式真相广播——血缘、奸情、命案多难的秘密，一个奶声奶气的娃免费宣读，满座大人当场采信，孩子成了编剧的拆信刀'
        : 'child-blurt again - bloodline, affair, murder, any secret the adults guard is read aloud for free by a lisping kid and believed on the spot; the child is the writer\'s letter opener',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"萌宝泄密"式童言阀门（${n} 处未救）——大人死守的秘密被孩子一句话当众拆封，第一次是天趣，第三次孩子就成了移动的真相广播。`
      : `${hitCount} child-blurt beats (${n} unrescued) - the adults' best-kept secret is opened by a child's one line. Once is charm; by the third, the kid is a walking truth broadcast.`);
    advice.push(zh
      ? '童言的账要当面算清：孩子的话可以当线头，不能当证词。给每一次"脱口而出"补一道门槛：①来路要演——孩子怎么知道的？躲在门后听见（演给他听的半句、他其实听错了）、捡到过照片、被大人套话利用（反派故意教孩子当众宣布好打主角一个措手不及——授意是行动，孩子就从广播变回棋子）；②采信要付代价——满座大人不该听完就变色定案，让亲者维护（"小孩子懂什么，别瞎说"）、让听者将信将疑，主角得拿孩子的话去对质、去验证，验证过程中再吃一次亏，真相才落锤；③让童言付出童言的代价——孩子说破后遭到训斥、被封口、甚至被反派盯上，下一次他学会了沉默，秘密的重量才回到大人身上。最忌讳同一个娃在一集里三次精准点名：亲爹是谁、奸夫是谁、凶手是谁，词汇量和信息来源全成谜。真想保留一次天趣，把它留给全稿唯一一次，并让大人的第一反应是"不可能"——孩子负责种下怀疑，扳倒人要靠成年人自己挣来的证据。'
      : 'A child\'s line keeps honest books: it can be a thread, never testimony. Toll every blurt with a gate: (1) Source on screen - how does the child know? A half-sentence overheard through a door (and misheard), a photo found, or an adult weaponizing the child (the villain coaches the kid to announce it in public - coaching is an action, the kid becomes a pawn instead of a PA). (2) Belief costs something - the room must not freeze into instant verdict; let a parent shut it down ("kids say the darndest things"), let the listener doubt, and make the protagonist verify and take a loss while verifying before the truth lands. (3) Let the blurt cost a child\'s price - the kid gets scolded, silenced, even targeted, and learns to go quiet next time; the weight of the secret returns to the adults. The unforgivable version is one toddler naming the real father, the lover, and the killer three times in one episode with no visible source. Save the single charming blurt for the whole script, and make the first adult reaction "that can\'t be true" - the child plants doubt; the takedown still needs evidence the grown-ups earn.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
