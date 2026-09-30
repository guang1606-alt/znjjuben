/**
 * B2 接入：progress-view.js 暴露小南课堂方法论数据 —— TDD 先红后绿
 * 目标：把 tool-lesson.js 的 5 张方法论卡片接到进度页轮播，
 *       让用户在等待生成期间学到方法论而不是干等。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

// 模拟浏览器加载顺序：tool-lesson.js 在 progress-view.js 之前加载，
// progress-view.js 通过 typeof ZnToolLesson 访问全局
const ZnToolLesson = require('../web/tool-lesson.js');
global.ZnToolLesson = ZnToolLesson;

const ProgressView = require('../web/progress-view.js');

describe('B2 · getXiaonanLessons 接入 tool-lesson', () => {
  it('函数存在且为数组返回', () => {
    assert.strictEqual(typeof ProgressView.getXiaonanLessons, 'function');
    const arr = ProgressView.getXiaonanLessons(false);
    assert.ok(Array.isArray(arr), '应返回数组');
  });

  it('中文：返回 5 张卡片，每张含 oneLiner + plainExplain + toolId', () => {
    const arr = ProgressView.getXiaonanLessons(false);
    assert.ok(arr.length >= 5, `至少 5 张卡片，实际：${arr.length}`);
    arr.forEach((c, i) => {
      assert.ok(c.toolId, `卡片[${i}] 应有 toolId`);
      assert.ok(c.oneLiner && c.oneLiner.length > 0, `卡片[${i}] 应有 oneLiner`);
      assert.ok(c.plainExplain && c.plainExplain.length > 30, `卡片[${i}] plainExplain 应≥30字，实际：${(c.plainExplain || '').length}`);
    });
  });

  it('英文：所有字段为英文（含 ASCII 字母）', () => {
    const arr = ProgressView.getXiaonanLessons(true);
    arr.forEach((c, i) => {
      assert.ok(/[a-zA-Z]/.test(c.oneLiner), `英文卡片[${i}] oneLiner 应含字母`);
      assert.ok(/[a-zA-Z]/.test(c.plainExplain), `英文卡片[${i}] plainExplain 应含字母`);
    });
  });

  it('5 个工具 id 都覆盖（tbCardPitch/tbCardRead/tbCardTd/tbCardDv/tbCardBr）', () => {
    const arr = ProgressView.getXiaonanLessons(false);
    const ids = arr.map((c) => c.toolId).sort();
    assert.ok(ids.includes('tbCardPitch'), '应有选题会');
    assert.ok(ids.includes('tbCardRead'), '应有围读');
    assert.ok(ids.includes('tbCardTd'), '应有拆爆款');
    assert.ok(ids.includes('tbCardDv'), '应有多版本去重');
    assert.ok(ids.includes('tbCardBr'), '应有互动分支');
  });

  it('未加载 ZnToolLesson 时安全返回空数组（不崩）', () => {
    // 模拟 ZnToolLesson 未加载：临时清除
    const origZnToolLesson = typeof global !== 'undefined' ? global.ZnToolLesson : undefined;
    const origWindow = typeof window !== 'undefined' ? window.ZnToolLesson : undefined;
    if (typeof global !== 'undefined') delete global.ZnToolLesson;
    if (typeof window !== 'undefined') delete window.ZnToolLesson;
    try {
      const arr = ProgressView.getXiaonanLessons(false);
      assert.ok(Array.isArray(arr), '应安全返回数组');
      assert.strictEqual(arr.length, 0, '未加载时应返回空数组');
    } finally {
      if (typeof global !== 'undefined' && origZnToolLesson) global.ZnToolLesson = origZnToolLesson;
      if (typeof window !== 'undefined' && origWindow) window.ZnToolLesson = origWindow;
    }
  });
});

describe('B2 · lessonForTip 按 waitTips 序号轮播对应工具', () => {
  it('函数存在', () => {
    assert.strictEqual(typeof ProgressView.lessonForTip, 'function');
  });

  it('按 tipIndex mod 5 取对应工具卡片', () => {
    // tipIndex 0 → tbCardPitch, 1 → tbCardRead, 2 → tbCardTd, 3 → tbCardDv, 4 → tbCardBr, 5 → 回到 0
    const l0 = ProgressView.lessonForTip(0, false);
    const l1 = ProgressView.lessonForTip(1, false);
    const l2 = ProgressView.lessonForTip(2, false);
    const l3 = ProgressView.lessonForTip(3, false);
    const l4 = ProgressView.lessonForTip(4, false);
    const l5 = ProgressView.lessonForTip(5, false);
    assert.strictEqual(l0 && l0.toolId, 'tbCardPitch');
    assert.strictEqual(l1 && l1.toolId, 'tbCardRead');
    assert.strictEqual(l2 && l2.toolId, 'tbCardTd');
    assert.strictEqual(l3 && l3.toolId, 'tbCardDv');
    assert.strictEqual(l4 && l4.toolId, 'tbCardBr');
    assert.strictEqual(l5 && l5.toolId, 'tbCardPitch', '序号 5 应回到 0');
  });

  it('tipIndex 超出范围用 mod 循环', () => {
    const l10 = ProgressView.lessonForTip(10, false);
    assert.ok(l10, 'tipIndex=10 应返回卡片（mod 5 = 0）');
    assert.strictEqual(l10.toolId, 'tbCardPitch');
  });

  it('返回的卡片含 oneLiner/plainExplain/diagram/toolId/steps', () => {
    const c = ProgressView.lessonForTip(0, false);
    assert.ok(c.toolId);
    assert.ok(c.oneLiner);
    assert.ok(c.plainExplain);
    assert.ok(c.diagram && c.diagram.includes('<svg'));
    assert.ok(Array.isArray(c.steps) && c.steps.length >= 3);
  });
});
