/**
 * 道具资产体检引擎（v2.159 L3"资产化运营"能力沉淀，对标 v2.152 角色资产体检）
 * ------------------------------------------------------------------
 * 痛点：道具资产入库后，编导不知道哪些信物档"能用"、哪些是空壳（只有名字没含义），
 * 也不知道两个信物档在跨剧复用时会拿错连续性状态（一档已销毁、一档在用）。
 * 职责（与 asset-health/prop-asset 同构：纯函数零 IO 可离线对拍，零 token）：
 *  1. scorePropAsset：五维完整度评分（剧情含义 40 / 出现集 15 / 外观锚点 20 /
 *     连续性禁忌 15 / 标签 10）+ 缺项清单 + 可执行建议——驱动"先补什么"。
 *  2. detectPropAssetConflicts：跨资产冲突预警——同名不同含义（upsert 误覆盖风险）、
 *     异名同含义（重复档，合并）、同名封禁态冲突（复用会拿错连续性状态）。
 *
 * 评分哲学（编导视角）：剧情含义是道具资产的本体（缺了就是道具间杂货清单）；
 * 出现集/封禁态是"连续性规则"的抓手；外观锚点服务于 AIGC 换剧画同一件。
 */
import type { PropAssetSeed } from './prop-asset';

/** 资产行兼容形态：prisma 行（eps/closedEps 为 Json）与种子双命名 */
export type PropAssetLike = PropAssetSeed & {
  id?: string;
  /** 出现集号（沉淀产物或手动补录） */
  eps?: number[] | null;
  /** 封禁集号（伴随销毁/丢失动作的集） */
  closedEps?: number[] | null;
  usedCount?: number;
  /** 题材/功能标签（跨剧检索用） */
  tags?: (string | null)[] | null;
};

export interface PropHealth {
  score: number; // 0-100
  level: 'rich' | 'usable' | 'thin';
  missing: string[]; // 缺失维度（恒为英文维度名，便于前端对色）
  advice: string[]; // 可执行建议（按价值降序，最多 3 条）
}

const DIM = { meaning: 40, eps: 15, visualAnchor: 20, taboo: 15, tags: 10 } as const;

const EPS_RE = /^\d{1,4}$/;

/** eps/closedEps Json 容错归一：非数组/非法项丢弃，取合法整数升序去重 */
export function normalizeEps(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<number>();
  for (const v of raw) {
    const n = Math.round(Number(v));
    if (EPS_RE.test(String(v)) && Number.isFinite(n) && n >= 1 && n <= 9999) out.add(n);
  }
  return [...out].sort((a, b) => a - b).slice(0, 500);
}

/**
 * 单道具五维完整度体检
 * @param lang 建议文案语言（missing 键恒为英文维度名，便于前端对色）
 */
