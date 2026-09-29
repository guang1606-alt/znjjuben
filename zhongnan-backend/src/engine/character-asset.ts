/**
 * 角色资产引擎（v2.151 编导分级协作法 L3"角色可资产化"工具落地）
 * ------------------------------------------------------------------
 * 痛点：换剧角色从零开始，人设/声线不复用，L3 编导无法把"养熟的角色"沉淀成跨剧资产。
 * 职责（与 brand-brief/trend-brief 同构：事实源 + 指令构建 + 离线提取，零 IO 可离线对拍）：
 *  1. buildCastAssetDirective：把引用的角色资产编译成三岗位（架构师/人设师/撰写师）强约束指令——
 *     名字可随新剧世界观调整，但人设内核/声音特征必须跨剧可辨识。
 *  2. extractCastAssetDrafts：从项目全局圣经（bible.characters）+ 最近成稿提取沉淀草稿——
 *     人设来自 traits/arc，声纹摘要复用 voice-print 引擎对成稿重算（一手数据源，不依赖落库摘要）。
 *
 * 数据源规约（L107① 教训）：沉淀只信 bible.characters 与 script.content 两个一手源；
 * voicePrint 引擎纯函数重算，杜绝"事后回看时落库摘要不在位"的静默失效。
 */
import { voicePrint, type VoicePrint } from './voice-print';
import { parseDialogue, type CastMap } from './character-logic';

/** 角色资产种子（落库快照/管线注入共用形态） */
export interface CastAssetSeed {
  id?: string;
  name: string;
  /** 人设内核：欲望/弧光/性格底色 */
  persona: string;
  /** 声音特质：句式/语气词/口头禅气质 */
  voice?: string | null;
  /** 标志性台词（气质锚，禁止逐字照搬进新剧） */
  signatureLines?: string[] | null;
  /** 视觉锚点（AIGC 换剧保持形象一致） */
  visualAnchor?: string | null;
  /** 声纹指纹摘要（voice-print 引擎产出） */
  voicePrintDigest?: { signature?: string } | null;
}

/** 沉淀草稿（from-project 端点返回/入库前的中间形态） */
export interface CastAssetDraft {
  name: string;
  persona: string;
  voice: string | null;
  signatureLines: string[];
  voicePrint: { avgLen: number; shortRatio: number; questionRatio: number; exclamRatio: number; topParticles: string[]; signature: string } | null;
  lineCount: number;
}

const MAX_ASSETS = 10;
const MAX_DRAFTS = 5; // 单项目一次沉淀上限：按对白样本量取主要角色

/**
 * 把角色资产编译成三岗位强约束指令（中英双语）
 * 注入语义划界（L106②）：三岗共用——架构师管行为逻辑、人设师管人设卡落库、撰写师管台词声音；
 * 海报/分镜导出不需要（人设不构成视觉事实源，视觉锚点仅作 AIGC 形象参考写入分镜附录时另行处理）。
 */
export function buildCastAssetDirective(assets: CastAssetSeed[], lang: 'zh' | 'en' = 'zh'): string {
  const list = (assets ?? []).filter((a) => a && a.name && a.persona).slice(0, MAX_ASSETS);
  if (!list.length) return '';
  const blocks = list.map((a, i) => {
    const parts: string[] = [];
    parts.push(lang === 'en' ? `persona: ${a.persona}` : `人设内核：${a.persona}`);
    if (a.voice) parts.push(lang === 'en' ? `voice: ${a.voice}` : `声音特质：${a.voice}`);
    if (a.visualAnchor) parts.push(lang === 'en' ? `visual anchor: ${a.visualAnchor}` : `视觉锚点：${a.visualAnchor}`);
    // v2.160 防御：signatureLines 为 Json 字段，污染成字符串时不进指令（与 asset-health 的防御同构）
    if (Array.isArray(a.signatureLines) && a.signatureLines.length) parts.push(lang === 'en' ? `signature lines (style anchor only): ${a.signatureLines.slice(0, 3).join(' / ')}` : `标志性台词（仅气质锚）：${a.signatureLines.slice(0, 3).join(' / ')}`);
    if (a.voicePrintDigest?.signature) parts.push(lang === 'en' ? `voice fingerprint: ${a.voicePrintDigest.signature}` : `声纹指纹：${a.voicePrintDigest.signature}`);
    return `${i + 1}. 「${a.name}」 ${parts.join('｜')}`;
  });
  const header = lang === 'en'
    ? `[CHARACTER ASSET CONSTRAINTS] The following characters are reusable assets from the user's character library (cross-project). They are the hard fact source for these characters:`
    : `【角色资产强约束】以下角色来自用户沉淀的角色资产库（跨剧复用资产），是这些角色的事实源上限：`;
  const rules = lang === 'en'
    ? [
        'Names may be adapted to this project\'s worldview, but the persona core (desire/arc/temperament) and voice features (sentence rhythm/particles/verbal tics) MUST stay recognizable — a viewer should identify "the same character" across projects.',
        'Architect: plot beats must never violate the asset persona\'s desire chain or behavior logic.',
        'Character designer: these characters MUST appear in the cast cards; keep the voice field consistent with the asset.',
        'Writer: dialogue for these characters MUST follow their voice features and signature-line temperament; never copy signature lines verbatim into new plots.',
        'Characters not covered by assets are created freely per this project\'s outline; do not blend temperaments between asset and non-asset characters.',
      ].map((r) => `- ${r}`).join('\n')
    : [
        '名字可按本剧世界观调整，但人设内核（欲望/弧光/性格底色）与声音特征（句式节奏/语气词/口头禅）必须保持跨剧可辨识——观众换剧也能认出"就是那个角色"。',
        '架构师：情节走向不得违背资产人设的欲望链与行为逻辑。',
        '人设师：这些角色必须写入人物卡，voice 字段与资产保持一致。',
        '撰写师：这些角色的台词必须遵守其声音特征与标志性台词气质；标志性台词禁止逐字照搬进新剧情节。',
        '资产未覆盖的角色按本剧大纲自由创作，资产角色与非资产角色的气质不得混用。',
      ].map((r) => `- ${r}`).join('\n');
  return `${header}\n${blocks.join('\n')}\n${rules}`;
}

