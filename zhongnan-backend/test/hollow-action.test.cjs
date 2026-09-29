// v2.80 空心动作调度检测（Hollow Stage Business）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/hollow-action.js');

describe('v2.80 hollow-action 空输入', () => {
  test('空草稿满分', () => {
    const r = M.hollowAction('');
    assert.equal(r.score, 100);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 hollow-action 整行空心调度', () => {
  test('站/坐/叹气独占一行判空心', () => {
    const draft = [
      '内景·客厅·夜',
      '他站了起来。',
      '她在沙发边坐了下来。',
      '他叹了口气。',
    ].join('\n');
    const r = M.hollowAction(draft);
    assert.ok(r.hits.length >= 3, `应至少命中3处，实际 ${r.hits.length}`);
    assert.ok(r.hits.some((h) => h.gesture === '站起'));
    assert.ok(r.hits.some((h) => h.gesture === '坐下'));
    assert.ok(r.hits.some((h) => h.gesture === '叹气'));
    assert.ok(r.score < 80);
  });

  test('强能量站起豁免', () => {
    const draft = '内景·客厅·夜\n他猛地站了起来。\n她腾地站起身冲了出去。';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
  });

  test('叹气带后续具体行为不判', () => {
    const draft = '内景·客厅·夜\n他叹了口气，把化验单折成四折塞进她口袋。';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 hollow-action 台词行不统计', () => {
  test('对白里的站起不算动作行', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我当时就站了起来，盯着他看。',
      '沈知远：他叹了口气说算了。',
    ].join('\n');
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 hollow-action 同一调度重复', () => {
  test('叹气出现4次进重复清单', () => {
    const draft = [
      '内景·客厅·夜',
      '他叹了口气。',
      '她也叹了口气，没接话。',
      '灯光下，老人叹了口气，望着窗外。',
      '门关上后，他又叹了口气。',
    ].join('\n');
    const r = M.hollowAction(draft);
    assert.ok((r.gestureCounts['叹气'] ?? 0) >= 4);
    assert.ok(r.repeatedGestures.includes('叹气'));
  });

  test('点头/摇头不判空心行，只计重复', () => {
    const draft = '内景·客厅·夜\n他点了点头。\n她摇了摇头。\n他又点了点头。\n她再次摇了摇头。\n他只能点了点头。';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
    assert.ok((r.gestureCounts['点头'] ?? 0) >= 3);
  });
});

describe('v2.80 hollow-action 健康稿', () => {
  test('动作都带物件/意图满分', () => {
    const draft = [
      '内景·厨房·夜',
      '她把婚戒搁在洗碗池边沿，推到他那一侧。',
      '他用拇指擦掉回执单上的水渍，折好塞进衬衣口袋。',
      '她捏住输液管的滚轮，慢慢调到最大，盯着他的脸。',
    ].join('\n');
    const r = M.hollowAction(draft);
    assert.equal(r.score, 100);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 hollow-action en 链路', () => {
  test('英文整行叹气/站坐判空心', () => {
    const draft = 'INT. LIVING ROOM - NIGHT\nHe sighs.\nShe sat down.\nSteve stands up.';
    const r = M.hollowAction(draft);
    assert.ok(r.hits.length >= 3, `hits=${r.hits.length}`);
  });
  test('英文叹气带后续不判', () => {
    const draft = 'INT. ROOM - NIGHT\nHe let out a sigh and reached for the gun in the drawer.';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
  });
  test('英文强能量动作豁免', () => {
    const draft = 'INT. ROOM - NIGHT\nHe slams the table and stands up.';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
  });
  test('英文点头只计重复不判空心', () => {
    const draft = 'INT. ROOM - NIGHT\nHe nods.\nShe nods.\nHe nods again.\nShe nods at the door.\nHe nods slowly.';
    const r = M.hollowAction(draft);
    assert.equal(r.hits.length, 0);
    assert.ok((r.gestureCounts['nod'] ?? 0) >= 4);
  });
});
