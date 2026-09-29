/**
 * v2.80 承诺欠账账本（Promise Drought Ledger）
 * ------------------------------------------------------------------
 * 缺口：mystery-drought 管"悬念线只吊不答"、humiliation-ledger 管
 * "屈辱雷埋了不还"，但角色立誓（"我一定为你报仇""三天内给你答案"）
 * 这条最重的观众记账线无人管——当众立誓=观众开始记账，连续几集不兑现
 * 也不推进（誓言挂账）=承诺贬值=后面真兑现观众也不信了。
 *
 * 记账模型（与悬念干旱同构，差异在"债务持续加重"，纯确定性）：
 *   每集摘要 { ep, line(活跃承诺代表句), advanced(正文兑现) }
 *   生成侧：本集有新誓言句 → 定线；无 → 继承前集活跃承诺（债务不断链）。
 *   按集升序过账：
 *     line 为空 → 挂起保持；
 *     换诺（词集无交集）→ drought 重置 0；
 *     同诺且 advanced（正文复现承诺词+兑现动作词）→ 清零；
 *     同诺未兑现 → drought + 1（承诺是持续债务，挂账每集都涨，
 *       与悬念不同——悬念需"又吊"才加重，承诺躺着也在涨）。
 *   挂账 drought ≥2 → mid；≥3 → high。
 * 输出：欠账结果 + 架构师"承诺兑现/部分兑现"指令（与悬念干旱注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * line 为剧本誓言句按原样透传（≤60 字截断）。
 */

export type PrmLang = 'zh' | 'en';

export interface PromiseRow {
  /** 集号 */
  ep: number;
  /** 活跃承诺代表句（''=本集无活跃承诺） */
  line: string;
  /** 本集正文是否兑现/推进了该承诺 */
  advanced: boolean;
}

export interface PromiseDroughtIssue {
  severity: 'mid' | 'high';
  type: 'promise_drought';
  evidence: string;
  advice: string;
}

export interface PromiseDroughtResult {
  /** 当前承诺连续未兑现的集数 */
  drought: number;
  /** none / mid / high */
  level: 'none' | 'mid' | 'high';
  /** 欠账承诺代表句（供指令引用） */
  line: string;
  issues: PromiseDroughtIssue[];
}

/** 挂账阈值：≥2 报 mid，≥3 升 high（承诺比悬念更急：立誓 2 集不兑现即警示） */
export const PROMISE_DROUGHT_MID = 2;
export const PROMISE_DROUGHT_HIGH = 3;

/** 誓言句截断长度（控台账/提示词预算） */
const LINE_MAX = 60;
/** en 誓言句截断长度 */
const LINE_MAX_EN = 80;
/** 承诺词上限（控匹配预算） */
const WORDS_CAP = 8;
/** 兑现检测最短正文长度（防空白/残片误判） */
const ADVANCE_MIN_TEXT = 20;

// —— 宣誓词：命中即判"本集立誓"（zh 词组级；en 小写短语级）——
const PLEDGE_WORDS_ZH: string[] = [
  '我保证', '我发誓', '我承诺', '我答应', '我一定', '一定会', '等着我', '等我回来', '给我三天', '给我一个月',
  '相信我', '一言为定', '君子一言', '我说到做到', '血债血偿', '以我之名', '拿性命担保', '拿人格担保',
];
const PLEDGE_WORDS_EN: string[] = [
  'i promise', 'i swear', 'i vow', 'i give you my word', 'on my life', 'trust me',
  'wait for me', 'give me three days', 'give me one month', 'mark my words', 'my word is my bond',
];

// —— 兑现动作词：承诺词复现 + 命中其一 → advanced ——
const FULFILL_WORDS_ZH: string[] = [
  '说到做到', '兑现', '如约', '答应你的', '答应过你的', '还给你', '做到了', '办成了', '办妥',
  '完成了', '到手', '拿到了', '报仇了', '报了仇', '实现了', '恩已经报了',
];
const FULFILL_WORDS_EN: string[] = [
  'kept my promise', 'promise kept', 'as promised', 'it is done', "it's done", 'i did it',
  'fulfilled', 'delivered', 'made it', 'got it back', 'paid back', 'avenged',
];

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

// —— 承诺线词停用表：宣誓词自身跨诺高频复现，用于同诺关联会误判（"我发誓报仇"vs"我发誓守护你"非同一诺）——
const ZH_STOP = new Set([
  '我们', '你们', '他们', '自己', '一定', '保证', '发誓', '承诺', '答应', '相信',
  '给我', '等我', '等着', '三天', '三天之', '个月', '绝不', '说话', '回来', '担保', '以我', '之名',
]);
const EN_STOP = new Set([
  'promise', 'swear', 'vow', 'will', 'trust', 'wait', 'give', 'days', 'month', 'words', 'life', 'bond', 'mark', 'with', 'that', 'this', 'your', 'from',
]);

/**
 * 承诺线词提取：zh 去标点后 2 字滑窗（誓言句多无标点，整句切分无法跨集关联），
 * en 按非字母切词（≥4 字母）；命中停用表丢弃，去重后 cap 8。
 */
