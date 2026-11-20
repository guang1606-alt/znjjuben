/**
 * v2.586 前集上下文读取失败不得静默降级（跨集连续性是付费生成的核心输入）：
 * 旧实现 `prevScript ... .catch(() => null)` 与 `prevRows ... .catch(() => [])` 把数据库故障
 * 吞成「没有前集」——付费用户拿到按第一集凭空衔接的成稿，既无提示也无日志。
 * 本用例锁定：读取失败必须中止生成、全额退款、任务标记失败、提示可重试；正常路径不受影响。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'gen-test-secret';
process.env.JWT_REFRESH_SECRET = 'gen-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
// 隔离真实 DB 供应商配置（与 http-generate 一致：测试走沙盘，不打真机 API）
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';

function seedWithPrev(id) {
  mem._seedUser({ id, level: 'BASIC', balance: 1000 });
  const pid = `proj_${id}`;
  mem._projects.set(pid, { id: pid, userId: id, bible: null });
  mem._scripts.push({
    id: `prev_${id}`, projectId: pid, epNo: 1, version: 1, title: '第一集',
    content: '第一集正文：林夏在雨里攥紧合同。\n结尾：会议室的门被推开。',
    qcReport: null, createdAt: new Date(),
  });
  return pid;
}

/** 只让匹配谓词的 script 查询失败，其余照常走原桩（避免误伤 lastEpisode/free 计数） */
function patchScriptFindMany(shouldFail) {
  const orig = mem.script.findMany;
  mem.script.findMany = async function (arg = {}) {
    if (shouldFail(arg?.where ?? {})) throw new Error('DB_DOWN');
    return orig.call(this, arg);
  };
  return () => { mem.script.findMany = orig; };
}

async function call(uid, level, body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` };
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers, body: JSON.stringify(body) });
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
    }
  }
  return { status: resp.status, events };
}

function assertFailedRefunded(r, uid, pid, prevCount) {
  assert.strictEqual(r.status, 200, 'SSE 正常建立，错误以事件返回');
  const last = r.events[r.events.length - 1];
  assert.strictEqual(last.stage, 'failed_refunded', '前集读不到必须走失败退款，而不是静默生成');
  assert.match(String(last.error), /前集剧本读取失败/, '必须给用户可操作的中文提示');
  const acc = mem._accounts.get(uid);
  assert.strictEqual(acc.balance, 1000, '失败必须全额退款');
  assert.strictEqual(acc.frozen, 0, '冻结必须清零');
  const task = [...mem._tasks.values()].find((t) => t.projectId === pid);
  assert.strictEqual(task.status, 'FAILED');
  assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, prevCount, '不得落新剧本');
}

describe('前集上下文读取失败的真实性（v2.586）', { concurrency: 1 }, () => {
  it('前集末稿读取失败：中止生成并退款，不产出无前集衔接的成稿', async () => {
    const pid = seedWithPrev('u_prev_script');
    const restore = patchScriptFindMany((w) => typeof w.epNo === 'number');
    try {
      const r = await call('u_prev_script', 'BASIC', { projectId: pid, brief, engineTier: 'ECONOMY' });
      assertFailedRefunded(r, 'u_prev_script', pid, 1);
    } finally { restore(); }
  });

  it('跨集台账批量读取失败：同样中止并退款，不得当作「没有历史」继续', async () => {
    const pid = seedWithPrev('u_prev_ledger');
    const restore = patchScriptFindMany((w) => w.epNo && typeof w.epNo === 'object' && 'lte' in w.epNo);
    try {
      const r = await call('u_prev_ledger', 'BASIC', { projectId: pid, brief, engineTier: 'ECONOMY' });
      assertFailedRefunded(r, 'u_prev_ledger', pid, 1);
    } finally { restore(); }
  });

  it('正常路径：有前集照常生成第 2 集并扣费（修复不得误伤成功链路）', async () => {
    const pid = seedWithPrev('u_prev_ok');
    const r = await call('u_prev_ok', 'BASIC', { projectId: pid, brief, engineTier: 'ECONOMY' });
    assert.strictEqual(r.status, 200);
    const done = r.events.find((e) => e.stage === 'done');
    assert.ok(done, '有前集时应正常完成');
    assert.strictEqual(done.pointsCharged, 10);
    assert.strictEqual(mem._accounts.get('u_prev_ok').balance, 990);
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 2);
  });
});
