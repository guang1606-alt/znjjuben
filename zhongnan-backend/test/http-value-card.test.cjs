const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
process.env.JWT_ACCESS_SECRET = 'vc-secret';
process.env.JWT_REFRESH_SECRET = 'vc-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u1', level: 'BASIC', penName: '墨白' });
mem._seedUser({ id: 'u2', level: 'FREE' });

function content() {
  let s = '【场景】日内 公司\n【人物】林晚、陈总\n林晚（冷笑）：你以为我真是保洁？\n';
  for (let i = 0; i < 10; i++) s += '陈总（震惊）：什么？！\n林晚：我占股51%，滚出去。\n反转！打脸！爽点！钩子！名场面！\n';
  return s;
}
before(async () => {
  await mem.project.create({ data: { id: 'pOk', userId: 'u1', title: '价值剧', mode: 'tags', format: 'LIVE_ACTION', tags: ['逆袭', '复仇'],
    bible: { timeline: ['保洁工实为隐藏大股东'] } } });
  for (let e = 1; e <= 3; e++) await mem.script.create({ data: { projectId: 'pOk', epNo: e, title: `第${e}集`, content: content(), wordCount: 300 } });
  await mem.project.create({ data: { id: 'pEmpty', userId: 'u1', title: '空剧', mode: 'tags', format: 'LIVE_ACTION' } });
});
const H = { Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'BASIC' })}` };

describe('v2.69 剧本价值证书端点', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    assert.strictEqual((await fetch(base + '/api/generate/projects/pOk/value-card')).status, 401);
  });
  it('无分集 400', async () => {
    const r = await fetch(base + '/api/generate/projects/pEmpty/value-card', { headers: H });
    assert.strictEqual(r.status, 400);
  });
  it('返回证书：含指数/等级/区间/分享文案，且分享不含正文', async () => {
    const r = await fetch(base + '/api/generate/projects/pOk/value-card', { headers: H });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.ok);
    const c = j.card;
    assert.strictEqual(c.episodes, 3);
    assert.ok(['S', 'A', 'B', 'C'].includes(c.grade));
    assert.ok(c.valueIndex >= 0 && c.valueIndex <= 100);
    assert.ok(c.band && c.band.marketEstimated === true);
    assert.strictEqual(c.band.totalLow, c.band.perEpLow * 3);
    assert.ok(c.penName === '墨白');
    assert.ok(!c.shareTextZh.includes('滚出去'), '分享文案不得含正文台词');
    assert.ok(c.shareTextZh.includes('价值剧'));
    assert.ok(c.disclaimerZh.includes('非报价'));
  });
  it('英文参数：平台生成层零中文、用英文品牌名（用户自填中文标题/梗概属用户内容不译）', async () => {
    const r = await fetch(base + '/api/generate/projects/pOk/value-card?lang=en', { headers: H });
    const c = (await r.json()).card;
    const cjk = /[一-鿿]/;
    assert.ok(!cjk.test(c.gradeEn));
    assert.ok(!cjk.test(c.disclaimerEn));
    assert.ok(!c.dimensions.some((d) => cjk.test(d.labelEn)));
    assert.ok(c.shareTextEn.includes('ZhongnanJi'));
    // 分享文案嵌入用户自填的中文标题/标签/笔名/梗概（属用户内容，确定性层不翻译）；
    // 剔除全部用户字段后，平台模板部分必须零中文
    let tpl = c.shareTextEn;
    [c.title, '保洁工实为隐藏大股东', '墨白', ...['逆袭', '复仇']].forEach((u) => { tpl = tpl.split(u).join(''); });
    assert.ok(!cjk.test(tpl), '剔除用户内容后英文模板零中文');
  });
  it('他人项目 404', async () => {
    const r = await fetch(base + '/api/generate/projects/pOk/value-card', { headers: { Authorization: `Bearer ${signAccess({ sub: 'u2', level: 'FREE' })}` } });
    assert.strictEqual(r.status, 404);
  });
});
