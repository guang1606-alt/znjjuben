/**
 * v2.605 幂等键查重与知识引用追踪：读/写失败必须留痕，且不得用「查不到」冒充「没有」。
 *
 * 先证伪：
 *   1) 建项目幂等键查重 `project.findFirst(...).catch(() => null)`——读失败按「无既有项目」继续建，
 *      弱网重试时正好绕开 v2.540 的幂等保护，造出第二个项目并白占额度。修复：fail-closed 500 + 留痕
 *      `generate.project.create.idempotency-lookup`（DB 恢复后同键重试仍幂等）。
 *   2) 生成成功后知识 `lastReferencedAt` 更新 `updateMany(...).catch(() => null)`——写失败完全无声，
 *      pruneKnowledge 会把这些仍在被引用的知识按「长期未引用」误判过时归档。修复：留痕
 *      `generate.knowledge.lastReferenced`，生成结果不受影响（非破坏）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2605-secret';
process.env.JWT_REFRESH_SECRET = 'v2605-refresh';
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
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
});

const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';
function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
function h(uid, level) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` };
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

describe('v2.605 幂等查重与知识引用追踪留痕', { concurrency: 1 }, () => {
  it('1) 幂等键查重读失败：fail-closed 500 + 留痕，不新建项目', async () => {
    mem._seedUser({ id: 'u_v2605_idem', level: 'BASIC', balance: 0 });
    const mk = (key) => fetch(base + '/api/generate/projects', {
      method: 'POST',
      headers: { ...h('u_v2605_idem', 'BASIC'), 'Idempotency-Key': key },
      body: JSON.stringify({ title: '幂等测试', mode: 'tags' }),
    });
    const first = await mk('k-ok'); // 正常路径先证不误伤
    assert.strictEqual(first.status, 200);
    const before = mem._projects.size;

    const orig = mem.project.findFirst;
    mem.project.findFirst = async (arg) => {
      if (arg?.where?.idempotencyKey) throw new Error('DB_DOWN');
      return orig.call(mem.project, arg);
    };
    const stop = captureErrors();
    let r;
    try {
      r = await mk('k-fail');
    } finally {
      const calls = stop(); mem.project.findFirst = orig;
      assert.ok(calls.some((c) => c.includes('[generate.project.create.idempotency-lookup]')),
        '必须留痕 idempotency-lookup；实际：' + calls.join(' | '));
    }
    assert.strictEqual(r.status, 500, '查重失败不得继续建项目');
    assert.deepStrictEqual(await r.json(), { error: '创建项目失败，请重试' });
    assert.strictEqual(mem._projects.size, before, '不得新建项目');
  });

  it('2) 知识 lastReferencedAt 更新失败：生成照常完成 + 留痕', async () => {
    const uid = 'u_v2605_kno';
    mem._seedUser({ id: uid, level: 'BASIC', balance: 1000 });
    const pid = 'proj_v2605_kno';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null });
    mem._scripts.push({
      id: 'prev_v2605', projectId: pid, epNo: 1, version: 1, title: '第一集',
      content: '第一集正文：林夏在雨里攥紧合同。\n结尾：会议室的门被推开。',
      qcReport: null, createdAt: new Date(),
    });
    mem._knowledgeItems.push({
      id: 'kno_v2605', userId: null, title: '三幕结构', content: '建立-对抗-解决',
      category: 'craft', status: 'APPROVED', approvedAt: new Date(),
    });
    const orig = mem.knowledgeItem.updateMany;
    mem.knowledgeItem.updateMany = async () => { throw new Error('DB_DOWN'); };
    const stop = captureErrors();
    let resp, events;
    try {
      resp = await fetch(base + '/api/generate/episodes', {
        method: 'POST', headers: h(uid, 'BASIC'),
        body: JSON.stringify({ projectId: pid, brief, engineTier: 'ECONOMY' }),
      });
      events = await readSse(resp);
    } finally {
      const calls = stop(); mem.knowledgeItem.updateMany = orig;
      assert.ok(calls.some((c) => c.includes('[generate.knowledge.lastReferenced]')),
        '必须留痕 knowledge.lastReferenced；实际：' + calls.join(' | '));
    }
    assert.strictEqual(resp.status, 200, '引用追踪失败不得中止生成');
    assert.ok(events.find((e) => e.stage === 'done'), '应正常走到 done');
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 2, '仍产出新剧本');
  });
});
