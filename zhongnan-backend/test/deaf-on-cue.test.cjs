'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { deafOnCue } = require('../dist/engine/deaf-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(deafOnCue('').score, 100);
  assert.strictEqual(deafOnCue('  \n ').score, 100);
  assert.strictEqual(deafOnCue('').hitCount, 0);
});

test('zh: 单次爆震秒耳聋（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 旧宅 夜',
    '△那夜炮弹在耳边炸响。',
    '△她什么都听不见了。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次爆震秒耳聋未救 → 70，元数据落耳聋行', () => {
  const draft = [
    '内景 林家 夜',
    '△那夜炮弹在耳边炸响。',
    '△她什么都听不见了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被灌了毁耳朵的药。',
    '△他聋了，成了聋子。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('聋'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('爆震秒耳聋'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('鼓膜'));
});

test('zh: onset 被 CAUSE 鼓膜穿孔/耳蜗毛细胞坏死救回', () => {
  const draft = [
    '内景 医院 夜',
    '△一声爆炸在她身边炸开。',
    '△她失聪了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△又一声爆炸，他被掀翻在地。',
    '△他再也听不见任何声音，医生说鼓膜穿孔、耳蜗毛细胞坏死。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: onset 被 DIAG 耳鼻喉科/纯音测听/确诊救回', () => {
  const draft = [
    '内景 医院 夜',
    '△她被一记耳光扇在耳边。',
    '△她聋了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场高烧之后，他听力全失。',
    '△家里带他去耳鼻喉科，做了纯音测听，三天后才确诊。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: onset 被 PRICE 手语唇语/聋校/助听器没用救回', () => {
  const draft = [
    '内景 山村 日',
    '△那夜煤气罐在她耳边爆炸。',
    '△她双耳失聪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△炮火声里他受了伤。',
    '△他成了聋子，只能靠手语和唇语交流，进了聋校，助听器也没用。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "银针扎一下听见"不救 onset，且自身另算 cure 事件', () => {
  const draft = [
    '内景 病房 日',
    '△一场爆炸后，她双耳失聪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被炮火震倒。',
    '△他什么都听不见。',
    '△神医银针扎向耳穴，他当场重新听见。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('zh: WEAK 裸耳鸣无听力损伤语境——爆后嗡嗡放行', () => {
  const draft = [
    '内景 巷口 夜',
    '△身后传来一声爆炸。',
    '△她耳朵里嗡嗡直响，有些耳鸣。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 听不清 + 手机电话语境——通讯故障让路放行', () => {
  const draft = [
    '内景 客厅 夜',
    '△她正打着手机，那边一声巨响。',
    '△她听不清对方在说什么。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK + 爆震性耳聋/耳膜穿孔语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 医院 日',
    '△爆炸在她耳边炸开。',
    '△她只觉得声音像隔了一层，听不清任何声音，医生说是爆震性耳聋，耳膜穿孔。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯耳鸣陈述无病因放行', () => {
  const draft = [
    '内景 家中 日',
    '△她最近总耳鸣，耳朵嗡嗡响。',
    '△她照常买菜做饭。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 高烧后耳朵发闷（短暂症状无失聪语境）放行', () => {
  const draft = [
    '内景 家中 日',
    '△她发了三天高烧。',
    '△她耳朵发闷，听着有点模糊，多喝热水便好。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: "震耳欲聋"是成语不是耳聋病，无结果锚放行', () => {
  const draft = [
    '内景 废墟 夜',
    '△爆炸声震耳欲聋，她捂着耳朵蹲下。',
    '△她仍在瓦砾间找人。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 装聋作哑/充耳不闻是意志不是失聪，整体让路', () => {
  const draft = [
    '内景 厨房 日',
    '△煤气罐突然爆炸。',
    '△她双耳失聪——其实是装聋作哑，充耳不闻，不想理会。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 天生失聪纯结果无病因放行（人设）', () => {
  const draft = [
    '内景 家中 日',
    '△她天生失聪，是个聋人姑娘。',
    '△她用手语与人交流。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯爆炸受伤无耳聋锚放行（普通创伤反应）', () => {
  const draft = [
    '内景 旧宅 夜',
    '△战场上传来爆炸，她被气浪掀翻。',
    '△她满脸是血，浑身疼。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 撞头→昏迷→醒来失聪归 wake-on-cue，本引擎让路', () => {
  const draft = [
    '内景 医院 日',
    '△他撞到头，昏迷了三天。',
    '△他醒过来，发现自己失聪了。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次银针秒复聪（型B）豁免不扣分', () => {
  const draft = [
    '内景 医馆 日',
    '△神医拈起银针，扎向她的耳穴。',
    '△她猛地听见了：娘。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次廉价秒复聪未救 → 70，kind=cure', () => {
  const draft = [
    '内景 医馆 日',
    '△神医扎了银针。',
    '△她突然能听见了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△孩子在火里哭喊，她一急。',
    '△她一下子听见了那声娘。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'cure');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.marker.includes('→'));
  assert.ok(h.reason.includes('廉价秒复聪'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('听力训练'));
});

test('zh: cure 被 CPROCESS 语训/耳蜗调机/电流声渐进救回', () => {
  const draft = [
    '内景 医馆 日',
    '△神医一针扎下。',
    '△她当场听见。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△名医再扎耳穴。',
    '△她又能听见了。',
    '△之后是好几个月的语训和耳蜗调机，先是电流嗡嗡声，才慢慢学着分辨人声。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 PARTIAL 只听得见巨响/依旧耳鸣/时好时坏救回', () => {
  const draft = [
    '内景 医馆 日',
    '△偏方滴耳神药灌下。',
    '△她听力回来了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医又给一针。',
    '△她重新听见，却只听得见巨响，依旧耳鸣，嘈杂处听不清，时好时坏。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: cure 被 COST 耳蜗天价/手术同意书/倾家荡产救回', () => {
  const draft = [
    '内景 医馆 日',
    '△神医施针。',
    '△她猛地听到了声音。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△人工耳蜗开机。',
    '△她第一次听见妈妈，可耳蜗天价，手术风险签了同意书，家里倾家荡产。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 无触发物的缓慢好转放行（合法康复）', () => {
  const draft = [
    '内景 家中 日',
    '△两个月的听力训练后，她一天比一天听得清。',
    '△医生说听力在慢慢恢复。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——爆炸在一场耳聋在下一场放行', () => {
  const draft = [
    '内景 旧宅 夜',
    '△她身边炸开一声巨响。',
    '内景 林家 日',
    '△她聋了。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻病因锚行合并为同一事件', () => {
  const draft = [
    '内景 柴房 夜',
    '△她被一记耳光扇倒。',
    '△她重重撞到了头。',
    '△她再也听不见。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 八事件密度封底 20，rescued 事件仍入 hits', () => {
  const draft = [
    '内景 长剧 夜',
    '△一声爆炸，她聋了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他挨了一记耳光，双耳失聪。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一场高烧，她什么都听不见了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他撞到头，成了聋子。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△从那夜以后，她失聪了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△炮火声中他被掀翻，听力全失。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医银针扎耳穴，她当场听见。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△孩子哭喊娘，他一急之下重新听见。',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 8);
  assert.strictEqual(r.unrescuedCount, 7);
  assert.strictEqual(r.score, 20);
  assert.ok(r.hits.some((h) => h.kind === 'onset'));
  assert.ok(r.hits.some((h) => h.kind === 'cure'));
});

/* ============ English ============ */

test('en: empty draft scores 100', () => {
  assert.strictEqual(deafOnCue('').score, 100);
});

test('en: single blast-to-deafness (STRONG) exempt', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'A shell exploded right beside her.',
    'She went deaf overnight and heard nothing again.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued onset → 70, kind=onset', () => {
  const draft = [
    'INT. LIN HOME - NIGHT',
    'The artillery shell went off next to her ear.',
    'She could no longer hear.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Someone slapped him across the ear.',
    'He lost his hearing completely.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: onset rescued by CAUSE ruptured eardrum and hair-cell death', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'The blast threw her down.',
    'She went deaf.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A gun went off right next to his ear.',
    'He could not hear at all; the doctor found a ruptured eardrum and destroyed cochlear hair cells.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: onset rescued by DIAG ENT, pure-tone test and audiologist', () => {
  const draft = [
    'INT. HOSPITAL - NIGHT',
    'A loud blast rang out beside her.',
    'She was deafened.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'After a high fever his hearing was gone.',
    'ENT admitted him for a pure-tone test and an audiologist diagnosed him days later.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: onset rescued by PRICE notes, sign language and deaf school', () => {
  const draft = [
    'INT. VILLAGE - DAY',
    'The explosion deafened her.',
    'She became deaf.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Another shell exploded near him.',
    'He was stone-deaf; he wrote notes instead, learned sign language, and entered a school for the deaf.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: a silver-needle cure does not rescue the onset', () => {
  const draft = [
    'INT. WARD - DAY',
    'After the explosion she went deaf.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Something struck him on the side of the head.',
    'He could no longer hear a sound.',
    'The famed doctor drove a silver needle behind his ear, and he could hear again at once.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  const onsetHit = r.hits.find((h) => h.kind === 'onset');
  assert.ok(onsetHit);
  assert.strictEqual(onsetHit.rescued, false);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('en: WEAK naked ringing without hearing-loss context → pass', () => {
  const draft = [
    'INT. ALLEY - NIGHT',
    'A sudden explosion roared behind her.',
    'Her ears were ringing and everything sounded muffled.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK anchor with cell-phone / bad-line context → comm-fail pass', () => {
  const draft = [
    'INT. LIVING ROOM - NIGHT',
    'She was on her cell phone when the loud bang hit.',
    'She could barely hear the caller through the bad line.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK anchor + acoustic trauma context → event, exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The blast went off beside her.',
    'Everything sounded distant and muffled; the doctor said it was acoustic trauma, a perforated eardrum.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: tinnitus alone without cause → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'She had tinnitus and her ears rang at night.',
    'She cooked and cleaned as usual.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: post-fever stuffed ears without loss context → transient, pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'She ran a high fever for three days.',
    'Her ears felt stuffed and sounds came as if underwater, but it soon passed.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: "deafening" noise is an idiom, no deafness anchor → pass', () => {
  const draft = [
    'INT. RUBBLE - NIGHT',
    'The music was deafening, but she covered her ears.',
    'She kept searching through the debris.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: feigned deafness and deliberate ignoring → pass', () => {
  const draft = [
    'INT. KITCHEN - DAY',
    'The gas explosion shook the room.',
    'She claimed she was stone-deaf, but she only feigned deafness and tuned him out.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: born deaf without cause → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'She was born deaf and communicated with her hands.',
    'She led a quiet, ordinary life.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure blast injury without deafness anchor → pass', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'The explosion threw her across the room.',
    'She was bleeding and bruised.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: head injury plus coma then waking deafness belongs to wake-on-cue', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'He hit his head and lay unconscious for days.',
    'When he woke from the coma, he had lost his hearing.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single one-shot instant cure exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor placed a silver needle behind her ear.',
    'Suddenly she heard it: Mama!',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second cheap instant cure unrescued → 70, kind=cure', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor inserted the silver needle.',
    'Her hearing returned at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Seeing her child in danger, she acted.',
    'In desperation, she suddenly heard his voice again.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('mapping'));
});

test('en: cure rescued by CPROCESS auditory training and implant mapping', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The famed doctor inserted the needle at her ear point.',
    'She could hear again instantly.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'Acupuncture at her ear once more.',
    'Her hearing returned the moment the needle went in.',
    'Months of auditory training and implant mapping followed; it started with electronic buzzing before she learned to interpret sounds.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cure rescued by PARTIAL loud sounds only and persistent ringing', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'A vial of herbal ear drops went in.',
    'Her hearing came back at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The miracle cure was pressed on her again.',
    'She could hear again, but she could only hear loud sounds; the ringing in her ears persisted and it came and went.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: cure rescued by COST fortune, consent form and drained savings', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The legendary doctor worked the needle.',
    'Sound rushed in at once.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The cochlear implant was activated.',
    'She heard for the first time, but the implant cost a fortune; she signed the surgical consent form and the bills drained their savings.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: slow recovery without trigger → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'After months of auditory training her hearing slowly returned.',
    'The doctor called it gradual healing.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene blast and deafness do not pair', () => {
  const draft = [
    'INT. OLD HOUSE - NIGHT',
    'The bomb went off beside her.',
    'INT. LIN HOME - DAY',
    'She went deaf.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: adjacent cause rows merge into one event', () => {
  const draft = [
    'INT. SHED - NIGHT',
    'They slapped him across the ear.',
    'Then he hit his head.',
    'He could no longer hear.',
  ].join('\n');
  const r = deafOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});
