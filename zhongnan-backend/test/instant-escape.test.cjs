/**
 * instant-escape 单测（块104）：束缚秒脱 / 脱身白给检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       工具/挣扎/外援三路 rescue、双锚缺一放行、距离超窗、
 *       场景头不参与匹配、同行 rescue、en 全链路、en rescue、
 *       en 零 CJK、zh 元数据。
 * 语料经验：BIND 与 ESCAPE 都占行，事件组之间必须插 ≥2 行隔离行
 *           拉开距离（防上一组 ESCAPE 行与下一组合并，块103教训）；
 *           rescue 行可落 ESCAPE 行自身；sceneIdx 从 -1 自增
 *           （首场景头后 = 0）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantEscape } = require('../dist/engine/instant-escape.js');

test('ex01 空稿满分', () => {
  const r = instantEscape('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次绝境反击是高光不进 hits', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子，活动了下手腕。',
    '小舟：该反击了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子，活动了下手腕。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△阿婆松了绑，站了起来。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的脱身行合并为同一事件', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△她挣脱了绳子。',
    '△她揉了揉发麻的手腕。',
    '△她脱了身，闪出门外。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件（zh 元数据）', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△她挣脱了绳子。',
    '内景 走廊 夜',
    '△他被手铐锁死在栏杆上。',
    '△她撬开了手铐。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits.length, 1); /* 第1次豁免不进 hits */
  assert.strictEqual(r.hits[0].sceneIndex, 0); /* 首个场景头 = scene 0（与既有引擎约定一致） */
  assert.ok(r.hits[0].sceneHeader.includes('走廊'));
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex06 工具铺垫 rescue：袖中藏着发夹', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子，推门而出。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△阿婆袖中藏着一枚发夹。',
    '△阿婆挣脱了绳索，走了出去。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 挣扎代价 rescue：磨了半夜才磨断绳索', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△阿婆磨了半夜，才磨断绳索。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 外援 rescue：同伙开门替阿婆松绑', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△同伙开门进来，替阿婆松绑。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯束缚陈述无脱身放行（囚禁交代本身是戏）', () => {
  const r = instantEscape([
    '△小舟被关进了地牢，铁门外守着两个看守。',
    '看守：上头说了，谁也不许探视。',
    '△小舟把耳朵贴在门缝上听动静。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯脱身无束缚放行（正常挣脱人群不归本引擎）', () => {
  const r = instantEscape([
    '△他挣脱了人群，快步离开。',
    '△巷口的灯还亮着。',
    '小舟：跟紧我。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗：束缚与脱身隔4行不配对', () => {
  const r = instantEscape([
    '△小舟被五花大绑按在椅子上。',
    '△雨点敲打着铁皮屋顶。',
    '△隔壁传来看守的脚步声。',
    '△灯泡忽明忽暗。',
    '△她终于挣脱了绳子。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△阿婆松了绑，站了起来。',
    '△小舟深吸了一口气。',
    '△地下室里，老陈被锁链吊在横梁上。',
    '△老陈挣脱开锁链，落了地。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 场景头行不参与匹配（头行含囚禁词不构成事件）', () => {
  const r = instantEscape([
    '内景 地牢（囚禁重犯） 夜',
    '△小舟隔着铁门与看守对话。',
    '看守：明天提审。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex14 rescue 行可与脱身行同行（磨断绳索+手腕渗出血）', () => {
  const r = instantEscape([
    '△他把小舟五花大绑，锁进了仓库。',
    '△小舟挣脱了绳子。',
    '△窗外的雨下个不停。',
    '△柴房里，阿婆被捆在柱子上。',
    '△阿婆磨断了绳索，手腕渗出血。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = instantEscape([
    'He tied her to a chair and left.',
    'She slipped the ropes and stood up.',
    'Rain drummed on the tin roof.',
    'They locked him up in the cellar.',
    'He picked the lock and walked out.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex16 en 工具铺垫 rescue：hairpin smuggled in', () => {
  const r = instantEscape([
    'He tied her to a chair and left.',
    'She slipped the ropes and stood up.',
    'Rain drummed on the tin roof.',
    'They locked her up in the cellar.',
    'The hairpin she smuggled in did the rest - she freed herself in a minute.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 零 CJK：输出串不含中文', () => {
  const r = instantEscape([
    'He tied her to a chair and left.',
    'She slipped the ropes and stood up.',
    'Rain drummed on the tin roof.',
    'They locked him up in the cellar.',
    'He picked the lock and walked out.',
  ].join('\n'));
  assert.strictEqual(r.unrescuedCount, 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)));
});
