/**
 * 角色资产体检引擎（v2.152 编导分级协作法 L3"资产化运营"能力沉淀）
 * ------------------------------------------------------------------
 * 痛点：资产库一人一档 upsert 沉淀后，编导不知道哪些资产"能用"、哪些是空壳档
 * （只有名字没人设），更不知道两个资产气质撞车会在新剧里串戏。
 * 职责（与 character-asset/trend-brief 同构：纯函数零 IO 可离线对拍）：
 *  1. scoreCastAsset：五维完整度评分（人设内核 30 / 声音特质 20 / 声纹指纹 20 /
 *     标志性台词 15 / 视觉锚点 15）+ 缺项清单 + 可执行建议——驱动"先补什么"。
 *  2. detectCastAssetConflicts：跨资产冲突预警——同名不同人设（upsert 误覆盖风险）、
 *     人设几乎相同的重复档、声纹指纹一致但人设不同（气质串戏源）。
 *
 * 评分哲学（编导视角）：人设内核是资产的本体（缺了就不是资产而是通讯录）；
 * 声纹/台词是"换剧可辨识"的抓手；视觉锚点服务于 AIGC 换剧形象一致。
 */
import type { CastAssetSeed } from './character-asset';

/** 资产行兼容形态：prisma 行（voicePrint）与种子（voicePrintDigest）双命名 */
export type CastAssetLike = CastAssetSeed & { id?: string; voicePrint?: { signature?: string } | null; usedCount?: number };

export interface AssetHealth {
  score: number; // 0-100
  level: 'rich' | 'usable' | 'thin';
  missing: string[]; // 缺失维度（中英随 lang）
  advice: string[]; // 可执行建议（按价值降序，最多 3 条）
}

const DIM_WEIGHTS = { persona: 30, voice: 20, voicePrint: 20, signatureLines: 15, visualAnchor: 15 } as const;

function pickPrint(a: CastAssetLike): { signature?: string } | null | undefined {
  return (a.voicePrintDigest as { signature?: string } | null | undefined) ?? a.voicePrint ?? null;
}

/**
 * 单资产五维完整度体检
 * @param lang 建议文案语言（missing 键恒为英文维度名，便于前端对色）
 */
export function scoreCastAsset(a: CastAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): AssetHealth {
  const zh = lang !== 'en';
  if (!a || !a.name || !a.persona) {
    return {
      score: 0, level: 'thin',
      missing: ['name', 'persona'],
      advice: [zh ? '资产缺少名字或人设内核，无法约束三岗位创作——先补人设。' : 'Asset lacks a name or persona core; fill the persona before it can constrain generation.'],
    };
  }
  const missing: string[] = [];
  const advice: string[] = [];
  let score = DIM_WEIGHTS.persona; // 有人设即得满分 30
  if ((a.persona ?? '').trim().length < 8) {
    score -= 10;
    advice.push(zh ? '人设内核过短（<8 字）：欲望/弧光/性格底色至少写全两项，架构师才有行为逻辑可依。' : 'Persona core too short (<8 chars): cover at least two of desire/arc/temperament so the architect has behavior logic to follow.');
  }
  if (!a.voice?.trim()) { missing.push('voice'); advice.push(zh ? '缺声音特质：补句式/语气词/口头禅，撰写师的台词才有声音抓手。' : 'Missing voice: add sentence rhythm/particles/verbal tics so the writer has a voice anchor.'); }
  else score += DIM_WEIGHTS.voice;
  const print = pickPrint(a);
  if (!print?.signature) { missing.push('voicePrint'); advice.push(zh ? '无声纹指纹：对该角色成一集成稿后重新沉淀，声纹是换剧"听得出是同一人"的依据。' : 'No voice fingerprint: harvest again after generating an episode; the fingerprint is what makes the character recognizable across projects.'); }
  else score += DIM_WEIGHTS.voicePrint;
  // v2.160 防御：signatureLines 为 Json 字段，历史/直写污染成字符串时不再 TypeError（与 normalizeEps 对 eps 的防御同构）
  const sigs = (Array.isArray(a.signatureLines) ? a.signatureLines : []).filter((s) => s && s.trim());
  if (!sigs.length) { missing.push('signatureLines'); advice.push(zh ? '无标志性台词：从成稿取最长一句气质锚，禁止逐字照搬进新剧。' : 'No signature lines: harvest the longest line as a temperament anchor (never copy verbatim into new plots).'); }
  else {
    score += DIM_WEIGHTS.signatureLines;
    if (sigs.length > 3) advice.push(zh ? `标志性台词 ${sigs.length} 条偏多：气质锚保留前 3 条即可，条目越多越容易被模型逐字照搬。` : `${sigs.length} signature lines is too many: keep 3 as temperament anchors; more invites verbatim copying.`);
  }
  if (!a.visualAnchor?.trim()) { missing.push('visualAnchor'); advice.push(zh ? '缺视觉锚点：补一个稳定外形特征（疤痕/服饰/体态），AIGC 换剧才画得出同一张脸。' : 'Missing visual anchor: add one stable physical trait so AIGC renders the same face across projects.'); }
  else score += DIM_WEIGHTS.visualAnchor;
  const level: AssetHealth['level'] = score >= 85 ? 'rich' : score >= 55 ? 'usable' : 'thin';
  if (level === 'rich') advice.unshift(zh ? '资产完整度达标：可直接跨剧引用，注意引用后人设内核不再随剧情漂移。' : 'Asset is complete: ready for cross-project reference; the persona core stays fixed after referencing.');
  else if (level === 'thin') advice.unshift(zh ? '空壳资产：当前只能"占位"，引用后三岗位拿不到有效约束，建议先体检补全再引用。' : 'Shell asset: referencing it now gives the three roles no effective constraints; complete it before referencing.');
  return { score: Math.max(0, Math.min(100, score)), level, missing, advice: advice.slice(0, 3) };
}

