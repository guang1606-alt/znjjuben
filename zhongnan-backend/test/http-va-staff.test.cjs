const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'va-test-secret';
process.env.JWT_REFRESH_SECRET = 'va-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const P = require('../dist/config/pricing.js');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const { SUPER_ADMIN_PHONE } = require('../dist/middleware/admin.js');
const MP = require('../dist/lib/model-proxy.js');

function seedUser(id, { level = 'FREE', balance = 0, isAdmin = false, phone } = {}) {
  mem._seedUser({ id, level, balance, isAdmin, phone });
}
function auth(id, level = 'FREE') {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: id, level })}` };
}
function seedProject(id, userId, extra = {}) {
  mem._projects.set(id, { id, userId, bible: null, tags: [], title: `本_${id}`, format: 'LIVE', ...extra });
}
function seedScript(projectId, epNo = 1, n = 20) {
  const content = Array.from({ length: n }, (_, i) => `第${i + 1}场，人物冲突激烈、对白饱满、动作明确的剧本正文内容。`).join('\n');
  const row = { id: `sc_${projectId}_${epNo}`, projectId, epNo, version: 1, title: 't', wordCount: 600, content, score: 80 };
  mem._scripts.push(row);
  return row;
}
function staffLedgers(uid) {
  return mem._ledgers.filter((l) => l.userId === uid && l.reason === 'STAFF_FREE' && l.amount === 0 && l.direction === 'OUT');
}

describe('增值服务内部账户免费通道（/api/va，串行）', { concurrency: 1 }, () => {
  it('小南深度共创：副管理员 FREE 零余额 200、points=0、staff=true、留 0 元 STAFF_FREE 流水', async () => {
    const uid = 'va_staff1';
    seedUser(uid, { level: 'FREE', balance: 0, isAdmin: true });
    const orig = MP.callText; MP.callText = async () => ({ text: '小南：这样设计钩子更好。', costFen: 0 });
    try {
      const r = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body: JSON.stringify({ question: '第一集怎么留住观众？' }) });
      assert.strictEqual(r.status, 200);
      const j = await r.json();
      assert.strictEqual(j.staff, true);
      assert.strictEqual(j.points, 0);
      assert.strictEqual(mem._accounts.get(uid).balance, 0);
      assert.ok(staffLedgers(uid).length === 1, '一笔 0 元 STAFF_FREE 审计流水');
    } finally { MP.callText = orig; }
  });

  it('小南深度共创：超管手机号硬命中（isAdmin=false）同样免费', async () => {
    const uid = 'va_super2';
    seedUser(uid, { level: 'FREE', balance: 0, isAdmin: false, phone: SUPER_ADMIN_PHONE });
    const orig = MP.callText; MP.callText = async () => ({ text: 'ok', costFen: 0 });
    try {
      const r = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body: JSON.stringify({ question: '测试' }) });
      assert.strictEqual(r.status, 200);
      const j = await r.json();
      assert.strictEqual(j.staff, true);
      assert.strictEqual(j.points, 0);
    } finally { MP.callText = orig; }
  });

  it('幂等：staff 同参数 5 分钟窗内重放 409，不重复服务/不重复落流水', async () => {
    const uid = 'va_staff3';
    seedUser(uid, { level: 'FREE', balance: 0, isAdmin: true });
    let calls = 0;
    const orig = MP.callText; MP.callText = async () => { calls++; return { text: '答', costFen: 0 }; };
    try {
      const body = JSON.stringify({ question: '同一个问题原样重放' });
      const r1 = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body });
      assert.strictEqual(r1.status, 200);
      const r2 = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body });
      assert.strictEqual(r2.status, 409);
      assert.strictEqual(calls, 1, '重放不得再次调用模型');
      assert.strictEqual(staffLedgers(uid).length, 1);
    } finally { MP.callText = orig; }
  });

  it('普通 FREE 零余额用小南深度共创：仍报积分不足（付费链路不回归）', async () => {
    const uid = 'va_plain4';
    seedUser(uid, { level: 'FREE', balance: 0 });
    const orig = MP.callText; MP.callText = async () => { throw new Error('模型不应被调用'); };
    try {
      const r = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body: JSON.stringify({ question: 'x' }) });
      assert.strictEqual(r.status, 400);
      const j = await r.json();
      assert.ok(/积分不足/.test(j.error || ''));
    } finally { MP.callText = orig; }
  });

  it('剧本海报：staff 零余额出图、points=0、落库 pointsCost=0；普通用户同档照价扣', async () => {
    const uidS = 'va_staff5'; seedUser(uidS, { level: 'FREE', balance: 0, isAdmin: true });
    seedProject('p_va5s', uidS);
    const uidP = 'va_plain5'; seedUser(uidP, { level: 'PRO', balance: 1000 });
    seedProject('p_va5p', uidP);
    const origImg = MP.callImage;
    MP.callImage = async () => ({ images: ['http://example.invalid/a.png', 'http://example.invalid/b.png', 'http://example.invalid/c.png', 'http://example.invalid/d.png'], costFen: 5 });
    try {
      const rs = await fetch(base + '/api/va/poster', { method: 'POST', headers: auth(uidS), body: JSON.stringify({ projectId: 'p_va5s', tier: 'STANDARD' }) });
      assert.strictEqual(rs.status, 200);
      const js = await rs.json();
      assert.strictEqual(js.staff, true);
      assert.strictEqual(js.points, 0);
      assert.strictEqual(mem._posters.at(-1).pointsCost, 0);
      assert.strictEqual(mem._accounts.get(uidS).balance, 0);
      assert.ok(staffLedgers(uidS).length === 1);

      const price = P.VALUE_ADDED.POSTER_STANDARD.points;
      assert.ok(price > 0);
      const rp = await fetch(base + '/api/va/poster', { method: 'POST', headers: auth(uidP, 'PRO'), body: JSON.stringify({ projectId: 'p_va5p', tier: 'STANDARD' }) });
      assert.strictEqual(rp.status, 200);
      const jp = await rp.json();
      assert.ok(!jp.staff);
      assert.strictEqual(jp.points, price);
      assert.strictEqual(mem._accounts.get(uidP).balance, 1000 - price);
    } finally { MP.callImage = origImg; }
  });

  it('剧本 PK：staff 零余额可打、battle.pointsCost=0；普通用户扣 20 分', async () => {
    const uidS = 'va_staff6'; seedUser(uidS, { level: 'FREE', balance: 0, isAdmin: true });
    seedProject('p_va6s', uidS); seedScript('p_va6s');
    const rs = await fetch(base + '/api/va/pk', { method: 'POST', headers: auth(uidS), body: JSON.stringify({ projectAId: 'p_va6s' }) });
    assert.strictEqual(rs.status, 200);
    const js = await rs.json();
    assert.strictEqual(js.staff, true);
    assert.strictEqual(js.points, 0);
    assert.strictEqual(mem._pkBattles.at(-1).pointsCost, 0);
    assert.strictEqual(mem._accounts.get(uidS).balance, 0);
    assert.ok(staffLedgers(uidS).length === 1);

    const uidP = 'va_plain6'; seedUser(uidP, { level: 'PRO', balance: 1000 });
    seedProject('p_va6p', uidP); seedScript('p_va6p');
    const rp = await fetch(base + '/api/va/pk', { method: 'POST', headers: auth(uidP, 'PRO'), body: JSON.stringify({ projectAId: 'p_va6p' }) });
    assert.strictEqual(rp.status, 200);
    const jp = await rp.json();
    assert.strictEqual(jp.points, P.VALUE_ADDED.PK_BATTLE.points);
    assert.strictEqual(mem._accounts.get(uidP).balance, 1000 - P.VALUE_ADDED.PK_BATTLE.points);
  });

  it('staff 下游失败：写 0 元 REFUND 后同请求可再次提交（与付费退款同构）', async () => {
    const uid = 'va_staff7'; seedUser(uid, { level: 'FREE', balance: 0, isAdmin: true });
    let n = 0;
    const orig = MP.callText;
    MP.callText = async () => { n++; if (n === 1) throw new Error('MODEL_DOWN'); return { text: '重试成功', costFen: 0 }; };
    try {
      const body = JSON.stringify({ question: '失败后重试同一问题' });
      const r1 = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body });
      assert.strictEqual(r1.status, 400);
      const r2 = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: auth(uid), body });
      assert.strictEqual(r2.status, 200, '0 元退款后同 refId 允许重试');
      const j = await r2.json();
      assert.strictEqual(j.points, 0);
      assert.strictEqual(n, 2);
      const outs = staffLedgers(uid).length;
      const ins = mem._ledgers.filter((l) => l.userId === uid && l.reason === 'STAFF_FREE:REFUND' && l.amount === 0 && l.direction === 'IN').length;
      assert.strictEqual(outs, 2, '失败尝试一笔 + 重试成功一笔，共 2 条 0 元 OUT');
      assert.ok(ins >= 1, '留有 0 元 REFUND 流水');
    } finally { MP.callText = orig; }
  });
});
