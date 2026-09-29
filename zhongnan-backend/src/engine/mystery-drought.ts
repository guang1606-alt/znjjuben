/**
 * v2.80 多集悬念干旱账本（Mystery Drought Ledger）
 * ------------------------------------------------------------------
 * 缺口：cliffhanger-payoff 只管"上集钩子→本集开场接住"的 1 集窗口；
 * mystery/reveal 悬念线跨集维度无人管——同一悬念（如"父亲到底去哪了"）
 * 集尾连吊 N 集，答案不给、正文也不推进（只吊不答=观众忍耐耗尽=弃剧）。
 *
 * 记账模型（纯确定性，关键词关联同线，零 LLM）：
 *   每集摘要 { ep, line(活跃线代表词), advanced(正文推进), hooked(集尾又吊) }
 *   按集升序过账：
 *     line 为空 → 挂起（无悬念期待，不加重不减轻）；
 *     换线（词集无交集）→ drought 重置 0；
 *     同线且 advanced（正文前 70% 复现线词）→ 清零；
 *     同线且 hooked 且未推进（集尾又吊同一问）→ drought + 1；
 *     同线挂起（未吊未推进）→ 保持。
 *   干旱 drought ≥2 → mid；≥3 → high。
 * 输出：干旱结果 + 架构师"悬念必须给部分答案"指令（与屈辱欠账注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * line 为剧本内容词按原样透传。
 */

export type MysLang = 'zh' | 'en';

export interface MysteryRow {
  /** 集号 */
  ep: number;
  /** 活跃悬念线代表词（关键词以 / 连接；''=本集无活跃线） */
  line: string;
  /** 本集正文是否推进了该线（前 70% 篇幅复现线词） */
  advanced: boolean;
  /** 集尾是否又吊了悬念钩（mystery/reveal 类型） */
  hooked: boolean;
}

export interface MysteryDroughtIssue {
  severity: 'mid' | 'high';
  type: 'mystery_drought';
  evidence: string;
  advice: string;
}

export interface MysteryDroughtResult {
  /** 当前悬念线连续未兑现/未推进的集数 */
  drought: number;
  /** none / mid / high */
  level: 'none' | 'mid' | 'high';
  /** 干旱线代表词（供指令引用，最多 3 词） */
  line: string;
  issues: MysteryDroughtIssue[];
}

/** 干旱阈值：≥2 报 mid，≥3 升 high */
export const DROUGHT_MID = 2;
export const DROUGHT_HIGH = 3;

/** 集尾片段入账最短长度（防空白/标点残片入账，与 hook bit 的 SNIPPET_MIN 一致） */
const SNIPPET_MIN = 8;
/** 线关键词上限（控扫描/提示词预算） */
const KEYWORDS_CAP = 8;
/** 指令引用线词上限 */
const LINE_QUOTE_MAX = 3;
/** 推进检测窗口：正文前 70%（后段是集尾钩区，钩里复现不算推进） */
export const MYSTERY_ADVANCE_WINDOW = 0.7;

// —— 悬念句式通用词停用表：这些词跨线高频复现，用于同线关联会误判 ——
// zh 为 2-gram（中文按双字滑窗提取线词）；en 为词级停用
const ZH_STOP = new Set([
  '到底', '究竟', '怎么', '什么', '为何', '哪里', '哪个', '原来', '真相', '秘密',
  '竟然', '居然', '是谁', '有谁', '谁在', '谁会', '谁知', '因为', '所以', '但是', '可是', '而且',
]);
const EN_STOP = new Set([
  'the', 'and', 'for', 'her', 'his', 'was', 'are', 'not', 'you', 'out', 'with', 'that', 'this',
  'she', 'him', 'who', 'what', 'why', 'where', 'how', 'which', 'whose', 'whom',
  'truth', 'secret', 'reveal', 'revealed', 'revealing', 'actually', 'turned', 'really', 'about', 'there', 'then', 'they', 'from',
]);

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

/** 线词提取最短文本（line 字段可短于集尾片段，3 字起即有可用线词） */
const KEYWORD_MIN_TEXT = 3;

/**
 * 悬念线词提取：zh 去标点后 2 字滑窗（悬念钩结尾句多无标点，整句切分无法关联），
 * en 按非字母切词（≥4 字母）；命中停用表丢弃，去重后 cap 8。
 */
