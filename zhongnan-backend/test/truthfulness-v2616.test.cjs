/**
 * v2.616 管理员鉴权读库失败必须可归因
 *
 * 证伪背景：createRequireAdmin 的 catch 在数据库异常时统一返回
 * 403「管理员鉴权失败」，但没有任何日志。读库失败被伪装成「没有管理员权限」，
 * 管理员会误以为自己被降权；服务端零线索，无法区分是用户表读失败还是权限确实不足。
 *
 * 本文件锁定：读库失败仍 403 原话术（挂载顺序/防误放行语义不变），
 * 同时写入 [admin.require] 且携带原始异常。
 */
const test = require('node:test');
const assert = require('node:assert');
const { createRequireAdmin } = require('../dist/middleware/admin.js');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(n) { this.statusCode = n; return this; },
    json(o) { this.body = o; return this; },
  };
}

test('管理员鉴权读库失败：仍 403 原话术，并写入 [admin.require] 留痕', async () => {
  const prisma = {
    user: { findUnique: async () => { throw new Error('ADMIN_LOOKUP_DB_DOWN_V2616'); } },
  };
  const requireAdmin = createRequireAdmin(prisma);
  const res = makeRes();
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  let nexted = false;
  try {
    await requireAdmin({ userId: 'u_admin_v2616' }, res, () => { nexted = true; });
  } finally {
    console.error = orig;
  }
  assert.strictEqual(nexted, false, '读库异常不得放行到后台 handler');
  assert.strictEqual(res.statusCode, 403, '行为保持不变：宁可误拒');
  assert.strictEqual(res.body.error, '管理员鉴权失败', '对外话术保持不变');
  assert.ok(
    logs.some((l) => l.includes('[admin.require]') && l.includes('ADMIN_LOOKUP_DB_DOWN_V2616')),
    '读库失败必须带 scope 与原始异常留痕，否则「管理员被降权」无从归因',
  );
});
