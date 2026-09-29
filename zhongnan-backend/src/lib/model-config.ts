/**
 * 模型配置：管理员后台填写（加密落库）+ 环境变量兜底。
 * C端用户永远拿不到明文 key，也看不到供应商/模型名（黑盒）。
 */
import { prisma } from './prisma';
import { encrypt, decrypt, maskKey } from './crypto';
import type { EngineTier } from '../config/pricing';
import {
  ProviderEntry, RoleId, upsertProvider, removeProvider, maskProviders, mergeMaskedKey,
} from './model-config-policy';

export interface ProviderCfg { baseUrl?: string; apiKey?: string; model?: string }
export interface ModelConfigData {
  text: Record<'economy' | 'standard' | 'flagship' | 'overseas', ProviderCfg>;
  image: { standard: ProviderCfg; flagship: ProviderCfg };
  providers?: ProviderEntry[];                                  // v2.41 多供应商池（加密落库）
  routing?: Partial<Record<RoleId, string>>;                    // v2.41 九岗→供应商路由
  updatedAt?: string;
}

const EMPTY: ModelConfigData = {
  text: { economy: {}, standard: {}, flagship: {}, overseas: {} },
  image: { standard: {}, flagship: { model: 'gpt-image-1' } },
  providers: [], routing: {},
};

let cache: { data: ModelConfigData; exp: number } | null = null;
const TTL_MS = 60_000;

function envText(tier: EngineTier): ProviderCfg {
  const t = tier.toUpperCase(); // 与 model-proxy 既有环境变量名保持一致
  return {
    baseUrl: process.env.MODEL_GATEWAY_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env[`MODEL_TEXT_${t}_KEY`],
    model: process.env[`MODEL_${t}`],
  };
}

/** 合并：后台配置优先，缺省回退环境变量；只返回真正可用的一套 */
export async function resolveText(tier: EngineTier, p: any = prisma): Promise<ProviderCfg | null> {
  const db = await loadConfig(p);
  const low = tier.toLowerCase() as 'economy' | 'standard' | 'flagship' | 'overseas';
  const cfg = { ...envText(tier), ...stripEmpty(db.text[low]) };
  return cfg.apiKey ? cfg : null;
}
export async function resolveImage(flagship: boolean, p: any = prisma): Promise<ProviderCfg | null> {
  const db = await loadConfig(p);
  const imgBase = process.env.MODEL_IMAGE_GATEWAY_BASE_URL || process.env.MODEL_GATEWAY_BASE_URL || 'https://api.openai.com/v1';
  const env: ProviderCfg = flagship
    ? { baseUrl: imgBase, apiKey: process.env.MODEL_IMAGE_FLAGSHIP_KEY, model: process.env.MODEL_IMAGE_FLAGSHIP || 'gpt-image-1' }
    : { baseUrl: imgBase, apiKey: process.env.MODEL_IMAGE_STANDARD_KEY, model: process.env.MODEL_IMAGE_STANDARD };
  const cfg = { ...env, ...stripEmpty(flagship ? db.image.flagship : db.image.standard) };
  return cfg.apiKey ? cfg : null;
}
function stripEmpty(c: ProviderCfg): ProviderCfg {
  const out: ProviderCfg = {};
  if (c.baseUrl) out.baseUrl = c.baseUrl;
  if (c.apiKey) out.apiKey = c.apiKey;
  if (c.model) out.model = c.model;
  return out;
}

export async function loadConfig(p: any = prisma): Promise<ModelConfigData> {
  if (cache && cache.exp > Date.now()) return cache.data;
  let data = EMPTY;
  try {
    const row = await p.modelConfig.findUnique({ where: { id: 'global' } });
    if (row) {
      const parsed = JSON.parse(decrypt(row.payloadEnc));
      data = {
        text: { ...EMPTY.text, ...(parsed.text || {}) },
        image: { ...EMPTY.image, ...(parsed.image || {}) },
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
        routing: parsed.routing && typeof parsed.routing === 'object' ? parsed.routing : {},
        updatedAt: row.updatedAt.toISOString(),
      };
    }
  } catch {
    /* 无表/无库时回退 env，保证开发与沙盘不炸 */
  }
  cache = { data, exp: Date.now() + TTL_MS };
  return data;
}

