import { isSceneHeaderLine } from './script-scenes';
/**
 * 反派拖刀 / 处决拖延检测（v2.130 块138，创作能力类）
 * ------------------------------------------------------------------
 * 病象：反派已完全控制局面——枪已上膛、刀已架好、人已被按跪捆缚、
 *   引爆器已在手里、账本证据已到手——下一锤本该落下（处决/揭穿/
 *   毁证/引爆），他却临场拖住：
 *     △枪顶着小舟的太阳穴。
 *     他：急什么。让我把话说完——你知道这五年我是怎么过的吗？
 *     △他的手机响了，他背过身去接。
 *     小舟悄悄磨着绳索……
 *   胜利宣言、接无关电话、"急什么，让他多活一会儿"、"先带下去
 *   关起来"、"明天再处理"、"看住他，我先走了"——处决拖成了
 *   独白剧，翻盘窗口是反派亲手留的。一次拖延是压迫感节拍，第三
 *   次观众就看穿：反派的枪里没有子弹，只有台词。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - deadline-stretch：管"倒计时赌注不兑付"（时钟层：期限喊得
 *    响、没人因时钟改变动作、到点惩罚不发生），本引擎管"处决执
 *    行中临场拖延"（行动层：单场内强势方已控局却主动拖住不落
 *    锤）——前者管时钟不走，本引擎管手不动刀；同为"威胁兑付
 *    白给"，互为镜像兄弟，本引擎让位入池；
 *  - empty-threat：管"狠话口嗨没下文"（威胁说完不执行），本引擎
 *    管"处决已在执行中却拖住"——前者管威胁放空，本引擎管执行
 *    拖延；
 *  - talk-down-crutch：管"强势方被三句话劝放下"（台词解压对峙），
 *    本引擎管"强势方自己拖住"（时间窗口白给）——一个被说动，
 *    一个自己拖；
 *  - villain-overconfession：管"反派炫耀式自爆"（信息白给），本
 *    引擎管"反派拖延处决"（时间白给）——胜利宣言只是拖延手段
 *    之一；
 *  - plot-armor-check：管"主角物理控制下不死"（结果层生死免疫），
 *    本引擎管"处决时机被拖"（事件层密度病）；
 *  - last-second-rescue：管救兵最后一秒无因赶到（该来不来），本
 *    引擎管反派最后一刻拖住不落锤（该落不落）——救援侧与行刑
 *    侧的镜像。
 *
 * 判定：
 *  - 控制锚（枪顶/上膛/刀架/按跪/五花大绑/团团围住/人质/引爆器/
 *    证据在手 + gun to head/knife at throat/tied up/hostage/
 *    detonator/proof in my hands…）与拖延锚（死个明白/让我把话
 *    说完/急什么/慢慢来/接电话/带下去/关起来/明天再/看住他/我先
 *    走 + any last words/no rush/let me tell you/take him away/
 *    lock him up/we'll deal with him tomorrow/answer the phone/
 *    watch him/i'll be back…）±2 行同场景共现 → 构成一次"反派
 *    拖刀"事件；双条件缺一不可——纯控制无拖延放行（处决本身是
 *    戏），纯拖延无控制放行（日常闲谈）；
 *  - rescue：①理由锚（问出口供/留个活口/请示/等头儿的话/当众/
 *    公开处决/等时机 + interrogation/keep him alive/waiting for
 *    orders/make an example…）——拖延有具体理由，处决是流程不
 *    是白给；②打断锚（枪响/爆炸/警笛/破门/变故/灯灭/刀落 +
 *    gunshot/explosion/sirens/kicked in/the blade fell…）——
 *    拖延刚起就被外力打断，窗口没被白用；③自救锚（磨绳/咬绳/
 *    摸刀/挣脱/扑/抢/血 + sawed at the rope/reached for/lunged/
 *    one hand free…）——拖延期间主角在自救行动，翻盘是自己挣
 *    的；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的控制行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次拖延是压迫感节拍——单场胜利宣言是名场
 *    面），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface VillainStallHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有理由/打断/自救（拖延不是白给的） */
  rescued: boolean;
  reason: string;
}

