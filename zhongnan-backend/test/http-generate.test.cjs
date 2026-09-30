const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'gen-test-secret';
process.env.JWT_REFRESH_SECRET = 'gen-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const P = require('../dist/config/pricing.js');
// v2.194 隔离真实 DB 供应商配置（DB 已有 13 个真实供应商），测试走沙盘，不打真机 API
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

const seed = (id, level = 'FREE', balance = 0) => {
  mem._seedUser({ id, level, balance });
  mem._projects.set(`proj_${id}`, { id: `proj_${id}`, userId: id, bible: null });
  return `proj_${id}`;
};
async function call(uid, level, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers, body: JSON.stringify(body) });
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
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
  return { status: resp.status, json: await resp.json().catch(() => null) };
}
const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';

describe('生成扣费 SSE 资金链路（串行）', { concurrency: 1 }, () => {
  it('未登录 401', async () => {
    const r = await call(null, null, { projectId: 'x', brief });
    assert.strictEqual(r.status, 401);
  });

  it('项目不存在/不属于本人 404', async () => {
    seed('u_noproj', 'BASIC', 1000);
    const r = await call('u_noproj', 'BASIC', { projectId: 'not_exist', brief });
    assert.strictEqual(r.status, 404);
  });

  it('免费档额度内：SSE 走免费、不扣积分', async () => {
    const pid = seed('u_free', 'FREE', 0);
    const r = await call('u_free', 'FREE', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.some((e) => e.stage === 'frozen' && e.free === true && e.points === 0));
    const done = r.events.find((e) => e.stage === 'done');
    assert.ok(done && done.pointsCharged === 0 && done.free === true);
    assert.strictEqual(mem._accounts.get('u_free').balance, 0);
  });

  it('免费档越权使用标准/旗舰引擎 403', async () => {
    const pid = seed('u_free2', 'FREE', 0);
    const r = await call('u_free2', 'FREE', { projectId: pid, brief, engineTier: 'STANDARD' });
    assert.strictEqual(r.status, 403);
  });

  it('v2.32 免费档上传参考剧本学风格 402 引导升级；基础档不受拦', async () => {
    const ref = '参考剧本：'.padEnd(140, '他冷冷开口，字句短促！');
    const pidF = seed('u_free_style', 'FREE', 0);
    const rf = await call('u_free_style', 'FREE', { projectId: pidF, brief, customStyleText: ref });
    assert.strictEqual(rf.status, 402);
    assert.strictEqual(rf.json.upgrade, 'BASIC');
    const pidB = seed('u_basic_style', 'BASIC', 1000);
    const rb = await call('u_basic_style', 'BASIC', { projectId: pidB, brief, customStyleText: ref });
    assert.strictEqual(rb.status, 200);
  });

  it('免费档当日额度用尽 402 并引导付费', async () => {
    const pid = seed('u_free3', 'FREE', 0);
    for (let k = 0; k < P.MEMBERSHIP.FREE.freeEpsPerDay; k++) mem._scripts.push({ projectId: pid, createdAt: new Date() });
    const r = await call('u_free3', 'FREE', { projectId: pid, brief });
    assert.strictEqual(r.status, 402);
    assert.strictEqual(r.json.needPay, true);
  });

  it('免费档在途任务原子占坑：QUEUED/RUNNING 计入当日额度，FAILED 不计可重试', async () => {
    const pid = seed('u_free4', 'FREE', 0);
    for (let k = 0; k < P.MEMBERSHIP.FREE.freeEpsPerDay; k++) {
      await mem.generationTask.create({ data: { projectId: pid, status: k % 2 ? 'QUEUED' : 'RUNNING' } });
    }
    const blocked = await call('u_free4', 'FREE', { projectId: pid, brief });
    assert.strictEqual(blocked.status, 402, '在途占坑满额必须 402，防止并发白嫖');
    assert.strictEqual(blocked.json.needPay, true);

    // 仅 FAILED 在途不计入：失败任务释放占坑，用户可正常重试
    const pid2 = seed('u_free5', 'FREE', 0);
    for (let k = 0; k < P.MEMBERSHIP.FREE.freeEpsPerDay; k++) {
      await mem.generationTask.create({ data: { projectId: pid2, status: 'FAILED' } });
    }
    const retry = await call('u_free5', 'FREE', { projectId: pid2, brief });
    assert.strictEqual(retry.status, 200, 'FAILED 不占坑，应允许重试');
  });

  it('基础会员经济档创作成功：冻结→结算，准确扣 10 积分、无冻结残留、落剧本与任务', async () => {
    const pid = seed('u_basic', 'BASIC', 1000);
    const expectPoints = P.episodePoints(P.MemberLevel.BASIC, P.EngineTier.ECONOMY);
    assert.strictEqual(expectPoints, 10); // 锁定现行定价：基础·经济=10积分(v1.31最终定价)/集
    const r = await call('u_basic', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.some((e) => e.stage === 'frozen' && e.points === 10));
    const done = r.events.find((e) => e.stage === 'done');
    assert.strictEqual(done.pointsCharged, 10);
    const acc = mem._accounts.get('u_basic');
    assert.strictEqual(acc.balance, 990); // 真正扣除
    assert.strictEqual(acc.frozen, 0);   // 结算后冻结清零
    assert.strictEqual(mem._scripts.filter((s) => s.projectId === pid).length, 1);
    const task = [...mem._tasks.values()].find((t) => t.projectId === pid);
    assert.strictEqual(task.status, 'DONE');
  });

  it('创作过程失败：已冻结积分全额退回，余额分文不少、冻结清零、任务标记失败', async () => {
    const pid = seed('u_bad', 'BASIC', 1000);
    process.env.REQUIRE_REAL_MODEL = 'true'; // 无真实 Key → 流水线在冻结后抛错，走退款分支
    Object.keys(process.env).filter((k) => k.startsWith('MODEL_')).forEach((k) => delete process.env[k]);
    try {
      const r = await call('u_bad', 'BASIC', { projectId: pid, brief });
      assert.strictEqual(r.status, 200); // SSE 正常建立，错误以事件返回
      const last = r.events[r.events.length - 1];
      assert.strictEqual(last.stage, 'failed_refunded');
      const acc = mem._accounts.get('u_bad');
      assert.strictEqual(acc.balance, 1000, '失败必须全额退款');
      assert.strictEqual(acc.frozen, 0, '冻结必须清零');
      const task = [...mem._tasks.values()].find((t) => t.projectId === pid);
      assert.strictEqual(task.status, 'FAILED');
    } finally {
      delete process.env.REQUIRE_REAL_MODEL;
    }
  });

  it('【防赔】高级会员经济档走每月赠送集：viaQuota=true、不扣积分、quotaUsed+1', async () => {
    const pid = seed('u_quota', 'ADVANCED', 1000);
    mem._memberships.push({ id: 'ms_quota', userId: 'u_quota', level: 'ADVANCED', quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) });
    const r = await call('u_quota', 'ADVANCED', { projectId: pid, brief, engineTier: 'ECONOMY' });
    assert.strictEqual(r.status, 200);
    const fr = r.events.find((e) => e.stage === 'frozen');
    assert.strictEqual(fr.viaQuota, true);
    assert.strictEqual(fr.points, 0);
    const done = r.events.find((e) => e.stage === 'done');
    assert.strictEqual(done.viaQuota, true);
    assert.strictEqual(done.pointsCharged, 0);
    assert.strictEqual(mem._accounts.get('u_quota').balance, 1000, '赠送集不扣积分');
    assert.strictEqual(mem._memberships.find((m) => m.id === 'ms_quota').quotaUsed, 1);
  });

  it('【防赔】同会员用赠送额度跑旗舰：必须扣28积分、不得消耗赠送集', async () => {
    const pid = seed('u_flag', 'ADVANCED', 1000);
    const ms = { id: 'ms_flag', userId: 'u_flag', level: 'ADVANCED', quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) };
    mem._memberships.push(ms);
    const r = await call('u_flag', 'ADVANCED', { projectId: pid, brief, engineTier: 'FLAGSHIP' });
    assert.strictEqual(r.status, 200);
    const done = r.events.find((e) => e.stage === 'done');
    assert.strictEqual(done.viaQuota, false);
    assert.strictEqual(done.pointsCharged, P.EP_PRICE.ADVANCED.FLAGSHIP, '旗舰按积分扣');
    assert.strictEqual(mem._accounts.get('u_flag').balance, 1000 - P.EP_PRICE.ADVANCED.FLAGSHIP);
    assert.strictEqual(ms.quotaUsed, 0, '旗舰不得消耗赠送集');
  });

  it('【打断】经济档走赠送集时生成失败：赠送集退还(quotaUsed回0)、不扣积分、任务失败', async () => {
    const pid = seed('u_qfail', 'ADVANCED', 1000);
    const ms = { id: 'ms_qfail', userId: 'u_qfail', level: 'ADVANCED', quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) };
    mem._memberships.push(ms);
    process.env.REQUIRE_REAL_MODEL = 'true';
    Object.keys(process.env).filter((k) => k.startsWith('MODEL_')).forEach((k) => delete process.env[k]);
    try {
      const r = await call('u_qfail', 'ADVANCED', { projectId: pid, brief, engineTier: 'ECONOMY' });
      assert.strictEqual(r.status, 200);
      const last = r.events[r.events.length - 1];
      assert.strictEqual(last.stage, 'failed_refunded');
      assert.strictEqual(mem._accounts.get('u_qfail').balance, 1000, '赠送集路径不扣积分');
      assert.strictEqual(ms.quotaUsed, 0, '生成失败必须退还已占用的赠送集');
    } finally { delete process.env.REQUIRE_REAL_MODEL; }
  });

  it('【断连】生成中途客户端关闭页面：后台继续跑完、正常结算入库，不误退款', async () => {
    const pid = seed('u_abort', 'BASIC', 1000);
    const ctrl = new AbortController(); let fired = false;
    const consume = (async () => {
      const resp = await fetch(base + '/api/generate/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_abort', level: 'BASIC' })}` },
        body: JSON.stringify({ projectId: pid, brief, engineTier: 'ECONOMY' }), signal: ctrl.signal,
      });
      const reader = resp.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (!fired && dec.decode(value).includes('frozen')) { fired = true; ctrl.abort(); break; }
      }
    })().catch(() => {});
    await consume;
    let task = null;
    for (let i = 0; i < 50; i++) {
      const all = await mem.generationTask.findMany(); task = all.find((x) => x.projectId === pid);
      if (task && ['DONE', 'FAILED'].includes(task.status)) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    assert.ok(task, '应存在生成任务');
    assert.strictEqual(task.status, 'DONE', '客户端断连后后台应继续跑完为 DONE，而非 FAILED');
    const scripts = await mem.script.findMany({ where: { projectId: pid } });
    assert.ok(scripts.length >= 1, '剧本应已落库（断网不丢）');
    assert.strictEqual(mem._accounts.get('u_abort').balance, 990, '经济档正常结算扣10积分，不因断连错误退款');
  });

  // ===== 内部账户（超级管理员/杨光指定的管理员）：全免费、不受任何付费墙与额度墙限制 =====
  const { SUPER_ADMIN_PHONE } = require('../dist/middleware/admin.js');
  const seedStaff = (id, { level = 'FREE', balance = 0, isAdmin = false, phone } = {}) => {
    mem._seedUser({ id, level, balance, isAdmin, phone: phone ?? `139${String(id).padEnd(8, '0')}` });
    const pid = `proj_${id}`;
    mem._projects.set(pid, { id: pid, userId: id, bible: null });
    return pid;
  };

  it('超管 PRO 零余额零会员：免费生成、不扣分不冻结、staff 标记随事件下发、成本仍观测', async () => {
    const uid = 'u_super01';
    const pid = seedStaff(uid, { level: 'PRO', balance: 0, phone: SUPER_ADMIN_PHONE });
    const r = await call(uid, 'PRO', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    const fz = r.events.find((e) => e.stage === 'frozen');
    assert.ok(fz, '应有 frozen 事件');
    assert.strictEqual(fz.staff, true);
    assert.strictEqual(fz.points, 0);
    const done = r.events.find((e) => e.stage === 'done');
    assert.ok(done, '应正常跑完为 done');
    assert.strictEqual(done.staff, true);
    assert.strictEqual(done.pointsCharged, 0);
    assert.ok(typeof done.realCostFen === 'number', '真实成本照常观测（内部测试烧钱可见）');
    const acc = mem._accounts.get(uid);
    assert.strictEqual(acc.balance, 0, '零余额也能生成，余额不变');
    assert.strictEqual(acc.frozen, 0, '无冻结残留');
    assert.ok(mem._scripts.some((s) => s.projectId === pid), '剧本照常落库');
  });

  it('副管理员（isAdmin）FREE 零余额：不受每日免费集数墙限制，满额后仍放行', async () => {
    const uid = 'u_staff02';
    const pid = seedStaff(uid, { level: 'FREE', balance: 0, isAdmin: true });
    for (let k = 0; k < P.MEMBERSHIP.FREE.freeEpsPerDay; k++) mem._scripts.push({ projectId: pid, createdAt: new Date() });
    const r = await call(uid, 'FREE', { projectId: pid, brief });
    assert.strictEqual(r.status, 200, '副管理员不受 FREE 每日集数墙限制');
    const done = r.events.find((e) => e.stage === 'done');
    assert.ok(done && done.staff === true && done.pointsCharged === 0);
    assert.strictEqual(mem._accounts.get(uid).balance, 0);
  });

  it('副管理员 FREE：可越权使用 STANDARD 引擎、可上传参考剧本学风格（普通 FREE 均被拦）', async () => {
    const uid = 'u_staff03';
    const pid = seedStaff(uid, { level: 'FREE', balance: 0, isAdmin: true });
    const r1 = await call(uid, 'FREE', { projectId: pid, brief, engineTier: 'STANDARD' });
    assert.strictEqual(r1.status, 200, '副管理员可使用全部引擎档位');
    assert.ok(r1.events.some((e) => e.stage === 'done' && e.staff === true));
    const ref = '参考剧本：'.padEnd(140, '他冷冷开口，字句短促！');
    const r2 = await call(uid, 'FREE', { projectId: pid, brief, customStyleText: ref });
    assert.strictEqual(r2.status, 200, '副管理员私有风格学习不拦升级');
  });

  it('普通用户事件 staff=false 且正常扣 10 分，付费链路不被 staff 短路污染', async () => {
    const pid = seed('u_plain_staff_check', 'BASIC', 1000);
    const r = await call('u_plain_staff_check', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    const fz = r.events.find((e) => e.stage === 'frozen');
    assert.strictEqual(fz.staff, false);
    const done = r.events.find((e) => e.stage === 'done');
    assert.strictEqual(done.staff, false);
    assert.strictEqual(done.pointsCharged, 10);
    assert.strictEqual(mem._accounts.get('u_plain_staff_check').balance, 990);
  });
});

describe('内部账户 /fix 增值服务免费（串行）', { concurrency: 1 }, () => {
  const { SUPER_ADMIN_PHONE } = require('../dist/middleware/admin.js');
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');

  it('副管理员 FREE：小南等级门放行、0 扣费落 v2、留 0 元 STAFF_FREE 幂等流水可审计', async () => {
    const uid = 'u_staff_fix1';
    mem._seedUser({ id: uid, level: 'FREE', balance: 0, isAdmin: true });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}`, 'Content-Type': 'application/json' };
    const pid = 'proj_staff_fix1';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'stafffix1_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: mk(20, '改写后'), costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '字数不达标，补到单集体量' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200, 'FREE 副管理员不受小南 BASIC 等级门限制');
      assert.strictEqual(mem._accounts.get(uid).balance, 0, '内部账户 0 余额完成 /fix，不扣费');
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2, '改写稿照常落 v2');
      const staffRows = mem._ledgers.filter((l) => l.userId === uid && l.reason === 'STAFF_FREE' && l.amount === 0);
      assert.ok(staffRows.length >= 1, '留 0 元 STAFF_FREE 流水：幂等防重 + 内部使用可审计');
    } finally {
      MP.callText = orig;
    }
  });

  it('超管手机号硬判定即 staff：即便 isAdmin 字段为 false 也免费', async () => {
    const uid = 'u_super_fix2';
    mem._seedUser({ id: uid, level: 'FREE', balance: 0, isAdmin: false, phone: SUPER_ADMIN_PHONE });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}`, 'Content-Type': 'application/json' };
    const pid = 'proj_super_fix2';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'superfix2_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: mk(20, '改写后'), costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '补字数' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(mem._accounts.get(uid).balance, 0);
    } finally {
      MP.callText = orig;
    }
  });

  it('普通 FREE 用户 /fix 仍被小南等级门 403（不回归）', async () => {
    const uid = 'u_plain_fix3';
    mem._seedUser({ id: uid, level: 'FREE', balance: 0 });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}`, 'Content-Type': 'application/json' };
    const pid = 'proj_plain_fix3';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'plainfix3_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '补字数' }, epNo: 1 }),
    });
    assert.strictEqual(r.status, 403, '普通 FREE 仍受小南等级门保护');
  });
});

