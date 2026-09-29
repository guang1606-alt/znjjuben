const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'hd-test-secret';
process.env.JWT_REFRESH_SECRET = 'hd-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminHandoffRouter } = require('../dist/routes/admin-handoff.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminHandoff: createAdminHandoffRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'a1', level: 'PRO', isAdmin: true });
mem._seedUser({ id: 'u1', level: 'BASIC' });
const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const req = async (method, p, uid, level, body, raw = false) => {
  const r = await fetch(base + p, { method, headers: uid ? H(uid, level) : {}, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: raw ? await r.text() : await r.json().catch(() => null) };
};

describe('v2.43 迭代接续档案', { concurrency: 1 }, () => {
  it('未登录 401 / 普通用户 403', async () => {
    assert.strictEqual((await req('GET', '/api/admin/handoff')).s, 401);
    assert.strictEqual((await req('GET', '/api/admin/handoff', 'u1', 'BASIC')).s, 403);
  });

  it('初始 GET：系统快照为代码事实（21引擎210装置/30小说源/锚点）且含空接续数据', async () => {
    const { s, j } = await req('GET', '/api/admin/handoff', 'a1', 'PRO');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.snapshot.product, '终南集 · 人工通用智能（AGI）编剧大师');
    const f = Object.fromEntries(j.snapshot.facts.map((x) => [x.label, x.value]));
    assert.ok(f['题材引擎/装置'].includes('210'), f['题材引擎/装置']);
    assert.ok(f['策略层卡片'].includes('25'), f['策略层卡片']);
    assert.ok(f['免费合法小说来源'].startsWith('30'), f['免费合法小说来源']);
    assert.ok(f['定价锚点'].includes('100集=100元=1000积分'));
    assert.deepStrictEqual(j.data.backlog, []);
    assert.ok(j.brief.includes('迭代接续口令'));
  });

  it('PUT 保存迭代脉络后 GET 回读一致（加密落库、明文不外泄依赖底层）', async () => {
    const body = {
      lastDelivery: 'v2.42 小说源30个', nextPlan: 'v2.43 接续档案',
      backlog: ['任务甲', '任务乙'], openQuestions: ['待拍板1'], notes: '备注',
    };
    const w = await req('PUT', '/api/admin/handoff', 'a1', 'PRO', body);
    assert.strictEqual(w.s, 200);
    const { j } = await req('GET', '/api/admin/handoff', 'a1', 'PRO');
    assert.strictEqual(j.data.lastDelivery, body.lastDelivery);
    assert.deepStrictEqual(j.data.backlog, ['任务甲', '任务乙']);
    assert.ok(j.brief.includes('v2.42 小说源30个') && j.brief.includes('任务甲'));
  });

  it('append 同版本覆盖、按时间倒序且最多60条', async () => {
    await req('POST', '/api/admin/handoff/append', 'a1', 'PRO', { version: 'v2.42', date: '2026-09-06', summary: '旧' });
    await req('POST', '/api/admin/handoff/append', 'a1', 'PRO', { version: 'v2.42', date: '2026-09-06', summary: '覆盖' });
    await req('POST', '/api/admin/handoff/append', 'a1', 'PRO', { version: 'v2.43', date: '2026-09-06', summary: '新' });
    const { j } = await req('GET', '/api/admin/handoff', 'a1', 'PRO');
    assert.strictEqual(j.data.iterationLog.filter((e) => e.version === 'v2.42').length, 1);
    assert.strictEqual(j.data.iterationLog[0].version, 'v2.43');
    assert.strictEqual(j.data.iterationLog.find((e) => e.version === 'v2.42').summary, '覆盖');
  });

  it('非法输入 400；import 可恢复合法 JSON 档案', async () => {
    const bad = await req('PUT', '/api/admin/handoff', 'a1', 'PRO', { backlog: '不是数组' });
    assert.strictEqual(bad.s, 400);
    const imp = await req('POST', '/api/admin/handoff/import', 'a1', 'PRO',
      { data: { lastDelivery: '导入档', backlog: ['x'], iterationLog: [] } });
    assert.strictEqual(imp.s, 200);
    assert.strictEqual(imp.j.data.lastDelivery, '导入档');
    const badJson = await req('POST', '/api/admin/handoff/import', 'a1', 'PRO', { data: '{not json' });
    assert.strictEqual(badJson.s, 400);
  });

  it('GET /brief 返回 markdown 文本', async () => {
    const r = await req('GET', '/api/admin/handoff/brief', 'a1', 'PRO', null, true);
    assert.strictEqual(r.s, 200);
    assert.ok(r.j.includes('# 终南集 · 人工通用智能（AGI）编剧大师 · 迭代接续口令'));
  });
});
