/**
 * v2.598 prop/scene 一键沉淀（POST /api/generate/{prop,scene}-assets/from-project/:projectId）
 * script.findMany 故障不得伪装成「无资产可沉淀」：
 * 旧实现 prisma.script.findMany(...).catch(() => [])——DB 故障时 allEps=[]
 * extract*AssetDrafts([]) → created=0 updated=0 → 假装「项目里没有资产可沉淀」。
 * character from-project 已是可接受的 fail-open（findFirst→null→继续），不修复。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'fp-secret';
process.env.JWT_REFRESH_SECRET = 'fp-refresh';
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

const UID = 'u_fp';
const FP_MSG = '资产一键沉淀加载失败，请重试';

before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  await mem.project.create({ data: { id: 'p_fp1', userId: UID, title: '测试项目', status: 'LIVE', bible: {} } });
  await mem.script.create({ data: { id: 's_fp1', projectId: 'p_fp1', epNo: 1, content: '内景 老宅祠堂。铜怀表躺在供桌上。' } });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function post(path, body) {
  const resp = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` },
    body: JSON.stringify(body || {}),
  });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}
function patch(model, method, impl) {
  const orig = mem[model][method];
  mem[model][method] = impl(orig);
  return () => { mem[model][method] = orig; };
}
async function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a); };
  try { await fn(); } finally { console.error = orig; }
  return calls;
}
function hasScope(calls, scope) {
  return calls.some((c) => typeof c[0] === 'string' && c[0].includes(`[${scope}]`));
}

const FAMILIES = [
  { path: '/api/generate/prop-assets/from-project/p_fp1', family: 'prop' },
  { path: '/api/generate/scene-assets/from-project/p_fp1', family: 'scene' },
];

describe('prop/scene 一键沉淀真实性·from-project（v2.598）', { concurrency: 1 }, () => {
  // 正常：script.findMany 通 → 200（extract*AssetDrafts 纯函数能解析出草稿 → created/updated > 0）
  it('正常：script.findMany 通 → 200 + created/updated 合约', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path);
      assert.strictEqual(r.status, 200, `${f.path} 应 200`);
      assert.ok(r.body && typeof r.body === 'object', `${f.path} body 必须对象`);
      assert.ok('created' in r.body, `${f.path} 应含 created`);
      assert.ok('updated' in r.body, `${f.path} 应含 updated`);
    }
  });

  // 故障：patch script.findMany → prop/scene 各自 500 + 文案 + 各自 scope 留痕
  it('script.findMany 故障：prop/scene 各自 500 + 文案 + 各自留痕', async () => {
    const restore = patch('script', 'findMany', (orig) => async (arg) => {
      if (arg?.where?.projectId === 'p_fp1') throw new Error('DB_DOWN');
      return orig.call(mem.script, arg);
    });
    try {
      const calls = await captureErrors(async () => {
        for (const f of FAMILIES) {
          const r = await post(f.path);
          assert.strictEqual(r.status, 500, `${f.path} 应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, FP_MSG, `${f.path} 文案不符`);
          assert.strictEqual(r.body.created, undefined, `${f.path} 不得返回 created`);
        }
      });
      assert.ok(hasScope(calls, 'generate.asset.prop.fromProject'), '必须留痕 prop.fromProject');
      assert.ok(hasScope(calls, 'generate.asset.scene.fromProject'), '必须留痕 scene.fromProject');
    } finally { restore(); }
  });

  it('恢复后立即可读', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path);
      assert.strictEqual(r.status, 200);
    }
  });
});
