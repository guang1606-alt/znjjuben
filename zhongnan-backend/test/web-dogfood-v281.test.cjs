/**
 * v2.281 dogfood 第十九轮（广场/市场加载三态补全）——慢网列表加载期不得全白零反馈
 * 复现（DEMO 8099，Playwright 慢响应 2.5s）：广场 loadFeed、市场 loadListings、榜单 loadBoard
 *  在 fetch 期间容器 0 子节点、无 aria-busy，与 v2.278 修复前的作品列表同款全白；
 *  切板块/翻页/切榜单时旧内容与旧分页器数字还滞留。
 * 修法（同 v2.278 znSkeleton 范式，零 API 变更）：
 *  - znSkeletonHtml 增 'cards' kind：纵向卡片堆（s-card × 4，不带 s-grid），贴合 .feed 纵向流；
 *  - loadFeed 取数前：隐藏 sqEmpty/sqPager + znSkeleton(sqFeed,'cards')；
 *  - loadListings 取数前：隐藏 mkEmpty/mkPager + znSkeleton(mkGrid,'grid')；
 *  - loadBoard 非 all 分支取数前同款铺骨架（all 分支由 loadListings 铺）；
 *  - 完成路径既有 innerHTML='' 自然清骨架，过期响应仍由请求序号守卫作废（骨架由更新的请求覆盖）。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器；精确函数窗口防大窗口假绿）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8')
  .replace(/\/\/.*$/gm, ''); // 剥行注释

function fnBody(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = src.indexOf(endMarker, s + startMarker.length);
  return e < 0 ? src.slice(s) : src.slice(s, e);
}

const helper = fnBody('function znSkeletonHtml', 'function znSkeleton(');
const feed = fnBody('async function loadFeed', 'function renderSqPager');
const listings = fnBody('async function loadListings', 'async function openListingDetail');
const board = fnBody('async function loadBoard(', 'b.onclick = () => loadBoard(b.dataset.board)');

describe('v2.281 [R1] znSkeleton 增纵向卡片骨架 cards kind', () => {
  it("A1 cards 与 grid 同为卡片块，但 cards 不得带 s-grid（保持 .feed 纵向流）", () => {
    assert.ok(helper.length > 0, 'znSkeletonHtml 未定位');
    assert.match(helper, /kind === 'grid'\s*\|\|\s*kind === 'cards'/,
      "cards kind 必须映射到 s-card 卡片块（与 grid 并列）");
    assert.match(helper, /sk-list\$\{kind === 'grid' \? ' s-grid' : ''\}/,
      "s-grid 仅 grid 可得；cards 必须保持 sk-list 默认 flex 纵向");
  });
});

describe('v2.281 [R2] loadFeed 广场加载骨架态', () => {
  it('A2 取数前向 sqFeed 铺 cards 骨架', () => {
    assert.ok(feed.length > 0, 'loadFeed 未定位');
    assert.match(feed, /znSkeleton\([^;]*sqFeed[^;]*['"]cards['"]\)/,
      'loadFeed 必须对 sqFeed 铺 cards 骨架');
  });
  it('A3 时序：seq 自增 → 隐藏 sqEmpty/铺骨架 → fetch；骨架不得晚于请求', () => {
    const iSeq = feed.indexOf('feedReqSeq');
    const iSkl = feed.search(/znSkeleton\([^;]*sqFeed/);
    const iFetch = feed.indexOf("fetch('/api/community/posts");
    const iHideEmpty = feed.search(/sqEmpty[\s\S]{0,40}classList\.add\(['"]hidden['"]\)/);
    assert.ok(iSeq >= 0 && iSkl >= 0 && iFetch >= 0, '锚点缺失');
    assert.ok(iSeq < iSkl && iSkl < iFetch, '骨架必须在请求序号之后、fetch 之前铺');
    assert.ok(iHideEmpty >= 0 && iHideEmpty < iFetch, '加载期必须先隐藏空态容器，防空态与骨架并存');
  });
  it('A4 加载期隐藏旧分页器，完成路径仍清骨架（feed.innerHTML 清空存续）', () => {
    assert.match(feed, /sqPager[\s\S]{0,40}classList\.add\(['"]hidden['"]\)/,
      '加载期必须隐藏 sqPager，旧「共 N 条·第 X 页」不得与骨架并存');
    assert.match(feed, /feed\.innerHTML\s*=\s*''/, '完成路径必须清空容器（骨架随之清除）');
  });
});

describe('v2.281 [R3] loadListings 市场列表加载骨架态', () => {
  it('A5 取数前向 mkGrid 铺 grid 骨架并隐藏空态，时序先于 fetch', () => {
    assert.ok(listings.length > 0, 'loadListings 未定位');
    assert.match(listings, /znSkeleton\([^;]*mkGrid[^;]*['"]grid['"]\)/,
      'loadListings 必须对 mkGrid 铺 grid 骨架');
    const iSkl = listings.search(/znSkeleton\([^;]*mkGrid/);
    const iFetch = listings.indexOf("fetch('/api/market/listings?");
    const iHideEmpty = listings.search(/mkEmpty[\s\S]{0,60}classList\.add\(['"]hidden['"]\)/);
    const iHidePager = listings.search(/mkPager[\s\S]{0,40}classList\.add\(['"]hidden['"]\)/);
    assert.ok(iSkl >= 0 && iFetch >= 0 && iSkl < iFetch, '骨架必须先于 fetch');
    assert.ok(iHideEmpty >= 0 && iHideEmpty < iFetch, '加载期必须先隐藏 mkEmpty');
    assert.ok(iHidePager >= 0 && iHidePager < iFetch, '加载期必须先隐藏 mkPager');
  });
  it('A6 完成路径 grid.innerHTML 清空存续（骨架不得永久滞留）', () => {
    assert.match(listings, /grid\.innerHTML\s*=\s*''/, '完成路径必须清空 mkGrid');
  });
});

describe('v2.281 [R4] loadBoard 榜单（mkGrid 第二数据源）同样补骨架', () => {
  it('A7 非 all 分支：all 分流之后、board fetch 之前铺 mkGrid 骨架', () => {
    assert.ok(board.length > 0, 'loadBoard 未定位');
    const iAll = board.indexOf("if (type === 'all')");
    const iSkl = board.search(/znSkeleton\([^;]*mkGrid/);
    const iFetch = board.indexOf("fetch('/api/market/board");
    assert.ok(iAll >= 0 && iSkl >= 0 && iFetch >= 0, '锚点缺失');
    assert.ok(iAll < iSkl && iSkl < iFetch,
      '骨架必须在 all 分流之后（all 由 loadListings 铺）、board fetch 之前');
  });
});
