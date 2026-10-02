const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
process.env.JWT_ACCESS_SECRET = 'pf-secret';
process.env.JWT_REFRESH_SECRET = 'pf-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { boardStore } = require('../dist/services/board-store.js');
const { toEngineUserProfile, ageBandToAge } = require('../dist/lib/profile-mapping.js');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem), generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { boardStore.clear(); server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'u1', level: 'ADVANCED' });
const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'ADVANCED' })}` });
const patch = (b) => fetch(base + '/api/auth/profile', { method: 'PATCH', headers: H(), body: JSON.stringify(b) });
const me = () => fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${signAccess({ sub: 'u1', level: 'ADVANCED' })}` } });
const sd = (b) => fetch(base + '/api/generate/smart-defaults', { method: 'POST', headers: H(), body: JSON.stringify(b) });

describe('v2.71 显式画像字段与个性化总开关', { concurrency: 1 }, () => {
  it('年龄段→代表年龄映射（确定性）', () => {
    assert.strictEqual(ageBandToAge('18-24'), 21);
    assert.strictEqual(ageBandToAge('over50'), 55);
    assert.strictEqual(ageBandToAge(undefined), undefined);
  });

  it('toEngineUserProfile：personalized=false 时不回传任何画像', () => {
    const on = toEngineUserProfile({ bio: '辽宁女生', region: '辽宁', ageBand: '18-24', gender: '女', personalized: true });
    assert.strictEqual(on.region, '辽宁'); assert.strictEqual(on.age, 21); assert.strictEqual(on.gender, '女');
    const off = toEngineUserProfile({ bio: '辽宁女生', region: '辽宁', ageBand: '18-24', gender: '女', personalized: false });
    assert.deepStrictEqual(off, {});
    assert.strictEqual(toEngineUserProfile({ region: '保密', gender: '保密', personalized: true }).gender, undefined);
  });

  it('PATCH 合法画像写入并在 /me 回显，默认 personalized=true', async () => {
    const r = await patch({ region: '辽宁', ageBand: '18-24', gender: '女' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.region, '辽宁'); assert.strictEqual(j.ageBand, '18-24'); assert.strictEqual(j.gender, '女');
    assert.strictEqual(j.personalized, true);
    const m = await (await me()).json();
    assert.strictEqual(m.region, '辽宁'); assert.strictEqual(m.personalized, true);
  });

  it('非法枚举 400（地区/年龄段/性别白名单）', async () => {
    assert.strictEqual((await patch({ region: '火星' })).status, 400);
    assert.strictEqual((await patch({ ageBand: '999' })).status, 400);
    assert.strictEqual((await patch({ gender: '外星人' })).status, 400);
  });

  it('v2.303 avatarUrl 协议白名单：javascript:/data: 等危险协议 400，http(s)/站内相对/空串放行', async () => {
    // 危险协议：伪 URL 入库后任何消费端 href 渲染即 XSS（纵深防御，入库前拒绝）
    assert.strictEqual((await patch({ avatarUrl: 'javascript:alert(1)' })).status, 400, 'javascript: 必须拒绝');
    assert.strictEqual((await patch({ avatarUrl: '  JavaScript:alert(1)' })).status, 400, '大小写/前导空白混淆必须拒绝');
    assert.strictEqual((await patch({ avatarUrl: 'data:text/html,<script>alert(1)</script>' })).status, 400, 'data:text/html 必须拒绝');
    assert.strictEqual((await patch({ avatarUrl: 'vbscript:msgbox(1)' })).status, 400, 'vbscript: 必须拒绝');
    // 合法形态
    assert.strictEqual((await patch({ avatarUrl: 'https://cdn.example.com/a.png' })).status, 200, 'https 放行');
    assert.strictEqual((await patch({ avatarUrl: 'http://example.com/a.png' })).status, 200, 'http 放行');
    assert.strictEqual((await patch({ avatarUrl: '/api/files/avatar/u1.png' })).status, 200, '站内相对路径放行（头像上传位）');
    const cleared = await patch({ avatarUrl: '' });
    assert.strictEqual(cleared.status, 200, '空串清空放行');
    const j = await cleared.json();
    assert.strictEqual(j.avatarUrl, null, '空串语义为清空头像');
  });

  it('v2.304 nickname HTML 元字符拒绝：跨用户透出身份字段入库前阻断（对齐 v2.303 原则）', async () => {
    // nickname 经 community 帖子/市场列表/榜单/后台多点透出，当前仅靠渲染侧 escapeHtml 兜底，
    // 且 web 端 6+ 份独立 esc 实现已漂移（teardown-view 缺 '）——入库侧拒绝 HTML 元字符，
    // 不依赖每个渲染点转义。合法昵称（中文/emoji/·）不受影响。
    assert.strictEqual((await patch({ nickname: '<img src=x onerror=alert(1)>' })).status, 400, '<> 必须拒绝');
    assert.strictEqual((await patch({ nickname: '"><script>alert(1)</script>' })).status, 400, '"> 必须拒绝');
    assert.strictEqual((await patch({ nickname: "O'Brien" })).status, 400, "单引号必须拒绝（属性注入面）");
    assert.strictEqual((await patch({ nickname: 'a"b' })).status, 400, '双引号必须拒绝');
    assert.strictEqual((await patch({ nickname: 'a&b' })).status, 400, '& 必须拒绝');
    // 合法形态：中文/emoji/· 全部放行
    assert.strictEqual((await patch({ nickname: '编剧小李🎬' })).status, 200, 'emoji 昵称放行');
    assert.strictEqual((await patch({ nickname: '终南·张三' })).status, 200, '中文+间隔号放行');
  });

  it('显式地域+性别画像 → 智能默认小南播报地域取向（地域走话术，性别/年龄走受众）', async () => {
    boardStore.clear();
    const r = await sd({ tags: ['逆袭'], lang: 'zh' });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    const joined = j.defaults.linesZh.join('');
    assert.ok(/东北|辽宁/.test(joined), '小南应播报东北/辽宁地域：' + joined);
  });

  it('关闭个性化 → 不再有 profile 取向与地域话术（时令/榜单照常）', async () => {
    await patch({ personalized: false });
    const j = await (await sd({ tags: ['逆袭'], lang: 'zh' })).json();
    assert.strictEqual(j.defaults.sourceCounts.profile, 0);
    assert.ok(!/东北|辽宁/.test(j.defaults.linesZh.join('')));
    // 重新打开，避免污染后续
    await patch({ personalized: true });
  });
});
