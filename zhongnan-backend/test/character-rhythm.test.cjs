const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/character-logic.js');
const R = require('../dist/engine/rhythm.js');
const S = require('../dist/engine/sample-script.js');

test('人物：未出场/背景板被识别', () => {
  const text = '内景 家·日\n△ 张三站着，李四在旁。\n张三：你来了。\n张三（冷）：说吧。';
  const r = C.characterLogicScan({
    张三: { voice: '正常' }, 李四: {}, 王五: {},
  }, text);
  assert.ok(r.issues.some((i) => i.character === '王五' && i.type === 'missing'));
  assert.ok(r.issues.some((i) => i.character === '李四' && i.type === 'background'));
});

test('人物：寡言者说长句、粗犷者说书面词被判人设崩塌', () => {
  const text = '甲：我认为这件事情的来龙去脉其实非常复杂需要我们坐下来慢慢分析清楚。\n乙：然而我并不认同你的观点。';
  const r = C.characterLogicScan({ 甲: { voice: '寡言少言' }, 乙: { voice: '粗犷市井口语' } }, text);
  assert.ok(r.issues.some((i) => i.character === '甲' && i.type === 'voice_break'));
  assert.ok(r.issues.some((i) => i.character === '乙' && i.type === 'voice_break'));
});

test('人物：功能性龙套只有一句推进台词→工具人提示', () => {
  const text = '内景 大厅·日\n前台：陈总在32楼等你。\n主角：谢谢。';
  const r = C.characterLogicScan({ 主角: {} }, text);
  assert.ok(r.issues.some((i) => i.type === 'tool_support' && i.character === '前台'));
});

test('节奏：黄金样例节奏弧完整、得分合格', () => {
  const r = R.rhythmScan(S.buildSampleScript('LIVE'));
  assert.strictEqual(r.arc.hook, true);
  assert.strictEqual(r.arc.blank, true);
  assert.strictEqual(r.score >= 60, true, `得分${r.score}`);
});

test('节奏：平铺直叙、全程对词被抓（开场平/无转折/无留白/无呼吸）', () => {
  const flat = '内景 家·日\n甲：今天天气不错。\n乙：是啊挺好的。\n甲：那我们吃饭吧。\n乙：好的没问题。\n甲：走吧。\n乙：嗯。';
  const r = R.rhythmScan(flat);
  const types = r.issues.map((i) => i.type);
  assert.ok(types.includes('flat_open'));
  assert.ok(types.includes('no_turn'));
  assert.strictEqual(r.score < 60, true, `得分${r.score}`);
});
