/**
 * v2.44 五套策略卡多语平移（ja/ko/es/ar）
 * 仅做"展示层"本地化：策略 id、推荐算法、进入管线的 directive 全部不动（管线指令保持 zh/en），
 * 只把用户看得到的卡片 name/tagline 与推荐理由翻成目标语言；缺译时按 en→zh 回退，绝不返回空。
 * 覆盖：钩子5 + 节奏5 + 台词5 + 情绪5 + 人物5 = 30 卡 × 4 语。
 */
export type StrategyUiLang = 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'ar';
export const STRATEGY_UI_LANGS: StrategyUiLang[] = ['zh', 'en', 'ja', 'ko', 'es', 'ar'];
const EXT_LANGS = ['ja', 'ko', 'es', 'ar'] as const;
type ExtLang = typeof EXT_LANGS[number];
export function isStrategyUiLang(x: unknown): x is StrategyUiLang {
  return typeof x === 'string' && (STRATEGY_UI_LANGS as string[]).includes(x);
}
/** 归一化：合法六语原样返回，否则回退 zh */
export function normalizeUiLang(x: unknown): StrategyUiLang { return isStrategyUiLang(x) ? x : 'zh'; }

interface Loc { name: string; tagline: string }
type ExtMap = Record<ExtLang, Loc>;

