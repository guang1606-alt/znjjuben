/**
 * wake-on-cue 单测（块102）：呼唤即醒 / 病床阀门检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       医学/渐变/守候三路 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 * 语料经验：每组事件自带 COMA 行且距 WAKE 行 ≤2；
 *           rescue 行可落 WAKE 行自身（渐变词与唤醒词同行）；
 *           事件组间隔 >2 行防误合并；sceneIdx 从 -1 自增
 *           （首场景头后 = 0）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { wakeOnCue } = require('../dist/engine/wake-on-cue.js');

test('ex01 空稿满分', () => {
  const r = wakeOnCue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次呼唤即醒是奇迹高光不进 hits', () => {
  const r = wakeOnCue([
    '△病床上的监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '小舟：妈，哥回来了，你睁眼看看。',
    '△她的手指动了。',
    '她：……小舟？',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = wakeOnCue([
    '△病床上的监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '小舟：妈，哥回来了，你睁眼看看。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△老宅塌了半边，爸在病床上昏迷了半年。',
    '小舟：爸，我给你读信。',
    '△他的手指动了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的唤醒行合并为同一事件', () => {
  const r = wakeOnCue([
    '△监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '△她的手指动了。',
    '△她缓缓睁开眼睛。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = wakeOnCue([
    '△监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '△她的手指动了。',
    '外景 医院走廊 日',
    '△他的手指动了。',
    '△病房里，爸昏迷了半年。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0); /* 首个场景头 = scene 0（与既有引擎约定一致） */
  assert.ok(r.hits[0].sceneHeader.includes('走廊'));
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex06 医学过程锚 rescue：会诊后脑电波出现恢复迹象', () => {
  const r = wakeOnCue([
    '△病床上的监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '小舟：妈，哥回来了，你睁眼看看。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△车祸后爸昏迷了半年，医生下了三次病危通知。',
    '△第三次会诊后，脑电波出现了恢复迹象。',
    '△他的手指动了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 渐变锚 rescue：三天后才缓缓睁开眼睛（渐变词与唤醒词同行）', () => {
  const r = wakeOnCue([
    '△病床上的监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '小舟：妈，哥回来了，你睁眼看看。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△车祸后爸昏迷了半年，医生说醒不了了。',
    '△病房的窗台上有他养的茉莉。',
    '△三天后，他才缓缓睁开眼睛。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 守候锚 rescue：日复一日地来念信', () => {
  const r = wakeOnCue([
    '△病床上的监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '小舟：妈，哥回来了，你睁眼看看。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△爸昏迷了半年，小舟日复一日地来念信。',
    '△他的手指动了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯昏迷陈述无唤醒放行（病情交代本身是戏）', () => {
  const r = wakeOnCue([
    '医生：她成了植物人，这辈子都醒不了了。',
    '小舟：我不信。',
    '△小舟搬进了病房隔壁的旅馆。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯苏醒无长期昏迷放行（普通术后苏醒）', () => {
  const r = wakeOnCue([
    '△手术室的灯灭了。',
    '医生：手术很成功。',
    '小舟：他什么时候能醒？',
    '△傍晚，他在病床上睁开了眼睛。',
    '小舟：你醒了？',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗：昏迷与唤醒隔4行不配对', () => {
  const r = wakeOnCue([
    '△她昏迷了三年，成了植物人。',
    '△病房的窗台上有他养的茉莉。',
    '△小舟坐在床边削苹果。',
    '△监护仪滴滴作响。',
    '△她的手指动了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = wakeOnCue([
    '△监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△爸昏迷了半年。',
    '△他的手指动了。',
    '△小舟握紧了她的手。',
    '△奶奶沉睡了十年。',
    '△她悠悠转醒。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 五次未救：n=4 → 封底 20', () => {
  const r = wakeOnCue([
    '医生：她昏迷三年了。',
    '△她的手指动了。',
    '△小舟守在床边。',
    '△爸成了植物人。',
    '△他睁开了眼睛。',
    '△小舟守在床边。',
    '△她沉睡了十年。',
    '△她悠悠转醒。',
    '△小舟守在床边。',
    '医生：他醒不了了。',
    '△他的手指动了。',
    '△小舟守在床边。',
    '△奶奶一直没醒。',
    '△她睁开了眼睛。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 zh 元数据：sceneIndex 从 0 起、line 为 1 基行号', () => {
  const r = wakeOnCue([
    '内景 病房 夜',
    '△监护仪滴滴作响。',
    '医生：她昏迷三年了，成了植物人。',
    '△她的手指动了。',
    '△小舟握紧了她的手。',
    '△爸昏迷了半年。',
    '△他的手指动了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('病房'));
  assert.strictEqual(r.hits[0].line, 7);
  assert.ok(r.hits[0].marker.length >= 2);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = wakeOnCue([
    'The monitor beeps on.',
    'Doctor: She has been in a coma for three years. She will never wake up.',
    'Ethan takes her hand: Mom, it is me.',
    'Her fingers twitched.',
    'Ethan holds his breath.',
    'Doctor: He has been in a coma for months.',
    'Ethan reads the letter aloud.',
    'His fingers twitched.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('ex16 en 医学 rescue：scans showed signs of brain activity', () => {
  const r = wakeOnCue([
    'The monitor beeps on.',
    'Doctor: She has been in a coma for three years. She will never wake up.',
    'Ethan takes her hand: Mom, it is me.',
    'Her fingers twitched.',
    'Ethan holds his breath.',
    'Doctor: He has been in a coma for months.',
    'The scans finally showed signs of brain activity.',
    'His fingers twitched.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 层零 CJK', () => {
  const r = wakeOnCue([
    'The monitor beeps on.',
    'Doctor: She has been in a coma for three years. She will never wake up.',
    'Ethan takes her hand: Mom, it is me.',
    'Her fingers twitched.',
    'Ethan holds his breath.',
    'Doctor: He has been in a coma for months.',
    'Ethan reads the letter aloud.',
    'His fingers twitched.',
  ].join('\n'));
  const all = [
    ...r.issues, ...r.advice,
    ...r.hits.flatMap((h) => [h.reason, h.snippet, h.marker, h.sceneHeader]),
  ].join('\n');
  assert.ok(!/[一-鿿]/.test(all), 'en 输出不应包含中文');
});