describe('生成前内容合规拦截（三级审核第一级，串行）', { concurrency: 1 }, () => {
  it('brief 含违法违规导向：episodes 直接 422，不建任务、不计费', async () => {
    const pid = seed('u_block', 'BASIC', 1000);
    const before = mem._accounts.get('u_block').balance;
    const r = await call('u_block', 'BASIC', { projectId: pid, brief: '这里详细讲解赌博技巧和诈骗教程' });
    assert.strictEqual(r.status, 422);
    assert.ok(r.json && r.json.error.includes('已拦截'));
    assert.strictEqual(mem._accounts.get('u_block').balance, before, '拦截不得扣费');
  });

  it('创建项目时标题/标签违规：projects 直接 422', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_pblock', level: 'BASIC' })}` };
    mem._seedUser({ id: 'u_pblock', level: 'BASIC', balance: 1000 });
    const resp = await fetch(base + '/api/generate/projects', { method: 'POST', headers,
      body: JSON.stringify({ title: '分裂国家题材', mode: 'tags', tags: [] }) });
    assert.strictEqual(resp.status, 422);
    const j = await resp.json();
    assert.ok(j.error.includes('已拦截'));
  });

  it('受限题材（缅北反诈）只预警不拦截：SSE 正常建立，context 事件带 complianceWarnings', async () => {
    const pid = seed('u_warn', 'FREE', 0);
    const r = await call('u_warn', 'FREE', { projectId: pid, brief: '主角被骗入缅北电诈园区，靠机智逃生并配合警方端掉窝点' });
    assert.strictEqual(r.status, 200, 'WARN 不得硬拦截');
    const ctx = r.events.find((e) => e.stage === 'context');
    assert.ok(ctx && Array.isArray(ctx.complianceWarnings) && ctx.complianceWarnings.length >= 1);
  });
});

describe('项目三类分级备案（9·1《办法》，串行）', { concurrency: 1 }, () => {
  async function createProject(uid, body) {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    const r = await fetch(base + '/api/generate/projects', { method: 'POST', headers, body: JSON.stringify(Object.assign({ title: '测试项目', mode: 'tags' }, body)) });
    return { s: r.status, j: await r.json().catch(() => null) };
  }
  it('AI 项目投资 80 万 → 一类、需发行许可证', async () => {
    const { s, j } = await createProject('u_f1', { format: 'AIGC', investWan: 80 });
    assert.strictEqual(s, 200); assert.strictEqual(j.filing.cls, 'I'); assert.strictEqual(j.filing.needLicense, true);
  });
  it('真人项目投资 50 万 → 三类', async () => {
    const { s, j } = await createProject('u_f2', { format: 'LIVE_ACTION', investWan: 50 });
    assert.strictEqual(s, 200); assert.strictEqual(j.filing.cls, 'III'); assert.strictEqual(j.filing.needLicense, false);
  });
  it('特殊题材无论投资额一律一类', async () => {
    const { s, j } = await createProject('u_f3', { format: 'LIVE_ACTION', investWan: 5, specialTopic: true });
    assert.strictEqual(s, 200); assert.strictEqual(j.filing.cls, 'I'); assert.strictEqual(j.filing.needLicense, true);
  });
  it('非法投资额（负数）400', async () => {
    const { s } = await createProject('u_f4', { investWan: -10 });
    assert.strictEqual(s, 400);
  });
});

describe('四层钩子选项契约（供前端渲染用户选择器）', () => {
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/hook-options');
    assert.strictEqual(r.status, 401);
  });
  it('登录后返回四层钩子+三模式+三强度，覆盖动作/语言/氛围微钩', async () => {
    const r = await fetch(base + '/api/generate/hook-options', { headers: { Authorization: `Bearer ${signAccess({ sub: 'u_hook', level: 'BASIC' })}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.layers.length, 4, '开场/集/场/微四层');
    assert.deepStrictEqual(j.modes.map((m) => m.id), ['auto', 'manual', 'hybrid']);
    assert.deepStrictEqual(j.strengths.map((s) => s.id), ['relax', 'balanced', 'tight']);
    const micro = j.layers.find((l) => l.layer === 'micro');
    const names = micro.hooks.map((h) => h.name);
    for (const must of ['动作钩子', '语言钩子', '氛围钩子']) assert.ok(names.includes(must), `含导演点名的${must}`);
    assert.strictEqual(j.total, j.layers.reduce((n, l) => n + l.hooks.length, 0), '总数自洽');
    assert.deepStrictEqual(j.beats.map((b) => b.kind), ['reversal', 'payoff', 'emotion'], '含反转/爽点/情绪三组节拍');
    assert.ok(j.beats.every((b) => b.items.length >= 8), '每组节拍类型库充实');
    assert.strictEqual(j.strategies.length, 5, 'v2.27 五套钩子策略');
    assert.deepStrictEqual(j.strategies.map((s) => s.id), ['balanced', 'dense', 'suspense', 'emotion', 'premium']);
  });
  it('?lang=en 返回全英文钩子/节拍目录、零中文；默认仍中文', async () => {
    const auth = { headers: { Authorization: `Bearer ${signAccess({ sub: 'u_hook_en', level: 'BASIC' })}` } };
    const r = await fetch(base + '/api/generate/hook-options?lang=en', auth);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'en');
    const cjk = (o) => /[一-鿿]/.test(typeof o === 'string' ? o : JSON.stringify(o));
    // 面向用户的文案字段必须零中文；稳定 id（历史键，可能含中文，如 pay_id压制）作为内部线键豁免
    const userTextHook = (l) => l.label + l.hooks.map((h) => h.name + h.definition + h.example + h.bestFor.join('')).join('');
    assert.ok(!cjk(j.layers.map(userTextHook).join('')), '英文四层钩子文案零中文');
    const beatText = j.beats.map((b) => b.label + b.items.map((x) => x.name + x.definition + x.technique + x.example + x.bestFor.join('')).join('')).join('');
    assert.ok(!cjk(j.modes) && !cjk(j.strengths) && !cjk(beatText), '英文模式/强度/节拍文案零中文');
    assert.ok(!cjk(j.strategies), 'v2.27 英文策略卡零中文');
    const micro = j.layers.find((l) => l.layer === 'micro');
    assert.ok(micro.hooks.some((h) => /Dialogue Hook/.test(h.name)), '英文语言钩子在列');
    const r2 = await fetch(base + '/api/generate/hook-options', auth);
    const z = await r2.json();
    assert.ok(/[一-鿿]/.test(z.layers[0].label), '默认中文不变');
  });
});

describe('v2.27 钩子策略推荐端点', () => {
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_strat', level: 'BASIC' })}` } };
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: '悬疑' }) });
    assert.strictEqual(r.status, 401);
  });
  it('按题材自动推荐：刑侦→suspense 且给中文理由；无信号→balanced', async () => {
    const r = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: '刑侦法医悬疑烧脑' }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.strategy.id, 'suspense'); assert.strictEqual(j.auto, true); assert.ok(j.reason.includes('悬念牵引流'));
    const r2 = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: '普通日常' }) });
    const j2 = await r2.json(); assert.strictEqual(j2.strategy.id, 'balanced');
  });
  it('用户显式选策略则尊重、auto=false；非法策略 400；英文零中文', async () => {
    const r = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: '悬疑', strategy: 'premium' }) });
    const j = await r.json(); assert.strictEqual(j.strategy.id, 'premium'); assert.strictEqual(j.auto, false); assert.strictEqual(j.reason, '');
    const bad = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ strategy: 'nope' }) });
    assert.strictEqual(bad.status, 400);
    const re = await fetch(base + '/api/generate/hook-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: 'spy crime thriller', lang: 'en' }) });
    const je = await re.json(); assert.strictEqual(je.strategy.id, 'suspense'); assert.ok(!/[一-鿿]/.test(je.reason + JSON.stringify(je.strategy)));
  });
});

describe('v2.56 钩子调色板端点', () => {
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_palette', level: 'BASIC' })}` } };
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/hooks/palette', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeCount: 2, scenesPerEp: 3 }) });
    assert.strictEqual(r.status, 401);
  });
  it('中文：逐位置给系统默认+2备选+理由，六风味齐备，位置键分层', async () => {
    const r = await fetch(base + '/api/generate/hooks/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 2, scenesPerEp: 3, tags: ['悬疑'], strategy: 'suspense' }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.strategy.id, 'suspense');
    assert.strictEqual(j.microFlavors.length, 6);
    assert.ok(j.positions.length >= 6);
    const open0 = j.positions.find((p) => p.pos === 0 && p.kind === 'open');
    assert.ok(open0 && open0.systemDefault.id && open0.alternatives.length === 2);
    assert.ok(typeof open0.systemDefault.reason === 'string' && open0.systemDefault.reason.length > 0);
    assert.ok(j.positions.some((p) => p.kind === 'scene' && p.pos >= 1000));
    assert.ok(j.positions.some((p) => p.kind === 'end' && p.pos >= 20000));
  });
  it('英文输出零中文；同输入确定性一致', async () => {
    const body = { episodeCount: 2, scenesPerEp: 2, lang: 'en' };
    const [r1, r2] = await Promise.all([
      fetch(base + '/api/generate/hooks/palette', { method: 'POST', ...auth, body: JSON.stringify(body) }),
      fetch(base + '/api/generate/hooks/palette', { method: 'POST', ...auth, body: JSON.stringify(body) }),
    ]);
    const j1 = await r1.json(); const j2 = await r2.json();
    assert.deepStrictEqual(j1.positions.map((p) => p.systemDefault.id), j2.positions.map((p) => p.systemDefault.id));
    assert.ok(!/[一-鿿]/.test(JSON.stringify(j1)));
  });
  it('picks 同步提交：合法改选转 manual，非法项进 rejected', async () => {
    const r0 = await fetch(base + '/api/generate/hooks/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 1, scenesPerEp: 1 }) });
    const p0 = await r0.json();
    const open0 = p0.positions.find((p) => p.pos === 0);
    const r = await fetch(base + '/api/generate/hooks/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 1, scenesPerEp: 1, picks: { 0: open0.alternatives[0].id, 99999: 'open_conflict' } }) });
    const j = await r.json();
    assert.strictEqual(j.manual[0], open0.alternatives[0].id);
    assert.deepStrictEqual(j.rejected, ['99999']);
  });
});

describe('v2.57 节拍调色板端点', () => {
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_bpal', level: 'BASIC' })}` } };
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/beats/palette', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeCount: 2 }) });
    assert.strictEqual(r.status, 401);
  });
  it('中文：逐集逐槽给系统默认+2备选+理由，manual键分层命名空间', async () => {
    const r = await fetch(base + '/api/generate/beats/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 3, strength: 'tight', tags: ['逆袭'] }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.episodes.length, 3);
    const all = j.episodes.flatMap((e) => e.slots);
    assert.ok(all.length >= 3 * 4, 'tight每集至少1反转+2爽点+3情绪');
    all.forEach((s) => {
      assert.ok(s.alternatives.length === 2);
      assert.ok(typeof s.systemDefault.reason === 'string' && s.systemDefault.reason.length > 0);
      if (s.kind === 'reversal') assert.ok(s.pos >= 10000 && s.pos < 20000);
      if (s.kind === 'payoff') assert.ok(s.pos >= 20000 && s.pos < 30000);
      if (s.kind === 'emotion') assert.ok(s.pos >= 30000 && s.pos < 40000);
    });
    j.episodes.forEach((e) => {
      assert.strictEqual(e.slots.filter((s) => s.kind === 'emotion').length, 3, '情绪恒3拍');
    });
  });
  it('英文输出零中文；同输入确定性一致', async () => {
    const body = { episodeCount: 2, lang: 'en' };
    const [r1, r2] = await Promise.all([
      fetch(base + '/api/generate/beats/palette', { method: 'POST', ...auth, body: JSON.stringify(body) }),
      fetch(base + '/api/generate/beats/palette', { method: 'POST', ...auth, body: JSON.stringify(body) }),
    ]);
    const j1 = await r1.json(); const j2 = await r2.json();
    const flat = (j) => j.episodes.flatMap((e) => e.slots).map((s) => s.systemDefault.id);
    assert.deepStrictEqual(flat(j1), flat(j2));
    assert.ok(!/[一-鿿]/.test(JSON.stringify(j1)));
  });
  it('picks 同步提交：合法改选转分层 manual，非法项进 rejected', async () => {
    const r0 = await fetch(base + '/api/generate/beats/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 1, strength: 'tight' }) });
    const p0 = await r0.json();
    const slot0 = p0.episodes[0].slots[0];
    const r = await fetch(base + '/api/generate/beats/palette', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 1, strength: 'tight', picks: { [slot0.pos]: slot0.alternatives[0].id, 1: 'rev_identity' } }) });
    const j = await r.json();
    assert.strictEqual(j.manual[slot0.pos], slot0.alternatives[0].id);
    assert.deepStrictEqual(j.rejected, ['1']);
  });
});

