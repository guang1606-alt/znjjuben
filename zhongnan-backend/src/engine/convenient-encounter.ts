import { isSceneHeaderLine } from './script-scenes';
/**
 * 转角偶遇 / 世界太小检测（v2.89 块97，创作能力类）
 * ------------------------------------------------------------------
 * 病象：两个人永远"恰好"相遇——转角撞进怀里、全世界唯一一家咖啡
 *   店必坐隔壁桌、回老家必撞前任、十亿人口的城市必同乘一部电梯：
 *     △她转角撞进一个男人怀里，咖啡洒了他一身。
 *     顾言：怎么是你？
 *     苏晚：前夫……这么巧？
 * 一次转角是缘分，第二次观众开始察觉世界太小，第三次观众直接
 * 看穿：这是作者按着计算器在安排相遇。偶遇的戏剧价值在于"不巧
 * 之巧"——铺垫过的交汇（同公司/每天同一条路/一场谁也不知道的
 * 蹲守）才立得住；零铺垫高频撞见，等于把人物命运交给作者的手。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - walkInTiming：镜像/姊妹引擎——管"刚被谈起 ±3 行内登场"
 *    （有人提起触发的到位巧合），本引擎管"无人提及、纯空间偶遇
 *    ×旧关系"（世界太小）；walkIn 的触发条件是"被谈及"，本引擎
 *    恰恰要求"没有被谈起也撞上"；
 *  - causalLogic：管显式巧合词（恰好/碰巧/撞见/coincidence）的
 *    全稿密度统计，不限定相遇对象与关系；本引擎收结构性"相遇
 *    方式×旧关系"共现事件，密度病按次数罚；
 *  - alwaysLate：错过（抵达就刚走）与偶遇（一出门就撞上）是
 *    timing 巧合的正反两面，但始终迟到罚的是"该成不成"，本引擎
 *    罚的是"不该成偏成"；
 *  - instantLove / instantTrust / instantKinship：免费关系家族
 *    （承诺/托付/接纳白给），本引擎管"相遇白给"——关系速热以
 *    前的一步，先让两个人"随机"撞上，相遇本身被白给；
 *  - plotArmor：管生存/逃脱的物理放水，本引擎管地理与缘分的
 *    放水。
 *
 * 判定：
 *  - 相遇方式锚（转角撞进怀里/迎面撞上/恰好同乘/冤家路窄/不期而
 *    遇/这么巧/又见面了 + ran right into/of all places/small
 *    world…）与关系锚（前任/前夫/初恋/死对头/多年不见 + my ex/
 *    old flame/haven't seen you in years…）同句或 ±2 行窗口共现
 *    → 构成一次"白给偶遇"事件；双条件缺一不可——纯撞路人无关系
 *    放行，纯旧关系陈述无相遇方式放行；
 *  - rescue：①安排锚（跟踪/蹲守/堵在楼下/打听到行程/故意等/
 *    staked out/waited outside）——偶遇是预谋，成本付过费；
 *    ②合理性锚（同公司/同班/邻居/每天同一条路/same office/
 *    neighbors）——高频交汇空间里偶遇合法；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过相遇行与关系行
 *    自身；
 *  - 相邻 ≤2 行的相遇方式行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次转角是缘分/命运感），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ConvenientEncounterHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有安排锚/合理性锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface ConvenientEncounterResult {
  score: number;
  /** 白给偶遇事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: ConvenientEncounterHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 相遇方式锚：世界把两个人往一块儿按 */
const ENCOUNT_ZH = /转角撞进|撞进[^。！？\n]{0,6}怀里|一头撞在|迎面撞上|迎面走来|恰好(?:同乘|同班|同一间|同一家|同一班|碰上|遇上|撞上)|不偏不倚[^。！？\n]{0,6}(?:撞|碰|落)|冤家路窄|狭路相逢|久别重逢|不期而遇|擦肩而过.{0,4}(?:回头|停下)|(?:恰好|刚好|正巧|偏偏)路过|居然在这里|竟然在这里|怎么(?:会)?(?:是你|在这里)|又(?:见面|碰上|遇上)了|这么巧|好巧(?:啊|呀)?|真巧|太巧了|怎么这么巧|世界(?:真|太)小|缘分(?:呐|啊)?|真是缘分/;

const ENCOUNT_EN = /\b(?:ran|walked|bump(?:ed)?|crashed) (?:right )?into (?:him|her|them|someone|a man|a woman)|literally ran into|of all (?:places|days|times|coffee shops|people)|small world|what a coincidence|how coincidental|we (?:keep )?(?:meeting|running into each other)|fancy meeting you|never thought i'?d see you (?:here|again)|of course you'?re here|what are the odds|just my luck|coincidence (?:again|keeps)|fate (?:keeps|brought|brought us)\b/i;

/* 关系锚：撞上的偏偏是"不该撞上的人" */
const RELATION_ZH = /前任|前夫|前妻|前男友|前女友|前未婚夫|前未婚妻|初恋|旧爱|旧情人|旧相识|仇人|仇家|死对头|冤家|宿敌|老对手|老同学|失联(?:多年|已久|多年)|多年不见|多年没见|十年没见|五年没见|三年没见|多年未见|青梅竹马|旧友|故人|离散多年的?/;

