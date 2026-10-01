/**
 * Refresh Token 轮换的一次性消费登记（jti → 过期时间）。
 * 与 login-throttle 同模式：进程内存态，单进程部署有效；重启清空后旧 token 短暂可复刷，
 * 但重放攻击窗口本就是秒级（轮换后旧 token 立即作废），内存态已覆盖真实威胁面。
 * 语义：同一 jti 只允许消费一次；二次出现即重放，返回 false。
 */
const consumed = new Map<string, number>(); // key -> exp (ms)
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;
const MAX_ENTRIES = 100_000; // 防御上限：正常流量远达不到，超限强制全量清扫

/** 消费一个 refresh token 标识：首次消费返回 true，重复消费（重放）返回 false */
export function consumeRefreshToken(key: string, expSeconds: number): boolean {
  const now = Date.now();
  sweep(now);
  if (consumed.has(key)) return false;
  consumed.set(key, Math.max(expSeconds, 0) * 1000);
  if (consumed.size > MAX_ENTRIES) sweepAll(now);
  return true;
}

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  sweepAll(now);
}
function sweepAll(now: number) {
  for (const [k, exp] of consumed) if (exp <= now) consumed.delete(k);
}

/** 测试辅助：清空登记（仅测试环境使用） */
export function resetRefreshRotate(): void {
  consumed.clear();
  lastSweep = Date.now();
}

/**
 * 续期在途单飞（v2.291）：同一 key 的并发续期共享首个 flight 的结果。
 * 场景：双标签页同次登录、access 同时到期 → 两页并发 /refresh 带同一 rt；
 * 无单飞时次个请求在首个完成后才消费（REFRESH_REUSED）→ 前端 clearSession 清共享
 * localStorage → 全端误登出。单飞只合并「在途」，flight 完成后同 key 重放仍拒绝——
 * 不留时间窗，重放防护语义（Auth0 式旋转+重放检测）完全不破。
 * 原子性：check pending → consume → set pending 之间无 await，Node 单线程 run-to-completion 保证。
 */
const pending = new Map<string, Promise<unknown>>();

export async function withRefreshFlight<T>(
  key: string,
  expSeconds: number,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; value?: T }> {
  const existing = pending.get(key);
  if (existing) return { ok: true, value: (await existing) as T };
  if (!consumeRefreshToken(key, expSeconds)) return { ok: false };
  const p = fn();
  pending.set(key, p);
  try {
    return { ok: true, value: await p };
  } finally {
    pending.delete(key);
  }
}
