/**
 * 爽点密度评分器（PRD 2.1.11 短剧爽感生死线）
 * ------------------------------------------------------------------
 * 短剧区别于其他内容形式的最核心特征：密集爽点。
 * 爽点不够 → 用户弃剧。爽点不"爽" → 用户差评。
 *
 * rhythm.ts 只检测"有没有冲突"（conflictCount >= 2），
 * 但不评估爽点密度够不够、爽不爽、分布均不均。
 *
 * 本引擎从成稿全文提取爽点信号，做五维评估：
 *  1) 数量：每集至少3个爽点（短剧标配），少于3为硬伤
 *  2) 分布：开头/中段/结尾三段都有爽点，不能只集中在一处
 *  3) 强度：爽点是否足够"爽"（打脸要狠、逆袭要彻底、揭露要够劲）
 *  4) 蓄力-爆发：爽点前是否有憋屈/压制的蓄力铺垫（先抑后扬）
 *  5) 多样性：不能全是同一种爽点（打脸+逆袭+揭露混合才过瘾）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type CmLang = 'zh' | 'en';

export interface CoolMomentIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export type CoolMomentType =
  | 'face_slap'      // 打脸爽：扇/泼/砸/掀/怒怼/当场打脸
  | 'counterattack'  // 逆袭爽：翻盘/反杀/绝地反击/咸鱼翻身
  | 'reveal'         // 揭露爽：真相大白/身份揭晓/原来是你
  | 'flex'           // 装逼爽：深藏不露/扮猪吃虎/原来是大佬
  | 'punish'         // 虐渣爽：报复/惩罚/让渣男后悔
  | 'protect'        // 护短爽：护短/撑腰/谁敢动我的人
  | 'wealth'         // 财富炫耀爽：砸钱/买下/支票/合同
  | 'weak'           // 弱爽点：只是一句狠话，没有实质动作
  | 'none';          // 无爽点

export interface CoolMomentHit {
  type: CoolMomentType;
  typeLabel: string;
  snippet: string;
  /** 位置 0-1（在全文中的相对位置） */
  position: number;
  /** 强度 0-100 */
  strength: number;
}

export interface CoolMomentScoreResult {
  /** 爽点密度 0-100（越高越好） */
  score: number;
  /** 命中的爽点列表 */
  hits: CoolMomentHit[];
  /** 爽点总数 */
  count: number;
  /** 爽点类型多样性（不重复的类型数） */
  variety: number;
  /** 三段分布：开头/中段/结尾各有几个爽点 */
  distribution: { head: number; mid: number; tail: number };
  /** 是否有蓄力-爆发节奏（先抑后扬） */
  hasBuildup: boolean;
  issues: CoolMomentIssue[];
}

