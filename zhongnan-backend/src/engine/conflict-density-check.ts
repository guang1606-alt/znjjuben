/**
 * 冲突密度与升级检测器（PRD 2.1.13 短剧驱动力生死线）
 * ------------------------------------------------------------------
 * 短剧的核心驱动力是冲突——没有冲突就没有故事，冲突不升级用户就弃剧。
 *
 * rhythm.ts 只检测"有没有冲突信号"（conflictCount >= 2），但不区分：
 *  - 冲突强度（口角 < 对峙 < 肢体冲突 < 生死对抗）
 *  - 冲突分布（开头/中段/结尾是否各有冲突）
 *  - 冲突升级（单集内冲突是否从小到大升级）
 *  - 冲突多样性（情感/利益/权力/身份/生死）
 *  - 冲突解决节奏（小型冲突当集解决，大型冲突跨集）
 *
 * cool-moment-score.ts 检测"爽点密度"，但爽点 ≠ 冲突：
 *  - 有些爽点不一定是冲突（如装逼/财富炫耀可能没有对抗）
 *  - 有些冲突不一定是爽点（如主角被欺负，是冲突但不爽）
 *
 * 本引擎专注于冲突本身的密度、强度、升级和多样性评估。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type CdLang = 'zh' | 'en';

export interface ConflictIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 冲突强度等级 */
export type ConflictLevel =
  | 'verbal'       // 口角：吵/骂/怼/反驳（强度 30）
  | 'confront'     // 对峙：拦/挡/推/抢/怒/吼/对峙（强度 55）
  | 'physical'     // 肢体冲突：打/摔/砸/撕/踹/扇/泼/掀（强度 80）
  | 'life_death';  // 生死对抗：杀/威胁生命/坠楼/毒/枪/刀（强度 95）

/** 冲突类型 */
export type ConflictCategory =
  | 'emotional'    // 情感冲突：分手/出轨/背叛/离婚/怀孕
  | 'interest'     // 利益冲突：钱/合同/支票/收购/遗产/股份
  | 'power'        // 权力冲突：开除/解雇/跪/求饶/滚/闭嘴
  | 'identity'     // 身份冲突：身份/真相/秘密/揭露/穿/戳/露
  | 'life_death';  // 生死冲突：杀/坠楼/毒/枪/刀/威胁生命

export interface ConflictHit {
  /** 冲突强度等级 */
  level: ConflictLevel;
  levelLabel: string;
  /** 冲突类型 */
  category: ConflictCategory;
  categoryLabel: string;
  /** 冲突原文片段 */
  snippet: string;
  /** 位置 0-1（在全文中的相对位置） */
  position: number;
  /** 强度数值 0-100 */
  strength: number;
}

export interface ConflictDensityResult {
  /** 冲突密度分 0-100（越高越好） */
  score: number;
  /** 命中的冲突列表 */
  hits: ConflictHit[];
  /** 冲突总数 */
  count: number;
  /** 最高冲突等级 */
  maxLevel: ConflictLevel;
  /** 冲突类型多样性（不重复的类型数） */
  variety: number;
  /** 三段分布：开头/中段/结尾各有几个冲突 */
  distribution: { head: number; mid: number; tail: number };
  /** 是否有冲突升级（强度递增） */
  hasEscalation: boolean;
  /** 冲突强度序列（按位置排序的强度值） */
  strengthCurve: number[];
  issues: ConflictIssue[];
}

