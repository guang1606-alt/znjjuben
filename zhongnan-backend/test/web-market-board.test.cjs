/**
 * v2.231 市场榜单 total 消费 —— 守卫 web/app.js、web/index.html、web/i18n.js
 * 背景：GET /api/market/board 契约 { type, total, items }（v2.215 起total=过滤后真总数，
 *  limit 上限 50、take 500 截断硬帽），但前端 loadBoard 既不传 limit（吃默认 20）、
 *  也不消费 total（>20 条静默不可见，>500 硬帽静默截断）——v2.156 截断提示铁律漏网点。
 * 本文件静态断言消费侧补全不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8');

function regionOf(startMark, endMark) {
  const start = src.indexOf(startMark);
  if (start < 0) return '';
  const end = src.indexOf(endMark, start);
  return end < 0 ? src.slice(start) : src.slice(start, end);
}

describe('v2.231 市场榜单 total 消费', () => {
  const boardRegion = regionOf('async function loadBoard', "$('mkListBtn').onclick");

  it('loadBoard 传 limit=50 拉满榜单页大小（默认 20 退役）', () => {
    assert.match(boardRegion, /\/api\/market\/board\?type=' \+ type \+ '&limit=/, '请求应带 limit 参数');
    assert.match(boardRegion, /BOARD_LIMIT = 50/, '应有 BOARD_LIMIT=50 常量（对齐后端 maxLimit）');
  });

  it('loadBoard 消费 data.total 并渲染 #mkBoardMeta（共 X 条 + 截断提示）', () => {
    assert.match(boardRegion, /Number\(data\.total\)/, '应读取响应 total（真总数）');
    assert.match(boardRegion, /t\('boardTotal'/, '应渲染共 X 条上榜提示');
    assert.match(boardRegion, /t\('boardTrunc'/, 'total > 展示条数时应有截断提示（v2.156 铁律）');
    assert.match(boardRegion, /const showMeta = !failed/, '失败/空态不显示 meta（空态由 #mkEmpty 承担）');
    assert.match(boardRegion, /meta\.classList\.toggle\('hidden',\s*!showMeta/, 'meta 显隐应由渲染逻辑统一控制');
  });

  it('all 分支不显示 meta（all 走 loadListings 翻页器）', () => {
    const allBranch = regionOf("if (type === 'all')", "if (type === 'hot')");
    assert.match(allBranch, /\$\('mkBoardMeta'\)\.classList\.add\('hidden'/, "all 分支应隐藏 meta");
  });

  it('index.html：mkBoardTabs 与 mkGrid 之间有 mkBoardMeta 容器且初始隐藏', () => {
    const tabsIdx = html.indexOf('id="mkBoardTabs"');
    const metaIdx = html.indexOf('id="mkBoardMeta"');
    const gridIdx = html.indexOf('id="mkGrid"');
    assert.ok(tabsIdx > 0 && metaIdx > tabsIdx && gridIdx > metaIdx, 'mkBoardMeta 应位于榜单 Tab 之后、卡片网格之前');
    assert.match(html, /class="board-meta hidden" id="mkBoardMeta"/, 'mkBoardMeta 初始应带 hidden');
  });

  it('i18n：boardTotal / boardTrunc 双语齐备', () => {
    for (const key of ['boardTotal', 'boardTrunc']) {
      const n = i18n.split(key + ':').length - 1;
      assert.ok(n >= 2, key + ' 应在 zh/en 两块均有定义（当前 ' + n + ' 处）');
    }
    assert.match(i18n, /boardTotal: '[^']*\{total\}[^']*'/, 'boardTotal 应含 {total} 占位符');
    assert.match(i18n, /boardTrunc: '[^']*\{shown\}[^']*'/, 'boardTrunc 应含 {shown} 占位符');
  });
});
