const { forcedProximity } = require('../dist/engine/forced-proximity.js');
const assert = require('assert');

/* c123 forced-proximity 困处阀门检测单测
 * 16 例：中文命中 / 英文命中 / 放行 / rescue×2 / 首次豁免 /
 *       计分 / 场景头排除 / 合并 / 跨场景不合并 / 空文本 / 自身排除 / 英文rescue / 英文计分 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c123 forced-proximity 困处阀门检测 ===\n');

/* 1. 中文命中：困处×浪漫推进共现，首次豁免 */
test('中文命中：电梯故障+心跳，首次豁免不罚', () => {
  const draft = `内景 电梯
苏晚：怎么回事？
陆总（低声）：别动。
黑暗中，她的心跳得很快。
电梯猛地一震，停住了。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免，unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免，score 应为 100');
});

/* 2. 中文第2次命中：n=1 → 100（首次未救援也豁免） */
test('中文第2次命中未救援：n=1 → 100', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
她的心跳得很快。
苏晚不自觉靠近了他。

内景 地下室
停电了，四周漆黑。
她的脸红了。
她不自觉靠近了他。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 1, 'unrescuedCount 应为 1');
  assert.strictEqual(r.score, 100, 'n=1 → 100（首次未救援豁免）');
});

/* 3. 中文第3次命中：n=2 → 70 */
test('中文第3次命中未救援：n=2 → 70', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
她的心跳得很快。
苏晚不自觉靠近了他。

内景 地下室
停电了，四周漆黑。
她的脸红了。
她不自觉靠近了他。

内景 仓库
密室反锁了。
他的目光撞上了她的。
身体不自觉向她靠。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 70, 'n=2 → 70');
});

/* 4. 纯困处无浪漫推进放行 */
test('纯困处无浪漫推进放行', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
苏晚：怎么回事？
陆总：别急，等维修。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 0, '纯困处无浪漫推进，hitCount 应为 0');
  assert.strictEqual(r.score, 100);
});

/* 5. 纯浪漫推进无困处放行 */
test('纯浪漫推进无困处放行', () => {
  const draft = `内景 咖啡厅
她的心跳得很快。
她不自觉靠近了他。
脸有些红了。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 0, '纯浪漫推进无困处，hitCount 应为 0');
  assert.strictEqual(r.score, 100);
});

/* 6. rescue R1：已有关系基础锚 */
test('rescue R1：已有关系基础锚放行', () => {
  const draft = `内景 电梯
苏晚暗恋陆总已经三年了。
电梯猛地一震，停住了。
她的心跳得很快。
她不自觉靠近了他。

内景 地下室
早就喜欢他了。
停电了，四周漆黑。
她的脸红了。
她不自觉靠近了他。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 0, '有已有关系基础锚 rescue，unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '全 rescue，score 应为 100');
});

/* 7. rescue R2：挣脱/拒绝锚 */
test('rescue R2：挣脱/拒绝锚放行', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
她的心跳得很快。
她不自觉靠近了他。
苏晚猛地推开他：别碰我！

内景 地下室
停电了，四周漆黑。
她的脸红了。
她靠近了一步。
陆总退后一步：离我远点。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 0, '有挣脱/拒绝锚 rescue，unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100);
});

/* 8. 英文命中 */
test('英文命中：elevator broke + heartbeat', () => {
  const draft = `INT. ELEVATOR
The elevator jolted and stopped.
Her heartbeat raced in the dark.
She drew closer to him without thinking.`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免');
  assert.strictEqual(r.score, 100);
});

/* 9. 英文第2次命中：n=1 → 100 */
test('英文第2次命中未救援：n=1 → 100', () => {
  const draft = `INT. ELEVATOR
The elevator jolted and stopped.
Her heartbeat raced.
She drew closer to him.

INT. BASEMENT
Power outage. Total darkness.
His eyes met hers.
He leaned in toward her.`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 1, 'unrescuedCount 应为 1');
  assert.strictEqual(r.score, 100, 'n=1 → 100');
});

/* 10. 英文 rescue R1：had feelings for */
test('英文 rescue R1：had feelings for 放行', () => {
  const draft = `INT. ELEVATOR
She had feelings for him for years.
The elevator jolted and stopped.
Her heartbeat raced.
She drew closer to him.

INT. BASEMENT
She always liked him.
Power outage.
His eyes met hers.
He leaned in toward her.`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, 'had feelings for rescue');
  assert.strictEqual(r.score, 100);
});

/* 11. 英文 rescue R2：pushed away */
test('英文 rescue R2：pushed away 放行', () => {
  const draft = `INT. ELEVATOR
The elevator jolted and stopped.
Her heartbeat raced.
She drew closer to him.
He pushed her away.

INT. BASEMENT
Power outage.
His eyes met hers.
He leaned in toward her.
She stepped back.`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, 'pushed away rescue');
  assert.strictEqual(r.score, 100);
});

/* 12. 场景头行不参与匹配 */
test('场景头行不参与匹配', () => {
  const draft = `内景 电梯猛地一震停住了她的心跳得很快
苏晚：怎么回事？`;
  const r = forcedProximity(draft);
  /* 场景头行"内景 电梯猛地一震停住了她的心跳得很快"不参与匹配 */
  assert.strictEqual(r.hitCount, 0, '场景头行不参与匹配');
});

/* 13. 相邻 ≤2 行的浪漫推进表述合并为同一事件 */
test('相邻 ≤2 行浪漫推进合并为同一事件', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
她的心跳得很快。
脸红了。
不自觉靠近了他。

内景 地下室
停电了。
她的脸红了。
心跳加速。
不自觉靠近了他。

内景 仓库
密室反锁了。
目光撞上了。
心跳得很厉害。`;
  const r = forcedProximity(draft);
  assert.strictEqual(r.hitCount, 3, '三处困处各成一件');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 70, 'n=2 → 70');
});

/* 14. 跨场景头不合并 */
test('跨场景头不合并', () => {
  const draft = `内景 电梯
电梯猛地一震，停住了。
她的心跳得很快。

内景 地下室
她不自觉靠近了他。`;
  const r = forcedProximity(draft);
  /* 第一场困处与第二场浪漫推进之间有场景头，不合并也不配对 */
  assert.strictEqual(r.hitCount, 1, '跨场景头困处与浪漫推进不配对，第一场困处无浪漫推进配对，不构成事件');
});

/* 15. 空文本放行 */
test('空文本放行', () => {
  const r = forcedProximity('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
});

/* 16. rescue 扫描跳过困处行与浪漫行自身 */
test('rescue 扫描跳过困处行与浪漫行自身', () => {
  /* 困处行自身含"暗恋"不算 rescue 证据，必须出现在其他行 */
  const draft = `内景 电梯
电梯猛地一震，暗恋三年的他停住了。
她的心跳得很快。
她不自觉靠近了他。

内景 地下室
停电暗恋，四周漆黑。
她的脸红了。
她不自觉靠近了他。`;
  const r = forcedProximity(draft);
  /* "暗恋"在困处行自身，rescue 扫描跳过，不算 rescue */
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1, 'rescue 扫描跳过困处行自身，n=1 → 100');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== 结果：${pass} 通过，${fail} 失败 ===\n`);
if (fail > 0) process.exit(1);
