const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/script-format.js');
const S = require('../dist/engine/sample-script.js');

test('汉字字数统计口径正确', () => {
  assert.strictEqual(F.cjkCount('你好，world！123'), 2);
});

test('真人实拍样例：标准格式 + 800-1000字 + 无提示词污染（黄金样例必须达标）', () => {
  const t = S.buildSampleScript('LIVE');
  const r = F.validateScript(t, 'LIVE');
  assert.strictEqual(r.cjk >= 800 && r.cjk <= 1000, true, `实际${r.cjk}字, ${r.violations.join(';')}`);
  assert.strictEqual(r.hasScene && r.hasAction && r.hasDialogue, true);
  assert.strictEqual(r.pass, true, r.violations.join(';'));
});

test('AIGC制作样例：1200-1500字且含视听信息、仍非提示词', () => {
  const t = S.buildSampleScript('AIGC');
  const r = F.validateScript(t, 'AIGC');
  assert.strictEqual(r.cjk >= 1200 && r.cjk <= 1500, true, `实际${r.cjk}字`);
  assert.strictEqual(r.pass, true, r.violations.join(';'));
});

test('提示词式污染被识别并拦截', () => {
  const bad = '内景 房间·日\n△ 人站着。\nprompt: masterpiece, 8k超高清, --ar 9:16\n主角：你好。';
  const r = F.validateScript(bad, 'LIVE');
  assert.strictEqual(r.pass, false);
  assert.ok(r.violations.some((v) => v.includes('提示词')));
});

test('字数不足/缺要素被诊断', () => {
  const short = F.validateScript('内景 家·日\n△ 坐。\n甲：走。', 'LIVE');
  assert.strictEqual(short.inRange, false);
  assert.ok(short.violations.some((v) => v.includes('字数不足')));
});

test('v2.80 英文稿按单词当量计字数：英文 AIGC 黄金样例 1200-1500 当量级满分，英文 LIVE 场标/台词可识别', () => {
  const en = S.buildSampleScript('AIGC', 'en');
  const r = F.validateScript(en, 'AIGC');
  assert.strictEqual(r.lang, 'en');
  assert.ok(r.cjk >= 1200 && r.cjk <= 1500, `当量${r.cjk}`);
  assert.strictEqual(r.pass, true, r.violations.join(';'));
  assert.strictEqual(r.score, 100);
  // 纯英文短句汉字数为 0，不会再被误判“字数不足”
  assert.strictEqual(F.validateScript(en, 'AIGC').violations.some((v) => v.includes('字数不足')), false);
  // 英文 LIVE 三要素正则：SCENE: 场标、△ 动作、NAME: 台词
  const liveEn = F.validateScript('SCENE: APARTMENT - NIGHT INT.\n△ She walks to the door and stops.\nAnna (cold): Get out.', 'LIVE');
  assert.ok(liveEn.hasScene && liveEn.hasAction && liveEn.hasDialogue);
});
