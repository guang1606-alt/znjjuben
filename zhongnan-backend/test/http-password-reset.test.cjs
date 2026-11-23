/**
 * v2.657 找回密码闭环：用户提交申请 → 超管后台核验后重置/忽略。
 *
 * 背景：本站未接入短信/邮件自动发码通道，用户忘记密码此前只能线下联系运营；
 * 产品需要一条可追溯、可处理、不泄露账号存在性的自助入口。
 *
 * 契约：
 *  · POST /api/auth/password-reset-requests            公开提交（手机号必填，备注选填）
 *      - 非法手机号 400；已注册/未注册同形 200 + ticketNo（防枚举）
 *      - 同手机号已有 PENDING 时复用原工单（幂等去重）
 *      - 同 IP 15 分钟窗口内最多受理 3 次，超出 429 + Retry-After
 *  · GET  /api/admin/password-reset-requests?status=  超管分页列表（统一分页契约）
 *  · POST /api/admin/password-reset-requests/:id/handle  action=resolve|dismiss
 *      - resolve 走与注册/改密同一条密码策略，真正改写 passwordHash
 *      - 已处理申请再次处理 409；未注册手机号 resolve 400
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access';
process.env.JWT_REFRESH_SECRET = 'test_refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createAdminRouter } = require('../dist/routes/admin.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess, hashPassword } = require('../dist/lib/auth.js');

test('找回密码：申请 → 超管列表 → 重置/忽略 闭环', async (t) => {
  const mem = createMemoryPrisma();
  mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
  mem._seedUser({ id: 'sub', phone: '13900000001', isAdmin: true, nickname: '副管' });
  const u = mem._seedUser({ id: 'u1', phone: '13900000002', level: 'BASIC', nickname: '张三' });
  await mem.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword('OldPass123') } });

  const app = createApp({ auth: createAuthRouter(mem), admin: createAdminRouter(mem) });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
  const subTok = signAccess({ sub: 'sub', level: 'FREE' });
  const userTok = signAccess({ sub: 'u1', level: 'BASIC' });
  const req = async (method, path, token, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json, headers: res.headers };
  };

  try {
    await t.test('非法手机号 400，且不消耗限流配额', async () => {
      const r = await req('POST', '/api/auth/password-reset-requests', null, { phone: '123' });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.error, '手机号格式不正确');
    });

    let unknownTicket = '';
    let registeredTicket = '';
    await t.test('未注册手机号与已注册手机号同形响应（防枚举）', async () => {
      const rUnknown = await req('POST', '/api/auth/password-reset-requests', null, { phone: '13700000000' });
      assert.strictEqual(rUnknown.status, 200);
      assert.deepStrictEqual(Object.keys(rUnknown.json).sort(), ['ok', 'ticketNo']);
      assert.match(rUnknown.json.ticketNo, /^PR-[0-9A-F]{8}$/);
      unknownTicket = rUnknown.json.ticketNo;

      const rKnown = await req('POST', '/api/auth/password-reset-requests', null, { phone: '13900000002', note: '注册昵称张三' });
      assert.strictEqual(rKnown.status, 200);
      assert.deepStrictEqual(Object.keys(rKnown.json).sort(), ['ok', 'ticketNo'], '不得回传昵称/等级等账号信息');
      registeredTicket = rKnown.json.ticketNo;
    });

    await t.test('同手机号重复提交复用原工单（幂等去重）', async () => {
      const r = await req('POST', '/api/auth/password-reset-requests', null, { phone: '13900000002' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ticketNo, registeredTicket);
      assert.strictEqual(mem._passwordResetRequests.filter((x) => x.status === 'PENDING').length, 2);
    });

    await t.test('同 IP 第 4 次提交 429 + Retry-After', async () => {
      const r = await req('POST', '/api/auth/password-reset-requests', null, { phone: '13700000003' });
      assert.strictEqual(r.status, 429);
      assert.ok(Number(r.headers.get('retry-after')) > 0);
    });

    await t.test('超管列表鉴权三档 + 未登录 401', async () => {
      assert.strictEqual((await req('GET', '/api/admin/password-reset-requests')).status, 401);
      const rUser = await req('GET', '/api/admin/password-reset-requests', userTok);
      assert.strictEqual(rUser.status, 403);
      assert.strictEqual(rUser.json.needAdmin, true);
      const rSub = await req('GET', '/api/admin/password-reset-requests', subTok);
      assert.strictEqual(rSub.status, 403);
      assert.strictEqual(rSub.json.needSuperAdmin, true);
    });

    let unknownId = '';
    let registeredId = '';
    await t.test('超管列表：分页契约 + 注册状态标注', async () => {
      const r = await req('GET', '/api/admin/password-reset-requests?page=1&pageSize=20', adminTok);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.total, 2);
      assert.strictEqual(r.json.page, 1);
      assert.strictEqual(r.json.pageSize, 20);
      assert.strictEqual(r.json.limit, 20);
      assert.strictEqual(r.json.offset, 0);
      const unknown = r.json.items.find((x) => x.phone === '13700000000');
      const known = r.json.items.find((x) => x.phone === '13900000002');
      assert.ok(unknown && known);
      assert.strictEqual(unknown.registered, false);
      assert.strictEqual(known.registered, true);
      assert.strictEqual(known.nickname, '张三');
      assert.strictEqual(known.note, '注册昵称张三');
      assert.strictEqual(unknown.ticketNo, unknownTicket);
      unknownId = unknown.id;
      registeredId = known.id;
    });

    await t.test('忽略申请：DISMISSED，重复处理 409', async () => {
      const r = await req('POST', `/api/admin/password-reset-requests/${unknownId}/handle`, adminTok, { action: 'dismiss' });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.status, 'DISMISSED');
      const again = await req('POST', `/api/admin/password-reset-requests/${unknownId}/handle`, adminTok, { action: 'dismiss' });
      assert.strictEqual(again.status, 409);
      const list = await req('GET', '/api/admin/password-reset-requests?status=DISMISSED', adminTok);
      assert.strictEqual(list.json.total, 1);
    });

    await t.test('重置密码：弱口令 400，合规口令改写 passwordHash 且旧密码立即失效', async () => {
      const weak = await req('POST', `/api/admin/password-reset-requests/${registeredId}/handle`, adminTok, { action: 'resolve', newPassword: 'short' });
      assert.strictEqual(weak.status, 400);

      const ok = await req('POST', `/api/admin/password-reset-requests/${registeredId}/handle`, adminTok, { action: 'resolve', newPassword: 'NewPass123' });
      assert.strictEqual(ok.status, 200);
      assert.strictEqual(ok.json.status, 'RESOLVED');

      const oldLogin = await req('POST', '/api/auth/login', null, { phone: '13900000002', password: 'OldPass123' });
      assert.strictEqual(oldLogin.status, 401);
      const newLogin = await req('POST', '/api/auth/login', null, { phone: '13900000002', password: 'NewPass123' });
      assert.strictEqual(newLogin.status, 200);

      const resolved = await req('GET', '/api/admin/password-reset-requests?status=RESOLVED', adminTok);
      assert.strictEqual(resolved.json.total, 1);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('找回密码：未注册手机号的申请不可被重置（400），不发账号信息', async () => {
  const mem = createMemoryPrisma();
  mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
  const app = createApp({ auth: createAuthRouter(mem), admin: createAdminRouter(mem) });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
  try {
    await fetch(base + '/api/auth/password-reset-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13700000009' }),
    });
    const list = await (await fetch(base + '/api/admin/password-reset-requests', { headers: { Authorization: `Bearer ${adminTok}` } })).json();
    const row = list.items.find((x) => x.phone === '13700000009');
    assert.ok(row);
    const r = await fetch(base + `/api/admin/password-reset-requests/${row.id}/handle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTok}` },
      body: JSON.stringify({ action: 'resolve', newPassword: 'NewPass123' }),
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).error, '该手机号尚未注册，无法重置');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
