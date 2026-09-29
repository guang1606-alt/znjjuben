/**
 * 合规规则库存储层（PRD 9.2.6 安全策略·敏感词库 的后台可运营化）
 *
 * 与 model-config 同一套「单行 global + 短时缓存 + prisma 可注入」模式：
 *  - 默认规则固化在 content-safety.ts（代码评审、随版本走、可回滚）；
 *  - 运营在后台新增/停用的规则以单行 JSON 落库（safetyConfig.id='global'），不加密（规则非密钥）；
 *  - 业务路由统一走 scanWithStore，保证后台改词全局即时生效，且无库/无表时回退默认规则、绝不炸。
 */
import { prisma as defaultPrisma } from './prisma';
import {
  ALL_RULES, EMPTY_OVERRIDES, mergeRules, scanContent, scanMany,
  type SafetyOverrides, type SafetyRule, type ScanResult,
} from './content-safety';

interface CacheEntry { data: SafetyOverrides; rules: SafetyRule[]; exp: number }
let cache: CacheEntry | null = null;
const TTL_MS = 60_000;

function normalize(raw: unknown): SafetyOverrides {
  if (!raw || typeof raw !== 'object') return EMPTY_OVERRIDES;
  const o = raw as Partial<SafetyOverrides>;
  return {
    custom: Array.isArray(o.custom) ? o.custom : [],
    disabled: Array.isArray(o.disabled) ? o.disabled.map(String) : [],
  };
}

/** 读取运营覆写（无库回退空覆写） */
export async function loadOverrides(p: any = defaultPrisma): Promise<SafetyOverrides> {
  if (cache && cache.exp > Date.now()) return cache.data;
  let data = EMPTY_OVERRIDES;
  try {
    const row = await p.safetyConfig.findUnique({ where: { id: 'global' } });
    if (row?.payload) data = normalize(JSON.parse(row.payload));
  } catch {
    /* 表/库缺失时回退默认规则 */
  }
  const rules = mergeRules(data, ALL_RULES);
  cache = { data, rules, exp: Date.now() + TTL_MS };
  return data;
}

/** 当前生效规则集（默认 + 覆写合并，带缓存） */
export async function effectiveRules(p: any = defaultPrisma): Promise<SafetyRule[]> {
  if (cache && cache.exp > Date.now()) return cache.rules;
  const data = await loadOverrides(p);
  return mergeRules(data, ALL_RULES);
}

/** 持久化覆写（后台保存后清缓存，全局即时生效） */
export async function saveOverrides(ov: SafetyOverrides, _by: string, p: any = defaultPrisma): Promise<void> {
  const clean = normalize(ov);
  await p.safetyConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', payload: JSON.stringify(clean), updatedBy: _by },
    update: { payload: JSON.stringify(clean), updatedBy: _by },
  });
  cache = null;
}

export function invalidateSafetyCache(): void { cache = null; }

/** 业务路由统一入口：用「默认+后台覆写」的生效规则扫描单段文本 */
export async function scanWithStore(text: string, p: any = defaultPrisma): Promise<ScanResult> {
  const rules = await effectiveRules(p);
  return scanContent(text, rules);
}

/** 互动分支/多段文本统一入口 */
export async function scanManyWithStore(texts: Array<string | undefined | null>, p: any = defaultPrisma): Promise<ScanResult> {
  const rules = await effectiveRules(p);
  return scanMany(texts, rules);
}

export interface RuleView {
  id: string; category: string; label: string; severity: 'BLOCK' | 'WARN';
  patterns: string[]; advice: string; statute?: string;
  builtin: boolean; active: boolean;
}
/** 后台规则库列表视图：默认规则标注 builtin，停用规则仍展示但 active=false */
export async function listRuleViews(p: any = defaultPrisma): Promise<RuleView[]> {
  const ov = await loadOverrides(p);
  const disabled = new Set(ov.disabled);
  const builtin = ALL_RULES.map((r) => ({
    id: r.id, category: r.category, label: r.label, severity: r.severity,
    patterns: r.patterns, advice: r.advice, statute: r.statute,
    builtin: true, active: !disabled.has(r.id),
  }));
  const customs = ov.custom.map((r) => ({
    id: r.id, category: r.category, label: r.label, severity: r.severity,
    patterns: r.patterns, advice: r.advice, statute: r.statute,
    builtin: false, active: !disabled.has(r.id),
  }));
  return [...builtin, ...customs];
}
