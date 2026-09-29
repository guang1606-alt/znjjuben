/**
 * 出海/多语言标签体系（英文剧本专用）
 * ---------------------------------------------------------------
 * 用户选英文（或目标平台为 ReelShort / DramaBox 等海外平台）时：
 *  1) 标签按海外市场真实偏好重新排布（狼人/霸总/黑帮/命定伴侣等强势赛道置顶）；
 *  2) 中文语境强绑定标签（赘婿/宅斗/方言梗）自动文化替换为海外等价表达；
 *  3) 智能随机按“海外热度”加权，保证懂市场；
 *  4) 普适标签做中—英行业术语映射，无法映射的保留并给出文化改写提示。
 * 纯数据 + 纯函数，零 IO；与 tag-taxonomy 单向依赖（本模块依赖它，反向不依赖）。
 */
import { findTagByName, type DimId } from './tag-taxonomy';

export type Locale = 'zh' | 'en';
export type OverseasSlot = 'core' | 'relation' | 'protagonist' | 'emotion' | 'structure';

export interface OverseasTag {
  en: string;            // 海外行业通用英文术语
  zh: string;            // 中文对照
  slot: OverseasSlot;    // 创作槽位
  heat: number;          // 海外市场热度 0-100（可由每日采集更新）
  dim: DimId;            // 对应国内维度，便于回写
  mapsToZh?: string;     // 对应国内已有标签名（存在则可双向映射）
}

