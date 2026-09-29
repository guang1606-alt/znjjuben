/**
 * 场景资产体检引擎（v2.161 L3"资产化运营"能力沉淀，第三资产家族，对标 v2.159 道具体检）
 * ------------------------------------------------------------------
 * 痛点：场景资产入库后，编导不知道哪些场景档"能用"、哪些是空壳（只有地点没功能/氛围），
 * 也不知道两个场景档在跨剧复用时会拿错状态红线（一档已烧毁、一档在用）。
 * 职责（与 asset-health/prop-health 同构：纯函数零 IO 可离线对拍，零 token）：
 *  1. scoreSceneAsset：五维完整度评分（剧情功能 30 / 外观锚点 25 / 氛围基调 15 /
 *     出现集 15 / 标签 15）+ 缺项清单 + 可执行建议——驱动"先补什么"。
 *  2. detectSceneAssetConflicts：跨资产冲突预警——同名不同功能（upsert 误覆盖风险）、
 *     异名同功能同锚点（重复档，合并）、同名状态红线不一致（复用会拿错烧毁/在用状态）。
 *
 * 评分哲学（编导视角，与道具家族的维度辨析）：
 *  - 场景的本体 = 剧情功能（这场景承载什么戏）+ 外观锚点（AIGC 换剧画同一个场），
 *    故功能 30 + 锚点 25 双高，高于道具的"含义 40 独大"；
 *  - 氛围基调维度兼收状态红线：有 mood 全分；无 mood 但写了 taboo 给 10 分
 *    （Math.round(15*2/3)，红线在位但不可视化）——场景禁忌少见，若独立成维多数场景永远封不了"丰满"；
 *  - 出现集/标签与道具家族同语义同权重逻辑。
 */
import { normalizeEps } from './prop-health'; // 出现集归一与道具家族同口径（同语义同判定铁律）
import type { SceneAssetSeed } from './scene-asset';

/** 资产行兼容形态：prisma 行（eps 为 Json）与种子双命名 */
export type SceneAssetLike = SceneAssetSeed & {
  id?: string;
  /** 出现集号（沉淀产物或手动补录） */
  eps?: number[] | null;
  usedCount?: number;
  /** 题材/功能标签（跨剧检索用） */
  tags?: (string | null)[] | null;
};

export interface SceneHealth {
  score: number; // 0-100
  level: 'rich' | 'usable' | 'thin';
  missing: string[]; // 缺失维度（恒为英文维度名，便于前端对色）
  advice: string[]; // 可执行建议（按价值降序，最多 3 条）
}

const DIM = { meaning: 30, visualAnchor: 25, mood: 15, eps: 15, tags: 15 } as const;

/**
 * 单场景五维完整度体检
 * @param lang 建议文案语言（missing 键恒为英文维度名，便于前端对色）
 */
