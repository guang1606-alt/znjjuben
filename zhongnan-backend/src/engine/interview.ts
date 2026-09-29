/**
 * interview.ts —— 采访式创作引擎（v2.92 把模式方法论变成机制）
 * ------------------------------------------------------------------
 * mode-craft.ts 的三条硬约束在这里落地为可运行机制：
 *  · 素材即事实源：四维记忆空间（人物关系/时间线/场景物件/原话金句）+ rawNotes 兜底；
 *    AI 提炼失败时按句归档，素材永不丢失，后续生成仍可使用。
 *  · 像采访不像问卷：一轮只追问一个最关键缺口；AI 主持，失败走确定性规则问
 *    （冲突 > 欲望 > 代价 > 转折 的缺口优先级，与 pitch meeting 同源思路）。
 *  · 表达完毕再生成：readyCheck 纯确定性判定；buildBrief 由四维素材确定性拼装，
 *    零成本、零幻觉；欲望→冲突→代价→转折的戏剧归位交给管线 architect
 *    （interview 方法论指令已注入）。
 * AI 容错铁律：每次 AI 调用都有确定性兜底，模型不可用不阻断采访流程。
 */
import { EngineTier } from '../config/pricing';
import { callText, extractJson } from '../lib/model-proxy';

export type Lang = 'zh' | 'en';
export const MATERIAL_CAP = 40; // 每维素材上限，防提示词膨胀

export interface InterviewMaterials {
  relationships: string[]; // 人物关系
  timeline: string[];      // 时间线/事件
  scenes: string[];        // 场景与物件
  quotes: string[];        // 原话金句（保留用户原表达）
  rawNotes: string[];      // 原始备注（AI 不可用时的兜底素材池）
}

export function emptyMaterials(): InterviewMaterials {
  return { relationships: [], timeline: [], scenes: [], quotes: [], rawNotes: [] };
}

const normArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

/** 确定性合并：去重、封顶；prev 在前 new 在后（先到先得保留用户原表达） */
export function mergeMaterials(prev: InterviewMaterials, inc: Partial<InterviewMaterials>): InterviewMaterials {
  const out = emptyMaterials();
  for (const k of Object.keys(out) as (keyof InterviewMaterials)[]) {
    const seen = new Set<string>();
    for (const s of [...(prev[k] ?? []), ...(inc[k] ?? [])]) {
      const t = s.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (out[k].length >= MATERIAL_CAP) break;
      out[k].push(t);
    }
  }
  return out;
}

