/**
 * v2.472 前端 UI 契约守卫（纯静态）
 *
 * 背景：UI 巡检（scripts/ui-audit.cjs）只能证明"此刻真机没问题"，不能防止后续改动把
 * 支撑这些行为的代码删掉。本守卫把三件事固化：
 *   G1 web/index.html 用到的静态类 `.input` 必须在 styles.css 有定义（否则回落成裸控件）
 *   G2 窄屏导航横滑条必须自动把激活项滚进可视区（switchView 内 scrollIntoView inline:center）
 *   G3 横滑条必须有右侧渐隐提示，且按 scrollLeft 实时挂/摘（避免末项被永久遮淡）
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');

describe('v2.472 前端 UI 契约', () => {
  it('G1 index.html 使用的 .input 类在样式表中有定义', () => {
    if (!/class="[^"]*\binput\b/.test(html)) return; // 未使用则无需定义
    assert.match(css, /\.input\s*\{/, 'styles.css 缺少 .input 规则：输入框会回落成浏览器默认裸控件');
  });

  // v2.476：管理后台深链首屏表格异步回填会把页脚从视口内顶出（实测 CLS 0.577）。
  // 修法是给视图一个「视口高地板」；这里守住规则不被后续改样式时顺手删掉。
  it('G4 管理后台视图有视口高地板（防异步回填 CLS）', () => {
    assert.match(css, /#view-admin\s*\{[^}]*min-height:\s*calc\(100vh\s*-\s*\d+px\)/, 'styles.css 缺少 #view-admin 的 min-height 视口地板');
    assert.match(css, /@supports\s*\(min-height:\s*100dvh\)/, '需要 dvh 兜底移动端地址栏收缩');
  });

  it('G2 切视图后把激活导航项滚进可视区（横滑条上仍能看见自己所在栏目）', () => {
    const fn = app.slice(app.indexOf('function switchView('), app.indexOf('function switchView(') + 4000);
    assert.ok(fn.includes('scrollIntoView'), 'switchView 内缺少 scrollIntoView');
    assert.ok(/inline:\s*'center'/.test(fn), '需用 inline:center 让激活项居中，避免只露出一条边');
  });

  it('G3 横滑条有渐隐提示且按滚动位置实时挂/摘', () => {
    assert.match(css, /\.nav\[data-scroll="more"\]\s*\{[\s\S]{0,220}mask-image/, 'styles.css 缺少 .nav[data-scroll="more"] 的渐隐规则');
    assert.ok(app.includes('_syncNavScrollHint'), 'app.js 缺少 _syncNavScrollHint()');
    assert.ok(/_syncNavScrollHint\(\);/.test(app), '缺少滚动/缩放后的重算调用');
    assert.ok(/data-scroll/.test(app), '缺少 data-scroll 挂载逻辑');
  });
});
