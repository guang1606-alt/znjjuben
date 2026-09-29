const { describe, it } = require('node:test');
const assert = require('node:assert');
const T = require('../dist/engine/hit-teardown.js');

const HIT = `第1集
日 内 林家
林晚被婆家误会偷了项链，婆婆当众羞辱她、逼她净身出户。丈夫背叛她，牵着第三者进门。她攥紧拳头，藏着自己才是集团继承人的秘密。
林晚（压着声）：今天你们怎么赶我走，明天我怎么回来。
第2集
日 内 公司
林晚隐藏身份回来，从保洁做起，被前同事嘲讽。谁知她当场揭穿对方做假账，第一次打脸，众人震惊。
第3集
夜 内 宴会厅
反转接连出现，她霸气反杀，一路逆袭碾压，真相大白，完成清算，夺回属于自己的一切，释然离场完成成长。`;

describe('拆爆款引擎', () => {
  it('拆解给出为什么爆/技法/标签池/可吸收技能', () => {
    const r = T.teardown(HIT, { type: 'text' });
    assert.ok(r.wordCount > 80);
    assert.ok(r.boomReasons.length >= 5);
    assert.strictEqual(r.techniques.length, 6);
    assert.ok(r.tagPool.length >= 4);
    assert.ok(r.absorbIntoSkill.length >= 4);
    assert.ok(['题材', '钩子', '人设', '情绪', '节奏', '场景'].includes(r.tagPool[0].category));
  });

  it('开场即麻烦、能识别观众站队杠杆', () => {
    const r = T.teardown(HIT);
    assert.strictEqual(r.opening.inTrouble, true);
    assert.ok(r.opening.sympathyLevers.length >= 1); // 被误会/被背叛/被逼
  });

  it('纯人物介绍、没有麻烦时开场站队判为不足', () => {
    const o = T.openingSympathy('她今年二十八岁，毕业于名牌大学，家境优渥，性格温柔，是一名优秀的设计师，履历非常漂亮。');
    assert.strictEqual(o.inTrouble, false);
    assert.ok(o.advice.includes('麻烦'));
  });

  it('结局兑付：苦难被清算/成长回应', () => {
    const r = T.teardown(HIT);
    assert.strictEqual(r.ending.closed, true);
    assert.ok(r.ending.payoffSignals.length >= 1);
  });

  it('三个改编方向且都带不侵权隔离说明', () => {
    const dirs = T.adaptDirections(T.teardown(HIT));
    assert.strictEqual(dirs.length, 3);
    dirs.forEach((d) => assert.ok(d.isolation.length > 5 && d.logline.length > 3));
  });

  it('勾选标签+方向生成改编大纲，标签透传、人物3个、起承转合4段', () => {
    const r = T.teardown(HIT);
    const tags = r.tagPool.slice(0, 3).map((t) => t.label);
    const o = T.buildAdaptOutline(r, tags, 'swap_world');
    assert.deepStrictEqual(o.pickedTags, tags);
    assert.strictEqual(o.characters.length, 3);
    assert.strictEqual(o.arc.length, 4);
    assert.ok(o.isolationNote.includes('原创') || o.isolationNote.includes('不'));
    assert.ok(o.openingHook.includes('钩'));
  });

  it('空/极短文本不崩，标签池有兜底', () => {
    const r = T.teardown('短');
    assert.ok(Array.isArray(r.tagPool));
    assert.ok(r.boomReasons.length >= 1);
  });
});

it('v1.90 lang=en：拆爆款/方向/大纲全英文且不含中文字符；默认中文不变', () => {
  const enText = 'She was kicked out and betrayed, humiliated with nowhere to go, little did they know she was a hidden billionaire heir. She endured, then exposed everything and crushed them in the comeback and reckoning, truth revealed and vindicated. '.repeat(6);
  const r = T.teardown(enText, { type: 'text' }, 'en');
  assert.strictEqual(r.lang, 'en');
  assert.ok(/[A-Za-z]/.test(r.hookType));
  const composed = JSON.stringify({ boom: r.boomReasons, tech: r.techniques, op: r.opening.advice, ed: r.ending.advice });
  assert.ok(!/[一-龥]/.test(composed));
  const dirs = T.adaptDirections(r);
  assert.ok(!/[一-龥]/.test(JSON.stringify(dirs)));
  const o = T.buildAdaptOutline(r, ['revenge'], 'swap_persona');
  assert.ok(!/[一-龥]/.test(JSON.stringify(o)));
  const zh = T.teardown('她被赶出家门背叛羞辱走投无路，谁知她是隐藏首富继承人，最终清算真相大白。'.repeat(6));
  assert.strictEqual(zh.lang, 'zh');
  assert.strictEqual(zh.boomReasons[0].dim, '开场钩子');
});
