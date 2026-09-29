/**
 * polish-fix.ts —— 诊断→一键针对性优化（闭环的“执行端”，纯函数、可单测、不连库不调模型）
 *
 * 全本诊断(full-diagnosis)给出的是“全本级”问题，没有具体集号。一键优化要落到可重写的单集，
 * 本模块负责两件事：
 *  1) pickEpisodeForFix：对每一集单独跑五套尺子，定位“该问题最严重”的那一集（自动、智能、成本为0 CPU）；
 *  2) buildFixPrompt：把一条诊断问题转成润色师可执行的改写指令——只改这一处、保持其余不变、输出完整修订版。
 *
 * 模型调用与计费在路由层完成，本模块不掺钱、不掺 I/O，保证可测、可复用。
 */
import { craftLint } from './craft-lint';
import { emotionCraftLint } from './emotion-craft';
import { webnovelLint } from './webnovel-craft';
import { archetypeLint } from './archetype-craft';
import { narrativeLint } from './narrative-craft';
import { TopFix } from './full-diagnosis';
import { buildPlaybookBlock } from './fix-playbook';

export interface FixEpisode { epNo: number; title?: string; content: string }

/** 单集跑五套尺子，返回某条规则在该集的得分（无命中返回 null） */
function ruleScoreForEpisode(text: string, rule: string): number | null {
  if (!text || !text.trim()) return null;
  const craft = craftLint({ episodes: [text], text, title: undefined });
  const emo = emotionCraftLint({ text, episodes: [text], isIntrigue: /权谋|宫斗|商战|朝堂|夺嫡/.test(text) });
  const wn = webnovelLint({ text, ending: text });
  const at = archetypeLint({ text, opening: text.slice(0, 600) });
  const nt = narrativeLint({ text, ending: text });
  const hit = [...craft.issues, ...emo.issues, ...wn.issues, ...at.issues, ...nt.issues].find((i) => i.rule === rule);
  return typeof hit?.score === 'number' ? hit.score : null;
}

/**
 * 定位最该改的那一集：
 *  - 只在“确实命中该问题”的集里挑分数最低者；
 *  - 若没有任何一集命中（聚合类/大纲类规则），兜底取第 1 集，仍可按建议整体打磨；
 *  - 返回 { epNo, score }，score 为 null 表示兜底。
 */
export function pickEpisodeForFix(
  episodes: FixEpisode[], rule: string,
): { epNo: number; score: number | null } {
  const list = (episodes || []).filter((e) => e && (e.content || '').trim());
  if (!list.length) return { epNo: 1, score: null };
  let worst: { epNo: number; score: number } | null = null;
  for (const e of list) {
    const s = ruleScoreForEpisode(e.content, rule);
    if (s === null) continue;
    if (!worst || s < worst.score) worst = { epNo: e.epNo, score: s };
  }
  if (worst) return worst;
  return { epNo: list[0].epNo, score: null };
}

export type ScriptMode = 'live' | 'aigc';

/** 构造润色师改写指令（只改问题、保持其余、输出完整修订版剧本，禁止解释和关键词堆砌） */
export function buildFixPrompt(
  original: string,
  fix: Pick<TopFix, 'dimLabel' | 'advice' | 'rule'>,
  opts: { scriptMode?: ScriptMode; lang?: 'zh' | 'en'; castNames?: string[] } = {},
): string {
  const lang = opts.lang === 'en' ? 'en' : 'zh';
  const isAigc = opts.scriptMode === 'aigc';
  // c220 专科改写兵法：按规则键注入病灶识别+具体手法+验收标准；未收录规则退回纯通用提示
  const playbook = buildPlaybookBlock(fix.rule, lang);
  const wordRule = isAigc
    ? (lang === 'en' ? '1200-1500 Chinese-char-equivalent length, AIGC-production format' : '单集1200-1500字，AIGC制作剧本格式（景别/运镜/光影/人物微情绪/音效）')
    : (lang === 'en' ? '800-1000 Chinese-char-equivalent length, live-action shooting format' : '单集800-1000字，真人实拍剧本格式（场景/人物/动作/带情绪标注的台词）');
  const cast = (opts.castNames || []).filter(Boolean).join('、');
  if (lang === 'en') {
    return [
      'You are a senior vertical-short-drama script doctor. Rewrite ONLY to fix the diagnosed problem below; keep every other plot beat, character, scene order and title structure unchanged.',
      `Dimension: ${fix.dimLabel}. Problem to fix: ${fix.advice}`,
      playbook || '',
      cast ? `Keep these characters consistent: ${cast}.` : '',
      `Format requirement: ${wordRule}.`,
      'Dialogue must be speakable, in-register for each character (age/identity/region/personality), no AI-style parallelism or lecturing; details must serve story/emotion, never padded; no prompt-style keyword dumps.',
      'Output the COMPLETE revised episode script only — no explanation, no before/after notes, no markdown fences.',
      '----- ORIGINAL EPISODE -----',
      original,
    ].filter(Boolean).join('\n');
  }
  return [
    '你是资深竖屏短剧剧本医生。请只针对下面诊断出的这一处问题修订本集，其余剧情节拍、人物、场景顺序、标题结构一律保持不变，不得借机改写无关内容。',
    `问题维度：${fix.dimLabel}。必须解决的问题：${fix.advice}`,
    playbook || '',
    cast ? `保持以下人物人设与口吻一致：${cast}。` : '',
    `格式要求：${wordRule}。`,
    '台词必须能念出口、贴合人物年龄/身份/地域/性格，杜绝AI式工整对仗与说教；细节为叙事和情绪服务、不堆字数；禁止提示词式关键词堆砌。',
    '直接输出修订后的【完整本集剧本正文】，不要解释、不要修改说明、不要前后缀、不要markdown代码块。',
    '----- 本集原稿 -----',
    original,
  ].filter(Boolean).join('\n');
}

/** 校验模型返回是否是可用的完整修订稿（长度达标且不是解释性回复） */
export function isUsableRewrite(text: string, original: string): boolean {
  const t = (text || '').trim();
  if (t.length < 200) return false;
  // 明显是“解释/道歉”而非剧本
  if (/^(抱歉|无法|我不能|作为一个|I'm sorry|I cannot|As an AI)/i.test(t)) return false;
  // 长度与原稿同量级（0.5~2.2倍），避免截断或注水
  const ratio = t.length / Math.max(original.length, 1);
  return ratio >= 0.5 && ratio <= 2.2;
}
