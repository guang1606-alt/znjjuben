/**
 * 场景资产引擎（v2.161 编导分级协作法 L3"场景可资产化"工具落地，第三资产家族，对标 v2.159 道具资产库）
 * ------------------------------------------------------------------
 * 痛点：老宅祠堂/天台/医院走廊是短剧的"舞台发动机"，但换剧即从零设计——
 * L3 编导养熟的"场景模型"（权谋舞台/情感锚点/高光现场）无法跨剧复用；
 * 且场景的状态红线（已烧毁/已封锁，未补交代不得完好再现）每剧都要重新交代。
 * 职责（与 character-asset/prop-asset 同构：纯函数零 IO 可离线对拍，零 token）：
 *  1. buildSceneAssetDirective：把引用的场景资产编译成架构师/撰写师强约束指令——
 *     地点名可随新剧世界观调整，但剧情功能/氛围基调/状态禁忌必须跨剧保持。
 *  2. extractSceneAssetDrafts：跨集成稿 → 场景沉淀草稿——
 *     一手源 script.content × 场头解析（sceneHeaderConvention，与物料场景总表同口径同源）。
 * 与道具家族的口径辨析：
 *  - 场景的"名"= 地点（场头提取原样）；内外景/日夜是同一场景的变体不入档（同场地日夜皆可能）；
 *  - 场景无"信物词典"类功能词表，沉淀只做确定性结构提取（地点×出现集），剧情功能留给编导精修——
 *    不臆造语义（反自我封闭铁律），创建占位"功能待补"、更新不碰 meaning（c155 占位稿不降级前置）。
 */
import { sceneHeaderConvention } from './scene-header-convention';

/** 场景资产种子（落库快照/管线注入共用形态） */
export interface SceneAssetSeed {
  id?: string;
  /** 场景名（地点，场头提取原样或自定义） */
  name: string;
  /** 剧情功能（主线舞台/情感锚点/冲突现场/高光打脸场） */
  meaning: string;
  /** 氛围基调（阴森/温馨/压抑…，AIGC 生图光线与节拍适配参考） */
  mood?: string | null;
  /** 状态禁忌（已烧毁/已封锁，未补交代不得完好再现等） */
  taboo?: string | null;
  /** 外观锚点（AIGC 换剧保持场景一致） */
  visualAnchor?: string | null;
}

const MAX_ASSETS = 10;
const MAX_DRAFTS = 12; // 场头是结构化数据、噪音低于信物词典，沉淀上限比道具(8)放宽一档
const MAX_EPS = 500;   // 出现集记录上限（分集上限一致）

/**
 * 把场景资产编译成架构师/撰写师强约束指令（中英双语）
 * 注入语义划界（与道具家族同口径）：场景是"舞台事实源"不是"人设"——人设师人物卡不含场景，
 * 故只注入架构师（节拍适配/状态红线）与撰写师（场头/氛围提及方式）两岗。
 */
