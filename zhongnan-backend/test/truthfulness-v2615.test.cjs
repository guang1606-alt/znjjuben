/**
 * v2.615 会话守卫（bannedGuard）数据库异常必须可归因
 *
 * 证伪背景：v2.302 已把「DB 异常时静默放行（封禁穿透）」改为 503 拒绝，
 * 但 catch 内没有任何日志。该守卫挂在 /api 上、每个带令牌的请求都会经过，
 * 数据库抖动/连接池耗尽时全站用户统一看到「系统繁忙」，服务端却零线索，
 * 无法区分是封禁表读失败、连接池耗尽还是 Prisma 客户端自身故障。
 *
 * 本文件锁定：DB 异常仍 503 + 原话术（行为不变），同时写入
 * [auth.session-guard] 且携带原始异常，便于线上归因。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
const { signAccess, passwordVersion } = require('../dist/lib/auth.js');
const { bannedGuard } = require('../dist/middleware/auth.js');

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
    status(n) { this.statusCode = n; return this; },
    json(o) { this.body = o; return this; },
    setHeader() { return this; },
  };
}

test('会话守卫：数据库异常必须 503 原话术，并写入 [auth.session-guard] 留痕', async () => {
  const prisma = {
    user: { findUnique: async () => { throw new Error('SESSION_GUARD_DB_DOWN_V2615'); } },
  };
  const token = signAccess({ sub: 'u_guard_db_v2615', level: 'BASIC', pv: passwordVersion('hash_v2615') });
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  const res = makeRes();
  let nexted = false;
  try {
    await bannedGuard(prisma)(makeReq({ token }), res, () => { nexted = true; });
  } finally {
    console.error = orig;
  }
  assert.strictEqual(nexted, false, '数据库异常不得放行请求');
  assert.strictEqual(res.statusCode, 503, '行为保持不变：仍按系统繁忙拒绝');
  assert.strictEqual(res.body.error, '系统繁忙，请稍后重试', '对外话术保持不变');
  assert.ok(
    logs.some((l) => l.includes('[auth.session-guard]') && l.includes('SESSION_GUARD_DB_DOWN_V2615')),
    '会话守卫异常必须带 scope 与原始异常留痕，否则全站 503 无从归因',
  );
});