// —— 中文爽点信号模式（按强度从高到低） ——
const SIGNALS_ZH: { type: CoolMomentType; label: string; re: RegExp; strength: number }[] = [
  // 打脸爽（最高强度 95）：扇耳光/泼水/砸东西/掀桌/当场打脸
  { type: 'face_slap', label: '打脸爽', re: /(一巴掌|扇|耳光|泼[了水一脸]|砸[在向下来]|掀[翻桌了]|摔[杯子门]|怒怼|当场打脸|打脸|啪啪|响亮)/, strength: 95 },
  // 逆袭爽（强度 92）：翻盘/反杀/绝地反击/咸鱼翻身
  { type: 'counterattack', label: '逆袭爽', re: /(翻盘|反杀|绝地反击|咸鱼翻身|逆风翻盘|触底反弹|东山再起|王者归来|碾压|完胜|吊打)/, strength: 92 },
  // 揭露爽（强度 88）：真相大白/身份揭晓/原来是你
  { type: 'reveal', label: '揭露爽', re: /(真相大白|身份揭晓|原来[你是他她才是]|谁才是|揭开|戳穿|揭穿|拆穿|狐狸尾巴|露馅)/, strength: 88 },
  // 装逼爽（强度 85）：深藏不露/扮猪吃虎/原来是大佬
  { type: 'flex', label: '装逼爽', re: /(深藏不露|扮猪吃虎|原来[是才是].*(大佬|首富|总裁|董事长|将军|大佬)|低调|隐藏身份|马甲|掉马|扮穷)/, strength: 85 },
  // 虐渣爽（强度 82）：报复/惩罚/让渣男后悔
  { type: 'punish', label: '虐渣爽', re: /(报复|惩罚|后悔|跪[下着]|求[饶原谅]|哭了|后悔莫及|自食其果|恶有恶报|报应)/, strength: 82 },
  // 护短爽（强度 80）：护短/撑腰/谁敢动我的人
  { type: 'protect', label: '护短爽', re: /(护短|撑腰|谁敢动|敢动我|护着|罩着|撑场|出头|替[她他我].*[撑出]|谁给你的胆)/, strength: 80 },
  // 财富炫耀爽（强度 78）：砸钱/买下/支票/合同
  { type: 'wealth', label: '财富炫耀爽', re: /(砸钱|买下|收购|支票|合同|签约|转账|黑卡|无限额|随便刷|不差钱|几个亿|千万|豪宅|豪车)/, strength: 78 },
  // 弱爽点（强度 40）：只是一句狠话，没有实质动作
  { type: 'weak', label: '弱爽点', re: /(你给我等着|走着瞧|别后悔|你会后悔的|休想|做梦|不可能|你完了|你死定了)/, strength: 40 },
];

// —— 英文爽点信号模式 ——
const SIGNALS_EN: { type: CoolMomentType; label: string; re: RegExp; strength: number }[] = [
  { type: 'face_slap', label: 'Face Slap', re: /\b(slap|smack|poured|splash|smash|flipped the table|backhand|cracked|punched)\b/i, strength: 95 },
  { type: 'counterattack', label: 'Counterattack', re: /\b(comeback|counterattack|turn(ed|s)? (the )?tables|crush(ed)?|dominate(d)?|sweep|underdog|rise again|rebound)\b/i, strength: 92 },
  { type: 'reveal', label: 'Reveal', re: /\b(truth|identity (revealed|exposed)|turns out|you are the|unmasked|exposed|busted|caught (red-handed)?)\b/i, strength: 88 },
  { type: 'flex', label: 'Flex', re: /\b(hiding (your|his|her) (identity|power)|pretending (to be )?poor|turns out (to be )?(the )?(boss|CEO|billionaire|mogul)|low key|undercover|big shot)\b/i, strength: 85 },
  { type: 'punish', label: 'Punish', re: /\b(revenge|punish|kneel|beg(ging)? (for )?(mercy|forgiveness)|regret|karma|payback|what goes around)\b/i, strength: 82 },
  { type: 'protect', label: 'Protect', re: /\b(protect|back (you|him|her) up|who dares (to )?touch|stand up for|shield|cover (for|him|her))\b/i, strength: 80 },
  { type: 'wealth', label: 'Wealth', re: /\b(buy out|acqui(ring|red)|check|contract|signing|transfer|black card|unlimited|billion(s)?|mansion|sports car)\b/i, strength: 78 },
  { type: 'weak', label: 'Weak', re: /\b(just you wait|you'll (regret|pay)|see|in your dreams|no way|you're (done|dead|finished))\b/i, strength: 40 },
];

// —— 蓄力信号（爽点前的憋屈/压制铺垫） ——
const BUILDUP_ZH = /(憋屈|压抑|忍|屈辱|受尽|被[羞辱欺负]\/?|忍气吞声|委曲求全|低声下气|忍辱负重|含泪|咬牙|吞[下着]|咽[下这])/;
const BUILDUP_EN = /\b(suppress(ed|ing)?|endure(d)?|humiliat(ed|ion)|swallow(ed)? (your|his|her) pride|bite (your|his|her) lip|hold back|tolerate|bear it|suffer(ed)? in silence)\b/i;

