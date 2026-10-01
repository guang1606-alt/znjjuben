/**
 * v2.229 分页契约 v2.215 消费侧覆盖 —— 守卫 web/app.js、web/index.html、web/styles.css
 * 背景：v2.215 后端统一分页契约 { items, total, page, pageSize, limit, offset }，
 *  但 market 橱窗 loadListings 只拉默认第一页（上架 >50 条静默截断、第 2 页不可达），
 *  admin 用户表 pager 是纯文本页码、无上一页/下一页按钮（admPage 恒为 1，翻页不可达）。
 * 本文件静态断言消费侧补全不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');

function regionOf(startMark, endMark) {
  const start = src.indexOf(startMark);
  if (start < 0) return '';
  const end = src.indexOf(endMark, start);
  return end < 0 ? src.slice(start) : src.slice(start, end);
}

describe('v2.229 market 橱窗分页', () => {
  const loadRegion = regionOf('async function loadListings', 'async function openListingDetail');
  const boardRegion = regionOf('async function loadBoard', "$('mkListBtn').onclick");

  it('loadListings 传 page/pageSize 并读取 total（>50 条不再静默截断）', () => {
    assert.ok(/let mkPage = 1/.test(src), '应有 mkPage 状态');
    assert.ok(/const MK_PAGE_SIZE = 50/.test(src), '应有 MK_PAGE_SIZE（与后端 defaultLimit 对齐）');
    assert.match(loadRegion, /&page=/, 'listings 请求应带 page 参数');
    assert.match(loadRegion, /&pageSize=/, 'listings 请求应带 pageSize 参数');
    assert.match(loadRegion, /j\.total/, '应读取响应 total（真总数）');
  });

  it('翻页器渲染 + 上/下一页按钮 + 排序切换重置页码', () => {
    assert.match(src, /function renderMkPager\(/, '应有 renderMkPager');
    assert.match(loadRegion, /renderMkPager\(/, 'loadListings 应渲染翻页器');
    assert.match(src, /\$\('mkPrevPage'\)\.onclick/, '上一页应绑定 onclick');
    assert.match(src, /\$\('mkNextPage'\)\.onclick/, '下一页应绑定 onclick');
    assert.match(src, /hasPrev \? '' : ' disabled'/, '无上一页时按钮应 disabled');
    assert.match(src, /hasNext \? '' : ' disabled'/, '无下一页时按钮应 disabled');
    assert.match(src, /\$\('mkSort'\)\.onchange = \(\) => \{ mkPage = 1/, 'mkSort 切换应重置 mkPage=1');
  });

  it('榜单 Tab 模式隐藏翻页器 + 空/失败态统一 znEmptyHtml/znErrorHtml', () => {
    assert.match(boardRegion, /\$\('mkPager'\)\.classList\.add\('hidden'\)/, '榜单模式应隐藏翻页器');
    // v2.282：failed 分支允许拼接 znRetryHtml 重试行（错误态可重试）
    const trio = (src.match(/empty\.innerHTML = failed \? znErrorHtml\(t\('loadFail'\)\)( \+ znRetryHtml\('[a-z-]+'\))? : znEmptyHtml\(t\('mkEmpty'\)\)/g) || []).length;
    assert.ok(trio >= 2, `loadListings/loadBoard 空/失败态应统一 znErrorHtml/znEmptyHtml，实际 ${trio} 处`);
  });

  it('index.html：mkPager 容器存在，mkEmpty 不再被 data-i 静态覆盖', () => {
    assert.match(html, /id="mkPager"/, '应有 mkPager 容器');
    assert.doesNotMatch(html, /id="mkEmpty" data-i=/, 'mkEmpty 改动态渲染，data-i 语言切换会覆盖 innerHTML，应移除');
    assert.doesNotMatch(html, /class="notice hidden" id="mkEmpty"/, 'zn-empty 自带样式，外层 notice 双层盒应收口');
  });
});

describe('v2.229 admin 用户表翻页', () => {
  const admRegion = regionOf('async function loadAdmUsers', "$('admUserTable').querySelectorAll");

  it('pager 渲染上/下一页按钮并接线 admPage 翻页', () => {
    assert.match(src, /function renderAdmUserPager\(/, '应有 renderAdmUserPager');
    assert.match(admRegion, /renderAdmUserPager\(d\)/, 'loadAdmUsers 应渲染翻页器');
    assert.match(src, /\$\('admPrevPage'\)\.onclick/, '上一页应绑定 onclick');
    assert.match(src, /\$\('admNextPage'\)\.onclick/, '下一页应绑定 onclick');
    assert.doesNotMatch(admRegion, /admUserPager'\)\.textContent/, '纯文本页码应替换为可交互翻页器');
    assert.match(css, /\.zn-pager \{/, '应有 .zn-pager 翻页器样式');
  });
});
