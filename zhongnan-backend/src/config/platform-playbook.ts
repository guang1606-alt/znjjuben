/**
 * 平台方法论卡（抖音集团短剧版权中心·真人短剧官方口径，2026 下半年）
 * 来源：官方真人短剧剧本合作交流会公开分享（可追溯，非臆测）：
 *  1) 真人短剧五大激励通道：自动叠加、不设上限；
 *  2) 女频在成熟品类内做“表达升级”，男频从单一情绪唤起转向“规则与主线竞争”，关注四要点；
 *  3) 行业进入精品化/系列化/群像化，情绪从“强度”走向“深度”，关注七要素。
 * 全部结构化为纯函数，供市场分析师、质量评分、投稿价值评估直接调用、可测试。
 */

// —— 1. 五大激励通道（分成追加 %，可叠加、不设上限）——
export interface IncentiveInput {
  categoryBoostPct?: number;   // 品类激励：命中八大优势品类 +10 / +20（由标签 BOOST 得出）
  seriesSeason?: 2 | 3;        // 系列剧：第二季 +20、第三季 +30
  qualityBoostPct?: number;    // 优质短剧：90天自然流量免费模式累计收入超200万的首播剧 +8~15（单部封顶150万）
  filmIpSLevel?: boolean;      // 传统影视IP改编且内容达S级 +15~20
  nativeBoostPct?: number;     // 抖音原生自然流量激励：覆盖全品类 +5~25
}
export interface IncentiveLine { channel: string; pct: number; note: string }
export interface IncentiveResult { totalPct: number; lines: IncentiveLine[]; capNote?: string }

export function incentiveStack(inp: IncentiveInput = {}): IncentiveResult {
  const lines: IncentiveLine[] = [];
  if (inp.categoryBoostPct) lines.push({ channel: '品类激励', pct: inp.categoryBoostPct, note: '命中八大真人优势品类' });
  if (inp.seriesSeason === 2) lines.push({ channel: '系列剧第二季', pct: 20, note: '续季化追加' });
  if (inp.seriesSeason === 3) lines.push({ channel: '系列剧第三季', pct: 30, note: '续季化追加，高于第二季' });
  if (inp.qualityBoostPct) lines.push({ channel: '优质短剧', pct: inp.qualityBoostPct, note: '90天免费自然流量累计收入超200万的首播剧' });
  if (inp.filmIpSLevel) lines.push({ channel: '影视IP改编(S级)', pct: 17.5, note: '传统影视IP改编、内容达S级，区间15~20取中值17.5' });
  if (inp.nativeBoostPct) lines.push({ channel: '抖音原生自然流量', pct: inp.nativeBoostPct, note: '覆盖全部品类' });
  const totalPct = lines.reduce((s, x) => s + x.pct, 0); // 自动叠加、不设上限
  const capNote = inp.qualityBoostPct ? '优质短剧激励单部封顶150万元' : undefined;
  return { totalPct: Math.round(totalPct * 10) / 10, lines, capNote };
}

// —— 2. 女频：成熟品类内部“表达升级”（不换赛道，换表达方式）——
export const FEMALE_MATURE = ['大女主', '都市情感', '职场', '古风言情'] as const;
export const FEMALE_NEW_SPACE = ['悬疑', '情感', '现实主义'] as const;
export function femaleUpgradeBrief(): string {
  return `女频为稳定主盘，不盲目换赛道，在成熟品类(${FEMALE_MATURE.join('、')})内做表达方式升级；同时为${FEMALE_NEW_SPACE.join('、')}等新方向留空间。`;
}

// —— 3. 男频四要点：卖点清晰 / 目标明确 / 情绪回报浓烈 / 设定转化为有效视觉呈现 ——
export interface MaleFreqSignals { sellingPoint?: boolean; clearGoal?: boolean; emotionPayoff?: boolean; visualizedSetting?: boolean }
export const MALE_FREQ_QUESTIONS = [
  { key: 'sellingPoint', label: '卖点是否清晰（一句话能说清爽点钩子）' },
  { key: 'clearGoal', label: '主角目标是否明确（想要什么、阻碍是什么）' },
  { key: 'emotionPayoff', label: '情绪回报是否足够浓烈（压抑-兑现的落差够大）' },
  { key: 'visualizedSetting', label: '设定是否转化为具体有效的视觉呈现（规则/金手指看得见）' },
] as const;
export function maleFrequencyCheck(s: MaleFreqSignals = {}): { ok: boolean; missing: string[]; advice: string } {
  const missing = MALE_FREQ_QUESTIONS.filter((q) => !s[q.key as keyof MaleFreqSignals]).map((q) => q.label);
  return {
    ok: missing.length === 0,
    missing,
    advice: missing.length ? `男频竞争在“规则与主线”，请补强：${missing.join('；')}` : '男频四要点齐备，主线与规则竞争成立',
  };
}

