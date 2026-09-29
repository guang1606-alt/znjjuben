/**
 * 道具资产引擎（v2.159 编导分级协作法 L3"道具可资产化"工具落地，对标 v2.151 角色资产库）
 * ------------------------------------------------------------------
 * 痛点：关键信物（玉佩/婚书/DNA报告）是短剧的剧情发动机，但换剧即从零设计——
 * L3 编导养熟的"信物模型"（认亲信物/复仇证据/悬念载体）无法跨剧复用；
 * 且信物的连续性规则（销毁后禁凭空再现）每剧都要重新交代。
 * 职责（与 character-asset/prop-ledger 同构：纯函数零 IO 可离线对拍，零 token）：
 *  1. buildPropAssetDirective：把引用的道具资产编译成架构师/撰写师强约束指令——
 *     名字可随新剧世界观调整，但剧情含义/功能与连续性禁忌必须跨剧保持。
 *  2. extractPropAssetDrafts：跨集聚合成稿 → 关键信物沉淀草稿——
 *     一手源 script.content × 信物词典（extractPropMentions，与信物账本/物料道具总表同词典同口径），
 *     出现集/封禁集/首现语境全部确定性提取。
 *
 * 数据源规约（L107① 教训）：沉淀只信 script.content 一手源 × 同一信物词典，
 * 杜绝"沉淀词典与账本词典漂移"导致的静默口径分裂。
 */
import { extractPropMentions } from './prop-ledger';

/** 道具资产种子（落库快照/管线注入共用形态） */
export interface PropAssetSeed {
  id?: string;
  /** 信物名（词典原样或自定义） */
  name: string;
  /** 剧情含义/功能（认亲信物/复仇证据/悬念载体） */
  meaning: string;
  /** 连续性禁忌（已销毁/已交出，禁止凭空再现等） */
  taboo?: string | null;
  /** 外观锚点（AIGC 换剧保持道具一致） */
  visualAnchor?: string | null;
}

const MAX_ASSETS = 10;
const MAX_DRAFTS = 8; // 单项目一次沉淀上限：信物词典只收剧情关键级，噪音低
const MAX_EPS = 500;  // 出现集记录上限（分集上限一致）

/**
 * 把道具资产编译成架构师/撰写师强约束指令（中英双语）
 * 注入语义划界（L106②）：道具是"剧情事实源"不是"人设"——人设师人物卡不含道具，
 * 故只注入架构师（埋设/回收节拍不得违背含义与禁忌）与撰写师（台词/动作提及方式）两岗。
 */
export function buildPropAssetDirective(assets: PropAssetSeed[], lang: 'zh' | 'en' = 'zh'): string {
  const list = (assets ?? []).filter((a) => a && a.name && a.meaning).slice(0, MAX_ASSETS);
  if (!list.length) return '';
  const blocks = list.map((a, i) => {
    const parts: string[] = [];
    parts.push(lang === 'en' ? `plot meaning: ${a.meaning}` : `剧情含义：${a.meaning}`);
    if (a.taboo) parts.push(lang === 'en' ? `continuity taboo: ${a.taboo}` : `连续性禁忌：${a.taboo}`);
    if (a.visualAnchor) parts.push(lang === 'en' ? `visual anchor: ${a.visualAnchor}` : `外观锚点：${a.visualAnchor}`);
    return `${i + 1}. 「${a.name}」 ${parts.join('｜')}`;
  });
  const header = lang === 'en'
    ? `[PROP ASSET CONSTRAINTS] The following key props are reusable assets from the user's prop library (cross-project). They are the hard fact source for these props:`
    : `【道具资产强约束】以下关键信物来自用户沉淀的道具资产库（跨剧复用资产），是这些信物的事实源上限：`;
  const rules = lang === 'en'
    ? [
        'Names may be adapted to this project\'s worldview, but the plot meaning/function and continuity taboos MUST stay intact — the prop must drive the same kind of story beat.',
        'Architect: plant/payoff beats for these props must honor their plot meaning; never destroy/lose a prop whose taboo forbids it without showing recovery, a remake, or a backup first.',
        'Writer: mentions of these props in dialogue/action must match their plot meaning and visual anchor; do not treat a keepsake prop as a throwaway.',
        'Props not covered by assets are created freely per this project\'s outline.',
      ].map((r) => `- ${r}`).join('\n')
    : [
        '信物名可按本剧世界观调整，但剧情含义/功能与连续性禁忌必须保持——同一信物要驱动同一类剧情节拍。',
        '架构师：这些信物的埋设/回收节拍必须符合其剧情含义；禁忌标明已销毁/已交出的信物，未补"找回/重制/另有备份"交代前不得再出场。',
        '撰写师：台词与动作中提及这些信物必须符合其剧情含义与外观锚点，纪念性信物不得当一次性道具用。',
        '资产未覆盖的信物按本剧大纲自由创作。',
      ].map((r) => `- ${r}`).join('\n');
  return `${header}\n${blocks.join('\n')}\n${rules}`;
}

