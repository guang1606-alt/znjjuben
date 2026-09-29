/**
 * script-value.ts — 剧本价值证书引擎（v2.69，纯确定性、零 LLM 边际成本）
 *
 * 目标（PRD："要让用户知道自己的剧本有价值、值钱"）：把已有的两套客观信号
 *   ① script-pk 六维创作分（人物/剧情/台词/市场/格式/去AI）
 *   ② investor-lens 资方视角分（赛道/回收/投流/内容门槛）
 * 融合为一张"价值证书"：价值指数、等级、参考价值区间、亮点、风险、可分享梗概文案。
 *
 * 诚实原则（不编造、不诱导成交）：
 *  - 价值区间是"算法参考区间"，明确标注 marketEstimated=true、非报价/非成交承诺，实际以交易撮合为准；
 *  - 没有正文（0集）时不产出高分，等级给"待评估"，价值区间给 null；
 *  - 分享文案只含剧名/标签/梗概级一句话 + 平台引流，绝不含剧本全文。
 */
import { scoreProject, PkDimensionKey } from './script-pk';
import { investorLens, InvestorLensResult } from '../engine/investor-lens';

export type ValueGrade = 'S' | 'A' | 'B' | 'C' | 'NA';

export interface ValueDim {
  key: PkDimensionKey | 'funder';
  labelZh: string;
  labelEn: string;
  score: number;
}

export interface ValueBand {
  perEpLow: number;   // 单集参考下限（元）
  perEpHigh: number;  // 单集参考上限（元）
  totalLow: number;   // 全本参考下限（元）
  totalHigh: number;  // 全本参考上限（元）
  currency: 'CNY';
  marketEstimated: true;
}

export interface ScriptValueResult {
  title: string;
  penName: string | null;
  episodes: number;
  craftScore: number;       // 六维创作均分
  funderScore: number;      // 资方视角分
  valueIndex: number;       // 融合价值指数 0-100
  grade: ValueGrade;
  gradeZh: string;
  gradeEn: string;
  dimensions: ValueDim[];
  strengthsZh: string[];
  strengthsEn: string[];
  risksZh: string[];
  risksEn: string[];
  band: ValueBand | null;
  disclaimerZh: string;
  disclaimerEn: string;
  shareTextZh: string;
  shareTextEn: string;
  investor: InvestorLensResult;
}

const DIM_LABEL: Record<PkDimensionKey, { zh: string; en: string }> = {
  character: { zh: '人物塑造', en: 'Character' },
  plot: { zh: '剧情节奏', en: 'Plot & Pace' },
  dialogue: { zh: '台词张力', en: 'Dialogue' },
  market: { zh: '市场潜力', en: 'Market Fit' },
  format: { zh: '格式规范', en: 'Format' },
  antiAi: { zh: '去AI质感', en: 'Human-like' },
};
const DIM_ORDER: PkDimensionKey[] = ['character', 'plot', 'dialogue', 'market', 'format', 'antiAi'];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 等级：S≥85 / A≥75 / B≥62 / C 其余；无正文 NA */
export function gradeOf(valueIndex: number, episodes: number): ValueGrade {
  if (!episodes) return 'NA';
  if (valueIndex >= 85) return 'S';
  if (valueIndex >= 75) return 'A';
  if (valueIndex >= 62) return 'B';
  return 'C';
}

const GRADE_LABEL: Record<ValueGrade, { zh: string; en: string }> = {
  S: { zh: 'S · 极具市场价值', en: 'S · High market value' },
  A: { zh: 'A · 具备商业潜力', en: 'A · Commercial potential' },
  B: { zh: 'B · 打磨后可推', en: 'B · Push after polish' },
  C: { zh: 'C · 建议继续打磨', en: 'C · Keep refining' },
  NA: { zh: '待评估', en: 'Not evaluated' },
};

/**
 * 单集参考价值区间（元/集，买断/定制初稿口径，保守量级）。
 * 仅用于让用户感知"剧本值钱"，明确为算法参考、非成交承诺。
 */
const PER_EP_BAND: Record<Exclude<ValueGrade, 'NA'>, [number, number]> = {
  S: [300, 600],
  A: [150, 300],
  B: [60, 150],
  C: [20, 60],
};

