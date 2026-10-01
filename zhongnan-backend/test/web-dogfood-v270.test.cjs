/**
 * v2.270 dogfood 第五轮（键盘可达性 lens）——roving tabindex 语义升级
 * 背景（DEMO 8099 + 源码勘察证据）：
 *  三组 tab 组件（市场榜单 board-tab、广场 sqTabs、后台 admTabs）均无语义角色、
 *  无方向键导航、无 roving tabindex。键盘用户按 Tab 键穿越 12 个后台 tab 才能到内容区。
 *  修法：统一实现 znBindTablist 公共函数，给三组 tab 注入 role="tablist"/role="tab"、
 *        ArrowLeft/ArrowRight（水平方向）方向键导航、Home/End 跳转、Enter/Space 激活、
 *        在激活态与非激活态之间 roving tabindex="0"/"-1" 聚焦管理。
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

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

// 辅助：确保函数体内调用了 znBindTablist
function assertCallsZnBindTablist(body, label) {
  assert.ok(/znBindTablist\s*\(/.test(body), label + ' 须调用 znBindTablist');
}

// 辅助：确保函数体中有 roving tabindex 设置（0 / -1 切换）
function assertRovingTabindex(body, label) {
  assert.ok(/tabIndex\s*=\s*[^;]*\b0\b/.test(body) || /setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]0['"]\s*\)/.test(body),
    label + ' 须有 tabindex="0" 聚焦态');
  assert.ok(/tabIndex\s*=\s*[^;]*-1/.test(body) || /setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]-1['"]\s*\)/.test(body),
    label + ' 须有 tabindex="-1" 非聚焦态');
}

// 辅助：方向键导航
function assertArrowNav(body, label) {
  assert.ok(/ArrowLeft|ArrowRight|ArrowUp|ArrowDown/.test(body),
    label + ' 须有方向键导航（ArrowLeft/ArrowRight/ArrowUp/ArrowDown）');
}

// 辅助：Home/End 支持
function assertHomeEnd(body, label) {
  assert.ok(/case\s+['"]Home['"]/.test(body) || /e\.key\s*===?\s*['"]Home['"]/.test(body),
    label + ' 须支持 Home 键跳转到首项');
  assert.ok(/case\s+['"]End['"]/.test(body) || /e\.key\s*===?\s*['"]End['"]/.test(body),
    label + ' 须支持 End 键跳转末项');
}

// 辅助：role 语义
function assertRoleSemantics(body, label) {
  assert.ok(/setAttribute\s*\(\s*['"]role['"]\s*,\s*['"]tablist['"]\s*\)/.test(body),
    label + ' 须设置 role="tablist"');
  assert.ok(/setAttribute\s*\(\s*['"]role['"]\s*,\s*['"]tab['"]\s*\)/.test(body),
    label + ' 须设置 role="tab"');
}

describe('v2.270 [K1] znBindTablist 公共函数存在且完整', () => {
  // marker 带形参：防"改名成 znBindTablistX"类变异靠子串匹配假绿（v2.270 M8 教训）
  const w = fnWindow('function znBindTablist(container', 'function ', 2000);

  it('znBindTablist 函数存在', () => {
    assert.ok(w, 'app.js 中应定义 znBindTablist 函数');
  });

  it('znBindTablist 内部实现 roving tabindex', () => {
    assertRovingTabindex(w, 'znBindTablist');
  });

  it('znBindTablist 内部实现方向键导航', () => {
    assertArrowNav(w, 'znBindTablist');
  });

  it('znBindTablist 内部支持 Home/End', () => {
    assertHomeEnd(w, 'znBindTablist');
  });

  it('znBindTablist 内部设置 ARIA 角色语义', () => {
    assertRoleSemantics(w, 'znBindTablist');
  });
});

describe('v2.270 [K2] 市场榜单 board-tabs 已接入键盘导航', () => {
  // loadBoard 中或 loadBoard 之后、且 znBindTablist 定义之后的调用点
  const body = fnWindow('function loadBoard(type)', 'function ', 1200);

  it('loadBoard 中调用 znBindTablist', () => {
    assertCallsZnBindTablist(body, 'loadBoard');
  });
});

describe('v2.270 [K3] 交流广场 sqTabs 已接入键盘导航', () => {
  const body = fnWindow('function renderSqTabs', 'function loadFeed', 800);

  it('renderSqTabs 中调用 znBindTablist', () => {
    assertCallsZnBindTablist(body, 'renderSqTabs');
  });
});

describe('v2.270 [K4] 后台管理 admTabs 已接入键盘导航', () => {
  const body = fnWindow('function renderAdmTabs', 'function loadAdmTab', 800);

  it('renderAdmTabs 中调用 znBindTablist', () => {
    assertCallsZnBindTablist(body, 'renderAdmTabs');
  });
});
