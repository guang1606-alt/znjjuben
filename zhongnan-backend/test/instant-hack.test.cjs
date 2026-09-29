/**
 * instant-hack 单测（块98）：黑客秒破/技术蒙太奇检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头、
 *       成本/内应双 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantHack } = require('../dist/engine/instant-hack.js');

test('ex01 空稿满分', () => {
  const r = instantHack('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次秒破是爽点不进 hits', () => {
  const r = instantHack([
    '△苏晚十指翻飞，屏幕上代码瀑布般滚落。',
    '苏晚：黑进了公安内网，不过如此。',
    '△安保科的警报灯闪了一下，又归于沉寂。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = instantHack([
    '△苏晚十指翻飞，屏幕上代码瀑布般滚落。',
    '苏晚：黑进了公安内网，不过如此。',
    '△安保科的警报灯闪了一下。',
    '△她活动了一下手腕。',
    '△下一台主机已经接入。',
    '苏晚：银行的加密，三秒破解。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行入侵行合并为同一事件', () => {
  const r = instantHack([
    '苏晚：黑进了公安内网。',
    '△屏幕代码刷过。',
    '苏晚：数据库权限也破解了。',
    '△她合上电脑。',
    '△走廊尽头空无一人。',
    '△电梯下行。',
    '苏晚：银行金库的门禁，黑掉了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = instantHack([
    '苏晚：黑进了公安内网。',
    '内景 安保机房 夜',
    '苏晚：银行的加密也破解了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('安保机房'));
});

test('ex06 成本锚 rescue：失败了三次再成功', () => {
  const r = instantHack([
    '苏晚：黑进了公安内网，不过如此。',
    '△主机指示灯明灭。',
    '△她揉了揉发酸的手腕。失败了三次，这次才进去。',
    '苏晚：银行的加密，破解了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 内应锚 rescue：密码是内鬼给的', () => {
  const r = instantHack([
    '苏晚：黑进了公安内网，不过如此。',
    '△走廊里脚步声远去。',
    '老周：密码是内鬼给的，账号是买来的。',
    '苏晚：银行的加密，破解了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯入侵无高安全目标放行（黑邻居WiFi/公司考勤）', () => {
  const r = instantHack([
    '苏晚：黑进了邻居家的WiFi。',
    '苏晚：顺便看了看他公司的考勤记录。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯安保陈述无入侵动作放行', () => {
  const r = instantHack('苏晚：公安内网的防火墙固若金汤，没人能从外面动它。');
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：目标与入侵隔4行不配对', () => {
  const r = instantHack([
    '苏晚：今晚的目标是公安内网。',
    '△她起身去倒水。',
    '△回来时换了台笔记本。',
    '△插上电源。',
    '△深吸一口气。',
    '苏晚：破解，开始。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 三次未救：n=2 → 50', () => {
  const r = instantHack([
    '△屏幕的光映在她脸上。',
    '苏晚：黑进了公安内网。',
    '△代码瀑布般滚落。',
    '△警报声被她掐灭。',
    '△下一段进度条开始走。',
    '苏晚：银行的加密，三秒破解。',
    '△屏幕的光映在她脸上。',
    '△代码瀑布般滚落。',
    '△警报声被她掐灭。',
    '△下一段进度条开始走。',
    '苏晚：入侵了军方的数据库。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 五次未救：n=4 → 封底 20', () => {
  const r = instantHack([
    '△屏幕的光映在她脸上。',
    '苏晚：黑进了公安内网。',
    '△屏幕的光映在她脸上。',
    '△代码瀑布般滚落。',
    '苏晚：银行的加密，破解了。',
    '△屏幕的光映在她脸上。',
    '△代码瀑布般滚落。',
    '苏晚：入侵了军方的数据库。',
    '△屏幕的光映在她脸上。',
    '△代码瀑布般滚落。',
    '苏晚：攻破了情报局的档案系统。',
    '△屏幕的光映在她脸上。',
    '△代码瀑布般滚落。',
    '苏晚：破译了国安局的加密系统。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 en 全链路：两事件 n=1 → 70', () => {
  const r = instantHack([
    '△The terminal light glowed in the dark.',
    'Maya: Hacked into the police database, just like that.',
    '△The cursor blinked.',
    '△Sweat beaded at her temple.',
    'Maya: Bypassed the firewall on the military network too.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex14 en 成本锚 rescue：all night + failed', () => {
  const r = instantHack([
    'Maya: Hacked into the police database, just like that.',
    '△The cursor blinked.',
    '△It took her all night and seven failed attempts to get this far.',
    'Maya: Cracked the encryption on the federal banking system too.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 纯 hack 无高安全目标放行', () => {
  const r = instantHack("Maya: I hacked into my ex's email account, just to see.");
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 层零中文：issues/advice/reason 无 CJK', () => {
  const r = instantHack([
    '△The terminal light glowed in the dark.',
    'Maya: Hacked into the police database, just like that.',
    '△The cursor blinked.',
    '△Sweat beaded at her temple.',
    'Maya: Bypassed the firewall on the military network too.',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.issues[0] || ''));
  assert.ok(r.advice.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.advice[0] || ''));
  assert.ok(!/[\u4e00-\u9fff]/.test(r.hits[0].reason || ''));
});

test('ex17 zh 元数据：issues/advice/reason 中文', () => {
  const r = instantHack([
    '△苏晚十指翻飞，屏幕上代码瀑布般滚落。',
    '苏晚：黑进了公安内网，不过如此。',
    '△安保科的警报灯闪了一下。',
    '△她活动了一下手腕。',
    '△下一台主机已经接入。',
    '苏晚：银行的加密，三秒破解。',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(r.issues[0].includes('黑客秒破'));
  assert.ok(r.advice[0].includes('技术戏'));
  assert.ok(r.hits[0].reason.includes('三秒黑客'));
});
