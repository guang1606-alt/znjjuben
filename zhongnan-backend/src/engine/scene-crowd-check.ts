/**
 * v2.352 单场群戏超载检测引擎（Scene Crowd Check）
 * ------------------------------------------------------------------
 * 盲区坐实：全引擎零覆盖「单场 distinct 说话人数」。
 *  - round-robin-dialogue：管群戏"读稿感"（轮转形式），不管人数多少；
 *  - character-balance-check：管全剧戏份比例，不管单场；
 *  - information-density-score：管单场信息推进数≥4，不管人数；
 *  - dialogue-functionality-check：管信息倾倒，不管人数；
 *  - character-presence-check：管全稿不同说话人个数（speakerCount），不切场。
 * 边界：同一场 5+ 个角色都开口抢话，观众分不清谁是谁，镜头乱成一锅粥；
 * 短剧竖屏尤甚——单屏容不下 5 张脸，AIGC 多角色同框一致性更是灾难。
 *
 * 判定（确定性，零 LLM、零 IO）：
 *  - 场切分复用 script-scenes.splitScriptScenes（c213 单一事实源）；
 *  - 每场用 character-logic.parseDialogue 提取 distinct 说话人；
 *  - 群体标签（众人/群众/同学们/大家/crowd/everyone 等）算 1 个说话人；
 *  - 旁白/解说/画外音不计入；
 *  - 单场 5-6 人 → mid crowded_scene；≥7 人 → high crowded_scene_overload；
 *  - 多场超限累计扣分：score = max(0, 100 - 22×high数 - 10×mid数)；
 *  - 空稿/畸形输入 checked=false 满分放行；EN 链路系统文案零中文。
 */

import { splitScriptScenes, isSceneHeaderLine, type ScriptScene } from './script-scenes';
import { parseDialogue } from './character-logic';

export type CrowdLang = 'zh' | 'en';

export interface CrowdIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'crowded_scene' | 'crowded_scene_overload';
  evidence: string;
  advice: string;
}

export interface CrowdResult {
  score: number;
  /** 输入有效（非空、≥20字正文）才检测；空稿/畸形输入 checked=false 满分放行 */
  checked: boolean;
  /** 场数（含无场头 fallback 单场） */
  sceneCount: number;
  /** 超限场数（mid + high 合计） */
  crowdedCount: number;
  /** 全稿单场最大说话人数 */
  maxSpeakers: number;
  issues: CrowdIssue[];
}

/** 群体标签：算 1 个说话人，不重复计 */
const GROUP_ZH = /^(?:众人|群众|大家|同学们|同事们|朋友们|亲友们|宾客们|员工们|记者们|围观者|吃瓜群众)$/i;
const GROUP_EN = /^(?:crowd|everyone|everybody|all|group|audience|people|onlookers|bystanders|reporters|guests|students|colleagues|friends|relatives|shareholders)$/i;

/** 旁白/解说/画外音：不计入说话人数 */
const NARRATOR_ZH = /^(?:旁白|解说|画外音|旁述|叙述|narrator|voiceover|vo)$/i;
const NARRATOR_EN = /^(?:narrator|voiceover|vo|narration)$/i;

function isGroupSpeaker(name: string): boolean {
  return GROUP_ZH.test(name) || GROUP_EN.test(name);
}

function isNarratorSpeaker(name: string): boolean {
  return NARRATOR_ZH.test(name) || NARRATOR_EN.test(name);
}

/**
 * EN 说话人提取（宽松版）：character-logic.parseDialogue 的正则
 * `[一-龥A-Za-z·]{1,6}(?:（…））?` 对 EN 有两大盲区——
 *  ① 名字最长 6 字符（CHAIRMAN/SECRETARY 超限）；
 *  ② 只认全角括号（），EN 剧本用半角 (stern)。
 * 本函数对 EN 用更宽容的格式：NAME 或 NAME (emotion) 或 NAME: 后跟台词；
 * 名字允许 1-24 字符含空格（LIN WAN / Dr. Smith / Mary Jane）。
 * 中文仍走 parseDialogue（与全引擎同口径）。
 */
