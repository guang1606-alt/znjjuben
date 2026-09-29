/**
 * 爆款逆向工程引擎（PRD 3.8·独创）
 * 只复用“可迁移的创作方法论骨架”，绝不复制原创表达。
 *  analyzeHit：拆解黄金三秒钩子类型、爽点密度与排布、反转节点、节奏/情绪曲线、人设反差、标签
 *  plagiarismCheck：新文本 vs 原爆款的 n-gram 重合率与最长连续照抄，给安全/预警/高风险
 *  reuseBrief：只吃抽象骨架 + 新设定，产出全新创作 brief，从机制上与原文文字隔离
 */

export interface Episode { title?: string; text: string }
export interface HitAnalysis {
  hookType: string;
  hookEvidence: string[];
  coolPoints: { perEpisode: number[]; total: number; densityPer100: number; episodeGaps: number[] };
  reversals: { episode: number; count: number }[];
  tensionCurve: number[];      // 每集 0-100
  personaContrast: string;
  tags: string[];
  skeleton: MethodSkeleton;
}
export interface MethodSkeleton {
  hookType: string;
  episodeBeats: string[];      // 每集功能（抽象标签，不含原句）
  coolRhythm: number[];        // 爽点节奏（相对密度）
  reversalAtEpisode: number[];
  personaContrast: string;
}

const HOOK_RULES: Record<string, string[]> = {
  身份错位: ['赘婿', '真假千金', '扫地出门', '隐藏身份', '回归', '首富', '继承人', '弃少', '替身'],
  危机开局: ['车祸', '病危', '绑架', '火灾', '重生', '睁眼', '坠楼', '中毒', '临死'],
  强冲突: ['耳光', '下跪', '羞辱', '嘲讽', '退婚', '分手', '背叛', '赶出', '逼婚'],
  悬念钩子: ['秘密', '真相', '没想到', '竟然', '谁知', '到底是谁', '谜团'],
  利益逆袭: ['继承', '遗嘱', '千亿', '合同', '翻盘', '破产', '欠条', '股权'],
};
// v1.90 英文源文本检测表（标签与中文一一对应）
const HOOK_RULES_EN: Record<string, string[]> = {
  'Identity mismatch': ['hidden heir', 'secret identity', 'disguised', 'switched at birth', 'unrecognized', 'billionaire heir', 'stand-in', 'impostor'],
  'Crisis opening': ['car crash', 'dying', 'kidnapped', 'fire', 'reborn', 'woke up', 'poisoned', 'last breath', 'ambulance'],
  'Hard conflict': ['slap', 'kneel', 'humiliat', 'mock', 'called off the wedding', 'breakup', 'betray', 'kicked out', 'forced marriage'],
  'Mystery hook': ['secret', 'truth', 'little did', 'who on earth', 'mystery', 'unknown', 'turns out'],
  'Fortune reversal': ['inherit', 'will', 'billion', 'contract', 'comeback', 'bankrupt', 'iou', 'equity', 'shares'],
};
const COOL_WORDS = ['打脸', '逆袭', '反转', '复仇', '揭穿', '高光', '翻盘', '碾压', '霸气', '真相大白', '扬眉吐气', '反杀', '清算', '跪舔', '震惊'];
const COOL_WORDS_EN = ['comeuppance', 'underdog', 'twist', 'revenge', 'expose', 'showdown', 'comeback', 'crush', 'badass', 'truth revealed', 'counter-kill', 'reckoning', 'kneel', 'shock'];
const REV_WORDS = ['没想到', '谁知', '原来', '竟然', '殊不知', '然而', '就在此时', '反转', '结果却', '岂料'];
const REV_WORDS_EN = ['little did', 'who knew', 'it turned out', 'unexpectedly', 'however', 'just then', 'twist', 'but instead', 'who would have thought'];
const CONTRAST_RULES: Record<string, string[]> = {
  '低位→隐藏高位(扮猪吃虎)': ['赘婿', '弃少', '扫地出门', '隐藏身份', '首富', '继承人'],
  '受害→强势反杀(复仇逆袭)': ['背叛', '退婚', '羞辱', '复仇', '反杀', '清算'],
  '落魄→命运翻盘(金手指)': ['破产', '重生', '遗嘱', '继承', '翻盘', '系统'],
};
const CONTRAST_RULES_EN: Record<string, string[]> = {
  'Low position → hidden power (hiding strength)': ['hidden heir', 'disguised', 'kicked out', 'secret identity', 'billionaire', 'heir'],
  'Victim → decisive counter-strike (revenge)': ['betray', 'called off', 'humiliat', 'revenge', 'counter', 'reckoning'],
  'Rock bottom → fate reversal (golden finger)': ['bankrupt', 'reborn', 'will', 'inherit', 'comeback', 'system'],
};
export type HitLang = 'zh' | 'en';

