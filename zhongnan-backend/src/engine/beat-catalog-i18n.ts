/**
 * v2.47 26 个具体节拍（反转8/爽点10/情绪8）的四语（ja/ko/es/ar）完整平移：name/definition/example
 * 原则同 hook-catalog-i18n：仅展示层本地化；进管线的 technique 保持 zh/en；缺译回退英文，绝不空。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';
export interface BeatLoc { name: string; definition: string; example: string }
type BeatLocMap = Record<ExtLang, BeatLoc>;

const CATALOG: Record<string, BeatLocMap> = {
  rev_identity: {
    ja: { name: '身分反転', definition: '真の身分と見せかけの身分のズレが明かされる', example: '嫌がらせを受けていた清掃員が、実は会社の筆頭株主だった' },
    ko: { name: '신분 반전', definition: '실제 신분과 겉신분의 어긋남이 드러남', example: '구박받던 청소부가 알고 보니 회사 지배주주' },
    es: { name: 'Giro de identidad', definition: 'Se revela el desfase entre identidad real y aparente', example: 'La limpiadora humillada resulta ser la accionista de control' },
    ar: { name: 'انقلاب الهوية', definition: 'يُكشف التباين بين الهوية الحقيقية والظاهرة', example: 'عاملة النظافة المُحتقَرة هي في الحقيقة صاحبة حصة السيطرة في الشركة' },
  },
  rev_stance: {
    ja: { name: '立場反転', definition: '同一人物の立場が180度変わる', example: '彼女を支えていた人が、古い借り一つで突然寝返る' },
    ko: { name: '입장 반전', definition: '같은 인물의 입장이 180도 전환', example: '그녀를 지지하던 사람이 옛 빚 하나에 갑자기 등을 돌린다' },
    es: { name: 'Giro de postura', definition: 'Un mismo personaje cambia de bando por completo', example: 'Quien la defendía se vuelve en contra por una vieja deuda' },
    ar: { name: 'انقلاب الموقف', definition: 'يغيّر الشخص ذاته موقفه مئة وثمانين درجة', example: 'من كان يساندها ينقلب عليها بسبب دين قديم' },
  },
  rev_friendfoe: {
    ja: { name: '敵味方反転', definition: '味方が敵、敵が助け手になる', example: 'ずっと助けてくれた親友こそ内通者で、ライバルが決定的証拠を差し出す' },
    ko: { name: '적우 반전', definition: '동지가 적, 적이 오히려 조력자로', example: '줄곧 도와준 절친이 내통자였고, 라이벌이 결정적 증거를 건넨다' },
    es: { name: 'Giro aliado-enemigo', definition: 'El aliado es el enemigo y el rival ayuda', example: 'La mejor amiga que la ayudaba era la infiltrada; la rival le entrega la prueba clave' },
    ar: { name: 'انقلاب الصديق والعدو', definition: 'الحليف عدو والعدو يصبح عوناً', example: 'صديقتها المقربة التي ساعدتها هي الخائنة، بينما تمدّها منافستها بالدليل الحاسم' },
  },
  rev_truefalse: {
    ja: { name: '真贋反転', definition: '本物だと思ったものが偽物、その逆', example: 'あの「遺書」は偽造で、本人は二階にいた' },
    ko: { name: '진위 반전', definition: '진짜라 믿은 게 가짜, 가짜라 믿은 게 진짜', example: '그 ‘유서’는 위조였고 본인은 위층에 있었다' },
    es: { name: 'Giro verdad-falsedad', definition: 'Lo creído verdadero es falso y viceversa', example: 'La «nota de suicidio» era falsa; la persona estaba arriba' },
    ar: { name: 'انقلاب الحقيقة والزيف', definition: 'ما ظُنّ حقيقياً مزيف والعكس', example: '«رسالة الانتحار» كانت مزوّرة والشخص حيّ في الطابق العلوي' },
  },
  rev_cause: {
    ja: { name: '因果反転', definition: '結果の真の原因が見た目と逆', example: '人を傷つけたとされた彼は、実は当年の救命者だった' },
    ko: { name: '인과 반전', definition: '결과의 진짜 원인이 겉모습과 반대', example: '해를 끼쳤다 지목된 그가 사실은 그때 사람을 구한 이였다' },
    es: { name: 'Giro causal', definition: 'La causa real es opuesta a la apariencia', example: 'Acusado de dañar a alguien, él era en realidad quien lo salvó años atrás' },
    ar: { name: 'انقلاب السببية', definition: 'السبب الحقيقي للنتيجة عكس الظاهر', example: 'المُتَّهم بإيذاء الآخرين هو في الحقيقة من أنقذهم في الماضي' },
  },
  rev_cognition: {
    ja: { name: '認識反転', definition: '観客と人物の既定認識を覆す', example: '恩返しのつもりが、相手は「借りを返している」と言う' },
    ko: { name: '인식 반전', definition: '관객과 인물의 기존 인식 전복', example: '그녀는 은혜 갚는 줄 알았는데 상대는 빚 갚는 거라 한다' },
    es: { name: 'Giro cognitivo', definition: 'Derriba la creencia del público y del personaje', example: 'Ella cree devolver un favor; él dice que está saldando una deuda' },
    ar: { name: 'انقلاب الإدراك', definition: 'يقلب فكرة الجمهور والشخصية الراسخة', example: 'تظنّ أنها تردّ الجميل بينما يقول إنه يسدد ديناً' },
  },
  rev_strongweak: {
    ja: { name: '強弱反転', definition: '強弱が入れ替わり、抑えられていた側が優位に', example: '全員が彼女の失態を待つ中、三言で逆に追い詰める' },
    ko: { name: '강약 반전', definition: '강약이 뒤바뀌어 억눌린 쪽이 우위로', example: '모두가 그녀의 망신을 기다리는데 세 마디로 역공한다' },
    es: { name: 'Giro fuerte-débil', definition: 'El oprimido toma la delantera', example: 'Todos esperan su ridículo; con tres frases los acorrala' },
    ar: { name: 'انقلاب القوة والضعف', definition: 'يتبادل القوي والضعيف موقعهما', example: 'الجميع ينتظر فضيحتها فتقلب الطاولة عليهم بثلاث جمل' },
  },
  rev_timeline: {
    ja: { name: '時間軸反転', definition: '時間のズレが真相を逆転させる', example: '二つの監視映像を突き合わせると、犯行時刻に彼は現場にいなかった' },
    ko: { name: '타임라인 반전', definition: '시간 순서 어긋남으로 진실이 뒤집힘', example: '두 감시 영상을 맞대니 사건 당시 그는 현장에 없었다' },
    es: { name: 'Giro de línea temporal', definition: 'El desfase cronológico invierte la verdad', example: 'Al cruzar dos cámaras, él no estaba en la escena del crimen' },
    ar: { name: 'انقلاب الخط الزمني', definition: 'اختلال الترتيب الزمني يعكس الحقيقة', example: 'بمطابقة مقطعي مراقبة تبيّن أنه لم يكن في المكان وقت الحادث' },
  },
  pay_faceslap: {
    ja: { name: '現証返り討ち', definition: '軽視された者がその場で証明し、周囲の態度が一変', example: '買えないと笑った途端、マネージャーが駆け寄り「董事長」と呼ぶ' },
    ko: { name: '현장 반증', definition: '얕본 사람이 즉석에서 증명하고 구경꾼 태도 전환', example: '못 산다고 비웃자마자 매니저가 달려와 회장님이라 부른다' },
    es: { name: 'Desmentida en el acto', definition: 'El menospreciado lo prueba ahí mismo y la actitud cambia', example: 'Apenas se ríen de que no puede pagar, el gerente corre a llamarla «presidenta»' },
    ar: { name: 'صفعة الرد المباشر', definition: 'المُحتقَر يُثبت فوراً فينقلب موقف الحاضرين', example: 'سُخروا منه لتوّهم حتى هرع المدير منادياً إياها «رئيسة مجلس الإدارة»' },
  },
  pay_counter: {
    ja: { name: '下克上の逆転', definition: '劣勢側が隠した実力や計略で盛り返す', example: 'プロジェクトが終了宣告されたところで、彼女は用意済みのプランBを出す' },
    ko: { name: '역습 반전', definition: '열세인 쪽이 숨긴 실력이나 계획으로 뒤집기', example: '프로젝트가 사형선고 받자 그녀는 미리 짠 Plan B를 꺼낸다' },
    es: { name: 'Remontada', definition: 'El que está en desventaja revierte con fuerza o plan oculto', example: 'Cuando dan el proyecto por muerto, ella saca el plan B preparado' },
    ar: { name: 'العودة من الخلف', definition: 'المتخلّف يقلبها بقوة خفية أو تخطيط مسبق', example: 'حُكم على المشروع بالموت حتى أخرجت خطتها البديلة المُعدّة سلفاً' },
  },
  pay_id压制: {
    ja: { name: '身分による制圧', definition: '隠した高い身分を明かし、地位で圧倒', example: '一本の電話で、相手本社が夜のうちに態度を変える' },
    ko: { name: '신분 제압', definition: '숨긴 높은 신분을 밝혀 지위로 압도', example: '전화 한 통에 상대 본사가 밤새 말을 바꾼다' },
    es: { name: 'Aplastamiento por estatus', definition: 'Revela un alto cargo y domina por posición', example: 'Con una llamada, la sede central da marcha atrás esa misma noche' },
    ar: { name: 'القمع بالمنصب', definition: 'يكشف مكانته العالية فيسحق بالموقع', example: 'بمكالمة واحدة يغيّر المقرّ المركزي للطرف الآخر موقفه ليلاً' },
  },
  pay_crush: {
    ja: { name: '実力制圧', definition: '確かな実力・専門性で一撃', example: 'あらゆる嫌がらせの中、彼女は3分で基幹システムを直す' },
    ko: { name: '실력 압도', definition: '단단한 실력·전문성으로 한 방 제압', example: '온갖 트집 속에 그녀는 3분 만에 핵심 시스템을 고친다' },
    es: { name: 'Aplastamiento por competencia', definition: 'Resuelve de un golpe con capacidad real', example: 'Ante trabas constantes, repara el sistema central en tres minutos' },
    ar: { name: 'السحق بالكفاءة', definition: 'يحسم الضربة بقدرة فعلية واحتراف', example: 'رغم كل العراقيل أصلحت النظام الجوهري في ثلاث دقائق' },
  },
  pay_truth: {
    ja: { name: '真相開示', definition: '誤解や陰謀が証拠で暴かれ正義が戻る', example: '監視映像が流れ、彼女に罪を着せた者がその場にへたり込む' },
    ko: { name: '진실 폭로', definition: '오해·음모가 증거로 드러나 정의가 바로섬', example: '감시 영상이 틀어지자 그녀에게 누명 씌운 이가 즉석에서 주저앉는다' },
    es: { name: 'Revelación de la verdad', definition: 'La evidencia expone el complot y la justicia vuelve', example: 'Al proyectar la cámara, quien la inculpó se desploma en el acto' },
    ar: { name: 'كشف الحقيقة', definition: 'الدليل يفضح المؤامرة فيعود العدل لموقعه', example: 'لحظة عرض المراقبة ينهار من لفّق لها التهمة في مكانه' },
  },
  pay_karma: {
    ja: { name: '悪人の即応報', definition: '悪役がその場で報いを受け、即時のカタルシス', example: '威張り終えたとたん、処分通知が届く' },
    ko: { name: '악인 즉보', definition: '악역이 즉석에서 응보, 즉각적 카타르시스', example: '잘난 체하자마자 처분 통지가 도착한다' },
    es: { name: 'Castigo inmediato', definition: 'El villano recibe su merecido al instante, sin frustración', example: 'Apenas termina de fanfarronear, llega la notificación de sanción' },
    ar: { name: 'جزاء الشرير الفوري', definition: 'ينال الشرير عقابه فوراً بإشباع آني بلا كبت', example: 'ما إن أنهى استعلاءه حتى وصل إخطار المساءلة' },
  },
  pay_sweet: {
    ja: { name: '双方向の応え', definition: '想いが対等に報われる', example: '彼女が言えなかった困りごとを、彼は黙って片付けておいた' },
    ko: { name: '쌍방 향함', definition: '감정의 헌신이 대등하게 응답받음', example: '그녀가 차마 말 못 한 어려움을 그는 말없이 해결해뒀다' },
    es: { name: 'Correspondencia mutua', definition: 'El afecto recibe una respuesta equivalente', example: 'La dificultad que ella no se atrevió a decir, él ya la resolvió en silencio' },
    ar: { name: 'التقاء متبادل', definition: 'يلقى العطاء العاطفي استجابة مكافئة', example: 'الصعوبة التي لم تفصح عنها كان قد تدبّرها بهدوء' },
  },
  pay_wish: {
    ja: { name: '願望の代償充足', definition: '現実ではできないことを代わりにやる', example: 'モラハラ圧迫の前で、彼女は静かに辞表を机に叩きつける' },
    ko: { name: '대리 만족', definition: '관객이 현실에서 못 하는 일을 대신 해줌', example: '가스라이팅 앞에서 그녀는 태연하게 사표를 탁 내려놓는다' },
    es: { name: 'Satisfacción vicaria', definition: 'Hace por el público lo que este no se atreve', example: 'Ante la manipulación, deja la dimisión sobre la mesa con calma' },
    ar: { name: 'إشباع الرغبة بالإنابة', definition: 'يفعل للجمهور ما لا يجرؤون عليه واقعياً', example: 'أمام التلاعب النفسي تضع استقالتها على الطاولة بهدوء' },
  },
  pay_underdog: {
    ja: { name: '弱者の雪辱', definition: '長く抑えられた者が尊厳を取り戻す', example: '十年いじめられた彼女が、今日初めて顔を上げる' },
    ko: { name: '약자 명예 회복', definition: '오래 억눌린 이가 한 번에 존엄을 되찾음', example: '10년간 괴롭힘당한 그녀가 오늘 처음 고개를 든다' },
    es: { name: 'El débil se alza', definition: 'Quien fue oprimido mucho tiempo recupera su dignidad', example: 'Tras diez años de abusos, por fin levanta la cabeza' },
    ar: { name: 'انتصام الضعيف', definition: 'المقهور طويلاً يسترد كرامته دفعة واحدة', example: 'بعد عشر سنوات من القمع ترفع رأسها للمرة الأولى' },
  },
  pay_resource: {
    ja: { name: '降臨リソース', definition: '決め手となる能力・人脈・財を得て形勢逆転', example: '絶体絶命の時、埋もれていた委任状が彼女の手に' },
    ko: { name: '자원 강림', definition: '결정적 치트·인맥·재물을 얻어 판세 변화', example: '절체절명의 순간, 묵혀둔 위임장이 그녀 손에 도착한다' },
    es: { name: 'Recurso inesperado', definition: 'Obtiene una ventaja, contacto o riqueza clave que cambia el juego', example: 'En la desesperación, llega a sus manos un poder olvidado' },
    ar: { name: 'مورد هابط', definition: 'ينال ميزة أو علاقة أو ثروة مفتاحية تغيّر الموازين', example: 'في لحظة المأزق يصلها تفويض مغبّر منذ زمن' },
  },
  emo_suppress: {
    ja: { name: '鬱屈の溜め', definition: 'まず抑える：虐め・誤解・抑圧', example: '手柄を奪われ、彼女は拳を握りしめて黙った' },
    ko: { name: '울분 축적', definition: '먼저 누르기: 괴롭힘·오해·억압', example: '공을 빼앗긴 그녀는 주먹을 쥐고 말을 아꼈다' },
    es: { name: 'Acumulación de frustración', definition: 'Primero oprime: humillación, malentendido, represión', example: 'Le roban el mérito; aprieta el puño en silencio' },
    ar: { name: 'شحن الكبت', definition: 'يُكبَت أولاً: الإيذاء أو سوء الفهم أو القمع', example: 'سُلب إنجازها فقبضت قبضتها صامتة' },
  },
  emo_burst: {
    ja: { name: '感情の爆発', definition: '衝突や感情が頂点で噴き出す', example: '彼女はついに口を開き、一言ずつ清算する' },
    ko: { name: '감정 폭발', definition: '갈등·감정이 정점에서 분출', example: '그녀가 마침내 입을 열어 한마디 한마디 따진다' },
    es: { name: 'Explosión emocional', definition: 'Desfogue en el clímax del conflicto', example: 'Por fin habla y ajusta cuentas palabra por palabra' },
    ar: { name: 'انفجار عاطفي', definition: 'تفريغ عند ذروة الصراع أو العاطفة', example: 'تكلّمت أخيراً وصَفّت الحساب كلمة كلمة' },
  },
  emo_release: {
    ja: { name: 'カタルシス解放', definition: '圧力が解ける痛快な瞬間', example: '判決が下り、彼女は深く息を吐いて扉を出る' },
    ko: { name: '쾌감 해방', definition: '압력이 풀리는 통쾌한 순간', example: '판결이 내려지자 그녀는 길게 숨 내쉬고 문을 나선다' },
    es: { name: 'Liberación', definition: 'El instante gozoso en que cesa la presión', example: 'Dictada la sentencia, exhala hondo y cruza la puerta' },
    ar: { name: 'إطلاق النشوة', definition: 'لحظة الانفراج المبهجة حين يُرفع الضغط', example: 'صدر الحكم فأطلقت زفيراً عميقاً وخرجت من الباب' },
  },
  emo_warmth: {
    ja: { name: '温情の余韻', definition: '柔らかいディテールで感情を着地させる', example: '喧嘩の後、彼は黙って温かいお粥を彼女のそばに置く' },
    ko: { name: '온정 여운', definition: '부드러운 디테일로 감정을 착지시킴', example: '다툰 뒤 그는 말없이 따뜻한 죽을 그녀 곁에 둔다' },
    es: { name: 'Calidez que perdura', definition: 'Un detalle tierno asienta la emoción', example: 'Tras la pelea, deja en silencio una sopa caliente a su lado' },
    ar: { name: 'دفء الأثر العالق', definition: 'تفصيلة رقيقة تُرسّي العاطفة', example: 'بعد الشجار يضع بصمت وعاء العصيدة الساخن قرب يدها' },
  },
  emo_suspense: {
    ja: { name: '心をつかむ懸念', definition: '未決のままで気を揉ませる', example: '手術室のランプが点きっぱなしで、誰も口をきかない' },
    ko: { name: '애절한 서스펜스', definition: '미결 상태로 마음 졸이게 함', example: '수술실 등이 계속 켜져 있고 아무도 말이 없다' },
    es: { name: 'Suspenso angustiante', definition: 'Lo no resuelto mantiene en vilo', example: 'La luz del quirófano sigue encendida; nadie habla' },
    ar: { name: 'تشويق قابض', definition: 'المعلّق بلا حسم يُبقي القلب مشدوداً', example: 'ضوء غرفة العمليات مضاء بلا انقطاع ولا أحد يتكلم' },
  },
  emo_tear: {
    ja: { name: '涙の決壊', definition: '共感の頂点：犠牲・誤解・親情', example: '遺品から、彼女が使えなかった切符が落ちる' },
    ko: { name: '눈물 포인트', definition: '공감 정점: 희생·오해·가족애', example: '유품에서 그녀가 아끼던 차표가 떨어진다' },
    es: { name: 'Punto de llanto', definition: 'Pico de empatía: sacrificio, malentendido, familia', example: 'De las pertenencias póstumas cae el billete que nunca se atrevió a usar' },
    ar: { name: 'نقطة الانكسار بالدمع', definition: 'ذروة التعاطف: تضحية أو سوء فهم أو قرابة', example: 'تسقط من الأمتعة الموروثة تذكرة لم تطاوعها نفسه على استخدامها' },
  },
  emo_hype: {
    ja: { name: '高燃ポイント', definition: '熱血・使命感が最高潮', example: '「今度こそ、俺たちが決める」全員が立ち上がる' },
    ko: { name: '고연 포인트', definition: '열혈·사명감 최고조', example: '“이번엔 우리가 정한다.” 모두가 일어선다' },
    es: { name: 'Punto épico', definition: 'Pasión y sentido de misión a tope', example: '«Esta vez decidimos nosotros.» Todos se ponen en pie' },
    ar: { name: 'نقطة الحماس', definition: 'ذروة الحمية والشعور بالرسالة', example: '«هذه المرة نحن من نقرّر.» ينهض الجميع' },
  },
  emo_heal: {
    ja: { name: '癒やしの慰藉', definition: '感情が鎮まり慰められる', example: '夜が明け、彼女は窓辺にもたれてふわりと笑う' },
    ko: { name: '치유 위안', definition: '감정이 가라앉고 위로받음', example: '날이 밝자 그녀는 창가에 기대어 살포시 웃었다' },
    es: { name: 'Consuelo sanador', definition: 'La emoción se asienta y reconforta', example: 'Amanece; apoya en la ventana y sonríe levemente' },
    ar: { name: 'العزاء المُداوي', definition: 'تسكّن العاطفة وتُسترضى', example: 'أطلّ الصباح فأسندت إلى النافذة وابتسمت برفق' },
  },
};

export const BEAT_CATALOG_IDS = Object.keys(CATALOG);

export function localizeBeatEntry(id: string, lang: StrategyUiLang, enFallback: BeatLoc): BeatLoc {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return enFallback;
  return CATALOG[id]?.[l] ?? enFallback;
}

export function localizeBeatCatalogList(list: Array<{ id: string; name: string; definition: string; example?: string; [k: string]: unknown }>, lang: StrategyUiLang) {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return list;
  return list.map((b) => {
    const loc = localizeBeatEntry(b.id, l, { name: b.name, definition: b.definition, example: b.example ?? '' });
    return { ...b, ...loc };
  });
}

/** 覆盖度自检：26 节拍 × 4 语 × 3 字段 */
export function beatCatalogCoverage(expectedIds: string[]): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  for (const id of expectedIds) {
    for (const l of ['ja', 'ko', 'es', 'ar'] as ExtLang[]) {
      const c = CATALOG[id]?.[l];
      for (const f of ['name', 'definition', 'example'] as const) {
        if (!c?.[f]) missing.push(`${id}/${l}/${f}`);
        else covered++;
      }
    }
  }
  return { missing, covered };
}