function parseSpeakersEn(body: string): string[] {
  const out: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('△') || isSceneHeaderLine(line, 'en')) continue;
    // NAME (emotion): line / NAME: line / NAME (emotion) : line
    const m = line.match(/^([A-Za-z][A-Za-z\s.'-]{0,22}?)(?:\s*\([^)]*\))?\s*:\s*(.+)$/);
    if (m && m[2].trim()) out.push(m[1].trim());
  }
  return out;
}

function sceneSpeakers(scene: ScriptScene, isZh: boolean): string[] {
  const names: string[] = isZh
    ? parseDialogue(scene.body).map((d) => d.name)
    : parseSpeakersEn(scene.body);
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || isNarratorSpeaker(name)) continue;
    // 群体标签归一为「群体」一个说话人
    const key = isGroupSpeaker(name) ? '__GROUP__' : name;
    seen.add(key);
  }
  return [...seen];
}

function sceneLabel(scene: ScriptScene, isZh: boolean): string {
  if (scene.header) return scene.header;
  return isZh ? '全文（无场头）' : 'Full text (no scene header)';
}

export function sceneCrowdCheck(
  text: string | null | undefined,
  lang: CrowdLang = 'zh',
): CrowdResult {
  const isZh = lang === 'zh';
  const base: CrowdResult = { score: 100, checked: false, sceneCount: 0, crowdedCount: 0, maxSpeakers: 0, issues: [] };
  const body = (text ?? '').replace(/\r\n?/g, '\n');
  if (body.trim().length < 20) return base;

  const scenes = splitScriptScenes(body, lang);
  const issues: CrowdIssue[] = [];
  let highCount = 0;
  let midCount = 0;
  let maxSpeakers = 0;

  for (const sc of scenes) {
    const speakers = sceneSpeakers(sc, isZh);
    const count = speakers.length;
    if (count > maxSpeakers) maxSpeakers = count;

    if (count >= 7) {
      highCount++;
      issues.push({
        severity: 'high',
        type: 'crowded_scene_overload',
        evidence: isZh
          ? `「${sceneLabel(sc, true)}」同场 ${count} 个角色开口：${speakers.join('、')}。竖屏单屏容不下 7 张脸，观众根本分不清谁是谁。`
          : `Scene "${sceneLabel(sc, false)}" has ${count} speaking characters: ${speakers.join(', ')}. A vertical screen cannot hold seven faces; viewers cannot tell who is who.`,
        advice: isZh
          ? '单场最多 4 个角色开口，其余人要么合并成小角色、要么拆到下一一场、要么用动作/眼神代替台词。群戏不是圆桌会议，必须有主次。'
          : 'No more than four speaking characters per scene. Merge minor roles, split the scene, or replace lines with actions and glances. A group scene is not a roundtable meeting.',
      });
    } else if (count >= 5) {
      midCount++;
      issues.push({
        severity: 'mid',
        type: 'crowded_scene',
        evidence: isZh
          ? `「${sceneLabel(sc, true)}」同场 ${count} 个角色开口：${speakers.join('、')}。短剧单屏超过 4 人，观众注意力开始分散。`
          : `Scene "${sceneLabel(sc, false)}" has ${count} speaking characters: ${speakers.join(', ')}. Beyond four faces on a short-drama screen, viewer attention fragments.`,
        advice: isZh
          ? '考虑合并小角色、拆场，或让部分人只带动作在场不开口。'
          : 'Consider merging minor roles, splitting the scene, or letting some characters be present through action only.',
      });
    }
  }

  return {
    score: Math.max(0, 100 - 22 * highCount - 10 * midCount),
    checked: true,
    sceneCount: scenes.length,
    crowdedCount: highCount + midCount,
    maxSpeakers,
    issues,
  };
}

