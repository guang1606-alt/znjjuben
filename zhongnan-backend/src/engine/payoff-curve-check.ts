/**
 * payoff-curve-check.ts —— 爽点蓄力曲线检测器（v2.348，真人实拍短剧本内核）
 * ------------------------------------------------------------------
 * 短剧铁律的位置形状：开头 1/3 压抑蓄力（憋），后 1/3 集中释放（爆）。
 * 观众追剧的动力曲线是「落差斜率」——蓄力堆得越深、爆发来得越狠，越过瘾。
 *
 * 与现有引擎的分工（不重复造轮子）：
 *  - cool-moment-score：爽点"数量/三段分布/强度/多样性/hasBuildup(布尔)"
 *    ——查"有没有爽点、有没有蓄力"，但 hasBuildup 只是布尔，不看蓄力堆在哪段。
 *  - payoff-rhythm-check：受压↔释放的"配对关系/时间间隔/兑付对等"（双边节奏）
 *    ——查"压了有没有还、还得够不够"，但不看蓄力密度的段落配比。
 *  - payoff-curve-check（本引擎）：蓄力与爆发在全文 0-1 位置上的"形状"——
 *    前段蓄力密度应 ≥ 后段蓄力密度、后段爽点密度应 ≥ 前段爽点密度、
 *    落差斜率（尾段爽点强度 - 头段蓄力深度的反向差）应足够陡。
 *    倒置稿（开头就爆、结尾干憋）是现有引擎的盲区，本引擎补位。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type PcLang = 'zh' | 'en';

export interface PayoffCurveIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'front_loaded_burst'      // 开头就爆：前 1/3 爽点密、蓄力稀（爽得没有支点）
    | 'tail_no_payoff'          // 结尾干憋：后 1/3 有蓄力但零爽点兑付
    | 'tail_suppression_pileup' // 蓄力错配：蓄力全堆在后段（该爆的位置还在憋）
    | 'flat_curve';             // 曲线平：蓄力/爽点在前后段密度几乎无差（无落差）
  evidence: string;
  advice: string;
}

export interface PayoffCurveResult {
  /** 蓄力曲线分 0-100（越高越接近"前憋后爆"理想形状） */
  score: number;
  /** 前段（0-0.4）蓄力信号密度（每千字蓄力数×100，归一化） */
  headBuildup: number;
  /** 后段（0.6-1.0）蓄力信号密度 */
  tailBuildup: number;
  /** 前段爽点信号密度 */
  headPayoff: number;
  /** 后段爽点信号密度 */
  tailPayoff: number;
  /** 落差斜率：(tailPayoff - headPayoff) + (headBuildup - tailBuildup)，越正越健康 */
  curveSlope: number;
  issues: PayoffCurveIssue[];
}

// —— 中文信号库 ——
// 蓄力（憋屈/压制/受辱铺垫）：主角侧吃亏、被压、忍辱（与 payoffRhythm 的 SUPPRESS 同族但聚焦"铺垫感"）
const BUILDUP_ZH = /(憋屈|压抑|忍辱|忍气吞声|委曲求全|低声下气|忍辱负重|含泪|咬牙|咽下|吞[下着]|咽[下这]|被退婚|被甩|被赶|扫地出门|被开除|被冤枉|被嘲笑|被嘲讽|被当众|被踩|走投无路|被逼到?绝境|绝望|痛哭|委屈|难堪|下不来台|身无分文|破产|负债|被关|被绑|被推|被扇|挨了?一?巴掌|挨耳光|被泼|账户被冻结|被迫下跪|逼.{0,3}跪|废物|穷鬼|你配吗|配不上|高攀不起|给我滚)/g;
// 爆发（爽点/翻盘/打脸兑付）：与 cool-moment 同族
const PAYOFF_ZH = /(一巴掌|扇|耳光|泼[了水一脸]|砸[在向下来]|掀[翻桌了]|摔[杯子门]|怒怼|当场打脸|打脸|翻盘|反杀|绝地反击|咸鱼翻身|逆风翻盘|碾压|完胜|吊打|真相大白|身份揭晓|揭开|戳穿|揭穿|拆穿|亮出?(?:黑卡|股份|合同|证据)|原来是?(?:总裁|董事长|首富|大佬|继承人)|恢复身份|收购|撤资|当场(?:逮捕|抓走|铐上)|跪地求饶|跪下求|下跪道歉|全场(?:震惊|哗然|死寂)|所有人(?:都)?(?:震惊|傻了|呆住)|倒吸一?口?凉气|扬眉吐气|大仇得报|自食其果|恶有恶报)/g;

