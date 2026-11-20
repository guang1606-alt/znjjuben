/**
 * v2.608 终态事件必须送达：任务状态落库失败不得改变对外结论。
 *
 * 先证伪：
 *  1) 失败兜底里 `await prisma.generationTask.update({ status: 'FAILED' })` 未包 try/catch——
 *     库抖动时异常从 catch 块里再次抛出，SSE 收尾时一个终态事件都没发，前端停在「生成中」转圈；
 *     而退款可能已经成功，用户既不知道钱已回、也无法重试。
 *  2) 成功路径 `update({ status: 'DONE' })` 同样未包——此时剧本已落库、费用已 settle，
 *     状态写失败会被外层 catch 当成「生成失败」：对外谎报失败、还去解冻一笔已结算的钱（必然 NO_LOSS），
 *     用户在作品库里明明能看到这一集，却被告知失败退款。
 * 修复：两处都改 try/catch + 留痕（`generate.episode.status` / `generate.episode.done-status`），
 * 对外事件照常发出；成功/失败语义、金额逻辑不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2608-secret';
process.env.JWT_REFRESH_SECRET = 'v2608-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const UID = 'u_v2608';
const PID = 'p_v2608';
const PID2 = 'p_v2608_b';
const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';

function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
async function readSse(resp) {
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
    }
  }
  return events;
}
function gen(projectId = PID) {
  return fetch(base + '/api/generate/episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` },
    body: JSON.stringify({ projectId, brief, engineTier: 'ECONOMY' }),
  });
}

describe('v2.608 状态落库失败不得吞掉终态事件', { concurrency: 1 }, () => {
  before(() => {
    mem._seedUser({ id: UID, level: 'BASIC', balance: 1000 });
    mem._projects.set(PID, { id: PID, userId: UID, bible: null });
    // 测试 1 的状态写失败会把任务留在 RUNNING（在途自愈窗口 35 分钟），用独立项目避免互相 409
    mem._projects.set(PID2, { id: PID2, userId: UID, bible: null });
  });

  it('1) 生成失败 + 状态写 FAILED 失败：仍发出 failed_refunded 并留痕', async () => {
    const origCreate = mem.script.create;
    const origTaskUpdate = mem.generationTask.update;
    mem.script.create = async () => { throw new Error('DB_DOWN_SCRIPT'); }; // 强制进入失败兜底
    mem.generationTask.update = async (arg) => {
      if (arg?.data?.status === 'FAILED') throw new Error('TASK_STATUS_DOWN');
      return origTaskUpdate.call(mem.generationTask, arg);
    };
    const stop = captureErrors();
    let events;
    try {
      const resp = await gen();
      assert.strictEqual(resp.status, 200);
      events = await readSse(resp);
    } finally {
      const calls = stop();
      mem.script.create = origCreate;
      mem.generationTask.update = origTaskUpdate;
      assert.ok(calls.some((c) => c.includes('[generate.episode.status]')),
        '状态写失败必须留痕 generate.episode.status；实际：' + calls.join(' | '));
    }
    const failed = events.find((e) => e.stage === 'failed_refunded');
    assert.ok(failed, '状态写失败也必须把终态事件送达前端，不得让用户一直转圈');
  });

  it('2) 生成成功 + 状态写 DONE 失败：仍发 done，不得谎报失败退款', async () => {
    const origTaskUpdate = mem.generationTask.update;
    mem.generationTask.update = async (arg) => {
      if (arg?.data?.status === 'DONE') throw new Error('TASK_DONE_DOWN');
      return origTaskUpdate.call(mem.generationTask, arg);
    };
    const stop = captureErrors();
    let events;
    try {
      const resp = await gen(PID2);
      assert.strictEqual(resp.status, 200);
      events = await readSse(resp);
    } finally {
      const calls = stop();
      mem.generationTask.update = origTaskUpdate;
      assert.ok(calls.some((c) => c.includes('[generate.episode.done-status]')),
        '完成状态写失败必须留痕 generate.episode.done-status；实际：' + calls.join(' | '));
    }
    assert.ok(events.find((e) => e.stage === 'done'), '剧本已落库且已结算，必须如实返回 done');
    assert.strictEqual(events.filter((e) => e.stage === 'failed_refunded').length, 0,
      '不得把已成功已计费的生成谎报成失败退款');
  });
});
