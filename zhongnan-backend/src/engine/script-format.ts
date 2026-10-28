/**
 * 剧本格式 / 字数刚性校验闸门（PRD 2.5 双制式 + 12.1 P0 红线）
 *  - 真人实拍：单集 800-1000 汉字；标准剧本格式（集标题/场景/△动作/角色台词）
 *  - AIGC 制作：单集 1200-1500 汉字；可含镜头/光影/音效，但仍是剧本不是提示词
 *  - 拦截“提示词手册式污染”（prompt、--ar、关键词堆砌等）
 * 只做判定与诊断，不改写；改写由管线润色/扩缩环节负责。
 */

export type ScriptMode = 'LIVE' | 'AIGC';
export const WORD_RANGE: Record<ScriptMode, [number, number]> = {
  LIVE: [800, 1000],
  AIGC: [1200, 1500],
};

/** 统计汉字数（行业“字数”口径：CJK 表意文字，不含标点/空格/数字） */
export function cjkCount(text: string): number {
  const m = text.match(/[一-鿿]/g);
  return m ? m.length : 0;
}
/** 统计英文单词数 */
export function enWordCount(text: string): number {
  const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
  return m ? m.length : 0;
}
/** 是否英文稿（拉丁词数多于汉字数） */
export function isEnglishScript(text: string): boolean {
  return enWordCount(text) > cjkCount(text);
}
/**
 * 跨语言统一“字数当量”：英文按单词数 × 1.67 折算汉字（1 英文词信息量 ≈ 1.6-1.7 汉字）。
 * 使同一套 800-1000 / 1200-1500 闸门与扩缩闭环对中英成稿等价生效。
 */
export function scriptUnits(text: string): number {
  const cjk = cjkCount(text);
  const words = enWordCount(text);
  return words > cjk ? Math.round(words * 1.67) : cjk;
}

// 提示词/关键词堆砌污染（P0：禁止输出提示词形式内容）
export const PROMPT_POLLUTION = [
  /prompt/gi, /提示词[：:]/g, /--ar\s*\d/g, /--v\s*\d/g, /--style/g,
  /masterpiece/gi, /best quality/gi, /8k超高清/gi, /\b4k\b/gi, /cinematic shot/gi,
  /(关键词|tag)[:：]\s*[一-鿿A-Za-z,，、]{8,}/g,
];
const SCENE_RE = /(第\s*[0-9一二三四五六七八九十]+\s*集|内景|外景|日\s*[\/／]?\s*(夜|晨|昏)|夜\s*[\/／]?\s*[内外]|场景[：:]|^\s*SCENE\s*[:：])/im;
const ACTION_RE = /(^|\n)\s*[△▲*✦]\s*\S/;
const DIALOGUE_RE = /(^|\n)\s*(?:[一-龥·]{2,6}|[A-Z][A-Za-z.'-]{1,19}(?:\s[A-Z][A-Za-z.'-]{1,19})?)(?:（[^）]{0,10}）|\([^)]{0,20}\))?\s*[：:]\s*\S/m;

import { checkLiveFeasibility, type LiveFeasibilityReport } from './live-action-feasibility';
import { checkAigcShotFeasibility, type AigcShotReport } from './aigc-shot-feasibility';

export interface FormatReport {
  mode: ScriptMode;
  /** 字数当量：中文为汉字数；英文为单词×1.67 折算的汉字当量 */
  cjk: number;
  lang: 'zh' | 'en';
  range: [number, number];
  inRange: boolean;
  hasScene: boolean;
  hasAction: boolean;
  hasDialogue: boolean;
  pollution: string[];
  violations: string[];
  pass: boolean;
  score: number; // 0-100
  /** v2.337 真人实拍可拍性/制片可行性（AIGC 制式不适用，缺省不填） */
  feasibility?: LiveFeasibilityReport;
  /** v2.341 AIGC 单镜可生成性（LIVE 制式不适用，缺省不填） */
  shotPlan?: AigcShotReport;
}

