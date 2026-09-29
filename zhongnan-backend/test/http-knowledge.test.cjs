const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'kn-secret';
process.env.JWT_REFRESH_SECRET = 'kn-refresh';
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
mem._seedUser({ id: 'subadm', phone: '13000000012', level: 'PRO', isAdmin: true }); // 副管：标记在、无后台权
mem._seedUser({ id: 'op' });
const K = '/api/admin/knowledge';
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'PRO' })}` });
const post = (path, body, uid) => fetch(base + K + path, { method: 'POST', headers: H(uid), body: JSON.stringify(body) });
const get = (path, uid) => fetch(base + K + path, { headers: H(uid) });
const upload = (content, title = '一条创作技法', extra = {}) => ({
  kind: 'TEXT', title, content: content || '黄金三秒要用动作钩子开场，先给结果再倒叙起因，避免平铺直叙。', category: 'plot', ...extra,
});

describe('后台学习窗口 HTTP 闭环', { concurrency: 1 }, () => {
  it('未登录 401；普通用户进入后台 403（学习窗口仅管理员）', async () => {
    const r0 = await fetch(base + K + '/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upload()) });
    assert.strictEqual(r0.status, 401);
    const r1 = await post('/', upload(), 'op');
    assert.strictEqual(r1.status, 403);
    const r2 = await post('/', upload(), 'subadm');
    assert.strictEqual(r2.status, 403, '副管理员不再可进知识库后台');
    assert.strictEqual((await r2.json()).needSuperAdmin, true);
  });
  it('管理员上传合规知识 → PENDING 待审核', async () => {
    const r = await post('/', upload(), 'admin');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.status, 'PENDING');
    assert.ok(j.id);
  });
  it('违规/相悖内容直接 REJECTED 且注明原因（政策一致性预检）', async () => {
    const r = await post('/', upload('这里讲赌博技巧和诈骗教程怎么操作'), 'admin');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.status, 'REJECTED');
    assert.match(j.conflictNote, /相悖|拦截/);
  });
  it('重复/近似知识标记去冗（DUPLICATE）', async () => {
    const content = '集尾钩子要在情绪最高点切断，留下未解疑问，驱动点下一集。';
    await post('/', upload(content), 'admin');
    const r2 = await post('/', upload(content, '另一条几乎相同'), 'admin');
    const j = await r2.json();
    assert.strictEqual(j.dedup, 'DUPLICATE');
  });
  it('学习队列按状态筛选；approve 生效、不存在 404；reject 驳回', async () => {
    const c = await (await post('/', upload('反派人设要有合理动机，避免脸谱化工具人。', '人设技法', { category: 'character' }), 'admin')).json();
    const ap = await post(`/${c.id}/approve`, {}, 'admin');
    assert.strictEqual(ap.status, 200);
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === c.id).status, 'APPROVED');
    const ap404 = await post('/no_such/approve', {}, 'admin');
    assert.strictEqual(ap404.status, 404);
    const pend = await (await post('/', upload('待驳回的一条。'), 'admin')).json();
    const rj = await post(`/${pend.id}/reject`, { reason: '质量不足' }, 'admin');
    assert.strictEqual(rj.status, 200);
    assert.strictEqual(mem._knowledgeItems.find((k) => k.id === pend.id).status, 'REJECTED');
    const approved = await (await get('/?status=APPROVED', 'admin')).json();
    assert.ok(approved.length >= 1 && approved.every((k) => k.status === 'APPROVED'));
  });
  it('技能包打包下载：仅含已生效知识、带版本/统计/附件头', async () => {
    const r = await get('/skill-package', 'admin');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-disposition') || '', /attachment/);
    const pkg = await r.json();
    assert.strictEqual(pkg.stats.total, pkg.items.length);
    assert.ok(pkg.items.length >= 1);
    assert.match(pkg.version, /^skill-/);
  });
});

describe('自主学习闭环（仅管理员，用户不可见）', { concurrency: 1 }, () => {
  it('普通用户触发自主学习 403', async () => {
    const r = await fetch(base + K + '/self-learn/run', { method: 'POST', headers: H('op'), body: JSON.stringify({ signals: [] }) });
    assert.strictEqual(r.status, 403);
  });
  it('管理员跑一轮：高置信创作技巧自动生效(AUTO)，政策类挂起待审，并出学习报告', async () => {
    const body = {
      signals: [
        { kind: 'ADOPTED_PATTERN', title: '集尾信息差卡点技法', score: 96, content: '当观众比角色多掌握一条关键信息时在峰值切断，用具体动作和半句台词制造揪心追更，信息越具体越有效，补充足够的细节描述长度' },
        { kind: 'POLICY_UPDATE', title: '某平台备案尺度更新', score: 90, content: '平台对穿越题材的备案与内容尺度提出新的合规要求说明，需要人工核对原文后再决定是否生效执行' },
      ],
    };
    const r = await post('/self-learn/run', body, 'admin');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.report.summary.autoApproved, 1, '创作技巧自动生效1条');
    assert.strictEqual(j.report.summary.pending, 1, '政策类待人工审1条');
    const auto = j.created.find((c) => c.decision === 'AUTO_APPROVE');
    assert.ok(auto && auto.confidence >= 72);
    assert.ok(j.report.text.includes('自主学习报告'));
    const rep = await (await get('/self-learn/report', 'admin')).json();
    assert.ok(rep.total >= 2 && rep.autoLearnedApproved >= 1 && rep.pendingNeedHuman >= 1);
  });
  it('空信号也可跑：仅做自主淘汰与快照，不报错', async () => {
    const r = await post('/self-learn/run', { signals: [] }, 'admin');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.report.summary.scanned, 0);
  });
});

describe('完整自主学习闭环 run-auto（仅管理员，不依赖手动上传）', { concurrency: 1 }, () => {
  it('普通用户 403', async () => {
    const r = await fetch(base + K + '/self-learn/run-auto', { method: 'POST', headers: H('op') });
    assert.strictEqual(r.status, 403);
  });
  it('站内高分剧本被自动提炼学习并留存报告；重复跑不重复入库（learnKey去重）', async () => {
    await mem.script.create({ data: {
      projectId: 'p1', epNo: 1, title: '第一集', wordCount: 900, qcPassed: true,
      synopsis: '落魄外卖员凭一手祖传厨艺逆袭、一路打开高端餐饮局面的热血成长故事梗概',
      content: 'SECRET_FULL_TEXT_SHOULD_NOT_LEAK',
      qcReport: { total: 90, dimensions: [{ key: 'dialogue', label: '台词', score: 92 }, { key: 'plot', label: '剧情结构', score: 88 }] },
    }});
    const run = async () => (await post('/self-learn/run-auto', {}, 'admin')).json();
    const j1 = await run();
    assert.ok(j1.collected >= 1, '采集到高分剧本信号');
    assert.ok(j1.created.some((c) => c.decision === 'AUTO_APPROVE'), '高置信技法自动生效');
    const learned = j1.created.find((c) => c.decision === 'AUTO_APPROVE');
    assert.ok(learned && !JSON.stringify(learned).includes('SECRET_FULL_TEXT'), '脱敏：正文不进入知识库');
    assert.ok(j1.reportId, '学习报告已留存');
    // 第二跑：同一 learnKey 被跳过，不再新增
    const j2 = await run();
    assert.strictEqual(j2.created.length, 0, '重复学习被 learnKey 去重');
    const rep = await (await get('/self-learn/reports?kind=DAILY_LEARN', 'admin')).json();
    assert.ok(rep.reports.length >= 1 && rep.reports[0].kind === 'DAILY_LEARN');
  });
});
