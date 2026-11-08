/**
 * v2.489 创作引擎档位门控（立项 + 生成本集同源）
 *
 * 背景：前端 #engine 下拉曾用自造的 STANDARD/HIGH/PRO 三个值，其中 HIGH/PRO 不在后端
 * EngineTier 枚举（ECONOMY/STANDARD/FLAGSHIP/OVERSEAS）里 → 选「高阶/专业」立项直接 400；
 * 即使改成合法档位，立项接口又不校验会员权限 → 免费用户可以建成旗舰档项目，
 * 之后每一集生成都 403（能立项、跑不了的死项目）。
 *
 * 本测试锁两件事：
 *  ① 立项按会员档拦截越级引擎，并回报 needLevel 供前端指路升级；
 *  ② 未传档位时的兜底档位落回当前会员可用范围（免费档 = 经济档）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'engine-tier-secret';
process.env.JWT_REFRESH_SECRET = 'engine-tier-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';
let seq = 0;
async function postProject(uid, level, extra = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` };
  const body = { title: `引擎门控项目${++seq}`, mode: 'tag', brief, ...extra };
  const resp = await fetch(base + '/api/generate/projects', { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

describe('v2.489 引擎档位门控', { concurrency: 1 }, () => {
  it('免费档不能建成旗舰档项目，并回报 needLevel=ADVANCED', async () => {
    mem._seedUser({ id: 'eng_free', level: 'FREE', balance: 0 });
    const r = await postProject('eng_free', 'FREE', { engineTier: 'FLAGSHIP' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.json.error, 'ENGINE_LOCKED');
    assert.strictEqual(r.json.needLevel, 'ADVANCED');
  });

  it('基础档可用标准档（200），旗舰档仍拒绝', async () => {
    mem._seedUser({ id: 'eng_basic', level: 'BASIC', balance: 1000 });
    const ok = await postProject('eng_basic', 'BASIC', { engineTier: 'STANDARD' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.json.engineTier, 'STANDARD');
    const no = await postProject('eng_basic', 'BASIC', { engineTier: 'FLAGSHIP' });
    assert.strictEqual(no.status, 403);
    assert.strictEqual(no.json.needLevel, 'ADVANCED');
  });

  it('高级档可建旗舰档项目', async () => {
    mem._seedUser({ id: 'eng_adv', level: 'ADVANCED', balance: 5000 });
    const r = await postProject('eng_adv', 'ADVANCED', { engineTier: 'FLAGSHIP' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.engineTier, 'FLAGSHIP');
  });

  it('未传档位时，免费档兜底为经济档（不再落成不可用的标准档）', async () => {
    mem._seedUser({ id: 'eng_default', level: 'FREE', balance: 0 });
    const r = await postProject('eng_default', 'FREE');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.engineTier, 'ECONOMY');
  });

  it('旧 UI 的 HIGH / PRO 不是合法档位：schema 层 400（前端必须传真实 EngineTier）', async () => {
    mem._seedUser({ id: 'eng_legacy', level: 'PRO', balance: 5000 });
    for (const legacy of ['HIGH', 'PRO']) {
      const r = await postProject('eng_legacy', 'PRO', { engineTier: legacy });
      assert.strictEqual(r.status, 400, `legacy tier ${legacy} 不应被接受`);
    }
  });
});
