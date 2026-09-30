/**
 * 模型黑盒代理网关（生产实现）
 *  - 前端只传“引擎档位 + 任务”，永不知道供应商/模型名/密钥
 *  - 走 OpenAI 兼容协议，可对接火山方舟 / OpenAI / 任意国产兼容端点
 *  - 每次按 usage 核算真实成本；售价 < 成本×2 直接熔断
 *  - 超时/重试/降级；失败由上层解冻积分，绝不让用户为失败买单
 *  - 故障转移链（v2.82）：岗位路由指定 → 引擎档位 → 供应商池替补（Top3 封顶），文本与图片同一套语义；
 *    瞬态错误（超时/429/5xx）同模型指数退避重试后换模型，401/403 换模型并计降级，
 *    400 等请求级错误不重试不换模型（图片含内容审核拒绝）；连续 3 次失败的端点熔断 10 分钟（内存态，单实例）
 */
import { EngineTier } from '../config/pricing';
import { resolveText, resolveImage, loadProviders, loadRouting } from './model-config';
import { ProviderEntry, RoleId, routeProvider } from './model-config-policy';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

export type Role =
  | 'architect' | 'designer' | 'writer' | 'audience' | 'polisher'
  | 'compliance' | 'market' | 'consistency' | 'deai';

interface Route { model: string; baseUrl: string; key: string; inYuanPerMTok: number; outYuanPerMTok: number }

function env(name: string, fallback = ''): string { return process.env[name] || fallback; }

/** 真实路由表仅服务端可见。model/baseUrl/单价在后台或环境变量配置，不下发前端 */
function textRoute(tier: EngineTier): Route {
  const g = env('MODEL_GATEWAY_BASE_URL', 'https://api.openai.com/v1');
  switch (tier) {
    case EngineTier.ECONOMY:
      return { model: env('MODEL_ECONOMY', 'eco-model'), baseUrl: g, key: env('MODEL_TEXT_ECONOMY_KEY'), inYuanPerMTok: 0.8, outYuanPerMTok: 2 };
    case EngineTier.FLAGSHIP:
      return { model: env('MODEL_FLAGSHIP', 'flagship-model'), baseUrl: g, key: env('MODEL_TEXT_FLAGSHIP_KEY'), inYuanPerMTok: 30, outYuanPerMTok: 90 };
    case EngineTier.OVERSEAS:
      // v2.54 海外档：env 兜底 OpenAI，实际由管理后台 MODEL_OVERSEAS / MODEL_TEXT_OVERSEAS_KEY 配置
      // EP_PRICE 未列 OVERSEAS → 任何用户尝试购买会被 assertMargin 拒绝（自然守卫，无需额外代码）
      return { model: env('MODEL_OVERSEAS', 'overseas-model'), baseUrl: g, key: env('MODEL_TEXT_OVERSEAS_KEY'), inYuanPerMTok: 30, outYuanPerMTok: 90 };
    case EngineTier.STANDARD:
    default:
      return { model: env('MODEL_STANDARD', 'standard-model'), baseUrl: g, key: env('MODEL_TEXT_STANDARD_KEY'), inYuanPerMTok: 5, outYuanPerMTok: 15 };
  }
}

/** v2.41 九岗路由的角色名映射（代理岗名 → 策略岗名）
 *  v2.191 注：market_pre 是 buildCreationContext 上下文注入不调 LLM，market_post 是唯一的 market LLM 调用，
 *  因此 'market' 单路由服务于 market_post，无需拆分 market_pre/market_post 两个 RoleId */
const ROLE_TO_ROUTE: Record<Role, RoleId> = {
  architect: 'architect', designer: 'character', writer: 'writer', audience: 'audience',
  polisher: 'polish', compliance: 'compliance', market: 'market', consistency: 'consistency', deai: 'deai',
};

