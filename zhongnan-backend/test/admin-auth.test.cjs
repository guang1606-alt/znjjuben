/**
 * 2026-09-29「超管一人独大」鉴权口径单测：
 *  · isAdminUser 仅认 超管手机号 / isAdmin===true（role 死条件已移除，生产 schema 从无 role）；
 *  · isSuperAdminUser 只认手机号硬标识；
 *  · requireSuperAdmin：无 adminUser（挂载错误）/ 副管理员 一律 403 needSuperAdmin；
 *  · createRequireAdmin + requireSuperAdmin 串联内存桩：普通用户 403、副管 403、超管放行。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'adm-auth-test';
process.env.JWT_REFRESH_SECRET = 'adm-auth-test-r';
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const {
  isAdminUser, isSuperAdminUser, requireSuperAdmin, createRequireAdmin, SUPER_ADMIN_PHONE,
} = require('../dist/middleware/admin.js');

test('isAdminUser：只认超管手机号与 isAdmin 布尔位；role 字段一律无效', () => {
  assert.strictEqual(isAdminUser(null), false);
  assert.strictEqual(isAdminUser({ phone: SUPER_ADMIN_PHONE, isAdmin: false }), true, '超管手机号恒为管理员');
  assert.strictEqual(isAdminUser({ phone: '13000000000', isAdmin: true }), true, '副管理员身份标记');
  assert.strictEqual(isAdminUser({ phone: '13000000000', isAdmin: false, role: 'ADMIN' }), false,
    'role==ADMIN 是已删除的死条件，不得放行（防历史脏数据/内存桩字段提权）');
  assert.strictEqual(isAdminUser({ phone: '13000000000', role: 'ADMIN' }), false);
  assert.strictEqual(isAdminUser({ phone: '13000000000', level: 'PRO' }), false, 'PRO 会员等级不是管理员');
});

test('isSuperAdminUser：手机号硬判定，唯一最高权限', () => {
  assert.strictEqual(isSuperAdminUser({ phone: SUPER_ADMIN_PHONE }), true);
  assert.strictEqual(isSuperAdminUser({ phone: '13000000000', isAdmin: true }), false, '副管理员不是超管');
  assert.strictEqual(isSuperAdminUser({ isAdmin: true }), false);
  assert.strictEqual(isSuperAdminUser(null), false);
});

function mockReqRes(userId, adminUser) {
  const req = { userId, adminUser };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return { req, res };
}

test('requireSuperAdmin：无 adminUser 与副管理员均 403，超管放行', async () => {
  {
    const { req, res } = mockReqRes('x', null);
    let nexted = false;
    requireSuperAdmin(req, res, () => { nexted = true; });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.needSuperAdmin, true);
    assert.strictEqual(nexted, false, '挂载顺序异常时宁可误拒');
  }
  {
    const { req, res } = mockReqRes('sub', { id: 'sub', phone: '13000000000', isAdmin: true });
    let nexted = false;
    requireSuperAdmin(req, res, () => { nexted = true; });
    assert.strictEqual(res.statusCode, 403, '副管理员一律拒绝');
    assert.strictEqual(nexted, false);
  }
  {
    const { req, res } = mockReqRes('boss', { id: 'boss', phone: SUPER_ADMIN_PHONE, isAdmin: false });
    let nexted = false;
    requireSuperAdmin(req, res, () => { nexted = true; });
    assert.strictEqual(nexted, true, '超管手机号放行');
  }
});

test('完整链 authRequired 之后：普通 403(needAdmin) / 副管 403(needSuperAdmin) / 超管放行', async () => {
  const mem = createMemoryPrisma();
  mem._seedUser({ id: 'normal', phone: '13911110001', level: 'PRO' });
  mem._seedUser({ id: 'sub', phone: '13911110002', level: 'PRO', isAdmin: true });
  mem._seedUser({ id: 'boss', phone: SUPER_ADMIN_PHONE, level: 'PRO' });
  const requireAdmin = createRequireAdmin(mem);
  const chain = (userId) => new Promise((resolve) => {
    const req = { userId };
    const res = {
      code: 200, body: null,
      status(c) { this.code = c; return this; },
      json(b) { this.body = b; resolve({ code: this.code, body: b, nexted: false }); return this; },
    };
    const finalNext = () => resolve({ code: 200, body: null, nexted: true });
    requireAdmin(req, res, () => requireSuperAdmin(req, res, finalNext));
  });
  const a = await chain('normal');
  assert.strictEqual(a.code, 403); assert.strictEqual(a.body.needAdmin, true); assert.strictEqual(a.nexted, false);
  const b = await chain('sub');
  assert.strictEqual(b.code, 403); assert.strictEqual(b.body.needSuperAdmin, true, '副管有身份标记但无后台权'); assert.strictEqual(b.nexted, false);
  const c = await chain('boss');
  assert.strictEqual(c.nexted, true, '仅超管穿透到 handler');
});
