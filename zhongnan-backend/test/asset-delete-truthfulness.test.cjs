/**
 * v2.584 资产删除失败不得回 ok。
 *
 * 背景（先证伪）：角色 / 道具 / 场景三族资产的 DELETE 路由都是
 * `await prisma.xxxAsset.delete(...).catch(() => null); res.json({ ok: true })`——
 * 数据库瞬时错误时前端把卡片从列表移除并提示「已删除」，刷新后资产又回来了；
 * 用户以为删干净了，实际上信物/角色仍在参与创作注入与资产体检。
 * 与 v2.574 广告下线同族：仅「本就查无此资产」(P2025，例如另一标签页已删) 按幂等成功返回；
 * 其余失败必须 500「删除失败，请重试」并 logInternal，可重试。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'asset-del-secret';
process.env.JWT_REFRESH_SECRET = 'asset-del-refresh';
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

mem._seedUser({ id: 'u_del', phone: '13900001111' });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_del', level: 'PRO' })}` };
const del = (path) => fetch(base + path, { method: 'DELETE', headers: H });

const FAMILIES = [
  { key: 'character', path: '/api/generate/character-assets', list: '_characterAssets', model: 'characterAsset', err: 'CAST_ASSET_NOT_FOUND', row: { name: '林晚', persona: '克制隐忍' } },
  { key: 'prop', path: '/api/generate/prop-assets', list: '_propAssets', model: 'propAsset', err: 'PROP_ASSET_NOT_FOUND', row: { name: '铜镜', meaning: '亡母遗物' } },
  { key: 'scene', path: '/api/generate/scene-assets', list: '_sceneAssets', model: 'sceneAsset', err: 'SCENE_ASSET_NOT_FOUND', row: { name: '雨夜码头', meaning: '第一次交易' } },
];

function seedAsset(f, id) {
  const row = { id, userId: 'u_del', usedCount: 0, ...f.row, createdAt: new Date(), updatedAt: new Date() };
  mem[f.list].push(row);
  return row;
}
/** 让指定资产的 delete 抛错（模拟数据库故障或并发已删），返回还原函数 */
function failDeleteFor(f, id, err) {
  const orig = mem[f.model].delete;
  mem[f.model].delete = async (args) => {
    if (args?.where?.id === id) throw err;
    return orig(args);
  };
  return () => { mem[f.model].delete = orig; };
}

describe('资产删除真实性（v2.584）', { concurrency: 1 }, () => {
  for (const f of FAMILIES) {
    it(`${f.key} 资产删除遇数据库故障 → 500「删除失败，请重试」，资产仍在`, async () => {
      const row = seedAsset(f, `${f.key}_del_fail`);
      const restore = failDeleteFor(f, row.id, new Error('db down'));
      let res;
      try {
        res = await del(`${f.path}/${row.id}`);
      } finally {
        restore();
      }
      assert.strictEqual(res.status, 500);
      assert.strictEqual((await res.json()).error, '删除失败，请重试');
      assert.ok(mem[f.list].some((x) => x.id === row.id), '失败时资产不得从库里消失');
    });

    it(`${f.key} 资产已被并发删除（P2025）→ 幂等 200，其余错误不混淆`, async () => {
      const row = seedAsset(f, `${f.key}_del_gone`);
      const restore = failDeleteFor(f, row.id, Object.assign(new Error('gone'), { code: 'P2025' }));
      let res;
      try {
        res = await del(`${f.path}/${row.id}`);
      } finally {
        restore();
      }
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(await res.json(), { ok: true });
    });

    it(`${f.key} 资产不存在 / 非本人 → 仍 404（防越权探测口径不变）`, async () => {
      const res = await del(`${f.path}/never_exists_${f.key}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual((await res.json()).error, f.err);
    });
  }
});
