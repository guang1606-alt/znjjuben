/**
 * v2.80 集尾钩子跨集兑现账本（Cliffhanger Payoff Ledger）
 * ------------------------------------------------------------------
 * 缺口：cliffhanger-score 只管单集"结尾有没有硬钩"，跨集维度无人管——
 * 上集结尾吊足胃口的反转/危机/揭秘钩，下一集开场却当没发生
 * （观众是钩着进来的，开场空转=直接划走）；或兑现拖到中后段
 * （观众带着钩子空开场，黄金三秒被浪费）。
 *
 * 输入：route 侧从前集 qcReport.cliffhanger 提取的钩子位
 * （HookBit：集号/类型/效力分/结尾片段，仅六类实质钩，weak/none 不入账）。
 * 检测：本集"开场 35%"是否接住上集钩子——
 *   a) 关键词兑现：上集结尾片段的分词在本集开场复现（zh 2字+/en 3字母+）；
 *   b) 承接信号：开场出现"原来/真相/谜底/揭晓"类回应词
 *     （不收"上集/回顾"类词——纯回顾不推进，不算兑现）。
 *   开场接住=opening；全文后段才接住=late（兑现迟到，mid）；
 *   全文都没接=dropped（钩子蒸发：反转/危机/揭秘/悬念钩 high，情感/动作钩 mid）。
 * 输出：兑现检测结果 + 架构师"跨集兑现"指令（与 subplot/gratification 注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * 片段为剧本内容引用按原样透传。
 */

export type HookPayLang = 'zh' | 'en';

export interface HookBit {
  /** 钩子所在集号（前集） */
  ep: number;
  /** 钩子类型（cliffhanger-score 六类实质钩之一） */
  type: 'reversal' | 'crisis' | 'reveal' | 'mystery' | 'emotional' | 'action_cut';
  /** 钩子效力分 0-100（cliffhanger-score） */
  score: number;
  /** 上集结尾片段（≤100 字符，来自 qcReport.cliffhanger.endingSnippet） */
  snippet: string;
}

export interface HookPayoffIssue {
  severity: 'high' | 'mid';
  type: 'hook_dropped' | 'late_payoff';
  evidence: string;
  advice: string;
}

export interface HookPayoffResult {
  /** 是否执行了兑现检测（无前集硬钩/文本过短=未检测） */
  checked: boolean;
  /** opening=开场内接住；late=后段才接住；none=全文未接住；未检测为 null */
  paid: 'opening' | 'late' | 'none' | null;
  /** 上集钩子类型（未检测为 null） */
  prevType: HookBit['type'] | null;
  issues: HookPayoffIssue[];
}

/** 硬钩类型（dropped 报 high） */
export const HARD_HOOK_TYPES: HookBit['type'][] = ['reversal', 'crisis', 'reveal', 'mystery'];
/** 软钩类型（dropped 报 mid） */
const SOFT_HOOK_TYPES: HookBit['type'][] = ['emotional', 'action_cut'];
/** 开场判定窗口：前 35% 篇幅 */
export const HOOK_OPENING_WINDOW = 0.35;
/** 片段入账最短长度（防空白/标点残片入账） */
const SNIPPET_MIN = 8;
/** 片段上限（与落库 qcReport.cliffhanger.endingSnippet 截断一致） */
const SNIPPET_MAX = 100;
/** 兑现关键词上限（控提示词/扫描预算） */
const KEYWORD_MAX = 6;

// 承接信号：开场正面回应上集钩子的措辞（不含"上集/回顾"——纯回顾不推进，不算兑现）
const CONTINUE_ZH = /(原来|真相|谜底|答案|揭晓|接上)/;
const CONTINUE_EN = /\b(as it turned out|turned out|the truth (?:was|is)|the answer|revealed|picking up|continuing from|finally know|so that['’]s)\b/i;

const TYPE_LABEL_ZH: Record<HookBit['type'], string> = {
  reversal: '反转钩', crisis: '危机钩', reveal: '揭秘钩', mystery: '悬念钩', emotional: '情感钩', action_cut: '动作钩',
};
const TYPE_LABEL_EN: Record<HookBit['type'], string> = {
  reversal: 'Reversal', crisis: 'Crisis', reveal: 'Reveal', mystery: 'Mystery', emotional: 'Emotional', action_cut: 'Action cut',
};

/**
 * qcReport.cliffhanger → 钩子位（规范化容错）：
 * type 必须是六类实质钩之一（none/weak/未知一律不入账）、
 * 片段 ≥8 字（去空格后）、score 缺省/非法按 0 兜底并 clamp 0-100。
 */
export function deriveHookBit(raw: unknown, epNo: number): HookBit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(epNo));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const type = typeof r.type === 'string' ? r.type : '';
  if (![...HARD_HOOK_TYPES, ...SOFT_HOOK_TYPES].includes(type as HookBit['type'])) return null;
  // 落库字段名为 endingSnippet（与 SSE 载荷同名），snippet 为别名兼容
  const snippet = (typeof r.endingSnippet === 'string' ? r.endingSnippet : typeof r.snippet === 'string' ? r.snippet : '')
    .trim().slice(0, SNIPPET_MAX);
  if (snippet.length < SNIPPET_MIN) return null;
  const scoreNum = Math.round(Number(r.score));
  const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 0;
  return { ep, type: type as HookBit['type'], score, snippet };
}

