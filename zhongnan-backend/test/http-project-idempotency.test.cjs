/**
 * v2.540 建项目幂等键（POST /api/generate/projects）
 * 背景：移动端弱网下「请求已发出、响应丢失」很常见，用户重试一次就会多出一个空项目，
 * 还占掉会员项目额度。前端同一次提交（含自动重试）复用同一个 Idempotency-Key，
 * 服务端按「用户 + 键」去重并回既有项目；旧客户端不带键时行为完全不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'proj-idem-secret';
process.env.JWT_REFRESH_SECRET = 'proj-idem-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
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

mem._seedUser({ id: 'u_a', level: 'PRO', balance: 0 });
mem._seedUser({ id: 'u_b', level: 'PRO', balance: 0 });

const post = (uid, body, key) => fetch(base + '/api/generate/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'PRO' })}`, ...(key ? { 'Idempotency-Key': key } : {}) },
  body: JSON.stringify(body),
});
const mine = (uid) => [...mem._projects.values()].filter((p) => p.userId === uid && p.status !== 'deleted');

describe('建项目幂等键', { concurrency: 1 }, () => {
  it('同键重放：返回同一项目并标记 idempotent，不新增行', async () => {
    const r1 = await post('u_a', { title: '幂等项目', mode: 'tag' }, 'k-same');
    assert.strictEqual(r1.status, 200);
    const p1 = await r1.json();
    assert.ok(p1.id);
    assert.ok(!p1.idempotent, '首次创建不带 idempotent 标记');

    const r2 = await post('u_a', { title: '幂等项目', mode: 'tag' }, 'k-same');
    assert.strictEqual(r2.status, 200);
    const p2 = await r2.json();
    assert.strictEqual(p2.id, p1.id, '同键必须命中既有项目');
    assert.strictEqual(p2.idempotent, true, '重放要显式告知命中');
    assert.strictEqual(mine('u_a').length, 1, '不得产生第二个项目');
  });

  it('不同键各自建项目', async () => {
    const before = mine('u_a').length;
    const a = await (await post('u_a', { title: 'A', mode: 'tag' }, 'k-1')).json();
    const b = await (await post('u_a', { title: 'B', mode: 'tag' }, 'k-2')).json();
    assert.notStrictEqual(a.id, b.id);
    assert.strictEqual(mine('u_a').length, before + 2);
  });

  it('不带键的旧客户端行为不变：连点两次就是两个项目', async () => {
    const a = await (await post('u_b', { title: '旧客户端', mode: 'tag' })).json();
    const b = await (await post('u_b', { title: '旧客户端', mode: 'tag' })).json();
    assert.notStrictEqual(a.id, b.id);
    assert.strictEqual(mine('u_b').length, 2);
  });

  it('幂等键按用户隔离：另一个用户带同一键仍建自己的项目', async () => {
    const a = await (await post('u_a', { title: '隔离', mode: 'tag' }, 'k-shared')).json();
    const b = await (await post('u_b', { title: '隔离', mode: 'tag' }, 'k-shared')).json();
    assert.notStrictEqual(a.id, b.id, '同一键跨用户不得串号');
  });

  it('重放不重复触发项目数上限校验（已建成功的项目直接回命中）', async () => {
    // FREE 档项目上限 2：先用同键建满，再重放同键必须仍是命中而不是 REACH_PROJECT_LIMIT
    mem._seedUser({ id: 'u_free', level: 'FREE', balance: 0 });
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_free', level: 'FREE' })}` };
    const call = (key) => fetch(base + '/api/generate/projects', { method: 'POST', headers: { ...h, 'Idempotency-Key': key }, body: JSON.stringify({ title: '限额', mode: 'tag' }) });
    assert.strictEqual((await call('free-k1')).status, 200);
    assert.strictEqual((await call('free-k2')).status, 200);
    const replay = await call('free-k1');
    assert.strictEqual(replay.status, 200, '同键重放不得被项目数上限拦成 403');
    assert.strictEqual((await replay.json()).idempotent, true);
  });

  // 前端半边：键要随请求头发出去，且超时/断网必须用同一个键重试一次——否则服务端幂等根本用不上。
  it('前端建项目必须带 Idempotency-Key，且超时/断网同键重试一次', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
    assert.match(src, /'Idempotency-Key': idemKey/, '请求头必须带幂等键');
    assert.match(src, /crypto\.randomUUID/, '键需用随机 UUID（同一次提交内复用，不同提交不同）');
    assert.match(src, /e\.code !== 'TIMEOUT' && e\.code !== 'NETWORK_ERR'/, '只在超时/断网时重试，业务错误不得重放');
    assert.match(src, /pr = await postProject\(\);/, '重试必须复用同一个 postProject（同一个键）');
  });
});
