const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.248 a11y 第八梯队：工作台独立面板地标角色细化
// 背景：v2.188 起 16 个工作台 panel 被移入全屏覆盖层 #workbenchLayer（role="dialog"）。
// dialog 内部的各功能分区（小南递招 / 小说素材库 / 编剧室）此前只是无语义的
// <section class="panel">，读屏器用户在 dialog 内无法区分当前处于哪个功能区。
// 本梯队：给三个高频独立面板补 role="region" + 可访问名——
//   craftBench     有静态 h3「小南递招 · 方法卡与钩子」→ aria-labelledby 指向 h3（h3 补 id）
//   novelSrcBench  有静态 h3「免费合法小说素材库 · 多语言」→ 同上
//   roomPanel      无静态标题元素（tab 切换器非标题）→ aria-label="编剧室"
// 零行为变化：纯语义层，视觉/逻辑不动；其余工作台面板本轮不扩散。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

// 定位指定 section.panel 的起始标签（含全部属性）
function sectionTag(html, id) {
  const re = new RegExp(`<section class="panel[^"]*" id="${id}"[^>]*>`);
  const m = html.match(re);
  return m ? m[0] : '';
}

describe('v2.248 a11y：工作台面板 role="region" 地标化', () => {
  it('craftBench 有 role="region" + aria-labelledby="craftBenchTitle"，且 h3#craftBenchTitle 存在', () => {
    const tag = sectionTag(html, 'craftBench');
    assert.ok(tag, '应存在 #craftBench');
    assert.match(tag, /role="region"/, 'craftBench 缺 role="region"');
    assert.match(tag, /aria-labelledby="craftBenchTitle"/, 'craftBench 缺 aria-labelledby="craftBenchTitle"');
    assert.ok(/<h3 data-i="craftTitle" id="craftBenchTitle">/.test(html), '应存在 h3#craftBenchTitle（小南递招标题）');
  });

  it('novelSrcBench 有 role="region" + aria-labelledby="novelSrcBenchTitle"，且 h3#novelSrcBenchTitle 存在', () => {
    const tag = sectionTag(html, 'novelSrcBench');
    assert.ok(tag, '应存在 #novelSrcBench');
    assert.match(tag, /role="region"/, 'novelSrcBench 缺 role="region"');
    assert.match(tag, /aria-labelledby="novelSrcBenchTitle"/, 'novelSrcBench 缺 aria-labelledby="novelSrcBenchTitle"');
    assert.ok(/<h3 data-i="novelSrcTitle" id="novelSrcBenchTitle">/.test(html), '应存在 h3#novelSrcBenchTitle（小说素材库标题）');
  });

  it('roomPanel 有 role="region" + aria-label="编剧室"（无静态标题元素，用 aria-label）', () => {
    const tag = sectionTag(html, 'roomPanel');
    assert.ok(tag, '应存在 #roomPanel');
    assert.match(tag, /role="region"/, 'roomPanel 缺 role="region"');
    assert.match(tag, /aria-label="编剧室"/, 'roomPanel 缺 aria-label="编剧室"');
  });

  it('边界：仅 3 个 .panel 带 role="region"（不扩散），且 labelledby 无悬挂引用', () => {
    const sections = html.match(/<section class="panel[^"]*" id="[^"]+"[^>]*>/g) || [];
    const regions = sections.filter(t => /role="region"/.test(t));
    const ids = regions.map(t => t.match(/id="([^"]+)"/)?.[1]).sort();
    assert.deepStrictEqual(ids, ['craftBench', 'novelSrcBench', 'roomPanel'],
      `应有且仅有 3 个 .panel 带 role="region"，实际：${ids.join(',')}`);
    // labelledby 引用闭环：每个标题 id 恰好出现 2 次（h3 自身 id + section aria-labelledby）
    for (const titleId of ['craftBenchTitle', 'novelSrcBenchTitle']) {
      const count = html.split(titleId).length - 1;
      assert.strictEqual(count, 2, `#${titleId} 应恰好出现 2 次（h3 id + section labelledby），实际 ${count} 次`);
    }
  });
});
