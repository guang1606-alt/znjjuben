/**
 * 真人编剧风格库（PRD 2.2）
 * 三维：题材(theme) × 受众(audience) × 地域(region)，每个风格不是空标签，而是可执行参数：
 * 台词句长、口语度、语气词、方言点缀、时代/风格禁用词、爽点偏好、留白节奏。
 * 能力：
 *  - resolveStyle：合并三维选择为一份可执行风格画像，并对违和组合给协调提示
 *  - buildDirective：生成注入岗位智能体的风格指令
 *  - styleConsistencyScan：校验成品是否违背所选风格（时代错配、超长书面句、口语度不足、地域风味缺失）
 */
import { parseDialogue } from './character-logic';

export type ThemeId = 'shuangwen' | 'urban' | 'costume' | 'suspense' | 'hk';
export type AudienceId = 'mass' | 'young_female' | 'male' | 'premium';
export type RegionId = 'dongbei' | 'nanfang' | 'whitecollar' | 'none';

interface StyleNode {
  label: string;
  maxSentence: number;
  colloquial: number;          // 0-100，越高越口语
  particles: string[];         // 语气词
  preferred: string[];         // 偏好/允许词
  banned: string[];            // 该风格禁用词
  hooks: string[];            // 偏好爽点/钩子
  blank: 'low' | 'mid' | 'high';
}

const MODERN_SLANG = ['yyds', '绝绝子', '老铁', '666', '打call', 'emo', '社死', '拿捏', '芭比Q', '家人们', '宝子', '栓Q'];

export const THEME: Record<ThemeId, StyleNode> = {
  shuangwen: { label: '爽文逆袭风', maxSentence: 18, colloquial: 85, particles: ['啊', '呀', '呗', '嘛', '呵', '行'], preferred: ['打脸', '逆袭'], banned: ['综上所述', '与此同时'], hooks: ['打脸', '身份反转', '扮猪吃虎', '绝地翻盘'], blank: 'low' },
  urban: { label: '都市情感风', maxSentence: 24, colloquial: 75, particles: ['吧', '呢', '嘛', '啊'], preferred: ['误会', '心软'], banned: [], hooks: ['误会', '追妻火葬场', '破镜重圆', '隐婚'], blank: 'mid' },
  costume: { label: '古装权谋风', maxSentence: 22, colloquial: 55, particles: ['罢了', '便是', '么', '呢'], preferred: ['殿下', '臣', '妾身', '甚好', '何以', '本宫'], banned: MODERN_SLANG, hooks: ['权谋反转', '身世之谜', '棋局博弈'], blank: 'mid' },
  suspense: { label: '悬疑烧脑风', maxSentence: 20, colloquial: 65, particles: ['难道', '究竟', '莫非', '？'], preferred: ['线索', '真相'], banned: [], hooks: ['真相反转', '误导', '密室', '不在场证明'], blank: 'high' },
  hk: { label: '港式短剧风', maxSentence: 18, colloquial: 70, particles: ['啦', '嘛', '咯', '啊'], preferred: ['先生', '小姐', '差人', '大佬', 'sir'], banned: [], hooks: ['商战', '家族恩怨', '卧底'], blank: 'mid' },
};

export const AUDIENCE: Record<AudienceId, { label: string; colloquialDelta: number; sentenceDelta: number; note: string }> = {
  mass: { label: '下沉市场', colloquialDelta: 10, sentenceDelta: -3, note: '直给、情绪外放、不绕弯' },
  young_female: { label: '年轻女性向', colloquialDelta: 5, sentenceDelta: 0, note: '情绪细腻、重感受与关系' },
  male: { label: '男性向', colloquialDelta: -5, sentenceDelta: -2, note: '硬朗、少撒娇语气词、节奏更快' },
  premium: { label: '精品化路线', colloquialDelta: -10, sentenceDelta: 4, note: '允许更工整，信息密度高，拒绝口水' },
};

export const REGION: Record<RegionId, { label: string; colloquialDelta: number; dialect: string[]; note: string }> = {
  none: { label: '不限地域', colloquialDelta: 0, dialect: [], note: '' },
  dongbei: { label: '东北乡土风', colloquialDelta: 10, dialect: ['咋', '整', '唠', '旮旯', '得瑟', '贼', '干啥', '咋整'], note: '东北方言点缀，爽利幽默' },
  nanfang: { label: '南方市井风', colloquialDelta: 5, dialect: ['啦', '咩', '喔', '靓', '莫', '晓得'], note: '南方市井软语，生活化' },
  whitecollar: { label: '都市白领风', colloquialDelta: 0, dialect: ['方案', '客户', '绩效', '通勤', '项目', 'KPI'], note: '职场语境，避免土味方言' },
};

export interface StyleProfile extends StyleNode {
  themeId: ThemeId; audienceId: AudienceId; regionId: RegionId;
  dialect: string[];
  conflictNote?: string;
}

