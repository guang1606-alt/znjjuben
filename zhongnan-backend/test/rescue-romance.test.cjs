const { rescueRomance } = require('../dist/engine/rescue-romance.js');
const assert = require('assert');

/* c124 rescue-romance 英雄救美必生情检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景不合并 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue×3 / 英文放行与合并 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c124 rescue-romance 英雄救美必生情检测 ===\n');

/* 1. 空文本 / 纯空白 */
test('空文本与纯空白：满分零命中', () => {
  assert.strictEqual(rescueRomance('').score, 100);
  assert.strictEqual(rescueRomance('').hitCount, 0);
  assert.strictEqual(rescueRomance('   \n  \n').hitCount, 0);
});

/* 2. 中文命中：救险×心动共现，首次豁免 */
test('中文命中：车轮救险+心跳漏拍，首次豁免不罚', () => {
  const draft = `内景 马路
△货车猛地冲来。
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚看着他的侧脸，心跳漏拍。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免 unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免 score 应为 100');
});

/* 3. 中文第 2 次命中未救援：n=1 → 70 */
test('中文第2次命中未救援：n=1 → 70', () => {
  const draft = `内景 马路
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚看着他的侧脸，心跳漏拍。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 巷口
△他扑过去护住她，替她挡下一棍。
△她怦然心动，认定他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2, 'hitCount 应为 2');
  assert.strictEqual(r.unrescuedCount, 1, 'unrescuedCount 应为 1');
  assert.strictEqual(r.score, 70, 'n=1 → 70');
  const h = r.hits[0];
  assert.ok(h.line > 0 && h.marker && h.snippet, 'hit 字段应完整');
  assert.strictEqual(h.rescued, false);
});

