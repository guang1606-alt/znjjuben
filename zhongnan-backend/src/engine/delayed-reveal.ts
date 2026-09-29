import { isSceneHeaderLine } from './script-scenes';
/**
 * 信息容器延迟开启检测（v2.83 块91，创作能力类）
 * ------------------------------------------------------------------
 * 病象：信息明明已经在主角手里，却用"不敢拆/不敢听"人为拖延释放，
 * 把容器当悬念阀门反复拧：
 *   妈妈的遗书，他三个月没敢拆。
 *   录音笔就放在枕边，她一直不敢听。
 *   等以后再说吧，U盘先收起来。
 * 拆不拆可以犹豫一场，但不能反复犹豫。观众等的是信封里的雷，
 * 不是看角色围着信封打转——同一封信犹豫超过一次，观众比角色
 * 先失去耐心。真正的悬念是"拆开后付出什么代价"，而不是"到底
 * 什么时候才拆"。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - comm-fail-crutch：管外部通讯阻断（没信号/打不通），本引擎
 *    管信息已在手、主动不敢开（心理拖延）；
 *  - prop-ledger：管信物归属权的跨集连续性，本引擎管信息释放
 *    节奏的人为拖延；
 *  - misunderstanding-drag：管误会不说开的对话层拖延，本引擎管
 *    实体容器（遗书/录音/U盘）的开启拖延；
 *  - flashback-crutch：管闪回滥用的结构病，本引擎管开启前的
 *    悬念阀门。
 *
 * 判定：
 *  - 容器词（遗书/那封信/信封/录音笔/磁带/U盘/日记/照片/证据/
 *    报告… + EN letter/envelope/diary/tape/recording/flash
 *    drive/report…）× 延迟表态（没敢拆/不敢看/还没打开/等以后
 *    再/留着以后… + EN can't bring myself to/haven't dared/
 *    not ready to…）同句或 ±1 行共现 → 构成一次 deferred 事件；
 *  - 容器共现是硬条件：裸"不敢看"（不敢看他的眼睛）无容器在场
 *    一律放行，裸容器（只是拿着信）无延迟表态也放行；
 *  - 相邻 ≤2 行的两处延迟表态合并为同一次事件（同一拍犹豫）；
 *    事件状态跨场景不重置（容器没拆，拖延就在继续）；
 *  - rescue：事件 ±2 行内出现 OPEN 动作（拆开/打开了/按下播放 +
 *    opened/pressed play）——当场拆开，信息释放，阀门关闭；OPEN
 *    不在延迟表态行本身上检测（防"不敢看"自动救援）；
 *  - 第 1 次豁免（犹豫一场是人之常情），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DelayedRevealHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 事件 ±2 行内是否出现当场开启动作（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface DelayedRevealResult {
  score: number;
  /** deferred 事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: DelayedRevealHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 容器词：可被"攥在手里不打开"的信息载体 */
const CONTAINER_ZH = /遗书|(?:这|那|一|哪|[一二三四五六七八九十两])\s*封\s*信|信封|录音笔|录音带|录音机|磁带|录像带|录像|U盘|优盘|光盘|日记(?:本)?|相册|照片|证据|报告|病历|化验单/;

const CONTAINER_EN = /\b(?:letter|envelope|diary|journal|tape|recording|video|photos?|flash ?drive|usb (?:drive|stick)|package|parcel|report)\b/i;

/* 延迟表态：不敢开/还没开/等以后再说 */
const DEFER_ZH = /没敢|不敢(?:拆|开|看|听|读|翻|碰|动)|还没(?:拆|打开|听|看|读|翻)(?:过)?|没(?:拆|打开|看|听|读)过|等[^，。！？\n]{0,6}再|找个时间再|改天再|回头再|回去再|留着(?:以后|等|给)|先收起来|以后再说|留到(?:以后|最后)|压箱底|藏起来/;