export function resolveStyle(sel: { theme: ThemeId; audience?: AudienceId; region?: RegionId }): StyleProfile {
  const t = THEME[sel.theme];
  const a = AUDIENCE[sel.audience ?? 'mass'];
  const r = REGION[sel.region ?? 'none'];
  let conflictNote: string | undefined;
  if (sel.theme === 'costume' && sel.region === 'dongbei') {
    conflictNote = '古装权谋与东北乡土跨度极大，请明确是古装喜剧还是正剧，否则容易出戏';
  }
  return {
    ...t,
    themeId: sel.theme, audienceId: sel.audience ?? 'mass', regionId: sel.region ?? 'none',
    colloquial: Math.max(0, Math.min(100, t.colloquial + a.colloquialDelta + r.colloquialDelta)),
    maxSentence: Math.max(8, t.maxSentence + a.sentenceDelta),
    preferred: Array.from(new Set([...t.preferred, ...r.dialect])),
    dialect: r.dialect,
    conflictNote,
  };
}

export function buildDirective(p: StyleProfile): string {
  return `【编剧风格·${p.label}】台词句长尽量≤${p.maxSentence}字，口语度约${p.colloquial}/100；`
    + `多用语气词（${p.particles.join('/')}）${p.dialect.length ? `，地域点缀词（${p.dialect.slice(0, 5).join('/')}）` : ''}；`
    + `偏好钩子/爽点：${p.hooks.join('、')}；留白节奏:${p.blank}；`
    + `禁用词：${p.banned.length ? p.banned.join('、') : '无特殊禁用，仍须去书面腔'}`
    + (p.conflictNote ? `；风格协调提示：${p.conflictNote}` : '');
}

export interface StyleIssue { severity: 'high' | 'mid' | 'low'; type: string; evidence: string; advice: string }

/** 校验成品是否贴合所选风格 */
export function styleConsistencyScan(text: string, p: StyleProfile): { issues: StyleIssue[]; score: number; particleRatio: number; longRatio: number } {
  const issues: StyleIssue[] = [];
  const lines = parseDialogue(text);
  const dialogueText = lines.map((l) => l.text);

  // 1) 时代/风格禁用词（硬伤）
  for (const w of p.banned) {
    if (text.includes(w)) issues.push({ severity: 'high', type: 'anachronism', evidence: `出现与「${p.label}」相悖的词：${w}`, advice: '删除时代错配/风格相悖词汇，换成符合世界观的表达' });
  }

  // 2) 超长书面句
  let long = 0;
  for (const d of dialogueText) {
    if (d.replace(/[，。、…？！\s]/g, '').length > p.maxSentence + 10) long += 1;
  }
  const longRatio = dialogueText.length ? Number((long / dialogueText.length).toFixed(2)) : 0;
  if (longRatio > 0.3) issues.push({ severity: 'mid', type: 'too_long', evidence: `${Math.round(longRatio * 100)}%台词超过该风格句长上限`, advice: `拆成≤${p.maxSentence}字的短句，更贴${p.label}节奏` });

  // 3) 语气词/口语度覆盖
  const withParticle = dialogueText.filter((d) => p.particles.some((x) => d.includes(x))).length;
  const particleRatio = dialogueText.length ? Number((withParticle / dialogueText.length).toFixed(2)) : 0;
  if (p.colloquial >= 70 && particleRatio < 0.2) {
    issues.push({ severity: 'mid', type: 'not_colloquial', evidence: `仅${Math.round(particleRatio * 100)}%台词带口语语气词，与高口语度风格不符`, advice: `按人物加${p.particles.slice(0, 4).join('/')}等自然语气，去掉朗诵腔` });
  }

  // 4) 地域风味缺失（仅提示）
  if (p.dialect.length >= 4 && !p.dialect.some((w) => text.includes(w))) {
    issues.push({ severity: 'low', type: 'region_missing', evidence: `选了地域风格但未见${p.label}点缀词`, advice: `少量自然点缀（${p.dialect.slice(0, 4).join('/')}），别硬堆` });
  }

  const deduct = issues.reduce((s, i) => s + (i.severity === 'high' ? 30 : i.severity === 'mid' ? 12 : 5), 0);
  return { issues, score: Math.max(0, 100 - deduct), particleRatio, longRatio };
}

/**
 * 自由风格文本 → 风格画像（v2.18：让真人编剧风格库能被管线等任意窗口安全调用）
 * 识别不出时返回 null（调用方安全跳过，绝不硬套风格）。
 */
const STYLE_HINT_RULES: [RegExp, ThemeId][] = [
  [/(爽文|逆袭|战神|赘婿|打脸|升级流|修仙|玄幻)/, 'shuangwen'],
  [/(都市|情感|婚恋|甜宠|虐恋|家庭|婆媳|年代)/, 'urban'],
  [/(古装|权谋|宫斗|宅斗|仙侠|古言)/, 'costume'],
  [/(悬疑|推理|犯罪|烧脑|刑侦)/, 'suspense'],
  [/(港|港式|商战|卧底)/, 'hk'],
];
export function resolveStyleByHint(hint?: string | null): StyleProfile | null {
  if (!hint) return null;
  for (const [re, theme] of STYLE_HINT_RULES) if (re.test(hint)) return resolveStyle({ theme });
  return null;
}

