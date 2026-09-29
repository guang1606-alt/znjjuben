import { isSceneHeaderLine } from './script-scenes';
/**
 * 假倒计时 / 期限橡皮筋阀门检测（v2.100 块108，创作能力类）
 * ------------------------------------------------------------------
 * 病象："限你三天之内还清，还不上就收房子！""天亮之前找不到女儿
 *   就撕票！"——期限和代价喊得震天响，随后角色不紧不慢地吃饭、
 *   吵架、谈情、翻旧账，没有一个人因为时钟在走而改变动作。到了
 *   点，惩罚不发生；或者期限毫无成本地宽限三天。倒计时成了吓唬
 *   观众的空喇叭：观众第一次替主角着急，第三次就看穿——那个钟
 *   是画上去的，从来不走。
 * mystery-craft 早已立规："时限若不影响角色决策就是假倒计时"，
 * 本引擎就是这条规矩的检测器。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - timeline-consistency-check：管倒计时的数字算术（"只剩三天"
 *    越等越多、昼夜矛盾、时间跳注水），本引擎管倒计时的赌注兑付
 *    （期限绑定的代价有没有压出行为变形、到点有没有收账）；
 *  - emptyThreat：管台词层狠话不兑付（"你给我等着"），本引擎管
 *    "期限+后果"的结构化赌注不兑付——空放狠话家族最近的兄弟；
 *  - emptyVow：管承诺义务宣告不兑付，本引擎管时间后果宣告不兑付；
 *  - alwaysLate：管抵达时机的巧合密度（一来就刚走），本引擎管
 *    宣布的时间压力根本不产生赶时间行为；
 *  - helpOnDemand：管免费救援凭空兜底，本引擎管期限常被"再等等"
 *    零成本化解（宽限本身必须是一场戏）；
 *  - weaponJam/evidenceBlank：管物件阀门，本引擎管赌注阀门。
 *
 * 判定：
 *  - 期限锚（只剩/限你/倒计时/最后期限/X天之内/天亮之前/婚礼
 *    以前/毒发 + 72 hours left/by sunrise/until midnight/
 *    deadline…）与后果锚（找不到/还不上/赶不到/凑不齐/就撕票/
 *    收房/离婚/开除/停药/ foreclose/she dies/or else…）±2 行
 *    窗口共现 → 构成一次"立赌"事件；双条件缺一不可——纯日程
 *    陈述放行（"三天之内他核对完账目"），纯狠话无期限放行
 *    （"找不到钱他就报警！"归 emptyThreat）；
 *  - rescue：①赶时间锚（连夜/争分夺秒/猛踩油门/踩着点赶到 +
 *    raced the clock/all night/floored it/just in time）——时钟
 *    压出了行为变形，时间压力是真的；②兑付锚（晚了一步/期限到
 *    了真收房/被扫地出门 + time ran out/foreclosed，或延期是
 *    挣来的：跪求宽限/谈妥延期/交易换来 + negotiated an
 *    extension/grace period/bought time）——到点收账，或宽限
 *    本身付出筹码；
 *  - rescue 扫描包含期限/后果行自身与事件 ±2 行，仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配（"内景 倒计时演播大厅 日"）；
 *  - 相邻 ≤2 行的期限表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次倒计时是悬念基本功），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DeadlineStretchHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有赶时间/兑付锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface DeadlineStretchResult {
  score: number;
  /** 立赌事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: DeadlineStretchHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 期限锚：明确的硬性截止时间（裸"三天后/婚礼"不收，必须带时限结构） */
const LIMIT_ZH =
  /只剩(?:下|有)?[^。！？\n]{0,6}(?:个)?(?:时辰|小时|钟头|分钟|天|日|夜|月|年)/.source
  + '|' + /还(?:有|剩)[^。！？\n]{0,6}(?:个)?(?:时辰|小时|钟头|分钟|天|日|夜|月|年)/.source
  + '|' + /限(?:你|他|她|你们|我们)?[^。！？\n]{0,8}(?:之内|以内|之前)/.source
  + '|' + /倒计时|最后期限/.source
  + '|' + /[一二两三四五六七八九十\d]+(?:个)?(?:时辰|小时|钟头|分钟|天|日|夜|月)(?:之?内|以内)/.source
  + '|' + /(?:天亮|日落|天黑|太阳(?:升起|落山)|午夜|子时|婚礼|开庭|行刑|签约)(?:之?前|以前)/.source
  + '|' + /毒发(?:之?前|时)?/.source;

