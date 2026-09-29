/**
 * 剧情软广·结构化品牌简报引擎（v2.93）
 * 设计目标：把用户结构化填写的品牌要素作为「事实源」确定性注入管线，
 *   ① 品牌/产品名逐字使用，防止模型改名、造系列名；
 *   ② 一条创意只锚定一个核心卖点，强制「剧情证明」而非旁白宣称；
 *   ③ 生成前做广告词合规预检（广告法绝对化用语 / 医疗功效 / 投资收益承诺），命中即拦截、不扣费；
 *   ④ 软性度三档决定品牌亮相方式与 CTA 强度。
 * 约束：纯函数 · 双语 · 零 IO · 不改变既有版式与字数闸门。
 */

export type BrandLang = 'zh' | 'en';
export type BrandSoftness = 'subtle' | 'balanced' | 'direct';

export interface BrandBriefInput {
  brand: string;          // 品牌名（必填）
  product: string;        // 产品/品类
  sellingPoint: string;   // 唯一核心卖点（必填）
  audience: string;       // 目标人群
  storyShell: string;     // 期望的剧情外壳
  memorySymbol: string;   // 品牌专属记忆符号（动作/道具/台词）
  cta: string;            // 期望的转化动作
  softness: BrandSoftness; // 软性度：轻植入 / 均衡 / 强转化
}

/** HTTP 入参形状（全部可选字符串，softness 单独收窄） */
export type BrandBriefRaw = Partial<Record<keyof Omit<BrandBriefInput, 'softness'>, unknown>> & {
  softness?: unknown;
};

const FIELD_MAX: Record<Exclude<keyof BrandBriefInput, 'softness'>, number> = {
  brand: 40, product: 60, sellingPoint: 120, audience: 60,
  storyShell: 200, memorySymbol: 60, cta: 60,
};

const SOFTNESS: BrandSoftness[] = ['subtle', 'balanced', 'direct'];

export class BrandBriefError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'BrandBriefError';
    this.field = field;
  }
}

function str(v: unknown, field: keyof typeof FIELD_MAX, label: string, required = false, min = 0): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && s.length < min) throw new BrandBriefError(field, label);
  return s.slice(0, FIELD_MAX[field]).trim();
}

/** 规范化 + 必填校验；仅在 branded_skit 模式下由路由调用 */
export function normalizeBrandBrief(raw: BrandBriefRaw | null | undefined): BrandBriefInput {
  const r = raw ?? {};
  const brand = str(r.brand, 'brand', '品牌名不能为空', true, 1);
  const sellingPoint = str(r.sellingPoint, 'sellingPoint', '核心卖点至少 2 个字', true, 2);
  const softness: BrandSoftness = SOFTNESS.includes(r.softness as BrandSoftness)
    ? (r.softness as BrandSoftness)
    : 'balanced';
  return {
    brand,
    product: str(r.product, 'product', ''),
    sellingPoint,
    audience: str(r.audience, 'audience', ''),
    storyShell: str(r.storyShell, 'storyShell', ''),
    memorySymbol: str(r.memorySymbol, 'memorySymbol', ''),
    cta: str(r.cta, 'cta', ''),
    softness,
  };
}

/** 是否有足够的实质内容（路由用于决定是否注入） */
export function hasBrandBrief(b: BrandBriefInput | null | undefined): b is BrandBriefInput {
  return !!b && b.brand.length > 0 && b.sellingPoint.length >= 2;
}

/* ------------------------------------------------------------------ */
/* 广告词合规预检（只扫用户填写的品牌字段，不扫成稿；命中只回词面类别） */
/* ------------------------------------------------------------------ */

// 绝对化用语（《广告法》第九条及常见违禁表述），按「短语」匹配，避免「她第一次」这类误伤
const AD_CLAIM_PATTERNS_ZH = [
  '国家级', '世界级', '最高级', '最佳', '最好', '最优', '最强', '最先进', '最低价', '最便宜',
  '全网第一', '全国第一', '行业第一', '销量第一', '排名第一', '天下第一',
  '顶级', '极品', '终极', '万能', '之王', '之最', '绝无仅有', '史无前例', '空前绝后',
  '100%', '百分百', '百分之百',
  '包治', '根治', '治愈', '疗效', '药到病除', '无副作用', '永不复发', '无效退款',
  '稳赚', '必赚', '保本', '零风险', '无风险', '躺赚', '高收益', '日进斗金',
  '秒杀所有', '碾压全', '吊打全', '通杀',
];
const AD_CLAIM_PATTERNS_EN = [
  'no.1', 'no. 1', '#1', 'best in the world', 'world-class', 'top-tier',
  '100%', 'guaranteed cure', 'cure-all', 'miracle cure', 'zero risk', 'risk-free',
  'guaranteed return', 'get rich', 'instant profit',
];

