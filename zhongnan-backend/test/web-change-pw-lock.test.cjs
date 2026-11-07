/**
 * v2.455 改密 429 倒计时 + 常驻错误区。
 *
 * 证伪背景：改密面板的错误全部走 xnSay(toast)，3 秒后自动消失——用户错过就看不到原因；
 * 且 catch 不消费后端 retryAfter，429 期间按钮仍可点，点一次失败一次。
 * 登录侧 v2.454 已经有倒计时，这里是同族缺口：倒计时要泛化到「指定按钮 + 指定错误区」，
 * 而不是写死 #authSubmit/#authErr。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');

function pick(fnName, asyncFn = false) {
  const m = appJs.match(new RegExp(`${asyncFn ? 'async ' : ''}function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

test('① 改密面板要有常驻错误区（toast 会消失，看不到原因）', () => {
  const seg = html.slice(html.indexOf('<form id="chgPwForm"'), html.indexOf('</form>', html.indexOf('<form id="chgPwForm"')));
  assert.match(seg, /id="chgPwErr"/, '改密 form 内必须有常驻错误区 #chgPwErr');
  assert.match(seg, /id="chgPwErr"[^>]*role="alert"/, '错误区需 role=alert，读屏可播报');
  assert.match(seg, /class="[^"]*\bhidden\b[^"]*"[^>]*id="chgPwErr"|id="chgPwErr"[^>]*class="[^"]*\bhidden\b/, '默认隐藏，有错误才显示');
});

test('② 倒计时必须泛化：作用于传入的按钮与错误区，不写死登录表单', () => {
  const fn = pick('startLockCountdown');
  assert.match(fn, /\(sec,\s*btnId,\s*errId\)/, '需要 (sec, btnId, errId) 参数');
  assert.match(fn, /\$\(btnId\)/, '按钮必须按参数取，不能写死 authSubmit');
  assert.match(fn, /\$\(errId\)/, '错误区必须按参数取，不能写死 authErr');
  assert.match(fn, /setInterval/);
  // 登录侧的薄封装保持原契约（既有用例与调用点不破）
  const wrap = pick('startAuthLock');
  assert.match(wrap, /startLockCountdown\(sec,\s*'authSubmit',\s*'authErr'\)/, '登录侧应委托泛化函数');
  const stop = pick('stopLockCountdown');
  assert.match(stop, /_lockBtnId/, '恢复时必须还原子调用方的按钮');
});

test('③ 改密 429 要进入倒计时，非 429 才用常驻错误区', () => {
  const fn = pick('doChangePw', true);
  assert.match(fn, /e\s*&&\s*e\.retryAfter/, '必须识别 retryAfter');
  assert.match(fn, /startLockCountdown\(e\.retryAfter,\s*'changePwBtn',\s*'chgPwErr'\)/, '429 交给倒计时接管');
  assert.match(fn, /showChgPwErr\(/, '普通错误写常驻错误区，而不是会消失的 toast');
  assert.ok(!/catch\s*\(e\)\s*\{\s*xnSay\(e\.message\)/.test(fn), 'catch 里不能只剩 xnSay');
});

test('④ 客户端预校验也走常驻错误区（同一处提示，口径一致）', () => {
  const fn = pick('doChangePw', true);
  assert.match(fn, /showChgPwErr\(t\('curPw'\)\)/, '缺当前密码应写在错误区');
  assert.match(fn, /showChgPwErr\(t\('pwClientErr'\)\)/, '弱新密码应写在错误区');
});
