const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'fb-test-secret';
process.env.JWT_REFRESH_SECRET = 'fb-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createFeedbackRouter } = require('../dist/routes/feedback.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ feedback: createFeedbackRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO', isAdmin: false });
mem._seedUser({ id: 'subadm', phone: '13000000011', level: 'PRO', isAdmin: true }); // 副管：标记在、无后台权
mem._seedUser({ id: 'u_pro', level: 'PRO', penName: '墨白' });
mem._seedUser({ id: 'u_free', level: 'FREE', penName: null });
mem._seedUser({ id: 'u_norm', level: 'BASIC', penName: '阿青' });

const auth = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
async function post(path, uid, level, body) {
  const r = await fetch(base + path, { method: 'POST', headers: auth(uid, level), body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function get(path, uid, level) {
  const headers = uid ? auth(uid, level) : {};
  const r = await fetch(base + path, { headers });
  return { status: r.status, json: await r.json().catch(() => null) };
}

describe('反馈/Bug 三态处置闭环', { concurrency: 1 }, () => {
  it('未登录提交 401', async () => {
    const rr = await fetch(base + '/api/feedback/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(rr.status, 401);
  });

  it('用户提交 BUG 工单成功，带 BUG 工单号', async () => {
    const r = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'BUG', content: '点生成按钮无响应，页面崩溃', urgent: true });
    assert.strictEqual(r.status, 200);
    assert.ok(/^BUG-/.test(r.json.ticketNo));
  });

  it('普通用户访问管理后台 403；副管理员同样 403(needSuperAdmin)', async () => {
    const r = await get('/api/feedback/admin/list', 'u_norm', 'BASIC');
    assert.strictEqual((await r).status, 403);
    const s = await get('/api/feedback/admin/list', 'subadm', 'PRO');
    assert.strictEqual(s.status, 403);
    assert.strictEqual(s.json.needSuperAdmin, true);
  });

  it('一键执行前 preview：梳理分类并预判修复路径（知识类→工具自愈/代码类→豆包/资金类→人工）', async () => {
    const mk = async (content) => {
      const c = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'SUGGESTION', content });
      const list = await get('/api/feedback/admin/list', 'admin1', 'PRO');
      return list.json.find((x) => x.ticketNo === c.json.ticketNo);
    };
    const tag = await mk('希望多加点悬疑探案标签');
    const bug = await mk('下载docx按钮点了没反应');
    const money = await mk('我被乱扣费了要求退款');
    const p1 = await post(`/api/feedback/admin/${tag.id}/preview`, 'admin1', 'PRO', {});
    const p2 = await post(`/api/feedback/admin/${bug.id}/preview`, 'admin1', 'PRO', {});
    const p3 = await post(`/api/feedback/admin/${money.id}/preview`, 'admin1', 'PRO', {});
    assert.strictEqual(p1.json.fixPath.route, 'tool_auto');
    assert.strictEqual(p2.json.fixPath.route, 'doubao');
    assert.strictEqual(p3.json.fixPath.route, 'manual');
  });

  it('一键执行：状态 EXECUTING、返回修复路径、小南暖心回复（含笔名），用户在 /mine 可见', async () => {
    const c = await post('/api/feedback/', 'u_pro', 'PRO', { type: 'SUGGESTION', content: '标签库希望补充更多国风非遗题材' });
    const list = await get('/api/feedback/admin/list', 'admin1', 'PRO');
    const fb = list.json.find((x) => x.ticketNo === c.json.ticketNo);
    const r = await post(`/api/feedback/admin/${fb.id}/action`, 'admin1', 'PRO', { action: 'execute' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.status, 'EXECUTING');
    assert.strictEqual(r.json.fixPath.route, 'tool_auto');
    assert.ok(r.json.reply.includes('墨白'));
    const mine = await get('/api/feedback/mine', 'u_pro', 'PRO');
    const seen = mine.json.find((x) => x.ticketNo === c.json.ticketNo);
    assert.strictEqual(seen.status, 'EXECUTING');
    assert.ok(seen.reply.includes('墨白'));
  });

  it('待办：PRO 与 FREE 各一条，按会员等级排序 PRO 在前', async () => {
    const c1 = await post('/api/feedback/', 'u_free', 'FREE', { type: 'SUGGESTION', content: '希望加个深色模式' });
    const c2 = await post('/api/feedback/', 'u_pro', 'PRO', { type: 'SUGGESTION', content: '希望批量导出' });
    const list = await get('/api/feedback/admin/list', 'admin1', 'PRO');
    const f1 = list.json.find((x) => x.ticketNo === c1.json.ticketNo);
    const f2 = list.json.find((x) => x.ticketNo === c2.json.ticketNo);
    await post(`/api/feedback/admin/${f1.id}/action`, 'admin1', 'PRO', { action: 'todo' });
    await post(`/api/feedback/admin/${f2.id}/action`, 'admin1', 'PRO', { action: 'todo' });
    const todos = await get('/api/feedback/admin/todos?sortBy=level', 'admin1', 'PRO');
    assert.strictEqual(todos.status, 200);
    assert.ok(todos.json.length >= 2);
    assert.strictEqual(todos.json[0].level, 'PRO');
    assert.ok(todos.json[0].ticket); // 回填工单详情
  });

  it('否定：状态 REJECTED 且仍给被尊重的回复；手改回复优先', async () => {
    const c = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'SUGGESTION', content: '希望加个无关功能' });
    const list = await get('/api/feedback/admin/list', 'admin1', 'PRO');
    const fb = list.json.find((x) => x.ticketNo === c.json.ticketNo);
    const r = await post(`/api/feedback/admin/${fb.id}/action`, 'admin1', 'PRO', { action: 'reject', manualText: '阿青，这条我们专门评估过，先保留，谢谢你～' });
    assert.strictEqual(r.json.status, 'REJECTED');
    assert.strictEqual(r.json.reply, '阿青，这条我们专门评估过，先保留，谢谢你～');
  });

  it('非法 action 值 400；工单不存在 404', async () => {
    const bad = await post('/api/feedback/admin/nope/action', 'admin1', 'PRO', { action: 'what' });
    assert.strictEqual(bad.status, 400);
    const miss = await post('/api/feedback/admin/nope/action', 'admin1', 'PRO', { action: 'todo' });
    assert.strictEqual(miss.status, 404);
  });
});
