/**
 * sleep-talk 单测（块134）：梦呓泄密 / 睡眠钥匙检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       含糊不泄/装睡利用两路 rescue（含同行 rescue）、双锚缺一放行、
 *       距离超窗、SLEEP 锚限定（梦见/喃喃不单收）、场景头不参与、
 *       同行共现、en 全链路、en rescue、en 零 CJK。
 * 语料经验（块103/104教训前置应用）：SLEEP 与 LEAK 行都占位，
 *       事件组间必须插 ≥2 行零词表词隔离行（"病房的灯忽明忽暗。"）
 *       防误合并；首次豁免后 hits 只含第 2 事件；首个场景头=scene 0。
 * 划界语料：drunkTruth 锚点是酒（灌醉/劝酒），本引擎锚点是睡
 *       （睡着/梦呓）——"三杯下肚"类酒词不收；eavesdropDump 管
 *       主动偷听，本引擎管被动听见，无窃听词。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { sleepTalk } = require('../dist/engine/sleep-talk.js');

test('ex01 空稿满分', () => {
  const r = sleepTalk('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次梦呓是氛围彩蛋不进 hits', () => {
  const r = sleepTalk([
    '△病房里，他守在床边。',
    '小舟：你猜她会不会说。',
    '△她睡梦中念着：钥匙……在保险柜……',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = sleepTalk([
    '△病房里，他守在床边。',
    '小舟：你猜她会不会说。',
    '△她睡梦中念着：钥匙……在保险柜……',
    '△病房的灯忽明忽暗。',
    '△病房的灯忽明忽暗。',
    '△他睡得沉。',
    '△梦呓里全是当年的真相。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex04 相邻≤2行的睡眠行合并为同一事件', () => {
  const r = sleepTalk([
    '△她睡着了。',
    '△梦呓里念着账本和密码。',
    '△翻了个身，还在说梦话。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件（zh 元数据）', () => {
  const r = sleepTalk([
    '内景 病房 夜',
    '△她睡梦中念着：钥匙……在保险柜……',
    '外景 客厅 夜',
    '△他翻着账本对名单。',
    '△床边，她睡得沉，呓语里全是当年的真相。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].sceneIndex, 1); /* 首个场景头 = scene 0，第二段 = scene 1 */
  assert.ok(r.hits[0].sceneHeader.includes('客厅'));
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex06 含糊不泄 rescue：语无伦次听不清', () => {
  const r = sleepTalk([
    '△她睡梦中念着：钥匙……在保险柜……',
    '△病房的灯忽明忽暗。',
    '△病房的灯忽明忽暗。',
    '△他睡得沉。',
    '△呓语里全是当年的真相。',
    '△可全是语无伦次，谁也听不清。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 装睡利用 rescue：听者主动布局非白给', () => {
  const r = sleepTalk([
    '△她睡梦中念着：钥匙……在保险柜……',
    '△病房的灯忽明忽暗。',
    '△病房的灯忽明忽暗。',
    '△他睡得沉。',
    '△呓语里全是当年的真相。',
    '△其实他一直装睡，等的就是这句。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯睡眠无机密放行', () => {
  const r = sleepTalk([
    '△她睡得很香。',
    '△被子掖好，灯关了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯机密无睡眠语境放行（清醒查账）', () => {
  const r = sleepTalk([
    '△他清醒着翻出账本，对着密码一个个试。',
    '小舟：还在查？',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：睡眠与机密隔4行不配对', () => {
  const r = sleepTalk([
    '△她睡得沉。',
    '△病房的灯忽明忽暗。',
    '△檐角的枯叶簌簌落下。',
    '△走廊里传来脚步声。',
    '△账本摊在桌上，密码就写在扉页。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 SLEEP 锚限定：梦见/喃喃自语不单收', () => {
  const r = sleepTalk([
    '△她梦见妈妈，醒来记不起。',
    '△他喃喃自语，念着密码。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = sleepTalk([
    '△她睡梦中念着：钥匙……在保险柜……',
    '△病房的灯忽明忽暗。',
    '△病房的灯忽明忽暗。',
    '△他睡得沉。',
    '△呓语里全是当年的真相。',
    '△病房的灯忽明忽暗。',
    '△走廊里传来脚步声。',
    '△隔壁床上她睡着了。',
    '△梦呓里蹦出凶手就是他。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.strictEqual(r.hits[1].line, 8); /* hit 行号 = 第 3 场的 SLEEP 锚行（"睡着了"），L9 梦呓为合并行 */
});

test('ex13 场景头行不参与匹配（头含"梦呓"不成事件）', () => {
  const r = sleepTalk([
    '内景 梦呓旅馆 夜',
    '△柜上摆着旧钥匙。',
    '△登记簿翻开着。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex14 同行共现：睡梦与机密同句判一次事件', () => {
  const r = sleepTalk('△她睡梦中念着：钥匙……在保险柜……');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = sleepTalk([
    'Ethan kept watch by the bed.',
    'She fell asleep soon after.',
    'She murmured in her sleep: "the ledger is under the floorboards."',
    'Rain drummed on the tin roof.',
    'Rain drummed on the tin roof.',
    'Ethan fell asleep on the chair.',
    'He talks in his sleep: "who killed your father?"',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.ok(!/[一-鿿]/.test(r.hits[0].reason));
});

test('ex16 en 含糊不泄 rescue：gibberish, no one could make out a word', () => {
  const r = sleepTalk([
    'She fell asleep soon after.',
    'She murmured in her sleep: "the ledger is under the floorboards."',
    'Rain drummed on the tin roof.',
    'Rain drummed on the tin roof.',
    'He fell asleep on the chair.',
    'He mumbled in his sleep about the code.',
    'It was all gibberish - no one could make out a word.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 零 CJK：输出串不含中文', () => {
  const r = sleepTalk([
    'She fell asleep soon after.',
    'She murmured in her sleep: "the ledger is under the floorboards."',
    'Rain drummed on the tin roof.',
    'Rain drummed on the tin roof.',
    'He fell asleep on the chair.',
    'He mumbled in his sleep about the code.',
  ].join('\n'));
  assert.strictEqual(r.unrescuedCount, 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)));
});
