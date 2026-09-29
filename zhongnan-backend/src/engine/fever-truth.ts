import { isSceneHeaderLine } from './script-scenes';
/**
 * 高烧谵妄吐真言检测（v2.127 块135，创作能力类）
 * ------------------------------------------------------------------
 * 病象：真话一难产就让人发烧——主角守在病床边，烧糊涂的人一场
 * 谵妄就把藏匿点/密码/当年隐情全盘托出：
 *   △他高烧不退，迷迷糊糊把当年下毒的事说了出来。
 *   △她烧糊涂了，嘴里念叨着账本藏在哪儿。
 *   He is delirious with fever. He spills where the ledger is hidden.
 * 高烧成了万能钥匙：情报的锁扣被简化为体温刻度。真实的人谵妄时
 * 语无伦次、只蹦碎片，烧退了多半不记得自己说过什么，唯独不会
 * 条理清晰地背诵机密；第一次是苦情彩蛋，第三次病床就成了档案
 * 柜的廉价替身。谵语只能当线索，不能当证词——要真话，让对方
 * 烧退清醒后自己选择开口才是戏。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - drunkTruth：管"灌醉"手段批量解锁真话，锚点是酒；本引擎锚点
 *    是病，"意识失守吐真言"三件套（酒/睡/病）词表正交；
 *  - sleepTalk：管睡眠梦呓泄密，锚点是睡姿；本引擎锚点是发烧
 *    谵妄，睡眠与病是两套身体状态；
 *  - truthSerum：管药物/测谎仪强制吐真（人为施药），本引擎管
 *    自然病程的零代价泄露，"胡话"在 truthSerum 中仅作非流利
 *    修饰词（rescue 域），非独立通道；
 *  - deathbedConfession：管临终遗言（死亡临近域），本引擎管
 *    可痊愈的发烧，不涉死亡；
 *  - muteOnCue/deafOnCue/blindnessOnCue：高烧在它们那里是失能
 *    成因（烧坏嗓子/耳朵/眼睛，夺走能力）；本引擎高烧是泄密
 *    通道（吐出秘密），同一把火方向相反；
 *  - woundOnCue/instantSurgery：发烧是伤情症状/手术代价词，
 *    掐点与代价域，不涉泄露；
 *  - faintOnCue：管晕倒掐断信息（信息出不去），本引擎管信息
 *    免费漏出（信息免费出去），方向相反。
 *
 * 判定（单型双锚）：
 *  - 发烧谵妄锚命中（高烧/烧糊涂/说胡话/胡言乱语/谵妄/high
 *    fever/delirious…；裸"发烧/低烧/退烧"程度弱不收），且 ±2
 *    行窗口内出现机密 payload（钥匙/密码/账本/当年真相/凶手是/
 *    the ledger/who killed…）——纯病床戏（无机密词）放行，纯
 *    机密戏（无发烧语境）放行，双锚缺一不可；
 *  - 相邻 2 行内的烧态表述视为同一场病（"高烧不退"+"说胡话"），
 *    不重复计；跨场景头重置，各算一次钥匙使用；
 *  - 第 1 次豁免（一次性彩蛋合法），第 2 次起每次 1 hit；
 *  - rescue（±2 行）：含糊不泄（语无伦次/听不清/没人听懂/
 *    incoherent/gibberish…）——谵语没产出可用情报；事后作废
 *    （烧糊涂说的当不得真/退烧后不记得/fever talk/remembered
 *    nothing…）——作者自己声明谵语不作数，非白给；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FeverTruthHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（含糊不泄/事后作废，没当情报直取） */
  rescued: boolean;
  reason: string;
}

