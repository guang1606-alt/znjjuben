/**
 * v2.630 定时学习闭环/每周盘点失败必须可归因。
 *
 * 先证伪：
 *   `src/services/scheduler.ts` 的 dailyTask / weeklyTask 两个 catch 都写成
 *   `console.error('[auto-learn] 每日闭环失败', (e as Error).message)`：
 *   ① 丢堆栈——只剩一行 message，事后无法定位抛出点；
 *   ② 非 Error 抛出（字符串/对象，采集器与第三方库常见）时 `.message` 为 undefined，
 *      日志变成「每日闭环失败 undefined」，等于什么都没记；
 *   ③ 不统一走 logInternal 的 [scope] 口径，与全站其他 500/兜底日志无法按 scope 检索。
 *   生产 `DISABLE_CRON=1` 时这些函数由 app.ts 的 POST / 与 /api/internal 触发，
 *   同样经过这两个 catch，失败同样不可归因。
 * 修复：两处改为 `logInternal(e, 'scheduler.daily-learn' / 'scheduler.weekly-audit')`；
 * 成功路径日志与调度语义完全不变。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2630-secret';
process.env.JWT_REFRESH_SECRET = 'v2630-refresh';
delete process.env.DISABLE_AUTO_SCHEDULER;
const AL = require('../dist/services/auto-learning.js');
const SCH = require('../dist/services/scheduler.js');

const { inspect } = require('node:util');

/** 计时器测试：nowFn 前两次返回触发点，之后返回 1 分钟后（避免立即重排成 1ms 空转） */
function makeNow(base) {
  let calls = 0;
  return () => {
    calls += 1;
    return calls <= 2 ? base : new Date(base.getTime() + 60_000);
  };
}
function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => {
    calls.push(a.map((x) => (x instanceof Error ? x.stack || String(x) : typeof x === 'string' ? x : inspect(x))).join(' '));
  };
  return Promise.resolve().then(fn).then((value) => ({ value, calls })).finally(() => { console.error = orig; });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function patch(name, impl) {
  const orig = AL[name];
  AL[name] = impl;
  return () => { AL[name] = orig; };
}

describe('v2.630 定时任务失败留痕', () => {
  it('1) 每日闭环抛非 Error（字符串）：必须记 scope 且保留原文，不得是 undefined', async () => {
    const restore = patch('runDailyLearningCycle', async () => { throw '采集器爆炸'; });
    const { calls } = await captureErrors(async () => {
      const h = SCH.startAutoScheduler({}, {}, { now: makeNow(new Date('2026-11-20T03:16:59.999')) });
      await sleep(60);
      h.stop();
    });
    restore();
    const hit = calls.find((c) => c.includes('[scheduler.daily-learn]'));
    assert.ok(hit, '每日闭环失败必须走统一 scope [scheduler.daily-learn]；实际：' + calls.join(' | '));
    assert.ok(hit.includes('采集器爆炸'), '非 Error 抛出必须保留原文，不能记成 undefined；实际：' + hit);
    assert.ok(!hit.includes('undefined'), '不得出现 undefined；实际：' + hit);
  });

  it('2) 每日闭环抛 Error：必须带堆栈，可定位抛出点', async () => {
    const restore = patch('runDailyLearningCycle', async () => { throw new Error('db down'); });
    const { calls } = await captureErrors(async () => {
      const h = SCH.startAutoScheduler({}, {}, { now: makeNow(new Date('2026-11-20T03:16:59.999')) });
      await sleep(60);
      h.stop();
    });
    restore();
    const hit = calls.find((c) => c.includes('[scheduler.daily-learn]'));
    assert.ok(hit, '每日闭环失败必须走统一 scope [scheduler.daily-learn]；实际：' + calls.join(' | '));
    assert.ok(hit.includes('db down'), '必须包含错误信息；实际：' + hit);
    assert.ok(hit.includes('truthfulness-v2630.test.cjs'), '必须带堆栈（含抛出点文件）；实际：' + hit);
  });

  it('3) 每周盘点抛非 Error（对象）：必须记 scope 且可读，不得静默', async () => {
    const restore = patch('runWeeklyModelAudit', async () => { throw { code: 'E_PRICE' }; });
    const { calls } = await captureErrors(async () => {
      const h = SCH.startAutoScheduler({}, {}, { now: makeNow(new Date('2026-11-16T04:19:59.999')) }); // 周一
      await sleep(60);
      h.stop();
    });
    restore();
    const hit = calls.find((c) => c.includes('[scheduler.weekly-audit]'));
    assert.ok(hit, '每周盘点失败必须走统一 scope [scheduler.weekly-audit]；实际：' + calls.join(' | '));
    assert.ok(hit.includes('E_PRICE'), '非 Error 抛出必须保留对象内容；实际：' + hit);
    assert.ok(!hit.includes('undefined'), '不得出现 undefined；实际：' + hit);
  });
});
