/**
 * v2.572 优雅关停（可单测的纯逻辑，信号绑定留在 index.ts）。
 * 顺序：取消活跃生成任务（走失败退款闭环）→ 关 HTTP 连接（SSE 随之中断）→ 断库 → exit(0)；
 * 关连接超时兜底 exit(1)，避免发布时卡死在长连接上。重复信号只执行一次。
 */
export interface ShutdownDeps {
  closeServer: (cb: () => void) => void;
  disconnect: () => Promise<unknown>;
  abortAll: () => number;
  exit: (code: number) => void;
  log?: (msg: string) => void;
  timeoutMs?: number;
}

export function makeShutdownHandler(deps: ShutdownDeps): (signal: string) => void {
  let started = false;
  return (signal: string) => {
    if (started) return;
    started = true;
    const log = deps.log ?? (() => {});
    const n = deps.abortAll();
    log(`[shutdown] 收到 ${signal}：已取消 ${n} 个活跃生成任务（按失败路径解冻退款）`);
    const timer = setTimeout(() => {
      log('[shutdown] 关闭连接超时，强制退出');
      deps.exit(1);
    }, deps.timeoutMs ?? 10_000);
    // 定时器不应单独把进程吊住（正常关停时会 clear）
    (timer as unknown as { unref?: () => void }).unref?.();
    deps.closeServer(() => {
      clearTimeout(timer);
      Promise.resolve()
        .then(() => deps.disconnect())
        .catch((e) => log(`[shutdown] 断开数据库失败：${(e as Error)?.message ?? e}`))
        .finally(() => deps.exit(0));
    });
  };
}