export function buildSceneAssetDirective(assets: SceneAssetSeed[], lang: 'zh' | 'en' = 'zh'): string {
  const list = (assets ?? []).filter((a) => a && a.name && a.meaning).slice(0, MAX_ASSETS);
  if (!list.length) return '';
  const blocks = list.map((a, i) => {
    const parts: string[] = [];
    parts.push(lang === 'en' ? `plot function: ${a.meaning}` : `剧情功能：${a.meaning}`);
    if (a.mood) parts.push(lang === 'en' ? `mood: ${a.mood}` : `氛围基调：${a.mood}`);
    if (a.taboo) parts.push(lang === 'en' ? `state taboo: ${a.taboo}` : `状态禁忌：${a.taboo}`);
    if (a.visualAnchor) parts.push(lang === 'en' ? `visual anchor: ${a.visualAnchor}` : `外观锚点：${a.visualAnchor}`);
    return `${i + 1}. 「${a.name}」 ${parts.join('｜')}`;
  });
  const header = lang === 'en'
    ? `[SCENE ASSET CONSTRAINTS] The following key scenes are reusable assets from the user's scene library (cross-project). They are the hard fact source for these locations:`
    : `【场景资产强约束】以下关键场景来自用户沉淀的场景资产库（跨剧复用资产），是这些场景的事实源上限：`;
  const rules = lang === 'en'
    ? [
        'Location names may be adapted to this project\'s worldview, but the plot function and mood MUST stay intact — the same scene must carry the same kind of drama.',
        'Architect: beat placement must honor each scene\'s plot function (a power-struggle stage should not host pure slice-of-life); for scenes whose state taboo marks them destroyed/locked, do not use them intact without first showing rebuilding, a replacement venue, or a timeline explanation.',
        'Writer: scene headers and atmosphere descriptions must match the mood and visual anchor; do not contradict a scene\'s state taboo in action lines.',
        'Scenes not covered by assets are created freely per this project\'s outline.',
      ].map((r) => `- ${r}`).join('\n')
    : [
        '场景名可按本剧世界观调整，但剧情功能与氛围基调必须保持——同一场景要承载同一类戏。',
        '架构师：节拍适配必须符合场景的剧情功能（权谋舞台不排纯甜宠日常）；状态禁忌标明已烧毁/已封锁的场景，未补"重建/换场地/时间回溯"交代前不得完好使用。',
        '撰写师：场头与氛围描写必须符合其氛围基调与外观锚点；动作行不得违背状态禁忌（烧毁的场景不能完好出现）。',
        '资产未覆盖的场景按本剧大纲自由创作。',
      ].map((r) => `- ${r}`).join('\n');
  return `${header}\n${blocks.join('\n')}\n${rules}`;
}

/** 沉淀草稿（from-project 端点返回/入库前的中间形态） */
export interface SceneAssetDraft {
  name: string;
  /** 出现集号升序（跨集聚合） */
  eps: number[];
}

/**
 * 跨集聚合提取场景资产沉淀草稿（零 token、确定性）
 * @param episodes 分集序列 [{ep, content}]（ep 为集号，乱序安全；content 为成稿正文）
 * 场头解析与物料场景总表同源（sceneHeaderConvention），归一口径同 production-materials：
 * 中文内外景前缀剥进 intExt（不入档），仅"内景/外景"无地点的场头不进（与总表口径一致）。
 */
export function extractSceneAssetDrafts(
  episodes: { ep: number; content: string }[] | null | undefined,
): SceneAssetDraft[] {
  const rows = (episodes ?? []).filter((e) => e && Number.isFinite(Number(e.ep)) && Number(e.ep) >= 1 && typeof e.content === 'string' && e.content.trim())
    .sort((a, b) => Number(a.ep) - Number(b.ep));
  if (!rows.length) return [];
  const agg = new Map<string, Set<number>>();
  for (const { ep, content } of rows) {
    let parsed: ReturnType<typeof sceneHeaderConvention> | null = null;
    try { parsed = sceneHeaderConvention(content); } catch { parsed = null; }
    if (!parsed) continue;
    for (const h of parsed.headers) {
      // 内外景前缀归一（与 production-materials.buildProductionMaterials 同口径同正则，杜绝两处各写各的漂移）
      let location = (h.location || '').trim();
      const io = location.match(/^(内景|外景|室内|室外)\s*/);
      if (io) location = location.slice(io[0].length).trim();
      if (!location) continue; // 仅"内景/外景"无具体地点 → 不进（与总表 missing_location 口径一致）
      if (!agg.has(location)) agg.set(location, new Set());
      agg.get(location)!.add(Math.round(Number(ep)));
    }
  }
  const drafts: SceneAssetDraft[] = [...agg.entries()].map(([name, eps]) => ({
    name,
    eps: [...eps].sort((x, y) => x - y).slice(0, MAX_EPS),
  }));
  // 高频场景优先：按出现集数降序（跨集反复出现的场景才是"舞台发动机"级资产）
  drafts.sort((a, b) => b.eps.length - a.eps.length);
  return drafts.slice(0, MAX_DRAFTS);
}
