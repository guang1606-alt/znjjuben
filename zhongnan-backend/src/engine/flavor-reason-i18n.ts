/**
 * v2.48 四轴风味推荐「理由句」四语（ja/ko/es/ar）平移
 * 规则名与 flavor-recommender.ts RULES[].name / 'fallback' 对齐；
 * 推荐算法、zh/en 理由不动，仅展示层本地化；缺译回退英文，绝不空。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';
const REASONS: Record<string, Record<ExtLang, string>> = {
  revenge: {
    ja: '復讐線は「溜める—探る—爆発」。情報格差と含み台詞を多用し、真相暴露と現証返り討ちで即応え、感情は先抑後放、破防を添えてもよい。',
    ko: '복수선은 ‘누르기-추적-폭발’. 정보격차와 함의 대사를 많이 쓰고 진실 폭로+현장 반증으로 즉시 응답, 감정은 먼저 누르고 나중에 풀며 눈물 포인트를 곁들여도 된다.',
    es: 'El arco de venganza sigue «presionar-investigar-detonar»: usa brecha informativa y subtexto, cobra con verdad y desmentida en el acto, suprime primero y libera después (con algo de angustia).',
    ar: 'خط الانتقام يسير «كبّت-تحرَّ-انفجر»: اعتمد على فجوة المعلومة والنص الضمني، وحصّل بكشف الحقيقة والصفعة الفورية، اكبس العاطفة أولاً ثم أطلقها مع لمسة انكسار.',
  },
  sweet: {
    ja: '甘宠・恋愛は含み台詞と感情マイクロフックを重視、爽点は双方向の甘い応え、感情は温情回甘を中心に。',
    ko: '달콤 로맨스는 함의 대사와 감정 마이크로 훅을 중시하고, 쾌점은 쌍방의 달콤한 응답, 감정은 온정 여운 중심.',
    es: 'El romance dulce prioriza subtexto y micro-ganchos emocionales; la recompensa es la respuesta mutua cálida y la emoción deja un regusto tierno.',
    ar: 'الرومانسية الحلوة تركّز على النص الضمني والخطافات العاطفية الدقيقة؛ الإشباع استجابة متبادلة دافئة والعاطفة تترك أثراً حنوناً.',
  },
  angst: {
    ja: '虐心は破防涙点を感情主軸に、感情/言語マイクロフックで溜め、関係立場反転ですれ違いを作る。',
    ko: '피폐물은 눈물 포인트를 감정 중심축으로, 감정/대사 마이크로 훅으로 축적하고 관계 입장 반전으로 어긋남을 만든다.',
    es: 'El drama angustiado toma el punto de llanto como eje, carga con ganchos de emoción/diálogo y crea el desencuentro con giros de relación.',
    ar: 'الدراما الموجعة تجعل نقطة الانكسار بالدمع محورها العاطفي، تشحن بخطافات عاطفية/حوارية وتصنع الفقد بانقلاب العلاقة والموقف.',
  },
  mystery: {
    ja: 'サスペンスは雰囲気/情報格差/伏線マイクロフックで惹き、主反転は真相因果と認識顛覆、感情は揪心懸念を維持。',
    ko: '서스펜스는 분위기/정보격차/복선 마이크로 훅으로 잡고, 주 반전은 인과 진실과 인식 전복, 감정은 애절한 서스펜스 유지.',
    es: 'El misterio engancha con atmósfera/brecha/presagio, el giro principal es causal-cognitivo y la emoción mantiene el suspenso angustiante.',
    ar: 'التشويق يشدّ بالأجواء/فجوة المعلومة/التلميح، الانقلاب الرئيسي سببي-معرفي، والعاطفة تبقى في تشويق قابض.',
  },
  underdog: {
    ja: '下克上の現証返り討ちは動作+言語マイクロフック、爽点を密に現証と身分・実力制圧で、身分/強弱反転と抑圧後解放を添える。',
    ko: '역습 현장반증은 동작+대사 마이크로 훅, 쾌점을 촘촘히 현장 반증과 신분·실력 제압으로, 신분/강약 반전과 억압 후 해방을 곁들인다.',
    es: 'La remontada del menospreciado usa ganchos de acción/diálogo, recompensas densas de desmentida y aplastamiento por estatus/capacidad, con giro de identidad/fuerza y liberación tras la opresión.',
    ar: 'عودة المُحتقَر تستخدم خطافات الفعل/الحوار، وإشباعاً كثيفاً بالصفعة والقمع بالمنصب/الكفاءة، مع انقلاب الهوية/القوة وانفلات بعد الكبت.',
  },
  comedy: {
    ja: '喜劇は言語と動作マイクロフックで笑いを作り、爽点は願望代償の発散、軽快テンポで即時解放。',
    ko: '코미디는 대사와 동작 마이크로 훅으로 웃음을 만들고, 쾌점은 대리 만족 해소, 경쾌한 템포로 즉각 해방.',
    es: 'La comedia construye el chiste con ganchos de diálogo/acción, recompensas de satisfacción vicaria, ritmo ligero y liberación inmediata.',
    ar: 'الكوميديا تصنع النكتة بخطافات الحوار/الفعل، وإشباع رغبة بالإنابة، بإيقاع خفيف وتحرير فوري.',
  },
  family: {
    ja: '家庭親情は感情と生活雰囲気マイクロフックを重視、真相帰位で対立を解き、涙点と温情回甘を交互に。',
    ko: '가족애는 감정과 생활 분위기 마이크로 훅을 중시하고, 진실 귀위로 갈등을 풀며 눈물 포인트와 온정 여운을 번갈아.',
    es: 'El drama familiar prioriza ganchos de emoción y atmósfera cotidiana; la verdad restablecida resuelve el conflicto, alternando llanto y calidez.',
    ar: 'الدراما العائلية تركّز على خطافات العاطفة وأجواء الحياة اليومية؛ الحقيقة المستعادة تحلّ الصراع، بالتناوب بين نقطة الدمع والأثر الحنون.',
  },
  workplace: {
    ja: '職場/業界劇は台詞の応酬と動作で推進、逆転+実力制圧で爽感、関係立場反転で派閥闘争を作る。',
    ko: '직장/업계극은 대사 격돌과 동작으로 추진하고, 역전+실력 제압으로 쾌감, 관계 입장 반전으로 편가르기 싸움을 만든다.',
    es: 'El drama laboral avanza con duelos verbales y acción; remontada y aplastamiento por competencia dan satisfacción, el giro de postura crea política de bandos.',
    ar: 'الدراما المهنية تتقدم بصدام الحوار والفعل؛ العودة والسحق بالكفاءة يمنحان النشوة، وانقلاب الموقف يصنع لعبة المحاور.',
  },
  hype: {
    ja: '高燃熱血は動作マイクロフック中心、実力制圧で爽味、感情を高燃点まで押し上げ、身分反転を添えてもよい。',
    ko: '고연 열혈은 동작 마이크로 훅 중심, 실력 제압으로 쾌감, 감정을 고연 포인트로 밀어올리고 신분 반전을 곁들여도 된다.',
    es: 'El relato ardiente se centra en ganchos de acción, aplasta por competencia, empuja la emoción al punto épico y puede añadir un giro de identidad.',
    ar: 'العمل الحماسي يدور حول خطافات الفعل، يسحق بالكفاءة، يدفع العاطفة إلى نقطة الحماس وقد يضيف انقلاب الهوية.',
  },
  transmigrate: {
    ja: '穿越/重生/系統流は伏線と情報格差（観客は知り人物は知らない）で優位を作り、認識顛覆+身分反転、チート資源で形勢を変える。',
    ko: '빙의/회귀/시스템물은 복선과 정보격차(관객만 앎)로 우위를 만들고 인식 전복+신분 반전, 치트 자원으로 판세를 바꾼다.',
    es: 'Renacimiento/isekai/sistema usa presagio e ironía dramática para la ventaja, giros cognitivos/de identidad y recursos «trampa» que cambian el poder.',
    ar: 'الانتقال/الولادة الثانية/النظام يصنع التفوّق بالتلميح والمفارقة الدرامية (الجمهور يعلم والشخصية تجهل)، بانقلاب معرفي/هوية وموارد خارقة تغيّر الموازين.',
  },
  travel: {
    ja: '文旅/無形文化遺産/美食は雰囲気感官と感情マイクロフックで在地の烟火を描き、感情は治愈回甘で。',
    ko: '문화관광/무형문화유산/미식은 분위기 감각과 감정 마이크로 훅으로 현지의 삶의 온기를 그리고 감정은 치유 여운으로.',
    es: 'Viajes/patrimonio/gastronomía muestran el sabor local con ganchos sensoriales y emocionales, en tono sanador y cálido.',
    ar: 'السياحة الثقافية/التراث/الطعام يرسم دفء المكان بخطافات حسية وعاطفية، بعاطفة شافية حنونة.',
  },
  meta: {
    ja: '戯中戯/メタ叙事は情報格差と伏線マイクロフックで観客に「套層を見抜かせ」、主反転は認識顛覆と真相帰位、感情は「二層がいつ撞破するか」の揪心懸念を維持。',
    ko: '극중극/메타 서사는 정보격차와 복선 훅으로 관객이 ‘겹층을 꿰뚫어보게’ 하고, 주 반전은 인식 전복과 진실 귀위, 감정은 ‘두 층이 언제 들통나나’ 애절한 서스펜스 유지.',
    es: 'La metaficción usa brecha/presagio para que el público vea las capas; el giro es cognitivo y de verdad, y la emoción mantiene el suspenso de cuándo chocarán ambos niveles.',
    ar: 'ما وراء القصة يجعل الجمهور يرى الطبقات المتداخلة عبر فجوة المعلومة والتلميح؛ الانقلاب معرفي وكاشف للحقيقة، وتبقى العاطفة في تشويق: متى تتصادم الطبقتان؟',
  },
  fantasy: {
    ja: '玄幻/科幻は動作と宏大雰囲気マイクロフックで世界観を立て、認識顛覆で設定を反転、高燃で昇級を推進。',
    ko: '현환/SF는 동작과 웅장한 분위기 마이크로 훅으로 세계관을 세우고 인식 전복으로 설정을 뒤집으며, 고연으로 성장을 추진.',
    es: 'Fantasía/ciencia ficción erige el mundo con ganchos de acción y atmósfera épica, invierte el planteamiento con un giro cognitivo y avanza con ardor hacia la progresión.',
    ar: 'الفانتازيا/الخيال العلمي يبني العالم بخطافات الفعل والأجواء الملحمية، يقلب الفرضية بانقلاب معرفي ويدفع التصعيد بحماس.',
  },
  fallback: {
    ja: '題材の特徴が薄いので、まず「言語+雰囲気マイクロフック、現証+逆転爽点、身分反転、抑圧後解放」の均衡構成から始め、手動で微調整できる。',
    ko: '장르 특징이 약하므로 우선 ‘대사+분위기 마이크로 훅, 현장반증+역전 쾌점, 신분 반전, 억압 후 해방’의 균형 조합으로 시작하고 수동으로 미세 조정 가능.',
    es: 'La señal de género es débil: parte de una mezcla equilibrada (ganchos de diálogo+atmósfera, recompensas de desmentida+remontada, giro de identidad, liberación tras opresión) y ajústala a mano.',
    ar: 'إشارة النوع ضعيفة: ابدأ بتشكيلة متوازنة (خطافات حوار+أجواء، إشباع صفعة+عودة، انقلاب هوية، تحرير بعد كبت) ثم اضبطها يدوياً.',
  },
};

export const FLAVOR_REASON_KEYS = Object.keys(REASONS);

/**
 * 推荐理由本地化：命中规则名与理由按顺序对齐；无命中（matched 空）走 fallback。
 * zh 返回 zh、en 返回 en；其余四语取字典，缺译回退英文。
 */
export function localizeFlavorReasons(matched: string[], reasons: { zh: string; en: string }[], lang: StrategyUiLang): string[] {
  const l = normalizeUiLang(lang);
  if (l === 'zh') return reasons.map((r) => r.zh);
  if (l === 'en') return reasons.map((r) => r.en);
  const keys = matched.length ? matched : ['fallback'];
  return reasons.map((r, i) => {
    const key = keys[i] ?? 'fallback';
    return REASONS[key]?.[l] ?? r.en;
  });
}

export function flavorReasonCoverage(): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  for (const k of FLAVOR_REASON_KEYS) {
    for (const l of ['ja', 'ko', 'es', 'ar'] as ExtLang[]) {
      if (!REASONS[k]?.[l]) missing.push(`${k}/${l}`);
      else covered++;
    }
  }
  return { missing, covered };
}
