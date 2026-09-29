import { isSceneHeaderLine } from './script-scenes';
/**
 * 晕倒阀门 / 剧情病检测（v2.86 块94，创作能力类）
 * ------------------------------------------------------------------
 * 病象：剧情需要掐断信息时，角色准时晕倒——真相说到一半眼前一黑，
 * 反派刚要交代主谋就昏迷过去，追凶差一步旧疾复发。晕倒是编剧手里
 * 最便宜的"信息阀门"，第一次是意外，第二次起观众就在掐表等她倒：
 *   △她话说到一半，突然眼前一黑。
 *   △再睁眼已是三天后——秘密被拖过了一整集。
 *   "他说出名字的前一秒，倒在了雪地里。"
 *   He was about to name the mastermind — and collapsed.
 * 生理突发必须改变故事走向（醒来付出时间/代价），而不是免费把
 * 关键信息再扣押一集；观众能原谅一次昏厥，原谅不了每次都昏在
 * 关键词出口前的半秒。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - continuity-supervision-check：管"晕倒之后没有养伤/跳时交代
 *    就活蹦乱跳"（injury_vanish 连续性穿帮，晕倒作为伤势状态），
 *    本引擎管晕倒的时机——晕倒被当阀门反复掐断关键信息（密度病）；
 *  - comm-fail-crutch：阀门家族第一员（通讯阀门：没信号/没电），
 *    本引擎是第二员（生理阀门：晕倒/旧疾/心口疼），同构不同域；
 *  - cheat-rule-check：管外挂反噬代价（用完昏倒是兑付），本引擎
 *    管晕倒掐断剧情（无代价白嫖）；
 *  - conflict-escalation-check：只把晕倒计为冲突 L3 强度，不判
 *    时机是否恰逢关键信息；cliffhanger-score 只算钩子强度；
 *  - wound-recovery / location-ledger：跨集伤势与滞留连续性账本，
 *    不测同稿内晕倒的密度与时机；
 *  - emotional-aftermath-check：装晕假死归其 FAKE 域，本引擎遇到
 *    "装的/假晕"直接豁免（角色计谋，不是编剧阀门）。
 *
 * 判定：
 *  - 晕倒分两档（与 comm-fail-crutch 的 SELF/STATE 同构）：
 *    SELF 自带阻断语境（晕倒行同句出现"正要/刚要/话没说完/话音
 *    未落/说到一半"）——晕倒掐断了进行中的信息流；STATE 纯晕倒
 *    状态（晕倒/昏迷/眼前一黑），必须 ±2 行窗口内出现关键信息
 *    语境（真相/主谋/证据/地址/遗嘱…）才算阀门，纯体力不支放行；
 *  - 相邻 ≤2 行的晕倒表述视为同一事件（"晕倒"+"昏迷不醒"只计
 *    1 次）；跨场景头重置，各自算一次阀门使用；
 *  - 装晕豁免（装的/假晕/pretend to faint）——角色计谋不判；
 *  - 第 1 次豁免（一次昏厥是合法意外），第 2 次起每次 1 hit；
 *  - rescue（±2 行出现生理来路或时间代价）：救护车/送医/抢救/
 *    输液/醒来已是三天后/woke up days later——晕倒付了成本，
 *    不是免费扣押；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FaintOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（晕倒有生理来路或醒来付出时间代价） */
  rescued: boolean;
  reason: string;
}