export interface VillainStallResult {
  score: number;
  hitCount: number;
  unrescuedCount: number;
  hits: VillainStallHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 控制锚：强势方已完全控制局面（枪/刀/绑/围/引爆器/证据在手） */
const CONTROL_ZH = /(?:枪(?:已)?(?:口|指|顶|抵|上膛)|上膛|扣住扳机|刀(?:已)?架|匕首(?:已)?(?:抵|贴)|利刃(?:已)?(?:抵|架)|按(?:住|倒)|押跪|五花大绑|绑(?:在|到|住)|被绑|团团围住|围住|包围|天罗地网|瓮中捉鳖|落网|被捕|被擒|束手就擒|人质|引爆器|引爆按钮|按(?:下|动)了?(?:引爆|按钮)|起爆|证据(?:已)?(?:在|到)手|账本(?:已)?(?:在|到)手|把柄(?:已)?(?:在|到)手|铁证|录音(?:已)?(?:在|到)手|视频(?:已)?(?:在|到)手)/;

const CONTROL_EN = /\b(?:gun (?:to|at|against|pressed (?:to|against|into))|gunpoint|pistol (?:pressed|aimed|pointed)|knife (?:is |was )?(?:at|against|pressed)|blade (?:at|against|pressed)|held (?:him|her|them|me) (?:at|down|captive|hostage)|pinned (?:him|her|them|me|down)|forced (?:him|her|them|me) to (?:his|her|their|my) knees|on (?:his|her|their) knees|tied (?:up|to)|bound (?:and gagged|with rope|to (?:a|the))|hostages?|detonator|finger on the trigger|pull(?:ed)? the trigger|press(?:ed)? the (?:button|trigger)|surrounded|noose|rope (?:around|tightened)|captured|taken captive|proof (?:is )?(?:in my hands|mine)|in my hands|the (?:ledger|recording|file|video|photo)s? (?:is|are) mine|leverage)\b/i;

/* 拖延锚：处决执行中临场拖住（宣言/事务/延后/离场四类） */
const STALL_ZH = /(?:死个明白|你可知|知道(?:我)?为什么|让我(?:告诉|讲)|听我(?:讲完|把话说完|说完)|讲个故事|说个故事|从那天起|这一切才(?:刚刚)?开始|好戏(?:才|还在)后头|慢慢(?:欣赏|享受|看|玩|来)|好好(?:欣赏|享受|看看)|享受(?:这|眼下|最后)|急什么|不急|来日方长|让(?:他|她|你)多活|让(?:他|她|你)再活|接(?:个)?电话|手机(?:响|来了)|电话(?:响|来了)|先接(?:个)?电话|吩咐(?:下去|手下|几句)|叫人(?:来|过来|进来)|把这(?:里|儿)(?:收拾|处理)(?:了|干净)|带(?:下去|走|回去|回牢|回房)|关(?:起来|进|进去)|押(?:回去|下去|走|回来)|收押|明天再|回头再|改天再|先(?:押|关|收|留|铐)着|交给[^\n]{0,6}处置|看住(?:他|她|他们|这人)|盯住(?:他|她|他们)|你(?:先)?(?:看|盯)着(?:他|她)|我先(?:走|撤|避)|先(?:走|撤)了)/;

const STALL_EN = /\b(?:any last words|any final words|enjoy(?:s|ed|ing)? (?:this|the show|your|these|it while)|savor|no rush|plenty of time|we have (?:time|all night)|all the time in the world|let me tell you|let me explain|hear (?:the|my) story|know why|do you know why|from that day|just getting started|the show (?:is just|has just)|take(?:s|ing)? (?:him|her|them) (?:away|downstairs|back|out)|lock(?:s|ed|ing)? (?:him|her|them) up|throw(?:s|ing)? (?:him|her|them) (?:in|into)|deal(?:s|t|ing)? with (?:him|her|them|this) (?:tomorrow|later)|handle(?:s|d)? this (?:later|tomorrow)|finish(?:es|ed|ing)? this (?:tomorrow|later)|until tomorrow|answer(?:s|ed|ing)? (?:the|my) phone|my phone (?:is ringing|rang)|watch(?:es|ed|ing)? (?:him|her|them)|keep(?:ing)? an eye on (?:him|her|them)|i(?:'ll| will) be back|leave (?:him|her|it|this) to me|keep(?:s|ing)? (?:him|her|them) (?:alive|for now))\b/i;

/* rescue A：理由锚——拖延有具体理由（审讯/活口/请示/仪式/时机） */
const REASON_ZH = /(?:问(?:出|他|她|我)(?:口供|下落|密码|位置|名单)|口供|逼问|审(?:问|他|她|一夜)|活口|留(?:个|她|他)?证人|送官|交给(?:警方|警察|衙门)|报官|请示|上报|等(?:头儿|老板|老大|上面)(?:的)?(?:话|指令|指示|吩咐|命令)|当众|让全(?:场|世界|公司|城)看|当着全|直播|公开处(?:刑|决)|祭(?:日|奠|拜)|仪式|等人(?:齐|到)|等(?:警卫|守卫|巡逻)(?:走|离开|换岗)|时机(?:一到|成熟)|撬开(?:他|她)(?:的)?嘴)/;

const REASON_EN = /\b(?:interrogat\w+|make (?:him|her) talk|need (?:him|her|them) alive|keep (?:him|her|them) alive|alive for (?:now|a while)|hand (?:him|her|them) (?:over|to)|turn (?:him|her|them) (?:over|in)|call (?:the boss|my boss|for orders)|wait(?:ing)? for (?:orders|instructions|his word|the boss)|when (?:everyone|the others|the rest) (?:arrive|get here|are here)|in front of (?:everyone|the board|the crowd|the whole)|make an example|livestream|live stream|the anniversary|the ritual|when the guards (?:leave|change|are gone)|the right moment|timing (?:is|was) right)\b/i;

/* rescue B：打断锚——拖延刚起就被外力打断（窗口没被白用） */
const INTERRUPT_ZH = /(?:枪响|一声枪响|爆炸|轰(?:的|然)?一声|警笛|警报(?:响|大作|声)|破门|踹(?:开)?门|撞开门|生变|变故|异动|灯(?:突然)?(?:灭|黑)了|刀(?:落|下)|绳(?:索)?(?:断|开)|玻璃碎|有人喊|喝止|住手)/;

const INTERRUPT_EN = /\b(?:gunshot|gun went off|a shot rang|explosion|blast|sirens?(?: wailed| blared| outside)?|alarm (?:went off|blared|sounded)|kicked (?:in|open)|door gave way|door (?:burst|swung) open|something (?:happened|moved|was wrong)|shouted|yelled|lights? (?:went out|flickered|out)|the blade (?:fell|came down)|rope snapped|glass shattered)\b/i;

/* rescue C：自救锚——拖延期间主角在自救行动（翻盘是自己挣的） */
const STRUGGLE_ZH = /(?:挣脱|挣扎|磨(?:绳|着绳|断)|咬(?:断|绳|他|她)|蹭断|摸(?:出|向|到)(?:刀|枪|钥匙|发卡|剪刀)|掏出(?:发卡|钥匙|刀|匕首)|抓起|抄起|砸(?:窗|门|碎)|扑(?:向|过去|上前)|抢(?:过|刀|枪)|踢(?:向|中|翻|开)|撞(?:向|开|翻)|翻(?:滚|窗)|血(?:顺着|流|泊)|忍痛|剧痛|割破|划破)/;

const STRUGGLE_EN = /\b(?:struggl\w+|worked (?:the|his|her) (?:rope|wrist|knot|loose)|sawed (?:at|through)|bit (?:down on|through) the rope|reached for (?:the|his|her|a)|grabbed (?:the|a)|smashed (?:the|a)|lunged|swiped at|kicked (?:at|the|him|her)|headbutt\w*|crawled|blood (?:ran|soaked|trickled)|bit (?:his|her) (?:hand|arm)|rolled (?:aside|over|away)|freed one hand|one hand free)\b/i;

/**
 * 纯函数：检测"处决执行中反派临场拖住不落锤"的时间窗口白给密度病。
 */
export function villainStall(draft: string): VillainStallResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const controlRe = zh ? CONTROL_ZH : CONTROL_EN;
  const stallRe = zh ? STALL_ZH : STALL_EN;
  const reasonRe = zh ? REASON_ZH : REASON_EN;
  const interruptRe = zh ? INTERRUPT_ZH : INTERRUPT_EN;
  const struggleRe = zh ? STRUGGLE_ZH : STRUGGLE_EN;

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
  const hasC: boolean[] = new Array(rawLines.length).fill(false);
  const hasS: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasC[i] = controlRe.test(line);
    hasS[i] = stallRe.test(line);
  });

