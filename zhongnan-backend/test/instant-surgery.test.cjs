const { instantSurgery } = require('../dist/engine/instant-surgery.js');
const assert = require('assert');

/* c128 instant-surgery 野战手术秒成功检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue×3 / 英文放行与合并 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== c128 instant-surgery 野战手术秒成功检测 ===\n');

/* 1. 空文本 / 纯空白 */
test('空文本与纯空白：满分零命中', () => {
  assert.strictEqual(instantSurgery('').score, 100);
  assert.strictEqual(instantSurgery('').hitCount, 0);
  assert.strictEqual(instantSurgery('   \n  \n').hitCount, 0);
});

/* 2. 中文命中：野战环境×医疗操作共现，首次豁免 */
test('中文命中：客厅取子弹，首次豁免不罚', () => {
  const draft = `内景 陈默家客厅 夜
△陈默就着台灯光，在茶几上给老周取子弹。
△老周疼得满头是汗，却死死咬着毛巾不出声。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 1, 'hitCount 应为 1');
  assert.strictEqual(r.unrescuedCount, 0, '首次豁免 unrescuedCount 应为 0');
  assert.strictEqual(r.score, 100, '首次豁免 score 应为 100');
});

/* 3. 中文第 2 次命中未救援：n=1 → 70 */
test('中文第2次命中未救援：n=1 → 70', () => {
  const draft = `内景 陈默家客厅 夜
△陈默就着台灯光，在茶几上给老周取子弹。
△老周疼得满头是汗，却死死咬着毛巾不出声。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 城郊仓库 日
△陈默用鱼线替小舟缝合了手臂上的刀伤。
△墙角堆着几个纸箱。`;
  const r = instantSurgery(draft);
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
△陈默在茶几上给老周取子弹。
△老周咬着毛巾不出声。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 仓库
△陈默用鱼线替小舟缝合了刀伤。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 废墟
△陈默在废墟的桌子上给阿强把骨头复位了。
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 3, 'hitCount 应为 3');
  assert.strictEqual(r.unrescuedCount, 2, 'unrescuedCount 应为 2');
  assert.strictEqual(r.score, 50, 'n=2 → 50');
});

/* 5. rescue A：资质来路（军医出身） */
test('rescue A：操作者是军医出身，放行', () => {
  const draft = `内景 陈默家客厅 夜
△陈默就着台灯光，在茶几上给老周取子弹。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 城郊仓库 日
△陈默用鱼线替小舟缝合了刀伤。
△陈默当过八年战地军医，这点伤对他不算什么。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '资质来路 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

/* 6. rescue B：过程代价（感染高烧） */
test('rescue B：术后感染高烧三天，放行', () => {
  const draft = `内景 陈默家客厅 夜
△陈默就着台灯光，在茶几上给老周取子弹。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 城郊仓库 日
△陈默用鱼线替小舟缝合了刀伤。
△当夜伤口感染，小舟高烧三天不退，险些没挺过来。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '过程代价 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 7. rescue C：专业求助（视频连线医生） */
test('rescue C：全程视频连线医生指导，放行', () => {
  const draft = `内景 陈默家客厅 夜
△陈默就着台灯光，在茶几上给老周取子弹。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
内景 城郊仓库 日
△陈默用鱼线替小舟缝合了刀伤。
△手机支在药箱上，全程视频连线医生，他照着指导一步步做。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0, '专业求助 rescue 应放行');
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 8. 双锚缺一：正规医院手术无野战语境放行 */
test('纯医院手术无野战环境：放行', () => {
  const draft = `内景 市一医院手术室 日
△主刀医生为老周取出子弹，手术持续了四个小时。
△麻醉师全程监护生命体征。
△护士记录着出血量。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 0, '无野战环境锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 9. 双锚缺一：纯环境无医疗操作放行 */
test('纯野战环境无操作：日常场景放行', () => {
  const draft = `内景 废弃仓库 夜
△两人把货箱搬上了推车。
△手电的光柱扫过墙根。
△铁门外传来狗叫。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 0, '无医疗操作锚不构成事件');
  assert.strictEqual(r.score, 100);
});

/* 10. 相邻 ≤2 行操作表述合并 */
test('相邻操作行合并为同一事件', () => {
  const draft = `内景 客厅 夜
△陈默就着白酒给老周消毒。
△他在茶几上取出了子弹。
△又用缝衣针缝合了伤口。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 1, '三个相邻操作行应合并为 1 个事件');
  assert.strictEqual(r.unrescuedCount, 0, '单事件首次豁免');
});

/* 11. 跨场景头不合并 + sceneIndex 正确 */
test('跨场景头：两个事件分别计数，sceneIndex 正确', () => {
  const draft = `△陈默在茶几上给老周取子弹。
△老周咬着毛巾不出声。

场 2：仓库
△陈默用鱼线替小舟缝合了刀伤。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 2, '跨场景头不合并');
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].sceneHeader, '场 2：仓库', 'hit 应归属第二场场景头');
  assert.strictEqual(r.score, 70);
});

