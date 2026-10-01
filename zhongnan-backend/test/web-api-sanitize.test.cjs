const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// v2.226 错误信息脱敏回落层：jsonOrThrow 对后端内部裸码（INTERNAL_ERROR / SERVER_BUSY / 无 body 5xx）
// 统一回落本地双语友好文案；e.error 保留原码供调用方分支，业务错误码不受影响。
const source = fs.readFileSync(path.join(__dirname, '../web/api.js'), 'utf8');
function environment(lang) {
  const storage = new Map([['zn_lang', lang]]);
  const context = {
    module: { exports: {} }, AbortController, AbortSignal,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };
  vm.runInNewContext(source, context, { filename: 'web/api.js' });
  return { Api: context.module.exports, storage };
}
const res = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body))),
});

describe('jsonOrThrow sanitizes internal server codes into friendly text', () => {
  it('500 INTERNAL_ERROR 回落中文友好文案，e.error 保留原码', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(500, { error: 'INTERNAL_ERROR' })).then(() => null, (x) => x);
    assert.ok(e && typeof e.message === 'string'); // vm 跨 realm，Error 原型不同，不测 instanceof
    assert.match(e.message, /服务开小差|请稍后/);
    assert.equal(e.error, 'INTERNAL_ERROR');
    assert.equal(e.httpStatus, 500);
  });

  it('500 无 body 回落中文友好文案并补 e.error=SERVER_BUSY', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(502)).then(() => null, (x) => x);
    assert.match(e.message, /服务开小差|请稍后/);
    assert.equal(e.error, 'SERVER_BUSY');
  });

  it('英文模式下回落英文友好文案', async () => {
    const { Api } = environment('en');
    const e = await Api.jsonOrThrow(res(503, { error: 'INTERNAL_ERROR' })).then(() => null, (x) => x);
    assert.match(e.message, /server|hiccup|retry/i);
    assert.ok(!/服务开小差/.test(e.message));
  });

  it('业务错误码不受影响：400 RATE_LIMITED 仍透传后端 message', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(400, { error: 'RATE_LIMITED', message: '操作太频繁了' })).then(() => null, (x) => x);
    assert.equal(e.message, '操作太频繁了');
    assert.equal(e.error, 'RATE_LIMITED');
  });

  it('IDEMPOTENT_REPLAY 幂等撞车仍展示后端提示', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(409, { error: 'IDEMPOTENT_REPLAY', message: '请求正在处理中，请勿重复提交' })).then(() => null, (x) => x);
    assert.equal(e.message, '请求正在处理中，请勿重复提交');
  });

  it('非 5xx 无 body 仍保留 HTTP 状态码提示（不误伤 4xx）', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(404)).then(() => null, (x) => x);
    assert.equal(e.message, 'HTTP 404');
  });
});

/* v2.239 消费侧收口：脱敏层漏网八处清零
 * 背景：v2.226 jsonOrThrow 脱敏层上线后，仍有多处消费侧绕过——手动 r.json() 取 error 字段投掷/上屏，
 *  500 时把 INTERNAL_ERROR 裸码糊给用户（违反契约速查「前端遇到 INTERNAL_ERROR 应显示本地友好文案」）。
 * 本轮收口：app.js 三族资产保存 / 反馈导出 / 余额三处 → jsonOrThrow；
 *  startGenerate 两处 body 已消费路径 → znSanitizeErr 就地脱敏；
 *  branch-view postJson → jsonOrThrow（与同文件 getJson 同口径）；
 *  teardown-view raw() 就地 5xx 裸码脱敏（业务码原样保留：REACH_PROJECT_LIMIT 等分支判断依赖）。
 */
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const branchSrc = fs.readFileSync(path.join(__dirname, '../web/branch-view.js'), 'utf8');
const teardownSrc = fs.readFileSync(path.join(__dirname, '../web/teardown-view.js'), 'utf8');
const sliceBetween = (s, a, b) => { const i = s.indexOf(a); const j = i >= 0 ? s.indexOf(b, i) : -1; return i >= 0 && j > i ? s.slice(i, j) : ''; };

