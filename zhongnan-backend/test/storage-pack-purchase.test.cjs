/**
 * v2.575 存储扩容包购买闭环
 * 缺口：STORAGE_PACKS 已定价、海报 413 话术承诺「或扩容后重试」、/me 已按
 * User.extraStorageBytes 计算配额，但全仓没有任何购买入口——承诺无法兑现、字段永远为 0。
 * 本文件锁死：可查价、可购买、扣分与加配额同事务、重放不重复扣、失败不半扣。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'pack-secret';
process.env.JWT_REFRESH_SECRET = 'pack-refresh';
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => {
  const done = () => { base = `http://127.0.0.1:${server.address().port}`; res(); };
  if (server.listening) return done();
  server.once('listening', done);
}));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'buyer', balance: 1000 });
mem._seedUser({ id: 'poor', balance: 100 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}` });
const get = (p, uid) => fetch(base + p, { headers: H(uid) });
const post = (p, body, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(body) });
const bal = (uid) => mem._accounts.get(uid).balance;
const extra = (uid) => mem._users.get(uid).extraStorageBytes ?? 0;
const packLedgers = (uid) => mem._ledgers.filter((l) => l.userId === uid && l.reason === 'STORAGE_PACK');

describe('存储扩容包：查价 / 购买 / 幂等 / 原子性', { concurrency: 1 }, () => {
  it('GET /storage/packs：列出三档定价与当前用量，未登录 401', async () => {
    const r0 = await fetch(base + '/api/va/storage/packs');
    assert.strictEqual(r0.status, 401);
    const r = await get('/api/va/storage/packs', 'buyer');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.packs.length, 3);
    const p5 = j.packs.find((p) => p.id === 'pack_5g');
    assert.ok(p5, '应含 pack_5g');
    assert.strictEqual(p5.gb, 5);
    assert.strictEqual(p5.points, 199);
    assert.strictEqual(p5.bytes, 5 * GB);
    assert.strictEqual(j.usage.used, 0);
    assert.strictEqual(j.usage.quota, 100 * MB, '免费档基础配额 100MB');
  });

  it('购买 pack_5g：扣 199 积分、配额 +5GB，且 /me 同口径生效', async () => {
    const r = await post('/api/va/storage/buy', { packId: 'pack_5g', clientToken: 'buy-1' }, 'buyer');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.points, 199);
    assert.strictEqual(bal('buyer'), 801);
    assert.strictEqual(extra('buyer'), 5 * GB);
    assert.strictEqual(j.usage.quota, 100 * MB + 5 * GB, '返回的配额应含扩容');
    assert.strictEqual(packLedgers('buyer').length, 1, '应有一条 STORAGE_PACK 扣费流水');
    assert.strictEqual(packLedgers('buyer')[0].amount, 199);
  });

  it('同一 clientToken 重放：409 且不再扣分、不重复加配额', async () => {
    const r = await post('/api/va/storage/buy', { packId: 'pack_5g', clientToken: 'buy-1' }, 'buyer');
    assert.strictEqual(r.status, 409);
    const j = await r.json();
    assert.strictEqual(j.error, 'IDEMPOTENT_REPLAY');
    assert.strictEqual(bal('buyer'), 801);
    assert.strictEqual(extra('buyer'), 5 * GB);
    assert.strictEqual(packLedgers('buyer').length, 1);
  });

  it('换新令牌可再次购买同等扩容包（累计叠加）', async () => {
    const r = await post('/api/va/storage/buy', { packId: 'pack_5g', clientToken: 'buy-2' }, 'buyer');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(bal('buyer'), 602);
    assert.strictEqual(extra('buyer'), 10 * GB);
  });

  it('积分不足：400 中文提示，余额与配额均不变', async () => {
    const r = await post('/api/va/storage/buy', { packId: 'pack_100g', clientToken: 'poor-1' }, 'poor');
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.match(j.error, /积分不足/);
    assert.strictEqual(bal('poor'), 100);
    assert.strictEqual(extra('poor'), 0);
    assert.strictEqual(packLedgers('poor').length, 0);
  });

  it('非法 packId：400 且不扣分', async () => {
    const r = await post('/api/va/storage/buy', { packId: 'pack_999g', clientToken: 'bad-1' }, 'buyer');
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.strictEqual(j.error, 'INVALID_PACK');
    assert.strictEqual(bal('buyer'), 602);
    assert.strictEqual(extra('buyer'), 10 * GB);
  });

  it('加配额写库失败：整笔回滚——不扣分、不出流水、不半加配额', async () => {
    const orig = mem.user.update;
    let thrown = false;
    mem.user.update = async (...args) => {
      if (!thrown && args[0]?.data?.extraStorageBytes) { thrown = true; throw new Error('DB_WRITE_FAULT'); }
      return orig(...args);
    };
    try {
      const r = await post('/api/va/storage/buy', { packId: 'pack_20g', clientToken: 'atomic-1' }, 'buyer');
      assert.strictEqual(r.status, 500);
      assert.strictEqual(thrown, true, '故障注入应命中');
      assert.strictEqual(bal('buyer'), 602, '扣费必须随事务回滚');
      assert.strictEqual(extra('buyer'), 10 * GB, '配额不得半加');
      assert.strictEqual(packLedgers('buyer').length, 2, '不得残留第三次扣费流水');
    } finally { mem.user.update = orig; }
  });
});
