const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.241 a11y 第二梯队：导航语义
// 地标骨架（header/nav/main/footer）已存在，缺口为：
// ① 主 <nav class="nav"> 无 aria-label（页面有多个 nav：主导航 + 面包屑，读屏无法区分）；
// ② 视图切换仅靠 .on/.active class 表达激活态，屏幕阅读器无感知——需 aria-current 同步：
//    data-view 按钮激活用 "page"，data-open 面板按钮用 "true"（非页面语义），
//    两处清理循环（switchView / data-open 分支）必须同步移除 aria-current 防残留错位。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const sliceBetween = (s, a, b) => { const i = s.indexOf(a); const j = i >= 0 ? s.indexOf(b, i) : -1; return i >= 0 && j > i ? s.slice(i, j) : ''; };

describe('v2.241 a11y：导航语义（aria-label 地标区分 + aria-current 激活同步）', () => {
  it('主导航 nav 有 aria-label 与面包屑 nav 区分', () => {
    const m = html.match(/<nav class="nav"[^>]*>/);
    assert.ok(m, '应存在 <nav class="nav">');
    assert.match(m[0], /aria-label="[^"]+"/, '主 nav 缺 aria-label（与面包屑 nav 无法区分）');
  });

  it('初始激活 nav-item（home）带 aria-current="page"，且全文件 aria-current 仅 1 处（其余由 JS 动态管理）', () => {
    const m = html.match(/<button class="on nav-item active"[^>]*data-view="home"[^>]*>/);
    assert.ok(m, '应存在初始激活的 home nav-item');
    assert.match(m[0], /aria-current="page"/, '初始激活项缺 aria-current="page"');
    const all = html.match(/aria-current=/g) || [];
    assert.equal(all.length, 1, `index.html 静态 aria-current 应仅初始项 1 处（当前 ${all.length}），其余由 JS 管理`);
  });

  it('switchView 激活循环同步 aria-current：激活 setAttribute page，未激活 removeAttribute', () => {
    const region = sliceBetween(appSrc, 'function switchView(v)', '// v2.200');
    assert.ok(region.length > 0, '应定位到 switchView 函数体');
    assert.match(region, /setAttribute\('aria-current', 'page'\)/, 'switchView 激活分支缺 setAttribute aria-current page');
    assert.match(region, /removeAttribute\('aria-current'\)/, 'switchView 未激活分支缺 removeAttribute aria-current');
  });

  it('两处 nav 清理循环（remove active/on）都同步 removeAttribute aria-current 防残留', () => {
    const cleanLoops = [...appSrc.matchAll(/document\.querySelectorAll\('\.nav \.nav-item'\)\.forEach\([\s\S]{0,200}?remove\('active', 'on'\)[\s\S]{0,200}?\}\);/g)];
    assert.ok(cleanLoops.length >= 2, `应至少 2 处清理循环（当前 ${cleanLoops.length}）`);
    for (const c of cleanLoops) {
      assert.match(c[0], /removeAttribute\('aria-current'\)/, '清理循环未同步移除 aria-current，切换后旧激活态残留');
    }
  });

  it('data-open 面板按钮激活设 aria-current="true"（非页面语义不用 page）', () => {
    const region = sliceBetween(appSrc, "querySelectorAll('.nav [data-open]')", "querySelectorAll('.nav [data-nav]')");
    assert.ok(region.length > 0, '应定位到 data-open 分支');
    assert.match(region, /setAttribute\('aria-current', 'true'\)/, 'data-open 激活缺 aria-current="true"');
    assert.doesNotMatch(region, /aria-current', 'page'/, 'data-open 面板按钮不应用 page 语义');
  });
});