/** en 高频功能词停用表：防止 the/is/her 这类词在任何英文文本里误判"已接住" */
const EN_STOP = new Set([
  'the', 'and', 'for', 'her', 'his', 'was', 'are', 'not', 'you', 'out', 'with', 'that', 'this',
  'she', 'him', 'who', 'what', 'when', 'where', 'their', 'them', 'were', 'has', 'had', 'did',
]);

/** 分词：zh 按标点切长块（≥2 字），en 按非字母切（≥3 字母 + 停用词过滤） */
function extractKeywords(snippet: string, isEn: boolean): string[] {
  const minLen = isEn ? 3 : 2;
  const words = isEn
    ? snippet.split(/[^a-zA-Z']+/)
    : snippet.split(/[\s，。,.！!？?：:；;、「」『』《》"'…—·\-()（）【】]+/);
  return [...new Set(words.map((w) => w.trim()).filter((w) => w.length >= minLen && !EN_STOP.has(w.toLowerCase())))]
    .slice(0, KEYWORD_MAX);
}

function contains(hay: string, needle: string, isEn: boolean): boolean {
  return isEn ? hay.toLowerCase().includes(needle.toLowerCase()) : hay.includes(needle);
}

/**
 * 跨集兑现检测：上集硬钩 vs 本集成稿。
 * @param prevHook 前集钩子位（无=未检测）
 * @param curText  本集成稿全文
 * @param lang     语言
 */
export function hookPayoffCheck(
  prevHook: HookBit | null | undefined,
  curText: string,
  lang: HookPayLang = 'zh',
): HookPayoffResult {
  if (!prevHook || !curText || curText.trim().length < 20) {
    return { checked: false, paid: null, prevType: null, issues: [] };
  }
  const isEn = lang === 'en';
  const openingCut = Math.max(1, Math.floor(curText.length * HOOK_OPENING_WINDOW));
  const opening = curText.slice(0, openingCut);
  const keywords = extractKeywords(prevHook.snippet, isEn);
  const kwInOpening = keywords.some((k) => contains(opening, k, isEn));
  const kwInFull = keywords.some((k) => contains(curText, k, isEn));
  const continueInOpening = isEn ? CONTINUE_EN.test(opening) : CONTINUE_ZH.test(opening);
  const paid: 'opening' | 'late' | 'none' = kwInOpening || continueInOpening ? 'opening' : kwInFull ? 'late' : 'none';

  const issues: HookPayoffIssue[] = [];
  const label = isEn ? TYPE_LABEL_EN[prevHook.type] : TYPE_LABEL_ZH[prevHook.type];
  if (paid === 'none') {
    const hard = HARD_HOOK_TYPES.includes(prevHook.type);
    issues.push({
      severity: hard ? 'high' : 'mid',
      type: 'hook_dropped',
      evidence: isEn
        ? `Episode ${prevHook.ep} ended on a ${label} hook ("${prevHook.snippet.slice(-60)}") but this episode never picks it up`
        : `第${prevHook.ep}集以${label}收尾（"${prevHook.snippet.slice(-60)}"），本集全文未接住该钩子`,
      advice: isEn
        ? 'The ending hook is why viewers clicked in — address it in the first third (reveal the answer / continue the crisis / play out the reversal), or at least acknowledge it in dialogue; never pretend it didn\'t happen'
        : '上集钩子是观众追进来的理由——本集开场1/3内必须正面接住（揭晓答案/延续危机/展开反转），或至少借台词承认钩子事件，不许当没发生',
    });
  } else if (paid === 'late') {
    issues.push({
      severity: 'mid',
      type: 'late_payoff',
      evidence: isEn
        ? `The ep${prevHook.ep} ${label} payoff arrives only in the later part; the first ${Math.round(HOOK_OPENING_WINDOW * 100)}% doesn't continue it`
        : `第${prevHook.ep}集${label}的兑现拖到本集中后段，开场${Math.round(HOOK_OPENING_WINDOW * 100)}%未见接续`,
      advice: isEn
        ? 'Late payoff — viewers arrive carrying the hook; move it into the first third (hook first, setup after), never let the golden three seconds idle'
        : '兑现迟到——观众带着钩子空开场；把兑现提到开场1/3内（先接钩再铺陈），开场黄金三秒不许空转',
    });
  }
  return { checked: true, paid, prevType: prevHook.type, issues };
}

/**
 * 集尾钩子跨集兑现调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 有前集硬钩才出话；无钩/无输入返回空串。
 */
export function hookPayoffDirective(prevHook: HookBit | null | undefined): { zh: string; en: string } {
  if (!prevHook) return { zh: '', en: '' };
  const quote = prevHook.snippet.slice(-60);
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Cliffhanger payoff — pick up last episode\'s ending hook]']
      : ['【集尾钩子·跨集兑现】'];
    lines.push(isEn
      ? `  - Episode ${prevHook.ep} ended on a ${TYPE_LABEL_EN[prevHook.type]} hook: "${quote}" — the first third of this episode must address it head-on (reveal the answer / continue the crisis / play out the reversal); never pretend it didn't happen — viewers came in for this hook.`
      : `  - 第${prevHook.ep}集以「${TYPE_LABEL_ZH[prevHook.type]}」收尾：「${quote}」——本集开场前1/3必须正面接住（揭晓答案/延续危机/展开反转），不许当没发生；观众是钩着进来的，开场空转=直接划走。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
