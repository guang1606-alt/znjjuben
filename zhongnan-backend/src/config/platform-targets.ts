/**
 * v2.549 目标平台规格（创作参数 → 生成指令的真实落点）
 *
 * 背景：前端「目标平台」下拉（web/index.html #platform）此前是一个死控件——
 * 用户选了红果/抖音/快手/ReelShort/DramaBox，值从不进任何请求，后端也没有该字段，
 * 生成链路完全不感知目标平台。同一份稿投不同平台，节奏与题材偏好本应不同。
 *
 * 口径来源：与 src/config/submission-channels.ts 的公开事实（fitTags / fitGenre / region）对齐，
 * 并沿用 src/config/overseas-taxonomy.ts 的「海外平台走本地化而非直译」原则。
 * 这里只沉淀可核验的平台偏好，不写未经验证的时长/集数/字数数字——
 * 具体规格仍由 aigcDurationMin / scenesPerEp / scriptType 决定。
 */
export type PlatformTargetId = 'hongguo' | 'douyin' | 'kuaishou' | 'reelshort' | 'dramabox';
export type PlatformRegion = 'domestic' | 'overseas';

export interface PlatformTarget {
  id: PlatformTargetId;
  name: string;
  nameEn: string;
  region: PlatformRegion;
  fitTags: string[];
  genre: string;
  genreEn: string;
  /** 该平台的节奏与题材偏好（注入架构师/撰写师/润色师，不含具体数字断言） */
  rhythm: string;
  rhythmEn: string;
}

export const PLATFORM_TARGETS: PlatformTarget[] = [
  {
    id: 'hongguo', name: '红果短剧', nameEn: 'Hongguo', region: 'domestic',
    fitTags: ['现代家庭', '情感', '悬疑', '逆袭', '现实'], genre: '全性别', genreEn: 'all audiences',
    rhythm: '强情绪、快兑付；每一集都要有可见的处境变化，集尾必留钩',
    rhythmEn: 'strong emotion, fast payoff; every episode must move the situation, always end on a hook',
  },
  {
    id: 'douyin', name: '抖音', nameEn: 'Douyin', region: 'domestic',
    fitTags: ['真人短剧', '逆袭', '情感', '都市'], genre: '全性别', genreEn: 'all audiences',
    rhythm: '前 3 秒必须抓住人，信息密度高、画面强；不接受慢热铺垫',
    rhythmEn: 'win the first 3 seconds; high information density and strong visuals; no slow build-up',
  },
  {
    id: 'kuaishou', name: '快手', nameEn: 'Kuaishou', region: 'domestic',
    fitTags: ['现实', '乡土', '情感', '喜剧'], genre: '全性别', genreEn: 'all audiences',
    rhythm: '现实/乡土质感，人物接地气、冲突直给；少悬浮设定与精英腔',
    rhythmEn: 'grounded realistic / rural texture, direct conflict, no floating elite phrasing',
  },
  {
    id: 'reelshort', name: 'ReelShort', nameEn: 'ReelShort', region: 'overseas',
    fitTags: ['Werewolf', 'Billionaire', 'Mafia', 'Mate'], genre: '女频', genreEn: 'female-led',
    rhythm: '欧美强设定女频（狼人/霸总/命定伴侣）；开场即冲突，台词用自然英文，不要中式「被看不起→打脸」公式',
    rhythmEn: 'Western female-led high-concept (werewolf / billionaire / fated mate); conflict from the first beat; natural English lines, never the CN "despised then face-slap" formula',
  },
  {
    id: 'dramabox', name: 'DramaBox', nameEn: 'DramaBox', region: 'overseas',
    fitTags: ['Revenge', 'CEO', 'Marriage'], genre: '女频', genreEn: 'female-led',
    rhythm: '欧美复仇/CEO/婚姻题材；节奏快、反转多，情绪直给不绕弯',
    rhythmEn: 'Western revenge / CEO / marriage tropes; fast pace, many reversals, emotions stated directly',
  },
];

export function isPlatformTargetId(id: unknown): id is PlatformTargetId {
  return typeof id === 'string' && PLATFORM_TARGETS.some((t) => t.id === id);
}

export function platformTargetOf(id: string | null | undefined): PlatformTarget | undefined {
  if (!id) return undefined;
  return PLATFORM_TARGETS.find((t) => t.id === id);
}

/**
 * 生成平台指令；未选/未知平台返回空串（行为与旧版完全一致，不额外注入）。
 * 海外平台附带「本地化而非直译」提醒，与 overseas-taxonomy 的原则一致。
 */
export function platformDirectiveOf(id: string | null | undefined, lang: 'zh' | 'en'): string {
  const t = platformTargetOf(id);
  if (!t) return '';
  if (lang === 'en') {
    const overseas = t.region === 'overseas'
      ? '\n- This is an overseas platform: localize culturally, do not translate the Chinese formula word-for-word'
      : '';
    return `[Target platform: ${t.nameEn}]\n- Region: ${t.region === 'overseas' ? 'overseas' : 'domestic mainland China'} · Lead: ${t.genreEn}\n- Fit themes: ${t.fitTags.join(', ')}\n- Rhythm: ${t.rhythmEn}${overseas}\n`;
  }
  const overseas = t.region === 'overseas'
    ? `\n- 这是海外平台：按当地文化做本地化，不要把中式公式逐字直译`
    : '';
  return `【目标平台：${t.name}】\n- 地区：${t.region === 'overseas' ? '海外' : '国内'} · 性别向：${t.genre}\n- 适配题材：${t.fitTags.join('、')}\n- 节奏偏好：${t.rhythm}${overseas}\n`;
}
