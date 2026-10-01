/**
 * v2.282 dogfood 第二十轮（主列表错误态恢复入口）——加载失败不得只剩一句报错、逼用户刷新整页
 * 复现（DEMO 8099，Playwright 三端点全 fulfill 500）：广场 #sqEmpty、市场 #mkEmpty、
 *  榜单 hot #mkEmpty 均出现 .zn-error[role=alert] 但 0 个 .zn-retry-row（exit=10 实锤）。
 * 修法（复用 v2.255 .zn-retry-row 既有范式 + 双语 Retry/重试，零 API 变更）：
 *  - znErrorHtml 旁新增 znRetryHtml(cls)：重试行 + btn-ghost 按钮，供错误态拼接；
 *  - loadFeed 失败三元 true 分支拼 znRetryHtml('sq-retry')，渲染后绑定 () => loadFeed()；
 *  - loadListings 失败态 'mk-retry' → () => loadListings()；
 *  - loadBoard 非 all 失败态 'board-retry' → () => loadBoard(curBoard)（all 由 loadListings 负责）；
 *  - 重试点击后加载函数开头（v2.281）即铺骨架+隐藏空态，错误态→骨架→数据自然闭环。
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

const helper = fnBody('function znRetryHtml', 'window.znSkeleton = znSkeleton');
const feed = fnBody('async function loadFeed', 'function renderSqPager');
const listings = fnBody('async function loadListings', 'async function openListingDetail');
const board = fnBody('async function loadBoard(', 'b.onclick = () => loadBoard(b.dataset.board)');

describe('v2.282 [R1] znRetryHtml 错误态重试行 helper（v2.255 范式收口）', () => {
  it("A1 输出 zn-retry-row > btn-ghost 按钮，文案双语 Retry/重试，class 可注入", () => {
    assert.ok(helper.length > 0, 'znRetryHtml 未定义（应位于 znError 辅助区）');
    assert.match(helper, /zn-retry-row/, '必须复用 v2.255 .zn-retry-row 样式钩子');
    assert.match(helper, /<button[^>]*class="btn-ghost/, '按钮必须挂 btn-ghost 既有按钮风格');
    assert.match(helper, /type="button"/, '必须 type=button，防表单隐式提交');
    assert.match(helper, /lang === 'en' \? 'Retry' : '重试'/, '必须双语 Retry/重试（与 eps-retry 等同款）');
    assert.match(helper, /function znRetryHtml\(\w+\)/, '必须接收 class 名参数以区分三处重试');
  });
});

describe('v2.282 [R2] loadFeed 广场错误态可重试', () => {
  it("A2 仅 failed 分支拼 znRetryHtml('sq-retry')，空态分支不得带重试", () => {
    assert.ok(feed.length > 0, 'loadFeed 未定位');
    assert.match(feed,
      /empty\.innerHTML = failed \? znErrorHtml\(t\('loadFail'\)\) \+ znRetryHtml\('sq-retry'\) : znEmptyHtml\(t\('sqEmpty'\)\)/,
      '错误三元必须为 failed ? znErrorHtml+sq-retry : znEmptyHtml');
  });
  it('A3 渲染后绑定 .sq-retry 点击 → loadFeed()，且绑定在 innerHTML 赋值之后', () => {
    const iSet = feed.indexOf("empty.innerHTML = failed");
    const m = feed.match(/empty\.querySelector\('\.sq-retry'\)[\s\S]{0,160}?\.onclick = \(\) => loadFeed\(\)/);
    assert.ok(m, '必须查询 .sq-retry 并绑定 onclick=()=>loadFeed()');
    assert.ok(iSet >= 0 && feed.indexOf(m[0]) > iSet, '绑定必须发生在 innerHTML 写入之后（否则查询不到按钮）');
  });
});

describe('v2.282 [R3] loadListings 市场错误态可重试', () => {
  it("A4 仅 failed 分支拼 znRetryHtml('mk-retry')", () => {
    assert.ok(listings.length > 0, 'loadListings 未定位');
    assert.match(listings,
      /empty\.innerHTML = failed \? znErrorHtml\(t\('loadFail'\)\) \+ znRetryHtml\('mk-retry'\) : znEmptyHtml\(t\('mkEmpty'\)\)/,
      '错误三元必须为 failed ? znErrorHtml+mk-retry : znEmptyHtml');
  });
  it('A5 渲染后绑定 .mk-retry 点击 → loadListings()（重跑当前排序/页码）', () => {
    const iSet = listings.indexOf("empty.innerHTML = failed");
    const m = listings.match(/empty\.querySelector\('\.mk-retry'\)[\s\S]{0,160}?\.onclick = \(\) => loadListings\(\)/);
    assert.ok(m, '必须查询 .mk-retry 并绑定 onclick=()=>loadListings()');
    assert.ok(iSet >= 0 && listings.indexOf(m[0]) > iSet, '绑定必须在 innerHTML 写入之后');
  });
});

describe('v2.282 [R4] loadBoard 榜单（非 all）错误态按当前榜单重试', () => {
  it("A6 失败态拼 'board-retry' 并绑定 () => loadBoard(curBoard)；窗口内仅一处 znRetryHtml", () => {
    assert.ok(board.length > 0, 'loadBoard 未定位');
    assert.match(board,
      /empty\.innerHTML = failed \? znErrorHtml\(t\('loadFail'\)\) \+ znRetryHtml\('board-retry'\) : znEmptyHtml\(t\('mkEmpty'\)\)/,
      '榜单错误三元必须为 failed ? znErrorHtml+board-retry : znEmptyHtml');
    const m = board.match(/empty\.querySelector\('\.board-retry'\)[\s\S]{0,160}?\.onclick = \(\) => loadBoard\(curBoard\)/);
    assert.ok(m, '榜单重试必须按当前 curBoard 重取（不得退回列表）');
    assert.strictEqual((board.match(/znRetryHtml\(/g) || []).length, 1,
      'loadBoard 窗口内只应有 board-retry 一处重试（all 分支错误态归 loadListings 的 mk-retry）');
  });
});

describe('v2.282 [R5] 重试即全新加载周期：取数前清空旧错误态内容（不得只 hidden 滞留）', () => {
  it('A7 三处取数前在隐藏 empty 同期清空其 innerHTML（旧 role=alert 不滞留到响应返回）', () => {
    const re = (w, id) => {
      const iHide = w.indexOf(`$('${id}').classList.add('hidden')`);
      const iClear = w.indexOf(`$('${id}').innerHTML = ''`);
      const iFetch = w.indexOf('await fetch') >= 0 ? w.indexOf('await fetch') : w.indexOf('fetch(');
      return iHide >= 0 && iClear >= 0 && iClear < iFetch && Math.abs(iClear - iHide) < 120;
    };
    assert.ok(re(feed, 'sqEmpty'), 'loadFeed 取数前必须清空 sqEmpty 内容（重试后旧错误态即时消失）');
    assert.ok(re(listings, 'mkEmpty'), 'loadListings 取数前必须清空 mkEmpty 内容');
    assert.ok(re(board, 'mkEmpty'), 'loadBoard 取数前必须清空 mkEmpty 内容');
  });
});
