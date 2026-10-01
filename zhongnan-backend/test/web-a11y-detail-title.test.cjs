const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.249 a11y 第九梯队：detailModal 动态标题同步可访问名
// 现状：detailModal 静态侧 aria-label="作品详情"（v2.245 兜底），但 openListingDetail
// 把 listing.title 注入 detailBody 的 h3 时，dialog 的可访问名始终是"作品详情"——
// 读屏器打开任何作品的详情都读同一个名，无法区分当前看的是哪部作品。
// 本梯队：openListingDetail 打开时先把可访问名重置为静态兜底（防上一作品标题残留），
// 数据到达后同步为「作品详情：<标题>」；index.html 静态兜底保留（首开/失败态回落）。
// 解析采用线性扫描（与 web-a11y-modal-labels 同款），禁「可选组套星号」正则。
const src = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

// 提取 openListingDetail 函数区域（到下一个同级函数 loadBoard 为止）
const fnStart = src.indexOf('async function openListingDetail');
assert.ok(fnStart >= 0, '找不到 openListingDetail 函数');
const fnEnd = src.indexOf('async function loadBoard', fnStart);
assert.ok(fnEnd > fnStart, 'openListingDetail 区域终点定位失败');
const region = src.slice(fnStart, fnEnd);

// 收集区域内全部 setAttribute('aria-label' 调用位置（线性扫描）
function setLabelCalls(text) {
  const positions = [];
  let i = text.indexOf("setAttribute('aria-label'");
  while (i >= 0) {
    positions.push(i);
    i = text.indexOf("setAttribute('aria-label'", i + 1);
  }
  return positions;
}

describe('v2.249 a11y：detailModal 动态标题同步可访问名', () => {
  it('openListingDetail 内含至少 2 处 aria-label 写入（重置兜底 + 动态注入）', () => {
    const calls = setLabelCalls(region);
    assert.ok(calls.length >= 2, `应至少 2 处 setAttribute('aria-label'，实际 ${calls.length}`);
  });

  it('动态注入的可访问名由当前作品标题构成（含 d.title）', () => {
    const calls = setLabelCalls(region);
    const dynamic = calls.find((pos) => region.slice(pos, pos + 300).includes('d.title'));
    assert.ok(dynamic !== undefined, '未找到含 d.title 的 aria-label 动态注入');
  });

  it('顺序铁律：重置兜底 < fetch 取数 < 动态注入（防残留/防陈旧）', () => {
    const calls = setLabelCalls(region);
    const fetchIdx = region.indexOf("fetch('/api/market/listings/'");
    assert.ok(fetchIdx >= 0, '区域内找不到列表详情 fetch');
    const dynamic = calls.find((pos) => region.slice(pos, pos + 300).includes('d.title'));
    const reset = calls.find((pos) => pos !== dynamic);
    assert.ok(reset !== undefined && dynamic !== undefined, '重置与动态注入调用不齐');
    assert.ok(reset < fetchIdx, `重置兜底（${reset}）应在 fetch（${fetchIdx}）之前`);
    assert.ok(dynamic > fetchIdx, `动态注入（${dynamic}）应在 fetch（${fetchIdx}）之后`);
  });

  it('index.html 静态兜底 aria-label="作品详情" 保留（首开/失败态回落）', () => {
    const openTag = '<div class="modal-mask hidden" id="detailModal"';
    const i = html.indexOf(openTag);
    assert.ok(i >= 0, '找不到 #detailModal 开标签');
    const tag = html.slice(i, html.indexOf('>', i) + 1);
    assert.ok(/aria-label="作品详情"/.test(tag), '#detailModal 静态 aria-label="作品详情" 不在');
    assert.ok(!/aria-labelledby/.test(tag), '#detailModal 不应改挂 aria-labelledby（标题为动态注入）');
  });
});
