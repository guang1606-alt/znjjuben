import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * v2.80 对白 AI 味检测（Dialogue AI-Taste Detection）
 * ------------------------------------------------------------------
 * 创作能力类引擎（非防穿帮）：定位 AI 生成对白的典型痕迹，给出定向改写建议喂 polisher。
 *
 * 查重分工（近邻引擎）：
 *  - voice-print：角色声纹独特度/一致性；
 *  - dialogue-water：台词水分/冗余；
 *  - 本引擎：**AI 味**——排比堆砌、说教腔、书面语过重、解释性台词、万能金句。
 *
 * 检测维度（纯确定性，逐句打分）：
 *  1. parallelism  排比堆砌：≥3 个结构相似并列短句（你不…你不…你不…）
 *  2. lecturing    说教腔：你要知道/你必须明白/你应该懂得/记住/听好了 + 长句
 *  3. formal       书面语过重：因此/然而/倘若/故此/众所周知/综上所述
 *  4. expository   解释性台词：因为…所以… / 我告诉你…是因为… / 这就是为什么
 *  5. aphorism     万能金句：真正的…是… / 人生就像… / 只有…才能… / 不管…都…
 *
 * 输出：score(0-100 越高越AI味) + issues[] + breakdown。零 LLM、零 IO；中英双语。
 * en 层系统文案零中文。
 */

export type AiTasteType = 'parallelism' | 'lecturing' | 'formal' | 'expository' | 'aphorism';

export interface DialogueAiTasteIssue {
  line: string;
  type: AiTasteType;
  severity: 'high' | 'medium' | 'low';
  advice: string;
}

export interface DialogueAiTasteResult {
  score: number;
  issues: DialogueAiTasteIssue[];
  breakdown: Record<AiTasteType, number>;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 提取对白行：格式 "角色名：台词" 或 "角色名：（情绪）台词" 或 "角色名:台词"
function extractDialogueLines(draft: string): string[] {
  const lines: string[] = [];
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // c213：场头/剧名页判定收口共享切分器；另保留本地"日/夜/闪回/括号"纯标签行跳过（非场头语义）
    if ((isSceneOrTitleLine(line) || /^(?:日|夜|闪回|\[|（|\()/.test(line)) && !/[：:]/.test(line)) continue;
    const m = line.match(/^[^\s：:]{1,12}\s*[：:]\s*(.+)$/);
    if (m) {
      const speech = m[1].trim();
      if (speech) lines.push(speech);
    }
  }
  return lines;
}

const LECT_ZH = ['你要知道', '你必须明白', '你应该懂得', '你听我说', '记住', '听好了', '我告诉你', '你给我记着'];
const LECT_EN = ['you must understand', 'you need to know', 'you should realize', 'let me tell you', 'remember that', 'listen carefully'];

const FORM_ZH = ['因此', '然而', '倘若', '故此', '众所周知', '综上所述', '由此可见', '毋庸置疑'];
const FORM_EN = ['therefore', 'however', 'thus', 'hence', 'consequently', 'as we all know', 'in conclusion'];

const EXPO_ZH = ['因为所以', '是因为', '这就是为什么', '之所以是因为', '由于因此'];
const EXPO_EN = ['because of this', 'this is why', 'the reason is that', 'due to the fact that'];

const APH_ZH = ['真正的是', '人生就像', '只有才能', '不管都', '只要就一定', '没有就没有'];
const APH_EN = ['the true meaning of', 'life is like', 'only by can we', 'no matter what', 'as long as we'];

function wordHit(text: string, w: string, isZh: boolean): boolean {
  return isZh ? text.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(text);
}

/** 检测排比：≥3 个以相同代词/否定词开头的短句 */
function detectParallelism(speech: string, isZh: boolean): boolean {
  if (isZh) {
    const parts = speech.split(/[，,；;]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) return false;
    const starters = parts.map((p) => p.slice(0, 2));
    const counts = new Map<string, number>();
    for (const s of starters) counts.set(s, (counts.get(s) || 0) + 1);
    return [...counts.values()].some((c) => c >= 3);
  }
  const parts = speech.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return false;
  const starters = parts.map((p) => p.split(/\s+/)[0]?.toLowerCase() || '');
  const counts = new Map<string, number>();
  for (const s of starters) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.values()].some((c) => c >= 3);
}

function classify(speech: string, isZh: boolean): AiTasteType | null {
  const lect = isZh ? LECT_ZH : LECT_EN;
  const form = isZh ? FORM_ZH : FORM_EN;
  const expo = isZh ? EXPO_ZH : EXPO_EN;
  const aph = isZh ? APH_ZH : APH_EN;

  // 优先级：说教 > 解释 > 金句 > 书面 > 排比
  if (lect.some((w) => wordHit(speech, w, isZh)) && speech.length > 20) return 'lecturing';
  if (expo.some((w) => wordHit(speech, w, isZh))) return 'expository';
  if (aph.some((w) => wordHit(speech, w, isZh))) return 'aphorism';
  if (form.some((w) => wordHit(speech, w, isZh))) return 'formal';
  if (detectParallelism(speech, isZh)) return 'parallelism';
  return null;
}

function adviceFor(type: AiTasteType, isZh: boolean): string {
  const zh: Record<AiTasteType, string> = {
    parallelism: '拆解排比，改用错落节奏；保留一句点睛即可',
    lecturing: '改说教为行动/潜台词，让角色用做代替说',
    formal: '把书面语换成口语词，对白要能说出口',
    expository: '拆分解释性台词，把信息藏进动作或冲突',
    aphorism: '删掉万能金句，用角色独有的表达代替',
  };
  const en: Record<AiTasteType, string> = {
    parallelism: 'Break the parallel structure; vary rhythm, keep one punch line',
    lecturing: 'Replace lecturing with action/subtext; show through doing',
    formal: 'Swap formal words for colloquial speech; dialogue must be speakable',
    expository: 'Split explanatory lines; hide information in action or conflict',
    aphorism: 'Drop generic aphorisms; use the character\'s own voice',
  };
  return isZh ? zh[type] : en[type];
}

export function dialogueAiTaste(draft: string): DialogueAiTasteResult {
  if (!draft || !draft.trim()) {
    return { score: 0, issues: [], breakdown: { parallelism: 0, lecturing: 0, formal: 0, expository: 0, aphorism: 0 } };
  }
  const isZh = isZhText(draft);
  const lines = extractDialogueLines(draft);
  const breakdown: Record<AiTasteType, number> = { parallelism: 0, lecturing: 0, formal: 0, expository: 0, aphorism: 0 };
  const issues: DialogueAiTasteIssue[] = [];

  for (const line of lines) {
    const type = classify(line, isZh);
    if (!type) continue;
    breakdown[type]++;
    const severity: DialogueAiTasteIssue['severity'] =
      type === 'lecturing' || type === 'expository' ? 'high' : 'medium';
    issues.push({ line, type, severity, advice: adviceFor(type, isZh) });
  }

  const total = lines.length || 1;
  // 高分 = 越多AI味问题；满分上限按问题数/台词数*100，封顶100
  const score = Math.min(100, Math.round((issues.length / total) * 100));
  return { score, issues, breakdown };
}