/**
 * 主函数：评估成稿爽点密度
 * @param text 成稿全文
 * @param lang 中英文
 */
export function coolMomentScore(text: string, lang: CmLang = 'zh'): CoolMomentScoreResult {
  const signals = lang === 'en' ? SIGNALS_EN : SIGNALS_ZH;
  const buildupRe = lang === 'en' ? BUILDUP_EN : BUILDUP_ZH;
  const textLen = Math.max(1, text.length);

  const hits: CoolMomentHit[] = [];

  // 全文扫描所有爽点信号
  for (const sig of signals) {
    // 跳过 weak 类型在主扫描阶段——单独处理
    if (sig.type === 'weak') continue;
    const re = new RegExp(sig.re.source, sig.re.flags.includes('g') ? sig.re.flags : sig.re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      // 提取周围文本作为 snippet（前10字+匹配+后10字）
      const start = Math.max(0, idx - 10);
      const end = Math.min(textLen, idx + m[0].length + 10);
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim();
      hits.push({
        type: sig.type,
        typeLabel: sig.label,
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

  // 去重：同一位置（±0.02）只保留强度最高的
  const deduped: CoolMomentHit[] = [];
  for (const h of hits) {
    const nearby = deduped.find((d) => Math.abs(d.position - h.position) < 0.02);
    if (nearby) {
      if (h.strength > nearby.strength) {
        Object.assign(nearby, h);
      }
    } else {
      deduped.push({ ...h });
    }
  }

  // 弱爽点检测：如果全文只有弱爽点信号没有强爽点
  const weakRe = signals.find((s) => s.type === 'weak');
  const strongCount = deduped.length;
  if (strongCount === 0 && weakRe) {
    const re = new RegExp(weakRe.re.source, weakRe.re.flags.includes('g') ? weakRe.re.flags : weakRe.re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      const start = Math.max(0, idx - 10);
      const end = Math.min(textLen, idx + m[0].length + 10);
      const snippet = text.slice(start, end).replace(/\n/g, ' ').trim();
      deduped.push({
        type: 'weak',
        typeLabel: weakRe.label,
        snippet,
        position: Number((idx / textLen).toFixed(2)),
        strength: weakRe.strength,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // 三段分布：0-0.33 开头，0.33-0.66 中段，0.66-1.0 结尾
  const distribution = { head: 0, mid: 0, tail: 0 };
  for (const h of deduped) {
    if (h.position < 0.33) distribution.head++;
    else if (h.position < 0.66) distribution.mid++;
    else distribution.tail++;
  }

  // 蓄力-爆发节奏检测：全文是否有蓄力信号
  const hasBuildup = buildupRe.test(text);

  // 多样性：不重复的爽点类型数
  const variety = new Set(deduped.map((h) => h.type)).size;

  const issues: CoolMomentIssue[] = [];
  const count = deduped.length;

  // 1. 数量评估：短剧每集至少3个爽点
  if (count === 0) {
    issues.push({
      severity: 'high',
      type: 'no_cool_moment',
      evidence: lang === 'en' ? 'No cool moment signal detected in the entire script' : '全文未检测到任何爽点信号',
      advice: lang === 'en'
        ? 'Short drama MUST have at least 3 cool moments per episode — add face-slap, counterattack, or reveal beats. No cool moments = users abandon'
        : '短剧每集必须有至少3个爽点——加打脸/逆袭/揭露桥段。没有爽点=用户弃剧',
    });
  } else if (count < 3) {
    issues.push({
      severity: 'high',
      type: 'low_density',
      evidence: lang === 'en' ? `Only ${count} cool moment(s) — short drama needs at least 3 per episode` : `仅${count}个爽点——短剧每集至少3个`,
      advice: lang === 'en'
        ? `Add ${3 - count} more cool moment(s) — face-slap, counterattack, reveal, or wealth flex`
        : `再加${3 - count}个爽点——打脸/逆袭/揭露/财富炫耀`,
    });
  }

  // 2. 分布评估：三段至少有2段有爽点
  const emptySegments = (distribution.head === 0 ? 1 : 0) + (distribution.mid === 0 ? 1 : 0) + (distribution.tail === 0 ? 1 : 0);
  if (count >= 3 && emptySegments >= 2) {
    issues.push({
      severity: 'mid',
      type: 'uneven_distribution',
      evidence: lang === 'en'
        ? `Distribution: head ${distribution.head}, mid ${distribution.mid}, tail ${distribution.tail} — too uneven`
        : `分布：开头${distribution.head}、中段${distribution.mid}、结尾${distribution.tail}——过于集中`,
      advice: lang === 'en'
        ? 'Spread cool moments across the episode — head/mid/tail each should have at least one'
        : '爽点要均匀分布——开头/中段/结尾各至少1个',
    });
  }

  // 3. 强度评估：强爽点（strength>=80）占比应≥50%
  const strongMoments = deduped.filter((h) => h.strength >= 80);
  if (count >= 3 && strongMoments.length < Math.ceil(count * 0.5)) {
    issues.push({
      severity: 'mid',
      type: 'weak_moments',
      evidence: lang === 'en'
        ? `${count - strongMoments.length} of ${count} moments are weak — viewers want HARD face-slaps, not mild`
        : `${count}个爽点中${count - strongMoments.length}个偏弱——观众要狠打脸，不要温吞`,
      advice: lang === 'en'
        ? 'Escalate weak moments — turn "you\'ll regret this" into a slap, a reveal, or a wealth flex'
        : '把弱爽点升级——"你给我等着"改成扇耳光/揭露身份/砸钱',
    });
  }

  // 4. 蓄力-爆发节奏
  if (count >= 3 && !hasBuildup) {
    issues.push({
      severity: 'low',
      type: 'no_buildup',
      evidence: lang === 'en' ? 'No buildup/suppression before cool moments — feels unearned' : '爽点前无憋屈/压制铺垫——爽得没有来头',
      advice: lang === 'en'
        ? 'Add suppression before the payoff — make protagonist suffer first, THEN deliver the face-slap'
        : '爽点前加蓄力铺垫——主角先受辱/被压制，再爆发打脸才够爽',
    });
  }

  // 5. 多样性：不能全是同一种爽点
  if (count >= 3 && variety === 1) {
    issues.push({
      severity: 'low',
      type: 'monotone',
      evidence: lang === 'en'
        ? `All ${count} moments are the same type (${deduped[0].typeLabel}) — feels repetitive`
        : `${count}个爽点全是${deduped[0].typeLabel}——单一类型容易疲劳`,
      advice: lang === 'en'
        ? 'Mix cool moment types — face-slap + reveal + wealth flex is more satisfying than all face-slaps'
        : '混合爽点类型——打脸+揭露+财富炫耀比全是打脸更过瘾',
    });
  }

  // 综合得分
  let score = 0;
  // 数量分（0-40分）：每集3个爽点满分，少1个扣13分
  const countScore = Math.min(40, count * 13);
  score += countScore;
  // 分布分（0-20分）：三段都有爽点满分，少1段扣7分
  const filledSegments = 3 - emptySegments;
  score += filledSegments * 7;
  // 强度分（0-20分）：强爽点占比越高分越高
  if (count > 0) {
    const strongRatio = strongMoments.length / count;
    score += Math.round(strongRatio * 20);
  }
  // 蓄力-爆发分（0-10分）
  if (hasBuildup) score += 10;
  // 多样性分（0-10分）：每种类型2分，上限10分
  score += Math.min(10, variety * 2);

  // high 级问题各扣 10，mid 扣 5，low 扣 2
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 10;
    else if (issue.severity === 'mid') score -= 5;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, hits: deduped, count, variety, distribution, hasBuildup, issues };
}
