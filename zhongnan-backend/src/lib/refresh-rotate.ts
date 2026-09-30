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