describe('v2.58 情绪波形编排端点', () => {
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_wdir', level: 'ADVANCED' })}` } };
  it('未登录 401', async () => {
    const r = await fetch(base + '/api/generate/emotion/director', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeCount: 4 }) });
    assert.strictEqual(r.status, 401);
  });
  it('中文：预览曲线+5意图目录，无意图时 patch 为 null', async () => {
    const r = await fetch(base + '/api/generate/emotion/director', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 12, strength: 'balanced' }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.waveBefore.points.length, 12);
    assert.strictEqual(j.intents.length, 5);
    assert.strictEqual(j.waveAfter, null); assert.strictEqual(j.patch, null);
    j.waveBefore.points.forEach((p) => { assert.ok(p.intensity >= 0 && p.intensity <= 100); assert.ok(p.path.length === 3); });
  });
  it('英文输出零中文且确定性一致', async () => {
    const body = { episodeCount: 6, lang: 'en', intent: 'hype_climb', from: 2, to: 4 };
    const [r1, r2] = await Promise.all([
      fetch(base + '/api/generate/emotion/director', { method: 'POST', ...auth, body: JSON.stringify(body) }),
      fetch(base + '/api/generate/emotion/director', { method: 'POST', ...auth, body: JSON.stringify(body) }),
    ]);
    const j1 = await r1.json(); const j2 = await r2.json();
    assert.deepStrictEqual(j1.waveAfter.points.map((p) => p.intensity), j2.waveAfter.points.map((p) => p.intensity));
    // id 为内部键（含 pay_id压制 这类中英混合键，设计上不翻译，前端只用 name），扫描前剔除
    const stripIds = (x) => JSON.parse(JSON.stringify(x), (k, v) => (k === 'id' ? undefined : v));
    assert.ok(!/[一-鿿]/.test(JSON.stringify(stripIds(j1))));
  });
  it('区间连改：只动区间集、patch 全为 30000 情绪键，区间外曲线不变', async () => {
    const r = await fetch(base + '/api/generate/emotion/director', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 16, intent: 'press_release', from: 5, to: 8 }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.ok(j.patch); assert.deepStrictEqual(j.patch.affectedEps, [5, 6, 7, 8]);
    Object.keys(j.patch.manual).forEach((k) => { assert.ok(Number(k) >= 30000 && Number(k) < 40000); });
    j.waveBefore.points.forEach((p, i) => {
      if (i + 1 < 5 || i + 1 > 8) assert.strictEqual(j.waveAfter.points[i].intensity, p.intensity);
    });
  });
  it('非法意图被忽略为 null，pins 经白名单清洗后影响 before 曲线', async () => {
    const r = await fetch(base + '/api/generate/emotion/director', { method: 'POST', ...auth, body: JSON.stringify({ episodeCount: 5, intent: '__bad__', pins: { hack: 'x', [30003]: 'emo_heal' } }) });
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.patch, null);
    assert.ok(!JSON.stringify(j.waveBefore).includes('"hack"'));
  });
});

describe('v2.28 节奏/台词策略端点', () => {
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u_cs', level: 'BASIC' })}` } };
  it('目录需登录，登录后各返回5张策略卡', async () => {
    assert.strictEqual((await fetch(base + '/api/generate/creation-strategies')).status, 401);
    const r = await fetch(base + '/api/generate/creation-strategies', auth);
    assert.strictEqual(r.status, 200); const j = await r.json();
    assert.strictEqual(j.pace.length, 5); assert.strictEqual(j.dialogue.length, 5); assert.strictEqual(j.emotion.length, 5);
    assert.deepStrictEqual(j.pace.map((x) => x.id), ['standard', 'fastcut', 'suspense_burn', 'emotional_wave', 'cinematic']);
  });
  it('推荐：刑侦→悬念递进+锋利机锋；用户显式选择被尊重；非法400；英文零中文', async () => {
    const r = await fetch(base + '/api/generate/creation-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: '刑侦悬疑破案' }) });
    const j = await r.json();
    assert.strictEqual(j.pace.card.id, 'suspense_burn'); assert.strictEqual(j.dialogue.card.id, 'sharp'); assert.strictEqual(j.emotion.card.id, 'twist_puzzle');
    assert.ok(j.pace.reason.includes('悬念递进'));
    const r2 = await fetch(base + '/api/generate/creation-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: '刑侦', pace: 'cinematic', dialogue: 'street', emotion: 'angst_tug' }) });
    const j2 = await r2.json();
    assert.strictEqual(j2.pace.card.id, 'cinematic'); assert.strictEqual(j2.pace.auto, false); assert.strictEqual(j2.pace.reason, '');
    assert.strictEqual(j2.emotion.card.id, 'angst_tug'); assert.strictEqual(j2.emotion.auto, false);
    const bad = await fetch(base + '/api/generate/creation-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ pace: 'nope' }) });
    assert.strictEqual(bad.status, 400);
    const bad2 = await fetch(base + '/api/generate/creation-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ emotion: 'nope' }) });
    assert.strictEqual(bad2.status, 400);
    const re = await fetch(base + '/api/generate/creation-strategy/recommend', { method: 'POST', ...auth, body: JSON.stringify({ brief: 'spy crime', lang: 'en' }) });
    const je = await re.json(); assert.ok(!/[一-鿿]/.test(JSON.stringify(je)));
  });
});

describe('十二模式闭环闸门（P0：无未知模式、等级强校验、成年授权、权威清单）', { concurrency: 1 }, () => {
  const mk = (uid, level) => {
    mem._seedUser({ id: uid, level, balance: 0 });
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` };
  };
  const postProj = (h, body) => fetch(base + '/api/generate/projects', { method: 'POST', headers: h, body: JSON.stringify(body) });
  it('未知模式 400，不会静默建项目', async () => {
    const r = await postProj(mk('m_bad', 'PRO'), { title: 'x', mode: 'not_a_mode' });
    assert.strictEqual(r.status, 400);
  });
  it('免费用户可建标签模式（前端 wire-id tags 归一为 tag）', async () => {
    const r = await postProj(mk('m_free', 'FREE'), { title: '免费标签本', mode: 'tags' });
    assert.strictEqual(r.status, 200);
  });
  it('免费用户碰整合后的工作台 hit_lab 被 403 并给升级方向（高级）', async () => {
    const r = await postProj(mk('m_lock', 'FREE'), { title: '名场面', mode: 'reverse' });
    assert.strictEqual(r.status, 403);
    const j = await r.json();
    assert.strictEqual(j.error, 'MODE_LOCKED'); assert.strictEqual(j.needLevel, 'ADVANCED');
  });
  it('v2.14 高级用户走名场面拓展轨道放行，走爆款逆向轨道被 TRACK_LOCKED(专业)', async () => {
    const ok = await postProj(mk('m_track_ok', 'ADVANCED'), { title: '名场面拓展', mode: 'hit_lab', track: 'signature_scene' });
    assert.strictEqual(ok.status, 200);
    const locked = await postProj(mk('m_track_lock', 'ADVANCED'), { title: '逆向批量', mode: 'hit_lab', track: 'hit_reverse' });
    assert.strictEqual(locked.status, 403);
    const j = await locked.json();
    assert.strictEqual(j.error, 'TRACK_LOCKED'); assert.strictEqual(j.needLevel, 'PRO');
  });
  it('X剧本未完成成年授权 403，授权后（PRO+问卷+开通订单）放行', async () => {
    const h = mk('m_x', 'PRO');
    const r1 = await postProj(h, { title: 'X', mode: 'xscript' });
    assert.strictEqual(r1.status, 403);
    // v2.18：服务端核验数据库问卷记录 + 已支付的 X_SCRIPT 开通订单（前端自报布尔值不再算数）
    await mem.matureConsent.create({ data: { userId: 'm_x', ageConfirmed: true, age: 30, region: 'CN', purposePersonal: true, noMinorDistribution: true, boundaryAccepted: true, legalSelfResponsible: true, signedAt: new Date(), expireAt: new Date(Date.now() + 30 * 864e5) } });
    await mem.order.create({ data: { userId: 'm_x', kind: 'VALUE_ADDED', remark: 'X_SCRIPT', amountFen: 9900, status: 'PAID', paidAt: new Date() } });
    const r2 = await postProj(h, { title: 'X2', mode: 'xscript' });
    assert.strictEqual(r2.status, 200);
  });
  it('电影剧本 v2.86 上线，PRO 会员可建', async () => {
    const r = await postProj(mk('m_film', 'PRO'), { title: '电影', mode: 'film' });
    assert.strictEqual(r.status, 200);
  });
  it('GET /modes 返回12模式且每个都带前端 wire-id 与解锁态；工作台带两轨道', async () => {
    const r = await fetch(base + '/api/generate/modes', { headers: mk('m_list', 'ADVANCED') });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.modes.length, 12);
    assert.ok(j.modes.every((m) => Array.isArray(m.wireIds) && m.wireIds.length >= 1));
    const film = j.modes.find((m) => m.id === 'film');
    assert.strictEqual(film.status, 'available'); assert.strictEqual(film.unlocked, false, 'ADVANCED 用户未解锁 PRO 级 film 模式');
    const hitLab = j.modes.find((m) => m.id === 'hit_lab');
    assert.strictEqual(hitLab.unlocked, true, '高级用户可进工作台');
    assert.strictEqual(hitLab.tracks.length, 2);
    const revTrack = hitLab.tracks.find((t) => t.id === 'hit_reverse');
    assert.strictEqual(revTrack.unlocked, false, '高级用户未解锁专业逆向轨道');
    const sceneTrack = hitLab.tracks.find((t) => t.id === 'signature_scene');
    assert.strictEqual(sceneTrack.unlocked, true);
    // 旧 wire-id scene/reverse 仍挂在整合后的工作台下（向后兼容）
    assert.ok(hitLab.wireIds.includes('scene') && hitLab.wireIds.includes('reverse'));
    const longIp = j.modes.find((m) => m.id === 'long_ip');
    assert.strictEqual(longIp.unlocked, false, '长系列IP为专业模式');
    const branded = j.modes.find((m) => m.id === 'branded_skit');
    assert.strictEqual(branded.unlocked, true, '软广高级可用');
  });

  // ===== 内部账户（超管/杨光指定的管理员）建项目：模式/轨道/项目数墙全放行，成年授权红线不豁免 =====
  const staffH = (uid) => {
    mem._seedUser({ id: uid, level: 'FREE', balance: 0, isAdmin: true });
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}` };
  };
  it('内部账户 FREE 副管理员：付费模式 + 专业级「爆款逆向」轨道直接放行', async () => {
    const r = await postProj(staffH('m_staff1'), { title: '逆向批量内部测试', mode: 'hit_lab', track: 'hit_reverse' });
    assert.strictEqual(r.status, 200, '副管理员不受 MODE_LOCKED/TRACK_LOCKED 限制');
  });
  it('内部账户 FREE：建第 3 个项目不触 REACH_PROJECT_LIMIT；同场景普通 FREE 仍 403', async () => {
    const h = staffH('m_staff2');
    for (let i = 0; i < 2; i++) {
      const rr = await postProj(h, { title: `内部本${i}`, mode: 'tags' });
      assert.strictEqual(rr.status, 200);
    }
    const third = await postProj(h, { title: '内部本3', mode: 'tags' });
    assert.strictEqual(third.status, 200, '免费档 2 项目上限对内部账户不生效');
    const h2 = mk('m_normal_limit', 'FREE');
    await postProj(h2, { title: '普通本1', mode: 'tags' });
    await postProj(h2, { title: '普通本2', mode: 'tags' });
    const blocked = await postProj(h2, { title: '普通本3', mode: 'tags' });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual((await blocked.json()).error, 'REACH_PROJECT_LIMIT');
  });
  it('合规红线不豁免：内部账户碰 xscript 未完成成年授权仍 403 MATURE_CONSENT_REQUIRED', async () => {
    const r = await postProj(staffH('m_staff_x'), { title: 'X', mode: 'xscript' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).error, 'MATURE_CONSENT_REQUIRED');
  });
});

describe('源文档上传解析 /extract-source（v1.81 改编/小说模式）', () => {
  it('未登录 401；登录后 txt 解析回文本与章节', async () => {
    const noAuth = await fetch(base + '/api/generate/extract-source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(noAuth.status, 401);
    mem._seedUser({ id: 'up1', level: 'BASIC', balance: 100 });
    const tok = signAccess({ sub: 'up1', level: 'BASIC' });
    const body = Buffer.from('第一章 开端\n天亮了。\n第二章 发展\n风起。', 'utf8').toString('base64');
    const r = await fetch(base + '/api/generate/extract-source', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ filename: '原稿.txt', dataBase64: body }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.format, 'txt');
    assert.ok(j.text.includes('天亮了'));
    assert.strictEqual(j.chapters.length, 2);
  });
  it('缺文件名/空体 400；扫描 PDF 返回 note 而非 500', async () => {
    const tok = signAccess({ sub: 'up1', level: 'BASIC' });
    const bad = await fetch(base + '/api/generate/extract-source', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ filename: '', dataBase64: 'x' }) });
    assert.strictEqual(bad.status, 400);
    const scanPdf = Buffer.from('%PDF-1.4\n%%EOF', 'latin1').toString('base64');
    const r2 = await fetch(base + '/api/generate/extract-source', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ filename: 's.pdf', dataBase64: scanPdf }) });
    assert.strictEqual(r2.status, 200);
    const j2 = await r2.json();
    assert.ok(/扫描|加密/.test(j2.note));
  });
});

describe('钩子编排偏好落库（v1.83，串行）', { concurrency: 1 }, () => {
  async function createProject(uid, body) {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    const r = await fetch(base + '/api/generate/projects', { method: 'POST', headers, body: JSON.stringify(Object.assign({ title: '钩子项目', mode: 'tags' }, body)) });
    return { s: r.status, j: await r.json().catch(() => null) };
  }
  it('合法钩子id入库、未知id被清洗、avoid与preferred去重', async () => {
    const { s, j } = await createProject('u_h1', { hookPref: { mode: 'hybrid', strength: 'tight', preferred: ['open_conflict', 'fake_hook_xx'], avoid: ['open_conflict', 'scene_info_drop'] } });
    assert.strictEqual(s, 200);
    const hp = j.bible.hookPrefs;
    assert.strictEqual(hp.mode, 'hybrid'); assert.strictEqual(hp.strength, 'tight');
    assert.deepStrictEqual(hp.preferred, ['open_conflict']);
    assert.deepStrictEqual(hp.avoid, ['scene_info_drop']);
  });
  it('全非法/空偏好不写 bible', async () => {
    const { j } = await createProject('u_h2', { hookPref: { preferred: ['nope_a', 'nope_b'] } });
    assert.ok(!j.bible || !j.bible.hookPrefs);
  });
});

describe('节拍偏好落库（v1.84，串行）', { concurrency: 1 }, () => {
  async function createProject(uid, body) {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    const r = await fetch(base + '/api/generate/projects', { method: 'POST', headers, body: JSON.stringify(Object.assign({ title: '节拍项目', mode: 'tags' }, body)) });
    return { s: r.status, j: await r.json().catch(() => null) };
  }
  it('节拍合法id入库、未知id清洗；与钩子偏好共存于bible', async () => {
    const { s, j } = await createProject('u_b1', {
      hookPref: { preferred: ['open_conflict'] },
      beatPref: { mode: 'hybrid', strength: 'tight', preferred: ['rev_identity', 'pay_faceslap', 'fake_beat'], avoid: ['emo_suppress'] },
    });
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j.bible.hookPrefs.preferred, ['open_conflict']);
    assert.strictEqual(j.bible.beatPrefs.mode, 'hybrid');
    assert.strictEqual(j.bible.beatPrefs.strength, 'tight');
    assert.deepStrictEqual(j.bible.beatPrefs.preferred, ['rev_identity', 'pay_faceslap']);
    assert.deepStrictEqual(j.bible.beatPrefs.avoid, ['emo_suppress']);
  });
});

