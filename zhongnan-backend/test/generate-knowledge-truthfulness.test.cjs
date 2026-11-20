/**
 * v2.592 知识注入读取失败不得静默降质：
 * 旧实现 `prisma.knowledgeItem.findMany(...).catch(() => [])` 把数据库故障吞成「没有知识」——
 * 付费生成照常完成并全额扣费，但缺少知识库（高分剧本技法/市场趋势/政策规则）注入，成稿降质，
 * 服务端无日志、用户无感知，既不可观测也不可归因。
 * 知识注入是增强项（用户无已批准知识时本就 knowledgeHints=null），与 v2.586 前集末稿（跨集核心输入）
 * 不同：读取失败不得杀死付费生成（fail-open），但必须 logInternal 留痕，使降质可观测可归因。
 * 本用例锁定：① findMany 故障 → 生成照常完成 + 照常扣费 + 不落退款，但 console.error 必含
 *   [generate.knowledge.fetch]；② 正常路径有已批准知识时照常生成（修复不得误伤成功链路）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'gen-kno-secret';
process.env.JWT_REFRESH_SECRET = 'gen-kno-refresh';
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

function patchKnowledgeFindMany(impl) {
  const orig = mem.knowledgeItem.findMany;
  mem.knowledgeItem.findMany = impl(orig);
  return () => { mem.knowledgeItem.findMany = orig; };
}

function captureErrors() {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => { calls.push(args.map((a) => String(a)).join(' ')); };
  return () => { console.error = orig; return calls; };
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

describe('知识注入读取失败不得静默降质（v2.592）', { concurrency: 1 }, () => {
  it('knowledgeItem.findMany 故障：生成照常完成并扣费（fail-open），但必须 logInternal 留痕', async () => {
    const pid = seedWithPrev('u_kno_fail');
    const restore = patchKnowledgeFindMany(() => async () => { throw new Error('DB_DOWN'); });
    const stopCap = captureErrors();
    let calls = [];
    try {
      const r = await call('u_kno_fail', 'BASIC', { projectId: pid, brief, engineTier: 'ECONOMY' });
      assert.strictEqual(r.status, 200, '知识读取失败不得中止生成（知识是增强项，fail-open）');
      const done = r.events.find((e) => e.stage === 'done');
      assert.ok(done, '应正常走到 done 事件，而不是失败退款');
      assert.strictEqual(done.pointsCharged, 10, '照常扣费（不退款）');
      assert.strictEqual(mem._accounts.get('u_kno_fail').balance, 990);
      assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 2, '仍产出新剧本');
    } finally {
      calls = stopCap();
      restore();
    }
    assert.ok(
      calls.some((c) => c.includes('[generate.knowledge.fetch]')),
      '故障必须 logInternal 留痕（可观测可归因），实际：' + calls.join(' | '),
    );
  });

  it('正常路径：有已批准知识时照常生成（修复不得误伤成功链路）', async () => {
    const pid = seedWithPrev('u_kno_ok');
    mem._knowledgeItems.push({
      id: 'kno_ok_1', userId: null, title: '三幕结构', content: '建立-对抗-解决',
      category: 'craft', status: 'APPROVED', approvedAt: new Date(),
    });
    const r = await call('u_kno_ok', 'BASIC', { projectId: pid, brief, engineTier: 'ECONOMY' });
    assert.strictEqual(r.status, 200);
    const done = r.events.find((e) => e.stage === 'done');
    assert.ok(done, '有知识时应正常完成');
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 2);
  });
});
