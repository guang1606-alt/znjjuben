/**
 * v2.600 自主学习闭环不得把数据库故障伪装成"空知识库"；立项资产引用校验失败必须留痕。
 *
 * 背景（先证伪）：
 *   A) src/services/auto-learning.ts 两处 `.catch(() => [])`——
 *      · 跨轮去重表读失败 → learnedKeys 为空 → 已学信号被重复落库（重复知识条目）
 *      · 既有知识库读失败 → stored 为空 → 冲突条目可能被自动批准（与 v2.599 self-learn/run 同族）
 *      两者都是写路径的前置读，必须 fail-closed：留痕 + 500「学习库加载失败，请重试」。
 *   B) src/routes/generate.ts 立项三族资产引用校验（lines 459/473/486）`.catch(() => [])`——
 *      故障时快照静默为空，用户以为资产已引用。立项是核心写路径，不能因资产库抖动阻断建项目，
 *      故采用「留痕 + fail-open 继续」，但服务端必须可归因。
 *
 * 成功合约完全不变（非破坏性）；仅故障路径由"静默降级"变为"500 或留痕"。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2600-secret';
process.env.JWT_REFRESH_SECRET = 'v2600-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem), knowledge: createKnowledgeRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

// 超管主账号（phone 须为 18891995171 才能通过 requireSuperAdmin）
mem._seedUser({ id: 'admin', phone: '18891995171', level: 'PRO', isAdmin: false });
const ADMIN = signAccess({ sub: 'admin', level: 'PRO' });
const HK = { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` };
// 立项用例用超管账号：isStaff 免项目数/额度限制，避免用例之间互相挤占项目配额
const UK = HK;
const K = '/api/admin/knowledge';
const G = '/api/generate';

function captureErrors() {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => { calls.push(args.join(' ')); orig(...args); };
  return () => { console.error = orig; return calls; };
}

/** patch mem[model].findMany 使其一律抛 DB_DOWN；返回 restore 函数 */
function patchFindManyThrow(modelName, errMsg = 'DB_DOWN') {
  const orig = mem[modelName].findMany;
  mem[modelName].findMany = async () => { throw new Error(errMsg); };
  return () => { mem[modelName].findMany = orig; };
}

describe('v2.600-A 自主学习闭环：知识库读失败必须中止而非按空库继续', { concurrency: 1 }, () => {

  it('1) POST /self-learn/run-auto 正常：200 + reportText（成功合约不变）', async () => {
    const r = await fetch(base + K + '/self-learn/run-auto', { method: 'POST', headers: HK });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(typeof j.reportText, 'string');
    assert.ok(Array.isArray(j.created));
  });

  it('2) POST /self-learn/run-auto DB 故障 → 500「学习库加载失败，请重试」+ 留痕 auto-learning.learned-fetch', async () => {
    const restore = patchFindManyThrow('knowledgeItem');
    const stop = captureErrors();
    let r; let j;
    try {
      r = await fetch(base + K + '/self-learn/run-auto', { method: 'POST', headers: HK });
      j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[auto-learning.learned-fetch]')),
        `应有 logInternal 留痕 auto-learning.learned-fetch；实际 calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(r.status, 500, '去重表读失败不得按"全都没学过"继续落库');
    assert.strictEqual(j.error, '学习库加载失败，请重试');
  });

  it('3) 恢复可读后重跑：200（DB 恢复即可重试，无需人工修数据）', async () => {
    const r = await fetch(base + K + '/self-learn/run-auto', { method: 'POST', headers: HK });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
  });
});

describe('v2.600-B 立项资产引用校验失败：留痕但不阻断建项目', { concurrency: 1 }, () => {

  it('4) 正常：本人角色资产快照进 bible.castAssets（成功合约不变）', async () => {
    const a = await fetch(base + G + '/character-assets', {
      method: 'POST', headers: UK, body: JSON.stringify({ name: '林昭', persona: '外冷内热刑警' }),
    });
    assert.strictEqual(a.status, 200);
    const asset = (await a.json()).asset;
    const p = await fetch(base + G + '/projects', {
      method: 'POST', headers: UK, body: JSON.stringify({ title: '旧案重演', mode: 'tags', castAssetIds: [asset.id] }),
    });
    assert.strictEqual(p.status, 200);
    const pj = await p.json();
    assert.strictEqual(pj.bible.castAssets.length, 1);
    assert.strictEqual(pj.bible.castAssets[0].name, '林昭');
  });

  it('5) characterAsset 读失败 → 仍 200 建项目 + 留痕 generate.project.cast-assets', async () => {
    const restore = patchFindManyThrow('characterAsset');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + G + '/projects', {
        method: 'POST', headers: UK, body: JSON.stringify({ title: '资产库抖动剧', mode: 'tags', castAssetIds: ['ca_ghost'] }),
      });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[generate.project.cast-assets]')),
        `应留痕 generate.project.cast-assets；实际 calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 200, '资产库抖动不得阻断立项');
    assert.ok(j.id, '项目仍应创建成功');
    assert.ok(!j.bible?.castAssets?.length, '读失败时不得伪造资产快照');
  });

  it('6) propAsset 读失败 → 仍 200 + 留痕 generate.project.prop-assets', async () => {
    const restore = patchFindManyThrow('propAsset');
    const stop = captureErrors();
    let status;
    try {
      const r = await fetch(base + G + '/projects', {
        method: 'POST', headers: UK, body: JSON.stringify({ title: '道具有抖动', mode: 'tags', propAssetIds: ['pa_ghost'] }),
      });
      status = r.status; await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[generate.project.prop-assets]')),
        `应留痕 generate.project.prop-assets；实际 calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 200);
  });

  it('7) sceneAsset 读失败 → 仍 200 + 留痕 generate.project.scene-assets', async () => {
    const restore = patchFindManyThrow('sceneAsset');
    const stop = captureErrors();
    let status;
    try {
      const r = await fetch(base + G + '/projects', {
        method: 'POST', headers: UK, body: JSON.stringify({ title: '场景有抖动', mode: 'tags', sceneAssetIds: ['sa_ghost'] }),
      });
      status = r.status; await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[generate.project.scene-assets]')),
        `应留痕 generate.project.scene-assets；实际 calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 200);
  });
});