export interface FeverTruthResult {
  score: number;
  /** 病床钥匙总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: FeverTruthHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 发烧谵妄锚（裸"发烧/低烧/退烧"程度弱或属恢复，不收；"烧得"须绑状态词防"烧得红了眼"误中） */
const FEVER_ZH = /高烧(?:不退|昏迷|抽搐|惊厥)?|烧糊涂|烧得[^，。\n]{0,8}(?:糊涂|迷糊|不省人事|胡话|厉害|说|起不来)|说[^，。\n]{0,3}胡话|胡言乱语|谵妄|烧(?:到|得)[^，。\n]{0,5}度/;

const FEVER_EN = /\b(?:high fever|burning up|burning with fever|deliri(?:ous|um)|feverish (?:rambling|murmuring|muttering|raving)|raving with fever|fever of \d{2,3}|temperature of \d{2,3})\b/i;

/* 机密 payload：发烧语境 × 具体机密物/身世/案情，共现才算泄露（与 sleepTalk 同族 payload 词表） */
const LEAK_ZH = /钥匙|密码|保险柜|账本|金条|存折|地契|遗嘱|名单|地窖|密室|暗格|夹层|转账|当年[^，。\n]{0,6}(?:真相|秘密|事)|下(?:了)?毒|凶手(?:是|就是)|灭(?:了)?口|幕后(?:主使)?/;

const LEAK_EN = /\b(?:the (?:safe|combination|code|key|keys|ledger|list|location|password|account|will|deed)|where (?:he|she|they|it|the (?:money|body|ledger|file))[^,.\n]{0,24}(?:hidden|buried|is)|who (?:killed|ordered|paid|sent)|killed (?:your|his|her)|the (?:truth|secret) about|under the (?:floorboards|bed))\b/i;

/* 救援：含糊不泄（谵语没产出可用情报）+ 事后作废（烧糊涂说的当不得真/退烧不记得） */
const RESCUE_ZH = /听不(?:清|懂)|语无伦次|含糊(?:不清)?|没人(?:能)?听懂|只言片语|几不可闻|当不得真|烧糊涂(?:了)?(?:说|的话|的)|退烧(?:后|了)?[^，。\n]{0,6}(?:不记得|记不得|忘了)|记不得自己|胡话当不得/;

const RESCUE_EN = /\b(?:gibberish|incoherent|unintelligible|couldn'?t (?:make out|understand)|made no sense|fever (?:talk|nonsense|ravings?)|remembered nothing|remembers nothing|remember(?:s|ed)? nothing (?:of|about)|delirious nonsense)\b/i;

/**
 * 纯函数：检测"高烧谵妄吐真言"式病床钥匙套路。
 */
export function feverTruth(draft: string): FeverTruthResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const feverRe = zh ? FEVER_ZH : FEVER_EN;
  const leakRe = zh ? LEAK_ZH : LEAK_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: FeverTruthHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevFeverLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevFeverLine = -10; return; }
    const m = line.match(feverRe);
    if (!m) return;
    /* 相邻 2 行内的烧态表述 = 同一场病（"高烧不退"+"说胡话"），不重复计 */
    if (i - prevFeverLine <= 2) { prevFeverLine = i; return; }
    prevFeverLine = i;

    /* 泄露检查：±2 行窗口内须出现机密 payload，纯病床戏放行 */
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
          ? '又在用高烧白给情报——一场谵妄就吐出藏匿点/密码/隐情，关键信息的锁被简化为体温刻度'
          : 'fever as a master key again — one bout of delirium hands over the hiding spot, the code, the whole secret; the lock reduced to a thermometer reading',
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
      ? `${hitCount} 处"高烧吐真言"式病床钥匙（${n} 处未救）——关键情报从烧糊涂的嘴里零成本漏出。`
      : `${hitCount} fever-truth beats (${n} unrescued) — critical intel leaks out of a delirious mouth for free.`);
    advice.push(zh
      ? '高烧不许当万能钥匙——真实的人谵妄时语无伦次、只蹦碎片，烧退了多半不记得自己说过什么，不会条理清晰地背诵机密；第一次是苦情彩蛋，第三次病床就成了档案柜。让情报贵起来：要么让听者付出代价（他守了三夜才从碎片里拼出半个地名），要么让谵语只当线索（逼主角去找证物验证）；要用谵妄，就写它的不可靠——烧退后追问，病人一脸茫然什么都不认，主角还得赌那句胡话是真是假。真要有人知道秘密，让他退烧清醒后自己选择开口，那才是戏。'
      : 'Fever is not a master key — real delirious people gibber in fragments and remember nothing when the fever breaks; they do not deliver an organized debrief. The first time is an angst Easter egg, the third makes the sickbed a filing cabinet. Make the intel cost something: the listener earns it (three nights of nursing yield half a place name), or let the delirium stay a lead (forcing the protagonist to hunt for corroboration). If you must use it, write its unreliability — questioned after the fever breaks, the patient remembers nothing and denies it all, and the protagonist has to gamble on whether the rant was real. If someone truly knows the secret, let them choose to speak once the fever breaks — that is the scene.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