function countHits(text: string, words: string[]): { n: number; hit: string[] } {
  const hit: string[] = [];
  let n = 0;
  for (const w of words) {
    const m = text.split(w).length - 1;
    if (m > 0) { n += m; hit.push(w); }
  }
  return { n, hit };
}

export function analyzeHit(episodes: Episode[], lang: HitLang = 'zh'): HitAnalysis {
  const en = lang === 'en';
  const open = (episodes[0]?.text || '').slice(0, 200);
  const hookRules = en ? HOOK_RULES_EN : HOOK_RULES;
  const coolWords = en ? COOL_WORDS_EN : COOL_WORDS;
  const revWords = en ? REV_WORDS_EN : REV_WORDS;
  const contrastRules = en ? CONTRAST_RULES_EN : CONTRAST_RULES;
  const openLow = en ? open.toLowerCase() : open;
  let hookType = en ? 'Generic setup' : '常规铺垫';
  let hookEvidence: string[] = [];
  for (const [t, ws] of Object.entries(hookRules)) {
    const h = countHits(openLow, en ? ws.map((w) => w.toLowerCase()) : ws);
    if (h.n > 0) { hookType = t; hookEvidence = h.hit; break; }
  }

  const perEpisode: number[] = [];
  const reversals: { episode: number; count: number }[] = [];
  const tensionCurve: number[] = [];
  const episodeBeats: string[] = [];
  const reversalAtEpisode: number[] = [];
  let totalWords = 0;
  let totalCool = 0;

  episodes.forEach((ep, i) => {
    const epText = en ? ep.text.toLowerCase() : ep.text;
    const len = ep.text.replace(/\s/g, '').length || 1;
    totalWords += len;
    const cool = countHits(epText, coolWords).n;
    perEpisode.push(cool);
    totalCool += cool;
    const rev = countHits(epText, revWords).n;
    if (rev > 0) { reversals.push({ episode: i, count: rev }); reversalAtEpisode.push(i); }
    // 张力：开篇钩子 + 爽点密度 + 反转，归一到 0-100
    const coolScore = Math.min(50, (cool / len) * 1200);
    const revScore = Math.min(30, rev * 10);
    const genericHook = en ? 'Generic setup' : '常规铺垫';
    const hookScore = i === 0 && hookType !== genericHook ? 20 : 0;
    tensionCurve.push(Math.round(Math.min(100, coolScore + revScore + hookScore)));
    // 抽象功能节拍（只打标签，不存原句）
    const beats: string[] = [];
    if (i === 0) beats.push(en ? 'Opening hook' : '开场钩子');
    if (cool >= 2) beats.push(en ? 'Dense payoff' : '爽点密集');
    else if (cool === 1) beats.push(en ? 'Single release' : '单点释放');
    else beats.push(en ? 'Build pressure' : '铺垫蓄压');
    if (rev > 0) beats.push(en ? 'Reversal' : '反转');
    if (i === episodes.length - 1) beats.push(en ? 'Episode-end hook' : '集尾钩子');
    episodeBeats.push(beats.join(en ? ' + ' : '+'));
  });

  const gaps: number[] = [];
  let last = -1;
  perEpisode.forEach((c, i) => { if (c > 0) { if (last >= 0) gaps.push(i - last); last = i; } });

  const allText = en ? episodes.map((e) => e.text.toLowerCase()).join('') : episodes.map((e) => e.text).join('');
  let personaContrast = en ? 'No clear contrast detected' : '未识别明显反差';
  for (const [t, ws] of Object.entries(contrastRules)) {
    if (countHits(allText, en ? ws.map((w) => w.toLowerCase()) : ws).n >= 2) { personaContrast = t; break; }
  }
  const tags = Array.from(new Set([...hookEvidence, ...countHits(allText, coolWords).hit])).slice(0, 8);
  const maxCool = Math.max(1, ...perEpisode);

  return {
    hookType, hookEvidence,
    coolPoints: { perEpisode, total: totalCool, densityPer100: +(totalCool / totalWords * 100).toFixed(2), episodeGaps: gaps },
    reversals, tensionCurve, personaContrast, tags,
    skeleton: {
      hookType, episodeBeats,
      coolRhythm: perEpisode.map((c) => +(c / maxCool).toFixed(2)),
      reversalAtEpisode, personaContrast,
    },
  };
}