/** bible.characters 兼容形态（traits/arc/voice，来自 result.bible 回写） */
type BibleCharacters = Record<string, { traits?: string; arc?: string; voice?: string } | undefined | null>;

// v2.191 c191 沉淀入口字段类型壳：bible 经 pipeline LLM 裸 JSON 落库（无 zod），
// traits/arc/voice 实测可能是 number/boolean/object/array——非字符串一律视同缺失，
// 杜绝裸 .trim() TypeError 让一个畸形角色毒丸整批沉淀（与 v2.160 signatureLines Json 污染防御同口径）。
const asBibleString = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * 从全局圣经 + 最近成稿提取角色资产沉淀草稿（零 token、确定性）
 * @param characters 项目 bible.characters（Record<名字, {traits,arc,voice}>）
 * @param scriptContent 最近一集成稿正文（可空：无成稿时仅沉淀人设，声纹为 null）
 * @param lang 中英文（声纹语气词表按语言切换）
 */
export function extractCastAssetDrafts(
  characters: BibleCharacters | null | undefined,
  scriptContent: string | null | undefined,
  lang: 'zh' | 'en' = 'zh',
): CastAssetDraft[] {
  // c157 复盘修复：键名 trim 归一——bible.characters 键来自 LLM 生成/立项解析，形态不可控；
  // 带空白键会沉淀出孤儿档（与手动 upsert 的 schema trim 口径分裂，dup_name 分组也检不出）；
  // trim 后同步改善 castMap 键与 script 对白说话人的匹配命中率。
  const entries = Object.entries(characters ?? {})
    .map(([name, c]) => [String(name ?? '').trim(), c] as const)
    .filter(([name, c]) => name && c && typeof c === 'object');
  if (!entries.length) return [];
  // 成稿存在时用对白指纹引擎重算声纹（一手源：script.content）
  let printsByName = new Map<string, VoicePrint>();
  if (scriptContent && scriptContent.trim().length >= 100) {
    const castMap: CastMap = {};
    for (const [name, c] of entries) castMap[name] = { voice: asBibleString(c?.voice), arc: asBibleString(c?.arc), hidden: [] };
    try {
      const vp = voicePrint(castMap, scriptContent, lang);
      for (const p of vp.prints) printsByName.set(p.name, p);
    } catch { /* 指纹重算失败不阻断沉淀，声纹置空 */ }
  }
  // 标志性台词草稿：取该角色最长一句台词（截 40 字），只作气质锚不逐字照搬
  const sigByName = new Map<string, string>();
  if (scriptContent) {
    for (const d of parseDialogue(scriptContent)) {
      const cur = sigByName.get(d.name);
      if (!cur || d.text.length > cur.length) sigByName.set(d.name, d.text);
    }
  }
  const drafts: CastAssetDraft[] = [];
  for (const [name, c] of entries) {
    const traits = asBibleString(c?.traits).trim();
    const arc = asBibleString(c?.arc).trim();
    const voice = asBibleString(c?.voice).trim();
    if (!traits && !arc && !voice) continue; // 三项全空：无资产价值，跳过
    const p = printsByName.get(name);
    // 声纹样本不足（<2 句）不落声纹摘要，避免"指纹无法判定"的噪音资产
    const digest = p && p.lineCount >= 2 ? {
      avgLen: p.avgLen, shortRatio: p.shortRatio, questionRatio: p.questionRatio, exclamRatio: p.exclamRatio,
      topParticles: Object.entries(p.particles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
      signature: p.signature,
    } : null;
    const personaParts: string[] = [];
    if (traits) personaParts.push(traits);
    if (arc) personaParts.push(lang === 'en' ? `arc: ${arc}` : `弧光：${arc}`);
    const sig = sigByName.get(name);
    drafts.push({
      name,
      persona: personaParts.join('；') || (lang === 'en' ? 'persona pending' : '人设待补'),
      voice: voice || null,
      signatureLines: sig ? [sig.slice(0, 40)] : [],
      voicePrint: digest,
      lineCount: p?.lineCount ?? 0,
    });
  }
  // 主要角色优先：按对白样本量降序（无成稿时按圣经声明序）
  drafts.sort((a, b) => b.lineCount - a.lineCount);
  return drafts.slice(0, MAX_DRAFTS);
}
