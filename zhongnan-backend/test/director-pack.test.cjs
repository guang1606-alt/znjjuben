const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'dp-secret';
process.env.JWT_REFRESH_SECRET = 'dp-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u1', level: 'FREE', penName: '测试甲' });
mem._seedUser({ id: 'u2', level: 'BASIC' });

async function seed(pid, withScripts) {
  await mem.project.create({ data: { id: pid, userId: 'u1', title: '预览剧', mode: 'tags', format: 'LIVE_ACTION',
    bible: { worldview: '都市', timeline: ['梗概'], foreshadow: [], characters: { 林晚: { traits: '后发制人', arc: '亮明身份', voice: '平静' } } } } });
  if (withScripts) {
    for (let e = 1; e <= 4; e++) {
      await mem.script.create({ data: { projectId: pid, epNo: e, title: `第${e}集`, content: `第${e}集\n【场景】日/厅/内\n【人物】林晚、陈总\n林晚：第${e}句。\n陈总：等着。`, wordCount: 20 } });
    }
  }
}
const H = { Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'FREE' })}` };

describe('v2.64 导演交付包预览端点', { concurrency: 1 }, () => {
  before(async () => { await seed('pOk', true); await seed('pEmpty', false); });

  it('未登录 401', async () => { assert.strictEqual((await fetch(base + '/api/generate/projects/pOk/director-pack')).status, 401); });
  it('无分集 400 提示先生成', async () => {
    const r = await fetch(base + '/api/generate/projects/pEmpty/director-pack', { headers: H });
    assert.strictEqual(r.status, 400);
    const j = await r.json(); assert.ok(j.error.includes('先生成'));
  });
  it('返回四页：情绪/钩子/兑现链/人物，且人物页含成长线', async () => {
    const r = await fetch(base + '/api/generate/projects/pOk/director-pack', { headers: H });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.episodeCount, 4);
    assert.ok(j.pages.length >= 3, `至少三页导演页，实际${j.pages.length}`);
    const types = j.pages.map((p) => p.type);
    assert.ok(types.includes('wave'));
    assert.ok(types.includes('hook'));
    assert.ok(types.includes('chain'));
    assert.ok(types.includes('cast'));
    const cast = j.pages.find((p) => p.type === 'cast');
    assert.ok(cast.lines.some((x) => /第1集 [①②③④⑤]/.test(x)), '人物页成长阶段行存在');
    assert.ok(cast.lines.some((x) => x.includes('林晚')), '人物页含真实解析角色');
  });
  it('他人项目 404', async () => {
    const r = await fetch(base + '/api/generate/projects/pOk/director-pack', { headers: { Authorization: `Bearer ${signAccess({ sub: 'u2', level: 'BASIC' })}` } });
    assert.strictEqual(r.status, 404);
  });
});
