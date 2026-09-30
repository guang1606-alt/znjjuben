const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.227 鉴权表单校验与后端 v2.212 统一密码策略对齐：
// 注册（/register）与改密（/change-password）共用「8-64 位 + 必含字母和数字」策略（登录不校验强度，存量不受影响）。
// 后端单源：src/lib/auth-policy.ts + src/routes/auth.ts z.string().min(8).max(64)。
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'web/i18n.js'), 'utf8');

describe('register form validation matches backend unified password policy (v2.212)', () => {
  const seg = app.slice(app.indexOf("$('authSubmit').onclick"), app.indexOf('$(' + "'authSubmit').onclick") + 900);
  it('注册分支校验 8 位下限', () => {
    assert.ok(/pwd\.length < 8/.test(seg), 'authSubmit 应校验密码至少 8 位');
  });
  it('注册分支校验必含字母和数字（与改密/admin 入口同口径，避免弱密码白跑后端）', () => {
    assert.ok(/!\/\[a-zA-Z\]\/\.test\(pwd\)/.test(seg), 'authSubmit 应校验密码含字母');
    assert.ok(/!\/\[0-9\]\/\.test\(pwd\)/.test(seg), 'authSubmit 应校验密码含数字');
  });
  it('index.html authPwd/inNewPw 输入框 maxlength=64（对齐后端 max(64)）', () => {
    for (const id of ['authPwd', 'inNewPw']) {
      const tag = html.split('\n').find((l) => l.includes(`id="${id}"`));
      assert.ok(tag && /maxlength="64"/.test(tag), `#${id} 应设 maxlength="64"`);
    }
  });
  it('i18n authErrPwd 双语文案包含字母和数字要求', () => {
    assert.ok(/authErrPwd: '[^']*(字母和数字|字母与数字)/.test(i18n), 'zh 文案应提及字母和数字');
    assert.ok(/authErrPwd: '[^']*letters and numbers/.test(i18n), 'en 文案应提及 letters and numbers');
  });
  it('authPwd placeholder 与新策略一致', () => {
    const tag = html.split('\n').find((l) => l.includes('id="authPwd"'));
    assert.ok(tag && /至少 8 位，需含字母和数字/.test(tag), 'placeholder 应反映完整策略');
  });
});
