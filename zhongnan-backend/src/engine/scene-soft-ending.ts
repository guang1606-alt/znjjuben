import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 场景软收尾检测（Scene Soft Ending）
 * -----------------------------------------------------------
 * 创作能力类引擎：冲突刚顶上去，最后一场不落在钩子/决定/新信息上，
 * 而是落在"泄气"的软调度——
 *   林棠把亲子鉴定拍在桌上。沈知远脸色煞白。
 *   她叹了口气，转身默默离开。
 * 观众那口气刚提起来，被一声叹气放掉，划走。
 *
 * 硬切应该留在"牌桌"上：物证、未答的问题、新威胁、半截动作。
 *
 * 边界：
 *  - scene-padding.draggyTail 管【全集末段15%】矛盾已平后的"岁月静好"；
 *    本引擎管【每一个非末场】冲突后的泄气尾巴，颗粒度不同。
 *  - cliffhanger 只管全集最后一场；本引擎显式跳过末场。
 *  - hollow-action 管场内空心动作密度；本引擎只看"末拍落在什么上"。
 *  - 摔门/夺门是强能量收尾，不判；只有沉默/转身/叹气式软退才判。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface SoftEndingHit {
  sceneHeader: string;
  endLine: number;
  ending: string;
  reason: string;
}

export interface SceneSoftEndingResult {
  score: number;
  sceneCount: number;
  checkedScenes: number;
  hits: SoftEndingHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 场内曾有高能：冲突动作/物证/强情绪（精简信号，够判定"这口气提起来过"即可）
const ENERGY_ZH = /(摔|拍桌|猛拍|怒吼|吼|甩|夺门|冲进|冲出|跪|一巴掌|撕|泼|撞|拽|拦住|质问|吵架|翻脸|摊牌|离婚|分手|签字|辞职|开除|报警|证据|录音|亲子鉴定|遗嘱|真相|原来|怀孕|车祸|绑架|反转|崩溃|大哭|冷笑|羞辱|复仇|陷害|揭穿|掏出|下令|赶出|断绝关系|你凭什么|凭什么|给我滚|我不信|不可能)/;
const ENERGY_EN = /\b(slam(?:med)?|shouted|yelled|snatched|grabbed|slapped|kneel(?:t|ed)?|divorce|fired|resign|police|evidence|recording|dna|will|truth|pregnant|crash|kidnap|betray|exposed|get out|how dare you|i don't believe|no way)\b/i;

// 末拍泄气软调度（裸"走"不算，必须带沉默/转身/叹气质感）
const SOFT_ZH = /(?:长长?地?)?叹(?:了?口?气|息|道)|(?:转身|扭头)(?:离开|离去|走开|走远|而去)|(?:默默|悄悄|静静|缓缓|慢慢|失魂落魄地?)(?:转身|扭头|起身)?(?:离开|离去|走开|走远|退出|放下)|消失在(?:夜色|雨夜|雨里|走廊|人群|门口)|背影消失|(?:轻轻|缓缓|默默|慢慢)?(?:关上|带上)(?:了)?房门?|摇了摇头|摇摇头|沉默(?:不语|良久|许久|下来)|陷入(?:沉默|死寂)|房间里只剩|空气凝固|呆坐(?:在)?|瘫坐(?:在)?|怔怔地|久久(?:没有|没)说话/;
const SOFT_EN = /\b(?:walked|turned|shuffled|crept)\b[^.\n]{0,14}\b(?:away|out|off)\b|\b(?:he|she|they)\b[^.\n]{0,10}\bsighed\b|disappeared into|closed the door (?:softly|quietly|gently|behind)|shook (?:his|her|their) head|(?:fell into|stared in|froze in) silence|sat (?:back )?down (?:slowly|quietly)|slumped (?:back|against|into)|said nothing for a (?:long|while)|(?:long|heavy) silence\b/i;

// 末拍若出现强能量动作，则不是泄气（摔门/夺门/拂袖/storm/slam）
const STRONG_ZH = /(摔门|夺门|拍桌|猛(?:地|然)?|转身就走|扭头就走|拂袖|撞门|踹)/;
const STRONG_EN = /\b(stormed|marched|slammed|whipped|fired back|stomped|slammed the door)\b/i;

// 末拍如果带钩子/决定/新信息则不判
const HOOK_ZH = /(？|\?|手机|短信|电话响|屏幕亮|化验单|报告|鉴定|门被(?:推开|踹开)|你到底是谁|等着瞧|不会放过|明天就|最后通牒|倒计时|血|遗嘱|录音键|摄像头|红灯闪)/;
const HOOK_EN = /\?|phone (?:buzz|rang|screen)|text message|report|door (?:burst|slammed|flew) open|you'll pay|last chance|countdown|blood|will\b|record(?:ing|er)|camera/;

export function sceneSoftEnding(draft: string): SceneSoftEndingResult {
  if (!draft || !draft.trim()) {
    return { score: 100, sceneCount: 0, checkedScenes: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const energyRe = isZh ? ENERGY_ZH : ENERGY_EN;
  const softRe = isZh ? SOFT_ZH : SOFT_EN;
  const hookRe = isZh ? HOOK_ZH : HOOK_EN;

  // 切场：保留行号
  const scenes: { header: string; lines: { no: number; text: string }[] }[] = [];
  let header = isZh ? '(开场)' : '(opening)';
  let cur: { no: number; text: string }[] = [];
  const flush = () => { if (cur.length) scenes.push({ header, lines: cur }); cur = []; };
  draft.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { flush(); header = line; return; }
    cur.push({ no: i + 1, text: line });
  });
  flush();

  const hits: SoftEndingHit[] = [];
  // 末场交给 cliffhanger/收尾评分，只查内场
  const checkable = scenes.slice(0, -1);

  for (const sc of checkable) {
    if (sc.lines.length < 3) continue;
    // 场内先得有高能，才谈得上"泄气"
    const hadEnergy = sc.lines.some((l) => energyRe.test(l.text));
    if (!hadEnergy) continue;
    // 找最后一个非空叙述/对白拍
    const last = sc.lines[sc.lines.length - 1];
    const prev = sc.lines[sc.lines.length - 2];
    const tailText = `${prev.text}\n${last.text}`;
    const lastIsDialogue = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]/.test(last.text);
    // 末拍必须落在软调度叙述上；末拍对白带钩子/问号也不判
    if (lastIsDialogue) continue;
    if (!softRe.test(tailText)) continue;
    // 末拍里有强能量动作（摔门/拂袖/storm out）不算泄气
    const strongRe = isZh ? STRONG_ZH : STRONG_EN;
    if (strongRe.test(tailText)) continue;
    if (hookRe.test(last.text)) continue;
    hits.push({
      sceneHeader: sc.header,
      endLine: last.no,
      ending: last.text.length > 24 ? `${last.text.slice(0, 24)}…` : last.text,
      reason: isZh
        ? '冲突顶上去后末拍落在沉默/转身/叹气上，观众刚提起的气被放掉'
        : 'After the conflict peaks, the scene exhales into silence/exit business instead of cutting on the tension',
    });
  }

  const score = Math.max(20, 100 - hits.length * 9);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `「${h.sceneHeader}」${h.reason}（第${h.endLine}行：${h.ending}）——删软尾巴，硬切在物证、未答的问题、新威胁或半截动作上`
      : `"${h.sceneHeader}" ${h.reason} (line ${h.endLine}: ${h.ending}) — cut the exhale; hard-cut on evidence, an unanswered question, a new threat, or a half-finished move`);

