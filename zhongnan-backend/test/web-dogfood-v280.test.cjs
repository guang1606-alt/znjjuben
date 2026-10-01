/**
 * v2.280 dogfood 第十八轮（登录沉降误清输入面）——匿名→登录不得清空用户本页已填创作输入
 * 复现（DEMO 8099，真实登录表单）：未登录在 studio 填好 modeBrief → 点生成弹登录框 →
 *  登录成功 → renderAuthButton → syncPrivateAccount（owner null→有值）→ resetPrivateAccountState
 *  → modeBrief.value='' 用户刚写的创意被清空（注册、跨标签页登录同链路）。
 * 语义边界：
 *  - 匿名→登录（旧 owner 为空、新 owner 有值）：输入是用户本页刚主动填的，不是上个账号残留，保留；
 *  - 换号 A→B（双方都有值）：必须全清防串号；
 *  - 登出（有值→null）：必须全清防下个使用者看到。
 * 修法：syncPrivateAccount 仅在匿名→登录沉降时给 resetPrivateAccountState 传 keepInputs 选项，
 *  resetPrivateAccountState 的用户输入框清空循环受该选项守卫（其余任务/资产/面板重置不变）。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8')
  .replace(/\/\/.*$/gm, ''); // 剥行注释

function fnBody(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = src.indexOf(endMarker, s + startMarker.length);
  return e < 0 ? src.slice(s) : src.slice(s, e);
}

const sync = fnBody('function syncPrivateAccount', 'function capturePrivateSession');
const reset = fnBody('function resetPrivateAccountState', 'function renderAuthButton');

describe('v2.280 [R1] 匿名→登录沉降保留用户已填输入；换号/登出仍全清', () => {
  it('A1 syncPrivateAccount 区分「匿名→登录」（旧 owner 为空且新 owner 有值）', () => {
    assert.ok(sync.length > 0, 'syncPrivateAccount 未定位');
    assert.match(sync, /!\s*privateAccountOwner[\s\S]{0,80}&&[\s\S]{0,40}\bowner\b/,
      '必须以「旧 owner 为空 且 新 owner 有值」识别匿名登录沉降');
  });

  it('A2 沉降分支向 resetPrivateAccountState 传递保留输入选项（keepInputs）', () => {
    assert.match(sync, /resetPrivateAccountState\([^)]*keepInputs[^)]*\)/,
      '匿名登录沉降必须向 reset 传 keepInputs 选项');
  });

  it('A3 换号/登出路径不得保留输入：选项只能由「旧 owner 为空」条件派生，不得恒传', () => {
    // 调用点不能是无条件的 resetPrivateAccountState({keepInputs:true})
    assert.ok(!/resetPrivateAccountState\(\s*\{\s*keepInputs\s*:\s*true\s*\}\s*\)/.test(sync),
      'keepInputs 不得无条件恒传（换号/登出必须全清）');
  });

  it('A4 resetPrivateAccountState 形参接收选项，输入框清空循环受 keepInputs 守卫', () => {
    assert.ok(reset.length > 0, 'resetPrivateAccountState 未定位');
    assert.match(reset, /function resetPrivateAccountState\s*\(\s*[A-Za-z_$][\w$]*\s*\)/, '必须接收 opts 形参');
    // 守卫与输入框列表必须同时出现且守卫在列表之前
    const iGuard = reset.search(/if\s*\([^)]*keepInputs[^)]*\)\s*\{?/);
    const iList = reset.indexOf("'modeBrief'");
    assert.ok(iGuard >= 0, '输入框清空必须有 keepInputs 条件守卫');
    assert.ok(iList >= 0, 'modeBrief 输入框清空列表不得删除');
    assert.ok(iGuard < iList, '守卫必须包住输入框清空列表');
  });

  it('A5 十类用户输入框清空列表存续（守卫生效时跳过，换号/登出仍清空）', () => {
    ['modeBrief', 'sourceText', 'tagIdea', 'inNickname', 'inPen', 'inBio'].forEach((id) => {
      assert.ok(reset.includes("'" + id + "'"), '输入框列表丢失: ' + id);
    });
  });

  it('A6 换号主判定（owner === privateAccountOwner 早退 + epoch++）结构不被破坏', () => {
    assert.match(sync, /owner\s*===\s*privateAccountOwner/, '同账号早退必须保留');
    assert.match(sync, /privateAccountEpoch\+\+/, '换号 epoch 递增必须保留');
  });
});
