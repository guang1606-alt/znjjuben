/**
 * v2.221 加载/空态统一 + v2.223 错误态统一（znSkeleton/znEmpty/znError）—— 守卫 web/app.js 与 web/styles.css
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

describe('v2.222 独立 view js 接入统一帮助函数', () => {
  // view js 均在 app.js 之后加载（index.html 脚本序），window.znSkeleton/znEmpty* 可直接用
  const viewSrc = {};
  for (const f of ['room-view.js', 'teardown-view.js', 'diversity-view.js', 'branch-view.js']) {
    viewSrc[f] = fs.readFileSync(path.join(WEB, f), 'utf8');
  }

  it('room-view 历史记录：加载走骨架屏、空态走 znEmptyHtml（旧 td-hist-card 纯文本写法收口）', () => {
    const s = viewSrc['room-view.js'];
    assert.doesNotMatch(s, /<div class="td-hist-card">\$\{T\(\)\.histLoading\}<\/div>/, 'histLoading 纯文本卡片应收口');
    assert.doesNotMatch(s, /<div class="td-hist-card">\$\{t\.histEmpty\}<\/div>/, 'histEmpty 纯文本卡片应收口');
    assert.ok(/znSkeleton\(/.test(s), 'room-view 应调用 znSkeleton');
    assert.ok(/znEmptyHtml\(/.test(s), 'room-view 应调用 znEmptyHtml');
  });

  it('teardown-view 拆解记录：加载/空态收口（旧 p.muted 写法清除）', () => {
    const s = viewSrc['teardown-view.js'];
    assert.doesNotMatch(s, /<p class="muted">\$\{esc\(t\.histLoading\)\}<\/p>/, 'histLoading p.muted 应收口');
    assert.doesNotMatch(s, /<p class="muted">\$\{esc\(t\.histEmpty\)\}<\/p>/, 'histEmpty p.muted 应收口');
    assert.ok(/znSkeleton\(/.test(s) && /znEmptyHtml\(/.test(s), 'teardown-view 应接入 znSkeleton/znEmptyHtml');
  });

  it('diversity-view 对比中加载态走骨架屏（旧 muted 拼接清除）', () => {
    const s = viewSrc['diversity-view.js'];
    assert.doesNotMatch(s, /<div class="muted">\$\{T\(\)\.comparing\}<\/div>/, 'comparing muted 应收口');
    assert.ok(/znSkeleton\(/.test(s), 'diversity-view 应调用 znSkeleton');
  });

  it('branch-view 检视空态走 znEmptyHtml（旧 muted 空态清除）', () => {
    const s = viewSrc['branch-view.js'];
    assert.doesNotMatch(s, /<div class="muted">\$\{t\.insEmpty\}<\/div>/, 'insEmpty muted 空态应收口');
    assert.ok(/znEmptyHtml\(/.test(s), 'branch-view 应调用 znEmptyHtml');
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

describe('v2.223 错误态统一：znErrorHtml/znError', () => {
  const region = extractMarkedRegion('v2.221 加载/空态统一');

  it('znErrorHtml/znError 齐备并 window 暴露，role=alert + _znEsc 转义', () => {
    assert.ok(region, '统一帮助函数区域应存在');
    assert.ok(/function znErrorHtml\s*\(/.test(region), '应定义 znErrorHtml(');
    assert.ok(/function znError\s*\(/.test(region), '应定义 znError(');
    assert.ok(/window\.znErrorHtml = znErrorHtml;/.test(region) && /window\.znError = znError;/.test(region),
      '应 window 暴露供独立 view js 复用');
    assert.ok(/role="alert"/.test(region), '错误态应有 role=alert（即时播报）');
    assert.ok(/_znEsc\(text\)/.test(region) && /_znEsc\(hint\)/.test(region), 'text/hint 应走 _znEsc');
  });

  it('调用点规模：app.js 错误态 znErrorHtml ≥5 处', () => {
    const errCalls = (src.match(/znErrorHtml\(/g) || []).length - 1; // 扣定义
    assert.ok(errCalls >= 5, `znErrorHtml 调用应 ≥5，实际 ${errCalls}`);
  });

  it('旧错误态写法已清除（notice err / muted 当错误用 / 内联 danger hack）', () => {
    assert.doesNotMatch(src, /<div class="notice err">/, 'notice err 应收口为 znErrorHtml');
    assert.doesNotMatch(src, /<p class="muted">\$\{escapeHtml\(\(e && e\.message\)/, 'modal 内 p.muted 当错误用应收口');
    assert.doesNotMatch(src, /style="border-color:var\(--danger/, '内联 danger 边框 hack 应收口');
  });

  it('旧加载/空态残留已清除（第二轮收口）', () => {
    assert.doesNotMatch(src, /<div class="muted">\$\{lang === 'en' \? 'Evaluating value…'/, '价值预览加载态应收口为骨架屏');
    assert.doesNotMatch(src, /<p class="muted">\$\{lang === 'en' \? 'Evaluating…'/, '价值卡加载态应收口为骨架屏');
    assert.doesNotMatch(src, /<div class="muted">\$\{lang === 'en' \? 'No episodes yet — value reference unavailable/,
      '价值预览空态应收口为 znEmptyHtml（文案+引导）');
    assert.doesNotMatch(src, /segBox\.textContent = lang === 'en' \? 'No playable episodes yet\.'/, '朗读片单空态应收口');
    assert.doesNotMatch(src, /<span class="muted">暂无自定义供应商/, '供应商列表空态应收口');
  });
});

describe('v2.223 view js 错误态接入 + styles.css 配套', () => {
  it('teardown-view 历史失败态走 znErrorHtml（旧 p.muted 错误写法清除）', () => {
    const s = fs.readFileSync(path.join(WEB, 'teardown-view.js'), 'utf8');
    assert.doesNotMatch(s, /<p class="muted">\$\{esc\(r\.data\.message/, '接口失败态 p.muted 应收口');
    assert.doesNotMatch(s, /<p class="muted">\$\{esc\(t\.histFail\)\}/, 'catch 失败态 p.muted 应收口');
    assert.ok(/znErrorHtml\(/.test(s), 'teardown-view 应调用 znErrorHtml');
  });

  it('room-view 历史失败态走 znErrorHtml（旧 td-hist-card 冒充记录卡片清除）', () => {
    const s = fs.readFileSync(path.join(WEB, 'room-view.js'), 'utf8');
    assert.doesNotMatch(s, /<div class="td-hist-card">\$\{esc\(errMsg\(e\)\)\}<\/div>/, '失败态不应冒充历史记录卡片');
    assert.ok(/znErrorHtml\(/.test(s), 'room-view 应调用 znErrorHtml');
  });

  it('.zn-error 样式齐备（图标/文案/引导，--danger 主题令牌）', () => {
    assert.ok(/\.zn-error \{/.test(css), '应有 .zn-error');
    assert.ok(/\.zn-error-ico/.test(css) && /\.zn-error-txt/.test(css) && /\.zn-error-hint/.test(css),
      '应有 图标/文案/引导 三子元素样式');
    assert.ok(/\.zn-error[^}]*var\(--danger/.test(css), '应使用 --danger 主题令牌（含回退）');
  });
});

describe('v2.224 错误态第二轮扫尾（muted 当错误用清零 + listen/PK榜/超管目录收口）', () => {
  it('muted 当错误用清零（loadCatalog×2 / 反馈箱 / 买家详情）', () => {
    assert.doesNotMatch(src, /<div class="muted">\$\{t\('loadFail'\)\}/,
      'loadCatalog 失败态 muted 应收口为 znError');
    assert.doesNotMatch(src, /<div class="muted">\$\{esc\(e\.message \|\| 'error'\)\}/,
      '反馈箱 catch muted 应收口为 znErrorHtml');
    assert.doesNotMatch(src, /<div class="muted">\$\{e\.error \|\| 'error'\}/,
      '买家详情失败态 muted 应收口为 znErrorHtml');
  });

  it('listen 弹窗 3 处失败态 textContent 收口为 znErrorHtml（保留 token 防竞态）', () => {
    assert.doesNotMatch(src, /segBox\.textContent = e\.message \|\|/,
      'segBox 失败态 textContent 应收口为 znErrorHtml');
  });

  it('PK 榜失败态 textContent 收口为 znErrorHtml', () => {
    assert.doesNotMatch(src, /card\.textContent = \(e && e\.message\)/,
      'PK 榜失败态应走 znErrorHtml');
  });

  it('超管 API 目录失败态收口为 znError（骨架屏占位替换）', () => {
    assert.doesNotMatch(src, /c\.textContent = '清单加载失败，可重试'/,
      'admApiDir 失败态应走 znError');
  });

  it('买家详情 INTERNAL_ERROR 回落本地友好文案（v2.216 契约速查落实）', () => {
    assert.ok(/INTERNAL_ERROR/.test(src.slice(src.indexOf('openListingDetail'), src.indexOf('openListingDetail') + 3000)),
      '买家详情失败分支应对 INTERNAL_ERROR 显示本地文案而非错误码');
  });

  it('znErrorHtml 调用规模扩至 ≥12 处', () => {
    const errCalls = (src.match(/znErrorHtml\(/g) || []).length - 1;
    assert.ok(errCalls >= 12, `znErrorHtml 调用应 ≥12，实际 ${errCalls}`);
  });
});
