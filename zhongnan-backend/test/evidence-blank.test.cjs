/**
 * evidence-blank 单测（块106）：证据恰好失灵 / 取证载体阀门检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       人为来路/替代证据两路 rescue、双锚缺一放行、距离超窗、
 *       场景头不参与、同行共现、en 全链路、en rescue、en 零 CJK、
 *       zh 元数据、计分梯度。
 * 语料经验（块103/104/105教训前置应用）：REC 与 BROKEN 行都占位，
 *       事件组间必须插 ≥2 行零词表词隔离行防误合并；首次豁免后
 *       hits 只含第 2 事件；首个场景头=scene 0。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { evidenceBlank } = require('../dist/engine/evidence-blank.js');

test('ex01 空稿满分', () => {
  const r = evidenceBlank('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次设备故障是现实不进 hits', () => {
  const r = evidenceBlank([
    '△保安挠头：那晚的监控坏了，还没修。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = evidenceBlank([
    '△保安挠头：那段的监控没录上。',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着排班表。',
    '△调出来一看，照片糊了，看不清车牌。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的失灵行合并为同一事件', () => {
  const r = evidenceBlank([
    '△内存卡满了，什么都没录上。',
    '△再翻那张照片，也糊了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两个失灵行各算一次', () => {
  const r = evidenceBlank([
    '△内存卡满了，什么都没录上。',
    '外景 修车铺 日',
    '△行车记录仪的镜头被挡住了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.score, 70);
});

test('ex06 人为来路 rescue：被剪的线是行动不是方便', () => {
  const r = evidenceBlank([
    '△保安挠头：那段的监控没录上。',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着排班表。',
    '△调出来一看，照片糊了，看不清车牌。',
    '△老周蹲下去看，摄像头前天被人剪了线。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 替代证据 rescue：对面路口也拍到了', () => {
  const r = evidenceBlank([
    '△行车记录仪的内存卡满了，最后三天全没录上。',
    '△仓库门口堆着纸箱。',
    '△纸箱上落了层灰。',
    '△调小区监控，那晚黑屏。',
    '△物业翻出备份：对面路口的摄像头也拍到了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯失灵无载体放行：人眼看不清不归本引擎', () => {
  const r = evidenceBlank([
    '△他揉了揉眼睛，看不清远处的人。',
    '△雨太大了，什么都模糊。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯载体陈述无失灵放行：正常取证不罚', () => {
  const r = evidenceBlank([
    '△新装的监控24小时在拍。',
    '△调出了完整的录像。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 场景头不参与匹配：监控室在头行不算载体', () => {
  const r = evidenceBlank([
    '内景 监控室 夜',
    '△谁也没拍到那辆黑车。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 同行共现：载体与失灵同句成事件', () => {
  const r = evidenceBlank([
    '△那晚的监控坏了三天，一直没人修。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex12 距离超窗：载体与失灵隔3行不构成', () => {
  const r = evidenceBlank([
    '△监控室里落满灰尘。',
    '△老周坐在椅子上发呆。',
    '△桌上摆着半盒烟。',
    '△烟灰缸早就满了，没人倒。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex13 en 全链路：两次未救 n=1 → 70', () => {
  const r = evidenceBlank([
    'The security camera was broken for three days.',
    'Dust settled on the empty corridor.',
    'A cat crossed the yard.',
    'She played back the dashcam - the memory card was full, nothing on it.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex14 en rescue：cut the wire 是人为来路', () => {
  const r = evidenceBlank([
    'The lobby camera was broken - black screen for a week.',
    'Rain hammered the parking lot.',
    'The night guard shrugged.',
    'The dashcam footage came back corrupted - nothing but static.',
    'The tech swore someone had cut the wire.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 零 CJK：advice/issues/reason 无中文', () => {
  const r = evidenceBlank([
    'The security camera was broken for three days.',
    'Dust settled on the empty corridor.',
    'A cat crossed the yard.',
    'She played back the dashcam - the memory card was full, nothing on it.',
  ].join('\n'));
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'en result must contain no CJK');
});

test('ex16 zh 元数据：行号/场景索引/场景头/摘录', () => {
  const r = evidenceBlank([
    '内景 便利店 夜',
    '△保安挠头：那段的监控没录上。',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着排班表。',
    '△调出来一看，照片糊了。',
  ].join('\n'));
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 5);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.strictEqual(r.hits[0].sceneHeader, '内景 便利店 夜');
  assert.ok(r.hits[0].snippet.includes('照片糊了'));
  assert.strictEqual(r.hits[0].marker, '糊了');
});

test('ex17 计分梯度：三次未救 n=2 → 50', () => {
  const r = evidenceBlank([
    '△保安挠头：那段的监控没录上。',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着排班表。',
    '△调出来一看，照片糊了。',
    '△他骂了一句。',
    '△把手机揣回兜里，转身就走。',
    '△他又调了楼道的，探头也被挡住了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});