export function scoreSceneAsset(a: SceneAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): SceneHealth {
  const zh = lang !== 'en';
  if (!a || !a.name || !a.meaning) {
    return {
      score: 0, level: 'thin',
      missing: ['name', 'meaning'],
      advice: [zh ? '场景档缺少地点或剧情功能，无法约束创作——先补功能（这场景承载什么戏？）。' : 'Scene asset lacks a location or plot function; state what kind of drama this scene carries first.'],
    };
  }
  const missing: string[] = [];
  const advice: string[] = [];
  let score = DIM.meaning; // 有功能即得满分 30
  if ((a.meaning ?? '').trim().length < 8) {
    score -= 10;
    advice.push(zh ? '剧情功能过短（<8 字）：写清这场景承载什么戏（主线舞台/情感锚点/冲突现场/高光打脸场），架构师才知道往哪排节拍。' : 'Plot function too short (<8 chars): state what drama the scene carries (main stage / emotional anchor / conflict arena).');
  }
  const eps = normalizeEps(a.eps);
  if (!eps.length) { missing.push('eps'); advice.push(zh ? '无出现集记录：从成稿场头沉淀或手动补录出现集，置景复用密度才有依据。' : 'No episode record: harvest from scene headers or add episodes manually so reuse density has anchors.'); }
  else score += DIM.eps;
  const mood = (a.mood ?? '').trim();
  const taboo = (a.taboo ?? '').trim();
  if (mood) {
    score += DIM.mood;
    if (taboo) { /* mood 全分 + taboo 不加分：状态红线是文本事实，写入即随档生效（指令注入），不占五维预算 */ }
  } else if (taboo) {
    // 无氛围但写了状态红线：给 10 分（状态在位但氛围不可视化）
    score += Math.round((DIM.mood * 2) / 3);
    advice.push(zh ? '已写状态禁忌但缺氛围基调：补一句情绪底色（阴森/温馨/压抑），AIGC 生图光线与节拍适配才有依据。' : 'State taboo present but mood missing: add one line of emotional tone so AIGC lighting and beat matching have anchors.');
  } else {
    missing.push('mood');
    advice.push(zh ? '缺氛围基调：补情绪底色（阴森/温馨/压抑…），场景跨剧复用时光线与配乐气质才不漂移。' : 'Missing mood: add the emotional tone so lighting and music temperament stay consistent on reuse.');
  }
  if (!a.visualAnchor?.trim()) { missing.push('visualAnchor'); advice.push(zh ? '缺外观锚点：补一句稳定外观（建筑形制/陈设/光线条件），AIGC 换剧才画得出同一个场。' : 'Missing visual anchor: add one stable look (structure/props/lighting) so AIGC renders the same scene across projects.'); }
  else score += DIM.visualAnchor;
  const tags = (a.tags ?? []).filter((s) => s && s.trim());
  if (!tags.length) { missing.push('tags'); advice.push(zh ? '无标签：补题材/功能标签（如 权谋·祠堂），跨剧检索才搜得到。' : 'No tags: add genre/function tags so the asset is findable across projects.'); }
  else score += DIM.tags;
  const level: SceneHealth['level'] = score >= 85 ? 'rich' : score >= 55 ? 'usable' : 'thin';
  if (level === 'rich') advice.unshift(zh ? '资产完整度达标：可直接跨剧引用，引用后功能与氛围不再随剧情漂移。' : 'Asset is complete: ready for cross-project reference; function and mood stay fixed after referencing.');
  else if (level === 'thin') advice.unshift(zh ? '空壳场景档：当前只能"占位"，引用后架构师拿不到有效约束，建议先体检补全再引用。' : 'Shell scene asset: referencing it now gives the architect no effective constraints; complete it before referencing.');
  return { score: Math.max(0, Math.min(100, score)), level, missing, advice: advice.slice(0, 3) };
}

export interface SceneConflict {
  type: 'dup_name' | 'same_scene' | 'closed_mismatch';
  a: string; // 资产名 A（同 name 冲突时为名字本身）
  b: string; // 资产名 B（同 name 冲突时为空串）
  note: string; // 中英说明
}

const norm = (s: string) => String(s ?? '').replace(/\s+/g, '');
// 场景无确定性封禁集提取（销毁检测无词典支撑），状态红线只来自 taboo 文本
const closedState = (a: SceneAssetLike): boolean => !!a.taboo?.trim();

/**
 * 跨资产冲突预警（库级体检）
 *  - dup_name：同名不同功能——upsert"一景一档"会被后写者覆盖，需先改名或合并
 *  - same_scene：异名功能+外观锚点双键一致——重复档，合并成一个
 *    （与道具 same_meaning 的单键辨析：场景功能文本易写得泛同（"主要拍摄场地"），
 *     外观锚点是场景的本体辨识，双键才判"真的是同一个场"）
 *  - closed_mismatch：同名且功能一致但状态红线不一致——一档已烧毁一档在用，跨剧复用会拿错状态
 */
export function detectSceneAssetConflicts(assets: (SceneAssetLike | null | undefined)[], lang: 'zh' | 'en' = 'zh'): SceneConflict[] {
  const zh = lang !== 'en';
  const list = (assets ?? []).filter((a): a is SceneAssetLike => !!a && !!a.name && !!a.meaning);
  const out: SceneConflict[] = [];
  const byName = new Map<string, SceneAssetLike[]>();
  for (const a of list) {
    const arr = byName.get(a.name) ?? [];
    arr.push(a);
    byName.set(a.name, arr);
  }
  for (const [name, arr] of byName) {
    const meanings = new Set(arr.map((a) => norm(a.meaning)));
    if (arr.length > 1 && meanings.size > 1) {
      out.push({ type: 'dup_name', a: name, b: '', note: zh ? `同名场景「${name}」存在 ${meanings.size} 套不同功能：同名 upsert 会互相覆盖，先改名或合并为一档。` : `Location "${name}" carries ${meanings.size} different plot functions: same-name upsert overwrites silently — rename or merge first.` });
      continue; // 功能都不一致的同名档，无需再查状态红线冲突
    }
    if (arr.length > 1) {
      const closedSet = new Set(arr.map(closedState));
      if (closedSet.size > 1) {
        out.push({ type: 'closed_mismatch', a: name, b: '', note: zh ? `同名场景「${name}」状态红线不一致（一档已烧毁/封锁、一档在用）：跨剧复用会拿错状态，先对齐销毁/在用记录。` : `Location "${name}" has conflicting state taboos (destroyed vs active): reuse will pick the wrong state — align the records first.` });
      }
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.name === b.name) continue; // 同名冲突已在上面报告
      if (norm(a.meaning) === norm(b.meaning) && norm(a.visualAnchor ?? '') === norm(b.visualAnchor ?? '')) {
        out.push({ type: 'same_scene', a: a.name, b: b.name, note: zh ? `「${a.name}」与「${b.name}」剧情功能与外观锚点完全相同：重复档，合并为一个场景资产。` : `"${a.name}" and "${b.name}" share identical plot function and visual anchor: merge into one scene asset.` });
      }
    }
  }
  return out.slice(0, 20); // 预警上限：库级体检不是错误清单，避免面板刷屏
}