// 海外竖屏短剧（ReelShort/DramaBox/GoodShort 等）经过市场验证的强势标签
export const OVERSEAS_TAGS: OverseasTag[] = [
  // —— 核心题材 core ——
  { en: 'Werewolf & Fated Mates', zh: '狼人命定伴侣', slot: 'core', heat: 98, dim: 'genre' },
  { en: 'Billionaire CEO', zh: '亿万霸总', slot: 'core', heat: 96, dim: 'genre' },
  { en: 'Mafia Romance', zh: '黑帮大佬之恋', slot: 'core', heat: 91, dim: 'genre' },
  { en: 'Revenge', zh: '复仇', slot: 'core', heat: 92, dim: 'conflict', mapsToZh: '复仇虐渣' },
  { en: 'Vampire Romance', zh: '吸血鬼之恋', slot: 'core', heat: 78, dim: 'genre' },
  { en: 'Dragon Shifter', zh: '龙族化形', slot: 'core', heat: 72, dim: 'genre' },
  { en: 'Supernatural', zh: '超自然', slot: 'core', heat: 77, dim: 'genre' },
  { en: 'Dark Romance', zh: '暗黑言情', slot: 'core', heat: 75, dim: 'style' },
  { en: 'Western Fantasy', zh: '西方奇幻', slot: 'core', heat: 63, dim: 'genre', mapsToZh: '东方玄幻' },
  { en: 'Omegaverse (ABO)', zh: 'ABO世界观', slot: 'core', heat: 60, dim: 'genre' },
  { en: 'Royalty & Kingdom', zh: '王室贵族', slot: 'core', heat: 70, dim: 'genre' },
  { en: 'Small-Town Romance', zh: '小镇情缘', slot: 'core', heat: 57, dim: 'genre' },
  // —— v1.96 穿书/转生/高概念对等补齐（海外 isekai / villainess / LitRPG 是经过验证的大赛道）——
  { en: 'Isekai: Transmigrated into a Novel', zh: '穿书进小说世界', slot: 'core', heat: 84, dim: 'genre', mapsToZh: '穿书' },
  { en: 'Reincarnated as the Villainess', zh: '转生为恶役千金', slot: 'core', heat: 88, dim: 'genre', mapsToZh: '穿成反派' },
  { en: 'Reincarnated as Cannon Fodder', zh: '转生为炮灰角色', slot: 'core', heat: 72, dim: 'genre', mapsToZh: '穿成炮灰' },
  { en: 'Reincarnated as the White Moonlight', zh: '转生为白月光', slot: 'core', heat: 60, dim: 'genre', mapsToZh: '穿成白月光' },
  { en: 'Quick Transmigration (World-Hopping)', zh: '快穿穿梭诸世界', slot: 'core', heat: 66, dim: 'genre', mapsToZh: '快穿' },
  { en: 'System / LitRPG Panel', zh: '系统面板流', slot: 'core', heat: 70, dim: 'genre', mapsToZh: '穿越带系统' },
  { en: 'Time Loop', zh: '时间循环', slot: 'core', heat: 68, dim: 'genre', mapsToZh: '时间循环困局' },
  { en: 'Self-Aware NPC', zh: 'NPC觉醒自我意识', slot: 'core', heat: 61, dim: 'genre', mapsToZh: 'NPC觉醒' },
  { en: 'Body Swap', zh: '灵魂互换', slot: 'core', heat: 63, dim: 'genre', mapsToZh: '灵魂互换' },
  { en: 'Parallel Worlds', zh: '平行世界', slot: 'core', heat: 58, dim: 'genre', mapsToZh: '平行世界' },
  { en: 'Breaking the Fourth Wall', zh: '打破次元壁', slot: 'core', heat: 55, dim: 'genre', mapsToZh: '打破次元壁' },
  // —— v1.96 文旅/风光剧情对等（Scenic Romance / Road-trip，承接城市营销与文旅合作）——
  { en: 'Scenic City Romance', zh: '城市风光文旅', slot: 'core', heat: 52, dim: 'genre', mapsToZh: '城市文旅打卡' },
  { en: 'Foodie Road Trip', zh: '美食公路文旅', slot: 'core', heat: 50, dim: 'genre', mapsToZh: '美食文旅' },
  { en: 'Heritage & Folk Culture', zh: '非遗民俗文旅', slot: 'core', heat: 48, dim: 'genre', mapsToZh: '非遗文旅' },
  { en: 'Healing Countryside Escape', zh: '乡村治愈文旅', slot: 'core', heat: 47, dim: 'genre', mapsToZh: '乡村文旅' },
  // —— 关系设定 relation（海外最吃“关系钩子”）——
  { en: 'Enemies to Lovers', zh: '宿敌变恋人', slot: 'relation', heat: 88, dim: 'genre', mapsToZh: '宿敌变恋人' },
  { en: 'Contract Marriage', zh: '契约婚姻', slot: 'relation', heat: 87, dim: 'genre', mapsToZh: '契约假情侣' },
  { en: 'Marriage First, Love Later', zh: '先婚后爱', slot: 'relation', heat: 84, dim: 'genre', mapsToZh: '先婚后爱' },
  { en: 'Secret Baby', zh: '隐孕秘宝', slot: 'relation', heat: 89, dim: 'genre', mapsToZh: '带球跑重逢' },
  { en: 'Fake Relationship', zh: '假扮情侣', slot: 'relation', heat: 82, dim: 'genre', mapsToZh: '假扮情侣见家长' },
  { en: 'Forced Proximity', zh: '被迫同居', slot: 'relation', heat: 80, dim: 'genre', mapsToZh: '死对头被迫同居' },
  { en: 'Forbidden Love', zh: '禁忌之恋', slot: 'relation', heat: 81, dim: 'genre', mapsToZh: '师徒禁忌之恋' },
  { en: 'Second Chance', zh: '破镜重圆', slot: 'relation', heat: 78, dim: 'genre', mapsToZh: '破镜重圆' },
  { en: 'Hidden Identity', zh: '隐藏身份', slot: 'relation', heat: 84, dim: 'genre', mapsToZh: '扮猪吃虎' },
  { en: 'Runaway Bride', zh: '逃婚新娘', slot: 'relation', heat: 74, dim: 'genre' },
  { en: 'Rejected Mate', zh: '被拒命定伴侣', slot: 'relation', heat: 87, dim: 'genre' },
  { en: 'Alpha & Luna', zh: '阿尔法与月神伴侣', slot: 'relation', heat: 85, dim: 'genre' },
  { en: 'Love Triangle', zh: '三角恋', slot: 'relation', heat: 66, dim: 'genre' },
  { en: 'Bodyguard Romance', zh: '保镖之恋', slot: 'relation', heat: 65, dim: 'genre' },
  { en: 'Boss & Intern', zh: '总裁与实习生', slot: 'relation', heat: 70, dim: 'genre', mapsToZh: '上下级隐恋' },
  { en: 'Friends to Lovers', zh: '友达以上', slot: 'relation', heat: 62, dim: 'genre', mapsToZh: '青梅竹马重逢' },
  { en: 'Age Gap', zh: '年龄差之恋', slot: 'relation', heat: 64, dim: 'genre', mapsToZh: '年下恋' },
  // —— 主角 protagonist ——
  { en: 'Cinderella Underdog', zh: '灰姑娘逆袭', slot: 'protagonist', heat: 82, dim: 'protagonist' },
  { en: 'Strong Female Lead', zh: '大女主', slot: 'protagonist', heat: 86, dim: 'protagonist', mapsToZh: '大女主' },
  { en: 'Amnesiac Hero(ine)', zh: '失忆主角', slot: 'protagonist', heat: 71, dim: 'protagonist' },
  { en: 'Time Traveler', zh: '穿越者', slot: 'protagonist', heat: 73, dim: 'genre', mapsToZh: '穿越现代' },
  { en: 'Reborn Hero(ine)', zh: '重生者', slot: 'protagonist', heat: 76, dim: 'genre', mapsToZh: '重生改命' },
  // —— 情绪 emotion ——
  { en: 'Redemption', zh: '救赎', slot: 'emotion', heat: 73, dim: 'emotion', mapsToZh: '治愈救赎' },
  { en: 'Angst & Tearjerker', zh: '虐心催泪', slot: 'emotion', heat: 70, dim: 'emotion', mapsToZh: '虐心' },
  { en: 'Sweet Fluff', zh: '高甜', slot: 'emotion', heat: 72, dim: 'emotion', mapsToZh: '高甜' },
  { en: 'Satisfying Revenge', zh: '高爽复仇', slot: 'emotion', heat: 85, dim: 'emotion', mapsToZh: '高爽感' },
  { en: 'Rom-com', zh: '浪漫轻喜剧', slot: 'emotion', heat: 68, dim: 'emotion', mapsToZh: '轻松搞笑' },
  // —— v1.96 喜剧机制深挖对等（解压刚需，覆盖沙雕/错位/职场情景/反套路/社死）——
  { en: 'Slapstick & Absurd Comedy', zh: '沙雕无厘头', slot: 'emotion', heat: 63, dim: 'emotion', mapsToZh: '沙雕解压' },
  { en: 'Fish-out-of-Water Comedy', zh: '错位反差喜剧', slot: 'emotion', heat: 55, dim: 'emotion', mapsToZh: '错位人生喜剧' },
  { en: 'Workplace Sitcom', zh: '职场情景喜剧', slot: 'emotion', heat: 54, dim: 'emotion', mapsToZh: '职场情景喜剧' },
  { en: 'Parody & Anti-Cliche Comedy', zh: '反套路恶搞', slot: 'emotion', heat: 56, dim: 'emotion', mapsToZh: '反套路喜剧' },
  { en: 'Cringe Comedy (Social Death)', zh: '社死名场面', slot: 'emotion', heat: 50, dim: 'emotion', mapsToZh: '大型社死现场' },
  { en: 'Bickering Enemies Comedy', zh: '欢喜冤家喜剧', slot: 'emotion', heat: 58, dim: 'emotion', mapsToZh: '家庭欢喜冤家' },
  // —— 结构 structure ——
  { en: 'Cliffhanger Serial', zh: '强卡点连载', slot: 'structure', heat: 80, dim: 'structure' },
  { en: 'Fast-Paced Short', zh: '快节奏短集', slot: 'structure', heat: 78, dim: 'structure', mapsToZh: '快节奏60_80集' },
  // —— v1.96 元叙事/特殊结构对等（戏中戏、伪纪录、循环结构）——
  { en: 'Story Within a Story (Metafiction)', zh: '戏中戏元叙事', slot: 'structure', heat: 55, dim: 'structure', mapsToZh: '戏中戏元叙事' },
  { en: 'Show-Within-a-Show Twist', zh: '剧中剧反转', slot: 'structure', heat: 52, dim: 'structure', mapsToZh: '剧中剧反转' },
  { en: 'Nested Layered Narrative', zh: '嵌套套层叙事', slot: 'structure', heat: 50, dim: 'structure', mapsToZh: '嵌套套层叙事' },
  { en: 'The Script Comes True', zh: '剧本照进现实', slot: 'structure', heat: 54, dim: 'structure', mapsToZh: '剧本照进现实' },
  { en: 'On-Set / Off-Set Twin Tracks', zh: '片场真假双线', slot: 'structure', heat: 47, dim: 'structure', mapsToZh: '片场真假双线' },
  { en: 'Rehearsal Mirrors the Truth', zh: '排练与真相互文', slot: 'structure', heat: 46, dim: 'structure', mapsToZh: '排练与真相互文' },
  { en: 'Audience-as-Character', zh: '观众即角色', slot: 'structure', heat: 45, dim: 'structure', mapsToZh: '观众即角色' },
  { en: 'Mockumentary', zh: '伪纪录片式', slot: 'structure', heat: 46, dim: 'structure', mapsToZh: '伪纪录片式' },
  { en: 'Time-Loop Repeat Structure', zh: '循环叙事结构', slot: 'structure', heat: 58, dim: 'structure', mapsToZh: '循环叙事' },
  { en: 'Interactive Branching', zh: '互动分支', slot: 'structure', heat: 57, dim: 'structure', mapsToZh: '互动分支' },
];

