/**
 * v2.576 会员「每月赠送集数」周期重置
 * 背景：购买/续费时只把 quotaUsed 清零一次；年卡（12 个月）用户在第一个月用完后，
 * 第 2~12 个月再也没有赠送集——会员页写的「每月赠 N 集」名存实亡。
 * 现改为消费入口惰性重置（无定时任务，多实例安全）：满 30 天清零 quotaUsed 并推进周期起点。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'quota-cycle-secret';
process.env.JWT_REFRESH_SECRET = 'quota-cycle-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { nextQuotaCycleStart, MEMBERSHIP_QUOTA_CYCLE_DAYS } = require('../dist/config/pricing.js');
const { ensureQuotaCycle, quotaRemainOf } = require('../dist/lib/membership-quota.js');

const DAY = 864e5;
const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const token = () => `Bearer ${signAccess({ sub: 'q1', level: 'ADVANCED' })}`;
const me = () => fetch(base + '/api/auth/me', { headers: { Authorization: token() } });

describe('周期推进纯函数', () => {
  it('未满一个周期不重置（含边界前 1 秒）', () => {
    const anchor = new Date('2026-01-01T00:00:00Z');
    assert.strictEqual(nextQuotaCycleStart(anchor, new Date(anchor.getTime() + (MEMBERSHIP_QUOTA_CYCLE_DAYS * DAY) - 1000)), null);
  });

  it('满一个周期对齐到周期边界（不是 now）', () => {
    const anchor = new Date('2026-01-01T00:00:00Z');
    const got = nextQuotaCycleStart(anchor, new Date(anchor.getTime() + 31 * DAY));
    assert.strictEqual(got.getTime(), anchor.getTime() + 30 * DAY);
  });

  it('跨多个周期一次追平到最近边界，避免下次访问又立刻重置', () => {
    const anchor = new Date('2026-01-01T00:00:00Z');
    const got = nextQuotaCycleStart(anchor, new Date(anchor.getTime() + 95 * DAY));
    assert.strictEqual(got.getTime(), anchor.getTime() + 90 * DAY);
  });
});

describe('ensureQuotaCycle：惰性重置与并发防超发', { concurrency: 1 }, () => {
  it('旧数据无 quotaCycleStart 时回退 startedAt；跨周期清零并保留额度总量', async () => {
    const row = await mem.membership.create({
      data: {
        userId: 'legacy', level: 'ADVANCED', expireAt: new Date(Date.now() + 300 * DAY),
        quotaTotal: 300, quotaUsed: 300, startedAt: new Date(Date.now() - 40 * DAY),
      },
    });
    const out = await ensureQuotaCycle(mem, row);
    assert.strictEqual(out.quotaUsed, 0);
    assert.strictEqual(quotaRemainOf(out), 300);
    assert.strictEqual(out.quotaTotal, 300, '重置只清已用，不改额度总量');
    assert.ok(out.quotaCycleStart instanceof Date);
  });

  it('未跨周期不动已用额度', async () => {
    const start = new Date(Date.now() - 5 * DAY);
    const row = await mem.membership.create({
      data: { userId: 'fresh', level: 'PRO', expireAt: new Date(Date.now() + 300 * DAY), quotaTotal: 1000, quotaUsed: 7, quotaCycleStart: start },
    });
    const out = await ensureQuotaCycle(mem, row);
    assert.strictEqual(out.quotaUsed, 7);
    assert.strictEqual(out.quotaCycleStart.getTime(), start.getTime());
  });

  it('并发占用后（quotaUsed 已变）本次不重置，回读最新行——绝不把别的请求刚占的那一集抹掉', async () => {
    const start = new Date(Date.now() - 31 * DAY);
    const row = await mem.membership.create({
      data: { userId: 'race', level: 'ADVANCED', expireAt: new Date(Date.now() + 300 * DAY), quotaTotal: 300, quotaUsed: 300, quotaCycleStart: start },
    });
    const stale = { ...row };
    // 模拟另一请求在读到 stale 之后原子占用了一个赠送集
    mem._memberships.find((m) => m.id === row.id).quotaUsed = 301;
    const out = await ensureQuotaCycle(mem, stale);
    assert.strictEqual(out.quotaUsed, 301, 'CAS 失败必须回读最新值，不得用旧快照覆盖');
    assert.strictEqual(out.quotaCycleStart.getTime(), start.getTime(), '周期起点也不能被旧快照推进');
  });
});

describe('GET /api/auth/me 下发本月剩余并顺带完成重置', { concurrency: 1 }, () => {
  it('年卡会员跨月后 /me 返回满额剩余，且只推进到周期边界', async () => {
    mem._seedUser({ id: 'q1', level: 'ADVANCED' });
    const anchor = new Date(Date.now() - 31 * DAY);
    await mem.membership.create({
      data: { userId: 'q1', level: 'ADVANCED', expireAt: new Date(Date.now() + 300 * DAY), quotaTotal: 300, quotaUsed: 300, quotaCycleStart: anchor },
    });
    const j = await (await me()).json();
    assert.ok(j.quota, '付费有效会员必须下发 quota');
    assert.strictEqual(j.quota.total, 300);
    assert.strictEqual(j.quota.used, 0);
    assert.strictEqual(j.quota.remain, 300);
    const expected = anchor.getTime() + MEMBERSHIP_QUOTA_CYCLE_DAYS * DAY;
    assert.strictEqual(new Date(j.quota.cycleStart).getTime(), expected);
    // 再调一次不应继续推进周期（否则每次访问都重置，等于无限赠送）
    const j2 = await (await me()).json();
    assert.strictEqual(new Date(j2.quota.cycleStart).getTime(), expected);
    assert.strictEqual(j2.quota.remain, 300);
  });

  it('免费用户 quota 为 null（不虚构赠送集）', async () => {
    mem._seedUser({ id: 'q2', level: 'FREE' });
    const r = await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q2', level: 'FREE' })}` } });
    const j = await r.json();
    assert.strictEqual(j.quota, null);
  });

  it('同一用户多档会员并存时，/me 只取当前等级那行（与生成计费同口径）', async () => {
    // 升级不删旧行：BASIC 因续期叠加更晚到期、ADVANCED 更早到期——旧实现会展示 BASIC 的 500 集额度
    mem._seedUser({ id: 'q3', level: 'ADVANCED' });
    await mem.membership.create({
      data: { userId: 'q3', level: 'BASIC', expireAt: new Date(Date.now() + 300 * DAY), quotaTotal: 500, quotaUsed: 0, quotaCycleStart: new Date() },
    });
    await mem.membership.create({
      data: { userId: 'q3', level: 'ADVANCED', expireAt: new Date(Date.now() + 100 * DAY), quotaTotal: 300, quotaUsed: 10, quotaCycleStart: new Date() },
    });
    const r = await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q3', level: 'ADVANCED' })}` } });
    const j = await r.json();
    assert.strictEqual(j.quota.total, 300, '必须取 ADVANCED 行，而不是更晚到期的 BASIC 行');
    assert.strictEqual(j.quota.used, 10);
    assert.strictEqual(j.quota.remain, 290);
  });

  it('免费用户下发今日免费集数（与生成同一口径：已完成 + 在途占坑）', async () => {
    mem._seedUser({ id: 'q5', level: 'FREE' });
    const p = await mem.project.create({ data: { userId: 'q5', title: '免费测试项目' } });
    let j = await (await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q5', level: 'FREE' })}` } })).json();
    assert.deepStrictEqual(j.freeToday, { limit: 2, used: 0, remain: 2 });
    assert.strictEqual(j.quota, null, '免费用户不应有月度赠送集');
    await mem.script.create({ data: { projectId: p.id, content: '第1集' } });
    await mem.generationTask.create({ data: { projectId: p.id, status: 'RUNNING' } });
    j = await (await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q5', level: 'FREE' })}` } })).json();
    assert.strictEqual(j.freeToday.used, 2, '今日已完成 1 集 + 在途 1 集');
    assert.strictEqual(j.freeToday.remain, 0);
    // 失败任务释放占坑，不误伤重试
    mem._tasks.get([...mem._tasks.keys()].pop()).status = 'FAILED';
    j = await (await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q5', level: 'FREE' })}` } })).json();
    assert.strictEqual(j.freeToday.used, 1);
    assert.strictEqual(j.freeToday.remain, 1);
  });

  it('付费会员 freeToday 为 null（不展示免费额度假象）', async () => {
    mem._seedUser({ id: 'q6', level: 'PRO' });
    await mem.membership.create({
      data: { userId: 'q6', level: 'PRO', expireAt: new Date(Date.now() + 100 * DAY), quotaTotal: 1000, quotaUsed: 0, quotaCycleStart: new Date() },
    });
    const j = await (await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'q6', level: 'PRO' })}` } })).json();
    assert.strictEqual(j.freeToday, null);
  });
});
