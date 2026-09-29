import { isSceneHeaderLine } from './script-scenes';
/**
 * 吵架秒和好 / 无反思和解检测（v2.117 块125，创作能力类）
 * ------------------------------------------------------------------
 * 病象：男女主这一场还拍桌子摔门、冷战赌气，同场几行之内就
 *   "算了，都过去了"——
 *     周莹：你凭什么替我做主！
 *     沈磊（摔门）：我不跟你吵！
 *     周莹（追出去）：沈磊！
 *     沈磊（停步）：……算了，不吵了。
 *     MARK: I'm done with this!
 *     LILY: Mark, wait!
 *     MARK (stops): ...fine. We're good.
 * 第一次吵架-和好是冲突余波，病在它被当成万能和解阀：
 *  1) 和好没有反思——只摔门走人又回来，跳过了"我为什么生气"、
 *     "她为什么委屈"的内心过场，戏靠和解续气；
 *  2) 和好不增信息——第二遍第三遍还是同一句"算了"，台词零
 *     新信息，人物不长记性只长脾气；
 *  3) 和好替代行动——观众以为他要反思了，结果只是又和好一遍，
 *     把戏剧张力用一句话掏空。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - cheap-forgiveness：管"被伤害→秒原谅"（重伤前提下，受害者
 *    单方原谅），本引擎管"吵架→秒和"（无重伤前提，双方和好）；
 *  - apology-loop：管加害方反复道歉≥3次无赎罪（过度道歉），本
 *    引擎管吵架秒和（跳过道歉）——互为正反面；
 *  - empty-vow：管复仇宣言空转（"我要让他付出代价"），本引擎
 *    管吵架和解空转（"算了，和好了"）——结构镜像、情感指向相反；
 *  - empty-threat：管当面威胁空转（"我要让你后悔"），本引擎管
 *    当面和解空转（"算了，不吵了"）——不重叠；
 *  - emotional-aftermath：管强情绪事件后的情绪余波（秒清零），
 *    本引擎管冲突事件的和解节奏（秒和好）——前者管情绪层，本
 *    引擎管关系层。
 *
 * "冲突解决"家族：apology-loop（过度道歉）与本引擎（跳过道歉）
 * 互为正反面——一个过度道歉一个跳过道歉，都是冲突解决不当的
 * 密度病。本引擎让位 apology-loop 入池（镜像兄弟退役）。
 *
 * 判定（镜像 rescue-romance 单型双锚）：
 *  - 吵架锚（吵架/大吵一架/闹翻/翻脸/冷战/摔门/拍桌子/破口大骂
 *    + had a fight/blew up/slammed the door/stormed out/cold
 *    shoulder…）与和好锚（和好/算了都过去了/翻篇/不怪你了/
 *    原谅你了/既往不咎 + made up/reconciled/water under the
 *    bridge/patched things up…）±2行窗口共现 → 构成一次"吵架
 *    秒和"事件；双条件缺一不可——纯吵架无和好放行（吵架本身
 *    是戏），纯和好无吵架放行（正常和解）；
 *  - rescue：① 真诚道歉锚（对不起/抱歉/我错了/sorry/请原谅
 *    + 具体赎罪行动）——和好有来路，道歉是反思的产物不是和解
 *    的开关；② 时间跨度锚（三天后/一周后/三天两头 + a week
 *    later/days passed）——和好有时间，情感磨化或现实变迁；
 *    ③ 第三方调解锚（劝和/调解/撮合/和事佬 + talked them
 *    through/mediated）——和好有外力，不是自己想通而是被劝通；
 *  - 场景头行不参与任何词表匹配；①③rescue 扫描跳过吵架行与和好
 *    行自身，②扫描全窗口（时间跨度常在场景头或旁白）；
 *  - 相邻 ≤2 行的和好表述合并为同一事件（跨场景头不合并）；
 *    事件 end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次吵架-和好是类型惯例），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FightReconcileHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有真诚道歉/时间跨度/第三方调解（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface FightReconcileResult {
  score: number;
  /** 吵架秒和事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: FightReconcileHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 吵架锚：日常冲突信号（不收原则性伤害——归 cheap-forgiveness） */
