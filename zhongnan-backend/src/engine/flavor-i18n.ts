/**
 * v2.45 四轴叙事风味 + 钩子台框架标签 多语平移（ja/ko/es/ar）
 * 与 strategy-i18n 同原则：仅展示层本地化，id/推荐算法/进管线的 directive 不动；缺译回退 en→zh。
 * 覆盖：微钩风味6 + 爽点风味5 + 反转风味4 + 情绪风味5 = 20 项（name+desc）；
 *       框架标签：四层目录、三种布点模式、三档强度、三类节拍名。
 * 注：29 个具体钩子、26 个具体节拍的完整四语释义在后续版本平移，本版对其回退英文（不伪装完成）。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';
const EXT: ExtLang[] = ['ja', 'ko', 'es', 'ar'];
type NameDesc = { name: string; desc: string };
type AxisMap = Record<string, Record<ExtLang, NameDesc>>;

const MICRO: AxisMap = {
  action: {
    ja: { name: 'アクションフック', desc: '異常・危険・意味深い動作や小逆転で説明を代替、語らず見せる' },
    ko: { name: '액션 훅', desc: '비정상·위험·의미심장한 동작이나 소반전으로 설명을 대체, 보여주기' },
    es: { name: 'Gancho de acción', desc: 'Una acción inquietante, peligrosa o reveladora (o un mini-giro) sustituye la explicación: mostrar, no decir' },
    ar: { name: 'خطافة الفعل', desc: 'فعل غير اعتيادي أو خطير أو ذو دلالة (أو انقلاب صغير) يحل محل الشرح: اعرض لا تخبر' },
  },
  line: {
    ja: { name: 'セリフフック', desc: '含み・二重の意味・言いさしで、台詞の裏に張力を持たせる' },
    ko: { name: '대사 훅', desc: '함의·이중 의미·말끊기로 대사 이면에 긴장을 부여한다' },
    es: { name: 'Gancho de diálogo', desc: 'Subtexto, doble sentido y frases inconclusas crean tensión' },
    ar: { name: 'خطافة الحوار', desc: 'المعنى الضمني وازدواج الدلالة والكلام المبتور يصنع التوتر' },
  },
  atmos: {
    ja: { name: '雰囲気/感覚フック', desc: '環境・光・音・匂いの変化で不穏を予感、直接は言わない' },
    ko: { name: '분위기/감각 훅', desc: '환경·빛·소리·냄새 변화로 불안을 예감하고 직접 말하지 않는다' },
    es: { name: 'Gancho de atmósfera/sentido', desc: 'Cambios de entorno, luz, sonido u olor presagian sin revelar' },
    ar: { name: 'خطافة الأجواء/الحواس', desc: 'تحولات المكان والضوء والصوت والرائحة تنذر دون تصريح' },
  },
  emotion: {
    ja: { name: '感情フック', desc: '感情の対比・堪える寸前・共感ディテールを、具体的な動作に宿す' },
    ko: { name: '감정 훅', desc: '감정 대비·폭발 직전의 참음·공감 디테일을 구체적 동작에 담는다' },
    es: { name: 'Gancho emocional', desc: 'Contraste emocional, contención a punto de estallar y empatía mediante un gesto concreto' },
    ar: { name: 'خطافة عاطفية', desc: 'تباين عاطفي وكبت على وشك الانفجار وتعاطف عبر حركة ملموسة' },
  },
  gap: {
    ja: { name: '情報格差フック', desc: '観客と人物の知識差で、緊張と期待を生む' },
    ko: { name: '정보격차 훅', desc: '관객과 인물의 지식 차이로 긴장과 기대를 만든다' },
    es: { name: 'Gancho de brecha informativa', desc: 'La ironía dramática —público y personaje saben cosas distintas— genera suspenso' },
    ar: { name: 'خطافة فجوة المعلومة', desc: 'المفارقة الدرامية حين يعرف الجمهور ما تجهله الشخصية تصنع التشويق' },
  },
  foreshadow: {
    ja: { name: '伏線/連鎖フック', desc: '後で回収する謎・物・言葉を植える、または即座に二度ロックする' },
    ko: { name: '복선/연쇄 훅', desc: '나중에 회수할 수수께끼·물건·말을 심거나 즉시 한 번 더 잠근다' },
    es: { name: 'Gancho de presagio/cadena', desc: 'Planta un misterio, objeto o frase a cobrar después, o encadena un segundo cierre al instante' },
    ar: { name: 'خطافة التلميح/التسلسل', desc: 'ازرع لغزاً أو غرضاً أو عبارة تُحصد لاحقاً، أو أغلق مرتين متتاليتين' },
  },
};

const PAYOFF: AxisMap = {
  face_slap: {
    ja: { name: 'その場で一矢', desc: '軽んじた者がその場で覆し、増長者はその場で報いを受ける' },
    ko: { name: '현장 반격', desc: '무시당한 이가 즉석에서 반증하고 잘난 체한 이는 즉각 보응받는다' },
    es: { name: 'Bofetada / karma inmediato', desc: 'El menospreciado lo demuestra allí mismo; el soberbio recibe su merecido al instante' },
    ar: { name: 'صفعة/عقاب فوري', desc: 'المُحتقَر يثبت العكس فوراً والمتغطرس ينال جزاءه في الحال' },
  },
  comeback: {
    ja: { name: '逆転リベンジ/願望代償', desc: '劣勢が知略や気骨でひっくり返す、観客の代わりに鬱憤を晴らす' },
    ko: { name: '역전/대리만족', desc: '열세가 모략과 배짱으로 판을 뒤집어 관객의 울분을 대리 해소한다' },
    es: { name: 'Remontada / satisfacción vicaria', desc: 'El débil da la vuelta con astucia o agallas y desahoga al espectador' },
    ar: { name: 'انتقام صاعد/إشباع بالنيابة', desc: 'الضعيف يقلب الطاولة بحنكة أو جرأة فينفّس عن المشاهد' },
  },
  status_crush: {
    ja: { name: '身分実力制圧', desc: '隠した身分や硬实力を明かし、格上で圧倒、チート資源込み' },
    ko: { name: '신분 실력 압도', desc: '숨긴 신분이나 실력을 드러내 격으로 압도, 치트 자원 포함' },
    es: { name: 'Dominio de estatus/competencia', desc: 'Revela estatus oculto o habilidad dura para superar por rango, recursos tipo «cheat» incluidos' },
    ar: { name: 'هيمنة المكانة/المهارة', desc: 'إظهار مكانة خفية أو مهارة صلبة للسحق بالرتبة، بما فيها موارد «الغش»' },
  },
  truth_justice: {
    ja: { name: '真相と正義', desc: '証拠の鎖が公で閉じ、陰謀を暴き正義が戻る' },
    ko: { name: '진실과 정의', desc: '증거 고리가 공개적으로 닫히고 음모가 폭로되며 정의가 복귀한다' },
    es: { name: 'Verdad y justicia', desc: 'La cadena de pruebas se cierra en público, se expone la trama y vuelve la justicia' },
    ar: { name: 'الحقيقة والعدالة', desc: 'تنغلق سلسلة الأدلة علناً وتُفضح المؤامرة ويعود العدل' },
  },
  sweet_warm: {
    ja: { name: '甘い応答', desc: '感情の労苦に対等な応えを、柔らかく確かな満足を届ける' },
    ko: { name: '달콤한 응답', desc: '감정 노력에 맞먹는 응답, 부드럽고 확실한 만족을 전한다' },
    es: { name: 'Recompensa dulce/cálida', desc: 'El esfuerzo emocional recibe una respuesta equivalente: una satisfacción tierna y segura' },
    ar: { name: 'مكافأة حلوة دافئة', desc: 'الجهد العاطفي ينال استجابة مكافئة: رضا رقيق مؤكد' },
  },
};

const REVERSAL: AxisMap = {
  identity_shift: {
    ja: { name: '身分/強弱逆転', desc: '正体が明かされ強弱が入れ替わり、抑えられた側が優位に立つ' },
    ko: { name: '신분/강약 역전', desc: '정체가 드러나고 강약이 맞바뀌어 억눌린 쪽이 우위에 선다' },
    es: { name: 'Cambio de identidad/poder', desc: 'Se revela la identidad, el poder cambia de manos y el oprimido toma ventaja' },
    ar: { name: 'تبدّل الهوية/القوة', desc: 'تُكشف الهوية ويتبادل القوة موقعه فيتقدّم المقهور' },
  },
  relation_turn: {
    ja: { name: '関係/立場の旋回', desc: '敵味方や立場が急変、利害と情報格差がそれを駆動する' },
    ko: { name: '관계/입장 선회', desc: '적아와 입장이 돌변하고 이해관계와 정보격차가 이를 구동한다' },
    es: { name: 'Giro de relación/postura', desc: 'Amigo-enemigo o postura cambian de golpe, movidos por interés y brechas de información' },
    ar: { name: 'انقلاب العلاقة/الموقف', desc: 'الصداقة والعداوة أو الموقف تنقلب فجأة بدافع المصلحة وفجوة المعلومة' },
  },
  truth_cause: {
    ja: { name: '真相/因果の逆転', desc: '真偽・因果・時間軸が組み上がり、真相が逆さになる' },
    ko: { name: '진실/인과 도치', desc: '진위·인과·시간축이 맞춰지며 진실이 뒤집힌다' },
    es: { name: 'Inversión de verdad/causa', desc: 'Lo verdadero-falso, causa-efecto y línea temporal se reensamblan en una verdad invertida' },
    ar: { name: 'قلب الحقيقة/السببية', desc: 'الحقيقي والزائف والسبب والأثر والخط الزمني تتجمّع في حقيقة مقلوبة' },
  },
  cognition_overturn: {
    ja: { name: '認識の覆し', desc: '新しい前提ひとつで、人物と観客の既定認識を書き換える' },
    ko: { name: '인식 전복', desc: '새 전제 하나로 인물과 관객의 기존 인식을 재작성한다' },
    es: { name: 'Vuelco cognitivo', desc: 'Una nueva premisa reescribe lo que personajes y audiencia creían' },
    ar: { name: 'انقلاب معرفي', desc: 'مقدمة جديدة واحدة تعيد كتابة ما اعتقده الشخصيات والجمهور' },
  },
};

const EMOTION: AxisMap = {
  press_release: {
    ja: { name: '抑圧→解放', desc: 'まず溜めてから爆発・解放する、カタルシス曲線' },
    ko: { name: '억압→해방', desc: '먼저 눌러 모았다가 폭발·해방하는 사이다 곡선' },
    es: { name: 'Supresión → liberación', desc: 'Presiona primero y estalla después: una curva catártica' },
    ar: { name: 'كبت→تحرير', desc: 'اكبُت أولاً ثم انفجر وأطلق: منحنى تطهيري' },
  },
  tender_heal: {
    ja: { name: '温かな癒やし', desc: '柔らかいディテールの余韻、感情が鎮まる慰め' },
    ko: { name: '다정한 힐링', desc: '부드러운 디테일의 여운, 감정이 가라앉는 위로' },
    es: { name: 'Ternura sanadora', desc: 'Detalles suaves con poso, una emoción que se asienta y consuela' },
    ar: { name: 'دفء شافٍ', desc: 'تفاصيل ناعمة ذات أثر وعاطفة تهدأ وتواسي' },
  },
  suspense_tug: {
    ja: { name: '心をつかむサスペンス', desc: '結末未定の地点で観客をつかみ、次へ惹き寄せる' },
    ko: { name: '애끓는 서스펜스', desc: '결말 미정 지점에서 관객을 붙들어 다음으로 견인한다' },
    es: { name: 'Suspenso que tira', desc: 'Sostiene al público en un resultado abierto y le empuja al siguiente tramo' },
    ar: { name: 'تشويق جاذب', desc: 'إمساك المشاهد عند نتيجة معلّقة وشدّه إلى المقطع التالي' },
  },
  tear_angst: {
    ja: { name: '崩壊の切なさ', desc: '犠牲・誤解・親情の共感頂点、具体物で涙を誘う' },
    ko: { name: '무너지는 피폐', desc: '희생·오해·가족애 공감 정점, 구체적 사물로 눈물을 유도한다' },
    es: { name: 'Roto de angustia', desc: 'Picos de empatía por sacrificio, malentendido o parentesco; lágrimas mediante objetos concretos' },
    ar: { name: 'انكسار ووجع', desc: 'ذروات التعاطف مع التضحية أو سوء الفهم أو صلة الدم، والدموع عبر أغراض ملموسة' },
  },
  hype_burn: {
    ja: { name: '灼熱の熱血', desc: '信念の宣言と行動で、感情を燃え上がり点まで押し上げる' },
    ko: { name: '고연 열혈', desc: '신념 선언과 행동으로 감정을 열혈 정점으로 밀어올린다' },
    es: { name: 'Clímax ardiente', desc: 'Credo más acción empujan la emoción a un pico de sangre caliente' },
    ar: { name: 'ذروة ملتهبة', desc: 'إعلان العقيدة مقترناً بالفعل يدفع العاطفة إلى ذروة ملتهبة' },
  },
};

const AXES: Record<string, AxisMap> = { micro: MICRO, payoff: PAYOFF, reversal: REVERSAL, emotion: EMOTION };

/** 单个风味本地化（zh/en 由调用方用原 meta，本函数只服务四扩展语）；缺项回退英文 */
export function localizeFlavor(axis: 'micro' | 'payoff' | 'reversal' | 'emotion', id: string, lang: StrategyUiLang, enFallback: NameDesc): NameDesc {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return enFallback;
  const cell = AXES[axis]?.[id]?.[l];
  return cell ?? enFallback;
}
export function localizeFlavorList(axis: 'micro' | 'payoff' | 'reversal' | 'emotion', list: Array<{ id: string; name: string; desc?: string }>, lang: StrategyUiLang, enMeta: Record<string, NameDesc>) {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return list;
  return list.map((x) => ({ ...x, ...localizeFlavor(axis, x.id, l, enMeta[x.id] ?? { name: x.name, desc: x.desc ?? '' }) }));
}