describe('v2.239 消费侧收口：绕过脱敏层的裸码路径清零', () => {
  it('三族资产保存不再手动解析 error 字段投掷，统一 jsonOrThrow', () => {
    assert.doesNotMatch(appSrc, /throw new Error\(e\.message \|\| e\.error \|\| t\('(?:cast|prop|scene)LibFail'\)\)/,
      '三族保存不应再手动 e.message||e.error 投掷裸码（500 会裸显 INTERNAL_ERROR）');
    for (const mark of ["/api/generate/character-assets', { method: 'POST'", "/api/generate/prop-assets', { method: 'POST'", "/api/generate/scene-assets', { method: 'POST'"]) {
      const i = appSrc.indexOf(mark);
      assert.ok(i >= 0, `应定位到保存调用 ${mark}`);
      assert.ok(appSrc.slice(i, i + 400).includes('await Api.jsonOrThrow(r);'), `${mark} 后应接 jsonOrThrow 脱敏`);
    }
  });

  it('反馈导出 fbExportBtn 失败走 jsonOrThrow，不再手动拼裸码', () => {
    const region = sliceBetween(appSrc, "$('fbExportBtn').onclick", "$('fbStatus').onchange");
    assert.ok(region, '应定位到 fbExportBtn');
    assert.ok(/Api\.jsonOrThrow\(r\)/.test(region), '失败应走 jsonOrThrow 脱敏层（成功路径保留 blob 下载）');
    assert.doesNotMatch(region, /e\.error \|\| `HTTP \$\{r\.status\}`/, '不应再手动拼 e.error||HTTP 裸码');
  });

  it('admin 余额三处（load/save/refresh）全走 jsonOrThrow', () => {
    assert.doesNotMatch(appSrc, /const e = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\); throw new Error\(e\.error \|\| `HTTP \$\{res\.status\}`\)/,
      'balances 三处不应再手动解析 error 裸码投掷');
    for (const mark of ['async function loadAdmBalances()', 'async function saveAdmBalance()', 'async function refreshAdmBalances()']) {
      const i = appSrc.indexOf(mark);
      assert.ok(i >= 0, `应定位到 ${mark}`);
      assert.ok(appSrc.slice(i, i + 700).includes('Api.jsonOrThrow(res)'), `${mark} 内应走 jsonOrThrow 脱敏`);
    }
  });

  it('startGenerate 两处 body 已消费路径经 znSanitizeErr 就地脱敏', () => {
    assert.ok(/function znSanitizeErr\(/.test(appSrc), '应定义 znSanitizeErr 帮助函数（body 已消费的错误路径专用）');
    const hi = appSrc.indexOf('function znSanitizeErr');
    const hseg = hi >= 0 ? appSrc.slice(hi, hi + 500) : '';
    assert.ok(hseg.includes("'INTERNAL_ERROR'") && hseg.includes("'SERVER_BUSY'"), 'helper 应识别 INTERNAL_ERROR/SERVER_BUSY 裸码');
    assert.ok(/status >= 500/.test(hseg), 'helper 应只对 5xx 回落（不误伤 4xx 业务码）');
    assert.doesNotMatch(appSrc, /throw new Error\(ej\.message \|\| ej\.error \|\| \('HTTP ' \+ pr\.status\)\)/, '建项失败投掷不应再裸 ej.error');
    assert.ok(/znSanitizeErr\(ej\.message \|\| ej\.error/.test(appSrc), '建项失败投掷应经 znSanitizeErr');
    assert.ok(/msg = znSanitizeErr\(msg, res\.status\)/.test(appSrc), '生成响应失败 msg 应经 znSanitizeErr');
  });

  it('branch-view postJson 与 getJson 同口径走 jsonOrThrow', () => {
    const region = sliceBetween(branchSrc, 'async function postJson', 'const posOf');
    assert.ok(region, '应定位到 branch-view postJson');
    assert.ok(/return window\.Api\.jsonOrThrow\(r\)/.test(region), 'postJson 应走 jsonOrThrow 脱敏层');
    assert.doesNotMatch(region, /throw new Error\(\(j && j\.error\)/, '不应再手动投掷 j.error 裸码');
  });

  it('teardown-view raw() 就地 5xx 裸码脱敏，业务码原样保留供分支', () => {
    const region = sliceBetween(teardownSrc, 'async function raw(', 'const btn =');
    assert.ok(region, '应定位到 teardown-view raw()');
    assert.ok(/!res\.ok && res\.status >= 500/.test(region), 'raw() 应只对 5xx 做脱敏（4xx 业务错误语义不变）');
    assert.ok(region.includes("'INTERNAL_ERROR'") && region.includes("'SERVER_BUSY'"), '应识别 INTERNAL_ERROR/SERVER_BUSY 裸码');
    assert.ok(/开小差|hiccup/i.test(region), '5xx 应回落本地双语友好文案');
    assert.ok(/return \{ ok: res\.ok, status: res\.status, data \}/.test(region), 'raw() 应保持 {ok,status,data} 契约（5 处调用点零改动）');
  });
});

/* v2.251 消费侧收口第二弹：策略推荐/调色板/情绪曲线 throw 族 + 社区/市场 xnSay 族共 12 处裸码清零
 * 背景：v2.239 清完资产保存/反馈导出/余额后，仍有 12 处绕过脱敏层——
 *  A 族（7 处）：推荐与调色板类 POST 失败时 `throw new Error(d.error || '...')`，外层 catch 一律
 *    `xnSay(String(e.message||e))` 上屏——500 时用户直接看到 INTERNAL_ERROR 裸码；
 *    涉及 flavor-recommend / hook-strategy / creation-strategy / hooks·beats palette / emotion director×2。
 *  B 族（5 处）：社区点赞/删帖、上架弹窗项目列表、下架/重新上架失败时 `xnSay((await r.json()).error || ...)`，
 *    500 同样裸码上屏。
 * 修复：12 处全部为 body 已消费路径，统一就地 znSanitizeErr(code, status) 脱敏（与 v2.239 startGenerate 同口径）；
 *  fallback 由 `x.error || '兜底'` 改为 `znSanitizeErr(x.error, status) || '兜底'`——500 无 body 也回落友好文案。
 */
describe('v2.251 消费侧收口第二弹：throw 族 + xnSay 族 12 处裸码清零', () => {
  it('A 族清零：不再存在 throw new Error(X.error || ...) 裸投掷（推荐/调色板/情绪曲线 7 处）', () => {
    const bare = appSrc.match(/throw new Error\([a-z]{1,3}\.error \|\|/g) || [];
    assert.strictEqual(bare.length, 0,
      `仍有 ${bare.length} 处裸投掷 d.error（500 会把 INTERNAL_ERROR 糊给用户），应经 znSanitizeErr：${bare.join(' ; ')}`);
  });

  it('B 族清零：不再存在 xnSay((await X.json()...) 直接上屏（社区/市场 5 处）', () => {
    const bare = appSrc.match(/xnSay\(\(await [a-z]+\.json\(\)/g) || [];
    assert.strictEqual(bare.length, 0,
      `仍有 ${bare.length} 处 xnSay 直接消费 r.json().error，应经 znSanitizeErr：${bare.join(' ; ')}`);
  });

  it('znSanitizeErr 调用面扩齐：定义 1 + v2.239 既有 2 + 本轮新增 12 = 至少 15 处', () => {
    const n = (appSrc.match(/znSanitizeErr\(/g) || []).length;
    assert.ok(n >= 15, `znSanitizeErr( 出现 ${n} 次，应 ≥15（定义1+v2.239两处+本轮12处）`);
  });

  it('A 族 7 处逐点核验：投掷语句经 znSanitizeErr 且带上响应 status', () => {
    const marks = [
      ['/api/generate/flavor-recommend', 'res.status'],
      ['/api/generate/hook-strategy/recommend', 'hRes.status'],
      ['/api/generate/creation-strategy/recommend', 'cRes.status'],
      ['/api/generate/hooks/palette', 'res.status'],
      ['/api/generate/beats/palette', 'res.status'],
      ['/api/generate/emotion/director', 'res.status'], // wave（首次出现）
    ];
    for (const [mark, st] of marks) {
      const i = appSrc.indexOf(mark);
      assert.ok(i >= 0, `应定位到 ${mark}`);
      const win = appSrc.slice(i, i + 600);
      assert.ok(new RegExp(`znSanitizeErr\\([a-z]{1,3}\\.error, ${st.replace('.', '\\.')}\\)`).test(win),
        `${mark} 失败投掷应经 znSanitizeErr(X.error, ${st})`);
    }
    // emotion/director 第二处（range）：窗口内需第二处 znSanitizeErr
    const first = appSrc.indexOf('/api/generate/emotion/director');
    const second = appSrc.indexOf('/api/generate/emotion/director', first + 10);
    assert.ok(second > first, 'emotion/director 应有 wave 与 range 两处调用');
    const win2 = appSrc.slice(second, second + 600);
    assert.ok(/znSanitizeErr\(d\.error, res\.status\)/.test(win2), 'emotion/director range 投掷应经 znSanitizeErr(d.error, res.status)');
  });

  it('B 族 5 处逐点核验：上屏前经 znSanitizeErr 且带 status', () => {
    const marks = [
      "/like`, { method }",                 // 社区点赞
      "posts/${p.id}`, { method: 'DELETE' }", // 社区删帖
      "$('mkListBtn').onclick",              // 上架弹窗项目列表（/api/generate/projects 首现在他处，锚到按钮）
      '/delist',                             // 下架
      '/relist',                             // 重新上架
    ];
    for (const mark of marks) {
      const i = appSrc.indexOf(mark);
      assert.ok(i >= 0, `应定位到 ${mark}`);
      const win = appSrc.slice(i, i + 700);
      assert.ok(/xnSay\(znSanitizeErr\(/.test(win), `${mark} 失败上屏应经 znSanitizeErr`);
      assert.ok(/znSanitizeErr\([\s\S]{0,160}?[a-z]+\.status\)/.test(win), `${mark} 脱敏应带 status 参数`);
    }
  });

  it('v2.239 断言面不回归：helper 定义与 startGenerate 两处仍在', () => {
    assert.ok(/function znSanitizeErr\(/.test(appSrc), 'znSanitizeErr 定义应保留');
    assert.ok(/znSanitizeErr\(ej\.message \|\| ej\.error/.test(appSrc), 'startGenerate 建项投掷脱敏应保留');
    assert.ok(/msg = znSanitizeErr\(msg, res\.status\)/.test(appSrc), 'startGenerate 响应失败脱敏应保留');
  });
});
