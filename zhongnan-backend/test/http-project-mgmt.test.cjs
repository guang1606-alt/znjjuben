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
});
