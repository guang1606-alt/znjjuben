const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'va-lb-secret';
process.env.JWT_REFRESH_SECRET = 'va-lb-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
// 记录战力榜对 user 表的查询参数：全表拉取（含手机号/密码哈希）是不必要的越权读取
let userQuery = null;
const rawUserModel = mem.user;
mem.user = { ...rawUserModel, findMany(args) { userQuery = args; return rawUserModel.findMany(args); } };
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const H = (uid) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });

describe('PK 战力榜：取数最小化与失败收口', { concurrency: 1 }, () => {
  it('只按上榜者 id 取 id/笔名/昵称三列，不再把全表用户读进内存', async () => {
    mem._seedUser({ id: 'lb1', penName: '甲' });
    mem._seedUser({ id: 'lb2', penName: '乙' });
    mem._seedUser({ id: 'lb3', penName: '丙' }); // 从未参战，不应被查询
    mem._pkBattles.push({ id: 'b1', userId: 'lb1', createdAt: new Date(Date.now() - 2000), result: { structured: { totalA: 78, winner: 'A' } }, pointsCost: 20 });
    mem._pkBattles.push({ id: 'b2', userId: 'lb1', createdAt: new Date(Date.now() - 1000), result: { structured: { totalA: 88, winner: 'A' } }, pointsCost: 20 });

    const r = await fetch(base + '/api/va/pk/leaderboard', { headers: H('lb1') });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.board.top[0].displayName, '甲');

    assert.ok(userQuery, '战力榜应查询用户笔名');
    assert.ok(userQuery.select, '必须用 select 限定列，禁止回传整行用户');
    assert.deepStrictEqual(Object.keys(userQuery.select).sort(), ['id', 'nickname', 'penName']);
    assert.ok(!('passwordHash' in userQuery.select), '密码哈希绝不能被战力榜读出');
    assert.ok(Array.isArray(userQuery.where?.id?.in), '应按上榜者 id 过滤');
    assert.ok(userQuery.where.id.in.includes('lb1'));
    assert.ok(!userQuery.where.id.in.includes('lb3'), '未上榜用户不应进入查询集合');
  });

  it('数据库异常：500 INTERNAL_ERROR，不把内部报文当 400 业务错误回给前端', async () => {
    const origPk = mem.pkBattle;
    mem.pkBattle = {
      ...origPk,
      findMany: async () => { throw new Error('PrismaClientKnownRequestError: connection refused at 10.0.0.5:5432'); },
    };
    try {
      const r = await fetch(base + '/api/va/pk/leaderboard', { headers: H('lb1') });
      assert.strictEqual(r.status, 500);
      const j = await r.json();
      assert.strictEqual(j.error, 'INTERNAL_ERROR');
      assert.ok(!/PrismaClient|connection refused/.test(JSON.stringify(j)), '内部报文不得外泄');
    } finally {
      mem.pkBattle = origPk;
    }
  });
});
