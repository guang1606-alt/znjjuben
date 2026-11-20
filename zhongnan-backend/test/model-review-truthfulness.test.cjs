/**
 * v2.601 模型体检/盘点链路：读失败不得按"没记录"继续，写失败不得谎报已保存。
 *
 * 先证伪（4 处静默）：
 *   1) services/auto-learning.ts latestReport  `.catch(() => [])`——DB 抖动时 ack=null → 体检基准日退回目录日，
 *      且"今日已生成"判断失效 → 同日重复落 MODEL_REVIEW 流水；超管看到的"已核对"状态可能是错的。
 *   2) runDailyModelReview 的 learningReport.create `.catch(() => null)`——200 + 无 reportId，谎报"已生成流水"。
 *   3) ackModelReview 的 create `.catch(() => null)`——最严重：ACK 没落库却返回 status=新鲜（归零），
 *      超管以为"今日已核对"，刷新后提醒又出现。
 *   4) runWeeklyModelAudit 的 create `.catch(() => null)`——200 + report 但没有 reportId，
 *      超管以为每周盘点已留存，实际 audit-report 仍为空/旧。
 *   5) routes/admin-model.ts findLatestReport `.catch(() => [])`——GET /portfolio/review 读失败时呈现"逾期"假状态且无留痕。
 *
 * 修复口径：读/写失败一律 logInternal 留痕，服务层抛 MODEL_REPORT_UNAVAILABLE，路由返回 500 + 可重试业务文案。
 * 成功响应形状完全不变（非破坏性）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2601-secret';
process.env.JWT_REFRESH_SECRET = 'v2601-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'admin', phone: '18891995171', level: 'PRO', isAdmin: false });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'admin', level: 'PRO' })}` };
const M = '/api/admin/model';

function captureErrors() {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => { calls.push(args.join(' ')); orig(...args); };
  return () => { console.error = orig; return calls; };
}
function patchThrow(model, method, msg = 'DB_DOWN') {
  const orig = mem[model][method];
  mem[model][method] = async () => { throw new Error(msg); };
  return () => { mem[model][method] = orig; };
}

describe('v2.601 模型体检/盘点链路不谎报', { concurrency: 1 }, () => {

  it('1) GET /portfolio/review 正常：200 + status/lastAckAt/lastReviewAt（合约不变）', async () => {
    const r = await fetch(base + M + '/portfolio/review', { headers: H });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.status && typeof j.status === 'object');
    assert.ok('lastAckAt' in j && 'lastReviewAt' in j);
  });

  it('2) GET /portfolio/review 读失败 → 500 + 文案 + 留痕 admin.review.status', async () => {
    const restore = patchThrow('learningReport', 'findMany');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + M + '/portfolio/review', { headers: H });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[admin.review.status]')), `缺留痕；calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 500, '读失败不得呈现"逾期/N 天未核对"假状态');
    assert.strictEqual(j.error, 'API 选型体检状态加载失败，请重试');
  });

  it('3) POST /portfolio/review/run 正常：200 + reportId（合约不变）', async () => {
    const r = await fetch(base + M + '/portfolio/review/run', { method: 'POST', headers: H, body: '{}' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.ok(j.reportId, '正常路径应返回落库 id');
  });

  it('4) POST run 读失败 → 500 + 文案 + 留痕 auto-learning.review.latest（不重复落流水）', async () => {
    const restore = patchThrow('learningReport', 'findMany');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + M + '/portfolio/review/run', { method: 'POST', headers: H, body: '{}' });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[auto-learning.review.latest]')), `缺留痕；calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 500);
    assert.strictEqual(j.error, 'API 选型体检执行失败，请重试');
  });

  it('5) POST run 写失败 → 500 + 文案 + 留痕 auto-learning.review.create（不谎报已生成）', async () => {
    // 先让"今日已生成"判断落空（findMany 返回空），确保真的走到 create 分支
    const origMany = mem.learningReport.findMany;
    mem.learningReport.findMany = async () => [];
    const restore = patchThrow('learningReport', 'create');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + M + '/portfolio/review/run', { method: 'POST', headers: H, body: '{}' });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore(); mem.learningReport.findMany = origMany;
      assert.ok(calls.some((c) => c.includes('[auto-learning.review.create]')), `缺留痕；calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 500);
    assert.strictEqual(j.error, 'API 选型体检执行失败，请重试');
  });

  it('6) POST /portfolio/review/ack 正常：200 + ackId', async () => {
    const r = await fetch(base + M + '/portfolio/review/ack', { method: 'POST', headers: H, body: '{}' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.ok(j.ackId);
  });

  it('7) POST ack 写失败 → 500「核对确认保存失败」+ 留痕（不得假装已归零）', async () => {
    const restore = patchThrow('learningReport', 'create');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + M + '/portfolio/review/ack', { method: 'POST', headers: H, body: '{}' });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[auto-learning.review.ack-create]')), `缺留痕；calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 500, 'ACK 未落库绝不能返回"已归零"');
    assert.strictEqual(j.ok, undefined);
    assert.strictEqual(j.error, '核对确认保存失败，请重试');
  });

  it('8) POST /portfolio/audit 正常：200 + reportId（合约不变）', async () => {
    const r = await fetch(base + M + '/portfolio/audit', { method: 'POST', headers: H, body: '{}' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.ok(j.reportId, '每周盘点正常路径应留存报告');
  });

  it('9) POST audit 写失败 → 500 + 文案 + 留痕 auto-learning.audit-report.create', async () => {
    const restore = patchThrow('learningReport', 'create');
    const stop = captureErrors();
    let status; let j;
    try {
      const r = await fetch(base + M + '/portfolio/audit', { method: 'POST', headers: H, body: '{}' });
      status = r.status; j = await r.json();
    } finally {
      const calls = stop(); restore();
      assert.ok(calls.some((c) => c.includes('[auto-learning.audit-report.create]')), `缺留痕；calls: ${calls.join(' | ')}`);
    }
    assert.strictEqual(status, 500, '周报未落库不得谎报"已留存"');
    assert.strictEqual(j.error, '每周盘点报告保存失败，请重试');
  });

  it('10) 恢复可读后 GET review 仍 200（无需人工修数据）', async () => {
    const r = await fetch(base + M + '/portfolio/review', { headers: H });
    assert.strictEqual(r.status, 200);
  });
});
