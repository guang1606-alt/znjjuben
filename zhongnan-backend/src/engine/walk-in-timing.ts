import { isSceneHeaderLine } from './script-scenes';
/**
 * 说曹操曹操到检测（v2.81 块89，创作能力类）
 * ------------------------------------------------------------------
 * 病象：人物刚被谈起就无铺垫登场——
 *   张伟：王律师怎么还没到？
 *   △门开了，王律师走了进来。
 *   DETECTIVE: Where is MARSH?
 *   MARSH walks in.
 * 谈论与登场之间没有召唤、没有预约、没有门铃敲门，登场全靠
 * 编剧的巧合而不是剧情的原因。一次是惯用节奏，次次如此就是
 * 情节便利贴：世界围着台词转，人物成了随叫随到的NPC。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - evidence-chain-check（airdropped_witness）：管翻盘时刻的
 *    人证铺垫公平性（关键时刻证人突然到场作证），本引擎管全
 *    域"谈论→登场"的 timing 巧合（登场者不限人证/翻盘场合）；
 *  - causal-logic-check：管泛巧合词面（恰好/碰巧/正巧）与机械
 *    降神，本引擎做结构检测（人名共现+登场词+窗口）；跨名巧合
 *    （谈起A、B登场）不属本引擎；
 *  - eavesdrop-dump：管登场后偷听并倾泻机密，本引擎只管登场
 *    时机本身；
 *  - instant-deduction / records-on-demand：其他免费情报结构。
 *
 * 判定：
 *  - 零词典人名源：pass1 扫全片说话人标签（zh 冒号前缀 1-8 字，
 *    en 全大写标签），构成"已知名"集合；名字集为空直接满分；
 *  - TALK 锚：台词行取冒号后内容（防说话人自我污染），叙述行
 *    须含谈论动词（说/提起/提到/talking about…）——纯动作
 *    叙述提到人名不算谈；含铺垫词（去请/叫来/on his way/
 *    already told）→ 结构性豁免（后续登场合法，不计数）；
 *  - ENTER 锚（台词行取标签段含括号，叙述行取整行）：推门/
 *    闯进来/现身/walked in/bursts through the door…，且锚内
 *    含 pending 谈论段中的某个名字，距离 ≤3 行 → 事件；
 *  - 连续谈论行（间隔 ≤2 行）合并为同段（人名并集，锚点后移）；
 *    场景头重置 pending（跨场景不追）；
 *  - 首次豁免（单次巧合惯用法合法），第 2 次起每次 1 hit；
 *  - rescue（窗口内有登场物理前因）：门铃/敲门/通报/如约/
 *    doorbell/knock/announced——登场有迹可循；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WalkInTimingHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（门铃/敲门/通报/如约等物理前因） */
  rescued: boolean;
  reason: string;
}

