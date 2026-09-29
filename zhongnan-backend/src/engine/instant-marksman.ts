import { isSceneHeaderLine } from './script-scenes';
/**
 * 神枪手一枪毙命 / 技能开挂检测（v2.91 块99，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角全剧第一枪就正中眉心，"多年没摸枪"的老刑警弹弹咬要害，
 *   三分钟戏份的配角枪枪上靶——技能全部拉满，枪枪都有眼睛：
 *     △陈锐举枪瞄准。枪声。
 *     子弹正中太阳穴。
 * 一次百步穿杨是爽点，第三次观众开始眯眼：全剧的枪都装了制导，
 * 且只在剧情需要时上靶。技能戏的张力来自训练成本与失手风险——
 * 距离、风速、手抖、弹药；把这些全部跳过，技能就成了作者的魔杖。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instantHack：管键盘开挂（零成本技术突破），本引擎管扳机开挂
 *    （零训练技能拉满）——一个罚电子安保崩塌，一个罚弹道如天降；
 *  - instantDeduction：管脑子"看一眼破案"（认知开挂），本引擎管
 *    手"枪枪上靶"（运动技能开挂）；
 *  - plotArmor：管子弹绕着主角走（生存光环），本引擎管主角弹弹
 *    咬要害（技能光环）——一对正反镜像；
 *  - cheatRuleCheck：管金手指本身的代价设定，本引擎不问人设来路，
 *    只罚"弹无虚发×零成本"的密度病。
 *
 * 判定：
 *  - 射击动作锚（开枪/扣扳机/举枪/开火 + fired/pulled the
 *    trigger/raised the pistol…）与精准上靶锚（正中眉心/一枪毙命/
 *    百发百中/神枪手 + right between the eyes/dead center…）同句
 *    或 ±2 行窗口共现 → 构成一次"枪枪上靶"事件；双条件缺一不可——
 *    纯射击动作无精准上靶放行（普通交火戏），纯枪法夸赞无射击动作
 *    放行（人设传说、口头吹捧）；
 *  - rescue：①来路锚（狙击手/特种兵/射击冠军/奥运/打猎为生 +
 *    sniper/ex-military/Olympic champion/hunter）——技能有来路，
 *    专业背景让精准合法；②失手锚（脱靶/第一枪没中/打偏 + missed/
 *    went wide）——有失败有重试，命中才有重量；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过射击行与上靶行
 *    自身；
 *  - 相邻 ≤2 行的射击表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次百步穿杨是类型惯例/人设标签），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantMarksmanHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有来路锚/失手锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantMarksmanResult {
  score: number;
  /** 枪枪上靶事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantMarksmanHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 射击动作锚：扳机成了许愿机 */
const SHOT_ZH = /开(?:了)?(?:一)?枪|开火|扣(?:动|下)(?:了)?扳机|举枪|端(?:起)?枪|枪响|射出|补(?:了)?一枪|鸣枪/;

const SHOT_EN = /\b(?:fired (?:a |the |his |her |another )?(?:shot|bullet|round)|fired at|pulled the trigger|took aim|raised (?:his|her|the) (?:gun|pistol|rifle)|opened fire|pulled out (?:his|her|a) (?:gun|pistol))\b/i;

/* 精准上靶锚：弹道精度如天降（只收"精准崇拜"，普通命中不收） */
const PERFECT_ZH = /百发百中|弹无虚发|指哪打哪|百步穿杨|神枪手|枪法(?:如神|超群|了得|一流)|一枪(?:爆头|毙命|致命|一个)|爆头|正中(?:了)?(?:靶心|红心|眉心|太阳穴|要害)|命中(?:了)?(?:靶心|眉心|太阳穴|要害)|击中(?:了)?要害|直入(?:了)?(?:眉心|太阳穴)|不偏不倚[^。！？\n]{0,4}(?:正中|命中|击中)|十环/;

const PERFECT_EN = /\b(?:one shot,? one kill|never miss(?:es|ed)?|dead ?eye|bullseye|right between (?:his|her|the) eyes|between the eyes|clean headshot|headshot|right in the temple|dead center|perfect (?:shot|aim)|marksmanship|never missed a (?:shot|target))\b/i;

/* rescue A：来路锚——专业背景让精准合法 */
const BACKGROUND_ZH = /狙击手|狙击(?:教员|教官)|特种兵|特警|武警|射击(?:冠军|选手|教练|教官|教员)|奥运会?射击|全运会|当过兵|打过仗|退伍(?:军人)?|老兵|行伍|猎户|打猎(?:为生|多年|出身)|从军多年|靶场(?:常客|教练|教官)|枪械(?:教官|教员)/;

