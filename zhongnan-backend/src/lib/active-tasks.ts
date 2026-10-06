/**
 * v2.318 共享「活跃生成任务」注册表。
 * 背景：此前 AbortController 注册表是 generate.ts 模块私有 Map，管理台无法干预。
 * 抽成独立模块后，生成路由（注册/删除/取消）与管理台（查看 live 标记/干预）共用同一份事实。
 * 单实例内存态，与既有健康降级同口径；多实例部署时僵尸判定仍以「registry 无句柄」为准。
 */
const _active = new Map<string, AbortController>();

/** 管线启动时注册句柄（同 taskId 重复注册以最新为准） */
export function setActiveAbort(id: string, ctrl: AbortController): void { _active.set(id, ctrl); }
export function getActiveAbort(id: string): AbortController | undefined { return _active.get(id); }
export function deleteActiveAbort(id: string): void { _active.delete(id); }
/** 便捷取消：命中返回 true；未注册（孤儿任务）返回 false */
export function abortActiveTask(id: string): boolean {
  const c = _active.get(id);
  if (!c) return false;
  c.abort();
  return true;
}
/** 观测用：当前活跃任务数 */
export function activeTaskCount(): number { return _active.size; }
