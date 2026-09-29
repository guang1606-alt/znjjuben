/**
 * v2.54 品牌口径唯一来源（全工具统一，禁止散落硬编码）
 * 对外统一口径：终南映画自研大模型 + AGI 体系化提示词应用工程；
 * C 端任何界面/导出物不得出现底层第三方模型厂商名称与开发逻辑。
 */
export const BRAND = {
  /** 短名（导航/标题） */
  name: '终南集',
  /** 正式全称 */
  fullName: '终南集 · 人工通用智能（AGI）编剧大师',
  /** 英文正式名 */
  nameEn: 'ZhongnanJi · AGI Screenwriting Master',
  /** 出品方 */
  producer: '陕西终南映画人工智能科技有限公司',
  producerEn: 'Shaanxi Zhongnan Yinghua AI Technology Co., Ltd.',
  /** 官方联系电话 */
  contactPhone: '18629152777',
  /** 对外技术口径（用户问“用了什么模型”时统一回答） */
  publicStackClaim: '终南映画自研大模型与 AGI 体系化提示词应用工程',
  publicStackClaimEn: 'Proprietary AGI model and systematic prompt-engineering stack by Zhongnan Yinghua',
  slogan: '人类级无AI感 · 竖屏短剧智能创作基础设施',
  sloganEn: 'Human-grade vertical-drama screenwriting infrastructure',
} as const;

export function brandLine(lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en'
    ? `${BRAND.nameEn} · ${BRAND.producerEn}`
    : `${BRAND.fullName} · ${BRAND.producer}`;
}
