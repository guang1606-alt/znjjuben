/**
 * v2.477 移动端键盘遮挡契约守卫（纯静态）
 *
 * 背景：iOS Safari 弹起键盘时不会缩小布局视口（`vh` 不变），底部抽屉式弹窗
 * （移动端 `.modal-mask` 是 `align-items: flex-end` + `max-height: 92vh`）会被键盘整体压住，
 * 正在输入的字段看不见，表现为「点了没反应 / 输入框不见了」。桌面端差值恒为 0，不能受影响。
 *
 * 守卫目的：把「用 visualViewport 差值收缩并抬升底部层」这套接线固化，
 * 防止后续改样式或改初始化顺序时把它删掉。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');

describe('v2.477 移动端键盘遮挡', () => {
  it('K1 用 visualViewport 量键盘高度并监听 resize', () => {
    assert.match(app, /function initKeyboardInset\(\)/, 'app.js 缺少 initKeyboardInset()');
    assert.match(app, /window\.visualViewport|visualViewport/, '必须读取 visualViewport');
    const fn = app.slice(app.indexOf('function initKeyboardInset('), app.indexOf('function initKeyboardInset(') + 2200);
    assert.match(fn, /addEventListener\('resize'/, '必须监听 visualViewport 的 resize');
    assert.match(fn, /innerHeight\s*-\s*vv\.height/, '键盘高度 = innerHeight - visualViewport.height（含 offsetTop）');
  });

  it('K2 把键盘高度写进 --kb-inset 并挂 data-kb 供 CSS 分支', () => {
    const fn = app.slice(app.indexOf('function initKeyboardInset('), app.indexOf('function initKeyboardInset(') + 2200);
    assert.match(fn, /setProperty\('--kb-inset'/, '必须写 --kb-inset 变量');
    assert.match(fn, /toggleAttribute\('data-kb'/, '必须在键盘弹起时挂 data-kb 属性');
  });

  it('K3 默认值必须为 0px（桌面端与无键盘时零影响）', () => {
    assert.match(css, /--kb-inset:\s*0px/, 'styles.css 缺少 --kb-inset: 0px 默认值');
  });

  it('K4 移动端底部抽屉按键盘高度抬升并收缩', () => {
    assert.match(css, /html\[data-kb\]\s+\.modal-mask\s*\{[^}]*padding-bottom:\s*var\(--kb-inset/, '键盘弹起时 .modal-mask 必须按 --kb-inset 抬升');
    assert.match(css, /\.modal,\s*\.modal-wide\s*\{[^}]*max-height:\s*calc\(92vh\s*-\s*var\(--kb-inset/, '弹窗 max-height 必须扣掉键盘高度，否则内容仍被压住');
  });

  it('K5 底部浮层（toast / 悬浮球）同样避开键盘', () => {
    assert.match(css, /\.toast-stack[\s\S]{0,400}bottom:\s*calc\(18px\s*\+\s*env\(safe-area-inset-bottom[^)]*\)\s*\+\s*var\(--kb-inset/, 'toast 底部停靠必须叠加 --kb-inset');
    assert.match(css, /\.xn-float\s*\{[^}]*bottom:\s*calc\(14px\s*\+\s*var\(--kb-inset/, '移动端悬浮球必须抬到键盘之上');
  });

  it('K6 启动时必须接线（否则整套规则不会生效）', () => {
    assert.match(app, /initKeyboardInset\(\);/, 'bootstrap 未调用 initKeyboardInset()');
  });
});
