import { isSceneHeaderLine } from './script-scenes';
/**
 * 丑闻秒传遍检测（v2.122 块130，创作能力类）
 * ------------------------------------------------------------------
 * 病象：一条丑闻/秘密/照片刚泄露，下一拍就"一夜之间传遍全城"
 *   "短短半天人尽皆知"——传播零时间、零载体、零对抗，消息像装了
 *   火箭，全城的耳朵被焊在主角的剧情需要上：
 *     △照片被人拍了下来。
 *     △一夜之间，流言传遍了全城。
 *     △The photo was taken.
 *     △Overnight it was everywhere.
 * 一次快传播是节奏，次次靠传播开挂观众就看穿了：舆论不是点菜单
 * 是森林大火——火要有火种（谁放的话）、要有风（什么载体）、要
 * 有烧的过程（时间发酵）、还会有救火的人（公关对抗），一样都
 * 不能少。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - crowd-flip：管"群体态度秒翻转"（听的人信不信），本引擎管
 *    "消息传播秒到位"（知不知道）——前者管态度转换，本引擎管
 *    信息扩散，扩散在先态度在后，两阶段互补；
 *  - eavesdrop-dump：管"偷听白给"（单人获取渠道），本引擎管
 *    "全网扩散速度"（多人传播速度）——前者管一个人怎么知道，
 *    本引擎管一城人怎么都知道；
 *  - info-delivery：管"弹窗广播投喂"（作者把信息直接送到主角
 *    眼前），本引擎管"故事世界内传播速度"（信息在人物之间怎么
 *    长腿）——前者管获取层，本引擎管扩散层；
 *  - child-blurt：管"萌宝一句话拆封秘密"（泄露源头时刻），本
 *    引擎管"泄露之后的扩散速度"——前者管泄密瞬间，本引擎管
 *    泄密之后；
 *  - villain-overconfession：管"反派炫耀式自爆"（泄露源头），
 *    本引擎管"自爆后的传播速度"——前者管说漏嘴，本引擎管传开；
 *  - records-on-demand：管"查档秒中"（官方渠道白给），本引擎
 *    管民间舆论场白给——前者管档案柜，本引擎管茶馆街头；
 *  - phone-relay：管"电话单边复读传递"（点对点传递拐杖），本
 *    引擎管一对全城的广播式扩散——前者管两点一线，本引擎管
 *    满城风雨。
 *
 * "免费信息扩散"家族第二员（child-blurt 萌宝拆封 → rumor-speed
 * 消息火箭——两维互补覆盖信息白给扩散的密度病）。本引擎让位
 * childBlurt 入池（信息扩散族镜像兄弟退役：萌宝拆封泄密 vs 消息
 * 火箭传遍，同构"信息白给"，语义最近）。
 *
 * 判定（镜像 crowd-flip 单型双锚）：
 *  - 传播锚（传遍/传开/不胫而走/人尽皆知/满城风雨/上了热搜/刷屏
 *    /疯传 + 群体词×议论复合段 + spread like wildfire/went
 *    viral/everyone knew/the whole city…）与速度锚（一夜之间/
 *    短短半天/不到一小时/几个小时后/隔天/顷刻 + overnight/
 *    within hours/by noon…）±2行窗口共现 → 构成一次"丑闻秒
 *    传遍"事件；双条件缺一不可——纯传播无速度放行（慢传播是
 *    正常戏），纯速度无传播放行（"一夜白了头"不是传播）；
 *  - rescue：① 慢发酵锚（酝酿/发酵/捂了三年/过了半年/瞒了几月
 *    + brewed for/gradually spread/it took months…）——时间
 *    跨度真实，纸包不住火有过程；② 传播主体锚（有人偷拍/偷录/
 *    发帖/买通水军/营销号/内鬼/记者拍下 + someone leaked/paid
 *    trolls/paparazzi/caught on camera…）——传播有载体有主使，
 *    不是凭空起飞；③ 封口对抗锚（删帖/辟谣/公关/压热搜/律师函
 *    /封口费 + deleted the post/PR killed the story/cease-and-
 *    desist…）——有人在救火，传播有对抗；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（载体/
 *    对抗词常出现在事件行自身的舞台提示里，如"照片被人偷拍了
 *    下来"，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的传播表述合并为同一事件（跨场景头不合并）；事件
 *    end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次快传播是节奏），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface RumorSpeedHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有慢发酵/传播主体/封口对抗（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface RumorSpeedResult {
  score: number;
  /** 秒传遍事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: RumorSpeedHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 传播锚：消息扩散/舆论爆发行为信号（固定短语自带传播性 + 群体词×议论复合段） */
