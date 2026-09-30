/**
 * 供应商余额自动探测（v2.612）：
 * · probeDeepseekBalance：GET https://api.deepseek.com/user/balance
 * · probeMoonshotBalance：GET https://api.moonshot.cn/v1/users/me/balance
 *
 * 设计原则：
 * · 不抛异常——任何失败都 catch 返回 { balanceYuan: null; error: string }，避免影响后台整体可用性
 * · 超时 8s（AbortController）
 * · 任何异常都返回 raw 字段便于排障
 */

export interface ProbeResult {
  balanceYuan: number | null;
  raw: unknown;
  error?: string;
}

const TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers || {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DeepSeek 余额：返回 { is_available, balance_infos: [{ currency, total_balance }] }，
 * 取 currency==='CNY' 的 total_balance（字符串，单位元）。
 */
export async function probeDeepseekBalance(apiKey: string): Promise<ProbeResult> {
  if (!apiKey) return { balanceYuan: null, raw: null, error: 'NO_API_KEY' };
  try {
    const res = await fetchWithTimeout('https://api.deepseek.com/user/balance', apiKey);
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep body null */ }
    if (!res.ok) {
      return { balanceYuan: null, raw: body ?? text, error: `HTTP_${res.status}` };
    }
    const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
    const cny = infos.find((x: any) => x?.currency === 'CNY') || infos[0];
    const v = cny?.total_balance;
    const num = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
    if (!Number.isFinite(num)) {
      return { balanceYuan: null, raw: body, error: 'BALANCE_PARSE_FAILED' };
    }
    return { balanceYuan: num, raw: body };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? `TIMEOUT_${TIMEOUT_MS}ms` : (e?.message || String(e));
    return { balanceYuan: null, raw: null, error: msg };
  }
}

/**
 * Moonshot 余额：返回 { data: { available_balance: number } }，单位元。
 */
export async function probeMoonshotBalance(apiKey: string): Promise<ProbeResult> {
  if (!apiKey) return { balanceYuan: null, raw: null, error: 'NO_API_KEY' };
  try {
    const res = await fetchWithTimeout('https://api.moonshot.cn/v1/users/me/balance', apiKey);
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep body null */ }
    if (!res.ok) {
      return { balanceYuan: null, raw: body ?? text, error: `HTTP_${res.status}` };
    }
    const v = body?.data?.available_balance;
    const num = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
    if (!Number.isFinite(num)) {
      return { balanceYuan: null, raw: body, error: 'BALANCE_PARSE_FAILED' };
    }
    return { balanceYuan: num, raw: body };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? `TIMEOUT_${TIMEOUT_MS}ms` : (e?.message || String(e));
    return { balanceYuan: null, raw: null, error: msg };
  }
}