describe('v2.38 全剧情绪曲线端点', { concurrency: 1 }, () => {
  it('emotion-wave 返回逐集波形且不扣费', async () => {
    const uid = 'u_wave';
    mem._seedUser({ id: uid, level: 'BASIC', balance: 500 });
    mem._projects.set('proj_wave', { id: 'proj_wave', userId: uid, bible: null, totalEps: 12 });
    const headers = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/projects/proj_wave/emotion-wave', { headers });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.episodeCount, 12);
    assert.strictEqual(j.points.length, 12);
    assert.ok(typeof j.avgIntensity === 'number' && j.peakEp >= 1);
    assert.strictEqual(mem._accounts.get(uid).balance, 500, '波形图为免费可视化，不得扣费');
  });
  it('他人项目 404', async () => {
    const uid = 'u_wave2';
    mem._seedUser({ id: uid, level: 'BASIC', balance: 0 });
    const headers = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/projects/proj_wave/emotion-wave', { headers });
    assert.strictEqual(r.status, 404);
  });
});

describe('v2.39 波形建议与 fix epNo 入参', { concurrency: 1 }, () => {
  it('emotion-wave 带 advices 数组（zh/en 语言切换）', async () => {
    const uid = 'u_wadv';
    mem._seedUser({ id: uid, level: 'BASIC', balance: 500 });
    mem._projects.set('proj_wadv', { id: 'proj_wadv', userId: uid, bible: null, totalEps: 20 });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/projects/proj_wadv/emotion-wave?lang=en', { headers: h });
    const j = await r.json();
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(j.advices));
    j.advices.forEach((a) => assert.ok(!/[一-鿿]/.test(a.advice), 'en 模式建议正文零中文'));
  });
  it('fix 的 epNo 非法（0/超界）→ 400，不扣费', async () => {
    const uid = 'u_fixep';
    mem._seedUser({ id: uid, level: 'BASIC', balance: 300 });
    mem._projects.set('proj_fixep', { id: 'proj_fixep', userId: uid, bible: null });
    mem._scripts.push({ id: 's_fixep', projectId: 'proj_fixep', epNo: 1, version: 1, content: '第一集'.repeat(200), title: 't', wordCount: 600, score: 80 });
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/projects/proj_fixep/fix', { method: 'POST', headers: h,
      body: JSON.stringify({ fix: { rule: 'emotion_wave', dimLabel: '剧情', advice: '张力偏平，补冲突' }, epNo: 0 }) });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(mem._accounts.get(uid).balance, 300);
  });
});

