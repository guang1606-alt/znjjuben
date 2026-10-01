/**
 * v2.293 守卫：软删除穿透防线（已删项目全端不可见 + 删除在途竞态）。
 *
 * 缺口（修复前实证）：项目软删除（status='deleted'）只在 列表/重命名/归档/克隆 四个端点
 * 过滤，而以下端点查项目时不带 status 过滤，对已删项目照常放行——
 *  资金写入面：POST /episodes（已删项目仍冻结+实扣积分生成新集，成果落进用户
 *    在列表里永远看不到的项目下，钱扣了东西看不见）；POST /projects/:id/fix
 *    （已删项目仍走 consumeFlexible 扣费重写）。
 *  数据写入面：POST /character|prop|scene-assets/from-project（已删项目仍沉淀资产草稿，
 *    产生孤儿数据）。
 *  只读面：GET /projects/:id/scripts|scripts/diff|director-pack|value-card|
 *    listen/playlist|diagnosis|emotion-wave、GET /scripts/:id、/scripts/:id/listen
 *    （已删项目数据仍可读，软删除语义不闭环）。
 *  删除竞态面：DELETE /projects/:id 无在途检查——可删掉正在扣费生成的项目，
 *    在途任务跑完 settle 实扣后成果进已删项目（用户看不到成果也看不到扣费去向）。
 *
 * 修复：①全部项目查询补 status:{not:'deleted'}（对已删项目而言等同于不存在）；
 * ②DELETE 加在途检查——35 分钟内 QUEUED/RUNNING 任务即 409 PROJECT_HAS_RUNNING_TASK
 * （与 v2.292 同口径自愈窗口：全局硬超时 30 分钟 + 收尾余量，崩溃残留绝不永久锁死删除）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'deleted-guard-test-secret';
process.env.JWT_REFRESH_SECRET = 'deleted-guard-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const headers = (uid, level = 'FREE') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const seed = (id, level = 'FREE', balance = 0) => {
  mem._seedUser({ id, level, balance });
  mem._projects.set(`proj_${id}`, { id: `proj_${id}`, userId: id, bible: null });
  return `proj_${id}`;
};
const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';
const CONTENT = '第一集\n场景一 外卖站 日 内\n林夏拎着餐盒冲进门，汗水浸透工服。\n林夏：这单马上到。';

/** 读取完整 SSE 流，返回事件数组（修复前 /episodes 穿透会走通整条沙盘流水线） */
async function callSse(uid, level, body) {
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers: headers(uid, level), body: JSON.stringify(body) });
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) return { status: resp.status, json: await resp.json().catch(() => null), events: [] };
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
    }
  }
  return { status: resp.status, events };
}
const get = (uid, level, path) => fetch(base + path, { headers: headers(uid, level) });
const post = (uid, level, path, body) => fetch(base + path, { method: 'POST', headers: headers(uid, level), body: JSON.stringify(body ?? {}) });
const del = (uid, level, pid) => fetch(base + `/api/generate/projects/${pid}`, { method: 'DELETE', headers: headers(uid, level) });