/** 返回命中的违禁短语（去重、保持出现顺序） */
export function scanAdClaims(text: string, lang: BrandLang = 'zh'): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const pats = lang === 'en' ? AD_CLAIM_PATTERNS_EN : AD_CLAIM_PATTERNS_ZH;
  const hits: string[] = [];
  for (const p of pats) {
    if (lower.includes(p.toLowerCase()) && !hits.includes(p)) hits.push(p);
  }
  return hits;
}

/** 扫描全部品牌字段（中文字段为主；英文字段在英文链路也扫英文词表） */
export function scanBrandBrief(b: BrandBriefInput, lang: BrandLang = 'zh'): string[] {
  const joined = [b.brand, b.product, b.sellingPoint, b.audience, b.memorySymbol, b.cta]
    .filter(Boolean).join(' / ');
  return scanAdClaims(joined, lang);
}

/* ------------------------------------------------------------------ */
/* 管线指令拼装（架构师 / 撰写师 / 观众代言官共用同一份事实源）          */
/* ------------------------------------------------------------------ */

const SOFTNESS_ZH: Record<BrandSoftness, string> = {
  subtle: '轻植入：品牌/产品只在剧情转折点之后自然出现一次，前 2/3 时长纯人物困境；结尾只用记忆符号回扣，不出现直接购买号召',
  balanced: '均衡：转折点让产品自然成为困境的解法并给一次体验证明，结尾用人物之口做一次软性引导，不打断剧情',
  direct: '强转化：卖点要让观众清晰可感知，转折后的体验证明要具体，结尾明确给出转化动作，但仍须由人物/剧情带出，禁止喊麦式口播',
};
const SOFTNESS_EN: Record<BrandSoftness, string> = {
  subtle: 'Subtle placement: the brand/product appears naturally only ONCE after the turning point; the first two thirds stay purely on the human predicament; end with the memory-symbol callback only, no direct purchase CTA',
  balanced: 'Balanced: at the turning point the product naturally becomes the solution with one lived proof moment; end with one soft invitation spoken by a character, without breaking the story',
  direct: 'Conversion-led: make the single selling point clearly perceptible, give a concrete proof moment after the turn, and end on a clear CTA — still delivered by a character through plot, never a shouty host-read',
};

export function buildBrandDirective(b: BrandBriefInput, lang: BrandLang = 'zh'): string {
  if (lang === 'en') {
    const lines = [
      '[BRANDED-SKIT BRAND BIBLE — hard facts, follow verbatim]',
      `· Brand: ${b.brand} (use this exact name everywhere; never rename, abbreviate or invent a sub-brand)`,
    ];
    if (b.product) lines.push(`· Product/category: ${b.product}`);
    lines.push(`· THE single core selling point: ${b.sellingPoint} (place only this one; prove it through plot — the character’s situation changes because of it; never assert it in narration or list specs)`);
    if (b.audience) lines.push(`· Target audience: ${b.audience}`);
    if (b.storyShell) lines.push(`· Wanted story wrapper: ${b.storyShell}`);
    if (b.memorySymbol) lines.push(`· Brand-owned memory symbol: ${b.memorySymbol} (callback it naturally exactly once at the end)`);
    if (b.cta) lines.push(`· Conversion action: ${b.cta} (delivered by a character through plot, never a shouty read)`);
    lines.push(`· Softness: ${SOFTNESS_EN[b.softness]}`);
    lines.push('· Compliance: do NOT add absolute claims (“best/#1/100%”), medical/investment efficacy promises, competitor disparagement or fake testimonials; do not disguise the ad as an objective review; keep required ad disclaimers.');
    return lines.join('\n');
  }
  const lines = [
    '【剧情软广·品牌简报·必须严格遵守】（以下为品牌事实源，逐字使用）',
    `◆ 品牌：${b.brand}（全稿品牌/产品名必须与此逐字一致，禁止改名、缩写或自造系列名）`,
  ];
  if (b.product) lines.push(`◆ 产品/品类：${b.product}`);
  lines.push(`◆ 唯一核心卖点：${b.sellingPoint}（只能植入这一个卖点；必须用剧情证明——人物处境因它改变；禁止旁白宣称、禁止堆砌参数）`);
  if (b.audience) lines.push(`◆ 目标人群：${b.audience}`);
  if (b.storyShell) lines.push(`◆ 期望剧情外壳：${b.storyShell}`);
  if (b.memorySymbol) lines.push(`◆ 品牌记忆符号：${b.memorySymbol}（在结尾自然回扣恰好一次）`);
  if (b.cta) lines.push(`◆ 转化动作：${b.cta}（由人物之口、随剧情自然带出，禁止喊麦式口播）`);
  lines.push(`◆ 软性度：${SOFTNESS_ZH[b.softness]}`);
  lines.push('◆ 合规红线：不得新增“最/第一/100%”等绝对化用语、医疗功效或投资收益承诺；不贬低竞品、不虚构体验、不伪装成客观测评；按平台规则保留广告提示。');
  return lines.join('\n');
}
