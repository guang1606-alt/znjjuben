const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'tags-secret';
process.env.JWT_REFRESH_SECRET = 'tags-refresh';
const { createApp } = require('../dist/server/app.js');
const { createTagsRouter } = require('../dist/routes/tags.js');

const app = createApp({ tags: createTagsRouter() });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const M = '/api/tags';
const get = (p) => fetch(base + M + p);
const post = (p, body) => fetch(base + M + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

describe('标签能力 HTTP 纵切（检索/维度/智能随机/自检/推荐）', { concurrency: 1 }, () => {
  it('search 毫秒检索：穿书等细分穿越标签可搜到；空 q 返回空数组', async () => {
    const r = await get('/search?q=' + encodeURIComponent('穿书'));
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.results.some((t) => t.name === '穿书'));
    const e = await get('/search?q=');
    assert.deepStrictEqual((await e.json()).results, []);
  });

  it('dimensions 返回12维度与叶子总数', async () => {
    const j = await (await get('/dimensions')).json();
    assert.strictEqual(j.dimensions.length, 12);
    assert.ok(j.total > 600);
  });

  it('leaves 按维度列叶子（热度降序）；非法维度 400', async () => {
    const j = await (await get('/leaves?dim=genre&limit=40')).json();
    assert.strictEqual(j.dim, 'genre');
    assert.ok(j.leaves.length > 20 && j.leaves.length <= 40);
    for (let i = 1; i < j.leaves.length; i++) assert.ok(j.leaves[i - 1].heat >= j.leaves[i].heat, '热度降序');
    const bad = await get('/leaves?dim=nope');
    assert.strictEqual(bad.status, 400);
  });

  it('random 中文：高考时令注入，组合合法、带小南解释', async () => {
    const r = await post('/random', { date: '2026-06-07', maxTags: 8 });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.names.length >= 3 && j.names.length <= 8);
    assert.strictEqual(j.report.missingRequired.length, 0);
    assert.ok(j.injected.some((x) => x.source === 'seasonal'));
    assert.ok(j.xiaonanLines.length >= 1);
  });

  it('random 英文：返回 english.enNames 与海外简报，不套中国时令', async () => {
    const j = await (await post('/random', { locale: 'en', date: '2026-06-07' })).json();
    assert.strictEqual(j.locale, 'en');
    assert.ok(j.english.enNames.length >= 3);
    assert.ok(!j.injected.some((x) => x.source === 'seasonal'));
  });

  it('random 榜单倾斜：红果爆款标签进入组合', async () => {
    const j = await (await post('/random', {
      board: [{ title: '爆款', platform: '红果短剧', tags: ['先婚后爱'], heat: 90, date: new Date().toISOString() }],
    })).json();
    assert.ok(j.injected.some((x) => x.tag === '先婚后爱' && x.source === 'trending'));
  });

  it('validate 识别互斥；recommend 给出互补标签', async () => {
    const v = await (await post('/validate', { names: ['HE圆满', 'BE虐心'] })).json();
    assert.strictEqual(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes('互斥')));
    const rec = await (await post('/recommend', { names: ['草根逆袭'], n: 5 })).json();
    assert.ok(rec.recommend.length >= 1);
  });

  it('脏请求不崩：错误 body 也安全返回', async () => {
    const j = await (await post('/random', { seed: 'notarray', dims: 'xx', profile: null })).json();
    assert.ok(Array.isArray(j.names) && j.names.length >= 3);
  });
});

describe('服务端榜单仓：昨日爆款自动倾斜 + 透明状态 + 过期失效', { concurrency: 1 }, () => {
  const { boardStore } = require('../dist/services/board-store.js');
  after(() => boardStore.clear());

  it('空仓时 board-status 标记未激活，random 不做爆款倾斜', async () => {
    boardStore.clear();
    const s = await (await get('/board-status')).json();
    assert.strictEqual(s.active, false);
    assert.ok(s.note.length > 0);
  });

  it('投喂保鲜榜单后，random 无需前端带 board 即自动倾斜，并由小南说明来源', async () => {
    boardStore.clear();
    const n = boardStore.replace([
      { title: '昨日爆款A', platform: '红果短剧', tags: ['先婚后爱'], heat: 95, date: new Date().toISOString() },
      { title: '示例不该生效', platform: '示例', tags: ['草根逆袭'], heat: 99, date: new Date().toISOString() },
    ], 'unit-test');
    assert.strictEqual(n, 1, '示例条目不入库');
    const s = await (await get('/board-status')).json();
    assert.strictEqual(s.active, true);
    assert.ok(s.platforms.includes('红果短剧'));
    const j = await (await post('/random', { maxTags: 8 })).json(); // 请求体故意不带 board
    assert.ok(j.injected.some((x) => x.tag === '先婚后爱' && x.source === 'trending'), '自动注入仓内爆款方向');
    assert.ok(j.xiaonanLines.some((l) => l.includes('红果') && l.includes('先婚后爱')), '小南透明说明来源');
  });

  it('仓超过保鲜期(7天)自动失效，不再倾斜', async () => {
    boardStore.clear();
    const old = new Date(Date.now() - 9 * 86400000);
    boardStore.replace([{ title: '旧剧', platform: '红果短剧', tags: ['先婚后爱'], heat: 90, date: old }], 'old', old);
    const s = await (await get('/board-status')).json();
    assert.strictEqual(s.active, false, '9天前的仓已过期');
    boardStore.clear();
  });
});
