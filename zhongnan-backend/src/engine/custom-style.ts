/**
 * 用户私有风格学习引擎（v2.32）
 * ------------------------------------------------------------------
 * PRD 2.2「支持用户自定义风格：上传参考剧本，AI 自动学习其叙事节奏、台词风格、
 * 人物塑造方式，生成同风格剧本」的落地。与内置风格库（creativity/style-library，
 * 全体用户共享、自动生效）不同，本模块处理**单个用户自带的参考文本**：纯统计、
 * 确定性、无外部依赖；只学“节奏与语言风格指纹”，**不照搬情节与原句**（版权安全）。
 */
export type CsLang = 'zh' | 'en';

export interface CustomStyleFingerprint {
  enough: boolean;            // 样本是否足够（<100字不足以判风格）
  dialogueRatio: number;      // 台词行占比 0..1
  avgDialogueLen: number;     // 平均台词长度（字符）
  avgNarrativeLen: number;    // 平均叙述/动作行长度
  shortLineRatio: number;     // 短句（≤12字符）占比
  exclaimPer100: number;      // 每百字感叹号
  questionPer100: number;     // 每百字问号
  ellipsisPer100: number;     // 每百字省略号
  tags: string[];             // 确定性风格标签
}

const MIN_SAMPLE = 100;
const MAX_SAMPLE = 20000;

const DIALECT_MARKERS = ['咋', '俺', '呗', '嘞', '唠', '搁', '啥', '得劲', '咋整', '咱'];
const FUN_MARKERS = ['吐槽', '翻白', '无语', '哈哈', '偷笑', '嘴角一抽', '没好气', '白眼'];
const COLLOQ_PARTICLES = ['啊', '吧', '呢', '嘛', '呀', '哟', '哎', '哦'];

function round2(n: number): number { return Math.round(n * 100) / 100; }

/** 纯统计分析参考文本，输出风格指纹；样本不足返回 enough:false（调用方应忽略） */
export function analyzeCustomStyle(reference: string): CustomStyleFingerprint {
  const text = (reference || '').slice(0, MAX_SAMPLE);
  const empty: CustomStyleFingerprint = {
    enough: false, dialogueRatio: 0, avgDialogueLen: 0, avgNarrativeLen: 0,
    shortLineRatio: 0, exclaimPer100: 0, questionPer100: 0, ellipsisPer100: 0, tags: [],
  };
  if (text.replace(/\s/g, '').length < MIN_SAMPLE) return empty;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dialogueLens: number[] = [];
  const narrativeLens: number[] = [];
  for (const line of lines) {
    // 剧本常见台词形态：角色名（情绪）：台词  /  "..." / “...”
    const m = line.match(/^[^：:「]{0,12}[：:]\s*(.+)$/) || line.match(/^[“"](.+?)[”"]\s*$/);
    if (m) dialogueLens.push(m[1].length); else narrativeLens.push(line.length);
  }
  const totalLines = lines.length || 1;
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const avgDialogueLen = avg(dialogueLens);
  const avgNarrativeLen = avg(narrativeLens);
  const dialogueRatio = dialogueLens.length / totalLines;
  const shortLineRatio = lines.filter((l) => l.length <= 12).length / totalLines;
  const len100 = Math.max(1, text.replace(/\s/g, '').length / 100);
  const count = (re: RegExp) => (text.match(re) || []).length;
  const exclaimPer100 = round2(count(/[!！]/g) / len100);
  const questionPer100 = round2(count(/[?？]/g) / len100);
  const ellipsisPer100 = round2(count(/(\.\.\.|…)/g) / len100);

  const tags: string[] = [];
  // 方言烟火气
  if (DIALECT_MARKERS.some((k) => text.includes(k))) tags.push('dialect_grounded');
  // 幽默吐槽
  if (FUN_MARKERS.some((k) => text.includes(k))) tags.push('witty_banter');
  // 口语化程度：语气词密度
  const particleHits = COLLOQ_PARTICLES.reduce((s, p) => s + count(new RegExp(p, 'g')), 0);
  const colloquial = particleHits / len100;
  // 短促有力：短句多、感叹多、平均台词短
  if (shortLineRatio >= 0.45 || (avgDialogueLen > 0 && avgDialogueLen <= 16 && exclaimPer100 >= 1.2)) tags.push('punchy_short');
  // 细腻绵密：叙述行长、省略号多、语气词多
  if (avgNarrativeLen >= 34 || ellipsisPer100 >= 0.8 || colloquial >= 6) tags.push('lyrical_detailed');
  // 冷峻克制：长叙述少、叹词问号少、语气词少（与短促互补，指整体白描）
  if (exclaimPer100 < 0.5 && questionPer100 < 0.8 && colloquial < 2 && avgNarrativeLen <= 28) tags.push('restrained_cold');
  // 书面规整：平均句长偏长且语气词少
  if (colloquial < 1.5 && (avgNarrativeLen >= 30 || avgDialogueLen >= 26)) tags.push('formal_literary');
  // 对话驱动：台词行占比高
  if (dialogueRatio >= 0.6) tags.push('dialogue_driven');

  return {
    enough: true,
    dialogueRatio: round2(dialogueRatio),
    avgDialogueLen: round2(avgDialogueLen),
    avgNarrativeLen: round2(avgNarrativeLen),
    shortLineRatio: round2(shortLineRatio),
    exclaimPer100, questionPer100, ellipsisPer100,
    tags: Array.from(new Set(tags)),
  };
}

