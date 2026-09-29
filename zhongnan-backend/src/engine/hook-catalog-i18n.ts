/**
 * v2.46 29 个具体钩子的四语（ja/ko/es/ar）完整平移：name/definition/example
 * 原则同 strategy-i18n：仅展示层本地化；technique 进管线保持 zh/en、bestFor 本就是英文标签，均不动；
 * 缺译回退英文（localizeHookCatalog 兜底），绝不返回空。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';
export interface HookLoc { name: string; definition: string; example: string }
type HookLocMap = Record<ExtLang, HookLoc>;

const CATALOG: Record<string, HookLocMap> = {
  open_conflict: {
    ja: { name: '直球衝突型', definition: '冒頭の一コマから強い衝突現場', example: '結婚式で、花嫁が指輪を新郎の顔にたたきつける' },
    ko: { name: '직접 충돌형', definition: '첫 프레임부터 강한 갈등 현장', example: '결혼식장에서 신부가 반지를 신랑 얼굴에 던진다' },
    es: { name: 'Conflicto directo', definition: 'Un fuerte conflicto desde el primer fotograma', example: 'En la boda, la novia le arroja el anillo a la cara al novio' },
    ar: { name: 'صراع مباشر', definition: 'مشهد صراع قوي منذ أول لقطة', example: 'في حفل الزفاف ترمي العروس الخاتم في وجه العريس' },
  },
  open_suspense: {
    ja: { name: '強サスペンス型', definition: '答えのない疑問や危険を突きつける', example: 'DNA鑑定書が机に広げられ、彼女の手が震える' },
    ko: { name: '강한 서스펜스형', definition: '풀리지 않는 의문/위험 던지기', example: 'DNA 감정서가 탁자에 펼쳐지고 그녀의 손이 떨린다' },
    es: { name: 'Alto suspenso', definition: 'Lanza una pregunta sin respuesta o un peligro', example: 'Sobre la mesa, un informe de ADN; su mano tiembla' },
    ar: { name: 'تشويق قوي', definition: 'طرح سؤال بلا حل أو خطر', example: 'تقرير الحمض النووي على الطاولة ويدها ترتجف' },
  },
  open_contrast: {
    ja: { name: '極限ギャップ型', definition: '直前まで絶頂、次の瞬間どん底', example: 'さっきまで社長夫人だった彼女が、次の瞬間警備員に建物から引きずり出される' },
    ko: { name: '극한 반차형', definition: '1초 전 정상, 다음 순간 나락', example: '방금 전 사모님이던 그녀가 다음 순간 경비원에게 끌려나간다' },
    es: { name: 'Contraste extremo', definition: 'De la cima al abismo en un segundo', example: 'Un segundo antes era la esposa del CEO; al siguiente, seguridad la arrastra fuera' },
    ar: { name: 'تباين حاد', definition: 'من القمة إلى القاع في ثانية', example: 'قبل لحظة زوجة الرئيس التنفيذي، وفي التالية يجرها الحراس خارج المبنى' },
  },
  open_identity: {
    ja: { name: '身分逆転フック', definition: '見せかけの身分と本当の身分のズレ', example: '誰もが私を家政婦だと思っている、このビルが私のものだとは知らずに' },
    ko: { name: '신분 역전 훅', definition: '겉신분과 실제 신분의 어긋남', example: '모두가 나를 가정부로 알지만 이 건물이 내 것인 줄은 모른다' },
    es: { name: 'Gancho de identidad', definition: 'La identidad aparente choca con la real', example: 'Todos me creen la niñera, sin saber que el edificio es mío' },
    ar: { name: 'خطافة انقلاب الهوية', definition: 'تباين الهوية الظاهرة عن الحقيقية', example: 'الجميع يحسبني خادمة ولا يعلمون أن المبنى ملكي' },
  },
  open_desperate: {
    ja: { name: '絶体絶命フック', definition: '冒頭から二者択一の窮地', example: '残り10分、誘拐犯が彼女にどちらの子を選ぶか迫る' },
    ko: { name: '절경 훅', definition: '시작부터 양자택일/막다른 상황', example: '카운트다운 10분, 납치범이 아이 하나를 고르라 한다' },
    es: { name: 'Gancho de desesperación', definition: 'Dilema sin salida desde el arranque', example: 'Diez minutos en el reloj: el secuestrador le hace elegir a un niño' },
    ar: { name: 'خطافة المأزق', definition: 'ورطة أو خياران مستحيلان منذ البداية', example: 'عشر دقائق على العدّاد ويجبرها الخاطف على اختيار أحد الطفلين' },
  },
  open_countdown: {
    ja: { name: 'カウントダウンフック', definition: '迫る期限と重大な結果', example: '手術同意の期限切れまであと20分' },
    ko: { name: '카운트다운 훅', definition: '촉박한 시간제한+중대한 결과', example: '수술 동의 효력 만료까지 20분' },
    es: { name: 'Gancho de cuenta atrás', definition: 'Plazo apremiante + consecuencia grave', example: 'Veinte minutos para que caduque el consentimiento quirúrgico' },
    ar: { name: 'خطافة العد التنازلي', definition: 'مهلة مضغوطة وعواقب وخيمة', example: 'عشرون دقيقة قبل انتهاء صلاحية توقيع العملية' },
  },
  open_reveal: {
    ja: { name: '衝撃暴露フック', definition: '一言で認識をひっくり返す', example: '「二十年守ってきた恩人こそ、お前の家族を壊した張本人だ」' },
    ko: { name: '충격 폭로 훅', definition: '한마디로 인식 전복', example: '"20년간 모셔온 은인이 바로 네 가문을 망친 장본인이야."' },
    es: { name: 'Gancho de revelación', definition: 'Una frase lo derrumba todo', example: '«Tu benefactor de veinte años es quien destruyó a tu familia.»' },
    ar: { name: 'خطافة الكشف الصادم', definition: 'جملة واحدة تقلب الإدراك', example: '«مَن رعيتَه عشرين عاماً هو من دمّر عائلتك.»' },
  },
  open_abnormal: {
    ja: { name: '異常映像フック', definition: '常識に反する映像を見せる', example: '普通の通りで、彼の背中に突然翼が広がる' },
    ko: { name: '이상한 장면 훅', definition: '상식에 어긋나는 화면 제시', example: '평범한 거리에서 그의 등에 갑자기 날개가 펼쳐진다' },
    es: { name: 'Gancho de imagen anómala', definition: 'Muestra una imagen que desafía el sentido común', example: 'En una calle cualquiera, de pronto le brotan alas a la espalda' },
    ar: { name: 'خطافة المشهد الشاذ', definition: 'عرض مشهد يخالف المألوف', example: 'في شارع عادي تنبسط فجأة جناحان خلف ظهره' },
  },
  open_line: {
    ja: { name: '名言オープンフック', definition: '炸裂の一語でトーンを決める', example: '「私が嫁いだのは男じゃない、この街で一番深い罠よ」' },
    ko: { name: '명대사 오프닝 훅', definition: '한 방 있는 대사로 톤 설정', example: '"내가 시집간 건 사람이 아니라 이 도시 가장 깊은 판이야."' },
    es: { name: 'Gancho de frase dorada', definition: 'Una línea demoledora fija el tono', example: '«No me casé con un hombre, sino con la trampa más honda de esta ciudad.»' },
    ar: { name: 'خطافة الافتتاحية الذهبية', definition: 'جملة صاعقة تحدد النبرة', example: '«لم أتزوج رجلاً، بل أعمق مؤامرة في هذه المدينة.»' },
  },
  open_endure: {
    ja: { name: '耐えるフック', definition: '奪われても泣き叫ばず無表情で飲み込み、復讐までの秒読みを刻む', example: '彼は屈辱を呑み込み、心でだけ言う——あと27日でお前たちは跪く' },
    ko: { name: '인욕 훅', definition: '빼앗겨도 울지 않고 무표정으로 삼키며 복수 카운트다운을 새김', example: '그는 모든 치욕을 삼키며 속으로 말한다: 27일 뒤 너희는 무릎 꿇는다' },
    es: { name: 'Gancho de entereza', definition: 'Al ser despojado no llora ni grita, traga en silencio y cuenta los días para la venganza', example: 'Se traga cada humillación pensando: veintisiete días y todos se arrodillarán' },
    ar: { name: 'خطافة الصمت الكاظم', definition: 'عند سلبه لا يبكي ولا يصيح، يبتلع بصمت جامح ويعدّ أيام الانتقام', example: 'يبتلع كل إهانة ويقول في سرّه: بعد سبعة وعشرين يوماً ستركعون جميعاً' },
  },
  open_cognitive: {
    ja: { name: '認識転覆フック', definition: '冒頭の一文で常識を覆す：Xだと思ったものは実はY', example: '物理学は、もう存在しない。' },
    ko: { name: '인식 전복 훅', definition: '첫 문장으로 상식 전복: 네가 아는 X는 사실 Y', example: '물리학은, 더 이상 존재하지 않는다.' },
    es: { name: 'Gancho cognitivo', definition: 'La primera frase tumba el sentido común: lo que creías X es Y', example: 'La física ya no existe.' },
    ar: { name: 'خطافة الانقلاب المعرفي', definition: 'الجملة الأولى تنقض المألوف: ما حسبته X هو Y', example: 'الفيزياء لم تعد موجودة.' },
  },
  ep_cliff_danger: {
    ja: { name: '危機ブツ切り', definition: '危険が襲う瞬間で終わる', example: 'ドアが打ち破られた刹那、画面が暗転する' },
    ko: { name: '위기 컷', definition: '위험이 닥친 순간에 종료', example: '문이 들이받히는 순간 화면이 암전된다' },
    es: { name: 'Corte de peligro', definition: 'Termina en el instante en que llega el peligro', example: 'En cuanto derriban la puerta, corte a negro' },
    ar: { name: 'قطع عند الخطر', definition: 'تنتهي الحلقة في لحظة وقوع الخطر', example: 'لحظة تُحطم البابة تُظلم الشاشة' },
  },
  ep_cliff_reveal: {
    ja: { name: '暴露ブツ切り', definition: '真実が明かされる寸前で切る', example: '「実はあなたの実の母親は——」ここで終わり' },
    ko: { name: '폭로 컷', definition: '진실이 밝혀지기 직전 끊기', example: '"사실 네 친어머니는—" 본편 끝' },
    es: { name: 'Corte de revelación', definition: 'La verdad a medias', example: '«En realidad tu madre biológica es…» Fin del episodio' },
    ar: { name: 'قطع عند الكشف', definition: 'الحقيقة على وشك أن تُقال', example: '«في الحقيقة والدتك الحقيقية هي…» نهاية الحلقة' },
  },
  ep_cliff_reversal: {
    ja: { name: 'どんでん返しブツ切り', definition: '最後の一語で覆す', example: 'ずっと彼女を助けてきた男が、振り向いて敵に電話をかける' },
    ko: { name: '반전 컷', definition: '마지막 한마디로 전복', example: '줄곧 그녀를 도운 사람이 돌아서서 악역에게 전화를 건다' },
    es: { name: 'Corte de giro', definition: 'La última frase lo voltea', example: 'Quien siempre la ayudaba se gira y llama al villano' },
    ar: { name: 'قطع عند الانقلاب', definition: 'الجملة الأخيرة تقلب الموازين', example: 'من طالما ساعدها يستدير ويتصل بالشرير' },
  },
  ep_cliff_choice: {
    ja: { name: '選択ブツ切り', definition: '二者択一の直前で止める', example: '母を救うか娘を救うか、彼女が手を上げる' },
    ko: { name: '선택 컷', definition: '양자택일 앞에서 멈춤', example: '어머니를 살릴까 딸을 살릴까, 그녀가 손을 든다' },
    es: { name: 'Corte de dilema', definition: 'Se detiene ante una elección', example: '¿Salvar a la madre o a la hija? Ella alza la mano' },
    ar: { name: 'قطع عند المعضلة', definition: 'التوقف قبل خيارين', example: 'أتنقذ الأم أم الابنة؟ ترفع يدها' },
  },
  ep_cliff_emotion: {
    ja: { name: '感情ブツ切り', definition: '感情が頂点に達したところで切る', example: '彼が片膝をついた瞬間、エピソード終了' },
    ko: { name: '감정 컷', definition: '감정이 최고조에 이른 지점에서 끊기', example: '그가 무릎을 꿇는 순간, 회차 종료' },
    es: { name: 'Corte emocional', definition: 'Corta en el pico emocional', example: 'En el instante en que se arrodilla, acaba el episodio' },
    ar: { name: 'قطع عند الذروة العاطفية', definition: 'القطع عند قمة العاطفة', example: 'لحظة يركع على ركبة واحدة تنتهي الحلقة' },
  },
  ep_cliff_newperson: {
    ja: { name: '新変数ブツ切り', definition: '決め手となる新人物・新証拠の登場', example: '会議室のドアが開き、入ってきたのは「死んだはず」の彼だった' },
    ko: { name: '새 변수 컷', definition: '핵심 새 인물/새 증거 등장', example: '회의실 문이 열리고 들어온 이는 "죽은" 그였다' },
    es: { name: 'Corte de nueva variable', definition: 'Entra una persona o prueba decisiva', example: 'Se abre la sala de juntas: es él, el «muerto»' },
    ar: { name: 'قطع عند متغير جديد', definition: 'دخول شخص أو دليل حاسم', example: 'يُفتح باب قاعة الاجتماع وإذا به هو «الميت»' },
  },
  scene_goal_block: {
    ja: { name: '目標遮断フック', definition: '目標が生まれた瞬間に遮る', example: '契約を手にしたばかりの彼女に、相手が破棄を宣告する' },
    ko: { name: '목표 좌절 훅', definition: '목표가 세워지자마자 차단', example: '그녀가 계약서를 받자마자 상대가 무효를 선언한다' },
    es: { name: 'Gancho de meta bloqueada', definition: 'El objetivo se frustra al formarse', example: 'Apenas obtiene el contrato, la otra parte lo anula' },
    ar: { name: 'خطافة إعاقة الهدف', definition: 'مقاطعة الهدف لحظة تشكّله', example: 'بالكاد تمسك العقد حتى يعلن الطرف الآخر إلغاءه' },
  },
  scene_info_drop: {
    ja: { name: '情報投下フック', definition: '場の終わりに鍵となる情報を放る', example: '「監視カメラのあの日、もう一人いた」' },
    ko: { name: '정보 투척 훅', definition: '장면 끝에 핵심 정보 던지기', example: '"감시 영상 속 그날, 두 번째 사람이 있었어."' },
    es: { name: 'Gancho de dato', definition: 'Suelta una información clave al final de la escena', example: '«En la cámara aquel día había una segunda persona.»' },
    ar: { name: 'خطافة إلقاء المعلومة', definition: 'إلقاء معلومة مفتاحية في نهاية المشهد', example: '«في مراقبة ذلك اليوم كان هناك شخص ثانٍ.»' },
  },
  scene_cut_question: {
    ja: { name: '疑問転場フック', definition: '問いを抱えたまま場面転換', example: '彼女が空の通帳を見つめると、場面はブランド店にいる夫へ切り替わる' },
    ko: { name: '의문 전환 훅', definition: '의문을 안고 장면 전환', example: '그녀가 텅 빈 통장을 보는 사이, 명품점의 남편으로 컷' },
    es: { name: 'Gancho de corte con pregunta', definition: 'Cambia de escena dejando una pregunta', example: 'Ella mira la libreta vacía; corte al marido en una tienda de lujo' },
    ar: { name: 'خطافة الانتقال بسؤال', definition: 'الانتقال بين المشاهد حاملاً سؤالاً', example: 'تحدّق في الدفتر الفارغ، ثم ينتقل المشهد إلى الزوج في متجر فاخر' },
  },
  micro_action: {
    ja: { name: '動作フック', definition: '異常・危険・意味深い一つの動作', example: '彼は笑いながら、遺言書を炎に押し近づける' },
    ko: { name: '동작 훅', definition: '비정상·위험·의미심장한 하나의 동작', example: '그는 웃으며 유언장을 불 쪽으로 민다' },
    es: { name: 'Micro-gancho de acción', definition: 'Un gesto anómalo, peligroso o revelador', example: 'Sonriendo, acerca un poco más el testamento al fuego' },
    ar: { name: 'خطافة فعل دقيقة', definition: 'حركة واحدة شاذة أو خطيرة أو ذات دلالة', example: 'وهو يبتسم يقرّب الوصية أكثر نحو النار' },
  },
  micro_line: {
    ja: { name: '台詞フック', definition: '含み・二重の意味・言いさし', example: '「あなた、お父さんにそっくりね」（彼女の顔色が変わる）' },
    ko: { name: '대사 훅', definition: '함의/이중 의미/말끊기', example: '"너 아빠랑 정말 똑같아."(그녀의 안색이 급변한다)' },
    es: { name: 'Micro-gancho de diálogo', definition: 'Subtexto, doble sentido o frase inconclusa', example: '«Eres idéntico a tu padre.» (su rostro cambia)' },
    ar: { name: 'خطافة حوار دقيقة', definition: 'معنى ضمني أو ازدواج دلالة أو كلام مبتور', example: '«أنت نسخة طبق الأصل من أبيك.» (يتغيّر لون وجهها فجأة)' },
  },
  micro_atmos: {
    ja: { name: '雰囲気フック', definition: '環境・光・音の変化で不安を作る', example: '階段のセンサーライトが階ごとに消え、足音は止まない' },
    ko: { name: '분위기 훅', definition: '환경·빛·소리 돌변으로 불안 조성', example: '복도 센서등이 층층이 꺼지는데 발소리는 멈추지 않는다' },
    es: { name: 'Micro-gancho de atmósfera', definition: 'Un cambio de entorno, luz o sonido crea inquietud', example: 'Las luces del pasillo se apagan piso a piso; los pasos no cesan' },
    ar: { name: 'خطافة أجواء دقيقة', definition: 'تغير مفاجئ في المحيط أو الضوء أو الصوت يصنع القلق', example: 'تنطفئ أضواء الدرج طابقاً تلو الآخر بينما لا تتوقف الخطوات' },
  },
  micro_emotion: {
    ja: { name: '感情フック', definition: '感情の対比・堪える寸前・共感ディテール', example: '彼女は笑って大丈夫と言うが、手はティッシュを握りつぶしている' },
    ko: { name: '감정 훅', definition: '감정 대비/폭발 직전의 참음/공감 디테일', example: '그녀는 웃으며 괜찮다지만 손은 휴지를 구겨 쥔다' },
    es: { name: 'Micro-gancho emocional', definition: 'Contraste, contención a punto de estallar, detalle de empatía', example: 'Dice «estoy bien» sonriendo, pero estruja el pañuelo en su mano' },
    ar: { name: 'خطافة عاطفية دقيقة', definition: 'تباين عاطفي أو كبت على وشك الانفجار أو تفصيل تعاطفي', example: 'تقول «أنا بخير» مبتسمة بينما تعصر المنديل في يدها' },
  },
  micro_gap: {
    ja: { name: '情報格差フック', definition: '観客は知り人物は知らない（劇的アイロニー）、または逆', example: '背後に人がいるのは観客だけが知り、彼女は楽しそうに料理を続ける' },
    ko: { name: '정보격차 훅', definition: '관객만 알고 인물은 모름(극적 아이러니) 혹은 반대', example: '관객은 뒤에 사람이 있는 걸 보는데 그녀는 즐겁게 요리 중' },
    es: { name: 'Micro-gancho de brecha', definition: 'El público sabe lo que el personaje ignora (ironía dramática) o al revés', example: 'El público ve a alguien a sus espaldas; ella sigue cocinando feliz' },
    ar: { name: 'خطافة فجوة معلومة دقيقة', definition: 'الجمهور يعلم والشخصية تجهل (المفارقة الدرامية) أو العكس', example: 'الجمهور يرى شخصاً خلفها وهي تطهو بسعادة' },
  },
  micro_foreshadow: {
    ja: { name: '伏線フック', definition: '後で回収する謎・物・言葉を植える', example: '第1話でクローズアップした古い鍵が、第18話で金庫を開ける' },
    ko: { name: '복선 훅', definition: '나중에 회수할 수수께끼·물건·말 심기', example: '1화에서 클로즈업한 낡은 열쇠가 18화에서 금고를 연다' },
    es: { name: 'Micro-gancho de presagio', definition: 'Planta un misterio, objeto o frase a cobrar luego', example: 'La vieja llave en primer plano del episodio 1 abre la caja fuerte en el 18' },
    ar: { name: 'خطافة تلميح دقيقة', definition: 'زرع لغز أو غرض أو عبارة تُحصد لاحقاً', example: 'المفتاح القديم في لقطة مقرّبة بالحلقة الأولى يفتح الخزنة في الثامنة عشرة' },
  },
  micro_sense: {
    ja: { name: '感覚フック', definition: '強い映像・匂い・音のクローズアップ', example: '雨が鉄錆の味とともに喉に流れ込む' },
    ko: { name: '감각 훅', definition: '강한 화면·냄새·소리 클로즈업', example: '빗물이 녹슨 맛과 함께 목으로 들이친다' },
    es: { name: 'Micro-gancho sensorial', definition: 'Prim plano visual, olfativo o sonoro intenso', example: 'El agua de lluvia con sabor a óxido se le cuela por la garganta' },
    ar: { name: 'خطافة حسية دقيقة', definition: 'لقطة قوية للصورة أو الرائحة أو الصوت', example: 'ماء المطر بطعم الصدأ يتدفق إلى حلقه' },
  },
  micro_minitwist: {
    ja: { name: '小逆転フック', definition: '場内の小さな期待外れ', example: '彼女が辞表を差し出すと、社長が先に昇進辞令を差し出す' },
    ko: { name: '소반전 훅', definition: '장면 내 작은 기대 위반', example: '그녀가 사표를 내밀자 사장이 먼저 승진서를 건넨다' },
    es: { name: 'Micro-giro', definition: 'Una pequeña expectativa rota dentro de la escena', example: 'Ella entrega su dimisión; el jefe le adelanta un ascenso' },
    ar: { name: 'خطافة انقلاب صغير', definition: 'خرق توقّع صغير داخل المشهد', example: 'تمدّ استقالتها فيبادرها المدير بقرار ترقية' },
  },
  micro_chain: {
    ja: { name: '連鎖フック', definition: '一文で掴んだらすぐ次の一文で再ロック、説明に逃げない', example: '天井から血がにじむ——目の前のコーヒーカップに落ち、暗紅の輪が広がる' },
    ko: { name: '연쇄 훅', definition: '첫 문장으로 잡자마자 둘째 문장으로 다시 잠금, 설명으로 빠지지 말 것', example: '천장에서 피가 스며든다—그의 커피잔에 떨어져 검붉은 원이 번진다' },
    es: { name: 'Gancho encadenado', definition: 'Atrapa en la primera frase y vuelve a cerrar en la segunda, sin escapar a la exposición', example: 'La sangre rezuma del techo… y cae justo en su café, tiñendo un círculo carmesí' },
    ar: { name: 'خطافة متسلسلة', definition: 'بعد إمساك القارئ بالجملة الأولى تُغلق الجملة الثانية فوراً دون هروب للشرح', example: 'الدم يتسرّب من السقف… ويسقط في فنجان قهوته تماماً فتتمدد دائرة قانية' },
  },
};

export const HOOK_CATALOG_IDS = Object.keys(CATALOG);

/** 单条钩子本地化：zh/en 原样；四语取字典；缺译回退传入的 enFallback */
export function localizeHookEntry(id: string, lang: StrategyUiLang, enFallback: HookLoc): HookLoc {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return enFallback;
  return CATALOG[id]?.[l] ?? enFallback;
}

export function localizeHookList(list: Array<{ id: string; name: string; definition: string; example: string; [k: string]: unknown }>, lang: StrategyUiLang) {
  const l = normalizeUiLang(lang);
  if (l === 'zh' || l === 'en') return list;
  return list.map((h) => ({ ...h, ...localizeHookEntry(h.id, l, { name: h.name, definition: h.definition, example: h.example }) }));
}

/** 覆盖度自检：29 钩 × 4 语 × 3 字段 */
export function hookCatalogCoverage(expectedIds: string[]): { missing: string[]; covered: number } {
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