/** 确定性句级归档（AI 兜底）：把用户表达按句切进 rawNotes，短句（<8字）丢弃防噪声 */
export function captureRawNotes(text: string, prev: InterviewMaterials): InterviewMaterials {
  const parts = text
    .split(/[。！？!?\n；;，,]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  return mergeMaterials(prev, { rawNotes: parts });
}

/* ---------------- 缺口检测与规则问（确定性，无模型也能主持） ---------------- */

const SIGNALS: Record<Lang, Record<'desire' | 'conflict' | 'stakes' | 'turn', RegExp>> = {
  zh: {
    desire: /(想|要|希望|目标|夺回|逃离|证明|查清|赚钱|翻身|复仇|守护)/,
    conflict: /(但|却|反对|阻止|冲突|对抗|敌人|对手|阻挠|打压|陷害|竞争|背叛)/,
    stakes: /(代价|失去|风险|失败|赌上|孤注一掷|最后机会|命|身家)/,
    turn: /(后来|转折|结果|最终|发现|真相|反转|直到|原来)/,
  },
  en: {
    desire: /(want|goal|decide|prove|escape|find out|reclaim|avenge|protect|win)/i,
    conflict: /(but|rival|antagonist|block|against|oppose|betray|enemy|competitor)/i,
    stakes: /(cost|lose|risk|stake|last chance|everything|failure)/i,
    turn: /(until|finally|discover|truth|twist|it turned out|then one day)/i,
  },
};

const allText = (m: InterviewMaterials): string =>
  [...m.relationships, ...m.timeline, ...m.scenes, ...m.quotes, ...m.rawNotes].join('\n');

export interface GapReport { desire: boolean; conflict: boolean; stakes: boolean; turn: boolean }

/** 四要素归位检查（确定性）：欲望→冲突→代价→转折 */
export function gapReport(m: InterviewMaterials, lang: Lang): GapReport {
  const t = allText(m);
  const S = SIGNALS[lang];
  return { desire: S.desire.test(t), conflict: S.conflict.test(t), stakes: S.stakes.test(t), turn: S.turn.test(t) };
}

/** 就绪判定（确定性）：欲望+冲突齐备、至少聊 2 轮即建议成稿；代价/转折可由合理想象补占位 */
export function readyCheck(m: InterviewMaterials, turnCount: number, lang: Lang): boolean {
  const g = gapReport(m, lang);
  return turnCount >= 2 && g.desire && g.conflict;
}

const RULE_QUESTIONS: Record<Lang, Record<'desire' | 'conflict' | 'stakes' | 'turn' | 'detail', string>> = {
  zh: {
    desire: '先聊最关键的：主角是谁？他/她最想要什么？（一句话即可，我在记录）',
    conflict: '收到。那挡着他/她的最大阻力是什么？谁在跟主角作对？',
    stakes: '如果主角失败，会失去什么？（这是观众揪心的代价）',
    turn: '故事里最大的转折或意外是什么？后来发生了什么？',
    detail: '再给一个具体场景或一句让你印象深的原话吧，素材会更有画面感。',
  },
  en: {
    desire: 'Start with the key thing: who is the lead, and what do they want most? (One sentence is enough — I am noting it.)',
    conflict: 'Got it. What is the biggest force blocking them — who stands against the lead?',
    stakes: 'If the lead fails, what do they lose? (That is the cost the audience aches for.)',
    turn: 'What is the biggest turn or surprise? What happened next?',
    detail: 'Give me one concrete scene, or a line you remember verbatim — it adds texture.',
  },
};

/** 规则下一问（确定性兜底）：按 冲突 > 欲望 > 代价 > 转折 的缺口优先级；全齐了就要细节 */
export function ruleGapQuestion(m: InterviewMaterials, turnCount: number, lang: Lang): string {
  const g = gapReport(m, lang);
  const Q = RULE_QUESTIONS[lang];
  if (!g.desire) return Q.desire;
  if (!g.conflict) return Q.conflict;
  if (!g.stakes && turnCount >= 1) return Q.stakes;
  if (!g.turn && turnCount >= 2) return Q.turn;
  return Q.detail;
}

/* ---------------- AI 提炼与 AI 追问（失败走上面确定性兜底） ---------------- */

const EXTRACT_PROMPT: Record<Lang, (q: string, a: string) => string> = {
  zh: (q, a) => `你是编剧采访助理。从用户回答中提炼四维素材，输出JSON（不要输出其他文字）：
{"relationships":["人物关系，每条一句"],"timeline":["事件/时间线，每条一句"],"scenes":["场景与关键物件"],"quotes":["用户原话金句，尽量保留原表达"]}
只提炼用户给出的事实，不得编造；没有的维度留空数组。
上一问：${q || '（开场）'}
用户回答：${a}`,
  en: (q, a) => `You are a screenwriting interview assistant. Extract four-dimension material from the user's answer as JSON only:
{"relationships":["one line per relationship"],"timeline":["events/chronology, one line each"],"scenes":["scenes & key objects"],"quotes":["the user's own lines, keep verbatim wording"]}
Extract only stated facts, never invent; use [] for absent dimensions.
Previous question: ${q || '(opening)'}
User answer: ${a}`,
};

const QUESTION_PROMPT: Record<Lang, (m: string, tr: string) => string> = {
  zh: (m, tr) => `你是编剧采访主持人。这是用户的创作素材与对话记录：
${m}
${tr}
规则：一轮只问最关键的一个缺口（先问决定冲突走向的）；像采访不像问卷，不打断、不连珠炮；用户表达完毕再生成。输出仅一行问题本身，不要编号不要解释。`,
  en: (m, tr) => `You are a screenwriting interview host. Material and transcript so far:
${m}
${tr}
Rules: ask only the single most decisive missing thing per round (conflict-steering first); interview, don't interrogate; no rapid-fire lists. Output exactly one question, nothing else.`,
};

export interface TurnOutcome {
  materials: InterviewMaterials;
  question: string;
  ready: boolean;
  costFen: number;
  /** 素材提炼与追问是否由 AI 完成（可观测，用于降级统计） */
  aiExtract: boolean;
  aiQuestion: boolean;
}

/** 采访一轮：素材提炼 → 下一问 → 就绪判定。模型全挂也能走（确定性兜底）。 */
export async function interviewTurn(
  tier: EngineTier, userText: string, prev: InterviewMaterials, lastQuestion: string,
  transcript: { q: string; a: string }[], lang: Lang,
): Promise<TurnOutcome> {
  const trimmed = userText.trim().slice(0, 4000);
  let materials = captureRawNotes(trimmed, prev); // 先确定性归档，素材永不丢
  let costFen = 0;
  let aiExtract = false;
  let aiQuestion = false;

  // 1) AI 提炼四维素材
  try {
    const r = await callText(tier, 'designer', EXTRACT_PROMPT[lang](lastQuestion, trimmed), { maxTokens: 800 });
    costFen += r.costFen;
    const j = extractJson<Partial<Record<keyof InterviewMaterials, unknown>>>(r.text);
    if (j && (normArr(j.relationships).length || normArr(j.timeline).length || normArr(j.scenes).length || normArr(j.quotes).length)) {
      materials = mergeMaterials(materials, {
        relationships: normArr(j.relationships), timeline: normArr(j.timeline),
        scenes: normArr(j.scenes), quotes: normArr(j.quotes),
      });
      aiExtract = true;
    }
  } catch { /* 兜底已归档 rawNotes */ }

  // 2) AI 下一问（失败→规则问）
  let question = ruleGapQuestion(materials, transcript.length, lang);
  try {
    const matLines = (Object.keys(materials) as (keyof InterviewMaterials)[])
      .map((k) => `${k}: ${materials[k].join(' / ') || '—'}`).join('\n');
    const trLines = transcript.slice(-4).map((t) => `Q: ${t.q}\nA: ${t.a}`).join('\n');
    const r = await callText(tier, 'designer', QUESTION_PROMPT[lang](matLines, trLines), { maxTokens: 200 });
    costFen += r.costFen;
    const q = r.text.trim().split('\n').filter(Boolean).pop() ?? '';
    if (q.length >= 6 && q.length <= 120 && !/^[0-9１-９]/.test(q)) { question = q; aiQuestion = true; }
  } catch { /* 规则问兜底 */ }

  // 3) transcript 追加本轮（调用方持久化）
  const full = [...transcript, { q: lastQuestion, a: trimmed }];
  return { materials, question, ready: readyCheck(materials, full.length, lang), costFen, aiExtract, aiQuestion };
}

/* ---------------- 结构化简报（确定性拼装，零成本零幻觉） ---------------- */

const DIM_LABEL: Record<Lang, Record<keyof Omit<InterviewMaterials, 'rawNotes'> | 'rawNotes', string>> = {
  zh: { relationships: '◆ 人物关系', timeline: '◆ 时间线', scenes: '◆ 场景物件', quotes: '◆ 原话金句', rawNotes: '◆ 其他原始素材' },
  en: { relationships: '◆ Relationships', timeline: '◆ Timeline', scenes: '◆ Scenes & objects', quotes: '◆ Verbatim lines', rawNotes: '◆ Other raw notes' },
};

/** 把四维素材拼成结构化创意简报：事实源直接喂给 architect（interview 方法论指令在管线内注入） */
export function buildBrief(m: InterviewMaterials, lang: Lang): string {
  const L = DIM_LABEL[lang];
  const head = lang === 'en' ? '[Interview-mode creative brief — material is the source of truth]' : '【采访式创作 · 创意简报】（素材即事实源，缺项由架构师合理想象补占位）';
  const sec = (items: string[]) => (items.length ? items.map((x) => `- ${x}`).join('\n') : '-');
  return [
    head,
    `${L.relationships}\n${sec(m.relationships)}`,
    `${L.timeline}\n${sec(m.timeline)}`,
    `${L.scenes}\n${sec(m.scenes)}`,
    `${L.quotes}\n${sec(m.quotes)}`,
    ...(m.rawNotes.length ? [`${L.rawNotes}\n${sec(m.rawNotes)}`] : []),
  ].join('\n');
}
