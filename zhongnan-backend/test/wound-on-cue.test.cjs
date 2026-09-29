/**
 * wound-on-cue 单测（块103）：带伤开挂 / 伤势阀门检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       医学许可/代价/代劳三路 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 * 语料经验：每组事件自带 INJURY 行且距 ACTION 行 ≤2；
 *           rescue 行可落 ACTION 行自身（代价词与行动词同行）；
 *           事件组间隔 >2 行防误合并；sceneIdx 从 -1 自增
 *           （首场景头后 = 0）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { woundOnCue } = require('../dist/engine/wound-on-cue.js');

test('ex01 空稿满分', () => {
  const r = woundOnCue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次咬牙硬撑是燃点不进 hits', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '小舟：爸，凶手就在城东。',
    '△他拔掉输液管，翻身下床。',
    '△他一口气追出了医院。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '小舟：爸，凶手就在城东。',
    '△他拔掉输液管，翻身下床。',
    '△他一口气追出了医院。',
    '△医生：她刚做完手术，下不了床。',
    '小舟：妈，钱在保险柜里。',
    '△她撑着床沿站起来。',
    '△她捂着伤口追出门。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的行动行合并为同一事件', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△他翻身下了病床。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '外景 医院走廊 日',
    '△他一口气追出了医院。',
    '△她伤得很重，还在住院。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0); /* 首个场景头 = scene 0（与既有引擎约定一致） */
  assert.ok(r.hits[0].sceneHeader.includes('走廊'));
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 医学许可锚 rescue：打了止痛针，绷带一缠', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△他一口气追出了医院。',
    '△医生：她刚做完手术，下不了床。',
    '△医生给她打了止痛针，绷带一缠。',
    '△她撑着床沿站起来。',
    '△她捂着伤口追出门。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 代价锚 rescue：伤口崩开了（与行动词同行）', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△他一口气追出了医院。',
    '△医生：她伤得很重，还在住院。',
    '△小舟守在床边。',
    '△她咬着牙冲了过去。',
    '△她咬着牙冲过去，伤口崩开了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 代劳锚 rescue：由兄弟代劳', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△他一口气追出了医院。',
    '△医生：她伤得很重，还在住院。',
    '△小舟按住了她：由兄弟代劳。',
    '△她撑着床沿站起来。',
    '△她捂着伤口追出门。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯伤情陈述无行动放行（病情交代本身是戏）', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根，还在输液。',
    '小舟：我不信。',
    '△小舟守在病房门口。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯行动无伤情放行（健康人打架不归本引擎）', () => {
  const r = woundOnCue([
    '△健身房的沙袋晃了晃。',
    '△他一口气跑完了十圈。',
    '△他咬着牙举起了杠铃。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗：伤情与行动隔4行不配对', () => {
  const r = woundOnCue([
    '△她伤得很重，还在住院。',
    '△病房的窗台上有他养的茉莉。',
    '△小舟坐在床边削苹果。',
    '△监护仪滴滴作响。',
    '△她拔掉了针头。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = woundOnCue([
    '△监护仪滴滴作响。',
    '医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△小舟守在床边。',
    '医生：她身负重伤，还在住院。',
    '△她咬着牙冲了过去。',
    '△小舟守在床边。',
    '△奶奶卧床不起。',
    '△她撞开铁门冲了出去。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 五次未救：n=4 → 封底 20', () => {
  const r = woundOnCue([
    '△医生：他肋骨断了三根。',
    '△他拔掉了针头。',
    '△小舟守在床边。',
    '△她身负重伤。',
    '△她咬着牙冲了过去。',
    '△小舟守在床边。',
    '△爷爷卧床不起。',
    '△他撞开铁门。',
    '△小舟守在床边。',
    '医生：他刚做完手术。',
    '△他从病床上挣扎起来。',
    '△小舟守在床边。',
    '△她失血过多，下不了床。',
    '△她一口气追了出去。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 zh 元数据：sceneIndex 从 0 起、line 为 1 基行号', () => {
  const r = woundOnCue([
    '内景 病房 夜',
    '△医生：他肋骨断了三根，还在输液。',
    '△他拔掉输液管。',
    '△他一口气追出了医院。',
    '△小舟守在床边。',
    '△她身负重伤，还在住院。',
    '△她咬着牙冲了过去。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('病房'));
  assert.strictEqual(r.hits[0].line, 7);
  assert.ok(r.hits[0].marker.length >= 2);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = woundOnCue([
    'Doctor: He has broken ribs and is still on the IV.',
    'He ripped out the IV.',
    'He ran three blocks.',
    'Doctor: She just got out of surgery. She is too weak to move.',
    'Ethan stays by the door.',
    'She pushed herself up.',
    'She chased him on foot.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('ex16 en 医学 rescue：painkiller shot', () => {
  const r = woundOnCue([
    'Doctor: He has broken ribs and is still on the IV.',
    'He ripped out the IV.',
    'He ran three blocks.',
    'Doctor: She is not fully healed. She is too weak to move.',
    'The doctor gave her a painkiller shot.',
    'She pushed herself up.',
    'She chased him on foot.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 层零 CJK', () => {
  const r = woundOnCue([
    'Doctor: He has broken ribs and is still on the IV.',
    'He ripped out the IV.',
    'He ran three blocks.',
    'Doctor: She just got out of surgery. She is too weak to move.',
    'She pushed herself up.',
    'She chased him on foot.',
  ].join('\n'));
  const all = [
    ...r.issues, ...r.advice,
    ...r.hits.flatMap((h) => [h.reason, h.snippet, h.marker, h.sceneHeader]),
  ].join('\n');
  assert.ok(!/[一-鿿]/.test(all), 'en 输出不应包含中文');
});
