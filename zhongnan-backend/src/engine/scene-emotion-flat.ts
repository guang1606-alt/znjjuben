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

/**
 * 前置教学：buildSceneEmotionFlatDirective(_format='LIVE', lang='zh')
 * ----------------------------------------------------------------
 * 同源铁律：教学函数与检测器 sceneEmotionFlat 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"单场对白要有情绪对比度"的检测口径，避免写完被
 *       prePolish 提示与 dialogue 维度加权打低分后才知道要改什么。
 */
export function buildSceneEmotionFlatDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Scene Emotional Flatness Pre-Writing Briefing (same source as sceneEmotionFlat: scene split + dialogue-only + three-valence + 0.8 threshold + score formula)】',
      '- Scene split: split on scene headers; lines before the first header count as one "(opening)" scene; no header = one scene.',
      '- Scan scope: dialogue lines only ("speaker 1-12 chars + colon + line"); action and blank lines ignored.',
      '- Threshold: a scene needs at least 3 dialogue lines to be judged; scenes with fewer are skipped.',
      '- Valence: negative checked first, then positive, otherwise neutral (negative wins when both appear).',
      '- Positive words (en 13): happy/glad/love/joy/smile/warm/grateful/hope/great/beautiful/sweet/wonderful/delighted.',
      '- Negative words (en 14): angry/hate/pain/sad/cry/afraid/fear/despair/furious/annoyed/miserable/terrible/awful/rage.',
      '- Two flat types: all-neutral (zero emotion words, nonNeu = 0) and single-valence (one side >= 0.8 of non-neutral lines).',
      '- Score formula: score = max(0, round(100 - flatRatio x 60 - allNeutralRatio x 20)).',
      '- Definitions: flatRatio = flat scenes / total scenes; allNeutralRatio = all-neutral scenes / total scenes; total 0 counts as 1; empty draft = 100.',
      '- Rewrite: add concrete emotional reactions or a positive-negative clash in all-neutral scenes; add one opposing line in single-valence scenes.',
      '- Pipeline consumption: prePolish injects a fix hint when flat scenes exist; dialogue dimension consumes score at 0.0549 weight.',
      '- Self-check: per scene - at least 3 dialogue lines? any emotion words? one valence dominating >= 80%?',
    ].join('\n');
  }
  return [
    '【场景情绪平·前置教学（检测同源：sceneEmotionFlat 场景切分 + 只扫对白 + 正负中三价 + 0.8 单极阈值 + 扣分公式）】',
    '- 场景切分：按场头（内景/外景/第X场/场：）切分，首个场头前的散行算作「(开场)」一场；无场头整篇算 1 场。',
    '- 检测范围：只扫对白行（「1-12 字说话人 + 冒号 + 台词」），动作行与空白行不计。',
    '- 判定门槛：单场对白 ≥3 句才判；不足 3 句的场直接跳过，不算平。',
    '- 情绪三价：先判负价、再判正价、都不中算中性；同一句既含正价又含负价时判负（负价优先）。',
    '- 正价词（zh 17）：开心/高兴/笑/爱/喜欢/幸福/温暖/感激/希望/乐/好/棒/美/甜/满足/轻松/安心。',
    '- 负价词（zh 17）：愤怒/恨/讨厌/痛苦/悲伤/哭/怕/恐惧/绝望/怒/气/烦/痛/死/杀/怨/惨。',
    '- 平场两类：all-neutral 全场对白零情绪词（nonNeu = 0）；single-valence 有情绪词但同价占比 ≥ 0.8，即 max(pos, neg) / nonNeu ≥ 0.8。',
    '- 得分公式：score = max(0, round(100 - flatRatio × 60 - allNeutralRatio × 20))。',
    '- 口径说明：flatRatio = 平场数 ÷ 总场数；allNeutralRatio = 全中性场数 ÷ 总场数；总场数为 0 时按 1 计；空稿满分 100。',
    '- 改写方向：全中性场给角色加具体情绪反应（动作/语气/生理反应）或安排正负情绪对撞；单极场加一句反向情绪的对白或动作打破平铺。',
    '- pipeline 消费：prePolish 在有平场时向润色师注入定向修复提示；dialogue 维度以 score 按 0.0549 权重并入。',
    '- 成稿自查：逐场数对白情绪 —— 是否 ≥3 句？是否全无情绪词？正负是否一边倒 ≥80%？',
  ].join('\n');
}