  const advice = isZh
    ? hits.length > 0
      ? '场是切断的，不是散场的。冲突之后不要用叹气和背影替观众松绑——把刀留在桌上，切。'
      : '内场均能在张力上硬切，无泄气尾巴，保持。'
    : hits.length > 0
      ? 'Scenes are cut, not adjourned. Never release the audience with a sigh or a retreating back after conflict — leave the knife on the table and cut.'
      : 'Internal scenes hard-cut on tension with no exhale beats; keep it.';

  return { score, sceneCount: scenes.length, checkedScenes: checkable.length, hits, issues, advice };
}

// —— c211 落库统一形态（批量生成 / SSE / /fix 重算三处共用，禁止手写分叉）——
export const SFT_DIGEST_HITS_CAP = 8;
export const SFT_DIGEST_ISSUES_CAP = 6;
export const SHELL_HEADER_MAX = 40;
export const SFT_ENDING_MAX = 30;
export const SFT_REASON_MAX = 120;
export const SFT_ISSUE_MAX = 200;
export const SFT_ADVICE_MAX = 200;

export interface SceneSoftEndingDigest {
  score: number;
  sceneCount: number;
  checkedScenes: number;
  hits: { sceneHeader: string; endLine: number; ending: string; reason: string }[];
  issues: string[];
  advice: string;
}

const clip = (s: unknown, max: number): string => String(s ?? '').slice(0, max);

/**
 * 落库摘要：hits 只四字段并截断，issues/advice 限长；null 入参显式抛错，不静默伪造。
 * 健康稿（hits/issues 为空）同样落库——质检卡靠它做"过硬集"计数。
 */
export function sceneSoftEndingDigest(res: SceneSoftEndingResult | null | undefined): SceneSoftEndingDigest {
  if (!res || typeof res !== 'object') {
    throw new Error('sceneSoftEndingDigest: result required');
  }
  return {
    score: typeof res.score === 'number' ? res.score : 100,
    sceneCount: res.sceneCount ?? 0,
    checkedScenes: res.checkedScenes ?? 0,
    hits: (res.hits ?? []).slice(0, SFT_DIGEST_HITS_CAP).map((h) => ({
      sceneHeader: clip(h.sceneHeader, SHELL_HEADER_MAX),
      endLine: Number.isFinite(h.endLine) ? h.endLine : 0,
      ending: clip(h.ending, SFT_ENDING_MAX),
      reason: clip(h.reason, SFT_REASON_MAX),
    })),
    issues: (res.issues ?? []).slice(0, SFT_DIGEST_ISSUES_CAP).map((s) => clip(s, SFT_ISSUE_MAX)),
    advice: clip(res.advice, SFT_ADVICE_MAX),
  };
}

/** 正文 → 落库摘要（引擎内部自动判语种，无需入参） */
export function sceneSoftEndingForStorage(draft: string): SceneSoftEndingDigest {
  return sceneSoftEndingDigest(sceneSoftEnding(draft));
}