export function extractLineKeywords(text: string): string[] {
  if (!text || text.trim().length < KEYWORD_MIN_TEXT) return [];
  if (isZhText(text)) {
    const compact = text.replace(/[\s，。,.！!？?：:；;、「」『』《》"'…—·\-()（）【】]+/g, '');
    const grams: string[] = [];
    for (let i = 0; i + 2 <= compact.length; i++) {
      const g = compact.slice(i, i + 2);
      if (!ZH_STOP.has(g) && !grams.includes(g)) grams.push(g);
      if (grams.length >= KEYWORDS_CAP) break;
    }
    return grams;
  }
  const words = text.toLowerCase().split(/[^a-zA-Z']+/);
  return [...new Set(words.filter((w) => w.length >= 4 && !EN_STOP.has(w)))].slice(0, KEYWORDS_CAP);
}

/** 两集词集有交集 → 同一条悬念线 */
export function shareLineWord(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ka = extractLineKeywords(a);
  const kb = extractLineKeywords(b);
  return ka.some((w) => kb.includes(w));
}

export interface MysteryHookState {
  /** 集尾是否为悬念钩（mystery/reveal） */
  hooked: boolean;
  /** 悬念线代表词（关键词 / 连接；''=无钩或钩片段过短） */
  line: string;
}

/**
 * qcReport.cliffhanger → 本集悬念钩状态（规范化容错）：
 * 仅 mystery/reveal 算"又吊"（其他类型不打断挂起保持）；
 * 片段 ≥8 字才提取线词（片段残缺时 hooked 保留、line 置空）。
 */
export function deriveMysteryHook(raw: unknown, epNo: number): MysteryHookState | null {
  const ep = Math.round(Number(epNo));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (!raw || typeof raw !== 'object') return { hooked: false, line: '' };
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === 'string' ? r.type : '';
  if (type !== 'mystery' && type !== 'reveal') return { hooked: false, line: '' };
  // 落库字段名为 endingSnippet（与 SSE 载荷同名），snippet 为别名兼容
  const snippet = (typeof r.endingSnippet === 'string' ? r.endingSnippet : typeof r.snippet === 'string' ? r.snippet : '').trim();
  const keywords = snippet.length < SNIPPET_MIN ? [] : extractLineKeywords(snippet);
  return { hooked: true, line: keywords.join('/') };
}

/** 悬念线推进检测：线词在正文前 70% 复现任一 → 推进（线空/短文=未推进） */
export function mysteryAdvanceCheck(line: string, curText: string): boolean {
  if (!line || !curText || curText.trim().length < 20) return false;
  const head = curText.slice(0, Math.max(1, Math.floor(curText.length * MYSTERY_ADVANCE_WINDOW)));
  return extractLineKeywords(line).some((w) => head.includes(w));
}

/** 落库摘要 → MysteryRow（规范化容错：ep 非法丢弃，line 过长截断） */
export function normalizeMysteryRow(raw: unknown): MysteryRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  return {
    ep,
    line: typeof r.line === 'string' ? r.line.slice(0, 120) : '',
    advanced: r.advanced === true,
    hooked: r.hooked === true || r.hooked === 1,
  };
}

/**
 * 悬念干旱记账：按集升序，换线重置 / 推进清零 / 只吊加重 / 挂起保持。
 * @param rows    前集悬念线摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function mysteryDroughtLedger(rows: MysteryRow[], curEpNo: number): MysteryDroughtResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizeMysteryRow)
    .filter((r): r is MysteryRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let drought = 0;
  let prevLine = '';
  for (const r of sorted) {
    if (!r.line) continue; // 无活跃线 → 挂起保持
    if (!prevLine || !shareLineWord(prevLine, r.line)) {
      drought = 0; // 新线首吊
    } else if (r.advanced) {
      drought = 0; // 正文推进了这条线
    } else if (r.hooked) {
      drought += 1; // 集尾又吊同一问且正文没动
    }
    prevLine = r.line;
  }
  const level: 'none' | 'mid' | 'high' = drought >= DROUGHT_HIGH ? 'high' : drought >= DROUGHT_MID ? 'mid' : 'none';
  const issues: MysteryDroughtIssue[] = [];
  if (level !== 'none') {
    const quote = prevLine.split('/').filter(Boolean).slice(0, LINE_QUOTE_MAX).join('/');
    issues.push({
      severity: level,
      type: 'mystery_drought',
      evidence: `悬念线「${quote}」已连续 ${drought} 集只吊不答且正文无推进`,
      advice: '本集必须给这条悬念部分答案或关键推进：答一半留一半（揭开一层再抛新问），不许只吊不答；悬念连吊3集不给任何答案=观众弃剧',
    });
  }
  return { drought, level, line: prevLine, issues };
}

/**
 * 悬念干旱调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 干旱达阈值才出话；无干旱/无输入返回空串。
 */
export function mysteryDroughtDirective(rows: MysteryRow[]): { zh: string; en: string } {
  const r = mysteryDroughtLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  const words = r.line.split('/').filter(Boolean).slice(0, LINE_QUOTE_MAX);
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Mystery drought — give a partial answer this episode]']
      : ['【悬念干旱·部分答案】'];
    const quote = isEn ? words.join(', ') : words.map((w) => `「${w}」`).join('');
    lines.push(isEn
      ? `  - The mystery thread${quote ? ` (${quote})` : ''} has been strung along for ${r.drought} episodes with no answer and no progress — this episode must deliver a partial answer or a key step forward: peel one layer open, then hang a new question. Stringing viewers along with zero payoff = they walk.`
      : `  - 悬念线${quote ? `${quote}` : ''}已连续 ${r.drought} 集只吊不答且正文无推进——本集必须给部分答案或关键推进：揭开一层再抛新问；悬念连吊不给任何答案=观众弃剧。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