const RELATION_EN = /\b(?:my ex|ex-?(?:husband|wife|boyfriend|girlfriend|fianc(?:e|e[eé])|partner)|first love|old flame|old rival|sworn enemy|arch-?enemy|arch-?rival|nemesis|childhood sweetheart|high school sweetheart|lost contact|haven'?t seen (?:you|him|her) in (?:years|ages|a decade|ten years|five years)|long time no see|after all these years)\b/i;

/* rescue A：安排锚——偶遇是预谋，不是命运的手 */
const PLANNED_ZH = /跟踪|蹲守|蹲了|堵在|守在|守了|打听了?[^。！？\n]{0,4}行程|打听(?:到)?(?:他|她|你)的?下落|故意(?:等|来|出现|撞)|约好的|安排好的|等在(?:楼下|门口|公司|车站)|查了?[^。！？\n]{0,4}行程/;

const PLANNED_EN = /\b(?:staked out|waited outside|waited (?:for|at) the|followed (?:him|her|them)|asked around|planned this|set this up|found out (?:his|her|their) schedule|made (?:sure|certain) (?:he|she|they)'?d be here)\b/i;

/* rescue B：合理性锚——高频交汇空间里偶遇合法 */
const REASONABLE_ZH = /同(?:一家|一个|个)(?:公司|学校|小区|剧组|部门|班)|我们(?:是)?同事|我(?:们)?(?:就)?住在?这一带|就在?(?:这|附近)(?:上班|住)?|邻居|低头不见抬头见|每天(?:都)?(?:见|经过|路过)|同一条路|同一栋楼/;

const REASONABLE_EN = /\b(?:same (?:office|company|building|school|class|neighborhood|floor|train every)|we work together|coworker|colleague|we live (?:in the same|nearby|next door|downstairs)|next door neighbor|see each other every day|every morning|same commute)\b/i;

/**
 * 纯函数：检测"转角撞进怀里"式偶遇当命运开关的密度病。
 */
export function convenientEncounter(draft: string): ConvenientEncounterResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const encRe = zh ? ENCOUNT_ZH : ENCOUNT_EN;
  const relRe = zh ? RELATION_ZH : RELATION_EN;
  const plannedRe = zh ? PLANNED_ZH : PLANNED_EN;
  const reasonableRe = zh ? REASONABLE_ZH : REASONABLE_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasE: boolean[] = new Array(rawLines.length).fill(false);
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasE[i] = encRe.test(line);
    hasR[i] = relRe.test(line);
  });

  /* pass2：相遇方式行与 ±2 行内的关系锚配对成事件（相邻 ≤2 行相遇行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasE[i]) return;
    const m = raw.match(encRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的相遇表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasR[j],
    );
    if (win.length === 0) return; /* 纯撞路人/无旧关系放行 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（安排锚/合理性锚；跳过相遇行与关系行自身） */
  const hits: ConvenientEncounterHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次转角是缘分） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasE[j] || hasR[j]) continue; /* 相遇行与关系行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = plannedRe.test(win) || reasonableRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"世界太小"——旧人零铺垫高频撞见，相遇靠作者按计算器，不靠人物的生活轨迹'
        : 'convenient encounter again - the world shrinks to stage two old ties together with zero setup',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"转角偶遇"式世界太小（${n} 处未救）——旧人零铺垫高频撞见，一次是缘分，第三次观众就看穿是作者在安排相遇。`
      : `${hitCount} convenient-encounter beats (${n} unrescued) - old ties keep bumping into each other with zero setup. Once is fate; by the third, the audience sees the author's hand.`);
    advice.push(zh
      ? '偶遇的戏剧价值在于"不巧之巧"。给每次相遇补一道来路：要么有预谋（他打听到她的航班、堵在公司楼下三小时——偶遇变猎手，人物在行动）、要么有轨迹（同一家医院化疗、同一条地铁线上下班——生活逻辑让相遇必然）、要么有代价（这次撞见让他赔上了准备三年的谈判）。更高级的写法是"反偶遇"：让她在同一家咖啡店连守七天都没等到，第八天他没来，第九天她自己走进了他的公司——相遇是人物挣来的，不是作者发的。如果剧情需要宿命感，让第三方点破"你们再这么撞下去，我就信缘分了"——替观众把吐槽说出口，白给就变成了自觉的浪漫。'
      : 'Encounters only feel fated when they are earned. Give each meeting a pedigree: premeditation (he found her flight, waited three hours outside her office - the "chance" meeting is really a hunt), a shared track (same chemo ward, same morning train - life makes the collision inevitable), or a cost (this collision torpedoes the deal he spent three years building). Better still, invert the meet: she stakes out the same cafe for seven days without a glimpse; on the eighth he does not come; on the ninth she walks into his office herself - a meeting the character earned, not one the author mailed in. If you want destiny, let a third party say "keep colliding like this and I\'ll start believing in fate" - the audience\'s eye-roll, voiced, becomes wit.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