/* ---------------- v2.82 轻量健康降级（内存态，单实例够用；不引入 DB/定时任务） ---------------- */
const HEALTH_FAILS = 3;                 // 连续失败 3 次
const HEALTH_COOLDOWN_MS = 10 * 60_000; // 熔断 10 分钟，期间候选链直接跳过该端点
const __health = new Map<string, { fails: number; until: number }>();
/** 测试钩子：清空健康状态 */
export function __resetModelHealth() { __health.clear(); }
function hKey(baseUrl: string, model: string): string { return `${baseUrl.replace(/\/+$/, '')}::${model}`; }
function isDegraded(k: string): boolean { const h = __health.get(k); return !!h && h.until > Date.now(); }
function markFailure(k: string): void {
  const h = __health.get(k) || { fails: 0, until: 0 };
  h.fails += 1;
  if (h.fails >= HEALTH_FAILS) { h.until = Date.now() + HEALTH_COOLDOWN_MS; h.fails = 0; }
  __health.set(k, h);
}
function markSuccess(k: string): void { __health.delete(k); }

/* ---------------- 测试钩子：注入供应商池/岗位路由（默认读 DB 配置） ---------------- */
type ProviderSource = () => Promise<{ providers: ProviderEntry[]; routing: Partial<Record<RoleId, string>> }>;
let __providerSource: ProviderSource | null = null;
export function __setProviderSource(src: ProviderSource | null) { __providerSource = src; }

export interface CallResult { text: string; tokensIn: number; tokensOut: number; costFen: number; sandbox?: boolean; /** 首选端点失败、由替补端点完成（可观测用，不下发前端） */ fellback?: boolean }
/** 从模型输出中安全提取 JSON（兼容 ```json 包裹 / 前后多余文字） */
export function extractJson<T = any>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const open = body[start]; const close = open === '[' ? ']' : '}';
  const end = body.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)) as T; } catch { return null; }
}

function yuanToFen(y: number): number { return Math.max(1, Math.ceil(y * 100)); }

/** 毛利熔断 */
export function assertMargin(priceFen: number, costFen: number) {
  if (priceFen < costFen * 2) throw new Error(`MARGIN_BREACH 售价${priceFen}分<成本${costFen}分×2`);
}

// 可注入 HTTP 传输（测试钩子）；生产按端点协议走 node:http(s)（veFaaS 环境内置 fetch 不稳定）
export interface MinimalResp { ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }
type HttpTransport = (url: string, init: { method: string; headers: Record<string, string | number>; body: string; timeoutMs: number; signal?: AbortSignal }) => Promise<MinimalResp>;
// eslint-disable-next-line @typescript-eslint/naming-convention
let __injectedTransport: HttpTransport | null = null;
export function __setHttpTransport(t: HttpTransport | null) { __injectedTransport = t; }

function httpPost(url: string, init: { method: string; headers: Record<string, string | number>; body: string; timeoutMs: number; signal?: AbortSignal }): Promise<MinimalResp> {
  return new Promise<MinimalResp>((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return reject(new Error('MODEL_FATAL_UNSUPPORTED_PROTOCOL'));
    const transport = u.protocol === 'http:' ? http : https;
    const req = transport.request(u, {
      method: init.method,
      headers: init.headers,
      timeout: init.timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('MODEL_TIMEOUT')));
    init.signal?.addEventListener('abort', () => req.destroy(new Error('MODEL_ABORTED')), { once: true });
    req.write(init.body);
    req.end();
  });
}

/** 文本候选端点：档位配置、九岗路由指定或供应商池替补，单价随实际端点核算 */
interface Candidate { baseUrl: string; model: string; key: string; inY: number; outY: number }

const TRANSIENT_HTTP = new Set([429, 408]); // 429 限流 / 408 请求超时：瞬态可重试；5xx 一并按瞬态处理
function isTransientStatus(status: number): boolean { return TRANSIENT_HTTP.has(status) || (status >= 500 && status <= 599); }

