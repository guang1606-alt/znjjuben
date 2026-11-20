/**
 * v2.580 免费档「每日 2 集」口径统一。
 * 此前只有生成入口内部内联计数：用户看不到今天还剩几集，只能撞到 402 才知道；
 * 且 /me 与生成各写一份计数迟早漂移。抽出唯一的「今日已用」计算：
 *  - 已完成：今日创建的剧本（每集落一条 Script）；
 *  - 在途：今日创建且 QUEUED/RUNNING 的生成任务（占坑行，防并发刷第 3 集；FAILED 自动释放）。
 */
export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** raw 可为 PrismaClient / 事务客户端 / 测试内存桩 */
export async function freeEpisodesUsedToday(raw: any, userId: string, now: Date = new Date()): Promise<number> {
  const since = startOfToday(now);
  const done = await raw.script.count({
    where: { project: { userId }, createdAt: { gte: since } },
  });
  const inFlight = await raw.generationTask.count({
    where: {
      project: { userId },
      status: { in: ['QUEUED', 'RUNNING'] },
      createdAt: { gte: since },
    },
  });
  return (Number(done) || 0) + (Number(inFlight) || 0);
}
