import { isSceneHeaderLine } from './script-scenes';
/**
 * 初见白给 / 爱情速热检测（v2.88 块96，创作能力类）
 * ------------------------------------------------------------------
 * 病象：两个人第一次见面，三行内以身相许——
 *     陆总：我们……今天刚认识吧？
 *     苏晚：可我认定你了。非你不嫁。
 *     陆总：（愣了半秒）好，娶你。
 *   "免费的爱情撑不起海誓山盟"。心动可以有瞬间，但非你不嫁/
 *   为你去死/娶你做陆太太这种级别的承诺，没有相处、没有了解、
 *   没有一起扛过事，就是编剧把"深情"当初见特效用。一次一见钟情
 *   是类型惯例；每一对CP都靠初见三行内完成求婚，观众就知道这份
 *   爱随时可以再白给给下一个人。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instant-trust：管"初识方秒被托付"（把公章/账本/孩子交给陌生
 *    人），本引擎管"初识方秒被许诺"（以身相许级情感承诺）——同
 *    一初见语境，白给的东西不同（信任物 vs 深情）；
 *  - instant-kinship：管血缘身份的秒接纳（认亲），本引擎管浪漫
 *    关系的秒承诺（告白/求婚）；
 *  - cheap-forgiveness：管"重伤方秒被原谅"（需 HARM 加害前提），
 *    本引擎管"陌生方秒被许爱"（无加害者，纯粹关系建立过速）；
 *  - stance-flip：管同一角色死誓立场的无因横跳（决定层），本引擎
 *    管关系建立的成本（关系层）；
 *  - family-craft / emotion-craft / narrative-craft：技法库（下发
 *    装置与机理论述），不检测单稿内承诺事件的速度；
 *  - twist-density / gratification-wave：反转与爽感密度评分，不判
 *    承诺挣没挣来。
 *
 * "免费关系/免费渠道"家族第五员：免费情报（eavesdrop/phoneRelay/
 * drunkTruth/villainConf/records）→ 免费人力（help-on-demand）→
 * 免费信任（instant-trust）→ 免费亲情（instant-kinship）→ 免费爱情
 * （本引擎）。
 *
 * 判定：
 *  - 高浓度承诺（以身相许/非你不嫁/娶你/为你去死/一生一世/i love
 *    you/marry me…）为锚，±2 行内出现初见信号（第一次见面/素未
 *    谋面/刚认识/we just met/total stranger）= 一次事件；双条件缺
 *    一不可——无初见信号的承诺（正常恋爱告白/求婚）放行，无承诺
 *    的初见心动（脸红/多看两眼）放行；
 *  - rescue：①时间铺垫锚（这些日子/认识你三年/all these years/
 *    we go way back）出现在承诺行之外的行——感情有来路；②拒绝
 *    摩擦锚（太快了/我们才认识/we barely know each other）出现在
 *    承诺行之外的行——有人替观众戳破；③承诺行自身自带时间限定
 *    （"认识你三年了，嫁给我"→selfQualified）；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过承诺行与初见行
 *    自身；
 *  - 相邻 ≤2 行的承诺行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次一见钟情是类型惯例），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantLoveHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有铺垫锚/摩擦锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantLoveResult {
  score: number;
  /** 初见白给事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantLoveHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 高浓度承诺：以身相许级别的告白（锚） */
const LOVE_ZH = /以身相许|非你不嫁|非你不娶|非君不嫁|非卿不娶|一生一世|永生永世|下辈子(?:还)?(?:嫁|娶|跟|跟定)|为你去死|为你死|替你死|为你挡|替你挡|拿命(?:护|换)|命是你的|把命给你|托付终身|托付一生|认定你了|我的心(?:已经)?是你的|爱上你了|爱上她了|爱上他了|嫁给我|娶你|此生非你|生死相随|不离不弃|海枯石烂|万死不辞|什么都愿意(?:为你|为了你)|我爱你/;

const LOVE_EN = /\b(?:i love you|marry me|be my (?:wife|husband)|spend (?:the rest of )?my life(?: with you)?|die for you|take a bullet|my heart (?:is|belongs to) yours?|forever yours|belong to you|can'?t live without you|soulmate|i'?m in love with you|give (?:you|him|her) my (?:life|heart)|love of my life|wait(?:ing)? for (?:you|him|her) forever)\b/i;

/* 初见信号：承诺发生的语境是"刚认识" */
const MEET_ZH = /第一次见面|初次见面|初次相识|初次相逢|素未谋面|素不相识|头一回见|第一次见|刚认识|刚见面|刚相识|今天刚认识/;

