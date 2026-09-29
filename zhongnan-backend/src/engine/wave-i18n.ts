/**
 * v2.49 全剧情绪波形六语（ja/ko/es/ar）平移
 * - 波形点 path/reversal/payoffs 的节拍名复用 beat-catalog-i18n（26 节拍同源翻译）；
 * - 4 类改稿建议（press/overheat/flat/level）模板化六语，占位 {ep}/{intensity}/{path}；
 * - 引擎 emotion-wave 保持 zh/en 确定性不动，仅展示层本地化；缺译回退英文，绝不空。
 */
import { StrategyUiLang, normalizeUiLang } from './strategy-i18n';
import { localizeBeatEntry } from './beat-catalog-i18n';
import type { EmotionWave, WaveAdvice } from './emotion-wave';

type ExtLang = 'ja' | 'ko' | 'es' | 'ar';
type RuleKind = 'press' | 'overheat' | 'flat' | 'level';

const TEMPLATES: Record<RuleKind, Record<ExtLang, string>> = {
  press: {
    ja: '第{ep}話は感情を溜めるだけで解放していません（{path}）。視聴者が鬱屈して離脱します：話の途中か末尾に解放拍（爽感解放／感情爆発／温情回甘）を1つ足し、溜めたら必ず放ち、解放を本話フックの前に置いてください。',
    ko: '제{ep}화는 감정을 누르기만 하고 풀지 않습니다({path}). 시청자가 답답해서 이탈합니다: 화 중반이나 끝에 해방 비트(쾌감 해방/감정 폭발/온정 여운)를 하나 더하고, 누른 만큼 반드시 풀며 해방을 본화 훅 앞에 배치하세요.',
    es: 'El ep.{ep} solo oprime sin liberar ({path}): el espectador se irá por agobio. Añade un beat de liberación (liberación de recompensa / estallido emocional / regusto cálido) a mitad o al final, cumple «a toda opresión le sigue su liberación» y sitúa la liberación antes del gancho del episodio.',
    ar: 'الحلقة {ep} تكبت العاطفة دون تحرير ({path})، فيملّ المشاهد ويغادر: أضف نقطة تحرير (إشباع/انفجار عاطفي/أثر دافئ) في منتصف الحلقة أو نهايتها، بحيث يتبع كل كبتٍ تحريرٌ يقع قبل خطاف نهاية الحلقة.',
  },
  overheat: {
    ja: '第{ep}話は前後の話と連続して高テンション（張力いずれも≥84）で呼吸の余白がありません：本話の前半に低張力の過渡シーン（日常／温情／情報場）を置き、本当の爆点を後ろへずらして感情疲労を防いでください。',
    ko: '제{ep}화는 이웃 화와 연속 고긴장(긴장도 모두 ≥84)이라 숨 쉴 틈이 없습니다: 본화 전반에 저긴장 전환 장면(일상/온정/정보 장면)을 배치하고 진짜 폭발점을 뒤로 미뤄 감정 피로를 막으세요.',
    es: 'El ep.{ep} y sus vecinos se mantienen en tensión ≥84 sin respiro: abre con una transición de baja tensión (cotidiano / calidez / exposición) y retrasa el verdadero clímax para evitar fatiga emocional.',
    ar: 'الحلقة {ep} والحوارات المجاورة تبقى بتوتّر ≥84 بلا متنفّس: ضع مشهداً انتقالياً منخفض التوتر (يومي/دافئ/معلوماتي) في صدر الحلقة، وأخّر نقطة الانفجار الحقيقية لتفادي إرهاق المشاعر.',
  },
  flat: {
    ja: '第{ep}話の張力は{intensity}しかなく平坦すぎます：具体的な衝突か即時爽点（反転／現証返り討ち／身分制圧）を1つ増やし、終尾フックを強いサスペンスに格上げして中盤の離脱を防いでください。',
    ko: '제{ep}화 긴장도는 {intensity}뿐이라 너무 평탄합니다: 구체적 갈등이나 즉각 쾌점(반전/현장 반증/신분 제압)을 하나 더하고, 결말 훅을 강한 서스펜스로 올려 중반 이탈을 막으세요.',
    es: 'La tensión del ep.{ep} es solo {intensity}, demasiado plana: añade un conflicto concreto o una recompensa inmediata (giro / desmentida / aplastamiento por estatus) y sube el gancho final a un suspenso fuerte para no perder al público en el tramo medio.',
    ar: 'توتر الحلقة {ep} هو {intensity} فقط، مسطّح أكثر من اللازم: أضف صراعاً ملموساً أو إشباعاً فورياً (انقلاب/صفعة/قمع بالمنصب)، وارقَ خطاف النهاية إلى تشويق قوي لمنع التسرّب في منتصف العمل.',
  },
  level: {
    ja: '第{ep}話は前後の話と張力がほぼ同じで起伏に欠けます：「先抑後放」または「偽の平穏→突発」で本話の三拍を並べ替え、前後の話との感情差をつけてください。',
    ko: '제{ep}화는 이웃 화와 긴장도가 거의 같아 기복이 부족합니다: ‘먼저 누르고 풀기’ 또는 ‘가짜 평온→돌발’로 본화 세 비트를 재배열해 앞뒤 화와 감정 차이를 만드세요.',
    es: 'El ep.{ep} está casi al mismo nivel que sus vecinos y la curva carece de variación: reordena sus tres beats como «oprimir→liberar» o «falsa calma→giro súbito» para abrir el contraste emocional con los episodios vecinos.',
    ar: 'الحلقة {ep} متساوية تقريباً مع جاراتها وتفتقر المنحنى إلى الصعود والهبوط: أعد ترتيب الضربات الثلاث على نمط «كبّت ثم حرّر» أو «هدوء زائف ثم مفاجأة» لتوسيع الفارق العاطفي مع الحلقات المجاورة.',
  },
};