// ---------- 侵权/照抄校验 ----------
export interface PlagiarismReport { overlapRatio: number; longestCopy: number; risk: 'safe' | 'warn' | 'high'; copied: string[] }

function ngrams(s: string, n: number): Set<string> {
  const t = s.replace(/\s/g, '');
  const set = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n));
  return set;
}
function longestCommon(a: string, b: string, cap = 1500): number {
  const x = a.replace(/\s/g, '').slice(0, cap);
  const y = b.replace(/\s/g, '').slice(0, cap);
  let best = 0;
  const dp = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    let prev = 0;
    for (let j = 1; j <= y.length; j++) {
      const tmp = dp[j];
      dp[j] = x[i - 1] === y[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}

export function plagiarismCheck(original: string, candidate: string): PlagiarismReport {
  const o = ngrams(original, 6);
  const c = ngrams(candidate, 6);
  let shared = 0;
  const copied: string[] = [];
  c.forEach((g) => { if (o.has(g)) { shared += 1; if (copied.length < 5) copied.push(g); } });
  const overlapRatio = c.size ? +(shared / c.size).toFixed(3) : 0;
  const longestCopy = longestCommon(original, candidate);
  let risk: PlagiarismReport['risk'] = 'safe';
  if (overlapRatio >= 0.3 || longestCopy >= 12) risk = 'high';
  else if (overlapRatio >= 0.12 || longestCopy >= 8) risk = 'warn';
  return { overlapRatio, longestCopy, risk, copied };
}

// ---------- 逻辑复用：只吃骨架与新设定，产出全新 brief（不接触原文字句）----------
export interface Replacement { persona: string; setting: string; world: string }
export interface ReuseBrief { logline: string; persona: string; setting: string; world: string; hookPlan: string; coolRhythm: number[]; reversalPlanAtEpisode: number[]; isolationNote: string }

export function reuseBrief(skeleton: MethodSkeleton, rep: Replacement, lang: HitLang = 'zh'): ReuseBrief {
  if (!rep.persona || !rep.setting || !rep.world) throw new Error(lang === 'en' ? 'Persona, setting and world must all be replaced' : '必须替换人设、背景、世界观三项');
  const en = lang === 'en';
  return {
    logline: en
      ? `Reuse the structural method "${skeleton.hookType} + ${skeleton.personaContrast}" to tell a brand-new story of ${rep.persona} in ${rep.setting}, set in ${rep.world}`
      : `沿用「${skeleton.hookType} + ${skeleton.personaContrast}」的结构方法，讲述${rep.world}背景下，${rep.persona}在${rep.setting}中的全新故事`,
    persona: rep.persona, setting: rep.setting, world: rep.world,
    hookPlan: en
      ? `Open with a ${skeleton.hookType} to win the golden first three seconds, but rewrite every character, event and line`
      : `开篇用${skeleton.hookType}抓黄金三秒，但人物、事件、台词全部重写`,
    coolRhythm: skeleton.coolRhythm,
    reversalPlanAtEpisode: skeleton.reversalAtEpisode,
    isolationNote: en
      ? 'This brief reuses only abstract rhythm and hook type, carries no text from the source hit, and must still pass plagiarismCheck'
      : '本brief仅复用抽象节奏与钩子类型，未携带原爆款任何文字，需再经plagiarismCheck校验',
  };
}
