/**
 * 剧本PK 评分引擎（v2.67）
 * 纯确定性、零 LLM 依赖：从剧本正文按六维启发式打分，支持单集与多集聚合。
 * 评分只用于"小游戏式对比"，不替代专业审稿；同一对剧本结果可复现（内容哈希种子）。
 */
import { createHash } from 'crypto';

export type PkDimensionKey = 'character' | 'plot' | 'dialogue' | 'market' | 'format' | 'antiAi';

export interface PkDimension {
  key: PkDimensionKey;
  labelZh: string;
  labelEn: string;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | 'tie';
}

export interface PkResult {
  dimensions: PkDimension[];
  totalA: number;
  totalB: number;
  winner: 'A' | 'B' | 'tie';
  xiaonanCommentZh: string;
  xiaonanCommentEn: string;
}

const DIM_META: Record<PkDimensionKey, { zh: string; en: string }> = {
  character: { zh: '人物塑造', en: 'Character' },
  plot: { zh: '剧情节奏', en: 'Plot & Pace' },
  dialogue: { zh: '台词张力', en: 'Dialogue' },
  market: { zh: '市场潜力', en: 'Market Fit' },
  format: { zh: '格式规范', en: 'Format' },
  antiAi: { zh: '去AI质感', en: 'Human-like' },
};

const DIM_ORDER: PkDimensionKey[] = ['character', 'plot', 'dialogue', 'market', 'format', 'antiAi'];

/** 简单字符串哈希 → 32位无符号，用于可复现的微扰 */
function hashSeed(s: string): number {
  const h = createHash('sha1').update(s).digest();
  return h.readUInt32BE(0);
}

/** 把原始分夹到 0-100 并保留一位小数 */
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/**
 * 单集六维评分（0-100）。全部基于正文可观测特征，不调用 LLM。
 * 各维设计思路：
 *  - character：人物场头密度 + 名字出现多样性 + 动作提示占比
 *  - plot：场景切换数 + 钩子标记（悬念/反转/！？）密度 + 字数在合理区间
 *  - dialogue：台词行占比 + 台词长度方差（长短交错=张力）+ 语气词密度
 *  - market：爽感词密度 + 冲突标记 + 标题/梗概钩子词（弱信号）
 *  - format：场头规范度 + 字数落在 800-1500 区间 + 无提示词式残留
 *  - antiAi：口语化标记（省略号/语气词/短句）+ 避免工整排比（长句均一度低）+ 细节词密度
 */
