/**
 * v2.454 锁定倒计时：429 期间按钮持续禁用，不再让用户空点。
 *
 * 证伪背景（v2.453 收尾顺手核查）：后端 v2.452/v2.453 已经把 429 的真实解锁秒数
 * 通过 retryAfter 给到前端，但 doAuthSubmit 的 catch 只 showAuthErr(e.message)，
 * finally 又无条件把按钮置回可用——锁定期用户点一次失败一次，看起来像「没反应」，
 * 每次点击还在继续打后端。后端好不容易给出的 retryAfter 在前端被丢掉了。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const i18nJs = fs.readFileSync(path.join(webDir, 'i18n.js'), 'utf8');

function pick(fnName, asyncFn = false) {
  const m = appJs.match(new RegExp(`${asyncFn ? 'async ' : ''}function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

test('① 倒计时期间按钮必须禁用并显示剩余秒数，结束才恢复', () => {
  // v2.455 倒计时泛化成 startLockCountdown(sec, btnId, errId)，具体目标由调用方传入；
  // 登录侧 startAuthLock 保留为薄封装，必须把目标钉死在 authSubmit / authErr（不能漂到别的按钮）。
  const fn = pick('startLockCountdown');
  assert.match(fn, /setInterval/, '倒计时要靠定时器逐秒推进');
  assert.match(fn, /\$\(btnId\)/, '倒计时按钮必须按入参取');
  assert.match(fn, /\$\(errId\)/, '倒计时错误区必须按入参取');
  assert.match(fn, /btn\.disabled\s*=\s*true/, '倒计时期间必须禁用提交按钮');
  assert.match(fn, /authLockedTip/, '提示文案走 i18n，且要带剩余秒数');
  const wrap = pick('startAuthLock');
  assert.match(wrap, /startLockCountdown\(sec,\s*'authSubmit',\s*'authErr'\)/, '登录侧必须委托泛化函数并固定自己的按钮/错误区');
  const stop = pick('stopLockCountdown');
  assert.match(stop, /clearInterval/, '必须能清除定时器，否则关闭弹窗后仍在跑');
  assert.match(stop, /disabled\s*=\s*false/, '结束时必须恢复可用');
  const stopWrap = pick('stopAuthLock');
  assert.match(stopWrap, /stopLockCountdown\(\)/, '登录侧停止也要委托统一出口');
});

test('② 429 的 retryAfter 要真正被消费：走倒计时而不是只弹一句错误', () => {
  const fn = pick('doAuthSubmit', true);
  assert.match(fn, /e\s*&&\s*e\.retryAfter/, '必须识别后端给的 retryAfter');
  assert.match(fn, /startAuthLock\(/, '命中 retryAfter 时进入倒计时');
  assert.match(fn, /if\s*\(!_lockTimer\)/, 'finally 不能无条件恢复按钮：锁定期恢复等于让用户继续空点');
});

test('③ 关闭弹窗要停掉倒计时（否则重开仍是禁用态，名实不符）', () => {
  const fn = pick('resetAuthForm');
  assert.match(fn, /stopAuthLock\(\)/, 'resetAuthForm 必须停倒计时');
});

test('④ 中英文案都要有 authLockedTip，且含 {n} 占位', () => {
  const hits = i18nJs.match(/authLockedTip:/g) || [];
  assert.strictEqual(hits.length, 2, `中英各一条，实际：${hits.length}`);
  const vals = i18nJs.match(/authLockedTip:\s*'([^']*)'/g) || [];
  assert.strictEqual(vals.length, 2);
  for (const v of vals) assert.match(v, /\{n\}/, `文案需含 {n}：${v}`);
});
