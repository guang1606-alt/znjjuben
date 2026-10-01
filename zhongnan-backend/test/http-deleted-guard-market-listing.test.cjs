/**
 * v2.297 守卫：软删除穿透补漏（交易市场「新增上架入口」面——resolveScript 同族漏网）。
 *
 * 缺口（修复前实证）：
 *  market.ts resolveScript（/listings 与 /listings/value-preview 共用的剧本解析入口）——
 *    script findFirst include project 后只查归属、不查 project.status：项目软删只改
 *    project.status='deleted'、scripts 原样保留，于是已删项目的剧本仍可被解析命中——
 *    卖家可把「已删项目」新上架到交易广场（POST /listings 正常落 listing），
 *    也可对已删项目生成上架前价值预览（POST /listings/value-preview 正常 200）。
 *    「已删=不存在」既定语义下，已删项目不得进入任何新增交易入口。
 *  （边界：存量已删 listing 仍在架可购属 docs 待拍板项，本守卫不动存量查询/购买面。）
 *
 * 修复：resolveScript 命中后统一判定 project.status==='deleted' → 按不存在返回 null；
 *  两个调用点（上架/价值预览）同根同治，最小修复面。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'del-market-test-secret';
process.env.JWT_REFRESH_SECRET = 'del-market-test-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const H = (uid, level = 'BASIC') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const post = (uid, path, body, level = 'BASIC') => fetch(base + path, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body ?? {}) });

describe('v2.297 软删除穿透补漏（市场新增上架入口面）', { concurrency: 1 }, () => {
  it('上架面：已删项目传 scriptId → POST /listings 404，且不落 listing 记录', async () => {
    mem._seedUser({ id: 'u_mk', level: 'BASIC' });
    await mem.project.create({ data: { id: 'p_mk_del', userId: 'u_mk', title: '已删待售项目', status: 'deleted', tags: [] } });
    await mem.script.create({ data: { id: 's_mk_del', projectId: 'p_mk_del', epNo: 1, title: '第1集', content: '已删项目的剧本正文' } });
    const before0 = mem._listings.length;
    const r = await post('u_mk', '/api/market/listings', { scriptId: 's_mk_del', priceFen: 1000 });
    assert.strictEqual(r.status, 404, '已删=不存在：已删项目不得新上架（修复前穿透落 listing）');
    assert.strictEqual(mem._listings.length, before0, '已删项目不得落任何 listing 记录');
  });

  it('上架面：已删项目传 projectId（解析路径②）→ POST /listings 同样 404', async () => {
    const r = await post('u_mk', '/api/market/listings', { projectId: 'p_mk_del', priceFen: 1000 });
    assert.strictEqual(r.status, 404, 'projectId 入参路径同根同洞，必须同治');
  });

  it('价值预览面：已删项目 POST /listings/value-preview → 按不存在拒绝（不得 200 出价值证书）', async () => {
    const r = await post('u_mk', '/api/market/listings/value-preview', { scriptId: 's_mk_del' });
    assert.ok(r.status === 400 || r.status === 404, `已删项目不得生成上架前价值预览（修复前 200）；实际 ${r.status}`);
  });

  it('回归①：正常项目上架不被误杀——200 且落 listing（佣金按 BASIC 15%）', async () => {
    await mem.project.create({ data: { id: 'p_mk_ok', userId: 'u_mk', title: '正常待售项目', status: 'active', tags: ['都市'] } });
    await mem.script.create({ data: { id: 's_mk_ok', projectId: 'p_mk_ok', epNo: 1, title: '第1集', content: '正常项目的剧本正文，足够生成价值评估。'.repeat(20) } });
    const r = await post('u_mk', '/api/market/listings', { scriptId: 's_mk_ok', priceFen: 1000 });
    assert.strictEqual(r.status, 200, `正常项目不得按不存在处理；实际 ${r.status}`);
    const j = await r.json();
    assert.ok(j.ok && j.id, '必须返回新 listing id');
    assert.strictEqual(j.commissionPct, 15, 'BASIC 佣金 15% 不得被改动');
  });

  it('回归②：正常项目价值预览不被误杀；他人项目仍 403（归属闸次序不受影响）', async () => {
    const r1 = await post('u_mk', '/api/market/listings/value-preview', { scriptId: 's_mk_ok' });
    assert.strictEqual(r1.status, 200, '正常项目价值预览不得被误杀');
    mem._seedUser({ id: 'u_mk2', level: 'BASIC' });
    const r2 = await post('u_mk2', '/api/market/listings', { scriptId: 's_mk_ok', priceFen: 1000 });
    assert.strictEqual(r2.status, 403, '归属闸不得受 status 判定影响：他人项目仍 403');
  });
});
