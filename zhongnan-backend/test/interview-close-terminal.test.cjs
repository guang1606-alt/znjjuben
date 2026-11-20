/**
 * v2.578 采访会话「关闭」不得打回已归档终态。
 * 旧实现 close 无条件写 status=CLOSED：
 *  · 已转 CONVERTED（已生成简报）的会话被关闭后退回 CLOSED——前端把 CLOSED 当非终态，
 *    刷新后「生成简报」按钮复活，用户会以为简报丢了、甚至重复生成；
 *  · 关闭是幂等操作，重复关闭不应产生额外写。
 * 现只允许 ACTIVE → CLOSED；其余状态原样返回真实 status。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-close-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'iv-close-refresh-0123456789';
const { createApp } = require('../dist/server/app.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ interview: createInterviewRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'closer', balance: 500 });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'closer', level: 'BASIC' })}` };
const post = (p, b) => fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const raw = (id) => mem._interviewSessions.find((x) => x.id === id);

async function openReady() {
  const o = await post('/api/interview/sessions', {
    idea: '被辞退的女厨师想夺回自己的餐厅，但前合伙人处处阻挠打压她', clientToken: `c-${Math.random()}`,
  });
  const sid = (await o.json()).sessionId;
  await post(`/api/interview/sessions/${sid}/turn`, { text: '她决定用旧账本证明前合伙人违规操作，但对手处处阻挠打压她' });
  return sid;
}

describe('采访会话关闭·终态保护（v2.578）', { concurrency: 1 }, () => {
  it('已 CONVERTED 的会话再关闭：保持 CONVERTED，不退回 CLOSED', async () => {
    const sid = await openReady();
    const b = await post(`/api/interview/sessions/${sid}/brief`, {});
    assert.strictEqual((await b.json()).status, 'CONVERTED');
    const c = await post(`/api/interview/sessions/${sid}/close`, {});
    assert.strictEqual(c.status, 200);
    assert.strictEqual((await c.json()).status, 'CONVERTED', '关闭不得把已归档会话打回非终态');
    assert.strictEqual(raw(sid).status, 'CONVERTED');
  });

  it('ACTIVE 会话关闭一次转 CLOSED；重复关闭仍 CLOSED（幂等）', async () => {
    const sid = await openReady();
    const c1 = await post(`/api/interview/sessions/${sid}/close`, {});
    assert.strictEqual((await c1.json()).status, 'CLOSED');
    assert.strictEqual(raw(sid).status, 'CLOSED');
    const c2 = await post(`/api/interview/sessions/${sid}/close`, {});
    assert.strictEqual((await c2.json()).status, 'CLOSED');
    assert.strictEqual(raw(sid).status, 'CLOSED');
  });

  it('关闭后简报仍可正常生成并转 CONVERTED（CLOSED 不是死路）', async () => {
    const sid = await openReady();
    await post(`/api/interview/sessions/${sid}/close`, {});
    const b = await post(`/api/interview/sessions/${sid}/brief`, {});
    assert.strictEqual((await b.json()).status, 'CONVERTED');
  });
});
