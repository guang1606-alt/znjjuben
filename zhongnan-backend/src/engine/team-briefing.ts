import { isSceneHeaderLine } from './script-scenes';
/**
 * 开会式推进 / 团队戏降智检测（v2.131 块139，创作能力类）
 * ------------------------------------------------------------------
 * 病象：AI 写团队行动戏有个本能——把部署戏写成排班表：
 *   老陈：都听好了。小舟你负责望风，大刘你带一队走后门。
 *   老陈：我带老三走正门，行动代号"破晓"。
 *   小舟：明白！
 *   大刘：收到，保证完成任务！
 *   老陈：行动！
 * 零异议、零风险讨论、零性格摩擦——计划顺利宣读，众人无条件
 * 领命，任务按部就班，群像沦为任务编排仪表盘。一次战前部署是
 * 仪式感高光，第三次观众就看穿：这队人永远不会吵起来。真群像
 * 的部署戏有讨价还价（凭什么我守后门）、有风险预估（万一警卫
 * 提前换班呢）、有人抢戏（我有个更好的主意）——分工是磨出来的，
 * 不是宣读出来的。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - round-robin-dialogue：管"群戏读稿感"（形式层：按人头轮流
 *    发言、句长整齐、零打断），本引擎管"部署读稿感"（内容层：
 *    分派锚×服从锚的功能性仪式）——前者看轮转形状，本引擎看
 *    台词内容是否任务编排；
 *  - talk-down-crutch：管"个体服从白给"（对峙现场被劝即放下
 *    武器），本引擎管"群体服从白给"（部署现场分派即诺）——
 *    同为"服从白给"，一个个体层一个群体层，镜像兄弟，本引擎
 *    入池让 talk-down 让位；
 *  - instant-trust：管"陌生人秒信任"（关系建立白给），本引擎
 *    管"下级秒领命"（协作执行白给）——前者管信任，本引擎管
 *    服从；
 *  - villain-stall：管"反派拖延处决"（威胁兑付白给），本引擎
 *    管"团队顺滑执行"（行动阻力白给）——一个该快的慢，一个
 *    该磨的顺；
 *  - self-intro-dump：管"自我介绍报菜名"（信息层报菜名），本
 *    引擎管"任务分派报菜名"（行动层报菜名）；
 *  - fake-choice：管"角色无选择权"（假选择），本引擎管"角色无
 *    反对权"（零异议）。
 *
 * 判定：
 *  - 分派锚（分头行动/各就各位/按计划/开始行动/全体注意/都听好
 *    了/听我口令/行动代号/你负责/你带一队/我来断后… + split up/
 *    listen up/here's the plan/you're on/cover me/on my mark/
 *    move out/stick to the plan…）与服从锚（明白/收到/保证完成
 *    任务/遵命/交给我/行动！ + roger/copy that/understood/on it/
 *    consider it done/let's move…）±2 行同场景共现 → 构成一次
 *    "开会式推进"事件；双条件缺一不可——纯分派无人应放行（布置
 *    后直接跳行动是剪辑选择），纯应答无部署放行（日常应答不归
 *    本引擎）；
 *  - rescue：①异议锚（等一下/凭什么/我反对/万一/我有个更好的主
 *    意 + wait a minute/why me/I object/what if…）——分工是吵
 *    出来的；②变数锚（计划赶不上变化/有变/出事了 + change of
 *    plan/things change…）——计划刚立就被现实敲打；③赌注锚
 *    （风险/赌一把/没有退路/成败在此一举 + too risky/no turning
 *    back/one shot…）——部署带赌注讨论就不是排班表；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的分派行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次战前部署是类型片仪式感），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TeamBriefingHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救（异议/变数/赌注，部署不是排班表） */
  rescued: boolean;
  reason: string;
}

