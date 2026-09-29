const { fightReconcileCrutch } = require('../dist/engine/fight-reconcile-crutch.js');
const assert = require('assert');

/* c125 fight-reconcile-crutch 吵架秒和好检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景不合并 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue×3 / 英文放行与合并 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c125 fight-reconcile-crutch 吵架秒和好检测 ===\n');

/* 1. 空文本 / 纯空白 */
test('空文本与纯空白：满分零命中', () => {
  assert.strictEqual(fightReconcileCrutch('').score, 100);
  assert.strictEqual(fightReconcileCrutch('').hitCount, 0);
  assert.strictEqual(fightReconcileCrutch('   \n  \n').hitCount, 0);
});

/* 2. 中文命中：吵架+和好共现，首次豁免 */
test('中文命中：吵架+和好共现，首次豁免不罚', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹（追出去）：沈磊！
沈磊（停步）：……算了，不吵了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免 unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免 score 应为 100');
});

/* 3. 中文第 2 次命中未救援：n=1 → 70 */
test('中文第2次命中未救援：n=1 → 70', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 卧室
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 1, 'unrescuedCount 应为 1');
  assert.strictEqual(r.score, 70, 'n=1 → 70');
  const h = r.hits[0];
  assert.ok(h.line > 0 && h.marker && h.snippet, 'hit 字段应完整');
  assert.strictEqual(h.rescued, false);
});

/* 4. 中文第 3 次命中未救援：n=2 → 50 */
test('中文第3次命中未救援：n=2 → 50', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 卧室
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：……和好了吧，别闹了。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 厨房
沈磊（拍桌子）：我说了算！
周莹（怒目而视）：你讲不讲理？
沈磊：……别吵了，翻篇了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 50, 'n=2 → 50');
});

