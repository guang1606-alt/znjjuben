/**
 * v2.50 全本诊断六语（ja/ko/es/ar）平移
 * - 六维标签、评级词、维度优化建议本地化；
 * - 每条 issue 的 advice 以「正文检测语言」为准（中文正文→中文，非中文→英文），
 *   ja/ko/es/ar 展示语下回退英文（检测引擎仅 zh/en），诚实不硬翻；
 * - zh 原样、en 英文化、其余四语缺译回退英文。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';
import type { DimKey } from './scorecard';
import type { FullDiagnosis } from './full-diagnosis';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';

const DIM: Record<DimKey, Record<ExtLang, string>> = {
  character: { ja: '人物', ko: '인물', es: 'Personaje', ar: 'الشخصية' },
  plot: { ja: '筋書き', ko: '줄거리', es: 'Trama', ar: 'الحبكة' },
  dialogue: { ja: '台詞', ko: '대사', es: 'Diálogo', ar: 'الحوار' },
  market: { ja: '市場性', ko: '시장성', es: 'Mercado', ar: 'السوق' },
  format: { ja: 'フォーマット', ko: '형식', es: 'Formato', ar: 'الصيغة' },
  deai: { ja: 'AI除去', ko: 'AI 탈피', es: 'Des-IA', ar: 'إزالة أثر الذكاء الاصطناعي' },
};
const DIM_EN: Record<DimKey, string> = {
  character: 'Character', plot: 'Plot', dialogue: 'Dialogue', market: 'Market', format: 'Format', deai: 'De-AI',
};
const DIM_ZH: Record<DimKey, string> = {
  character: '人物', plot: '剧情', dialogue: '台词', market: '市场', format: '格式', deai: '去AI化',
};

const LEVEL: Record<'优秀' | '良好' | '及格' | '待打磨', Record<ExtLang, string>> = {
  优秀: { ja: '優秀', ko: '우수', es: 'Excelente', ar: 'ممتاز' },
  良好: { ja: '良好', ko: '양호', es: 'Bueno', ar: 'جيد' },
  及格: { ja: '合格', ko: '합격', es: 'Aprobado', ar: 'مقبول' },
  待打磨: { ja: '要研磨', ko: '다듬기 필요', es: 'Por pulir', ar: 'يحتاج صقلاً' },
};
const LEVEL_EN: Record<string, string> = { 优秀: 'Excellent', 良好: 'Good', 及格: 'Pass', 待打磨: 'Needs work' };

const DIM_ADVICE: Record<DimKey, Record<ExtLang, string>> = {
  character: {
    ja: '人物の隠れた設定と独立した動機を補い、道具人形化・設定崩壊を防ぐ。',
    ko: '인물의 숨은 설정과 독립적 동기를 보강해 도구화·설정 붕괴를 막으세요.',
    es: 'Añade trasfondo implícito y motivación propia a los personajes; evita personajes-función e incoherencias.',
    ar: 'أضف خلفية ضمنية ودوافع مستقلة للشخصيات، وتجنّب الشخصيات الأداة وانهيار التوصيف.',
  },
  plot: {
    ja: '黄金フック・衝突密度・転換を強め、結尾の余白を補う。',
    ko: '황금 훅·갈등 밀도·전환을 강화하고 결말 여운을 보강하세요.',
    es: 'Refuerza el gancho dorado, la densidad de conflicto y los giros; deja espacio al final.',
    ar: 'عزّز الخطاف الذهبي وكثافة الصراع والانقلابات، وأضف مساحة بيضاء في النهاية.',
  },
  dialogue: {
    ja: '台詞から書き言葉調を除き人物の身分に寄せ、自然な語気と含みを加える。',
    ko: '대사의 문어체를 걷어내고 인물 신분에 맞추며 자연스러운 어조와 함의를 더하세요.',
    es: 'Quita el tono libresco del diálogo, adáptalo a la identidad del personaje y añade naturalidad y subtexto.',
    ar: 'أزل النبرة المكتوبة من الحوار، واطبقه على هوية الشخصية، وأضف نبرة طبيعية ونصاً ضمنياً.',
  },
  market: {
    ja: 'ターゲット平台の尺度と視聴者の爽点に合わせ、人気ランキングを参考に題材選定する。',
    ko: '목표 플랫폼 기준과 시청자 쾌점에 맞추고 인기 순위를 참고해 소재를 정하세요.',
    es: 'Alinea el tono con la plataforma objetivo y los puntos de recompensa de la audiencia; usa el ranking de tendencias para elegir tema.',
    ar: 'طابق المعايير مع المنصة المستهدفة ونقاط إشباع الجمهور، واستعن بقائمة الرواج لاختيار الموضوع.',
  },
  format: {
    ja: '脚本フォーマットと単集字数を直し、場面／カット要素を補う。',
    ko: '대본 형식과 화당 글자수를 바로잡고 장면/숏 요소를 보완하세요.',
    es: 'Corrige el formato guion y el conteo por episodio; completa los elementos de escena/plano.',
    ar: 'صحّح صيغة السيناريو وعدد الكلمات لكل حلقة، وأكمل عناصر المشهد/اللقطة.',
  },
  deai: {
    ja: 'AI調と決まり切った展開を除き、生活感と不完全さを注入する。',
    ko: 'AI 말투와 진부한 전개를 걷어내고 생활감과 불완전한 자연스러움을 불어넣으세요.',
    es: 'Elimina el tono de IA y los tropos gastados; inyecta textura cotidiana y sensación de imperfección.',
    ar: 'أزل نبرة الذكاء الاصطناعي والمشاهد المبتذلة، واحقن أجواء الحياة اليومية وإحساس النقص الطبيعي.',
  },
};
const DIM_ADVICE_EN: Record<DimKey, string> = {
  character: 'Add hidden backstory and independent motives; avoid tool-characters and characterization collapse.',
  plot: 'Strengthen the golden hook, conflict density and turns; leave a breathing ending.',
  dialogue: 'De-literarize dialogue, match character identity, add natural tone and subtext.',
  market: 'Align with the target platform’s limits and audience payoffs; use the trend ranking for topic choice.',
  format: 'Fix script format and per-episode word count; complete scene/shot elements.',
  deai: 'Remove AI tone and formulaic beats; inject everyday texture and controlled imperfection.',
};
const DIM_ADVICE_ZH: Record<DimKey, string> = {
  character: '补人物隐性设定与独立动机，避免工具人/人设崩塌',
  plot: '强化黄金钩子、冲突密度与转折，补结尾留白',
  dialogue: '台词去书面腔、贴人物身份，加自然语气与潜台词',
  market: '对齐目标平台尺度与受众爽点，参考热度榜选题',
  format: '修正剧本格式与单集字数，补齐场景/镜头要素',
  deai: '清除AI腔与套路桥段，注入烟火气与不完美感',
};

function dimLabel(key: DimKey, l: StrategyUiLang): string {
  if (l === 'zh') return DIM_ZH[key];
  if (l === 'en') return DIM_EN[key];
  return DIM[key][l];
}
function levelLabel(zhLevel: string, l: StrategyUiLang): string {
  if (l === 'zh') return zhLevel;
  if (l === 'en') return LEVEL_EN[zhLevel] ?? zhLevel;
  return LEVEL[zhLevel as keyof typeof LEVEL]?.[l] ?? (LEVEL_EN[zhLevel] ?? zhLevel);
}
function dimAdvice(key: DimKey, l: StrategyUiLang): string {
  if (l === 'zh') return DIM_ADVICE_ZH[key];
  if (l === 'en') return DIM_ADVICE_EN[key];
  return DIM_ADVICE[key][l];
}

export function localizeDiagnosis<T extends FullDiagnosis>(d: T, lang: StrategyUiLang): T {
  const l = normalizeUiLang(lang);
  if (l === 'zh') return d;
  const groups = d.groups.map((g) => ({ ...g, label: dimLabel(g.key, l) }));
  const topFixes = d.topFixes.map((f) => ({ ...f, dimLabel: dimLabel(f.dim as DimKey, l) }));
  const dimensions = d.scorecard.dimensions.map((x) => ({
    ...x, label: dimLabel(x.key, l), level: levelLabel(x.level, l), advice: dimAdvice(x.key, l),
  }));
  return {
    ...d,
    groups,
    topFixes,
    scorecard: {
      ...d.scorecard,
      dimensions,
      level: levelLabel(d.scorecard.level, l),
      weakest: { ...d.scorecard.weakest, label: dimLabel(d.scorecard.weakest.key, l), level: levelLabel(d.scorecard.weakest.level, l), advice: dimAdvice(d.scorecard.weakest.key, l) },
      priorityActions: d.scorecard.priorityActions.map((x) => ({
        ...x, label: dimLabel(x.key, l), level: levelLabel(x.level, l), advice: dimAdvice(x.key, l),
      })),
    },
  };
}

export function diagnosisI18nCoverage(): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  const keys = Object.keys(DIM) as DimKey[];
  keys.forEach((k) => (['ja', 'ko', 'es', 'ar'] as ExtLang[]).forEach((lg) => {
    if (!DIM[k][lg]) missing.push(`dim/${k}/${lg}`); else covered++;
    if (!DIM_ADVICE[k][lg]) missing.push(`advice/${k}/${lg}`); else covered++;
  }));
  (Object.keys(LEVEL) as (keyof typeof LEVEL)[]).forEach((k) => (['ja', 'ko', 'es', 'ar'] as ExtLang[]).forEach((lg) => {
    if (!LEVEL[k][lg]) missing.push(`level/${k}/${lg}`); else covered++;
  }));
  return { missing, covered };
}
