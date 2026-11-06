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

/**
 * v2.407 对白 AI 味前置教学（与 dialogueAiTaste 同源）
 * ------------------------------------------------------------------
 * 撰写师首轮即拿到检测口径，避免写完被 deai / craft 维度打低分。
 */
export function buildDialogueAiTasteDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Dialogue AI Taste Pre-Writing Briefing (same source as dialogueAiTaste: five signal types + priority chain + score formula + severity split)】',
      '- Scan scope: dialogue lines only (1-12 char speaker name + colon); scene headers, title pages, day/night/flashback bare labels are excluded.',
      '- Five signal types: lecturing / expository / aphorism / formal / parallelism.',
      '- Priority chain: lecturing > expository > aphorism > formal > parallelism; each dialogue line counts only the first matched type.',
      '- lecturing keywords: you must understand, you need to know, you should realize, let me tell you, remember that, listen carefully — length > 20 chars.',
      '- expository keywords: because of this, this is why, the reason is that, due to the fact that.',
      '- aphorism keywords: the true meaning of, life is like, only by can we, no matter what, as long as we.',
      '- formal keywords: therefore, however, thus, hence, consequently, as we all know, in conclusion.',
      '- parallelism: at least 3 comma-separated clauses starting with the same word (Chinese: first two chars identical / English: first word identical).',
      '- Score formula: round(issue count / total dialogue count x 100) capped at 100; empty script = 0.',
      '- severity split: lecturing and expository are high; the other three are medium.',
      '- Rewrite direction: lecturing → action/subtext; expository → hide info in action/conflict; aphorism → character unique voice; formal → colloquial; parallelism → vary rhythm, keep one punch.',
      '- Pipeline consumption: craft dialogue dimension uses (100 - score) as a quality input; deai dimension adds (100 - score) x 0.02 as negative weight.',
      '- Self-check: every speech ≥20 chars — does it sound like a lecture? is information hidden in action or just dumped? replace any aphorism with character-specific phrasing.',
    ].join('\n');
  }
  return [
    '【对白 AI 味前置教学（检测同源：dialogueAiTaste 五维度 + 优先级链 + score 公式 + severity 分级）】',
    '- 检测范围：只扫对白行（1-12 字姓名 + 冒号 + 台词），场头 / 剧名页 / 日·夜·闪回纯标签行一律排除。',
    '- 五维度 AI 味：lecturing 说教腔 / expository 解释性 / aphorism 万能金句 / formal 书面语 / parallelism 排比堆砌。',
    '- 优先级链：lecturing > expository > aphorism > formal > parallelism；单条台词只记第一命中的类型。',
    '- lecturing 说教腔：关键词 8 个「你要知道 / 你必须明白 / 你应该懂得 / 你听我说 / 记住 / 听好了 / 我告诉你 / 你给我记着」，长度 >20 字才算命中。',
    '- expository 解释性台词：关键词 5 个「因为所以 / 是因为 / 这就是为什么 / 之所以是因为 / 由于因此」。',
    '- aphorism 万能金句：关键词 6 个「真正的是 / 人生就像 / 只有才能 / 不管都 / 只要就一定 / 没有就没有」。',
    '- formal 书面语：关键词 8 个「因此 / 然而 / 倘若 / 故此 / 众所周知 / 综上所述 / 由此可见 / 毋庸置疑」。',
    '- parallelism 排比堆砌：同一句对白被逗号分割后，≥3 个短句以相同词开头（中文按前两字相同 / 英文按首个词相同）；典型形态「你不…你不…你不…」。',
    '- 得分公式：round(问题数 / 总对白数 ×100) 封顶 100；空稿 0 分；台词越少，出现 1 句 AI 味台词的扣分占比越高。',
    '- severity 分级：lecturing 和 expository 为 high（教腔 / 说明书最伤）；aphorism / formal / parallelism 为 medium。',
    '- 改写方向：lecturing 改说教为行动/潜台词；expository 拆解释、把信息藏进动作或冲突；aphorism 删万能金句、用角色独有的表达；formal 把书面语换成口语、对白必须能说出口；parallelism 拆解排比、保留一句点睛即可。',
    '- pipeline 消费：craft dialogue 维度以 (100 - score) 作为质量输入；deai 维度以 (100 - score) × 0.02 作为负向权重。',
    '- 成稿自查：每条 ≥20 字的对白 —— 会不会听起来像上课？信息是藏进了动作/冲突还是被直接讲解？万能金句都换成角色独有的表达？是否有 ≥3 句相同词开头的排比？对白能不能用嘴说出来？',
  ].join('\n');
}