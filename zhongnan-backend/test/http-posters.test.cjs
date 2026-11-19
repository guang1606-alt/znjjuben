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
mem._seedUser({ id: 'pages', balance: 0 });
mem._seedUser({ id: 'cursor', balance: 0 });
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

  // v2.543 静默截断修复：旧实现固定 60 张且不告诉前端还有没有，超过 60 张的旧海报既看不到也删不掉
  it('列表分页：limit/offset 生效，返回 total 与 hasMore', async () => {
    for (let i = 0; i < 5; i++) {
      await mem.mediaAsset.create({
        data: { userId: 'pages', kind: 'poster', mime: 'image/png', size: i + 1, bytes: Buffer.alloc(i + 1), createdAt: new Date(Date.now() - i * 1000) },
      });
    }
    const q = (qs) => fetch(base + '/api/va/posters' + qs, { headers: H('pages') }).then((r) => r.json());
    const p1 = await q('?limit=2');
    assert.strictEqual(p1.items.length, 2);
    assert.strictEqual(p1.total, 5, '必须回传总数，前端才知道还有多少');
    assert.strictEqual(p1.hasMore, true);
    const p2 = await q('?limit=2&offset=4');
    assert.strictEqual(p2.items.length, 1);
    assert.strictEqual(p2.hasMore, false);
    const p3 = await q('?limit=999');
    assert.strictEqual(p3.items.length, 5, 'limit 超上限只做截断，不得改变数据');
  });

  // v2.551 游标分页：offset 分页在「翻页期间有新图插入」时会重复返回已看过的卡片，
  // 并发（另一端生成海报）正是本列表最常见的写入时序；改用 (createdAt,id) 键集游标，插入/删除都不重不漏。
  it('列表游标分页：翻页期间新图插入也不重复、不跳过', async () => {
    const seeded = [];
    for (let i = 0; i < 5; i++) {
      seeded.push(await mem.mediaAsset.create({
        data: { userId: 'cursor', kind: 'poster', mime: 'image/png', size: i + 1, bytes: Buffer.alloc(i + 1), createdAt: new Date(Date.now() - (i + 1) * 1000) },
      }));
    }
    const q = (qs) => fetch(base + '/api/va/posters' + qs, { headers: H('cursor') }).then((r) => r.json());
    const p1 = await q('?limit=2');
    assert.strictEqual(p1.items.length, 2);
    assert.ok(p1.nextCursor, '必须回传 nextCursor，否则前端无法续页');
    assert.ok(p1.items[0].cursor, '每一项都要回传 cursor，删除加载区末端那张后才能就地续页');
    // 翻页途中另一处生成了一张新海报（比所有旧图都新）——offset 分页此时会让第二页重复第一页末张
    await mem.mediaAsset.create({ data: { userId: 'cursor', kind: 'poster', mime: 'image/png', size: 9, bytes: Buffer.alloc(9), createdAt: new Date() } });
    const p2 = await q('?limit=2&cursor=' + encodeURIComponent(p1.nextCursor));
    assert.strictEqual(p2.items.length, 2);
    const paged = [...p1.items, ...p2.items].map((x) => x.id);
    assert.strictEqual(new Set(paged).size, paged.length, '翻页不得重复返回同一张');
    assert.deepStrictEqual(paged, seeded.slice(0, 4).map((r) => r.id), '第二页应是原始第 3/4 张（新图插最前也不得跳过）');
    const p3 = await q('?limit=2&cursor=' + encodeURIComponent(p2.nextCursor));
    assert.strictEqual(p3.items.length, 1);
    assert.strictEqual(p3.hasMore, false);
    assert.strictEqual(p3.nextCursor, '', '最后一页 nextCursor 必须为空');
  });

  it('游标是脏值时回到第一页（不 500、不空列表）', async () => {
    const d = await fetch(base + '/api/va/posters?limit=2&cursor=not-a-cursor', { headers: H('cursor') }).then((r) => r.json());
    assert.strictEqual(d.items.length, 2, '脏游标应安全退化为第一页，不能把用户列表变成空白');
  });

  it('前端「我的海报」使用游标续页并去重，且保留加载更多入口', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
    assert.ok(app.includes("'?cursor=' + encodeURIComponent(myPostersCursor)"), '请求必须带游标续页，否则永远只看得到第一页');
    assert.ok(app.includes('d.nextCursor'), '必须用 nextCursor 续页（offset 会重复卡片）');
    assert.ok(app.includes('!seen.has(it.id)'), '追加时必须按 id 去重（并发新图插入不重复卡片）');
    assert.ok(app.includes('data-poster-cursor'), '卡片必须记录自身游标（删除加载区末端后回退续页）');
    assert.match(app, /myPostersMore/, '必须有加载更多按钮接线');
    const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
    assert.match(html, /id="myPostersMore"/, '弹窗内必须有加载更多按钮');
  });
});