export interface AssetConflict {
  type: 'dup_name' | 'same_persona' | 'clash_print';
  a: string; // 资产名 A（同 name 冲突时为名字本身）
  b: string; // 资产名 B（同 name 冲突时为空串）
  note: string; // 中英说明
}

/**
 * 跨资产冲突预警（库级体检）
 *  - dup_name：同名不同人设——upsert"一人一档"会被后写者覆盖，需先改名或合并
 *  - same_persona：人设内核几乎相同（去空白后完全一致）——重复档，合并成一个
 *  - clash_print：声纹指纹一致但人设不同——两个角色听起来像同一个人，新剧会串戏
 */
export function detectCastAssetConflicts(assets: (CastAssetLike | null | undefined)[], lang: 'zh' | 'en' = 'zh'): AssetConflict[] {
  const zh = lang !== 'en';
  const list = (assets ?? []).filter((a): a is CastAssetLike => !!a && !!a.name && !!a.persona);
  const out: AssetConflict[] = [];
  // v2.160 口径统一：dup_name 与 same_persona 同用 norm（去全部空白）——
  // 原 dup_name 只 trim，同名两人设仅差中间空白时误报"不同人设"，与同文件 same_persona 的"相同"判定自相矛盾（prop 家族已统一 norm）
  const norm = (s: string) => String(s ?? '').replace(/\s+/g, '');
  const byName = new Map<string, CastAssetLike[]>();
  for (const a of list) {
    const arr = byName.get(a.name) ?? [];
    arr.push(a);
    byName.set(a.name, arr);
  }
  for (const [name, arr] of byName) {
    const personas = new Set(arr.map((a) => norm(a.persona)));
    if (arr.length > 1 && personas.size > 1) {
      out.push({ type: 'dup_name', a: name, b: '', note: zh ? `同名「${name}」存在 ${personas.size} 套不同人设：同名 upsert 会互相覆盖，先改名或合并为一档。` : `Name "${name}" carries ${personas.size} different personas: same-name upsert overwrites silently — rename or merge first.` });
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.name === b.name) continue; // 同名冲突已在 dup_name 报告
      if (norm(a.persona!) === norm(b.persona!)) {
        out.push({ type: 'same_persona', a: a.name, b: b.name, note: zh ? `「${a.name}」与「${b.name}」人设内核完全相同：重复档，合并为一个资产。` : `"${a.name}" and "${b.name}" share an identical persona core: merge into one asset.` });
        continue;
      }
      const pa = pickPrint(a)?.signature?.trim(), pb = pickPrint(b)?.signature?.trim();
      if (pa && pb && pa === pb) {
        out.push({ type: 'clash_print', a: a.name, b: b.name, note: zh ? `「${a.name}」与「${b.name}」声纹指纹一致但人设不同：换剧后观众会"听串"，调整其中一个的句式/语气词。` : `"${a.name}" and "${b.name}" share a voice fingerprint but differ in persona: viewers will conflate them — retune one's rhythm/particles.` });
      }
    }
  }
  return out.slice(0, 20); // 预警上限：库级体检不是错误清单，避免面板刷屏
}

