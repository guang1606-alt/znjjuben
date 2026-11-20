/**
 * v2.603 一键沉淀入口：读故障不得伪装成「项目不存在 / 没有成稿」。
 *
 * 先证伪：
 *   1) 三族 from-project 的 `project.findFirst(...).catch(() => null as any)`——DB 抖动时 project=null，
 *      直接返回 404 PROJECT_NOT_FOUND，编导看到「项目不存在」并可能以为项目被删（实际只是读失败）。
 *   2) cast from-project 的最近成稿 `script.findFirst(...).catch(() => null as any)`——读失败时 latest=null，
 *      声纹/台词全部按空重算且无任何留痕，沉淀结果「看起来正常」但实为降级。
 * 修复：project 读失败 → 500「项目加载失败，请重试」+ 各自 scope 留痕（真不存在仍 404）；
 *      cast 最近成稿读失败 → 留痕后 fail-open 继续（bible 一手源仍可沉淀）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2603-secret';
process.env.JWT_REFRESH_SECRET = 'v2603-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);

const UID = 'u_v2603';
before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  await mem.project.create({
    data: {
      id: 'p_v2603', userId: UID, title: '入口测试', status: 'LIVE',
      bible: { characters: [{ name: '林昭', traits: '外冷内热，刑警' }] },
    },
  });
  await mem.script.create({ data: { id: 's_v2603', projectId: 'p_v2603', epNo: 1, content: '内景 老宅祠堂。林昭盯着供桌上的铜怀表。' } });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` };
async function post(path) {
  const r = await fetch(base + path, { method: 'POST', headers: H });
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
  { key: 'cast', path: '/api/generate/character-assets/from-project/p_v2603', count: (b) => b.created + b.updated },
  { key: 'prop', path: '/api/generate/prop-assets/from-project/p_v2603', count: (b) => b.created + b.updated },
  { key: 'scene', path: '/api/generate/scene-assets/from-project/p_v2603', count: (b) => b.created + b.updated },
];

describe('v2.603 一键沉淀入口真实性', { concurrency: 1 }, () => {
  it('1) 正常：三族均能沉淀（合约不变）', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path);
      assert.strictEqual(r.status, 200, `${f.key} 应 200`);
      assert.ok(f.count(r.body) >= 1, `${f.key} 应至少沉淀一条`);
    }
  });

  it('2) project 读失败 → 三族 500「项目加载失败，请重试」+ 留痕，而不是 404 项目不存在', async () => {
    const restore = patchThrow('project', 'findFirst');
    const stop = captureErrors();
    try {
      for (const f of FAMILIES) {
        const r = await post(f.path);
        assert.strictEqual(r.status, 500, `${f.key} 读故障应 500，实际 ${r.status}`);
        assert.strictEqual(r.body.error, '项目加载失败，请重试', `${f.key} 文案不符`);
        assert.strictEqual(r.body.assets, undefined, `${f.key} 不得返回沉淀结果`);
      }
    } finally {
      const calls = stop(); restore();
      for (const f of FAMILIES) {
        assert.ok(calls.some((c) => c.includes(`[generate.asset.${f.key}.fromProject.project]`)),
          `${f.key} 应留痕 project 读取故障；实际：${calls.join(' | ')}`);
      }
    }
  });

  it('3) 真实不存在仍 404（故障与不存在必须可区分）', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path.replace('p_v2603', 'p_missing_v2603'));
      assert.strictEqual(r.status, 404, `${f.key} 不存在应 404`);
      assert.strictEqual(r.body.error, 'PROJECT_NOT_FOUND');
    }
  });

  it('4) cast 最近成稿读失败 → fail-open 仍按 bible 沉淀 + 留痕 fromProject.latest', async () => {
    const restore = patchThrow('script', 'findFirst');
    const stop = captureErrors();
    let r;
    try {
      r = await post('/api/generate/character-assets/from-project/p_v2603');
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[generate.asset.cast.fromProject.latest]')),
        `应留痕 latest；实际：${calls.join(' | ')}`);
    }
    assert.strictEqual(r.status, 200, '读成稿失败不应阻断沉淀');
    assert.ok(r.body.created + r.body.updated >= 1, 'bible 一手源仍应沉淀');
  });

  it('5) 恢复后立即可读', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path);
      assert.strictEqual(r.status, 200);
    }
  });
});