export function scoreEpisode(content: string): Record<PkDimensionKey, number> {
  const text = content || '';
  const len = text.length;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lineCount = lines.length;

  // 场头：【第X场】/[Scene] / 时间·地点 等
  const sceneHeaders = lines.filter((l) => /^(【|\[|第[一二三四五六七八九十百\d]+场|\d+\.)/.test(l.trim())).length;
  // 人物场头：【人物】/[Characters] 或 角色名：台词
  const charLines = lines.filter((l) => /(【人物】|\[Characters?\]|^[\u4e00-\u9fa5A-Za-z]{2,8}[：:])/.test(l)).length;
  // 台词行（含冒号或引号）
  const dialogueLines = lines.filter((l) => /[：:“"]/.test(l)).length;
  const dialogueRatio = lineCount ? dialogueLines / lineCount : 0;
  // 钩子/反转标记
  const hookMarkers = (text.match(/[！!？?]/g) || []).length;
  const suspenseWords = (text.match(/(突然|竟然|原来|没想到|谁知|就在这时|下一秒|反转|悬念)/g) || []).length;
  // 爽感词
  const payoffWords = (text.match(/(逆袭|打脸|翻身|称霸|登顶|碾压|反杀|揭穿|曝光)/g) || []).length;
  // 口语化标记
  const colloquial = (text.match(/(…|——|嗯|啊|吧|呢|嘛|啦|哎|哦)/g) || []).length;
  // 细节词（道具/动作/环境）
  const detailWords = (text.match(/(微微|缓缓|紧紧|轻轻|眼神|嘴角|指尖|背影|灯光|风声)/g) || []).length;
  // 提示词式残留（AI味）
  const aiTell = (text.match(/(作为一个|综上所述|首先.*其次.*最后|不仅.*而且|值得注意的是)/g) || []).length;
  // 句长方差（粗略：按标点切句）
  const sentences = text.split(/[。！？!?…]/).filter((s) => s.trim().length > 0);
  const avgSentenceLen = sentences.length ? sentences.reduce((a, s) => a + s.length, 0) / sentences.length : 0;
  const sentenceVariance = sentences.length
    ? sentences.reduce((a, s) => a + Math.pow(s.length - avgSentenceLen, 2), 0) / sentences.length
    : 0;

  // —— 各维原始分 ——
  // character: 人物场头密度(0-40) + 台词占比(0-30) + 细节词(0-30)
  const character = Math.min(40, charLines * 4) + Math.min(30, dialogueRatio * 50) + Math.min(30, detailWords * 2);
  // plot: 场景数(0-25) + 钩子标记密度(0-40) + 悬念词(0-20) + 字数合理(0-15)
  const plot =
    Math.min(25, sceneHeaders * 5) +
    Math.min(40, (hookMarkers / Math.max(1, len / 200)) * 8) +
    Math.min(20, suspenseWords * 3) +
    (len >= 600 && len <= 1800 ? 15 : len >= 400 ? 8 : 3);
  // dialogue: 台词占比(0-45) + 句长方差(0-30) + 语气词(0-25)
  const dialogue = Math.min(45, dialogueRatio * 70) + Math.min(30, sentenceVariance / 5) + Math.min(25, colloquial * 1.5);
  // market: 爽感词(0-40) + 悬念词(0-30) + 钩子密度(0-30)
  const market = Math.min(40, payoffWords * 5) + Math.min(30, suspenseWords * 3) + Math.min(30, (hookMarkers / Math.max(1, len / 300)) * 6);
  // format: 场头规范(0-35) + 字数区间(0-35) + 无AI残留(0-30)
  const format =
    Math.min(35, sceneHeaders * 6) +
    (len >= 800 && len <= 1500 ? 35 : len >= 600 && len <= 1800 ? 22 : len >= 400 ? 12 : 5) +
    Math.max(0, 30 - aiTell * 10);
  // antiAi: 口语化(0-40) + 句长方差(0-30) + 细节词(0-30) - AI残留惩罚
  const antiAi = Math.min(40, colloquial * 2) + Math.min(30, sentenceVariance / 5) + Math.min(30, detailWords * 2) - aiTell * 8;

  return {
    character: clamp(character),
    plot: clamp(plot),
    dialogue: clamp(dialogue),
    market: clamp(market),
    format: clamp(format),
    antiAi: clamp(antiAi),
  };
}

/** 多集聚合：逐集评分后取均值；空内容返回中位基准分 */
export function scoreProject(contents: string[]): Record<PkDimensionKey, number> {
  const valid = (contents || []).filter((c) => c && c.trim().length > 0);
  if (!valid.length) {
    const base: Record<PkDimensionKey, number> = { character: 55, plot: 55, dialogue: 55, market: 55, format: 55, antiAi: 55 };
    return base;
  }
  const sums: Record<PkDimensionKey, number> = { character: 0, plot: 0, dialogue: 0, market: 0, format: 0, antiAi: 0 };
  valid.forEach((c) => {
    const s = scoreEpisode(c);
    DIM_ORDER.forEach((k) => (sums[k] += s[k]));
  });
  DIM_ORDER.forEach((k) => (sums[k] = clamp(sums[k] / valid.length)));
  return sums;
}

/** 小南点评：按总分差与最强维度生成确定性文案 */
function xiaonanComment(totalA: number, totalB: number, dims: PkDimension[], seed: number): { zh: string; en: string } {
  const diff = totalA - totalB;
  const strongAZh = dims.filter((d) => d.winner === 'A').map((d) => d.labelZh);
  const strongBZh = dims.filter((d) => d.winner === 'B').map((d) => d.labelZh);
  const strongAEn = dims.filter((d) => d.winner === 'A').map((d) => d.labelEn);
  const strongBEn = dims.filter((d) => d.winner === 'B').map((d) => d.labelEn);
  const pick = (arr: string[]) => arr[seed % Math.max(1, arr.length)] || '';
  if (Math.abs(diff) < 1) {
    return {
      zh: '旗鼓相当！两本各有千秋，A 在' + (strongAZh.join('、') || '综合') + '略占优，B 在' + (strongBZh.join('、') || '细节') + '更出彩，再打磨一版就能拉开差距。',
      en: 'Dead heat! A edges ahead in ' + (strongAEn.join(', ') || 'overall') + ', B shines in ' + (strongBEn.join(', ') || 'details') + '. One more polish will break the tie.',
    };
  }
  const win = diff > 0 ? 'A' : 'B';
  const strongZh = diff > 0 ? strongAZh : strongBZh;
  const weakZh = diff > 0 ? strongBZh : strongAZh;
  const strongEn = diff > 0 ? strongAEn : strongBEn;
  const weakEn = diff > 0 ? strongBEn : strongAEn;
  const zhTpl = [
    `${win} 赢了！领先 ${Math.abs(diff).toFixed(1)} 分，强项在${pick(strongZh) || '综合'}，短板在${pick(weakZh) || '细节'}，补一补就能更稳。`,
    `${win} 以 ${Math.abs(diff).toFixed(1)} 分胜出，${pick(strongZh) || '节奏'}明显更抓人，${pick(weakZh) || '台词'}还可以再生活化一点。`,
    `判定 ${win} 胜，差距 ${Math.abs(diff).toFixed(1)} 分；${pick(strongZh) || '人物'}立得住，${pick(weakZh) || '格式'}再规范些就更交付级了。`,
  ];
  const enTpl = [
    `${win} wins by ${Math.abs(diff).toFixed(1)}! Strong in ${pick(strongEn) || 'overall'}, weak in ${pick(weakEn) || 'details'} — patch that and it solidifies.`,
    `${win} takes it by ${Math.abs(diff).toFixed(1)}; ${pick(strongEn) || 'pace'} is more gripping, ${pick(weakEn) || 'dialogue'} could be more colloquial.`,
    `${win} wins by ${Math.abs(diff).toFixed(1)}; ${pick(strongEn) || 'characters'} land well, ${pick(weakEn) || 'format'} needs tightening for delivery.`,
  ];
  return { zh: zhTpl[seed % zhTpl.length], en: enTpl[seed % enTpl.length] };
}

/**
 * 跑一场 PK：A/B 各为多集正文数组。
 * 结果可复现：种子 = hash(A拼接+B拼接)。
 */
export function runPk(contentsA: string[], contentsB: string[]): PkResult {
  const scoreA = scoreProject(contentsA);
  const scoreB = scoreProject(contentsB);
  const dimensions: PkDimension[] = DIM_ORDER.map((key) => {
    const a = scoreA[key];
    const b = scoreB[key];
    return {
      key,
      labelZh: DIM_META[key].zh,
      labelEn: DIM_META[key].en,
      scoreA: a,
      scoreB: b,
      winner: a > b ? 'A' : b > a ? 'B' : 'tie',
    };
  });
  const totalA = clamp(dimensions.reduce((s, d) => s + d.scoreA, 0) / dimensions.length);
  const totalB = clamp(dimensions.reduce((s, d) => s + d.scoreB, 0) / dimensions.length);
  const seed = hashSeed((contentsA || []).join('|') + '::' + (contentsB || []).join('|'));
  const comment = xiaonanComment(totalA, totalB, dimensions, seed);
  return {
    dimensions,
    totalA,
    totalB,
    winner: totalA > totalB ? 'A' : totalB > totalA ? 'B' : 'tie',
    xiaonanCommentZh: comment.zh,
    xiaonanCommentEn: comment.en,
  };
}
