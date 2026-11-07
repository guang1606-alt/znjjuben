/**
 * v2.451 账号安全卫生 + 改密表单语义。
 *
 * 证伪背景（v2.449 收尾时同族顺手核查）：
 * ①`closeAuth()` 只关弹窗、清错误提示与 aria-invalid，**不清密码框**——共用设备上关掉再打开，
 *   上次输入的密码还留在 DOM 里（可被同页脚本读出，密码管理器也可能把它记成新凭据）；
 * ②「资料 → 修改密码」两个密码框与按钮仍是 div 拼的，不在任何 form 内：回车不提交、
 *   密码管理器识别不到「更新密码」场景，和 v2.449 修的登录表单是同一族缺陷。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');

function pick(fnName, asyncFn = false) {
  const m = appJs.match(new RegExp(`${asyncFn ? 'async ' : ''}function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

test('① 关闭登录弹窗必须清空密码框（共用设备不残留凭据），手机号保留减少重输', () => {
  const fn = pick('resetAuthForm');
  assert.match(fn, /\$\('authPwd'\)\.value\s*=\s*''/, 'resetAuthForm 必须清空 #authPwd.value');
  assert.ok(!/\$\('authPhone'\)\.value\s*=/.test(fn), '手机号不应被清空：重开时保留上次账号更省事');
  // 关闭路径不止 X：Esc 与通用 data-close 走 closeModalEl，所以清理必须挂在关闭钩子上，
  // 且 closeAuth 必须委托给 closeModalEl（自己写 hidden 会绕过钩子）。
  assert.match(appJs, /setModalCloseHook\('authModal',\s*resetAuthForm\)/, '清理需注册到 authModal 的关闭钩子');
  const close = pick('closeAuth');
  assert.match(close, /closeModalEl\(\$\('authModal'\)\)/, 'closeAuth 必须走统一关闭出口，否则会绕过清理钩子');
});

test('② 改密面板包在 <form id="chgPwForm"> 内，按钮是 submit', () => {
  const open = html.indexOf('<form id="chgPwForm"');
  assert.ok(open >= 0, '改密面板必须有 <form id="chgPwForm">');
  const close = html.indexOf('</form>', open);
  assert.ok(close > open, 'form 必须闭合');
  const seg = html.slice(open, close);
  assert.match(seg, /novalidate/, '校验口径在 app.js（与后端同规则），form 需 novalidate');
  for (const id of ['inCurPw', 'inNewPw', 'changePwBtn']) {
    assert.ok(seg.includes(`id="${id}"`), `#${id} 必须在改密 form 内`);
  }
  const btn = seg.match(/<button[^>]*id="changePwBtn"[^>]*>/);
  assert.ok(btn, '应存在 #changePwBtn');
  assert.match(btn[0], /type="submit"/, '改密按钮必须是 type="submit"，回车才走原生提交');
});

test('③ 改密 Enter 提交走 form onsubmit，复用同一提交函数且阻止默认导航', () => {
  assert.match(appJs, /\$\('chgPwForm'\)\.onsubmit\s*=\s*\(/, '必须接管改密 form 的 submit');
  const onsubmit = appJs.match(/\$\('chgPwForm'\)\.onsubmit\s*=\s*\(([\s\S]*?)\n  \};/);
  assert.ok(onsubmit, '需要可读的 submit 处理函数体');
  assert.match(onsubmit[0], /preventDefault\(\)/, 'submit 必须 preventDefault，否则回车会把两个密码拼进 query 刷新整页');
  assert.match(onsubmit[0], /doChangePw\(\)/, 'submit 必须复用 doChangePw，避免两套校验');
  assert.ok(!/\$\('changePwBtn'\)\.onclick\s*=/.test(appJs), '提交逻辑不应再挂按钮 onclick（否则回车仍不生效）');
  const fn = pick('doChangePw', true);
  assert.match(fn, /pwClientErr/, 'doChangePw 仍需保留本地密码强度预校验');
  assert.match(fn, /changePassword/, 'doChangePw 必须仍调用统一改密接口');
});
