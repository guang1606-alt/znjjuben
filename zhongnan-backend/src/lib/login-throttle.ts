/**
 * 登录失败限流（内存滑动窗）：同 key（IP+手机号）在窗口内累计失败达上限即锁定，
 * 窗口滑出最早失败后自动解锁；成功登录应 clear 清零。
 * 多实例部署时各实例独立计数，仍显著提高暴力破解成本（v2.208）。
 */
export interface LoginThrottleOptions {
  maxFailures?: number;
  windowMs?: number;
  now?: () => number;
}

export function createLoginThrottle(options: LoginThrottleOptions = {}) {
  const maxFailures = options.maxFailures ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = options.now ?? Date.now;
  const failures = new Map<string, number[]>();
  function prune(key: string) {
    const cutoff = now() - windowMs;
    const list = (failures.get(key) || []).filter((t) => t > cutoff);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
  }
  return {
    /** 是否处于锁定（窗口内失败次数达到上限） */
    isLocked(key: string): boolean {
      prune(key);
      return (failures.get(key)?.length ?? 0) >= maxFailures;
    },
    /** 记录一次失败，返回窗口内当前失败次数 */
    recordFailure(key: string): number {
      prune(key);
      const list = failures.get(key) ?? [];
      list.push(now());
      failures.set(key, list);
      return list.length;
    },
    /** 登录成功后清零 */
    clear(key: string): void {
      failures.delete(key);
    },
  };
}
