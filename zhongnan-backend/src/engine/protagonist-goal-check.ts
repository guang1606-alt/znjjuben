/**
 * 主角目标与行动链检测器（PRD 2.1.25 主角驱动过硬线）
 * ------------------------------------------------------------------
 * 短剧主角的唯一铁律：他必须"想要什么 + 被什么挡住 + 自己动手去争"。
 * 观众弃剧的主角问题集中在三类：
 *  1) 欲望隐形：开场 30% 看不到主角明确想要什么（想看下去的第一牵引力缺失）
 *  2) 主角被动：事情不断"发生在他身上"（被逼/只好/被告知），他不推动剧情
 *  3) 闭环断裂：立了目标却没有障碍（白日梦），或有目标却没有行动（空想家）
 *  4) 中段失焦：目标只在开头喊了一嗓子，25%-70% 黄金段再无欲望牵引
 *
 * 与现有引擎的分工：
 *  - character-balance-check: 检测"主角戏份占比"（量）
 *  - character-logic: 检测"人物行为是否符合人设"（一致性）
 *  - protagonist-goal-check (本引擎): 检测"主角是否在主动驱动因果链"（能动性）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type PgLang = 'zh' | 'en';

export interface ProtagonistGoalIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'invisible_desire'       // 开场欲望隐形
    | 'passive_protagonist'    // 主角被动
    | 'goal_no_obstacle'       // 有目标无障碍
    | 'goal_no_action'         // 有目标无行动
    | 'midpoint_goal_gap'      // 中段目标消失
    | 'goal_unresolved';       // 强烈目标尾段无兑付（低优先级，连续剧可集尾悬置）
  evidence: string;
  advice: string;
}

export interface DesireHit {
  marker: string;
  snippet: string;
  /** 归一化位置 0-1 */
  position: number;
  inHead: boolean;
  inMid: boolean;
  inTail: boolean;
}

export interface ProtagonistGoalResult {
  /** 主角驱动分 0-100（越高越好） */
  score: number;
  /** 欲望信号总数 */
  desireCount: number;
  /** 开场 30% 欲望信号数 */
  headDesireCount: number;
  desireHits: DesireHit[];
  /** 障碍/阻力信号数 */
  obstacleCount: number;
  /** 主角主动行动信号数 */
  actionCount: number;
  /** 被动反应信号数 */
  passiveCount: number;
  /** 目标兑付信号数 */
  payoffCount: number;
  /** 尾段（后 30%）兑付数 */
  tailPayoffCount: number;
  /** 目标-障碍-行动闭环是否成立 */
  hasGoalObstacleActionChain: boolean;
  /** 能动性比：主动行动 / (主动行动 + 被动反应)，范围 0-1 */
  agencyRatio: number;
  issues: ProtagonistGoalIssue[];
}