const DIM_LABEL: Record<ExtLang, string> = {
  ja: '筋書き', ko: '플롯', es: 'Trama', ar: 'الحبكة',
};

function beatName(id: string, fallbackEn: string, lang: StrategyUiLang): string {
  if (lang === 'zh') return ''; // zh 保留引擎原名，调用方处理
  return localizeBeatEntry(id, lang, { name: fallbackEn, definition: '', example: '' }).name;
}

/** 波形点内节拍名本地化：zh 原样、en 取 nameEn、其余四语取 beat 字典，缺译回退英文 */
export function localizeEmotionWave<T extends EmotionWave>(wave: T, lang: StrategyUiLang): T {
  const l = normalizeUiLang(lang);
  if (l === 'zh') return wave;
  const rename = (b: { id: string; name: string; nameEn: string }) => {
    if (l === 'en') return { ...b, name: b.nameEn };
    return { ...b, name: beatName(b.id, b.nameEn, l) || b.nameEn };
  };
  return {
    ...wave,
    points: wave.points.map((p) => ({
      ...p,
      path: p.path.map(rename),
      reversal: p.reversal ? rename(p.reversal) : null,
      payoffs: p.payoffs.map(rename),
    })),
  };
}

/** 单条改稿建议六语：zh/en 用引擎原文，其余按 ruleKind 模板渲染 */
export function localizeWaveAdvice(advice: WaveAdvice, wave: EmotionWave, lang: StrategyUiLang): WaveAdvice {
  const l = normalizeUiLang(lang);
  if (l === 'zh') return advice;
  if (l === 'en') return { ...advice, dimLabel: advice.dimLabelEn, advice: advice.adviceEn };
  const p = wave.points[advice.ep - 1];
  const pathStr = (p?.path ?? []).map((q) => beatName(q.id, q.nameEn, l) || q.nameEn).join('→');
  const tpl = TEMPLATES[advice.ruleKind]?.[l] ?? advice.adviceEn;
  const text = tpl.replaceAll('{ep}', String(advice.ep)).replaceAll('{intensity}', String(p?.intensity ?? '')).replaceAll('{path}', pathStr);
  return { ...advice, dimLabel: DIM_LABEL[l], advice: text };
}

export function localizeWaveAdviceList(advices: WaveAdvice[], wave: EmotionWave, lang: StrategyUiLang): WaveAdvice[] {
  return advices.map((a) => localizeWaveAdvice(a, wave, lang));
}

export function waveI18nCoverage(): { missing: string[]; covered: number } {
  const missing: string[] = [];
  let covered = 0;
  (Object.keys(TEMPLATES) as RuleKind[]).forEach((k) => {
    (['ja', 'ko', 'es', 'ar'] as ExtLang[]).forEach((l) => {
      if (!TEMPLATES[k]?.[l]) missing.push(`${k}/${l}`);
      else covered++;
      if (!DIM_LABEL[l]) missing.push(`dim/${l}`);
      else covered++;
    });
  });
  return { missing, covered };
}
