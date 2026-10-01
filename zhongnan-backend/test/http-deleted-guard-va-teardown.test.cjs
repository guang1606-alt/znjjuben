/**
 * v2.296 守卫：软删除穿透补漏（v2.295 同族漏网面——海报计费面 / 改编承接状态机面）。
 *
 * 缺口（修复前实证）：
 *  海报计费面：POST /api/va/poster（value-added.ts）项目查询裸 findFirst 无 status 过滤——
 *    已删项目不 404，穿过归属/存在性检查直达 charge，用户花 39/199 积分为一个已删项目
 *    生成海报（修复前实证：FREE 用户零余额下得到 400「积分不足」而非 404——证明请求
 *    已穿透到计费阶段；同文件 PK 面 v2.295 已修，poster 面漏网）。
 *  改编承接面：POST /api/teardown/:id/to-project（teardown.ts）matching 路径——
 *    candidates 查询无 status 过滤，related.find(大纲深等) 命中已删项目即直接 return，
 *    拆解记录标 TO_PROJECT 指向已删项目：用户确认改编后拿到一个已删项目 id，
 *    新项目不创建（修复前实证：响应 project.id === 已删项目 id 且 status==='deleted'）。
 *
 * 修复：两处统一对齐「已删=不存在」——poster findFirst 补 status:{not:'deleted'}；
 *  to-project 的 matching 判定先排除 deleted（已删项目不构成「已承接」，照常新建项目承接）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'del-va-td-test-secret';
process.env.JWT_REFRESH_SECRET = 'del-va-td-test-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { createTeardownRouter } = require('../dist/routes/teardown.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem), teardown: createTeardownRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const H = (uid, level = 'FREE') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const post = (uid, path, body, level = 'FREE') => fetch(base + path, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body ?? {}) });

describe('v2.296 软删除穿透补漏（海报计费面/改编承接面）', { concurrency: 1 }, () => {
  it('海报面：已删项目 POST /api/va/poster → 404，且零计费痕迹（不得穿透到扣费阶段）', async () => {
    mem._seedUser({ id: 'u_po', level: 'BASIC' });
    await mem.project.create({ data: { id: 'p_po_del', userId: 'u_po', title: '已删海报项目', status: 'deleted' } });
    const r = await post('u_po', '/api/va/poster', { projectId: 'p_po_del', tier: 'STANDARD' }, 'BASIC');
    assert.strictEqual(r.status, 404, '已删项目海报必须 404（修复前穿透到计费阶段：零余额得 400 积分不足/有余额直接扣 39 积分）');
    const ledgers = mem._ledgers.filter((l) => l.userId === 'u_po');
    assert.strictEqual(ledgers.length, 0, '已删项目不得产生任何扣费/退款流水');
    assert.strictEqual(mem._posters.length, 0, '已删项目不得落海报记录');
  });

  it('海报回归：正常项目不被误杀——响应不得为 404（穿透到计费/生成阶段属预期）', async () => {
    await mem.project.create({ data: { id: 'p_po_ok', userId: 'u_po', title: '正常海报项目', status: 'active', tags: [] } });
    const r = await post('u_po', '/api/va/poster', { projectId: 'p_po_ok', tier: 'STANDARD' }, 'BASIC');
    assert.notStrictEqual(r.status, 404, '正常项目不得按不存在处理');
  });

  it('改编承接面：已删项目大纲相同亦不构成「已承接」——to-project 必须新建项目而非返回已删项目', async () => {
    // 独立用户隔离：FREE 配额按 activeCount 计（deleted 亦计入，见 docs 待拍板），共享用户会触限干扰断言
    mem._seedUser({ id: 'u_td1', level: 'FREE' });
    const outline = { logline: '外卖员逆袭成餐饮大王', direction: 'swap_persona', characters: [], mainline: 'm', arc: [], openingHook: 'h', endingPayoff: 'p', isolationNote: 'n' };
    await mem.teardownRecord.create({ data: { id: 'td_del', userId: 'u_td1', title: '拆解样本', outline, state: 'OUTLINED' } });
    // 已删项目：bible.adaptationDraft.recordId 指向该记录且大纲深等——修复前 matching 直接命中返回
    await mem.project.create({ data: { id: 'p_td_del', userId: 'u_td1', title: '已删改编项目', status: 'deleted', bible: { adaptationDraft: { recordId: 'td_del', brief: 'b', outline } } } });
    const r = await post('u_td1', '/api/teardown/td_del/to-project', { totalEps: 12 });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.project?.id, '必须返回项目');
    assert.notStrictEqual(j.project.id, 'p_td_del', '已删=不存在：不得把已删项目当改编落点返回（修复前 project.id===p_td_del）');
    assert.notStrictEqual(j.project.status, 'deleted', '返回的项目不得是已删态');
  });

  it('改编回归①：正常已承接项目（active+大纲深等）仍复用返回，不重复新建', async () => {
    mem._seedUser({ id: 'u_td2', level: 'FREE' });
    const outline = { logline: 'L', direction: 'flip_view', characters: [], mainline: 'm', arc: [], openingHook: 'h', endingPayoff: 'p', isolationNote: 'n' };
    await mem.teardownRecord.create({ data: { id: 'td_ok', userId: 'u_td2', title: '样本2', outline, state: 'OUTLINED' } });
    await mem.project.create({ data: { id: 'p_td_ok', userId: 'u_td2', title: '已承接项目', status: 'active', bible: { adaptationDraft: { recordId: 'td_ok', brief: 'b', outline } } } });
    const before = mem._projects.size;
    const r = await post('u_td2', '/api/teardown/td_ok/to-project', { totalEps: 12 });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.project.id, 'p_td_ok', '正常已承接项目必须复用返回（matching 语义不破）');
    assert.strictEqual(mem._projects.size, before, '不得重复新建项目');
  });

  it('改编回归②：无任何承接项目时正常新建（create 路径不破）', async () => {
    mem._seedUser({ id: 'u_td3', level: 'FREE' });
    const outline = { logline: 'L2', direction: 'swap_world', characters: [], mainline: 'm', arc: [], openingHook: 'h', endingPayoff: 'p', isolationNote: 'n' };
    await mem.teardownRecord.create({ data: { id: 'td_new', userId: 'u_td3', title: '样本3', outline, state: 'OUTLINED' } });
    const r = await post('u_td3', '/api/teardown/td_new/to-project', { totalEps: 12 });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.project?.id, '必须新建项目返回');
    const rec = mem._teardownRecords.find((x) => x.id === 'td_new');
    assert.strictEqual(rec.state, 'TO_PROJECT', '记录状态必须推进为 TO_PROJECT');
  });
});