export function validateScript(text: string, mode: ScriptMode = 'LIVE', durationMin = 1): FormatReport {
  const lang: 'zh' | 'en' = isEnglishScript(text) ? 'en' : 'zh';
  const cjk = scriptUnits(text);
  // v2.35 AIGC 字数带按成片时长缩放（1200-1500字/分钟）；LIVE 与缺省1分钟行为不变
  const d = mode === 'AIGC' ? Math.min(5, Math.max(0.5, Number(durationMin) || 1)) : 1;
  const [bLo, bHi] = WORD_RANGE[mode];
  const lo = Math.round(bLo * d), hi = Math.round(bHi * d);
  const violations: string[] = [];
  const pollution = PROMPT_POLLUTION.filter((re) => re.test(text)).map((re) => re.source.slice(0, 12));

  const hasScene = SCENE_RE.test(text);
  const hasAction = ACTION_RE.test(text);
  const hasDialogue = DIALOGUE_RE.test(text);

  if (cjk < lo) violations.push(`字数不足：${cjk}<${lo}`);
  if (cjk > hi) violations.push(`字数超限：${cjk}>${hi}`);

  if (mode === 'AIGC') {
    // v2.33 Z-AIGC 流畅制作本：五维可理解性 + 流畅度（人读顺畅/机器可拆），替代旧三要素判定
    const cov = validateAigcScreenplay(text);
    if (cov.sceneCount === 0) violations.push('缺标准场景信息（内景/外景 地点·时间）');
    violations.push(...cov.sceneIssues, ...cov.smoothnessIssues, ...cov.compositionIssues);
    if (pollution.length) violations.push(`含提示词式污染 ${pollution.length} 处`);
    // v2.341 单镜闸门：拆不开的巨镜/纯台词无画面镜与版式违规同级拦截；
    // 5-8 秒与多台词只作成本提示（shotPlan.issues），不阻断但计入单镜打分。
    const shotPlan = checkAigcShotFeasibility(text, d, lang);
    for (const iss of shotPlan.issues) {
      if (iss.severity === 'high') violations.push(lang === 'en' ? `Shot: ${iss.message}` : `镜头不可生成：${iss.message}`);
    }
    const wordScore = cjk < lo ? Math.max(0, 40 * cjk / lo)
      : cjk > hi ? Math.max(0, 40 * (1 - (cjk - hi) / hi)) : 40;
    // 字数40 + AIGC五维/流畅60（validateAigcScreenplay 满分100，折算60%）；单镜结论走 shotPlan，不重复折损总分
    const score = Math.round(wordScore + cov.score * 0.6);
    return {
      mode, cjk, lang, range: [lo, hi], inRange: cjk >= lo && cjk <= hi,
      hasScene: cov.sceneCount > 0,
      hasAction: cov.dimensions.action > 0,
      hasDialogue: DIALOGUE_RE.test(text),
      pollution, violations, pass: violations.length === 0, score, shotPlan,
    };
  }

  if (!hasScene) violations.push('缺标准场景信息（时间/地点/内外景）');
  if (!hasAction) violations.push('缺动作提示行（应以 △ 标注可拍摄动作）');
  if (!hasDialogue) violations.push('缺规范角色台词（角色名：台词）');
  if (pollution.length) violations.push(`含提示词式污染 ${pollution.length} 处`);
  // v2.337 可拍性闸门：制片维度的硬伤（场次/角色数超上限）与版式违规同级拦截；
  // 成本提示走 feasibility.issues（mid/low），不阻断但计入打分，供 QC 面板与 /fix 消费。
  const feasibility = checkLiveFeasibility(text, lang);
  for (const iss of feasibility.issues) {
    if (iss.severity === 'high') violations.push(lang === 'en' ? `Production: ${iss.message}` : `制片不可行：${iss.message}`);
  }

  // 打分：字数贴合度 40 + 三要素 30 + 无污染 30；v2.337 再按制片可行性折损（无问题时保持原分）
  const wordScore = cjk < lo ? Math.max(0, 40 * cjk / lo)
    : cjk > hi ? Math.max(0, 40 * (1 - (cjk - hi) / hi))
    : 40;
  const elemScore = (hasScene ? 10 : 0) + (hasAction ? 10 : 0) + (hasDialogue ? 10 : 0);
  const cleanScore = pollution.length ? 0 : 30;
  const baseScore = wordScore + elemScore + cleanScore;
  const score = Math.round(baseScore * (feasibility.score / 100));

  return { mode, cjk, lang, range: [lo, hi], inRange: cjk >= lo && cjk <= hi, hasScene, hasAction, hasDialogue, pollution, violations, pass: violations.length === 0, score, feasibility };
}