/**
 * v2.181 规则模板补全（场景家族）
 * ---------------------------------------------------
 * 与 autoFillCastAsset / autoFillPropAsset 同构：零 token 不调 AI 的占位级补全。
 *  - visualAnchor：基于 meaning 生成"建筑形制/陈设/光线条件"占位
 *  - mood：基于 meaning 关键词推断情绪底色（压抑/温馨/阴沉/中性）
 *  - tags：从 meaning 抽 2-3 个中文关键词作标签
 *  - eps 不可规则补全 → skipped
 *  - meaning 必填，缺则整条 skipped
 */
export interface AutoFillSceneResult {
  filled: Partial<Pick<SceneAssetLike, 'visualAnchor' | 'mood' | 'tags'>> & { filledFields: string[] };
  skipped: { field: string; reason: string }[];
}

export function autoFillSceneAsset(a: SceneAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): AutoFillSceneResult {
  const zh = lang !== 'en';
  const filled: AutoFillSceneResult['filled'] = { filledFields: [] };
  const skipped: AutoFillSceneResult['skipped'] = [];
  if (!a || !a.name || !a.meaning) {
    skipped.push({ field: 'meaning', reason: zh ? '缺地点或剧情功能，不替编导捏功能——先手写 meaning 再来补全。' : 'Missing location or plot function; auto-fill refuses to invent a function — write meaning by hand first.' });
    return { filled, skipped };
  }
  const meaning = a.meaning.trim();
  const h = scoreSceneAsset(a, lang);
  if (h.missing.includes('visualAnchor')) {
    filled.visualAnchor = zh
      ? `形制${meaning.includes('祠') || meaning.includes('庙') ? '祠堂式' : meaning.includes('府') || meaning.includes('宅') ? '院落式' : '近代式'}；陈设${meaning.includes('书') ? '案牍' : '简朴'}；光线${meaning.includes('夜') || meaning.includes('阴') ? '暗调' : '自然光'}`
      : `Structure: ${meaning.includes('祠') || meaning.includes('庙') ? 'shrine-style' : meaning.includes('府') || meaning.includes('宅') ? 'courtyard' : 'modern'}; props: ${meaning.includes('书') ? 'desks' : 'sparse'}; lighting: ${meaning.includes('夜') || meaning.includes('阴') ? 'low-key' : 'natural'}`;
    filled.filledFields!.push('visualAnchor');
  }
  if (h.missing.includes('mood')) {
    const mood = meaning.includes('仇') || meaning.includes('血') || meaning.includes('杀') ? '压抑'
      : meaning.includes('暖') || meaning.includes('合') || meaning.includes('圆') ? '温馨'
      : meaning.includes('权') || meaning.includes('谋') ? '阴沉'
      : '中性';
    filled.mood = zh ? mood : ({ '压抑': 'oppressive', '温馨': 'warm', '阴沉': 'gloomy', '中性': 'neutral' } as const)[mood as '压抑' | '温馨' | '阴沉' | '中性'];
    filled.filledFields!.push('mood');
  }
  if (h.missing.includes('tags')) {
    const keywords = (meaning.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []).slice(0, 3);
    filled.tags = keywords.length ? keywords : (zh ? ['场景'] : ['scene']);
    filled.filledFields!.push('tags');
  }
  if (h.missing.includes('eps')) {
    skipped.push({ field: 'eps', reason: zh ? '出现集必须从成稿场头沉淀或手动补录，规则补全会伪造置景密度——跳过。' : 'Episodes must be harvested from scene headers or added manually; rule-based fill would forge scene-setup density — skipped.' });
  }
  return { filled, skipped };
}
