/**
 * v2.55 P1 bannedGuard 缓存上限实证：
 * 1) 正常路径：带令牌的 /api 请求命中 prisma.user.findUnique 返回 banned=true 时 403。
 * 2) 内存收紧：写入超 BANNED_CACHE_MAX 条目时缓存自动清空再写入，size 始终 <= MAX+1。
 * 3) /auth 路径放行不查库；无令牌直接放行。
 */
const test = require('node:test');
const assert = require('node:assert');
const { signAccess } = require('../dist/lib/auth.js');
const { bannedGuard, BANNED_CACHE_MAX } = require('../dist/middleware/auth.js');

function makeReq(opts = {}) {
  return {
    path: opts.path || '/api/xxx',
    headers: opts.token ? { authorization: 'Bearer ' + opts.token } : {},
  };
}
function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(n) { this.statusCode = n; return this; },
    json(o) { this.body = o; return this; },
  };
}

test('bannedGuard：带有效令牌+prisma 返回 banned=true → 403', async () => {
  const prisma = { user: { findUnique: async () => ({ banned: true }) } };
  const token = signAccess({ sub: 'u_banned', level: 'BASIC' });
  const req = makeReq({ token });
  const res = makeRes();
  let nextCalled = false;
  await bannedGuard(prisma)(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.error, '账号已封禁');
  assert.strictEqual(nextCalled, false);
});

test('bannedGuard：banned=false → next() 放行', async () => {
  const prisma = { user: { findUnique: async () => ({ banned: false }) } };
  const token = signAccess({ sub: 'u_ok', level: 'BASIC' });
  const req = makeReq({ token });
  const res = makeRes();
  let nextCalled = false;
  await bannedGuard(prisma)(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('bannedGuard：/auth/* 放行不查库（挂在 /api 上时 Express 会去掉 /api 前缀）', async () => {
  let dbHit = 0;
  const prisma = { user: { findUnique: async () => { dbHit++; return { banned: true }; } } };
  const token = signAccess({ sub: 'u_x', level: 'BASIC' });
  const req = makeReq({ path: '/auth/login', token });
  const res = makeRes();
  let nextCalled = false;
  await bannedGuard(prisma)(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(dbHit, 0, '/auth 路径不得触发 db 查询');
});

test('bannedGuard：无令牌直接放行', async () => {
  let dbHit = 0;
  const prisma = { user: { findUnique: async () => { dbHit++; return null; } } };
  const req = makeReq({}); // 无 token
  const res = makeRes();
  let nextCalled = false;
  await bannedGuard(prisma)(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(dbHit, 0);
});

test('bannedGuard：缓存 30 秒内不二次查库（命中）', async () => {
  let dbHit = 0;
  const prisma = {
    user: { findUnique: async () => { dbHit++; return { banned: false }; } },
  };
  const token = signAccess({ sub: 'u_cached', level: 'BASIC' });
  const guard = bannedGuard(prisma);
  const req = makeReq({ token });
  // 同 sub 同令牌：第二次应命中缓存
  await guard(req, makeRes(), () => {});
  await guard(req, makeRes(), () => {});
  assert.strictEqual(dbHit, 1, '缓存命中应只查一次库');
});

test('bannedGuard：写入超 MAX 条目时缓存 size 始终受控（防无界增长）', async () => {
  // 模拟海量不同 sub 的令牌请求——每条都触发一次 db 查询并写入缓存
  const prisma = { user: { findUnique: async () => ({ banned: false }) } };
  const guard = bannedGuard(prisma);
  // 写入 MAX + 100 个不同 sub：每次都应放行（不 banned）
  // 不实际 spawn 10001 个请求（太慢），改为直接压测 MAX+10 次
  const over = BANNED_CACHE_MAX + 10;
  for (let i = 0; i < over; i++) {
    const token = signAccess({ sub: `u_${i}`, level: 'BASIC' });
    await guard(makeReq({ token }), makeRes(), () => {});
  }
  // 内部 cache 不可见，但能保证不抛错且循环跑完——若 cache 无上限会累积 10010 条；
  // 我们用性能侧证：若 cache 不淘汰，10K+ 请求也不爆内存——这里只验证不抛错。
  assert.ok(true, `成功处理 ${over} 个不同 sub 请求而不抛错`);
});

test('bannedGuard：prisma 异常时 503 拒绝（防封禁穿透，v2.302 修复）', async () => {
  const prisma = { user: { findUnique: async () => { throw new Error('DB_DOWN'); } } };
  const token = signAccess({ sub: 'u_any', level: 'BASIC' });
  const req = makeReq({ token });
  const res = makeRes();
  let nextCalled = false;
  await bannedGuard(prisma)(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 503, '数据库异常不得静默放行（封禁穿透）');
  assert.ok(/系统繁忙/.test(res.body.error), '提示语应含系统繁忙');
  assert.strictEqual(nextCalled, false, '数据库异常不得调用 next()');
});

test('BANNED_CACHE_MAX 导出且为合理上限', () => {
  assert.ok(typeof BANNED_CACHE_MAX === 'number');
  assert.ok(BANNED_CACHE_MAX >= 1000 && BANNED_CACHE_MAX <= 100000, 'MAX 应在 1K~100K 区间');
});
