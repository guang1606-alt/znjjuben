const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/services/generation-service.js');
const { InMemoryTx } = require('../dist/lib/memory-tx.js');
const L = require('../dist/config/pricing.js');

const okGen = async () => ({ content: '第1集\n\n场景：清晨的面馆，热气蒸腾。\n林晚（低声）：来了？', wordCount: 900, costFen: 50, tokensIn: 100, tokensOut: 200 });
const passQc = () => ({ pass: true });

function deps({ users, gen = okGen, qc = passQc, consent = async () => true } = {}) {
  const tx = new InMemoryTx();
  return {
    tx,
    getUser: async (id) => users[id] ?? null,
    hasMatureConsent: consent,
    generator: gen,
    qc,
  };
}
const U = { free: { id: 'u', level: L.MemberLevel.FREE, banned: false }, pro: { id: 'p', level: L.MemberLevel.PRO, banned: false }, banned: { id: 'b', level: L.MemberLevel.PRO, banned: true } };

test('成功路径：冻结→生成质检→结算，余额正确扣减且无残留冻结', async () => {
  const d = deps({ users: { u: U.free } });
  d.tx.seed('u', 1000);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't1' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.pointsCharged, 100);
  const dump = d.tx.dump('u');
  assert.strictEqual(dump.account.balance, 900);
  assert.strictEqual(dump.account.frozen, 0);
  assert.deepStrictEqual(dump.ledger.map((x) => x.direction), ['FROZEN', 'OUT']);
});

test('积分不足：拒绝且不调用生成器', async () => {
  let called = false;
  const d = deps({ users: { u: U.free }, gen: async () => { called = true; return okGen(); } });
  d.tx.seed('u', 50);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't2' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'INSUFFICIENT');
  assert.strictEqual(called, false);
});

test('用户不存在/被封禁拦截', async () => {
  const d1 = deps({ users: {} });
  assert.strictEqual((await S.runGeneration(d1, { userId: 'x', modeId: 'tag', chargePoints: 1, idem: 'a' })).code, 'USER_NOT_FOUND');
  const d2 = deps({ users: { b: U.banned } });
  assert.strictEqual((await S.runGeneration(d2, { userId: 'b', modeId: 'tag', chargePoints: 1, idem: 'b' })).code, 'USER_BANNED');
});

test('等级不足模式锁定（FREE 用热点追更）', async () => {
  const d = deps({ users: { u: U.free } });
  d.tx.seed('u', 1000);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'hotspot', chargePoints: 100, idem: 't3' });
  assert.strictEqual(r.code, 'MODE_LOCKED');
});

test('成年向模式：PRO但无授权被拦，不扣积分', async () => {
  const d = deps({ users: { p: U.pro }, consent: async () => false });
  d.tx.seed('p', 1000);
  const r = await S.runGeneration(d, { userId: 'p', modeId: 'mature_x', chargePoints: 100, idem: 't4' });
  assert.strictEqual(r.code, 'MATURE_CONSENT_REQUIRED');
  assert.strictEqual(d.tx.dump('p').account.balance, 1000);
});

test('生成器抛错：全额退款，余额复原、冻结清零', async () => {
  const d = deps({ users: { u: U.free }, gen: async () => { throw new Error('MODEL_HTTP_500'); } });
  d.tx.seed('u', 1000);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't5' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'GEN_FAILED');
  assert.strictEqual(r.refundedPoints, 100);
  const dump = d.tx.dump('u');
  assert.strictEqual(dump.account.balance, 1000);
  assert.strictEqual(dump.account.frozen, 0);
  assert.deepStrictEqual(dump.ledger.map((x) => x.direction), ['FROZEN', 'UNFROZEN']);
});

test('质检不过：QC_FAILED 并退款', async () => {
  const d = deps({ users: { u: U.free }, qc: () => ({ pass: false, errors: ['字数不足'] }) });
  d.tx.seed('u', 1000);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't6' });
  assert.strictEqual(r.code, 'QC_FAILED');
  assert.strictEqual(d.tx.dump('u').account.balance, 1000);
});

test('售价覆盖不了成本×2：NO_MARGIN 熔断并退款（不做亏本生意）', async () => {
  // chargePoints=100 → 售价1000分；成本600分 → 2×600=1200>1000 熔断
  const d = deps({ users: { u: U.free }, gen: async () => ({ content: 'x'.repeat(900), wordCount: 900, costFen: 600, tokensIn: 0, tokensOut: 0 }) });
  d.tx.seed('u', 1000);
  const r = await S.runGeneration(d, { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't7' });
  assert.strictEqual(r.code, 'NO_MARGIN');
  assert.strictEqual(d.tx.dump('u').account.balance, 1000);
});

test('幂等：同一任务重复结算不重复扣积分', async () => {
  const d = deps({ users: { u: U.free } });
  d.tx.seed('u', 1000);
  const req = { userId: 'u', modeId: 'tag', chargePoints: 100, idem: 't8' };
  await S.runGeneration(d, req);
  await S.runGeneration(d, req);
  assert.strictEqual(d.tx.dump('u').account.balance, 900);
});