/** 沉淀草稿（from-project 端点返回/入库前的中间形态） */
export interface PropAssetDraft {
  name: string;
  /** 首现语境截句（含义线索，≤60 字，编导可精修） */
  meaning: string;
  /** 出现集号升序（跨集聚合） */
  eps: number[];
  /** 封禁集号（伴随销毁/丢失动作的集，升序） */
  closedEps: number[];
}

/** 首现语境截句长度（含义线索：足够辨认功能，不吞提示词预算） */
const MEANING_CLUE_MAX = 60;

/** 清理首现语境行：去掉场头/动作标记/说话人前缀，保留可读语境 */
function cleanMeaningClue(line: string): string {
  const s = line.replace(/^\s*△?\s*/, '').replace(/^[^：:]{1,12}[：:]\s*/, '').trim();
  return s.slice(0, MEANING_CLUE_MAX);
}

/**
 * 跨集聚合提取道具资产沉淀草稿（零 token、确定性）
 * @param episodes 分集序列 [{ep, content}]（ep 为集号，乱序安全；content 为成稿正文）
 * 信物词典与信物账本/物料道具总表同源（extractPropMentions），长词优先防截胡。
 */
export function extractPropAssetDrafts(
  episodes: { ep: number; content: string }[] | null | undefined,
): PropAssetDraft[] {
  const rows = (episodes ?? []).filter((e) => e && Number.isFinite(Number(e.ep)) && Number(e.ep) >= 1 && typeof e.content === 'string' && e.content.trim())
    .sort((a, b) => Number(a.ep) - Number(b.ep));
  if (!rows.length) return [];
  const agg = new Map<string, { eps: Set<number>; closedEps: Set<number>; clue: string | null }>();
  for (const { ep, content } of rows) {
    // 逐句提取（extractPropMentions 按句切分并判 closed）；为拿首现语境按句独立跑
    for (const sent of content.split(/[。！？；!?;\n\r]+/).map((s) => s.trim()).filter(Boolean)) {
      for (const it of extractPropMentions(sent)) {
        if (!agg.has(it.name)) agg.set(it.name, { eps: new Set(), closedEps: new Set(), clue: cleanMeaningClue(sent) || null });
        const a = agg.get(it.name)!;
        a.eps.add(Math.round(Number(ep)));
        if (it.closed) a.closedEps.add(Math.round(Number(ep)));
      }
    }
  }
  const drafts: PropAssetDraft[] = [...agg.entries()].map(([name, a]) => ({
    name,
    meaning: a.clue ?? '',
    eps: [...a.eps].sort((x, y) => x - y).slice(0, MAX_EPS),
    closedEps: [...a.closedEps].sort((x, y) => x - y).slice(0, MAX_EPS),
  }));
  // 高频信物优先：按出现集数降序（跨集反复出现的信物才是"剧情发动机"级资产）
  drafts.sort((a, b) => b.eps.length - a.eps.length);
  return drafts.slice(0, MAX_DRAFTS);
}
