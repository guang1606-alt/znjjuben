import { isSceneHeaderLine } from './script-scenes';
/**
 * 梦呓泄密检测（v2.126 块134，创作能力类）
 * ------------------------------------------------------------------
 * 病象：关键情报一难产就让人睡着——主角守在床边，睡着的人一句
 * 梦呓就把藏匿点/密码/身世全盘托出：
 *   △她在梦里喃喃：钥匙……藏在衣柜夹层……
 *   △他睡得沉，说出了当年的真相。
 *   She murmurs in her sleep: "the ledger is under the floorboards."
 * 睡眠成了免费情报闸口：泄露的锁扣被简化为睡姿。真实的人说梦话
 * 语无伦次、多为当天琐事的碎片，唯独不会条理清晰地背诵机密；
 * 第一次是氛围彩蛋，反复用就成了档案柜的廉价替身。梦话只能当
 * 线索，不能当情报直取——要真话，让对方醒着选择开口才是戏。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - drunkTruth：管"灌醉"这个手段批量解锁真话，锚点是酒；本引擎
 *    锚点是睡眠，两者同属"意识失守吐真言"姊妹，词表正交；
 *  - truthSerum：管药物/测谎仪强制吐真（人为施药），本引擎管
 *    自然睡眠的零代价泄露；
 *  - eavesdropDump：管第三方主动偷听（有窃听动作），本引擎管
 *    被动听见睡梦中的话，无窃听锚词重叠；
 *  - villainOverconfession：管清醒反派被空泛质问后不打自招，
 *    本引擎管睡眠状态泄露，与清醒质问结构无交集；
 *  - faintOnCue：管晕倒掐断信息（信息出不去），本引擎管信息
 *    白给漏出（信息免费出去），方向相反。
 *
 * 判定（单型双锚）：
 *  - 睡眠状态锚命中（睡着/梦呓/说梦话/睡得沉/半梦半醒/fell
 *    asleep/murmurs in her sleep…），且 ±2 行窗口内出现机密
 *    payload（钥匙/密码/账本/当年真相/凶手是/the ledger/where
 *    she buried/who killed…）——纯睡眠戏（无机密词）放行，
 *    纯机密戏（无睡眠语境）放行，双锚缺一不可；
 *  - 相邻 2 行内的睡眠表述视为同一场睡眠（"睡着了"+"梦呓"），
 *    不重复计；跨场景头重置，各算一次钥匙使用；
 *  - 第 1 次豁免（一次性彩蛋合法），第 2 次起每次 1 hit；
 *  - rescue（±2 行）：含糊不泄（语无伦次/听不清/没人听懂/
 *    gibberish/incoherent…）——梦话没产出可用情报；装睡利用
 *    （装睡/假寐/pretends to sleep…）——听者主动布局，非白给；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface SleepTalkHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（含糊不泄/装睡利用，没当情报直取） */
  rescued: boolean;
  reason: string;
}