// —— 英文信号库 ——
const BUILDUP_EN = /(jilted|called off the (?:wedding|engagement)|humiliat(?:ed|ing)|kicked (?:me|him|her) out|evicted|wrongfully accused|framed|betrayed|cheated on|nowhere to (?:go|turn)|desperate|in despair|devastat(?:ed|ing)|tears (?:streamed|fell|welled)|burst into tears|sobbed|bankrupt|drowned in debt|slapped (?:me|her|him) across|forced to (?:kneel|leave)|get on your knees|ordered (?:me|her|him) to kneel|you('re| are) (?:nothing|trash|worthless|a loser|nobody)|you don't deserve|get out|froze (?:my|his|her) accounts|fired (?:me|him|her) on the spot|divorce papers|swallow(ed)? (?:your|his|her) pride|bite (?:your|his|her) lip|suffer(?:ed)? in silence)/gi;
const PAYOFF_EN = /(slap|smack|backhand|flipped the table|face-slap|counterattack(?:ed)?|turned the tables|made a comeback|revenge was|crushed (?:him|her|them)|destroyed (?:him|her|them)|outsmarted|won it all back|reclaimed|vindicated|begged for mercy|dropped to (?:his|her|the) knees|knelt and begged|everyone (?:was|went) (?:shocked|stunned|silent)|the whole room (?:gasped|fell silent)|stunned silence|gasped in shock|revealed (?:his|her|the) (?:true )?identity|turned out to be the (?:CEO|chairman|billionaire|heir)|acquired the company|pulled (?:his|her|their) funding|arrested on the spot|handcuffed|the truth came out|truth was revealed|exposed|unmasked)/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** 统计信号在 [lo, hi) 位置区间内的命中密度（命中数 / 区间字数 × 100，归一化便于跨稿比较） */
function densityInRange(text: string, re: RegExp, lo: number, hi: number): number {
  const len = Math.max(1, text.length);
  const start = Math.floor(len * lo);
  const end = Math.ceil(len * hi);
  const segLen = Math.max(1, end - start);
  let count = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const pos = m.index / len;
    if (pos >= lo && pos < hi) count++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return (count / segLen) * 100 * 10; // ×10 放大便于斜率可读
}

/**
 * 爽点蓄力曲线检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function payoffCurveCheck(text: string, lang: PcLang = 'zh'): PayoffCurveResult {
  if (!text || text.trim().length < 20) {
    return { score: 100, headBuildup: 0, tailBuildup: 0, headPayoff: 0, tailPayoff: 0, curveSlope: 0, issues: [] };
  }

  const isZh = lang === 'zh';
  const buildupRe = isZh ? BUILDUP_ZH : BUILDUP_EN;
  const payoffRe = isZh ? PAYOFF_ZH : PAYOFF_EN;
  const issues: PayoffCurveIssue[] = [];

  // 三段切分：前段 0-0.4（蓄力区）、中段 0.4-0.6（过渡）、后段 0.6-1.0（爆发区）
  const headBuildup = densityInRange(text, buildupRe, 0, 0.4);
  const tailBuildup = densityInRange(text, buildupRe, 0.6, 1.0);
  const headPayoff = densityInRange(text, payoffRe, 0, 0.4);
  const tailPayoff = densityInRange(text, payoffRe, 0.6, 1.0);

  // 落差斜率：后段爽点比前段多（+）+ 前段蓄力比后段多（+）→ 越正越接近"前憋后爆"
  const curveSlope = Math.round((tailPayoff - headPayoff) + (headBuildup - tailBuildup));

  let penalty = 0;

  // 1) 开头就爆：前段爽点密度显著高于后段（爽点前置，爽得没有支点，后段没货）
  if (headPayoff > 0 && headPayoff > tailPayoff * 1.5 && headPayoff - tailPayoff > 0.5) {
    penalty += 20;
    issues.push({
      severity: 'high',
      type: 'front_loaded_burst',
      evidence: isZh
        ? `前段爽点密度 ${headPayoff.toFixed(1)} > 后段 ${tailPayoff.toFixed(1)}（爽点全堆开头）`
        : `Head payoff density ${headPayoff.toFixed(1)} > tail ${tailPayoff.toFixed(1)} (all payoff up front)`,
      advice: isZh
        ? '开头就把大招放完，后段就没东西可看了——观众刷到一半就走。短剧的大招要憋到后 1/3：开头先让主角吃亏受辱蓄力，把打脸/身份揭晓/碾压留到尾段集中爆发。先把弹簧按到最底，弹起来才最高。'
        : 'Spend your biggest payoff in the opening and the back half has nothing left — viewers swipe away mid-episode. Save the trump card for the final third: let the protagonist suffer and build pressure early, then detonate the face-slap, identity reveal, and crush in the tail. Press the spring all the way down before it snaps.',
    });
  }

  // 2) 结尾干憋：后段有蓄力信号但零爽点兑付（憋到结尾不给药，观众带憋屈退场）
  if (tailBuildup > 0.3 && tailPayoff === 0) {
    penalty += 22;
    issues.push({
      severity: 'high',
      type: 'tail_no_payoff',
      evidence: isZh
        ? `后段蓄力密度 ${tailBuildup.toFixed(1)}，但后段爽点密度为 0（憋到结尾没翻盘）`
        : `Tail buildup ${tailBuildup.toFixed(1)}, tail payoff 0 (pressure built but never released)`,
      advice: isZh
        ? '短剧的最后一口必须是甜的。后段还在压主角却不给翻盘，观众会带着憋屈退出、不给下一集。后 1/3 必须安排至少一次对等强兑付：当场打脸/身份压人/反派跪求/当场抓捕。本集可以留钩子，但必须先给一次明确的小胜。'
        : 'The last taste of a short drama must be sweet. If the final third pins the protagonist down without a flip, the viewer exits frustrated. The last third must deliver at least one equal-or-greater payoff: an on-the-spot face-slap, identity flex, the villain begging, an arrest. You may keep a hook — but give one clear win first.',
    });
  }

  // 3) 蓄力错配：蓄力全堆在后段（该爆的位置还在憋，节奏倒置）
  if (tailBuildup > 0.5 && tailBuildup > headBuildup * 1.5 && tailPayoff < headPayoff) {
    penalty += 15;
    issues.push({
      severity: 'mid',
      type: 'tail_suppression_pileup',
      evidence: isZh
        ? `后段蓄力密度 ${tailBuildup.toFixed(1)} > 前段 ${headBuildup.toFixed(1)}（蓄力全堆后段，该爆的位置还在憋）`
        : `Tail buildup ${tailBuildup.toFixed(1)} > head ${headBuildup.toFixed(1)} (pressure piled into the payoff zone)`,
      advice: isZh
        ? '蓄力要堆在前段，爆发要放在后段——位置反了就是节奏倒置。把后段的受辱/压制往前挪，让主角开头就被逼到墙角；后段腾出来给翻盘和打脸。前憋后爆，落差才够陡。'
        : 'Pressure belongs up front, payoff belongs at the back — swap them and the rhythm inverts. Move the late humiliation and suppression earlier so the protagonist is cornered from the start; free the tail for the flip and the face-slap. Build early, explode late.',
    });
  }

  // 4) 曲线平：蓄力/爽点在前后段几乎无密度差（无落差，像流水账）
  const totalSignal = headBuildup + tailBuildup + headPayoff + tailPayoff;
  if (totalSignal > 1.0 && Math.abs(curveSlope) < 0.4 && issues.length === 0) {
    penalty += 10;
    issues.push({
      severity: 'low',
      type: 'flat_curve',
      evidence: isZh
        ? `落差斜率 ${curveSlope}（蓄力/爽点在前后段几乎无密度差，曲线平）`
        : `Curve slope ${curveSlope} (buildup/payoff evenly smeared — no gradient)`,
      advice: isZh
        ? '有蓄力也有爽点，但前后段撒得一样匀，就像没有起伏的流水账。把憋屈感往前段集中、把爽点往后段集中，人为做出"前低后高"的落差斜率——观众要的是爬坡后的一脚踩空。'
        : 'You have buildup and payoff, but smeared evenly — a flat line reads like a chronicle. Concentrate the suffering up front and the payoffs at the back to manufacture a rising gradient — the audience wants the drop after the climb.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    headBuildup: Math.round(headBuildup * 10) / 10,
    tailBuildup: Math.round(tailBuildup * 10) / 10,
    headPayoff: Math.round(headPayoff * 10) / 10,
    tailPayoff: Math.round(tailPayoff * 10) / 10,
    curveSlope,
    issues,
  };
}

/**
 * v2.392 前置教学函数：与 payoffCurveCheck 同源
 * 四类形状病的 severity / 触发阈值 / 扣分 100% 对齐引擎源码
 * 撰写师+润色师首轮注入，让阈值口径前置而不是写完再打回
 */
export function buildPayoffCurveDirective(_format: 'LIVE' | 'AIGC' = 'LIVE', lang: PcLang = 'zh'): string {
  if (lang === 'en') {
    return [
      '[Pre-writing rule · payoff buildup curve (sibling to payoffCurveCheck)]',
      'Short-drama law of position and shape — pent-up buildup in the first third, concentrated release in the last third. Four shape diseases; severity, trigger and penalty all mirror the detector:',
      '',
      'front_loaded_burst | high | head payoff density > tail × 1.5 and gap > 0.5 → -20 points',
      'tail_no_payoff | high | tail buildup density > 0.3 and tail payoff = 0 → -22 points',
      'tail_suppression_pileup | mid | tail buildup > 0.5 and tail buildup > head × 1.5 and tail payoff < head payoff → -15 points',
      'flat_curve | low | total signal > 1.0 and |curve slope| < 0.4 with no other issue → -10 points',
      '',
      'Three segments: head 0-0.4 (buildup zone) / middle 0.4-0.6 (transition) / tail 0.6-1.0 (payoff zone)',
      'Curve slope = (tail payoff - head payoff) + (head buildup - tail buildup); more positive is healthier',
      'Exemption: skip when text < 20 chars; a clean script scores 100',
      'Score formula: score = clamp(100 - penalty, 0, 100)',
      'Shape mantra: build low early, explode late — press the spring all the way down before releasing.',
    ].join('\n');
  }
  return [
    '【前置教学·爽点蓄力曲线（PayoffCurveCheck 同源·v2.392）】',
    '短剧铁律的位置形状：前 1/3 压抑蓄力（憋），后 1/3 集中释放（爆）。四类形状病——severity / 触发阈值 / 扣分与引擎 100% 对齐：',
    '',
    'front_loaded_burst | high | 前段爽点密度 > 后段 × 1.5 且 差值 > 0.5 → 扣 20 分',
    'tail_no_payoff | high | 后段蓄力密度 > 0.3 且 后段爽点 = 0 → 扣 22 分',
    'tail_suppression_pileup | mid | 后段蓄力 > 0.5 且 后段蓄力 > 前段 × 1.5 且 后段爽点 < 前段爽点 → 扣 15 分',
    'flat_curve | low | 总信号 > 1.0 且 |落差斜率| < 0.4 且无其他问题 → 扣 10 分',
    '',
    '三段切分：前段 0-0.4（蓄力区）/ 中段 0.4-0.6（过渡）/ 后段 0.6-1.0（爆发区）',
    '落差斜率 = (后段爽点 - 前段爽点) + (前段蓄力 - 后段蓄力)，越正越健康',
    '豁免：正文 < 20 字不评；零问题满分 100',
    '评分公式：score = clamp(100 - penalty, 0, 100)',
    '形状口诀：前憋后爆，弹簧按到最底再松手——开头先让主角吃亏受辱，把打脸/身份揭晓/碾压留到尾段集中爆发',
  ].join('\n');
}
