/**
 * v2.599 超管自主学习 / 盘点链路不得把数据库故障伪装成空数据。
 *
 * 背景（先证伪）：knowledge.ts + admin-model.ts 共 4 处 `.catch(() => [])`——
 *   1) POST /api/admin/knowledge/self-learn/run  读知识库失败 → 空知识库跑自主学习 → 可能批准冲突条目
 *   2) GET  /api/admin/knowledge/self-learn/report  知识库快照 → 空
 *   3) GET  /api/admin/knowledge/self-learn/reports  自主学习历史 → 空
 *   4) GET  /api/admin/model/portfolio/audit-report  每周盘点最新 → null
 * 与 v2.594–v2.598 资产库/看板/usage/batch-complete/from-project 故障同族——
 * 管理端链路静默吞异常，超管看到"没数据/最新盘点为 null"无从重试，服务端无日志不可归因。
 *
 * 修复：每处各包 try/catch + logInternal + 500「...加载失败，请重试」；成功合约完全不变，非破坏性。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ka-truth-secret';
process.env.JWT_REFRESH_SECRET = 'ka-truth-refresh';
const { createApp } = require('../dist/server/app.js');
const { createKnowledgeRouter } = require('../dist/routes/knowledge.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ knowledge: createKnowledgeRouter(mem), adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

// seed 超级管理员主账号（phone 须为 18891995171 才能通过 requireSuperAdmin）
mem._seedUser({ id: 'admin', phone: '18891995171', level: 'PRO', isAdmin: false });
// 超管 token：sub 须与 seed user id 对应
const ADMIN = signAccess({ sub: 'admin', level: 'PRO' });
const HK = { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` };
const K = '/api/admin/knowledge';
const M = '/api/admin/model';

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

describe('v2.599 超管自主学习/盘点链路真实性', { concurrency: 1 }, () => {

  it('1) POST /self-learn/run 正常：空信号 200 + 报告存在', async () => {
    // 先给知识库塞点种子，确保 findMany 正常返回
    mem._knowledgeItems.push({
      id: 'ki_seed_1', kind: 'TEXT', title: '种子技法', content: '集尾钩子要在情绪最高点切断。',
      category: 'plot', status: 'APPROVED', version: 1, source: 'MANUAL',
      approvedAt: new Date(), archivedAt: null, conflictNote: null, createdAt: new Date(),
    });
    const r = await fetch(base + K + '/self-learn/run', {
      method: 'POST', headers: HK, body: JSON.stringify({ signals: [] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.report, '应返回 report');
  });

  it('2) POST /self-learn/run DB 故障 → 500「知识库加载失败，请重试」+ logInternal 留痕', async () => {
    const restore = patchFindManyThrow('knowledgeItem');
    const stop = captureErrors();
    try {
      const r = await fetch(base + K + '/self-learn/run', {
        method: 'POST', headers: HK, body: JSON.stringify({ signals: [] }),
      });
      assert.strictEqual(r.status, 500, 'DB 故障应 500 而非 200 继续跑');
      const j = await r.json();
      // 文案应含"知识库加载失败"或"加载失败"
      const msg = (j.error || j.message || '');
      assert.ok(/加载失败|知识库/.test(msg), `错误文案应指向知识库加载失败，实际：${msg}`);
    } finally {
      restore();
      const calls = stop();
      assert.ok(calls.some((c) => /knowledge.*self.?learn.*fetch/i.test(c)),
        `应有 logInternal 留痕 knowledge.self-learn.fetch；实际 calls: ${calls.join(' | ')}`);
    }
  });

  it('3) POST /self-learn/run 恢复可读：取消 patch 后正常 200', async () => {
    // 上一个用例已 restore；这里直接再跑一次确认
    const r = await fetch(base + K + '/self-learn/run', {
      method: 'POST', headers: HK, body: JSON.stringify({ signals: [] }),
    });
    assert.strictEqual(r.status, 200);
  });

  it('4) GET /self-learn/report 正常：200 + byStatus', async () => {
    const r = await fetch(base + K + '/self-learn/report', { headers: HK });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.byStatus || j.total >= 0);
  });

  it('5) GET /self-learn/report DB 故障 → 500 + logInternal 留痕', async () => {
    const restore = patchFindManyThrow('knowledgeItem');
    const stop = captureErrors();
    try {
      const r = await fetch(base + K + '/self-learn/report', { headers: HK });
      assert.strictEqual(r.status, 500);
      const j = await r.json();
      const msg = (j.error || j.message || '');
      assert.ok(/加载失败|知识库/.test(msg), `错误文案应指向知识库加载，实际：${msg}`);
    } finally {
      restore();
      const calls = stop();
      assert.ok(calls.some((c) => /knowledge.*self.?learn.*report/i.test(c)),
        `应留痕 knowledge.self-learn.report；实际 calls: ${calls.join(' | ')}`);
    }
  });

  it('6) GET /self-learn/reports 正常：200 + reports 数组', async () => {
    const r = await fetch(base + K + '/self-learn/reports', { headers: HK });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.reports));
  });

  it('7) GET /self-learn/reports DB 故障 → 500 + logInternal 留痕', async () => {
    const restore = patchFindManyThrow('learningReport');
    const stop = captureErrors();
    try {
      const r = await fetch(base + K + '/self-learn/reports', { headers: HK });
      assert.strictEqual(r.status, 500);
      const j = await r.json();
      const msg = (j.error || j.message || '');
      assert.ok(/加载失败|报告|盘点/.test(msg), `错误文案应指向报告加载，实际：${msg}`);
    } finally {
      restore();
      const calls = stop();
      assert.ok(calls.some((c) => /knowledge.*self.?learn.*reports/i.test(c)),
        `应留痕 knowledge.self-learn.reports；实际 calls: ${calls.join(' | ')}`);
    }
  });

  it('8) GET /api/admin/model/portfolio/audit-report 正常：200 + latest 字段', async () => {
    const r = await fetch(base + M + '/portfolio/audit-report', { headers: HK });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok('latest' in j);
  });

  it('9) GET /api/admin/model/portfolio/audit-report DB 故障 → 500 + logInternal 留痕', async () => {
    const restore = patchFindManyThrow('learningReport');
    const stop = captureErrors();
    try {
      const r = await fetch(base + M + '/portfolio/audit-report', { headers: HK });
      assert.strictEqual(r.status, 500);
      const j = await r.json();
      const msg = (j.error || j.message || '');
      assert.ok(/加载失败|盘点/.test(msg), `错误文案应指向盘点加载，实际：${msg}`);
    } finally {
      restore();
      const calls = stop();
      assert.ok(calls.some((c) => /audit.?report/i.test(c)),
        `应留痕 admin.audit-report；实际 calls: ${calls.join(' | ')}`);
    }
  });

  it('10) 全部恢复可读后 GET /self-learn/reports 再次 200', async () => {
    const r = await fetch(base + K + '/self-learn/reports', { headers: HK });
    assert.strictEqual(r.status, 200);
    const r2 = await fetch(base + M + '/portfolio/audit-report', { headers: HK });
    assert.strictEqual(r2.status, 200);
  });
});
