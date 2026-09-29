/**
 * 创作力引擎：反套路 + 真人编剧风格库 + 多版本差异化
 * 直接服务 PRD 2.1.1（反套路同质化治理）与 2.2（真人编剧风格化）。
 * 架构师/人设师/双校验消费本模块；学习中心吸收的新套路、新风格也沉淀到这里。
 */

export type AntiStrength = 'classic' | 'balanced' | 'innovative';
export const ANTI_STRENGTH: Record<AntiStrength, { maxHits: number; label: string }> = {
  classic: { maxHits: 4, label: '经典稳妥（允许成熟套路）' },
  balanced: { maxHits: 2, label: '均衡（老套桥段≤2）' },
  innovative: { maxHits: 0, label: '创新大胆（零容忍老套桥段）' },
};

/** 烂大街桥段库（持续扩充；命中即“同质化风险”） */
export const CLICHE_TROPES = [
  { id: 'amnesia_cancer', cat: '剧情', keywords: ['失忆', '车祸失忆', '白血病', '癌症晚期', '绝症'], alt: '用更具体、更有生活质感的困境替代万能病痛' },
  { id: 'ceo_love', cat: '人设', keywords: ['霸道总裁', '总裁爱上我', '冷面总裁', '亿万总裁'], alt: '给男主一个不依赖“有钱+霸总”的独特欲望与缺陷' },
  { id: 'substitute_bride', cat: '剧情', keywords: ['替嫁', '替身新娘', '替嫁新娘'], alt: '错位关系可以保留，但动机要反常识' },
  { id: 'war_god', cat: '人设', keywords: ['战神归来', '龙王', '殿主', '隐世高手下山'], alt: '强者回归的“强”换一个非武力维度（认知/资源/手艺）' },
  { id: 'pregnant_divorce', cat: '剧情', keywords: ['离婚当天发现怀孕', '带球跑', '五年后携子归来'], alt: '避开“离婚+怀孕”的条件反射组合' },
  { id: 'beggar_rich', cat: '反转', keywords: ['乞丐竟是', '保洁竟是董事长', '扫地僧其实是'], alt: '身份反差要埋至少3处可回看的伏笔，而非天降' },
  { id: 'system_gift', cat: '设定', keywords: ['万能系统', '神级选择系统', '签到送'], alt: '金手指要有代价与边界，不能无脑送' },
  { id: 'rebirth_revenge_all', cat: '剧情', keywords: ['重生复仇', '灭门之仇', '杀光全家'], alt: '复仇对象/手段去脸谱化，给反派自洽逻辑' },
  { id: 'slap_face_chain', cat: '节奏', keywords: ['啪啪打脸', '连环打脸', '装逼打脸'], alt: '减少机械打脸次数，把一次反转做透' },
  { id: 'evil_mil', cat: '人设', keywords: ['恶婆婆', '极品婆婆', '恶毒女配'], alt: '对立面要有可怜/可信的一面，避免纸片反派' },
  { id: 'mistress_carve', cat: '剧情', keywords: ['小三上位', '白莲花', '绿茶'], alt: '情感冲突不靠标签化女性互害' },
  { id: 'coincidence_reunion', cat: '反转', keywords: ['失散多年的亲', '青梅竹马重逢', '娃娃亲'], alt: '巧合降到最低，用选择推动而非血缘' },
] as const;

export interface ClicheResult { hits: { id: string; cat: string; found: string; alt: string }[]; noveltyScore: number; pass: boolean; }

/** 反套路扫描：strength 越激进，容忍度越低 */
export function clicheScan(text: string, strength: AntiStrength = 'balanced'): ClicheResult {
  const hits: ClicheResult['hits'] = [];
  for (const t of CLICHE_TROPES) {
    const found = t.keywords.find((k) => text.includes(k));
    if (found) hits.push({ id: t.id, cat: t.cat, found, alt: t.alt });
  }
  const noveltyScore = Math.max(0, 100 - hits.length * 18);
  const pass = hits.length <= ANTI_STRENGTH[strength].maxHits;
  return { hits, noveltyScore, pass };
}

/** 真人编剧风格库：题材 × 受众 × 地域 */
export interface StyleProfile { id: string; dim: '题材' | '受众' | '地域'; rhythm: string; dialogue: string; payoff: string; taboo: string; }
export const STYLE_LIB: StyleProfile[] = [
  { id: 'kuai_shuang', dim: '题材', rhythm: '快节奏、强冲突、每30秒一爽点', dialogue: '直白短促、金句打脸', payoff: '逆袭反杀、即时兑现', taboo: '铺垫过长、文青抒情' },
  { id: 'urban_emo', dim: '题材', rhythm: '情绪流、误会与和解交替', dialogue: '生活化、有潜台词', payoff: '情感共鸣、关系反转', taboo: '悬浮豪门、强行狗血' },
  { id: 'ancient_plot', dim: '题材', rhythm: '权谋层层递进、信息差博弈', dialogue: '半文半白、话里有话', payoff: '棋局反转、智斗胜出', taboo: '现代腔、台词过于口语' },
  { id: 'suspense', dim: '题材', rhythm: '悬念前置、每集抛谜', dialogue: '克制、留白、误导', payoff: '真相层层翻盘', taboo: '过早泄底、逻辑硬伤' },
  { id: 'hk_style', dim: '题材', rhythm: '凌厉、黑白对立、江湖气', dialogue: '粤语区质感、短句有力', payoff: '情义两难、宿命反转', taboo: '拖沓说教' },
  { id: 'mass_down', dim: '受众', rhythm: '简单直接、情绪浓度高', dialogue: '接地气、家长里短', payoff: '善恶有报、扬眉吐气', taboo: '需要动脑的复杂设定' },
  { id: 'female', dim: '受众', rhythm: '情感关系驱动、细腻', dialogue: '重感受、多内心戏外化', payoff: '自我成长、情感掌控', taboo: '女主工具化、恋爱脑无成长' },
  { id: 'male', dim: '受众', rhythm: '目标导向、升级打怪', dialogue: '兄弟情、狠话少废话', payoff: '实力碾压、地位跃升', taboo: '感情戏喧宾夺主' },
  { id: 'premium', dim: '受众', rhythm: '电影感、留白与克制', dialogue: '真实多义、拒绝喊口号', payoff: '余味与社会议题', taboo: '直白说教、低幼爽点' },
  { id: 'dongbei', dim: '地域', rhythm: '烟火气、幽默化解苦难', dialogue: '东北方言幽默、自嘲', payoff: '小人物的体面与反击', taboo: '刻意卖惨、刻板丑化' },
  { id: 'nanfang', dim: '地域', rhythm: '市井细密、人情往来', dialogue: '南方市井委婉、绵里藏针', payoff: '精明与世故的较量', taboo: '方言堆砌、地域刻板' },
  { id: 'white_collar', dim: '地域', rhythm: '职场高压、信息快', dialogue: '职场黑话与潜台词', payoff: '职场反杀、阶层跃升', taboo: '不懂职场的悬浮桥段' },
];