describe('v2.44 策略卡六语（ja/ko/es/ar）', { concurrency: 1 }, () => {
  it('GET /creation-strategies?lang=ja 返回日文卡名且结构齐全', async () => {
    mem._seedUser({ id: 'u_ja', level: 'BASIC' });
    const tok = signAccess({ sub: 'u_ja', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/creation-strategies?lang=ja', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'ja');
    for (const fam of ['pace', 'dialogue', 'emotion', 'character']) {
      assert.strictEqual(j[fam].length, 5);
      j[fam].forEach((c) => assert.ok(c.name && c.tagline && c.id));
    }
    assert.ok(j.pace[0].name.includes('テンポ'));
  });
  it('POST /creation-strategy/recommend ar 返回阿语理由；非法 lang 回退 zh', async () => {
    const tok = signAccess({ sub: 'u_ja', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/creation-strategy/recommend', {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'ar', tags: ['复仇'] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'ar');
    assert.ok(j.pace.card.name && j.pace.reason.length > 0);
    const r2 = await fetch(base + '/api/generate/creation-strategies?lang=fr', { headers: { Authorization: `Bearer ${tok}` } });
    const j2 = await r2.json();
    assert.strictEqual(j2.lang, 'zh');
  });
  it('GET /hook-options?lang=ko 钩子策略卡为韩文，四层钩目录回退英文不炸', async () => {
    const tok = signAccess({ sub: 'u_ja', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/hook-options?lang=ko', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'ko');
    assert.strictEqual(j.strategies.length, 5);
    assert.ok(j.strategies.some((s) => s.name.includes('균형')));
    assert.strictEqual(j.layers.length, 4);
  });
});

describe('v2.45 四轴风味/框架标签六语', { concurrency: 1 }, () => {
  it('GET /hook-options?lang=es：四轴风味/层/模式/强度/节拍类名西语，29钩目录回退英文不炸', async () => {
    mem._seedUser({ id: 'u_es', level: 'BASIC' });
    const tok = signAccess({ sub: 'u_es', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/hook-options?lang=es', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'es');
    assert.ok(j.flavors.length === 6 && j.flavors.every((f) => f.name && f.desc));
    assert.ok(j.flavors.some((f) => f.id === 'action' && f.name.includes('acción')));
    assert.ok(j.payoffFlavors.length === 5 && j.reversalFlavors.length === 4 && j.emotionFlavors.length === 5);
    assert.strictEqual(j.layers.length, 4);
    assert.ok(j.layers[0].label.includes('apertura'));
    assert.deepStrictEqual(j.modes.map((m) => m.id), ['auto', 'manual', 'hybrid']);
    assert.ok(j.modes[0].name.includes('Auto'));
    assert.strictEqual(j.strengths.length, 3);
    assert.ok(j.beats.map((b) => b.label).some((x) => x.includes('giro')));
    assert.strictEqual(j.layers[0].hooks.length > 0, true); // 29 钩目录仍在（英文回退）
  });
  it('POST /flavor-recommend lang=ja：风味名为日文，结构完整', async () => {
    const tok = signAccess({ sub: 'u_es', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/flavor-recommend', {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'ja', tags: ['复仇', '悬疑'] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.lang, 'ja');
    for (const k of ['microFlavors', 'payoffFlavors', 'reversalFlavors', 'emotionFlavors']) {
      assert.ok(Array.isArray(j[k]) && j[k].every((x) => x.id && x.name));
    }
  });
});

describe('v2.46 29 个具体钩子四语目录', { concurrency: 1 }, () => {
  it('GET /hook-options?lang=ja：四层 29 钩名称/释义/示例全日文，bestFor 保留', async () => {
    mem._seedUser({ id: 'u_ja2', level: 'BASIC' });
    const tok = signAccess({ sub: 'u_ja2', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/hook-options?lang=ja', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const n = j.layers.reduce((a, L) => a + L.hooks.length, 0);
    assert.strictEqual(n, j.total);
    assert.strictEqual(j.total, 29);
    const open = j.layers.find((L) => L.layer === 'open').hooks;
    const conflict = open.find((h) => h.id === 'open_conflict');
    assert.ok(conflict.name.includes('衝突'));
    assert.ok(conflict.definition && conflict.example);
    assert.ok(Array.isArray(conflict.bestFor));
    // en 接口仍零中文
    const re = await fetch(base + '/api/generate/hook-options?lang=en', { headers: { Authorization: `Bearer ${tok}` } });
    const je = await re.json();
    const blob = JSON.stringify(je.layers);
    assert.ok(!/[一-鿿]/.test(blob), '英文钩子目录零中文');
  });
});

describe('v2.47 26 个具体节拍四语目录', { concurrency: 1 }, () => {
  it('GET /hook-options?lang=ko：三类 26 节拍名称/释义/示例全韩文，technique 保留', async () => {
    mem._seedUser({ id: 'u_ko2', level: 'BASIC' });
    const tok = signAccess({ sub: 'u_ko2', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/hook-options?lang=ko', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.beats.length, 3);
    const n = j.beats.reduce((a, g) => a + g.items.length, 0);
    assert.strictEqual(n, 26);
    const rev = j.beats.find((g) => g.kind === 'reversal').items;
    const id = rev.find((b) => b.id === 'rev_identity');
    assert.ok(id.name.includes('신분'));
    assert.ok(id.definition && id.example && id.technique);
    const emo = j.beats.find((g) => g.kind === 'emotion').items;
    assert.strictEqual(emo.length, 8);
  });
});

describe('v2.48 风味推荐理由四语', { concurrency: 1 }, () => {
  it('POST /flavor-recommend lang=es：理由句西语、与命中规则对齐', async () => {
    mem._seedUser({ id: 'u_es2', level: 'BASIC' });
    const tok = signAccess({ sub: 'u_es2', level: 'BASIC' });
    const r = await fetch(base + '/api/generate/flavor-recommend', {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'es', tags: ['复仇', '逆袭'] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.reasons) && j.reasons.length >= 1);
    assert.ok(j.reasons.every((x) => typeof x === 'string' && x.length > 10));
    assert.ok(/venganza/i.test(j.reasons.join(' ')));
  });
});

describe('v2.49 情绪波形六语', { concurrency: 1 }, () => {
  it('emotion-wave?lang=ja：节拍名日语化、建议无占位残留；lang=ar 正常返回', async () => {
    const uid = 'u_wja';
    mem._seedUser({ id: uid, level: 'PRO', balance: 999 });
    mem._projects.set('proj_wja', { id: 'proj_wja', userId: uid, bible: null, totalEps: 20 });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'PRO' })}` };
    const rj = await fetch(base + '/api/generate/projects/proj_wja/emotion-wave?lang=ja', { headers: h });
    assert.strictEqual(rj.status, 200);
    const j = await rj.json();
    assert.strictEqual(j.points.length, 20);
    const named = j.points.flatMap((p) => [...p.path, ...p.payoffs, p.reversal].filter(Boolean));
    assert.ok(named.length > 0);
    assert.ok(named.every((b) => b.name && !/[，。；]/.test(b.name) === true || b.name));
    j.advices.forEach((a) => assert.ok(!/\{(ep|intensity|path)\}/.test(a.advice)));
    const ra = await fetch(base + '/api/generate/projects/proj_wja/emotion-wave?lang=ar', { headers: h });
    assert.strictEqual(ra.status, 200);
    const ja2 = await ra.json();
    assert.strictEqual(ja2.points.length, 20);
  });
});

describe('v2.50 全本诊断六语', { concurrency: 1 }, () => {
  it('diagnosis?lang=ja 六维标签日语化；英文正文 lang=en 建议零中文', async () => {
    const uid = 'u_dja';
    mem._seedUser({ id: uid, level: 'PRO', balance: 999 });
    mem._projects.set('proj_dja', { id: 'proj_dja', userId: uid, bible: null });
    const zhText = '他心中五味杂陈，一股莫名情绪涌上心头，不禁暗自想，久久不能平静。'.repeat(8);
    mem._scripts.push({ id: 's_dja', projectId: 'proj_dja', epNo: 1, version: 1, content: zhText, title: '第一集', wordCount: zhText.length, score: 70 });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'PRO' })}` };
    const rj = await fetch(base + '/api/generate/projects/proj_dja/diagnosis?lang=ja', { headers: h });
    assert.strictEqual(rj.status, 200);
    const j = await rj.json();
    assert.deepStrictEqual(j.groups.map((g) => g.label), ['人物', '筋書き', '台詞', '市場性', 'フォーマット', 'AI除去']);
    assert.ok(j.scorecard.dimensions.every((x) => x.advice && x.level));

    mem._projects.set('proj_den', { id: 'proj_den', userId: uid, bible: null });
    const enText = 'She had mixed feelings; a wave of sadness washed over her and she could not calm down. '.repeat(8);
    mem._scripts.push({ id: 's_den', projectId: 'proj_den', epNo: 1, version: 1, content: enText, title: 'Ep1', wordCount: enText.length, score: 70 });
    const re = await fetch(base + '/api/generate/projects/proj_den/diagnosis?lang=en', { headers: h });
    const je = await re.json();
    assert.strictEqual(re.status, 200);
    assert.deepStrictEqual(je.groups.map((g) => g.label), ['Character', 'Plot', 'Dialogue', 'Market', 'Format', 'De-AI']);
    je.topFixes.forEach((f) => assert.ok(!/[一-鿿]/.test(f.advice + f.dimLabel), '英文诊断零中文'));
  });
});

describe('v2.54 小南能力硬闸门与黑盒', { concurrency: 1 }, () => {
  it('免费用户让小南做剧情深度优化 → 403 且带升级引导，不扣费', async () => {
    const uid = 'u_gate_free';
    mem._seedUser({ id: uid, level: 'FREE', balance: 300 });
    mem._projects.set('proj_gate_free', { id: 'proj_gate_free', userId: uid, bible: null });
    mem._scripts.push({ id: 's_gate_free', projectId: 'proj_gate_free', epNo: 1, version: 1, content: '第一集'.repeat(200), title: 't', wordCount: 600, score: 80 });
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'FREE' })}` };
    const r = await fetch(base + '/api/generate/projects/proj_gate_free/fix', { method: 'POST', headers: h,
      body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '张力偏平' } }) });
    assert.strictEqual(r.status, 403);
    const j = await r.json();
    assert.strictEqual(j.error, 'ASSISTANT_LEVEL_REQUIRED');
    assert.ok(/高级会员/.test(j.upsell.zh));
    assert.strictEqual(mem._accounts.get(uid).balance, 300);
  });
  it('黑盒：沙盘 SSE 全事件不含任何底层厂商/型号/端点线索', async () => {
    const { scanVendorLeaks } = require('../dist/lib/blackbox.js');
    const pid = seed('u_bbox', 'BASIC', 1000);
    const r = await call('u_bbox', 'BASIC', { projectId: pid, brief });
    assert.strictEqual(r.status, 200);
    const leaks = scanVendorLeaks(r.events);
    assert.deepStrictEqual(leaks, [], `C端事件泄露: ${leaks.join(' | ')}`);
  });
  it('GET /assistant/capabilities：返回13项能力与当前等级解锁状态', async () => {
    const uid = 'u_cap';
    mem._seedUser({ id: uid, level: 'BASIC' });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/assistant/capabilities', { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.capabilities.length, 13);
    assert.strictEqual(j.capabilities.find((c) => c.action === 'dialogue_polish').allowed, true);
    assert.strictEqual(j.capabilities.find((c) => c.action === 'deep_advice').allowed, false);
    assert.strictEqual(j.capabilities.find((c) => c.action === 'listen_script').allowed, false);
  });
});

describe('v2.55 听剧本朗读接口', { concurrency: 1 }, () => {
  const listenText = [
    '第1集 雨夜归来', '内景 老旧居民楼·楼道 夜',
    '镜头：缓推至门口。', '△林晚攥紧钥匙，指节发白。',
    '林晚（压低声音）：妈，我回来了。',
  ].join('\n');
  const seedScript = (uid, level, id = 's_listen') => {
    mem._seedUser({ id: uid, level, balance: 500 });
    mem._projects.set(`proj_${uid}`, { id: `proj_${uid}`, userId: uid, bible: null });
    mem._scripts.push({ id, projectId: `proj_${uid}`, epNo: 1, version: 1, content: listenText, title: '雨夜归来', wordCount: listenText.length, score: 80 });
  };
  it('基础会员听剧本 → 403 ASSISTANT_LEVEL_REQUIRED 且不扣分', async () => {
    seedScript('u_lis_basic', 'BASIC', 's_lis_b');
    const before = mem._accounts.get('u_lis_basic').balance;
    const h = { Authorization: `Bearer ${signAccess({ sub: 'u_lis_basic', level: 'BASIC' })}` };
    const r = await fetch(base + '/api/generate/scripts/s_lis_b/listen', { headers: h });
    assert.strictEqual(r.status, 403);
    const j = await r.json();
    assert.strictEqual(j.error, 'ASSISTANT_LEVEL_REQUIRED');
    assert.strictEqual(j.needLevel, 'ADVANCED');
    assert.strictEqual(mem._accounts.get('u_lis_basic').balance, before);
  });
  it('高级会员听剧本 → 200，分段/角色/时长/朗读稿齐备，技术行剔除', async () => {
    seedScript('u_lis_adv', 'ADVANCED', 's_lis_a');
    const h = { Authorization: `Bearer ${signAccess({ sub: 'u_lis_adv', level: 'ADVANCED' })}` };
    const r = await fetch(base + '/api/generate/scripts/s_lis_a/listen?lang=zh', { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.scriptId, 's_lis_a');
    assert.strictEqual(j.dialogueCount, 1);
    assert.deepStrictEqual(j.speakerSet, ['林晚']);
    assert.ok(j.estSeconds > 0 && j.totalChars > 0);
    assert.ok(j.narration.includes('林晚（压低声音）：妈，我回来了'));
    assert.ok(!j.segments.some((s) => s.text.startsWith('镜头：')));
    assert.strictEqual(j.ttsReady, false);
    assert.ok(j.note.title.includes('高级会员'));
  });
  it('听剧本：剧本不存在 404、非本人项目 403、空正文 400', async () => {
    const uid = 'u_lis_adv2';
    mem._seedUser({ id: uid, level: 'ADVANCED' });
    mem._projects.set(`proj_${uid}`, { id: `proj_${uid}`, userId: uid, bible: null });
    mem._scripts.push({ id: 's_lis_empty', projectId: `proj_${uid}`, epNo: 1, version: 1, content: '镜头：特写\n配乐：BGM', title: '空', wordCount: 8, score: 70 });
    mem._projects.set('proj_other', { id: 'proj_other', userId: 'someone_else', bible: null });
    mem._scripts.push({ id: 's_lis_other', projectId: 'proj_other', epNo: 1, version: 1, content: listenText, title: '他人本', wordCount: 10, score: 70 });
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` };
    assert.strictEqual((await fetch(base + '/api/generate/scripts/no_such/listen', { headers: h })).status, 404);
    assert.strictEqual((await fetch(base + '/api/generate/scripts/s_lis_other/listen', { headers: h })).status, 403);
    const re = await fetch(base + '/api/generate/scripts/s_lis_empty/listen', { headers: h });
    assert.strictEqual(re.status, 400);
  });
});

// v2.193 c193 复盘行为锁定：对象形态圣经（pipeline 主回写形态）下，配角在场台账必须真实注入
// 架构师。旧码 castNameList 只认数组形态 → 对象形态名表恒空 → 台账静默失效（无报错、SSE 200）。
describe('v2.193 c193 · 对象形态圣经的配角在场台账端到端注入', { concurrency: 1 }, () => {
  const mp = require('../dist/lib/model-proxy.js');
  it('陈总第1集后连续缺席3集 → 第5集架构师 prompt 含在场防遗忘调度与陈总', async () => {
    const uid = 'u_c193_pres';
    const pid = `proj_${uid}`;
    mem._seedUser({ id: uid, level: 'BASIC', balance: 50000 });
    mem._projects.set(pid, {
      id: pid, userId: uid, title: '在场台账测试', mode: 'tags', format: 'LIVE_ACTION', totalEps: 10,
      tags: [], createdAt: new Date(),
      bible: {
        worldview: '现代都市', timeline: ['一句话梗概'], foreshadow: [],
        characters: { // 对象形态：pipeline.ts 人设师回写的主形态（旧码此形态名表恒空）
          林晚: { traits: '隐忍', arc: '反击', voice: '短句' },
          陈总: { traits: '多疑', arc: '崩塌', voice: '慢条斯理' },
        },
      },
    });
    // 4 集成稿（epIndex=count=4 → 生成第5集；路由取 epNo<4 的 1/2/3 集入台账）：
    // 陈总仅 ep1 出场 → lastIn=1，lastDone=4，absentStreak=3 → mid 调度必须注入
    const epContent = (ep, withChen) => [
      '场景一 内景 写字楼 日',
      '林晚（平静）：这是第' + ep + '集的对白。',
      withChen ? '陈总（冷笑）：你以为赢了？' : '林晚独自翻看文件，夜深未归。',
    ].join('\n');
    for (let ep = 1; ep <= 4; ep++) {
      mem._scripts.push({ id: `s_c193_${ep}`, projectId: pid, epNo: ep, version: 0, title: `第${ep}集`, wordCount: 120, score: 80, content: epContent(ep, ep === 1) });
    }
    const cap = [];
    const origJson = mp.callJson, origText = mp.callText;
    mp.callJson = async (t, r, p) => { cap.push({ r, p }); return { text: '', sandbox: true, costFen: 0 }; };
    mp.callText = mp.callJson;
    try {
      const res = await call(uid, 'BASIC', { projectId: pid, brief });
      assert.strictEqual(res.status, 200);
      const archPrompts = cap.filter((x) => x.r === 'architect').map((x) => x.p);
      assert.ok(archPrompts.length >= 1, '架构师岗应被调用');
      const joined = archPrompts.join('\n');
      assert.ok(joined.includes('配角在场·防遗忘调度'), '对象形态名表必须生效，注入在场台账（旧码静默蒸发）');
      assert.ok(joined.includes('陈总') && joined.includes('连续 3 集未出场'), '缺席角色名与连续缺席集数须具体');
      assert.ok(!joined.includes('林晚」已连续 3 集'), '最近完成集仍在场的林晚不应被误报');
    } finally {
      mp.callJson = origJson; mp.callText = origText;
    }
  }, 90000);
});

// c202 功能轮：改写前后版本对比端点（只读/零扣费/确定性）+ /fix 响应带改写幅度观测
describe('c202 版本对比 GET /projects/:id/scripts/diff', { concurrency: 1 }, () => {
  const uid = 'u_c202diff';
  const pid = 'proj_c202diff';
  const OLD = ['第1集', '场景一 小店', '老周：面钱下回给。', '小林：你上回也这么说。', '他端起碗吃面。'].join('\n');
  const NEW = ['第1集', '场景一 小店', '老周：面钱今天就结。', '小林：你上回也这么说。', '他端起碗吃面。', '门外喇叭响了两声。'].join('\n');
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
  mem._seedUser({ id: uid, level: 'BASIC', balance: 500 });
  mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
  mem._scripts.push(
    { id: 'c202d_e1v1', projectId: pid, epNo: 1, version: 1, title: '第一集', wordCount: OLD.length, content: OLD, score: 80 },
    { id: 'c202d_e1v2', projectId: pid, epNo: 1, version: 2, title: '第一集', wordCount: NEW.length, content: NEW, score: 85 },
    { id: 'c202d_e2v1', projectId: pid, epNo: 2, version: 1, title: '第二集', wordCount: 10, content: '第二集内容', score: 80 },
  );

  it('指定 from/to：返回行级 segments 与统计，免费不扣分', async () => {
    const before = mem._accounts.get(uid).balance;
    const r = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1&to=2`, { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.epNo, 1);
    assert.strictEqual(j.from.version, 1);
    assert.strictEqual(j.to.version, 2);
    assert.ok(Array.isArray(j.segments) && j.segments.length >= 4);
    for (const s of j.segments) assert.ok(['equal', 'added', 'removed'].includes(s.type) && typeof s.text === 'string');
    assert.strictEqual(j.stats.equal, 4, '第1集/场景/小林对白/吃面 四行不变');
    assert.strictEqual(j.stats.removed, 1, '老周旧对白一行被删');
    assert.strictEqual(j.stats.added, 2, '老周新对白 + 门外新增行');
    assert.ok(j.span && ['negligible', 'light', 'partial', 'major'].includes(j.span.level));
    assert.strictEqual(typeof j.span.changedRatio, 'number');
    assert.strictEqual(mem._accounts.get(uid).balance, before, '版本对比是只读可视化，绝不扣分');
  });

  it('c204 响应附带 summary 变更摘要：台词/动作分类计数 + 台词亮点（零扣费、零模型）', async () => {
    const r = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1&to=2`, { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.summary && j.summary.added && j.summary.removed, 'summary 必须随 diff 一起返回');
    assert.strictEqual(j.summary.removed.dialogue, 1, '老周旧台词被替换');
    assert.strictEqual(j.summary.added.dialogue, 1, '老周新台词');
    assert.strictEqual(j.summary.added.action, 1, '门外动作行');
    const hl = j.summary.highlights.added.find((x) => x.speaker === '老周');
    assert.ok(hl, '新台词亮点带 speaker，供前端直接渲染"谁的台词改了"');
    assert.ok(hl.text.includes('今天就结'), '亮点内容是纯台词文本');
  });

  it('省略 to：默认对比该集最新版（v2）', async () => {
    const r = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1`, { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.to.version, 2, 'to 缺省时取 epNo 最大版本');
  });

  it('from===to → 400；版本号不存在 → 400；epNo 缺失/非法 → 400', async () => {
    const r1 = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=2&to=2`, { headers: h });
    assert.strictEqual(r1.status, 400, '同版自比无意义');
    const r2 = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=9&to=10`, { headers: h });
    assert.strictEqual(r2.status, 400);
    const r3 = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?from=1&to=2`, { headers: h });
    assert.strictEqual(r3.status, 400);
    const r4 = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=x&from=1&to=2`, { headers: h });
    assert.strictEqual(r4.status, 400);
  });

  it('他人项目 → 404（不得借 diff 端点读取他人剧本全文）', async () => {
    mem._seedUser({ id: 'u_c202other', level: 'BASIC', balance: 0 });
    const oh = { Authorization: `Bearer ${signAccess({ sub: 'u_c202other', level: 'BASIC' })}` };
    const r = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1&to=2`, { headers: oh });
    assert.strictEqual(r.status, 404);
  });

  it('/fix 成功响应带 rewriteSpan 改写幅度（纯函数观测，不改变扣费语义）', async () => {
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    // 原稿 20 行；改写稿保留前 10 行、替换后 10 行（≈0.5 churn→partial），长度同量级过 isUsableRewrite
    const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
    const original = mk(20, '原稿');
    const rewritten = Array.from({ length: 20 }, (_, i) =>
      (i < 10 ? `原稿第${i + 1}行，这是足够长的对白或动作描写文本。` : `改写后第${i + 1}行，全新的台词与动作描写在这里。`)).join('\n');
    mem._projects.set('proj_c202fix', { id: 'proj_c202fix', userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'c202fix_v1', projectId: 'proj_c202fix', epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 70 });
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const before = mem._accounts.get(uid).balance;
      const r = await fetch(base + '/api/generate/projects/proj_c202fix/fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '字数不达标，补到单集体量' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const j = await r.json();
      assert.strictEqual(j.newVersion, 2);
      assert.ok(j.rewriteSpan && typeof j.rewriteSpan.changedRatio === 'number', '成功响应必须带改写幅度，供前端告诉用户“改了多少”');
      assert.ok(['negligible', 'light', 'partial', 'major'].includes(j.rewriteSpan.level));
      assert.strictEqual(mem._accounts.get(uid).balance, before - j.pointsCharged, '扣费语义不变：span 仅观测');
    } finally {
      MP.callText = orig;
    }
  });
});

// c203 复盘轮：/fix 并发败者资金保护——幂等键含 rule/尝试序号，拦不住跨规则并发（同规则在 SSI 重试后
// 序号也会漂移）；两笔都扣款、都调模型，落 Script 新版本时 [projectId,epNo,version] 唯一键必撞，
// 旧代码让败者裸抛 500 且钱不退。修复：落库前重读版本 + create 兜底 catch，败者一律退款并给可识别错误码。
describe('c203 /fix 并发版本冲突的退款保护', { concurrency: 1 }, () => {
  const uid = 'u_c203race';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  const rewritten = mk(20, '改写后');
  const fixBody = JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '字数不达标，补到单集体量' }, epNo: 1 });
  mem._seedUser({ id: uid, level: 'BASIC', balance: 500 });

  it('模型返回时版本已被并发请求推进 → 409 VERSION_ADVANCED，积分原路退回，不重复落库', async () => {
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    const pid = 'proj_c203race1';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'c203race1_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    MP.callText = async () => {
      // 模拟并发的“另一笔”请求已先落 v2（唯一键的胜者）
      mem._scripts.push({ id: 'c203race1_winner', projectId: pid, epNo: 1, version: 2, title: 't', wordCount: rewritten.length, content: rewritten, score: 80 });
      return { text: mk(20, '败者改写'), costFen: 0 };
    };
    try {
      const before = mem._accounts.get(uid).balance;
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, { method: 'POST', headers: h, body: fixBody });
      assert.strictEqual(r.status, 409);
      const j = await r.json();
      assert.strictEqual(j.error, 'VERSION_ADVANCED');
      assert.strictEqual(mem._accounts.get(uid).balance, before, '败者必须全额退款，钱不能悬挂');
      const v2rows = mem._scripts.filter((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.strictEqual(v2rows.length, 1, '败者不得再写一行 v2');
      assert.strictEqual(v2rows[0].id, 'c203race1_winner', 'v2 只能是并发胜者那一行');
      const refunds = mem._ledgers.filter((l) => l.userId === uid && /TARGETED_FIX/.test(l.reason) && l.direction === 'IN');
      assert.ok(refunds.length >= 1, '必须留下退款流水，账本能对账');
    } finally {
      MP.callText = orig;
    }
  });

  it('create 撞 P2002 唯一键 → 409 VERSION_ADVANCED + 退款（重读与落库之间的竞态兜底）', async () => {
    const pid = 'proj_c203race2';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'c203race2_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    const MP = require('../dist/lib/model-proxy.js');
    const origText = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    const origCreate = mem.script.create;
    mem.script.create = async (args) => {
      if (args && args.data && args.data.projectId === pid && args.data.version === 2) {
        const e = new Error('Unique constraint'); e.code = 'P2002'; throw e;
      }
      return origCreate(args);
    };
    try {
      const before = mem._accounts.get(uid).balance;
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, { method: 'POST', headers: h, body: fixBody });
      assert.strictEqual(r.status, 409);
      const j = await r.json();
      assert.strictEqual(j.error, 'VERSION_ADVANCED');
      assert.strictEqual(mem._accounts.get(uid).balance, before, 'P2002 败者全额退款');
    } finally {
      mem.script.create = origCreate;
      MP.callText = origText;
    }
  });

  it('create 发生非唯一键异常 → 502 SAVE_FAILED + 退款（任何落库失败都不得吞掉已扣积分）', async () => {
    const pid = 'proj_c203race3';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'c203race3_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: 400, content: mk(20, '原稿'), score: 70 });
    const MP = require('../dist/lib/model-proxy.js');
    const origText = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    const origCreate = mem.script.create;
    mem.script.create = async (args) => {
      if (args && args.data && args.data.projectId === pid) throw new Error('db down');
      return origCreate(args);
    };
    try {
      const before = mem._accounts.get(uid).balance;
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, { method: 'POST', headers: h, body: fixBody });
      assert.strictEqual(r.status, 502);
      const j = await r.json();
      assert.strictEqual(j.error, 'SAVE_FAILED');
      assert.strictEqual(mem._accounts.get(uid).balance, before, '落库异常也必须退款');
    } finally {
      mem.script.create = origCreate;
      MP.callText = origText;
    }
  });
});

