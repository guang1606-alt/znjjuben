/**
 * 角色戏份均衡检测器（PRD 2.1.17 短剧人物驱动生死线）
 * ------------------------------------------------------------------
 * 短剧是人物驱动的——AIGC 剧本最常见的顽疾：
 *  - 主角变成背景板：主角对白字数 < 全剧 30%，沦为解说员
 *  - 工具人独白剧：单一角色对白字数 > 全剧 70%，其他角色全是"嗯""啊""是吗"
 *  - 戏份悬殊：主角 2000 字 vs 配角 20 字，比例 > 5:1
 *  - 对手戏缺失：主角只和一个角色有同场对话，关系网扁平
 *  - 龙套过场：有名字有台词的角色只出现 1 句，纯工具人
 *
 * 现有引擎检测"角色有没有出场"和"声口是否同质化"：
 *  - character-logic 检测悬空/背景板/声口崩塌，不检测戏份比例
 *  - voice-print 检测角色间声音相似度，不检测谁说得多谁说得少
 *
 * 本引擎专注于戏份均衡——补齐"人物驱动"维度。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
import { parseDialogue, type CastMap } from './character-logic';
import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源

export type CbLang = 'zh' | 'en';

export interface BalanceIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单个角色戏份信息 */
export interface CharacterShare {
  /** 角色名 */
  name: string;
  /** 对白行数 */
  lineCount: number;
  /** 对白总字数 */
  wordCount: number;
  /** 戏份占比 0-1（字数占比） */
  share: number;
  /** 首次出现位置 0-1 */
  firstAppear: number;
  /** 末次出现位置 0-1 */
  lastAppear: number;
  /** 出场跨度 0-1（lastAppear - firstAppear，1=贯穿全剧） */
  span: number;
  /** 与之同场对白过的角色列表（用于检测对手戏多样性） */
  coSceneChars: string[];
  /** 平均句长 */
  avgLen: number;
}

export interface CharacterBalanceResult {
  /** 戏份均衡分 0-100（越高越好） */
  score: number;
  /** 各角色戏份详情，按字数降序 */
  shares: CharacterShare[];
  /** 主角名（戏份最多的角色） */
  protagonist: string;
  /** 主角戏份占比 0-1 */
  protagonistShare: number;
  /** 最大/最小角色字数比（最小角色≥3句时计算，否则为 0） */
  topBottomRatio: number;
  /** 龙套过场角色数（只出现1句的角色） */
  cameoCount: number;
  /** 总对白行数 */
  totalLines: number;
  /** 总对白字数 */
  totalWords: number;
  /** 有台词的角色数 */
  speakingChars: number;
  issues: BalanceIssue[];
}

// —— 非正文行识别（c213：收口共享切分器 isSceneOrTitleLine，覆盖全格式场头+剧名页） ——
function isSceneLine(line: string, lang: CbLang): boolean {
  return isSceneOrTitleLine(line, lang);
}

function isActionLine(line: string): boolean {
  return line.trim().startsWith('△');
}

/**
 * 主函数：检测角色戏份均衡
 * @param text 成稿全文
 * @param cast 人物卡（可选，用于区分主角/配角；cast 第一个 key 视为主角）
 * @param lang 中英文
 */
