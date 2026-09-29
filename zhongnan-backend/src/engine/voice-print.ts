/**
 * 对白指纹引擎（PRD 2.1.8 对白同质化治理）
 * ------------------------------------------------------------------
 * 短剧核心痛点：所有角色说话一个味儿。现有 dialogue.ts 只检测书面腔/AI 腔，
 * character-logic.ts 的 voice_break 只看人设是否崩塌，都不做角色间对白相似度比对。
 * 本模块从成稿中提取每个角色的对白集合，计算"语音指纹"（句长分布/句式偏好/语气词/书面词），
 * 比对角色之间的指纹相似度，检测"指纹高度重合"——判定为 high 级问题，触发润色重写。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：
 *  1. 复用 character-logic.ts 的 parseDialogue 提取每角色对白
 *  2. 计算每角色指纹：平均句长/短句占比/长句占比/疑问句占比/感叹句占比/语气词频率/书面词命中
 *  3. 两两比对相似度（多维度加权平均，0-100）
 *  4. 相似度>85 → high；>70 → mid；<2 句的角色跳过（样本不足）
 *  5. 3+ 角色互相相似 → 整体性"一个味儿"high 级问题
 *
 * 中英双语：中文层为单一事实源，英文层零中文（particles/written markers 均有英文表）。
 */
import { parseDialogue, type CastMap } from './character-logic';

export type VoicePrintLang = 'zh' | 'en';

export interface VoicePrint {
  name: string;
  /** 对白行数（样本量，<2 时不可判定） */
  lineCount: number;
  /** 平均句长（字符数，含标点） */
  avgLen: number;
  /** 短句占比（≤8字）0-1 */
  shortRatio: number;
  /** 长句占比（≥30字）0-1 */
  longRatio: number;
  /** 疑问句占比（含？?）0-1 */
  questionRatio: number;
  /** 感叹句占比（含！!）0-1 */
  exclamRatio: number;
  /** 语气词频率 top5（词→次数） */
  particles: Record<string, number>;
  /** 书面词命中数 */
  writtenHits: number;
  /** 指纹简述（供 advice 引用，人话描述） */
  signature: string;
}

export interface VoicePair {
  a: string;
  b: string;
  /** 相似度 0-100（越高越像） */
  similarity: number;
  /** 相似原因（人话描述） */
  reason: string;
}

export interface VoicePrintResult {
  prints: VoicePrint[];
  /** 指纹高度重合的角色对 */
  similarPairs: VoicePair[];
  /** 是否整体性"一个味儿"（3+ 角色互相相似） */
  homogeneousAll: boolean;
  /** 指纹独特度 0-100（越高越好，100=所有角色声音都不同） */
  score: number;
  /** 问题列表 */
  issues: { severity: 'high' | 'mid' | 'low'; type: string; advice: string }[];
}

// —— 中文语气词（高频口语标记，区分角色声音的关键信号） ——
const PARTICLES_ZH = ['啊', '呢', '吧', '呗', '嘛', '呀', '哦', '哈', '嘿', '诶', '嗯', '啦', '喽', '哇', '哎', '哼', '呸', '咳', '嘘', '哟', '嘞', '滴', '咩', '嘎', '捏', '惹'];
// —— 英文语气词 / filler words ——
const PARTICLES_EN = ['oh', 'ah', 'well', 'hey', 'like', 'yeah', 'nope', 'uh', 'um', 'hmm', 'huh', 'ooh', 'ouch', 'whoa', 'wow', 'ugh', 'mmm', 'oy', 'ayy', 'hoo'];

// —— 中文书面词（复用 dialogue.ts 思路，取高频标记子集） ——
const WRITTEN_ZH = ['然而', '因此', '此外', '与此同时', '换言之', '毋庸置疑', '众所周知', '总而言之', '综上所述', '故而', '仿佛', '宛如', '不禁', '缓缓', '眸子', '眼眸', '蓦地', '霎时', '内心深处', '心潮澎湃', '显而易见', '不仅', '而且', '之所以', '由于', '显然'];
// —— 英文书面词 / academic markers ——
const WRITTEN_EN = ['however', 'therefore', 'moreover', 'thus', 'hence', 'in conclusion', 'in summary', 'to summarize', 'in other words', 'that is to say', 'presumably', 'obviously', 'clearly', 'undoubtedly', 'unquestionably', 'as everyone knows', 'it is worth noting', 'one must', 'indeed', 'nevertheless', 'nonetheless', 'accordingly', 'as a result', 'furthermore', 'consequently'];

/**
 * 计算单个角色的语音指纹
 */