const FIGHT_ZH = /吵架了?|大吵一?架|大吵了一?架|闹翻了?|翻脸了?|翻脸不认人|闹了?别扭|闹别扭|冷战|拌嘴|争执了?|吵翻了?|吵了?一?架|怄气|赌气|摔门|甩门|夺门而出|摔门而去|甩手走人|拍桌子|砸东西|掀桌子|破口大骂|指着鼻子骂|怒目而视|怒气冲冲|气冲冲地走|甩了?门|砸了?门|拍了?桌子|掀了?桌子|砰的?一声|摔了?门|踢了?门|气呼呼|气鼓鼓|气冲冲/;

const FIGHT_EN = /\b(?:had (?:a|an) (?:fight|argument|row|blowup|blow-up)|had a blowout|fought|argued|got into (?:a|an) (?:fight|argument|row)|blew up (?:at|on|in front of) (?:her|him|me|you|each other)|blew up|screamed (?:at|on)|yelled (?:at|on)|shouted (?:at|on)|slammed (?:the|a) door|stormed out|stormed off|walked out (?:on|of)|walked off|gave (?:her|him|you|me) the cold shoulder|cold shoulder|silent treatment|not speaking|not talking|fell out|had (?:a|an)? falling out|throwdown|throw-down|blew (?:her|his|my|your) top|lost (?:her|his|my|your) temper|lost it|hit the roof|hit the ceiling|went (?:ballistic|berserk|crazy|mad))\b/i;

/* 和好锚：吵架后秒级和解信号 */
const RECONCILE_ZH = /和好了?|和好如初|和好了?吧|没事了|别生气了|别气了|原谅你了?|不计较了?|翻篇了?|翻篇了?吧|不怪你了?|不怪你(?:了)?|不恨你(?:了)?|既往不(?:咎|究)|我不计较(?:了)?|我不追究(?:了)?|都过去了|算了[，,。]?都过去了|我们和好吧|别吵了|别闹了|别吵了?吧|别闹了?吧|别气了?吧|和好吧|算了[，,。]?不吵了|算了[，,。]?不闹了|翻过去(?:了)?|揭过去(?:了)?|重新开始|重归于好|言归于好|握手言和|冰释前嫌|烟消云散|一笔勾销/;

const RECONCILE_EN = /\b(?:made up|made it up|made (?:our|things) right|reconciled|patched things up|patched (?:it|things) up|worked it out|sorted it out|made peace|buried the hatchet|called a truce|kissed and made up|water under the bridge|moved past it|moved on|let it go|let bygones be bygones|it'?s all in the past|all forgiven|all forgotten|friends again|cool(?:ed)? down|calm(?:ed)? down|made amends|made (?:it|things) up to (?:her|him|me|you|each other)|forgave (?:him|her|you|me)|forgiven|no hard feelings|all good now|we'?re (?:good|fine|okay|alright) now|patched (?:it|things) up)\b/i;

/* rescue A：真诚道歉锚——和好有来路，道歉是反思产物（跳过锚行） */
const APOLOGY_ZH = /对不起|抱歉|赔不是|赔罪|我错了|是我[的错]?不对|我有罪|原谅我|怪我|我的锅|都怪我|千错万错[^\n。！？]{0,8}我的错|郑重(?:道歉|歉意)|正式道歉|深深(?:道歉|歉意)|真诚(?:道歉|歉意)|我(?:的)?错|都怪我不好|是我不好|我太冲动|我不该|我后悔|我不对/;

const APOLOGY_EN = /\b(?:i'?m sorry|i am sorry|i apologize|please forgive me|i was wrong|i owe you an apology|my fault|my mistake|i regret what i did|forgive me|sincerely sorry|truly sorry|formally apologize|i shouldn'?t have|i (?:was )?wrong|i (?:was )?out of line|i (?:was )?an idiot|i overreacted)\b/i;

/* rescue B：时间跨度锚——和好有时间（全窗口扫描，常在场景头/旁白） */
const TIME_ZH = /(?:[一二两三四五六七八九十\d]+(?:天|日|周|礼拜|个月|月|年)(?:后|以后|过去|之后)|多年(?:后|以后|过去|之后)|数年(?:后|以后)|几年(?:后|以后)|三天两头|过了?[^。！？\n]{0,4}(?:天|日|周|礼拜|个月|月|年))/;

const TIME_EN = /\b(?:a (?:day|week|month|year)|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) (?:days?|weeks?|months?|years?)|several (?:days|weeks|months|years))\s+(?:later|after|passed|passed by)\b/i;

