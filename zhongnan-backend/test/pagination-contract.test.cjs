/**
 * v2.215 API 分页一致性契约测试（家族铁律）
 * 统一契约：
 *  - 请求：page/pageSize（页码式，主风格）或 limit/offset（偏移式，别名）；混给时 page 优先
 *  - 响应：{ items, total, page, pageSize, limit, offset } —— items 唯一列表键、total 真总数、四元分页信息全回显（limit=pageSize）
 * 覆盖端点：GET /api/admin/users、GET /api/generate/{character,prop,scene}-assets/health、
 *          GET /api/market/listings、GET /api/market/board（total 真总数语义）
 * top-N 端点（/api/tags/*、裸数组橱窗历史形态）不在本契约范围。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'pg_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'pg_refresh_secret_16';
const { parsePageParams } = require('../dist/lib/pagination.js');
const { createApp } = require('../dist/server/app.js');
const { createAdminRouter } = require('../dist/routes/admin.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const MP = require('../dist/lib/model-proxy.js');

// 沙盘隔离：无供应商 → 零真实模型调用
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({
  admin: createAdminRouter(mem),
  generate: createGenerateRouter(mem),
  market: createMarketRouter(mem),
});
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const adminTok = signAccess({ sub: 'admin', level: 'FREE' });
const userTok = signAccess({ sub: 'u1', level: 'BASIC' });
async function req(path, token) {
  const resp = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

// —— 数据沙盘（IIFE 顺序落库：createdAt 语义由内存表插入顺序决定）——
(async () => {
  // admin/users 沙盘：3 用户
  mem._seedUser({ id: 'admin', phone: '18891995171', nickname: '超管' });
  mem._seedUser({ id: 'u1', level: 'BASIC', balance: 100, nickname: '张三' });
  mem._seedUser({ id: 'u2', level: 'FREE', balance: 0, nickname: '李四' });
  // health 沙盘：4 角色资产（创建顺序 = updatedAt 升序 → 列表倒序）
  for (const [i, n] of ['乙', '甲', '丙', '丁'].entries()) {
    await mem.characterAsset.create({ data: { userId: 'u1', name: n, persona: `人设内核${i}` } });
  }
  await mem.propAsset.create({ data: { userId: 'u1', name: '玉佩', persona: '祖传信物' } });
  await mem.sceneAsset.create({ data: { userId: 'u1', name: '祠堂', persona: '宗族空间' } });
  // market 沙盘：3 个在售 listing
  for (const id of ['ls_a', 'ls_b', 'ls_c']) {
    await mem.listing.create({ data: { id, sellerId: 'u1', scriptId: `s_${id}`, title: `剧${id}`, priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ON_SHELF' } });
  }
})();

describe('v2.215 分页统一契约', () => {
  describe('parsePageParams 归一化单元', () => {
    it('页码式主风格：page/pageSize → 四元全量', () => {
      const p = parsePageParams({ page: '3', pageSize: '10' }, { defaultLimit: 20, maxLimit: 100 });
      assert.deepStrictEqual(p, { page: 3, pageSize: 10, limit: 10, offset: 20 });
    });
    it('偏移式别名：limit/offset → 换算 page', () => {
      const p = parsePageParams({ limit: '2', offset: '2' }, { defaultLimit: 50, maxLimit: 200 });
      assert.deepStrictEqual(p, { page: 2, pageSize: 2, limit: 2, offset: 2 });
    });
    it('混给时 page 优先，offset 由 page 推导', () => {
      const p = parsePageParams({ page: '2', pageSize: '5', offset: '99' }, { defaultLimit: 20, maxLimit: 100 });
      assert.strictEqual(p.page, 2);
      assert.strictEqual(p.offset, 5, 'page 优先时 offset=(page-1)*pageSize');
    });
    it('钳制：limit 上限封顶、负 offset 归零、page 下限 1', () => {
      const p = parsePageParams({ limit: '999', offset: '-5' }, { defaultLimit: 50, maxLimit: 200 });
      assert.deepStrictEqual(p, { page: 1, pageSize: 200, limit: 200, offset: 0 });
      const p2 = parsePageParams({ page: '0' }, { defaultLimit: 20, maxLimit: 100 });
      assert.strictEqual(p2.page, 1);
    });
    it('无效值走默认：NaN/0/负 pageSize → defaultLimit', () => {
      for (const bad of [{ limit: 'abc' }, { pageSize: '0' }, { limit: '-3' }, {}]) {
        const p = parsePageParams(bad, { defaultLimit: 50, maxLimit: 200 });
        assert.strictEqual(p.pageSize, 50);
        assert.strictEqual(p.page, 1);
        assert.strictEqual(p.offset, 0);
      }
    });
    it('仅 offset（无 page）：offset 保留、page 由 floor(offset/pageSize)+1 换算', () => {
      const p = parsePageParams({ offset: '7' }, { defaultLimit: 20, maxLimit: 100 });
      assert.strictEqual(p.offset, 7);
      assert.strictEqual(p.page, 1);
      const p2 = parsePageParams({ offset: '20', limit: '10' });
      assert.strictEqual(p2.page, 3);
    });
  });

  describe('GET /api/admin/users（页码式基准端点）', () => {
    it('page/pageSize 全回显 + limit/offset 补齐', async () => {
      const r = await req('/api/admin/users?page=2&pageSize=2', adminTok);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.total, 3);
      assert.strictEqual(r.json.items.length, 1, '第 2 页只剩 1 条');
      assert.strictEqual(r.json.page, 2);
      assert.strictEqual(r.json.pageSize, 2);
      assert.strictEqual(r.json.limit, 2, 'limit=pageSize 回显');
      assert.strictEqual(r.json.offset, 2, 'offset=(page-1)*pageSize');
    });
    it('limit/offset 别名可读并换算 page', async () => {
      const r = await req('/api/admin/users?limit=1&offset=1', adminTok);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.page, 2, 'offset=1,pageSize=1 → page=2');
      assert.strictEqual(r.json.pageSize, 1);
    });
  });

  describe('GET /api/generate/character-assets/health（偏移式 → 统一键名）', () => {
    it('items 统一列表键 + 四元分页回显，healths 键退役', async () => {
      const r = await req('/api/generate/character-assets/health?limit=2&offset=2', userTok);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.total, 4);
      assert.ok(Array.isArray(r.json.items), '列表键统一为 items');
      assert.strictEqual(r.json.items.length, 2);
      assert.strictEqual(r.json.page, 2);
      assert.strictEqual(r.json.pageSize, 2);
      assert.strictEqual(r.json.limit, 2);
      assert.strictEqual(r.json.offset, 2);
      assert.strictEqual(r.json.healths, undefined, '旧键 healths 退役');
    });
    it('钳制契约保持：limit 封顶 200、负 offset 归零', async () => {
      const r = await req('/api/generate/character-assets/health?limit=999&offset=-5', userTok);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.limit, 200);
      assert.strictEqual(r.json.offset, 0);
      assert.strictEqual(r.json.page, 1);
    });
    it('prop/scene 体检同契约', async () => {
      for (const kind of ['prop', 'scene']) {
        const r = await req(`/api/generate/${kind}-assets/health?limit=1`, userTok);
        assert.strictEqual(r.status, 200);
        assert.ok(Array.isArray(r.json.items), `${kind} items 键`);
        assert.strictEqual(r.json.healths, undefined);
        assert.strictEqual(r.json.page, 1);
        assert.strictEqual(r.json.pageSize, 1);
      }
    });
  });

  describe('GET /api/market/listings（裸数组 → 统一包裹）', () => {
    it('包裹形状 + 四元分页回显 + total 真总数', async () => {
      const r = await req('/api/market/listings');
      assert.strictEqual(r.status, 200);
      assert.ok(Array.isArray(r.json.items), '裸数组升级为 items 包裹');
      assert.strictEqual(r.json.total, 3);
      assert.strictEqual(r.json.page, 1);
      assert.strictEqual(r.json.pageSize, 50, '橱窗默认 50 保持前端观感');
      assert.strictEqual(r.json.limit, 50);
      assert.strictEqual(r.json.offset, 0);
    });
    it('limit/offset 分页可用', async () => {
      const r = await req('/api/market/listings?limit=2&offset=1');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.items.length, 2);
      assert.strictEqual(r.json.total, 3);
      assert.strictEqual(r.json.page, 1, 'offset=1,pageSize=2 → floor(1/2)+1=1');
    });
  });

  describe('GET /api/market/board（total 真总数语义修复）', () => {
    it('limit 只裁 items，total 为过滤后真总数', async () => {
      const r = await req('/api/market/board?type=new&limit=2');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.items.length, 2);
      assert.strictEqual(r.json.total, 3, 'total 不再等于本页条数');
    });
  });
});