// 中文语境强绑定标签 → 海外等价替换（直译成英文观众看不懂，必须文化转译）
interface CultureRemap { en: string; zh: string; reason: string }
export type { CultureRemap };
export const CULTURE_REMAP: Record<string, CultureRemap> = {
  上门赘婿: { en: 'Hidden Billionaire Husband', zh: '隐富丈夫', reason: '“赘婿”为东亚家庭结构特有，海外用“隐藏富豪丈夫”承接爽感' },
  婆媳矛盾: { en: 'Evil Mother-in-law', zh: '恶毒婆婆', reason: '海外家庭剧以恶婆婆冲突承接' },
  重生宅斗: { en: 'Rebirth & Household Revenge', zh: '重生内宅复仇', reason: '保留重生复仇内核，弱化宗族制度背景' },
  宫斗: { en: 'Royal Court Intrigue', zh: '王室宫廷权谋', reason: '转为海外可理解的王室内斗' },
  东北方言喜剧: { en: 'Slapstick Local Comedy', zh: '本土化肢体喜剧', reason: '方言谐音梗不可直译，建议改为动作/情境喜剧' },
  川渝方言喜剧: { en: 'Slapstick Local Comedy', zh: '本土化肢体喜剧', reason: '川渝方言谐音/语气梗不可直译，建议改为动作/情境喜剧' },
  修仙升级: { en: 'Cultivation Fantasy (gloss terms)', zh: '仙侠升级(需术语注释)', reason: '修仙体系海外小众，首次出现需注释境界设定' },
};

