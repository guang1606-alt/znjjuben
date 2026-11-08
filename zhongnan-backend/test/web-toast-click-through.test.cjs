/**
 * v2.470 弹窗期 toast 遮挡与点击穿透守卫
 * 背景（8121 真机，390×844 模拟移动端实测证据）：
 *   `window.toastInfo()` 推入一条 3 行长提示后，#toastStack 卡片实测 rect=(98,141,195,102)、
 *   pointer-events:auto，恰好压在反馈弹窗页签 #fbTabMine=(110,151,85,41) 上；
 *   document.elementFromPoint(页签中心) 命中 .t-body —— 点页签直接落到提示卡片，用户表现为「点了没反应」。
 *   同类风险：任何弹窗/工作台打开时，顶部 18px 的 toast 浮岛都可能压住对话框标题与页签。
 * 修法（纯 styles.css）：
 *   ① 卡片本体 pointer-events:none（点击穿透），仅 .t-action / .t-close 恢复 auto；
 *   ② 弹窗/工作台/通用对话框存在时，toast-stack 由顶部改停靠底部安全区，进场方向随之自下而上。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');

// 取某选择器前缀首次出现处的 { ... } 声明块
function ruleBlock(selectorPrefix) {
  const i = css.indexOf(selectorPrefix);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  if (open < 0) return '';
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

/* ---------- [G1] 卡片点击穿透 ---------- */
describe('v2.470 [G1] toast 卡片不拦截底层点击', () => {
  it('A1 .toast-stack > * 声明 pointer-events:none（卡片本体穿透）', () => {
    const b = ruleBlock('.toast-stack > *');
    assert.ok(b, '.toast-stack > * 规则块缺失');
    assert.match(b, /pointer-events\s*:\s*none/, '卡片必须点击穿透，否则长提示会吃掉弹窗页签的点击');
  });

  it('A2 .t-action 与 .t-close 各自恢复 pointer-events:auto（互动控件仍可点）', () => {
    assert.match(ruleBlock('.toast .t-action {'), /pointer-events\s*:\s*auto/, '操作按钮必须恢复 auto');
    assert.match(ruleBlock('.toast .t-close {'), /pointer-events\s*:\s*auto/, '关闭按钮必须恢复 auto，否则关不掉提示');
  });
});

/* ---------- [G2] 弹窗期停靠底部 ---------- */
describe('v2.470 [G2] 弹窗/工作台打开时 toast 停靠底部安全区', () => {
  it('B1 存在 :has(.modal-mask:not(.hidden)) 的 toast-stack 定位规则', () => {
    assert.match(css, /body:has\(\.modal-mask:not\(\.hidden\)\)\s+\.toast-stack[,{\s]/, '缺少弹窗态 toast 定位规则');
  });

  it('B2 同时覆盖工作台与通用对话框（uiConfirm/uiPrompt）', () => {
    assert.match(css, /body:has\(#workbenchLayer:not\(\.hidden\)\)\s+\.toast-stack/, '工作台打开时也应避让');
    assert.match(css, /body:has\(\.ui-dlg-overlay\)\s+\.toast-stack/, '通用对话框打开时也应避让');
  });

  it('B3 由顶部改为底部停靠：top:auto + bottom 含安全区 env()', () => {
    const b = ruleBlock('body:has(.modal-mask:not(.hidden)) .toast-stack');
    assert.ok(b, '弹窗态 toast-stack 规则块缺失');
    assert.match(b, /top\s*:\s*auto/, '必须清掉顶部定位，否则仍会压住对话框标题');
    assert.match(b, /bottom\s*:\s*calc\([^)]*env\(safe-area-inset-bottom/, '底部停靠需计入 iOS 安全区');
  });

  it('B4 进场位移量由 --toast-y 驱动（底部停靠时自下而上，不残留向上滑）', () => {
    assert.match(ruleBlock('.toast {'), /--toast-y\s*:\s*-10px/, '.toast 应声明默认进场位移变量');
    assert.match(css, /translateY\(var\(--toast-y/, 'toast-in 关键帧应使用 --toast-y');
    assert.match(css, /body:has\(\.ui-dlg-overlay\)\s+\.toast\s*\{[^}]*--toast-y\s*:\s*10px/,
      '弹窗态应把进场位移翻转为 +10px');
  });
});

/* ---------- [G3] 顶栏偏移走变量，不用内联 top ---------- */
describe('v2.470 [G3] toast-stack 顶部偏移改由 CSS 变量传递', () => {
  it('C1 基础规则用 top: var(--toast-top, 18px)', () => {
    assert.match(ruleBlock('.toast-stack {'), /top\s*:\s*var\(--toast-top,\s*18px\)/,
      '基础 top 必须走变量，否则无法被弹窗态 top:auto 覆盖');
  });

  it('C2 JS 写入 --toast-top，禁止内联 style.top（否则压过 top:auto 把堆栈拉伸）', () => {
    assert.match(appJs, /stack\.style\.setProperty\('--toast-top'/, 'JS 应写入 --toast-top 变量');
    assert.doesNotMatch(appJs, /stack\.style\.top\s*=/, 'inline style.top 优先级高于样式表，会让底部停靠失效');
  });
});
