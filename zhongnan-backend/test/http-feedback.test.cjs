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

  // —— v2.189 反馈图片上传 + 后台导出总表 ——
  const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('用户提交带图片的反馈成功，后台 list 可见 images 数组', async () => {
    const r = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'BUG', content: '按钮错位，附图', images: [png1x1] });
    assert.strictEqual(r.status, 200);
    const list = await get('/api/feedback/admin/list', 'admin1', 'PRO');
    const fb = list.json.find((x) => x.ticketNo === r.json.ticketNo);
    assert.ok(Array.isArray(fb.images));
    assert.strictEqual(fb.images.length, 1);
    assert.ok(fb.images[0].startsWith('data:image/png;base64,'));
  });

  it('图片超过 3 张返回 400', async () => {
    const r = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'SUGGESTION', content: '多图', images: [png1x1, png1x1, png1x1, png1x1] });
    assert.strictEqual(r.status, 400);
  });

  it('非图片 MIME（如 text/html）返回 400', async () => {
    const bad = 'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    const r = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'SUGGESTION', content: 'x', images: [bad] });
    assert.strictEqual(r.status, 400);
  });

  it('单张图片超过 2MB 返回 400', async () => {
    // base64 膨胀比 4/3，2MB 原图上限对应 base64 约 2.67MB；用 3MB 确保超限
    const huge = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024);
    const r = await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'SUGGESTION', content: 'x', images: [huge] });
    assert.strictEqual(r.status, 400);
  });

  it('后台导出 JSON 总表（含 images），需超管权限', async () => {
    // 先确保至少有一条带图工单
    await post('/api/feedback/', 'u_pro', 'PRO', { type: 'SUGGESTION', content: '导出测试', images: [png1x1] });
    // 普通用户 403
    const forb = await get('/api/feedback/admin/export', 'u_norm', 'BASIC');
    assert.strictEqual(forb.status, 403);
    // 超管 200，Content-Disposition 含 attachment
    const exp = await fetch(base + '/api/feedback/admin/export', { headers: auth('admin1', 'PRO') });
    assert.strictEqual(exp.status, 200);
    assert.ok(/attachment/.test(exp.headers.get('content-disposition') || ''));
    const data = await exp.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
    const withImg = data.find((x) => x.content === '导出测试');
    assert.ok(withImg);
    assert.ok(Array.isArray(withImg.images));
  });

  it('后台导出支持按 status/type 过滤', async () => {
    await post('/api/feedback/', 'u_norm', 'BASIC', { type: 'BUG', content: '过滤测试bug' });
    const bugOnly = await fetch(base + '/api/feedback/admin/export?type=BUG', { headers: auth('admin1', 'PRO') });
    const arr = await bugOnly.json();
    assert.ok(arr.every((x) => x.type === 'BUG'));
  });
});