describe('v2.293 软删除穿透防线', { concurrency: 1 }, () => {
  it('资金核心：已删项目 /episodes → 404，零冻结零建单零落库', async () => {
    const pid = seed('u_dep', 'BASIC', 1000);
    const d = await del('u_dep', 'BASIC', pid);
    assert.strictEqual(d.status, 200, '无在途任务的项目可正常软删');
    assert.strictEqual(mem._projects.get(pid).status, 'deleted');
    const r = await callSse('u_dep', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 404, '已删项目必须 404，不得进入生成流程');
    assert.ok(r.json?.error, '404 必须带可直接展示的中文 error');
    assert.strictEqual(mem._accounts.get('u_dep').balance, 1000, '零扣费');
    assert.strictEqual(mem._accounts.get('u_dep').frozen, 0, '零冻结');
    assert.strictEqual((await mem.generationTask.findMany({ where: { projectId: pid } })).length, 0, '零建单');
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 0, '零落库');
  });

  it('资金：已删项目 /fix → 404，零扣费零新版本', async () => {
    const pid = seed('u_dfx', 'BASIC', 1000);
    await mem.script.create({ data: { projectId: pid, epNo: 1, title: '第一集', synopsis: '梗概', content: CONTENT, wordCount: 100 } });
    await del('u_dfx', 'BASIC', pid);
    const r = await post('u_dfx', 'BASIC', `/api/generate/projects/${pid}/fix`, { fix: { rule: 'dialogue_polish', dimLabel: '台词', advice: '台词更口语化' } });
    assert.strictEqual(r.status, 404, '已删项目 /fix 必须 404');
    assert.strictEqual(mem._accounts.get('u_dfx').balance, 1000, '零扣费');
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 1, '不得产生新版本');
  });

  it('数据写入：已删项目三个资产沉淀端点 → 404，零孤儿数据', async () => {
    const pid = seed('u_das', 'PRO', 0);
    mem._projects.get(pid).bible = { characters: { '林夏': { traits: '坚韧隐忍', arc: '成长', voice: '冷静' } } };
    await mem.script.create({ data: { projectId: pid, epNo: 1, title: '第一集', synopsis: '梗概', content: CONTENT, wordCount: 100 } });
    await del('u_das', 'PRO', pid);
    const before = mem._characterAssets.length + mem._propAssets.length + mem._sceneAssets.length;
    for (const kind of ['character', 'prop', 'scene']) {
      const r = await post('u_das', 'PRO', `/api/generate/${kind}-assets/from-project/${pid}`);
      assert.strictEqual(r.status, 404, `${kind}-assets 对已删项目必须 404`);
    }
    const afterN = mem._characterAssets.length + mem._propAssets.length + mem._sceneAssets.length;
    assert.strictEqual(afterN, before, '已删项目不得沉淀任何资产草稿');
  });

  it('只读一致性：已删项目只读端点群 → 4xx 且无数据泄露', async () => {
    const pid = seed('u_dro', 'PRO', 0);
    const sc = await mem.script.create({ data: { projectId: pid, epNo: 1, title: '第一集', synopsis: '梗概', content: CONTENT, wordCount: 100 } });
    await del('u_dro', 'PRO', pid);
    const cases = [
      `/api/generate/projects/${pid}/scripts`,
      `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1&to=1`,
      `/api/generate/projects/${pid}/director-pack`,
      `/api/generate/projects/${pid}/value-card`,
      `/api/generate/projects/${pid}/listen/playlist`,
      `/api/generate/projects/${pid}/diagnosis`,
      `/api/generate/projects/${pid}/emotion-wave`,
    ];
    for (const path of cases) {
      const r = await get('u_dro', 'PRO', path);
      assert.strictEqual(r.status, 404, `${path} 对已删项目必须 404`);
    }
    // 反查面（先查剧本再查项目）：已删项目下剧本不可读
    const r1 = await get('u_dro', 'PRO', `/api/generate/scripts/${sc.id}`);
    assert.ok([403, 404].includes(r1.status), `/scripts/:id 对已删项目必须拒绝，实际 ${r1.status}`);
    const r2 = await get('u_dro', 'PRO', `/api/generate/scripts/${sc.id}/listen`);
    assert.ok([403, 404].includes(r2.status), `/scripts/:id/listen 对已删项目必须拒绝，实际 ${r2.status}`);
  });

  it('删除竞态：在途 RUNNING 任务的项目 DELETE → 409，项目保持原状', async () => {
    const pid = seed('u_run', 'BASIC', 1000);
    await mem.generationTask.create({ data: { projectId: pid, userId: 'u_run', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10 } });
    const r = await del('u_run', 'BASIC', pid);
    assert.strictEqual(r.status, 409, '有在途任务的项目必须拒绝删除');
    const j = await r.json();
    assert.strictEqual(j.code, 'PROJECT_HAS_RUNNING_TASK');
    assert.ok(j.error && j.error.length > 0, 'error 必须是可直接展示的中文文案');
    assert.notStrictEqual(mem._projects.get(pid).status, 'deleted', '项目不得被删除');
  });

  it('删除竞态自愈：任务 DONE/FAILED 后可删；35 分钟前崩溃残留 RUNNING 不锁死删除', async () => {
    // 终态不阻塞
    const pid1 = seed('u_fin', 'BASIC', 0);
    await mem.generationTask.create({ data: { projectId: pid1, userId: 'u_fin', stage: 'draft', engineTier: 'ECONOMY', status: 'DONE', pointsCost: 10 } });
    await mem.generationTask.create({ data: { projectId: pid1, userId: 'u_fin', stage: 'draft', engineTier: 'ECONOMY', status: 'FAILED', pointsCost: 10 } });
    const r1 = await del('u_fin', 'BASIC', pid1);
    assert.strictEqual(r1.status, 200, '终态任务不得阻塞删除');
    assert.strictEqual(mem._projects.get(pid1).status, 'deleted');
    // 崩溃残留（35 分钟前的 RUNNING 行，进程已死不会再收尾）不永久锁死删除
    const pid2 = seed('u_stale', 'BASIC', 0);
    await mem.generationTask.create({ data: { projectId: pid2, userId: 'u_stale', stage: 'draft', engineTier: 'ECONOMY', status: 'RUNNING', pointsCost: 10, createdAt: new Date(Date.now() - 36 * 60_000) } });
    const r2 = await del('u_stale', 'BASIC', pid2);
    assert.strictEqual(r2.status, 200, '35 分钟前残留 RUNNING 必须放行删除（与全局硬超时可以自愈同口径）');
    assert.strictEqual(mem._projects.get(pid2).status, 'deleted');
  });

  it('回归：正常项目生成/只读/删除全链路不受影响', async () => {
    const pid = seed('u_ok', 'BASIC', 1000);
    const r = await callSse('u_ok', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.find((e) => e.stage === 'done'), '正常项目必须正常生成完成');
    assert.strictEqual(mem._accounts.get('u_ok').balance, 990);
    const scripts = await get('u_ok', 'BASIC', `/api/generate/projects/${pid}/scripts`);
    assert.strictEqual(scripts.status, 200, '正常项目剧本列表必须可读');
    const list = await scripts.json();
    assert.strictEqual(list.length, 1);
    const one = await get('u_ok', 'BASIC', `/api/generate/scripts/${list[0].id}`);
    assert.strictEqual(one.status, 200, '正常项目单集正文必须可读');
    const d = await del('u_ok', 'BASIC', pid);
    assert.strictEqual(d.status, 200, '无在途任务的正常项目可删');
    const again = await get('u_ok', 'BASIC', `/api/generate/projects/${pid}/scripts`);
    assert.strictEqual(again.status, 404, '删除后即刻不可读');
  });
});
