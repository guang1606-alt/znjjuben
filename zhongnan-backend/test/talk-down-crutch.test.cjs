const { talkDownCrutch } = require('../dist/engine/talk-down-crutch.js');
const assert = require('assert');

/* c127 talk-down-crutch 嘴炮退敌检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue×3 / 英文放行与合并 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c127 talk-down-crutch 嘴炮退敌检测 ===\n');

/* 1. 空文本 / 纯空白 */
test('空文本与纯空白：满分零命中', () => {
  assert.strictEqual(talkDownCrutch('').score, 100);
  assert.strictEqual(talkDownCrutch('').hitCount, 0);
  assert.strictEqual(talkDownCrutch('   \n  \n').hitCount, 0);
});

/* 2. 中文命中：对峙×说降共现，首次豁免 */
test('中文命中：举枪+把枪放下，首次豁免不罚', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
男主（缓缓起身）：把枪放下。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免 unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免 score 应为 100');
});

/* 3. 中文第 2 次命中未救援：n=1 → 70 */
test('中文第2次命中未救援：n=1 → 70', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
男主：把枪放下。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 天台
△绑匪把刀架在孩子脖子上。
男主：别冲动，想想你的女儿。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 1, 'unrescuedCount 应为 1');
  assert.strictEqual(r.score, 70, 'n=1 → 70');
  const h = r.hits[0];
  assert.ok(h.line > 0 && h.marker && h.snippet, 'hit 字段应完整');
  assert.strictEqual(h.rescued, false);
});

/* 4. 中文第 3 次命中未救援：n=2 → 50 */
test('中文第3次命中未救援：n=2 → 50', () => {
  const draft = `内景 仓库
△歹徒举枪对着人质。
男主：把枪放下。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 天台
△绑匪把刀架在孩子脖子上。
男主：别冲动。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 街口
△持刀者挟持着她。
男主：住手，不值得。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 50, 'n=2 → 50');
});

/* 5. rescue A：博弈过程（谈条件/凭什么） */
test('rescue A：对峙有博弈来回，放行', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
男主：把枪放下。
内景 天台
△绑匪把刀架在孩子脖子上。
男主：放开他。
绑匪：凭什么听你的？你先退后，不然我马上动手。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '博弈来回 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

/* 6. rescue B：外力压制（警方包围/狙击） */
test('rescue B：放下武器有外力压制，放行', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
男主：把枪放下。
内景 天台
△绑匪把刀架在孩子脖子上。
男主：放下刀。
△楼下警笛大作，警方包围了整栋楼，狙击手已锁定。
△绑匪手中的刀慢慢垂了下来。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '外力压制 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 7. rescue C：时间消耗（僵持数小时） */
test('rescue C：对峙有时间消耗，放行', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
男主：把枪放下。
内景 天台
△绑匪把刀架在孩子脖子上。
△双方僵持了三个小时，夜色渐深。
男主：放下刀，我可以答应你的条件。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '时间消耗 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 8. 双锚缺一：纯对峙无说降放行 */
test('纯对峙无说降：对峙本身放行', () => {
  const draft = `内景 废弃仓库
△歹徒举枪对着人质。
△特警破门而入，将其扑倒制服。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9. 双锚缺一：纯说降无对峙放行 */
test('纯说降无对峙：日常劝解放行', () => {
  const draft = `内景 咖啡馆
△他搅着咖啡。
她叹气：别冲动，冷静点，有话好好说。
△窗外阳光正好。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 0, '无对峙锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 10. 相邻 ≤2 行说降表述合并 */
test('相邻说降行合并为同一事件', () => {
  const draft = `内景 天台
△绑匪把刀架在孩子脖子上。
男主：把刀放下。
男主：别冲动，有话好好说。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 1, '两个说降行应合并为 1 个事件');
  assert.strictEqual(r.unrescuedCount, 0, '单事件首次豁免');
});

/* 11. 跨场景头不合并 + sceneIndex 正确 */
test('跨场景头：两个事件分别计数，sceneIndex 正确', () => {
  const draft = `△歹徒举枪对着人质。
男主：把枪放下。

场 2：天台
△绑匪把刀架在孩子脖子上。
男主：别冲动。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2, '跨场景头不合并');
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '场 2：天台', 'hit 应归属第二场场景头');
  assert.strictEqual(r.score, 70);
});

/* 12. ±2 行窗口边界：隔 3 行不配对 */
test('窗口边界：对峙与说降隔 3 行，不构成事件', () => {
  const draft = `△歹徒举枪对着人质。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
男主：把枪放下。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 0, '±2 行窗口外不配对');
});

