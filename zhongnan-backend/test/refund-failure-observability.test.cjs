/**
 * v2.571 失败退款不得静默：
 * v2.569 已为编剧室/采访的退款加了 safeRefund 留痕，但海报、PK、小南深度共创、
 * 剧本拆解这 6 处仍是 `.catch(() => {})`——退款失败只丢异常、不留任何对账线索，
 * 用户被扣分却无产出时服务端完全不可观测。本用例逐面锁定：退款失败必须留 [scope] 日志。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'rf-obs-secret';
process.env.JWT_REFRESH_SECRET = 'rf-obs-refresh';
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { createTeardownRouter } = require('../dist/routes/teardown.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

function captureErrors() {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args); };
  return { logs, restore: () => { console.error = orig; } };
}
/** 第 1 次事务=扣费成功，第 2 次=退款失败 */
function failSecondTx(mem) {
  const orig = mem.$transaction;
  let n = 0;
  mem.$transaction = async (...a) => { n += 1; if (n >= 2) throw new Error('tx-down'); return orig.apply(mem, a); };
  return () => { mem.$transaction = orig; };
}

describe('v2.571 退款失败留痕（海报/PK/小南/拆解）', { concurrency: 1 }, () => {
  const mem = createMemoryPrisma();
  const app = createApp({ va: createValueAddedRouter(mem), teardown: createTeardownRouter(mem) });
  let base;
  const server = app.listen(0);
  before(() => new Promise((res) => {
    const done = () => { base = `http://127.0.0.1:${server.address().port}`; res(); };
    if (server.listening) return done();
    server.once('listening', done);
  }));
  after(async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
  });

  mem._seedUser({ id: 'u1', level: 'BASIC', balance: 2000 });
  mem.project.create({ data: { id: 'pa', userId: 'u1', title: '留痕项目', tags: ['都市'] } });
  mem.script.create({ data: { id: 'sa', projectId: 'pa', epNo: 1, version: 1, content: '第一集：主角在雨夜收到一封神秘来信。'.repeat(12) } });

  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'BASIC' })}` };
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: H, body: JSON.stringify(body ?? {}) });

  it('海报：上游失败 + 退款失败 → [va.poster] 留痕', async () => {
    const mp = require('../dist/lib/model-proxy.js');
    const origImg = mp.callImage;
    mp.callImage = async () => { throw new Error('boom-image'); };
    const restore = failSecondTx(mem);
    const cap = captureErrors();
    try {
      const r = await post('/api/va/poster', { projectId: 'pa', tier: 'STANDARD' });
      assert.strictEqual(r.status, 400);
      assert.ok(cap.logs.some((l) => String(l[0]).includes('va.poster')), `应留痕 va.poster，实际：${JSON.stringify(cap.logs)}`);
    } finally { mp.callImage = origImg; restore(); cap.restore(); }
  });

  it('小南：空产出退款 + 退款失败 → 仍回 503 且 [va.xiaonan] 留痕', async () => {
    const mp = require('../dist/lib/model-proxy.js');
    const origText = mp.callText;
    mp.callText = async () => ({ text: '', tokensIn: 0, tokensOut: 0, costFen: 0, sandbox: true });
    const restore = failSecondTx(mem);
    const cap = captureErrors();
    try {
      const r = await post('/api/va/xiaonan', { question: '怎么写出钩子？' });
      assert.strictEqual(r.status, 503);
      assert.strictEqual((await r.json()).error, 'SANDBOX');
      assert.ok(cap.logs.some((l) => String(l[0]).includes('va.xiaonan')), `应留痕 va.xiaonan，实际：${JSON.stringify(cap.logs)}`);
    } finally { mp.callText = origText; restore(); cap.restore(); }
  });

  it('PK：落库失败 + 退款失败 → [va.pk] 留痕', async () => {
    const origCreate = mem.pkBattle.create;
    mem.pkBattle.create = async () => { throw new Error('boom-pk'); };
    const restore = failSecondTx(mem);
    const cap = captureErrors();
    try {
      const r = await post('/api/va/pk', { projectAId: 'pa' });
      assert.strictEqual(r.status, 400);
      assert.ok(cap.logs.some((l) => String(l[0]).includes('va.pk')), `应留痕 va.pk，实际：${JSON.stringify(cap.logs)}`);
    } finally { mem.pkBattle.create = origCreate; restore(); cap.restore(); }
  });

  it('拆解：落库失败 + 退款失败 → [teardown.analyze] 留痕', async () => {
    const origCreate = mem.teardownRecord.create;
    mem.teardownRecord.create = async () => { throw new Error('boom-td'); };
    const restore = failSecondTx(mem);
    const cap = captureErrors();
    try {
      const r = await post('/api/teardown/analyze', { text: '第一集：主角在雨夜收到一封神秘来信，信上只有一句话。'.repeat(5) });
      assert.ok(r.status >= 500, `未知异常应走 500，实际 ${r.status}`);
      assert.ok(cap.logs.some((l) => String(l[0]).includes('teardown.analyze')), `应留痕 teardown.analyze，实际：${JSON.stringify(cap.logs)}`);
    } finally { mem.teardownRecord.create = origCreate; restore(); cap.restore(); }
  });
});