const LIMIT_ZH_RE = new RegExp(LIMIT_ZH);

const LIMIT_EN =
  /\b(?:only\s+)?(?:\d+|twenty-four|seventy-two|forty-eight)\s+(?:hours?|hrs?|minutes?|mins?|days?|nights?|months?)\s+(?:left|to go|remaining)\b/.source
  + '|' + /\b(?:you have|you'?ve got)\s+(?:\d+|twenty-four|seventy-two|forty-eight)\s+(?:hours?|hrs?|minutes?|days?|nights?)\b/.source
  + '|' + /\bby\s+(?:sunrise|sunset|dawn|dusk|midnight|noon|tomorrow|the\s+wedding|the\s+hearing|the\s+trial)\b/.source
  + '|' + /\buntil\s+(?:sunrise|sunset|dawn|dusk|midnight|noon|tomorrow)\b/.source
  + '|' + /\bbefore\s+(?:sunrise|sunset|dawn|dusk|midnight|the\s+wedding|the\s+hearing|the\s+trial)\b/.source
  + '|' + /\b(?:countdown|deadline|final notice|ticking clock)\b/.source;

const LIMIT_EN_RE = new RegExp(LIMIT_EN, 'i');

/* 后果锚：期限绑定的明确代价（纯能力困难"找不到"需与期限共现才成立） */
const STAKES_ZH =
  /找不到|拿不出|交不出|交不齐|还不上|还不清|赶不到|赶不回|回不来|不回来|查不出|办不成|办不到|凑不齐|凑不够|见不到|救不回|救不了|来不及|停药/.source
  + '|' + /就(?:等死|没命|收房|离婚|开除|报警|抓人|撕票|动手|完了|死定了|滚蛋|换人|取消|查封|起诉|收尸)/.source
  + '|' + /等着收尸|人财两空|血本无归|扫地出门|逐出家门|强制执行|一分(?:钱)?不给/.source
  + '|' + /否则[^。！？\n]{0,10}(?:死|完|抓|收|离|开除|封)/.source;

const STAKES_ZH_RE = new RegExp(STAKES_ZH);

const STAKES_EN =
  /\bif\s+(?:we|you|he|she|they)\s+(?:can'?t|cannot|don'?t|doesn'?t|fail\s+to)\s+[^.\n!?]{0,46}?\b(?:find|get|deliver|pay|reach|return|show\s*up|make\s+it|prove|raise|come\s+up\s+with|sign)\b/.source
  + '|' + /\bor\s+(?:else\b|she\s+dies|he\s+dies|we\s+lose|they\s+foreclose|he\s+kills\s+her)/.source
  + '|' + /\b(?:he\s+kills\s+her|she\s+dies|he\s+dies|we\s+lose\s+everything|foreclos(?:e|ure)|evict(?:ion|ed)?|she'?s\s+a\s+dead|we'?re\s+(?:dead|finished|doomed|ruined))\b/.source
  + '|' + /\b(?:calls?\s+off\s+the\s+wedding|tears?\s+up\s+the\s+contract|press\s+charges)\b/.source;

const STAKES_EN_RE = new RegExp(STAKES_EN, 'i');

/* rescue A：赶时间锚——时钟压出行为变形（连夜/狂奔/踩着点 + race 词汇） */
const RACE_ZH = /连夜|通宵|彻夜|一夜没睡|一整夜|不眠不休|争分夺秒|分秒必争|一路狂奔|狂奔|猛踩油门|踩死油门|飙车|马不停蹄|日夜兼程|快马加鞭|饭(?:也|都)没(?:顾|吃)|冒着?(?:大雨|暴雨)|连闯[^。！？\n]{0,3}红灯|赶(?:最后|最早)(?:一班)?(?:飞机|航班|高铁)|掐着点|卡着点|准点(?:赶到|送达|交上)|踩着?点(?:赶到|到|送达|交上)|一路小跑|转身就往[^。！？\n]{0,3}跑/;

const RACE_EN = /\b(?:raced (?:against )?(?:the clock|time)|worked (?:all|through the) night|stayed up all night|without sleep|sped through|floored it|ran every red light|first flight out|red-eye|around the clock|desperate (?:dash|race)|sprinted|drove like a madman|cut it close|made it just in time|just in time|with seconds to spare)\b/i;

/* rescue B：兑付锚——到点收账（惩罚真发生），或宽限是挣来的（谈判/筹码/跪求） */
const HONOR_ZH =
  /晚了一步|迟了一步|期限(?:到了|已至|届满)|时间(?:到|已到)/.source
  + '|' + /真的(?:动手|撕票|收房|开除|离婚|报警|抓人|查封|取消|封了)|说到做到/.source
  + '|' + /被(?:扫地出门|逐出家门|没收|查封|收走|开除)|强制执行/.source
  + '|' + /(?:争取|换来|谈妥|求来|跪求|苦求|卖了?[^。！？\n]{0,4}换来)[^。！？\n]{0,10}(?:宽限|延期|改期|多给|续了?|缓)/.source
  + '|' + /同意(?:宽限|延期|改期)|宽限[^。！？\n]{0,4}(?:一天|几日|三天|两天)/.source
  + '|' + /提前(?:一天|两天|几个时辰)?(?:还清|交上|送到|赶到|完成|把钱)/.source;

const HONOR_ZH_RE = new RegExp(HONOR_ZH);

const HONOR_EN =
  /\btime\s+(?:ran\s+out|was\s+up)\b|\bthe\s+deadline\s+passed\b/.source
  + '|' + /\btoo\s+late\b|\bmissed\s+it\s+by\b/.source
  + '|' + /\b(?:he|she)\s+(?:really\s+)?kept\s+(?:his|her)\s+word\b/.source
  + '|' + /\b(?:foreclosed|got\s+evicted|was\s+evicted)\b/.source
  + '|' + /\b(?:got|received|negotiated|granted)\s+(?:an?\s+)?extension\b|\bextension\s+was\s+(?:granted|negotiated)\b/.source
  + '|' + /\bbought\s+(?:more\s+)?time\b|\bgrace\s+period\b|\bpostponed\s+the\s+wedding\b|\brescheduled\b|\bpaid\s+off\s+(?:early|ahead\s+of\s+time|in\s+time)\b|\bmade\s+the\s+payment\s+just\s+in\s+time\b/.source;

const HONOR_EN_RE = new RegExp(HONOR_EN, 'i');


/**
 * 纯函数：检测"假倒计时/期限橡皮筋"密度病。
 */
export function deadlineStretch(draft: string): DeadlineStretchResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const limitRe = zh ? LIMIT_ZH_RE : LIMIT_EN_RE;
  const stakesRe = zh ? STAKES_ZH_RE : STAKES_EN_RE;
  const raceRe = zh ? RACE_ZH : RACE_EN;
  const honorRe = zh ? HONOR_ZH_RE : HONOR_EN_RE;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasLimit: boolean[] = new Array(rawLines.length).fill(false);
  const hasStakes: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasLimit[i] = limitRe.test(line);
    hasStakes[i] = stakesRe.test(line);
  });

  /* pass2：期限行成组（相邻 ≤2 行合并、跨场景头不合并），与 ±2 行内后果配对成事件 */
  interface Ev { start: number; end: number; anchorEnd: number; marker: string; }
  const groups: { start: number; end: number; marker: string }[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasLimit[i]) return;
    const m = raw.match(limitRe);
    const marker = (m?.[0] ?? '').replace(/^\s+/, '').slice(0, 28);
    const last = groups[groups.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的期限表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    groups.push({ start: i, end: i, marker });
  });

  const events: Ev[] = [];
  for (const g of groups) {
    const lo = Math.max(0, g.start - 2);
    const hi = Math.min(rawLines.length - 1, g.end + 2);
    const stakeIdx: number[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasStakes[j]) stakeIdx.push(j);
    }
    if (stakeIdx.length === 0) continue; /* 纯日程陈述放行（"三天之内核对完账目"不归本引擎） */
    events.push({
      start: Math.min(g.start, stakeIdx[0]),
      end: Math.max(g.end, stakeIdx[stakeIdx.length - 1]),
      anchorEnd: g.end,
      marker: g.marker,
    });
  }

  /* pass3：rescue 检测（赶时间/兑付两路；窗口含事件自身 ±2 行，仅跳过场景头行） */
  const hits: DeadlineStretchHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次倒计时是悬念基本功） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = raceRe.test(win) || honorRe.test(win);
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是假倒计时——"三天之内还不上就收房"喊完，角色照样吃饭吵架谈情，没人因为时钟在走而改动作；到点惩罚不发生，或毫无成本地宽限，倒计时成了吓唬观众的空喇叭'
        : 'fake deadline again - after "pay in 72 hours or we foreclose", nobody races and nothing is collected at the hour (or the deadline stretches for free); the clock never changes a single decision',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"假倒计时/期限橡皮筋"（${n} 处未救）——期限和代价喊得震天响，角色却不赶时间，到点惩罚不发生或零成本宽限。第一次观众替主角着急，第三次观众就看穿那个钟是画上去的。`
      : `${hitCount} fake-deadline beats (${n} unrescued) - the clock and its forfeit are announced at full volume, nobody races, and the hour passes with no collection (or a free extension). Once is suspense; by the third, the audience sees the clock is painted on.`);
    advice.push(zh
      ? '让那个钟真的走起来：①期限要压出决策变形——倒计时一出，角色的下一场戏就该不一样：放弃一单生意、牺牲一个人情、冒着雨连闯三个红灯、在借钱名单上划掉最后一个名字。观众不是听见"还剩三天"，而是看见这三天怎么把人逼成另一个样；②让代价可见地烧钱——每个侦查/筹钱动作都消耗可见时间（推门时天还亮，出来天已黑；说好三天，第二天就只剩两天），临近截止安排一次错误方向，把剩余时间彻底打光，最后用省下来的一条缝翻盘；③到点必须收账——要么惩罚真兑付（晚一步、撕票、收房、开除，让主角和观众都疼），要么宽限本身是一场戏：跪求来的、筹码换来的、交易续来的，对方为什么多给一天要有人物理由（债主也有求于他、反派在猫戏老鼠），白给的延期等于没有期限；④时钟要反复出声——剩余时间通过道具（沙漏、吊瓶、对方发来的时钟截图）和配角催促不断显形，观众随时知道还剩多少。最忌讳喊完"天亮之前找不到就撕票"，接下来三场戏全是吃饭翻旧账，然后天亮了大家集体失忆。真想保留一次"喊完即过"的期限，把它留给全稿唯一一次，并让紧接着的戏用一个动作证明钟在走。'
      : 'Make the clock actually tick: (1) The deadline must bend decisions - the very next scene after a countdown should look different: a deal abandoned, a favor burned, three red lights in the rain, the last name crossed off the borrowing list. The audience should not hear "72 hours" but watch those hours deform a person. (2) Burn time on screen - every move costs visible time (dawn when they enter, dark when they leave); send them down a wrong path near the hour that spends the last reserve, then turn it on a saved sliver. (3) Collect at the hour - either the forfeit really lands (too late, foreclosure, eviction, cancellation - hurt both character and audience), or the extension itself is a scene: begged, negotiated, traded for a chip, granted for a reason the giver has (the creditor needs him too; the villain toys with prey). A free extension cancels the deadline. (4) Keep the clock audible - hourglasses, IV drips, countdown screenshots, henchmen checking watches, so the time left is always known. The unforgivable version is "find her before sunrise or she dies" followed by three scenes of dinner and old grudges, then sunrise with collective amnesia. Save the single throwaway deadline for the whole script, and prove the clock is moving with one concrete action in the next scene.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