// v1.99 编剧风格英文要点（id 键控，一条涵盖节奏/台词/爽点/禁忌，保证英文链路零中文）
const STYLE_EN: Record<string, string> = {
  kuai_shuang: 'Fast pace, strong conflict, a payoff every ~30s; direct, punchy dialogue with mic-drop lines; instant underdog comeback; avoid long setup and artsy lyricism.',
  urban_emo: 'Emotion-driven, alternating misunderstanding and reconciliation; lifelike dialogue with subtext; emotional resonance and relationship turns; avoid detached wealth porn and forced melodrama.',
  ancient_plot: 'Layered court intrigue and information-asymmetry mind games; semi-classical, subtext-heavy speech; chessboard reversals and wit wins; avoid modern slang and overly colloquial lines.',
  suspense: 'Front-load mystery, pose a new riddle each episode; restrained, use negative space and misdirection; truth overturns in layers; avoid revealing too early and plot holes.',
  hk_style: 'Sharp, black-and-white, jianghu grit; Cantonese-flavored terse forceful lines; loyalty-vs-righteousness and fated turns; avoid dragging and preaching.',
  mass_down: 'Simple and direct, high emotional density; grounded, household-level talk; virtue rewarded and vindication; avoid complex setups that demand hard thinking.',
  female: 'Driven by emotional relationships, nuanced; feeling-first, inner life externalized; self-growth and emotional agency; avoid tool-like heroines and no-growth romance obsession.',
  male: 'Goal-oriented leveling-up; brotherhood, tough words, no fluff; strength overwhelms and status climbs; avoid romance hijacking the plot.',
  premium: 'Cinematic, restrained with breathing room; real, ambiguous dialogue, no sloganeering; aftertaste and social themes; avoid on-the-nose preaching and childish payoffs.',
  dongbei: 'Lifelike grit, humor defusing hardship; Northeastern dialect comedy and self-mockery; the little guy’s dignity and counterattack; avoid wallowing and stereotypical mockery.',
  nanfang: 'Fine-grained street life and social favors; soft, indirect speech with hidden edge; shrewdness vs worldliness; avoid dialect stacking and regional clichés.',
  white_collar: 'High-pressure workplace, fast information; office jargon and subtext; workplace counterattack and class climb; avoid out-of-touch, unrealistic office beats.',
};
export function buildStyleDirective(styleId?: string, lang: 'zh' | 'en' = 'zh'): string {
  if (!styleId) return '';
  const s = STYLE_LIB.find((x) => x.id === styleId);
  if (!s) return '';
  if (lang === 'en') return STYLE_EN[styleId] ? `\n[Assigned screenwriter style] ${STYLE_EN[styleId]}` : '';
  return `\n【指定编剧风格·${s.dim}】节奏：${s.rhythm}；台词：${s.dialogue}；爽点：${s.payoff}；禁忌：${s.taboo}。`;
}

function ngramSet(s: string, n: number): Set<string> {
  const t = s.replace(/\s/g, '');
  const set = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) set.add(t.slice(i, i + n));
  return set;
}
function jaccard(A: Set<string>, B: Set<string>): number {
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((g) => { if (B.has(g)) inter++; });
  return inter / (A.size + B.size - inter);
}
/** 中文短文本相似度：单字(抗同义词替换)+双字组(保语序)加权，识别“换汤不换药” */
export function textSimilarity(a: string, b: string): number {
  const uni = jaccard(ngramSet(a, 1), ngramSet(b, 1));
  const bi = jaccard(ngramSet(a, 2), ngramSet(b, 2));
  return Math.round((uni * 0.4 + bi * 0.6) * 100) / 100;
}

/**
 * 多版本强制差异化：同一需求的多个版本，人设/走向/核心冲突必须真的不同。
 * 任意两版相似度 > 阈值即判“换汤不换药”。
 */
export function diversityCheck(versions: { logline: string }[], threshold = 0.55): { diverse: boolean; maxSim: number; worstPair?: [number, number] } {
  let maxSim = 0; let worstPair: [number, number] | undefined;
  for (let i = 0; i < versions.length; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      const sim = textSimilarity(versions[i].logline, versions[j].logline);
      if (sim > maxSim) { maxSim = sim; worstPair = [i, j]; }
    }
  }
  return { diverse: maxSim <= threshold, maxSim: Math.round(maxSim * 100) / 100, worstPair };
}
