const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.246 a11y 第六梯队：authModal 字段错误关联（aria-invalid + aria-describedby）
// 现状：authErr 是登录/注册 modal 内嵌错误区（.notice.err hidden），showAuthErr 触发时
// 设置文本并去 hidden——但读屏用户焦点还在 authPhone/authPwd 上时，听不到错误；
// 且两输入无 aria-invalid 状态，读屏器无法朗读"无效输入"。
// 本梯队：①authPhone/authPwd 补 aria-describedby="authErr"（输入朗读后自动跟读错误区）；
// ②authErr 补 role="alert"（showAuthErr 时立即断言朗读）；
// ③showAuthErr 触发时给两输入加 aria-invalid="true"（标记无效状态）；
// ④closeAuth / authPhone|authPwd input 事件清除 aria-invalid（错误修复后解除标记）。
// 零行为变化：纯语义层，视觉/逻辑不动；authErr 的 hidden 切换不变。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const sliceBetween = (s, a, b) => { const i = s.indexOf(a); const j = i >= 0 ? s.indexOf(b, i) : -1; return i >= 0 && j > i ? s.slice(i, j) : ''; };

describe('v2.246 a11y：authModal 字段错误关联', () => {
  it('authPhone/authPwd 有 aria-describedby="authErr"（错误区关联）', () => {
    const phone = html.match(/<input id="authPhone"[^>]*>/);
    const pwd = html.match(/<input id="authPwd"[^>]*>/);
    assert.ok(phone, '应存在 #authPhone');
    assert.ok(pwd, '应存在 #authPwd');
    assert.match(phone[0], /aria-describedby="authErr"/, 'authPhone 缺 aria-describedby="authErr"');
    assert.match(pwd[0], /aria-describedby="authErr"/, 'authPwd 缺 aria-describedby="authErr"');
  });

  it('authErr 有 role="alert"（showAuthErr 触发时立即断言朗读）', () => {
    const err = html.match(/<div class="notice err hidden" id="authErr"[^>]*>/);
    assert.ok(err, '应存在 #authErr');
    assert.match(err[0], /role="alert"/, 'authErr 缺 role="alert"');
  });

  it('showAuthErr 触发时给 authPhone/authPwd 加 aria-invalid="true"', () => {
    // showAuthErr 是短小函数，终点取函数末尾的 }（找下一个以 } 起始的行）
    const region = sliceBetween(appSrc, 'function showAuthErr(msg)', '// v2.246 a11y：用户重新输入');
    assert.ok(region.length > 0, '应定位到 showAuthErr');
    assert.match(region, /\$\(['"]authPhone['"]\)\.setAttribute\(['"]aria-invalid['"],\s*['"]true['"]\)/, 'showAuthErr 未给 authPhone 加 aria-invalid');
    assert.match(region, /\$\(['"]authPwd['"]\)\.setAttribute\(['"]aria-invalid['"],\s*['"]true['"]\)/, 'showAuthErr 未给 authPwd 加 aria-invalid');
  });

  it('closeAuth 清除 authPhone/authPwd 的 aria-invalid', () => {
    const region = sliceBetween(appSrc, 'function closeAuth()', 'function syncAuthTabs');
    assert.ok(region.length > 0, '应定位到 closeAuth');
    assert.match(region, /\$\(['"]authPhone['"]\)\.removeAttribute\(['"]aria-invalid['"]\)/, 'closeAuth 未清 authPhone aria-invalid');
    assert.match(region, /\$\(['"]authPwd['"]\)\.removeAttribute\(['"]aria-invalid['"]\)/, 'closeAuth 未清 authPwd aria-invalid');
  });

  it('authPhone/authPwd 绑定 input 事件清 aria-invalid（用户改错时立即解除标记）', () => {
    // addEventListener 风格：$('xxx').addEventListener('input', () => { $('xxx').removeAttribute('aria-invalid'); });
    // 用非贪婪匹配到行尾（这两条监听各占一行），避免括号嵌套正则陷阱
    assert.match(appSrc, /\$\(['"]authPhone['"]\)\.addEventListener\(['"]input['"][^\n]*removeAttribute\(['"]aria-invalid['"]\)/, 'authPhone 缺 input 事件清 aria-invalid');
    assert.match(appSrc, /\$\(['"]authPwd['"]\)\.addEventListener\(['"]input['"][^\n]*removeAttribute\(['"]aria-invalid['"]\)/, 'authPwd 缺 input 事件清 aria-invalid');
  });

  it('authPhone/authPwd 静态侧不应预置 aria-invalid（仅错误时动态加）', () => {
    const phone = html.match(/<input id="authPhone"[^>]*>/);
    const pwd = html.match(/<input id="authPwd"[^>]*>/);
    assert.ok(!/aria-invalid/.test(phone[0]), 'authPhone 静态侧不应预置 aria-invalid（仅错误时加）');
    assert.ok(!/aria-invalid/.test(pwd[0]), 'authPwd 静态侧不应预置 aria-invalid（仅错误时加）');
  });
});