/* 13. 场景头行不参与词表匹配 */
test('场景头含说降词也不匹配', () => {
  const draft = `场 3 把枪放下
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 14. 反例：谈判戏有博弈词但无对峙武器 */
test('反例：普通争执劝和无武器，不命中', () => {
  const draft = `△他拍着桌子，脸色铁青。
△她拉住他的手。
她低声说：别冲动，冷静点。
△他深吸一口气，坐了下来。`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 15. 英文两事件未救援：n=1 → 70 */
test('英文：对峙+说降共现两事件，n=1 → 70', () => {
  const draft = `INT. WAREHOUSE - NIGHT
The thug pointed the gun at the hostage.
He raised his hands slowly: Put the gun down.
Paint peeled from the window frame.
A neon sign buzzed outside.
INT. ROOFTOP - NIGHT
The kidnapper pressed the knife against her throat.
He stepped forward: Don't do this. Think about your daughter.`;
  const r = talkDownCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(/talk-down crutch/i.test(r.hits[0].reason));
});

/* 16. 英文 rescue 三路：博弈过程 / 外力压制 / 时间消耗 */
test('英文 rescue A/B/C：三种救法均放行', () => {
  const head = `INT. WAREHOUSE - NIGHT
The thug pointed the gun at the hostage.
He raised his hands slowly: Put the gun down.
Paint peeled from the window frame.
A neon sign buzzed outside.`;
  /* A：博弈过程 */
  const a = `${head}
INT. ROOFTOP - NIGHT
The kidnapper pressed the knife against her throat.
He stepped closer: Let her go.
The kidnapper sneered: Why should I? You first, then we talk terms.`;
  const ra = talkDownCrutch(a);
  assert.strictEqual(ra.hitCount, 2);
  assert.strictEqual(ra.unrescuedCount, 0, 'A 博弈过程应放行');
  assert.strictEqual(ra.hits[0].rescued, true);

  /* B：外力压制 */
  const b = `${head}
INT. ROOFTOP - NIGHT
The kidnapper pressed the knife against her throat.
He raised his voice: Put the knife down.
Sirens wailed below. The police surrounded the building, a sniper locked on.`;
  const rb = talkDownCrutch(b);
  assert.strictEqual(rb.hitCount, 2);
  assert.strictEqual(rb.unrescuedCount, 0, 'B 外力压制应放行');
  assert.strictEqual(rb.hits[0].rescued, true);

  /* C：时间消耗 */
  const c = `${head}
INT. ROOFTOP - NIGHT
The kidnapper pressed the knife against her throat.
He said quietly: Drop the knife.
The standoff lasted for hours. Night fell, time dragged on.`;
  const rc = talkDownCrutch(c);
  assert.strictEqual(rc.hitCount, 2);
  assert.strictEqual(rc.unrescuedCount, 0, 'C 时间消耗应放行');
  assert.strictEqual(rc.hits[0].rescued, true);
});

/* 17. 英文：双锚缺一 + 相邻合并 */
test('英文：纯对峙/纯说降放行，相邻说降行合并', () => {
  const pureStandoff = `The thug pointed the gun at the hostage.
The swat team breached and tackled him to the ground.
No one asked him to put anything down.`;
  assert.strictEqual(talkDownCrutch(pureStandoff).hitCount, 0);

  const pureTalkdown = `He stirred his coffee.
She sighed: Calm down, take it easy.
The sun shone outside.`;
  assert.strictEqual(talkDownCrutch(pureTalkdown).hitCount, 0);

  const merged = `INT. ROOFTOP - NIGHT
The kidnapper pressed the knife against her throat.
He raised his hands.
He said: Put the knife down, don't do this.`;
  const r = talkDownCrutch(merged);
  assert.strictEqual(r.hitCount, 1, '两个相邻说降行应合并');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== talk-down-crutch 结果：${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
