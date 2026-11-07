/**
 * v2.449 登录表单语义：从「一堆 div + onclick」变成真正的 <form>。
 *
 * 证伪背景：v2.448 真机复核时 Chrome 控制台报
 * `Password field is not contained in a form`——全站 `grep '<form'` 命中 0，
 * 登录/注册模态是 div 拼的、提交只挂在按钮 onclick 上。后果有三：
 * ①密码管理器无法保存/填充凭据（它按 form + autocomplete 识别登录表单）；
 * ②手机键盘与浏览器的「前往/登录」回车键不生效，必须精准点到按钮；
 * ③缺少 submit 语义，读屏器与自动化工具都认为这里没有可提交的表单。
 * 本文件锁死最小契约：字段包在 form 内、按钮是 submit、Enter 走原生提交且不刷新页面、
 * autocomplete 随登录/注册切换。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');

function pick(fnName) {
  const m = appJs.match(new RegExp(`function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

const authBlock = (() => {
  const m = html.match(/<div class="modal-mask hidden" id="authModal"[\s\S]*?<!-- v2\.261/);
  assert.ok(m, '应能定位 #authModal 区块');
  return m[0];
})();

test('① 登录字段包在 <form id="authForm"> 内（密码管理器据此识别登录表单）', () => {
  const open = authBlock.indexOf('<form');
  assert.ok(open >= 0, '#authModal 内必须有 <form>，否则 Chrome 报 Password field is not contained in a form');
  assert.match(authBlock, /<form[^>]*id="authForm"/, 'form 需要有稳定 id 供提交接线');
  assert.match(authBlock, /<form[^>]*novalidate/, '自定义校验口径在 app.js，form 需 novalidate 避免原生拦截');
  const close = authBlock.lastIndexOf('</form>');
  assert.ok(close > open, 'form 必须闭合');
  for (const id of ['authPhone', 'authPwd', 'authInvite', 'authSubmit']) {
    const i = authBlock.indexOf(`id="${id}"`);
    assert.ok(i > open && i < close, `#${id} 必须在 form 内`);
  }
});

test('② 账号/密码字段带 autocomplete 语义，提交按钮是 submit', () => {
  const phone = authBlock.match(/<input id="authPhone"[^>]*>/);
  assert.ok(phone, '应存在 #authPhone');
  assert.match(phone[0], /autocomplete="tel"/, '手机号需 autocomplete="tel"，否则密码管理器不认作账号字段');
  assert.match(phone[0], /type="tel"/, '手机号应为 type="tel"（移动端键盘与自动填充更准确）');

  const submit = authBlock.match(/<button[^>]*id="authSubmit"[^>]*>/);
  assert.ok(submit, '应存在 #authSubmit');
  assert.match(submit[0], /type="submit"/, '提交按钮必须是 type="submit"，Enter 才能触发原生提交');
});

test('③ Enter 提交走 form onsubmit，且阻止默认导航', () => {
  assert.match(appJs, /\$\('authForm'\)\.onsubmit\s*=|addEventListener\('submit'/, '必须接管 form 的 submit 事件');
  const onsubmit = appJs.match(/\$\('authForm'\)\.onsubmit\s*=\s*\(([\s\S]*?)\n  \};/);
  assert.ok(onsubmit, '需要把 submit 处理写成可读函数体，便于校验 preventDefault');
  assert.match(onsubmit[0], /preventDefault\(\)/, 'submit 必须 preventDefault：否则回车会带 ?authPhone=... 刷新整页');
  assert.match(onsubmit[0], /doAuthSubmit\(\)/, 'submit 必须复用与按钮同一套提交逻辑，避免双份校验漂移');
  assert.ok(!/\$\('authSubmit'\)\.onclick\s*=/.test(appJs), '提交逻辑不应再挂在按钮 onclick 上（否则 Enter 仍不生效）');
});

test('④ autocomplete 随登录/注册切换：登录 current-password、注册 new-password', () => {
  const fn = pick('syncAuthTabs');
  assert.match(fn, /authPwd'\)\.autocomplete/, 'syncAuthTabs 必须按模式设置密码框 autocomplete');
  assert.match(fn, /current-password/, '登录模式需 current-password，浏览器才会填充已存凭据');
  assert.match(fn, /new-password/, '注册模式需 new-password，避免把新密码覆盖到旧凭据');
});