// —— 中文冲突信号模式（按强度从低到高） ——
const SIGNALS_ZH: { level: ConflictLevel; category: ConflictCategory; label: string; catLabel: string; re: RegExp; strength: number }[] = [
  // 口角（强度 30）：吵/骂/怼/反驳/质问
  { level: 'verbal', category: 'emotional', label: '口角', catLabel: '情感口角', re: /(吵|骂|怼|反驳|质问|争吵|抱怨|指责|埋怨|你凭什么|你算什么|你以为|你算老几|闭嘴|滚蛋|胡说|放屁|废话|少废话)/, strength: 30 },
  { level: 'verbal', category: 'interest', label: '口角', catLabel: '利益口角', re: /(不[给同意]差钱|还钱|欠[钱债]|赖账|不还|少一分|一分不少|我的钱|你的钱|股份|分红|合同|签字)/, strength: 30 },
  { level: 'verbal', category: 'power', label: '口角', catLabel: '权力口角', re: /(开除|解雇|辞退|炒鱿鱼|收拾东西|走人|不用来了|你被|撤职|降职|调离)/, strength: 30 },

  // 对峙（强度 55）：拦/挡/推/抢/怒/吼/对峙
  { level: 'confront', category: 'emotional', label: '对峙', catLabel: '情感对峙', re: /(拦|挡|推|抢|怒|吼|对峙|逼|威胁|警告|你不[配敢]|休想|做梦|不可能|凭什么|你敢|你想怎样)/, strength: 55 },
  { level: 'confront', category: 'power', label: '对峙', catLabel: '权力对峙', re: /(跪|求[饶谅]|跪下|跪着|求你|放[过我]|饶了|放过我|别[这那样]|你不能|你不可以|不允许|不准|不许)/, strength: 55 },
  { level: 'confront', category: 'identity', label: '对峙', catLabel: '身份对峙', re: /(身份|真相|秘密|隐瞒|欺骗|撒谎|坦白|你骗|你撒谎|你瞒着|你骗我|你骗了多少年)/, strength: 55 },

  // 肢体冲突（强度 80）：打/摔/砸/撕/踹/扇/泼/掀
  { level: 'physical', category: 'emotional', label: '肢体冲突', catLabel: '情感肢体', re: /(一巴掌|扇[了耳]|耳光|打[了在]|踹|踢|摔[杯子门]|砸[东西]|撕|掀[翻桌]|泼[了水]|拽|揪|扯|扭打|动手|拳头|捶|掐|拧)/, strength: 80 },
  { level: 'physical', category: 'interest', label: '肢体冲突', catLabel: '利益肢体', re: /(抢[夺走]|夺|劫|勒索|敲诈|强占|霸占|侵吞|挪用|贪污|卷款|卷走|私吞)/, strength: 80 },

  // 生死对抗（强度 95）：杀/威胁生命/坠楼/毒/枪/刀
  { level: 'life_death', category: 'life_death', label: '生死对抗', catLabel: '生死对抗', re: /(杀|死|杀[了人]|杀人|灭口|坠楼|跳楼|跳下去|毒|下毒|投毒|枪|开枪|刀|捅|刺|绞[杀死]|勒死|淹死|烧死|活埋|灭门|同归于尽)/, strength: 95 },
];

