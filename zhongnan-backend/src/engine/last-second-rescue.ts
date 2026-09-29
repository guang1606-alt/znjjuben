import { isSceneHeaderLine } from './script-scenes';
/**
 * 千钧一发来救 / 救兵天降检测（v2.129 块137，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角被逼到绝路——刀架在脖子、枪顶着太阳穴、被逼到天台边缘、
 *   被打手团团围住——下一秒门被踹开，救兵恰好赶到：
 *     △打手把小舟逼到天台边缘，刀已经架上脖子。
 *     △门被踹开，老陈带人冲进来，一把把小舟拉开。
 *     小舟（喘着气）：你怎么来了？
 *     老陈：路过。
 *   一次最后一秒获救是高光，第三次观众就看穿：绝境是假的，反正
 *   总有人踩着点来。危机的戏剧价值在于"可能没人来"——主角自己
 *   挣扎、付代价、做选择，救援才是挣来的；零铺垫、零求救、零代价
 *   的天降救兵，等于把生死关头当等待救援的过场，紧张感被提前剧透。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - help-on-demand：管"主角主动求助→对方无代价应允"（日常事务的
 *    免费人力），本引擎管"来不及/没有求助→救兵天降于生死危机"
 *    （绝境中的免费武力）——前者有求助动作，后者只有绝境；
 *  - walk-in-timing：管"说曹操曹操到"的登场时机巧合（日常语境，
 *    不要求危机），本引擎要求濒败绝境 + 救兵解围动作双条件；
 *  - instant-escape：管"被绑者自己零成本脱身"（绳/铐/锁秒失效），
 *    本引擎管"外人来救"——一个自救白给，一个被救白给；
 *  - plot-armor：管主角在物理控制下的生死免疫（结果层：枪口下不死），
 *    本引擎管救兵降临的时机与代价（事件层密度病）；
 *  - rescue-romance：管"救险→心动认定"（爱情开关），本引擎不管
 *    心动，只管救援本身是否被铺垫/求救/代价挣来；
 *  - causal-logic-check：管泛巧合/机械降神（单点巧合），本引擎管
 *    同型"最后一秒救兵"反复出现的密度病。
 *
 * 判定：
 *  - 绝境锚（刀架脖子/枪顶太阳穴/被逼到绝路/团团围住/命悬一线 +
 *    knife at throat/held at gunpoint/cornered/surrounded/about to
 *    die…）与救兵锚（门被踹开/冲进来/及时赶到/一把拉开/挡在身前/
 *    kicked the door down/burst in/arrived just in time/pulled her
 *    away/reinforcements…）±2 行同场景共现 → 构成一次"救兵天降"
 *    事件；双条件缺一不可——纯绝境陈述放行（危机铺垫本身是戏），
 *    纯救场无绝境放行（日常搭救不归本引擎）；
 *  - rescue：①铺垫锚（一直跟着/暗中保护/早有埋伏/按约定赶来/
 *    had been following/backup was called/was waiting outside）——
 *    救兵有来路，天降是伏笔回收；②求救锚（打电话报警/按下报警器/
 *    喊救命/called for help/pressed the alarm）——救援是自己挣来的；
 *    ③代价锚（替挡一刀/中枪/倒在血泊/took the bullet/got shot/
 *    wounded）——救援是拿命换的；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的绝境行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次千钧一发是类型片高光），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface LastSecondRescueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（铺垫/求救/代价，救兵不是白来的） */
  rescued: boolean;
  reason: string;
}