// —— 4. 精品化/系列化/群像化：内容七要素 + 情绪从强度到深度 ——
export const SEVEN_ELEMENTS = ['事层结构', '题材', '产业', '领域', '核心关系', '主角路径', '情绪回报'] as const;
export function sevenElementCheck(present: string[] = []): { covered: string[]; missing: string[]; completenessPct: number } {
  const has = new Set(present);
  const covered = SEVEN_ELEMENTS.filter((e) => has.has(e));
  const missing = SEVEN_ELEMENTS.filter((e) => !has.has(e));
  return { covered: [...covered], missing: [...missing], completenessPct: Math.round((covered.length / SEVEN_ELEMENTS.length) * 100) };
}
export const EMOTION_DEPTH_NOTE = '情绪仍是第一驱动力，但观众要求正从“强度”走向“深度”：用双向治愈、默默守护、质朴善意等关系沉淀替代单纯高强度刺激（与“情绪→情感驱动”审计一致）。';

// —— 5. 活人感/接地气（破亿短剧方法论 + 《北往》“用真诚换真心”）——
// AI 剧本最大的敌人是“假”，以下六要素是“像真人活着”的可检验清单
export const ALIVENESS_ELEMENTS = [
  { key: 'livelihood', label: '生计落地：角色有具体职业/收入/花钱算计，钱怎么来怎么花看得见' },
  { key: 'motive', label: '真实动机：有私心、会犹豫、会权衡，不伟光正、不工具化' },
  { key: 'speech', label: '说人话：口语、口头禅、会打断会重复，不端着不朗诵' },
  { key: 'action', label: '生活流动作：边做事边说话，手上动作不停，场景有烟火气' },
  { key: 'flaw', label: '缺点破绽：会出错、会尴尬、会嘴硬心软，不完美才可信' },
  { key: 'boundary', label: '关系分寸：亲疏有别，不第一次见面就掏心掏肺' },
] as const;
export function alivenessCheck(present: string[] = []): { covered: string[]; missing: string[]; completenessPct: number; advice: string } {
  const has = new Set(present);
  const covered = ALIVENESS_ELEMENTS.filter((e) => has.has(e.key)).map((e) => e.key);
  const missing = ALIVENESS_ELEMENTS.filter((e) => !has.has(e.key)).map((e) => e.label);
  return {
    covered, missing, completenessPct: Math.round((covered.length / ALIVENESS_ELEMENTS.length) * 100),
    advice: missing.length ? `活人感不足，补：${missing.slice(0, 3).join('；')}` : '活人感六要素齐备，角色立得住、接地气',
  };
}

// —— 6. 回归观众：最后拼的不是谁更会做内容，而是谁更懂观众 ——
export const AUDIENCE_FIRST = [
  { key: 'who', label: '为谁写：目标受众画像清晰（性别/年龄/地域/处境）' },
  { key: 'compensation', label: '情绪代偿：观众现实里缺什么，这剧替他兑现什么' },
  { key: 'entry', label: '代入门槛：前3秒观众能否把自己代入主角处境' },
  { key: 'payoff', label: '回报承诺：看下去能得到爽感/治愈/解气/情感寄托中的哪一种' },
] as const;
export function audienceFirstCheck(present: string[] = []): { missing: string[]; advice: string } {
  const has = new Set(present);
  const missing = AUDIENCE_FIRST.filter((e) => !has.has(e.key)).map((e) => e.label);
  return { missing, advice: missing.length ? `懂观众四问缺：${missing.join('；')}` : '懂观众四问齐备' };
}

// —— 7. 跨文化/跨地域反差（《少夫人来自东北》成功要素，联动地域文化卡）——
/** 跨文化三要素：差异产生戏剧、但不丑化任何一方、最终以真诚达成理解 */
export function crossCultureBrief(fromRegion?: string, toEnv?: string): string {
  const a = fromRegion ? `来自${fromRegion}的人物` : '带着鲜明地域文化的人物';
  const b = toEnv ? `进入${toEnv}的异质环境` : '进入一个文化习惯截然不同的环境';
  return [
    `跨文化反差：${a}${b}，用语言习惯、处事方式、价值观的错位制造天然戏剧冲突与喜感；`,
    '反差不丑化：笑点来自文化差异本身，双方都有尊严与道理，严禁地域黑、丑化、刻板矮化（与地域文化卡 taboos 一致）；',
    '真诚打底：差异最终靠“真诚换真心”走向理解/融合/彼此成就，让跨文化成为情感线而非猎奇噱头。',
  ].join('\n');
}