  /* pass2：控制行与 ±2 行内的拖延动作配对成事件（相邻 ≤2 行控制合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasC[i]) return;
    const m = raw.match(controlRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的控制合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasS[j] && sceneOf[j] === sceneOf[i], /* 拖延行须与控制行同场景（跨场景头不计入事件边界） */
    );
    if (win.length === 0) return; /* 无拖延动作不构成事件（当场处决放行） */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（理由/打断/自救；同场景全窗口 ±2 行） */
  const hits: VillainStallHit[] = [];
  let hitCount = 0;
  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次拖延是压迫感节拍） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (sceneOf[j] !== sceneOf[ev.end]) continue; /* 跨场景头不取信 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = reasonRe.test(win) || interruptRe.test(win) || struggleRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"反派拖刀"——枪刀已控局却临场拖延，胜利宣言/接电话/带下去关起来，处决窗口白给主角翻盘'
        : 'villain stall again - the kill is already in hand yet the villain dawdles with a victory speech or a phone call, handing the hero a free window',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"反派拖刀"式处决拖延（${n} 处未化解）——控局后不落锤，靠宣言/接电话/明天再处理给主角留翻盘窗口，压迫感被提前剧透。`
      : `${hitCount} villain-stall beats (${n} unrescued) - the villain holds all the cards yet delays the kill with speeches, phone calls or "deal with him tomorrow", telegraphing the escape window.`);
    advice.push(zh
      ? '处决的戏剧价值在于"这一锤真的会落下"。给每一次拖刀补一道理由或代价，三选其一：①理由——拖延有具体用处（他需要先问出金库密码、要等头儿的指令、要在董事会上当众揭穿，拖是为了更大的图谋）；②打断——拖延刚起就被掐断（宣言说到一半警笛响起、电话还没接完正门已被踹开，窗口没来得及被白用）；③自救——拖延期间主角在拿命换时间（她磨着绳索手腕磨出血、他咬断绳子扑向引爆器，翻盘是自己挣的不是反派送的）。更高级的写法是"拖刀有账"：反派拖完这一下确实办成了事（拿到签名/逼出藏尸地点），而不是拖了个寂寞——处决慢一拍可以，但每一拍都要有戏。'
      : 'An execution only works when the audience believes the blade will really fall. Give every stall a purpose or a price, one of three: (1) reason - the delay serves a design (he needs the vault code first, is waiting for the boss\'s order, wants to expose her in front of the board); (2) interruption - the stall is cut short (sirens rise mid-speech, the door bursts open before the call ends), so the window is never wasted; (3) struggle - the hero buys every second with blood (sawing at the rope until her wrist bleeds, biting through it and lunging for the detonator), earning the reversal instead of being gifted it. Better still, make the stall pay: the villain actually accomplishes something in that beat (gets the signature, forces out the burial site) - the blade may hesitate, but every beat of hesitation must carry weight.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
