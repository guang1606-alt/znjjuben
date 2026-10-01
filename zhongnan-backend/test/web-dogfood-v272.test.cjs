/**
 * v2.272 dogfood 第七轮（键盘可达性收尾 lens）——skip link「跳到主内容」
 * 背景（DEMO 8099 匿名/登录双态全视图巡检证据）：
 *  0 pageerror / 0 console.error / 0 4xx-5xx；三空视图均为正常 znEmpty；toast 已有
 *  aria-live=polite；模态（v2.220 焦点移入/归还/Tab 圈闭/Esc）、工作台（v2.242/243
 *  同款收口）、tablist（v2.270）、grid（v2.271）均已闭环。
 *  唯一缺口：页面无 skip link —— 键盘/读屏用户每次进页面必须 Tab 穿过 11 个导航项 +
 *  4 个顶栏控件才能到主内容（焦点路径第一环缺失）。
 * 修法（标准 WAI skip-link 形态）：
 *  - index.html：body 首元素加 <a class="skip-link" href="#mainContent" data-i=...>；
 *    <main class="wrap"> 加 id="mainContent" tabindex="-1"（编程聚焦承接，不进 Tab 序列）。
 *  - styles.css：.skip-link 默认离屏（position:absolute;left:-9999px），:focus 时归位
 *    left:0 + 高 z-index（键盘用户可见，鼠标用户无感）。
 *  - i18n.js：skipToMain 中英文案。
 *  - app.js：点击/Enter 激活时 preventDefault + getElementById(hash) + focus()，
 *    跨浏览器保证焦点（含读屏光标）真正落到 main，而非仅 URL hash 滚动。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const srcRaw = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const src = srcRaw.replace(/\/\/.*$/gm, '');
const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(webDir, 'styles.css'), 'utf8');
const i18n = fs.readFileSync(path.join(webDir, 'i18n.js'), 'utf8');

function fnWindow(startMarker, endMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  if (e > s) return src.slice(s, e);
  return src.slice(s, s + (maxLen || 4000));
}

/* ---------- [G1] index.html：skip link + main 承接点 ---------- */
describe('v2.272 [G1] index.html skip link 结构', () => {
  it('A1 body 首元素存在 skip-link 锚点且 href 指向 mainContent（完整标签形态，防改名/改锚救场）', () => {
    // <a ... class="skip-link" ... href="#mainContent" ...>：锚点与 class 同一标签
    assert.match(html, /<a\b[^>]*\bclass="skip-link"[^>]*\bhref="#mainContent"[^>]*>/);
  });

  it('A2 skip link 位于 <header> 之前（Tab 第一站，否则失去意义）', () => {
    const iLink = html.indexOf('class="skip-link"');
    const iHeader = html.indexOf('<header');
    assert.ok(iLink > 0 && iHeader > 0 && iLink < iHeader, 'skip-link 必须在 header 之前');
  });

  it('A3 skip link 挂 data-i 键支持中英双语', () => {
    assert.match(html, /<a\b[^>]*\bclass="skip-link"[^>]*\bdata-i="skipToMain"/);
  });

  it('A4 <main> 有 id="mainContent" 且 tabindex="-1"（编程聚焦承接但不进 Tab 序列）', () => {
    assert.match(html, /<main\b[^>]*\bid="mainContent"[^>]*\btabindex="-1"[^>]*>/);
  });
});

/* ---------- [G2] styles.css：离屏隐藏 + focus 归位 ---------- */
describe('v2.272 [G2] styles.css skip link 视觉形态', () => {
  it('B1 .skip-link 默认绝对定位离屏（left 负向），不可见也不占布局', () => {
    const m = css.match(/\.skip-link\s*\{([^}]*)\}/);
    assert.ok(m, '.skip-link 规则块缺失');
    const body = m[1];
    assert.match(body, /position\s*:\s*absolute/);
    // left:-9999px / left:-100vw / translateX(-100%) 任一离屏手法
    assert.ok(/left\s*:\s*-\d/.test(body) || /translateX\(\s*-100%/.test(body), '必须有负向离屏位移');
  });

  it('B2 .skip-link:focus（含 -visible）时归位可见 left:0', () => {
    const m = css.match(/\.skip-link:focus(?:-visible)?\s*\{([^}]*)\}/);
    assert.ok(m, '.skip-link:focus 规则块缺失');
    assert.match(m[1], /left\s*:\s*0/);
  });

  it('B3 focus 态 z-index 高于 topbar（不被导航栏遮挡）', () => {
    const m = css.match(/\.skip-link:focus(?:-visible)?\s*\{([^}]*)\}/);
    assert.match(m[1], /z-index\s*:\s*\d{3,}/);
  });
});

/* ---------- [G3] i18n：中英文案 ---------- */
describe('v2.272 [G3] i18n skipToMain 双语文案', () => {
  it('C1 中文案存在', () => {
    assert.match(i18n, /skipToMain\s*:\s*'跳到主内容'/);
  });
  it('C2 英文案存在', () => {
    assert.match(i18n, /skipToMain\s*:\s*'Skip to main content'/i);
  });
});

/* ---------- [G4] app.js：激活后焦点真正落到 main ---------- */
describe('v2.272 [G4] app.js skip link 焦点增强', () => {
  const w = fnWindow("querySelectorAll('.skip-link')", null, 900);

  it('D1 存在 .skip-link 统一绑定窗口（marker 带选择器实参，防改名救场）', () => {
    assert.ok(w.length > 0, '未找到 skip-link 绑定窗口');
  });

  it('D2 激活时 preventDefault（不让裸 hash 变化替代焦点移动）', () => {
    assert.match(w, /\.addEventListener\(\s*'click'/);
    assert.match(w, /preventDefault\(\)/);
  });

  it('D3 由 href 取目标 id 并 focus（跨浏览器保证读屏焦点落到 main）', () => {
    assert.match(w, /getAttribute\(\s*'href'\s*\)[^;]*\.slice\(1\)/);
    assert.match(w, /getElementById\(/);
    assert.match(w, /\.focus\(/);
  });
});
