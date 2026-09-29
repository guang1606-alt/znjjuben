/**
 * v1.46 超级管理员后台 HTTP 闭环测试
 * 覆盖：鉴权(401/403)、用户列表/搜索/脱敏、封禁、调级、增减积分(含余额非负)、重置密码、
 *      数据总览聚合、财务汇总、帖子审核隐藏/恢复、目标不存在 404。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access';
process.env.JWT_REFRESH_SECRET = 'test_refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminRouter } = require('../dist/routes/admin.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess } = require('../dist/lib/auth.js');
const { verifyPassword } = require('../dist/lib/auth.js');

function appWith(mem) {
  return createApp({ admin: createAdminRouter(mem) });
}

test('管理员后台：完整闭环', async (t) => {
  const mem = createMemoryPrisma();
  mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
  mem._seedUser({ id: 'u1', level: 'BASIC', balance: 100, nickname: '张三', penName: '终南张三' });
  mem._seedUser({ id: 'u2', level: 'FREE', balance: 0 });
  const app = appWith(mem);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
  const userTok = signAccess({ sub: 'u1', level: 'BASIC' });
  const req = async (method, path, token, body) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json };
  };

  await t.test('未登录 401 / 普通用户 403', async () => {
    assert.strictEqual((await req('GET', '/api/admin/users')).status, 401);
    const r = await req('GET', '/api/admin/users', userTok);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.json.needAdmin, true);
  });

  await t.test('用户列表：分页/搜索/脱敏，带余额与作品数', async () => {
    const r = await req('GET', '/api/admin/users?pageSize=10', adminTok);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.total, 3);
    assert.ok(r.json.items.every((u) => !('passwordHash' in u)));
    const zs = r.json.items.find((u) => u.id === 'u1');
    assert.strictEqual(zs.balance, 100);
    const s = await req('GET', '/api/admin/users?q=终南', adminTok);
    assert.strictEqual(s.json.total, 1);
    assert.strictEqual(s.json.items[0].id, 'u1');
  });

  await t.test('封禁 / 解封', async () => {
    assert.strictEqual((await req('POST', '/api/admin/users/u1/ban', adminTok, { banned: true })).json.banned, true);
    assert.strictEqual(mem._users.get('u1').banned, true);
    assert.strictEqual((await req('POST', '/api/admin/users/u1/ban', adminTok, { banned: false })).json.banned, false);
  });

  await t.test('调整等级与有效期', async () => {
    const r = await req('POST', '/api/admin/users/u1/level', adminTok, { level: 'PRO', days: 30 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.level, 'PRO');
    assert.ok(r.json.levelExpireAt);
    assert.strictEqual((await req('POST', '/api/admin/users/u1/level', adminTok, { level: 'BOGUS' })).status, 400);
  });

  await t.test('增减积分：补发/扣减/余额非负拦截/写流水', async () => {
    const add = await req('POST', '/api/admin/users/u1/points', adminTok, { delta: 50, reason: '活动补发' });
    assert.strictEqual(add.status, 200);
    assert.strictEqual(add.json.balance, 150);
    const over = await req('POST', '/api/admin/users/u1/points', adminTok, { delta: -999, reason: '误扣' });
    assert.strictEqual(over.status, 400);
    const sub = await req('POST', '/api/admin/users/u1/points', adminTok, { delta: -30, reason: '修正' });
    assert.strictEqual(sub.json.balance, 120);
    assert.strictEqual((await req('POST', '/api/admin/users/u1/points', adminTok, { delta: 0, reason: 'x' })).status, 400);
    const ledgers = mem._ledgers.filter((l) => l.userId === 'u1' && String(l.reason).startsWith('ADMIN_ADJUST'));
    assert.strictEqual(ledgers.length, 2);
  });

  await t.test('重置密码：长度校验 + argon2id 可验证', async () => {
    assert.strictEqual((await req('POST', '/api/admin/users/u1/reset-password', adminTok, { newPassword: '123' })).status, 400);
    const r = await req('POST', '/api/admin/users/u1/reset-password', adminTok, { newPassword: 'newpass123' });
    assert.strictEqual(r.status, 200);
    assert.ok(await verifyPassword(mem._users.get('u1').passwordHash, 'newpass123'));
  });

  // c198 主账号开设子账号：仅超管可开（子账号/普通用户 403），预设初始密码与权限档；
  // 开设接口绝不接受 role/isAdmin 等提权字段（zod 剥离），保证「其他账号权限都在主账号之下」。
  await t.test('开设账号：超管预设初始密码与档位，子账号可登录且无后台权限', async () => {
    const r = await req('POST', '/api/admin/users', adminTok, {
      phone: '13911112222', initialPassword: 'init12345', level: 'ADVANCED', nickname: '编剧一号',
    });
    assert.strictEqual(r.status, 200);
    assert.ok(!('passwordHash' in r.json), '响应绝不含 passwordHash');
    assert.strictEqual(r.json.level, 'ADVANCED');
    assert.strictEqual(r.json.phone, '13911112222');
    // 预设初始密码可用 argon2id 验证（预设密码语义）
    const created = mem._users.get(r.json.id);
    assert.ok(created, '开设的用户须落库');
    assert.ok(await verifyPassword(created.passwordHash, 'init12345'), '初始密码须按预设值哈希落库');
    // 子账号不能开设账号（权限严格在超管之下）
    const subTok = signAccess({ sub: r.json.id, level: 'ADVANCED' });
    assert.strictEqual((await req('POST', '/api/admin/users', subTok, {
      phone: '13911113333', initialPassword: 'init12345', level: 'FREE',
    })).status, 403, '子账号开设账号必须 403');
    // 未登录 401
    assert.strictEqual((await req('POST', '/api/admin/users', null, { phone: '13911114444', initialPassword: 'init12345' })).status, 401);
    // 重复手机号 409
    assert.strictEqual((await req('POST', '/api/admin/users', adminTok, {
      phone: '13911112222', initialPassword: 'init12345', level: 'FREE',
    })).status, 409);
    // 参数不合法：密码 <8 位（与注册口径一致）/ 非法档位 / 手机号格式
    assert.strictEqual((await req('POST', '/api/admin/users', adminTok, { phone: '13911115555', initialPassword: 'short7', level: 'FREE' })).status, 400);
    assert.strictEqual((await req('POST', '/api/admin/users', adminTok, { phone: '13911115555', initialPassword: 'init12345', level: 'VIP' })).status, 400);
    assert.strictEqual((await req('POST', '/api/admin/users', adminTok, { phone: '12345', initialPassword: 'init12345', level: 'FREE' })).status, 400);
  });

  // c199 副管理员：仅主账号可开设（isAdmin:true），可进后台做日常管理（列表/重置密码/封禁…），
  // 但不可开设账号——「仅次于主账号」：requireSuperAdmin 以主账号手机号硬判定，role 无法自造。
  await t.test('开设副管理员：可进后台，不可开设账号', async () => {
    const r = await req('POST', '/api/admin/users', adminTok, {
      phone: '13911116666', initialPassword: 'init12345', level: 'PRO', isAdmin: true, nickname: '副管理员',
    });
    assert.strictEqual(r.status, 200);
    assert.ok(!('passwordHash' in r.json));
    const subAdminTok = signAccess({ sub: r.json.id, level: 'PRO' });
    // 可进后台：用户列表可读
    assert.strictEqual((await req('GET', '/api/admin/users', subAdminTok)).status, 200, '副管理员必须能进后台');
    // 可做日常管理：重置普通用户密码
    assert.strictEqual((await req('POST', '/api/admin/users/u2/reset-password', subAdminTok, { newPassword: 'reset8888' })).status, 200);
    // 不可开设账号（仅次于主账号的硬边界）
    const denied = await req('POST', '/api/admin/users', subAdminTok, {
      phone: '13911117777', initialPassword: 'init12345', level: 'FREE', isAdmin: true,
    });
    assert.strictEqual(denied.status, 403, '副管理员开设账号必须 403');
    assert.strictEqual(denied.json.needSuperAdmin, true);
  });

  // c199 危险操作目标保护：封禁/调级/加减分/重置密码四操作按「目标」设防——
  // ① 主账号绝不可被任何人封禁/动密码（防下克上锁死最高权限）；② 副管理员只能管普通用户，
  // 不可操作其他副管理员；③ 主账号是唯一仲裁者，仍可封禁/处置副管理员与所有人。
  await t.test('目标保护：副管理员不可封主账号、不可动其他副管理员', async () => {
    mem._seedUser({ id: 'sub1', phone: '15211112222', level: 'PRO', isAdmin: true });
    mem._seedUser({ id: 'sub2', phone: '15233334444', level: 'PRO', isAdmin: true });
    mem._seedUser({ id: 'u3', phone: '13733334444', level: 'FREE' });
    const subTok = signAccess({ sub: 'sub1', level: 'PRO' });
    // ① 副管理员封主账号 → 403，且主账号状态绝不能变
    const banSuper = await req('POST', '/api/admin/users/admin/ban', subTok, { banned: true });
    assert.strictEqual(banSuper.status, 403, '封禁主账号必须 403');
    assert.strictEqual(mem._users.get('admin').banned, false, '主账号绝不能被封');
    // ② 副管理员重置另一副管理员密码 → 403（防互斗窃号）
    assert.strictEqual((await req('POST', '/api/admin/users/sub2/reset-password', subTok, { newPassword: 'hacked999' })).status, 403);
    // ③ 副管理员给另一副管理员加积分 → 403（防自肥）
    assert.strictEqual((await req('POST', '/api/admin/users/sub2/points', subTok, { delta: 100, reason: 'x' })).status, 403);
    // ④ 副管理员调另一副管理员等级 → 403
    assert.strictEqual((await req('POST', '/api/admin/users/sub2/level', subTok, { level: 'PRO' })).status, 403);
    // ⑤ 主账号是唯一仲裁者：仍可封/解封副管理员
    assert.strictEqual((await req('POST', '/api/admin/users/sub2/ban', adminTok, { banned: true })).status, 200);
    assert.strictEqual(mem._users.get('sub2').banned, true);
    assert.strictEqual((await req('POST', '/api/admin/users/sub2/ban', adminTok, { banned: false })).status, 200);
    // ⑥ 副管理员日常管理普通用户不受影响
    assert.strictEqual((await req('POST', '/api/admin/users/u3/ban', subTok, { banned: true })).status, 200);
    assert.strictEqual((await req('POST', '/api/admin/users/u3/ban', subTok, { banned: false })).status, 200);
    // ⑦ 主账号重置自己密码走既有自助通道不受影响：此处仅确认保护不误伤普通目标的重置
    assert.strictEqual((await req('POST', '/api/admin/users/u3/reset-password', subTok, { newPassword: 'ok12345' })).status, 200);
  });

  await t.test('数据总览聚合正确', async () => {
    await mem.project.create({ data: { id: 'pj1', userId: 'u1', title: '剧A', mode: 'tags', format: 'LIVE_ACTION' } });
    await mem.project.create({ data: { id: 'pj2', userId: 'u2', title: '剧B', mode: 'hot', format: 'AIGC' } });
    await mem.script.create({ data: { projectId: 'pj1', epNo: 1, version: 1, content: 'x', qcPassed: true } });
    await mem.post.create({ data: { id: 'po1', userId: 'u1', section: 'experience', title: 't', body: 'b', hidden: false } });
    await mem.listing.create({ data: { id: 'l1', sellerId: 'u1', scriptId: 'pj1', title: '卖', priceFen: 990, commissionPct: 10, status: 'ON_SHELF' } });
    await mem.order.create({ data: { id: 'o1', userId: 'u1', kind: 'MEMBER', amountFen: 9900, points: 990, status: 'PAID' } });
    const r = await req('GET', '/api/admin/stats/overview', adminTok);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.users.total, 8); // 原 3 人 + c198 子账号 + c199 副管理员 + sub1/sub2/u3
    assert.strictEqual(r.json.projects.total, 2);
    assert.strictEqual(r.json.projects.byMode.tags, 1);
    assert.strictEqual(r.json.scripts.total, 1);
    assert.strictEqual(r.json.scripts.qcPassed, 1);
    assert.strictEqual(r.json.community.posts, 1);
    assert.strictEqual(r.json.market.onShelf, 1);
    assert.strictEqual(r.json.orders.total, 1);
  });

  await t.test('财务汇总：只统计已支付，按 kind 归类', async () => {
    await mem.order.create({ data: { id: 'o2', userId: 'u2', kind: 'PACKAGE', amountFen: 1000, points: 100, status: 'PENDING' } });
    const r = await req('GET', '/api/admin/finance/overview', adminTok);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.paidRevenueFen, 9900); // PENDING 不计
    assert.strictEqual(r.json.paidOrderCount, 1);
    assert.strictEqual(r.json.byKind.MEMBER.amountFen, 9900);
    assert.strictEqual(r.json.byKind.PACKAGE, undefined);
  });

  await t.test('帖子审核：隐藏/恢复/过滤', async () => {
    const hide = await req('POST', '/api/admin/posts/po1/hide', adminTok, { hidden: true });
    assert.strictEqual(hide.json.hidden, true);
    const hiddenOnly = await req('GET', '/api/admin/posts?hidden=hidden', adminTok);
    assert.strictEqual(hiddenOnly.json.total, 1);
    const visible = await req('GET', '/api/admin/posts?hidden=visible', adminTok);
    assert.strictEqual(visible.json.total, 0);
    await req('POST', '/api/admin/posts/po1/hide', adminTok, { hidden: false });
  });

  await t.test('定价测算：返回各档售价倍数与会员月模型，超量假设可传参', async () => {
    const r = await req('GET', '/api/admin/pricing-sim', adminTok);
    assert.strictEqual(r.status, 200);
    // 三档会员（基础/高级/专业）月模型
    assert.strictEqual(r.json.plans.length, 3);
    const pro = r.json.plans.find((p) => p.level === 'PRO');
    assert.strictEqual(pro.quotaModelCostFen, 1000 * 12);
    // 每个会员档每个在售引擎售价都≥2倍
    for (const row of r.json.priceTable)
      for (const e of row.engines) assert.ok(e.pass, `${row.level} ${e.tier} 必须≥成本2倍`);
    // 传超量假设后计入付费收入
    const r2 = await req('GET', '/api/admin/pricing-sim?std=10&other=500', adminTok);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.assumedPaidEps.STANDARD, 10);
    assert.strictEqual(r2.json.assumedOtherCostFen, 500);
  });

  await t.test('目标不存在返回 404 / 参数非法 400', async () => {
    assert.strictEqual((await req('POST', '/api/admin/users/nope/ban', adminTok, { banned: true })).status, 404);
    assert.strictEqual((await req('POST', '/api/admin/posts/nope/hide', adminTok, { hidden: true })).status, 404);
    assert.strictEqual((await req('POST', '/api/admin/users/u1/ban', adminTok, {})).status, 400);
  });

  server.close();
});
