/**
 * 模型供应商池 + 七岗路由（纯函数、可离线对拍）
 * 管理员后台可粘贴任意多个 文本/图片/视频 供应商 API（含 GPT-image），再把每个创作岗位路由到指定供应商；
 * 未绑定则回退“引擎档位 → 环境变量”。Key 只在服务端加密落库，回显一律脱敏，C端不可见。
 */

export type Modality = 'text' | 'image' | 'video';
export interface ProviderEntry {
  id: string;
  name: string;                 // 管理员自识别，如“火山-旗舰文本”“OpenAI GPT-image”
  modality: Modality;
  baseUrl: string;
  apiKey: string;
  model: string;
  inYuanPerMTok: number;        // 文本输入单价（元/百万token）
  outYuanPerMTok: number;       // 文本输出单价
  catalogId?: string;           // v2.41 对应 model-catalog 型号 id（选中则 baseUrl/单价可自动带出）
  enabled: boolean;
}
export type RoleId =
  | 'architect' | 'character' | 'writer' | 'audience' | 'polish'
  | 'compliance' | 'market' | 'consistency' | 'deai';

/** 九大创作岗（含双校验门，门岗一般走本地规则不耗 token） */
export const ALL_ROLE_IDS: RoleId[] = ['market', 'architect', 'character', 'writer', 'audience', 'polish', 'compliance', 'consistency', 'deai'];
export const ROLE_LABEL_ZH: Record<RoleId, string> = {
  market: '市场分析师（前置定位+后置终评）', architect: '剧情架构师', character: '人设设计师',
  writer: '单集撰写师', audience: '观众代言官', polish: '细节润色师',
  compliance: '合规审核师', consistency: '一致性校验门', deai: '去AI化校验门',
};

export function emptyProvider(modality: Modality): ProviderEntry {
  return { id: '', name: '', modality, baseUrl: '', apiKey: '', model: '', inYuanPerMTok: 0, outYuanPerMTok: 0, enabled: true };
}

/**
 * v2.41：BaseUrl 是否必填的确定口径——
 *  · 选了目录内型号(catalogId)时【非必填】：自动套用该型号 defaultBaseUrl（OpenAI 兼容标准端点）；
 *  · 自建/中转/兼容代理时【必填】：必须给 http(s) 端点，否则不知道往哪发。
 * catalogId 为目录型号 id（见 config/model-catalog TEXT/IMAGE_MODELS），由后台下拉带入。
 */
export function resolveProviderBaseUrl(p: Partial<ProviderEntry>, catalogDefault?: string): string {
  const explicit = (p.baseUrl || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return (catalogDefault || '').replace(/\/+$/, '');
}

/** 单个供应商合法性校验：启用态必须有可用端点/密钥/模型，单价不得为负 */
export function validateProvider(p: Partial<ProviderEntry>, catalogDefault?: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!p.name || !p.name.trim()) problems.push('供应商名称必填');
  const base = resolveProviderBaseUrl(p, catalogDefault);
  if (!base || !/^https?:\/\/.+/i.test(base)) problems.push('BaseUrl 需为 http(s) 地址（选用目录型号可留空自动补默认端点，自建/中转必填）');
  if (p.modality === 'text' && !p.model) problems.push('文本模型需填写模型名');
  if (p.modality === 'image' && !p.model) problems.push('图片模型需填写模型名');
  if ((p.inYuanPerMTok ?? 0) < 0 || (p.outYuanPerMTok ?? 0) < 0) problems.push('单价不能为负');
  if (p.enabled && !p.apiKey) problems.push('启用前必须粘贴 API Key');
  return { ok: problems.length === 0, problems };
}

/**
 * 选 catalog 型号时自动回填单价/baseUrl/model（用户手填优先，单价为 0 才回填）。
 * 修复：之前 saveProvider 只回填 baseUrl，不回填单价，导致选目录型号后单价落库为 0，
 * 成本核算/×2铁底/健康降级全部失效。
 */
export function enrichProviderFromCatalog(
  entry: ProviderEntry, catalog?: { defaultBaseUrl?: string; name?: string; inYuanPerMTok?: number; outYuanPerMTok?: number },
): ProviderEntry {
  if (!catalog) return entry;
  return {
    ...entry,
    baseUrl: entry.baseUrl || catalog.defaultBaseUrl || '',
    model: entry.model || catalog.name || '',
    inYuanPerMTok: (entry.inYuanPerMTok ?? 0) > 0 ? entry.inYuanPerMTok : (catalog.inYuanPerMTok ?? 0),
    outYuanPerMTok: (entry.outYuanPerMTok ?? 0) > 0 ? entry.outYuanPerMTok : (catalog.outYuanPerMTok ?? 0),
  };
}

