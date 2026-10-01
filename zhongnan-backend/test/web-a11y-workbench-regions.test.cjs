const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.248 a11y 第八梯队：工作台独立面板地标角色细化（v2.250 扩展第二梯队 tagBench/branchPanel/interviewPanel，共 6 面板）
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

  // v2.250 第二梯队扩展：tagBench/branchPanel/interviewPanel 三个次高频面板补地标
  //   tagBench      静态 h3「智能标签工作台」→ h3 补 id="tagBenchTitle"，labelledby 指向
  //   branchPanel   无 h3，但事实标题 <b data-i="tbBrTitle">（app.js 面板名提取逻辑也认它）
  //                 → b 补 id="brPanelTitle"，labelledby 指向（双语随 i18n 跟随，优于 aria-label 定死中文）
  //   interviewPanel h3 内 <span id="ivHeading"> 恒为标题文本（状态走 ivStatus）→ 直接复用，零新增 id
  it('tagBench 有 role="region" + aria-labelledby="tagBenchTitle"，且 h3#tagBenchTitle 存在', () => {
    const tag = sectionTag(html, 'tagBench');
    assert.ok(tag, '应存在 #tagBench');
    assert.match(tag, /role="region"/, 'tagBench 缺 role="region"');
    assert.match(tag, /aria-labelledby="tagBenchTitle"/, 'tagBench 缺 aria-labelledby="tagBenchTitle"');
    assert.ok(/<h3 data-i="tagBenchTitle" id="tagBenchTitle">/.test(html), '应存在 h3#tagBenchTitle（智能标签工作台标题）');
  });

  it('branchPanel 有 role="region" + aria-labelledby="brPanelTitle"，且 b#brPanelTitle 存在', () => {
    const tag = sectionTag(html, 'branchPanel');
    assert.ok(tag, '应存在 #branchPanel');
    assert.match(tag, /role="region"/, 'branchPanel 缺 role="region"');
    assert.match(tag, /aria-labelledby="brPanelTitle"/, 'branchPanel 缺 aria-labelledby="brPanelTitle"');
    assert.ok(/<b style="align-self:center" data-i="tbBrTitle" id="brPanelTitle">/.test(html), '应存在 b#brPanelTitle（互动分支编辑器标题）');
  });

  it('interviewPanel 有 role="region" + aria-labelledby="ivHeading"（复用既有 span#ivHeading）', () => {
    const tag = sectionTag(html, 'interviewPanel');
    assert.ok(tag, '应存在 #interviewPanel');
    assert.match(tag, /role="region"/, 'interviewPanel 缺 role="region"');
    assert.match(tag, /aria-labelledby="ivHeading"/, 'interviewPanel 缺 aria-labelledby="ivHeading"');
    assert.ok(/<span id="ivHeading">/.test(html), '应存在 span#ivHeading（采访式创作标题）');
  });

  it('边界：仅 6 个 .panel 带 role="region"（不扩散），且 labelledby 无悬挂引用', () => {
    const sections = html.match(/<section class="panel[^"]*" id="[^"]+"[^>]*>/g) || [];
    const regions = sections.filter(t => /role="region"/.test(t));
    const ids = regions.map(t => t.match(/id="([^"]+)"/)?.[1]).sort();
    assert.deepStrictEqual(ids, ['branchPanel', 'craftBench', 'interviewPanel', 'novelSrcBench', 'roomPanel', 'tagBench'],
      `应有且仅有 6 个 .panel 带 role="region"，实际：${ids.join(',')}`);
    // labelledby 引用闭环：每个标题 id 恰好出现 2 次（标题元素自身 id + section aria-labelledby）
    for (const titleId of ['craftBenchTitle', 'novelSrcBenchTitle', 'ivHeading']) {
      const count = html.split(titleId).length - 1;
      assert.strictEqual(count, 2, `#${titleId} 应恰好出现 2 次（标题 id + section labelledby），实际 ${count} 次`);
    }
    // tagBenchTitle/brPanelTitle 的标题元素另有 data-i 同值属性，改用精确匹配闭环（id= 1 次 + labelledby= 1 次）
    for (const titleId of ['tagBenchTitle', 'brPanelTitle']) {
      const idCount = html.split(`id="${titleId}"`).length - 1;
      const refCount = html.split(`aria-labelledby="${titleId}"`).length - 1;
      assert.strictEqual(idCount, 1, `id="${titleId}" 应恰好出现 1 次，实际 ${idCount} 次`);
      assert.strictEqual(refCount, 1, `aria-labelledby="${titleId}" 应恰好出现 1 次，实际 ${refCount} 次`);
    }
  });
});
