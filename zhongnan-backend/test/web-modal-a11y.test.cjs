/**
 * v2.220 模态统一收口：语义/Esc/焦点/清理钩子 —— 守卫 web/app.js
 * 背景：18 个 .modal-mask 业务弹窗此前只有 data-close/遮罩两条关闭路径——
 *  Esc 仅 dpModal 专属、无 role/aria-modal 语义、开关无焦点管理、
 *  listenModal 关闭副作用靠独立监听器与通用关闭"双轨并存"。
 * 本文件静态断言收口实现不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');

function extractMarkedRegion(name) {
  const start = src.indexOf(`/* ---------- ${name}`);
  if (start < 0) return null;
  const endMarker = `/* ---------- ${name} 结束 ---------- */`;
  const end = src.indexOf(endMarker, start);
  if (end < 0) return null;
  return src.slice(start, end);
}

describe('v2.220 模态统一收口：核心实现', () => {
  const region = extractMarkedRegion('v2.220 模态统一收口');

  it('标记区域存在且完整', () => {
    assert.ok(region, '应有标记区域「v2.220 模态统一收口」…结束');
  });

  it('closeModalEl / setModalCloseHook / 焦点管理齐备', () => {
    assert.ok(/function closeModalEl\s*\(/.test(region), '应定义 closeModalEl(');
    assert.ok(/function setModalCloseHook\s*\(/.test(region), '应定义 setModalCloseHook(');
    assert.ok(/function _modalFocusables\s*\(/.test(region), '应定义 _modalFocusables(');
    assert.ok(new RegExp('_modalCloseHooks').test(region), '应有清理钩子表');
    // 关闭：钩子清理 + hidden + 焦点恢复
    assert.ok(/hook\(\)/.test(region), '关闭前应触发清理钩子');
    assert.ok(/el\._znPrevFocus/.test(region), '应记录/恢复打开前焦点');
    // 打开：焦点入模态
    assert.ok(/_modalFocusables\(el\)\[0\]/.test(region), '打开应聚焦模态内首个可聚焦元素');
    assert.ok(/first\.focus\(\)/.test(region), '应有 focus() 调用');
  });

  it('语义补齐：role=dialog + aria-modal（幂等）', () => {
    assert.ok(/setAttribute\('role', 'dialog'\)/.test(region), '应为 .modal-mask 补 role=dialog');
    assert.ok(/setAttribute\('aria-modal', 'true'\)/.test(region), '应为 .modal-mask 补 aria-modal');
  });

  it('全局 Esc 关闭最上层可见模态', () => {
    assert.ok(/addEventListener\('keydown'/.test(region), '应注册全局 keydown');
    const escBlock = region.match(/addEventListener\('keydown'[\s\S]*?\}\);/);
    assert.ok(escBlock && /\.modal-mask:not\(\.hidden\)/.test(escBlock[0]), 'Esc 处理器应选择可见 .modal-mask');
    assert.ok(/openMasks\[openMasks\.length - 1\]/.test(region), '应取最上层（DOM 序最后）模态');
  });

  it('data-close 与遮罩点击统一走 closeModalEl', () => {
    assert.ok(/data-close\]'\).forEach\(\(b\) => \{ b\.onclick = \(\) => closeModalEl\(/.test(region),
      'data-close 按钮应走 closeModalEl');
    assert.ok(/if \(e\.target === m\) closeModalEl\(m\)/.test(region), '遮罩点击应走 closeModalEl');
  });
});

describe('v2.220 周边让位与钩子接线', () => {
  it('workbench ESC 退级对打开的 .modal-mask 让位', () => {
    // 模态打开时按 Esc 只关模态，不连视图一起退回
    const hasOverlayLine = src.split('\n').find((l) => l.includes('const hasOverlay = document.querySelector'));
    assert.ok(hasOverlayLine, '应存在 workbench 的 hasOverlay 检测');
    assert.ok(/\.modal-mask:not\(\.hidden\)/.test(hasOverlayLine), 'hasOverlay 选择器应包含 .modal-mask:not(.hidden)');
  });

  it('dpModal 专属 Esc 已删除（全局 Esc 覆盖）', () => {
    assert.doesNotMatch(src, /Escape[\s\S]{0,120}\$\('dpModal'\)/, '不应再有 dpModal 专属 Escape 处理');
  });

  it('listenModal 清理经钩子接线，旧双轨监听已删除', () => {
    assert.ok(src.includes("setModalCloseHook('listenModal', listenFinish)"), 'listenModal 应注册 listenFinish 清理钩子');
    assert.doesNotMatch(src, /e\.target\.id === 'listenModal'/, '不应再有 listenModal 专属点击关闭监听（统一走 closeModalEl）');
    // beforeunload 兜底保留：页面卸载时仍要停播
    assert.ok(/window\.addEventListener\('beforeunload', listenFinish\)/.test(src), 'beforeunload 停播兜底应保留');
  });

  it('authModal 开关走收口入口（openModal/closeModalEl）', () => {
    assert.ok(/function openAuth\(mode\) \{ authMode = mode \|\| 'login'; openModal\('authModal'\)/.test(src),
      'openAuth 应走 openModal（登录弹窗焦点入首个输入框）');
    // v2.246 起 closeAuth 多行化（补 aria-invalid 清理），改为校验「closeAuth 函数体含 closeModalEl(authModal)」
    const i = src.indexOf('function closeAuth()');
    const j = src.indexOf('function syncAuthTabs', i);
    const body = i >= 0 && j > i ? src.slice(i, j) : '';
    assert.ok(body.length > 0, '应定位到 closeAuth');
    assert.ok(/closeModalEl\(\$\('authModal'\)\)/.test(body), 'closeAuth 应走 closeModalEl');
  });
});