const ZH_INDEX = new Map<string, OverseasTag>();
OVERSEAS_TAGS.forEach((t) => { ZH_INDEX.set(t.zh, t); if (t.mapsToZh) ZH_INDEX.set(t.mapsToZh, t); });

export function overseasTags(slot?: OverseasSlot): OverseasTag[] {
  return (slot ? OVERSEAS_TAGS.filter((t) => t.slot === slot) : OVERSEAS_TAGS).slice();
}
/** 海外热度排序（某槽位/某维度） */
export function overseasRank(slot?: OverseasSlot): OverseasTag[] {
  return overseasTags(slot).sort((a, b) => b.heat - a.heat);
}

export interface LocalizedItem { zh: string; en: string; mapped: boolean }
export interface LocalizeResult { items: LocalizedItem[]; replaced: { from: string; to: CultureRemap }[]; notes: string[] }
/** 把一组中文标签本地化为英文：普适映射 → 文化强绑定替换 → 无法映射则保留并提示 */
export function localizeCombo(zhNames: string[]): LocalizeResult {
  const items: LocalizedItem[] = []; const replaced: LocalizeResult['replaced'] = []; const notes: string[] = [];
  for (const name of zhNames) {
    const hit = ZH_INDEX.get(name);
    if (hit) { items.push({ zh: hit.zh, en: hit.en, mapped: true }); continue; }
    const remap = CULTURE_REMAP[name];
    if (remap) { items.push({ zh: remap.zh, en: remap.en, mapped: true }); replaced.push({ from: name, to: remap }); notes.push(`「${name}」→「${remap.zh}」：${remap.reason}`); continue; }
    items.push({ zh: name, en: name, mapped: false });
    notes.push(`「${name}」文化特异性强、暂无标准海外等价，建议人工改写为海外观众可理解的表达`);
  }
  return { items, replaced, notes };
}

