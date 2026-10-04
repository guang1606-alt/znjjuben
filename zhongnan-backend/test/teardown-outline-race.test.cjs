const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // 隔离真实DB供应商池
process.env.JWT_ACCESS_SECRET = 'td-race-secret';
process.env.JWT_REFRESH_SECRET = 'td-race-refresh';
const { createApp } = require('../dist/server/app.js');
const { createTeardownRouter } = require('../dist/routes/teardown.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ teardown: createTeardownRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'tdracer', balance: 1000, level: 'BASIC' });
mem._seedUser({ id: 'tdseq', balance: 1000, level: 'BASIC' });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + '/api/teardown' + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b) });
const bal = (uid) => mem._accounts.get(uid).balance;

const HIT = `第1集
日 内 林家
她被婆家误会偷了项链，婆婆当众羞辱她、逼她净身出户，丈夫背叛她牵着第三者进门。她藏着自己是集团继承人的秘密，决定反击。
她（低声）：今天怎么赶我走，明天我怎么回来。
第2集
日 内 公司
她隐藏身份从保洁做起被嘲讽，谁知当场揭穿假账，第一次打脸众人震惊。
第3集
夜 内 宴会厅
反转不断，她霸气反杀逆袭碾压，真相大白完成清算，夺回一切释然成长。`;

const rawRecord = (id) => mem._teardownRecords.find((x) => x.id === id);

/**
 * 冻结记录读快照：frozen 期间 findUnique 恒返回同一快照行（模拟两个在途请求基于同一旧快照）。
 * 写入仍走真实内存存储——与 v2.309 join / v2.310 interview turn 竞态同一确定性复现手法。
 */
function freezeOn(snapshot) {
  const orig = mem.teardownRecord.findUnique.bind(mem.teardownRecord);
  mem.teardownRecord.findUnique = async ({ where }) =>
    snapshot && where.id === snapshot.id ? snapshot : orig({ where });
  return () => { mem.teardownRecord.findUnique = orig; };
}

describe('拆爆款改编大纲·并发覆盖防护（v2.312）', { concurrency: 1 }, () => {
  it('同记录两个不同方向在途：败者退款 409，胜者大纲不被覆盖、不双扣', async () => {
    const a = await post('/analyze', { sourceType: 'text', text: HIT }, 'tdracer');
    assert.strictEqual(a.status, 200);
    const aj = await a.json();
    const rid = aj.recordId;
    const afterAnalyze = bal('tdracer');

    // 两个在途请求共同的旧快照（direction=null，未生成过大纲）
    const snap = structuredClone(rawRecord(rid));
    const unfreeze = freezeOn(snap);

    const rA = await post(`/${rid}/outline`, { pickedTags: ['逆袭'], direction: 'swap_persona' }, 'tdracer');
    assert.strictEqual(rA.status, 200); // 胜者正常落库
    const rB = await post(`/${rid}/outline`, { pickedTags: ['复仇'], direction: 'flip_view' }, 'tdracer');
    unfreeze();

    assert.strictEqual(rB.status, 409); // 旧实现：200 且 outline 覆盖 A、双扣 20 —— 咬红点
    const bj = await rB.json();
    assert.strictEqual(bj.error, 'OUTLINE_RACE');

    const saved = rawRecord(rid);
    assert.strictEqual(saved.direction, 'swap_persona'); // 胜者方向不被 B 顶掉
    assert.ok(saved.outline && typeof saved.outline === 'object');

    // 资金：拆解后只再净扣一份大纲费 20（B 已收→退），旧实现双扣 40
    assert.strictEqual(bal('tdracer'), afterAnalyze - 20, `应只净扣一份大纲费（20），实际差额 ${afterAnalyze - bal('tdracer')}`);
  });

  it('串行改方向重生成：条件命中正常覆盖，余额正常再扣', async () => {
    const a = await post('/analyze', { sourceType: 'text', text: HIT }, 'tdseq');
    const aj = await a.json();
    const rid = aj.recordId;
    const r1 = await post(`/${rid}/outline`, { pickedTags: ['逆袭'], direction: 'swap_persona' }, 'tdseq');
    assert.strictEqual(r1.status, 200);
    const saved1 = rawRecord(rid);
    assert.strictEqual(saved1.direction, 'swap_persona');
    // 改方向重生成（合法产品语义：后写覆盖先写，串行无并发）
    const r2 = await post(`/${rid}/outline`, { pickedTags: ['复仇'], direction: 'flip_view' }, 'tdseq');
    assert.strictEqual(r2.status, 200);
    const saved2 = rawRecord(rid);
    assert.strictEqual(saved2.direction, 'flip_view');
  });
});
