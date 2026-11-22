/**
 * v2.650 卖家工作台上架续页消费侧守卫：后端已回传 itemsNextCursor，前端必须真正渲染
 * 「加载更多」并去重追加——否则卖家的第 51 个上架仍看不到，缺口未关闭。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
const start = src.indexOf('async function loadMoreDashList()');
const end = src.indexOf('function renderMkMine()', start);
const fn = start < 0 ? '' : src.slice(start, end < 0 ? undefined : end);

describe('v2.650 卖家工作台上架续页消费', () => {
  it('续页请求带 cursor + limit，并推进游标/截断信号', () => {
    assert.match(fn, /\/api\/market\/seller-dashboard\?limit=50&cursor=/, '必须复用同一端点并带游标');
    assert.match(fn, /dash\.itemsNextCursor/, '应消费 itemsNextCursor');
    assert.match(fn, /dash\.itemsHasMore = !!d\.itemsHasMore/, '应更新 hasMore');
    assert.match(fn, /dash\.itemsNextCursor = d\.itemsNextCursor \|\| ''/, '应推进游标');
  });

  it('按 id 去重追加，且统计覆盖保持全库口径', () => {
    assert.match(fn, /new Set\(\(dash\.items \|\| \[\]\)\.map\(\(x\) => x\.id\)\)/, '追加前必须去重');
    assert.match(fn, /dash\.stats = d\.stats/, '续页应同步统计（服务端恒为全库口径）');
  });

  it('防并发与账号切换守卫齐备，渲染器提供按钮入口', () => {
    assert.match(fn, /st\.dashLoading\) return/, '重复点击不得并发翻页');
    assert.match(fn, /isPrivateSessionCurrent\(st\.account\)/, '异步返回必须校验会话归属');
    assert.match(src, /data-dash-more=/, '渲染器必须渲染「加载更多」按钮');
    assert.match(src, /dashMore\.onclick = \(\) => loadMoreDashList\(\)/, '按钮必须接线到续页函数');
  });
});
