const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.247 a11y 第七梯队：模态框 aria-describedby 描述关联
// 勘察结论：18 个 modal 中仅 listenModal（#listenNote 功能说明 + #listenTtsTip TTS 提示）
// 与 xMatureModal（#xMatureBoundary 分级边界说明）有明确的静态描述性 notice 区域。
// 其余弹窗要么纯表格/空态、要么字段级表单，描述关联收益低，维持现状。
// 本梯队：给 listenModal 补 aria-describedby="listenNote listenTtsTip"，
// 给 xMatureModal 补 aria-describedby="xMatureBoundary"。
// 零行为变化：纯语义层，视觉/逻辑不动。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

// 定位指定 modal-mask 的起始标签（含全部属性）
function maskTag(html, maskId) {
  const re = new RegExp(`<div class="modal-mask hidden" id="${maskId}"[^>]*>`);
  const m = html.match(re);
  return m ? m[0] : '';
}

describe('v2.247 a11y：模态框 aria-describedby 描述关联', () => {
  it('listenModal 有 aria-describedby="listenNote listenTtsTip"（功能说明区关联）', () => {
    const tag = maskTag(html, 'listenModal');
    assert.ok(tag, '应存在 listenModal');
    assert.match(tag, /aria-describedby="listenNote listenTtsTip"/, 'listenModal 缺 aria-describedby="listenNote listenTtsTip"');
  });

  it('xMatureModal 有 aria-describedby="xMatureBoundary"（分级边界说明关联）', () => {
    const tag = maskTag(html, 'xMatureModal');
    assert.ok(tag, '应存在 xMatureModal');
    assert.match(tag, /aria-describedby="xMatureBoundary"/, 'xMatureModal 缺 aria-describedby="xMatureBoundary"');
  });

  it('listenNote / listenTtsTip / xMatureBoundary 元素真实存在（无悬挂引用）', () => {
    assert.ok(/<div class="notice" id="listenNote"><\/div>/.test(html), '应存在 #listenNote');
    assert.ok(/<div class="notice hidden" id="listenTtsTip"><\/div>/.test(html), '应存在 #listenTtsTip');
    assert.ok(/<div class="notice" id="xMatureBoundary"><\/div>/.test(html), '应存在 #xMatureBoundary');
  });

  it('其余 15 个 modal 不补 aria-describedby（边界明确，不扩散）', () => {
    const masks = html.match(/<div class="modal-mask hidden" id="[^"]+"[^>]*>/g) || [];
    const described = masks.filter(t => /aria-describedby/.test(t));
    // 仅允许 listenModal + xMatureModal 有 aria-describedby
    assert.strictEqual(described.length, 2, `应有且仅有 2 个 modal 带 aria-describedby，实际 ${described.length} 个`);
    const ids = described.map(t => t.match(/id="([^"]+)"/)?.[1]).sort();
    assert.deepStrictEqual(ids, ['listenModal', 'xMatureModal'], '仅 listenModal 与 xMatureModal 可带 aria-describedby');
  });
});
