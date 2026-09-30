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
