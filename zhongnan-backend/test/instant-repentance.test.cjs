const { instantRepentance } = require('../dist/engine/instant-repentance.js');
const assert = require('assert');

/* c126 instant-repentance 加害者秒悔悟检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue×3 / 英文放行与合并 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c126 instant-repentance 加害者秒悔悟检测 ===\n');

/* 1. 空文本 / 纯空白 */
test('空文本与纯空白：满分零命中', () => {
  assert.strictEqual(instantRepentance('').score, 100);
  assert.strictEqual(instantRepentance('').hitCount, 0);
  assert.strictEqual(instantRepentance('   \n  \n').hitCount, 0);
});

/* 2. 中文命中：作恶×悔悟共现，首次豁免 */
test('中文命中：扇耳光+我错了，首次豁免不罚', () => {
  const draft = `内景 周家客厅
△周父抬手扇了周莹一耳光。
△周父（手停在半空）：……我不该这样对你。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免 unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免 score 应为 100');
});

/* 3. 中文第 2 次命中未救援：n=1 → 70 */
test('中文第2次命中未救援：n=1 → 70', () => {
  const draft = `内景 周家客厅
△周父抬手扇了周莹一耳光。
△周父：……我不该这样对你。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 周父书房
△周父指着沈磊：滚出去！我不认你这个女婿！
△周父（猛地一拍桌）：是我错了，原谅爸爸好不好。`;
  const r = instantRepentance(draft);
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
△周父扇了周莹一耳光。
△周父：我不该这样对你。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 书房
△周父：滚出去！
△周父：是我错了，原谅我。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 卧室
△周父抬手要打：你不听话！
△周父（手放下）：千错万错，是我的错。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 50, 'n=2 → 50');
});

/* 5. rescue A：内心过场（挣扎/犹豫） */
test('rescue A：悔悟前有内心过场，放行', () => {
  const draft = `内景 周家客厅
△周父扇了周莹一耳光。
△周父：我不该这样对你。
内景 书房
△周父抬手指着沈磊：滚出去！
△周父（手停在半空，天人交战）：……是我错了。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '内心过场 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

/* 6. rescue B：时间外部触发（看到泪/血/旧物） */
test('rescue B：悔悟有外部触发（看见女儿哭），放行', () => {
  const draft = `内景 周家客厅
△周父扇了周莹一耳光。
△周父：我不该这样对你。
内景 书房
△周父指着沈磊：滚出去！我不认你！
△周父看见周莹在角落无声地流泪。
△周父（手放下）：……是我错了。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '外部触发 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 7. rescue C：具体赎罪（退股/赔偿/自首） */
test('rescue C：悔悟落到具体赎罪（退股），放行', () => {
  const draft = `内景 周家客厅
△周父扇了周莹一耳光。
△周父：我不该这样对你。
内景 书房
△周父：滚出去！
△周父：是我错了，明天我就去撤诉，把股权退还给她。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '具体赎罪 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 8. 双锚缺一：纯作恶无悔悟放行 */
test('纯作恶无悔悟：作恶本身放行', () => {
  const draft = `内景 火场
△他狠狠扇了对方一耳光。
△围观群众纷纷后退。
△消防员随后赶到现场。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9. 双锚缺一：纯悔悟无作恶放行 */
test('纯悔悟无作恶：正常悔悟心理放行', () => {
  const draft = `内景 咖啡馆
△他搅着咖啡，心里默念：是我不对。
△他想起早晨的争吵，心里有些后悔。
△窗外阳光正好。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 0, '无作恶锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 10. 相邻 ≤2 行悔悟表述合并 */
test('相邻悔悟行合并为同一事件', () => {
  const draft = `内景 巷口
△周父抬手要打：你不听话！
△周父：我不该。
△周父：是我错了。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 1, '两个悔悟行应合并为 1 个事件');
  assert.strictEqual(r.unrescuedCount, 0, '单事件首次豁免');
});

/* 11. 跨场景头不合并 + sceneIndex 正确 */
test('跨场景头：两个事件分别计数，sceneIndex 正确', () => {
  const draft = `△周父扇了周莹一耳光。
△周父：我不该这样对你。

场 2：书房
△周父：滚出去！
△周父：是我错了。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 2, '跨场景头不合并');
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '场 2：书房', 'hit 应归属第二场场景头');
  assert.strictEqual(r.score, 70);
});

/* 12. ±2 行窗口边界：隔 3 行不配对 */
test('窗口边界：作恶与悔悟隔 3 行，不构成事件', () => {
  const draft = `△周父扇了周莹一耳光。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△周父：我不该这样对你。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 0, '±2 行窗口外不配对');
});

/* 13. 场景头行不参与词表匹配 */
test('场景头含悔悟词也不匹配', () => {
  const draft = `场 3 我错了
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 14. 反例：路人劝说无作恶 */
test('反例：路人劝和的悔悟无作恶，不命中', () => {
  const draft = `△他拍着朋友的肩膀。
△他低头说：是我不对，我应该听你的劝。`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 15. 英文两事件未救援：n=1 → 70 */
test('英文：作恶+悔悟共现两事件，n=1 → 70', () => {
  const draft = `INT. LIVING ROOM - DAY
He slapped Lily across the face.
He lowered his hand: ...I shouldn't have done that.
Paint peeled from the window frame.
A neon sign buzzed outside.
INT. STUDY - NIGHT
He shoved Jake toward the door: Get out!
He slammed his palm on the desk: I was wrong. Forgive me.`;
  const r = instantRepentance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(/instant repentance/i.test(r.hits[0].reason));
});

/* 16. 英文 rescue 三路：内心过场 / 外部触发 / 具体赎罪 */
test('英文 rescue A/B/C：三种救法均放行', () => {
  const head = `INT. LIVING ROOM - DAY
He slapped Lily across the face.
He lowered his hand: ...I shouldn't have done that.
Paint peeled from the window frame.
A neon sign buzzed outside.`;
  /* A：内心过场 */
  const a = `${head}
INT. STUDY - NIGHT
He shoved Jake toward the door: Get out!
He stopped, his hand trembling, torn.
He lowered his eyes: I was wrong.`;
  const ra = instantRepentance(a);
  assert.strictEqual(ra.hitCount, 2);
  assert.strictEqual(ra.unrescuedCount, 0, 'A 内心过场应放行');
  assert.strictEqual(ra.hits[0].rescued, true);

  /* B：外部触发 */
  const b = `${head}
INT. STUDY - NIGHT
He shoved Jake toward the door: Get out!
He saw her sobbing in the corner.
He stopped: I was wrong, forgive me.`;
  const rb = instantRepentance(b);
  assert.strictEqual(rb.hitCount, 2);
  assert.strictEqual(rb.unrescuedCount, 0, 'B 外部触发应放行');
  assert.strictEqual(rb.hits[0].rescued, true);

  /* C：具体赎罪 */
  const c = `${head}
INT. STUDY - NIGHT
He shoved Jake toward the door: Get out!
He stopped: I was wrong. I'll return the shares tomorrow and resign.`;
  const rc = instantRepentance(c);
  assert.strictEqual(rc.hitCount, 2);
  assert.strictEqual(rc.unrescuedCount, 0, 'C 具体赎罪应放行');
  assert.strictEqual(rc.hits[0].rescued, true);
});

/* 17. 英文：双锚缺一 + 相邻合并 */
test('英文：纯作恶/纯悔悟放行，相邻悔悟行合并', () => {
  const pureWrong = `He slapped the young thug across the face.
The crowd gasped.
No one apologized for anything.`;
  assert.strictEqual(instantRepentance(pureWrong).hitCount, 0);

  const pureRepent = `He stirred his coffee, muttering: I was wrong.
He thought about the morning quarrel, feeling guilty.
The sun shone outside.`;
  assert.strictEqual(instantRepentance(pureRepent).hitCount, 0);

  const merged = `INT. STUDY - NIGHT
He shoved Jake toward the door: Get out!
He stopped.
He lowered his hand: I was wrong, forgive me.`;
  const r = instantRepentance(merged);
  assert.strictEqual(r.hitCount, 1, '两个相邻悔悟行应合并');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== instant-repentance 结果：${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