export interface TeamBriefingResult {
  score: number;
  hitCount: number;
  unrescuedCount: number;
  hits: TeamBriefingHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 分派锚：任务被宣读 */
const BRIEF_ZH = /(?:分头行动|分头(?:去|找|查)|各就各位|按(?:原)?计划(?:行动|行事)?|开始行动|行动开始|全体注意|都听好了|都听我|听我口令|行动代号|作战部署|任务分配|分工(?:如下|明确)?|你负责|你(?:带(?:着)?(?:一|二|三|几|\d+)?队|去(?:盯|守|查|接应)|守(?:着|在)?|盯(?:着|住)?|望风)|我来(?:引开|断后|负责|殿后)|给我(?:盯|守|拿|带)住|交给你了|四人为一组|两人一组)/;

const BRIEF_EN = /\b(?:split(?:ting)? up|each (?:team|of you)|your job is|you(?:'re| are) (?:on|in charge of|taking)|you take (?:point|the|north|south|east|west|lead)|i(?:'ll| will) take (?:point|the|lead)|cover me|on my (?:mark|signal|count)|follow my lead|stick(?:ing)? to the plan|move(?:d|s)? out|listen up|here(?:'s| is) the plan|operation (?:codename )?\w+|team (?:one|two|alpha|bravo)|positions,? (?:everyone|people)|in groups of (?:two|three|four)|you watch (?:the|my)|i(?:'ll| will) (?:distract|cover|go))\b/i;

/* 服从锚：任务被无摩擦领受 */
const OBEY_ZH = /(?:明白(?:了)?|收到|保证完成任务|遵命|得令|没问题|交给我|包在我身上|这就去|马上(?:出发|去办)|行动！|走！|是！|领命|照办|一声令下|(?:二话不说|齐声)(?:应道|答道|领命)?)/;

const OBEY_EN = /\b(?:roger(?: that)?|copy(?: that)?|understood|got it|yes,? sir|on it|affirmative|consider it done|leave it to me|on my way|mission accepted|let'?s move|let'?s go|at once|right away)\b/i;

/* rescue A：异议锚——分工是吵出来的 */
const DISSENT_ZH = /(?:等一下|慢着|且慢|我反对|我有(?:意见|异议)|凭什么|为什么(?:是|让)我|不行|这太(?:冒险|危险|荒唐)|不同意|办不到|我有个(?:更好|别的)(?:主意|想法|办法)|万一|哪有那么容易|没那么简单)/;

const DISSENT_EN = /\b(?:wait a (?:minute|second)|hold on|i object|i disagree|no way|are you (?:crazy|out of your mind)|that'?s (?:insane|too risky)|over my dead body|why me|not fair|i have a better idea|what if)\b/i;

/* rescue B：变数锚——计划刚立就被现实敲打 */
const SURPRISE_ZH = /(?:计划赶不上变化|情况有变|有变|突变|出事了|出意外|意外|突发|变卦|临时改动|节外生枝)/;

const SURPRISE_EN = /\b(?:things change|change of plan|the plan(?:'s| is) off|something(?:'s| has) come up|situation(?:'s| has) changed|complication|plot twist|something went wrong)\b/i;

/* rescue C：赌注锚——部署带赌注讨论就不是排班表 */
const STAKES_ZH = /(?:风险|赌一把|孤注一掷|没有退路|背水一战|只有一次机会|成败在此一举|代价|失败(?:了)?(?:怎么办|如何)|输不起|一步走错)/;

const STAKES_EN = /\b(?:too risky|one shot|no turning back|point of no return|all or nothing|the stakes|if this goes wrong|this is suicide|we fail|one chance)\b/i;

/**
 * 纯函数：检测"开会布置任务、众人齐声领命"的群体服从白给密度病。
 */
export function teamBriefing(draft: string): TeamBriefingResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const briefRe = zh ? BRIEF_ZH : BRIEF_EN;
  const obeyRe = zh ? OBEY_ZH : OBEY_EN;
  const dissentRe = zh ? DISSENT_ZH : DISSENT_EN;
  const surpriseRe = zh ? SURPRISE_ZH : SURPRISE_EN;
  const stakesRe = zh ? STAKES_ZH : STAKES_EN;

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
  const hasB: boolean[] = new Array(rawLines.length).fill(false);
  const hasO: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasB[i] = briefRe.test(line);
    hasO[i] = obeyRe.test(line);
  });

  /* pass2：分派行与 ±2 行内的服从动作配对成事件（相邻 ≤2 行分派合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasB[i]) return;
    const m = raw.match(briefRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的分派合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasO[j] && sceneOf[j] === sceneOf[i], /* 服从行须与分派行同场景（跨场景头不计入事件边界） */
    );
    if (win.length === 0) return; /* 无服从动作不构成事件（纯布置无应答放行） */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（异议/变数/赌注；同场景全窗口 ±2 行） */
  const hits: TeamBriefingHit[] = [];
  let hitCount = 0;
  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次战前部署是类型片仪式感） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (sceneOf[j] !== sceneOf[ev.end]) continue; /* 跨场景头不取信 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = dissentRe.test(win) || surpriseRe.test(win) || stakesRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"开会式推进"——任务排班表式宣读，众人齐声领命，没有讨价还价、没有风险讨论、没有性格摩擦，群像成了流水线'
        : 'team briefing again - orders are read out like a duty roster and everyone falls in line with no pushback, no risk talk and no friction, flattening the ensemble into a pipeline',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"开会式推进"部署戏（${n} 处未救）——分派即诺、零摩擦执行，群像的戏被排班表吃掉了。`
      : `${hitCount} team-briefing beats (${n} unrescued) - orders are announced and accepted without friction, draining the ensemble drama out of the setup.`);
    advice.push(zh
      ? '部署戏的戏不在任务本身，在领任务的人。给每一次分派补一道摩擦，三选其一：①异议——有人不服（凭什么我守后门/我不同意这个分法，他跟老三有过节你不知道吗），分工是吵出来才像真的；②变数——计划刚立就被现实敲打（话音未落警卫提前换班的消息到了，全体重新洗牌）；③赌注——分派时把代价摆上桌（都记住，这次只有一次机会，谁掉链子谁留在里面）。'
      : 'The drama of a briefing is not the plan - it is the people receiving it. Add friction to every deployment, pick one: (1) dissent - someone pushes back ("why am I on door duty? you know he and Liu have history"), assignments feel earned only when argued over; (2) disruption - reality interrupts the plan before it starts (the guard rotation just moved up, reshuffle everything); (3) stakes - put the price on the table ("one shot at this - anyone slips, they get left inside").');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
