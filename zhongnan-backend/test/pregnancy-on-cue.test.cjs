'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { pregnancyOnCue } = require('../dist/engine/pregnancy-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(pregnancyOnCue('').score, 100);
  assert.strictEqual(pregnancyOnCue('  \n ').score, 100);
  assert.strictEqual(pregnancyOnCue('').hitCount, 0);
});

test('zh: 单次撞击见红豁免不扣分（STRONG 见红）', () => {
  const draft = [
    '内景 客厅 夜',
    '△他猛地一把推开她，她跌坐在地上。',
    '△她腿间见红，脸色煞白。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次撞击见红未救 → 70，元数据落危机行', () => {
  const draft = [
    '内景 客厅 夜',
    '△他猛地一把推开她，她跌坐在地上。',
    '△她腿间见红，脸色煞白。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△他又一把将她推倒，她滚下楼梯。',
    '△她蜷缩在地，动了胎气。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('客厅'));
  assert.ok(h.snippet.includes('胎气'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'shock');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('一推就见红'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('黄体酮'));
});

test('zh: WEAK 危机词无既存孕妇锚——普通车祸受伤放行', () => {
  const draft = [
    '内景 马路 日',
    '△一辆车把她撞倒在地。',
    '△她捂着小腹，腿间流出鲜血。',
    '△路人把她送到医院急诊。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 危机词 + 既存孕妇锚兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 马路 日',
    '△她怀孕三个月，正出门产检。',
    '△一辆车把她撞倒在地。',
    '△她捂着小腹，腿间流出鲜血。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 第2次干呕确诊未救 → 70，元数据落确诊行', () => {
  const draft = [
    '内景 公寓 日',
    '△她一阵恶心，捂着嘴冲进卫生间干呕。',
    '△她举着验孕棒，两道杠刺得眼睛发疼。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△她又是恶心想吐，酸梅子吃了一罐又一罐。',
    '△医生宣布：怀孕八周，妊娠反应。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('公寓'));
  assert.ok(h.snippet.includes('医生'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'diagnosis');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('干呕就确诊'));
  assert.strictEqual(r.score, 70);
});

test('zh: 纯呕吐无确诊放行（食物中毒）', () => {
  const draft = [
    '内景 小饭馆 夜',
    '△他吃了两口凉菜，突然恶心，捂着嘴冲进卫生间呕吐。',
    '△老板说：怕是食物中毒，快叫救护车。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯怀孕陈述无孕反放行（日常产检）', () => {
  const draft = [
    '内景 医院 日',
    '△她拿着产检报告，医生说孩子一切正常。',
    '△她笑着摸了摸肚子起身。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue CARE——黄体酮+卧床医嘱，危机被规范处理', () => {
  const draft = [
    '内景 楼梯间 夜',
    '△他狠狠推了她一把，她摔下楼梯。',
    '△她腿间一热，见红了。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△争执中他又一把推倒她，她跌坐在地。',
    '△她动了胎气，医生给她注射了黄体酮，叮嘱卧床静养。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'shock');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: “可能保不住”危机宣告不算兑付，不救', () => {
  const draft = [
    '内景 客厅 夜',
    '△他一把推开她，她倒在地上。',
    '△她见红了。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△他再次把怀孕的她推倒，她滚下楼梯。',
    '△她身下渗出血来，医生说孩子可能保不住。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: rescue LOSS——孩子最终没了，危机真实兑付', () => {
  const draft = [
    '内景 客厅 夜',
    '△争吵中他一把推开她，她跌坐在地。',
    '△她见红了。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△他又把怀孕的她推倒，她滚下楼梯。',
    '△她再次见红，送医后还是晚了，孩子最终没了。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'shock');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue PROCESS——抽血化验HCG+复查+B超确认', () => {
  const draft = [
    '内景 公寓 日',
    '△她突然恶心干呕。',
    '△验孕棒两道杠。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△她又犯恶心，嗜酸得厉害。',
    '△初筛两道杠，她立刻去医院抽血化验HCG，隔天复查B超确认。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'diagnosis');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue KNOWN——怀孕以来一直吐，既存孕妇日常反应', () => {
  const draft = [
    '内景 公寓 日',
    '△她一阵恶心。',
    '△两道杠，她怀孕了。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△怀孕以来她一直吐，今早又恶心干呕。',
    '△产检护士说妊娠反应还得再熬几周。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'diagnosis');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue FALSE——试纸过期+空欢喜+没怀上', () => {
  const draft = [
    '内景 公寓 日',
    '△她一阵恶心干呕。',
    '△验孕棒两道杠。',
    '△旧挂钟滴答响着。',
    '△墙角堆着几个纸箱。',
    '△她又是恶心想吐，翻出旧验孕棒一看又是两道杠。',
    '△再测一遍却是白板。',
    '△原来试纸过期，一场空欢喜，根本没怀上。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'diagnosis');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻≤2行触发行合并为同一事件', () => {
  const draft = [
    '内景 客厅 夜',
    '△他一把推开她，她撞在茶几上。',
    '△她又被他一把推倒。',
    '△她动了胎气。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 碰撞与危机跨场景头不配对', () => {
  const draft = [
    '内景 客厅 夜',
    '△他一把推开她，她倒在地上。',
    '内景 医院 夜',
    '△医生说她动了胎气，需要保胎。',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: 2nd shove-and-bleed → 70, metadata on fetal line', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'He shoved her down and she crumpled to the floor.',
    'Blood soaked through her skirt; she might lose the baby.',
    'Rain tapped against the window.',
    'A neon sign buzzed outside.',
    'He shoved her backward again and she fell down the stairs.',
    'The fetal heartbeat weakened and the doctors looked grim.',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('LIVING ROOM'));
  assert.ok(h.snippet.toLowerCase().includes('heartbeat'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'shock');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('shove-and-bleed'));
  assert.strictEqual(r.score, 70);
});

test('en: 2nd nausea-to-diagnosis → 70', () => {
  const draft = [
    'INT. APARTMENT - DAY',
    'A wave of nausea hit her and she threw up in the bathroom.',
    'The pregnancy test showed two pink lines.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed across the street.',
    'Morning sickness hit again and she gagged into the sink.',
    'The doctor said: "You\'re pregnant, about eight weeks along."',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'diagnosis');
  assert.ok(h.snippet.toLowerCase().includes('doctor'));
  assert.ok(h.reason.includes('nausea-to-diagnosis'));
  assert.strictEqual(r.score, 70);
});

test('en: ordinary crash injury without pregnancy context passes', () => {
  const draft = [
    'EXT. STREET - DAY',
    'A car hit her and she fell hard.',
    'She clutched her stomach and blood ran down her coat.',
    'A stranger rushed her to the ER.',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: result strings carry zero CJK on an english draft', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'He shoved her down and she crumpled to the floor.',
    'Blood soaked through her skirt; she might lose the baby.',
    'Rain tapped against the window.',
    'A neon sign buzzed outside.',
    'He shoved her backward again and she fell down the stairs.',
    'The fetal heartbeat weakened and the doctors looked grim.',
  ].join('\n');
  const r = pregnancyOnCue(draft);
  assert.strictEqual(r.score, 70);
  const noCjk = (s) => !/[一-鿿]/.test(s);
  for (const h of r.hits) {
    assert.ok(noCjk(h.reason), 'reason has CJK');
    assert.ok(noCjk(h.marker), 'marker has CJK');
    assert.ok(noCjk(h.snippet), 'snippet has CJK');
    assert.ok(noCjk(h.sceneHeader), 'sceneHeader has CJK');
  }
  assert.ok(r.issues.every(noCjk), 'issues has CJK');
  assert.ok(r.advice.every(noCjk), 'advice has CJK');
});
