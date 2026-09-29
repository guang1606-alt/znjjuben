/**
 * mode-gate.ts —— 模式级成稿硬闸门（v2.92 起；v2.96 扩至全 12 模式）
 * ------------------------------------------------------------------
 * 与 mode-craft.ts 的分工：
 *  - mode-craft.ts 在架构师/撰写师提示词里"告诉"模型怎么写（前置引导）；
 *  - mode-gate.ts 在成稿后按模式做差异化硬校验（后置闸门）——
 *    命中 blocked 即拦截交付（走 catch 原路退还冻结积分），命中 warnings 只入 SSE 提示。
 *
 * 覆盖范围（v2.96 全 12 模式）：
 *  · 硬禁线（blocked）：video_short（广告法绝对化）/ branded_skit（绝对化+医疗+投资+贬低竞品）
 *  · 软警告（warnings）：video_short（钩子/口播/CTA）、branded_skit（品牌过早）、hot（虚构声明/人物>3）、
 *    adapt/novel/hit_lab（原作引用信号——可能沿用原文）、interview（缺事实源回指+四维记忆空间）、
 *    tag（缺标签落地信号）、film（缺三幕结构+字数不达标）、long_ip（缺跨季+伏笔账本信号）
 *  · 不重复：mature_x 由 matureScreen 硬禁闸承担、interactive 由 validateBranches 图论校验承担
 *
 * 纯函数·双语·零 IO·确定性；非对应模式返回 allowed=true 空报告。
 */
import { canonicalModeId } from '../config/modes';

export type GateLang = 'zh' | 'en';
export interface GateHit {
  rule: string;
  evidence: string;
  advice: string;
}
export interface ModeGateReport {
  mode: string;
  blocked: GateHit[];   // 命中即拦截交付
  warnings: GateHit[];  // 只入 SSE 提示，不拦截
  allowed: boolean;     // blocked 为空即 true
  score: number;        // 0-100，越高越好
}

const EMPTY: ModeGateReport = { mode: '', blocked: [], warnings: [], allowed: true, score: 100 };

/* ---------- 共用：广告法绝对化用语 + 医疗/投资/贬低竞品 硬禁词表（双语） ---------- */
// 广告法绝对化用语（广告法第九条禁用）
export const ABSOLUTE_CLAIMS_ZH = [
  '国家级', '世界级', '最高级', '最佳', '最好', '最大', '第一品牌', '唯一', '顶尖', '极致',
  '100%', '百分之百', '绝无仅有', '万能', '永久', '永远', '根治', '治愈', '疗效显著', '药到病除',
  '无效退款', '包退', '包治', '包好', '药到病除', '一劳永逸', '零风险', '绝对',
];
export const ABSOLUTE_CLAIMS_EN = [
  'best', 'greatest', 'world-class', 'number one', 'the only', 'top-tier', 'ultimate', 'perfect',
  '100%', '100 percent', 'forever', 'permanent', 'cure', 'guaranteed cure', 'money-back', 'risk-free',
  'zero risk', 'absolutely', 'miracle', 'universal',
];
// 医疗功效承诺（非药品不得宣传疗效）
export const MEDICAL_CLAIMS_ZH = [
  '降血压', '降血糖', '降血脂', '抗癌', '抗肿瘤', '消炎', '杀菌', '镇痛', '止血',
  '调理经期', '壮阳', '补肾', '生发', '祛疤', '祛斑', '祛痘', '美白', '抗衰老', '延年益寿',
];
export const MEDICAL_CLAIMS_EN = [
  'lowers blood pressure', 'lowers blood sugar', 'lowers cholesterol', 'anti-cancer', 'anti-tumor',
  'anti-inflammatory', 'antibacterial', 'analgesic', 'hemostatic', 'aphrodisiac', 'kidney tonic',
  'hair growth', 'scar removal', 'whitening', 'anti-aging', 'longevity',
];
// 投资承诺（非金融牌照不得承诺收益）
export const INVESTMENT_CLAIMS_ZH = [
  '保本', '稳赚', '必涨', '必赚', '零风险', '无风险', '翻倍', '暴富', '财富自由',
  '稳收益', '固定收益', '保本保息', '刚性兑付', '日赚', '月赚', '年化',
];
export const INVESTMENT_CLAIMS_EN = [
  'capital guaranteed', 'sure profit', 'must rise', 'must earn', 'zero risk', 'risk-free',
  'double your money', 'get rich', 'financial freedom', 'fixed income', 'guaranteed return',
  'daily earn', 'monthly earn', 'annualized',
];
// 贬低竞品（广告法第十三条禁用）
export const DISPARAGE_CLAIMS_ZH = [
  '远超', '秒杀', '碾压', '吊打', '完爆', '吊打同行', '甩开几条街', '甩同行几条街',
  '完胜', '秒杀同类', '吊打竞品', '秒杀竞品', '碾压竞品',
];
export const DISPARAGE_CLAIMS_EN = [
  'far surpasses', 'kills', 'crushes', 'destroys', 'beats hands down', 'leaves in the dust',
  'outperforms completely', 'crushes competitors', 'kills rivals',
];

