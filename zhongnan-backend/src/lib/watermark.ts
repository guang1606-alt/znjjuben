/**
 * 笔名校名水印（用户最新口径）
 *  - 用户可创建笔名；笔名自动成为所生成剧本的水印（作者署名 + 平台标识，兼具版权与拉新）
 *  - 去水印权限：高级会员及以上（ADVANCED/PRO）；免费/基础强制带水印
 *    （口径变更：旧版“基础即可去水印”作废，以最新指令为准，用于诱导升级）
 */
import { MemberLevel } from '../config/pricing';

import { BRAND as B } from '../config/brand';
const BRAND = B.fullName;

export function canRemoveWatermark(level?: string): boolean {
  return level === MemberLevel.ADVANCED || level === MemberLevel.PRO;
}

export interface WatermarkUser {
  penName?: string | null;
  nickname?: string | null;
  level?: string;
  removeWatermark?: boolean; // 高等级用户主动选择去水印
}

function signature(u: WatermarkUser): string {
  const author = (u.penName || u.nickname || '匿名编剧').trim();
  return `——本剧本由「${author}」创作于${BRAND}`;
}

/** 给导出/分享的剧本文本附加水印；高等级且选择去除时返回干净原文 */
export function applyWatermark(text: string, u: WatermarkUser): { text: string; watermarked: boolean } {
  const removable = canRemoveWatermark(u.level);
  if (removable && u.removeWatermark === true) return { text, watermarked: false };
  const line = signature(u);
  if (text.trimEnd().endsWith(line)) return { text, watermarked: true };
  return { text: `${text.trimEnd()}\n\n${line}`, watermarked: true };
}

/** 分享梗概卡片用的短水印（不含正文） */
export function shareByline(u: WatermarkUser): string {
  return `编剧 ${(u.penName || u.nickname || '匿名编剧').trim()} · ${BRAND}`;
}