const DEFER_EN = /\b(?:can'?t bring (?:myself|himself|herself) to|h(?:ave|as)n'?t dared|not ready to|(?:i'?m|she'?s|he'?s) not ready|can'?t bear to|h(?:ave|as)n'?t had the (?:nerve|courage|heart)|h(?:ave|as)n'?t (?:opened|read|watched|listened to|touched)|never (?:opened|read|watched)|h(?:ave|as)n'?t yet (?:been )?(?:opened|read|watched)|when i'?m ready|until i'?m ready|some ?day|leave it (?:unopened|sealed)|keeps? it sealed|save it for (?:later|when)|not going to (?:open|read|watch|listen))\b/i;

/* OPEN 动作：当场拆开/播放——信息释放，阀门关闭 */
const OPEN_ZH = /拆开了|拆了|打开了|开了封|按下了?播放|播放了|翻开了|看完了|看了|听完了|听了|读完了|读了/;

const OPEN_EN = /\b(?:opened|unsealed|tore (?:it|the) open|ripped (?:it|the) open|pressed play|hit play|played the|finished reading|read it|read the|read every)\b/i;

/**
 * 纯函数：检测"信息已在手却用不敢拆人为拖延释放"的悬念阀门密度病。
 */
export function delayedReveal(draft: string): DelayedRevealResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const containerRe = zh ? CONTAINER_ZH : CONTAINER_EN;
  const deferRe = zh ? DEFER_ZH : DEFER_EN;
  const openRe = zh ? OPEN_ZH : OPEN_EN;

  /* 逐行分类：场景头行不参与匹配（防"报告厅"误当容器） */
  const isScene = rawLines.map((l) => isSceneHeaderLine(l.trim()));
  const hasC = rawLines.map((l, i) => !isScene[i] && containerRe.test(l));
  const hasD = rawLines.map((l, i) => !isScene[i] && deferRe.test(l));
  const hasO = rawLines.map((l, i) => !isScene[i] && openRe.test(l));

  /* deferred 事件：延迟表态行 ±1 行内（含同句）有容器在场 */
  type Ev = { start: number; end: number };
  const events: Ev[] = [];
  rawLines.forEach((_, i) => {
    if (!hasD[i]) return;
    const cNear = hasC[i] || (i > 0 && hasC[i - 1]) || (i < rawLines.length - 1 && hasC[i + 1]);
    if (!cNear) return;
    const last = events[events.length - 1];
    const between = last ? rawLines.slice(last.end + 1, i) : [];
    if (last && i - last.end <= 2 && !between.some((l) => isSceneHeaderLine(l.trim()))) {
      last.end = i; /* 相邻 ≤2 行的犹豫合并为同一拍（跨场景头算新一拍） */
    } else {
      events.push({ start: i, end: i });
    }
  });

  /* rescue：事件 ±2 行内的 OPEN 动作（跳过延迟表态行本身） */
  const sceneIdxOf: number[] = [];
  const headerOf: string[] = [];
  let sceneIdx = -1;
  let header = '';
  rawLines.forEach((l, i) => {
    if (isScene[i]) { sceneIdx += 1; header = l.trim(); }
    sceneIdxOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  const hits: DelayedRevealHit[] = [];
  events.forEach((ev) => {
    let rescued = false;
    for (let j = Math.max(0, ev.start - 2); j <= Math.min(rawLines.length - 1, ev.end + 2); j += 1) {
      if (hasD[j]) continue; /* OPEN 不在延迟表态行上检测，防"不敢看"自动救援 */
      if (hasO[j]) { rescued = true; break; }
    }
    const hitIdx = events.indexOf(ev) + 1;
    if (hitIdx >= 2) {
      const anchor = rawLines[ev.start].trim();
      const m = anchor.match(deferRe);
      hits.push({
        line: ev.start + 1,
        sceneIndex: sceneIdxOf[ev.start],
        sceneHeader: headerOf[ev.start],
        snippet: anchor.slice(0, 30),
        marker: (m?.[0] ?? '').slice(0, 28),
        rescued,
        reason: zh
          ? '又是"信息容器延迟开启"——遗书/录音/证据明明在手，却靠"不敢拆"人为拖延释放，容器成了反复拧的悬念阀门'
          : 'deferred reveal again - the letter or recording sits in hand while "I can\'t bring myself to open it" milks suspense; the container becomes a plot valve',
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
      ? `${events.length} 处"不敢拆"式信息容器拖延（${n} 处未救）——信息已在手却反复拧悬念阀门，观众等的是信封里的雷，不是看角色围着信封打转。`
      : `${events.length} deferred-container beats (${n} unrescued) - the secret is already in hand but the opening is stalled again and again; the audience waits for the bomb inside the envelope, not the character circling it.`);
    advice.push(zh
      ? '容器里的信息要按时释放。拆不拆可以犹豫一场，不能反复犹豫：要么让角色当场拆开，把内容炸出来推动剧情；要么给"不敢拆"一个具体的代价（"拆了就回不了头"），并在两三场内兑现。更狠的写法是让旁人替他拆——母亲留下的信被律师当庭念出，拖延的选择权被夺走，角色被迫在毫无防备时面对真相。同一封信犹豫超过一次，观众比角色先失去耐心。'
      : 'A container\'s secret has a shelf life. Hesitation can buy one scene, never a running gag: either open it and let the contents detonate the plot, or give the fear a concrete price ("Once I read it, there\'s no going back") and cash it within two or three scenes. Sharper still, take the choice away - the lawyer reads the mother\'s letter aloud in court, and the character faces the truth with no armor on. Hesitate over the same letter twice and the audience loses patience before the character does.');
  }

  return { score, hitCount: events.length, unrescuedCount: n, hits, issues, advice };
}
