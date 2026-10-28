/**
 * v2.325 整合：12 → 9 种创作模式
 *  · 删 mature_x（成年向分级剧本，合规风险高、使用频率极低）
 *  · novel（小说改编）并入 adapt（创意改编），后端 canonical 归一为 adapt
 *  · branded_skit（剧情软广）并入 video_short（爆款短视频脚本），后端 canonical 归一为 video_short
 *
 *  v2.14 历史整合（已在前轮完成，保留注释备查）：
 *  · 名场面引擎 + 爆款逆向工程 → hit_lab，内部两条轨道
 *  · 新增 long_ip（长系列IP创作）；film（电影剧本）
 *
 * 会员等级开放：
 *  免费：标签创建
 *  基础：+ 采访式 / 创意改编（含小说压缩轨道）/ 互动短剧
 *  高级：+ 爆款拆解·名场面 / 热点追更 / 爆款短视频脚本（含品牌简报可选）
 *  专业：+ 名场面工作台的「爆款逆向批量」轨道 / 长系列IP创作 / 电影剧本
 */
import { MemberLevel } from './pricing';

export type ModeId =
  | 'interview' | 'adapt' | 'tag' | 'interactive'
  | 'hit_lab' | 'hot' | 'video_short'
  | 'long_ip' | 'film';

/**
 * 线上 wire-id / 历史 id → 后端 canonical ModeId 归一表
 *  · novel / novel_* → adapt（v2.325 合并小说改编）
 *  · branded_skit / softad → video_short（v2.325 合并剧情软广）
 *  · mature_x / xscript → film（v2.325 移除独立成年向分级模式，付费用户转 film 电影剧本创作，支持犯罪惊悚/黑暗人性等成熟题材）
 *  · scene / reverse → hit_lab（v2.14 整合）
 */
export const MODE_ALIASES: Record<string, ModeId> = {
  tag: 'tag', tags: 'tag',
  video_short: 'video_short', shortvideo: 'video_short', short_video: 'video_short',
  branded_skit: 'video_short', softad: 'video_short', soft_ad: 'video_short', // v2.325 并入 video_short
  interview: 'interview', adapt: 'adapt', novel: 'adapt', interactive: 'interactive', // v2.325 novel → adapt
  hit_lab: 'hit_lab', hitlab: 'hit_lab', scene: 'hit_lab', reverse: 'hit_lab', viral_reverse: 'hit_lab',
  long_ip: 'long_ip', longip: 'long_ip', longseries: 'long_ip', long_series: 'long_ip',
  hot: 'hot', hotspot: 'hot', film: 'film',
  // v2.325 mature_x / xscript 付费用户不变成死胡同，归一到 film 电影剧本（犯罪惊悚/黑暗人性题材仍可写）
  mature_x: 'film', xscript: 'film', x_script: 'film',
};

/** 把任意线上/历史 mode 字符串归一为规范 ModeId；无法识别返回 undefined */
export function canonicalModeId(id: string | null | undefined): ModeId | undefined {
  if (!id) return undefined;
  return MODE_ALIASES[String(id).trim().toLowerCase()];
}

/**
 * 爆款拆解·名场面工作台的两条内部轨道（v2.14 整合）：
 *  signature_scene 名场面拓展：围绕一个高能场面前铺后延成完整剧本（高级可用）
 *  hit_reverse    爆款逆向：拆整剧方法论骨架、换设定批量 3-5 版不侵权新本（专业可用）
 */