export interface LastSecondRescueResult {
  score: number;
  hitCount: number;
  unrescuedCount: number;
  hits: LastSecondRescueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 绝境锚：主角被逼到生死关头 */
const PERIL_ZH = /(?:五花大绑|绑(?:在|到)(?:椅子|柱子|床)|被绑|刀架(?:在)?(?:[一-鿿]{1,3})?的?(?:脖子|脖颈)|枪(?:顶|抵)(?:在|着)?(?:[一-鿿]{1,3})?的?(?:头|额头|太阳穴|后背)|枪口下|刀下|被逼(?:到|入)(?:绝境|死角|绝路|墙角)|走投无路|无路可退|退无可退|命悬一线|千钧一发|生死一线|即将(?:坠|掉|摔)(?:落|下|下去)|悬(?:在|于)(?:悬崖|楼|窗|半空)边缘|陷入火海|被火(?:包围|困住)|团团围住|被(?:人群|打手|保镖|黑衣人|敌人)(?:团团)?围住|堵(?:在|死)(?:巷子|角落|仓库)|绝境|垂死|奄奄一息|只剩(?:最后)?一(?:颗子弹|招|口气)|危在旦夕)/;

const PERIL_EN = /\b(?:tied up|bound (?:to|in|with)|gun(?:point)? to (?:his|her|my|the) (?:head|temple|back)|knife (?:is )?at (?:his|her|my|the) throat|held at gunpoint|held a knife to|cornered|trapped|no way out|back against the wall|backed into a corner|about to (?:die|fall|drop)|cliff edge|edge of the roof|surrounded(?: by (?:men|guards|enemies))?|outnumbered|out of (?:options|ammo|bullets)|last bullet|on the brink of death|life flashed before|dangling from|hanging off the)\b/i;

/* 救兵锚：最后一秒有人出现解围 */
const RESCUE_ZH = /(?:门(?:被|给)?(?:踹|撞|踢)开|踹开(?:了)?(?:门|大门)|破门而入|冲(?:了?)(?:进|入|进来)|及时(?:赶到|出现)|(?:一把|伸手|猛地)(?:将|把)?(?:他|她|我|你)(?:拉开|拽开|拉回|拽回|推开)|挡(?:在|到)(?:他|她|我|你)?(?:身前|前面|跟前)|扑(?:过|上)去(?:护|挡|救)|(?:从天而降|神兵天降)|(?:救兵|援兵|援军)(?:赶到|来了|到了)|(?:赶|冲)来(?:相救|支援|解围|救人)|救下(?:了)?(?:他|她|我|你|众人)?|出手相救|挺身(?:而出|相护)|护住(?:了)?(?:他|她|我|你))/;

const RESCUE_EN = /\b(?:kicked (?:down|in) the door|the door (?:is|was|gets|got) kicked (?:down|open)|door bursts? open|bursts? in(?:to the room)?|rushes? in|storms? in|arriv(?:e|es|ed) just in time|got there just in time|came to the rescue|came out of nowhere|stepped in (?:just )?in time|pulled (?:him|her|me) (?:away|back|to safety)|shoved (?:him|her|me) (?:away|aside)|shielded (?:him|her|me)|took the bullet|blocked the (?:knife|blow|shot)|reinforcements (?:arrive|arrives|arrived)|backup (?:arrives?|arrived)|saved (?:him|her|me) (?:just )?in time|dived to save)\b/i;

/* rescue A：铺垫锚——救兵有来路（跟踪/埋伏/约定/定位） */
const PREP_ZH = /(?:一直(?:在)?(?:跟着|跟踪|尾随)|暗中(?:跟着|保护|监视)|早(?:就|有)(?:埋伏|安排|准备|约定)|按(?:约定|计划|信号)(?:赶来|行动)|守(?:在)?(?:门外|附近|外面)|留了(?:一手|后手)|他(?:早|就)(?:料到|知道会)|定位(?:器|追踪)|监听(?:器|设备))/;

const PREP_EN = /\b(?:had been following(?: him| her)?|been tailing him|kept watch(?: outside| nearby)|was waiting outside|as planned|per the signal|backup was (?:already )?called|had a tracker|planted a gps|knew this would happen|was staking out|lay in wait)\b/i;

/* rescue B：求救锚——救援是自己挣来的（报警/呼救/信号） */
const CALL_ZH = /(?:打电话(?:报警|求助|叫人|求救)|报了警|按(?:下|动)了?(?:报警器|警铃|求救按钮)|悄悄(?:发|按下)了?(?:求救|定位|报警器)|喊(?:救命|来人)|拨通了(?:110|警察|救援)|发出求救|触发(?:了)?(?:警报|定位))/;

const CALL_EN = /\b(?:called (?:911|for help|backup|the police)|pressed the alarm|sent an sos|texted for help|triggered the alarm|cried for help|screamed for help|set off the alarm)\b/i;

/* rescue C：代价锚——救援是拿命换的（受伤/拼命/牺牲） */
const COST_ZH = /(?:替(?:他|她|我)?挡(?:了)?一?(?:刀|枪|棍|剑)|中(?:了)?(?:弹|枪|刀)|身中|挨了一?(?:刀|枪|棍)|流(?:了)?血|鲜血|倒(?:在|下)(?:血泊|地)|拼命(?:缠住|拦住|抵抗)|牺牲|硬扛|伤口|骨折|住进(?:医院|重症))/;

const COST_EN = /\b(?:took the bullet|took the knife|got shot|was stabbed|blocked it with (?:his|her) (?:arm|body)|blood (?:soaked|ran)|fought (?:off|through) (?:them|the men)|wounded(?: in (?:the )?(?:arm|leg|shoulder))?|sacrificed himself|took the blow)\b/i;

/**
 * 纯函数：检测"绝境中救兵最后一秒天降"的免费武力密度病。
 */
export function lastSecondRescue(draft: string): LastSecondRescueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const perilRe = zh ? PERIL_ZH : PERIL_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;
  const prepRe = zh ? PREP_ZH : PREP_EN;
  const callRe = zh ? CALL_ZH : CALL_EN;
  const costRe = zh ? COST_ZH : COST_EN;

