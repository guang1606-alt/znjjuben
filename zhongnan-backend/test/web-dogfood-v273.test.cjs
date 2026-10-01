/**
 * v2.273 dogfood 第八轮（移动端触控可操作性 lens）——关闭键热区 + iOS 输入聚焦防缩放
 * 背景（DEMO 8099，iPhone13 模拟 390×844 / hasTouch / coarse pointer 实测证据）：
 *  全视图 0 水平溢出、nav 横滑（scrollW673>clientW344）与 topbar 不遮挡均健康；
 *  但两类触控缺陷稳定复现：
 *  ① 关闭类按钮触摸热区过小：富版 toast 的 .t-close 实测 18×20px、弹窗 .modal-x 25×24px，
 *     低于触摸目标下限（WCAG 2.5.8 AA=24px、推荐 44/48px），指尖难点中。
 *  ② iOS Safari 对 font-size<16px 的输入框聚焦时自动放大整页：640 断点只对
 *     `.field/.configbar` 容器内输入框设了 16px，遗漏容器外的登录弹窗 authPhone/authPwd
 *     （实测 14px，移动端最高频入口）、worksSearch 与 #mkSort（13.3px）。
 * 修法（纯 styles.css，零 JS/HTML 变更）：
 *  - 关闭键热区用 ::before 伪元素负向外扩到 ≈44×44（视觉 × 尺寸与布局零位移，桌面鼠标无感）：
 *    .t-close 加 position:relative；.t-close::before / .modal-x::before absolute 负 inset。
 *  - 640 断点内新增通用「文本类输入框 16px」规则：input:not(checkbox/radio/range/button/
 *    submit/file/image/color),select,textarea —— 一处覆盖容器内外全部输入，不再逐容器枚举，
 *    未来新增输入框自动受防护。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');

// 提取某选择器（精确前缀）紧邻的 { ... } 规则块
function ruleBlock(selectorPrefix) {
  const i = css.indexOf(selectorPrefix);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  if (open < 0) return '';
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}
// 提取 @media (max-width: 640px) 块（花括号配平，兼容嵌套）
function mediaBlock(header) {
  const s = css.indexOf(header);
  if (s < 0) return '';
  const open = css.indexOf('{', s);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return css.slice(open + 1, i); }
  }
  return '';
}

/* ---------- [G1] toast 关闭键伪元素热区 ---------- */
describe('v2.273 [G1] .t-close 触摸热区外扩', () => {
  it('A1 .toast .t-close 主规则块建立定位上下文 position:relative（否则伪元素相对错误祖先）', () => {
    const b = ruleBlock('.toast .t-close {');
    assert.ok(b, '.toast .t-close 规则块缺失');
    assert.match(b, /position\s*:\s*relative/);
  });

  it('A2 存在 .toast .t-close::before 规则块（伪元素热区，视觉零位移方案）', () => {
    const b = ruleBlock('.toast .t-close::before');
    assert.ok(b, '.t-close::before 规则块缺失');
    assert.match(b, /content\s*:\s*['"]{2}/);
    assert.match(b, /position\s*:\s*absolute/);
  });

  it('A3 热区垂直外扩 ≥12px（视觉高 20 + 2×12 = 44px 达推荐目标）', () => {
    const b = ruleBlock('.toast .t-close::before');
    const m = b.match(/inset\s*:\s*(-?\d+)px(?:\s+(-?\d+)px)?/);
    assert.ok(m, '缺 inset 外扩声明');
    const y = parseInt(m[1], 10);
    assert.ok(y <= -12, `垂直外扩 ${m[1]} 不足 -12px（热区达不到 44px）`);
  });

  it('A4 热区水平外扩 ≥13px（视觉宽 18 + 2×13 = 44px）', () => {
    const b = ruleBlock('.toast .t-close::before');
    const m = b.match(/inset\s*:\s*-?\d+px\s+(-?\d+)px/);
    assert.ok(m, '缺双向 inset（水平值）');
    assert.ok(parseInt(m[1], 10) <= -13, `水平外扩 ${m[1]} 不足 -13px`);
  });
});

/* ---------- [G2] 弹窗关闭键伪元素热区 ---------- */
describe('v2.273 [G2] .modal-x 触摸热区外扩', () => {
  it('B1 存在 .modal-x::before 规则块且为绝对定位伪元素', () => {
    const b = ruleBlock('.modal-x::before');
    assert.ok(b, '.modal-x::before 规则块缺失');
    assert.match(b, /content\s*:\s*['"]{2}/);
    assert.match(b, /position\s*:\s*absolute/);
  });

  it('B2 垂直外扩 ≥10px（视觉高 24 + 2×10 = 44px）', () => {
    const b = ruleBlock('.modal-x::before');
    const m = b.match(/inset\s*:\s*(-?\d+)px(?:\s+(-?\d+)px)?/);
    assert.ok(m, '缺 inset 外扩声明');
    assert.ok(parseInt(m[1], 10) <= -10, `垂直外扩 ${m[1]} 不足 -10px`);
  });

  it('B3 水平外扩 ≥9px（视觉宽 25 + 2×9 ≈ 43px）', () => {
    const b = ruleBlock('.modal-x::before');
    const m = b.match(/inset\s*:\s*-?\d+px\s+(-?\d+)px/);
    assert.ok(m, '缺双向 inset（水平值）');
    assert.ok(parseInt(m[1], 10) <= -9, `水平外扩 ${m[1]} 不足 -9px`);
  });
});

/* ---------- [G3] 移动端通用文本输入 16px 防 iOS 聚焦缩放 ---------- */
describe('v2.273 [G3] 640 断点通用输入防聚焦缩放', () => {
  const block = mediaBlock('@media (max-width: 640px)');

  it('C1 640 媒体查询块存在', () => {
    assert.ok(block.length > 0);
  });

  it('C2 存在通用文本 input 选择器且排除 checkbox/radio（不能只靠 .field 容器枚举）', () => {
    // 裸 input:not 起头（通用），且排除两个布尔控件
    assert.match(block, /(^|[\s,}])input:not\(\[type\s*=\s*['"]?checkbox['"]?\]\):not\(\[type\s*=\s*['"]?radio['"]?\]\)/);
  });

  it('C3 同规则覆盖 select 与 textarea（弹窗下拉/文本域同样 <16px 会缩放）', () => {
    assert.match(block, /input:not\([^)]*\)[^}]*,\s*select\s*,\s*textarea|select\s*,\s*textarea/);
  });

  it('C4 规则声明 font-size:16px（iOS 聚焦不缩放的临界值）', () => {
    // 找到通用 input:not 选择器所在规则块，验证其声明含 16px
    const idx = block.indexOf('input:not([type');
    assert.ok(idx >= 0, '未找到通用 input:not 选择器');
    const open = block.indexOf('{', idx);
    const close = block.indexOf('}', open);
    const decl = block.slice(open, close);
    assert.match(decl, /font-size\s*:\s*16px/);
  });
});
