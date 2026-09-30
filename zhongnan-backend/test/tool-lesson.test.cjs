/**
 * 小南课堂 · 工具方法论卡片 —— TDD 先红后绿
 * 目标：每个工具配 SVG mini-diagram + 白话讲解（费曼式），
 *       让用户在等待生成期间学到方法论。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { getLesson, listLessons } = require('../web/tool-lesson.js');

describe('小南课堂 · getLesson 基础行为', () => {
  it('5 个工具都有方法论卡片', () => {
    const ids = listLessons();
    assert.ok(ids.includes('tbCardPitch'), '应有选题会');
    assert.ok(ids.includes('tbCardRead'), '应有剧本围读');
    assert.ok(ids.includes('tbCardTd'), '应有拆爆款');
    assert.ok(ids.includes('tbCardDv'), '应有多版本去重');
    assert.ok(ids.includes('tbCardBr'), '应有互动分支校验');
    assert.ok(ids.length >= 5, `至少 5 个工具，实际：${ids.length}`);
  });

  it('未知工具返回 null', () => {
    assert.strictEqual(getLesson('unknownTool', false), null);
    assert.strictEqual(getLesson('', false), null);
    assert.strictEqual(getLesson(null, false), null);
  });
});

describe('小南课堂 · 卡片内容契约（每张卡都满足）', () => {
  const IDS = ['tbCardPitch', 'tbCardRead', 'tbCardTd', 'tbCardDv', 'tbCardBr'];
  for (const id of IDS) {
    it(`[${id}] 中文卡片含 title/oneLiner/steps/diagram/plainExplain`, () => {
      const c = getLesson(id, false);
      assert.ok(c, `工具 ${id} 应有卡片`);
      assert.ok(c.title && c.title.length > 0, `应有 title，实际：${c.title}`);
      assert.ok(c.oneLiner && c.oneLiner.length > 0, `应有 oneLiner，实际：${c.oneLiner}`);
      assert.ok(Array.isArray(c.steps) && c.steps.length >= 3, `steps 至少 3 条，实际：${(c.steps || []).length}`);
      c.steps.forEach((s, i) => {
        assert.ok(s.name && s.name.length > 0, `step[${i}].name 不能空`);
        assert.ok(s.explain && s.explain.length > 0, `step[${i}].explain 不能空`);
      });
      assert.ok(c.diagram && c.diagram.includes('<svg'), `diagram 应是 SVG，实际：${(c.diagram || '').slice(0, 50)}`);
      assert.ok(c.plainExplain && c.plainExplain.length > 30, `plainExplain 应足够长（≥30 字），实际：${(c.plainExplain || '').length}`);
      assert.ok(c.plainExplain.length <= 250, `plainExplain 应精炼（≤250 字），实际：${(c.plainExplain || '').length}`);
    });

    it(`[${id}] 英文卡片所有字段非空且为英文（含 ASCII 字母）`, () => {
      const c = getLesson(id, true);
      assert.ok(c.title && /[a-zA-Z]/.test(c.title), `英文 title 应含字母，实际：${c.title}`);
      assert.ok(c.oneLiner && /[a-zA-Z]/.test(c.oneLiner), `英文 oneLiner 应含字母`);
      assert.ok(c.plainExplain && /[a-zA-Z]/.test(c.plainExplain), `英文 plainExplain 应含字母`);
      c.steps.forEach((s, i) => {
        assert.ok(/[a-zA-Z]/.test(s.name), `英文 step[${i}].name 应含字母`);
        assert.ok(/[a-zA-Z]/.test(s.explain), `英文 step[${i}].explain 应含字母`);
      });
    });
  }
});

describe('小南课堂 · 费曼式方法论核心', () => {
  it('选题会卡片含「四席位/四关」概念（白话讲清楚）', () => {
    const c = getLesson('tbCardPitch', false);
    assert.ok(/四|4|四个/.test(c.title + c.oneLiner + c.plainExplain), `应含四席位概念`);
    assert.ok(/市场|故事|制作|观众/.test(c.plainExplain), `plainExplain 应提到四个席位`);
  });

  it('拆爆款卡片含五步法（爆点/结构/技法/标签/改编）', () => {
    const c = getLesson('tbCardTd', false);
    assert.ok(c.steps.length >= 5, `拆爆款应至少 5 步，实际：${c.steps.length}`);
    const allSteps = c.steps.map((s) => s.name).join('');
    assert.ok(/爆点|结构|技法|标签|改编/.test(allSteps), `五步应覆盖爆点/结构/技法/标签/改编`);
  });

  it('多版本去重卡片含「正交」或「四维」概念', () => {
    const c = getLesson('tbCardDv', false);
    assert.ok(/正交|四维|4维/.test(c.title + c.oneLiner + c.plainExplain), `应含正交/四维概念`);
    assert.ok(/原型|冲突|反转|基调/.test(c.plainExplain), `plainExplain 应提到四个轴`);
  });

  it('互动分支卡片含六类校验项（死胡同/伪选择/自环/死循环/悬空/概率）', () => {
    const c = getLesson('tbCardBr', false);
    assert.ok(/死胡同/.test(c.plainExplain), `应提到死胡同`);
    assert.ok(/伪选择|自环|死循环|悬空|概率/.test(c.plainExplain), `应提到其他校验项`);
  });

  it('每张卡片的 diagram 都是合法 SVG 字符串（含 viewBox 与 xmlns）', () => {
    const ids = listLessons();
    ids.forEach((id) => {
      const c = getLesson(id, false);
      assert.ok(c.diagram.includes('viewBox'), `${id} diagram 应有 viewBox`);
      assert.ok(c.diagram.includes('xmlns'), `${id} diagram 应有 xmlns`);
      assert.ok(c.diagram.includes('</svg>'), `${id} diagram 应闭合 </svg>`);
    });
  });
});