const BACKGROUND_EN = /\b(?:sniper|special forces|special ops|swat|ex-?military|army (?:veteran|sniper)|marine|veteran|olympic (?:champion|shooter|medalist)|shooting (?:champion|medalist|coach)|marksman badge|hunter|hunting|grew up (?:hunting|shooting)|range (?:instructor|coach)|firearms instructor)\b/i;

/* rescue B：失手锚——有失败有重试，命中才有重量 */
const MISS_ZH = /脱靶|打偏(?:了)?|偏出|没打中|没有打中|一枪没中|打歪(?:了)?|失手|擦着[^。！？\n]{0,4}(?:飞过|掠过|过去)|手在抖|手腕发酸|胳膊发麻|第一枪[^。！？\n]{0,2}(?:没中|偏了|脱了)/;

const MISS_EN = /\b(?:missed|off target|went wide|shot went wide|grazed|didn't hit|did not hit|first shot (?:missed|went wide)|hands? (?:shaking|trembling)|wrist (?:sore|aching))\b/i;

/**
 * 纯函数：检测"第一枪就正中眉心"式神枪手开挂的密度病。
 */
export function instantMarksman(draft: string): InstantMarksmanResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const shotRe = zh ? SHOT_ZH : SHOT_EN;
  const perfectRe = zh ? PERFECT_ZH : PERFECT_EN;
  const bgRe = zh ? BACKGROUND_ZH : BACKGROUND_EN;
  const missRe = zh ? MISS_ZH : MISS_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasShot: boolean[] = new Array(rawLines.length).fill(false);
  const hasPerfect: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasShot[i] = shotRe.test(line);
    hasPerfect[i] = perfectRe.test(line);
  });

  /* pass2：射击动作行与 ±2 行内的精准上靶配对成事件（相邻 ≤2 行射击行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasShot[i]) return;
    const m = raw.match(shotRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的射击表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasPerfect[j],
    );
    if (win.length === 0) return; /* 纯射击动作/无精准上靶放行 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（来路锚/失手锚；跳过射击行与上靶行自身） */
  const hits: InstantMarksmanHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次百步穿杨是爽点） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasShot[j] || hasPerfect[j]) continue; /* 射击行与上靶行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = bgRe.test(win) || missRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"枪枪上靶"——零训练零失手，弹弹咬要害，等于告诉观众全剧的枪都装了制导'
        : 'instant marksman again - zero training, zero misses, every round finding its mark like the guns are guided',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"枪枪上靶"式技能开挂（${n} 处未救）——枪法零成本零失手，一次是爽点，第三次观众就看穿全剧的枪都长着眼睛。`
      : `${hitCount} instant-marksman beats (${n} unrescued) - marksmanship with zero training and zero misses. Once is a flex; by the third, every gun in the story has a guidance chip.`);
    advice.push(zh
      ? '枪战的张力来自距离、风速、手抖和弹药，不在弹道的听话程度。给每次命中补一道门槛：要么有来路（狙击手出身、拿过省运会冠军、当过八年武警——专业背景让精准合法，交代一句就是戏）、要么有失手（第一枪打偏了，第二枪屏住呼吸才中——失败让命中有重量）、要么有代价（打中了，但枪声引来了巡逻队，位置暴露了——每次开枪都在支付利息）、要么有过程（测风、装表尺、等目标转身——专业动作本身就是表演）。更高级的写法是"反神枪"：全片只留一枪真的百步穿杨，留给他这辈子最不能再失手的那一次。如果剧情需要一次爽快命中，把它留给唯一一次，并给对手一句"这距离，不可能"——观众要的不是弹道学讲义，是有人在替他们屏住呼吸。'
      : 'Gunfights get their tension from distance, wind, shaking hands and ammo count - not from how obedient the bullets are. Give every hit a toll: a source (ex-sniper, provincial champion, eight years in SWAT - a professional pedigree legitimizes precision, and one line of it is drama), a miss (the first shot went wide; the second landed only after a held breath - failure gives the hit weight), a price (the shot landed, but the muzzle flash gave away the position and patrols are converging - every trigger pull pays interest), or process (reading the wind, dialing the sights, waiting for the target to turn - the professional routine itself is performance). Better still, invert the legend: let the whole script hold exactly one true dead-eye shot, saved for the one moment he cannot afford to miss. If the story needs a breezy bullseye, save it for that single shot and let the opponent say "at this range? impossible" - the audience does not want a ballistics lecture, they want someone on screen holding their breath with them.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
