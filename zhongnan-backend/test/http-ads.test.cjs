/**
 * v2.80 广告位路由 HTTP 纵切
 * 公开取位（生效窗口/排序/字段脱敏）、点击静默计数、管理端鉴权与增删改。
 * 使用内存 prisma 桩，不依赖数据库。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ads_access';
process.env.JWT_REFRESH_SECRET = 'ads_refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdsRouter } = require('../dist/routes/ads.js');
const { signAccess } = require('../dist/lib/auth.js');

function fakePrisma() {
  const now = new Date();
  const ads = [
    { id: 'a1', slot: 'home_hero_roll', title: '上线中广告', imageUrl: 'https://x/a.png', linkUrl: 'https://x', badge: '广告', sponsorName: '厂商甲', priceFenDay: 1000, active: true, sort: 1, clicks: 0, createdAt: now, startAt: null, endAt: null },
    { id: 'a2', slot: 'home_hero_roll', title: '排序靠前广告', imageUrl: null, linkUrl: null, badge: '广告', sponsorName: null, priceFenDay: 0, active: true, sort: 0, clicks: 0, createdAt: now, startAt: null, endAt: null },
    { id: 'a3', slot: 'create_done', title: '未开始广告', imageUrl: null, linkUrl: null, badge: '广告', sponsorName: null, priceFenDay: 0, active: true, sort: 0, clicks: 0, createdAt: now, startAt: new Date(Date.now() + 86400000), endAt: null },
    { id: 'a4', slot: 'square_feed', title: '已下线广告', imageUrl: null, linkUrl: null, badge: '广告', sponsorName: null, priceFenDay: 0, active: false, sort: 0, clicks: 0, createdAt: now, startAt: null, endAt: null },
    { id: 'a5', slot: 'square_feed', title: '已结束广告', imageUrl: null, linkUrl: null, badge: '广告', sponsorName: null, priceFenDay: 0, active: true, sort: 0, clicks: 0, createdAt: now, startAt: null, endAt: new Date(Date.now() - 86400000) },
  ];
  return {
    user: {
      async findUnique({ where: { id } }) {
        if (id === 'admin') return { id: 'admin', phone: '18891995171', role: 'USER' };
        if (id === 'u1') return { id: 'u1', phone: '13800000000', role: 'USER' };
        return null;
      },
    },
    advert: {
      async findMany(args) {
        const rows = ads.filter((a) => (!args?.where?.active || a.active === args.where.active)).slice();
        return rows.sort((x, y) => (x.sort - y.sort) || (y.createdAt - x.createdAt));
      },
      async findUnique({ where: { id } }) { return ads.find((a) => a.id === id) ?? null; },
      async create({ data }) { const row = { id: `a${ads.length + 1}`, clicks: 0, createdAt: new Date(), ...data }; ads.push(row); return row; },
      async update({ where: { id }, data }) {
        const row = ads.find((a) => a.id === id);
        if (!row) throw new Error('not found');
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && v.increment) row[k] = (row[k] ?? 0) + v.increment;
          else row[k] = v;
        }
        return row;
      },
      async delete({ where: { id } }) { const i = ads.findIndex((a) => a.id === id); if (i >= 0) ads.splice(i, 1); return {}; },
    },
  };
}

test('广告位路由 HTTP 纵切', async (t) => {
  const mem = fakePrisma();
  const app = createApp({ ads: createAdsRouter(mem) });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
  const userTok = signAccess({ sub: 'u1', level: 'FREE' });
  const req = async (method, path, token, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json };
  };

  await t.test('公开列表：只回生效窗口内广告、按 sort 排序、字段脱敏', async () => {
    const r = await req('GET', '/api/ads');
    assert.strictEqual(r.status, 200);
    const ids = r.json.list.map((a) => a.id);
    assert.deepStrictEqual(ids, ['a2', 'a1']);
    assert.ok(r.json.slots.length >= 4);
    assert.ok(!('active' in r.json.list[0]) && !('priceFenDay' in r.json.list[0]), '不泄露运营字段');
    assert.strictEqual(r.json.list[0].badge, '广告');
  });

  await t.test('slot 过滤：只取该广告位', async () => {
    const r = await req('GET', '/api/ads?slot=square_feed');
    assert.deepStrictEqual(r.json.list.map((a) => a.id), []);
    const r2 = await req('GET', '/api/ads?slot=create_done');
    assert.deepStrictEqual(r2.json.list, [], '未开始广告不展示');
  });

  await t.test('点击计数 +1；广告不存在也静默 200', async () => {
    const r = await req('POST', '/api/ads/a1/click');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.ok, true);
    const r2 = await req('POST', '/api/ads/nope/click');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.json.ok, true);
  });

  await t.test('管理端鉴权：未登录401、普通用户403', async () => {
    assert.strictEqual((await req('GET', '/api/ads/admin/list')).status, 401);
    const r = await req('GET', '/api/ads/admin/list', userTok);
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.json.needAdmin, true);
  });

  await t.test('管理端闭环：创建（默认值）→ 非法参数400 → 更新404/成功 → 列表含下线 → 删除', async () => {
    const created = await req('POST', '/api/ads/admin/create', adminTok, { slot: 'user_side', title: '侧边广告' });
    assert.strictEqual(created.status, 200);
    assert.strictEqual(created.json.badge, '广告');
    assert.strictEqual(created.json.active, true);
    assert.strictEqual(created.json.sort, 0);
    const bad = await req('POST', '/api/ads/admin/create', adminTok, { slot: '', title: '' });
    assert.strictEqual(bad.status, 400);
    const miss = await req('POST', '/api/ads/admin/nope/update', adminTok, { title: 'x' });
    assert.strictEqual(miss.status, 404);
    const upd = await req('POST', '/api/ads/admin/a4/update', adminTok, { active: true, title: '重新上线' });
    assert.strictEqual(upd.status, 200);
    assert.strictEqual(upd.json.active, true);
    const list = await req('GET', '/api/ads/admin/list', adminTok);
    assert.strictEqual(list.status, 200);
    assert.ok(list.json.list.some((a) => a.id === 'a4' && a.title === '重新上线'));
    const del = await req('POST', '/api/ads/admin/a5/delete', adminTok);
    assert.strictEqual(del.status, 200);
    const list2 = await req('GET', '/api/ads/admin/list', adminTok);
    assert.ok(!list2.json.list.some((a) => a.id === 'a5'));
  });

  await new Promise((r) => server.close(r));
});