export interface WalkInTimingResult {
  score: number;
  /** 巧合登场总次数（含豁免的第 1 次，不含铺垫豁免） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: WalkInTimingHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ---------- 说话人标签提取（零词典人名源） ---------- */

/* zh：行首冒号前缀 1-8 字（不含分隔符与括号），支持全/半角括号注记 */
const ZH_TAG_RE = /^(?!△)([^\s：:（(]{1,8})(?:[（(][^）)]*[）)])?\s*[：:]/;
const ZH_TAG_BLACKLIST = /旁白|画外音|字幕|手机|电话|众|大家|全场|所有人|群演|VO|OS|CUT/i;

/* en：全大写标签（允许 O'BRIEN / JEAN-PAUL 连字与至多 4 词），括号注记不取 */
const EN_TAG_RE = /^([A-Z]+(?:['’\-][A-Z]+)*(?:\s+[A-Z]+(?:['’\-][A-Z]+)*){0,3})(?:\s*\([^)]*\))?\s*:/;
const EN_TAG_BLACKLIST = /\b(?:CUT|FADE|INTERCUT|DISSOLVE|CONTINUOUS|CONT'?D|VO|V\.O\.|O\.S\.|OS|NOTE|SUPER|TITLE|CAPTION|INT|EXT)\b/;

/* ---------- ENTER 锚：登场动作（台词行取标签段、叙述行取整行） ---------- */

const ENTER_ZH = /推(?:开)?(?:了)?(?:大)?门|门被(?:推开|撞开|踹开|踢开)|闯了?进?来|走了?进?来|跑了?进?来|冲了?进?来|大步(?:走了)?(?:进|来)|出现在(?:门口|众人面前)|门口(?:站着|出现|传来)|从门外|掀(?:开)?(?:了)?(?:门)?帘|门(?:一?开|开了)|现身|进门/;

const ENTER_EN = /\b(?:walk(?:ed|s)?\s+in|came\s+in|comes?\s+in|burst(?:s)?\s+(?:in|through(?:\s+the)?\s+doors?)|rush(?:ed|es)?\s+in|storm(?:ed|s)?\s+in|enter(?:ed|s)|appear(?:ed|s)?\s+(?:at|in)\s+(?:the\s+)?door|standing\s+(?:at|in)\s+(?:the\s+)?door(?:way)?|the\s+doors?\s+(?:opened|swung|burst)|steps?\s+(?:in|inside|through)|lets?\s+(?:himself|herself)\s+in|push(?:ed|es)?\s+(?:the\s+)?door(?:\s+open)?|swings?\s+open)\b/i;

/* ---------- TALK 锚：叙述行须带谈论动词（台词行仅看内容含名） ---------- */

const TALK_ZH = /说到|说起|谈到|谈起|提到|提起|议论|念叨|聊起|打听|问起|谈论|说(?:道)?/;

const TALK_EN = /\b(?:says?|said|telling|tells?|tell|speaks?|spoke|speaking|talks?|talked|talking|mention(?:s|ed|ing)?|brings? up|brought up|asks?|asked|discuss(?:es|ed|ing)?|was just saying)\b/;

/* ---------- ARRANGE 铺垫：结构性豁免（登场有召唤/在途前因） ---------- */

const ARRANGE_ZH = /去[^，。；\n]{0,6}(?:叫|请|接|喊|传)|把[^，。；\n]{0,6}(?:叫|请|接|喊)(?:来|过来|到)|传[^，。；\n]{0,4}(?:来|上来)|(?:马上|就|快|这就)(?:到|来|回来)|在路上|快到了|快来了|已(?:经)?(?:通知|约|请|叫|打发)|(?:他|她)(?:在|就在)(?:门外|楼里|隔壁|外面|路上)|如约|正在赶(?:来|过来)?|电话里(?:说)?(?:让|叫|请)|去电(?:话)?(?:叫|请|通知)/;

const ARRANGE_EN = /\b(?:go\s+(?:get|call|fetch|bring)|fetch\s+(?:him|her|them)|(?:he|she|they)'?s?\s+on\s+(?:his\s+|her\s+|their\s+)?way|almost\s+here|already\s+(?:told|called|invited|summoned|sent\s+for)|waiting\s+outside|as\s+arranged|by\s+appointment|on\s+(?:his|her|their)\s+way|summon(?:ed|s)?|sent\s+(?:for|word))\b/i;

/* ---------- RESCUE：窗口内有登场物理前因 ---------- */

const RESCUE_ZH = /门铃|敲门|按(?:了)?门铃|预约|如约|通报|传(?:话|报)|请进|进来吧|前台(?:通报|引)|秘书(?:引|带)|已在(?:路上|途中)|先到了|早到了|守在门口/;

const RESCUE_EN = /\b(?:doorbell|knock(?:s|ed|ing)?|by\s+appointment|as\s+scheduled|announc(?:es|ed|ing)|buzz(?:ed)?\s*(?:in)?|front\s+desk|show(?:n)?\s+in|escorted|already\s+(?:here|waiting|outside)|was\s+(?:already|just)\s+outside|waiting\s+at\s+the\s+door)\b/i;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const titleCase = (s: string): string =>
  s.toLowerCase().replace(/(^|[\s'’\-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

/**
 * 纯函数：检测"谈论某人→3 行内该人无铺垫登场"的 timing 巧合病。
 */
export function walkInTiming(draft: string): WalkInTimingResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

  /* pass1：全片说话人标签 → 已知名集合 */
  const names: string[] = [];
  rawLines.forEach((raw) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    const m = zh ? line.match(ZH_TAG_RE) : line.match(EN_TAG_RE);
    if (!m) return;
    let name = (m[1] ?? '').trim();
    if (!zh) name = name.replace(/\s*CONT'?D$/i, '').trim();
    if (name.length < 2) return;
    if (zh ? ZH_TAG_BLACKLIST.test(name) : EN_TAG_BLACKLIST.test(name)) return;
    if (!names.includes(name)) names.push(name);
  });
  if (names.length === 0) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }

  /* en 名字双形式匹配（UPPERCASE 动作行 + TitleCase 正文提及） */
  const enNameRes = new Map<string, RegExp>();
  if (!zh) {
    names.forEach((n) => {
      enNameRes.set(n, new RegExp(`\\b(?:${escapeRe(n)}|${escapeRe(titleCase(n))})\\b`));
    });
  }
  const collectNames = (t: string): string[] => {
    if (zh) return names.filter((n) => t.includes(n));
    return names.filter((n) => enNameRes.get(n)!.test(t));
  };

  const enterRe = zh ? ENTER_ZH : ENTER_EN;
  const talkRe = zh ? TALK_ZH : TALK_EN;
  const arrangeRe = zh ? ARRANGE_ZH : ARRANGE_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: WalkInTimingHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let pendingTalkLine = -10;
  let pendingNames: Set<string> = new Set();
  let setupMark = false;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
      pendingTalkLine = -10;
      pendingNames = new Set();
      setupMark = false;
      return;
    }

    /* 分离标签与内容：台词行锚=标签段（含括号），叙述行锚=整行 */
    const tm = zh ? line.match(ZH_TAG_RE) : line.match(EN_TAG_RE);
    const isDialogue = !!tm;
    const anchor = tm ? tm[0] : line;
    const content = tm ? line.slice(tm[0].length) : line;

    /* ENTER 锚：台词行查标签段（"他推门进来抓起文件"不被台词引用误判），叙述行查整行 */
    if (enterRe.test(anchor)) {
      const inAnchor = collectNames(anchor);
      if (
        pendingTalkLine >= 0 &&
        i - pendingTalkLine <= 3 &&
        inAnchor.some((n) => pendingNames.has(n))
      ) {
        if (!setupMark) {
          hitCount += 1;
          if (hitCount >= 2) {
            const win = rawLines
              .slice(Math.max(0, pendingTalkLine), i + 1)
              .filter((l) => !isSceneHeaderLine(l.trim()))
              .join('\n');
            hits.push({
              line: i + 1,
              sceneIndex: Math.max(0, sceneIdx),
              sceneHeader: header,
              snippet: anchor.slice(0, 30),
              marker: (anchor.match(enterRe)?.[0] ?? '').slice(0, 28),
              rescued: rescueRe.test(win),
              reason: zh
                ? '人物刚被谈起就凭空出现——谈论与登场之间没有召唤、没有预约、没有门铃，登场全靠编剧的巧合而非剧情的原因'
                : 'character walks in right after being mentioned — no summons, no appointment, no doorbell between the talk and the arrival; the entrance runs on writer coincidence, not story cause',
            });
          }
        }
        pendingTalkLine = -10;
        pendingNames = new Set();
        setupMark = false;
      }
      return; /* 登场行不作谈论锚（防止登场接登场误连） */
    }

    /* TALK 锚：内容含已知名；叙述行须带谈论动词（纯动作叙述提及不算谈） */
    const inContent = collectNames(content);
    if (inContent.length === 0) return;
    if (!isDialogue && !talkRe.test(content)) return;

    /* 铺垫豁免：有召唤/在途前因 → 后续登场合法，不计数 */
    if (arrangeRe.test(content)) {
      pendingTalkLine = -10;
      pendingNames = new Set();
      setupMark = true;
      return;
    }

    /* 连续谈论行（间隔 ≤2 行）合并为同段：人名并集、锚点后移 */
    if (pendingTalkLine >= 0 && i - pendingTalkLine <= 2) {
      inContent.forEach((n) => pendingNames.add(n));
      pendingTalkLine = i;
    } else {
      pendingNames = new Set(inContent);
      pendingTalkLine = i;
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"说曹操曹操到"式登场（${n} 处未救）——人物刚被谈起就凭空出现，登场全靠编剧的巧合而非剧情的原因。`
      : `${hitCount} walk-in timing beats (${n} unrescued) — characters materialize right after being mentioned; entrances run on writer coincidence, not story cause.`);
    advice.push(zh
      ? '"说曹操曹操到"一次是巧合，三次是懒惰。让每一次登场都有迹可循：要么提前一拍写召唤——"把王律师请来"之后才是推门，要么给物理前奏——门铃、敲门、前台通报、走廊脚步声，要么给登场者动机——他本来就在门外、他听到了谈话、他按约定时间赴约。实在要保留"刚说到就到"的节奏，就把它写成有意识的设计：谈话内容刻意引向这个人，门开的瞬间对话直接转向他，让巧合变成"所有人都知道他要来"的必然。'
      : 'One speak-of-the-devil entrance is luck; three is laziness. Give every arrival a trail: summon them a beat early ("go get the lawyer" precedes the push of the door), plant a physical cue (doorbell, knock, front-desk announcement, footsteps in the hall), or give the arrival a motive — they were already outside, they overheard the conversation, they came at the appointed hour. If you must keep the just-mentioned-just-arrived rhythm, make it deliberate: steer the conversation toward that person, and when the door opens, pivot the scene to them, so the coincidence reads as "everyone knew he was coming."');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