/* ---------- video_short：3秒钩子信号词（前 80 字须命中其一） ---------- */
const HOOK_SIGNAL_ZH = ['？', '?', '！', '!', '竟然', '谁知', '没想到', '谁知道', '可是', '直到', '直到那天', '结果', '后来', '直到有一次', '有一天'];
const HOOK_SIGNAL_EN = ['?', '!', 'But', 'However', 'Until', 'One day', 'Then', 'Suddenly', 'Unexpectedly', 'Nobody knew'];
/* ---------- CTA 行动引导词 ---------- */
const CTA_ZH = ['点赞', '关注', '评论', '转发', '收藏', '点链接', '小黄车', '下单', '点击', '立即', '去抢', '抢购', '马上', '快来', '评论区'];
const CTA_EN = ['like', 'follow', 'comment', 'share', 'save', 'link below', 'cart', 'buy now', 'click', 'grab', 'subscribe'];
/* ---------- 品牌名探测：抓「」"" 包裹的专有名词 + 带品牌后缀的"XX牌/XX品牌/XX Pro" ----------
 * 注意：不抓任意中文片段（会误命中通用词），只抓有明确品牌信号的名。 */
function extractBrandNames(text: string): string[] {
  const hits = new Set<string>();
  // 「」包裹的专有名词
  const wrapped1 = text.match(/[「「][^「」]{1,12}[」」]/g) || [];
  wrapped1.forEach((w) => hits.add(w.replace(/^[「「]|[」」]$/g, '')));
  // 双引号包裹的专有名词（≥2字）
  const wrapped2 = text.match(/["""]([^"""]{2,12})["""]/g) || [];
  wrapped2.forEach((w) => hits.add(w.replace(/^["""]|["""]$/g, '')));
  // 带品牌后缀：XX牌 / XX品牌 / XX Pro / XX Max / XX Plus / XX Ultra / XX Air / XX Pad / XX Watch / XX Mate
  // 注意：不限制后缀后必须非中文（"小熊牌榨汁杯"里"小熊牌"也是品牌信号）
  const brandSuffix = text.match(/[\u4e00-\u9fff]{2,6}(?:牌|品牌)/g) || [];
  brandSuffix.forEach((b) => hits.add(b));
  // 英文品牌名：连续≥3字母（首字母大写或全大写，排除句首常见词）
  const enBrand = text.match(/\b([A-Z][a-zA-Z]{2,}(?:Pro|Max|Plus|Ultra|Air|Pad|Watch|Mate)?)\b/g) || [];
  enBrand.forEach((b) => {
    // 排除句首常见词
    const common = new Set(['The', 'But', 'And', 'However', 'Until', 'One', 'Then', 'Suddenly', 'Nobody', 'Lin', 'Chen', 'Zhang', 'Wang']);
    if (!common.has(b)) hits.add(b);
  });
  return Array.from(hits).filter((b) => b && b.length >= 2).slice(0, 12);
}

function hitWords(text: string, words: string[]): string[] {
  return words.filter((w) => text.includes(w));
}
function hitWordsEn(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}
function countOccurrences(text: string, words: string[]): number {
  return words.reduce((n, w) => n + (text.split(w).length - 1), 0);
}

/* ---------- v2.96 n-gram 重合度检测：识别成稿中可能直接沿用原文的片段 ----------
 * 中文用 6-gram（字符级，中文无空格），英文用 4-gram（词级，按 \b 切词）。
 * 纯函数·零 IO·确定性。返回重合片段（取最长 5 条）与重合比例。
 * 用于 adapt/novel/hit_lab 模式在用户提供原文时做真实侵权检测。 */
export interface OverlapResult {
  fragments: string[];
  ratio: number;
}
export function nGramOverlap(draft: string, source: string, lang: GateLang = 'zh'): OverlapResult {
  if (!draft || !source || draft.length < 6 || source.length < 6) return { fragments: [], ratio: 0 };
  if (lang === 'en') {
    // 英文：词级 4-gram
    const toks = (t: string) => t.toLowerCase().match(/\b[a-z']+\b/g) || [];
    const sToks = toks(source);
    const dToks = toks(draft);
    const N = 4;
    if (sToks.length < N || dToks.length < N) return { fragments: [], ratio: 0 };
    const srcSet = new Set<string>();
    for (let i = 0; i <= sToks.length - N; i++) srcSet.add(sToks.slice(i, i + N).join(' '));
    const fragments: string[] = [];
    let runStart = -1, overlap = 0, total = 0;
    for (let i = 0; i <= dToks.length - N; i++) {
      total++;
      const g = dToks.slice(i, i + N).join(' ');
      if (srcSet.has(g)) {
        overlap++;
        if (runStart === -1) runStart = i;
      } else {
        if (runStart !== -1 && i - runStart >= 2) fragments.push(dToks.slice(runStart, i + N - 1).join(' '));
        runStart = -1;
      }
    }
    if (runStart !== -1 && dToks.length - runStart >= 2) fragments.push(dToks.slice(runStart).join(' '));
    fragments.sort((a, b) => b.length - a.length);
    return { fragments: fragments.slice(0, 5), ratio: total > 0 ? overlap / total : 0 };
  }
  // 中文：字符级 6-gram
  const N = 6;
  const sNorm = source.toLowerCase();
  const dNorm = draft.toLowerCase();
  const srcSet = new Set<string>();
  for (let i = 0; i <= sNorm.length - N; i++) srcSet.add(sNorm.slice(i, i + N));
  const fragments: string[] = [];
  let runStart = -1, overlap = 0, total = 0;
  for (let i = 0; i <= dNorm.length - N; i++) {
    total++;
    const g = dNorm.slice(i, i + N);
    if (srcSet.has(g)) {
      overlap++;
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1 && i - runStart >= N) fragments.push(draft.slice(runStart, i + N - 1));
      runStart = -1;
    }
  }
  if (runStart !== -1 && dNorm.length - runStart >= N) fragments.push(draft.slice(runStart));
  fragments.sort((a, b) => b.length - a.length);
  return { fragments: fragments.slice(0, 5), ratio: total > 0 ? overlap / total : 0 };
}

/* ---------- video_short 硬闸门 ---------- */
function videoShortGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const blocked: GateHit[] = [];
  const warnings: GateHit[] = [];

  // 硬禁：绝对化/医疗/投资/贬低竞品
  const abs = en ? hitWordsEn(probe, ABSOLUTE_CLAIMS_EN) : hitWords(probe, ABSOLUTE_CLAIMS_ZH);
  if (abs.length) blocked.push({
    rule: 'absolute_claims',
    evidence: en ? `Absolute claims hit: ${abs.join(', ')}` : `绝对化用语命中：${abs.join('、')}`,
    advice: en ? 'Advertising law bans absolute claims (best/first/100%/cure/money-back). Rewrite with verifiable, bounded language.' : '广告法第九条禁用绝对化用语（最佳/第一/100%/根治/无效退款），改用可验证的有限表述。',
  });

  // 软警：3秒钩子（前 80 字须有冲突/疑问/反差/极端情绪信号）
  const head = text.slice(0, en ? 320 : 80);
  const headProbe = en ? head.toLowerCase() : head;
  const hookHit = (en ? HOOK_SIGNAL_EN : HOOK_SIGNAL_ZH).some((w) => headProbe.includes(en ? w.toLowerCase() : w));
  if (!hookHit) warnings.push({
    rule: 'missing_3s_hook',
    evidence: en ? 'No conflict/question/contrast signal in first ~80 chars' : '前 80 字无冲突/疑问/反差/极端情绪信号',
    advice: en ? 'Front-load a 3-second hook: pain-point question, counter-intuitive claim, result-first, or identity gap.' : '前置 3 秒钩子：痛点提问/反常识结论/结果前置/身份反差四选一。',
  });

  // 软警：口播行长度（旁白/主播台词行平均 ≤20 字）
  // 抽取「角色名（情绪）：台词」或 "NAME (emotion): line" 的台词行
  const lineRe = /[「"][^」"]{1,40}[」"]|^[^\n△]{0,20}[（(][^）)]{1,10}[）)][：:]([^\n]{1,200})/gm;
  const lines = (text.match(lineRe) || []).map((l) => l.replace(/^[^：:]*[：:]/, '').trim()).filter(Boolean);
  if (lines.length >= 3) {
    const avg = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    if (avg > 20) warnings.push({
      rule: 'voiceover_too_long',
      evidence: en ? `Average voiceover line length ${Math.round(avg)} chars (>20)` : `口播行平均 ${Math.round(avg)} 字（>20）`,
      advice: en ? 'One ≤20-character line per shot, speakable in one breath; cut bookish phrasing.' : '每镜一句、≤20字、能一口气念出口，删书面语与形容词堆叠。',
    });
  }

  // 软警：CTA 出现次数（行动引导词在全文出现次数）
  const ctaCount = countOccurrences(probe, en ? CTA_EN : CTA_ZH);
  if (ctaCount > 6) warnings.push({
    rule: 'cta_overload',
    evidence: en ? `CTA phrases appear ${ctaCount} times (>6)` : `行动引导词出现 ${ctaCount} 次（>6）`,
    advice: en ? 'CTA appears once, no begging, no stacking.' : '行动引导只重复一次、不哀求不堆砌。',
  });

  const score = Math.max(0, 100 - blocked.length * 40 - warnings.length * 12);
  return { mode: 'video_short', blocked, warnings, allowed: blocked.length === 0, score };
}

/* ---------- branded_skit 硬闸门 ---------- */
function brandedSkitGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const blocked: GateHit[] = [];
  const warnings: GateHit[] = [];

  // 硬禁：绝对化 + 医疗功效 + 投资承诺 + 贬低竞品
  const abs = en ? hitWordsEn(probe, ABSOLUTE_CLAIMS_EN) : hitWords(probe, ABSOLUTE_CLAIMS_ZH);
  if (abs.length) blocked.push({
    rule: 'absolute_claims',
    evidence: en ? `Absolute claims hit: ${abs.join(', ')}` : `绝对化用语命中：${abs.join('、')}`,
    advice: en ? 'Advertising law bans absolute claims in branded content.' : '软广内容禁用绝对化用语（广告法第九条）。',
  });
  const med = en ? hitWordsEn(probe, MEDICAL_CLAIMS_EN) : hitWords(probe, MEDICAL_CLAIMS_ZH);
  if (med.length) blocked.push({
    rule: 'medical_claims',
    evidence: en ? `Medical efficacy claims: ${med.join(', ')}` : `医疗功效承诺：${med.join('、')}`,
    advice: en ? 'Non-pharmaceuticals must not promise efficacy; prove via plot, never assert in narration.' : '非药品不得宣传疗效；卖点用剧情证明，不用旁白宣称。',
  });
  const inv = en ? hitWordsEn(probe, INVESTMENT_CLAIMS_EN) : hitWords(probe, INVESTMENT_CLAIMS_ZH);
  if (inv.length) blocked.push({
    rule: 'investment_claims',
    evidence: en ? `Investment return promises: ${inv.join(', ')}` : `投资收益承诺：${inv.join('、')}`,
    advice: en ? 'Non-licensed entities must not promise returns; remove all guaranteed-return wording.' : '非金融牌照不得承诺收益，删除所有保本/稳赚/翻倍表述。',
  });
  const dis = en ? hitWordsEn(probe, DISPARAGE_CLAIMS_EN) : hitWords(probe, DISPARAGE_CLAIMS_ZH);
  if (dis.length) blocked.push({
    rule: 'disparage_competitors',
    evidence: en ? `Competitor disparagement: ${dis.join(', ')}` : `贬低竞品：${dis.join('、')}`,
    advice: en ? 'Advertising law bans disparaging competitors; differentiate on your own merits, never by tearing down others.' : '广告法第十三条禁用贬低竞品表述；用自身卖点差异化，不靠踩别人。',
  });

  // 软警：品牌名过早出现（任一品牌名在前 1/3 篇幅出现 ≥2 次）
  const brands = extractBrandNames(text);
  if (brands.length) {
    const headThird = text.slice(0, Math.floor(text.length / 3));
    const earlyRepeat = brands.filter((b) => (headThird.split(b).length - 1) >= 2);
    if (earlyRepeat.length) warnings.push({
      rule: 'brand_too_early',
      evidence: en ? `Brand names repeat in first third: ${earlyRepeat.slice(0, 3).join(', ')}` : `前三分之一篇幅品牌名反复出现：${earlyRepeat.slice(0, 3).join('、')}`,
      advice: en ? 'Brand is the problem-solver, not the protagonist: spend the first two thirds on the human predicament, let the brand land at the turning point.' : '品牌是解题者不是主角：前三分之二立人物困境，转折点才让品牌成为解法。',
    });
  }

  const score = Math.max(0, 100 - blocked.length * 40 - warnings.length * 12);
  return { mode: 'branded_skit', blocked, warnings, allowed: blocked.length === 0, score };
}

/* ---------- hot 硬闸门 ---------- */
function hotGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];
  const blocked: GateHit[] = [];

  // 软警：缺虚构声明（成稿须含"虚构/如有雷同/纯属虚构/dramatization/fictional"）
  const fictionSignals = en ? ['fictional', 'dramatization', 'based on', 'inspired by', 'any resemblance'] : ['虚构', '如有雷同', '纯属虚构', '改编自', 'Inspired by'];
  const hasFiction = fictionSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasFiction) warnings.push({
    rule: 'missing_fiction_disclaimer',
    evidence: en ? 'No fictionalization disclaimer found' : '未发现虚构声明',
    advice: en ? 'Hot-mode scripts must disclaim fiction (e.g., "inspired by real events, dramatized") to mitigate misappropriation risk.' : '热点追更模式须声明虚构（"改编自真实事件，剧情纯属虚构"），降低侵权风险。',
  });

  // 软警：人物>3（台词角色名去重后>3）
  // 抽取「角色名（情绪）：」或 "NAME (emotion):" 的角色名
  const nameRe = /([一-鿿]{1,4}|[A-Z][a-z]{1,12})\s*[（(][^）)]{0,10}[）)][：:]/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text)) !== null) {
    names.add(m[1]);
  }
  if (names.size > 3) warnings.push({
    rule: 'too_many_characters',
    evidence: en ? `Distinct speaking characters: ${names.size} (>3)` : `台词角色数：${names.size}（>3）`,
    advice: en ? 'Hot mode resolves one conflict with at most 3 principals — too many characters dilute the signal.' : '热点追更单集只解决一个冲突，主要人物不超过 3 个，人物过多会稀释热点信号。',
  });

  const score = Math.max(0, 100 - blocked.length * 40 - warnings.length * 12);
  return { mode: 'hot', blocked, warnings, allowed: blocked.length === 0, score };
}

/* ---------- v2.96 共用：原作引用信号词（adapt/novel/hit_lab 共享，提示可能沿用原文） ---------- */
const SOURCE_REFERENCE_ZH = ['原著中', '原作中', '小说里', '漫画里', '动漫中', '电视剧里', '小说原著', '原剧', '原著', '原作'];
const SOURCE_REFERENCE_EN = ['in the novel', 'in the original', 'original work', 'novel says', 'manga says', 'anime says', 'TV drama says', 'the original drama'];
/** 改编形态信号词（adapt 模式专用） */
const ADAPT_FORM_ZH = ['续写', '衍生', '联动', '同人', '续篇', '外传', '番外'];
const ADAPT_FORM_EN = ['continue', 'spin-off', 'crossover', 'fan-fiction', 'side story', 'sequel'];

/* ---------- adapt 软闸门：创意改编模式 ---------- */
function adaptGate(text: string, lang: GateLang, sourceText?: string): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：原作引用信号——成稿出现"原著中/原作中/小说里"等，提示可能沿用原文句子（侵权风险）
  const refs = SOURCE_REFERENCE_ZH.filter((w) => probe.includes(w))
    .concat(SOURCE_REFERENCE_EN.filter((w) => probe.includes(en ? w.toLowerCase() : w)));
  if (refs.length) warnings.push({
    rule: 'source_reference_signal',
    evidence: en ? `Found source-reference markers: ${[...new Set(refs)].slice(0, 3).join(', ')}` : `检测到原作引用信号：${[...new Set(refs)].slice(0, 3).join('、')}`,
    advice: en ? 'Adaptation mode allows borrowing the underlying method only; do not reuse original sentences, signature lines, or distinctive plot sequences. Rewrite expression entirely.' : '改编模式只借底层方法，不沿用原句/标志性台词/独特情节序列——表达必须重写。',
  });

  // v2.96 真实侵权检测：用户提供原文时，跑 n-gram 重合度，命中即给出具体片段
  if (sourceText) {
    const ov = nGramOverlap(text, sourceText, lang);
    if (ov.fragments.length && ov.ratio > 0.08) {
      const sample = ov.fragments.slice(0, 2).map((f) => `"${f.slice(0, 40)}${f.length > 40 ? '…' : ''}"`).join(en ? ', ' : '、');
      warnings.push({
        rule: 'source_text_overlap',
        evidence: en ? `Text overlap with source: ${Math.round(ov.ratio * 100)}% — e.g. ${sample}` : `与原文重合 ${Math.round(ov.ratio * 100)}%，片段如：${sample}`,
        advice: en ? 'Rewrite the overlapping passages in your own expression; borrow only the underlying method, never the wording.' : '重合片段须用自己的表达重写；只借底层方法，不沿用措辞。',
      });
    }
  }

  // 软警：缺改编形态信号——成稿无"续写/衍生/联动/同人"任一形态提示，可能未定性改编形态
  const forms = ADAPT_FORM_ZH.filter((w) => probe.includes(w))
    .concat(ADAPT_FORM_EN.filter((w) => probe.includes(en ? w.toLowerCase() : w)));
  if (!forms.length) warnings.push({
    rule: 'missing_adapt_form',
    evidence: en ? 'No adaptation-form marker found (continue / spin-off / crossover / fan-fiction)' : '未发现改编形态信号（续写/衍生/联动/同人）',
    advice: en ? 'Adaptation mode requires a pre-decided form (continue / spin-off / crossover / fan-fiction); pick one to anchor the writing.' : '改编模式须先定性形态（续写/衍生/联动/同人），定性能让写作聚焦。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'adapt', blocked: [], warnings, allowed: true, score };
}

/* ---------- novel 软闸门：小说改编模式 ---------- */
function novelGate(text: string, lang: GateLang, sourceText?: string): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：原作引用信号——同 adapt
  const refs = SOURCE_REFERENCE_ZH.filter((w) => probe.includes(w))
    .concat(SOURCE_REFERENCE_EN.filter((w) => probe.includes(en ? w.toLowerCase() : w)));
  if (refs.length) warnings.push({
    rule: 'source_reference_signal',
    evidence: en ? `Found source-reference markers: ${[...new Set(refs)].slice(0, 3).join(', ')}` : `检测到原作引用信号：${[...new Set(refs)].slice(0, 3).join('、')}`,
    advice: en ? 'Novel adaptation must compress, not quote; do not keep original monologues or descriptive sentences. Borrow only the underlying setup.' : '小说改编须压缩而非引用——不得保留原著独白与说明性句子，只借底层设定。',
  });

  // v2.96 真实侵权检测：用户提供小说原文时，跑 n-gram 重合度
  if (sourceText) {
    const ov = nGramOverlap(text, sourceText, lang);
    if (ov.fragments.length && ov.ratio > 0.08) {
      const sample = ov.fragments.slice(0, 2).map((f) => `"${f.slice(0, 40)}${f.length > 40 ? '…' : ''}"`).join(en ? ', ' : '、');
      warnings.push({
        rule: 'source_text_overlap',
        evidence: en ? `Text overlap with novel: ${Math.round(ov.ratio * 100)}% — e.g. ${sample}` : `与小说原文重合 ${Math.round(ov.ratio * 100)}%，片段如：${sample}`,
        advice: en ? 'Rewrite the overlapping passages in your own screenplay expression; compress, do not quote.' : '重合片段须用剧本化表达重写；压缩改编，不照抄原文。',
      });
    }
  }

  // 软警：钩子前置——成稿前 200 字无 3 秒钩子信号词（同 video_short 的 HOOK_SIGNAL）
  const head = probe.slice(0, 200);
  const hookHits = HOOK_SIGNAL_ZH.filter((w) => head.includes(w))
    .concat(HOOK_SIGNAL_EN.filter((w) => head.includes(en ? w.toLowerCase() : w)));
  if (!hookHits.length) warnings.push({
    rule: 'missing_hook_frontload',
    evidence: en ? 'No hook signal in first 200 chars' : '前 200 字未发现钩子信号',
    advice: en ? 'Novel adaptation must front-load the original hook (core mystery / identity / crisis) into the first 3 seconds of episode 1.' : '小说改编须把原著核心钩子（悬念/身份/危机）前置到第 1 集前 3 秒。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'novel', blocked: [], warnings, allowed: true, score };
}

/* ---------- hit_lab 软闸门：爆款拆解·名场面工作台 ---------- */
function hitLabGate(text: string, lang: GateLang, sourceText?: string): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：原作引用信号——名场面/爆款逆向轨道尤其容易沿用原文
  const refs = SOURCE_REFERENCE_ZH.filter((w) => probe.includes(w))
    .concat(SOURCE_REFERENCE_EN.filter((w) => probe.includes(en ? w.toLowerCase() : w)));
  if (refs.length) warnings.push({
    rule: 'source_reference_signal',
    evidence: en ? `Found source-reference markers: ${[...new Set(refs)].slice(0, 3).join(', ')}` : `检测到原作引用信号：${[...new Set(refs)].slice(0, 3).join('、')}`,
    advice: en ? 'Hit-reverse track must replace persona, setting and worldview entirely; do not share character names, signature lines or plot sequences with the source.' : '爆款逆向轨道必须人设/背景/世界观全部替换，不得共用原作角色名、标志性台词、情节序列。',
  });

  // v2.96 真实侵权检测：用户提供原作/名场面原文时，跑 n-gram 重合度
  if (sourceText) {
    const ov = nGramOverlap(text, sourceText, lang);
    if (ov.fragments.length && ov.ratio > 0.08) {
      const sample = ov.fragments.slice(0, 2).map((f) => `"${f.slice(0, 40)}${f.length > 40 ? '…' : ''}"`).join(en ? ', ' : '、');
      warnings.push({
        rule: 'source_text_overlap',
        evidence: en ? `Text overlap with source hit: ${Math.round(ov.ratio * 100)}% — e.g. ${sample}` : `与原作/名场面重合 ${Math.round(ov.ratio * 100)}%，片段如：${sample}`,
        advice: en ? 'Replace all overlapping wording; keep only the abstract method (rhythm, payoff logic), never the expression.' : '重合措辞必须全部替换；只保留抽象方法论（节奏、兑付逻辑），不保留任何表达。',
      });
    }
  }

  // 软警：缺峰值场面信号——成稿无"峰值/高潮/名场面/peak/CLIMAX"等峰值提示
  const peakSignals = en ? ['peak', 'climax', 'signature scene', 'key moment'] : ['峰值', '高潮', '名场面', '关键场面', '关键时刻'];
  const hasPeak = peakSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasPeak) warnings.push({
    rule: 'missing_peak_signal',
    evidence: en ? 'No peak-scene marker found' : '未发现峰值场面信号',
    advice: en ? 'Hit-lab treats the given scene as the emotional/conflict peak; mark the peak position explicitly.' : '名场面工作台把给定场面当作全剧情绪/冲突峰值，须显式标注峰值位置。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'hit_lab', blocked: [], warnings, allowed: true, score };
}

/* ---------- interview 软闸门：采访式创作模式 ---------- */
function interviewGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：缺事实源回指——成稿无"你说的/你提到/你刚才/你告诉/你给"等回指用户口述信号
  const factBackrefs = en
    ? ['you said', 'you mentioned', 'you just told', 'you gave', 'you described', 'your words']
    : ['你说的', '你提到', '你刚才', '你告诉', '你给', '你描述', '你口述'];
  const hasBackref = factBackrefs.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasBackref) warnings.push({
    rule: 'missing_fact_source_backref',
    evidence: en ? 'No user-statement back-reference found' : '未发现事实源回指',
    advice: en ? 'Interview mode treats user-spoken fragments as the fact source; key settings must not be invented. Echo back to what the user said.' : '采访式把用户口述碎片当事实源，关键设定不得凭空编造——回指用户原话。',
  });

  // 软警：缺四维记忆空间信号——成稿无"关系/时间线/场景/金句"四维任一信号
  const fourDimSignals = en
    ? ['relationship', 'timeline', 'scene', 'prop', 'quote', 'signature line']
    : ['关系', '时间线', '场景', '物件', '金句', '原话'];
  const dimHits = fourDimSignals.filter((w) => probe.includes(en ? w.toLowerCase() : w));
  if (dimHits.length < 2) warnings.push({
    rule: 'missing_four_dim_memory',
    evidence: en ? `Four-dimension memory signals: ${dimHits.length}/4+` : `四维记忆空间信号：${dimHits.length}/4+ 不足`,
    advice: en ? 'Interview mode requires a four-dimension memory space (relationship / timeline / scene-prop / signature line); each dimension must land in the outline.' : '采访式须有四维记忆空间（人物关系/时间线/场景物件/原话金句），逐条落到大纲。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'interview', blocked: [], warnings, allowed: true, score };
}

/* ---------- tag 软闸门：标签创建模式 ---------- */
function tagGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：缺标签落地信号——成稿无"标签/已选/组合/Tag"等标签落地信号
  const tagLandSignals = en ? ['tag', 'selected', 'combo', 'label', 'picked'] : ['标签', '已选', '组合', '选中'];
  const hasTagLand = tagLandSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasTagLand) warnings.push({
    rule: 'missing_tag_landing',
    evidence: en ? 'No tag-landing marker found' : '未发现标签落地信号',
    advice: en ? 'Tag mode requires every selected tag to land as a concrete setting in the outline; tags must not be mere title decoration.' : '标签模式要求每个已选标签在大纲里落地为可指认的具体设定——不许只做标题装饰。',
  });

  // 软警：缺标签焊接桥——成稿无"身份/秘密/时间节点"等焊接桥信号
  const weldSignals = en ? ['identity', 'secret', 'time node', 'bridge'] : ['身份', '秘密', '时间节点', '焊接', '合理桥'];
  const hasWeld = weldSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasWeld) warnings.push({
    rule: 'missing_tag_weld_bridge',
    evidence: en ? 'No tag-weld bridge marker found' : '未发现标签焊接桥信号',
    advice: en ? 'Tag combos must be welded (one identity / one secret / one time node), not stacked; build a plausibility bridge for fresh-but-self-consistent combos.' : '标签组合要焊接不要堆砌——用"一个身份/一个秘密/一个时间节点"搭合理性桥，让组合新鲜但自洽。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'tag', blocked: [], warnings, allowed: true, score };
}

/* ---------- film 软闸门：电影剧本模式 ---------- */
function filmGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：缺三幕结构信号——成稿无"第一幕/第二幕/第三幕/Act 1/Act 2/Act 3/建置/对抗/解决"等三幕信号
  const act1Signals = en ? ['act 1', 'act one', 'setup', 'first act'] : ['第一幕', '第一幕', '建置', '开端', '起'];
  const act2Signals = en ? ['act 2', 'act two', 'confrontation', 'second act'] : ['第二幕', '对抗', '发展', '中段'];
  const act3Signals = en ? ['act 3', 'act three', 'resolution', 'third act'] : ['第三幕', '解决', '高潮', '尾声', '结局'];
  const hasAct1 = act1Signals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  const hasAct2 = act2Signals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  const hasAct3 = act3Signals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  const actHits = [hasAct1, hasAct2, hasAct3].filter(Boolean).length;
  if (actHits < 2) warnings.push({
    rule: 'missing_three_act_structure',
    evidence: en ? `Three-act signals: ${actHits}/3` : `三幕结构信号：${actHits}/3 不足`,
    advice: en ? 'Film mode requires a three-act structure (setup / confrontation / resolution); mark each act explicitly.' : '电影剧本须有三幕结构（建置/对抗/解决），须显式标注每幕边界。',
  });

  // 软警：字数不达标——电影制式 12000-18000 字（90-120 分钟）
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = (text.match(/\b[A-Za-z]+\b/g) || []).length;
  const wordCount = cjkCount + enCount;
  const minWords = 12000;
  const maxWords = 18000;
  if (wordCount < minWords) warnings.push({
    rule: 'word_count_too_short',
    evidence: en ? `Word count: ${wordCount} (< ${minWords})` : `字数：${wordCount}（< ${minWords}）`,
    advice: en ? `Film mode targets 90-120 minutes (${minWords}-${maxWords} words); current is too short, extend with fragment-sequence generation.` : `电影剧本目标 90-120 分钟（${minWords}-${maxWords}字），当前过短，按分段连续生成补足。`,
  });
  else if (wordCount > maxWords) warnings.push({
    rule: 'word_count_too_long',
    evidence: en ? `Word count: ${wordCount} (> ${maxWords})` : `字数：${wordCount}（> ${maxWords}）`,
    advice: en ? `Film mode targets 90-120 minutes (${minWords}-${maxWords} words); current is too long, tighten the structure.` : `电影剧本目标 90-120 分钟（${minWords}-${maxWords}字），当前过长，收紧结构。`,
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'film', blocked: [], warnings, allowed: true, score };
}

/* ---------- long_ip 软闸门：长系列IP创作模式 ---------- */
function longIpGate(text: string, lang: GateLang): ModeGateReport {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const warnings: GateHit[] = [];

  // 软警：缺跨季信号——成稿无"上一季/前传/后传/前季/上季/新一季/第N季"等跨季信号
  const crossSeasonSignals = en
    ? ['previous season', 'prequel', 'sequel', 'last season', 'new season', 'season 1', 'season 2', 'season 3', 'cross-season']
    : ['上一季', '前传', '后传', '前季', '上季', '新一季', '第一季', '第二季', '第三季', '跨季'];
  const hasCross = crossSeasonSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasCross) warnings.push({
    rule: 'missing_cross_season_signal',
    evidence: en ? 'No cross-season marker found' : '未发现跨季信号',
    advice: en ? 'Long-IP mode spans multiple seasons; cross-season continuity ( callbacks, character growth, world-rule consistency) must be explicit.' : '长系列IP跨多季，跨季连续性（伏笔回扣、人物成长、世界观规则一致）须显式标注。',
  });

  // 软警：缺伏笔账本信号——成稿无"伏笔/埋下/前季/之前/回收/兑付"等伏笔信号
  const foreshadowSignals = en
    ? ['foreshadow', 'plant', 'previous season', 'set up', 'payoff', 'callback', 'setup']
    : ['伏笔', '埋下', '前季', '之前', '回收', '兑付', '回扣', '铺垫'];
  const hasForeshadow = foreshadowSignals.some((w) => probe.includes(en ? w.toLowerCase() : w));
  if (!hasForeshadow) warnings.push({
    rule: 'missing_foreshadow_ledger',
    evidence: en ? 'No foreshadow-ledger marker found' : '未发现伏笔账本信号',
    advice: en ? 'Long-IP mode requires a foreshadow ledger (plant in early season / payoff in later season); track each plant-payoff pair.' : '长系列IP须有伏笔账本（早季埋下/晚季兑付），逐条跟踪 plant-payoff 配对。',
  });

  const score = Math.max(0, 100 - warnings.length * 12);
  return { mode: 'long_ip', blocked: [], warnings, allowed: true, score };
}

/**
 * 模式级成稿闸门入口。
 * @param modeRaw 线上/历史 mode 字符串（会先 canonicalModeId 归一）
 * @param text 成稿全文
 * @param lang 'zh' | 'en'，默认中文
 * @param sourceText 可选原文（adapt/novel/hit_lab 模式启用 n-gram 重合检测）
 * @returns ModeGateReport；非对应模式返回 allowed=true 空报告
 */
export function screenModeGate(modeRaw: string | undefined | null, text: string, lang: GateLang = 'zh', sourceText?: string): ModeGateReport {
  if (!text || !text.trim()) return { ...EMPTY, mode: modeRaw || '' };
  const canon = canonicalModeId(modeRaw);
  if (!canon) return { ...EMPTY, mode: modeRaw || '' };
  switch (canon) {
    case 'video_short': return videoShortGate(text, lang);
    case 'branded_skit': return brandedSkitGate(text, lang);
    case 'hot': return hotGate(text, lang);
    // v2.96 扩展：剩余 7 种模式（全软警告，不硬拦截，避免误伤）
    case 'adapt': return adaptGate(text, lang, sourceText);
    case 'novel': return novelGate(text, lang, sourceText);
    case 'hit_lab': return hitLabGate(text, lang, sourceText);
    case 'interview': return interviewGate(text, lang);
    case 'tag': return tagGate(text, lang);
    case 'film': return filmGate(text, lang);
    case 'long_ip': return longIpGate(text, lang);
    default: return { ...EMPTY, mode: canon };
  }
}
