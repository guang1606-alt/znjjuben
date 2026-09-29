const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/custom-style.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

const SAMPLE_PUNCHY = Array.from({ length: 24 }, () =>
  '林夜（冷）：住手！\n他拔刀。\n快！\n别废话！').join('\n') + '补足样本长度的叙述文字，确保超过一百字判定门槛，继续继续继续继续继续。';
const SAMPLE_LYRICAL = Array.from({ length: 12 }, () =>
  '她慢慢走到窗边，指尖轻轻拂过那盆早已干枯的茉莉，眼神里有说不清的怅然，像是想起很多年前那个下着细雨的黄昏……').join('\n');

test('v2.32 analyzeCustomStyle：确定性、样本门槛、长短句风格可区分', () => {
  const a = C.analyzeCustomStyle(SAMPLE_PUNCHY);
  const b = C.analyzeCustomStyle(SAMPLE_PUNCHY);
  assert.ok(a.enough);
  assert.deepStrictEqual(a, b);
  assert.ok(a.tags.includes('punchy_short'));
  const lyr = C.analyzeCustomStyle(SAMPLE_LYRICAL);
  assert.ok(lyr.enough && lyr.tags.includes('lyrical_detailed'));
  assert.ok(!C.analyzeCustomStyle('太短').enough);
  assert.strictEqual(C.buildCustomStyleDirective('太短', 'zh'), '');
});

test('v2.32 指令只学风格不抄内容；英文零中文且含版权安全声明', () => {
  const zh = C.buildCustomStyleDirective(SAMPLE_PUNCHY, 'zh');
  assert.ok(zh.includes('严禁照搬') && zh.includes('统计指纹'));
  const en = C.buildCustomStyleDirective(SAMPLE_PUNCHY, 'en');
  assert.ok(!cjk(en) && /never its plot/.test(en));
});

test('v2.32 方言与对话驱动可被识别', () => {
  const dialect = Array.from({ length: 10 }, (_, i) =>
    `张老汉：咋整嘞，俺说啥你都不听呗？\n李婶：那咱咋弄，搁这儿等啥呢？（第${i}轮补足样本长度的文字内容继续堆叠直到超过门槛）`).join('\n');
  const fp = C.analyzeCustomStyle(dialect);
  assert.ok(fp.tags.includes('dialect_grounded'));
  assert.ok(fp.tags.includes('dialogue_driven'));
});
