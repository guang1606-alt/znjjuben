/* v2.286 守卫：管理后台 admApi 裸调用成组收口
 * - 5 个 tab loader 断网/非 ok 冒泡 unhandledrejection 且无就地错误态 → try/catch + znErrorHtml 写主容器
 * - 6 个写操作 fire-and-forget（onclick 直挂/箭头裸调）无 catch → try/catch xnSay，成功链保留，uiConfirm 留外
 * - admDownload 网络层/ blob reject 冒泡 → try/catch 固定文案（与其非 ok 分支一致，不直送技术 message）
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src0 = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
const src = src0.replace(/\/\/.*$/gm, '');

function fnBody(name) {
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

// 取体内第一个语句级 catch 块的内容（支持早返回范式：catch 后仍有成功路径代码）
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

test('L 组：5 个后台 tab loader 均 try 兜底且 catch 内 znErrorHtml 写主容器', () => {
  const cases = [
    ['loadAdmHandoff', 'hdSnapshot'],
    ['loadAdmStats', 'admStatCards'],
    ['loadAdmFinance', 'admFinanceCards'],
    ['loadAdmPosts', 'admPostList'],
    ['loadAdmSafety', 'sfTbody'],
  ];
  for (const [name, box] of cases) {
    const b = fnBody(name);
    const iTry = b.search(/\btry\s*\{/);
    const iReq = b.search(/admApi\(|Api\.request\(/);
    assert.ok(iTry >= 0 && iTry < iReq, `${name}: try 先于请求`);
    const catchTail = firstCatchBody(b);
    assert.ok(catchTail, `${name}: 语句级 catch 存在`);
    assert.ok(new RegExp(`\\$\\('${box}'\\)`).test(catchTail), `${name}: catch 写主容器 #${box}`);
    assert.ok(/znErrorHtml/.test(catchTail), `${name}: catch 用 znErrorHtml 就地错误态（非仅 toast）`);
  }
});

test('W1 saveAdmHandoff：try 包 PUT，catch 反馈，成功提示保留', () => {
  const b = fnBody('saveAdmHandoff');
  assert.ok(/\btry\s*\{/.test(b) && b.search(/\btry\s*\{/) < b.indexOf("'/handoff'"));
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/接续脉络已加密保存/.test(b));
});

test('W2 appendAdmHandoff：try 包 append POST，catch 反馈，saveAdmHandoff() 成功链保持', () => {
  const b = fnBody('appendAdmHandoff');
  assert.ok(b.search(/\btry\s*\{/) >= 0 && b.search(/\btry\s*\{/) < b.indexOf('/handoff/append'));
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/saveAdmHandoff\(\)/.test(b));
});

test('W3 toggleAdmSafety：try 包 toggle POST，catch 反馈，loadAdmSafety 刷新保持', () => {
  const b = fnBody('toggleAdmSafety');
  assert.ok(b.search(/\btry\s*\{/) >= 0 && b.search(/\btry\s*\{/) < b.indexOf('/toggle'));
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/loadAdmSafety\(\)/.test(b));
});

test('W4 delAdmSafety：uiConfirm 留 try 外，DELETE 包 try，catch 反馈', () => {
  const b = fnBody('delAdmSafety');
  const iC = b.indexOf('uiConfirm'), iT = b.search(/\btry\s*\{/), iD = b.indexOf("method: 'DELETE'");
  assert.ok(iC >= 0 && iC < iT && iT < iD);
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/loadAdmSafety\(\)/.test(b));
});

test('W5 resetAdmSafety：uiConfirm 留 try 外，reset POST 包 try，成功提示+刷新保持', () => {
  const b = fnBody('resetAdmSafety');
  const iC = b.indexOf('uiConfirm'), iT = b.search(/\btry\s*\{/), iR = b.indexOf("'/safety/reset'");
  assert.ok(iC >= 0 && iC < iT && iT < iR);
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/已恢复默认规则库/.test(b) && /loadAdmSafety\(\)/.test(b));
});

test('W6 saveRoutes：try 包 PUT routing，catch 反馈，成功链（提示+loadProviders+loadAdmPortfolio）保持', () => {
  const b = fnBody('saveRoutes');
  assert.ok(b.search(/\btry\s*\{/) >= 0 && b.search(/\btry\s*\{/) < b.indexOf('/model/routing'));
  const cm = firstCatchBody(b);
  assert.ok(cm && /xnSay/.test(cm));
  assert.ok(/岗位路由已保存/.test(b));
  assert.ok(/loadProviders\(\)/.test(b) && /loadAdmPortfolio\(\)/.test(b));
});

test('D1 admDownload：try 包住请求+blob，catch 固定失败文案，非 ok 分支保持', () => {
  const b = fnBody('admDownload');
  const iT = b.search(/\btry\s*\{/), iReq = b.indexOf("Api.request('/api/admin'"), iBlob = b.indexOf('res.blob()');
  assert.ok(iT >= 0 && iT < iReq && iReq < iBlob);
  const iNotOk = b.indexOf('if (!res.ok)');
  assert.ok(iNotOk >= 0 && /下载失败，请重试/.test(b));
  const cm = firstCatchBody(b);
  assert.ok(/xnSay\(['"]下载失败，请重试['"]\)/.test(cm), 'catch 用固定文案，不直送网络层技术 message');
});