const MEET_EN = /\b(?:we (?:just|only) met|just met|first time (?:we|I|he|she) (?:met|saw)|never met before|total stranger|complete stranger|just introduced|first day|we'?ve only just met)\b/i;

/* rescue A：时间铺垫锚——感情有来路 */
const QUALIFY_ZH = /这些日子|这段时间|相处|这几个月|这(?:一|三|五|十|二十)?年|慢慢(?:了解|熟悉)|越来(?:越)?了解|认识你(?:很久|三年|十年|二十|多年|这么久)|同窗|共事|多年的?(?:朋友|交情)|老朋友|早就认识|青梅竹马|早就(?:爱|喜欢)上|毕业/;

const QUALIFY_EN = /\b(?:all these (?:years|months)|for (?:years|months|a long time)|we'?ve known each other|getting to know|spent (?:time|months|years) together|we go way back|childhood friends|grew up together|we'?ve been together)\b/i;

/* rescue B：拒绝摩擦锚——有人替观众戳破 */
const DECLINE_ZH = /太快了|太突然|太唐突|才认识(?:几天|一天|三天|多久|第一天|多久)|才见(?:了)?(?:一面|第一面|一次)|我还不了解你|都不了解你|你不觉得(?:太快|奇怪|唐突)|说什么傻话|别开玩笑了|先(?:从朋友|做朋友)|当朋友|先相处/;

const DECLINE_EN = /\b(?:too fast|too soon|this is crazy|we barely know each other|we hardly know (?:each other|you|him|her)|don'?t you think(?: that)?(?:'?s)? too fast|give it time|let'?s (?:start as|take it) slow|this is too sudden)\b/i;

/**
 * 纯函数：检测"初见三行内以身相许"的爱情速热密度病。
 */
export function instantLove(draft: string): InstantLoveResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const loveRe = zh ? LOVE_ZH : LOVE_EN;
  const meetRe = zh ? MEET_ZH : MEET_EN;
  const qualifyRe = zh ? QUALIFY_ZH : QUALIFY_EN;
  const declineRe = zh ? DECLINE_ZH : DECLINE_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasL: boolean[] = new Array(rawLines.length).fill(false);
  const hasM: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasL[i] = loveRe.test(line);
    hasM[i] = meetRe.test(line);
  });

  /* pass2：承诺行与 ±2 行内的初见信号配对成事件（相邻 ≤2 行承诺合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasL[i]) return;
    const m = raw.match(loveRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的承诺合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasM[j],
    );
    if (win.length === 0) return; /* 无初见信号不构成事件（正常告白放行） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（时间铺垫/拒绝摩擦；跳过承诺行与初见行自身） */
  const hits: InstantLoveHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次一见钟情是类型惯例） */
    /* 承诺行自身带时间限定（"认识你三年了，嫁给我"）算有来路的承诺 */
    let selfQualified = false;
    for (let j = ev.start; j <= ev.end; j += 1) {
      if (hasL[j] && qualifyRe.test(rawLines[j])) { selfQualified = true; break; }
    }
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasL[j] || hasM[j]) continue; /* 承诺行与初见行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = selfQualified || qualifyRe.test(win) || declineRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"初见白给"——第一次见面就以身相许，没有相处、没有了解、没一起扛过事，海誓山盟像免费试用装'
        : 'instant love again - a lifelong vow lands within lines of a first meeting, with no time spent and no one flinching',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"初见白给"式爱情速热（${n} 处未救）——初见即以身相许，零相处零摩擦。`
      : `${hitCount} instant-love beats (${n} unrescued) - first meetings produce lifelong vows with zero time spent and zero resistance.`);
    advice.push(zh
      ? '深情的戏剧价值在于难。给每一次告白补一道来路：要么有时间（认识三年才敢开口，或"这些日子照顾你，才看清自己"）、要么有摩擦（"你才认识他几天？"让旁观者替观众戳破）、要么有代价（表白就意味着放弃复仇/离开家族）。更好用的做法是"心动而不敢认"——初见心跳是真的，但一句"非你不嫁"咽回去三年，咽回去的那句比当场说出口更值钱。如果剧情就是需要速热，让承诺附上一个赌注（"明天你要是真敢签字，我就嫁你"）——白给变成了有条件的冒险。'
      : 'Love is only dramatic when it costs something. Give every vow a pedigree: time (three years before the confession finds its nerve, or "Caring for you these months - that\'s when I knew"), friction ("You\'ve known him a week?" - let a bystander voice what the audience thinks), or cost (saying it means giving up the revenge, leaving the family). Better still: let the heart race but hold the word - the "I love you" swallowed for three years is worth more than the one blurted on first sight. If the plot needs speed, attach a stake ("Sign that contract tomorrow and I\'ll marry you") - the freebie becomes a conscious gamble.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