export interface SleepTalkResult {
  score: number;
  /** 睡眠钥匙总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: SleepTalkHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 睡眠状态锚（"梦见/梦到"是做梦内容不一定是睡态行，不收；"喃喃"清醒可用，不单收） */
const SLEEP_ZH = /说梦话|梦呓|呓语|睡(?:着|梦|熟|了|去)|睡得[^，。\n]{0,4}(?:沉|死|香)|半梦半醒|梦(?:中|里)/;

const SLEEP_EN = /\b(?:(?:murmur(?:s|ing)?|mumbl(?:es|ing)?|mumbles?|rambl(?:es|ing)?|talk(?:s|ing)?|sleep-talk(?:ing|s)?) (?:in|during) (?:his|her|their) sleep|asleep|half[- ]asleep|sound asleep|in (?:his|her|their) sleep)\b/i;

/* 机密 payload：睡眠语境 × 具体机密物/身世/案情，共现才算泄露 */
const LEAK_ZH = /钥匙|密码|保险柜|账本|金条|存折|地契|遗嘱|名单|地窖|密室|暗格|夹层|转账|当年[^，。\n]{0,6}(?:真相|秘密|事)|下(?:了)?毒|凶手(?:是|就是)|灭(?:了)?口|幕后(?:主使)?/;

const LEAK_EN = /\b(?:the (?:safe|combination|code|key|keys|ledger|list|location|password|account|will|deed)|where (?:he|she|they|it|the (?:money|body|ledger|file))[^,.\n]{0,24}(?:hidden|buried|is)|who (?:killed|ordered|paid|sent)|killed (?:your|his|her)|the (?:truth|secret) about|under the (?:floorboards|bed))\b/i;

/* 救援：含糊不泄（梦话没产出可用情报）+ 装睡利用（听者主动布局） */
const RESCUE_ZH = /听不(?:清|懂)|语无伦次|含糊(?:不清)?|没人(?:能)?听懂|只言片语|几不可闻|装睡|假寐/;

const RESCUE_EN = /\b(?:gibberish|incoherent|unintelligible|couldn'?t (?:make out|understand)|made no sense|pretends? to (?:be )?(?:asleep|sleep)|feign(?:ing|ed)? sleep)\b/i;

/**
 * 纯函数：检测"说梦话白给情报"式睡眠钥匙套路。
 */
export function sleepTalk(draft: string): SleepTalkResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const sleepRe = zh ? SLEEP_ZH : SLEEP_EN;
  const leakRe = zh ? LEAK_ZH : LEAK_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: SleepTalkHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevSleepLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevSleepLine = -10; return; }
    const m = line.match(sleepRe);
    if (!m) return;
    /* 相邻 2 行内的睡眠表述 = 同一场睡眠（"睡着了"+"梦呓"），不重复计 */
    if (i - prevSleepLine <= 2) { prevSleepLine = i; return; }
    prevSleepLine = i;

    /* 泄露检查：±2 行窗口内须出现机密 payload，纯睡眠戏放行 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const win = rawLines.slice(lo, hi + 1).join('\n');
    if (!leakRe.test(win)) return;

    hitCount += 1;
    if (hitCount >= 2) {
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (m[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '又在用说梦话白给情报——一句呓语就吐出藏匿点/密码/身世，关键信息的锁被简化为睡姿'
          : 'sleep-talk as a free intel chute again — one murmur hands over the hiding spot, the code, the whole secret; the lock reduced to a sleeping posture',
      });
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"梦呓泄密"式睡眠白给（${n} 处未救）——关键情报从睡着的嘴里零成本漏出。`
      : `${hitCount} sleep-talk beats (${n} unrescued) — critical intel leaks out of a sleeping mouth for free.`);
    advice.push(zh
      ? '梦话不许当情报快递——真实的人说梦话语无伦次、多为当天琐事的碎片，不会条理清晰地背诵机密；第一次是氛围彩蛋，第三次睡眠就成了档案柜。让情报贵起来：要么让听者付出代价（他守了三夜才拼出半句有用的），要么让梦话只当线索（呓语只有半个地名，逼主角去找证物验证）；要用梦呓，就写它的不可靠——第二天追问，睡者一脸茫然什么都不认，主角还得赌那句呓语是真是假。真要有人知道秘密，让他醒着选择开口，那才是戏。'
      : 'Sleep-talk is not an intel chute — real sleep-talkers gibber in fragments about the day\'s trivia; they do not deliver an organized debrief. The first time is an atmospheric Easter egg, the third makes sleep a filing cabinet. Make the intel cost something: the listener earns it (three nights of watching yield half a sentence), or let the murmur stay a lead (half a place name only, forcing the protagonist to hunt for corroboration). If you must use sleep-talk, write its unreliability — questioned the next morning, the sleeper remembers nothing and denies it all, and the protagonist has to gamble on whether the murmur was real. If someone truly knows the secret, let them choose to speak while awake — that is the scene.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
