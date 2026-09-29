'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { amnesiaOnCue } = require('../dist/engine/amnesia-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(amnesiaOnCue('').score, 100);
  assert.strictEqual(amnesiaOnCue('  \n ').score, 100);
  assert.strictEqual(amnesiaOnCue('').hitCount, 0);
});

test('zh: 单次撞击秒失忆（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 楼梯间 夜',
    '△她被他一推，滚下楼梯，后脑重重磕在台阶上。',
    '△醒来时她得了逆行性遗忘，谁都不记得。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次撞击秒失忆未救 → 70，元数据落失忆行', () => {
  const draft = [
    '内景 林家 夜',
    '△她脚下一滑摔下楼梯，后脑重重磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△混乱中她跌倒磕到了头。',
    '△她再度失忆，过去一片空白。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('失忆'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('一撞就失忆'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('CT'));
});

test('zh: WEAK 失忆词无医疗语境——日常遗忘放行', () => {
  const draft = [
    '内景 办公室 日',
    '△他起身时磕到了头。',
    '△他不记得了，钥匙放在哪。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 失忆词 + 醒后医疗语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 病房 日',
    '△她摔下楼梯磕到后脑。',
    '△她醒来后谁都不认得，一直问你是谁。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯失忆陈述无头部受创锚放行（心因性失忆归跨集账）', () => {
  const draft = [
    '内景 诊室 日',
    '△医生说她是心因性失忆，需要长期心理治疗。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 撞头后没有失忆结果——普通动作戏放行', () => {
  const draft = [
    '内景 小巷 夜',
    '△混混一棍砸在他后脑，他踉跄着扶住墙。',
    '△他骂了一句，转身继续追。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 第2次廉价秒恢复未救 → 70，kind=recall', () => {
  const draft = [
    '内景 老宅 日',
    '△店里放着那首歌。',
    '△她全都想起来了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△路过旧地，她翻出那条项链。',
    '△记忆如潮水般涌回，过去的一切都回来了。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'recall');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.snippet.includes('涌回'));
  assert.ok(h.reason.includes('秒恢复'));
  assert.strictEqual(r.score, 70);
});

test('zh: 有触发物但无整体恢复——听歌怀旧放行', () => {
  const draft = [
    '内景 车里 日',
    '△电台里响起熟悉的旋律。',
    '△她怔了怔，眼眶发红，却什么也没说。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 双型混排——首次 onset 豁免，第2次 recall 落账', () => {
  const draft = [
    '内景 林家 夜',
    '△她摔下楼梯，后脑磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△店里放着那首歌。',
    '△她全都想起来了。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'recall');
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('zh: rescue CARE——脑部CT+神经科会诊+留院观察', () => {
  const draft = [
    '内景 医院 日',
    '△她摔下楼梯，后脑磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她又一次磕到了头。',
    '△她再度失忆，医生安排了脑部CT和神经科会诊，留院观察。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue PERMANENT——记忆再也没能恢复，阀门真掐断', () => {
  const draft = [
    '内景 公寓 夜',
    '△她摔下楼梯，后脑重重磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她往后一仰，后脑撞在墙上。',
    '△她又失忆了，而这一次记忆再也没能恢复。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue PRICE——失忆期间被冒名利用、连孩子都不认', () => {
  const draft = [
    '内景 公寓 夜',
    '△她摔下楼梯，后脑重重磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她跌坐在地，后脑撞在门槛上。',
    '△她再次失去记忆，骗子利用她失忆冒名顶替，连自己的孩子都不认得了。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue PROCESS——数月心理治疗后逐渐恢复记忆', () => {
  const draft = [
    '内景 诊所 日',
    '△店里放着那首歌。',
    '△她全都想起来了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她看见那条手链。',
    '△经过数月心理治疗，她才逐渐恢复了记忆。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'recall');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue PARTIAL——只想起片段，记忆仍有空白', () => {
  const draft = [
    '内景 老宅 日',
    '△店里放着那首歌。',
    '△她全都想起来了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她翻出那张旧照片。',
    '△她恢复了记忆，却只想起一些片段，记忆仍有空白。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'recall');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻≤2行触发行合并为同一事件', () => {
  const draft = [
    '内景 老屋 日',
    '△她听到那首歌。',
    '△她又看见那条项链。',
    '△她全都想起来了。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 撞击与失忆跨场景头不配对', () => {
  const draft = [
    '内景 客厅 夜',
    '△她往后一仰，后脑撞在墙上。',
    '内景 医院 日',
    '△医生说她失忆了。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: snippet 截30字、marker 截28字', () => {
  const draft = [
    '内景 林家 夜',
    '△她摔下楼梯，后脑磕在台阶上。',
    '△她失去了记忆。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△混乱中她跌倒磕到了头。',
    '△她再度失忆，那些过往的人与事全都被一只无形的手彻底抹去，半点不剩。',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hits.length, 1);
  assert.ok(r.hits[0].snippet.length <= 30);
  assert.ok(r.hits[0].marker.length <= 28);
});

/* ============ English ============ */

test('en: single bump-to-amnesia (STRONG) exempt', () => {
  const draft = [
    'INT. HOSPITAL WARD - DAY',
    'She fell down the stairs and hit her head on the edge of a step.',
    'When she woke up, the doctors said it was retrograde amnesia.',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: 2nd bump-to-amnesia unrescued → 70', () => {
  const draft = [
    'INT. LIN HOUSE - NIGHT',
    'She tripped on the steps and hit her head.',
    'The diagnosis was amnesia.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'In the struggle she struck her head against the doorframe.',
    'Once again she had amnesia and remembered nothing.',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('LIN HOUSE'));
  assert.ok(h.snippet.toLowerCase().includes('amnesia'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('bump-on-the-head amnesia'));
  assert.strictEqual(r.score, 70);
});

test('en: 2nd instant-recall unrescued → 70, kind=recall', () => {
  const draft = [
    'INT. OLD HOUSE - DAY',
    'Hearing the familiar song, she froze.',
    'Suddenly memories flooded back.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Then she saw the old necklace in the drawer.',
    'It all came flooding back and she remembered everything.',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'recall');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.snippet.toLowerCase().includes('came flooding'));
  assert.ok(h.reason.includes('instant-recall'));
  assert.strictEqual(r.score, 70);
});

test('en: rescue TRAUMA——memories rush back but she relives the trauma', () => {
  const draft = [
    'INT. OLD APARTMENT - DAY',
    'Hearing the familiar song, she froze.',
    'Suddenly memories flooded back.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'She spotted the keepsake on the shelf.',
    'All her memories rushed back and she relived the trauma, screaming in agony.',
  ].join('\n');
  const r = amnesiaOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'recall');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: result strings carry zero CJK on an english draft', () => {
  const draft = [
    'INT. LIN HOUSE - NIGHT',
    'She tripped on the steps and hit her head.',
    'The diagnosis was amnesia.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'In the struggle she struck her head against the doorframe.',
    'Once again she had amnesia and remembered nothing.',
  ].join('\n');
  const r = amnesiaOnCue(draft);
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
