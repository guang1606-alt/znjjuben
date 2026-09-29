/**
 * 成年向分级剧本（第11模式）准入与内容安全闸
 * 设计原则（合规底线，不可被问卷/付费绕过）：
 *  1) 只做合法的“成熟向叙事”（犯罪惊悚/暴力/黑暗人性/情欲张力），对标电影 R/18+ 分级；
 *  2) 露骨淫秽色情在【所有法域、任何付费状态】下一律硬禁——免责问卷不能免除平台传播淫秽内容的法律责任；
 *  3) 进入前必须完成成年问卷+法域声明+责任承担+单独付费，且授权有时效、全程留痕；
 *  4) 生成结果再过一次内容安全闸，露骨内容阻断并只返回类别（不回显原文）。
 */

export type Region = 'CN' | 'HK' | 'TW' | 'US' | 'JP' | 'KR' | 'EU' | 'OTHER';
interface Jurisdiction { label: string; matureNarrative: boolean; explicitSexual: false; note: string }
// explicitSexual 恒为 false 且类型锁死，杜绝后台被配置成允许露骨色情
export const JURISDICTIONS: Record<Region, Jurisdiction> = {
  CN: { label: '中国大陆', matureNarrative: true, explicitSexual: false, note: '仅可个人非传播的成熟向叙事，严禁淫秽色情且不得公开传播' },
  HK: { label: '中国香港', matureNarrative: true, explicitSexual: false, note: '按《淫亵及不雅物品管制条例》分级，露骨淫秽禁止' },
  TW: { label: '中国台湾', matureNarrative: true, explicitSexual: false, note: '按台湾地区分级制度，露骨淫秽内容禁止' },
  US: { label: '美国', matureNarrative: true, explicitSexual: false, note: 'R级成熟叙事可，obscenity 与 CSAM 联邦重罪，平台不生成露骨色情' },
  JP: { label: '日本', matureNarrative: true, explicitSexual: false, note: 'R18影视分级叙事可，露骨色情出版受规制，平台不生成' },
  KR: { label: '韩国', matureNarrative: true, explicitSexual: false, note: '19禁分级叙事可，露骨淫秽禁止' },
  EU: { label: '欧盟', matureNarrative: true, explicitSexual: false, note: '按各成员国分级与DSA要求，露骨淫秽禁止' },
  OTHER: { label: '其他地区', matureNarrative: true, explicitSexual: false, note: '用户须自行确认符合当地法律，露骨淫秽平台一律不生成' },
};

export interface MatureConsent {
  memberPro: boolean;
  paid: boolean;              // 已单独付费开通
  ageConfirmed: boolean;
  age: number;
  region: Region;
  purposePersonal: boolean;   // 仅合法个人创作
  noMinorDistribution: boolean;
  boundaryAccepted: boolean;  // 知悉平台不生成露骨淫秽
  legalSelfResponsible: boolean;
  signedAt: number;           // 签署时间戳(ms)
}
export interface ConsentResult { pass: boolean; reasons: string[]; expireAt: number | null }
export const GATING_VALID_DAYS = 30;
const DAY = 24 * 3600 * 1000;

export function evaluateConsent(c: MatureConsent, now = Date.now()): ConsentResult {
  const reasons: string[] = [];
  if (!c.memberPro) reasons.push('需专业会员');
  if (!c.paid) reasons.push('需单独付费开通成年向分级功能');
  if (!c.ageConfirmed) reasons.push('未确认成年');
  if (!(c.age >= 18)) reasons.push('年龄须满18周岁');
  if (!c.purposePersonal) reasons.push('须声明仅用于合法个人创作');
  if (!c.noMinorDistribution) reasons.push('须承诺不向未成年人传播');
  if (!c.boundaryAccepted) reasons.push('须知悉并同意平台不生成露骨淫秽内容的边界');
  if (!c.legalSelfResponsible) reasons.push('须自行承担所在地法律责任');
  const juris = JURISDICTIONS[c.region];
  if (!juris) reasons.push('法域未选择');
  else if (!juris.matureNarrative) reasons.push('该法域不开放成熟向创作');
  if (!c.signedAt) reasons.push('未完成授权签署');
  else if (now - c.signedAt > GATING_VALID_DAYS * DAY) reasons.push('授权已过期，请重新签署');
  return { pass: reasons.length === 0, reasons, expireAt: c.signedAt ? c.signedAt + GATING_VALID_DAYS * DAY : null };
}

// ---------- 内容安全闸：露骨淫秽硬禁，成熟向非露骨放行并打分级 ----------
// 仅用于“识别并拦截”，命中后只返回类别，不回显词面
const EXPLICIT_BLOCKLIST: { cat: string; words: string[] }[] = [
  { cat: '露骨性行为描写', words: ['性交', '做爱', '抽插', '插入下体', '口交', '肛交', '群交', '轮奸', '强奸过程描写'] },
  { cat: '露骨性器官描写', words: ['阴道', '阴茎', '阴蒂', '阴唇', '睾丸', '乳房揉捏', '下体湿润描写'] },
  { cat: '未成年人性化', words: ['未成年', '幼女', '幼男', '学生妹性关系', '萝莉性', '正太性'] },
];
// 成熟向但非露骨：允许，转为分级预警
const MATURE_WARN: { cat: string; words: string[] }[] = [
  { cat: '暴力血腥', words: ['枪杀', '刀刺', '血迹', '搏斗', '尸体', '复仇猎杀'] },
  { cat: '犯罪惊悚', words: ['贩毒', '绑架', '勒索', '黑帮', '谋杀', '悬疑凶案'] },
  { cat: '情欲张力(非露骨)', words: ['暧昧', '拥吻', '喘息', '指尖划过', '情欲', '床帏', '宽衣'] },
  { cat: '黑暗人性', words: ['背叛', '算计', '堕落', '灰色', '人性深渊'] },
];

export interface ScreenResult {
  allowed: boolean;
  blockedCategories: string[];
  warnings: string[];
  rating: 'PG-13' | 'R' | '18+';
}

export function screenMatureText(text: string): ScreenResult {
  const blockedCategories: string[] = [];
  for (const g of EXPLICIT_BLOCKLIST) {
    if (g.words.some((w) => text.includes(w))) blockedCategories.push(g.cat);
  }
  const warnings: string[] = [];
  let score = 0;
  for (const g of MATURE_WARN) {
    if (g.words.some((w) => text.includes(w))) { warnings.push(g.cat); score += 1; }
  }
  // 未成年人性化是最高红线，只要命中直接最高级阻断（已含在blocked）
  const allowed = blockedCategories.length === 0;
  let rating: ScreenResult['rating'] = 'PG-13';
  if (warnings.length >= 3) rating = '18+';
  else if (warnings.length >= 1) rating = 'R';
  return { allowed, blockedCategories, warnings, rating: allowed ? rating : '18+' };
}

/** 完整闸门：准入 + 单次内容校验，任一不过即拒绝 */
export function matureGate(consent: MatureConsent, text: string, now = Date.now()) {
  const consentResult = evaluateConsent(consent, now);
  const screen = screenMatureText(text);
  return {
    admitted: consentResult.pass,
    consent: consentResult,
    screen,
    ok: consentResult.pass && screen.allowed,
    rejectReasons: [...consentResult.reasons, ...(screen.allowed ? [] : screen.blockedCategories.map((c) => `内容触红线：${c}`))],
  };
}
