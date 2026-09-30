/**
 * c198 超管主账号引导（ensureSuperAdmin）单测
 * 覆盖：无则建（ENTERPRISE 最高档 + 显式配置初始密码 argon2id 可验证 + 积分账户就绪）、
 *      幂等（二调不重复建/不覆盖已有密码）、passwordHash 缺失补设、被封自愈解封、
 *      env SUPER_ADMIN_INIT_PASSWORD 可覆盖初始密码。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access';
process.env.JWT_REFRESH_SECRET = 'test_refresh';
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { verifyPassword } = require('../dist/lib/auth.js');
const { ensureSuperAdmin, SUPER_ADMIN_INITIAL_PASSWORD_ENV } = require('../dist/lib/super-admin.js');
const { SUPER_ADMIN_PHONE } = require('../dist/middleware/admin.js');

test.beforeEach(() => { process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV] = 'test-admin-pass-2026'; });
test.afterEach(() => { delete process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV]; });

test('未设置初始化密码时不创建账号、不补写旧账号密码', async () => {
  delete process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV];
  const mem = createMemoryPrisma();
  await assert.rejects(() => ensureSuperAdmin(mem), /SUPER_ADMIN_INIT_PASSWORD/);
  assert.strictEqual(mem._users.size, 0);
  mem._seedUser({ id: 'legacy-empty', phone: SUPER_ADMIN_PHONE });
  await assert.rejects(() => ensureSuperAdmin(mem), /SUPER_ADMIN_INIT_PASSWORD/);
  assert.ok(!mem._users.get('legacy-empty').passwordHash);
});

test('已有密码在未设置初始化密码时保持可用', async () => {
  const mem = createMemoryPrisma();
  const u = await ensureSuperAdmin(mem);
  const hash = u.passwordHash;
  delete process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV];
  assert.strictEqual((await ensureSuperAdmin(mem)).passwordHash, hash);
});

test('初始化密码太短时拒绝创建', async () => {
  process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV] = 'short';
  const mem = createMemoryPrisma();
  await assert.rejects(() => ensureSuperAdmin(mem), /SUPER_ADMIN_INIT_PASSWORD/);
  assert.strictEqual(mem._users.size, 0);
});

test('ensureSuperAdmin：无则建（最高档+显式配置初始密码+积分账户），幂等不覆盖已有密码', async () => {
  const mem = createMemoryPrisma();
  const u = await ensureSuperAdmin(mem);
  assert.strictEqual(u.phone, SUPER_ADMIN_PHONE, '主账号手机号必须是 18891995171');
  assert.strictEqual(u.level, 'PRO', '主账号必须是最高会员档（权限在一切普通账号之上）');
  assert.ok(u.passwordHash, '必须落密码哈希');
  assert.ok(await verifyPassword(u.passwordHash, 'test-admin-pass-2026'), '显式配置初始密码可验证（登录即用）');
  assert.ok(mem._accounts.get(u.id), '积分账户须就绪');
  // 幂等：二调不重复建、不覆盖已有密码
  const hashBefore = u.passwordHash;
  const u2 = await ensureSuperAdmin(mem);
  assert.strictEqual(u2.id, u.id, '幂等：返回同一账号');
  assert.strictEqual(mem._users.size, 1, '不重复建号');
  assert.strictEqual(u2.passwordHash, hashBefore, '已有密码不被覆盖');
  // 已有密码验证仍通过
  assert.ok(await verifyPassword(mem._users.get(u.id).passwordHash, 'test-admin-pass-2026'));
});

test('ensureSuperAdmin：passwordHash 缺失补设 / 被封自愈解封', async () => {
  const mem = createMemoryPrisma();
  // 历史手机号注册无密码：补设初始密码
  const noPw = mem._seedUser({ id: 'legacy', phone: SUPER_ADMIN_PHONE });
  await ensureSuperAdmin(mem);
  assert.ok(mem._users.get('legacy').passwordHash, '空密码须补设');
  assert.ok(await verifyPassword(mem._users.get('legacy').passwordHash, 'test-admin-pass-2026'));
  // 被封自愈：主账号不应处于封禁态
  mem._setBanned(SUPER_ADMIN_PHONE, true);
  await ensureSuperAdmin(mem);
  assert.strictEqual(mem._users.get('legacy').banned, false, '主账号被封须自动解封');
  // 已有正常密码不覆盖（与上例对照）
  const seeded = mem._seedUser({ id: 'keeper', phone: SUPER_ADMIN_PHONE });
  seeded.passwordHash = await require('../dist/lib/auth.js').hashPassword('keepme12345');
  await ensureSuperAdmin(mem);
  assert.ok(await verifyPassword(mem._users.get('keeper').passwordHash, 'keepme12345'), '已有密码不得被重置');
});

test('ensureSuperAdmin：env SUPER_ADMIN_INIT_PASSWORD 可覆盖初始密码', async () => {
  const mem = createMemoryPrisma();
  process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV] = 'envOverride66';
  try {
    const u = await ensureSuperAdmin(mem);
    assert.ok(await verifyPassword(u.passwordHash, 'envOverride66'), '初始密码须取 env 覆盖值');
    assert.ok(!(await verifyPassword(u.passwordHash, 'test-admin-pass-2026')));
  } finally {
    delete process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV];
  }
});
