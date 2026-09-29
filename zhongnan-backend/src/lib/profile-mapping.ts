/**
 * v2.71 用户显式画像 → 创作引擎 UserProfile 的确定性映射
 * 用户在资料页可选填 地区/年龄段/性别，并可用「个性化总开关」一键关闭画像倾斜。
 * 引擎（context-personalization.profileSignals）本就支持显式 region/age/gender 优先、
 * bio 保守推断兜底；本文件只负责把存储字段安全、可校验地翻译成引擎入参，不做任何网络/LLM 调用。
 */

export type AgeBandId = 'u18' | '18-24' | '25-30' | '31-40' | '41-50' | 'over50';

export interface AgeBand {
  id: AgeBandId;
  /** 该年龄段的代表年龄（用于引擎 audience 分档：≤24 Z世代 / ≥50 银发向） */
  mid: number;
  labelZh: string;
  labelEn: string;
}

export const AGE_BANDS: AgeBand[] = [
  { id: 'u18', mid: 16, labelZh: '18岁以下', labelEn: 'Under 18' },
  { id: '18-24', mid: 21, labelZh: '18-24岁', labelEn: '18–24' },
  { id: '25-30', mid: 27, labelZh: '25-30岁', labelEn: '25–30' },
  { id: '31-40', mid: 35, labelZh: '31-40岁', labelEn: '31–40' },
  { id: '41-50', mid: 45, labelZh: '41-50岁', labelEn: '41–50' },
  { id: 'over50', mid: 55, labelZh: '50岁以上', labelEn: 'Over 50' },
];

export const AGE_BAND_IDS: readonly string[] = AGE_BANDS.map((b) => b.id);

export const GENDERS = ['男', '女', '保密'] as const;
export type GenderId = (typeof GENDERS)[number];

/**
 * 可选地区：均为 regional-culture.matchRegion 可识别的省/地区名（或其别名），
 * 保证选了就能真正命中地域文化卡，而不是存一个引擎不认识的字符串。
 */
export const PROFILE_REGIONS: string[] = [
  // 东北
  '黑龙江', '吉林', '辽宁',
  // 京津
  '北京', '天津',
  // 西北
  '陕西', '甘肃', '宁夏', '青海', '新疆',
  // 中原/华北
  '河南', '河北', '山西', '内蒙古',
  // 山东
  '山东',
  // 川渝
  '四川', '重庆',
  // 两湖
  '湖南', '湖北',
  // 江南/长三角
  '上海', '江苏', '浙江', '安徽',
  // 岭南
  '广东', '广西', '海南',
  // 闽台
  '福建', '台湾',
  // 云贵
  '云南', '贵州',
  // 江西
  '江西',
  // 海外/其他
  '海外', '其他',
];

export function ageBandToAge(band?: string | null): number | undefined {
  if (!band) return undefined;
  return AGE_BANDS.find((b) => b.id === band)?.mid;
}

export interface StoredProfile {
  bio?: string | null;
  region?: string | null;
  ageBand?: string | null;
  gender?: string | null;
  personalized?: boolean | null;
}

export interface EngineUserProfile {
  bio?: string;
  region?: string;
  age?: number;
  gender?: string;
  pastTags?: string[];
}

/**
 * 把存储用户 + 历史标签翻译成引擎画像。
 * - personalized === false：不回传任何显式画像字段（仅保留 bio 也不传，彻底关闭画像倾斜），
 *   时令/真实榜单仍照常工作，只是不做"迎合你"的个人化取向。
 * - gender='保密' 视为不提供性别。
 */
export function toEngineUserProfile(u: StoredProfile | null | undefined, pastTags?: string[]): EngineUserProfile {
  const base: EngineUserProfile = {};
  if (pastTags && pastTags.length) base.pastTags = pastTags.slice(0, 12);
  if (!u || u.personalized === false) return base; // 关闭个性化：不显式喂画像（bio 推断也关闭）
  if (u.bio && String(u.bio).trim()) base.bio = String(u.bio).trim();
  if (u.region && u.region !== '其他') base.region = u.region === '海外' ? '' : u.region;
  const age = ageBandToAge(u.ageBand);
  if (age != null) base.age = age;
  if (u.gender === '男' || u.gender === '女') base.gender = u.gender;
  return base;
}
