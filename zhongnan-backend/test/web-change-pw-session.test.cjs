/**
 * v2.457 改密后保持登录态（前端侧）。
 *
 * 证伪背景：doChangePw 成功后 Api.clearSession() + setTimeout(openAuth('login'), 1000)，
 * 用户刚设的新密码立刻要求再输一次；同一入口在「其他设备改密」时不会有任何提示。
 * 新契约：服务端返回新令牌（见 http-change-password-session.test.cjs），api.js 原地 setSession，
 * 页面不再清会话、不再弹登录框；文案也要从「请重新登录」改为「已生效」。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const apiJs = fs.readFileSync(path.join(webDir, 'api.js'), 'utf8');
const i18nJs = fs.readFileSync(path.join(webDir, 'i18n.js'), 'utf8');

function pickAsync(fnName) {
  const m = appJs.match(new RegExp(`async function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 async function ${fnName}`);
  return m[0];
}

test('① doChangePw 成功后不得清会话、不得弹登录框', () => {
  const fn = pickAsync('doChangePw');
  assert.ok(!/Api\.clearSession\(\)/.test(fn), '改密成功不应 clearSession（旧行为=强制重新登录）');
  assert.ok(!/openAuth\(\s*['"]login['"]\s*\)/.test(fn), '改密成功不应弹登录框要用户重输新密码');
  assert.ok(!/setTimeout/.test(fn), '不应再用延迟跳登录');
  assert.match(fn, /pwChangeOk/, '仍要给成功反馈');
});

test('② api.changePassword 上报当前 refreshToken 并原地替换凭证', () => {
  const m = apiJs.match(/async changePassword\([^)]*\)[\s\S]*?\n    \},/);
  assert.ok(m, '缺 Api.auth.changePassword');
  const seg = m[0];
  assert.match(seg, /refreshToken/, '必须上报本地 refreshToken，服务端才能吊销旧凭据');
  assert.match(seg, /setSession\(/, '成功必须原地 setSession 续上登录态');
  assert.match(seg, /data\.accessToken/, '必须用服务端返回的新 accessToken');
  assert.match(seg, /data\.refreshToken/, '必须用服务端返回的新 refreshToken');
});

test('③ 成功文案不再要求「重新登录」', () => {
  const zh = i18nJs.match(/pwChangeOk:\s*'([^']*)'/);
  const en = i18nJs.match(/pwChangeOk:\s*'([^']*)'/g);
  assert.ok(zh, '缺中文 pwChangeOk');
  assert.ok(!/重新登录|重新登陆/.test(zh[1]), `中文文案仍在要求重新登录：${zh[1]}`);
  const enAll = [...i18nJs.matchAll(/pwChangeOk:\s*'([^']*)'/g)].map((x) => x[1]);
  assert.ok(enAll.length >= 2, '中英两份文案都要在');
  const enMsg = enAll.find((s) => /password/i.test(s) && /[a-zA-Z]/.test(s) && !/[\u4e00-\u9fa5]/.test(s));
  assert.ok(enMsg, '缺英文 pwChangeOk');
  assert.ok(!/sign in|log ?in again/i.test(enMsg), `英文文案仍在要求重新登录：${enMsg}`);
  assert.ok(en && en.length >= 1);
});
