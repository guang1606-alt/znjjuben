import { isSceneHeaderLine } from './script-scenes';
/**
 * 化验秒出检测（v2.123 块131，创作能力类）
 * ------------------------------------------------------------------
 * 病象：该等一周的亲子鉴定当场就拿，该走流程的审批今天就要——
 *   化验/鉴定/审批/公证的官方耗时被剧情掐掉，公家的钟表被拨快：
 *     △化验结果当场就出了。
 *     △亲子鉴定报告半小时就拿到了。
 *     △The blood work was already out.
 *     △The DNA results were in before lunch.
 * 一次快出是节奏，次次靠流程秒出观众就看穿了：官方流程不是点菜
 * 单是排队挂号——要排队（真实周期）、要花钱（加急代价）、要有
 * 物理依据（现场快检），一样都不能少。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - unplanted-asset：管"关键道具无铺垫"（铺垫缺失），本引擎管
 *    "官方流程耗时白给"（该等不等）——前者管东西哪来的，本引擎
 *    管时间哪去了；
 *  - memory-fakeout：管"鉴定造假反转"（鉴定是假的），本引擎管
 *    "鉴定快得不真实"（鉴定是真的但太快）——前者管真假，本引擎
 *    管快慢；
 *  - records-on-demand：管"调档秒中"（情报随要随有），本引擎管
 *    "制证秒出"（流程耗时白给）——前者管查，本引擎管出；
 *  - instant-escape：管"逃脱工具白给"（自救装备凭空出现），本
 *    引擎管"官方流程白给"（公家钟表被拨快）——前者管自救工具，
 *    本引擎管公家流程；
 *  - deadline-stretch：管"假倒计时不兑付"（说了三天就没影），本
 *    引擎管"真实流程被掐快"（该一周的当天出）——前者管诺言不
 *    兑付，本引擎管时钟被拨快；
 *  - evidence-blank：管"证据恰好失灵"（取证之路全断），本引擎管
 *    "证据恰好秒出"（出证之路全绿）——失灵与秒出是一枚硬币的
 *    两面，方向相反。
 *
 * "掐点白给"家族第二员（amnesia-on-cue 失忆身体掐点 → results-
 * on-cue 结果流程掐点——撞头秒失忆是"该记的记不起"，化验秒出是
 * "该等的等不了"，同为身体/流程阀门被剧情拨快拨慢，结构同构的
 * 镜像兄弟。amnesiaOnCue 已退役出池仅保留检测器，本引擎接棒入池）。
 *
 * 判定（镜像 rumor-speed 单型双锚）：
 *  - 流程锚（化验/检验/送检/鉴定报告/验伤/尸检/亲子鉴定/DNA/
 *    血检/毒理/笔迹鉴定/痕检/立案/审批/公证/过户/批复/审计/
 *    评估报告 + lab test/blood work/toxicology/autopsy/forensics/
 *    paternity test/dna report/fingerprint match/background
 *    check/notarized/the paperwork…）与秒速兑付锚（当场就出/
 *    这就出/马上出/几分钟就/半小时就/今天就能/当天出/用不了
 *    多久 + already out/within minutes/before lunch/same day/
 *    right away…）±2 行窗口共现 → 构成一次"流程秒出"事件；
 *    双条件缺一不可——纯流程陈述放行（"化验结果下周出"是正常
 *    戏），纯速度无流程放行（"批文当场就拿到了"没提流程名）；
 *  - rescue：① 等待明示锚（等了三天/还得等一周/三天后出/下周出
 *    + takes weeks/still waiting/won't be out until…）——该等
 *    的等了，周期真实；② 加急代价锚（加急/塞了红包/托了关系/
 *    走后门/花双倍 + rush fee/expedited/pulled strings/called
 *    in a favor…）——快是花钱买的，有代价；③ 现场快检锚（现场
 *    快检/快筛/试纸/验孕棒/血糖仪/便携检测仪 + field test/rapid
 *    test/test strip/handheld scanner…）——快有物理依据，不
 *    是流程开挂；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（"为了
 *    加急他塞了红包"常是独立行，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的流程表述合并为同一事件（跨场景头不合并）；事件
 *    end 取窗口内最后一个锚行（只延不缩，保证 rescue 扫描覆盖
 *    锚行之后，固化坑④）；
 *  - 第 1 次豁免（一次快出是节奏），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ResultsOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有等待明示/加急代价/现场快检（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface ResultsOnCueResult {
  score: number;
  /** 流程秒出事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: ResultsOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 流程锚：官方流程/检验鉴定行为信号（流程名词自带排队属性） */
const PROC_ZH = /化验|检验|送检|鉴定(?:报告|结果)?|验伤|尸检|验尸|亲子鉴定|DNA|基因检测|血检|尿检|毒理|笔迹(?:鉴定)?|痕检|立案|审批|公证|过户|批复|审计|评估报告|检测(?:报告|结果)/;

