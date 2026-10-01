const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\/\/.*$/gm, '');
const app = read('web/app.js');
const dv = read('web/diversity-view.js');

function fnBody(src, name) {
  const m = new RegExp(`async function ${name}\\s*\\(`).exec(src);
  assert.ok(m, '函数存在: ' + name);
  let depth = 0, started = false;
  const brace = src.indexOf('{', m.index);
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; if (started && depth === 0) return src.slice(brace + 1, i); }
  }
  throw new Error('body not closed: ' + name);
}
function firstCatchBody(b) {
  const m = /\}\s*catch[^{]*\{/.exec(b);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < b.length; i++) {
    if (b[i] === '{') depth++;
    else if (b[i] === '}') { depth--; if (depth === 0) return b.slice(m.index + m[0].length, i); }
  }
  return null;
}

test('M1 loadMe：/api/auth/me 包 try，catch 静默（全局网络 hook 已提示，资料卡保旧不双弹）', () => {
  const b = fnBody(app, 'loadMe');
  const iTry = b.search(/\btry\s*\{/);
  const iReq = b.indexOf("'/api/auth/me'");
  assert.ok(iTry >= 0 && iTry < iReq, 'try 先于 /api/auth/me 请求');
  const c = firstCatchBody(b);
  assert.ok(c, '存在语句级 catch');
  assert.ok(!/xnSay|toastError|alert\(/.test(c), 'catch 静默：不双弹 toast/alert（v2.283 纪律，Api.request 网络面全局 hook 已覆盖）');
});

test('M2 loadCatalog：裸 fetch /api/order/catalog 包 try，catch 走 znError 就地错误态（裸 fetch 无全局网络 hook，不可静默）', () => {
  const b = fnBody(app, 'loadCatalog');
  const iTry = b.search(/\btry\s*\{/);
  const iFetch = b.indexOf("fetch('/api/order/catalog')");
  assert.ok(iTry >= 0 && iTry < iFetch, 'try 先于裸 fetch');
  const c = firstCatchBody(b);
  assert.ok(c && /znError\(\s*'plansGrid'/.test(c), "catch 内 znError('plansGrid', …) 就地错误态（与非 ok 分支同容器）");
  assert.ok(/if\s*\(!res\.ok\)/.test(b) && /znError\(\s*'plansGrid'/.test(b), '既有非 ok 分支 plansGrid 错误态保留');
});

test('V1 diversity genSeeds：onclick 直绑 async 函数，内部须 try 自管 + catch 就地 dv-bad 错误态（对齐同文件 audit）', () => {
  const b = fnBody(dv, 'genSeeds');
  const iTry = b.search(/\btry\s*\{/);
  const iReq = b.indexOf("'/api/craft/diverse-seeds");
  assert.ok(iTry >= 0 && iTry < iReq, 'try 先于 getJson diverse-seeds');
  const c = firstCatchBody(b);
  assert.ok(c && /dvResult/.test(c) && /dv-bad/.test(c), 'catch 就地写 #dvResult .dv-bad（与 audit 失败态同构）');
  assert.ok(/seedFail/.test(c), 'catch 使用 seedFail 文案键（非误用 auditFail）');
  // i18n 双语文案键齐备
  const zh = /seedFail:\s*'[^']+'/.test(dv);
  const enBlock = dv.match(/seedFail:\s*'[^']+'/g);
  assert.ok(zh && enBlock && enBlock.length >= 2, 'seedFail 中英双语文案均存在');
  assert.ok(/\$\('dvSeedBtn'\)\.onclick\s*=\s*genSeeds\s*;/.test(dv), '直绑保留（函数自管后 onclick=genSeeds 安全）');
});
