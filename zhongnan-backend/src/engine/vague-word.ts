import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * v2.80 模糊词/空心词检测（Vague Word / Hedge Detection）
 * ------------------------------------------------------------------
 * 创作能力类引擎：AI 文笔不敢下具体判断，满篇对冲语态、空心名词、模糊量词——
 * "一种说不出的感觉""似乎有什么东西""sort of somehow something"。
 * 检测**叙述行**中的模糊表达密度，定向要求 polisher 换成具体所指。
 *
 * 查重分工：
 *  - show-dont-tell.abstractAdj：检测"美丽的/神秘的"这类**评价性抽象形容词**；
 *  - 本引擎：检测**模糊/对冲/空心指代**（语态与指代空心，非评价形容词）。
 *
 * 三类：
 *  hedge   对冲语态：似乎/仿佛/好像/显得/看起来 / seemed, appeared, kind of, sort of
 *  filler  空心名词：东西/事情/玩意儿/什么的 / something, thing, stuff
 *  measure 模糊量词：某种/一种/一股/几分/些许/说不出的 / a sense of, some kind of
 *
 * 仅统计叙述行（跳过台词——口语中的"好像/那个东西"是自然的）。
 * 零 LLM、零 IO；中英双语；zh includes，en \b；en 层零中文。
 */

export type VagueType = 'hedge' | 'filler' | 'measure';

export interface VagueHit {
  word: string;
  type: VagueType;
  snippet: string;
}

export interface VagueWordResult {
  score: number;
  hits: VagueHit[];
  counts: Record<VagueType, number>;
  totalCount: number;
  narrationSentences: number;
  /** 每百句模糊词密度 */
  densityPer100: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const HEDGE_ZH = ['似乎', '仿佛', '好像', '显得', '看起来', '看样子', '多多少少', '或多或少', '隐隐约约'];
const HEDGE_EN = ['seemed', 'seeming', 'appeared', 'apparently', 'somehow', 'somewhat', 'as if', 'as though'];

const FILLER_ZH = ['东西', '事情', '玩意儿', '什么的', '之类的'];
const FILLER_EN = ['something', 'anything', 'thing', 'things', 'stuff'];

const MEASURE_ZH = ['某种', '一种', '一股', '一阵', '几分', '些许', '说不出的', '难以言喻', '莫名的', '一股脑'];
const MEASURE_EN = ['a sense of', 'some kind of', 'a kind of', 'a sort of', 'some sort of', 'an air of', 'a feeling of'];

const LEX: Record<VagueType, { zh: string[]; en: string[] }> = {
  hedge: { zh: HEDGE_ZH, en: HEDGE_EN },
  filler: { zh: FILLER_ZH, en: FILLER_EN },
  measure: { zh: MEASURE_ZH, en: MEASURE_EN },
};

const ALL_TYPES: VagueType[] = ['hedge', 'filler', 'measure'];

function extractNarration(draft: string): string[] {
  const out: string[] = [];
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (isSceneHeaderLine(line)) continue; // c213：收口共享切分器
    if (/^[^\s：:]{1,12}\s*[：:]/.test(line)) continue;
    out.push(line.replace(/^[（(\[△\s]+|[）)\]]+$/g, ''));
  }
  return out;
}

function snippetAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 6);
  const end = Math.min(text.length, idx + len + 6);
  return text.slice(start, end);
}

export function vagueWord(draft: string): VagueWordResult {
  const emptyCounts: Record<VagueType, number> = { hedge: 0, filler: 0, measure: 0 };
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], counts: emptyCounts, totalCount: 0, narrationSentences: 0, densityPer100: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const narration = extractNarration(draft).join(' ');
  const sentences = narration.split(/[。！？!?；;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 4);
  const sentenceCount = sentences.length || 1;

  const hits: VagueHit[] = [];
  const counts: Record<VagueType, number> = { ...emptyCounts };

  for (const type of ALL_TYPES) {
    const words = isZh ? LEX[type].zh : LEX[type].en;
    for (const w of words) {
      if (isZh) {
        let from = 0;
        let idx = narration.indexOf(w, from);
        while (idx !== -1) {
          counts[type]++;
          hits.push({ word: w, type, snippet: snippetAround(narration, idx, w.length) });
          from = idx + w.length;
          idx = narration.indexOf(w, from);
        }
      } else {
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(narration)) !== null) {
          counts[type]++;
          hits.push({ word: w, type, snippet: snippetAround(narration, m.index, m[0].length) });
        }
      }
    }
  }

  const totalCount = hits.length;
  const densityPer100 = Math.round((totalCount / sentenceCount) * 1000) / 10;
  // 每 10 句 >1 个模糊词开始扣分（密度>10），密度 40 封顶扣完
  const score = Math.max(0, Math.round(100 - Math.max(0, densityPer100 - 8) * 3.125));

  const typeNameZh: Record<VagueType, string> = { hedge: '对冲语态', filler: '空心名词', measure: '模糊量词' };
  const typeNameEn: Record<VagueType, string> = { hedge: 'hedges', filler: 'filler nouns', measure: 'vague measures' };

  const presentTypes = ALL_TYPES.filter((t) => counts[t] > 0);
  const issues = presentTypes.map((t) =>
    isZh
      ? `${typeNameZh[t]} ${counts[t]} 处（如"${hits.find((h) => h.type === t)!.word}"）——叙述不敢落到具体所指`
      : `${counts[t]} ${typeNameEn[t]} (e.g. "${hits.find((h) => h.type === t)!.word}") — narration avoids concrete reference`,
  );

  const advice = isZh
    ? totalCount > 0
      ? '删掉对冲与模糊指代，直接下具体判断：把"似乎有什么东西"改成所见所闻的实体（"门后传来指甲刮木头的声音"）；"一种感觉"换成具体生理反应或动作。'
      : '叙述具体、敢于落判，保持。'
    : totalCount > 0
      ? 'Cut hedges and vague references; commit to concrete detail: replace "there seemed to be something" with the actual entity/sensation, and "a sense of" with a concrete physical reaction or action.'
      : 'Narration is concrete and committed; keep it.';

  return { score, hits, counts, totalCount, narrationSentences: sentences.length, densityPer100, issues, advice };
}
