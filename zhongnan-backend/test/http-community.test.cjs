const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'comm-secret';
process.env.JWT_REFRESH_SECRET = 'comm-refresh';
const { createApp } = require('../dist/server/app.js');
const { createCommunityRouter } = require('../dist/routes/community.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ community: createCommunityRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u1', nickname: '老王' });
mem._seedUser({ id: 'u2', nickname: '小李' });
const H = (uid, level = 'FREE') => ({ 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${signAccess({ sub: uid, level })}` } : {}) });
const post = (path, body, uid) => fetch(base + path, { method: 'POST', headers: H(uid), body: JSON.stringify(body) });

describe('交流广场 HTTP 闭环', { concurrency: 1 }, () => {
  it('未登录发帖 401；列表公开可读', async () => {
    const r = await post('/api/community/posts', { section: 'news', title: 't', body: 'b' }, null);
    assert.strictEqual(r.status, 401);
    // v2.230 分页统一契约：裸数组退役，{ items, total, page, pageSize, limit, offset } 六键
    const j0 = await (await fetch(base + '/api/community/posts')).json();
    assert.ok(Array.isArray(j0.items), '列表键应为 items');
    assert.strictEqual(j0.total, 0, '空库 total 应为 0');
    assert.strictEqual(j0.page, 1);
    assert.strictEqual(j0.pageSize, 50, '默认 pageSize 50');
  });
  it('非法分区 400 / 标题或正文长度不合法 400', async () => {
    const r1 = await post('/api/community/posts', { section: 'nope', title: 't', body: 'b' }, 'u1');
    assert.strictEqual(r1.status, 400);
    const r2 = await post('/api/community/posts', { section: 'news', title: '', body: 'b' }, 'u1');
    assert.strictEqual(r2.status, 400);
  });
  it('违规导向内容 422 拦截（内容安全前置）', async () => {
    const r = await post('/api/community/posts', { section: 'news', title: '标题', body: '这里讲赌博技巧怎么玩' }, 'u1');
    assert.strictEqual(r.status, 422);
  });
  it('正常发帖成功并带作者信息', async () => {
    const r = await post('/api/community/posts', { section: 'experience', title: '我的创作心得', body: '正文内容……' }, 'u1');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.id);
    const list = (await (await fetch(base + '/api/community/posts?section=experience')).json()).items;
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].user.nickname, '老王');
  });
  it('隐藏帖不出现在列表；点赞累加、按热度倒序；不存在帖子点赞404', async () => {
    const a = await (await post('/api/community/posts', { section: 'review', title: 'A', body: 'aa' }, 'u1')).json();
    const b = await (await post('/api/community/posts', { section: 'review', title: 'B', body: 'bb' }, 'u2')).json();
    // 直接把 A 置隐藏、给 B 两个赞
    const pa = mem._posts.find((p) => p.id === a.id); pa.hidden = true;
    await post(`/api/community/posts/${b.id}/like`, {}, 'u1');
    await post(`/api/community/posts/${b.id}/like`, {}, 'u2');
    const list = (await (await fetch(base + '/api/community/posts?section=review')).json()).items;
    assert.strictEqual(list.length, 1, '隐藏帖不得出现');
    assert.strictEqual(list[0].id, b.id);
    assert.strictEqual(list[0].likes, 2);
    const r404 = await post('/api/community/posts/no_such/like', {}, 'u1');
    assert.strictEqual(r404.status, 404);
  });
  it('点赞幂等：同一用户重复点赞只计一次（含并发三发），不产生重复赞行', async () => {
    const p = await (await post('/api/community/posts', { section: 'review', title: 'C', body: 'cc' }, 'u1')).json();
    const [r1, r2, r3] = await Promise.all([
      post(`/api/community/posts/${p.id}/like`, {}, 'u2'),
      post(`/api/community/posts/${p.id}/like`, {}, 'u2'),
      post(`/api/community/posts/${p.id}/like`, {}, 'u2'),
    ]);
    const js = await Promise.all([r1, r2, r3].map(async (r) => {
      assert.strictEqual(r.status, 200, '重复点赞幂等返回 200，不报错');
      return r.json();
    }));
    assert.strictEqual(js.filter((j) => j.liked === true).length, 1, '只有首赞 liked=true');
    assert.deepStrictEqual(js.map((j) => j.likes).sort(), [1, 1, 1], '三个响应赞数恒为 1');
    assert.strictEqual(mem._postLikes.filter((l) => l.postId === p.id && l.userId === 'u2').length, 1);
    const postRow = mem._posts.find((x) => x.id === p.id);
    assert.strictEqual(postRow.likes, 1, '帖子冗余计数字段不得被重复自增');
  });

  // v2.201 取消点赞 + 删除自己帖子
  it('取消点赞：DELETE 扣减计数，未点赞时幂等返回', async () => {
    const p = await (await post('/api/community/posts', { section: 'review', title: 'D', body: 'dd' }, 'u1')).json();
    await post(`/api/community/posts/${p.id}/like`, {}, 'u2');
    const del = await fetch(base + `/api/community/posts/${p.id}/like`, { method: 'DELETE', headers: H('u2') });
    assert.strictEqual(del.status, 200);
    assert.strictEqual((await del.json()).likes, 0);
    // 再次取消幂等
    const del2 = await fetch(base + `/api/community/posts/${p.id}/like`, { method: 'DELETE', headers: H('u2') });
    assert.strictEqual((await del2.json()).likes, 0);
  });

  it('删除帖子：本人可删（hidden），他人 403，列表不再出现', async () => {
    const p = await (await post('/api/community/posts', { section: 'news', title: 'E', body: 'ee' }, 'u1')).json();
    // 他人删除 403
    const other = await fetch(base + `/api/community/posts/${p.id}`, { method: 'DELETE', headers: H('u2') });
    assert.strictEqual(other.status, 403);
    // 本人删除 200
    const r = await fetch(base + `/api/community/posts/${p.id}`, { method: 'DELETE', headers: H('u1') });
    assert.strictEqual(r.status, 200);
    // 列表不再出现
    const list = (await (await fetch(base + '/api/community/posts?section=news')).json()).items;
    assert.ok(!list.some((x) => x.id === p.id));
  });

  // v2.230 分页统一契约：六键全回显、第 2 页可达、total 为过滤后真总数、偏移式别名等价、无效值走默认
  it('分页契约：六键回显 + 翻页可达 + total 真总数 + 偏移式别名 + 无效值默认', async () => {
    const before = await (await fetch(base + '/api/community/posts?section=review&pageSize=100')).json();
    const n0 = before.total;
    for (let i = 0; i < 3; i++) await post('/api/community/posts', { section: 'review', title: `P${i}`, body: 'pp' }, 'u1');
    const r1 = await fetch(base + '/api/community/posts?section=review&page=1&pageSize=2');
    assert.strictEqual(r1.status, 200);
    const j1 = await r1.json();
    for (const k of ['items', 'total', 'page', 'pageSize', 'limit', 'offset']) assert.ok(k in j1, `响应应含 ${k}`);
    assert.strictEqual(j1.page, 1);
    assert.strictEqual(j1.pageSize, 2);
    assert.strictEqual(j1.limit, 2, 'limit 恒等于 pageSize');
    assert.strictEqual(j1.offset, 0);
    assert.strictEqual(j1.items.length, 2);
    assert.strictEqual(j1.total, n0 + 3, 'total 应为该分区过滤后真总数');
    const j2 = await (await fetch(base + '/api/community/posts?section=review&page=2&pageSize=2')).json();
    assert.strictEqual(j2.page, 2);
    assert.strictEqual(j2.offset, 2);
    assert.strictEqual(j2.items.length, Math.min(2, j2.total - 2));
    assert.notStrictEqual(j1.items[0].id, j2.items[0].id, '第 2 页应与第 1 页内容不同');
    // 偏移式别名：limit/offset 换算回页码式回显
    const j3 = await (await fetch(base + '/api/community/posts?section=review&limit=2&offset=2')).json();
    assert.strictEqual(j3.page, 2);
    assert.strictEqual(j3.offset, 2);
    // 无效值走默认（page 1 / pageSize 50），越界页 items 空、total 不变
    const j4 = await (await fetch(base + '/api/community/posts?section=review&page=0&pageSize=-5')).json();
    assert.strictEqual(j4.page, 1);
    assert.strictEqual(j4.pageSize, 50);
    const j5 = await (await fetch(base + '/api/community/posts?section=review&page=999')).json();
    assert.strictEqual(j5.items.length, 0);
    assert.strictEqual(j5.total, j1.total, '越界页 total 不变');
  });
});
