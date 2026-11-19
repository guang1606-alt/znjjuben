/**
 * v2.552 作品库列表瘦身 + 按需详情端点
 *
 * 缺口（修复前实证）：GET /api/generate/projects 直接 res.json(list) 返回整行，
 * 每条都带完整 bible——adapt / novel 项目的 bible.sourceText 原文上限 50000 字，
 * 而作品库每次进入、每次搜索（输入框 250ms 防抖）都会整包拉一遍。
 * 原文越长、项目越多，列表越慢，移动端首屏与搜索都会被拖垮。
 *
 * 但列表真正用到的只有：id/title/mode/format/engineTier/totalEps/status/createdAt
 * + bible.platform（作品卡平台徽章）+ 「继续创作」的可用性判断。
 * 原文与改编大纲只在用户点「继续创作」时才需要。
 *
 * 修复：列表返回渲染摘要（platform/hasSource/hasAdaptDraft）；
 * 新增 GET /api/generate/projects/:id 按需取完整项目（仅本人、已删不可见）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
process.env.JWT_ACCESS_SECRET = 'project-list-slim-secret';
process.env.JWT_REFRESH_SECRET = 'project-list-slim-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

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

const auth = (uid, level = 'FREE') => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
// 24000 字原文：单条就远超一份合理列表的体量，列表若整包返回必然被体积断言抓住
const BIG_TEXT = '原创小说原文段落，用于改编版权闸门与列表体积回归。'.repeat(1000);

function seedProject(id, userId, bible, extra = {}) {
  mem._projects.set(id, {
    id, userId, title: `项目-${id}`, mode: 'adapt', format: 'LIVE_ACTION',
    engineTier: 'STANDARD', totalEps: 20, status: 'active', tags: ['逆袭'],
    createdAt: new Date('2026-11-18T10:00:00Z'), updatedAt: new Date('2026-11-18T10:00:00Z'),
    bible, ...extra,
  });
  return id;
}

describe('v2.552 作品库列表瘦身', { concurrency: 1 }, () => {
  mem._seedUser({ id: 'u_slim', level: 'ADVANCED', balance: 0 });
  mem._seedUser({ id: 'u_other', level: 'ADVANCED', balance: 0 });

  it('列表不再整包返回 bible，改为 platform/hasSource/hasAdaptDraft 摘要', async () => {
    const pid = seedProject('p_slim', 'u_slim', { sourceText: BIG_TEXT, platform: 'hongguo', adaptationDraft: { brief: '改编大纲' } });
    const r = await fetch(base + '/api/generate/projects', { headers: auth('u_slim', 'ADVANCED') });
    assert.strictEqual(r.status, 200);
    const list = await r.json();
    assert.ok(Array.isArray(list), '列表契约保持数组');
    const it = list.find((x) => x.id === pid);
    assert.ok(it, '应能取回自己的项目');
    assert.strictEqual(it.bible, undefined, '列表不得整包返回 bible（原文/大纲走详情端点）');
    assert.strictEqual(it.sourceText, undefined, '列表不得把原文摊到顶层');
    assert.strictEqual(it.platform, 'hongguo', '作品卡平台徽章需要 platform 摘要');
    assert.strictEqual(it.hasSource, true, '有原文的项目要能判断「可继续创作」');
    assert.strictEqual(it.hasAdaptDraft, true, '有改编大纲的项目要能判断「可继续创作」');
    assert.strictEqual(it.title, '项目-p_slim', '标题仍需返回');
    assert.strictEqual(it.totalEps, 20);
    assert.ok(!Number.isNaN(new Date(it.createdAt).getTime()));
    assert.ok(JSON.stringify(list).length < 2000,
      '列表体积不得随原文膨胀（当前 ' + JSON.stringify(list).length + ' 字节，原文 ' + BIG_TEXT.length + ' 字）');
  });

  it('无 bible 的项目摘要兜底为空/假，不抛错', async () => {
    const pid = seedProject('p_plain', 'u_slim', null);
    const r = await fetch(base + '/api/generate/projects', { headers: auth('u_slim', 'ADVANCED') });
    const it = (await r.json()).find((x) => x.id === pid);
    assert.ok(it);
    assert.strictEqual(it.platform, '');
    assert.strictEqual(it.hasSource, false);
    assert.strictEqual(it.hasAdaptDraft, false);
  });

  it('新增 GET /projects/:id：本人可取完整项目（含原文），他人与已删一律 404', async () => {
    const pid = seedProject('p_detail', 'u_slim', { sourceText: BIG_TEXT, platform: 'reelshort' });
    const mine = await fetch(base + '/api/generate/projects/' + pid, { headers: auth('u_slim', 'ADVANCED') });
    assert.strictEqual(mine.status, 200);
    const full = await mine.json();
    assert.strictEqual(full.id, pid);
    assert.strictEqual(full.bible.sourceText, BIG_TEXT, '详情端点必须返回原文（续写回填依赖）');
    assert.strictEqual(full.bible.platform, 'reelshort');

    const other = await fetch(base + '/api/generate/projects/' + pid, { headers: auth('u_other', 'ADVANCED') });
    assert.strictEqual(other.status, 404, '他人项目按不存在处理');

    mem._projects.get(pid).status = 'deleted';
    const gone = await fetch(base + '/api/generate/projects/' + pid, { headers: auth('u_slim', 'ADVANCED') });
    assert.strictEqual(gone.status, 404, '已软删除项目不可读');

    const missing = await fetch(base + '/api/generate/projects/no_such_id', { headers: auth('u_slim', 'ADVANCED') });
    assert.strictEqual(missing.status, 404);
  });
});

describe('v2.552 前端按需取详情（静态守卫）', () => {
  const js = read('web/app.js');

  it('后端列表不再直接 res.json(整行列表)', () => {
    const src = read('src/routes/generate.ts');
    assert.ok(!/generateRouter\.get\('\/projects'[\s\S]{0,900}?res\.json\(list\)/.test(src),
      'GET /projects 不得整包回吐 ORM 行（bible 原文会随列表下发）');
  });

  it('作品卡平台徽章兼容瘦身字段', () => {
    assert.ok(js.includes('platformLabel(p.platform || p.bible?.platform)'),
      '作品卡应优先读列表摘要 platform，兼容旧的全量行');
  });

  it('「继续创作」按需拉详情，且 canResume 兼容摘要字段', () => {
    assert.ok(js.includes('p.hasAdaptDraft || p.bible?.adaptationDraft?.brief'), 'canResume 应读摘要 hasAdaptDraft');
    assert.ok(js.includes('p.hasSource === true'), 'canResume 应读摘要 hasSource');
    assert.ok(js.includes('/api/generate/projects/${p.id}'),
      '列表项没有 bible 时应按需请求详情端点后再续写');
  });
});
