const { it, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = 'editing-regression-access';
process.env.JWT_REFRESH_SECRET = 'editing-regression-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const { createExportRouter } = require('../dist/routes/export.js');
const { buildScriptDoc } = require('../dist/lib/script-doc.js');
const pipeline = require('../dist/agents/pipeline.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const mem = createMemoryPrisma();
const server = createApp({ generate: createGenerateRouter(mem), interview: createInterviewRouter(mem), export: createExportRouter(mem) }).listen(0);
let base;
before(() => new Promise(resolve => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); })));
after(async () => { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); await require('../dist/lib/prisma.js').prisma.$disconnect(); });
function request(path, body, uid = 'editor') {
  return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function post(path, body, uid) { const r = await request(path, body, uid); return { status: r.status, json: await r.json() }; }
mem._seedUser({ id: 'editor', level: 'BASIC', balance: 5000 });
mem._seedUser({ id: 'stranger', level: 'BASIC', balance: 5000 });

for (const [kind, field] of [['character', 'persona'], ['prop', 'meaning'], ['scene', 'meaning']]) {
  it(`${kind} asset rename updates selected id and rejects name collisions without overwriting`, async () => {
    const path = `/api/generate/${kind}-assets`;
    const a = (await post(path, { name: '原名甲', [field]: '原有设定甲' })).json.asset;
    const b = (await post(path, { name: '原名乙', [field]: '原有设定乙' })).json.asset;
    const renamed = await post(path, { id: a.id, name: '改名甲', [field]: '修订设定甲' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.json.asset.id, a.id, 'rename must keep original asset identity');
    const collision = await post(path, { id: a.id, name: b.name, [field]: '不能覆盖乙' });
    assert.equal(collision.status, 409);
    assert.ok(collision.json.message);
    const duplicate = await post(path, { name: b.name, [field]: '不能借新建覆盖乙' });
    assert.equal(duplicate.status, 409);
    const foreign = await post(path, { id: a.id, name: '越权改名', [field]: '越权' }, 'stranger');
    assert.equal(foreign.status, 404);
    const missing = await post(path, { id: 'missing-id', name: '不存在', [field]: '无记录' });
    assert.equal(missing.status, 404);
    const list = await (await request(path)).json();
    assert.equal(list.assets.length, 2);
    assert.equal(list.assets.find(x => x.id === a.id).name, '改名甲');
    assert.equal(list.assets.find(x => x.id === b.id)[field], '原有设定乙');
  });
}

it('interview reload retains pending question and associates the next answer with that question', async () => {
  const opened = await post('/api/interview/sessions', { idea: '女厨师希望重开家里的餐厅，前合伙人却阻拦她。' });
  assert.equal(opened.status, 200);
  const path = `/api/interview/sessions/${opened.json.sessionId}`;
  const reloaded = await (await request(path)).json();
  assert.equal(reloaded.session.question, opened.json.question);
  const answered = await post(path + '/turn', { text: '她必须赶在月底之前拿回租约，否则家人无处可去。' });
  assert.equal(answered.status, 200);
  assert.equal(answered.json.transcript.at(-1).q, opened.json.question);
  const answeredAgain = await post(path + '/turn', { text: '她在后厨找到旧账本，决定当众公布真实租约。' });
  assert.equal(answeredAgain.json.transcript.at(-1).q, answered.json.question);
  const final = await (await request(path)).json();
  assert.equal(final.session.question, answeredAgain.json.question);
});

const script = (projectId, epNo, version, content) => ({ projectId, epNo, version, title: `第${epNo}集`, synopsis: '', content, wordCount: content.length, qcReport: { beats: { reversalId: content } } });
it('targeted fix rejects a missing explicit episode before charging or modifying another episode', async () => {
  const p = await mem.project.create({ data: { userId: 'editor', title: '指定不存在的分集', mode: 'tags' } });
  await mem.script.create({ data: script(p.id, 1, 1, '第一集原稿，不应因请求第二集而被改写。') });
  const balance = mem._accounts.get('editor').balance;
  const ledgerCount = mem._ledgers.length;
  const originalScripts = structuredClone(mem._scripts.filter(x => x.projectId === p.id));
  const result = await post(`/api/generate/projects/${p.id}/fix`, {
    epNo: 2,
    fix: { rule: 'dialogue', dimLabel: '台词', advice: '请缩短台词。' },
  });
  assert.equal(result.status, 400);
  assert.match(result.json.error, /指定的分集不存在/);
  assert.equal(mem._accounts.get('editor').balance, balance);
  assert.equal(mem._ledgers.length, ledgerCount, 'invalid episode must not charge and refund a different episode');
  assert.deepEqual(mem._scripts.filter(x => x.projectId === p.id), originalScripts);
});
const brief = '外卖员林夏发现自己即将接手的公司涉嫌造假，她决定收集证据保护同事。';
async function generate(projectId) {
  const response = await request('/api/generate/episodes', { projectId, brief });
  assert.equal(response.status, 200);
  return (await response.text()).split('\n').filter(x => x.startsWith('data: ')).map(x => JSON.parse(x.slice(6)));
}
for (const [name, rows, next] of [
  ['first sequel', [[1, 1, '第一集结尾唯一标记']], 2],
  ['revised episode', [[1, 1, '旧版本标记'], [1, 2, '新版结尾标记']], 2],
  ['existing episode gap', [[1, 1, '第一集内容'], [4, 1, '第四集最新结尾']], 5],
]) {
  it(`generation ${name} uses max episode + 1 and latest previous revision`, async () => {
    const project = await mem.project.create({ data: { userId: 'editor', title: name, mode: 'tags', totalEps: 12, bible: { adaptationDraft: { recordId: 'source', brief: '改编大纲' } } } });
    for (const row of rows) await mem.script.create({ data: script(project.id, ...row) });
    const run = pipeline.runEpisode;
    let options;
    pipeline.runEpisode = async (...args) => { options = args[4]; return run(...args); };
    try {
      const events = await generate(project.id);
      assert.ok(events.some(x => x.stage === 'done'), JSON.stringify(events.at(-1)));
      const saved = mem._scripts.filter(x => x.projectId === project.id).at(-1);
      assert.equal(saved.epNo, next);
      assert.equal(options.episodeIndex, next - 1);
      assert.equal(options.prevEpisode.epNo, rows.at(-1)[0]);
      assert.equal(options.prevEpisode.summary, rows.at(-1)[2]);
      assert.deepEqual(options.prevDevices, rows.filter((row, i) => !rows.slice(i + 1).some(x => x[0] === row[0])).map(row => ({ ep: row[0], reversalId: row[2], payoffIds: [], emotionPath: [] })));
      assert.equal(mem._projects.get(project.id).bible.adaptationDraft.recordId, 'source');
    } finally { pipeline.runEpisode = run; }
  });
}

it('export body, document model, materials and episode header use one latest version per episode', async () => {
  const p = await mem.project.create({ data: { userId: 'editor', title: '修订导出', mode: 'tags' } });
  const rows = [script(p.id, 1, 2, '内景 新店 夜\n林夏：新版唯一正文。'), script(p.id, 2, 1, '外景 街口 日\n林夏：第二集正文。'), script(p.id, 1, 1, '内景 旧店 夜\n林夏：旧版不可导出。')];
  for (const row of rows) await mem.script.create({ data: row });
  const doc = buildScriptDoc(p, rows);
  assert.equal(doc.epCount, 2);
  assert.deepEqual(doc.blocks.filter(b => b.kind === 'epStart').map(b => b.ep), [1, 2]);
  const r = await request(`/api/export/${p.id}?format=txt`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-Episode-Count'), '2');
  const body = await r.text();
  assert.ok(body.includes('新版唯一正文'));
  assert.ok(!body.includes('旧版不可导出'));
  const material = await (await request(`/api/export/${p.id}/materials`)).json();
  assert.equal(material.episodeCount, 2);
  assert.ok(!JSON.stringify(material).includes('旧店'));
});

it('demo storage uses database episode filters, version defaults and real timestamps', async () => {
  const isolated = createMemoryPrisma();
  const p = await isolated.project.create({ data: { userId: 'editor', title: '默认值', mode: 'tags' } });
  assert.ok(Number.isFinite(new Date(p.createdAt).getTime()));
  assert.ok(Number.isFinite(new Date(p.updatedAt).getTime()));
  const a = await isolated.script.create({ data: { projectId: p.id, epNo: 1, title: '一', content: '正文' } });
  assert.equal(a.version, 1);
  await isolated.script.create({ data: script(p.id, 2, 1, '第二集') });
  await isolated.script.create({ data: script(p.id, 1, 2, '第一集修订') });
  assert.equal((await isolated.script.findFirst({ where: { projectId: p.id, epNo: 1 }, orderBy: { version: 'desc' } })).content, '第一集修订');
  assert.equal(await isolated.script.findFirst({ where: { projectId: p.id, epNo: 0 } }), null);
});

it('a compliance rejection returns reserved points and never delivers or saves a script', async () => {
  const p = await mem.project.create({ data: { userId: 'editor', title: '审核拒绝', mode: 'tags' } });
  const balance = mem._accounts.get('editor').balance;
  const run = pipeline.runEpisode;
  pipeline.runEpisode = async () => { throw new Error('COMPLIANCE_REJECTED'); };
  try {
    const events = await generate(p.id);
    assert.ok(events.some(x => x.stage === 'failed_refunded'));
    assert.ok(!events.some(x => x.stage === 'done'));
    assert.equal(mem._scripts.filter(x => x.projectId === p.id).length, 0);
    assert.equal(mem._accounts.get('editor').balance, balance);
    assert.equal(mem._accounts.get('editor').frozen, 0);
  } finally { pipeline.runEpisode = run; }
});

it('a final content scan BLOCK returns points and withholds delivery and persistence', async () => {
  const safety = require('../dist/lib/safety-store.js');
  const p = await mem.project.create({ data: { userId: 'editor', title: '终稿拦截', mode: 'tags' } });
  const balance = mem._accounts.get('editor').balance;
  const run = pipeline.runEpisode;
  await safety.saveOverrides({ disabled: [], custom: [{ id: 'test-final-block', category: '测试规则', label: '终稿拦截', severity: 'BLOCK', patterns: ['终稿规则唯一标记'], advice: '请修改' }] }, 'test', mem);
  pipeline.runEpisode = async (...args) => ({ ...await run(...args), draft: '终稿规则唯一标记' });
  try {
    const events = await generate(p.id);
    assert.ok(events.some(x => x.stage === 'failed_refunded'), events.map(x => x.stage).join(','));
    assert.ok(!events.some(x => x.stage === 'done'));
    assert.equal(mem._scripts.filter(x => x.projectId === p.id).length, 0);
    assert.equal(mem._accounts.get('editor').balance, balance);
    assert.equal(mem._accounts.get('editor').frozen, 0);
  } finally { pipeline.runEpisode = run; await safety.saveOverrides({ disabled: [], custom: [] }, 'test', mem); }
});