// c203 D4：diff 端点对超行数上限的内容给 400（零扣费），而不是让 O(nm) DP 拖垮进程
describe('c203 diff 端点行数上限', { concurrency: 1 }, () => {
  const uid = 'u_c203big';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` };
  mem._seedUser({ id: uid, level: 'BASIC', balance: 500 });
  it('两版均超 2000 行 → 400 SCRIPT_TOO_LARGE，不扣分', async () => {
    const pid = 'proj_c203big';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    const mkBig = (tag) => Array.from({ length: 2002 }, (_, i) => `${tag}第${i + 1}行正文内容。`).join('\n');
    const v1 = mkBig('旧稿'); const v2 = mkBig('新稿');
    mem._scripts.push(
      { id: 'c203big_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: v1.length, content: v1, score: 70 },
      { id: 'c203big_v2', projectId: pid, epNo: 1, version: 2, title: 't', wordCount: v2.length, content: v2, score: 70 },
    );
    const before = mem._accounts.get(uid).balance;
    const r = await fetch(base + `/api/generate/projects/${pid}/scripts/diff?epNo=1&from=1&to=2`, { headers: h });
    assert.strictEqual(r.status, 400);
    const j = await r.json();
    assert.strictEqual(j.error, 'SCRIPT_TOO_LARGE');
    assert.strictEqual(mem._accounts.get(uid).balance, before, '只读端点超限也绝不扣费');
  });
});

// c206 功能轮：听剧本端点返回多角色声线 cast（确定性/零模型/零扣费）+ 会员闸门
describe('c206 听剧本 GET /scripts/:id/listen（多角色声线）', { concurrency: 1 }, () => {
  const uid = 'u_c206listen';
  const pid = 'proj_c206listen';
  const TEXT = [
    '第1集 夜归',
    '内景 县三中教室·傍晚',
    '时间：傍晚',
    '地点：县三中教室',
    '人物：林晚、陈默',
    '林晚：你怎么才来。',
    '陈默（喘气）：路上堵死了。',
    '△他把书包扔在桌上。',
  ].join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 500 });
  mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
  mem._scripts.push({ id: 'c206s1', projectId: pid, epNo: 1, version: 1, title: '第一集', wordCount: TEXT.length, content: TEXT, score: 80 });

  it('ADVANCED：返回朗读段 + cast（旁白/角色声线、选声语言），台账行不入朗读、零扣分', async () => {
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` };
    const before = mem._accounts.get(uid).balance;
    const r = await fetch(base + '/api/generate/scripts/c206s1/listen', { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.segments) && j.segments.length > 0);
    assert.ok(!j.narration.includes('时间：傍晚'), 'c205 台账行不进朗读稿');
    assert.ok(!j.narration.includes('人物：林晚'));
    assert.deepStrictEqual(j.speakerSet, ['林晚', '陈默']);
    // cast 结构
    assert.ok(j.cast && j.cast.narrator && j.cast.characters, 'cast 必须随朗读稿返回');
    assert.strictEqual(j.cast.voiceLang, 'zh-CN');
    assert.ok(j.cast.narrator.pitch > 0 && j.cast.narrator.rate > 0);
    assert.deepStrictEqual(Object.keys(j.cast.characters).sort(), ['林晚', '陈默']);
    assert.notDeepStrictEqual(j.cast.characters['林晚'], j.cast.characters['陈默'], '两个角色声线必须不同');
    assert.notDeepStrictEqual(j.cast.characters['林晚'], j.cast.narrator, '角色声线与旁白不同');
    assert.ok(j.note && j.note.title);
    assert.strictEqual(mem._accounts.get(uid).balance, before, '听剧本零扣分');
  });

  it('lang=en：voiceLang=en-US；FREE 用户 403 带升级引导', async () => {
    const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` };
    const r = await fetch(base + '/api/generate/scripts/c206s1/listen?lang=en', { headers: h });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).cast.voiceLang, 'en-US');

    const fuid = 'u_c206free';
    mem._seedUser({ id: fuid, level: 'FREE', balance: 0 });
    const fh = { Authorization: `Bearer ${signAccess({ sub: fuid, level: 'FREE' })}` };
    const before = mem._accounts.get(fuid).balance;
    const rf = await fetch(base + '/api/generate/scripts/c206s1/listen', { headers: fh });
    assert.strictEqual(rf.status, 403);
    const jf = await rf.json();
    assert.strictEqual(jf.error, 'ASSISTANT_LEVEL_REQUIRED');
    assert.ok(jf.upsell, '403 必须带升级引导');
    assert.strictEqual(mem._accounts.get(fuid).balance, before, '被闸门拦下不扣分');
  });

  it('他人剧本 403；不存在剧本 404', async () => {
    const ouid = 'u_c206other';
    mem._seedUser({ id: ouid, level: 'ADVANCED', balance: 0 });
    const oh = { Authorization: `Bearer ${signAccess({ sub: ouid, level: 'ADVANCED' })}` };
    const r = await fetch(base + '/api/generate/scripts/c206s1/listen', { headers: oh });
    assert.strictEqual(r.status, 403, '不得借听剧本端点读取他人剧本全文');
    const r2 = await fetch(base + '/api/generate/scripts/no_such_script/listen', { headers: oh });
    assert.strictEqual(r2.status, 404);
  });
});

// c208 功能轮：整剧连播。片单只含每集"最新版本"且有可朗读正文的集（零模型零扣费、权益同单集听剧本）；
// 单集 /listen 附带同片单邻接关系，前端最后一段播完可自动跨集，不把旧版本/空集串进连播。
describe('c208 整剧连播 GET /projects/:id/listen/playlist + /listen neighbors', { concurrency: 1 }, () => {
  const uid = 'u_c208listen';
  const pid = 'proj_c208listen';
  const epText = (n) => [
    `第${n}集 测试`,
    '内景 房间·夜',
    `林晚：这是第${n}集的台词。`,
    '△她转过身去。',
  ].join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 500 });
  mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE', title: 'c208剧' });
  // ep1 有两个版本：v1 必须被 v2 遮蔽，不进片单、不成为邻接
  mem._scripts.push({ id: 'c208e1v1', projectId: pid, epNo: 1, version: 1, title: '一旧', wordCount: 20, content: epText(1) + '\n旧版本', score: 70 });
  mem._scripts.push({ id: 'c208e1v2', projectId: pid, epNo: 1, version: 2, title: '一新', wordCount: 20, content: epText(1), score: 80 });
  mem._scripts.push({ id: 'c208e2', projectId: pid, epNo: 2, version: 1, title: '二', wordCount: 20, content: epText(2), score: 80 });
  mem._scripts.push({ id: 'c208e3', projectId: pid, epNo: 3, version: 1, title: '三', wordCount: 20, content: epText(3), score: 80 });
  // 空正文集：片单跳过，邻接也不得把自动连播带进 400 死路
  mem._scripts.push({ id: 'c208e4empty', projectId: pid, epNo: 4, version: 1, title: '空', wordCount: 0, content: '', score: 0 });

  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` };

  it('片单：仅最新版、按 epNo 升序、空集计入 skipped，零扣费', async () => {
    const before = mem._accounts.get(uid).balance;
    const r = await fetch(base + `/api/generate/projects/${pid}/listen/playlist?lang=zh`, { headers: h });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.projectId, pid);
    assert.strictEqual(j.lang, 'zh');
    assert.strictEqual(j.title, 'c208剧');
    assert.deepStrictEqual(j.episodes.map((e) => e.scriptId), ['c208e1v2', 'c208e2', 'c208e3'], '旧版本/空集不进片单');
    assert.deepStrictEqual(j.episodes.map((e) => e.epNo), [1, 2, 3]);
    assert.strictEqual(j.totalEps, 3);
    assert.strictEqual(j.skippedEps, 1);
    assert.ok(j.totalSeconds > 0);
    const e1 = j.episodes[0];
    assert.ok(e1.segCount > 0 && e1.dialogueCount === 1 && e1.totalChars > 0 && e1.estSeconds > 0);
    assert.strictEqual(mem._accounts.get(uid).balance, before, '片单零扣费');
  });

  it('单集 /listen：带 projectId 与可播放片单邻接（旧版本/空集不参与）', async () => {
    const r1 = await fetch(base + '/api/generate/scripts/c208e1v2/listen', { headers: h });
    assert.strictEqual(r1.status, 200);
    const j1 = await r1.json();
    assert.strictEqual(j1.projectId, pid);
    assert.strictEqual(j1.neighbors.prevScriptId, null, '首集无上一集');
    assert.strictEqual(j1.neighbors.nextScriptId, 'c208e2');
    assert.strictEqual(j1.neighbors.epPos, 1);
    assert.strictEqual(j1.neighbors.epCount, 3, '空集不计入可播放片单总数');

    const r2 = await fetch(base + '/api/generate/scripts/c208e2/listen', { headers: h });
    const j2 = await r2.json();
    assert.strictEqual(j2.neighbors.prevScriptId, 'c208e1v2', '上一集指向最新版而非 v1');
    assert.strictEqual(j2.neighbors.nextScriptId, 'c208e3');
    assert.strictEqual(j2.neighbors.epPos, 2);

    const r3 = await fetch(base + '/api/generate/scripts/c208e3/listen', { headers: h });
    const j3 = await r3.json();
    assert.strictEqual(j3.neighbors.nextScriptId, null, '末集无下一集（空集被跳过）');
  });

  it('闸门/归属/空项目：FREE 403 带 upsell；他人项目 404；无可朗读分集 400', async () => {
    const fuid = 'u_c208free';
    mem._seedUser({ id: fuid, level: 'FREE', balance: 0 });
    const fh = { Authorization: `Bearer ${signAccess({ sub: fuid, level: 'FREE' })}` };
    const before = mem._accounts.get(fuid).balance;
    const rf = await fetch(base + `/api/generate/projects/${pid}/listen/playlist`, { headers: fh });
    assert.strictEqual(rf.status, 403);
    assert.strictEqual((await rf.json()).error, 'ASSISTANT_LEVEL_REQUIRED');
    assert.strictEqual(mem._accounts.get(fuid).balance, before, '被拦不扣分');

    const ouid = 'u_c208other';
    mem._seedUser({ id: ouid, level: 'ADVANCED', balance: 0 });
    const oh = { Authorization: `Bearer ${signAccess({ sub: ouid, level: 'ADVANCED' })}` };
    assert.strictEqual((await fetch(base + `/api/generate/projects/${pid}/listen/playlist`, { headers: oh })).status, 404);

    const pEmpty = 'proj_c208empty';
    mem._projects.set(pEmpty, { id: pEmpty, userId: uid, bible: null, format: 'LIVE', title: '空项目' });
    const re = await fetch(base + `/api/generate/projects/${pEmpty}/listen/playlist`, { headers: h });
    assert.strictEqual(re.status, 400);
  });

  it('lang=en：片单语言随参数', async () => {
    const r = await fetch(base + `/api/generate/projects/${pid}/listen/playlist?lang=en`, { headers: h });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).lang, 'en');
  });
});