/* 5. rescue A：真诚道歉（我不该 + 具体错在哪） */
test('rescue A：真诚道歉点出具体错，放行', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。
内景 卧室
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：我不该那样做，是我不好，我不该替你做主，这是你的私事。
周莹：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '真诚道歉 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

/* 6. rescue B：时间跨度（三天后） */
test('rescue B：时间跨度磨化，放行', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。
内景 卧室
三天后。
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '时间跨度 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 7. rescue C：第三方调解（老娘舅劝和） */
test('rescue C：第三方调解劝和，放行', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。
内景 卧室
王阿姨来劝和了，撮合他们。
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '第三方调解 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 8. 双锚缺一：纯吵架无和好放行 */
test('纯吵架无和好：吵架本身放行', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
△他转身离开客厅。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9. 双锚缺一：纯和好无吵架放行 */
test('纯和好无吵架：正常和解放行', () => {
  const draft = `内景 咖啡馆
△两人握手言和，冰释前嫌。
△窗外阳光正好。
△他们各自点了咖啡。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 0, '无吵架锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 10. 相邻 ≤2 行和好行合并 */
test('相邻和好行合并为同一事件', () => {
  const draft = `内景 客厅
周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了。
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 1, '两个和好行应合并为 1 个事件');
  assert.strictEqual(r.unrescuedCount, 0, '单事件首次豁免');
});

/* 11. 跨场景头不合并 + sceneIndex 正确 */
test('跨场景头：两个事件分别计数，sceneIndex 正确', () => {
  const draft = `周莹：你凭什么替我做主！
沈磊（摔门）：我不跟你吵！
周莹：算了，都过去了，我们和好吧。

场 2：卧室
沈磊：这事没商量！
周莹（赌气）：随你便！
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2, '跨场景头不合并');
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '场 2：卧室', 'hit 应归属第二场场景头');
  assert.strictEqual(r.score, 70);
});

/* 12. ±2 行窗口边界：隔 3 行不配对 */
test('窗口边界：吵架与和好隔 3 行，不构成事件', () => {
  const draft = `周莹：你凭什么替我做主！
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△苏晚搅着咖啡，莫名心安。
沈磊：……和好了吧，别闹了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 0, '±2 行窗口外不配对');
});

/* 13. 场景头行不参与词表匹配 */
test('场景头含和好词也不匹配', () => {
  const draft = `场 3 和好如初
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 14. 反例：讨论"和好"话题但无吵架 */
test('反例：讨论和好话题无吵架，不命中', () => {
  const draft = `△他们聊起了和好的往事。
△窗外下着小雨。
△咖啡渐渐凉了。`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 15. 英文两事件未救援：n=1 → 70 */
test('英文：吵架+和好共现两事件，n=1 → 70', () => {
  const draft = `INT. LIVING ROOM - DAY
LILY: You had no right to decide for me!
MARK (slammed the door): I'm done with this!
LILY: ...fine. We're good now. Let it go.
Paint peeled from the window frame.
A neon sign buzzed outside.
INT. BEDROOM - NIGHT
MARK: This is not up for discussion!
LILY (cold shoulder): Whatever.
MARK: ...we made up. It's all in the past.`;
  const r = fightReconcileCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(/instant reconcile/.test(r.hits[0].reason));
});

/* 16. 英文 rescue 三路：真诚道歉 / 时间跨度 / 第三方调解 */
test('英文 rescue A/B/C：三种救法均放行', () => {
  const head = `INT. LIVING ROOM - DAY
LILY: You had no right to decide for me!
MARK (slammed the door): I'm done with this!
LILY: ...fine. We're good now. Let it go.
Paint peeled from the window frame.
A neon sign buzzed outside.`;
  /* A：真诚道歉 */
  const a = `${head}
INT. BEDROOM - NIGHT
MARK: This is not up for discussion!
LILY (cold shoulder): Whatever.
MARK: I was wrong. I shouldn't have made that call for you.
LILY: ...we made up. It's all in the past.`;
  const ra = fightReconcileCrutch(a);
  assert.strictEqual(ra.hitCount, 2);
  assert.strictEqual(ra.unrescuedCount, 0, 'A 真诚道歉应放行');
  assert.strictEqual(ra.hits[0].rescued, true);

  /* B：时间跨度 */
  const b = `${head}
INT. BEDROOM - NIGHT
A week later.
MARK: This is not up for discussion!
LILY (cold shoulder): Whatever.
MARK: ...we made up. It's all in the past.`;
  const rb = fightReconcileCrutch(b);
  assert.strictEqual(rb.hitCount, 2);
  assert.strictEqual(rb.unrescuedCount, 0, 'B 时间跨度应放行');
  assert.strictEqual(rb.hits[0].rescued, true);

  /* C：第三方调解 */
  const c = `${head}
INT. BEDROOM - NIGHT
Aunt Susan stepped in to mediate between them.
MARK: This is not up for discussion!
LILY (cold shoulder): Whatever.
MARK: ...we made up. It's all in the past.`;
  const rc = fightReconcileCrutch(c);
  assert.strictEqual(rc.hitCount, 2);
  assert.strictEqual(rc.unrescuedCount, 0, 'C 第三方调解应放行');
  assert.strictEqual(rc.hits[0].rescued, true);
});

/* 17. 英文：双锚缺一 + 相邻合并 */
test('英文：纯吵架/纯和好放行，相邻和好行合并', () => {
  const pureFight = `MARK (slammed the door): I'm done with this!
LILY ran after him but he was already down the block.
No one said anything about making up.`;
  assert.strictEqual(fightReconcileCrutch(pureFight).hitCount, 0);

  const pureReconcile = `They had already reconciled last week.
The paperwork sat untouched on the desk.
Nothing about a fight came up.`;
  assert.strictEqual(fightReconcileCrutch(pureReconcile).hitCount, 0);

  const merged = `INT. LIVING ROOM - DAY
LILY: You had no right!
MARK (slammed the door): I'm done with this!
LILY: ...fine. We're good now.
MARK: Let it go. All in the past.`;
  const r = fightReconcileCrutch(merged);
  assert.strictEqual(r.hitCount, 1, '两个相邻和好行应合并');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== fight-reconcile-crutch 结果：${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