/**
 * 双制式写作指令（v2.18）：把 PRD 2.5.1/2.5.2 的差异在“生成前”下发给架构师/撰写岗，
 * 而不是只在生成后用 validateScript 做事后判分。纯函数、双语、英文零中文。
 *  - LIVE 真人实拍：800-1000 字、标准剧本格式、给导演/演员留现场发挥空间、不写镜头术语
 *  - AIGC 制作：1200-1500 字、Z-AIGC 流畅制作本（v2.33）：流畅自然段承载五维细节、
 *    自然括号承载内心/音效、机器可按集/场确定性拆分，仍不是提示词手册
 */
import { aigcScreenplayDirective, validateAigcScreenplay } from './aigc-screenplay';

export function scriptFormatDirective(mode: ScriptMode = 'LIVE', lang: 'zh' | 'en' = 'zh'): string {
  if (mode === 'AIGC') return aigcScreenplayDirective(lang);
  if (lang === 'en') {
    return `【OUTPUT FORMAT · LIVE-ACTION SHOOTING SCRIPT】Write a SCREENPLAY, not prose fiction: every filmable action must be its own line starting with △; every spoken line must be its own line in the form NAME (emotion/action cue): dialogue. Never embed dialogue inside narration paragraphs. Each episode 800-1000 Chinese characters across 3-4 scenes (about 250 chars per scene). Layout, exactly:
EPx Title
SCENE N: Location - Time (INT./EXT.)
△ one shootable action (under 40 chars)
NAME (emotion): dialogue
△ next action
NAME: dialogue
Rules: one △ line = one action; one dialogue line = one character's one utterance; no long narration blocks (never more than 3 consecutive non-action lines); keep dialogue short (under 30 chars per line); leave room for the director/actors; no shot-size or camera jargon; no prompt-style text. Production discipline (decided before writing, not after): 3-5 scenes per episode (hard cap 8 — a 9-scene episode cannot be scheduled); every scene header must state INT./EXT., location and time; reuse at least one existing location; no more than 6 speaking roles (hard cap 8); no crowd scenes, explosions, gunfights, car chases, underwater or high-altitude set pieces, and no more than half the scenes at night.`;
  }
  return `【输出制式·真人实拍剧本·强制版式】你写的是剧本不是小说，严禁大段连贯叙述、严禁把台词嵌在叙述段落里。单集严格800-1000字（3-4个场景，每场景约250字）。必须严格按以下骨架逐行排版：
第X集 标题
场景N：地点·时间（N为连续编号，如 场景1：老宅厨房·日）
△ 一个可拍摄动作（每行只写一个动作，不超过40字）
角色名（情绪/动作）：台词
△ 下一个动作
角色名：台词
硬性规则：①每个动作独占一行且必须以△开头；②每句台词独占一行，格式为“角色名（可选情绪）：台词”，不得写成“他说：”“某人喊道：”；③△动作行与台词行交替推进，不允许出现超过3行连续无△的纯叙述；④台词要短，单句尽量不超过30字；⑤给导演现场调度与演员表演留发挥空间，不要写景别/运镜术语，不要写提示词式文字；⑥制片铁律（写之前就定，不是写完再改）：单集3-5场（硬上限8场，超过就排不出通告）；每场场头必须写清「内景/外景+地点+时间」；至少复用一次已有场景；有台词角色不超过6人（硬上限8人）；不写群演、爆炸、枪战、追车、水下、高空这类要额外预算的场面；夜戏不超过一半。`;
}

