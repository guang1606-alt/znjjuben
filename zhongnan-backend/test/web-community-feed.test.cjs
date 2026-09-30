/**
 * v2.230 交流广场分页消费侧 —— 守卫 web/app.js、web/index.html
 * 背景：v2.230 后端 GET /api/community/posts 纳入分页统一契约（v2.215 六键），
 *  裸数组 + take 50 静默截断退役（>50 帖第 2 页不可达）；前端 loadFeed 补 page/pageSize
 *  参数并消费 total 翻页；错误/空态收口 znErrorHtml/znEmptyHtml（v2.223 三态体系漏网点，
 *  与 v2.229 #mkEmpty 同族：data-i/notice 静态绑定退役）。
 * 本文件静态断言消费侧补全不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

function regionOf(startMark, endMark) {
  const start = src.indexOf(startMark);
  if (start < 0) return '';
  const end = src.indexOf(endMark, start);
  return end < 0 ? src.slice(start) : src.slice(start, end);
}

describe('v2.230 交流广场分页消费', () => {
  const tabsRegion = regionOf('function renderSqTabs', 'async function loadFeed');
  const feedRegion = regionOf('async function loadFeed', "$('sqSubmit').onclick");

  it('loadFeed 传 page/pageSize 并消费 items/total（>50 帖不再静默截断）', () => {
    assert.ok(/let sqPage = 1/.test(src), '应有 sqPage 状态');
    assert.ok(/const SQ_PAGE_SIZE = 50/.test(src), '应有 SQ_PAGE_SIZE（与后端 defaultLimit 对齐）');
    assert.match(feedRegion, /&page=/, '请求应带 page 参数');
    assert.match(feedRegion, /&pageSize=/, '请求应带 pageSize 参数');
    assert.match(feedRegion, /j\.items/, '应读取响应 items');
    assert.match(feedRegion, /j\.total/, '应读取响应 total（真总数）');
  });

  it('翻页器渲染 + 上/下一页接线 + 分区切换重置页码', () => {
    assert.match(src, /function renderSqPager\(/, '应有 renderSqPager');
    assert.match(feedRegion, /renderSqPager\(/, 'loadFeed 应渲染翻页器');
    assert.match(src, /\$\('sqPrevPage'\)\.onclick/, '上一页应绑定 onclick');
    assert.match(src, /\$\('sqNextPage'\)\.onclick/, '下一页应绑定 onclick');
    assert.match(tabsRegion, /sqPage = 1/, '分区切换应重置 sqPage=1');
  });

  it('空/失败态统一 znEmptyHtml/znErrorHtml，旧式 textContent 退役', () => {
    assert.match(feedRegion, /failed \? znErrorHtml\(t\('loadFail'\)\) : znEmptyHtml\(t\('sqEmpty'\)\)/, 'sqEmpty 应统一三态');
    assert.doesNotMatch(feedRegion, /empty\.textContent/, '旧式 textContent 错误态应退役');
  });

  it('index.html：sqPager 容器存在，sqEmpty 不再被 data-i/notice 静态覆盖', () => {
    assert.match(html, /id="sqPager"/, '应有 sqPager 容器');
    assert.doesNotMatch(html, /id="sqEmpty" data-i=/, 'sqEmpty 改动态渲染，data-i 语言切换会覆盖 innerHTML，应移除');
    assert.doesNotMatch(html, /class="notice hidden" id="sqEmpty"/, 'zn-empty 自带样式，外层 notice 双层盒应收口');
  });
});