/* rescue C：第三方调解锚——和好有外力（跳过锚行） */
const MEDIATOR_ZH = /劝和|调解|撮合|和事佬|说和|说合|打圆场|圆场|劝架|拉架|劝了?[^。！？\n]{0,4}(?:和|架)|拉了?[^。！？\n]{0,4}架|第三方|中间人|老娘舅|居委会|调解员|劝了?(?:几句|一番|一通)|说和了?|撮合了?|调解了?|劝和了?|打圆场了?|说合了?/;

const MEDIATOR_EN = /\b(?:talked (?:them|us|him|her) (?:through|out of|into)|mediat\w*|brokered (?:peace|a truce)|intervened|intervention|peacemaker|go-between|third party|stepped in (?:to|and|between)|sorted (?:it|them) out|brought (?:them|us) (?:back together|to the table)|broke the ice|cleared the air)\b/i;

/**
 * 纯函数：检测"吵架秒和好"的无反思和解密度病。
 */
export function fightReconcileCrutch(draft: string): FightReconcileResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const fightRe = zh ? FIGHT_ZH : FIGHT_EN;
  const reconcileRe = zh ? RECONCILE_ZH : RECONCILE_EN;
  const apologyRe = zh ? APOLOGY_ZH : APOLOGY_EN;
  const timeRe = zh ? TIME_ZH : TIME_EN;
  const mediatorRe = zh ? MEDIATOR_ZH : MEDIATOR_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasF: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasF[i] = fightRe.test(line);
    hasR[i] = reconcileRe.test(line);
  });

  /* pass2：和好行与 ±2 行内的吵架锚配对成事件（相邻 ≤2 行和好行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasR[i]) return;
    const m = raw.match(reconcileRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的和好表述合并为同一事件（跨场景头不合并）；
           合并时以新和好行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasF[j],
    );
    if (win.length === 0) return; /* 纯和好无吵架不构成事件（正常和解放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（真诚道歉/时间跨度/第三方调解；①③跳过锚行，②全窗口） */
  const hits: FightReconcileHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次吵架-和好是类型惯例） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R3 用，跳过锚行 */
    const timeLines: string[] = []; /* R2 用，全窗口 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      timeLines.push(rawLines[j]); /* TIME 全窗口（时间跨度常在场景头/旁白） */
      if (hasF[j] || hasR[j]) continue; /* R1/R3 跳过吵架行与和好行自身 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const timeWin = timeLines.join('\n');
    const rescued = apologyRe.test(win) || timeRe.test(timeWin) || mediatorRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"吵架秒和"——摔门走人又回头，跳过反思与道歉，把和解当万能缓冲阀，白给的和好撑不起冲突的分量'
        : 'instant reconcile again - slamming doors then walking back in, skipping reflection and apology, reconciliation-as-valve cheapens every fight it ends',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"吵架秒和"式无反思和解（${n} 处未救）——吵架后跳过反思与道歉直接和好，和解像水龙头一拧就开。`
      : `${hitCount} instant-reconcile beats (${n} unrescued) - fights end with no reflection or apology, reconciliation handed out like tap water.`);
    advice.push(zh
      ? '和解的戏剧价值在于挣得。给每一次和好补一道来路：要么有真诚道歉且点出具体错在哪（"我不该替你做主，这是你的私事"），要么有时间跨度让情感磨化（三天两头不说话，再见面时火气已冷），要么有第三方劝和（老娘舅上门撮合）。更好用的做法是让和好带犹豫——沈磊追出去又站了三秒才说"算了"，这个犹豫比和好本身更让观众记住"他其实也没想通"。如果剧情就是需要速和搭档，让第三方质疑一句"你们刚吵完就好成这样？"——替观众把疑问说出口，白给就变成了有意识的妥协。'
      : 'Reconciliation is only dramatic when it is earned. Give every makeup a pedigree: a real apology that names the specific wrong ("I shouldn\'t have made that call for you - it\'s your life"), a time gap that lets the feeling cool (three days of silence before they\'re in the same room again), or a mediator (auntie comes by to broker peace). Better still, let the makeup hesitate - Shen Lei chases out but stands there three seconds before muttering "fine"; that hesitation tells the audience more than the reconciliation itself. If the plot needs fast peace, have a third character ask "You\'re fine already?" - voicing the doubt turns a freebie into a conscious concession.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
