/**
 * 创作上下文个性化引擎（Context Personalization）
 * ---------------------------------------------------------------
 * 让“随机/推荐”既懂市场、又懂时令、更懂用户，且全程可解释（由小南告知原因）、可关闭：
 *  1) seasonalSignals  —— 时令/节日/社会事件日历（如 6 月高考、毕业季；举一反三覆盖全年）；
 *  2) trendingSignals  —— 平台（红果/抖音等）近一日上榜爆款 → 题材方向实时倾斜 + 原因；
 *  3) profileSignals   —— 用户主页地域/年龄/性别 + 修改动作 + 与小南聊天 → 持续学习偏好；
 *  4) composePersonalization —— 三路融合加权，输出推荐方向与小南解释文案。
 * 纯函数、零 IO、可离线对拍；不做越权画像，个性化可由用户在设置关闭。
 */
import { findTagByName } from '../config/tag-taxonomy';
import { matchRegion, type RegionCard } from '../config/regional-culture';

// ============ 1. 时令日历 ============
export interface SeasonalSignal {
  id: string; name: string; start: string; end: string; // MM-DD
  directions: string[];   // 建议题材/标签方向
  reason: string;         // 给小南的解释
}
// 全年关键节点（窗口内 + 前 3 天预热命中）。directions 必须是 tag-taxonomy 中真实存在的三级叶子标签名，
// 否则智能选片导演无法把时令信号落成可立项标签（已全量对齐，新增节点时请同步用 findTagByName 自检）
export const SEASONAL_CALENDAR: SeasonalSignal[] = [
  { id: 'newyear', name: '元旦跨年', start: '12-29', end: '01-03', directions: ['破镜重圆','暗恋成真','高甜撒糖'], reason: '正值跨年，观众偏爱“告别旧年、重新出发”的温暖与仪式感题材' },
  { id: 'chunyun', name: '春运返乡', start: '01-10', end: '02-15', directions: ['返乡尽孝','乡土人情','亲情和解'], reason: '春运返乡期，“回家、亲情、城乡反差”共鸣最强' },
  { id: 'spring', name: '春节阖家', start: '02-08', end: '02-20', directions: ['平凡温暖','多人群像','相亲名场面'], reason: '春节阖家，团圆、代际关系、相亲催婚类题材正当季' },
  { id: 'valentine', name: '情人节', start: '02-11', end: '02-15', directions: ['高甜撒糖','暗恋成真','双向奔赴'], reason: '情人节前后甜宠、双向奔赴题材转化高' },
  { id: 'womensday', name: '三八女性季', start: '03-05', end: '03-10', directions: ['大女主','女性觉醒','女性互助'], reason: '三八节前后女性向、大女主成长题材受平台与用户青睐' },
  { id: 'springwarm', name: '春日治愈', start: '03-15', end: '04-10', directions: ['治愈慢生活','文旅治愈公路','烟火气'], reason: '开春适合轻盈治愈、出发与相遇类故事' },
  { id: 'qingming', name: '清明追思', start: '04-02', end: '04-08', directions: ['跨越生死的思念','子欲养而亲不待','遗物里的秘密'], reason: '清明追思，亲情、生死、遗憾类高泪点题材情绪浓度正当时' },
  { id: 'mayday', name: '五一出行', start: '04-28', end: '05-05', directions: ['公路旅途','旅途奇遇','高甜撒糖'], reason: '五一假期，出行、公路、旅途邂逅类轻题材观看上升' },
  { id: 'mother', name: '母亲节', start: '05-08', end: '05-12', directions: ['亲情和解','母亲留了一辈子的东西','平凡温暖'], reason: '母亲节，母爱与亲情和解类高泪点内容最易破防' },
  { id: 'love520', name: '520表白季', start: '05-18', end: '05-21', directions: ['高甜撒糖','暗恋成真','宿敌变恋人'], reason: '520 前后甜宠、暗恋成真题材热度高' },
  { id: 'gaokao', name: '高考季', start: '06-04', end: '06-10', directions: ['校园青春','高考陪考','学霸逆袭'], reason: '正值高考，校园青春、陪考父母、奋斗改命类题材全民共情' },
  { id: 'graduate', name: '毕业季', start: '06-15', end: '07-05', directions: ['毕业遗憾','青春暗恋','初入职场'], reason: '毕业季，青春遗憾、暗恋告别、初入职场题材情绪契合' },
  { id: 'father', name: '父亲节', start: '06-13', end: '06-20', directions: ['沉默的靠山','父亲的记账本','治愈救赎'], reason: '父亲节，“沉默父爱”类细节杀题材最催泪' },
  { id: 'summer', name: '暑期档', start: '07-01', end: '08-25', directions: ['修仙升级','高甜撒糖','爽文逆袭风'], reason: '暑期学生党活跃，男频玄幻、高甜、强爽感题材进入高峰' },
  { id: 'qixi', name: '七夕', start: '08-15', end: '08-22', directions: ['古装甜宠','虐恋情深','破镜重圆'], reason: '七夕中式情人节，言情、虐恋、破镜重圆题材应景' },
  { id: 'backschool', name: '开学季', start: '08-28', end: '09-10', directions: ['校园青春','师生情谊','与自己和解'], reason: '开学季，校园、师生、成长题材回归' },
  { id: 'midautumn', name: '中秋团圆', start: '09-12', end: '09-20', directions: ['离散重逢','跨越生死的思念','人间值得'], reason: '中秋团圆，思念、离散重逢类题材情绪浓度高' },
  { id: 'national', name: '国庆家国', start: '09-28', end: '10-08', directions: ['家国情怀','先婚后爱','文旅治愈公路'], reason: '国庆长假，家国情怀、婚礼、文旅类题材正当时' },
  { id: 'chongyang', name: '重阳敬老', start: '10-20', end: '10-28', directions: ['银发养老','银发纯爱','子欲养而亲不待'], reason: '重阳敬老，银发、亲情类题材契合节点' },
  { id: 'double11', name: '双11消费季', start: '11-05', end: '11-12', directions: ['职场晋升','职场打脸','商战博弈'], reason: '双11，消费、职场逆袭、商战打脸类题材有话题度' },
  { id: 'christmas', name: '圣诞氛围', start: '12-22', end: '12-26', directions: ['高甜','高甜撒糖','暗恋成真'], reason: '圣诞氛围浓，冬日高甜、浪漫邂逅类题材受欢迎' },
];
function mmdd(date: Date): number { return (date.getMonth() + 1) * 100 + date.getDate(); } // 1 基月，与 MM-DD 对齐
function inWindow(date: Date, start: string, end: string, leadDays = 3): boolean {
  const [sm, sd] = start.split('-').map(Number); const [em, ed] = end.split('-').map(Number);
  const s = sm * 100 + sd, e = em * 100 + ed;
  const d = new Date(date); d.setDate(d.getDate() + leadDays); const cur = mmdd(d);
  if (s <= e) return cur >= s && cur <= e;   // 同年窗口
  return cur >= s || cur <= e;               // 跨年窗口（如 12-29 ~ 次年 01-03）
}
export function seasonalSignals(date: Date = new Date()): SeasonalSignal[] {
  return SEASONAL_CALENDAR.filter((x) => inWindow(date, x.start, x.end));
}