export function extractPromiseKeywords(text: string): string[] {
  if (!text || text.trim().length < 3) return [];
  if (isZhText(text)) {
    const compact = text.replace(/[\s，。,.！!？?：:；;、「」『』《》"'…—·\-()（）【】]+/g, '');
    const grams: string[] = [];
    for (let i = 0; i + 2 <= compact.length; i++) {
      const g = compact.slice(i, i + 2);
      if (!ZH_STOP.has(g) && !grams.includes(g)) grams.push(g);
      if (grams.length >= WORDS_CAP) break;
    }
    return grams;
  }
  const words = text.toLowerCase().split(/[^a-zA-Z']+/);
  return [...new Set(words.filter((w) => w.length >= 4 && !EN_STOP.has(w)))].slice(0, WORDS_CAP);
}

/** 两句承诺词集有交集 → 同一条承诺 */
export function sharePromiseWord(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ka = extractPromiseKeywords(a);
  const kb = extractPromiseKeywords(b);
  return ka.some((w) => kb.includes(w));
}

/**
 * 誓言句提取：切句后取首个含宣誓词的句子（≤60 字截断）；无 → ''。
 * zh 与 en 各自词表；空文本安全。
 */
export function derivePromiseLine(text: string): string {
  if (!text || !text.trim()) return '';
  const zh = isZhText(text);
  // 先剥引号再切句：中文引语多以 ！？收尾，引号不剥会被切分符拦腰截断（闭引号残片丢失）
  const clean = text.replace(/["'“”‘’「」『』《》]/g, '');
  const sentences = clean.split(zh ? /[。！？；!?;\n\r]+/ : /[.!?;\n\r]+/).map((s) => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    const lower = zh ? sent : sent.toLowerCase();
    const hit = (zh ? PLEDGE_WORDS_ZH : PLEDGE_WORDS_EN).some((w) => lower.includes(w));
    if (hit) return sent.slice(0, zh ? LINE_MAX : LINE_MAX_EN);
  }
  return '';
}

/** 承诺兑现检测：承诺词在正文复现任一 AND 正文含兑现动作词（line 空/正文过短=未兑现） */
export function promiseAdvanceCheck(line: string, curText: string): boolean {
  if (!line || !curText || curText.trim().length < ADVANCE_MIN_TEXT) return false;
  const zh = isZhText(line);
  const words = extractPromiseKeywords(line);
  const echoed = words.some((w) => curText.includes(w));
  if (!echoed) return false;
  const lower = zh ? curText : curText.toLowerCase();
  return (zh ? FULFILL_WORDS_ZH : FULFILL_WORDS_EN).some((w) => lower.includes(w));
}

/** 落库摘要 → PromiseRow（规范化容错：ep 非法丢弃，line 截断，advanced 容错 true/1） */
export function normalizePromiseRow(raw: unknown): PromiseRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  return {
    ep,
    line: typeof r.line === 'string' ? r.line.slice(0, LINE_MAX) : '',
    advanced: r.advanced === true || r.advanced === 1,
  };
}

/**
 * 承诺欠账记账：按集升序，换诺重置 / 兑现清零 / 同诺未兑现每集 +1。
 * @param rows    前集承诺摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function promiseDroughtLedger(rows: PromiseRow[], curEpNo: number): PromiseDroughtResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizePromiseRow)
    .filter((r): r is PromiseRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let drought = 0;
  let prevLine = '';
  for (const r of sorted) {
    if (!r.line) continue; // 无活跃承诺 → 挂起保持
    if (!prevLine || !sharePromiseWord(prevLine, r.line)) {
      drought = 0; // 新承诺首立
    } else if (r.advanced) {
      drought = 0; // 正文兑现了这条承诺
    } else {
      drought += 1; // 承诺是持续债务：同诺未兑现，每过一集欠账 +1
    }
    prevLine = r.line;
  }
  const level: 'none' | 'mid' | 'high' = drought >= PROMISE_DROUGHT_HIGH ? 'high' : drought >= PROMISE_DROUGHT_MID ? 'mid' : 'none';
  const issues: PromiseDroughtIssue[] = [];
  if (level !== 'none') {
    issues.push({
      severity: level,
      type: 'promise_drought',
      evidence: `承诺「${prevLine.slice(0, 30)}」已连续 ${drought} 集未兑现且正文无推进`,
      advice: '承诺欠账：立过的誓必须还——本集兑现，或给阶段兑现（答应的事先办一半/办砸也要给交代）；只立誓不兑现=誓言贬值=观众不再信角色',
    });
  }
  return { drought, level, line: prevLine, issues };
}

/**
 * 承诺欠账调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 挂账达阈值才出话；无欠账/无输入返回空串。
 */
export function promiseDroughtDirective(rows: PromiseRow[]): { zh: string; en: string } {
  const r = promiseDroughtLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  const quote = r.line.slice(0, 40);
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Promise debt — pay it down this episode]']
      : ['【承诺欠账·本集兑现】'];
    lines.push(isEn
      ? `  - The pledge "${quote}" has been outstanding for ${r.drought} episodes with zero payoff — this episode must deliver on it, or pay it in installments (half done / botched but accounted for); a vow that never cashes out makes every character promise worthless.`
      : `  - 誓言「${quote}」已挂账 ${r.drought} 集未兑现——本集必须兑现，或给阶段兑现（先办一半/办砸也要给交代）；只立誓不还=誓言贬值=观众不再信这个角色。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