const PROC_EN = /\b(?:lab (?:test|results?|work)|blood (?:test|work|draw)|toxicology|autopsy|forensics|paternity (?:test|report|results?)|dna (?:test|results?|report)|fingerprint (?:analysis|match|results?)|background check|notariz\w+|the paperwork|approved the (?:permit|application)|the results (?:are|were) in)\b/i;

/* 秒速兑付锚：不合理的快（须与流程锚共现才成事件） */
const INSTANT_ZH = /当场(?:就)?(?:出|拿|批|办|开)|这就出|马上出|立刻出|几分钟就|半小时就?|一个小时就|一上午就|中午前|下班前|今天就能|当天(?:出|拿|批|办)|用不了多久/;

const INSTANT_EN = /\b(?:already (?:out|ready|approved|done)|by the time|within (?:minutes|the hour)|before (?:lunch|dawn|tonight)|by tonight|by morning|same day|no waiting|right away|in no time)\b/i;

/* rescue A：等待明示锚——该等的等了，周期真实（全窗口扫描） */
const WAIT_ZH = /等了[^。\n]{0,6}(?:天|周|个月?|小时)|还得等|要等[^。\n]{0,6}(?:天|周|个月?)|三天后出|一周后出|下周出|下个月|一个星期/;

const WAIT_EN = /\b(?:takes (?:weeks|days|a month)|results (?:in|take)|still waiting|won'?t be (?:out|ready) until)\b/i;

/* rescue B：加急代价锚——快是花钱买的（全窗口扫描） */
const COST_ZH = /加急|塞了红包|递了红包|托了关系|找了人|走后门|花(?:了)?(?:双倍|大价钱|不少钱)/;

const COST_EN = /\b(?:paid (?:extra|double|a rush fee)|rush fee|expedited|pulled strings|called in a favor)\b/i;

/* rescue C：现场快检锚——快有物理依据（全窗口扫描） */
const FAST_ZH = /现场(?:快检|快筛|检测)|快筛|试纸|验孕棒|血糖仪|便携(?:式)?(?:检测|仪)/;

const FAST_EN = /\b(?:field test|rapid test|instant test|test strip|point.of.care|handheld (?:scanner|device))\b/i;

/**
 * 纯函数：检测"化验秒出/官方流程掐点"的免费等待密度病。
 */
export function resultsOnCue(draft: string): ResultsOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const procRe = zh ? PROC_ZH : PROC_EN;
  const instantRe = zh ? INSTANT_ZH : INSTANT_EN;
  const waitRe = zh ? WAIT_ZH : WAIT_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const fastRe = zh ? FAST_ZH : FAST_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasP: boolean[] = new Array(rawLines.length).fill(false);
  const hasI: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasP[i] = procRe.test(line);
    hasI[i] = instantRe.test(line);
  });

  /* pass2：流程行与 ±2 行内的秒速兑付锚配对成事件（相邻 ≤2 行流程行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasP[i]) return;
    const m = raw.match(procRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的流程表述合并为同一事件（跨场景头不合并）；
           合并时以新流程行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasI[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯流程无秒速不构成事件（真实周期放行） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（等待明示/加急代价/现场快检；全窗口扫描——
     "为了加急他塞了红包""用的是现场快检试纸"常是独立行，排除
     锚行会漏检 rescue，固化坑⑧） */
  const hits: ResultsOnCueHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次快出是节奏） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = waitRe.test(win) || costRe.test(win) || fastRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"化验秒出/流程掐点"——该等一周的鉴定报告当场就拿，该走流程的审批今天就要，官方流程的耗时白给，公家的钟表被剧情拨快，排队挂号成了召之即来的自助餐'
        : 'results on cue again - the week-long report is ready on the spot and the paperwork clears before lunch, official process time given away for free, the public clock rewound to serve the plot',
    });
  }

  const unrescuedCount = hits.filter((h) => !h.rescued).length;
  const score = unrescuedCount === 0 ? 100 : Math.max(20, 90 - unrescuedCount * 20);
  const issues: string[] = [];
  const advice: string[] = [];
  if (unrescuedCount > 0) {
    issues.push(zh
      ? `检测到 ${unrescuedCount} 处"化验秒出/流程掐点"密度病（共 ${hitCount} 次流程秒出事件，首次已豁免）`
      : `Detected ${unrescuedCount} results-on-cue hits (out of ${hitCount} total instant-process events, first occurrence exempted)`);
    advice.push(zh
      ? '官方流程不是点菜单是排队挂号——给等待挣来：要么写出真实周期（血检要三天/亲子鉴定一周后出/立案排到下个月），要么写出加急代价（塞了红包/托了关系/花双倍走加急），要么给出快检依据（现场快检试纸/便携检测仪/验孕棒）；更狠的写法是让等待成为戏——报告没出的三天里嫌疑人又动了一步，等待本身制造新的麻烦'
      : 'Official process runs on queues, not plot speed - earn the turnaround: state the real window (three days for the blood panel, a week for the DNA, the permit queued for next month), pay for the rush (a bribe, a pulled string, double the expedite fee), or ground the speed in a field test (a rapid strip, a handheld scanner, a pharmacy kit); better still, make the wait dramatic - in the three days before the report lands, the suspect moves again');
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
