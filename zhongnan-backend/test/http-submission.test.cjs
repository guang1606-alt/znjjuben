const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'sub-secret';
process.env.JWT_REFRESH_SECRET = 'sub-refresh';
const { createApp } = require('../dist/server/app.js');
const { createSubmissionRouter } = require('../dist/routes/submission.js');

const app = createApp({ submission: createSubmissionRouter() });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const M = '/api/submission';
const get = (p) => fetch(base + M + p).then((r) => r.json());

describe('投稿与变现通道', { concurrency: 1 }, () => {
  it('channels 返回全量通道 + 未核验计数', async () => {
    const j = await get('/channels');
    assert.ok(Array.isArray(j.channels) && j.channels.length >= 10);
    assert.ok(j.unverified > 0, '当前全部通道联系方式待运营核验，unverified 应 > 0');
    // 诚信铁律：未核验通道 verifiedAt 必须为 null
    assert.ok(j.channels.every((c) => c.contact.verifiedAt === null));
  });

  it('match 按标签命中：情感+逆袭 应返回含这些标签的通道且按命中数排序', async () => {
    const j = await get('/match?tags=' + encodeURIComponent('情感,逆袭') + '&count=3');
    assert.strictEqual(j.matches.length, 3);
    // 第一条命中数 >= 最后一条
    assert.ok(j.matches[0].matched.length >= j.matches[2].matched.length);
    // 每条都带 matched 与 verified 字段
    j.matches.forEach((c) => {
      assert.ok(Array.isArray(c.matched));
      assert.strictEqual(typeof c.verified, 'boolean');
    });
  });

  it('match region=overseas 只返回出海通道', async () => {
    const j = await get('/match?region=overseas&count=10');
    assert.ok(j.matches.every((c) => c.region === 'overseas'));
  });

  it('match count 上限 12，非法 count 回退默认 5', async () => {
    const j1 = await get('/match?count=99');
    assert.ok(j1.matches.length <= 12);
    const j2 = await get('/match?count=abc');
    assert.strictEqual(j2.query.count, 5);
  });
});