// —— 中文信号库 ——
// 欲望：第一人称的明确目标宣言。"我要"排除"我要是"（假设句）；"我得"排除"我得知/我得意/我得到"
const DESIRE_ZH = /(我想要|我要(?!是|不)|我必须|我一定要|我非得|我决定|我打算|我发誓|我非要|我的目标|我得(?:把|去|想办法|找到|救|查|拿|让|先|赶紧|马上|亲自)|我承诺|我保证|我绝不(?:能|会|允许))/g;
// 障碍：外部阻力直接作用于主角
const OBSTACLE_ZH = /(被拦|拦住|阻止|不准|不让|拒绝|碰壁|行不通|没门|休想|挡住|堵在|堵死|刁难|逼债|威胁|下最后通牒|设局|陷害|栽赃|撕毁|收回|撤资|被赶|开除|冷笑[着说]?[道:]?|一笔勾销|勾销|先还债|还不起|还不清|医药费|手术费|停药|停水(?:停电|停药)?|签了它|逼签|抵押物?|保证人|限你(?:\d+|[一二三四五六七八九十]+|明天|今晚|今天|这周|本周)?[天日]?[内之]?(?:答复|搬走|还钱|签字|腾房|走人)?|最后期限|抢(?:合同|文件|证据|手机|录音))/g;
// 主动行动：强动作动词（物理行动 + 策略行动），带方向性或对象，避免单字误伤
const ACTION_ZH = /(冲(?:了|上|进|到|向|过)|扑(?:了|上|向|到)|追(?:了|上|出去|到|向|过)?|推开|推开门|踹开|撞开|跑(?:到|进|向|去|下|上)|闯(?:进|入|到)|抢(?:过|到|下)|夺(?:过|回|走)|掏(?:出|起)|拨(?:通|打|了)|拨打|埋伏|蹲守|翻(?:墙|窗|遍|箱|出)|砸(?:开|向|在)|拽(?:住|开|走)|谈判|跪下|录音|偷拍|录像|调查(?:了|到|过)?|堵截|举报|自首|偷(?:偷|出|走|了)|藏(?:起|进|在)|找上门|堵(?:在|到|门)|复印|律师|经侦|取证|留证|报(?:案|警)|抱(?:进|紧|住)[^，。]{0,6}(?:文件|证据|合同|怀里)|护(?:住|着)?(?:文件|证据|合同)|后退(?:一步)?|寄(?:出|给)|递(?:给|交))/g;
// 被动：事情发生在主角身上，而非主角促成
const PASSIVE_ZH = /(被逼|被迫|迫于|只好|只能|无奈|不得不|眼睁睁|束手就擒|坐以待毙|任人|无计可施|没办法?只能|被(?:告知|通知|带走|赶出去|开除|抛弃|绑|抓))/g;
// 兑付：目标达成信号
const PAYOFF_ZH = /(终于(?:拿到|做到|成功|救回|找到|赢|离开|证明|夺回|报仇|逃)|成功(?:救|逃|拿|了|脱身)?|做到了|赢了|拿下|夺回|救出|得手|大仇得报|真相大白|沉冤得雪|证明了?清白|穿制服(?:的人)?(?:站|出现|赶到|上门|敲)|(?:警察|警官|民警|公安|经侦).{0,6}(?:上门|赶到|站在|出现|带走|拦住)|被(?:警方|警察|公安|民警).{0,4}带走|戴上手铐|铐(?:住|上|走)|押上(?:了)?警车)/g;