// ============ 2. 平台爆款实时倾斜（国内外多平台榜单） ============
export type BoardRegion = 'domestic' | 'overseas';
export interface BoardSource { id: string; name: string; region: BoardRegion; kinds: string[] }
/** 持续监控的国内外短剧平台/榜单（采集器按此清单抓取；联系方式/排名等不臆造，只做方向聚合） */
export const PLATFORM_BOARDS: BoardSource[] = [
  { id: 'hongguo', name: '红果短剧', region: 'domestic', kinds: ['热度榜', '飙升榜', '新书榜'] },
  { id: 'douyin', name: '抖音短剧', region: 'domestic', kinds: ['热播榜', '话题榜'] },
  { id: 'kuaishou', name: '快手星芒', region: 'domestic', kinds: ['热播榜'] },
  { id: 'fanqie', name: '番茄短剧', region: 'domestic', kinds: ['人气榜'] },
  { id: 'dianzhong', name: '点众/九州', region: 'domestic', kinds: ['投放榜'] },
  { id: 'reelshort', name: 'ReelShort', region: 'overseas', kinds: ['Trending', 'TopCharts'] },
  { id: 'dramabox', name: 'DramaBox', region: 'overseas', kinds: ['Trending'] },
  { id: 'goodshort', name: 'GoodShort', region: 'overseas', kinds: ['Ranking'] },
  { id: 'shortmax', name: 'ShortMax', region: 'overseas', kinds: ['TopList'] },
  { id: 'flextv', name: 'FlexTV', region: 'overseas', kinds: ['Hot'] },
];
export interface BoardItem { title: string; platform: string; tags: string[]; heat: number; date: Date; region?: BoardRegion }
export interface TrendingTag { tag: string; score: number; from: string[] }
export function trendingSignals(board: BoardItem[] = [], now: Date = new Date(), topN = 6, region: BoardRegion | 'all' = 'all'): TrendingTag[] {
  const pool = region === 'all' ? board : board.filter((b) => (b.region ?? 'domestic') === region);
  const agg = new Map<string, { score: number; from: Set<string> }>();
  pool.forEach((b) => {
    const ageDays = Math.max(0, (now.getTime() - b.date.getTime()) / 86400000);
    const decay = Math.exp(-ageDays / 5); // 约 5 天半衰期，越新越重
    b.tags.forEach((tag) => {
      const cur = agg.get(tag) ?? { score: 0, from: new Set<string>() };
      cur.score += b.heat * decay; cur.from.add(`${b.platform}·${b.title}`); agg.set(tag, cur);
    });
  });
  return [...agg.entries()]
    .map(([tag, v]) => ({ tag, score: Math.round(v.score * 10) / 10, from: [...v.from].slice(0, 3) }))
    .sort((a, b) => b.score - a.score).slice(0, topN);
}