export function scorePropAsset(a: PropAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): PropHealth {
  const zh = lang !== 'en';
  if (!a || !a.name || !a.meaning) {
    return {
      score: 0, level: 'thin',
      missing: ['name', 'meaning'],
      advice: [zh ? '信物档缺少名字或剧情含义，无法约束创作——先补含义（这信物驱动什么剧情？）。' : 'Prop asset lacks a name or plot meaning; fill in what story beat this prop drives before it can constrain generation.'],
    };
  }
  const missing: string[] = [];
  const advice: string[] = [];
  let score = DIM.meaning; // 有含义即得满分 40
  if ((a.meaning ?? '').trim().length < 8) {
    score -= 15;
    advice.push(zh ? '剧情含义过短（<8 字）：写清这信物驱动什么剧情（认亲凭证/复仇证据/悬念载体），架构师才知道往哪埋。' : 'Plot meaning too short (<8 chars): state what story beat the prop drives (proof of kinship / evidence / suspense carrier).');
  }
  const eps = normalizeEps(a.eps);
  if (!eps.length) { missing.push('eps'); advice.push(zh ? '无出现集记录：从成稿沉淀或手动补录出现集，跨集连续性规则才有落点。' : 'No episode record: harvest from scripts or add episodes manually so continuity rules have anchors.'); }
  else score += DIM.eps;
  const closedEps = normalizeEps(a.closedEps);
  if (!a.taboo?.trim()) {
    if (closedEps.length) {
      // 已有封禁集但没写禁忌：给半分 8（Math.round(15/2)，状态在位但不可读），并提示补禁忌文案
      score += Math.round(DIM.taboo / 2);
      advice.push(zh ? `第 ${closedEps.join('、')} 集检测到销毁/丢失动作：补一句连续性禁忌（如"已烧毁，再现有须补找回交代"），撰写师才能读懂红线。` : `Destruction detected in ep ${closedEps.join(',')}: add a one-line continuity taboo so the writer can read the red line.`);
    } else {
      missing.push('taboo');
      advice.push(zh ? '无连续性禁忌：写清红线（如"已交出，未交代去向不得再现"），防换剧复用时穿帮。' : 'No continuity taboo: state the red line (e.g. handed over, must not reappear without explanation) to prevent continuity breaks on reuse.');
    }
  } else score += DIM.taboo;
  if (!a.visualAnchor?.trim()) { missing.push('visualAnchor'); advice.push(zh ? '缺外观锚点：补一句稳定外观（材质/颜色/形制），AIGC 换剧才画得出同一件。' : 'Missing visual anchor: add one stable look (material/color/shape) so AIGC renders the same prop across projects.'); }
  else score += DIM.visualAnchor;
  const tags = (a.tags ?? []).filter((s) => s && s.trim());
  if (!tags.length) { missing.push('tags'); advice.push(zh ? '无标签：补题材/功能标签（如 复仇·认亲），跨剧检索才搜得到。' : 'No tags: add genre/function tags (e.g. revenge, kinship) so the asset is findable across projects.'); }
  else score += DIM.tags;
  const level: PropHealth['level'] = score >= 85 ? 'rich' : score >= 55 ? 'usable' : 'thin';
  if (level === 'rich') advice.unshift(zh ? '资产完整度达标：可直接跨剧引用，引用后含义与禁忌不再随剧情漂移。' : 'Asset is complete: ready for cross-project reference; meaning and taboos stay fixed after referencing.');
  else if (level === 'thin') advice.unshift(zh ? '空壳信物档：当前只能"占位"，引用后架构师拿不到有效约束，建议先体检补全再引用。' : 'Shell prop asset: referencing it now gives the architect no effective constraints; complete it before referencing.');
  return { score: Math.max(0, Math.min(100, score)), level, missing, advice: advice.slice(0, 3) };
}

export interface PropConflict {
  type: 'dup_name' | 'same_meaning' | 'closed_mismatch';
  a: string; // 资产名 A（同 name 冲突时为名字本身）
  b: string; // 资产名 B（同 name 冲突时为空串）
  note: string; // 中英说明
}

const norm = (s: string) => String(s ?? '').replace(/\s+/g, '');
const closedState = (a: PropAssetLike): boolean => normalizeEps(a.closedEps).length > 0 || !!a.taboo?.trim();

/**
 * 跨资产冲突预警（库级体检）
 *  - dup_name：同名不同含义——upsert"一物一档"会被后写者覆盖，需先改名或合并
 *  - same_meaning：异名含义相同（去空白后完全一致）——重复档，合并成一个
 *  - closed_mismatch：同名且含义相同但封禁态不一致——一档已封禁一档在用，跨剧复用会拿错连续性状态
 */
export function detectPropAssetConflicts(assets: (PropAssetLike | null | undefined)[], lang: 'zh' | 'en' = 'zh'): PropConflict[] {
  const zh = lang !== 'en';
  const list = (assets ?? []).filter((a): a is PropAssetLike => !!a && !!a.name && !!a.meaning);
  const out: PropConflict[] = [];
  const byName = new Map<string, PropAssetLike[]>();
  for (const a of list) {
    const arr = byName.get(a.name) ?? [];
    arr.push(a);
    byName.set(a.name, arr);
  }
  for (const [name, arr] of byName) {
    const meanings = new Set(arr.map((a) => norm(a.meaning)));
    if (arr.length > 1 && meanings.size > 1) {
      out.push({ type: 'dup_name', a: name, b: '', note: zh ? `同名信物「${name}」存在 ${meanings.size} 套不同含义：同名 upsert 会互相覆盖，先改名或合并为一档。` : `Name "${name}" carries ${meanings.size} different plot meanings: same-name upsert overwrites silently — rename or merge first.` });
      continue; // 含义都不一致的同名档，无需再查封禁态冲突
    }
    if (arr.length > 1) {
      const closedSet = new Set(arr.map(closedState));
      if (closedSet.size > 1) {
        out.push({ type: 'closed_mismatch', a: name, b: '', note: zh ? `同名信物「${name}」封禁态不一致（一档已销毁/在用）：跨剧复用会拿错连续性状态，先对齐销毁/在用记录。` : `Name "${name}" has conflicting continuity states (destroyed vs active): reuse will pick the wrong state — align the records first.` });
      }
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.name === b.name) continue; // 同名冲突已在上面报告
      if (norm(a.meaning) === norm(b.meaning)) {
        out.push({ type: 'same_meaning', a: a.name, b: b.name, note: zh ? `「${a.name}」与「${b.name}」剧情含义完全相同：重复档，合并为一个信物资产。` : `"${a.name}" and "${b.name}" share an identical plot meaning: merge into one prop asset.` });
      }
    }
  }
  return out.slice(0, 20); // 预警上限：库级体检不是错误清单，避免面板刷屏
}