function fingerprint(name: string, lines: { text: string }[], lang: VoicePrintLang): VoicePrint {
  const n = lines.length;
  if (n === 0) {
    return { name, lineCount: 0, avgLen: 0, shortRatio: 0, longRatio: 0, questionRatio: 0, exclamRatio: 0, particles: {}, writtenHits: 0, signature: lang === 'en' ? 'no dialogue' : '无对白' };
  }
  const lens = lines.map((l) => l.text.length);
  const avgLen = Math.round(lens.reduce((s, x) => s + x, 0) / n);
  const shortRatio = Math.round((lens.filter((x) => x <= 8).length / n) * 100) / 100;
  const longRatio = Math.round((lens.filter((x) => x >= 30).length / n) * 100) / 100;
  const questionRatio = Math.round((lines.filter((l) => /[？?]/.test(l.text)).length / n) * 100) / 100;
  const exclamRatio = Math.round((lines.filter((l) => /[！!]/.test(l.text)).length / n) * 100) / 100;

  // 语气词频率
  const particles: Record<string, number> = {};
  const particleSet = lang === 'en' ? PARTICLES_EN : PARTICLES_ZH;
  for (const p of particleSet) {
    let count = 0;
    for (const l of lines) {
      if (lang === 'en') {
        // 英文按词边界匹配
        const re = new RegExp(`\\b${p}\\b`, 'gi');
        const m = l.text.match(re);
        if (m) count += m.length;
      } else {
        // 中文直接子串匹配
        for (const ch of l.text) if (ch === p) count += 1;
      }
    }
    if (count > 0) particles[p] = count;
  }

  // 书面词命中
  const writtenSet = lang === 'en' ? WRITTEN_EN : WRITTEN_ZH;
  let writtenHits = 0;
  for (const w of writtenSet) {
    for (const l of lines) {
      if (lang === 'en') {
        if (new RegExp(`\\b${w.replace(/\s+/g, '\\s+')}\\b`, 'i').test(l.text)) writtenHits += 1;
      } else {
        if (l.text.includes(w)) writtenHits += 1;
      }
    }
  }

  // 指纹简述（人话描述，供 advice 引用）
  const tone = shortRatio > 0.5 ? (lang === 'en' ? 'short-clipped' : '短句利落') : longRatio > 0.3 ? (lang === 'en' ? 'long-flowing' : '长句铺陈') : (lang === 'en' ? 'mixed-length' : '长短相间');
  const mood = questionRatio > 0.3 ? (lang === 'en' ? 'question-heavy' : '多疑问') : exclamRatio > 0.3 ? (lang === 'en' ? 'exclamatory' : '多感叹') : (lang === 'en' ? 'declarative' : '偏陈述');
  const topParticle = Object.entries(particles).sort((a, b) => b[1] - a[1])[0]?.[0];
  const particleHint = topParticle ? (lang === 'en' ? `, leans on "${topParticle}"` : `，爱用"${topParticle}"`) : '';
  const signature = lang === 'en' ? `${tone}, ${mood}${particleHint}, ${writtenHits} written-markers` : `${tone}、${mood}${particleHint}、书面词${writtenHits}处`;

  return { name, lineCount: n, avgLen, shortRatio, longRatio, questionRatio, exclamRatio, particles, writtenHits, signature };
}

/**
 * 计算两个指纹的相似度 0-100（越高越像）
 */
function similarity(a: VoicePrint, b: VoicePrint, lang: VoicePrintLang): { sim: number; reason: string } {
  // 句长维度：差值归一化（差越小越像）
  const lenDiff = Math.abs(a.avgLen - b.avgLen);
  const lenScore = Math.max(0, 100 - lenDiff * 4); // 每差1字扣4分

  // 句式维度：短句/长句/疑问/感叹占比差
  const ratioDiff = (x: number, y: number) => Math.abs(x - y);
  const shortScore = Math.max(0, 100 - ratioDiff(a.shortRatio, b.shortRatio) * 150);
  const longScore = Math.max(0, 100 - ratioDiff(a.longRatio, b.longRatio) * 150);
  const qScore = Math.max(0, 100 - ratioDiff(a.questionRatio, b.questionRatio) * 150);
  const eScore = Math.max(0, 100 - ratioDiff(a.exclamRatio, b.exclamRatio) * 150);

  // 语气词维度：Jaccard 相似度（top5 的重合度）
  // 边界处理：双方都无语气词时，应视为该维度完全一致（都"不用语气词"本身是共同特征），得满分
  const aKeys = new Set(Object.keys(a.particles));
  const bKeys = new Set(Object.keys(b.particles));
  const union = new Set([...aKeys, ...bKeys]);
  const inter = [...aKeys].filter((k) => bKeys.has(k));
  const jaccard = union.size > 0 ? inter.length / union.size : 1;
  const particleScore = Math.round(jaccard * 100);

  // 书面词维度：差异越小越像
  const wDiff = Math.abs(a.writtenHits - b.writtenHits);
  const wScore = Math.max(0, 100 - wDiff * 10);

  // 加权平均：句长25% + 句式40% + 语气词25% + 书面词10%
  const sim = Math.round(lenScore * 0.25 + (shortScore + longScore + qScore + eScore) / 4 * 0.4 + particleScore * 0.25 + wScore * 0.1);

  // 相似原因
  const reasons: string[] = [];
  if (lenDiff < 2) reasons.push(lang === 'en' ? `avg length close (${a.avgLen} vs ${b.avgLen})` : `句长相近(${a.avgLen} vs ${b.avgLen})`);
  if (ratioDiff(a.shortRatio, b.shortRatio) < 0.1) reasons.push(lang === 'en' ? 'similar short-sentence ratio' : '短句占比相近');
  if (jaccard > 0.5) reasons.push(lang === 'en' ? 'overlapping particles' : '语气词重合');
  if (wDiff < 2) reasons.push(lang === 'en' ? 'same written-marker count' : '书面词数相同');
  const reason = reasons.length ? reasons.join('；') : (lang === 'en' ? 'overall pattern overlap' : '整体模式重合');

  return { sim, reason };
}

