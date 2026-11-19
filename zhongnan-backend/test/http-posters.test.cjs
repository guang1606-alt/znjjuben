/**
 * v2.538 我的海报（列表 / 删除释放 / 配额硬校验）
 * 背景：v2.536 落库让海报不再裂图，v2.537 把生成物计入存储用量；但没有「看得了、删得掉」的入口，
 * 配额就只能展示不能闭环。本文件守住：只能看/删自己的、删除同时释放用量、空间满时生成前直接拒绝（不扣积分）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'posters-secret';
process.env.JWT_REFRESH_SECRET = 'posters-refresh';
delete process.env.IMAGE_API_KEY; delete process.env.OPENAI_API_KEY;
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // 隔离真实供应商池
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'me', balance: 500 });
mem._seedUser({ id: 'other', balance: 500 });
mem._seedUser({ id: 'full', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });

const seedPoster = (userId, size = 10) => mem.mediaAsset.create({
  data: { userId, kind: 'poster', mime: 'image/png', size, bytes: Buffer.alloc(size) },
});

describe('我的海报：归属 / 删除释放 / 配额硬校验', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    assert.strictEqual((await fetch(base + '/api/va/posters')).status, 401);
  });

  it('列表只返回本人的海报，字段含 url/size/createdAt', async () => {
    await seedPoster('me', 12);
    await seedPoster('other', 99);
    const d = await (await fetch(base + '/api/va/posters', { headers: H('me') })).json();
    assert.ok(d.items.length >= 1);
    assert.ok(d.items.every((x) => typeof x.url === 'string' && x.url.startsWith('/media/')));
    assert.ok(!d.items.some((x) => x.size === 99), '不得看到他人的海报');
  });

  it('删除自己的海报成功，并同步释放存储用量；他人海报 404', async () => {
    const mine = await seedPoster('me', 100);
    await mem.storageObject.create({ data: { userId: 'me', kind: 'poster', bytes: 100, refId: mine.id } });
    const before = await mem.storageObject.aggregate({ where: { userId: 'me', deletedAt: null }, _sum: { bytes: true } });
    const r = await fetch(base + `/api/va/posters/${mine.id}`, { method: 'DELETE', headers: H('me') });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).freedBytes, 100, '应回报释放字节数');
    const after = await mem.storageObject.aggregate({ where: { userId: 'me', deletedAt: null }, _sum: { bytes: true } });
    assert.strictEqual(after._sum.bytes, before._sum.bytes - 100, '删除后用量必须下降');

    const theirs = await seedPoster('other', 5);
    assert.strictEqual((await fetch(base + `/api/va/posters/${theirs.id}`, { method: 'DELETE', headers: H('me') })).status, 404);
  });

  it('存储已满：生成海报在扣积分前即被拒绝（413），积分不变', async () => {
    await mem.project.create({ data: { id: 'p_full', userId: 'full', title: '配额已满项目' } });
    await mem.storageObject.create({ data: { userId: 'full', kind: 'poster', bytes: 500 * 1024 * 1024 } }); // BASIC 基础配额 500MB
    const r = await fetch(base + '/api/va/poster', {
      method: 'POST', headers: H('full'), body: JSON.stringify({ projectId: 'p_full', tier: 'STANDARD' }),
    });
    assert.strictEqual(r.status, 413);
    const j = await r.json();
    assert.strictEqual(j.error, 'STORAGE_QUOTA_EXCEEDED');
    assert.match(j.message, /删除|扩容/, '提示要告诉用户如何释放或扩容');
    assert.strictEqual(mem._accounts.get('full').balance, 500, '拒绝发生在扣费前，积分不得减少');
  });
});