// key = family:id（hook/pace/dialogue/emotion/character）
const I18N: Record<string, ExtMap> = {
  // —— 钩子策略 5 ——
  'hook:balanced': {
    ja: { name: 'バランス標準流', tagline: '緩急をつけフックと余白を均衡させた、最も無難な万能選択' },
    ko: { name: '균형 표준류', tagline: '완급과 여백의 균형, 가장 안전한 만능 선택' },
    es: { name: 'Equilibrio estándar', tagline: 'Tensión y respiración equilibradas: la opción universal más segura' },
    ar: { name: 'التوازن القياسي', tagline: 'شد وجذب متوازن مع مساحات تنفس—الخيار العام الأكثر أمانًا' },
  },
  'hook:dense': {
    ja: { name: 'フック高密度流', tagline: '冒頭から衝突、毎場面で牽引、切り返しを強め完視聴と追っかけを最大化' },
    ko: { name: '훅 고밀도류', tagline: '시작부터 갈등, 장면마다 견인, 강한 끊기로 완시청과 추격을 극대화' },
    es: { name: 'Ganchos densos', tagline: 'Arranca en conflicto, cada escena tira del hilo con cortes más duros: retención máxima' },
    ar: { name: 'خطافات مكثفة', tagline: 'افتتاح بالصراع وشد في كل مشهد ونهايات قاطعة أقوى—تعظيم الإكمال والمتابعة' },
  },
  'hook:suspense': {
    ja: { name: 'サスペンス牽引流', tagline: '問い先行、伏線連鎖、明かす寸前で集を終え答えへと惹きつける' },
    ko: { name: '서스펜스 견인류', tagline: '질문 선행, 복선 연쇄, 밝히기 직전에 끝내 답으로 끌어당기기' },
    es: { name: 'Suspense', tagline: 'Preguntas primero, pistas encadenadas, cortes antes de la revelación que tiran hacia la respuesta' },
    ar: { name: 'تشويق', tagline: 'أسئلة أولاً وتلميحات متسلسلة وقطع قبل الكشف لشد المشاهد نحو الإجابة' },
  },
  'hook:emotion': {
    ja: { name: '没入型感情流', tagline: '感情の器と台詞の裏で進め、集尾は感情ピークで、共感で残す' },
    ko: { name: '감정 몰입류', tagline: '감정 매개와 함의로 전개, 회차 끝은 감정 정점에서, 공감으로 잔류' },
    es: { name: 'Inmersión emocional', tagline: 'Avanza con portadores emocionales y subtexto; cierra en pico emocional y retiene por empatía' },
    ar: { name: 'انغماس عاطفي', tagline: 'التقدم عبر الناقلات العاطفية والمعنى الضمني، وإنهاء عند الذروة والبقاء بالتعاطف' },
  },
  'hook:premium': {
    ja: { name: 'プレミアム慢熱流', tagline: '強い切り返しを減らし雰囲気と質感の微フックで残す、余白多めで上質' },
    ko: { name: '프리미엄 완열류', tagline: '강한 끊기를 줄이고 분위기와 질감의 미세한 훅으로 잔류, 여백이 많고 고급' },
    es: { name: 'Slow-burn premium', tagline: 'Menos cliffhangers duros; retiene con atmósfera y micro-ganchos de textura, más respiración y elegancia' },
    ar: { name: 'احتراق بطيء راقٍ', tagline: 'تقليل القطعات الحادة والبقاء بالأجواء والخطافات الدقيقة ومساحات أوسع ولمسة أرقى' },
  },
  // —— 节奏策略 5 ——
  'pace:standard': {
    ja: { name: '標準テンポ流', tagline: '衝突と余白のバランス、1集に小さな起伏が一つ、最も汎用的' },
    ko: { name: '표준 완급류', tagline: '갈등과 여백 균형, 한 화에 작은 기복 하나, 가장 범용적' },
    es: { name: 'Ritmo estándar', tagline: 'Conflicto y respiración equilibrados, un pequeño arco por episodio: el más versátil' },
    ar: { name: 'إيقاع قياسي', tagline: 'توازن بين الصراع والتنفس ومنحنى صغير لكل حلقة—الأكثر عمومية' },
  },
  'pace:fastcut': {
    ja: { name: '高速カット流', tagline: '短場面・早い切替・衝突連鎖で爽感と完視聴を最大化' },
    ko: { name: '빠른 컷류', tagline: '짧은 장면, 빠른 전환, 갈등 연쇄로 쾌감과 완시청 극대화' },
    es: { name: 'Cortes rápidos', tagline: 'Escenas cortas, cambios veloces, conflicto encadenado: máxima satisfacción y completado' },
    ar: { name: 'قص سريع', tagline: 'مشاهد قصيرة وتبديل سريع وصراع متسلسل—تعظيم النشوة والإكمال' },
  },
  'pace:suspense_burn': {
    ja: { name: 'サスペンス漸進流', tagline: '場面ごとに情報を小出し、圧力を積み上げ答えへ惹きつける' },
    ko: { name: '서스펜스 점진류', tagline: '장면마다 정보를 조금씩, 압력을 층층이 쌓아 답으로 견인' },
    es: { name: 'Escalada de suspense', tagline: 'Información dosificada por escena y presión creciente que atrae hacia la respuesta' },
    ar: { name: 'تصعيد التشويق', tagline: 'إطلاق المعلومة مشهداً بمشهد وضغط متصاعد يشد نحو الإجابة' },
  },
  'pace:emotional_wave': {
    ja: { name: '感情の波流', tagline: '感情に起伏をつけ抑えてから解放、共感と涙の沈殿を残す' },
    ko: { name: '감정 파동류', tagline: '감정에 기복을, 누른 뒤 해방, 공감과 눈물의 침전을 확보' },
    es: { name: 'Ola emocional', tagline: 'Subidas y bajadas, presionar para luego liberar; deja asentar la empatía y el llanto' },
    ar: { name: 'موجة عاطفية', tagline: 'صعود وهبوط وكبت ثم إطلاق، مع إفساح المجال للتعاطف والدموع' },
  },
  'pace:cinematic': {
    ja: { name: 'シネマ慢板流', tagline: '長場面・雰囲気の醸成・抑制された卡点、質感と余韻で残す' },
    ko: { name: '시네마 완판류', tagline: '긴 장면, 분위기 조성, 절제된 끊기, 질감과 여운으로 잔류' },
    es: { name: 'Lentitud cinematográfica', tagline: 'Escenas largas, construcción atmosférica, ganchos contenidos; retiene por textura y poso' },
    ar: { name: 'إيقاع سينمائي', tagline: 'مشاهد طويلة وبناء أجواء وقطعات مضبوطة، البقاء بالملمس والأثر' },
  },
  // —— 台词策略 5 ——
  'dialogue:natural': {
    ja: { name: '自然な口語', tagline: '本物の人の話し方、途切れや口語助詞を許容、万能デフォルト' },
    ko: { name: '자연 구어', tagline: '진짜 사람 말투, 끊김과 구어 조사 허용, 만능 기본' },
    es: { name: 'Hablado natural', tagline: 'Voz humana real con frases rotas y muletillas: el comodín por defecto' },
    ar: { name: 'منطوق طبيعي', tagline: 'كلام بشري حقيقي مع جمل متقطعة وأدوات لفظية—الافتراضي العام' },
  },
  'dialogue:street': {
    ja: { name: '市井の活気', tagline: '高い口語度、生活のザラつきと土地の味、地に足のついた表現' },
    ko: { name: '서민 생활감', tagline: '높은 구어도, 생활의 거친 느낌과 지역맛, 현장 밀착' },
    es: { name: 'Calle y barrio', tagline: 'Muy coloquial, textura cotidiana áspera y sabor local, pegado a la calle' },
    ar: { name: 'شارع شعبي', tagline: 'عامية عالية وملمس حياتي خشن ونكهة محلية، قريب من الأرض' },
  },
  'dialogue:sharp': {
    ja: { name: '鋭い機鋒', tagline: '短く打ち合い、言外の意味、一語ごとに効かせる' },
    ko: { name: '날카로운 기봉', tagline: '짧은 주고받기, 말속뜻, 한마디 한마디를 유효하게' },
    es: { name: 'Filo y subtexto', tagline: 'Intercambios cortos, doble sentido, cada frase golpea' },
    ar: { name: 'حدّة وتلميح', tagline: 'تبادل قصير ومعانٍ ضمنية، كل جملة تصيب' },
  },
  'dialogue:elegant': {
    ja: { name: '抑制と端正', tagline: '言葉を選び比較的整った文体、時代劇とエリート場面に' },
    ko: { name: '절제와 정연', tagline: '단어를 가려 비교적 정돈된 문체, 시대극과 엘리트 장면에' },
    es: { name: 'Contenido y pulcro', tagline: 'Palabras cuidadas y registro relativamente formal para época y entornos de élite' },
    ar: { name: 'ضبط وأناقة', tagline: 'مفردات منتقاة وصياغة رسمية نسبية، للدراما التاريخية وأوساط النخبة' },
  },
  'dialogue:youthful': {
    ja: { name: 'ネット世代', tagline: '軽快でネタ感、ツッコミ強め、若者の語感に合わせる' },
    ko: { name: 'MZ 감각', tagline: '가볍고 밈 감각, 태클 강함, 젊은 시청자 어감에 부합' },
    es: { name: 'Nativo digital', tagline: 'Ligero, con memes y mala leche cariñosa, afinado al habla joven' },
    ar: { name: 'لغة الشباب الرقمية', tagline: 'خفيف ومفعم بالميمات والانتقاد المرح، مضبوط على لسان الشباب' },
  },
  // —— 情绪策略 5 ——
  'emotion:balanced': {
    ja: { name: 'バランス叙事', tagline: '爽点・逆転・感情の起伏を均等配分、最も汎用的' },
    ko: { name: '균형 서사', tagline: '쾌점·반전·감정 기복을 고르게 배분, 가장 범용적' },
    es: { name: 'Arco equilibrado', tagline: 'Mezcla pareja de recompensa, giro y emoción: el más versátil' },
    ar: { name: 'سرد متوازن', tagline: 'توزيع متساوٍ لنقاط النشوة والانقلاب والعاطفة—الأكثر عمومية' },
  },
  'emotion:payoff_dense': {
    ja: { name: '快感高密度', tagline: 'ざまあと逆転を連鎖、鬱屈を圧縮し早めに報いる' },
    ko: { name: '쾌감 고밀도', tagline: '사이다 반전 연쇄, 억눌림을 압축해 빠르게 보상' },
    es: { name: 'Recompensa densa', tagline: 'Giro y revancha encadenados; se comprime la frustración y se paga pronto' },
    ar: { name: 'نشوة مكثفة', tagline: 'صفعات وانقلابات متسلسلة وضغط المكابدة ثم مكافأة سريعة' },
  },
  'emotion:angst_tug': {
    ja: { name: '切なさの牽引', tagline: '誤解と後悔を層にし解放は控えめ、涙を誘う' },
    ko: { name: '피폐 견인', tagline: '오해와 후회를 층층이, 해방은 자제, 눈물을 유도' },
    es: { name: 'Angustia', tagline: 'Malentendidos y arrepentimientos en capas, liberación contenida: hace llorar' },
    ar: { name: 'وجد وشدة', tagline: 'سوء فهم وندم بطبقات وإطلاق مضبوط، استدرار للدموع' },
  },
  'emotion:sweet_heal': {
    ja: { name: '甘く癒やし', tagline: '高糖度と優しい癒やし中心、衝突は軽く温もり多め' },
    ko: { name: '달콤 힐링', tagline: '고당도와 다정한 힐링 중심, 갈등은 가볍고 온기 충분' },
    es: { name: 'Dulce sanador', tagline: 'Dulzor alto y cura tierna; conflicto ligero, mucho calor' },
    ar: { name: 'حلوٍ شافٍ', tagline: 'حلاوة عالية وشفاء لطيف وصراع خفيف ودفء وافر' },
  },
  'emotion:twist_puzzle': {
    ja: { name: '逆転パズル', tagline: '情報格差と認識の逆転で駆動、結末で必ず台を返す' },
    ko: { name: '반전 퍼즐', tagline: '정보격차와 인식 반전으로 구동, 결말에서 반드시 판을 엎음' },
    es: { name: 'Giro y enigma', tagline: 'Movido por brechas de información y reversiones cognitivas; el final voltea la mesa' },
    ar: { name: 'انقلاب وأحجية', tagline: 'مدفوع بفجوة المعلومة وانقلاب الإدراك، والنهاية تقلب الطاولة حتماً' },
  },
  // —— 人物策略 5 ——
  'character:grounded': {
    ja: { name: '立体的で真実', tagline: '隠れた設定が下支え、行動に動機、脇役にも人生あり、万能' },
    ko: { name: '입체적 실재', tagline: '숨은 설정이 받침, 행동에 동기, 조역에게도 삶 있음, 만능' },
    es: { name: 'Verosímil y real', tagline: 'Trasfondo oculto que motiva la conducta; hasta los secundarios tienen vida: comodín' },
    ar: { name: 'واقعي مجسّد', tagline: 'خلفية خفية تمنح الدوافع، حتى الأدوار الثانوية تعيش حياتها—خيار عام' },
  },
  'character:contrast': {
    ja: { name: '極限のギャップ', tagline: '表裏・身分・予期の三重ギャップ、開始から記憶に残る爽劇フック' },
    ko: { name: '극한 반차', tagline: '표리·신분·예기의 삼중 반차, 시작부터 각인되는 사극 훅' },
    es: { name: 'Contraste extremo', tagline: 'Triple contraste (apariencia/interior, identidad, expectativa): gancho instantáneo para el power-fantasy' },
    ar: { name: 'تباين حاد', tagline: 'تباين ثلاثي (الظاهر/الباطن والهوية والتوقع)—خطافة فورية لدراما الانتقام والقوة' },
  },
  'character:bond_dynamic': {
    ja: { name: '関係の牽引', tagline: '関係そのものがエンジン：双強の駆け引き・喧嘩するほど仲がいい・愛憎' },
    ko: { name: '관계 견인', tagline: '관계 자체가 엔진: 쌍강의 밀당, 티격태격, 애증' },
    es: { name: 'Vínculo y fricción', tagline: 'La relación es el motor: dos protagonistas fuertes, del roce al cariño, amor-odio' },
    ar: { name: 'شد العلاقة', tagline: 'العلاقة نفسها محرّك: قويّان يتلاعبان، خصمان يتحابان، حب وكراهية' },
  },
  'character:ensemble': {
    ja: { name: '群像併立', tagline: '複数主線が各々弧を描き機能重複なく関係網を織る' },
    ko: { name: '군상 병립', tagline: '여러 주선이 각자 호를 그리고 기능 중복 없이 관계망을 직조' },
    es: { name: 'Reparto coral', tagline: 'Varios protagonistas con arcos propios y funciones no solapadas tejidos en una red' },
    ar: { name: 'جوقة أدوار', tagline: 'خطوط رئيسية متعددة بأقواس متميزة وأدوار غير متداخلة، منسوجة في شبكة علاقات' },
  },
  'character:growth_arc': {
    ja: { name: '成長と変貌', tagline: '欠陥→契機→試練→変貌、弧そのものが主線' },
    ko: { name: '성장 탈변', tagline: '결함→계기→시련→탈변, 호 자체가 주선' },
    es: { name: 'Arco de crecimiento', tagline: 'Defecto→detonante→prueba→transformación; el arco es la línea principal' },
    ar: { name: 'قوس النمو', tagline: 'عيب→محفّز→محنة→تحوّل، والقوس نفسه هو الخط الرئيسي' },
  },
};

