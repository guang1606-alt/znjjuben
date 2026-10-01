/**
 * v2.295 守卫：软删除穿透补漏（v2.293 漏网面——导出 / 编剧室 / PK 协作面）。
 *
 * 缺口（修复前实证）：v2.293 给 generate.ts 14 处项目查询统一补了 status:{not:'deleted'}
 * （已删=不存在），但同一语义在以下六处漏网，已删项目内容仍可被完整消费：
 *  导出面：GET /api/export/:projectId?format=txt|docx|pdf（已删项目全剧正文仍可打包下载）、
 *    GET /api/export/:projectId/materials（已删项目物料聚合照常返回）——
 *    export.ts 两处 project.findFirst 不带 status 过滤，是 v2.293 扫描集外的漏网文件。
 *  编剧室面：POST /api/room/read/open（凭已删项目的 scriptId 仍可开围读室，剧本全文
 *    被复活进房间并可凭邀请码外溢）；GET /api/room/read/:id/rewrite-pack（代码注释明示
 *    「项目被删：退化为无落点」，但实现只判 !sc/!sc.project，软删除项目照样 linked:true
 *    下发 projectId/scriptId——名实不符）。
 *  PK 面：POST /api/va/pk 项目路径（projectAId/projectBId 两处 findFirst 无 status 过滤）
 *    与剧本路径（scriptAId/scriptBId 只查归属不查项目状态）——花 20 积分 PK 自己已删的
 *    内容照常 200 扣费成功。
 *
 * 修复：六处统一对齐「已删=不存在」——findFirst 补 status:{not:'deleted'}；剧本反查面
 * （include: project）补 project.status==='deleted' 即按不存在/无落点处理。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'del-collab-test-secret';
process.env.JWT_REFRESH_SECRET = 'del-collab-test-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createExportRouter } = require('../dist/routes/export.js');
const { createRoomRouter } = require('../dist/routes/room.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ export: createExportRouter(mem), room: createRoomRouter(mem), va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const H = (uid, level = 'FREE') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const get = (uid, path, level = 'FREE') => fetch(base + path, { headers: H(uid, level) });
const post = (uid, path, body, level = 'FREE') => fetch(base + path, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body ?? {}) });
const CONTENT = '第一集\n场景一 外卖站 日 内\n林夏拎着餐盒冲进门。\n林夏：这单马上到。';
/** 建项目（可直接埋 deleted 态）+ 一集成稿，返回 script 行 */
async function seedProj(uid, pid, { deleted = false } = {}) {
  await mem.project.create({ data: { id: pid, userId: uid, title: `项目${pid}`, mode: 'tags', status: deleted ? 'deleted' : 'active' } });
  const sc = await mem.script.create({ data: { projectId: pid, epNo: 1, title: '第一集', synopsis: '开局', content: CONTENT, wordCount: 30 } });
  return sc;
}

describe('v2.295 软删除穿透补漏（导出/编剧室/PK）', { concurrency: 1 }, () => {
  it('导出面：已删项目 txt 导出与物料聚合均 404，不吐出任何正文', async () => {
    mem._seedUser({ id: 'u_ex', level: 'FREE' });
    await seedProj('u_ex', 'p_ex_del', { deleted: true });
    const r1 = await get('u_ex', '/api/export/p_ex_del?format=txt');
    assert.strictEqual(r1.status, 404, '已删项目导出必须 404（修复前 200 吐全剧正文）');
    const r2 = await get('u_ex', '/api/export/p_ex_del/materials');
    assert.strictEqual(r2.status, 404, '已删项目物料聚合必须 404');
  });

  it('导出回归：正常项目 txt 导出 200 且含分集目录', async () => {
    await seedProj('u_ex', 'p_ex_ok');
    const r = await get('u_ex', '/api/export/p_ex_ok?format=txt');
    assert.strictEqual(r.status, 200);
    assert.ok((await r.text()).includes('分集目录'));
  });

  it('编剧室面：凭已删项目 scriptId 开围读室 → 404 且零建房（剧本全文不得复活入房）', async () => {
    mem._seedUser({ id: 'u_rm', level: 'FREE' });
    const sc = await seedProj('u_rm', 'p_rm_del', { deleted: true });
    const before = mem._writersRooms.length;
    const r = await post('u_rm', '/api/room/read/open', { readMode: 'me_xn', scriptId: sc.id });
    assert.strictEqual(r.status, 404, '已删项目剧本必须按不存在处理');
    assert.strictEqual(mem._writersRooms.length, before, '不得创建围读室（修复前 200 建房且剧本全文入 room.scriptText）');
  });

  it('编剧室回归：正常项目 scriptId 开房 200', async () => {
    const sc = await seedProj('u_rm', 'p_rm_ok');
    const r = await post('u_rm', '/api/room/read/open', { readMode: 'me_xn', scriptId: sc.id, title: '正常围读' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.ok && j.roomId);
  });

  it('改写包降级：开房后项目被删 → rewrite-pack 退化为 linked:false（与代码注释语义一致）', async () => {
    const sc = await seedProj('u_rm', 'p_rm_rw');
    const open = await (await post('u_rm', '/api/room/read/open', { readMode: 'me_xn', scriptId: sc.id, title: '将删项目围读' })).json();
    assert.ok(open.roomId);
    mem._projects.get('p_rm_rw').status = 'deleted'; // 模拟开房后项目被软删
    const r = await get('u_rm', `/api/room/read/${open.roomId}/rewrite-pack`);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.linked, false, '项目已删必须退化为无落点（修复前 linked:true 继续下发 projectId/scriptId）');
    assert.strictEqual(j.projectId, undefined, '不得泄漏已删项目 id');
  });

  it('PK 项目面：已删项目 projectAId → 404 且零扣费（修复前 200 扣 20 积分）', async () => {
    mem._seedUser({ id: 'u_pk', level: 'BASIC', balance: 100 });
    await seedProj('u_pk', 'p_pk_del', { deleted: true });
    const r = await post('u_pk', '/api/va/pk', { projectAId: 'p_pk_del' }, 'BASIC');
    assert.strictEqual(r.status, 404, '已删项目不得参与 PK');
    assert.strictEqual(mem._accounts.get('u_pk').balance, 100, '余额必须原样（扣了也必须退回来）');
  });

  it('PK 剧本面：scriptAId 属已删项目 → 404 且零扣费', async () => {
    const scDel = await seedProj('u_pk', 'p_pk_del2', { deleted: true });
    const scOk = await seedProj('u_pk', 'p_pk_ok2');
    const r = await post('u_pk', '/api/va/pk', { scriptAId: scDel.id, scriptBId: scOk.id }, 'BASIC');
    assert.strictEqual(r.status, 404, '已删项目的剧本必须按不存在处理');
    assert.strictEqual(mem._accounts.get('u_pk').balance, 100, '余额必须原样');
  });

  it('PK 回归：双正常项目 200 且正常扣 20 积分', async () => {
    await seedProj('u_pk', 'p_pk_a');
    await seedProj('u_pk', 'p_pk_b');
    const r = await post('u_pk', '/api/va/pk', { projectAId: 'p_pk_a', projectBId: 'p_pk_b' }, 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(mem._accounts.get('u_pk').balance, 80);
  });
});