/** 单候选端点调用：瞬态错误同模型退避重试（3 次），请求级错误（400/401/403 等）立即上抛不重试 */
async function tryCandidate(
  c: Candidate, prompt: string, maxTokens: number, timeoutMs: number, signal?: AbortSignal,
): Promise<CallResult> {
  let lastErr: Error | null = null;
  for (let i = 0; i < 3; i++) {
    let failure: Error;
    // 每次重试都要新建 AbortController/超时计时器，否则首试 abort 后信号已失效，后续重试无法超时
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const url = `${c.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const body = JSON.stringify({
        model: c.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: maxTokens,
        reasoning_effort: 'minimal',
      });
      const transport = __injectedTransport ?? httpPost;
      const resp = await transport(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}`, 'Content-Length': Buffer.byteLength(body) },
        body, timeoutMs, signal: controller.signal,
      });
      if (!resp.ok) {
        const detail = (await resp.text()).slice(0, 200);
        failure = isTransientStatus(resp.status)
          ? new Error(`MODEL_TRANSIENT_HTTP_${resp.status}:${detail}`)
          : new Error(`MODEL_FATAL_HTTP_${resp.status}:${detail}`);
      } else {
        const data = await resp.json() as {
          choices: { message: { content: string } }[];
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const tokensIn = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 2);
        // usage 缺失时输出 token 按 maxTokens 的 70% 保守估算，宁可成本高估也不能漏算导致毛利熔断失效
        const tokensOut = data.usage?.completion_tokens ?? Math.ceil(maxTokens * 0.7);
        const costYuan = (tokensIn / 1e6) * c.inY + (tokensOut / 1e6) * c.outY;
        return { text: data.choices?.[0]?.message?.content ?? '', tokensIn, tokensOut, costFen: yuanToFen(costYuan) };
      }
    } catch (e) {
      // 超时/中断/网络错误/坏 JSON：一律按瞬态处理（供应商异常页也常以网络异常形态出现）
      failure = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timer);
    }
    if (/MODEL_FATAL_/.test(failure.message)) throw failure;
    if (signal?.aborted) throw new Error('CANCELLED');  // v2.542 用户取消：立即停止重试，不退避
    lastErr = failure;
    await new Promise((r) => setTimeout(r, 300 * (i + 1))); // 指数退避
  }
  throw lastErr ?? new Error('MODEL_UNKNOWN');
}

/** 调文本模型（黑盒），返回正文与真实成本。
 *  候选链：九岗路由指定 → 引擎档位配置 → 供应商池替补（Top3 封顶，全部降级时仍照常尝试）。
 *  主候选瞬态耗尽/鉴权失败自动换下一候选；400 等请求级错误不换模型直接上抛。 */
