/**
 * v2.80 追更"上集回顾"生成器（Recap Builder）
 * ------------------------------------------------------------------
 * 从结构化引擎数据（节拍 plan 的装置 id + 秘密账本揭示主题 + 人物状态桥接）
 * 确定性拼装 1-2 句上集回顾，供连载页/分享卡/导出文档使用。
 * 与 scene-padding-check 的"反 recap_dump"不冲突：那是剧内台词复述注水；
 * 这是平台页外挂卡片，观众主动需要，不占剧内时长。
 * 输入零 LLM、零 IO、可复现；中英双语：英文层零中文（揭示主题为中文词表，英文回顾跳过该项）。
 */
import { beatNameOf } from './beat-system';
import { BEAT_NAME_EN } from './emotion-wave';
import { CHAR_STATE_META, type CharStateId } from './character-state-ledger';

export type RbLang = 'zh' | 'en';

export interface RecapSource {
  epNo: number;
  title?: string | null;
  /** 本集反转装置 id（beat plan） */
  reversalId?: string | null;
  /** 本集爽点装置 id 列表（beat plan） */
  payoffIds?: string[];
  /** 本集情绪主轴 id（emotionPath 头部） */
  emotionId?: string | null;
  /** 集尾钩子一句（可空，超 40 字截断） */
  cliffhanger?: string | null;
  /** 本集揭示的秘密主题（secret-ledger 中文词表） */
  revealedTopics?: string[];
  /** 本集完成桥接的人物状态 id（character-state-ledger） */
  bridgedStates?: CharStateId[];
}

export interface RecapResult {
  epNo: number;
  /** 中文回顾（1-2 句） */
  text: string;
  /** 英文回顾（零中文；揭示主题为中文词表故跳过该项） */
  textEn: string;
}

/** 节拍名：zh 用 beat-system；en 用 emotion-wave 英文名表（回退 id，保证零中文） */
function beatName(id: string, lang: RbLang): string {
  if (lang === 'en') return BEAT_NAME_EN[id] ?? beatNameOf(id, 'en') ?? id;
  return beatNameOf(id, 'zh') || id;
}

function clip40(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

/**
 * 拼装上集回顾。无任何可用素材时回退到诚实的中性句（不编造情节）。
 */
export function buildRecap(src: RecapSource, lang: RbLang = 'zh'): RecapResult {
  const epNo = Math.max(1, Math.round(src.epNo) || 1);
  const payoffIds = (src.payoffIds ?? []).filter(Boolean).slice(0, 4);
  const revealedTopics = (src.revealedTopics ?? []).filter(Boolean).slice(0, 3);
  const bridgedStates = (src.bridgedStates ?? []).filter(Boolean).slice(0, 3);

  // —— 中文层（单一事实源） ——
  const zhParts: string[] = [];
  if (src.reversalId) zhParts.push(`剧情在「${beatName(src.reversalId, 'zh')}」处急转`);
  if (payoffIds.length) {
    const names = payoffIds.slice(0, 2).map((id) => beatName(id, 'zh'));
    zhParts.push(`爽点兑现：${names.join('、')}${payoffIds.length > 2 ? '等' : ''}`);
  }
  if (src.emotionId) zhParts.push(`情绪主轴走「${beatName(src.emotionId, 'zh')}」`);
  if (revealedTopics.length) zhParts.push(`「${revealedTopics.join('」「')}」的真相揭开`);
  if (bridgedStates.length) {
    zhParts.push(`${bridgedStates.map((s) => CHAR_STATE_META[s].zh).join('、')}有了交代`);
  }
  if (src.cliffhanger && src.cliffhanger.trim()) zhParts.push(`悬念停在：${clip40(src.cliffhanger)}`);
  const headZh = `上集回顾 · 第${epNo}集${src.title ? `《${src.title}》` : ''}：`;
  const text = zhParts.length ? headZh + zhParts.join('；') + '。' : `${headZh}主线剧情推进。`;

  // —— 英文层（零中文：标题/揭示主题为中文词表，跳过） ——
  const enParts: string[] = [];
  if (src.reversalId) enParts.push(`the story pivots on "${beatName(src.reversalId, 'en')}"`);
  if (payoffIds.length) {
    const names = payoffIds.slice(0, 2).map((id) => beatName(id, 'en'));
    enParts.push(`payoffs landed: ${names.join(', ')}${payoffIds.length > 2 ? ', and more' : ''}`);
  }
  if (src.emotionId) enParts.push(`emotional throughline: "${beatName(src.emotionId, 'en')}"`);
  if (bridgedStates.length) {
    enParts.push(`resolved: ${bridgedStates.map((s) => CHAR_STATE_META[s].en).join(', ')}`);
  }
  if (src.cliffhanger && src.cliffhanger.trim()) enParts.push(`cliffhanger: ${clip40(src.cliffhanger)}`);
  const headEn = `Previously: Ep${epNo} — `;
  const textEn = enParts.length ? headEn + enParts.join('; ') + '.' : `${headEn}the main plot advances.`;

  return { epNo, text, textEn };
}
