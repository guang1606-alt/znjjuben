const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
process.env.JWT_ACCESS_SECRET = 'mc-test-secret';
process.env.JWT_REFRESH_SECRET = 'mc-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createOrderRouter } = require('../dist/routes/order.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { validateScript } = require('../dist/engine/script-format.js');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem), order: createOrderRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const H = (uid, level = 'PRO') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const validBody = { age: 28, region: 'CN', purposePersonal: true, noMinorDistribution: true, boundaryAccepted: true, legalSelfResponsible: true };

describe('v2.18 X剧本成年分级授权链路（问卷落库+服务端核验+撤销）', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/mature/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) });
    assert.strictEqual(r.status, 401);
  });
  it('问卷缺项 400（四个 literal(true) 承诺缺一不可）', async () => {
    const r = await fetch(base + '/api/generate/mature/consent', { method: 'POST', headers: H('mc_bad'), body: JSON.stringify({ ...validBody, boundaryAccepted: false }) });
    assert.strictEqual(r.status, 400);
  });
  it('问卷落库但未开通订单：ok=false 且原因含“单独付费”', async () => {
    mem._seedUser({ id: 'mc1', level: 'PRO' });
    const r = await fetch(base + '/api/generate/mature/consent', { method: 'POST', headers: H('mc1'), body: JSON.stringify(validBody) });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.pass, false);
    assert.ok(j.reasons.some((x) => x.includes('付费')));
  });
  it('商品目录含 XSCRIPT_M（99元/月开通）；补支付订单后重新提交即通过，GET 可查', async () => {
    const cat = await (await fetch(base + '/api/order/catalog')).json();
    const sku = cat.items.find((i) => i.sku === 'XSCRIPT_M');
    assert.ok(sku && sku.amountFen === 9900);
    await mem.order.create({ data: { userId: 'mc1', kind: 'VALUE_ADDED', remark: 'X_SCRIPT', amountFen: 9900, status: 'PAID', paidAt: new Date() } });
    const r = await fetch(base + '/api/generate/mature/consent', { method: 'POST', headers: H('mc1'), body: JSON.stringify(validBody) });
    const j = await r.json();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(j.pass, true, JSON.stringify(j.reasons));
    const g = await (await fetch(base + '/api/generate/mature/consent', { headers: H('mc1') })).json();
    assert.strictEqual(g.pass, true); assert.ok(g.latest);
  });
  it('撤销后项目闸门再次 403', async () => {
    await fetch(base + '/api/generate/mature/consent/revoke', { method: 'POST', headers: H('mc1') });
    const g = await (await fetch(base + '/api/generate/mature/consent', { headers: H('mc1') })).json();
    assert.strictEqual(g.pass, false);
  });
});

describe('v2.18 离线达标样例端点（sample-script 技能接线）', () => {
  it('LIVE/AIGC 样例均通过格式闸门且 AIGC 含视听行', async () => {
    for (const fmt of ['LIVE', 'AIGC']) {
      const j = await (await fetch(`${base}/api/generate/sample-script?format=${fmt}`)).json();
      const rep = validateScript(j.script, fmt);
      assert.ok(rep.inRange, `${fmt} 样例字数 ${rep.cjk} 不在区间`);
      assert.strictEqual(rep.pollution.length, 0);
      // v2.33 AIGC 为流畅制作本：不再用【】技术标签，改为流畅自然段 + 自然括号语义
      if (fmt === 'AIGC') assert.ok(!/【景别】|【运镜】/.test(j.script) && /（音效|（内心|（配乐/.test(j.script));
    }
  });

  it('v2.185.14 lang=en 透传英文样例；非法/缺省 lang 回落中文', async () => {
    const en = await (await fetch(`${base}/api/generate/sample-script?format=AIGC&lang=en`)).json();
    assert.strictEqual(en.format, 'AIGC');
    assert.ok(/INT\.|EXT\./.test(en.script), 'lang=en 应返回含英文场标的样例');
    const bad = await (await fetch(`${base}/api/generate/sample-script?lang=xx`)).json();
    assert.ok(/内景|外景/.test(bad.script), '非法 lang 必须回落中文样例，不得透传任意值');
  });
});
