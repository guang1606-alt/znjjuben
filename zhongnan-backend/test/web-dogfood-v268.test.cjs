/**
 * v2.268 dogfood 第三轮收口（新用户首用路径 + 键盘可达性双 lens，DEMO 8099 实证三处）：
 *  1. [K1] 弹窗无焦点陷阱：v2.220 openModal 把焦点移入弹窗，但全局 keydown 只处理 Esc，
 *     不处理 Tab。实测 authModal 打开后连按 Tab，焦点序列逃出弹窗落到背景
 *     loginBtn → mkSort → mkListBtn → 榜单 tab → xnFloat（背景可交互元素在弹窗
 *     打开时仍可聚焦，读屏/键盘用户上下文丢失）。修法：模态统一收口区的全局 keydown
 *     增加 Tab/Shift+Tab 圈闭——有可见 .modal-mask 时，焦点限定在最上层 mask 的
 *     _modalFocusables 内循环（到底回头、到顶回尾；焦点在弹窗外则拉回第一个）。
 *  2. [K2] .modal-x 关闭按钮焦点不可见：styles.css 仅 :hover 变色，无 :focus-visible
 *     规则；openModal 自动聚焦的第一个可交互元素恰是 × 按钮（实测 computed outline
 *     为 none、box-shadow none），键盘用户不知道焦点在哪。修法：补 .modal-x:focus-visible
 *     可见描边（与全局按钮焦点环同色系）。
 *  3. [K3] qsMask 快捷搜索嵌套 dialog：wireQuickSwitcher 内层 .modal 模板硬编码
 *     role="dialog"，而 v2.220 统一收口已给外层 .modal-mask 幂等补 role/aria-modal，
 *     同一弹窗双层 dialog 为无效 ARIA（读屏重复宣告）。修法：内层模板去掉硬编码
 *     role（mask 层语义由统一收口保证），保留 placeholder 的 Esc 提示。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const srcRaw = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
// 剥行注释后再匹配代码形态（防注释文字击中断言造成假红）
const src = srcRaw.replace(/\/\/.*$/gm, '');
const css = fs.readFileSync(path.join(webDir, 'styles.css'), 'utf8');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

describe('v2.268 [K1] 弹窗打开时 Tab 焦点必须圈闭在最上层 mask 内', () => {
  // 模态统一收口区：从 v2.220 注释头到反馈中心注释头之间
  const w = fnWindow('v2.220 模态统一收口', 'v2.185.14 c194');

  it('模态统一收口区可定位', () => {
    assert.ok(w.length > 500, '应定位到 v2.220 模态统一收口区');
    assert.ok(/_modalFocusables/.test(w), '区内应含 _modalFocusables 辅助函数');
  });

  it('全局 keydown 处理 Tab（不止 Esc）', () => {
    assert.ok(/e\.key\s*===?\s*['"]Tab['"]/.test(w),
      '统一收口区 keydown 必须处理 Tab 键（实测焦点从 authModal 逃到背景 mkSort）');
  });

  it('Tab 圈闭基于最上层可见 .modal-mask 与 _modalFocusables', () => {
    assert.ok(/modal-mask:not\(\.hidden\)/.test(w), '应以 .modal-mask:not(.hidden) 判定当前有打开弹窗');
    // 圈闭须引用 _modalFocusables 计算弹窗内可聚焦元素
    const tabPos = w.indexOf("'Tab'");
    assert.ok(tabPos > 0, 'Tab 分支存在');
    const tabBlock = w.slice(tabPos, tabPos + 1200);
    assert.ok(/_modalFocusables/.test(tabBlock), 'Tab 分支须用 _modalFocusables 取弹窗内可聚焦元素列表');
  });

  it('Shift+Tab 反向循环与正向循环都存在（到底回头、到顶回尾）', () => {
    assert.ok(/shiftKey/.test(w), 'Tab 圈闭须区分 shiftKey（反向）');
    assert.ok(/preventDefault\s*\(\s*\)/.test(w), '圈闭须 preventDefault 阻止默认跳出');
  });
});

describe('v2.268 [K2] .modal-x 关闭按钮必须有可见焦点态', () => {
  it('styles.css 存在 .modal-x:focus-visible 规则', () => {
    assert.ok(/\.modal-x:focus-visible/.test(css),
      '.modal-x 必须补 :focus-visible 样式（openModal 自动聚焦 × 按钮，computed outline 为 none）');
  });

  it('.modal-x:focus-visible 规则含可见描边（outline 或 box-shadow）', () => {
    const m = css.match(/\.modal-x:focus-visible\s*\{([^}]*)\}/);
    assert.ok(m, '应能截取 .modal-x:focus-visible 规则体');
    assert.ok(/outline|box-shadow/.test(m[1]), '焦点态须有 outline 或 box-shadow 可见描边');
  });
});

describe('v2.268 [K3] qsMask 内层不得硬编码 role="dialog"（mask 层语义由统一收口补齐）', () => {
  const w = fnWindow('function wireQuickSwitcher', '登录/注册', 3000);

  it('wireQuickSwitcher 可定位且 qsMask 仍创建', () => {
    assert.ok(w, '应定位到 wireQuickSwitcher');
    assert.ok(/qsMask/.test(w), '应仍创建 qsMask');
  });

  it('内层 .modal 模板不再硬编码 role="dialog"', () => {
    assert.ok(!/<div class="modal" role="dialog"/.test(w),
      '内层模板硬编码 role="dialog" 与 mask 层（统一收口补齐）形成嵌套 dialog，必须移除');
  });

  it('Esc 关闭提示与键盘行为保留（无回归）', () => {
    assert.ok(/Esc 关闭/.test(w), 'placeholder 的 Esc 关闭提示须保留');
    assert.ok(/e\.key\s*===?\s*['"]Escape['"]/.test(w), 'Esc 关闭行为须保留');
  });
});
