'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { blindnessOnCue } = require('../dist/engine/blindness-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(blindnessOnCue('').score, 100);
  assert.strictEqual(blindnessOnCue('  \n ').score, 100);
  assert.strictEqual(blindnessOnCue('').hitCount, 0);
});

test('zh: 单次撞击秒失明（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 马路 夜',
    '△她出了车祸，人被撞飞。',
    '△她双目失明，什么都看不见了。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次撞击秒失明未救 → 70，元数据落失明行', () => {
  const draft = [
    '内景 林家 夜',
    '△她出了车祸，人被撞飞。',
    '△她双目失明，什么都看不见了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他从楼梯上摔下来，磕到了头。',
    '△他两眼全瞎，眼前一片漆黑。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('漆黑'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('撞击秒失明'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('视网膜'));
});

test('zh: onset 被 CAUSE 眼球破裂/视网膜脱落救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她摔下楼梯撞到了头。',
    '△她当场失明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被人一拳打在眼上。',
    '△他眼球破裂，视网膜脱落，彻底失明。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: onset 被 DIAG 眼科会诊/眼底造影/数日后确诊救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她出了车祸。',
    '△她双目失明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被车撞了。',
    '△他什么都看不见了。',
    '△眼科医院组织会诊，做了眼底造影和CT，三天后才确诊。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: onset 被 PRICE 终身失明/盲文/导盲犬救回', () => {
  const draft = [
    '内景 山村 日',
    '△她出了车祸。',
    '△她双目失明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场高烧之后，她失明了。',
    '△她再也没有复明，学着盲文，靠导盲犬和手杖生活。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "拆纱布复明"不救 onset → 70', () => {
  const draft = [
    '内景 病房 日',
    '△她出了车祸。',
    '△她双目失明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他摔下楼梯磕到了头。',
    '△他什么都看不见了。',
    '△拆开纱布，她立刻重见光明。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: WEAK 眼伤无眼科语境——挨打眼冒金星放行', () => {
  const draft = [
    '内景 巷口 夜',
    '△他被人打了一拳。',
    '△他眼冒金星，眼前发黑。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 眼伤 + 眼科语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 医院 日',
    '△他被人打了一拳，眼前发黑。',
    '△眼科医生说是角膜擦伤，先包上纱布。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯失明陈述无病因放行（天生盲是人设）', () => {
  const draft = [
    '内景 家中 日',
    '△她从小双目失明。',
    '△她靠手摸认路。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯车祸无视盲锚放行（普通外伤）', () => {
  const draft = [
    '内景 马路 夜',
    '△他出了车祸。',
    '△他断了一条腿。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次角膜移植秒复明（型B）豁免不扣分', () => {
  const draft = [
    '内景 医院 日',
    '△医生连夜做了角膜移植手术。',
    '△拆开纱布，她立刻看见了他的脸。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次廉价秒复明未救 → 70，kind=cure', () => {
  const draft = [
    '内景 医院 日',
    '△医生连夜安排了角膜移植手术。',
    '△拆开纱布，她当场重见光明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了一包偏方药。',
    '△她马上就能看见了。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'cure');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.marker.includes('→'));
  assert.ok(h.reason.includes('廉价秒复明'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('排异'));
});

test('zh: cure 被 CPROCESS 抗排异/视力训练/光感到轮廓救回', () => {
  const draft = [
    '内景 医院 日',
    '△医生连夜做了角膜移植。',
    '△拆开纱布，她当场重见光明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△城里名医为她做了第二回角膜移植。',
    '△她瞬间恢复了视力。',
    '△术后要吃抗排异药，做三个月视力训练，从光感慢慢练到看清轮廓。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 PARTIAL 弱视/怕光/可能恶化救回', () => {
  const draft = [
    '内景 医院 日',
    '△医生做了角膜移植。',
    '△拆开纱布，她当场能看见了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医又给了一包偏方。',
    '△她当场能看见了，却留下了弱视，怕光，医生说还可能恶化。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: cure 被 COST 捐献者去世/等三年/倾家荡产救回', () => {
  const draft = [
    '内景 医院 日',
    '△医生为她安排了角膜移植。',
    '△拆开纱布，她当场重见光明。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了一包偏方。',
    '△她马上就能看见了。',
    '△捐献者已经去世，她等了三年才等到角膜，手术费让家里倾家荡产。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 撞头/磕脑袋廉价秒复明第二次 → 70', () => {
  const draft = [
    '内景 病房 日',
    '△他的头又被撞了一下。',
    '△他瞬间恢复了视力。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她的脑袋又磕了一下。',
    '△她马上能看见了。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.score, 70);
});

test('zh: 无触发物的缓慢好转放行（合法恢复）', () => {
  const draft = [
    '内景 家中 日',
    '△两个月后，他的视力一天比一天清楚。',
    '△医生说视网膜在慢慢修复。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——车祸在一场失明在下一场放行', () => {
  const draft = [
    '内景 马路 夜',
    '△她出了车祸。',
    '内景 医院 日',
    '△她双目失明。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻损伤锚行合并为同一事件', () => {
  const draft = [
    '内景 楼梯口 夜',
    '△她摔下了楼梯。',
    '△又磕到了头。',
    '△她双目失明了。',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: empty draft scores 100', () => {
  assert.strictEqual(blindnessOnCue('').score, 100);
});

test('en: single instant blindness (STRONG) exempt', () => {
  const draft = [
    'EXT. ROAD - NIGHT',
    'She was hit by a car.',
    'She went completely blind overnight.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued onset → 70, kind=onset', () => {
  const draft = [
    'INT. LIN HOME - NIGHT',
    'She was hit by a car.',
    'She went completely blind overnight.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He fell down the stairs and struck his head.',
    'He lost his sight entirely; the world went dark.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: onset rescued by CAUSE detached retina', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'She was in a car crash.',
    'She went blind.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The explosion burned his eyes.',
    'His retinas detached and he went blind.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: onset rescued by PRICE braille and white cane', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'She was in a car crash.',
    'She went blind.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A high fever swept through her and she went blind.',
    'She never regained her sight; she learned braille and walked with a white cane.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: WEAK blurry vision without eye context → pass', () => {
  const draft = [
    'INT. ALLEY - NIGHT',
    'He was punched in the face.',
    'His vision went blurry for a moment.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK blurry vision + ophthalmologist context → event, exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'She was beaten; her vision was blurry.',
    'The ophthalmologist said the cornea was scratched.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure blindness without harm → pass (blind from birth)', () => {
  const draft = [
    'INT. HOME - DAY',
    'She had been blind from birth.',
    'She read braille at the school.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single one-shot instant cure exempt', () => {
  const draft = [
    'INT. WARD - DAY',
    'The corneal transplant was a success.',
    'They removed the bandages and she could see his face instantly.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second cheap instant cure unrescued → 70, kind=cure', () => {
  const draft = [
    'INT. WARD - DAY',
    'The corneal transplant was a success.',
    'They removed the bandages and she could see his face instantly.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A famed doctor gave her a herbal remedy.',
    'Her sight returned miraculously.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: cure rescued by CPROCESS + PARTIAL (anti-rejection, little by little, light-sensitive)', () => {
  const draft = [
    'INT. WARD - DAY',
    'The corneal transplant was a success.',
    'They removed the bandages and she could see instantly.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Another bump on the head, the doctor said, cured her.',
    'At once she could see again.',
    'She kept using anti-rejection drops; sight returned little by little, and she stayed sensitive to light.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cure rescued by COST donor death and years of waiting', () => {
  const draft = [
    'INT. WARD - DAY',
    'The corneal transplant was a success.',
    'They removed the bandages and she could see his face instantly.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A famous specialist performed a second corneal transplant.',
    'Her vision was restored the moment the bandages came off.',
    'The donor had died; she had waited years and the bills drained their savings.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: slow recovery without trigger → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'Over the following months her sight returned by degrees.',
    'The doctor called it a slow healing.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene harm and blindness do not pair', () => {
  const draft = [
    'EXT. ROAD - NIGHT',
    'She was in a car crash.',
    'INT. HOSPITAL - NIGHT',
    'She went blind.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: adjacent harm rows merge into one event', () => {
  const draft = [
    'EXT. ROAD - NIGHT',
    'She was hit by a car.',
    'She struck her head on the windshield.',
    'She went blind.',
  ].join('\n');
  const r = blindnessOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});
