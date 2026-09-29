/**
 * v2.186 工具优化弹窗铁律：/api/updates/* 与 /api/admin/updates HTTP 闭环测试
 *
 * 契约：
 *  · GET  /api/updates/latest          公开读最新公告 + 当前后端版本号
 *  · POST /api/admin/updates           超管发布新公告（version/titleZh/bodyZh 必填；同 version 拒绝）
 *  · 鉴权：未登录 401 / 普通用户 403 needAdmin / 副管理员 403 needSuperAdmin / 超管 200
 *
 * 背景铁律：用户 2026-09-29 拍板——「工具的每一次优化、调整、更新都要有弹窗」，
 * 后端版本号变更即弹；超管可主动推公告。本测试覆盖鉴权、CRUD、唯一约束与公开读路径。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access';
process.env.JWT_REFRESH_SECRET = 'test_refresh';
const { createApp } = require('../dist/server/app.js');
const { createUpdatesRouter } = require('../dist/routes/updates.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { signAccess } = require('../dist/lib/auth.js');

function appWith(mem) {
  return createApp({ updates: createUpdatesRouter(mem) });
}

test('工具更新公告：完整闭环', async (t) => {
  const mem = createMemoryPrisma();
  mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
  mem._seedUser({ id: 'sub', phone: '13900000001', isAdmin: true, nickname: '副管' });
  mem._seedUser({ id: 'u1', phone: '13900000002', level: 'BASIC', nickname: '张三' });
  const app = appWith(mem);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
  const subTok = signAccess({ sub: 'sub', level: 'FREE' });
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

  await t.test('GET /api/updates/latest 无公告返回 200 + null + 当前版本号', async () => {
    const r = await req('GET', '/api/updates/latest');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.announcement, null);
    assert.ok(typeof r.json.version === 'string' && r.json.version.length > 0);
  });

  await t.test('POST /api/admin/updates 鉴权四档：401 / 403 needAdmin / 403 needSuperAdmin / 200', async () => {
    const body = { version: '2.186.0', titleZh: '弹窗机制上线', bodyZh: '每次工具优化都会弹窗通知你。' };
    assert.strictEqual((await req('POST', '/api/admin/updates', null, body)).status, 401);
    const rUser = await req('POST', '/api/admin/updates', userTok, body);
    assert.strictEqual(rUser.status, 403);
    assert.strictEqual(rUser.json.needAdmin, true);
    const rSub = await req('POST', '/api/admin/updates', subTok, body);
    assert.strictEqual(rSub.status, 403);
    assert.strictEqual(rSub.json.needSuperAdmin, true);
    const rAdmin = await req('POST', '/api/admin/updates', adminTok, body);
    assert.strictEqual(rAdmin.status, 200);
    assert.strictEqual(rAdmin.json.version, '2.186.0');
    assert.strictEqual(rAdmin.json.titleZh, '弹窗机制上线');
  });

  await t.test('POST 字段校验：version/titleZh/bodyZh 缺一不可', async () => {
    assert.strictEqual((await req('POST', '/api/admin/updates', adminTok, { titleZh: 'x', bodyZh: 'y' })).status, 400);
    assert.strictEqual((await req('POST', '/api/admin/updates', adminTok, { version: '2.187.0', bodyZh: 'y' })).status, 400);
    assert.strictEqual((await req('POST', '/api/admin/updates', adminTok, { version: '2.187.0', titleZh: 'x' })).status, 400);
  });

  await t.test('POST 同 version 重复 409', async () => {
    const r = await req('POST', '/api/admin/updates', adminTok, { version: '2.186.0', titleZh: '重复', bodyZh: '重复' });
    assert.strictEqual(r.status, 409);
  });

  await t.test('GET /api/updates/latest 发布后返回最新公告（按 createdAt desc，pinned 优先）', async () => {
    // 再发一条更新版本，应排在最新
    await req('POST', '/api/admin/updates', adminTok, {
      version: '2.187.0', titleZh: '又一版', bodyZh: '再次优化。', pinned: true,
    });
    const r = await req('GET', '/api/updates/latest');
    assert.strictEqual(r.status, 200);
    assert.ok(r.json.announcement, '应有公告');
    assert.strictEqual(r.json.announcement.version, '2.187.0');
    assert.strictEqual(r.json.announcement.pinned, true);
    assert.strictEqual(r.json.version, '2.187.0'); // 版本号取最新公告的 version
  });

  await t.test('GET /api/updates/since?version=X 返回比 X 更新的列表', async () => {
    const r = await req('GET', '/api/updates/since?version=2.186.0');
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.json.items));
    assert.strictEqual(r.json.items.length, 1);
    assert.strictEqual(r.json.items[0].version, '2.187.0');
  });

  // 收尾
  server.close();
});
