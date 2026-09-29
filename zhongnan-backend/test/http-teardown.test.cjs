const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'td-secret';
process.env.JWT_REFRESH_SECRET = 'td-refresh';
const { createApp } = require('../dist/server/app.js');
const { createTeardownRouter } = require('../dist/routes/teardown.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createAdsRouter } = require('../dist/routes/ads.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ teardown: createTeardownRouter(mem), generate: createGenerateRouter(mem), ads: createAdsRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'basic', balance: 1000, level: 'BASIC' });
mem._seedUser({ id: 'pro', balance: 1000, level: 'PRO' });
mem._seedUser({ id: 'poor', balance: 1, level: 'BASIC' });
mem._seedUser({ id: 'free2', balance: 0, level: 'FREE' });
mem._seedUser({ id: 'other', balance: 500, level: 'BASIC' });
mem._seedUser({ id: 'boss', balance: 9999, level: 'PRO', isAdmin: true });
const H = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: level || 'BASIC' })}` });
const post = (p, b, uid, level) => fetch(base + '/api/teardown' + p, { method: 'POST', headers: H(uid, level), body: JSON.stringify(b) });
const get = (p, uid, level) => fetch(base + '/api/teardown' + p, { headers: H(uid, level) });
const postG = (p, b, uid, level) => fetch(base + '/api/generate' + p, { method: 'POST', headers: H(uid, level), body: JSON.stringify(b) });
const getAd = (p) => fetch(base + '/api/ads' + p);
const adPost = (p, b, uid, level) => fetch(base + '/api/ads' + p, { method: 'POST', headers: H(uid, level), body: JSON.stringify(b) });
const bal = (uid) => mem._accounts.get(uid).balance;

const HIT = `第1集
日 内 林家
她被婆家误会偷了项链，婆婆当众羞辱她、逼她净身出户，丈夫背叛她牵着第三者进门。她藏着自己是集团继承人的秘密，决定反击。
她（低声）：今天怎么赶我走，明天我怎么回来。
第2集
日 内 公司
她隐藏身份从保洁做起被嘲讽，谁知当场揭穿假账，第一次打脸众人震惊。
第3集
夜 内 宴会厅
反转不断，她霸气反杀逆袭碾压，真相大白完成清算，夺回一切释然成长。`;

describe('拆爆款 HTTP', () => {
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/teardown/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: HIT }) });
    assert.strictEqual(r.status, 401);
  });

  it('文本太短/只给链接不给正文 → 422 NEED_TEXT，不扣分', async () => {
    const before = bal('basic');
    const r = await post('/analyze', { sourceType: 'video_url', sourceUrl: 'https://x/y' }, 'basic');
    assert.strictEqual(r.status, 422);
    const j = await r.json();
    assert.strictEqual(j.error, 'NEED_TEXT');
    assert.strictEqual(bal('basic'), before);
  });

  it('拆解成功：基础会员扣30积分，返回报告/方向/记录', async () => {
    const before = bal('basic');
    const r = await post('/analyze', { text: HIT, sourceType: 'text' }, 'basic');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.recordId);
    assert.strictEqual(j.points, 30);
    assert.strictEqual(j.directions.length, 3);
    assert.ok(j.report.boomReasons.length >= 5);
    assert.ok(j.report.tagPool.length >= 4);
    assert.strictEqual(bal('basic'), before - 30);
    global.__rec = j.recordId;
  });

  it('专业会员拆解享6折=18积分（不赔钱）', async () => {
    const before = bal('pro');
    const r = await post('/analyze', { text: HIT }, 'pro', 'PRO');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 18);
    assert.strictEqual(bal('pro'), before - 18);
  });

  it('余额不足 400 且不扣分', async () => {
    const before = bal('poor');
    const r = await post('/analyze', { text: HIT }, 'poor');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bal('poor'), before);
  });

  it('生成改编大纲：扣20（基础），返回4段结构', async () => {
    const before = bal('basic');
    const r = await post(`/${global.__rec}/outline`, { pickedTags: ['逆袭', '打脸'], direction: 'swap_persona' }, 'basic');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 20);
    assert.strictEqual(j.outline.arc.length, 4);
    assert.deepStrictEqual(j.outline.pickedTags, ['逆袭', '打脸']);
    assert.strictEqual(bal('basic'), before - 20);
  });

  it('他人记录 403', async () => {
    const r = await post(`/${global.__rec}/outline`, { pickedTags: [], direction: 'flip_view' }, 'other');
    assert.strictEqual(r.status, 403);
  });

  it('确认大纲 → 创建改编项目并置 TO_PROJECT', async () => {
    const r = await post(`/${global.__rec}/to-project`, { title: '我的拆爆款改编' }, 'basic');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.project.mode, 'adapt');
    assert.ok(j.project.tags.includes('拆爆款改编'));
    const rec = mem._teardownRecords?.find((x) => x.id === global.__rec);
    assert.strictEqual(rec.state, 'TO_PROJECT');
  });

  it('我的拆解记录列表：只返摘要（不带 report/outline 大 Json），仅本人记录按时间倒序', async () => {
    const r = await get('/mine', 'basic');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.list.length >= 1);
    for (const row of j.list) {
      assert.strictEqual(row.userId, undefined, '列表不泄露内部字段');
      assert.strictEqual(row.report, undefined, '列表禁止携带 report 大 Json（c195 瘦身）');
      assert.strictEqual(row.outline, undefined, '列表禁止携带 outline 大 Json（c195 瘦身）');
      assert.ok(row.id && row.state && typeof row.pointsCost === 'number');
    }
    // 仅本人：pro 的拆解不得出现在 basic 的列表中
    assert.ok(j.list.every((x) => x.id !== undefined));
    const times = j.list.map((x) => new Date(x.createdAt).getTime());
    assert.deepStrictEqual(times, [...times].sort((a, b) => b - a), '必须按 createdAt 倒序');
  });

  it('详情 GET /:id：owner 取回完整 report/outline/directions 可续作；他人 403；不存在 404；未登录 401', async () => {
    const own = await get(`/${global.__rec}`, 'basic');
    assert.strictEqual(own.status, 200);
    const j = await own.json();
    assert.ok(j.report && j.report.boomReasons.length >= 5, '详情必须带完整拆解报告');
    assert.strictEqual(j.directions.length, 3, '详情随报告重算改编方向（与 analyze 同源）');
    assert.ok(j.outline && j.outline.arc.length === 4, '已生成的大纲必须可恢复');
    assert.strictEqual(j.state, 'TO_PROJECT');

    const other = await get(`/${global.__rec}`, 'other');
    assert.strictEqual(other.status, 403);
    const none = await get('/td_not_exist', 'basic');
    assert.strictEqual(none.status, 404);
    const anon = await fetch(base + `/api/teardown/${global.__rec}`);
    assert.strictEqual(anon.status, 401);
  });
});

describe('拆爆款 幂等与封禁', () => {
  it('同 clientToken 重复拆解 → 409 且只扣一次；换新令牌 → 正常再扣', async () => {
    const before = bal('pro');
    const r1 = await post('/analyze', { text: HIT, clientToken: 'td-token-1' }, 'pro', 'PRO');
    assert.strictEqual(r1.status, 200);
    const r2 = await post('/analyze', { text: HIT, clientToken: 'td-token-1' }, 'pro', 'PRO');
    assert.strictEqual(r2.status, 409);
    assert.strictEqual(bal('pro'), before - 18, '重复提交不得重复扣分');
    const r3 = await post('/analyze', { text: HIT, clientToken: 'td-token-2' }, 'pro', 'PRO');
    assert.strictEqual(r3.status, 200, '换新令牌刻意重拆应放行');
    assert.strictEqual(bal('pro'), before - 36);
  });

  it('被封禁用户即使持有未过期 JWT 也一律 403（以数据库 banned 为准）', async () => {
    const u = mem._users.get('free2');
    u.banned = true;
    const r = await post('/analyze', { text: HIT }, 'free2', 'FREE');
    assert.strictEqual(r.status, 403);
    u.banned = false;
  });
});

describe('会员项目数上限', () => {
  it('免费会员最多2个同时项目，第3个被拦截', async () => {
    const mk = (i) => postG('/projects', { title: `p${i}`, mode: 'tag' }, 'free2', 'FREE');
    assert.strictEqual((await mk(1)).status, 200);
    assert.strictEqual((await mk(2)).status, 200);
    const r3 = await mk(3);
    assert.strictEqual(r3.status, 403);
    const j = await r3.json();
    assert.strictEqual(j.error, 'REACH_PROJECT_LIMIT');
    assert.strictEqual(j.limit, 2);
  });
});

describe('广告位', () => {
  it('超管可建广告，公开接口按位返回、自动带广告标识', async () => {
    const c = await adPost('/admin/create', { slot: 'home_hero_roll', title: 'AIGC工具推广', linkUrl: 'https://x', priceFenDay: 20000 }, 'boss', 'PRO');
    assert.strictEqual(c.status, 200);
    const r = await getAd('/?slot=home_hero_roll');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.list.length, 1);
    assert.strictEqual(j.list[0].title, 'AIGC工具推广');
    assert.ok(j.list[0].badge);
    assert.ok(j.slots.length >= 4); // 四大广告位
  });

  it('非管理员不能建广告 403', async () => {
    const r = await adPost('/admin/create', { slot: 'home_hero_roll', title: 'x' }, 'basic');
    assert.strictEqual(r.status, 403);
  });

  it('下线广告不在公开列表', async () => {
    const created = await (await adPost('/admin/create', { slot: 'user_side', title: '下线我', active: false }, 'boss', 'PRO')).json();
    const r = await getAd('/?slot=user_side');
    const j = await r.json();
    assert.strictEqual(j.list.length, 0);
    assert.ok(created.id);
  });
});
