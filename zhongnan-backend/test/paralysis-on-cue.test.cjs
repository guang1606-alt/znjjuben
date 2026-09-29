'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { paralysisOnCue } = require('../dist/engine/paralysis-on-cue.js');

/* ============ 中文（26 例） ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(paralysisOnCue('').score, 100);
  assert.strictEqual(paralysisOnCue('  \n ').score, 100);
  assert.strictEqual(paralysisOnCue('').hitCount, 0);
});

test('zh: 单次事故秒瘫痪（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 工地 日',
    '△他从脚手架上摔下来。',
    '△他双腿瘫痪。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次事故秒瘫痪未救 → 70，元数据落瘫痪行', () => {
  const draft = [
    '内景 工地 夜',
    '△一场车祸撞倒了她。',
    '△她双腿瘫痪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△钢梁砸在他后腰。',
    '△他再也站不起来。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('工地'));
  assert.ok(h.snippet.includes('站不起来'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('事故秒瘫痪'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('脊髓'));
});

test('zh: onset 被 R_CAUSE 脊髓损伤/椎体爆裂骨折救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她从房顶上摔下来，下身瘫痪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△水泥板砸在他后背，下半身失去知觉。',
    '△医生诊断脊髓损伤、椎体爆裂骨折。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: onset 被 R_DIAG 核磁共振/神经外科会诊/确诊救回', () => {
  const draft = [
    '内景 医院 夜',
    '△他被卡车撞倒，双腿瘫痪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他从高处坠落，双腿不能动。',
    '△送医后做了核磁共振，神经外科会诊，三天后才确诊。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: onset 被 R_PRICE 坡道/导尿/妻子推轮椅救回', () => {
  const draft = [
    '内景 山村 日',
    '△钢梁砸在他后腰，他高位截瘫。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她被汽车撞飞，终身坐轮椅。',
    '△家里改了坡道，她带着导尿管，妻子天天推着轮椅进出。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "银针扎一针站起来"不救 onset，且自身另算 cure 事件', () => {
  const draft = [
    '内景 病房 日',
    '△一场车祸后，她瘫痪了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被车撞了。',
    '△他双腿瘫痪。',
    '△神医银针沿脊柱扎下，他扔下轮椅就追。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('zh: WEAK 蹲麻两腿发麻无病因——放行', () => {
  const draft = [
    '内景 巷口 夜',
    '△雨里蹲太久，她两腿发麻，一软险些跌倒。',
    '△她扶着墙慢慢站起来。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 吓得两腿发软——放行', () => {
  const draft = [
    '内景 客厅 夜',
    '△门突然被踹开，她吓得两腿发软，扶着墙才站住。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK + MOBCTX 脊柱骨折语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 医院 日',
    '△他从梯子上摔下来。',
    '△他双腿发麻，使不上劲。',
    '△医生说脊柱骨折，压迫了神经。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯腿麻陈述无病因放行', () => {
  const draft = [
    '内景 家中 日',
    '△她最近总觉得腿麻，照常买菜做饭。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 装瘫碰瓷骗保是意志不是失能，整体让路', () => {
  const draft = [
    '内景 街口 日',
    '△他被汽车撞倒，双腿瘫痪。',
    '△其实他是装瘫碰瓷，想骗保险金。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 车祸→昏迷→醒来下半身不能动归 wake-on-cue，本引擎让路', () => {
  const draft = [
    '内景 医院 日',
    '△一场车祸，他昏迷了三天。',
    '△他醒过来，下半身不能动了。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 旧伤瘸了一辈子是人设，无事故病因放行', () => {
  const draft = [
    '内景 村中 日',
    '△他年轻时打仗伤了腿，瘸了一辈子。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯擦伤无瘫痪锚放行（普通外伤）', () => {
  const draft = [
    '内景 路口 夜',
    '△她被车蹭倒，膝盖擦破了皮。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次廉价秒愈（带 STATE 长期瘫痪前提）豁免不扣分', () => {
  const draft = [
    '内景 医馆 日',
    '△老中医扎了银针。',
    '△她突然能走路了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她本已瘫痪三年。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 第2次廉价秒愈未救 → 70，kind=cure，STATE 复用', () => {
  const draft = [
    '内景 医馆 日',
    '△老中医扎了银针。',
    '△她突然能走路了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她本已瘫痪三年。',
    '△孩子坠楼，她一急。',
    '△她猛地站起就追。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 8);
  assert.strictEqual(h.kind, 'cure');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.marker.includes('→'));
  assert.ok(h.reason.includes('廉价秒愈'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('康复训练'));
});

test('zh: STATE 门控反例——正骨后健康人站起，无长期瘫痪前提放行', () => {
  const draft = [
    '内景 按摩店 日',
    '△他扭伤了腰。',
    '△正骨师给他揉了揉。',
    '△他突然站起来走了走。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 R_CPROCESS 数月康复/翻身坐起/步态训练救回', () => {
  const draft = [
    '内景 医馆 日',
    '△他瘫痪三年。',
    '△正骨师在他后腰一扳。',
    '△他竟然能走路了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他依旧瘫痪在床。',
    '△老中医再沿脊柱行针。',
    '△瘫痪多年的他一下子站起。',
    '△之后好几个月康复训练，他先学会翻身坐起，再练步态训练，一天比一天稳。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 R_PARTIAL 双拐/两三步就喘/拖腿/时好时坏救回', () => {
  const draft = [
    '内景 医馆 日',
    '△她坐了三年轮椅。',
    '△偏方膏药贴上后腰。',
    '△她又能走路了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她依旧离不开轮椅。',
    '△神医又扎一针。',
    '△她重新站了起来，却拄着双拐，走两三步就喘，一条腿还拖着，时好时坏，还得回轮椅。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: cure 被 R_COST 进口钢钉/天价手术/倾家荡产/同意书救回', () => {
  const draft = [
    '内景 医馆 日',
    '△他瘫痪三年。',
    '△老中医一针扎在他的脊柱上。',
    '△他当场能走路了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她也终身坐轮椅。',
    '△她家里凑钱请神医再扎。',
    '△她重新站了起来，可进口钢钉和天价手术早让家里倾家荡产，还签了同意书。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 无触发物的缓慢好转放行（合法康复）', () => {
  const draft = [
    '内景 家中 日',
    '△两个月康复训练后，她先能动大脚趾，再练站立训练，一天比一天稳。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——银针在一场站起在下一场放行', () => {
  const draft = [
    '内景 医馆 日',
    '△神医银针沿脊柱扎下。',
    '内景 院子 日',
    '△她扔下轮椅站了起来。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻病因锚行合并为同一事件', () => {
  const draft = [
    '内景 工地 夜',
    '△他被卡车撞倒。',
    '△紧接着钢梁砸中他后腰。',
    '△他高位截瘫。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 八事件密度封底 20，rescued 事件仍入 hits', () => {
  const draft = [
    '内景 长剧 夜',
    '△他从脚手架上摔下来，瘫痪了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场车祸，她下半身没了知觉。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△塌方的水泥板砸在他后腰，双腿都不能动。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△子弹打中他的脊梁，他终身瘫痪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他从马背上摔落，这辈子只能在轮椅上。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△钢梁砸在他脊梁上，他成了瘫子。',
    '△神医银针沿脊柱扎下，她扔下轮椅就走。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他瘫痪三年。',
    '△正骨师咔嚓一扳，他猛地站起就追。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 8);
  assert.strictEqual(r.unrescuedCount, 7);
  assert.strictEqual(r.score, 20);
  assert.ok(r.hits.some((h) => h.kind === 'onset'));
  assert.ok(r.hits.some((h) => h.kind === 'cure'));
});

test('zh: 后腰轻拍与推轮椅 false positive 放行', () => {
  const draft = [
    '内景 院子 日',
    '△有人在他后腰上轻轻拍了拍。',
    '△她没扶他，自己推着轮椅走了。',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English（25 例） ============ */