// ============ 3. 用户画像/行为学习 ============
export interface UserProfile {
  region?: string; age?: number; gender?: '男' | '女' | string;
  bio?: string; pastTags?: string[]; editPreferredTags?: string[]; chatKeywords?: string[];
}
export interface ProfileSignal {
  regionCard?: RegionCard; preferredTags: string[]; audience?: string; reasons: string[];
}
export function profileSignals(p: UserProfile = {}): ProfileSignal {
  const reasons: string[] = [];
  const regionCard = matchRegion([p.region ?? '', p.bio ?? ''].join(' '));
  if (regionCard) reasons.push(`检测到你的${regionCard.name}地域背景，将强化${regionCard.name}地道的人物与生活细节`);
  // 未显式给性别/年龄时，从个人简介(bio)保守补抽，避免要求用户额外填表；显式字段永远优先
  const inferred = inferDemographic(p);
  const gender = p.gender || inferred.gender;
  const age = p.age ?? inferred.age;
  // 偏好 = 历史标签 + 编辑偏好 + 聊天关键词命中标签，按出现频次排序
  const freq = new Map<string, number>();
  [p.pastTags ?? [], p.editPreferredTags ?? [], p.chatKeywords ?? []].flat().forEach((t) => { if (t) freq.set(t, (freq.get(t) ?? 0) + 1); });
  const preferredTags = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]);
  if (preferredTags.length) reasons.push(`结合你的历史创作与修改偏好，优先靠近：${preferredTags.slice(0, 4).join('、')}`);
  let audience: string | undefined;
  if (gender === '女') audience = '女性向'; else if (gender === '男') audience = '男性向';
  if (age != null) { if (age <= 24) audience = (audience ?? '') + 'Z世代'; else if (age >= 50) audience = (audience ?? '') + '银发向'; }
  if (audience) reasons.push(`按你的画像匹配${audience}受众的表达习惯`);
  return { regionCard, preferredTags, audience: audience || undefined, reasons };
}

