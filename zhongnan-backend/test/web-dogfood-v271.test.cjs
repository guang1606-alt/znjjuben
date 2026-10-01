/**
 * v2.271 dogfood 第六轮（网格键盘可达性 lens）——模式卡/工具卡二维方向键导航
 * 背景（DEMO 8099 + 源码勘察证据）：
 *  ① 工具箱 3 张 tool-card 是 <div>（index.html），无 tabindex、非 button，键盘用户完全到不了，
 *     只能靠 addEventListener('click') 鼠标激活 —— 最严重：不可达而非仅无方向键。
 *  ② studio #modeGrid 12 张 mode-card、首页 #homeQuickGrid 6 卡、#homeToolGrid 4 卡均为 button，
 *     但无 roving tabindex、无方向键导航，Tab 键需线性穿越全部卡片。
 *  ③ CSS 为 repeat(auto-fill, minmax(...)) 响应式列数，列数必须运行时感知（offsetTop 法）。
 * 修法：
 *  - index.html：tool-card 由 <div> 改 <button>（mode-card 样式已在 button 上验证；home-tool-card
 *    已有 button>h3/p 先例），容器加 id="toolboxGrid"。
 *  - app.js：新增公共函数 znBindGrid(container, {selector})：roving tabindex（焦点项=0 其余=-1）、
 *    四方向键（Left/Right ±1 线性 wrap；Up/Down ±列数 clamp）、Home/End、列数 offsetTop 运行时感知、
 *    focusin 跟随记忆焦点、幂等（_znGridBound 防重复绑定）。
 *  - 接入四处：renderModes（modeGrid）、renderHome（homeQuickGrid + homeToolGrid）、
 *    工具箱静态卡（toolboxGrid，_TOOL_TO_PANEL 绑定处）。
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
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

/* ---------- [G1] znBindGrid 公共函数 ---------- */
describe('v2.271 [G1] znBindGrid 公共函数存在且完整', () => {
  // marker 带形参：防"改名成 znBindGridX"类变异靠子串匹配假绿（v2.270 M8 教训）
  const w = fnWindow('function znBindGrid(container', 'function ', 2600);

  it('znBindGrid 函数存在', () => {
    assert.ok(w, 'app.js 中应定义 znBindGrid 函数');
  });

  it('znBindGrid 内部实现 roving tabindex（0 / -1 切换）', () => {
    assert.ok(/tabIndex\s*=\s*[^;]*\b0\b/.test(w) || /setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]0['"]\s*\)/.test(w),
      'znBindGrid 须有 tabindex="0" 聚焦态');
    assert.ok(/tabIndex\s*=\s*[^;]*-1/.test(w) || /setAttribute\s*\(\s*['"]tabindex['"]\s*,\s*['"]-1['"]\s*\)/.test(w),
      'znBindGrid 须有 tabindex="-1" 非聚焦态');
  });

  it('znBindGrid 内部实现四方向键导航', () => {
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].forEach((k) => {
      assert.ok(w.includes(k), 'znBindGrid 须处理 ' + k);
    });
  });

  it('znBindGrid 内部支持 Home/End', () => {
    assert.ok(/['"]Home['"]/.test(w), 'znBindGrid 须支持 Home 键跳首项');
    assert.ok(/['"]End['"]/.test(w), 'znBindGrid 须支持 End 键跳末项');
  });

  it('znBindGrid 列数运行时感知（offsetTop 分行法，适配 auto-fill 响应式）', () => {
    // 须出现 ≥2 次（top0 基准行取值 + 各元素比较取值各一处），防单点替换被救场
    const hits = w.match(/offsetTop/g) || [];
    assert.ok(hits.length >= 2, 'znBindGrid 须用 offsetTop 感知列数（基准行+行间比较两处；CSS 为 auto-fill 响应式列数，不可硬编码）');
  });

  it('znBindGrid 幂等防重复绑定', () => {
    // \b 词边界：防"_znGridBoundXX 改名"靠子串匹配救场（v2.270 M8 / v2.271 M4 教训）
    assert.ok(/_znGridBound\b/.test(w), 'znBindGrid 须有 _znGridBound 幂等标记');
    // 语义断言：幂等必须由条件判断驱动——删除 if 条件改成 if(true) 时，标记仍在但重复绑定保护已失效（M4b 教训）
    assert.ok(/if\s*\(\s*!container\._znGridBound\s*\)/.test(w),
      'znBindGrid 幂等须由 if(!container._znGridBound) 条件守卫，不可无条件绑定');
  });

  it('znBindGrid 焦点跟随（focusin/focus 时同步 roving tabindex）', () => {
    assert.ok(/focusin|addEventListener\s*\(\s*['"]focus['"]/.test(w),
      'znBindGrid 须在焦点进入时同步 roving tabindex（记忆焦点项）');
  });
});

/* ---------- [G2] studio 模式卡网格接入 ---------- */
describe('v2.271 [G2] renderModes 已接入网格方向键导航', () => {
  const body = fnWindow('function renderModes(', 'function ', 3600);
  it('renderModes 中对 modeGrid 调用 znBindGrid', () => {
    assert.ok(/znBindGrid\s*\(\s*grid/.test(body) || /znBindGrid\s*\(\s*\$\(\s*['"]modeGrid['"]\s*\)/.test(body),
      'renderModes 须对 modeGrid 调用 znBindGrid');
  });
});

/* ---------- [G3] 首页两组网格接入 ---------- */
describe('v2.271 [G3] renderHome 已接入网格方向键导航', () => {
  const body = fnWindow('function renderHome(', 'function ', 2600);
  it('renderHome 中对 homeQuickGrid 调用 znBindGrid', () => {
    assert.ok(/znBindGrid\s*\(\s*qg/.test(body) || /znBindGrid\s*\(\s*\$\(\s*['"]homeQuickGrid['"]\s*\)/.test(body),
      'renderHome 须对 homeQuickGrid 调用 znBindGrid');
  });
  it('renderHome 中对 homeToolGrid 调用 znBindGrid', () => {
    assert.ok(/znBindGrid\s*\(\s*tg/.test(body) || /znBindGrid\s*\(\s*\$\(\s*['"]homeToolGrid['"]\s*\)/.test(body),
      'renderHome 须对 homeToolGrid 调用 znBindGrid');
  });
});

/* ---------- [G4] 工具箱静态卡：div→button + 网格接入 ---------- */
describe('v2.271 [G4] 工具箱 tool-card 键盘可达', () => {
  it('toolTeardown 卡片为 <button>（不再是 div）', () => {
    assert.ok(/<button[^>]*class="mode-card tool-card"[^>]*id="toolTeardown"/.test(html),
      'toolTeardown 须为 <button class="mode-card tool-card"> 原生可聚焦元素');
  });
  it('toolDiversity / toolBranch 卡片均为 <button>', () => {
    assert.ok(/<button[^>]*class="mode-card tool-card"[^>]*id="toolDiversity"/.test(html), 'toolDiversity 须为 <button>');
    assert.ok(/<button[^>]*class="mode-card tool-card"[^>]*id="toolBranch"/.test(html), 'toolBranch 须为 <button>');
  });
  it('工具箱网格容器有 id 供绑定', () => {
    assert.ok(/<div[^>]*class="grid tool-grid"[^>]*id="toolboxGrid"/.test(html)
      || /<div[^>]*id="toolboxGrid"[^>]*class="grid tool-grid"/.test(html),
      'tool-grid 容器须有 id="toolboxGrid"');
  });
  it('app.js 中对 toolboxGrid 调用 znBindGrid', () => {
    assert.ok(/znBindGrid\s*\(\s*\$\(\s*['"]toolboxGrid['"]\s*\)/.test(src),
      '须在工具箱初始化处对 toolboxGrid 调用 znBindGrid');
  });
});