  /* 场景索引（rescue 全窗口扫描时跨场景头不取信） */
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

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasP: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasP[i] = perilRe.test(line);
    hasR[i] = rescueRe.test(line);
  });

  /* pass2：绝境行与 ±2 行内的救兵动作配对成事件（相邻 ≤2 行绝境合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasP[i]) return;
    const m = raw.match(perilRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的绝境合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasR[j],
    );
    if (win.length === 0) return; /* 无救兵动作不构成事件（未被解救的绝境放行） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（铺垫/求救/代价；同场景全窗口 ±2 行） */
  const hits: LastSecondRescueHit[] = [];
  let hitCount = 0;
  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次千钧一发是类型片高光） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (sceneOf[j] !== sceneOf[ev.end]) continue; /* 跨场景头不取信 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = prepRe.test(win) || callRe.test(win) || costRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"救兵天降"——刚被逼到绝路，救兵就踹门而入，没有铺垫、没有求救、没有代价，生死关头成了等救援的过场'
        : 'last-second rescue again - the hero is cornered at death\'s door and help kicks the door down with no setup, no distress call and no price paid',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"救兵天降"式绝境解围（${n} 处未救）——救兵总在最后一秒无因赶到，绝境紧张感被提前剧透。`
      : `${hitCount} last-second-rescue beats (${n} unrescued) - help keeps arriving at the final second with no setup, no call for help and no cost, draining the peril of tension.`);
    advice.push(zh
      ? '危机的戏剧价值在于"可能没人来"。给每一次天降救兵补一道来路，三选其一：①铺垫——救援者早就在场（他这集一直在暗处跟着她，之前咖啡馆窗口那个戴鸭舌帽的背影就是他），救兵是埋了四十分钟的伏笔回收；②求救——让主角自己挣来救援（她被绑前把定位发了出去、谈判时悄悄按下报警器），救援到来前先让观众看到她争取过；③代价——救兵不是无伤到场（替她挡了一刀、硬扛住三个打手、用自己换她出去），解围越险，救人者越要付费。更高级的写法是"救兵来晚一步"或"救兵也陷入绝境"：门踹开时刀已经落下，或者老陈自己也被按住——主角必须在绝境里完成最后一击，救兵只负责收尾，高光才属于主角。'
      : 'Peril only works when the audience believes help might not come. Give every rescue a pedigree, one of three: (1) setup - the rescuer was already there (the capped figure outside the cafe forty minutes ago was him), so the rescue is a planted payoff; (2) distress - the hero earns the rescue (she sent her location before being bound, triggered the alarm during the negotiation), so we see her fight for it first; (3) cost - the rescuer does not arrive unscathed (takes the knife, holds off three men, trades himself for her); the closer the call, the more the rescuer must pay. Better still, let help arrive too late or fall into the same trap: when the door bursts open the blade has already fallen, or old Chen is pinned too - the hero must land the final blow in the peril itself, and the cavalry only mops up. The climax then belongs to the hero.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