// 从简介文本保守推断性别/年龄段（仅在用户未显式填写时兜底，宁可不推断也不乱贴标签）
const FEMALE_HINTS = ['女生', '女性', '女孩', '女士', '宝妈', '妈妈', '姐姐', '阿姨', '人妻', '孕妈'];
const MALE_HINTS = ['男生', '男性', '男孩', '男士', '大叔', '哥哥', '直男', '爸爸', '老爸'];
const GENERATION_AGE: Record<string, number> = { '00后': 21, '95后': 26, '90后': 31, '85后': 36, '80后': 41, '70后': 51, '60后': 61 };
export function inferDemographic(p: UserProfile = {}): { gender?: '男' | '女'; age?: number } {
  if (p.gender || p.age != null) {
    const out: { gender?: '男' | '女'; age?: number } = {};
    if (p.gender) out.gender = p.gender as '男' | '女';
    if (p.age != null) out.age = p.age;
    return out;
  }
  const bio = p.bio || '';
  let gender: '男' | '女' | undefined;
  if (FEMALE_HINTS.some((w) => bio.includes(w))) gender = '女';
  else if (MALE_HINTS.some((w) => bio.includes(w))) gender = '男';
  let age: number | undefined;
  const gen = Object.keys(GENERATION_AGE).find((g) => bio.includes(g));
  if (gen) age = GENERATION_AGE[gen];
  const m = bio.match(/(\d{2})\s*岁/);
  if (m) { const n = Number(m[1]); if (n >= 10 && n <= 90) age = n; }
  const out: { gender?: '男' | '女'; age?: number } = {};
  if (gender) out.gender = gender;
  if (age != null) out.age = age;
  return out;
}

// ============ 4. 三路融合 ============
export interface ComposeInput { date?: Date; board?: BoardItem[]; profile?: UserProfile; personalized?: boolean; boardRegion?: BoardRegion | 'all' }
export interface Direction { tag: string; source: 'trending' | 'seasonal' | 'profile'; weight: number; validTag: boolean }
export interface ComposeResult { directions: Direction[]; xiaonanLines: string[]; seasonal: SeasonalSignal[] }
export function composePersonalization(inp: ComposeInput = {}): ComposeResult {
  const personalized = inp.personalized !== false; // 默认开启，可关闭
  const date = inp.date ?? new Date();
  const seasonal = seasonalSignals(date);
  const trend = trendingSignals(inp.board ?? [], date, 6, inp.boardRegion ?? 'all');
  const prof = profileSignals(inp.profile ?? {});
  const W = { trending: 0.35, seasonal: 0.25, profile: 0.4 };
  const merged = new Map<string, Direction>();
  const add = (tag: string, source: Direction['source'], w: number) => {
    const cur = merged.get(tag);
    if (cur) cur.weight = Math.round((cur.weight + w) * 100) / 100;
    else merged.set(tag, { tag, source, weight: w, validTag: !!findTagByName(tag) });
  };
  trend.forEach((t, i) => add(t.tag, 'trending', W.trending * (1 - i * 0.1)));
  seasonal.forEach((s) => s.directions.forEach((d) => add(d, 'seasonal', W.seasonal)));
  if (personalized) prof.preferredTags.forEach((t, i) => add(t, 'profile', W.profile * (1 - i * 0.1)));
  const directions = [...merged.values()].sort((a, b) => b.weight - a.weight).slice(0, 8);
  const xiaonanLines: string[] = [];
  trend.slice(0, 2).forEach((t) => xiaonanLines.push(`小南注意到${t.from[0] ?? '平台'}近期爆款带火了「${t.tag}」，已为你上调该方向～`));
  seasonal.forEach((s) => xiaonanLines.push(`小南提醒：${s.reason}`));
  if (personalized) prof.reasons.forEach((r) => xiaonanLines.push(`小南越来越懂你：${r}`));
  if (!personalized) xiaonanLines.push('当前已关闭个性化，仅按市场热度与时令推荐（可在设置中重新开启）');
  return { directions, xiaonanLines, seasonal };
}