export async function saveConfig(data: Omit<ModelConfigData, 'updatedAt'>, updatedBy: string, p: any = prisma): Promise<void> {
  // 若某字段传的是脱敏占位（含••），说明用户没改，保留原值
  const old = await loadConfig(p);
  const merge = (n: ProviderCfg, o: ProviderCfg): ProviderCfg => ({
    baseUrl: n.baseUrl ?? o.baseUrl,
    model: n.model ?? o.model,
    // 未填(空串)或传回脱敏占位(含•)都视为“未修改”，保留原密钥，避免只改其他项时误清空 key
    apiKey: !n.apiKey || n.apiKey.includes('•') ? o.apiKey : n.apiKey,
  });
  const merged: ModelConfigData = {
    text: {
      economy: merge(data.text.economy, old.text.economy),
      standard: merge(data.text.standard, old.text.standard),
      flagship: merge(data.text.flagship, old.text.flagship),
      overseas: merge(data.text.overseas, old.text.overseas),
    },
    image: {
      standard: merge(data.image.standard, old.image.standard),
      flagship: merge(data.image.flagship, old.image.flagship),
    },
    // v2.41：五档密钥保存不动供应商池/路由，避免旧接口误清空
    providers: old.providers ?? [],
    routing: old.routing ?? {},
  };
  await p.modelConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', payloadEnc: encrypt(JSON.stringify(merged)), updatedBy },
    update: { payloadEnc: encrypt(JSON.stringify(merged)), updatedBy },
  });
  cache = null;
}

/** 后台回显：key 脱敏，绝不返回明文 */
export async function maskedConfig(p: any = prisma) {
  const d = await loadConfig(p);
  const m = (c: ProviderCfg) => ({ baseUrl: c.baseUrl || '', model: c.model || '', hasKey: !!c.apiKey, keyMask: maskKey(c.apiKey || '') });
  return {
    text: { economy: m(d.text.economy), standard: m(d.text.standard), flagship: m(d.text.flagship), overseas: m(d.text.overseas) },
    image: { standard: m(d.image.standard), flagship: m(d.image.flagship) },
    updatedAt: d.updatedAt || null,
  };
}

/* ================= v2.41 多供应商池 + 九岗路由（加密落库、回显脱敏） ================= */

/** 读取供应商池（服务端内部用，含明文 key，仅后端调用） */
export async function loadProviders(p: any = prisma): Promise<ProviderEntry[]> {
  const d = await loadConfig(p);
  return (d.providers ?? []).map((x) => ({ ...emptySafe(), ...x }));
}
function emptySafe(): ProviderEntry {
  return { id: '', name: '', modality: 'text', baseUrl: '', apiKey: '', model: '', inYuanPerMTok: 0, outYuanPerMTok: 0, enabled: true };
}
/** 读取岗位路由 */
export async function loadRouting(p: any = prisma): Promise<Partial<Record<RoleId, string>>> {
  const d = await loadConfig(p);
  return d.routing ?? {};
}
/** 后台回显：供应商脱敏 + 路由 */
export async function maskedProvidersConfig(p: any = prisma) {
  const [providers, routing, d] = await Promise.all([loadProviders(p), loadRouting(p), loadConfig(p)]);
  return { providers: maskProviders(providers), routing, updatedAt: d.updatedAt || null };
}

async function persistPool(providers: ProviderEntry[], routing: Partial<Record<RoleId, string>>, updatedBy: string, p: any) {
  const old = await loadConfig(p);
  const merged: ModelConfigData = {
    text: old.text, image: old.image, providers, routing,
  };
  await p.modelConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', payloadEnc: encrypt(JSON.stringify(merged)), updatedBy },
    update: { payloadEnc: encrypt(JSON.stringify(merged)), updatedBy },
  });
  cache = null;
}

/** 新增/更新单个供应商（catalogDefault 来自 model-catalog，目录型号可免填 baseUrl） */
export async function saveProvider(entry: ProviderEntry, catalogDefault: string | undefined, updatedBy: string, p: any = prisma): Promise<ProviderEntry> {
  const list = await loadProviders(p);
  const oldOne = list.find((x) => x.id === entry.id);
  const mergedEntry = mergeMaskedKey(entry, oldOne);
  const next = upsertProvider(list, mergedEntry, catalogDefault);
  await persistPool(next, await loadRouting(p), updatedBy, p);
  return next.find((x) => x.name === mergedEntry.name)!;
}
export async function deleteProvider(id: string, updatedBy: string, p: any = prisma): Promise<void> {
  const [list, routing] = await Promise.all([loadProviders(p), loadRouting(p)]);
  const next = removeProvider(list, id);
  const nextRouting: Partial<Record<RoleId, string>> = {};
  for (const [role, pid] of Object.entries(routing)) if (pid !== id) nextRouting[role as RoleId] = pid; // 删供应商自动解绑岗位
  await persistPool(next, nextRouting, updatedBy, p);
}
export async function saveRouting(routing: Partial<Record<RoleId, string>>, updatedBy: string, p: any = prisma): Promise<void> {
  const list = await loadProviders(p);
  const ids = new Set(list.map((x) => x.id));
  const clean: Partial<Record<RoleId, string>> = {};
  for (const [role, pid] of Object.entries(routing)) if (pid && ids.has(pid)) clean[role as RoleId] = pid; // 悬空路由直接丢弃
  await persistPool(list, clean, updatedBy, p);
}