/**
 * v2.371 前置教学指令：单场 distinct 说话人数 ≤4
 * ----------------------------------------------------------------------
 * 与 sceneCrowdCheck 同文件同源（v2.157 同源铁律）。
 * zh 七条：① distinct 说话人阈值（≤4 安全 / ≥5 mid / ≥7 high）
 * ② 量化同源（22/high、10/mid 扣分）③ 三种正向动作（合并 / 拆场 / 动作代替台词）
 * ④ 群体标签归并（众人/大家/crowd 算 1 人）+ 旁白/解说不计入
 * ⑤ 边界五项（群戏轮转形式归 round-robin-dialogue / 全剧戏份比例归 character-balance-check /
 *   单场信息推进数归 information-density / 全稿 speakerCount 归 character-presence-check /
 *   拆场节奏归 craft-lint）⑥ LIVE/AIGC 制式分叉。
 * en 层零中文。缺省 format=LIVE。
 */
export function buildSceneCrowdDirective(
  format: 'LIVE' | 'AIGC' = 'LIVE',
  lang: CrowdLang = 'zh',
): string {
  if (lang === 'en') {
    const base = [
      '◆ Scene crowd control: no more than 4 distinct speaking characters per scene.',
      '  ≥5 speakers in one scene → mid penalty 10 per scene; ≥7 → high penalty 22 per scene.',
      '  Vertical short-drama screens cannot show 7 faces clearly — viewers lose track.',
      '◆ Three fixes: ① Merge minor roles into one speaker, ② Split the scene across two beats, ③ Replace some lines with actions, glances, or crowd reactions.',
      '◆ Group labels (crowd / everyone / audience) count as 1 speaker each; narrator / voiceover does not count.',
      '◆ Boundaries: group-scene read-aloud form → round-robin-dialogue / full-drama screen ratio → character-balance-check / per-scene info push count → information-density / whole-script speaker count → character-presence-check / beat-splitting rhythm → craft-lint.',
    ];
    if (format === 'AIGC') {
      base.push('◆ AIGC mode: write crowd scenes as flowing paragraphs without △ lines. Silence, pauses, and crowd reactions go into continuous action; if a character only needs to react, write that reaction as a visual detail instead of a line of dialogue.');
    } else {
      base.push('◆ LIVE mode: crowd reactions written as dedicated △ action lines. One beat of △ before each speaker change keeps the camera following faces clearly.');
    }
    return base.join('\n');
  }

  const zh = [
    '◆ 单场 distinct 说话人数控制：每场最多 4 个角色开口。',
    '  同场 ≥5 人开口 → mid 扣 10 分/场；≥7 人开口 → high 扣 22 分/场。',
    '  短剧竖屏单屏容不下 7 张脸，观众根本分不清谁是谁。',
    '◆ 三种正向动作：① 把 2-3 个小角色合并成一个说话人（功能一样的人只留一个开口）',
    '  ② 把 7 人轮流转的群戏拆成两场——前半 3 人达成共识，后半另一场景 4 人执行',
    '  ③ 让部分人只做动作在场不开口：用眼神、点头、掏东西、起身等 △ 动作代替台词',
    '◆ 群体标签归并：众人/大家/同学们/crowd/everyone 算 1 个说话人，不重复计；旁白/解说/画外音不计入说话人数。',
    '◆ 边界五项：群戏"读稿感"轮转形式归 round-robin-dialogue、全剧戏份比例归 character-balance-check、单场信息推进数归 information-density、全稿不同 speaker 总数归 character-presence-check、拆场节奏归 craft-lint。',
  ];
  if (format === 'AIGC') {
    zh.push('◆ AIGC 制式：正文不加 △。群戏的沉默、眼神交流和人群反应写进连续自然段里——如果某个角色只需要有反应，把那个反应写成视觉细节而不是一句台词。');
  } else {
    zh.push('◆ LIVE 制式：每次换说话人之前加一行 △ 动作行（△ 众人议论纷纷 / △ 顾言抬眼环视），让镜头有地方落、观众跟得上谁在说话。');
  }
  return zh.join('\n');
}
