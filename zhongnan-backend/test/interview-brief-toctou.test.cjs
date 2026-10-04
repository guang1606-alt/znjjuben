const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-race-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'iv-race-refresh-0123456789';
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

mem._seedUser({ id: 'toctou', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b) });

const rawSession = (id) => mem._interviewSessions.find((x) => x.id === id);

/**
 * 冻结会话读快照：模拟 brief 读取后、落库前 close 插入。
 */
function freezeOn(snapshot) {
  const orig = mem.interviewSession.findUnique.bind(mem.interviewSession);
  mem.interviewSession.findUnique = async ({ where }) =>
    snapshot && where.id === snapshot.id ? snapshot : orig({ where });
  return () => { mem.interviewSession.findUnique = orig; };
}

describe('采访简报·status 翻转 TOCTOU（v2.311）', { concurrency: 1 }, () => {
  it('brief 读快照后 close 插入：close 不被覆盖回 CONVERTED', async () => {
    // 创建 ACTIVE 会话（已有至少一轮回答，ready=true）
    const o = await post('/api/interview/sessions', {
      idea: '被辞退的女厨师想夺回自己的餐厅，但前合伙人处处阻挠打压她', clientToken: 'toctou-open',
    }, 'toctou');
    assert.strictEqual(o.status, 200);
    const sid = (await o.json()).sessionId;
    // 一轮回答，凑够素材让 ready=true（rawNotes 需含 conflict 信号词）
    await post(`/api/interview/sessions/${sid}/turn`, {
      text: '她决定用旧账本证明前合伙人违规操作，但对手处处阻挠打压她',
    }, 'toctou');

    // 冻结快照（status=ACTIVE）
    const snap = structuredClone(rawSession(sid));
    const unfreeze = freezeOn(snap);

    // close 先落库 → status 变为 CLOSED
    const rClose = await post(`/api/interview/sessions/${sid}/close`, {}, 'toctou');
    assert.strictEqual(rClose.status, 200);

    // brief 后落库：读的是旧快照认为 ACTIVE，旧实现会 update → CONVERTED 覆盖 CLOSED（咬红）
    const rBrief = await post(`/api/interview/sessions/${sid}/brief`, {}, 'toctou');
    unfreeze();
    assert.strictEqual(rBrief.status, 200);

    // 最终状态必须是 CLOSED，不能回退成 CONVERTED
    const saved = rawSession(sid);
    assert.strictEqual(saved.status, 'CLOSED', 'close 后 brief 不应覆盖回 CONVERTED（TOCTOU 咬红）');
  });
});
