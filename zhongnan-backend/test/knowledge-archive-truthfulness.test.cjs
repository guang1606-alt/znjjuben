/**
 * v2.582 知识归档不得谎报成功。
 *
 * 背景（先证伪）：`POST /self-learn/run`、`runDailyLearningCycle` 的自主淘汰与手动
 * `/:id/archive`、`/:id/restore` 全是 `update(...).catch(() => null)`：
 *  · 写库失败后仍把该项计入 `archived`，学习报告也写着「N 条已自动归档」——条目实际仍是 APPROVED；
 *  · 手动归档/恢复遇到数据库瞬时错误，一律回 404「知识不存在」——条目明明在，用户被误导成"数据丢了"。
 * 与 v2.574 广告删除同族：写路径不得用 catch 兜底吞异常、不得把失败伪装成成功或不存在。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'kn-arch-secret';
process.env.JWT_REFRESH_SECRET = 'kn-arch-refresh';
const { createApp } = require('../dist/server/app.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
const { runDailyLearningCycle } = require('../dist/services/auto-learning.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ knowledge: createKnowledgeRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'admin', phone: '18891995171', isAdmin: false });
const K = '/api/admin/knowledge';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'admin', level: 'PRO' })}` };
const post = (path, body = {}) => fetch(base + K + path, { method: 'POST', headers: H, body: JSON.stringify(body) });

let seedSeq = 0;
function seedApproved(over = {}) {
  const id = over.id || `k_arch_${++seedSeq}`;
  const row = {
    id, kind: 'TEXT', title: `过时技法${seedSeq}`, content: '旧版钩子技法：先平铺直叙再进入冲突。',
    category: 'plot', status: 'APPROVED', version: 1, source: 'AUTO',
    lastReferencedAt: new Date(Date.now() - 200 * 86400000),
    archivedAt: null, pruneReason: null, createdAt: new Date(Date.now() - 300 * 86400000),
    ...over,
  };
  mem._knowledgeItems.push(row);
  return row;
}
/** 只让指定 id 的写库抛错，用于模拟数据库瞬时故障；返回还原函数 */
function failUpdateFor(...ids) {
  const orig = mem.knowledgeItem.update;
  mem.knowledgeItem.update = async (args) => {
    if (ids.includes(args?.where?.id)) throw new Error('db down');
    return orig(args);
  };
  return () => { mem.knowledgeItem.update = orig; };
}

describe('知识归档真实性（v2.582）', { concurrency: 1 }, () => {
  it('每日学习闭环：归档写库失败不计入 archived，报告不得谎称已归档', async () => {
    const bad = seedApproved({ id: 'k_svc_bad', title: '服务层失败项' });
    const restore = failUpdateFor(bad.id);
    let r;
    try {
      r = await runDailyLearningCycle(mem, {}, 'admin');
    } finally {
      restore();
    }
    assert.deepStrictEqual(r.archiveFailed.map((x) => x.id), [bad.id]);
    assert.deepStrictEqual(r.archived.map((x) => x.id), [], '写库失败项不得进入 archived');
    assert.strictEqual(r.report.summary.archived, 0, '报告统计必须按真实归档结果');
    assert.ok(!r.report.text.includes('1条已自动归档'), '报告正文不得宣称失败项已归档');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === bad.id).status, 'APPROVED', '条目必须仍是生效态');
    // 隔离：本行仍是过时态，后续用例的淘汰会再次命中；刷新引用时间，避免跨用例串扰
    mem._knowledgeItems.find((k) => k.id === bad.id).lastReferencedAt = new Date();
  });

  it('自主淘汰一轮（管理端）：archived 仅含成功项，失败项进 archiveFailed 且状态未变', async () => {
    seedApproved({ id: 'k_route_bad', title: '路由层失败项' });
    seedApproved({ id: 'k_route_ok', title: '路由层成功项' });
    const restore = failUpdateFor('k_route_bad');
    let j;
    try {
      const res = await post('/self-learn/run', { signals: [], staleDays: 30 });
      assert.strictEqual(res.status, 200);
      j = await res.json();
    } finally {
      restore();
    }
    assert.ok(!j.archived.some((x) => x.id === 'k_route_bad'), '失败项不得出现在 archived');
    assert.ok(j.archived.some((x) => x.id === 'k_route_ok'));
    assert.deepStrictEqual(j.archiveFailed.map((x) => x.id), ['k_route_bad']);
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === 'k_route_bad').status, 'APPROVED');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === 'k_route_ok').status, 'ARCHIVED');
    assert.strictEqual(j.report.summary.archived, 1);
  });

  it('手动归档遇数据库故障 → 500「归档失败，请重试」，不得谎报 404「知识不存在」', async () => {
    const row = seedApproved({ id: 'k_manual_arch' });
    const restore = failUpdateFor(row.id);
    let res;
    try {
      res = await post(`/${row.id}/archive`, { reason: '人工复核' });
    } finally {
      restore();
    }
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).error, '归档失败，请重试');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === row.id).status, 'APPROVED');
  });

  it('手动恢复遇数据库故障 → 500「恢复失败，请重试」，条目保持归档态', async () => {
    const row = seedApproved({ id: 'k_manual_rest', status: 'ARCHIVED', archivedAt: new Date() });
    const restore = failUpdateFor(row.id);
    let res;
    try {
      res = await post(`/${row.id}/restore`);
    } finally {
      restore();
    }
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).error, '恢复失败，请重试');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === row.id).status, 'ARCHIVED');
  });

  it('真正不存在（P2025）仍返回 404，不把数据故障混同为不存在', async () => {
    const a = await post('/k_never_exists/archive');
    assert.strictEqual(a.status, 404);
    assert.strictEqual((await a.json()).error, '知识不存在');
    const b = await post('/k_never_exists/restore');
    assert.strictEqual(b.status, 404);
    assert.strictEqual((await b.json()).error, '知识不存在');
  });
});