const SPREAD_ZH = /传遍|传开(?:了)?|传到(?:了)?[^。\n]{0,8}(?:耳中|耳里|耳朵里)|不胫而走|人尽皆知|尽人皆知|无人不知|无人不晓|全城皆知|满城风雨|沸沸扬扬|街知巷闻|炸开了?锅|流言四起|谣言四起|风言风语|走漏了?(?:风声|消息)|(?:所有人|全公司|全校|全族|全村|全镇|全县|全城|整个?(?:公司|学校|家族|村子|镇|圈子|行业|城|剧组|集团|县|市))[^。\n]{0,6}(?:都知道(?:了)?|传遍了?|炸了|轰动了?|议论(?:纷纷)?|沸腾)|丑闻|绯闻|(?:被|遭(?:到)?)曝光|曝光(?:了|出(?:来)?)|被爆(?:料|光|出)|爆料|上了?热搜|顶上热搜|热搜第一|头条|疯传|刷屏|传疯|传得到处都是|路人皆知/;

const SPREAD_EN = /\b(?:spread (?:through|across|like|fast)|got out|went viral|the (?:news|rumor|rumour|word|story|gossip|secret|scandal) (?:spread|got out|traveled|broke|leaked)|everyone (?:knew|heard|found out|was talking)|the whole (?:city|town|school|company|family|village|office) (?:knew|heard|found out|was talking|buzzed)|on everyone'?s (?:lips|mind)|tongues (?:were )?wagging|buzzing|gossip|scandal|rumor|rumour|leaked|exposed|headline|trending|blew up online|shared (?:everywhere|like crazy)|posted everywhere)\b/i;

/* 速度锚：短时间跨度信号（须与传播锚共现才成事件） */
const SPEED_ZH = /一夜之间|一夕之间|短短[^。\n]{0,6}(?:小时|天|日|夜|分钟)|不到[^。\n]{0,6}(?:小时|天|日|夜|分钟)|几个小时(?:之?后)?|半天(?:之内|不到)?|当天下午?|当天晚上?|隔天|顷刻(?:之间)?|眨眼(?:之间)?|分分钟|火速|光速|闪电般|快得(?:惊人|吓人|离谱)|不到半日|速度(?:之快|快得)/;

const SPEED_EN = /\b(?:overnight|within (?:hours|minutes|days)|by (?:morning|noon|nightfall|sundown)|in no time|in a heartbeat|like wildfire|same (?:day|night)|by the next (?:day|morning)|before sundown|within the hour|faster than (?:the|a|any)|in hours)\b/i;

/* rescue A：慢发酵锚——时间跨度真实（跳过锚行） */
const TIME_ZH = /发酵|酝酿|慢慢传开|逐渐传开|渐渐传开|过了[^。\n]{0,6}(?:个月?|年)|半年后|几年后|多年以后|瞒了[^。\n]{0,6}(?:个月?|年)|捂了[^。\n]{0,6}(?:个月?|年)|一直没人知道|深埋(?:了)?[^。\n]{0,6}(?:个月?|年)/;

const TIME_EN = /\b(?:fermented|brewed for|gradually spread|slowly spread|months later|years later|took (?:months|years)|kept (?:secret|quiet) for|no one knew for)\b/i;

/* rescue B：传播主体锚——传播有载体有主使（跳过锚行） */
const AGENT_ZH = /有人(?:故意|恶意|暗中|蓄意)?散布|有人(?:故意|恶意|暗中|蓄意)?散播|故意放出|放出了?消息|买通|水军|营销号|发了?帖|转发|偷拍|偷录|拍下|录下|流出|泄露|知情人透露|知情人士|内部人(?:员)?|内鬼|记者|狗仔|媒体|发到(?:群里|网上)|发(?:到)?朋友圈|挂到网上|发上网|拍到了?视频|录到了?音频/;

const AGENT_EN = /\b(?:someone (?:spread|leaked|posted|sent|filmed|recorded)|deliberately (?:spread|leaked|posted)|paid (?:posters|trolls)|marketing accounts|tabloid|paparazzi|journalist|reporter|the media|leaked (?:the )?(?:photo|photos|video|recording|pictures)|posted (?:it|the video|the photo) online|shared it online|insider|mole|someone filmed|caught on (?:camera|video)|recorded (?:it|the conversation))\b/i;

/* rescue C：封口对抗锚——有人在救火（跳过锚行） */
const FIGHT_ZH = /辟谣|澄清|公关|删帖|撤(?:下)?热搜|压(?:下)?热搜|压了(?:下去|下来)|律师函|控评|封口|摆平|封锁消息|悄悄压|压下去/;

const FIGHT_EN = /\b(?:denied (?:it|the rumor)|debunk\w*|clarif\w*|PR (?:team|campaign|firm)|publicist|deleted? (?:the )?post|kill(?:ed)? the story|take(?:n)? down the (?:post|story)|cease[- ]and[- ]desist|lawyer(?:'s)? letter|hush money|swept (?:it )?under|covered it up|suppressed (?:the )?(?:story|news))\b/i;

/**
 * 纯函数：检测"丑闻秒传遍"的舆论扩散零成本密度病。
 */
export function rumorSpeed(draft: string): RumorSpeedResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const spreadRe = zh ? SPREAD_ZH : SPREAD_EN;
  const speedRe = zh ? SPEED_ZH : SPEED_EN;
  const timeRe = zh ? TIME_ZH : TIME_EN;
  const agentRe = zh ? AGENT_ZH : AGENT_EN;
  const fightRe = zh ? FIGHT_ZH : FIGHT_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasS: boolean[] = new Array(rawLines.length).fill(false);
  const hasT: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasS[i] = spreadRe.test(line);
    hasT[i] = speedRe.test(line);
  });

  /* pass2：传播行与 ±2 行内的速度锚配对成事件（相邻 ≤2 行传播行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasS[i]) return;
    const m = raw.match(spreadRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的传播表述合并为同一事件（跨场景头不合并）；
           合并时以新传播行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasT[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯传播无速度不构成事件（慢传播放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（慢发酵/传播主体/封口对抗；全窗口扫描——
     AGENT/FIGHT 词常出现在事件行自身的舞台提示里，如"照片被人
     偷拍了下来""周家连夜删帖"，排除锚行会漏检 rescue，固化坑⑧） */
  const hits: RumorSpeedHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次快传播是节奏） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = timeRe.test(win) || agentRe.test(win) || fightRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"丑闻秒传遍"——消息像装了火箭，一转眼人尽皆知，传播零时间零载体零对抗，把全城的耳朵当主角的外挂，丑闻成了召之即来的舆论核弹'
        : 'rumor rocket again - the news is everywhere overnight with zero time, zero carrier and zero pushback, wiring every ear in town to the protagonist like a loudspeaker and turning scandal into an on-call nuke',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"丑闻秒传遍"密度病（共 ${hitCount} 次传播事件，首次已豁免）`
      : `Detected ${unrescuedCount} rumor-rocket hits (out of ${hitCount} total spread events, first occurrence exempted)`);
    advice.push(zh
      ? '消息不是光速是腿跑的——给传播挣来：要么写出载体与主使（有人偷拍了视频/营销号收钱带节奏/内鬼放料），要么写出时间发酵（半年才慢慢传开/捂了三年纸包不住火），要么写出对抗（当事人连夜删帖/公关压热搜/发律师函）；更狠的写法是传走样——传到第三个人耳朵里版本已经离谱，埋谣言反噬的种子'
      : 'News travels on legs, not rockets - earn the spread: show the carrier and the mover (someone filmed it, a paid troll farm fanned it, an insider leaked it), show the slow burn (half a year before it crept out, three years sealed until the paper could not wrap the fire), or show the pushback (posts deleted overnight, PR killing the story, lawyer letters flying); better still, let it distort - by the third retelling the story is unrecognizable, seeding the backlash');
  }

  return {
    score,
    hitCount,
    unrescuedCount,
    hits,
    issues,
    advice,
  };
}