/**
 * 对白指纹引擎主函数
 * @param cast 角色卡（用于确认角色名，voice 字段可选）
 * @param text 成稿文本
 * @param lang 中英文
 */
export function voicePrint(cast: CastMap, text: string, lang: VoicePrintLang = 'zh'): VoicePrintResult {
  const dialogues = parseDialogue(text);
  const byName = new Map<string, { text: string }[]>();
  for (const d of dialogues) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push({ text: d.text });
  }

  // 只对 cast 中声明的角色 + 实际有对白的角色取交集
  const castNames = Object.keys(cast);
  const activeNames = [...byName.keys()].filter((n) => castNames.includes(n) || byName.get(n)!.length >= 2);
  const prints: VoicePrint[] = [];
  const thinSamples: string[] = [];
  for (const name of activeNames) {
    const lines = byName.get(name) || [];
    if (lines.length < 2) {
      thinSamples.push(name);
      // 样本不足也记录指纹，但不参与相似度比对
      prints.push(fingerprint(name, lines, lang));
      continue;
    }
    prints.push(fingerprint(name, lines, lang));
  }

  // 两两比对相似度
  const comparable = prints.filter((p) => p.lineCount >= 2);
  const similarPairs: VoicePair[] = [];
  for (let i = 0; i < comparable.length; i++) {
    for (let j = i + 1; j < comparable.length; j++) {
      const { sim, reason } = similarity(comparable[i], comparable[j], lang);
      if (sim > 70) similarPairs.push({ a: comparable[i].name, b: comparable[j].name, similarity: sim, reason });
    }
  }
  similarPairs.sort((x, y) => y.similarity - x.similarity);

  // 整体性"一个味儿"检测：3+ 角色互相相似
  // 如果有 3 个角色，他们两两相似度都 >70，就是整体同质化
  const highPairs = similarPairs.filter((p) => p.similarity > 85);
  const involvedNames = new Set<string>();
  for (const p of highPairs) { involvedNames.add(p.a); involvedNames.add(p.b); }
  const homogeneousAll = involvedNames.size >= 3;

  // 问题列表
  const issues: VoicePrintResult['issues'] = [];
  for (const p of highPairs) {
    issues.push({
      severity: 'high',
      type: 'voice_homogeneous_pair',
      advice: lang === 'en'
        ? `${p.a} and ${p.b} sound too similar (${p.similarity}%): ${p.reason}. Give them distinct sentence lengths, particles, and word choices — one short/blunt, the other long/flowing, etc.`
        : `${p.a}和${p.b}说话太像（相似度${p.similarity}%）：${p.reason}。请区分他们的句式长短、语气词、用词偏好——一个短促直接、另一个绵长委婉等`,
    });
  }
  if (homogeneousAll) {
    const names = [...involvedNames].slice(0, 4).join('、');
    issues.push({
      severity: 'high',
      type: 'voice_homogeneous_all',
      advice: lang === 'en'
        ? `Multiple characters (${names}) all sound the same — this is the #1 short-drama complaint. Differentiate by: one uses questions, another exclamations; one short sentences, another long; one particles, another none`
        : `${names}等多个角色声音全部同质化——这是短剧第一差评点。请从句式（一个多疑问/一个多感叹）、句长（一个短促/一个绵长）、语气词（一个爱用/一个不用）三个维度强行拉开`,
    });
  }
  // mid 级（70-85）只进 issues 不触发重写
  for (const p of similarPairs.filter((p) => p.similarity > 70 && p.similarity <= 85)) {
    issues.push({
      severity: 'mid',
      type: 'voice_homogeneous_pair',
      advice: lang === 'en'
        ? `${p.a} and ${p.b} are somewhat similar (${p.similarity}%): ${p.reason}. Consider more differentiation`
        : `${p.a}和${p.b}略相似（${p.similarity}%）：${p.reason}，建议进一步区分`,
    });
  }
  for (const name of thinSamples) {
    issues.push({
      severity: 'low',
      type: 'voice_thin_sample',
      advice: lang === 'en'
        ? `${name} has fewer than 2 dialogue lines — voice fingerprint cannot be judged, ensure they have enough to speak`
        : `${name}对白不足2句——无法判定指纹，请确保该角色有足够台词`,
    });
  }

  // 得分：100 - high*15 - mid*5 - low*1，下限 0
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const midCount = issues.filter((i) => i.severity === 'mid').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;
  const score = Math.max(0, Math.min(100, 100 - highCount * 15 - midCount * 5 - lowCount * 1));

  return { prints, similarPairs, homogeneousAll, score, issues };
}