// —— 英文冲突信号模式 ——
const SIGNALS_EN: { level: ConflictLevel; category: ConflictCategory; label: string; catLabel: string; re: RegExp; strength: number }[] = [
  // 口角（强度 30）
  { level: 'verbal', category: 'emotional', label: 'Verbal', catLabel: 'Emotional Verbal', re: /\b(argue|yell|scold|retort|question|complain|accuse|blame|who do you think|shut up|get out|nonsense|bullshit|stop talking)\b/i, strength: 30 },
  { level: 'verbal', category: 'interest', label: 'Verbal', catLabel: 'Interest Verbal', re: /\b(pay (up|me)|owe|debt|not a cent|my money|your money|shares|dividend|contract|sign)\b/i, strength: 30 },
  { level: 'verbal', category: 'power', label: 'Verbal', catLabel: 'Power Verbal', re: /\b(fire|fired|sacked|dismissed|terminated|pack up|you're done|transfer|demote)\b/i, strength: 30 },

  // 对峙（强度 55）
  { level: 'confront', category: 'emotional', label: 'Confront', catLabel: 'Emotional Confront', re: /\b(block|push|grab|anger|shout|confront|threaten|warn|you can't|don't you dare|in your dreams|no way|why should I)\b/i, strength: 55 },
  { level: 'confront', category: 'power', label: 'Confront', catLabel: 'Power Confront', re: /\b(kneel|beg (for )?(mercy|forgiveness)|kneel down|spare|let (me|him|her) go|don't do this|not allowed|forbidden)\b/i, strength: 55 },
  { level: 'confront', category: 'identity', label: 'Confront', catLabel: 'Identity Confront', re: /\b(identity|truth|secret|hide|deceive|lie|confess|you lied|you're lying|you hid|how long have you lied)\b/i, strength: 55 },

  // 肢体冲突（强度 80）
  { level: 'physical', category: 'emotional', label: 'Physical', catLabel: 'Emotional Physical', re: /\b(slap|smack|punch|kick|smash|tear|flip|pour|drag|grab|pull|fight|fist|pound|pinch|twist)\b/i, strength: 80 },
  { level: 'physical', category: 'interest', label: 'Physical', catLabel: 'Interest Physical', re: /\b(snatch|seize|rob|extort|blackmail|embezzle|misappropriate|abscond|pocket|swindle)\b/i, strength: 80 },

  // 生死对抗（强度 95）
  { level: 'life_death', category: 'life_death', label: 'Life/Death', catLabel: 'Life/Death', re: /\b(kill|murder|silence|fall (off|from)|jump|poison|gun|shoot|stab|strangle|drown|burn (alive)|bury (alive)|massacre|die together)\b/i, strength: 95 },
];

/**
 * 主函数：评估冲突密度与升级
 * @param text 成稿全文
 * @param lang 中英文
 */
export function conflictDensityCheck(text: string, lang: CdLang = 'zh'): ConflictDensityResult {
  const signals = lang === 'en' ? SIGNALS_EN : SIGNALS_ZH;
  const textLen = Math.max(1, text.length);

  const hits: ConflictHit[] = [];

  // 全文扫描所有冲突信号
  for (const sig of signals) {
    const re = new RegExp(sig.re.source, sig.re.flags.includes('g') ? sig.re.flags : sig.re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      const start = Math.max(0, idx - 10);
      const end = Math.min(textLen, idx + m[0].length + 10);
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim();
      hits.push({
        level: sig.level,
        levelLabel: sig.label,
        category: sig.category,
        categoryLabel: sig.catLabel,
        snippet,
        position: Number((idx / textLen).toFixed(2)),
        strength: sig.strength,
      });
      // 防止零长度匹配死循环
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // 按位置排序
  hits.sort((a, b) => a.position - b.position);

  // 去重：同一位置（±0.03）只保留强度最高的
  const deduped: ConflictHit[] = [];
  for (const h of hits) {
    const nearby = deduped.find((d) => Math.abs(d.position - h.position) < 0.03);
    if (nearby) {
      if (h.strength > nearby.strength) {
        Object.assign(nearby, h);
      }
    } else {
      deduped.push({ ...h });
    }
  }

  // 三段分布：0-0.33 开头，0.33-0.66 中段，0.66-1.0 结尾
  const distribution = { head: 0, mid: 0, tail: 0 };
  for (const h of deduped) {
    if (h.position < 0.33) distribution.head++;
    else if (h.position < 0.66) distribution.mid++;
    else distribution.tail++;
  }

  // 冲突强度序列（按位置排序）
  const strengthCurve = deduped.map((h) => h.strength);

  // 冲突升级检测：强度序列是否整体递增（允许局部波动）
  // 简化判断：后半段平均强度 > 前半段平均强度
  const hasEscalation = (() => {
    if (deduped.length < 2) return false;
    const half = Math.floor(deduped.length / 2);
    const firstHalfAvg = deduped.slice(0, half).reduce((s, h) => s + h.strength, 0) / Math.max(1, half);
    const secondHalfAvg = deduped.slice(half).reduce((s, h) => s + h.strength, 0) / Math.max(1, deduped.length - half);
    return secondHalfAvg > firstHalfAvg;
  })();

  // 最高冲突等级
  const maxLevel: ConflictLevel = deduped.length === 0
    ? 'verbal'
    : deduped.reduce((max, h) => (h.strength > (signals.find((s) => s.level === max)?.strength ?? 0) ? h.level : max), 'verbal' as ConflictLevel);

  // 多样性：不重复的冲突类型数
  const variety = new Set(deduped.map((h) => h.category)).size;

  const issues: ConflictIssue[] = [];
  const count = deduped.length;

  // 1. 数量评估：短剧每集至少3个冲突点
  if (count === 0) {
    issues.push({
      severity: 'high',
      type: 'no_conflict',
      evidence: lang === 'en' ? 'No conflict signal detected in the entire script' : '全文未检测到任何冲突信号',
      advice: lang === 'en'
        ? 'Short drama MUST have at least 3 conflict points per episode — without conflict there is no story'
        : '短剧每集必须有至少3个冲突点——没有冲突就没有故事',
    });
  } else if (count < 3) {
    issues.push({
      severity: 'high',
      type: 'low_density',
      evidence: lang === 'en' ? `Only ${count} conflict(s) — short drama needs at least 3 per episode` : `仅${count}个冲突——短剧每集至少3个`,
      advice: lang === 'en'
        ? `Add ${3 - count} more conflict(s) — verbal, confrontation, or physical`
        : `再加${3 - count}个冲突——口角/对峙/肢体冲突`,
    });
  }

  // 2. 分布评估：三段至少有2段有冲突
  const emptySegments = (distribution.head === 0 ? 1 : 0) + (distribution.mid === 0 ? 1 : 0) + (distribution.tail === 0 ? 1 : 0);
  if (count >= 3 && emptySegments >= 2) {
    issues.push({
      severity: 'mid',
      type: 'uneven_distribution',
      evidence: lang === 'en'
        ? `Distribution: head ${distribution.head}, mid ${distribution.mid}, tail ${distribution.tail} — too uneven`
        : `分布：开头${distribution.head}、中段${distribution.mid}、结尾${distribution.tail}——过于集中`,
      advice: lang === 'en'
        ? 'Spread conflicts across the episode — head/mid/tail each should have at least one'
        : '冲突要均匀分布——开头/中段/结尾各至少1个',
    });
  }

  // 3. 强度评估：最高冲突等级应≥对峙（confront）
  const maxStrength = deduped.length > 0 ? Math.max(...deduped.map((h) => h.strength)) : 0;
  if (count >= 3 && maxStrength < 55) {
    issues.push({
      severity: 'mid',
      type: 'weak_conflict',
      evidence: lang === 'en'
        ? `Max conflict level is verbal — viewers need escalation to confrontation or physical`
        : `最高冲突等级仅为口角——观众需要升级到对峙或肢体冲突`,
      advice: lang === 'en'
        ? 'Escalate conflicts — turn verbal spats into physical confrontations or life-death stakes'
        : '升级冲突——把口角升级为肢体冲突或生死对抗',
    });
  }

  // 4. 冲突升级评估：强度应从小到大升级
  if (count >= 3 && !hasEscalation) {
    issues.push({
      severity: 'mid',
      type: 'no_escalation',
      evidence: lang === 'en' ? 'Conflicts do not escalate — intensity is flat or decreasing' : '冲突未升级——强度持平或下降',
      advice: lang === 'en'
        ? 'Escalate conflict intensity — start with verbal, build to confrontation, peak with physical'
        : '冲突强度要升级——从口角开始，升级到对峙，高潮用肢体冲突',
    });
  }

  // 5. 多样性：不能全是同一种冲突类型
  if (count >= 3 && variety === 1) {
    issues.push({
      severity: 'low',
      type: 'monotone',
      evidence: lang === 'en'
        ? `All ${count} conflicts are the same category (${deduped[0].categoryLabel}) — feels repetitive`
        : `${count}个冲突全是${deduped[0].categoryLabel}——单一类型容易疲劳`,
      advice: lang === 'en'
        ? 'Mix conflict types — emotional + interest + power + identity is more engaging'
        : '混合冲突类型——情感+利益+权力+身份比全是一种更抓人',
    });
  }

  // 综合得分
  let score = 0;
  // 数量分（0-35分）：每集3个冲突满分，少1个扣12分
  const countScore = Math.min(35, count * 12);
  score += countScore;
  // 分布分（0-20分）：三段都有冲突满分，少1段扣7分
  const filledSegments = 3 - emptySegments;
  score += filledSegments * 7;
  // 强度分（0-20分）：最高冲突等级越高分越高
  if (count > 0) {
    score += Math.round((maxStrength / 95) * 20);
  }
  // 升级分（0-15分）
  if (hasEscalation) score += 15;
  // 多样性分（0-10分）：每种类型2分，上限10分
  score += Math.min(10, variety * 2);

  // high 级问题各扣 10，mid 扣 5，low 扣 2
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 10;
    else if (issue.severity === 'mid') score -= 5;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, hits: deduped, count, maxLevel, variety, distribution, hasEscalation, strengthCurve, issues };
}
