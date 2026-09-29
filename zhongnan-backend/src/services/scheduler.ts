/**
 * 自主进化调度器（零外部依赖：setTimeout 自驱动，可启动/停止，漂移自校正）
 * ------------------------------------------------------------------
 *  · 每日 03:17 跑一次自主学习闭环（榜单/政策/高分剧本 → 学习 → 淘汰 → 报告）；
 *  · 每周一 04:20 额外跑一次 API 全面盘点（铁底/异构/代际/价格 → 周报，作为每周修正依据）；
 *  · 纯函数 nextDailyDelay / nextWeeklyDelay 可离线对拍；定时器只负责按时调用。
 * 用环境变量 DISABLE_AUTO_SCHEDULER=1 可关闭（测试/本地调试）。
 */
import { runDailyLearningCycle, runWeeklyModelAudit, AutoDeps } from './auto-learning';

export interface SchedOptions { dailyHour?: number; dailyMinute?: number; weeklyHour?: number; weeklyMinute?: number; now?: () => Date }
/** 距下一个每日触发点的毫秒（默认 03:17） */
export function nextDailyDelay(now: Date, hour = 3, minute = 17): number {
  const t = new Date(now); t.setHours(hour, minute, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}
/** 距下一个"周一 hour:minute"的毫秒（getDay: 0=周日,1=周一） */
export function nextWeeklyDelay(now: Date, hour = 4, minute = 20): number {
  const t = new Date(now); t.setHours(hour, minute, 0, 0);
  const daysToMonday = (1 - now.getDay() + 7) % 7; // getDay:0=周日,1=周一；今天周一为0
  t.setDate(t.getDate() + daysToMonday);
  if (daysToMonday === 0 && t.getTime() <= now.getTime()) t.setDate(t.getDate() + 7); // 今天周一但已过点→下周一
  return t.getTime() - now.getTime();
}
export interface SchedulerHandle { stop: () => void; running: () => boolean }

export function startAutoScheduler(prisma: any, deps: AutoDeps = {}, opts: SchedOptions = {}): SchedulerHandle {
  if (process.env.DISABLE_AUTO_SCHEDULER === '1') return { stop: () => {}, running: () => false };
  const nowFn = opts.now ?? (() => new Date());
  let stopped = false; let dailyTimer: NodeJS.Timeout | null = null; let weeklyTimer: NodeJS.Timeout | null = null;

  const dailyTask = async () => {
    try {
      const r = await runDailyLearningCycle(prisma, deps);
      const liveCount = r.created.filter((c) => c.decision === 'AUTO_APPROVE').length;
      console.log(`[auto-learn] 采集${r.collected} 新增${r.fresh} 生效${liveCount} 归档${r.archived.length}`);
      // v2.186：空采集源静默回退可见性——任一源非 OK 时输出诊断，让"采集0"的原因可定位
      const src = r.sources;
      if (src) {
        const gaps: string[] = [];
        (['boards', 'policy', 'topScripts'] as const).forEach((k) => {
          const s = src[k];
          if (s.reason !== 'OK') gaps.push(`${k}=${s.reason}${s.error ? `(${s.error})` : ''}[${s.count}]`);
        });
        if (gaps.length) console.log(`[auto-learn] 采集源缺口: ${gaps.join(' | ')}`);
      }
    } catch (e) { console.error('[auto-learn] 每日闭环失败', (e as Error).message); }
    if (!stopped) dailyTimer = setTimeout(dailyTask, nextDailyDelay(nowFn(), opts.dailyHour ?? 3, opts.dailyMinute ?? 17));
  };
  const weeklyTask = async () => {
    try {
      const { report } = await runWeeklyModelAudit(prisma, {}, 'scheduler');
      console.log(`[model-audit] 每周盘点 healthy=${report.healthy} BLOCK=${report.summary.block} 升级建议=${report.summary.upgrade}`);
    } catch (e) { console.error('[model-audit] 每周盘点失败', (e as Error).message); }
    if (!stopped) weeklyTimer = setTimeout(weeklyTask, nextWeeklyDelay(nowFn(), opts.weeklyHour ?? 4, opts.weeklyMinute ?? 20));
  };

  dailyTimer = setTimeout(dailyTask, nextDailyDelay(nowFn(), opts.dailyHour ?? 3, opts.dailyMinute ?? 17));
  weeklyTimer = setTimeout(weeklyTask, nextWeeklyDelay(nowFn(), opts.weeklyHour ?? 4, opts.weeklyMinute ?? 20));
  return {
    stop: () => { stopped = true; if (dailyTimer) clearTimeout(dailyTimer); if (weeklyTimer) clearTimeout(weeklyTimer); },
    running: () => !stopped,
  };
}