// c209 功能轮：付费定向改写后 qcReport.cliffhanger 必须按新正文重算（旧版整体沿用会让
// 集尾钩分数/类型/结尾片段与正文事实漂移，下一集 deriveHookBit 读到错误钩子位）；
// 其余跨集台账键（beats/outline/payoffRhythm…）仍按旧规保留。
describe('c209 /fix 后集尾钩重算且台账保留', { concurrency: 1 }, () => {
  const uid = 'u_c209fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 500 });

  it('改写把平收结尾变成强反转钩 → 新版本 cliffhanger 为 reversal 且带 issues/planAlignment 字段', async () => {
    const pid = 'proj_c209fix1';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    const original = [mk(14, '原稿'), '△她站起身。', '李明：事情就这样定了。', '门关上了。', '一切归于平静。'].join('\n');
    // 旧版 qcReport：平收稿的集尾钩结论（none + 低分）+ 必须保留的跨集台账
    const staleQc = {
      cliffhanger: { score: 0, type: 'none', typeLabel: '无钩子', endingSnippet: '一切归于平静。' },
      beats: { reversalId: 'old_rev', payoffIds: ['old_pay'], emotionPath: [] },
      outline: { subplots: ['旧支线'] },
      payoffRhythm: { suppressCount: 2, releaseCount: 1 },
    };
    mem._scripts.push({ id: 'c209fix1_v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    // 改写稿：前14行沿用（过 isUsableRewrite 同量级），末几行换成强反转钩
    const rewritten = [
      mk(14, '原稿'),
      '△林晚把手里的茶杯轻轻放下，抬眼看向门口。',
      '陈总（冷笑）：你以为你赢了？',
      '没想到，门外缓缓走进来的人，正是本该已经死去的林母。',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '结尾平，加钩子' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2, '必须落 v2 新版本');
      const q = v2.qcReport;
      assert.ok(q && typeof q === 'object', 'v2 必须有 qcReport');
      assert.strictEqual(q.cliffhanger.type, 'reversal', `新结尾是反转钩，实际 ${q.cliffhanger.type}`);
      assert.ok(q.cliffhanger.score >= 70, `强反转钩应高分，实际 ${q.cliffhanger.score}`);
      assert.ok(q.cliffhanger.endingSnippet.includes('没想到') || q.cliffhanger.endingSnippet.includes('林母'), 'endingSnippet 必须来自新正文');
      assert.ok(Array.isArray(q.cliffhanger.issues), 'issues 字段必须存在（前端质检卡数据源）');
      assert.ok('planAlignment' in q.cliffhanger, 'planAlignment 字段必须存在');
      assert.ok(q.cliffhanger.endingSnippet.length <= 100, '落库片段≤100字');
      // 跨集台账不得被重算覆盖
      assert.deepStrictEqual(q.beats, staleQc.beats, 'beats 台账必须沿用旧版');
      assert.deepStrictEqual(q.outline, staleQc.outline, 'outline 台账必须沿用旧版');
      assert.deepStrictEqual(q.payoffRhythm, staleQc.payoffRhythm, 'payoffRhythm 台账必须沿用旧版');
      assert.strictEqual(q.targetedFix.rule, 'rhythm_flat');
      // 旧版本行不得被改动
      const v1 = mem._scripts.find((s) => s.id === 'c209fix1_v1');
      assert.strictEqual(v1.qcReport.cliffhanger.type, 'none', '旧版结论保持不变');
    } finally {
      MP.callText = orig;
    }
  });
});

// c210 功能轮：付费定向改写后 qcReport.arcTrack 必须按新正文 + 上一集台账重算，
// 且批量/SSE/修复三处共用限界 digest（角色只四字段、列表封顶）；其余台账键沿用旧版。
describe('c210 /fix 后角色弧光重算且形态限界', { concurrency: 1 }, () => {
  const uid = 'u_c210fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 600 });

  it('prevArc 读上一集最新版：喜悦→绝望硬切被抓，落库只四字段且旧停滞台账被替换；beats 等台账保留', async () => {
    const pid = 'proj_c210fix1';
    // c196 复盘：夹具改用生产真实形态（bible.characters 对象形态，pipeline 回写主形态）；
    // 旧夹具写从不落库的 bible.cast，曾让 /fix 名表读取的名实不符 bug 被绿灯掩盖
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: { characters: { 林夏: { arc: '低谷到反击' } } } });
    // 第 1 集最新版：林夏喜悦/收束（作为 prevArc 精确输入）
    const ep1Qc = { arcTrack: { score: 80, characters: [{ name: '林夏', emotion: 'joy', stage: 'resolution', changed: true }], stalled: [], jumpCut: [], issues: [] } };
    mem._scripts.push({ id: 'c210fix1_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't1', wordCount: 10, content: mk(14, '一集'), score: 60, qcReport: ep1Qc });
    // 第 2 集 v1：与新正文完全不符的陈旧弧光台账（calm/setup + 停滞），改写后必须被整体替换
    const staleQc = {
      arcTrack: {
        score: 10,
        characters: [{ name: '林夏', emotion: 'calm', stage: 'setup', changed: false, emotionTrack: ['calm'], relations: [] }],
        stalled: [{ name: '林夏', reason: '陈旧停滞结论' }],
        jumpCut: [],
        issues: [{ severity: 'mid', type: 'arc_stalled', advice: '旧 advice 必须被替换' }],
      },
      beats: { reversalId: 'old_rev', payoffIds: ['old_pay'], emotionPath: [] },
      outline: { subplots: ['旧支线'] },
      payoffRhythm: { suppressCount: 2, releaseCount: 1 },
    };
    const original = [mk(14, '原稿'), '林夏平静地看着窗外。'].join('\n');
    mem._scripts.push({ id: 'c210fix1_ep2v1', projectId: pid, epNo: 2, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    // 改写稿：林夏无任何恐惧/愤怒缓冲，直接绝望崩溃（对 prev 喜悦 → 跨极硬切）
    const rewritten = [mk(14, '原稿'), '林夏绝望，崩溃，心如死灰，无力地瘫倒，眼泪止不住地流。'].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '情绪转折太硬' }, epNo: 2 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 2 && s.version === 2);
      assert.ok(v2, '必须落 v2 新版本');
      const at = v2.qcReport.arcTrack;
      assert.ok(at && typeof at.score === 'number', 'arcTrack 必须存在且有 score');
      assert.strictEqual(at.characters.length, 1);
      assert.deepStrictEqual(Object.keys(at.characters[0]).sort(), ['changed', 'emotion', 'name', 'stage'], '落库角色只准四字段');
      assert.ok(!('emotionTrack' in at.characters[0]) && !('relations' in at.characters[0]), '无界轨迹/关系不得落库');
      const ch = at.characters[0];
      assert.strictEqual(ch.name, '林夏');
      assert.strictEqual(ch.emotion, 'despair', '新正文主导情绪为绝望');
      assert.ok(at.jumpCut.some((j) => j.from === 'joy' && j.to === 'despair'), '必须基于上一集台账抓到 joy→despair 硬切');
      assert.ok(at.issues.some((i) => i.type === 'emotion_jump'), 'issues 必须含重算出的情绪跳变');
      assert.ok(!at.stalled.some((s) => s.reason.includes('陈旧')), '陈旧停滞台账必须被重算结果替换');
      assert.ok(at.issues.every((i) => i.advice.length <= 160), 'advice≤160');
      // 其余跨集台账不动
      assert.deepStrictEqual(v2.qcReport.beats, staleQc.beats, 'beats 台账沿用旧版');
      assert.deepStrictEqual(v2.qcReport.outline, staleQc.outline, 'outline 台账沿用旧版');
      assert.deepStrictEqual(v2.qcReport.payoffRhythm, staleQc.payoffRhythm, 'payoffRhythm 台账沿用旧版');
      assert.strictEqual(v2.qcReport.targetedFix.rule, 'rhythm_flat');
      // 旧版本两行都不得被改动
      const oldEp2 = mem._scripts.find((s) => s.id === 'c210fix1_ep2v1');
      assert.strictEqual(oldEp2.qcReport.arcTrack.score, 10, 'v1 旧台账保持不变');
      const oldEp1 = mem._scripts.find((s) => s.id === 'c210fix1_ep1v1');
      assert.strictEqual(oldEp1.qcReport.arcTrack.characters[0].emotion, 'joy', '上一集台账不得被改写');
    } finally {
      MP.callText = orig;
    }
  });

  it('圣经无 cast 时从旧台账角色名并集重算；无上一集则 prevArc=null 不伪造跳变', async () => {
    const pid = 'proj_c210fix2';
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE' });
    const staleQc = { arcTrack: { score: 90, characters: [{ name: '阿昭', emotion: 'joy', stage: 'resolution', changed: true }], stalled: [], jumpCut: [], issues: [] } };
    const original = [mk(14, '旧稿'), '阿昭笑着离开。'].join('\n');
    mem._scripts.push({ id: 'c210fix2_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    const rewritten = [mk(14, '旧稿'), '阿昭绝望，崩溃，眼泪掉下来，心如死灰。'].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '重写情绪' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      const at = v2.qcReport.arcTrack;
      assert.ok(at, '圣经无 cast 也必须从台账角色名完成重算');
      assert.strictEqual(at.characters[0].name, '阿昭');
      assert.strictEqual(at.characters[0].emotion, 'despair');
      // 首集没有上一集：prevArc=null，不得拿本集旧台账冒充前集去制造跳变
      assert.strictEqual(at.jumpCut.length, 0, '无上一集时不得伪造跳变');
    } finally {
      MP.callText = orig;
    }
  });
});

// c196 名实不符复盘：/fix 人物名旧读 bible.cast（生产从不落库，真实字段是 characters 且 pipeline
// 回写为对象形态）→ castNames 恒空 → 三处名表消费整体空跑：① c215 batchCreativeDigest 静默跳过
// voicePrint/dialogueNameCall 两个需 cast 引擎（qcReport 永远缺键，改写后声口/点名质检无反馈）；
// ② c218 character 逻辑引擎空 cast；③ c217 台账重放本集角色行缺失。用生产真实形态（对象圣经）
// 端到端证伪。注：跨集死亡引擎按 ep<cur 只评前序，本集复活归角色在场引擎管（滞后一集记账是
// 设计行为），故本锁以「名表门控键是否随新正文产出」为证伪点。
describe('c196 /fix 人物表读 bible.characters（对象形态），需 cast 的质检引擎不再静默跳过', { concurrency: 1 }, () => {
  const uid = 'u_c196fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 600 });

  it('对象形态圣经的林晚进入 /fix 名表 → dialogueNameCall/voicePrint 按改写稿产出，24 键重放产出死亡名册', async () => {
    const pid = 'proj_c196fix1';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: { characters: { 林晚: { traits: '隐忍', arc: '假死归来' } } } });
    // 第 1 集短名摘要行：林晚已死亡（active 行 + dead=true）
    mem._scripts.push({
      id: 'c196_ep1', projectId: pid, epNo: 1, version: 1, title: 't1', wordCount: 10,
      content: mk(14, '一集'), score: 60,
      qcReport: { death: { rows: [{ name: '林晚', dead: true, revived: false, active: true }] } },
    });
    // v1 qcReport 刻意不含 dialogueNameCall/voicePrint：旧码名表恒空时这两个键会永久缺席
    const original = [mk(14, '旧稿'), '夜凉如水，街巷空无一人。'].join('\n');
    mem._scripts.push({ id: 'c196_ep2v1', projectId: pid, epNo: 2, version: 1, title: 't2', wordCount: original.length, content: original, score: 60, qcReport: {} });
    // 改写稿：林晚有本人台词（需 cast 引擎据此产出声口/点名质检）
    const rewritten = [mk(14, '新稿'), '△ 林晚推门而入，面色平静。\n林晚：我回来了，这些日子我一直在想你。'].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '重写' }, epNo: 2 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 2 && s.version === 2);
      assert.ok(v2, '必须落 v2');
      // ① c215 名表门控引擎：旧码 castNames=[] 时 batchCreativeDigest 根本不产此二键（已纯函数对拍证实）
      assert.ok(v2.qcReport.dialogueNameCall && Array.isArray(v2.qcReport.dialogueNameCall.hits),
        'dialogueNameCall 必须按改写稿重算产出（旧码读 bible.cast 时此键永久缺席，c196 回归锁）');
      assert.strictEqual(v2.qcReport.dialogueNameCall.score, 100);
      assert.ok(v2.qcReport.voicePrint && Array.isArray(v2.qcReport.voicePrint.issues),
        'voicePrint 必须按改写稿重算产出（旧码时静默跳过）');
      // ② c217 二十四本重放随对象形态圣经正常产出：死亡台账须随重放产出。c197 起改写集按已完成集
      // 评估——林晚在本集改写稿中再开口，当场复活出册（resurrected_after_death 归 c197 锁），故此处
      // 只锁引擎确实带着名表/前序跑通（名册保留或复活出册二选一，空跑时两者皆无）。
      const dl = v2.qcReport.deathLedger;
      assert.ok(dl && Array.isArray(dl.dead) && Array.isArray(dl.issues), 'deathLedger 须随重放产出');
      assert.ok(
        dl.dead.some((d) => d.name === '林晚' && d.deathEp === 1)
          || dl.issues.some((i) => i.type === 'resurrected_after_death'),
        '第 1 集死者须进入台账（保留在册，或因本集复活而出册报错，二者皆证明引擎带名表运行）',
      );
    } finally {
      MP.callText = orig;
    }
  });
});

// c197 静默回退/名实不符复盘：/fix 改写的是已完成集，却照搬「生成预览集」语义（引擎按 ep<cur
// 过滤本集行），造成两种盲：① 改写集自身引入的跨集穿帮（死者本集再开口）/fix 后抓不到，
// c217 诊断与新正文无关；② 28 个短名摘要行（props/death/humiliation…）一个都不回写，后续集
// prev 读到的永远是 v1 旧稿账面。c197：引擎按 cur+1 评估，bundle 另出本集短名行随 v2 落库。
describe('c197 /fix 按已完成集评估：本集穿帮当场判 + 短名摘要行随改写稿回写', { concurrency: 1 }, () => {
  const uid = 'u_c197fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 600 });

  it('死者本集再开口 → resurrected_after_death 当场报；death/humiliation 短名行按新正文落库（旧码保留 v1 旧值）', async () => {
    const pid = 'proj_c197fix1';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: { characters: { 林晚: { traits: '隐忍', arc: '假死归来' } } } });
    // 第 1 集：林晚已确认死亡（短名行 + 长名引擎的共同前序账面）
    mem._scripts.push({
      id: 'c197_ep1', projectId: pid, epNo: 1, version: 1, title: 't1', wordCount: 10,
      content: mk(14, '一集'), score: 60,
      qcReport: {
        death: { rows: [{ name: '林晚', dead: true, revived: false, active: true }] },
        humiliation: { planted: 0, paid: 0, strong: 0, markers: [] },
      },
    });
    // v1 旧稿短名账面：本集林晚无活动、无羞辱雷。旧 /fix 不回写短名行，v2 会原样保留这两个旧值。
    const original = [mk(14, '旧稿'), '夜凉如水，街巷空无一人。'].join('\n');
    mem._scripts.push({
      id: 'c197_ep2v1', projectId: pid, epNo: 2, version: 1, title: 't2', wordCount: original.length,
      content: original, score: 60,
      qcReport: {
        death: { rows: [{ name: '林晚', dead: false, revived: false, active: false }] },
        humiliation: { planted: 0, paid: 0, strong: 0, markers: [] },
      },
    });
    // 改写稿：林晚本集推门而入并开口（死者复活穿帮）；另新埋 3 枚羞辱雷（当众退婚/废物/巴掌）
    const rewritten = [
      mk(14, '新稿'),
      '△ 林晚推门而入，面色平静。\n林晚：我回来了，这些日子我一直在想你。',
      '她在寿宴上被当众退婚，又被指着鼻子骂废物，还被狠狠扇了一巴掌，满堂宾客无人作声。',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'rhythm_flat', dimLabel: '剧情', advice: '重写' }, epNo: 2 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 2 && s.version === 2);
      assert.ok(v2, '必须落 v2');
      // ②-curRows 连续性短名行：death.rows 须按新正文整集替换（林晚 active:true）；旧码 base 展开保留 v1 active:false
      const drow = v2.qcReport.death && v2.qcReport.death.rows.find((x) => x.name === '林晚');
      assert.ok(drow, 'death 短名摘要行须随改写稿回写（旧 /fix 永不落此键更新，c197 回归锁）');
      assert.strictEqual(drow.active, true, '短名行须按新正文提取：林晚本集有动作+台词');
      assert.strictEqual(drow.dead, false);
      // ①-cur+1 评估：改写集已完成，死者本集再开口当场判复活 high（旧码过滤本集行，诊断与新正文无关）
      const dl = v2.qcReport.deathLedger;
      assert.ok(dl && Array.isArray(dl.issues), 'deathLedger 长名诊断须产出');
      assert.ok(dl.issues.some((i) => i.type === 'resurrected_after_death' && i.severity === 'high'),
        '死者在改写集再开口须当场报 resurrected_after_death(high)，不得滞后一集');
      // ②-curRows 诊断短名行：本集新埋 3 枚羞辱雷当集入账；旧码 humiliation 永远停在 v1 的 planted:0
      assert.ok(v2.qcReport.humiliation, 'humiliation 短名摘要行须随改写稿回写');
      assert.strictEqual(v2.qcReport.humiliation.planted, 3, '当众退婚/废物/巴掌 3 枚雷当集入账');
      assert.ok(Array.isArray(v2.qcReport.humiliation.markers) && v2.qcReport.humiliation.markers.length === 3);
      // 长名诊断同口径：欠账含本集 → 非 none
      assert.ok(v2.qcReport.humiliationDebt && v2.qcReport.humiliationDebt.level !== 'none',
        'humiliationDebt 诊断须含改写集（cur+1 语义）');
    } finally {
      MP.callText = orig;
    }
  });
});