const TAG_LABEL_ZH: Record<string, string> = {
  dialect_grounded: '方言烟火气（口语词、地域表达自然点染，不堆砌）',
  witty_banter: '幽默吐槽感（人物自带调侃与内心 OS）',
  punchy_short: '短促有力（短句推进、台词利落、少长从句）',
  lyrical_detailed: '细腻绵密（动作与情绪描写充分、留白与停顿多）',
  restrained_cold: '冷峻克制（白描为主、少感叹、情绪藏在动作里）',
  formal_literary: '书面规整（句式完整、措辞讲究、语气词少）',
  dialogue_driven: '对话驱动（以台词推进剧情，叙述行精简）',
};
const TAG_LABEL_EN: Record<string, string> = {
  dialect_grounded: 'grounded regional colloquialism (sparing, natural, never piled on)',
  witty_banter: 'witty banter with dry inner commentary',
  punchy_short: 'punchy and staccato (short lines, crisp dialogue, few long clauses)',
  lyrical_detailed: 'lyrical and detailed (rich action/emotion beats, pauses and white space)',
  restrained_cold: 'restrained and cold (plain depiction, few exclamations, emotion shown through action)',
  formal_literary: 'formal and literary (complete sentences, refined wording, few filler particles)',
  dialogue_driven: 'dialogue-driven (plot moves through speech, lean narrative lines)',
};

/** 由指纹生成注入管线的风格指令；样本不足返回空串 */
export function buildCustomStyleDirective(reference: string, lang: CsLang = 'zh'): string {
  const fp = analyzeCustomStyle(reference);
  if (!fp.enough) return '';
  if (lang === 'en') {
    const tags = fp.tags.map((t) => `· ${TAG_LABEL_EN[t]}`).join('\n');
    return [
      'The user supplied a REFERENCE SCRIPT to learn style from. Match its WRITING STYLE only, never its plot, names, or original sentences (no copying):',
      `- Dialogue lines ratio ${fp.dialogueRatio}, avg dialogue length ${fp.avgDialogueLen}, avg narrative length ${fp.avgNarrativeLen}, short-line ratio ${fp.shortLineRatio}.`,
      tags || '· neutral baseline style',
      'Mirror the rhythm, sentence length and tone above; keep the current story and characters unchanged.',
    ].join('\n');
  }
  const tags = fp.tags.map((t) => `· ${TAG_LABEL_ZH[t]}`).join('\n');
  return [
    '用户提供了【参考剧本】用于学习风格：只学习其叙事节奏、句式长短与语言风格，**严禁照搬其情节、人名与原句**（避免侵权）：',
    `- 统计指纹：台词行占比 ${fp.dialogueRatio}、平均台词 ${fp.avgDialogueLen} 字、平均叙述行 ${fp.avgNarrativeLen} 字、短句占比 ${fp.shortLineRatio}。`,
    tags || '· 中性基准风格',
    '按上述节奏与语感创作，当前故事、人设保持不变。',
  ].join('\n');
}