test('en: empty draft scores 100', () => {
  assert.strictEqual(paralysisOnCue('').score, 100);
});

test('en: single fall-to-paralysis (STRONG) exempt', () => {
  const draft = [
    'INT. SITE - DAY',
    'He fell from the scaffolding.',
    'He was paralyzed.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued onset → 70, kind=onset', () => {
  const draft = [
    'INT. STREET - NIGHT',
    'A truck struck him.',
    'He lost the use of his legs.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A steel beam landed on his lower back.',
    'He could never walk again.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('spinal cord'));
});

test('en: onset rescued by CAUSE severed spinal cord and burst fracture', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'She fell from the roof.',
    'She was paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A beam crushed his back; he had no feeling in his legs.',
    'The MRI showed a severed spinal cord and a burst fracture.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: onset rescued by DIAG neurosurgeon, MRI, CT and later diagnosis', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'After the car crash, she was paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He fell from the ladder.',
    "He couldn't move his legs.",
    'The neurosurgeon ordered an MRI and a CT scan; the diagnosis came days later.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: onset rescued by PRICE ramp, catheter and wheelchair care', () => {
  const draft = [
    'INT. VILLAGE - DAY',
    'A steel beam landed on his lower back and left him paraplegic.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was hit by a truck and was wheelchair-bound.',
    'The house got a wheelchair ramp; he wore a catheter and needed help to bathe, and his wife pushed him in the wheelchair.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: a silver-needle cure does not rescue the onset', () => {
  const draft = [
    'INT. WARD - DAY',
    'After the car crash she was paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was hit by a car.',
    'His legs were completely paralyzed.',
    'The famed doctor needled down the spine, and he abandoned the wheelchair and ran.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('en: WEAK naked numbness from squatting without cause → pass', () => {
  const draft = [
    'INT. ALLEY - NIGHT',
    'His legs were numb from squatting too long.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK anchor plus fractured-vertebra/nerve-damage context → event, exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'He fell from the roof.',
    "His legs went numb and wouldn't move.",
    'The neurologist said it was a fractured vertebra with nerve damage.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: faked paralysis for insurance money → pass', () => {
  const draft = [
    'INT. STREET - DAY',
    'He faked the paralysis, pretending to be paralyzed for the insurance money.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: crash plus coma then waking paralysis belongs to wake-on-cue', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'After the crash he was comatose for weeks.',
    'When he woke from the coma, he was paralyzed from the waist down.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: born paraplegic without cause → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'She had been paraplegic since birth and used a wheelchair.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure explosion injury without paralysis anchor → pass', () => {
  const draft = [
    'INT. WAREHOUSE - NIGHT',
    'The explosion threw him across the room.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single one-shot instant cure with STATE exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'She had been in a wheelchair for years.',
    'The famed doctor placed a silver needle along her spine.',
    'Suddenly she stood up and took a step.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second cheap instant cure unrescued → 70, kind=cure', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'He was paralyzed for years now.',
    'The famed doctor inserted the needle along the spine.',
    'His legs worked again at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was confined to a wheelchair.',
    'As the child fell, he acted in desperation.',
    'He suddenly stood and chased.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 9);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('rehab'));
});

test('en: STATE-gate negative - healthy man stands after a back rub → pass', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'He twisted his ankle.',
    'The chiropractor rubbed his back.',
    'He suddenly stood up and walked it off.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cure rescued by CPROCESS months of PT, toe work and gait training', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'He was wheelchair-bound for years.',
    'The chiropractor worked his back with one sharp twist.',
    'He could walk again at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He was still confined to a wheelchair.',
    'The legendary doctor worked another needle along the spine.',
    'He, paralyzed for years, rose from the wheelchair at once.',
    'Months of physical therapy followed; he started by wiggling a toe, then came gait training, little by little.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cure rescued by PARTIAL crutches, shaky steps, dragged leg and wheelchair', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'He was paralyzed for months.',
    'A miracle plaster went on his back.',
    'He walked across the room at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He had not walked in years.',
    'The legendary doctor needled down the spine.',
    'He could walk again, but only on crutches; he took two shaky steps, dragged one leg and would still need the wheelchair.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: cure rescued by COST steel rods, fortune, consent form and savings', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'She was confined to a wheelchair.',
    'The famed doctor needled down the spine.',
    'Feeling returned to her legs at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He had not walked in years.',
    'The famed doctor needled down the spine once more.',
    'Feeling returned to his legs at once, but the imported steel rods and the surgery cost a fortune; he signed the consent form and years of doctors had drained their savings.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: slow recovery without trigger → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'After months of physical therapy he slowly began to stand.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene needle and standing do not pair', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor needled down the spine.',
    'INT. COURTYARD - DAY',
    'He abandoned the wheelchair and stood.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: adjacent cause rows merge into one event', () => {
  const draft = [
    'INT. SITE - NIGHT',
    'The truck hit him.',
    'Then a beam landed on his lower back.',
    'He was paraplegic.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: eight-event density floors at 20', () => {
  const draft = [
    'INT. MONTAGE - NIGHT',
    'He fell from the scaffolding and was paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A truck struck him; he lost the use of his legs.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A steel beam landed on his lower back; his legs were completely paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A bullet lodged in his spine; he was permanently paralyzed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He fell off the horse and was wheelchair-bound.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A rock crushed his back and he became paralyzed.',
    'The famed doctor needled down the spine; he abandoned the wheelchair and walked away.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He had been in a wheelchair for years.',
    'As the child fell, he acted in desperation and suddenly stood and ran.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 8);
  assert.strictEqual(r.unrescuedCount, 7);
  assert.strictEqual(r.score, 20);
  assert.ok(r.hits.some((h) => h.kind === 'onset'));
  assert.ok(r.hits.some((h) => h.kind === 'cure'));
});

test('en: friendly pat on the back → pass', () => {
  const draft = [
    'INT. YARD - DAY',
    'Someone patted him on the back for luck.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: startled healthy man stands without trigger or state → pass', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'A loud noise startled him and he suddenly stood up.',
  ].join('\n');
  const r = paralysisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});
