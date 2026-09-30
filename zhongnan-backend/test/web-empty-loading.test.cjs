/**
 * v2.221 加载/空态统一：znSkeleton/znEmpty 收口 —— 守卫 web/app.js 与 web/styles.css
 * 背景：styles.css v3.0 的 .skeleton/.sk-list 骨架屏体系此前零使用（死样式），
 *  加载态散落 <div class="muted">加载中…</div>、空态 .muted/.notice 混拼。
 * 本文件静态断言统一收口实现不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');

function extractMarkedRegion(name) {
  const start = src.indexOf(`/* ---------- ${name}`);
  if (start < 0) return null;
  const endMarker = `/* ---------- ${name} 结束 ---------- */`;
  const end = src.indexOf(endMarker, start);
  if (end < 0) return null;
  return src.slice(start, end);
}

describe('v2.221 加载/空态统一：核心帮助函数', () => {
  const region = extractMarkedRegion('v2.221 加载/空态统一');

  it('标记区域存在且完整', () => {
    assert.ok(region, '应有标记区域「v2.221 加载/空态统一」…结束');
  });

  it('znSkeletonHtml/znSkeleton/znEmptyHtml/znEmpty 四函数齐备并 window 暴露', () => {
    assert.ok(/function znSkeletonHtml\s*\(/.test(region), '应定义 znSkeletonHtml(');
    assert.ok(/function znSkeleton\s*\(/.test(region), '应定义 znSkeleton(');
    assert.ok(/function znEmptyHtml\s*\(/.test(region), '应定义 znEmptyHtml(');
    assert.ok(/function znEmpty\s*\(/.test(region), '应定义 znEmpty(');
    assert.ok(/window\.znSkeleton = znSkeleton; window\.znEmpty = znEmpty;/.test(region),
      '应 window 暴露供独立 view js 复用');
  });

  it('骨架屏带语义：role=status + aria-busy，且复用 .skeleton/.sk-list 死样式体系', () => {
    assert.ok(/role="status" aria-busy="true"/.test(region), '加载骨架应有 role=status + aria-busy');
    assert.ok(/skeleton s-card/.test(region) && /skeleton s-line/.test(region), '应复用 .skeleton s-card/s-line 变体');
    assert.ok(/sk-list\$\{kind === 'grid' \? ' s-grid' : ''\}/.test(region), '网格形态应挂 .sk-list.s-grid');
  });

  it('空态文案经 _znEsc 转义（text 与 hint 都不得直插）', () => {
    assert.ok(/function _znEsc\s*\(/.test(region), '应定义 _znEsc 转义');
    assert.ok(/_znEsc\(text\)/.test(region) && /_znEsc\(hint\)/.test(region), 'text/hint 应走 _znEsc');
  });
});

describe('v2.221 调用点收口规模', () => {
  const skeletonCalls = (src.match(/znSkeleton\(/g) || []).length - 1; // 扣定义
  const emptyCalls = (src.match(/znEmptyHtml\(/g) || []).length - 1;  // 扣定义
  const znEmptyCalls = (src.match(/[^lL]znEmpty\(/g) || []).length - 1;

  it('加载态骨架屏替换 ≥ 14 处', () => {
    assert.ok(skeletonCalls >= 14, `znSkeleton 调用应 ≥14，实际 ${skeletonCalls}`);
  });
  it('空态统一替换 ≥ 9 处', () => {
    assert.ok(emptyCalls >= 7, `znEmptyHtml 调用应 ≥7（另有 znEmpty 直写 3 处），实际 ${emptyCalls}`);
    assert.ok(znEmptyCalls >= 2, `znEmpty 直写宿主调用应 ≥2，实际 ${znEmptyCalls}`);
  });

  it('旧临时加载态写法已清除', () => {
    assert.doesNotMatch(src, /资产库加载中/, '资产库三处临时加载文案应收口');
    assert.doesNotMatch(src, /Loading library…/, 'Loading library… 应收口');
    assert.doesNotMatch(src, /\$\('dpBody'\)\.textContent = t\('dpLoading'\)/, 'dpBody 应走 znSkeleton');
    assert.doesNotMatch(src, /<div class="muted">\$\{t\('loading'\)/, 't(loading) muted 拼接应收口');
    assert.doesNotMatch(src, /<div class="diag-loading">\$\{lang === 'en' \? 'Loading episode list…'/, 'listen 片单临时加载应收口');
  });

  it('旧临时空态写法已清除', () => {
    assert.doesNotMatch(src, /<div class="notice">\$\{lang === 'en' \? 'No posts\.' /, '暂无帖子应收口');
    assert.doesNotMatch(src, /<div class="notice">暂无报告（每日03:17/, '学习报告空态应收口为 文案+引导 hint');
    assert.doesNotMatch(src, /<div class="muted" style="padding:6px">\$\{lang === 'en' \? 'No channels\.'/, '渠道空态应收口');
    assert.doesNotMatch(src, /li\.textContent = lang === 'en' \? 'No battles yet/, 'PK 榜空态应收口');
  });
});

describe('v2.221 styles.css 配套', () => {
  it('.zn-empty 空态样式齐备', () => {
    assert.ok(/\.zn-empty \{/.test(css), '应有 .zn-empty');
    assert.ok(/\.zn-empty-ico/.test(css) && /\.zn-empty-txt/.test(css) && /\.zn-empty-hint/.test(css),
      '应有 图标/文案/引导 三子元素样式');
  });

  it('skeleton shimmer 主题自适应（中性灰，非亮色白渐变）', () => {
    assert.ok(/rgba\(128,128,128,\.16\) 50%/.test(css), 'shimmer 应为中性灰（light 主题可见）');
    assert.doesNotMatch(css, /rgba\(255,255,255,\.10\) 50%/, '旧亮色渐变应移除');
    assert.ok(/@media \(prefers-reduced-motion: reduce\) \{ \.skeleton::after \{ animation: none;/.test(css),
      'reduced-motion 下应停 shimmer');
  });
});
