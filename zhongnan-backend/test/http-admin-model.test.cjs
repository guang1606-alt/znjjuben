const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'am-test-secret';
process.env.JWT_REFRESH_SECRET = 'am-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO', isAdmin: false });
mem._seedUser({ id: 'subadm', phone: '13000000009', level: 'PRO', isAdmin: true }); // 副管理员：身份标记仍在，但 2026-09-29 起后台 403
mem._seedUser({ id: 'u_norm', level: 'BASIC' });

const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const get = async (p, uid, level) => { const r = await fetch(base + p, { headers: uid ? H(uid, level) : {} }); return { s: r.status, j: await r.json().catch(() => null) }; };
const put = async (p, uid, level, body) => { const r = await fetch(base + p, { method: 'PUT', headers: H(uid, level), body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) }; };
// 五档骨架，未提供的档给空对象
const skeleton = (over = {}) => ({
  text: { economy: {}, standard: {}, flagship: {}, ...(over.text || {}) },
  image: { standard: {}, flagship: {}, ...(over.image || {}) },
});

describe('管理员模型密钥配置（脱敏/加密/不误清空）', { concurrency: 1 }, () => {
  it('未登录 GET 401', async () => assert.strictEqual((await get('/api/admin/model/')).s, 401));
  it('普通用户 GET 403', async () => assert.strictEqual((await get('/api/admin/model/', 'u_norm', 'BASIC')).s, 403));

  it('超管初始 GET：五档齐全、hasKey=false、无明文', async () => {
    const { s, j } = await get('/api/admin/model/', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    for (const tier of ['economy', 'standard', 'flagship']) assert.ok(j.text[tier]);
    for (const tier of ['standard', 'flagship']) assert.ok(j.image[tier]);
    assert.strictEqual(j.text.standard.hasKey, false);
    assert.ok(!JSON.stringify(j).includes('sk-'));
  });

  it('PUT 保存文本标准档+图片旗舰档(gpt-image-1)，回显仅脱敏掩码、绝无明文', async () => {
    const body = skeleton({
      text: { standard: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', apiKey: 'sk-secret-xyz-123' } },
      image: { flagship: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1', apiKey: 'img-secret-abc' } },
    });
    const { s, j } = await put('/api/admin/model/', 'admin1', 'PRO', body);
    assert.strictEqual(s, 200); assert.strictEqual(j.ok, true);
    assert.strictEqual(j.masked.text.standard.hasKey, true);
    assert.strictEqual(j.masked.text.standard.model, 'gpt-4.1-mini');
    assert.strictEqual(j.masked.image.flagship.model, 'gpt-image-1');
    assert.ok(j.masked.text.standard.keyMask.includes('•'));
    assert.ok(!JSON.stringify(j).includes('sk-secret-xyz-123'));
    assert.ok(!JSON.stringify(j).includes('img-secret-abc'));
  });

  it('只改 model、密钥字段缺省时，原密钥保留不被清空（回归 merge 隐患）', async () => {
    const before = (await get('/api/admin/model/', 'admin1', 'PRO')).j.text.standard;
    assert.strictEqual(before.hasKey, true);
    const prevMask = before.keyMask;
    const body = skeleton({ text: { standard: { baseUrl: before.baseUrl, model: 'gpt-4.1' } } }); // 不传 apiKey
    const { s } = await put('/api/admin/model/', 'admin1', 'PRO', body);
    assert.strictEqual(s, 200);
    const after = (await get('/api/admin/model/', 'admin1', 'PRO')).j.text.standard;
    assert.strictEqual(after.model, 'gpt-4.1');
    assert.strictEqual(after.hasKey, true, '缺省 apiKey 不得清空已存密钥');
    assert.strictEqual(after.keyMask, prevMask, '密钥掩码应保持不变');
  });

  it('普通用户 PUT 403', async () => {
    const { s } = await put('/api/admin/model/', 'u_norm', 'BASIC', skeleton());
    assert.strictEqual(s, 403);
  });
});

describe('每周API盘点 HTTP（仅管理员）', { concurrency: 1 }, () => {
  const M = '/api/admin/model';
  it('普通用户盘点 403', async () => {
    const r = await fetch(base + M + '/portfolio/audit', { method: 'POST', headers: H('u_norm', 'BASIC'), body: '{}' });
    assert.strictEqual(r.status, 403);
  });
  it('管理员盘点 → healthy 且留存报告，再查最近报告', async () => {
    const r = await fetch(base + M + '/portfolio/audit', { method: 'POST', headers: H('admin1', 'PRO'), body: '{}' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.report.healthy, true);
    assert.strictEqual(j.report.summary.block, 0);
    assert.ok(j.reportId);
    const g = await get(M + '/portfolio/audit-report', 'admin1', 'PRO');
    assert.strictEqual(g.s, 200);
    assert.ok(g.j.latest && g.j.latest.kind === 'WEEKLY_MODEL');
  });
});

describe('2026-09-29 超管一人独大：副管理员模型后台一律 403', { concurrency: 1 }, () => {
  const M = '/api/admin/model';
  it('副管 GET 模型配置 403 needSuperAdmin', async () => {
    const { s, j } = await get(M + '/', 'subadm', 'PRO');
    assert.strictEqual(s, 403);
    assert.strictEqual(j.needSuperAdmin, true);
  });
  it('副管 GET 组合全景 403', async () => {
    assert.strictEqual((await get(M + '/portfolio', 'subadm', 'PRO')).s, 403);
  });
  it('副管 POST 每日体检 ACK 403（高危留痕动作）', async () => {
    const r = await fetch(base + M + '/portfolio/review/ack', { method: 'POST', headers: H('subadm', 'PRO'), body: '{}' });
    assert.strictEqual(r.status, 403);
  });
});

describe('v2.187 每日API选型体检 HTTP（仅管理员）', { concurrency: 1 }, () => {
  const M = '/api/admin/model';
  it('普通用户查看体检 403', async () => {
    const r = await fetch(base + M + '/portfolio/review', { headers: H('u_norm', 'BASIC') });
    assert.strictEqual(r.status, 403);
  });
  it('超管查看：无 ACK 时以 2026-08-01 基准日亮 overdue，附清单与厂商链接', async () => {
    const { s, j } = await get(M + '/portfolio/review', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.status.baseDate, '2026-08-01');
    assert.ok(j.status.daysSinceReview >= 14, '距基准日已逾 14 天');
    assert.strictEqual(j.status.level, 'overdue');
    assert.ok(j.status.checklist.length >= 5);
    assert.ok(j.status.vendors.length >= 8);
  });
  it('超管 ACK 后状态归零 fresh、checkedToday；同日 run 首次落库、再次 skipped 幂等', async () => {
    const ack = await fetch(base + M + '/portfolio/review/ack', { method: 'POST', headers: H('admin1', 'PRO'), body: '{}' });
    assert.strictEqual(ack.status, 200);
    const aj = await ack.json();
    assert.strictEqual(aj.ok, true);
    assert.strictEqual(aj.status.level, 'fresh');
    assert.strictEqual(aj.status.checkedToday, true);

    const g = await get(M + '/portfolio/review', 'admin1', 'PRO');
    assert.strictEqual(g.j.status.level, 'fresh');
    assert.ok(g.j.lastAckAt);

    const run1 = await fetch(base + M + '/portfolio/review/run', { method: 'POST', headers: H('admin1', 'PRO'), body: '{}' });
    assert.strictEqual(run1.status, 200);
    const r1 = await run1.json();
    assert.ok(r1.reportId, '当天首次手动补跑应落库');

    const run2 = await fetch(base + M + '/portfolio/review/run', { method: 'POST', headers: H('admin1', 'PRO'), body: '{}' });
    const r2 = await run2.json();
    assert.strictEqual(r2.skipped, true, '同日重复补跑必须幂等');
  });
});

describe('v2.41 供应商池/九岗路由/组合全景', { concurrency: 1 }, () => {
  const M = '/api/admin/model';
  it('普通用户访问组合全景 403', async () => {
    const r = await fetch(base + M + '/portfolio', { headers: H('u_norm', 'BASIC') });
    assert.strictEqual(r.status, 403);
  });
  it('GET /portfolio：顺序自检零错误、8岗建议、4等级×3档铁底表、图片端口含gpt_image、6条FAQ、v2.51国产替补自检ok', async () => {
    const { s, j } = await get(M + '/portfolio', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j.orderErrors, []);
    assert.strictEqual(j.order[0].key, 'market_pre', '市场前置必须排第一');
    assert.strictEqual(j.advice.length, 8);
    assert.strictEqual(j.floorChecks.length, 12);
    assert.ok(j.floorChecks.every((f) => typeof f.ok === 'boolean'));
    assert.ok(j.imageCatalog.some((m) => m.id === 'gpt_image'));
    assert.ok(j.imageCatalog.length >= 8, '图片模型端口不少于8家');
    assert.strictEqual(j.faq.length, 7);
    assert.ok(j.backupSelfCheck && j.backupSelfCheck.ok === true);
    assert.deepStrictEqual(j.backupSelfCheck.issues, []);
    assert.ok(j.routingCoverage.length === 9);
  });
  it('目录型号免填 BaseUrl 也能保存供应商，回显脱敏无明文', async () => {
    const body = {
      name: '火山豆包-成稿', modality: 'text', catalogId: 'doubao_seedflash',
      baseUrl: '', model: 'doubao-seed-2-flash', apiKey: 'sk-volc-secret-999',
      inYuanPerMTok: 0.8, outYuanPerMTok: 2, enabled: true,
    };
    const r = await fetch(base + M + '/providers', { method: 'PUT', headers: H('admin1', 'PRO'), body: JSON.stringify(body) });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.masked.providers.length, 1);
    assert.ok(j.masked.providers[0].apiKey.includes('•'));
    assert.ok(!JSON.stringify(j).includes('sk-volc-secret-999'));
  });
  it('缺名称的供应商 400', async () => {
    const body = { name: '', modality: 'text', model: 'x', apiKey: 'k' };
    const r = await fetch(base + M + '/providers', { method: 'PUT', headers: H('admin1', 'PRO'), body: JSON.stringify(body) });
    assert.strictEqual(r.status, 400);
  });
  it('路由 architect→该供应商后覆盖体检为 routed；删除供应商自动解绑回 fallback', async () => {
    const list = (await get(M + '/providers', 'admin1', 'PRO')).j;
    const pid = list.providers[0].id;
    let r = await fetch(base + M + '/routing', { method: 'PUT', headers: H('admin1', 'PRO'), body: JSON.stringify({ architect: pid, writer: 'pv_not_exist' }) });
    assert.strictEqual(r.status, 200);
    let j = await r.json();
    assert.strictEqual(j.masked.routing.architect, pid);
    assert.ok(!('writer' in j.masked.routing), '悬空路由必须被服务端丢弃');
    const pf = (await get(M + '/portfolio', 'admin1', 'PRO')).j;
    const arch = pf.routingCoverage.find((x) => x.role === 'architect');
    assert.strictEqual(arch.state, 'routed');
    assert.ok(pf.routedCostFenPerEp >= 0);
    r = await fetch(base + M + `/providers/${pid}`, { method: 'DELETE', headers: H('admin1', 'PRO') });
    assert.strictEqual(r.status, 200);
    j = await r.json();
    assert.strictEqual(j.masked.providers.length, 0);
    assert.ok(!j.masked.routing.architect, '删供应商必须自动解绑岗位');
  });
});

describe('v2.53 全量API清单', { concurrency: 1 }, () => {
  it('GET /api-directory：超管可取，覆盖零缺失，含三档岗位链接与基础设施层', async () => {
    const { s, j } = await get('/api/admin/model/api-directory', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j.coverage.missing, []);
    assert.ok(j.text.length >= 8 && j.image.length >= 8 && j.infra.length >= 10);
    assert.strictEqual(j.tiers.length, 4);  // v2.54：3档全国产 + 海外档预留
    const arch = j.tiers[2].roles.find((r) => r.role === 'architect');  // tiers[2] = flagship（全国产）
    assert.ok(arch.primary.consoleUrl.startsWith('https://'));
    assert.ok(arch.backups.every((b) => b.region === 'domestic' || b.region === 'local'));
  });
});

describe('v2.54 API清单 docx 下载', { concurrency: 1 }, () => {
  it('超管下载得到 docx 二进制，普通用户 403', async () => {
    const r = await fetch(base + '/api/admin/model/api-directory/docx', { headers: H('admin1', 'PRO') });
    assert.strictEqual(r.status, 200);
    assert.ok((r.headers.get('content-type') || '').includes('wordprocessingml'));
    const buf = Buffer.from(await r.arrayBuffer());
    assert.strictEqual(buf.slice(0, 2).toString(), 'PK');
    assert.ok(buf.length > 8000);
    const r2 = await fetch(base + '/api/admin/model/api-directory/docx', { headers: { Authorization: signAccess({ sub: 'u_x', level: 'PRO' }) } });
    assert.strictEqual(r2.status, 403);
  });
});