// —— 框架标签（层/模式/强度/节拍类）——
type L4 = Record<ExtLang, string>;
const LAYER_LABELS: Record<string, L4> = {
  open: {
    ja: 'オープニングフック（黄金3秒）', ko: '오프닝 훅(황금 3초)',
    es: 'Ganchos de apertura (3 segundos de oro)', ar: 'خطافات الافتتاح (الثلاث ثوانٍ الذهبية)',
  },
  episode: {
    ja: 'エピソードフック（頭の引継ぎ／尻の引きで連続視聴）', ko: '회차 훅(도입 연결/회차 끝 끊기로 추격 유도)',
    es: 'Ganchos de episodio (apertura / cliffhanger final para el binge)', ar: 'خطافات الحلقة (افتتاحية/قطع نهاية الحلقة للمتابعة)',
  },
  scene: {
    ja: '場フック（場面間の牽引）', ko: '장면 훅(장면 사이 견인)',
    es: 'Ganchos de escena (tracción entre escenas)', ar: 'خطافات المشهد (الشد بين المشاهد)',
  },
  micro: {
    ja: 'マイクロフック（文レベル：動作／台詞／雰囲気／感情／情報格差／伏線／感覚／小逆転）',
    ko: '마이크로 훅(문장 단위: 동작/대사/분위기/감정/정보격차/복선/감각/소반전)',
    es: 'Micro-ganchos (a nivel de frase: acción/diálogo/atmósfera/emoción/brecha/presagio/sentido/mini-giro)',
    ar: 'خطافات دقيقة (على مستوى الجملة: فعل/حوار/أجواء/عاطفة/فجوة معلومة/تلميح/حاسة/انقلاب صغير)',
  },
};
const BEAT_KIND_LABELS: Record<string, L4> = {
  reversal: { ja: '逆転ビート', ko: '반전 비트', es: 'Beats de giro', ar: 'إيقاعات الانقلاب' },
  payoff: { ja: 'カタルシスビート', ko: '쾌감 비트', es: 'Beats de recompensa', ar: 'إيقاعات النشوة' },
  emotion: { ja: '感情ビート', ko: '감정 비트', es: 'Beats emocionales', ar: 'إيقاعات عاطفية' },
};
const CUE_MODES: Record<string, Record<ExtLang, NameDesc>> = {
  auto: {
    ja: { name: 'スマート自動', desc: '題材とリズムで配置・ローテし倦怠を回避（既定）' },
    ko: { name: '스마트 자동', desc: '소재와 리듬으로 배치·순환해 피로를 회피(기본)' },
    es: { name: 'Auto inteligente', desc: 'El sistema organiza y rota por género y ritmo para evitar fatiga (por defecto)' },
    ar: { name: 'تلقائي ذكي', desc: 'يوزّع النظام ويُناوب حسب النوع والإيقاع لتفادي الملل (افتراضي)' },
  },
  manual: {
    ja: { name: '手動指定', desc: '各位置のフック種を自分で一つずつ指定' },
    ko: { name: '직접 지정', desc: '모든 위치의 훅 유형을 직접 하나씩 지정' },
    es: { name: 'Yo elijo', desc: 'Especifica el tipo de gancho en cada posición, una por una' },
    ar: { name: 'أنا أختار', desc: 'تحدد نوع الخطافة في كل موضع يدوياً واحداً واحداً' },
  },
  hybrid: {
    ja: { name: 'ハイブリッド', desc: '指定を優先し、残りの位置をシステムが補完' },
    ko: { name: '하이브리드', desc: '지정을 우선하고 나머지 위치를 시스템이 보완' },
    es: { name: 'Híbrido', desc: 'Tu elección manda; el sistema completa el resto de posiciones' },
    ar: { name: 'هجين', desc: 'اختيارك أولاً ويكمل النظام المواضع المتبقية' },
  },
};
const STRENGTHS: Record<string, Record<ExtLang, NameDesc>> = {
  relax: {
    ja: { name: '疎らで余白', desc: 'フック薄め、雰囲気と余白を重視' },
    ko: { name: '드문드문 여백', desc: '훅을 드물게, 분위기와 여백 중시' },
    es: { name: 'Espaciado y respirado', desc: 'Pocos ganchos, énfasis en atmósfera y respiración' },
    ar: { name: 'متخلخل ومتنفس', desc: 'خطافات قليلة مع تركيز على الأجواء ومساحات التنفس' },
  },
  balanced: {
    ja: { name: '均衡', desc: '緊と緩を交代、万能の選択' },
    ko: { name: '균형', desc: '완급을 교차, 만능 선택' },
    es: { name: 'Equilibrado', desc: 'Alterna tensión y distensión; la opción universal' },
    ar: { name: 'متوازن', desc: 'تناوب الشد والرخي؛ الخيار العام' },
  },
  tight: {
    ja: { name: '高密度フック', desc: '毎場面にフック、微フック密集、強い連続視聴' },
    ko: { name: '고밀도 훅', desc: '장면마다 훅, 마이크로 훅 집약, 강한 추격 시청' },
    es: { name: 'Ganchos de alta densidad', desc: 'Un gancho en cada escena, micro-ganchos densos, fuerte binge' },
    ar: { name: 'كثافة عالية من الخطافات', desc: 'خطافة في كل مشهد وخطافات دقيقة مكثفة لشد المتابعة' },
  },
};

export function localizeLabel(table: 'layer' | 'beatKind' | 'cueMode' | 'strength', id: string, lang: StrategyUiLang, zhEn: { name: string; desc?: string }): { name: string; desc?: string } {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return zhEn;
  const map = table === 'layer' ? LAYER_LABELS : table === 'beatKind' ? BEAT_KIND_LABELS : table === 'cueMode' ? CUE_MODES : STRENGTHS;
  const cell = (map as Record<string, any>)[id]?.[l];
  if (!cell) return zhEn;
  return typeof cell === 'string' ? { name: cell } : cell;
}

/** 覆盖度自检：20 风味 × 4 语 name+desc 必须齐全 */
export function flavorI18nCoverage(): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  for (const [axis, m] of Object.entries(AXES)) {
    for (const id of Object.keys(m)) {
      for (const l of EXT) {
        const c = m[id][l];
        if (!c?.name || !c?.desc) missing.push(`${axis}:${id}/${l}`);
        else covered++;
      }
    }
  }
  return { missing, covered };
}
