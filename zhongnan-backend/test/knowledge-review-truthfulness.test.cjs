/**
 * v2.583 知识审核「通过/驳回」同样不得谎报成功。
 *
 * 背景（先证伪）：v2.582 修完归档路径后，同一文件的审核路径仍是旧口径——
 *  · `/:id/approve` 写库失败 `.catch(() => null)` → 一律 404「知识不存在」（条目还在，管理员以为丢了）；
 *  · `/:id/reject` 写库失败直接吞掉 → 返回 200 ok，前端提示「已驳回」，条目实际仍 PENDING 待审积压；
 *  · 两个接口对真正不存在的 id 也没有区分（reject 甚至回 200）。
 * 与 v2.574 / v2.582 同族：管理端写路径必须区分「记录不存在（P2025）」与「数据库故障」，
 * 失败要可归因（500 + 结构化日志），不得把失败伪装成成功或不存在。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'kn-rev-secret';
process.env.JWT_REFRESH_SECRET = 'kn-rev-refresh';
const { createApp } = require('../dist/server/app.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
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
function seedPending() {
  const id = `k_rev_${++seedSeq}`;
  mem._knowledgeItems.push({
    id, kind: 'TEXT', title: `待审知识${seedSeq}`, content: '集尾钩子要在情绪最高点切断，留下未解疑问。',
    category: 'plot', status: 'PENDING', version: 1, source: 'MANUAL',
    approvedAt: null, archivedAt: null, pruneReason: null, createdAt: new Date(),
  });
  return mem._knowledgeItems[mem._knowledgeItems.length - 1];
}
function failUpdateFor(id) {
  const orig = mem.knowledgeItem.update;
  mem.knowledgeItem.update = async (args) => {
    if (args?.where?.id === id) throw new Error('db down');
    return orig(args);
  };
  return () => { mem.knowledgeItem.update = orig; };
}

describe('知识审核真实性（v2.583）', { concurrency: 1 }, () => {
  it('审核通过遇数据库故障 → 500「生效失败，请重试」，条目仍 PENDING', async () => {
    const row = seedPending();
    const restore = failUpdateFor(row.id);
    let res;
    try {
      res = await post(`/${row.id}/approve`);
    } finally {
      restore();
    }
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).error, '生效失败，请重试');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === row.id).status, 'PENDING');
  });

  it('驳回遇数据库故障 → 500「驳回失败，请重试」，不得回 200 谎称已驳回', async () => {
    const row = seedPending();
    const restore = failUpdateFor(row.id);
    let res;
    try {
      res = await post(`/${row.id}/reject`, { reason: '质量不足' });
    } finally {
      restore();
    }
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).error, '驳回失败，请重试');
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === row.id).status, 'PENDING');
  });

  it('真正不存在（P2025）→ 404「知识不存在」（通过/驳回一致）', async () => {
    const a = await post('/k_never_review/approve');
    assert.strictEqual(a.status, 404);
    assert.strictEqual((await a.json()).error, '知识不存在');
    const b = await post('/k_never_review/reject', { reason: '不存在' });
    assert.strictEqual(b.status, 404);
    assert.strictEqual((await b.json()).error, '知识不存在');
  });
});
