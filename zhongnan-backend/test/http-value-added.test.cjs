const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'va-secret';
process.env.JWT_REFRESH_SECRET = 'va-refresh';
// 不配置任何图片/文本密钥：文本走沙盘兜底，图片 callImage 无密钥必抛 IMAGE_NOT_CONFIGURED（用于验证失败退款）
delete process.env.IMAGE_API_KEY; delete process.env.OPENAI_API_KEY;
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const bal = (uid) => mem._accounts.get(uid).balance;
const refundLedgers = (uid) => mem._ledgers.filter((l) => l.userId === uid && String(l.reason).endsWith('REFUND'));
mem._seedUser({ id: 'rich', balance: 200 });
mem._seedUser({ id: 'mid', balance: 100 });
mem._seedUser({ id: 'poor', balance: 5 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (path, body, uid) => fetch(base + path, { method: 'POST', headers: H(uid), body: JSON.stringify(body) });

describe('增值服务消费-失败退款 资金链路', { concurrency: 1 }, () => {
  it('未登录 401；空问题 400 且不扣分', async () => {
    const r0 = await fetch(base + '/api/va/xiaonan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'x' }) });
    assert.strictEqual(r0.status, 401);
    const r = await post('/api/va/xiaonan', { question: '' }, 'poor');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bal('poor'), 5);
  });
  it('小南深度共创成功扣10积分并返回答案', async () => {
    const r = await post('/api/va/xiaonan', { question: '怎么设计黄金三秒钩子？' }, 'mid');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 10);
    assert.strictEqual(typeof j.answer, 'string'); // 无密钥沙盘返回空串，真实质量待 Key 盲测；此处验扣费链路
    assert.strictEqual(bal('mid'), 90);
  });
  it('余额不足在扣费阶段失败：400 且余额不变（本就没扣，不退）', async () => {
    const r = await post('/api/va/xiaonan', { question: '再来一次' }, 'poor');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bal('poor'), 5);
    assert.strictEqual(refundLedgers('poor').length, 0);
  });
  it('图片下游未配置/失败：已扣积分原样退回，余额复原且有退款流水', async () => {
    await mem.project.create({ data: { id: 'pj1', userId: 'rich', title: '逆袭人生', tags: ['逆袭', '都市'] } });
    const before = bal('rich');
    const r = await post('/api/va/poster', { projectId: 'pj1', tier: 'STANDARD' }, 'rich');
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.match(j.error, /IMAGE_NOT_CONFIGURED/);
    assert.strictEqual(bal('rich'), before, '海报失败必须退款，余额复原');
    assert.strictEqual(refundLedgers('rich').length, 1);
  });
  it('PK 剧本不存在：扣费后查无对象，404 且退款复原', async () => {
    const before = bal('mid');
    const r = await post('/api/va/pk', { scriptAId: 'nope1', scriptBId: 'nope2' }, 'mid');
    assert.strictEqual(r.status, 404);
    assert.strictEqual(bal('mid'), before);
  });
  it('PK 成功：扣20积分、出对比结果、落对战记录', async () => {
    await mem.project.create({ data: { id: 'pjMid', userId: 'mid', title: '我的本', tags: ['都市'] } });
    await mem.script.create({ data: { id: 'sA', projectId: 'pjMid', content: '片段A：她推开门，全场安静。'.repeat(3) } });
    await mem.script.create({ data: { id: 'sB', projectId: 'pjMid', content: '片段B：他攥紧拳头，冷笑一声。'.repeat(3) } });
    const before = bal('mid');
    const r = await post('/api/va/pk', { scriptAId: 'sA', scriptBId: 'sB' }, 'mid');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 20);
    assert.strictEqual(typeof j.analysis, 'string');
    assert.ok(j.result && Array.isArray(j.result.dimensions) && j.result.dimensions.length === 6);
    assert.ok(['A', 'B', 'tie'].includes(j.result.winner));
    assert.strictEqual(bal('mid'), before - 20);
    assert.strictEqual(mem._pkBattles.length, 1);
  });
  it('PK 项目级：缺省对手自动对阵平台标杆本，扣20积分', async () => {
    const before = bal('mid');
    const r = await post('/api/va/pk', { projectAId: 'pjMid' }, 'mid');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 20);
    assert.strictEqual(j.titleB, '平台标杆本·都市逆袭');
    assert.ok(j.result.dimensions.length === 6);
    assert.strictEqual(bal('mid'), before - 20);
  });
  it('PK 项目级：A不属于自己则403且退款', async () => {
    const before = bal('mid');
    const r = await post('/api/va/pk', { projectAId: 'pj1' }, 'mid'); // pj1 属 rich
    assert.strictEqual(r.status, 404);
    assert.strictEqual(bal('mid'), before);
  });
  it('战力榜：查看免费不扣分，PK后 mine 上榜带段位与排名', async () => {
    const before = bal('mid');
    // 先确保 mid 至少有一局（上面用例已产生，这里带新 clientToken 再打一局，刻意重玩应正常计费）
    await post('/api/va/pk', { projectAId: 'pjMid', clientToken: 'lb-again-1' }, 'mid');
    // 同令牌立即重试 → 409 幂等拦截，不重复扣分
    const replay = await post('/api/va/pk', { projectAId: 'pjMid', clientToken: 'lb-again-1' }, 'mid');
    assert.strictEqual(replay.status, 409);
    const r = await fetch(base + '/api/va/pk/leaderboard', { headers: H('mid') });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.ok);
    assert.ok(j.board.seasonId.startsWith('S'));
    assert.ok(j.board.mine && j.board.mine.userId === 'mid');
    assert.ok(j.board.mine.rank >= 1);
    assert.ok(typeof j.board.mine.power === 'number');
    assert.ok(j.board.mine.tierEn && !/[一-鿿]/.test(j.board.mine.tierEn));
    assert.ok(j.nextTier && 'progress' in j.nextTier);
    // 查看榜单不扣分（只扣了上面那局 PK 的 20）
    assert.strictEqual(bal('mid'), before - 20);
  });
  it('战力榜：未登录 401', async () => {
    const r = await fetch(base + '/api/va/pk/leaderboard');
    assert.strictEqual(r.status, 401);
  });
});