/**
 * v2.181 规则模板补全（零 token 不调 AI）
 * ---------------------------------------------------
 * 痛点：thin 视图筛选出一堆空壳资产（只缺 voice/visualAnchor/signatureLines），
 *   编导一条一条手补太累；调 AI 又费 token——其实"占位级"补全用规则模板就够：
 *   补完后资产从 thin 升到 usable，三岗位有最小约束可依，编导后续可逐条精修。
 * 哲学：autoFill 只补"占位"不补"指纹"——
 *   - voice/signatureLines/visualAnchor 基于 persona 生成可读占位（编导视角可接受）；
 *   - voicePrint 不可规则补全（声纹必须从成稿生成后沉淀，规则生成会污染跨剧辨识）→ skipped；
 *   - persona/name 必填，缺则整条 skipped（不替编导捏人设）。
 * 返回：{ filled: 补全字段映射, skipped: 跳过原因[] }——供前端预览或直接保存。
 */
export interface AutoFillCastResult {
  filled: Partial<Pick<CastAssetLike, 'voice' | 'signatureLines' | 'visualAnchor'>> & { filledFields: string[] };
  skipped: { field: string; reason: string }[];
}

export function autoFillCastAsset(a: CastAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): AutoFillCastResult {
  const zh = lang !== 'en';
  const filled: AutoFillCastResult['filled'] = { filledFields: [] };
  const skipped: AutoFillCastResult['skipped'] = [];
  if (!a || !a.name || !a.persona) {
    skipped.push({ field: 'persona', reason: zh ? '缺名字或人设内核，不替编导捏人设——先手写 persona 再来补全。' : 'Missing name or persona core; auto-fill refuses to invent a persona — write persona by hand first.' });
    return { filled, skipped };
  }
  const persona = a.persona.trim();
  const h = scoreCastAsset(a, lang);
  // voice：句式/语气词/口头禅占位（基于 persona 关键词抽取）
  if (h.missing.includes('voice')) {
    filled.voice = zh
      ? `句式${persona.slice(0, 4)}…；语气词"嗯/吧/呢"；口头禅"${persona.slice(-2)}才怪"`
      : `Rhythm: ${persona.slice(0, 4)}…; particles: mm/ba/ne; verbal tic: "as ${persona.slice(-2)} if"`;
    filled.filledFields!.push('voice');
  }
  // signatureLines：一句气质锚占位（基于 persona 抽核心动词）
  if (h.missing.includes('signatureLines')) {
    filled.signatureLines = [zh
      ? `${persona.slice(0, 6)}，是我这辈子不会让步的事。`
      : `${persona.slice(0, 6)} — that's what I'll never yield on.`];
    filled.filledFields!.push('signatureLines');
  }
  // visualAnchor：身材/服饰/体态占位
  if (h.missing.includes('visualAnchor')) {
    filled.visualAnchor = zh
      ? `身材中 等；常穿${persona.slice(0, 2)}色立领衫；体态${persona.includes('怒') || persona.includes('刚') ? '挺拔' : '随和'}`
      : `Medium build; ${persona.slice(0, 2)}-colored mandarin collar; ${persona.includes('怒') || persona.includes('刚') ? 'upright' : 'relaxed'} posture`;
    filled.filledFields!.push('visualAnchor');
  }
  // voicePrint 不可规则补全
  if (h.missing.includes('voicePrint')) {
    skipped.push({ field: 'voicePrint', reason: zh ? '声纹指纹必须从成稿生成后沉淀，规则补全会污染跨剧辨识——跳过。' : 'Voice fingerprint must be harvested from a finished episode; rule-based fill would pollute cross-project recognition — skipped.' });
  }
  return { filled, skipped };
}

// 注：autoFillPropAsset / autoFillSceneAsset 分别定义在 prop-health.ts / scene-health.ts，
// 与三族体检引擎同构（同文件同 export），避免反向依赖破坏 asset-health → prop-health → scene-health 的依赖方向。
