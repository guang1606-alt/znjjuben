/**
 * v2.602 写路径的前置校验读失败不得按"不存在"继续。
 *
 * 先证伪：
 *   1) 三族「一键沉淀」from-project：查重 findFirst `.catch(() => null as any)`——DB 抖动时按"该资产不存在"
 *      直接 create，跨项目重复建档；写库再失败也只是计入 skipped，服务端无任何留痕。
 *   2) 知识上传：去重比对 findMany `.catch(() => [])`——比对没做成，响应里的 dedup 仍报结果，等于谎报已去重。
 * 修复：查重读失败留痕并跳过该条（响应形状不变）；知识上传改为 fail-closed 500 可重试。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2602-secret';
process.env.JWT_REFRESH_SECRET = 'v2602-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem), knowledge: createKnowledgeRouter(mem) });
let base;
const server = app.listen(0);

const UID = 'u_v2602';
before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  mem._seedUser({ id: 'admin', phone: '18891995171', level: 'PRO', isAdmin: false });
  await mem.project.create({
    data: {
      id: 'p_v2602', userId: UID, title: '沉淀测试', status: 'LIVE',
      bible: { characters: [{ name: '林昭', traits: '外冷内热，刑警' }] },
    },
  });
  await mem.script.create({ data: { id: 's_v2602', projectId: 'p_v2602', epNo: 1, content: '内景 老宅祠堂。林昭盯着供桌上的铜怀表。' } });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` };
const A = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'admin', level: 'PRO' })}` };
async function post(path, headers, body) {
  const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.join(' ')); orig(...a); };
  return () => { console.error = orig; return calls; };
}
function patchThrow(model, method, msg = 'DB_DOWN') {
  const orig = mem[model][method];
  mem[model][method] = async () => { throw new Error(msg); };
  return () => { mem[model][method] = orig; };
}

const FAMILIES = [
  // 三族 from-project 响应均为 { created:number, updated:number, skipped:number, assets:[] }，统一按数字口径断言
  { key: 'cast', path: '/api/generate/character-assets/from-project/p_v2602', model: 'characterAsset', countCreated: (b) => b.created, countUpdated: (b) => b.updated },
  { key: 'prop', path: '/api/generate/prop-assets/from-project/p_v2602', model: 'propAsset', countCreated: (b) => b.created, countUpdated: (b) => b.updated },
  { key: 'scene', path: '/api/generate/scene-assets/from-project/p_v2602', model: 'sceneAsset', countCreated: (b) => b.created, countUpdated: (b) => b.updated },
];

describe('v2.602 三族一键沉淀：查重读失败不得重复建档', { concurrency: 1 }, () => {
  it('1) 正常：三族 from-project 均能沉淀出资产（合约不变）', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path, H);
      assert.strictEqual(r.status, 200, `${f.key} 应 200`);
      assert.ok(f.countCreated(r.body) + f.countUpdated(r.body) >= 1, `${f.key} 应至少沉淀一条`);
    }
  });

  it('2) 三族查重读失败 → 不留重复档、计入 skipped、留痕 fromProject.lookup', async () => {
    for (const f of FAMILIES) {
      const restore = patchThrow(f.model, 'findFirst');
      const stop = captureErrors();
      let r;
      try {
        r = await post(f.path, H);
      } finally {
        const calls = stop(); restore();
        assert.ok(calls.some((c) => c.includes(`[generate.asset.${f.key}.fromProject.lookup]`)),
          `${f.key} 应留痕 lookup；实际：${calls.join(' | ')}`);
      }
      assert.strictEqual(r.status, 200);
      assert.strictEqual(f.countCreated(r.body), 0, `${f.key} 查重读失败不得新建`);
      assert.strictEqual(f.countUpdated(r.body), 0, `${f.key} 查重读失败不得更新`);
      assert.ok(r.body.skipped >= 1, `${f.key} 应计入 skipped`);
    }
  });

  it('3) 三族写库失败 → 计入 skipped + 留痕 fromProject.write', async () => {
    for (const f of FAMILIES) {
      // 用例 1 已建过档，本条走 update 分支；create/update 都 patch 以覆盖两条路径
      const restoreCreate = patchThrow(f.model, 'create');
      const restoreUpdate = patchThrow(f.model, 'update');
      const stop = captureErrors();
      let r;
      try {
        r = await post(f.path, H);
      } finally {
        const calls = stop(); restoreUpdate(); restoreCreate();
        assert.ok(calls.some((c) => c.includes(`[generate.asset.${f.key}.fromProject.write]`)),
          `${f.key} 应留痕 write；实际：${calls.join(' | ')}`);
      }
      assert.strictEqual(r.status, 200);
      assert.strictEqual(f.countCreated(r.body), 0, `${f.key} 写失败不得计入 created`);
    }
  });
});

describe('v2.602 知识上传：去重比对读失败必须中止', { concurrency: 1 }, () => {
  it('4) 正常上传：200 + ok + dedup 状态（合约不变）', async () => {
    const r = await post('/api/admin/knowledge', A, {
      kind: 'TEXT', title: 'v2602 节奏原则', content: '竖屏短剧前三秒必须抛出核心钩子，十秒内建立冲突。',
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
    assert.ok(r.body.dedup);
  });

  it('5) 比对读失败 → 500「知识库比对失败，请重试」+ 留痕 knowledge.upload.dedup', async () => {
    const restore = patchThrow('knowledgeItem', 'findMany');
    const stop = captureErrors();
    let r;
    try {
      r = await post('/api/admin/knowledge', A, {
        kind: 'TEXT', title: 'v2602 失败上传', content: '本条不应入库，因为去重比对没有做成。',
      });
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[knowledge.upload.dedup]')), `缺留痕；实际：${calls.join(' | ')}`);
    }
    assert.strictEqual(r.status, 500, '没做去重比对不得返回 dedup 结果');
    assert.strictEqual(r.body.error, '知识库比对失败，请重试');
  });
});
