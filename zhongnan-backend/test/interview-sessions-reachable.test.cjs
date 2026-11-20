/**
 * v2.585 未完成采访必须始终可达。
 *
 * 背景（先证伪）：`GET /api/interview/sessions` 固定返回「最新更新 20 条」，前端恢复逻辑
 * 只在这 20 条里找 ACTIVE。用户连续新建/关闭超过 20 个会话后，更早的 ACTIVE 会话被挤出窗口：
 * 刷新页面即"丢失"未完成采访（实际仍在库里），用户无法继续回答，也无法生成简报。
 * 修复：响应始终并入「最近一个 ACTIVE」会话（已在窗口内则不重复），前端零改动即恢复正常。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-reach-secret';
process.env.JWT_REFRESH_SECRET = 'iv-reach-refresh';
const { createApp } = require('../dist/server/app.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ interview: createInterviewRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u_iv', phone: '13700002222' });
const H = { Authorization: `Bearer ${signAccess({ sub: 'u_iv', level: 'PRO' })}` };
const listSessions = async () => (await (await fetch(base + '/api/interview/sessions', { headers: H })).json()).sessions;

describe('采访会话可达性（v2.585）', { concurrency: 1 }, () => {
  it('未完成（ACTIVE）会话被挤出最新 20 条时，列表仍必须包含它且排在首位', async () => {
    const active = await mem.interviewSession.create({
      data: { userId: 'u_iv', title: '未完成采访', status: 'ACTIVE', updatedAt: new Date(Date.now() - 40 * 86400000) },
    });
    for (let i = 0; i < 20; i++) {
      await mem.interviewSession.create({
        data: { userId: 'u_iv', title: `已归档${i}`, status: 'CONVERTED', updatedAt: new Date(Date.now() - i * 86400000) },
      });
    }
    const list = await listSessions();
    assert.ok(list.some((s) => s.id === active.id), '被挤出窗口的 ACTIVE 会话必须仍在返回列表中');
    assert.strictEqual(list[0].id, active.id, 'ACTIVE 会话应排首位，前端优先恢复');
    assert.strictEqual(list.filter((s) => s.id === active.id).length, 1, '不得重复出现');
  });

  it('ACTIVE 已在最新 20 条内时不得重复插入', async () => {
    await mem.interviewSession.create({
      data: { userId: 'u_iv', title: '新未完成采访', status: 'ACTIVE', updatedAt: new Date() },
    });
    const list = await listSessions();
    const actives = list.filter((s) => s.status === 'ACTIVE');
    assert.strictEqual(actives.length, 1, '窗口内已有 ACTIVE 时不得再插入同一条');
    assert.strictEqual(new Set(list.map((s) => s.id)).size, list.length, '列表 id 不得重复');
  });

  it('别人的 ACTIVE 会话不得混入（账号隔离）', async () => {
    mem._seedUser({ id: 'u_other', phone: '13700003333' });
    const other = await mem.interviewSession.create({
      data: { userId: 'u_other', title: '他人未完成', status: 'ACTIVE', updatedAt: new Date(Date.now() - 60 * 86400000) },
    });
    const list = await listSessions();
    assert.ok(!list.some((s) => s.id === other.id), '查询必须限定当前账号');
  });
});
