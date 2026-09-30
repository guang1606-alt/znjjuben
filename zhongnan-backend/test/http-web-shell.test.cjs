const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
process.env.JWT_ACCESS_SECRET = 'web-secret';
process.env.JWT_REFRESH_SECRET = 'web-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });
mem._seedUser({ id: 'u1', level: 'BASIC' });
const tok = signAccess({ sub: 'u1', level: 'BASIC' });

describe('前端站点托管 + 项目创建端点', { concurrency: 1 }, () => {
  it('GET / 返回单页 index.html', async () => {
    const r = await fetch(base + '/');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /html/);
    const html = await r.text();
    assert.match(html, /终南集 · 人工通用智能（AGI）编剧大师/);
    assert.match(html, /progress-view\.js/);
  });
  it('静态资源 styles.css / app.js 可访问', async () => {
    const css = await fetch(base + '/styles.css');
    assert.strictEqual(css.status, 200);
    assert.match(await css.text(), /--accent/);
    const js = await fetch(base + '/progress-view.js');
    assert.strictEqual(js.status, 200);
  });
  it('前端路由任意非 /api 路径回退 index.html（刷新不 404）', async () => {
    const r = await fetch(base + '/studio/some/deep/route', { headers: { Accept: 'text/html' } });
    assert.strictEqual(r.status, 200);
    assert.match(await r.text(), /<!DOCTYPE html>/);
  });
  it('/api 路径不被单页回退吞掉（返回非 HTML）', async () => {
    const r = await fetch(base + '/api/nonexistent-xyz');
    const body = await r.text();
    assert.ok(!/progress-view\.js|终南集 · 人工通用智能（AGI）编剧大师/.test(body), 'API 缺失路由不得回退成单页 index.html');
  });
  it('未登录创建项目 401；登录后创建并在列表中取回', async () => {
    const r0 = await fetch(base + '/api/generate/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 't', mode: 'tags' }) });
    assert.strictEqual(r0.status, 401);
    const r = await fetch(base + '/api/generate/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: '我的逆袭剧', mode: 'tags', totalEps: 20, tags: ['逆袭', '都市'] }),
    });
    assert.strictEqual(r.status, 200);
    const p = await r.json();
    assert.ok(p.id);
    assert.strictEqual(p.mode, 'tags');
    assert.strictEqual(p.totalEps, 20);
    assert.deepStrictEqual(p.tags, ['逆袭', '都市']);
    assert.ok(!Number.isNaN(new Date(p.createdAt).getTime()), '演示项目应模拟 Prisma 的 createdAt 默认值');
    const list = await (await fetch(base + '/api/generate/projects', { headers: { Authorization: `Bearer ${tok}` } })).json();
    assert.ok(list.some((x) => x.id === p.id));
  });
  it('项目参数非法（空标题）400', async () => {
    const r = await fetch(base + '/api/generate/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: '', mode: 'tags' }),
    });
    assert.strictEqual(r.status, 400);
  });
});

mem._seedUser({ id: 'u2', level: 'FREE' });
const tok2 = signAccess({ sub: 'u2', level: 'FREE' });
describe('项目剧本读取端点（作品库/结果正文，归属隔离）', { concurrency: 1 }, () => {
  it('本人可读项目下全部剧本；他人 404；未登录 401；单集他人 403', async () => {
    const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
    const pr = await fetch(base + '/api/generate/projects', { method: 'POST', headers: H, body: JSON.stringify({ title: '可读剧', mode: 'tags' }) });
    const p = await pr.json();
    await mem.script.create({ data: { projectId: p.id, epNo: 1, title: '第一集', synopsis: '梗概', content: '正文ABC', wordCount: 3, qcPassed: true } });
    // 本人列表
    const mine = await fetch(base + `/api/generate/projects/${p.id}/scripts`, { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(mine.status, 200);
    const eps = await mine.json();
    assert.strictEqual(eps.length, 1);
    assert.strictEqual(eps[0].content, '正文ABC');
    assert.strictEqual(eps[0].version, 1, '演示脚本应模拟 Prisma 的 version 默认值');
    // 未登录
    const anon = await fetch(base + `/api/generate/projects/${p.id}/scripts`);
    assert.strictEqual(anon.status, 401);
    // 他人访问项目剧本 → 404
    const other = await fetch(base + `/api/generate/projects/${p.id}/scripts`, { headers: { Authorization: `Bearer ${tok2}` } });
    assert.strictEqual(other.status, 404);
    // 单集：本人 200，他人 403
    const oneMine = await fetch(base + `/api/generate/scripts/${eps[0].id}`, { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(oneMine.status, 200);
    const oneOther = await fetch(base + `/api/generate/scripts/${eps[0].id}`, { headers: { Authorization: `Bearer ${tok2}` } });
    assert.strictEqual(oneOther.status, 403);
  });
});