export type HitLabTrack = 'signature_scene' | 'hit_reverse';
export const HIT_LAB_TRACKS: { id: HitLabTrack; name: string; nameEn: string; minLevel: MemberLevel; desc: string; descEn: string }[] = [
  { id: 'signature_scene', name: '名场面拓展', nameEn: 'Signature-scene expansion', minLevel: MemberLevel.ADVANCED, desc: '围绕一个高能名场面，向前补因、向后延果，扩成完整单集/全本', descEn: 'Build causes before and consequences after one high-energy scene into a full episode/script' },
  { id: 'hit_reverse', name: '爆款逆向批量', nameEn: 'Hit reverse-engineering batch', minLevel: MemberLevel.PRO, desc: '拆解整剧爆款方法论骨架，替换人设/背景/世界观，批量产出不侵权新本', descEn: 'Extract a hit’s method skeleton, swap persona/setting/worldview and batch non-infringing drafts' },
];
export function canonicalHitLabTrack(track: string | null | undefined): HitLabTrack {
  return track === 'hit_reverse' || track === 'reverse' ? 'hit_reverse' : 'signature_scene';
}
/** 轨道级权限：hit_lab 的爆款逆向批量需专业版；其余模式/名场面轨道走模式级权限 */
export function trackAvailable(modeId: string, track: string | undefined, level: MemberLevel): boolean {
  if (canonicalModeId(modeId) !== 'hit_lab') return true;
  const t = HIT_LAB_TRACKS.find((x) => x.id === canonicalHitLabTrack(track));
  const order: MemberLevel[] = [MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO];
  return order.indexOf(level) >= order.indexOf(t!.minLevel);
}
export function trackUnlockLevel(modeId: string, track: string | undefined): MemberLevel | null {
  if (canonicalModeId(modeId) !== 'hit_lab') return null;
  return HIT_LAB_TRACKS.find((x) => x.id === canonicalHitLabTrack(track))!.minLevel;
}

export interface CreationMode {
  id: ModeId;
  name: string;
  desc: string;
  minLevel: MemberLevel;
  status?: 'available' | 'coming_soon';
  mature?: boolean;
}
const L = MemberLevel;

/** v2.325 整合后的 9 种模式注册表（按会员档排序） */
export const CREATION_MODES: CreationMode[] = [
  { id: 'interview', name: '采访式创作', desc: '对话式引导，把模糊创意聊成剧本', minLevel: L.BASIC },
  { id: 'adapt', name: '创意改编', desc: '续写/衍生/联动/同人/小说压缩（v2.325 合并小说改编）', minLevel: L.BASIC },
  { id: 'tag', name: '标签创建', desc: '标签组合，一键定向题材', minLevel: L.FREE },
  { id: 'interactive', name: '互动短剧', desc: '分支选择、多结局可视化创作', minLevel: L.BASIC },
  { id: 'hit_lab', name: '爆款拆解·名场面工作台', desc: '名场面前铺后延 / 拆爆款方法论批量出不侵权新本', minLevel: L.ADVANCED },
  { id: 'hot', name: '热点追更', desc: '借势全网热点快速出本', minLevel: L.ADVANCED },
  { id: 'video_short', name: '爆款短视频脚本', desc: '强钩子前3秒 · 分镜化口播 · 每镜一句（v2.325 合并剧情软广，可加品牌简报）', minLevel: L.ADVANCED },
  { id: 'long_ip', name: '长系列IP创作', desc: '多季/长系列/多IP联动：跨季伏笔账本、成长谱系、季终大钩与世界观总控', minLevel: L.PRO },
  { id: 'film', name: '电影剧本创作', desc: '三幕结构长片 · 90-120分钟院线/流媒体级别', minLevel: L.PRO },
];

const LEVEL_ORDER: MemberLevel[] = [L.FREE, L.BASIC, L.ADVANCED, L.PRO];
function findMode(modeId: string): CreationMode | undefined {
  const canon = canonicalModeId(modeId);
  return canon ? CREATION_MODES.find((m) => m.id === canon) : undefined;
}
export function isComingSoon(modeId: string): boolean {
  return findMode(modeId)?.status === 'coming_soon';
}
export function modeAvailable(modeId: string, level: MemberLevel): boolean {
  const mode = findMode(modeId);
  if (!mode || mode.status === 'coming_soon') return false;
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(mode.minLevel);
}
export function modesForLevel(level: MemberLevel): CreationMode[] {
  return CREATION_MODES.filter((m) => m.status !== 'coming_soon' && modeAvailable(m.id, level));
}
/** 引导升级：返回解锁该模式所需的最低等级名 */
export function unlockLevel(modeId: string): MemberLevel | null {
  return findMode(modeId)?.minLevel ?? null;
}