/** 按语言重排已有标签：中文原样；英文把可映射/高海外热度的排前，水土不服的排后 */
export function reorderForLocale(names: string[], locale: Locale): string[] {
  if (locale !== 'en') return names.slice();
  const heatOf = (n: string) => ZH_INDEX.get(n)?.heat ?? -1;
  return names.slice().sort((a, b) => heatOf(b) - heatOf(a));
}

/** 海外智能随机：保证 核心题材/关系/主角 三槽位必有，再按海外热度补情绪/结构，懂市场且不重复 */
export function smartOverseasCombo(opts: { n?: number; rng?: () => number } = {}): OverseasTag[] {
  const { n = 6, rng = Math.random } = opts;
  const out: OverseasTag[] = []; const usedEn = new Set<string>();
  const weightedPick = (pool: OverseasTag[]): OverseasTag | undefined => {
    const avail = pool.filter((t) => !usedEn.has(t.en));
    if (!avail.length) return undefined;
    const sum = avail.reduce((s, t) => s + t.heat, 0); let r = rng() * sum;
    for (const t of avail) { r -= t.heat; if (r <= 0) return t; }
    return avail[avail.length - 1];
  };
  (['core', 'relation', 'protagonist'] as OverseasSlot[]).forEach((slot) => {
    const t = weightedPick(overseasTags(slot)); if (t) { out.push(t); usedEn.add(t.en); }
  });
  const rest: OverseasSlot[] = ['emotion', 'structure', 'core', 'relation'];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const slot = rest[out.length % rest.length];
    const t = weightedPick(overseasTags(slot));
    if (!t) continue;
    out.push(t); usedEn.add(t.en);
  }
  return out.slice(0, n);
}

/** 校验：所有 mapsToZh 指向的国内标签必须真实存在（防映射悬空，开发期自检） */
export function validateOverseasMapping(): string[] {
  const bad: string[] = [];
  OVERSEAS_TAGS.forEach((t) => { if (t.mapsToZh && !findTagByName(t.mapsToZh)) bad.push(`${t.en} -> ${t.mapsToZh}`); });
  return bad;
}

/** 英文创作简报：本地化标签转成可直接喂“剧情架构师”的英文行（括注中文便于人工核对），并附文化提示 */
export function overseasBrief(zhNames: string[]): { title: string; lines: string[]; raw: string; notes: string[] } {
  const r = localizeCombo(zhNames);
  const lines = r.items.map((i) => (i.mapped ? `${i.en}（${i.zh}）` : `${i.zh} [需人工英文化]`));
  return { title: 'Tag Brief — Overseas / English Market', lines, raw: lines.join('\n'), notes: r.notes };
}