/**
 * v2.181 规则模板补全（道具家族）
 * ---------------------------------------------------
 * 与 autoFillCastAsset 同构：零 token 不调 AI 的占位级补全。
 *  - visualAnchor：基于 meaning 生成"材质/颜色/形制"占位
 *  - taboo：基于 meaning 类型（认亲凭证/复仇证据/悬念载体/其他）给通用禁忌占位
 *  - tags：从 meaning 抽 2-3 个中文关键词作标签
 *  - eps 不可规则补全（必须从成稿沉淀）→ skipped
 *  - meaning 必填，缺则整条 skipped（不替编导捏含义）
 */
export interface AutoFillPropResult {
  filled: Partial<Pick<PropAssetLike, 'visualAnchor' | 'taboo' | 'tags'>> & { filledFields: string[] };
  skipped: { field: string; reason: string }[];
}

export function autoFillPropAsset(a: PropAssetLike | null | undefined, lang: 'zh' | 'en' = 'zh'): AutoFillPropResult {
  const zh = lang !== 'en';
  const filled: AutoFillPropResult['filled'] = { filledFields: [] };
  const skipped: AutoFillPropResult['skipped'] = [];
  if (!a || !a.name || !a.meaning) {
    skipped.push({ field: 'meaning', reason: zh ? '缺名字或剧情含义，不替编导捏含义——先手写 meaning 再来补全。' : 'Missing name or plot meaning; auto-fill refuses to invent a meaning — write meaning by hand first.' });
    return { filled, skipped };
  }
  const meaning = a.meaning.trim();
  const h = scorePropAsset(a, lang);
  if (h.missing.includes('visualAnchor')) {
    filled.visualAnchor = zh
      ? `材质${meaning.includes('玉') ? '玉' : '铜'}；颜色${meaning.includes('血') ? '暗红' : '包浆'}；形制掌心大小`
      : `Material: ${meaning.includes('玉') ? 'jade' : 'bronze'}; color: ${meaning.includes('血') ? 'dark red' : 'patina'}; size: palm-sized`;
    filled.filledFields!.push('visualAnchor');
  }
  if (h.missing.includes('taboo')) {
    const kind = meaning.includes('认亲') ? '认亲凭证'
      : meaning.includes('复仇') || meaning.includes('证据') ? '复仇证据'
      : meaning.includes('悬念') || meaning.includes('线索') ? '悬念载体'
      : '信物';
    filled.taboo = zh
      ? `【${kind}】已交出后未交代去向不得再现；销毁场景须给特写并写入后续集禁用记录。`
      : `[${kind}] Once handed over, must not reappear without explaining its whereabouts; destruction scene needs close-up and must be recorded as forbidden in later episodes.`;
    filled.filledFields!.push('taboo');
  }
  if (h.missing.includes('tags')) {
    const keywords = (meaning.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []).slice(0, 3);
    filled.tags = keywords.length ? keywords : (zh ? ['信物'] : ['prop']);
    filled.filledFields!.push('tags');
  }
  if (h.missing.includes('eps')) {
    skipped.push({ field: 'eps', reason: zh ? '出现集必须从成稿沉淀或手动补录，规则补全会伪造连续性——跳过。' : 'Episodes must be harvested from scripts or added manually; rule-based fill would forge continuity — skipped.' });
  }
  return { filled, skipped };
}