export async function callText(
  tier: EngineTier, role: Role, prompt: string,
  opts: { maxTokens?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<CallResult> {
  const r = textRoute(tier); // 仅用于内置单价做成本核算兜底
  const src = __providerSource ?? (async () => ({ providers: await loadProviders(), routing: await loadRouting() }));
  const { providers, routing } = await src();
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const push = (c: Candidate): boolean => {
    const k = hKey(c.baseUrl, c.model);
    if (seen.has(k)) return false;
    seen.add(k); candidates.push(c); return true;
  };
  // 1) v2.41 九岗路由：管理员把岗位指定到池内供应商则优先（与 routedCostFenPerEp 计费口径一致）
  const routed = routeProvider(providers, routing, ROLE_TO_ROUTE[role]);
  if (routed?.apiKey && routed.baseUrl) {
    push({ baseUrl: routed.baseUrl, model: routed.model, key: routed.apiKey, inY: routed.inYuanPerMTok || r.inYuanPerMTok, outY: routed.outYuanPerMTok || r.outYuanPerMTok });
  }
  // 2) 引擎档位配置（后台优先、env 兜底）
  const cfg = await resolveText(tier);
  if (cfg?.apiKey) {
    push({ baseUrl: cfg.baseUrl || r.baseUrl, model: cfg.model || r.model, key: cfg.apiKey, inY: r.inYuanPerMTok, outY: r.outYuanPerMTok });
  }
  // 3) 供应商池替补：Top3 封顶（首选+2），控制最坏时延；单价缺省按档位价保守核算
  for (const p of providers) {
    if (candidates.length >= 3) break;
    if (p.modality !== 'text' || !p.enabled || !p.apiKey || !p.baseUrl) continue;
    push({ baseUrl: p.baseUrl, model: p.model, key: p.apiKey, inY: p.inYuanPerMTok || r.inYuanPerMTok, outY: p.outYuanPerMTok || r.outYuanPerMTok });
  }
  // 未配置任何可用端点：进入沙盘模式（开发/演示/自动化测试可完整跑通协作链路）；
  // 生产可设 REQUIRE_REAL_MODEL=true 强制必须真实模型，杜绝“假装在创作”。
  const live = candidates.filter((c) => !isDegraded(hKey(c.baseUrl, c.model)));
  const chain = live.length ? live : candidates; // 全部熔断时可用性优先照常尝试
  if (!chain.length) {
    if (env('REQUIRE_REAL_MODEL') === 'true') throw new Error(`MODEL_NOT_CONFIGURED:${tier}`);
    return { text: '', tokensIn: 0, tokensOut: 0, costFen: 0, sandbox: true };
  }
  const maxTokens = opts.maxTokens ?? 4096;
  const timeoutMs = opts.timeoutMs ?? 120000;
  let lastErr: unknown;
  for (let idx = 0; idx < chain.length; idx++) {
    const c = chain[idx];
    const k = hKey(c.baseUrl, c.model);
    try {
      const out = await tryCandidate(c, prompt, maxTokens, timeoutMs, opts.signal);
      markSuccess(k);
      if (idx > 0) {
        out.fellback = true;
        console.warn(`[model-failover] text role=${role} 首选端点失败，已由替补完成 -> ${c.baseUrl} :: ${c.model}`);
      }
      return out;
    } catch (e) {
      lastErr = e;
      if (opts.signal?.aborted) throw new Error('CANCELLED');  // v2.542 用户取消：不换候选立即上抛，不误降级健康分
      const msg = e instanceof Error ? e.message : String(e);
      const fatal = msg.match(/MODEL_FATAL_HTTP_(\d{3})/);
      if (fatal && fatal[1] !== '401' && fatal[1] !== '403') throw e; // 请求/提示词级错误换模型也无意义，直接上抛
      markFailure(k); // 瞬态耗尽或 401/403：计入健康降级，累计 3 次熔断 10 分钟
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface ImageResult { images: string[]; costFen: number; /** 首选端点失败、由替补端点完成（可观测用，不下发前端） */ fellback?: boolean }

interface ImageCandidate { baseUrl: string; model: string; key: string; perImageFen: number }

/** 单图片候选端点：瞬态错误（429/5xx/超时/网络/坏结构）最多重试 1 次；
 *  图片调用耗时且成功即计费，重试次数比文本保守；400（含内容审核拒绝）/401/403 立即上抛不白烧钱 */
async function tryImageCandidate(
  c: ImageCandidate, prompt: string, n: number, size: string, timeoutMs: number, signal?: AbortSignal,
): Promise<string[]> {
  let lastErr: Error | null = null;
  for (let i = 0; i < 2; i++) {
    let failure: Error;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const url = `${c.baseUrl.replace(/\/$/, '')}/images/generations`;
      const body = JSON.stringify({ model: c.model, prompt, n, size });
      const transport = __injectedTransport ?? httpPost;
      const resp = await transport(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}`, 'Content-Length': Buffer.byteLength(body) },
        body, timeoutMs, signal: controller.signal,
      });
      if (!resp.ok) {
        const detail = (await resp.text()).slice(0, 200);
        failure = isTransientStatus(resp.status)
          ? new Error(`IMAGE_TRANSIENT_HTTP_${resp.status}:${detail}`)
          : new Error(`IMAGE_FATAL_HTTP_${resp.status}:${detail}`);
      } else {
        const data = await resp.json() as { data?: { url?: string; b64_json?: string }[] };
        // 供应商异常/被网关劫持时可能返回 {error:...} 等非标准结构，必须显式拒绝而不是崩在 .map 上；
        // 这类劫持页多为瞬态，按瞬态处理允许重试/转移一次
        if (!Array.isArray(data?.data)) failure = new Error('IMAGE_BAD_RESPONSE: 图片供应商返回结构异常');
        else {
          const images = data.data.map((d) => d.url || (d.b64_json ? `data:image/png;base64,${d.b64_json}` : '')).filter(Boolean);
          if (images.length === 0) failure = new Error('IMAGE_BAD_RESPONSE: 图片供应商返回空数组');
          else return images;
        }
      }
    } catch (e) {
      // 超时/中断/网络错误/坏 JSON：瞬态（成功响应后 JSON 解析失败理论上不会扣费重试，但概率极低，可接受一次重试）
      failure = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timer);
    }
    if (/IMAGE_FATAL_/.test(failure.message)) throw failure;
    if (signal?.aborted) throw new Error('CANCELLED');  // v2.542 用户取消：立即停止重试
    lastErr = failure;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw lastErr ?? new Error('IMAGE_UNKNOWN');
}

/** 调图片模型（OpenAI images 兼容，GPT-image 走同一协议），n 张选 1。
 *  候选链（v2.82 对齐文本语义）：引擎档位图片端点 → 供应商池 image 端点（Top3 封顶）；
 *  瞬态耗尽/401/403 自动换下一候选，400 内容审核类错误直接上抛；熔断端点跳过；失败由上层退款。 */
export async function callImage(
  tier: EngineTier, prompt: string, n = 4, size: '1024x1024' | '1024x1536' = '1024x1536',
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ImageResult> {
  const isFlagship = tier === EngineTier.FLAGSHIP;
  // 旗舰约1.4元/张、国产约0.1元/张；真实以账单为准，这里给安全下限并由 assertMargin 兜底
  const perImageFen = isFlagship ? 140 : 10;
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();
  const push = (baseUrl: string, model: string, key: string): boolean => {
    const k = hKey(baseUrl, model);
    if (seen.has(k)) return false;
    seen.add(k); candidates.push({ baseUrl, model, key, perImageFen }); return true;
  };
  // 1) 引擎档位图片配置（后台优先、env 兜底；旗舰位即 GPT-image）
  const cfg = await resolveImage(isFlagship);
  if (cfg?.apiKey) {
    push(cfg.baseUrl || 'https://api.openai.com/v1', cfg.model || (isFlagship ? 'gpt-image-1' : 'image-standard'), cfg.apiKey);
  }
  // 2) 供应商池 image 端点替补：Top3 封顶（含首选共 3 个），单价仍按档位下限保守核算（池内国产更便宜，成本只高估不低估）
  const src = __providerSource ?? (async () => ({ providers: await loadProviders(), routing: await loadRouting() }));
  const { providers } = await src();
  for (const p of providers) {
    if (candidates.length >= 3) break;
    if (p.modality !== 'image' || !p.enabled || !p.apiKey || !p.baseUrl) continue;
    push(p.baseUrl, p.model, p.apiKey);
  }
  // 全部熔断时可用性优先照常尝试；一个可用端点都没有才报未配置（业务侧自动退款）
  const live = candidates.filter((c) => !isDegraded(hKey(c.baseUrl, c.model)));
  const chain = live.length ? live : candidates;
  if (!chain.length) throw new Error(`IMAGE_NOT_CONFIGURED:${tier}`);
  const timeoutMs = opts.timeoutMs ?? 180000;
  let lastErr: unknown;
  for (let idx = 0; idx < chain.length; idx++) {
    const c = chain[idx];
    const k = hKey(c.baseUrl, c.model);
    try {
      const images = await tryImageCandidate(c, prompt, n, size, timeoutMs, opts.signal);
      markSuccess(k);
      if (idx > 0) {
        console.warn(`[model-failover] image tier=${tier} 首选端点失败，已由替补完成 -> ${c.baseUrl} :: ${c.model}`);
        return { images, costFen: c.perImageFen * n, fellback: true };
      }
      return { images, costFen: c.perImageFen * n };
    } catch (e) {
      lastErr = e;
      if (opts.signal?.aborted) throw new Error('CANCELLED');  // v2.542 用户取消：不换候选立即上抛
      const msg = e instanceof Error ? e.message : String(e);
      const fatal = msg.match(/IMAGE_FATAL_HTTP_(\d{3})/);
      if (fatal && fatal[1] !== '401' && fatal[1] !== '403') throw e; // 400/内容审核等换端点无意义，直接上抛
      markFailure(k); // 瞬态耗尽或 401/403：计入健康降级，累计 3 次熔断 10 分钟
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** 稳定后缀：拼到每个图/视频镜头提示词末尾，提升人物一致性 */
export const STABILITY_SUFFIX =
  '人物五官全程稳定不变，发型服饰不突变，光影统一，色调一致，无闪烁、无跳帧、无肢体畸形、无多余手指';
