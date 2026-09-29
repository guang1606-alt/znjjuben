const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
process.env.JWT_ACCESS_SECRET = 'sd-secret';
process.env.JWT_REFRESH_SECRET = 'sd-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { boardStore } = require('../dist/services/board-store.js');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { boardStore.clear(); server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u1', level: 'BASIC', penName: '墨白' });
before(async () => {
  boardStore.clear();
  await mem.user.update({ where: { id: 'u1' }, data: { bio: '东北人，爱写逆袭' } });
  await mem.project.create({ data: { id: 'p1', userId: 'u1', title: '旧作', mode: 'tags', format: 'LIVE_ACTION', tags: ['逆袭'] } });
});
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'BASIC' })}` };
const post = (body) => fetch(base + '/api/generate/smart-defaults', { method: 'POST', headers: H, body: JSON.stringify(body || {}) });

describe('v2.70 立项智能默认端点', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/smart-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 401);
  });

  it('空榜单诚实返回 boardActive=false，含钩子默认与画像历史标签，且免费', async () => {
    const r = await post({ tags: ['逆袭'], lang: 'zh' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.ok);
    assert.strictEqual(j.defaults.boardActive, false);
    assert.strictEqual(j.boardStatus.active, false);
    assert.ok(j.defaults.hookStrategy.id);
    assert.ok(j.defaults.linesZh.some((l) => l.includes('不会编造爆款')));
  });

  it('投喂真实保鲜榜单后：boardActive=true 且方向含 trending', async () => {
    const now = new Date();
    const n = boardStore.replace([{ title: '红果逆袭黑马', platform: '红果短剧', tags: ['逆袭', '扮猪吃虎'], heat: 95, date: now }], 'test', now);
    assert.ok(n >= 1);
    const j = await (await post({ tags: ['逆袭'] })).json();
    assert.strictEqual(j.defaults.boardActive, true);
    assert.strictEqual(j.boardStatus.active, true);
    assert.ok(j.defaults.directions.some((d) => d.source === 'trending'));
  });

  it('英文：linesEn/钩子平台层零中文', async () => {
    const j = await (await post({ tags: ['逆袭'], lang: 'en' })).json();
    const cjk = /[一-鿿]/;
    j.defaults.linesEn.forEach((l) => assert.ok(!cjk.test(l)));
    assert.ok(!cjk.test(j.defaults.hookStrategy.reasonEn));
  });
});