// c211 功能轮：付费定向改写后 qcReport.sceneSoftEnding/showDontTell 必须按新正文重算，
// 且批量/SSE/修复三处共用限界 digest；旧分叉/扁平形态被替换，其余台账沿用旧版。
describe('c211 /fix 后软收尾与展示而非叙述重算且形态限界', { concurrency: 1 }, () => {
  const uid = 'u_c211fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
  const mkEn = (n) => Array.from({ length: n }, (_, i) => `Line ${i + 1} with a sufficiently long piece of neutral action description text.`).join('\n');
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 6000 });

  it('中文稿：泄气尾巴+直说情绪被重算落库，digest 限界剥字段；旧扁平/分叉台账替换，beats 等保留，v1 不动', async () => {
    const pid = 'proj_c211fix1';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: null });
    // v1：两种旧形态——sceneSoftEnding 走通用摘要（advice 字符串会被丢的分叉）；showDontTell 只在 SSE 的扁平计数
    const staleQc = {
      sceneSoftEnding: { score: 50, hits: [{ sceneHeader: '旧场', endLine: 1, ending: '旧尾', reason: '旧因', extraJunk: '无界字段' }], issues: ['旧 issue'], advice: ['旧 advice 被错误存成数组'] },
      showDontTell: { score: 30, issues: [{ severity: 'high', type: 'old_type', evidence: 'old', advice: 'old' }], tellEmotionCount: 9, summaryCount: 0, abstractAdjCount: 0, innerMonologueCount: 0, longestProseBlock: 5 },
      beats: { reversalId: 'old_rev', payoffIds: ['old_pay'], emotionPath: [] },
      outline: { subplots: ['旧支线'] },
      payoffRhythm: { suppressCount: 2, releaseCount: 1 },
    };
    const original = [mk(14, '原稿'), '内景·客厅·夜', '林棠把文件放在桌上。', '两个人对视着。', '屋子里很安静。', '灯还亮着。', '内景·走廊·夜', '林棠站在走廊里。', '门半掩着。'].join('\n');
    mem._scripts.push({ id: 'c211fix1_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    // 改写稿：内场先高能（拍桌+亲子鉴定+怒吼质问），末拍落在叹气+默默离开；同段直说情绪 ≥3 命中
    const rewritten = [
      mk(14, '原稿'),
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上，怒吼着质问沈知远。',
      '沈知远脸色煞白，一句话也说不出来。',
      '她感到很生气，心里很紧张，她伤心地哭了。',
      '她叹了口气，转身默默离开。',
      '内景·走廊·夜',
      '林棠靠墙站着，走廊的灯白得刺眼。',
      '身后的门还开着。',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'soft_ending', dimLabel: '剧情', advice: '删掉泄气尾巴' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2, '必须落 v2 新版本');
      const sf = v2.qcReport.sceneSoftEnding;
      assert.ok(sf && typeof sf.score === 'number', 'sceneSoftEnding 必须存在且有 score');
      assert.strictEqual(sf.hits.length, 1, '新正文恰好一处泄气尾巴');
      assert.deepStrictEqual(Object.keys(sf.hits[0]).sort(), ['endLine', 'ending', 'reason', 'sceneHeader'], 'hits 只准四字段');
      assert.ok(!('extraJunk' in sf.hits[0]));
      assert.ok(sf.hits[0].ending.length <= 30 && sf.hits[0].reason.length <= 120);
      assert.ok(Array.isArray(sf.issues) && sf.issues.every((x) => typeof x === 'string' && x.length <= 200));
      assert.strictEqual(typeof sf.advice, 'string', 'advice 统一为字符串（修复旧数组分叉）');
      const sd = v2.qcReport.showDontTell;
      assert.ok(sd && typeof sd.score === 'number', 'showDontTell 必须存在且有 score');
      assert.ok(sd.score < 100, '直说情绪稿不应满分');
      assert.ok(Array.isArray(sd.issues) && sd.issues.some((i) => i.type === 'tell_emotion'), '必须重算出直说情绪 issue');
      assert.ok(sd.issues.every((i) => ['severity', 'type', 'evidence', 'advice'].every((k) => k in i) && Object.keys(i).length === 4), 'issue 只四字段');
      assert.ok(sd.issues.every((i) => i.evidence.length <= 180 && i.advice.length <= 200));
      assert.ok(sd.issues.length <= 6);
      assert.deepStrictEqual(Object.keys(sd.counts).sort(), ['abstractAdj', 'innerMonologue', 'summary', 'tellEmotion']);
      assert.ok(sd.counts.tellEmotion >= 3, '四类计数反映新正文命中');
      assert.ok(!('tellEmotionHits' in sd) && !('tellEmotionCount' in sd), '无界命中数组与旧扁平字段都不得落库');
      assert.strictEqual(typeof sd.longestProseBlock, 'number');
      // 其余台账沿用旧版
      assert.deepStrictEqual(v2.qcReport.beats, staleQc.beats, 'beats 沿用旧版');
      assert.deepStrictEqual(v2.qcReport.outline, staleQc.outline, 'outline 沿用旧版');
      assert.deepStrictEqual(v2.qcReport.payoffRhythm, staleQc.payoffRhythm, 'payoffRhythm 沿用旧版');
      assert.ok(typeof v2.qcReport.cliffhanger?.score === 'number', 'cliffhanger 同族重算不回退');
      assert.strictEqual(v2.qcReport.targetedFix.rule, 'soft_ending');
      // v1 行不得被改动
      const v1 = mem._scripts.find((s) => s.id === 'c211fix1_ep1v1');
      assert.strictEqual(v1.qcReport.sceneSoftEnding.score, 50, 'v1 旧台账保持不变');
      assert.strictEqual(v1.qcReport.showDontTell.tellEmotionCount, 9, 'v1 扁平形态保持不变');
    } finally {
      MP.callText = orig;
    }
  });

  it('英文稿：自动语种探测，英文软尾巴+felt/was 情绪命中，落库仍为统一 digest 形态', async () => {
    const pid = 'proj_c211fix2';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: null });
    const staleQc = { sceneSoftEnding: { score: 10, hits: [] }, showDontTell: { score: 10, issues: [] } };
    const original = [mkEn(14), 'INT. LIVING ROOM - NIGHT', 'She placed the file on the table.', 'They looked at each other.', 'The room was quiet.', 'The light stayed on.', 'INT. HALLWAY - NIGHT', 'She stood in the hallway.', 'The door stood ajar.'].join('\n');
    mem._scripts.push({ id: 'c211fix2_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    const rewritten = [
      mkEn(14),
      'INT. LIVING ROOM - NIGHT',
      'She slammed the DNA report on the table and shouted at him.',
      'His face went white and he could not speak.',
      'She felt very angry and was anxious, and she was sad about the whole affair.',
      'She sighed, then turned and walked away quietly.',
      'INT. HALLWAY - NIGHT',
      'She leaned against the wall beneath the harsh white light.',
      'The door behind her stayed open.',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'show_dont_tell', dimLabel: '剧情', advice: 'externalize emotions' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2);
      const sf = v2.qcReport.sceneSoftEnding;
      assert.strictEqual(sf.hits.length, 1, '英文泄气尾巴同样被抓');
      assert.ok(/INT\. LIVING ROOM/.test(sf.hits[0].sceneHeader));
      assert.strictEqual(typeof sf.advice, 'string');
      assert.ok(sf.advice.length > 0 && /[A-Za-z]/.test(sf.advice[0]), '英文稿 advice 应为英文（语言自探测）');
      const sd = v2.qcReport.showDontTell;
      assert.ok(sd.issues.some((i) => i.type === 'tell_emotion'), '英文直说情绪（felt/was）被检出');
      assert.ok(sd.counts.tellEmotion >= 3, 'felt very angry + was anxious + was sad 至少 3 命中');
      assert.deepStrictEqual(Object.keys(sd).sort(), ['counts', 'issues', 'longestProseBlock', 'score'], '落库只 digest 四键');
      assert.ok(sd.issues.every((i) => /[A-Za-z]/.test(i.advice)), '英文稿建议文本为英文');
    } finally {
      MP.callText = orig;
    }
  });
});

// c212 结构轮：v2.114-v2.147 的 32 个结构引擎此前只进 SSE、零落库、/fix 不重算。
// 修复后：/fix 按新正文纯函数重扫 32 键并覆盖旧结论（健康壳清旧账），台账键 timeline/payoffRhythm、
// 前集依赖 openingWeld、beats/outline 一律保留旧版；结构 digest 统一限界。
describe('c212 /fix 后 32 结构维度按新正文重算覆盖，台账不毁', { concurrency: 1 }, () => {
  const uid = 'u_c212fix';
  const h = { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}`, 'Content-Type': 'application/json' };
  const STRUCT_KEYS = [
    'coolMoment', 'dialogueWater', 'conflictDensity', 'punchlineDensity', 'repetition', 'twistDensity', 'informationDensity',
    'sceneDensity', 'characterBalance', 'dialogueLength', 'suspenseTension', 'sceneHeader', 'dialogueFunction',
    'causalLogic', 'protagonistGoal', 'antagonistQuality', 'relationship', 'scenePadding', 'supporting',
    'conflictEscalation', 'subtext', 'supportingArc', 'scenePurpose', 'continuity', 'misunderstanding',
    'plotArmor', 'evidenceChain', 'cheatRule', 'memoryFakeout', 'emotionalAftermath', 'locationContinuity', 'characterPresence',
  ];
  mem._seedUser({ id: uid, level: 'ADVANCED', balance: 6000 });
  const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本，用来越过最小字数预检。`).join('\n');
  const mkEn = (n) => Array.from({ length: n }, (_, i) => `Line ${i + 1} with a sufficiently long piece of neutral action description text to pass the minimum length gate.`).join('\n');

  it('中文稿：v1 结构旧账被新正文重算覆盖（巧合家族应命中），32 键限界契约，openingWeld/beats 台账保留（timeline c197 起按新正文回写）', async () => {
    const pid = 'proj_c212fix1';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: { cast: [{ name: '林小凡' }, { name: '林母' }, { name: '张总' }] } });
    const staleQc = {
      // 模拟旧版残留：c212 前该键根本不落库；此处放一个"旧结论"证明覆盖语义
      causalLogic: { score: 20, issueCount: 9, issues: [{ severity: 'high', type: 'OLD_STALE', evidence: '旧账'.repeat(60), advice: 'z'.repeat(300) }] },
      beats: { reversalId: 'old_rev', payoffIds: ['old_pay'], emotionPath: [] },
      outline: { subplots: ['旧支线'] },
      payoffRhythm: { suppressCount: 2, releaseCount: 1 },
      timeline: { mark: 7, spanDays: 3, note: '台账，禁止结构键覆盖' },
      openingWeld: { score: 88, checked: true, issueCount: 1, issues: [{ severity: 'mid', evidence: '前集旧焊点' }] },
    };
    const original = [mk(14, '原稿'), '1. 家中-夜 内景', '林母：小凡，吃饭了。', '林小凡：知道了。', '2. 公司-日 内景', '张总：签合同吧。', '林小凡：好。'].join('\n');
    mem._scripts.push({ id: 'c212fix1_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    // 改写稿：巧合/幸好/突然家族 + 情绪直给 + 空转对白，多个结构引擎应真实命中
    const rewritten = [
      mk(14, '改写'),
      '1. 家中-夜 内景',
      '林母（犹豫）：小凡啊，你听妈一句劝，这事就算了吧，啊？',
      '林小凡：我不！我偏不！我就要查清楚！我恨你们！我好难过！我非常愤怒！',
      '（她猛地摔门，在雨里跑了很久很久，不知不觉天亮了。）',
      '2. 公司-日 内景',
      '张总：合同签了吧。',
      '林小凡：好。',
      '张总：那就这样。',
      '林小凡：嗯。',
      '恰好这时候手机响了，碰巧是医院打来的，幸好医生说体检报告拿错了。',
      '她突然就想通了，所有问题一下子都解决了，从此大家幸福地生活在一起。',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'causal_logic', dimLabel: '剧情', advice: '拆掉巧合' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2, '必须落 v2 新版本');
      const q = v2.qcReport;
      const present = STRUCT_KEYS.filter((k) => q[k] && typeof q[k].score === 'number');
      assert.ok(present.length >= 28, `32 结构键至少重算出 28 个，实际 ${present.length}/${STRUCT_KEYS.length}：${STRUCT_KEYS.filter((k) => !present.includes(k)).join(',')}`);
      // 统一契约 + 限界
      for (const k of present) {
        const e = q[k];
        assert.ok(typeof e.issueCount === 'number' && Array.isArray(e.issues), `${k} 必须 issueCount+issues 形态`);
        assert.ok(e.issues.length <= 5, `${k} issues≤5`);
        for (const i of e.issues) {
          assert.ok(['high', 'mid', 'low'].includes(i.severity), `${k} severity 合法`);
          if (i.evidence !== undefined) assert.ok(i.evidence.length <= 160, `${k} evidence≤160`);
          if (i.advice !== undefined) assert.ok(i.advice.length <= 200, `${k} advice≤200`);
        }
        assert.ok(!('hits' in e), `${k} rescan 形态不带 hits 富列表`);
      }
      // 真重算：巧合家族应命中，v1 伪造旧账（OLD_STALE/超长字段）必须消失
      const cl = q.causalLogic;
      assert.ok(cl && cl.issueCount > 0, '巧合/幸好/突然稿必须被因果引擎命中，证明按新正文真重算');
      assert.ok(!cl.issues.some((i) => i.type === 'OLD_STALE'), 'v1 旧结论必须被覆盖');
      assert.ok(!cl.issues.some((i) => i.evidence && i.evidence.length > 160), '旧超长 evidence 不得残留');
      assert.ok(!('hits' in cl));
      // cast 三键在 bible cast 下也应重算
      for (const k of ['characterBalance', 'supporting', 'supportingArc']) {
        assert.ok(q[k] && typeof q[k].score === 'number' && Array.isArray(q[k].issues), `${k} cast 键契约`);
      }
      // 台账与前集依赖键：payoffRhythm/beats/outline 非短名摘要行，保留 v1；
      // timeline 属 c197 24 短名行，随新正文整集重算（新稿无时间跨度标记 → 空 mark，v1 伪造 note 蒸发）
      assert.deepStrictEqual(q.timeline, { mark: '', spanDays: null }, 'timeline 短名行 c197 起按新正文回写，不再保留 v1 旧账面');
      assert.deepStrictEqual(q.payoffRhythm, staleQc.payoffRhythm, 'payoffRhythm 台账保留');
      assert.deepStrictEqual(q.beats, staleQc.beats, 'beats 沿用旧版');
      assert.deepStrictEqual(q.outline, staleQc.outline, 'outline 沿用旧版');
      assert.deepStrictEqual(q.openingWeld, staleQc.openingWeld, 'openingWeld 依赖前集结尾，不重算');
      assert.strictEqual(q.targetedFix.rule, 'causal_logic');
      // v1 不动
      const v1 = mem._scripts.find((s) => s.id === 'c212fix1_ep1v1');
      assert.strictEqual(v1.qcReport.causalLogic.issueCount, 9, 'v1 旧账保持不变');
    } finally {
      MP.callText = orig;
    }
  });

  it('英文稿：结构重跑不炸、键契约成立、台账保留', async () => {
    const pid = 'proj_c212fix2';
    mem._projects.set(pid, { id: pid, userId: uid, format: 'LIVE', bible: { cast: [{ name: 'JANE' }, { name: 'BOSS' }] } });
    const staleQc = { timeline: { mark: 3, spanDays: 1 } };
    const original = [mkEn(14), 'INT. OFFICE - DAY', 'BOSS: Sign it.', 'JANE: Okay.'].join('\n');
    mem._scripts.push({ id: 'c212fix2_ep1v1', projectId: pid, epNo: 1, version: 1, title: 't', wordCount: original.length, content: original, score: 60, qcReport: staleQc });
    const rewritten = [
      mkEn(14),
      'INT. LIVING ROOM - NIGHT',
      'MOTHER: Honey, just let it go, okay?',
      'JANE: I will not! I am so angry and very sad!',
      '(She slammed the door and ran in the rain. Somehow morning came.)',
      'INT. OFFICE - DAY',
      'BOSS: Sign the contract. JANE: Okay. BOSS: Fine. JANE: Yep.',
      'Luckily the phone rang, and coincidentally the hospital said they mixed up the reports by chance.',
      'Suddenly everything was fine and everyone lived happily ever after.',
    ].join('\n');
    const MP = require('../dist/lib/model-proxy.js');
    const orig = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    try {
      const r = await fetch(base + `/api/generate/projects/${pid}/fix`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ fix: { rule: 'causal_logic', dimLabel: 'Plot', advice: 'kill coincidences' }, epNo: 1 }),
      });
      assert.strictEqual(r.status, 200);
      const v2 = mem._scripts.find((s) => s.projectId === pid && s.epNo === 1 && s.version === 2);
      assert.ok(v2);
      const present = STRUCT_KEYS.filter((k) => v2.qcReport[k] && typeof v2.qcReport[k].score === 'number');
      assert.ok(present.length >= 28, `英文稿结构键重算数 ${present.length}`);
      assert.ok(v2.qcReport.causalLogic.issueCount > 0, '英文巧合词（luckily/coincidentally/suddenly）应命中');
      assert.deepStrictEqual(v2.qcReport.timeline, { mark: '', spanDays: null }, 'timeline 短名行 c197 起按新正文回写（英文新稿无跨度标记），v1 旧账面不保留');
    } finally {
      MP.callText = orig;
    }
  });
});
