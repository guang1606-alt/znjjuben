const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'as-test-secret';
process.env.JWT_REFRESH_SECRET = 'as-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminSafetyRouter } = require('../dist/routes/admin-safety.js');
const { createCommunityRouter } = require('../dist/routes/community.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 同一个内存库：后台改规则 → 社区发帖立即按新规则判定，验证“全局唯一事实源”
const mem = createMemoryPrisma();
const app = createApp({ adminSafety: createAdminSafetyRouter(mem), community: createCommunityRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'adm', level: 'PRO', isAdmin: true });
mem._seedUser({ id: 'norm', level: 'BASIC' });
const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const jget = async (p, uid, lv) => { const r = await fetch(base + p, { headers: H(uid, lv) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const jpost = async (p, uid, lv, body, method = 'POST') => { const r = await fetch(base + p, { method, headers: H(uid, lv), body: JSON.stringify(body || {}) }); return { s: r.status, j: await r.json().catch(() => null) }; };
async function postBody(uid, title, body) {
  const r = await fetch(base + '/api/community/posts', { method: 'POST', headers: H(uid, 'BASIC'), body: JSON.stringify({ section: 'experience', title, body }) });
  return r.status;
}

describe('超管合规规则库管理（串行）', { concurrency: 1 }, () => {
  it('未登录 401 / 普通用户 403', async () => {
    assert.strictEqual((await jget('/api/admin/safety/rules')).s, 401);
    assert.strictEqual((await jget('/api/admin/safety/rules', 'norm', 'BASIC')).s, 403);
  });

  it('超管初始列表：默认规则齐全、计数正确、全部 builtin', async () => {
    const { s, j } = await jget('/api/admin/safety/rules', 'adm', 'PRO');
    assert.strictEqual(s, 200);
    assert.ok(j.rules.length >= 15);
    assert.strictEqual(j.counts.custom, 0);
    assert.ok(j.counts.block >= 1 && j.counts.warn >= 1);
    assert.ok(j.rules.every((r) => r.builtin === true && r.active === true));
  });

  it('新增自定义规则校验：空命中词/单字词 400', async () => {
    assert.strictEqual((await jpost('/api/admin/safety/rules', 'adm', 'PRO', { severity: 'BLOCK', label: '空', patterns: [] })).s, 400);
    assert.strictEqual((await jpost('/api/admin/safety/rules', 'adm', 'PRO', { severity: 'BLOCK', label: '单字', patterns: ['x'] })).s, 400);
    assert.strictEqual((await jpost('/api/admin/safety/rules', 'adm', 'PRO', { severity: 'BAD', label: '级别错', patterns: ['测试词'] })).s, 400);
  });

  it('新增自定义 BLOCK 词 → 社区发帖立即被拦（全局生效）', async () => {
    // 新增前：含“火星暗语测试词”的帖子正常（该词不在默认库）
    assert.strictEqual(await postBody('norm', '普通帖', '一段完全正常的交流内容'), 200);
    const { s, j } = await jpost('/api/admin/safety/rules', 'adm', 'PRO',
      { severity: 'BLOCK', category: '测试类', label: '暗语', patterns: ['火星暗语测试词', '第二个暗语'], advice: '测试拦截建议' });
    assert.strictEqual(s, 200);
    assert.ok(j.rule.id.startsWith('c_'));
    // 新增后：含自定义词的帖子 422
    assert.strictEqual(await postBody('norm', '违规帖', '这里出现火星暗语测试词'), 422);
  });

  it('停用默认规则 → 该规则不再拦截；重新启用恢复', async () => {
    // 默认 B05 含“赌博技巧”，正常应拦
    assert.strictEqual(await postBody('norm', 't1', '教学赌博技巧内容'), 422);
    // 停用 B05-crime-tutorial
    const off = await jpost('/api/admin/safety/rules/B05-crime-tutorial/toggle', 'adm', 'PRO', { active: false });
    assert.strictEqual(off.s, 200);
    assert.strictEqual(await postBody('norm', 't2', '教学赌博技巧内容'), 200);
    // 重新启用
    const on = await jpost('/api/admin/safety/rules/B05-crime-tutorial/toggle', 'adm', 'PRO', { active: true });
    assert.strictEqual(on.s, 200);
    assert.strictEqual(await postBody('norm', 't3', '教学赌博技巧内容'), 422);
  });

  it('内置规则不可删除(400)，自定义规则可删除，停用不存在规则 404', async () => {
    assert.strictEqual((await jpost('/api/admin/safety/rules/B01-state-security', 'adm', 'PRO', {}, 'DELETE')).s, 400);
    assert.strictEqual((await jpost('/api/admin/safety/rules/not-exist/toggle', 'adm', 'PRO', { active: false })).s, 404);
    // 找到刚建的自定义规则并删除
    const { j } = await jget('/api/admin/safety/rules', 'adm', 'PRO');
    const custom = j.rules.find((r) => !r.builtin && r.patterns.includes('火星暗语测试词'));
    assert.ok(custom);
    assert.strictEqual((await jpost('/api/admin/safety/rules/' + custom.id, 'adm', 'PRO', {}, 'DELETE')).s, 200);
    // 删除后该词不再拦
    assert.strictEqual(await postBody('norm', 't4', '这里出现火星暗语测试词'), 200);
  });

  it('一键恢复默认：自定义清空、停用清空', async () => {
    await jpost('/api/admin/safety/rules', 'adm', 'PRO', { severity: 'WARN', label: '临时', patterns: ['临时词abc'] });
    const r = await jpost('/api/admin/safety/reset', 'adm', 'PRO', {});
    assert.strictEqual(r.s, 200);
    const { j } = await jget('/api/admin/safety/rules', 'adm', 'PRO');
    assert.strictEqual(j.counts.custom, 0);
    assert.strictEqual(j.counts.disabled, 0);
    assert.ok(j.rules.every((x) => x.active));
  });
});
