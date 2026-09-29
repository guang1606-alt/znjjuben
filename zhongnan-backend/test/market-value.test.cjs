const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mv-secret';
process.env.JWT_REFRESH_SECRET = 'mv-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'seller', level: 'PRO' });
const M = '/api/market';
const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'seller', level: 'PRO' })}` });
const post = (path, body) => fetch(base + M + path, { method: 'POST', headers: H(), body: JSON.stringify(body ?? {}) });

async function seedEpisodes(pid, n) {
  await mem.project.create({ data: { id: pid, userId: 'seller', title: `剧${pid}`, tags: ['逆袭'] } });
  for (let i = 1; i <= n; i++) {
    await mem.script.create({ data: { id: `${pid}_ep${i}`, projectId: pid, epNo: i, version: 1, title: `第${i}集`, content: `第${i}集正文：女主在暴雨夜冲进会议室，把合同摔在桌上。台词口语化，节奏紧凑，结尾钩子拉满。`.repeat(3) } });
  }
}

describe('v2.72 价值证书接入交易广场', { concurrency: 1 }, () => {
  it('无分集剧本：value-preview 诚实返回 null，不编造价值', async () => {
    await mem.project.create({ data: { id: 'pj_empty', userId: 'seller', title: '空剧本' } });
    await mem.script.create({ data: { id: 's_empty', projectId: 'pj_empty', content: '' } });
    const r = await post('/listings/value-preview', { scriptId: 's_empty' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.value, null);
    assert.strictEqual(j.suggested, null);
    assert.ok(j.note);
  });

  it('有分集剧本：返回价值指数/等级/单集与全集建议区间，佣金率正确', async () => {
    await seedEpisodes('pj_good', 3);
    const r = await post('/listings/value-preview', { scriptId: 'pj_good_ep1' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.value);
    assert.ok(typeof j.value.valueIndex === 'number' && j.value.valueIndex >= 0 && j.value.valueIndex <= 100);
    assert.ok(['S', 'A', 'B', 'C', 'NA'].includes(j.value.grade));
    assert.strictEqual(j.commissionPct, 5); // PRO
    if (j.suggested) {
      assert.strictEqual(j.suggested.episodes, 3);
      assert.strictEqual(j.suggested.totalLowYuan, j.suggested.perEpLowYuan * 3);
      assert.strictEqual(j.suggested.totalHighYuan, j.suggested.perEpHighYuan * 3);
      assert.ok(j.suggested.totalLowYuan > 0);
    }
  });

  it('上架时自动写入价值快照，列表回显等级徽章字段', async () => {
    const r = await post('/listings', { scriptId: 'pj_good_ep1', priceFen: 5000, sample: '样章' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.value);
    assert.strictEqual(j.value.episodes, 3);
    const list = await (await fetch(base + M + '/listings')).json();
    const row = list.find((l) => l.id === j.id);
    assert.ok(row);
    assert.ok(['S', 'A', 'B', 'C', 'NA'].includes(row.valueGrade));
    assert.ok(typeof row.valueIndex === 'number');
    assert.strictEqual(row.valueEpisodes, 3);
  });

  it('未登录调用 value-preview 401', async () => {
    const r = await fetch(base + M + '/listings/value-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 401);
  });

  it('v2.73 兼容 projectId 入参：前端传项目id也能解析到剧本并返回 projectId', async () => {
    const r = await post('/listings/value-preview', { projectId: 'pj_good' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.value);
    assert.strictEqual(j.projectId, 'pj_good');
  });

  it('v2.73 买家详情页 GET /listings/:id：返回完整价值维度+样章，绝不泄露全本', async () => {
    const lr = await post('/listings', { scriptId: 'pj_good_ep1', priceFen: 5000, sample: '详情样章' });
    const lj = await lr.json();
    const r = await fetch(base + M + '/listings/' + lj.id);
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.title, '剧pj_good');
    assert.strictEqual(d.sample, '详情样章');
    assert.ok(d.value);
    assert.ok(Array.isArray(d.value.dimensions) && d.value.dimensions.length >= 6);
    assert.ok(d.value.dimensions.every((x) => typeof x.score === 'number'));
    assert.ok(!('fullText' in d));
    assert.ok(!('content' in d));
    assert.ok(d.disclaimer);
  });

  it('v2.73 买家详情页：不存在返回 404', async () => {
    const r = await fetch(base + M + '/listings/nonexistent');
    assert.strictEqual(r.status, 404);
  });
});
