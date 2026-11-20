/**
 * v2.577 采访简报归档写库失败的留痕。
 * 旧实现 `.catch(() => ({ count: 0 }))` 把数据库错误当成普通「并发已改变」：
 * brief 响应说 ready=true 但会话仍是 ACTIVE，服务端零日志，用户与运维都无从判断是并发还是故障。
 * 现要求：响应仍 200 且 status 如实返回原状态（不谎报已转换），但必须落 `[interview.brief]` 日志。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-obs-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'iv-obs-refresh-0123456789';
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

mem._seedUser({ id: 'obs', balance: 500 });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'obs', level: 'BASIC' })}` };
const post = (p, b) => fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(b) });

describe('采访简报归档失败留痕（v2.577）', { concurrency: 1 }, () => {
  it('updateMany 抛错：响应 200 且 status 如实为 ACTIVE，并落 [interview.brief] 日志', async () => {
    const o = await post('/api/interview/sessions', {
      idea: '被辞退的女厨师想夺回自己的餐厅，但前合伙人处处阻挠打压她', clientToken: 'obs-open',
    });
    assert.strictEqual(o.status, 200);
    const sid = (await o.json()).sessionId;
    await post(`/api/interview/sessions/${sid}/turn`, {
      text: '她决定用旧账本证明前合伙人违规操作，但对手处处阻挠打压她',
    });

    const orig = mem.interviewSession.updateMany.bind(mem.interviewSession);
    mem.interviewSession.updateMany = async () => { throw new Error('db down'); };
    const logs = [];
    const origErr = console.error;
    console.error = (...a) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };

    let r;
    try {
      r = await post(`/api/interview/sessions/${sid}/brief`, {});
    } finally {
      console.error = origErr;
      mem.interviewSession.updateMany = orig;
    }

    assert.strictEqual(r.status, 200, '写库失败不应把已可用的简报变成 500');
    const j = await r.json();
    assert.strictEqual(j.ready, true);
    assert.strictEqual(j.status, 'ACTIVE', '未能转 CONVERTED 时必须如实返回，不得谎报');
    const hit = logs.find((l) => l.includes('[interview.brief]'));
    assert.ok(hit, `必须落 [interview.brief] 日志，实际：${logs.join(' | ')}`);
    assert.ok(hit.includes(sid), '日志需带 sessionId 才能对账重试');
    assert.ok(hit.includes('db down'), '日志需带原始错误');
    // 状态确实没有被改成 CONVERTED（避免「日志打了、状态也改了」的自相矛盾）
    assert.strictEqual(mem._interviewSessions.find((x) => x.id === sid).status, 'ACTIVE');
  });

  it('正常路径仍转 CONVERTED（留痕改造不影响归档）', async () => {
    const o = await post('/api/interview/sessions', {
      idea: '卧底警察被迫在自己的案子里当嫌疑人，而唯一证人是他要抓的人', clientToken: 'obs-open-2',
    });
    const sid = (await o.json()).sessionId;
    await post(`/api/interview/sessions/${sid}/turn`, {
      text: '他必须在洗清自己和抓捕唯一证人之间做选择，但对手处处阻挠打压他',
    });
    const r = await post(`/api/interview/sessions/${sid}/brief`, {});
    const j = await r.json();
    assert.strictEqual(j.status, 'CONVERTED');
    assert.strictEqual(mem._interviewSessions.find((x) => x.id === sid).status, 'CONVERTED');
  });
});