export interface FaintOnCueResult {
  score: number;
  /** 晕倒阀门总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: FaintOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 晕倒分两档：SELF 自带阻断语境（同句"正要/话没说完"）；
   STATE 仅晕倒状态，必须 ±2 行内出现关键信息语境才算阀门。 */
const FAINT_ZH = /晕倒|昏倒|晕了过去|昏了过去|晕厥(?:过去)?|昏迷(?:过去|不醒)?|眼前一黑|栽(?:倒|在)(?:地|门|桌)|旧疾(?:发作|复发)|心口(?:一疼|一阵刺痛|一阵绞痛)|腹(?:中)?绞痛|低血糖发作/;

const CUTOFF_ZH = /正要|刚要|正准备|刚准备|话(?:还)?没(?:说完|说完)|话音未落|话说到一半|还没来得及(?:说|讲|开口)/;

const FAINT_EN = /\b(?:faint(?:s|ed|ing)|passed out|blacks? out|black(?:ed)? out|collaps(?:es|ed)|los(?:e|t|ing) consciousness|slumps? (?:to|over|forward)|crumpl(?:e|ed) (?:to|on) the floor)\b|\b(?:heart (?:pain|twinge)|a sharp pain (?:in|shot through)|old wound(?:s)? (?:acting up|flar(?:e|ing) (?:up)?))\b/i;

const CUTOFF_EN = /\b(?:was|were) (?:just )?about to (?:say|speak|tell|reveal|confess|answer|name)|mid[- ]sentence|before (?:she|he|they) could (?:say|finish|speak|tell)|halfway through (?:her|his|the) (?:sentence|words)|the words barely left/i;

/* 关键信息语境：晕倒必须卡在"关键信息待出"上才算阀门，纯体力不支放行 */
const KEYINFO_ZH = /真相|秘密|主谋|幕后(?:黑手|主使)|凶手|证据|地址|密码|遗嘱|配方|身世|录音|下落|行踪|关键/;

const KEYINFO_EN = /\b(?:the truth|the secret|the mastermind|the killer|the evidence|the address|the password|the will|the formula|the recording|the tape|the antidote|his identity|her identity|their identity|the name of)\b/i;

/* 装晕豁免：角色计谋不是编剧阀门 */
const FAKE_ZH = /装晕|假晕|假装(?:晕倒|昏迷|昏厥)|并没有(?:真)?(?:晕|昏)|根本没晕/;

const FAKE_EN = /\b(?:pretend(?:s|ed|ing)? to (?:faint|pass out|be unconscious)|faking (?:it|the faint|unconsciousness)|not really unconscious|wasn'?t really fainted)\b/i;

/* 救援：晕倒有生理来路或醒来付出时间代价——不是免费扣押 */
const RESCUE_ZH = /救护车|送(?:进|去|往|了)?医(?:院)?|抢救|急救|医生|大夫|护士|输液|住院|做了?(?:全面)?检查|醒来(?:时|后|已是|发现)|睁(?:开)?眼[^。！？\n]{0,8}(?:已经|已是)|三天后|再睁眼/;

const RESCUE_EN = /\b(?:ambulance|hospital|doctor|medic(?:al)? (?:team|care)|first aid|iv drip|emergency surgery|rushed to|wakes? up (?:three days later|in (?:a|the) hospital|to find)|when (?:she|he) (?:comes? to|wakes up|opens? (?:her|his) eyes)[^.]{0,24}(?:days later|already|it was))\b/i;

/**
 * 纯函数：检测"关键时刻就晕倒"式生理阀门当剧情拖延的套路。
 */
export function faintOnCue(draft: string): FaintOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const faintRe = zh ? FAINT_ZH : FAINT_EN;
  const cutoffRe = zh ? CUTOFF_ZH : CUTOFF_EN;
  const keyinfoRe = zh ? KEYINFO_ZH : KEYINFO_EN;
  const fakeRe = zh ? FAKE_ZH : FAKE_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: FaintOnCueHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevFaintLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevFaintLine = -10; return; }
    const m = line.match(faintRe);
    if (!m) return;
    /* 装晕是角色计谋，不作数 */
    if (fakeRe.test(line)) return;
    /* 相邻 2 行内的晕倒表述 = 同一事件（"晕倒"+"昏迷不醒"），不重复计 */
    if (i - prevFaintLine <= 2) { prevFaintLine = i; return; }
    prevFaintLine = i;

    /* 语境检查：SELF 自带阻断（正要/话没说完同句）；STATE 需 ±2 行内
       出现关键信息语境，纯体力不支放行 */
    const selfContained = cutoffRe.test(line);
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const win = rawLines.slice(lo, hi + 1).join('\n');
    if (!selfContained && !keyinfoRe.test(win)) return;

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
          ? '晕倒又在掐关键信息——生理突发被当免费阀门，观众已经开始掐表等她倒'
          : 'another collapse right before the reveal — fainting as a free valve, the audience is timing the fall',
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
      ? `${hitCount} 处"关键时刻就晕倒"式生理阀门（${n} 处未救）——真相说到一半眼前一黑、刚要交代主谋就昏迷，晕倒被当免费的信息阀门反复白嫖。`
      : `${hitCount} faint-on-cue beats (${n} unrescued) — collapsing exactly when the truth is due; fainting as a free information valve.`);
    advice.push(zh
      ? '晕倒不许当万能剧情阀门——每次都昏在关键词出口前的半秒，观众就开始掐表等她倒。要么给晕倒生理来路：旧疾铺垫过、医生诊断过、这具身体早就在超支，晕倒是债务到期而不是作者伸手；要么让晕倒付出真代价：再睁眼已是三天后，凶手换了藏身处、遗嘱被调了包、孩子高烧转了院——晕倒必须改变故事走向，而不只是把秘密再扣押一集。更好用的做法是把"晕"换成"咽"：她话说完才倒，信息出去了，责任回来了——听见真相的人从此背负它，比没人听见更有戏。装晕另算：角色主动装晕是计谋，不犯此条。'
      : 'Fainting is not a plot valve — she collapses half a second before the key word every time, and the audience starts timing the fall. Give the faint a medical pedigree: an established illness, a diagnosed condition, a body running on debt — the collapse is the bill coming due, not the author reaching in. Or make it cost something real: she wakes three days later to find the killer relocated, the will swapped, the child moved hospitals. A faint must change the story, not just park the secret for another episode. Better still, let her finish the sentence before she falls: the information gets out, and now everyone who heard it has to carry it — that weighs more than silence. Feigned fainting is a character scheme, not a writer\'s valve, and does not count here.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
