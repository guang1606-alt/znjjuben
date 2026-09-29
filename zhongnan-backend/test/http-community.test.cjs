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
    const list = await (await fetch(base + '/api/community/posts')).json();
    assert.ok(Array.isArray(list));
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
    const list = await (await fetch(base + '/api/community/posts?section=experience')).json();
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
    const list = await (await fetch(base + '/api/community/posts?section=review')).json();
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
});
