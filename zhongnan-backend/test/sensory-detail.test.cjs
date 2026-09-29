// v2.80 感官细节密度（Sensory Detail Density）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/sensory-detail.js');

describe('v2.80 sensory-detail 空输入', () => {
  test('空草稿满分不罚', () => {
    const r = M.sensoryDetail('');
    assert.equal(r.score, 100);
    assert.equal(r.narrationSentences, 0);
  });
});

describe('v2.80 sensory-detail 纯视觉叙述', () => {
  test('只有视觉缺四种非视觉', () => {
    const draft = '内景·房间·夜\n他站在门口，桌上有一道红光，影子很长。';
    const r = M.sensoryDetail(draft);
    assert.ok(r.covered.includes('sight'));
    assert.deepEqual(r.missing.sort(), ['smell', 'sound', 'taste', 'touch'].sort());
    assert.ok(r.score < 60);
  });
});

describe('v2.80 sensory-detail 五感齐全', () => {
  test('视听触嗅味都命中高分', () => {
    const draft = '内景·巷子·夜\n红光闪烁，轰鸣震耳，墙壁滚烫，空气里全是腥味，他咽下一口苦涩的唾沫。';
    const r = M.sensoryDetail(draft);
    for (const k of ['sight', 'sound', 'touch', 'smell', 'taste']) {
      assert.ok(r.covered.includes(k), `应覆盖 ${k}`);
    }
    assert.equal(r.missing.length, 0);
    assert.ok(r.score >= 80, `五感齐全应高分，实际 ${r.score}`);
  });
});

describe('v2.80 sensory-detail 台词不参与', () => {
  test('台词里的感官词不计入叙述', () => {
    const draft = '内景·房间·夜\n沈知远：这汤好苦涩，还有腥味。\n林棠：是啊。';
    const r = M.sensoryDetail(draft);
    // 无叙述行，非视觉感官应为 0
    assert.equal(r.counts.taste, 0);
    assert.equal(r.counts.smell, 0);
  });
});

describe('v2.80 sensory-detail 场景头跳过', () => {
  test('场景头文字不参与统计', () => {
    const draft = '内景·红光巷子·夜\n他站着。';
    const r = M.sensoryDetail(draft);
    // "红光"在场景头被跳过；叙述"他站着"无视觉词
    assert.equal(r.counts.sight, 0);
  });
});

describe('v2.80 sensory-detail 非视觉密度', () => {
  test('非视觉词多密度分高', () => {
    const draft = '轰鸣不断，墙壁滚烫，腥味扑鼻，嘴里发苦，冷风刺骨，咯吱声四起，又湿又黏。';
    const r = M.sensoryDetail(draft);
    assert.ok(r.nonVisualCount >= 5);
    assert.ok(r.score >= 70);
  });
});

describe('v2.80 sensory-detail advice 与 issues', () => {
  test('有缺失时给补写建议', () => {
    const draft = '内景·房间·夜\n他站在门口，红光映脸。';
    const r = M.sensoryDetail(draft);
    assert.ok(r.issues.length > 0);
    assert.ok(r.advice.includes('补'));
  });
  test('无缺失 issues 为空', () => {
    const draft = '轰鸣震耳，墙壁滚烫，腥味弥漫，苦涩难忍，红光闪烁。';
    const r = M.sensoryDetail(draft);
    assert.equal(r.issues.length, 0);
  });
});

describe('v2.80 sensory-detail en 链路', () => {
  test('英文纯视觉缺非视觉', () => {
    const draft = 'INT. ROOM - NIGHT\nHe stood at the door, red light on the wall.';
    const r = M.sensoryDetail(draft);
    assert.ok(r.covered.includes('sight'));
    assert.ok(r.missing.includes('sound'));
    assert.ok(r.issues[0].includes('sound'));
  });
  test('英文五感齐全', () => {
    const draft = 'Red light flashed, a roar shook the walls, the metal was burning hot, a metallic reek filled the air, and a bitter taste filled his mouth.';
    const r = M.sensoryDetail(draft);
    assert.equal(r.missing.length, 0);
    assert.ok(r.score >= 80);
  });
  test('英文词界（smell 不匹配 smelly 之外的变形问题用 \\b）', () => {
    const draft = 'The soft cold wind blew and a faint aroma drifted.';
    const r = M.sensoryDetail(draft);
    assert.ok(r.counts.touch >= 1);
    assert.ok(r.counts.smell >= 1);
  });
});