export function buildScriptValue(input: {
  title: string;
  penName?: string | null;
  tags?: string[];
  contents: string[];
  synopsis?: string | null;
  lang?: 'zh' | 'en';
}): ScriptValueResult {
  const lang = input.lang === 'en' ? 'en' : 'zh';
  const en = lang === 'en';
  const episodes = input.contents.filter((c) => c && c.trim()).length;
  const craft = scoreProject(input.contents);
  const craftScore = r1(DIM_ORDER.reduce((s, k) => s + craft[k], 0) / DIM_ORDER.length);
  const investor = investorLens({ text: input.contents.join('\n').slice(0, 20000), tags: input.tags ?? [], episodes }, lang);
  const funderScore = investor.overall;
  // 价值指数：创作实力与资方视角各半（好内容 + 好回收才"值钱"）
  const valueIndex = r1(0.5 * craftScore + 0.5 * funderScore);
  const grade = gradeOf(valueIndex, episodes);

  const dimensions: ValueDim[] = [
    ...DIM_ORDER.map((k) => ({ key: k, labelZh: DIM_LABEL[k].zh, labelEn: DIM_LABEL[k].en, score: r1(craft[k]) })),
    { key: 'funder', labelZh: '资方视角', labelEn: 'Funder view', score: funderScore },
  ];

  // 亮点：创作六维取前2 + 资方四维取前1
  const craftTop = [...DIM_ORDER].sort((a, b) => craft[b] - craft[a]).slice(0, 2);
  const funderTop = [...investor.dimensions].sort((a, b) => b.score - a.score)[0];
  const strengthsZh = [
    ...craftTop.map((k) => `${DIM_LABEL[k].zh}表现突出（${r1(craft[k])}分）`),
    funderTop ? `资方看重的「${funderTop.name}」是你的强项（${funderTop.score}分）` : '',
  ].filter(Boolean);
  const strengthsEn = [
    ...craftTop.map((k) => `Strong ${DIM_LABEL[k].en.toLowerCase()} (${r1(craft[k])})`),
    funderTop ? `Funder-prioritized "${funderTop.name}" is a strength (${funderTop.score})` : '',
  ].filter(Boolean);

  // 风险：资方硬否决优先，其次创作最弱一维（investorLens 已按 lang 产出同语言 vetoes/advice）
  const craftWeak = [...DIM_ORDER].sort((a, b) => craft[a] - craft[b])[0];
  const weakZh = craft[craftWeak] < 62 ? `${DIM_LABEL[craftWeak].zh}偏弱（${r1(craft[craftWeak])}分），建议针对性打磨后再推交易/投稿` : null;
  const weakEn = craft[craftWeak] < 62 ? `${DIM_LABEL[craftWeak].en} is weak (${r1(craft[craftWeak])}); polish before pitching.` : null;
  const dimAdvice = investor.dimensions.filter((d) => d.score < 62).slice(0, 2);
  const risksZh = [
    ...(en ? [] : investor.vetoes), weakZh,
    ...dimAdvice.map((d) => `【${d.name}】${d.advice}`),
  ].filter((x): x is string => !!x);
  const risksEn = [
    ...(en ? investor.vetoes : []), weakEn,
    ...dimAdvice.map((d) => `[${d.name}] ${d.advice}`),
  ].filter((x): x is string => !!x);

  // 参考价值区间
  let band: ValueBand | null = null;
  if (grade !== 'NA') {
    const [lo, hi] = PER_EP_BAND[grade];
    band = {
      perEpLow: lo, perEpHigh: hi,
      totalLow: lo * episodes, totalHigh: hi * episodes,
      currency: 'CNY', marketEstimated: true,
    };
  }

  const disclaimerZh = '价值指数与区间为平台算法依据文本特征的参考估算，非报价或成交承诺，剧本实际价值以交易撮合、平台过稿与市场表现为准。';
  const disclaimerEn = 'The index and band are algorithmic reference estimates from text signals, not a quote or deal promise; actual value is set by matchmaking, platform acceptance and market performance.';

  // 分享文案：只含剧名/标签/梗概级一句话 + 平台引流（绝不放全文）
  const tagStr = (input.tags ?? []).slice(0, 3).join(en ? '/' : '、');
  const syn = (input.synopsis || '').trim();
  const author = input.penName ? (en ? ` by ${input.penName}` : ` · 作者 ${input.penName}`) : '';
  const shareTextZh = `我在「终南集·AGI编剧大师」写的短剧《${input.title}》${author}${tagStr ? `（${tagStr}）` : ''}获得 ${grade} 级价值认证，价值指数 ${valueIndex}。${syn ? `一句话简介：${syn.slice(0, 60)}。` : ''}好剧本会说话，来写你自己的爆款 →`;
  const shareTextEn = `My vertical drama "${input.title}"${author}${tagStr ? ` (${tagStr})` : ''} just earned a ${grade} value certificate (index ${valueIndex}) on ZhongnanJi · AGI Screenwriting Master.${syn ? ` Logline: ${syn.slice(0, 80)}.` : ''} Write your own hit →`;

  return {
    title: input.title,
    penName: input.penName ?? null,
    episodes,
    craftScore, funderScore, valueIndex, grade,
    gradeZh: GRADE_LABEL[grade].zh,
    gradeEn: GRADE_LABEL[grade].en,
    dimensions,
    strengthsZh, strengthsEn,
    risksZh, risksEn,
    band,
    disclaimerZh, disclaimerEn,
    shareTextZh, shareTextEn,
    investor,
  };
}
