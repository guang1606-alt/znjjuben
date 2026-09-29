import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 场景情绪平检测（Scene Emotional Flatness）
 * ------------------------------------------------------------------
 * 创作能力类引擎：检测单场景内对白是否缺乏情绪对比度（全场同一基调/无情绪词），
 * 给出"加情绪反差"的定向改写建议，喂 polisher。
 *
 * 查重分工：
 *  - emotion-wave：跨集情绪强度曲线（集与集之间的起伏）；
 *  - emotion-craft：爽点/打脸/反差结构（整体情绪设计）；
 *  - 本引擎：**单场景内**对白情绪对比度（场内心跳起伏）。
 *
 * 检测逻辑（纯确定性）：
 *  1. 按场景头切分场景（内景/外景/第X场/场：等）；
 *  2. 逐句对白判情绪价（正/负/中性），命中情绪词计入；
 *  3. 场为"平"当：对白≥3 句且（全中性 或 非中性中同价占比≥0.8）；
 *  4. score = 100 - flatScenes 占比*100 - 全中性场额外扣分。
 *
 * 零 LLM、零 IO；中英双语；en 层系统文案零中文。
 */

export interface FlatScene {
  sceneHeader: string;
  lineCount: number;
  posCount: number;
  negCount: number;
  neutralCount: number;
  reason: 'all-neutral' | 'single-valence';
  advice: string;
}

export interface SceneEmotionFlatResult {
  score: number;
  flatScenes: FlatScene[];
  totalScenes: number;
  issues: string[];
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const POS_ZH = ['开心', '高兴', '笑', '爱', '喜欢', '幸福', '温暖', '感激', '希望', '乐', '好', '棒', '美', '甜', '满足', '轻松', '安心'];
const POS_EN = ['happy', 'glad', 'love', 'joy', 'smile', 'warm', 'grateful', 'hope', 'great', 'beautiful', 'sweet', 'wonderful', 'delighted'];

const NEG_ZH = ['愤怒', '恨', '讨厌', '痛苦', '悲伤', '哭', '怕', '恐惧', '绝望', '怒', '气', '烦', '痛', '死', '杀', '恨', '怨', '恨', '惨', '怕'];
const NEG_EN = ['angry', 'hate', 'pain', 'sad', 'cry', 'afraid', 'fear', 'despair', 'furious', 'annoyed', 'miserable', 'terrible', 'awful', 'rage'];

function valenceOf(line: string, isZh: boolean): 'pos' | 'neg' | 'neutral' {
  const pos = isZh ? POS_ZH : POS_EN;
  const neg = isZh ? NEG_ZH : NEG_EN;
  const lower = line.toLowerCase();
  const has = (w: string) => isZh ? line.includes(w) : new RegExp(`\\b${w}\\b`).test(lower);
  if (neg.some(has)) return 'neg';
  if (pos.some(has)) return 'pos';
  return 'neutral';
}

// 场景头识别

function splitScenes(draft: string, isZh: boolean): { header: string; body: string }[] {
  const scenes: { header: string; body: string }[] = [];
  let curHeader = isZh ? '(开场)' : '(opening)';
  let curBody: string[] = [];
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      if (curBody.length) scenes.push({ header: curHeader, body: curBody.join('\n') });
      curHeader = line;
      curBody = [];
    } else {
      curBody.push(raw);
    }
  }
  if (curBody.length) scenes.push({ header: curHeader, body: curBody.join('\n') });
  return scenes;
}

function extractDialogue(body: string): string[] {
  const lines: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^[^\s：:]{1,12}\s*[：:]\s*(.+)$/);
    if (m) {
      const sp = m[1].trim();
      if (sp) lines.push(sp);
    }
  }
  return lines;
}

export function sceneEmotionFlat(draft: string): SceneEmotionFlatResult {
  if (!draft || !draft.trim()) {
    return { score: 100, flatScenes: [], totalScenes: 0, issues: [] };
  }
  const isZh = isZhText(draft);
  const scenes = splitScenes(draft, isZh);
  const flatScenes: FlatScene[] = [];

  for (const sc of scenes) {
    const lines = extractDialogue(sc.body);
    if (lines.length < 3) continue;
    let pos = 0, neg = 0, neu = 0;
    for (const l of lines) {
      const v = valenceOf(l, isZh);
      if (v === 'pos') pos++;
      else if (v === 'neg') neg++;
      else neu++;
    }
    const nonNeu = pos + neg;
    const isAllNeutral = nonNeu === 0;
    const isSingleValence = nonNeu > 0 && (Math.max(pos, neg) / nonNeu) >= 0.8;
    if (isAllNeutral || isSingleValence) {
      const reason: FlatScene['reason'] = isAllNeutral ? 'all-neutral' : 'single-valence';
      const advice = isZh
        ? (reason === 'all-neutral'
          ? '本场对白全无情绪词，像念台词。给角色加具体的情绪反应（动作/语气/生理反应），或安排正负情绪对撞。'
          : `本场情绪基调单一（${pos > neg ? '正' : '负'}向主导），加一个反向情绪的对白或动作打破平铺。`)
        : (reason === 'all-neutral'
          ? 'No emotion words in this scene\'s dialogue. Add concrete emotional reactions (action/tone/physiology) or a positive-negative emotional clash.'
          : `Single emotional valence (${pos > neg ? 'positive' : 'negative'} dominant). Add one opposing line or beat to break the flat tone.`);
      flatScenes.push({ sceneHeader: sc.header, lineCount: lines.length, posCount: pos, negCount: neg, neutralCount: neu, reason, advice });
    }
  }

  const total = scenes.length || 1;
  const flatRatio = flatScenes.length / total;
  // 全中性场额外扣分（比单一价更平）
  const allNeutralPenalty = flatScenes.filter((s) => s.reason === 'all-neutral').length / total * 20;
  const score = Math.max(0, Math.round(100 - flatRatio * 60 - allNeutralPenalty));

  const issues = flatScenes.map((s) =>
    isZh
      ? `场景「${s.sceneHeader}」情绪平（${s.reason === 'all-neutral' ? '全无情绪词' : `${s.posCount > s.negCount ? '正' : '负'}向主导`}）`
      : `Scene "${s.sceneHeader}" emotionally flat (${s.reason === 'all-neutral' ? 'no emotion words' : `${s.posCount > s.negCount ? 'positive' : 'negative'} dominant`})`,
  );

  return { score, flatScenes, totalScenes: scenes.length, issues };
}
