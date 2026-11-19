/**
 * v2.572 优雅关停：
 * 此前 index.ts 只 app.listen，不处理 SIGTERM/SIGINT——容器滚动发布或 Ctrl+C 时进程直接退出，
 * 正在跑的生成任务中断为 QUEUED/RUNNING 悬挂孤儿（管理台需人工 force-fail），且中断路径的退款闭环来不及执行。
 * 关停应先取消全部活跃生成任务（管线在下一岗位边界抛 CANCELLED → 既有失败路径解冻退款），再关连接、断库，超时兜底强退。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { setActiveAbort, abortAllActiveTasks, activeTaskCount } = require('../dist/lib/active-tasks.js');
const { makeShutdownHandler } = require('../dist/lib/shutdown.js');

describe('v2.572 优雅关停与活跃任务取消', { concurrency: 1 }, () => {
  it('abortAllActiveTasks：全部触发 abort 并清空注册表', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    setActiveAbort('t1', c1);
    setActiveAbort('t2', c2);
    const n = abortAllActiveTasks();
    assert.strictEqual(n, 2);
    assert.strictEqual(c1.signal.aborted, true);
    assert.strictEqual(c2.signal.aborted, true);
    assert.strictEqual(activeTaskCount(), 0);
  });

  it('关停顺序：先取消任务 → 关连接 → 断库 → exit(0)', async () => {
    const calls = [];
    const logs = [];
    let closed = false;
    const shutdown = makeShutdownHandler({
      abortAll: () => { calls.push('abort'); return 3; },
      closeServer: (cb) => { calls.push('close'); closed = true; cb(); },
      disconnect: async () => { calls.push('disconnect'); },
      exit: (code) => { calls.push(`exit:${code}`); },
      log: (m) => logs.push(m),
      timeoutMs: 10_000,
    });
    shutdown('SIGTERM');
    await new Promise((r) => setTimeout(r, 10));
    assert.deepStrictEqual(calls, ['abort', 'close', 'disconnect', 'exit:0']);
    assert.ok(closed);
    assert.ok(logs.some((m) => m.includes('SIGTERM') && m.includes('3')), `日志应含信号与取消数，实际：${JSON.stringify(logs)}`);
  });

  it('重复信号只执行一次关停', async () => {
    let aborts = 0;
    const shutdown = makeShutdownHandler({
      abortAll: () => { aborts += 1; return 0; },
      closeServer: (cb) => cb(),
      disconnect: async () => {},
      exit: () => {},
      timeoutMs: 10_000,
    });
    shutdown('SIGTERM');
    shutdown('SIGINT');
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(aborts, 1);
  });

  it('关连接超时：兜底 exit(1)，不死等', async () => {
    const logs = [];
    const exits = [];
    makeShutdownHandler({
      abortAll: () => 0,
      closeServer: () => { /* 永不回调，模拟 SSE 长连接卡住 */ },
      disconnect: async () => {},
      exit: (code) => exits.push(code),
      log: (m) => logs.push(m),
      timeoutMs: 20,
    })('SIGTERM');
    await new Promise((r) => setTimeout(r, 80));
    assert.deepStrictEqual(exits, [1]);
    assert.ok(logs.some((m) => m.includes('超时')), `应记录超时，实际：${JSON.stringify(logs)}`);
  });

  it('断库失败不阻断退出', async () => {
    const exits = [];
    makeShutdownHandler({
      abortAll: () => 0,
      closeServer: (cb) => cb(),
      disconnect: async () => { throw new Error('db-down'); },
      exit: (code) => exits.push(code),
      timeoutMs: 10_000,
    })('SIGTERM');
    await new Promise((r) => setTimeout(r, 10));
    assert.deepStrictEqual(exits, [0]);
  });
});