export type StrategyCardLike = { id: string; name: string; nameEn?: string; tagline: string; taglineEn?: string; [k: string]: unknown };

/** 把一张 zh/en 卡片按目标语替换 name/tagline；其余字段原样保留（fit 等在 ja/ko/es/ar 下回退英文） */
export function localizeCard(family: string, card: StrategyCardLike, lang: StrategyUiLang): StrategyCardLike {
  if (lang === 'zh' || lang === 'en') return card;
  const m = I18N[`${family}:${card.id}`]?.[lang];
  if (!m) {
    // 缺译回退：非拉丁语优先英文，保证不空
    return { ...card, name: card.nameEn || card.name, tagline: card.taglineEn || card.tagline };
  }
  return { ...card, name: m.name, tagline: m.tagline };
}

export function localizeList(family: string, list: StrategyCardLike[], lang: StrategyUiLang): StrategyCardLike[] {
  return list.map((c) => localizeCard(family, c, lang));
}

// 推荐理由模板：auto=true 为"未识别强信号默认"，false 为"按题材默认"，{n}=本地化卡名、{t}=tagline
const REASON_TPL: Record<ExtLang, { auto: string; byGenre: string; switch: string }> = {
  ja: { auto: '強い偏りを検出できないため「{n}」を既定にします：{t}。', byGenre: '題材から「{n}」を既定提案します：{t}（いつでも変更可）。', switch: '（いつでも切り替え可能）' },
  ko: { auto: '뚜렷한 편향이 없어 「{n}」을(를) 기본으로 합니다: {t}.', byGenre: '소재에 따라 「{n}」을(를) 기본 제안합니다: {t}(언제든 전환 가능).', switch: '(언제든 전환 가능)' },
  es: { auto: 'Sin una señal clara, se usa «{n}» por defecto: {t}.', byGenre: 'Según el género, se propone «{n}» por defecto: {t} (puedes cambiarlo cuando quieras).', switch: '(puedes cambiarlo cuando quieras)' },
  ar: { auto: 'بدون إشارة قوية، الافتراضي هو «{n}»: {t}.', byGenre: 'وفق النوع، الاقتراح الافتراضي هو «{n}»: {t} (يمكنك التبديل في أي وقت).', switch: '(يمكنك التبديل في أي وقت)' },
};

/** 生成本地化推荐理由；zh/en 由调用方既有 reason/reasonEn 提供，本函数只服务四扩展语 */
export function localizeReason(lang: StrategyUiLang, card: { name: string; tagline: string }, auto: boolean): string {
  if (lang === 'zh' || lang === 'en') return '';
  const tpl = REASON_TPL[lang];
  const raw = auto ? tpl.auto : tpl.byGenre;
  return raw.replace('{n}', card.name).replace('{t}', card.tagline);
}

/** 覆盖完整性自检（供测试/后台体检）：返回缺失的 family:id/lang 格 */
export function strategyI18nCoverage(expected: Record<string, string[]>): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  for (const [family, ids] of Object.entries(expected)) {
    for (const id of ids) {
      for (const l of EXT_LANGS) {
        const cell = I18N[`${family}:${id}`]?.[l];
        if (!cell || !cell.name || !cell.tagline) missing.push(`${family}:${id}/${l}`);
        else covered++;
      }
    }
  }
  return { missing, covered };
}