// —— 英文信号库 ——
const DESIRE_EN = /(i want|i need|i must|i have to|i('ve| have) got to|i('m| am) going to|i will(?! not)|i decide[ds]?|i swear|i vow|my goal|i promise|i('m| am) determined to)/gi;
const OBSTACLE_EN = /(blocked my|refused|denied|won't let|wouldn't let|stopped (?:me|him|her)|can't get|cannot get|no way|impossible|slammed the door|threatened (?:me|him|her)|blackmail|framed me|set (?:me|him) up|ambushed|cornered|shut (?:me|him) out|sign (?:it|the|here|now)|medical bills|debt (?:is|stays|remains)|wiped clean|collateral|guarantor|deadline|ultimatum|reaches for (?:the )?(?:contract|agreement|file|phone)|tries? to grab|by tomorrow)/gi;
const ACTION_EN = /(rushed|ran (?:to|toward|after|into|down|up|for)|chased|pushed (?:open|through|past)|kicked (?:open|down|the door)|burst(?:s|ed)? (?:in|into|through)|snatched|grabbed|punched|slammed|dialed|called (?:him|her|them|the police)|hid in|waited in ambush|ambushed|broke into|climbed (?:over|through|out)|leaped|lunged|negotiated|recorded (?:it|him|her)|filmed|reported (?:him|her|them) to|turned (?:him|her|them) in|confronted|snatches|grabs|rushes|dials|films|confronts|recording (?:it|him|her|his|their|the|voice)|records (?:it|him|her|his)|(?:have|has|had|made) copies|lawyer|economic crimes|reports (?:him|her|them) to|pressed charges)/gi;
const PASSIVE_EN = /(was forced|had no choice|could only|could do nothing|helplessly|watched helplessly|was told|was informed|was fired|was kicked out|powerless|reluctantly|no choice but)/gi;
const PAYOFF_EN = /(finally (?:got|did|found|won|saved|escaped|proved|recovered)|succeeded|made it|got (?:him|her|them) back|(?:i|we|he|she) won|rescued|pulled it off|cleared (?:my|his|her) name|proved (?:my|his|her) innocence|uniformed officers?|police (?:arrive|arrives|stand|stands|knock|knocks)|officers? (?:stand|arrive|knock)|(?:was|were|is|are) arrested|handcuffed|led away by (?:the )?police|cuffs (?:click|go) on)/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function countMatches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

function snippetAt(text: string, idx: number, len = 24): string {
  const start = Math.max(0, idx - 6);
  const end = Math.min(text.length, idx + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * 主角目标与行动链检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function protagonistGoalCheck(text: string, lang: PgLang): ProtagonistGoalResult {
  if (!text || text.trim().length < 20) {
    return {
      score: 100,
      desireCount: 0,
      headDesireCount: 0,
      desireHits: [],
      obstacleCount: 0,
      actionCount: 0,
      passiveCount: 0,
      payoffCount: 0,
      tailPayoffCount: 0,
      hasGoalObstacleActionChain: false,
      agencyRatio: 1,
      issues: [],
    };
  }

  const issues: ProtagonistGoalIssue[] = [];
  const total = text.length || 1;
  const isZh = lang === 'zh';

  const desireRe = isZh ? DESIRE_ZH : DESIRE_EN;
  const obstacleRe = isZh ? OBSTACLE_ZH : OBSTACLE_EN;
  const actionRe = isZh ? ACTION_ZH : ACTION_EN;
  const passiveRe = isZh ? PASSIVE_ZH : PASSIVE_EN;
  const payoffRe = isZh ? PAYOFF_ZH : PAYOFF_EN;

  // —— 欲望命中（记录位置，区分开场/中段/尾段） ——
  const desireHits: DesireHit[] = [];
  let m: RegExpExecArray | null;
  desireRe.lastIndex = 0;
  while ((m = desireRe.exec(text)) !== null) {
    const position = m.index / total;
    desireHits.push({
      marker: m[0],
      snippet: snippetAt(text, m.index),
      position,
      inHead: position < 0.3,
      inMid: position >= 0.25 && position < 0.7,
      inTail: position >= 0.7,
    });
    if (m.index === desireRe.lastIndex) desireRe.lastIndex++;
  }

  // —— 尾段兑付命中 ——
  const payoffHits: number[] = [];
  payoffRe.lastIndex = 0;
  while ((m = payoffRe.exec(text)) !== null) {
    payoffHits.push(m.index / total);
    if (m.index === payoffRe.lastIndex) payoffRe.lastIndex++;
  }

  const obstacleCount = countMatches(text, obstacleRe).length;
  const actionCount = countMatches(text, actionRe).length;
  const passiveMarkers = countMatches(text, passiveRe);
  const passiveCount = passiveMarkers.length;

  const headDesireCount = desireHits.filter((h) => h.inHead).length;
  const midDesireCount = desireHits.filter((h) => h.inMid).length;
  const tailPayoffCount = payoffHits.filter((p) => p >= 0.7).length;
  const hasGoalObstacleActionChain = desireHits.length >= 1 && obstacleCount >= 1 && actionCount >= 1;
  const agencyRatio = actionCount + passiveCount === 0 ? 1 : actionCount / (actionCount + passiveCount);

  let penalty = 0;

  // 1) 欲望隐形：开场 30% 零欲望且全文欲望信号 <2 —— 短剧开场必须让观众知道主角要什么
  if (headDesireCount === 0 && desireHits.length < 2) {
    penalty += 30;
    issues.push({
      severity: 'high',
      type: 'invisible_desire',
      evidence: isZh
        ? `开场 30% 无任何"我要/我必须/我决定"目标宣言，全文仅 ${desireHits.length} 处欲望信号`
        : `No goal statement ("I want/I must/I will") in the opening 30%; only ${desireHits.length} desire signal(s) total`,
      advice: isZh
        ? '开场必须让主角的欲望"可听见"：用一句第一人称狠话/哀求把他要什么、要不到会怎样讲清楚（"我必须在三天内拿到十万，否则我妈停药"）。短剧观众前 10 秒就要知道主角图什么。'
        : 'Make the protagonist\'s desire audible in the opening: a first-person line stating what they want and the cost of failure ("I must get $10k in three days or they cut my mother\'s meds"). Short-drama viewers need the want within the first 10 seconds.',
    });
  }

  // 2) 主角被动：被动信号 ≥3 且被动数量压过主动行动
  if (passiveCount >= 3 && passiveCount >= actionCount) {
    penalty += 25;
    issues.push({
      severity: 'high',
      type: 'passive_protagonist',
      evidence: isZh
        ? `被动反应 ${passiveCount} 次（被逼/只好/被告知），主动行动仅 ${actionCount} 次，能动性比 ${(agencyRatio * 100) | 0}%`
        : `${passiveCount} passive beats (forced/had no choice/was told) vs ${actionCount} active moves; agency ratio ${(agencyRatio * 100) | 0}%`,
      advice: isZh
        ? '主角被剧情推着走。每一次"被逼/只好"之后，给他一个反制动作：被开除→当场录音取证；被赶出→雨夜堵人对峙。被动处境可以有，但回应必须主动，且最好是主角的计谋而非情绪。'
        : 'The protagonist is carried by the plot. After every "forced/had no choice" beat, give a counter-move: fired → secretly record it; thrown out → confront in the rain with leverage. The situation may be passive; the response must be active, ideally a plan rather than a tantrum.',
    });
  }

  // 3) 有目标无障碍：欲望 ≥2 却看不到阻力——愿望没有代价
  if (desireHits.length >= 2 && obstacleCount === 0) {
    penalty += 15;
    issues.push({
      severity: 'mid',
      type: 'goal_no_obstacle',
      evidence: isZh ? `${desireHits.length} 处目标宣言，0 处外部阻力` : `${desireHits.length} goal statements, 0 obstacles`,
      advice: isZh
        ? '主角想要什么观众知道了，但没人挡他。立刻立一个"具体且强大"的阻力：一个能当场拒绝他的人、一道锁上的门、一个死线。欲望越值钱，障碍越要狠。'
        : 'The audience knows what the protagonist wants, but nothing blocks him. Add a concrete, powerful obstacle: someone who can say no to his face, a locked door, a deadline. The more valuable the goal, the tougher the resistance.',
    });
  }

  // 4) 有目标无行动：喊目标却从不动手——空想家主角
  if (desireHits.length >= 2 && actionCount === 0) {
    penalty += 15;
    issues.push({
      severity: 'mid',
      type: 'goal_no_action',
      evidence: isZh ? `${desireHits.length} 处目标宣言，0 个强动作（冲/追/闯/谈判/取证）` : `${desireHits.length} goal statements, 0 strong action verbs`,
      advice: isZh
        ? '主角只会表决心，没有动作。把每一句"我一定要"后跟一个可拍摄的具体行动（推门、拨电话、翻窗、下跪、录音），让欲望立刻变成肢体动作。'
        : 'The protagonist only declares intent, never moves. Follow every "I will" with a filmable action (push through a door, make the call, climb through a window, kneel, press record) so desire instantly becomes motion.',
    });
  }

  // 5) 中段失焦：欲望信号 ≥2 但 25%-70% 黄金段零欲望牵引
  if (desireHits.length >= 2 && midDesireCount === 0) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'midpoint_goal_gap',
      evidence: isZh ? `目标宣言集中在首尾，中段 25%-70% 无欲望牵引` : `Goal statements cluster at the ends; none in the 25%-70% middle band`,
      advice: isZh
        ? '中段主角的目标"消失"了，剧情会散。让他在中段升级或改写目标（从"借钱"到"查清谁在设局"），至少安排一次主动提起目标的台词或为目标付出的代价。'
        : 'The goal vanishes in the middle and the story drifts. Escalate or reframe it mid-script (from "borrow money" to "find out who set me up"), with at least one line restating the goal or a price paid for it.',
    });
  }

  // 6) 强烈目标尾段无兑付（低优先级）：≥3 处欲望且尾段 0 兑付——连续剧可集尾悬置，故仅轻度提示
  if (desireHits.length >= 3 && tailPayoffCount === 0 && payoffHits.length === 0) {
    penalty += 5;
    issues.push({
      severity: 'low',
      type: 'goal_unresolved',
      evidence: isZh ? `${desireHits.length} 处强烈欲望，全片 0 兑付信号` : `${desireHits.length} strong desire signals, 0 payoff signals`,
      advice: isZh
        ? '主角想要的东西本集毫无进展。若为集尾悬念，确认钩子确实指向"下一步行动"；否则至少给一个局部小兑付（拿到线索/扳回一城），让观众感到目标在逼近。'
        : 'The protagonist makes zero progress toward the goal. If this is a cliffhanger, make sure the hook points to the next move; otherwise grant a partial win (a clue, a small reversal) so the goal feels closer.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    desireCount: desireHits.length,
    headDesireCount,
    desireHits: desireHits.slice(0, 8),
    obstacleCount,
    actionCount,
    passiveCount,
    payoffCount: payoffHits.length,
    tailPayoffCount,
    hasGoalObstacleActionChain,
    agencyRatio: Math.round(agencyRatio * 100) / 100,
    issues,
  };
}
