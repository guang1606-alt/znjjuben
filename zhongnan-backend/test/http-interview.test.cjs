const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-secret';
process.env.JWT_REFRESH_SECRET = 'iv-refresh';
const { createApp } = require('../dist/server/app.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const ENG = require('../dist/engine/interview.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 沙盘隔离：无任何供应商端点 → callText 返回 sandbox('')，AI 全走确定性兜底
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ interview: createInterviewRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'rich', balance: 500 });
mem._seedUser({ id: 'poor', balance: 3 });
mem._seedUser({ id: 'other', balance: 200 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid, extraHeaders = {}) => fetch(base + p, { method: 'POST', headers: { ...H(uid), ...extraHeaders }, body: JSON.stringify(b) });
const get = (p, uid) => fetch(base + p, { headers: H(uid) });
const bal = (uid) => mem._accounts.get(uid).balance;

/* ---------------- 引擎确定性单元 ---------------- */
describe('采访引擎·确定性机制', { concurrency: 1 }, () => {
  it('captureRawNotes：按句归档，短句(<8字)丢弃防噪声', () => {
    const out = ENG.captureRawNotes('好。今天他离开了老家，去城里找活干。', ENG.emptyMaterials());
    assert.deepStrictEqual(out.rawNotes, ['今天他离开了老家']);
  });
  it('mergeMaterials：去重且先到先得（保留用户原表达）', () => {
    const prev = ENG.emptyMaterials(); prev.quotes = ['巧了，这店租约写的我名'];
    const out = ENG.mergeMaterials(prev, { quotes: ['巧了，这店租约写的我名', '新的金句'], scenes: ['后厨小店'] });
    assert.deepStrictEqual(out.quotes, ['巧了，这店租约写的我名', '新的金句']);
    assert.deepStrictEqual(out.scenes, ['后厨小店']);
  });
  it('gapReport/readyCheck：欲望+冲突齐备且满2轮才就绪', () => {
    const m = ENG.captureRawNotes('被辞退的她想夺回自己的餐厅。但前合伙人处处打压她。', ENG.emptyMaterials());
    const g = ENG.gapReport(m, 'zh');
    assert.ok(g.desire && g.conflict);
    assert.strictEqual(ENG.readyCheck(m, 1, 'zh'), false);
    assert.strictEqual(ENG.readyCheck(m, 2, 'zh'), true);
  });
  it('ruleGapQuestion：欲望→冲突→代价→转折 优先级兜底', () => {
    const e = ENG.emptyMaterials();
    assert.strictEqual(ENG.ruleGapQuestion(e, 0, 'zh'), '先聊最关键的：主角是谁？他/她最想要什么？（一句话即可，我在记录）');
    e.relationships = ['她想夺回餐厅'];
    assert.strictEqual(ENG.ruleGapQuestion(e, 0, 'zh'), '收到。那挡着他/她的最大阻力是什么？谁在跟主角作对？');
  });
  it('buildBrief：结构化简报含事实源四维，中英双语头部', () => {
    const m = ENG.emptyMaterials();
    m.relationships = ['前合伙人 vs 主厨']; m.rawNotes = ['今天他离开了老家'];
    const zh = ENG.buildBrief(m, 'zh');
    assert.ok(zh.includes('【采访式创作 · 创意简报】') && zh.includes('前合伙人 vs 主厨') && zh.includes('今天他离开了老家'));
    const en = ENG.buildBrief(ENG.emptyMaterials(), 'en');
    assert.ok(en.includes('creative brief'));
  });
  it('interviewTurn 沙盘：AI 不可用时素材仍归档、规则问兜底、零成本', async () => {
    const out = await ENG.interviewTurn('STANDARD', '被辞退的女厨师想夺回餐厅。但前合伙人在打压她。', ENG.emptyMaterials(), '', [], 'zh');
    assert.strictEqual(out.aiExtract, false);
    assert.strictEqual(out.aiQuestion, false);
    assert.strictEqual(out.costFen, 0);
    assert.ok(out.materials.rawNotes.length >= 1);
    assert.ok(out.question.length >= 6);
  });
});

/* ---------------- HTTP 路由闭环 ---------------- */
describe('采访式创作·HTTP 闭环', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/interview/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: '测试想法' }) });
    assert.strictEqual(r.status, 401);
  });
  it('开场：idea 即第一轮素材，扣5积分返回第一个追问与缺口', async () => {
    const before = bal('rich');
    const r = await post('/api/interview/sessions', {
      idea: '被辞退的女厨师想夺回自己的餐厅，但前合伙人在打压她',
      title: '夺店风云', clientToken: 'open-1',
    }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.sessionId && typeof j.question === 'string' && j.question.length >= 6);
    assert.strictEqual(j.points, 5);
    assert.strictEqual(j.ready, false);
    assert.ok(j.materials.rawNotes.length >= 1, '素材即事实源：沙盘下 rawNotes 必须归档');
    assert.ok(j.gaps.desire && j.gaps.conflict);
    assert.strictEqual(bal('rich'), before - 5);
    global.ivSession = j.sessionId;
  });
  it('追问一轮：turnCount 累计、就绪判定转 true、再扣5积分', async () => {
    const before = bal('rich');
    const r = await post(`/api/interview/sessions/${global.ivSession}/turn`, {
      text: '如果失败她将失去女儿的抚养权，直到一份旧账本揭开真相',
    }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.turnCount, 2);
    assert.strictEqual(j.transcript.length, 2);
    assert.strictEqual(j.ready, true);
    assert.strictEqual(bal('rich'), before - 5);
  });
  it('幂等重放：相同 clientToken 同窗返回 409 且不重复扣费', async () => {
    const before = bal('rich');
    const r = await post('/api/interview/sessions', {
      idea: '被辞退的女厨师想夺回自己的餐厅，但前合伙人在打压她',
      clientToken: 'open-1',
    }, 'rich');
    assert.strictEqual(r.status, 409);
    assert.strictEqual(bal('rich'), before);
  });
  it('余额不足：400 且余额不变、不建会话', async () => {
    const r = await post('/api/interview/sessions', { idea: '一个想要夺回人生的女性成长故事' }, 'poor');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bal('poor'), 3);
  });
  it('越权 403 / 不存在 404', async () => {
    const o = await post('/api/interview/sessions', { idea: '别人的想法也想试一试采访流程呢' }, 'other');
    const oj = await o.json();
    const r403 = await get(`/api/interview/sessions/${oj.sessionId}`, 'rich');
    assert.strictEqual(r403.status, 403);
    const r404 = await get('/api/interview/sessions/iv_notexist', 'rich');
    assert.strictEqual(r404.status, 404);
  });
  it('会话列表与详情', async () => {
    const list = await get('/api/interview/sessions', 'rich');
    const lj = await list.json();
    assert.ok(lj.sessions.some((s) => s.id === global.ivSession));
    const one = await get(`/api/interview/sessions/${global.ivSession}`, 'rich');
    const oj = await one.json();
    assert.strictEqual(oj.session.turnCount, 2);
  });
  it('简报：确定性拼装、就绪后会话转 CONVERTED，再追问返回 409', async () => {
    const r = await post(`/api/interview/sessions/${global.ivSession}/brief`, {}, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ready, true);
    assert.ok(j.brief.includes('【采访式创作 · 创意简报】'));
    assert.ok(j.brief.includes('◆ 其他原始素材') && j.brief.includes('被辞退的女厨师想夺回自己的餐厅'));
    assert.strictEqual(j.status, 'CONVERTED');
    const t = await post(`/api/interview/sessions/${global.ivSession}/turn`, { text: '再补充一点细节可以吗' }, 'rich');
    assert.strictEqual(t.status, 409);
  });
  it('关闭会话', async () => {
    const o = await post('/api/interview/sessions', { idea: '另一个还没聊完的案子，先收尾处理' }, 'other');
    const oj = await o.json();
    const r = await post(`/api/interview/sessions/${oj.sessionId}/close`, {}, 'other');
    assert.strictEqual(r.status, 200);
    const one = await get(`/api/interview/sessions/${oj.sessionId}`, 'other');
    assert.strictEqual((await one.json()).session.status, 'CLOSED');
  });
});