/* 12. ±2 行窗口边界：隔 3 行不配对 */
test('窗口边界：操作与环境隔 3 行，不构成事件', () => {
  const draft = `△陈默给他取出了子弹。
△墙角堆着几个纸箱。
△窗台上落着一层灰。
△窗外传来几声狗叫。
△桌上摊着带血的纱布。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 0, '±2 行窗口外不配对');
});

/* 13. 场景头行不参与词表匹配 */
test('场景头含操作词也不匹配', () => {
  const draft = `场 3 取子弹
△墙角堆着几个纸箱。
△窗台上落着一层灰。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 14. 反例：创可贴包扎属日常低门槛处理 */
test('反例：创可贴贴一下，不命中', () => {
  const draft = `△她从抽屉里翻出创可贴，贴在他划破的手指上。
△窗外传来收废品的吆喝声。
△茶几上放着两杯凉掉的茶。`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 0);
});

/* 15. 英文两事件未救援：n=1 → 70 */
test('英文：野战手术两事件，n=1 → 70', () => {
  const draft = `INT. LIVING ROOM - NIGHT
He digs the bullet out of Leo's shoulder on the kitchen table.
Leo bites down on the belt, refusing to make a sound.
Paint peeled from the window frame.
A neon sign buzzed outside.
INT. WAREHOUSE - DAY
He stitches up the gash on Mia's arm with fishing line.
The flashlight flickers against the wall.`;
  const r = instantSurgery(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.ok(/instant surgery/i.test(r.hits[0].reason));
});

/* 16. 英文 rescue 三路：资质 / 代价 / 求助 */
test('英文 rescue A/B/C：三种救法均放行', () => {
  const head = `INT. LIVING ROOM - NIGHT
He digs the bullet out of Leo's shoulder on the kitchen table.
Leo bites down on the belt, refusing to make a sound.
Paint peeled from the window frame.
A neon sign buzzed outside.`;
  /* A：资质来路 */
  const a = `${head}
INT. WAREHOUSE - DAY
He stitches up the gash on Mia's arm with fishing line.
He served as a combat medic for eight years.`;
  const ra = instantSurgery(a);
  assert.strictEqual(ra.hitCount, 2);
  assert.strictEqual(ra.unrescuedCount, 0, 'A 资质来路应放行');
  assert.strictEqual(ra.hits[0].rescued, true);

  /* B：过程代价 */
  const b = `${head}
INT. WAREHOUSE - DAY
He stitches up the gash on Mia's arm with fishing line.
By midnight the wound was infected and she was burning with fever.`;
  const rb = instantSurgery(b);
  assert.strictEqual(rb.hitCount, 2);
  assert.strictEqual(rb.unrescuedCount, 0, 'B 过程代价应放行');
  assert.strictEqual(rb.hits[0].rescued, true);

  /* C：专业求助 */
  const c = `${head}
INT. WAREHOUSE - DAY
He stitches up the gash on Mia's arm with fishing line.
The doctor on the phone talked him through every step.`;
  const rc = instantSurgery(c);
  assert.strictEqual(rc.hitCount, 2);
  assert.strictEqual(rc.unrescuedCount, 0, 'C 专业求助应放行');
  assert.strictEqual(rc.hits[0].rescued, true);
});

/* 17. 英文：双锚缺一 + 相邻合并 */
test('英文：纯手术/纯环境放行，相邻操作行合并', () => {
  const pureHospital = `INT. HOSPITAL - DAY
The surgeon removes the bullet after four hours in the OR.
The anesthesiologist monitors the vitals.
The nurse logs the blood loss.`;
  assert.strictEqual(instantSurgery(pureHospital).hitCount, 0);

  const pureScene = `The flashlight swept across the warehouse wall.
A rat darted between the crates.
Somewhere a chain rattled.`;
  assert.strictEqual(instantSurgery(pureScene).hitCount, 0);

  const merged = `INT. LIVING ROOM - NIGHT
He sterilized the blade with vodka.
He digs the bullet out of Leo's shoulder on the kitchen table.
He stitches the wound shut with sewing thread.`;
  const r = instantSurgery(merged);
  assert.strictEqual(r.hitCount, 1, '两个相邻操作行应合并');
  assert.strictEqual(r.score, 100);
});

console.log(`\n=== instant-surgery 结果：${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
