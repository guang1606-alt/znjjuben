/**
 * v2.574 广告位运维与投放数据的静默失败收口
 * ① 管理端删除广告：旧实现 `.catch(() => null)` 把数据库错误也当成功——管理员以为已下线，广告实际还在投放；
 * ② 点击计数：计数失败可以不影响跳转，但除「广告已删除」(P2025) 外的失败必须留痕，否则投放点击长期少计。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ads2_access';
process.env.JWT_REFRESH_SECRET = 'ads2_refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdsRouter } = require('../dist/routes/ads.js');
const { signAccess } = require('../dist/lib/auth.js');

function fakePrisma(overrides = {}) {
  const ads = [
    { id: 'a1', slot: 'home_hero_roll', title: '在投广告', imageUrl: null, linkUrl: 'https://x', badge: '广告', sponsorName: null, priceFenDay: 0, active: true, sort: 0, clicks: 3, createdAt: new Date(), startAt: null, endAt: null },
  ];
  return {
    user: {
      async findUnique({ where: { id } }) {
        if (id === 'admin') return { id: 'admin', phone: '18891995171', role: 'USER' };
        return { id, phone: '13800000000', role: 'USER' };
      },
    },
    advert: {
      async findMany() { return ads.slice(); },
      async findUnique({ where: { id } }) { return ads.find((a) => a.id === id) ?? null; },
      async create({ data }) { const row = { id: 'a9', clicks: 0, createdAt: new Date(), ...data }; ads.push(row); return row; },
      async update(args) {
        if (overrides.updateThrows) throw Object.assign(new Error('write down'), { code: overrides.updateThrows });
        const row = ads.find((a) => a.id === args.where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        row.clicks += args.data?.clicks?.increment ?? 0;
        return row;
      },
      async delete({ where: { id } }) {
        if (overrides.deleteThrows) throw Object.assign(new Error('delete down'), { code: overrides.deleteThrows });
        const i = ads.findIndex((a) => a.id === id);
        if (i < 0) throw Object.assign(new Error('not found'), { code: 'P2025' });
        ads.splice(i, 1);
        return {};
      },
    },
  };
}

async function boot(prisma) {
  const app = createApp({ ads: createAdsRouter(prisma) });
  const server = app.listen(0);
  await new Promise((res) => { const d = () => res(); if (server.listening) return d(); server.once('listening', d); });
  return { base: `http://127.0.0.1:${server.address().port}`, server };
}

async function capture(method, url, token) {
  const logs = [];
  const orig = console.error;
  console.error = (...a) => { logs.push(a.map(String).join(' ')); };
  try {
    const res = await fetch(url, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    let json = null; try { json = await res.json(); } catch { /* 非 JSON */ }
    return { status: res.status, json, logs };
  } finally { console.error = orig; }
}

describe('广告删除与点击计数留痕（v2.574）', { concurrency: 1 }, () => {
  const admin = signAccess({ sub: 'admin', level: 'FREE' });

  it('管理员删除广告遇数据库错误：如实 500 可重试 + [ads.delete] 留痕（不得谎报已下线）', async () => {
    const p = fakePrisma({ deleteThrows: 'P2010' });
    const { base, server } = await boot(p);
    try {
      const r = await capture('POST', `${base}/api/ads/admin/a1/delete`, admin);
      assert.strictEqual(r.status, 500);
      assert.strictEqual(r.json.error, '删除失败，请重试');
      assert.ok(r.logs.some((l) => l.includes('[ads.delete]')), '失败必须留痕');
      assert.ok(await p.advert.findUnique({ where: { id: 'a1' } }), '广告仍在投放，与报错一致');
    } finally { await new Promise((r) => server.close(r)); }
  });

  it('删除本就不存在的广告：按幂等成功返回，不误报 500', async () => {
    const { base, server } = await boot(fakePrisma());
    try {
      const r = await capture('POST', `${base}/api/ads/admin/nope/delete`, admin);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ok, true);
      assert.ok(!r.logs.some((l) => l.includes('[ads.delete]')), '查无此广告不算故障，不刷日志');
    } finally { await new Promise((r) => server.close(r)); }
  });

  it('点击计数写入失败：跳转仍回 ok，但留痕 [ads.click]', async () => {
    const { base, server } = await boot(fakePrisma({ updateThrows: 'P2010' }));
    try {
      const r = await capture('POST', `${base}/api/ads/a1/click`);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ok, true, '计数失败不影响用户跳转');
      assert.ok(r.logs.some((l) => l.includes('[ads.click]')), '点击丢失必须可观测');
    } finally { await new Promise((r) => server.close(r)); }
  });

  it('点击已删除广告（P2025，客户端缓存旧 id）：静默 200，不刷日志', async () => {
    const { base, server } = await boot(fakePrisma());
    try {
      const r = await capture('POST', `${base}/api/ads/gone/click`);
      assert.strictEqual(r.status, 200);
      assert.ok(!r.logs.some((l) => l.includes('[ads.click]')), '过期 id 属正常现象');
    } finally { await new Promise((r) => server.close(r)); }
  });
});
