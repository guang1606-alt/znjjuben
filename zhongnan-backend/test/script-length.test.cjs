const test = require('node:test');
const assert = require('node:assert');
const L = require('../dist/engine/script-length.js');
const S = require('../dist/engine/sample-script.js');

test('无损压缩只精简△叙述行，角色台词一字不动', () => {
  const t = '内景 家·夜\n△ 事实上，他非常地站在原地，值得一提的是没说话。\n陈凯（吼）：其实吧，我就是不想让你走。';
  const r = L.compressNarrative(t);
  assert.ok(!r.text.includes('事实上'));
  assert.ok(r.text.includes('其实吧，我就是不想让你走'), '台词必须原样保留');
  assert.strictEqual(r.dialogueKept, true);
  assert.ok(r.after < r.before);
});

test('黄金样例字数已达标→直接放行', () => {
  const p = L.adaptScriptLength(S.buildSampleScript('LIVE'), 'LIVE');
  assert.strictEqual(p.status, 'ok');
  assert.strictEqual(p.ready, true);
});

test('字数不足→按场景产出扩写规划，缺口分配自洽且不伪造正文', () => {
  const short = S.buildSampleScript('LIVE').slice(0, 700);
  const p = L.adaptScriptLength(short, 'LIVE');
  assert.strictEqual(p.status, 'under');
  assert.strictEqual(p.ready, false);
  assert.strictEqual(p.need, 'polish');
  assert.ok(p.delta > 0);
  const sum = p.expansion.reduce((a, s) => a + s.targetAdd, 0);
  assert.ok(Math.abs(sum - p.delta) <= 5, `各场景分配之和${sum}应≈缺口${p.delta}`);
  assert.ok(p.expansion.every((s) => s.types.length >= 1));
});

test('超标→无损压缩能压回区间且不伤台词', () => {
  let over = S.buildSampleScript('LIVE');
  for (let i = 0; i < 25; i++) over += '\n△ 事实上，值得一提的是，换句话说，与此同时，不得不说。';
  const before = L.adaptScriptLength(over, 'LIVE');
  assert.strictEqual(before.status, 'over');
  assert.strictEqual(before.ready, true, '删尽叙述填充后应回到区间');
  assert.strictEqual(before.compressed.dialogueKept, true);
  assert.ok(before.compressed.after < before.compressed.before);
});

test('压缩后仍超标→如实标注需润色岗精简，不假装已解决', () => {
  // 用大量“不含可删填充词”的台词堆超（无损压缩删不动台词）
  let over = '内景 家·夜\n';
  for (let i = 0; i < 120; i++) over += `\n角色${i % 4}：这是第${i}句实打实推进剧情的关键台词内容啊。`;
  const p = L.adaptScriptLength(over, 'LIVE');
  assert.strictEqual(p.status, 'over');
  assert.strictEqual(p.ready, false);
  assert.strictEqual(p.need, 'llm_trim');
});

// ---------- v2.80 AIGC 超限：逐场硬预算 planTrim + 确定性硬剪 hardTrimToRange ----------

function overlongAigc() {
  // 4场、约2600+字、叙述为主（模拟真实模型把1分钟写超长）
  const seg = '她推开木门，冷风灌进领口，楼道灯忽明忽暗，她攥紧纸箱带子，指节发白，脚步停在台阶上，听见楼下传来汽车熄火的声音。';
  const narr = (n) => { let s = ''; while (s.length < n) s += seg; return s.slice(0, n); };
  const parts = [];
  for (let i = 1; i <= 4; i++) {
    parts.push(`内景 老楼${i}·夜`);
    parts.push(narr(560));
    parts.push('林晚（压低声音）：这一次，我不会再退了。');
    parts.push(narr(90));
  }
  return parts.join('\n');
}

test('v2.80 planTrim：给出逐场硬预算，保台词为下限，总预算≈目标', () => {
  const t = overlongAigc();
  const p = L.planTrim(t, 'AIGC', 1);
  assert.strictEqual(p.hi, 1500);
  assert.ok(p.totalCurrent > 2000);
  assert.strictEqual(p.scenes.length, 4);
  assert.ok(p.scenes.every((s) => !s.drop), '4场不应并场');
  assert.ok(p.scenes.every((s) => s.targetKeep >= s.spoken), '预算不得低于本场台词量');
  assert.ok(p.scenes.every((s) => s.cutUnits > 0), '每场都要砍');
  const keptSum = p.scenes.reduce((a, s) => a + s.targetKeep, 0);
  assert.ok(Math.abs(keptSum - p.target) <= 120, `预算合计${keptSum}应≈目标${p.target}`);
});

test('v2.80 planTrim：超过5场时标记并入发声最少的中间场，开场与卡点永不并', () => {
  const seg = '风从巷口灌过来，塑料帘子拍在墙上，她抬眼盯着远处车灯，呼吸放得很轻，指尖一点点收紧。';
  const parts = [];
  for (let i = 1; i <= 7; i++) {
    parts.push(`内景 地点${i}·夜`);
    parts.push(seg.repeat(7));
    // 每个中间场都有台词，唯第4场是纯叙述过场（发声0）→ 应优先并入
    if (i !== 4 && i !== 7) parts.push(`角色${i}：第${i}场保留人物发声的关键台词内容。`);
  }
  const p = L.planTrim(parts.join('\n'), 'AIGC', 1);
  assert.ok(p.scenes.some((s) => s.drop), '应至少标记一个并入场');
  assert.ok(p.scenes.find((s) => s.scene === 4).drop, '纯叙述过场（发声0）优先并入');
  assert.ok(!p.scenes[0].drop && !p.scenes[1].drop && !p.scenes[6].drop, '前两场与卡点场必须保留');
});

test('v2.80 hardTrimToRange：带标点超长稿被剪回1200-1500，台词全保、场标完整、达标稿原样放行', () => {
  const t = overlongAigc();
  const ht = L.hardTrimToRange(t, 'AIGC', 1);
  assert.ok(ht.after <= 1500 && ht.after >= 1000, `实际${ht.after}`);
  assert.ok(ht.after < ht.before);
  assert.strictEqual((ht.text.match(/林晚（压低声音）：这一次，我不会再退了。/g) || []).length, 4, '四句台词一字不动');
  assert.strictEqual((ht.text.match(/内景 老楼[1-4]·夜/g) || []).length, 4, '4个场标保留');
  // 达标稿不改动
  const gold = S.buildSampleScript('AIGC');
  const noop = L.hardTrimToRange(gold, 'AIGC', 1);
  assert.strictEqual(noop.text, gold);
});

test('v2.80 hardTrimToRange 按时长缩放：2分钟稿上限3000', () => {
  const seg = '她推开木门，冷风灌进领口，楼道灯忽明忽暗，她攥紧纸箱带子，指节发白，脚步停在台阶上，听见楼下传来汽车熄火的声音。';
  const parts = [];
  for (let i = 1; i <= 4; i++) {
    parts.push(`内景 楼${i}·夜`);
    parts.push(seg.repeat(14));
    parts.push('林晚：按两分钟的容量，这句台词仍然必须原样留下来。');
  }
  const t = parts.join('\n');
  const ht = L.hardTrimToRange(t, 'AIGC', 2);
  assert.ok(ht.after <= 3000 && ht.after > 2400, `实际${ht.after}`);
  assert.strictEqual((ht.text.match(/林晚：按两分钟的容量/g) || []).length, 4);
});
