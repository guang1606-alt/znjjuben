/** 每集只保留最高版本；旧记录缺少 version 时按初版处理。 */
export function latestScripts<T extends { epNo: number; version?: number }>(scripts: readonly T[]): T[] {
  const episodes = new Map<number, T>();
  for (const script of scripts) {
    const previous = episodes.get(script.epNo);
    if (!previous || (script.version ?? 1) > (previous.version ?? 1)) episodes.set(script.epNo, script);
  }
  return [...episodes.values()].sort((a, b) => a.epNo - b.epNo);
}