// —— 8. 优质稀缺题材定向扶持（真人短剧系列化、稀缺题材定向扶持）——
// 只沉淀“方向与逻辑”，不臆造具体扶持金额；数值以后台/官方激励规则为准（incentiveStack）
export const SCARCE_GENRES = [
  { id: 'realism_life', name: '现实主义民生', keywords: ['现实', '民生', '市井', '底层', '打工', '乡土'], why: '贴近真实生活、政策友好、差异化于霸总甜宠红海' },
  { id: 'heritage', name: '非遗/传统文化', keywords: ['非遗', '传统', '国风', '戏曲', '手艺', '文物'], why: '文化价值高、易获定向扶持与文旅联动' },
  { id: 'scifi', name: '科幻/近未来', keywords: ['科幻', '未来', 'AI', '末世', '星际', '赛博'], why: '真人短剧稀缺，形式增量空间大' },
  { id: 'profession', name: '行业剧(律政/医疗/应急)', keywords: ['律政', '医疗', '医生', '律师', '消防', '应急', '刑侦'], why: '专业壁垒高、精品化方向、男女性别通吃' },
  { id: 'silver', name: '银发题材', keywords: ['银发', '养老', '老年', '黄昏恋', '退休'], why: '人口结构增量人群，竞争极少' },
  { id: 'male_premium', name: '男性向精品', keywords: ['男频', '战神', '规则怪谈', '硬核', '商战'], why: '男频供给不足、从单一情绪转向规则主线竞争' },
  { id: 'rural', name: '乡村振兴', keywords: ['乡村', '返乡', '振兴', '新农人', '扶贫'], why: '主旋律扶持、接地气' },
  { id: 'cultural_tourism', name: '文旅融合', keywords: ['文旅', '地方', '城市', '景区', '地域美食'], why: '与地方文旅联动、商业定制空间' },
] as const;
export function matchScarce(tags: string[] = []) {
  const hit = SCARCE_GENRES.filter((g) => g.keywords.some((k) => tags.join('|').includes(k)) || tags.includes(g.name));
  return hit.map((g) => ({ id: g.id, name: g.name, why: g.why }));
}

// —— 9. 系列化创作健康度（鼓励系列化：续季 S2/S3 有叠加激励）——
export interface SeriesInput { hasRecurringCharacters?: boolean; worldExpandable?: boolean; mainlineEscalates?: boolean; season?: number }
export function seriesDesignCheck(s: SeriesInput = {}): { ok: boolean; missing: string[]; advice: string; season: number } {
  const missing: string[] = [];
  if (!s.hasRecurringCharacters) missing.push('核心人物/CP可延续（续季观众是冲着人回来的）');
  if (!s.worldExpandable) missing.push('世界观可扩容（留有新场景/新势力/新地图的空间）');
  if (!s.mainlineEscalates) missing.push('主线能升级（每季矛盾体量递增，不重复第一季套路）');
  return {
    ok: missing.length === 0, missing, season: s.season ?? 1,
    advice: missing.length
      ? `要做系列化先补：${missing.join('；')}。系列化可叠加续季激励（S2+20%/S3+30%，见 incentiveStack），并更易获得稀缺题材定向扶持`
      : '系列化骨架成立，可规划 S2/S3，人物延续+世界观扩容+主线升级',
  };
}

// —— 10. 创新增量阶梯：短剧创新不只是单部红利，更开辟增量赛道 ——
export const INNOVATION_LADDER = [
  { layer: '题材增量', desc: '在成熟品类做表达升级，或开辟稀缺/蓝海题材（非遗、银发、行业、科幻）' },
  { layer: '形式增量', desc: '互动分支、竖屏电影质感、单元剧、戏中戏、伪纪录片等新形态' },
  { layer: '人群增量', desc: '银发、男性向精品、下沉/高线分层、海外多语种本地化人群' },
  { layer: '技术/产业增量', desc: 'AIGC降本增效、IP联动、文旅/品牌定制、系列化IP资产沉淀' },
] as const;
/** 给定现有标签，返回最值得开辟的增量方向（去重、按与现状的互补性提示） */
export function innovationPaths(tags: string[] = []): string[] {
  const joined = tags.join('|');
  const out: string[] = [];
  if (!/互动|分支|多结局/.test(joined)) out.push('形式增量：可尝试互动分支/多结局，提升参与与复玩');
  if (!matchScarce(tags).length) out.push('题材增量：当前偏红海，可叠加一个稀缺题材元素做差异化');
  if (!/海外|出海|Werewolf|CEO/.test(joined)) out.push('人群增量：同一故事可做海外多语种本地化版本（出海标签体系已就位）');
  out.push('产业增量：把单部沉淀为可系列化的IP资产（人物/世界观可延续）');
  return out;
}

// —— 11. 真情感（《云缈》：好故事与真情感是值得探索的方向）——
// 区分“真情感”与“靠配乐/台词硬煽”：情感必须长在人物处境里、有铺垫、且克制
export function trueEmotionCheck(e: { groundedInPlight?: boolean; hasForeshadow?: boolean; restrained?: boolean } = {}) {
  const missing: string[] = [];
  if (!e.groundedInPlight) missing.push('情感是否长在人物真实处境与选择上（而非旁白/配乐硬催泪）');
  if (!e.hasForeshadow) missing.push('爆发前是否有足够铺垫与细节伏笔（没有铺垫的哭是尬煽）');
  if (!e.restrained) missing.push('表达是否克制（留白比喊出来更打人，与节奏呼吸感一致）');
  return { ok: missing.length === 0, missing, advice: missing.length ? `真情感待加强：${missing.join('；')}` : '真情感成立：处境生根、伏笔到位、表达克制' };
}
