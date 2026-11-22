/**
 * v2.649 卖家工作台消费侧守卫：后端已把统计改走全库 count 并新增 itemsHasMore，
 * 前端必须消费 itemsHasMore 诚实标注「仅显示最近 N 个（共 M 个）」——
 * 否则统计卡显示 60、列表只有 50 且无任何说明，用户会误以为数据丢失。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
const start = src.indexOf('function renderMkMine()');
const end = src.indexOf("$('mkMineBtn').onclick", start);
const region = start < 0 ? '' : src.slice(start, end < 0 ? undefined : end);

describe('v2.649 卖家工作台截断提示', () => {
  it('渲染器消费 itemsHasMore，且文案同时给出已展示数与总数', () => {
    assert.match(region, /dash\.itemsHasMore \?/, '必须按 itemsHasMore 决定是否提示');
    assert.match(region, /dash\.items\.length/, '提示需给出已展示条数');
    assert.match(region, /s\.totalListings/, '提示需给出全库总数');
    assert.match(region, /仅显示最近 .* 个上架（共 .* 个）/, '中文诚实标注缺失');
    assert.match(region, /Showing latest .* of .* listings/, '英文诚实标注缺失');
  });

  it('统计卡直接消费后端全库口径字段（不再在前端二次计算）', () => {
    assert.match(region, /s\.totalListings/);
    assert.match(region, /s\.onShelf/);
    assert.match(region, /s\.sold/);
    assert.ok(!/listings\.filter\(|items\.filter\(/.test(region), '前端不得再用截断列表推算统计');
  });
});
