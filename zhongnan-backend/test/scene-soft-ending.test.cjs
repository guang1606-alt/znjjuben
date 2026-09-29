// v2.80 场景软收尾检测（Scene Soft Ending）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/scene-soft-ending.js');

describe('v2.80 scene-soft-ending 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.sceneSoftEnding('').score, 100);
  });
});

describe('v2.80 scene-soft-ending 泄气尾巴', () => {
  test('高能后叹气短退判软收尾', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上。',
      '沈知远：这不可能！',
      '林棠：证据就在你眼前。',
      '她叹了口气，转身默默离开。',
      '内景·走廊·夜',
      '林棠靠在墙上。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 1);
    assert.ok(r.score < 100);
  });

  test('高能后摔门而去不判（强收尾）', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠把离婚协议拍在桌上。',
      '沈知远：你凭什么！',
      '她转身就走，房门被摔得震天响。',
      '内景·走廊·夜',
      '林棠靠在墙上。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 0);
    assert.equal(r.score, 100);
  });

  test('末拍落在钩子物证上不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上。',
      '沈知远脸色煞白。',
      '林棠走后，他的手机屏幕亮起：亲子鉴定已完成。',
      '内景·医院·日',
      '走廊尽头站着林棠。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 scene-soft-ending 边界', () => {
  test('无冲突场景软收尾不判（没有气可泄）', () => {
    const draft = [
      '内景·茶室·日',
      '母亲给她倒了杯茶。',
      '两人慢慢喝着。',
      '她默默起身离开。',
      '内景·走廊·日',
      '灯光昏暗。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 0);
  });

  test('末场软收尾交给 cliffhanger，不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上。',
      '沈知远：这不可能！',
      '她叹了口气，转身默默离开。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.checkedScenes, 0);
    assert.equal(r.hits.length, 0);
  });

  test('末拍是对白行不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠把证据拍在桌上。',
      '沈知远脸色发白。',
      '林棠：明天法院见。',
      '内景·法院外·日',
      '台阶很长。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 scene-soft-ending 多场累计', () => {
  test('两个内场泄气累计扣分', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠拍桌：签字离婚！',
      '沈知远僵在原地。',
      '她叹了口气，转身离开。',
      '内景·办公室·日',
      '沈知远把证据摔在总监面前。',
      '总监满脸铁青。',
      '他摇了摇头，久久没有说话。',
      '内景·天台·夜',
      '风吹过。',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.sceneCount, 3);
    assert.equal(r.hits.length, 2);
  });
});

describe('v2.80 scene-soft-ending en', () => {
  test('sigh-and-lead-away flagged', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Anna slams the divorce papers on the table.',
      'Ben: How dare you!',
      'She sighed and turned away.',
      'INT. HALLWAY - NIGHT',
      'The light flickered.',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 1);
  });
  test('hard cut on evidence clean', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Anna slams the DNA report on the table.',
      'Ben stares at it.',
      'Her phone screen lit up with a new message.',
      'INT. HOSPITAL - DAY',
      'Anna stood at the end of the hall.',
    ].join('\n');
    const r = M.sceneSoftEnding(draft);
    assert.equal(r.hits.length, 0);
  });
});

// c211 落库统一 digest：批量/SSE/修复三处同形态，限界防膨胀
describe('c211 sceneSoftEndingDigest 限界与形态', () => {
  const big = (n, ch) => ch.repeat(n);
  const fakeHit = (i) => ({
    sceneHeader: `第${i}场 ` + big(60, '场'),
    endLine: 100 + i,
    ending: big(80, '尾'),
    reason: big(200, '理'),
    extra: '无界字段必须剥离',
  });
  const base = {
    score: 55, sceneCount: 30, checkedScenes: 29,
    hits: Array.from({ length: 12 }, (_, i) => fakeHit(i)),
    issues: Array.from({ length: 9 }, (_, i) => `issue${i} ` + big(240, '问')),
    advice: big(260, '建'),
  };

  test('hits≤8/issues≤6 且各字符串截断；hits 只四字段', () => {
    const d = M.sceneSoftEndingDigest(base);
    assert.strictEqual(d.hits.length, 8);
    assert.strictEqual(d.issues.length, 6);
    assert.deepStrictEqual(Object.keys(d.hits[0]).sort(), ['endLine', 'ending', 'reason', 'sceneHeader']);
    assert.ok(d.hits[0].sceneHeader.length <= 40 + 3, '场景名截断（含第N场前缀）');
    assert.ok(d.hits[0].ending.length <= 30);
    assert.ok(d.hits[0].reason.length <= 120);
    assert.ok(d.issues.every((s) => s.length <= 200));
    assert.ok(d.advice.length <= 200);
    assert.strictEqual(d.score, 55);
    assert.strictEqual(d.sceneCount, 30);
    assert.strictEqual(d.checkedScenes, 29);
  });

  test('健康形态透传（空 hits/issues，advice 保留）', () => {
    const d = M.sceneSoftEndingDigest(M.sceneSoftEnding(''));
    assert.strictEqual(d.score, 100);
    assert.deepStrictEqual(d.hits, []);
    assert.deepStrictEqual(d.issues, []);
    assert.strictEqual(typeof d.advice, 'string');
  });

  test('null/非法入参显式抛错，不静默伪造', () => {
    assert.throws(() => M.sceneSoftEndingDigest(null));
    assert.throws(() => M.sceneSoftEndingDigest(undefined));
  });

  test('forStorage 端到端：泄气尾巴稿出限界形态，干净稿满分', () => {
    const bad = [
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上。',
      '沈知远：这不可能！',
      '她叹了口气，转身默默离开。',
      '内景·走廊·夜',
      '林棠靠在墙上。',
    ].join('\n');
    const d = M.sceneSoftEndingForStorage(bad);
    assert.strictEqual(d.hits.length, 1);
    assert.ok(d.score < 100);
    assert.ok(d.hits[0].sceneHeader.length <= 43);
    const clean = M.sceneSoftEndingForStorage([
      '内景·客厅·夜',
      '林棠把亲子鉴定拍在桌上。',
      '沈知远：你还有什么话说？',
      '林棠：明天就等着瞧。',
      '内景·走廊·夜',
      '林棠靠墙站着。',
    ].join('\n'));
    assert.strictEqual(clean.hits.length, 0);
  });
});
