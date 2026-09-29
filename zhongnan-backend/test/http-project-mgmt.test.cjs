const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'proj-mgmt-secret';
process.env.JWT_REFRESH_SECRET = 'proj-mgmt-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const UID = 'u_proj_mgmt';
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'FREE' })}` });
const call = (method, path, body) => fetch(base + '/api/generate' + path, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined }).then((r) => r.json().then((j) => ({ status: r.status, j })));

describe('项目管理：重命名 + 软删除', { concurrency: 1 }, () => {
  it('重命名：PUT 更新 title，返回新标题', async () => {
    mem._seedUser({ id: UID, level: 'FREE', balance: 0 });
    mem._projects.set('p1', { id: 'p1', userId: UID, title: '旧标题', status: 'draft' });
    const { status, j } = await call('PUT', '/projects/p1', { title: '新标题' });
    assert.strictEqual(status, 200);
    assert.strictEqual(j.title, '新标题');
  });

  it('重命名：空标题 400，超长标题 400', async () => {
    const r1 = await call('PUT', '/projects/p1', { title: '' });
    assert.strictEqual(r1.status, 400);
    const r2 = await call('PUT', '/projects/p1', { title: 'x'.repeat(81) });
    assert.strictEqual(r2.status, 400);
  });

  it('软删除：DELETE 设 status=deleted，列表不再返回', async () => {
    const { status, j } = await call('DELETE', '/projects/p1');
    assert.strictEqual(status, 200);
    assert.strictEqual(j.ok, true);
    // 列表过滤已删除项目
    const list = await call('GET', '/projects');
    assert.ok(!list.j.some((p) => p.id === 'p1'));
  });

  it('已删除项目：重命名/删除均 404', async () => {
    const r1 = await call('PUT', '/projects/p1', { title: 'x' });
    assert.strictEqual(r1.status, 404);
    const r2 = await call('DELETE', '/projects/p1');
    assert.strictEqual(r2.status, 404);
  });

  it('越权：他人项目不可重命名/删除', async () => {
    mem._projects.set('p2', { id: 'p2', userId: 'other_user', title: '别人的', status: 'draft' });
    const r1 = await call('PUT', '/projects/p2', { title: 'x' });
    assert.strictEqual(r1.status, 404);
    const r2 = await call('DELETE', '/projects/p2');
    assert.strictEqual(r2.status, 404);
  });

  // v2.198 项目克隆
  it('克隆：复制 bible/tags/mode/format，返回新项目，默认标题带"副本"', async () => {
    mem._projects.delete('p1'); // 清理软删除的旧项目，避免触发 FREE 项目数限制（2）
    mem._projects.set('psrc', { id: 'psrc', userId: UID, title: '源项目', mode: 'tags', format: 'LIVE_ACTION', tags: ['都市', '逆袭'], bible: { worldview: '现代' }, status: 'draft' });
    const { status, j } = await call('POST', '/projects/psrc/clone');
    assert.strictEqual(status, 200);
    assert.strictEqual(j.title, '源项目 - 副本');
    assert.strictEqual(j.mode, 'tags');
    assert.strictEqual(j.format, 'LIVE_ACTION');
    assert.deepStrictEqual(j.tags, ['都市', '逆袭']);
    assert.strictEqual(j.clonedFrom, 'psrc');
    // 新项目与源项目 id 不同
    assert.notStrictEqual(j.id, 'psrc');
  });

  it('克隆：可指定新标题', async () => {
    // 清理上一测试产生的克隆项目，避免 FREE 项目数限制（2）
    for (const [k, v] of mem._projects) if (v.userId === UID && k !== 'psrc') mem._projects.delete(k);
    const { status, j } = await call('POST', '/projects/psrc/clone', { title: '我的新本' });
    assert.strictEqual(status, 200);
    assert.strictEqual(j.title, '我的新本');
  });

  it('克隆：源项目不存在 404', async () => {
    const r = await call('POST', '/projects/nonexistent/clone');
    assert.strictEqual(r.status, 404);
  });

  // v2.199 归档/取消归档
  it('归档：status→archived，再传 archive:false 恢复为 active', async () => {
    mem._projects.set('par', { id: 'par', userId: UID, title: '待归档', status: 'draft' });
    const r1 = await call('POST', '/projects/par/archive');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.j.status, 'archived');
    const r2 = await call('POST', '/projects/par/archive', { archive: false });
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.j.status, 'active');
  });

  it('归档：不存在的项目 404', async () => {
    const r = await call('POST', '/projects/nope/archive');
    assert.strictEqual(r.status, 404);
  });

  // v2.200 项目列表搜索/筛选
  it('搜索：?q=按标题模糊匹配，?status=archived 仅返归档', async () => {
    mem._projects.set('pAlpha', { id: 'pAlpha', userId: UID, title: '阿尔法剧本', mode: 'tags', status: 'draft' });
    mem._projects.set('pBeta', { id: 'pBeta', userId: UID, title: '贝塔故事', mode: 'tags', status: 'archived' });
    const all = await call('GET', '/projects');
    assert.ok(all.j.some((p) => p.title === '阿尔法剧本'));
    assert.ok(all.j.some((p) => p.title === '贝塔故事'));
    const byQ = await call('GET', '/projects?q=阿尔法');
    assert.ok(byQ.j.every((p) => p.title.includes('阿尔法')));
    assert.strictEqual(byQ.j.length, 1);
    const archived = await call('GET', '/projects?status=archived');
    assert.ok(archived.j.every((p) => p.status === 'archived'));
  });
});