/** 新增或按 id 覆盖；不同 id 不允许重名（避免后台混淆） */
export function upsertProvider(list: ProviderEntry[], entry: ProviderEntry, catalogDefault?: string): ProviderEntry[] {
  if (!entry.id) entry.id = `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const nameClash = list.some((p) => p.id !== entry.id && p.name.trim() === entry.name.trim());
  if (nameClash) throw new Error('PROVIDER_NAME_DUP 供应商名称重复');
  const v = validateProvider(entry, catalogDefault);
  if (!v.ok) throw new Error('PROVIDER_INVALID ' + v.problems.join('；'));
  const idx = list.findIndex((p) => p.id === entry.id);
  const next = list.slice();
  if (idx >= 0) next[idx] = entry; else next.push(entry);
  return next;
}

export function removeProvider(list: ProviderEntry[], id: string): ProviderEntry[] {
  return list.filter((p) => p.id !== id);
}

/**
 * 岗位路由：优先用 roleRouting[role] 指定且启用、模态匹配的供应商；
 * 指定的被删/禁用/模态不符 → 返回 null，由上层回退引擎档位/env（保证不因配置错误中断创作）
 */
export function routeProvider(
  list: ProviderEntry[], routing: Partial<Record<RoleId, string>>, role: RoleId,
): ProviderEntry | null {
  const pid = routing[role];
  if (!pid) return null;
  const p = list.find((x) => x.id === pid);
  if (!p || !p.enabled) return null;
  if (p.modality !== 'text') return null; // 创作岗位只能路由文本模型
  return p;
}

/** 后台回显脱敏：绝不返回明文 Key */
export function maskProviders(list: ProviderEntry[]) {
  return list.map((p) => ({ ...p, apiKey: p.apiKey ? '••••••' + p.apiKey.slice(-4) : '' }));
}

/** 保存时：若 Key 是脱敏占位（含••），沿用旧值，避免被掩码覆盖 */
export function mergeMaskedKey(incoming: ProviderEntry, old: ProviderEntry | undefined): ProviderEntry {
  if (old && incoming.apiKey && incoming.apiKey.includes('•')) return { ...incoming, apiKey: old.apiKey };
  return incoming;
}

/** v2.41 岗位路由覆盖体检：每岗是否有可用文本供应商；未路由/指向失效不算错（回退档位env），只给状态 */
export interface RoutingStatus { role: RoleId; providerId: string | null; state: 'routed' | 'fallback' | 'invalid'; providerName: string | null }
export function routingCoverage(list: ProviderEntry[], routing: Partial<Record<RoleId, string>>): RoutingStatus[] {
  return ALL_ROLE_IDS.map((role) => {
    const pid = routing[role] || null;
    if (!pid) return { role, providerId: null, state: 'fallback', providerName: null };
    const p = list.find((x) => x.id === pid);
    if (!p || !p.enabled || p.modality !== 'text') return { role, providerId: pid, state: 'invalid', providerName: p?.name || null };
    return { role, providerId: pid, state: 'routed', providerName: p.name };
  });
}

/**
 * v2.41 按当前路由估算【每集九岗裸 token 成本（分）】。
 * tokensPerEp 由调用方传入（model-catalog.ROLE_TOKENS_PER_EP 的口径，门岗/市场未给则按 0 不重复计费）；
 * 未路由到自定义供应商的岗位不计（仍走档位组合，其成本在 model-catalog 已核算，避免双算）。
 */
export function routedCostFenPerEp(
  list: ProviderEntry[], routing: Partial<Record<RoleId, string>>,
  tokensPerEp: Partial<Record<RoleId, { in: number; out: number }>>,
): { costFen: number; byRole: Record<string, number> } {
  let yuan = 0; const byRole: Record<string, number> = {};
  for (const role of ALL_ROLE_IDS) {
    const p = routeProvider(list, routing, role); const tok = tokensPerEp[role];
    if (!p || !tok) { byRole[role] = 0; continue; }
    const c = (tok.in / 1e6) * p.inYuanPerMTok + (tok.out / 1e6) * p.outYuanPerMTok;
    byRole[role] = Math.round(c * 10000) / 10000; yuan += c;
  }
  return { costFen: Math.ceil(yuan * 100), byRole };
}