/* 4. 中文第 3 次命中未救援：n=2 → 50 */
test('中文第3次命中未救援：n=2 → 50', () => {
  const draft = `内景 马路
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚心跳漏拍，就是他了。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 巷口
△他扑过去护住她，替她挡下一棍。
△她怦然心动，认定他了。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 仓库
△他挡在她身前，伸手拉住了她。
△那一刻她彻底爱上他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 50, 'n=2 → 50');
});

/* 5. rescue A：已有关系基础（暗恋已久） */
test('rescue A：心动有来路（暗恋已久），放行', () => {
  const draft = `内景 马路
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚心跳漏拍，就是他了。
内景 巷口
△他扑过去护住她，替她挡下一棍。
△她暗恋已久，这份心意藏了三年。
△她怦然心动，认定他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '历史基础 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

/* 6. rescue B：报恩≠爱（只是感激/救命恩人） */
test('rescue B：人物划清恩情与爱情，放行', () => {
  const draft = `内景 马路
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚心跳漏拍，就是他了。
内景 巷口
△他挡在她身前，替她挡下一棍。
△她摇头：我只是感激他，毕竟他是救命恩人。
△她心跳漏拍，却把话咽了回去。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '报恩≠爱 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 7. rescue C：救险真代价（中刀流血，允许锚行自身） */
test('rescue C：救的人真付了代价（中刀流血），放行', () => {
  const draft = `内景 马路
△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚心跳漏拍，就是他了。
内景 巷口
△他扑过去，替她挡了一刀，胳膊中刀，鲜血直流。
△她心跳漏拍，就是他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '救险代价 rescue 应放行（锚行自身也算）');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 8. 双锚缺一：纯救险无心动放行 */
test('纯救险无心动：救人本身放行', () => {
  const draft = `内景 火场
△他冲过去把人从火里拉了出来。
△围观群众纷纷鼓掌。
△消防员随后赶到现场。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9. 双锚缺一：纯心动无救险放行 */
test('纯心动无救险：正常恋爱心理放行', () => {
  const draft = `内景 咖啡馆
△苏晚搅着咖啡，莫名心安。
△她想起他早晨发来的消息，心里踏实。
△窗外阳光正好。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 0, '无救险锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 10. 相邻 ≤2 行救险表述合并 */
test('相邻救险行合并为同一事件', () => {
  const draft = `内景 巷口
△陆沉冲过去把苏晚从枪口下推开。
△他挡在她身前。
△苏晚心跳漏拍，就是他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 1, '两个救险行应合并为 1 个事件');
  assert.strictEqual(r.unrescuedCount, 0, '单事件首次豁免');
});

/* 11. 跨场景头不合并 + sceneIndex 正确 */
test('跨场景头：两个事件分别计数，sceneIndex 正确', () => {
  const draft = `△陆沉冲过去把苏晚从车轮下拉了回来。
△苏晚心跳漏拍，就是他了。

场 2：巷口
△他扑过去护住她，替她挡下一棍。
△她怦然心动，认定他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2, '跨场景头不合并');
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '场 2：巷口', 'hit 应归属第二场场景头');
  assert.strictEqual(r.score, 70);
});

/* 12. ±2 行窗口边界：隔 3 行不配对 */
test('窗口边界：救险与心动隔 3 行，不构成事件', () => {
  const draft = `△陆沉冲过去把苏晚从车轮下拉了回来。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△苏晚心跳漏拍，就是他了。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 0, '±2 行窗口外不配对');
});

/* 13. 场景头行不参与词表匹配 */
test('场景头含心动词也不匹配', () => {
  const draft = `场 3 怦然心动
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 14. 反例：救儿童无生情 */
test('反例：救落水儿童+道谢，不命中', () => {
  const draft = `△他跳进湖里救了一个落水儿童。
△孩子上岸后连连咳嗽。
△家长握着他的手连连道谢。`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 15. 英文两事件未救援：n=1 → 70 */
test('英文：救险+心动共现两事件，n=1 → 70', () => {
  const draft = `INT. ROAD - DAY
Jake dove toward her and pulled her away from the truck.
Her heart skipped a beat. He was the one.
Paint peeled from the window frame.
A neon sign buzzed outside.
INT. ALLEY - NIGHT
He stepped in front of her and shielded her from the blade.
Something shifted inside; she fell for him right then.`;
  const r = rescueRomance(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(/rescue-romance/.test(r.hits[0].reason));
});

/* 16. 英文 rescue 三路：历史基础 / 报恩划界 / 救险代价 */
test('英文 rescue A/B/C：三种救法均放行', () => {
  const head = `INT. ROAD - DAY
Jake dove toward her and pulled her away from the truck.
Her heart skipped a beat. He was the one.
Paint peeled from the window frame.
A neon sign buzzed outside.`;
  /* A：暗恋有来路 */
  const a = `${head}
INT. ALLEY - NIGHT
He shielded her and took a bullet for her.
She had carried a secret crush on him for months already.
Something shifted inside her as she felt safe.`;
  const ra = rescueRomance(a);
  assert.strictEqual(ra.hitCount, 2);
  assert.strictEqual(ra.unrescuedCount, 0, 'A 历史基础应放行');
  assert.strictEqual(ra.hits[0].rescued, true);

  /* B：报恩划界 */
  const b = `${head}
INT. ALLEY - NIGHT
He stepped in front of her and shielded her.
She told herself she was just grateful, that gratitude isn't love.
Her heart raced despite the words.`;
  const rb = rescueRomance(b);
  assert.strictEqual(rb.hitCount, 2);
  assert.strictEqual(rb.unrescuedCount, 0, 'B 报恩划界应放行');
  assert.strictEqual(rb.hits[0].rescued, true);

  /* C：救险真代价（锚行自身） */
  const c = `${head}
INT. ALLEY - NIGHT
He took a knife for her, bleeding through his shirt.
Her heart skipped a beat and he was the one.`;
  const rc = rescueRomance(c);
  assert.strictEqual(rc.hitCount, 2);
  assert.strictEqual(rc.unrescuedCount, 0, 'C 救险代价应放行');
  assert.strictEqual(rc.hits[0].rescued, true);
});

/* 17. 英文：双锚缺一 + 相邻合并 */
test('英文：纯救险/纯心动放行，相邻救险行合并', () => {
  const pureRescue = `He shielded her from the swarm of reporters.
The cameras flashed around them.
No one said a word about feelings.`;
  assert.strictEqual(rescueRomance(pureRescue).hitCount, 0);

  const pureDeep = `Her heart raced whenever he walked into a room.
She stared at her paperwork and said nothing.`;
  assert.strictEqual(rescueRomance(pureDeep).hitCount, 0);

  const merged = `INT. ALLEY - NIGHT
He pulled her out of the way.
He shielded her with his body.
Her heart raced and something shifted inside.`;
  const r = rescueRomance(merged);
  assert.strictEqual(r.hitCount, 1, '两个相邻救险行应合并');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== rescue-romance 结果：${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
