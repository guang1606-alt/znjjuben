const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-race-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'iv-race-refresh-0123456789';
const { createApp } = require('../dist/server/app.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 沙盘隔离：无供应商 → 确定性兜底引擎
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ interview: createInterviewRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'racer', balance: 500 });
mem._seedUser({ id: 'dbl', balance: 500 });
mem._seedUser({ id: 'seq', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b) });
const bal = (uid) => mem._accounts.get(uid).balance;
const FEE = 5; // INTERVIEW_TURN 单轮积分

const IDEA = '被辞退的女厨师想夺回自己的餐厅，但前合伙人在处处打压她';
const ANS_A = '她的目标是夺回餐厅经营权，对手是前合伙人，代价是可能失去女儿抚养权，计划是找到旧账本';
const ANS_B = '另一条补充：她还要面对婆婆的阻挠，决定先去后厨收集证据，反抗到底绝不认输';

/**
 * 冻结会话读快照：frozen 期间 findUnique 恒返回同一快照行（模拟两个在途请求基于同一旧快照）。
 * 写入（update/updateMany）仍走真实内存存储 —— 与 v2.309 join 竞态同一确定性复现手法。
 */
function freezeOn(snapshot) {
  const orig = mem.interviewSession.findUnique.bind(mem.interviewSession);
  mem.interviewSession.findUnique = async ({ where }) =>
    snapshot && where.id === snapshot.id ? snapshot : orig({ where });
  return () => { mem.interviewSession.findUnique = orig; };
}
const rawSession = (id) => mem._interviewSessions.find((x) => x.id === id);

describe('采访轮次·并发覆盖防护（v2.310）', { concurrency: 1 }, () => {
  it('同会话两条不同回答在途：败者退款 409，胜者轮次不被覆盖', async () => {
    const o = await post('/api/interview/sessions', { idea: IDEA, clientToken: 'race-open' }, 'racer');
    assert.strictEqual(o.status, 200);
    const oj = await o.json();
    const sid = oj.sessionId;
    const afterOpen = bal('racer');

    // 两个在途请求共同的旧快照（turnCount=1）；A 先落库后存储已到 2，B 读到的仍是 1
    const snap1 = structuredClone(rawSession(sid));
    const unfreeze = freezeOn(snap1);

    const rA = await post(`/api/interview/sessions/${sid}/turn`, { text: ANS_A }, 'racer');
    assert.strictEqual(rA.status, 200); // 胜者正常落库
    const rB = await post(`/api/interview/sessions/${sid}/turn`, { text: ANS_B }, 'racer');
    unfreeze();
    assert.strictEqual(rB.status, 409); // 旧实现：200 且覆盖 A —— 咬红点
    const bj = await rB.json();
    assert.strictEqual(bj.error, 'IDEMPOTENT_REPLAY');

    const saved = rawSession(sid);
    assert.strictEqual(saved.turnCount, 2);
    assert.strictEqual(saved.transcript.length, 2);
    assert.strictEqual(saved.transcript[1].a, ANS_A.slice(0, 4000)); // A 的回答不被 B 顶掉

    // 资金：open 后只再净扣一轮（B 已收→退），旧实现会双扣 10
    assert.strictEqual(bal('racer'), afterOpen - FEE);
  });

  it('同文本双击：既有 5 分钟窗幂等不回归（第二击 409、不重复扣费）', async () => {
    const o = await post('/api/interview/sessions', { idea: IDEA, clientToken: 'dbl-open' }, 'dbl');
    const oj = await o.json();
    const afterOpen = bal('dbl');
    const r1 = await post(`/api/interview/sessions/${oj.sessionId}/turn`, { text: ANS_A }, 'dbl');
    assert.strictEqual(r1.status, 200);
    const r2 = await post(`/api/interview/sessions/${oj.sessionId}/turn`, { text: ANS_A }, 'dbl');
    assert.strictEqual(r2.status, 409);
    assert.strictEqual(bal('dbl'), afterOpen - FEE);
  });

  it('正常顺序多轮：条件更新连续命中，turnCount/transcript 正常递增', async () => {
    const o = await post('/api/interview/sessions', { idea: IDEA, clientToken: 'seq-open' }, 'seq');
    const oj = await o.json();
    const sid = oj.sessionId;
    for (const t of [ANS_A, ANS_B, '最后她用账本在关键时刻反转局面，赢回餐厅也修复了家庭关系，集数约二十集']) {
      const r = await post(`/api/interview/sessions/${sid}/turn`, { text: t }, 'seq');
      assert.strictEqual(r.status, 200);
    }
    const saved = rawSession(sid);
    assert.strictEqual(saved.turnCount, 4);
    assert.strictEqual(saved.transcript.length, 4);
    assert.ok(saved.transcript[3].a.includes('反转局面'));
  });
});