export function characterBalanceCheck(
  text: string,
  cast: CastMap | null | undefined,
  lang: CbLang = 'zh',
): CharacterBalanceResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const dialogues = parseDialogue(text);
  const totalLines = dialogues.length;
  const totalWords = dialogues.reduce((s, d) => s + d.text.length, 0);

  // —— 按角色聚合对白 ——
  const byName = new Map<string, typeof dialogues>();
  for (const d of dialogues) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push(d);
  }

  // —— 计算同场对手戏：扫描场景块内的对白序列 ——
  // 简化策略：相邻对白行之间视为"同场"，场景行重置同场窗口
  const coSceneMap = new Map<string, Set<string>>();
  let currentSceneChars: string[] = [];
  for (const line of lines) {
    if (isSceneLine(line, lang)) {
      currentSceneChars = [];
      continue;
    }
    if (isActionLine(line)) continue;
    // 尝试匹配对白行
    const m = line.match(/^([一-龥A-Za-z·]{1,6})(?:（[^）]*\))?[：:]/);
    if (m) {
      const name = m[1];
      // 与本场已出场的其他角色建立同场关系
      if (!coSceneMap.has(name)) coSceneMap.set(name, new Set());
      for (const other of currentSceneChars) {
        if (other !== name) {
          coSceneMap.get(name)!.add(other);
          if (!coSceneMap.has(other)) coSceneMap.set(other, new Set());
          coSceneMap.get(other)!.add(name);
        }
      }
      if (!currentSceneChars.includes(name)) currentSceneChars.push(name);
    }
  }

  // —— 构建角色戏份列表 ——
  const shares: CharacterShare[] = [];
  for (const [name, dLines] of byName) {
    const wordCount = dLines.reduce((s, d) => s + d.text.length, 0);
    const firstIdx = dialogues.indexOf(dLines[0]);
    const lastIdx = dialogues.indexOf(dLines[dLines.length - 1]);
    const firstAppear = totalLines > 0 ? firstIdx / totalLines : 0;
    const lastAppear = totalLines > 0 ? lastIdx / totalLines : 0;
    const coScene = coSceneMap.get(name);
    shares.push({
      name,
      lineCount: dLines.length,
      wordCount,
      share: totalWords > 0 ? wordCount / totalWords : 0,
      firstAppear,
      lastAppear,
      span: Math.max(0, lastAppear - firstAppear),
      coSceneChars: coScene ? Array.from(coScene) : [],
      avgLen: dLines.length > 0 ? Math.round(wordCount / dLines.length) : 0,
    });
  }
  shares.sort((a, b) => b.wordCount - a.wordCount);

  // 主角识别：优先用 cast 声明的第一个角色（用户意图），否则用字数最多者
  const declaredLead = cast && Object.keys(cast).length > 0 ? Object.keys(cast)[0] : null;
  const protagonist = declaredLead ?? shares[0]?.name ?? '';
  const protagonistShare = shares.find((s) => s.name === protagonist)?.share ?? 0;
  const speakingChars = shares.length;

  // 最大/最小字数比（只要最小角色有对白就算，1 句 3 字 vs 主角 200 字也确实悬殊）
  let topBottomRatio = 0;
  if (shares.length >= 2) {
    const bottom = shares[shares.length - 1];
    if (bottom.wordCount > 0) {
      topBottomRatio = shares[0].wordCount / Math.max(1, bottom.wordCount);
    }
  }

  // 龙套过场：只出现 1 句的角色
  const cameoCount = shares.filter((s) => s.lineCount === 1).length;

  const issues: BalanceIssue[] = [];
  let totalPenalty = 0;

  // —— 1. 主角戏份不足（high：< 20%；mid：< 30%）——
  if (speakingChars >= 2 && protagonistShare > 0 && protagonistShare < 0.2) {
    totalPenalty += 20;
    issues.push({
      severity: 'high',
      type: 'protagonist_underweight',
      evidence: lang === 'en'
        ? `Protagonist "${protagonist}" only has ${Math.round(protagonistShare * 100)}% of dialogue — should be ≥30%`
        : `主角「${protagonist}」戏份仅占${Math.round(protagonistShare * 100)}%，应≥30%`,
      advice: lang === 'en'
        ? 'The protagonist drives the story — give them more dialogue, decisions, and reactions. Other characters should orbit them, not overshadow them.'
        : '主角是故事驱动者——多给对白/决策/反应，其他角色围绕主角转，不能喧宾夺主。',
    });
  } else if (speakingChars >= 2 && protagonistShare > 0 && protagonistShare < 0.3) {
    totalPenalty += 8;
    issues.push({
      severity: 'mid',
      type: 'protagonist_thin',
      evidence: lang === 'en'
        ? `Protagonist "${protagonist}" has only ${Math.round(protagonistShare * 100)}% of dialogue — borderline underweight`
        : `主角「${protagonist}」戏份占${Math.round(protagonistShare * 100)}%，戏份偏薄`,
      advice: lang === 'en'
        ? 'Give the protagonist a clearer stance, more decisions, or a key reversal to lift their share above 30%.'
        : '给主角更明确的立场/更多决策/一次关键反转，把戏份提到 30% 以上。',
    });
  }

  // —— 2. 工具人独白剧（high：单一角色 > 80%；mid：> 70%）——
  if (speakingChars >= 3 && protagonistShare > 0.8) {
    totalPenalty += 18;
    issues.push({
      severity: 'high',
      type: 'monologue_drama',
      evidence: lang === 'en'
        ? `"${protagonist}" holds ${Math.round(protagonistShare * 100)}% of dialogue — others are props`
        : `「${protagonist}」独占${Math.round(protagonistShare * 100)}%对白，其他角色沦为工具人`,
      advice: lang === 'en'
        ? 'A monologue drama kills tension. Give at least 2 other characters substantive dialogue (questions, objections, secrets) to create push-and-pull.'
        : '独白剧没有张力——至少给 2 个其他角色实质性对白（提问/反对/揭秘），制造拉锯。',
    });
  } else if (speakingChars >= 3 && protagonistShare > 0.7) {
    totalPenalty += 8;
    issues.push({
      severity: 'mid',
      type: 'near_monologue',
      evidence: lang === 'en'
        ? `"${protagonist}" holds ${Math.round(protagonistShare * 100)}% of dialogue — borderline monologue`
        : `「${protagonist}」占${Math.round(protagonistShare * 100)}%对白，接近独白剧`,
      advice: lang === 'en'
        ? 'Distribute dialogue more evenly — let other characters challenge or question the lead to break the monologue feel.'
        : '更均衡地分配对白——让其他角色质疑/追问主角，打破独白感。',
    });
  }

  // —— 3. 戏份悬殊（mid：最大/最小 > 5:1 且最小≥3句）——
  if (topBottomRatio > 5) {
    totalPenalty += 10;
    const bottom = shares[shares.length - 1];
    issues.push({
      severity: 'mid',
      type: 'share_gap',
      evidence: lang === 'en'
        ? `Top character ${shares[0].wordCount} chars vs bottom "${bottom.name}" ${bottom.wordCount} chars (ratio ${topBottomRatio.toFixed(1)}:1)`
        : `主角${shares[0].wordCount}字 vs「${bottom.name}」${bottom.wordCount}字（${topBottomRatio.toFixed(1)}:1）`,
      advice: lang === 'en'
        ? 'Huge dialogue gap flattens supporting characters. Give the smallest role one decisive line or reveal to matter.'
        : '对白悬殊会扁平化配角——给戏份最少者一句决定性台词或揭秘，让其有存在感。',
    });
  }

  // —— 4. 对手戏缺失（mid：主角只和 ≤1 个角色同场）——
  if (speakingChars >= 3) {
    const protCoScene = shares[0]?.coSceneChars.length ?? 0;
    if (protCoScene <= 1) {
      totalPenalty += 8;
      issues.push({
        severity: 'mid',
        type: 'narrow_co_scene',
        evidence: lang === 'en'
          ? `Protagonist "${protagonist}" only shares scenes with ${protCoScene} character(s) — relationship web is flat`
          : `主角「${protagonist}」仅与${protCoScene}个角色同场——关系网扁平`,
        advice: lang === 'en'
          ? 'A flat relationship web kills ensemble chemistry. Arrange at least one scene where the protagonist confronts a different character.'
          : '关系网扁平会失去群像化学反应——至少安排一场主角与其他角色的对手戏。',
      });
    }
  }

  // —— 5. 龙套过场（low：≥3 个角色只出现 1 句）——
  if (cameoCount >= 3) {
    totalPenalty += 5;
    issues.push({
      severity: 'low',
      type: 'too_many_cameos',
      evidence: lang === 'en'
        ? `${cameoCount} characters appear in only one line — pure props`
        : `${cameoCount}个角色只出现1句——纯工具人`,
      advice: lang === 'en'
        ? 'Too many one-line cameos dilute the cast. Either merge them into one character or give each a second beat.'
        : '过多一句龙套稀释群像——合并为一个角色，或给每人第二拍反应。',
    });
  }

  // —— 评分：100 - 总扣分，下限 0 ——
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  return {
    score,
    shares,
    protagonist,
    protagonistShare,
    topBottomRatio,
    cameoCount,
    totalLines,
    totalWords,
    speakingChars,
    issues: issues.sort((a, b) => {
      const order = { high: 0, mid: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    }),
  };
}
