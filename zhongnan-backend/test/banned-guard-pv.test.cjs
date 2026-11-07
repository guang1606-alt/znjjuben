/**
 * v2.459 access token 的密码版本（pv）校验：把「改密即作废旧会话」从 refresh token 延伸到 access token。
 *
 * 证伪背景：v2.458 只在 /refresh 比对 pv，access token 本身仍靠 15 分钟 TTL 自然过期——
 * 也就是说改密后，其他设备（或失窃的 access token）在最长 15 分钟内仍能正常调用全部 /api。
 * 而 bannedGuard 本来就对每个带令牌的 /api 请求查一次用户（30 秒缓存），顺带把 pv 一起比对，
 * 不增加任何查库成本，就能把这个窗口从 15 分钟压到缓存 TTL（30 秒）。
 *
 * 本文件锁定四件事：
 * 1) pv 一致放行、pv 不一致 401 SESSION_REVOKED（前端据此走续期 → 续期也拒 → 重新登录）；
 * 2) 无 pv 的历史令牌按兼容放行（与 v2.458 同口径，避免上线踢掉全部存量会话）；
 * 3) /auth/me 等资料读接口不再整体豁免（登录/注册/续期/登出仍豁免）；
 * 4) 缓存命中时依然比对 pv（缓存里存的是「当前密码的 pv」，不是「见过就放行」）。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
const { signAccess, passwordVersion } = require('../dist/lib/auth.js');
const { bannedGuard } = require('../dist/middleware/auth.js');

const HASH_OLD = 'hash_old_value';
const HASH_NEW = 'hash_new_value';

function makeReq(opts = {}) {
  return {
    path: opts.path || '/projects',
    headers: opts.token ? { authorization: 'Bearer ' + opts.token } : {},
  };
}
function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(n) { this.statusCode = n; return this; },
    json(o) { this.body = o; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
  };
}
function prismaWith(row) {
  return { user: { findUnique: async () => row } };
}

test('pv 守卫：令牌 pv 与库中 passwordHash 一致 → 放行', async () => {
  const prisma = prismaWith({ banned: false, passwordHash: HASH_NEW });
  const token = signAccess({ sub: 'u_pv_ok', level: 'BASIC', pv: passwordVersion(HASH_NEW) });
  const res = makeRes();
  let nexted = false;
  await bannedGuard(prisma)(makeReq({ token }), res, () => { nexted = true; });
  assert.strictEqual(nexted, true, 'pv 一致的令牌应放行');
  assert.strictEqual(res.statusCode, 200);
});

test('pv 守卫：改密后旧 access token（pv 已变）→ 401 SESSION_REVOKED', async () => {
  const prisma = prismaWith({ banned: false, passwordHash: HASH_NEW });
  const token = signAccess({ sub: 'u_pv_stale', level: 'BASIC', pv: passwordVersion(HASH_OLD) });
  const res = makeRes();
  let nexted = false;
  await bannedGuard(prisma)(makeReq({ token }), res, () => { nexted = true; });
  assert.strictEqual(nexted, false, 'pv 不一致不得放行');
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.error, 'SESSION_REVOKED');
});

test('pv 守卫：无 pv 的历史令牌按兼容放行（不踢存量会话）', async () => {
  const prisma = prismaWith({ banned: false, passwordHash: HASH_NEW });
  const token = signAccess({ sub: 'u_pv_legacy', level: 'BASIC' });
  const res = makeRes();
  let nexted = false;
  await bannedGuard(prisma)(makeReq({ token }), res, () => { nexted = true; });
  assert.strictEqual(nexted, true, '无 pv 的历史令牌必须放行');
});

test('pv 守卫：/auth/me 不再整体豁免（会话建立类端点仍豁免）', async () => {
  let dbHit = 0;
  const prisma = { user: { findUnique: async () => { dbHit++; return { banned: false, passwordHash: HASH_NEW }; } } };
  const token = signAccess({ sub: 'u_pv_me', level: 'BASIC', pv: passwordVersion(HASH_NEW) });
  const guard = bannedGuard(prisma);
  await guard(makeReq({ path: '/auth/me', token }), makeRes(), () => {});
  assert.strictEqual(dbHit, 1, '/auth/me 属于敏感资料读接口，必须查库校验 pv');
  for (const p of ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']) {
    await guard(makeReq({ path: p, token }), makeRes(), () => {});
  }
  assert.strictEqual(dbHit, 1, '登录/注册/续期/登出必须豁免（令牌可能已失效仍要能走完）');
});

test('pv 守卫：30 秒缓存命中时仍比对 pv（缓存存的是当前 pv，不是见过就放行）', async () => {
  let dbHit = 0;
  const prisma = { user: { findUnique: async () => { dbHit++; return { banned: false, passwordHash: HASH_NEW }; } } };
  const guard = bannedGuard(prisma);
  const fresh = signAccess({ sub: 'u_pv_cache', level: 'BASIC', pv: passwordVersion(HASH_NEW) });
  await guard(makeReq({ token: fresh }), makeRes(), () => {});
  const stale = signAccess({ sub: 'u_pv_cache', level: 'BASIC', pv: passwordVersion(HASH_OLD) });
  const res = makeRes();
  let nexted = false;
  await guard(makeReq({ token: stale }), res, () => { nexted = true; });
  assert.strictEqual(dbHit, 1, '同 sub 应命中缓存，不重复查库');
  assert.strictEqual(nexted, false, '缓存命中也不得放过 pv 不一致的令牌');
  assert.strictEqual(res.statusCode, 401);
});

test('pv 守卫：用户已被删除（查不到）→ 带 pv 的令牌 401', async () => {
  const prisma = prismaWith(null);
  const token = signAccess({ sub: 'u_pv_gone', level: 'BASIC', pv: passwordVersion(HASH_OLD) });
  const res = makeRes();
  let nexted = false;
  await bannedGuard(prisma)(makeReq({ token }), res, () => { nexted = true; });
  assert.strictEqual(nexted, false);
  assert.strictEqual(res.statusCode, 401);
});
