'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { poisonOnCue } = require('../dist/engine/poison-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(poisonOnCue('').score, 100);
  assert.strictEqual(poisonOnCue('  \n ').score, 100);
  assert.strictEqual(poisonOnCue('').hitCount, 0);
});

test('zh: 单次毒酒秒中毒（SPEC+STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 宴厅 夜',
    '△那杯酒里被人下了毒。',
    '△她喝下后七窍流血，奄奄一息。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次接触秒中毒未救 → 70，元数据落危象行，kind=onset', () => {
  const draft = [
    '内景 林家 夜',
    '△她喝下那杯毒酒。',
    '△她七窍流血，奄奄一息。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他被毒簪子扎了一下。',
    '△他口吐白沫，昏迷不醒。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('白沫'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('接触秒中毒'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('洗胃'));
});

test('zh: onset 被 CAUSE 毒理化验/乌头碱/肝肾衰竭救回', () => {
  const draft = [
    '内景 侯府 夜',
    '△她喝下毒酒。',
    '△她七窍流血，昏迷不醒。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他喝了毒茶。',
    '△他口吐白沫，浑身抽搐。',
    '△化验报告出来了：乌头碱，毒素侵入肝肾，引起呼吸衰竭。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: onset 被 DIAG 催吐洗胃/抗毒血清救回', () => {
  const draft = [
    '内景 侯府 夜',
    '△她喝下毒酒。',
    '△她七窍流血，昏迷不醒。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他喝了毒茶。',
    '△他口吐白沫，浑身抽搐。',
    '△大夫连夜抢救，催吐洗胃，又打了抗毒血清，留在医院观察。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: onset 被 PRICE 真死/灵堂救回（阀门没掰回去）', () => {
  const draft = [
    '内景 山村 夜',
    '△她喝下毒酒。',
    '△她七窍流血。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他饮下毒茶。',
    '△他奄奄一息。',
    '△他到底没救回来，三天后真的死了，灵堂都搭起来了。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: “一颗解药就好”不救 onset → 70', () => {
  const draft = [
    '内景 柴房 夜',
    '△她喝下毒酒。',
    '△她七窍流血。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他饮下毒茶。',
    '△他奄奄一息。',
    '△好在他怀里揣着解药，一颗下去就好了。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: WEAK 腹痛呕吐无毒语境——醉酒/吃坏肚子放行', () => {
  const draft = [
    '内景 酒楼 夜',
    '△他干了那杯酒。',
    '△他腹痛如绞，呕吐起来。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: GENERIC+WEAK 须 TOXCTX 兜底——补上中毒语境后事件成立（首次豁免）', () => {
  const draft = [
    '内景 家中 夜',
    '△他喝了一碗汤。',
    '△他肚子绞痛，一阵呕吐。',
    '△家人都说这像是中毒。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: GENERIC+STRONG 无毒理语境放行（普通醉酒昏迷）', () => {
  const draft = [
    '内景 酒楼 夜',
    '△他喝了杯酒。',
    '△他昏迷不醒。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯中毒陈述无危象放行', () => {
  const draft = [
    '内景 家中 日',
    '△他去年中毒了。',
    '△家人带着他四处求医。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯吃喝无危象放行', () => {
  const draft = [
    '内景 宴厅 夜',
    '△她端起酒杯，喝了一口。',
    '△席上众人觥筹交错。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 毒蛇咬伤秒危象 SPEC 直配（首次豁免）', () => {
  const draft = [
    '外景 后山 日',
    '△他被毒蛇咬了一口。',
    '△他浑身抽搐，奄奄一息。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次解药秒愈（型B）豁免不扣分', () => {
  const draft = [
    '内景 病房 日',
    '△大夫给她服下解药。',
    '△她当场没事，坐了起来。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次廉价秒解毒未救 → 70，kind=cure', () => {
  const draft = [
    '内景 病房 日',
    '△大夫给她喂了解药。',
    '△她立刻没事，坐了起来。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一丸丹药。',
    '△他当场活蹦乱跳，跟没事人一样。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'cure');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.marker.includes('→'));
  assert.ok(h.reason.includes('廉价秒解毒'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('余毒'));
});

test('zh: cure 被 CPROCESS 洗胃透析/昏迷三天/休养三月救回', () => {
  const draft = [
    '内景 医馆 日',
    '△她服下解药。',
    '△她立刻痊愈，恢复如初。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一颗解毒丹。',
    '△他当场活蹦乱跳，毒全解了。',
    '△又是洗胃又是透析，他昏迷了三天，休养了三个月才恢复。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cure 被 PARTIAL 余毒未清/可能复发救回', () => {
  const draft = [
    '内景 医馆 日',
    '△她服下解药。',
    '△她立刻痊愈，恢复如初。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一颗解毒丹。',
    '△他当场活蹦乱跳，毒全解了。',
    '△大夫说余毒未清，身子还虚，可能复发，还要喝三个月汤药。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: cure 被 COST 唯一一颗/以命换药救回', () => {
  const draft = [
    '内景 药庐 日',
    '△她服下解药。',
    '△她立刻痊愈，恢复如初。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一颗解毒丹。',
    '△他当场活蹦乱跳，毒全解了。',
    '△这解药世上只有一颗，炼药的老师傅以命换药，拿药的人再没回来。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 有解药但缓慢好转无 FINE 锚——放行', () => {
  const draft = [
    '内景 家中 日',
    '△她按时服用解药。',
    '△接下来的三个月她持续治疗，慢慢恢复。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 嘴吸毒血+当场坐起（型B）；第2次带余毒尾巴救回，kind=cure', () => {
  const draft = [
    '内景 破庙 夜',
    '△大夫给她喂下解药。',
    '△她立刻没事，坐了起来。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他伏身用嘴吸出伤口里的毒血。',
    '△她当场坐了起来。',
    '△大夫说余毒未清，可能复发。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景——接触与危象不配对，放行', () => {
  const draft = [
    '内景 前厅 夜',
    '△她喝下毒酒。',
    '内景 卧房 夜',
    '△她七窍流血，昏迷不醒。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻投毒/饮下行合并为一个事件', () => {
  const draft = [
    '内景 宴厅 夜',
    '△那杯酒里被人下了毒。',
    '△她端起酒杯，一饮而尽。',
    '△她当场七窍流血，奄奄一息。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 三次中毒阀门均未救 → n=2，50 分', () => {
  const draft = [
    '内景 宫中 夜',
    '△她喝下毒酒。',
    '△她七窍流血。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他饮下毒茶。',
    '△他口吐白沫，奄奄一息。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△太后服了毒药。',
    '△她昏迷不醒，大夫摇头。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.score, 50);
});

test('zh: 裸“回家休养”无时长不救 cure；rescued=false', () => {
  const draft = [
    '内景 医馆 日',
    '△她服下解药。',
    '△她当场没事，坐了起来。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一颗丹药。',
    '△他立刻活蹦乱跳，跟没事人一样。',
    '△大夫只让他回家休养，别太劳累。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('zh: “休养了三个月”带时长救回 cure', () => {
  const draft = [
    '内景 医馆 日',
    '△她服下解药。',
    '△她当场没事，坐了起来。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△神医给了他一颗丹药。',
    '△他立刻活蹦乱跳，跟没事人一样。',
    '△大夫让他休养了三个月，又针灸了几回，他才慢慢下床。',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

/* ============ English ============ */

test('en: empty draft scores 100', () => {
  assert.strictEqual(poisonOnCue('').score, 100);
  assert.strictEqual(poisonOnCue('\n  \n').hitCount, 0);
});

test('en: single spiked-wine instant crisis exempt', () => {
  const draft = [
    'INT. FEAST HALL - NIGHT',
    'She drank the poisoned wine.',
    'She was foaming at the mouth and convulsing on the floor.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second instant poisoning unrescued → 70, onset metadata', () => {
  const draft = [
    'INT. LIN MANOR - NIGHT',
    'She drank the poisoned wine at dinner.',
    'She foamed at the mouth and convulsed.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'His wine had been laced with arsenic.',
    'He was comatose, and doctors shook their heads.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.ok(h.sceneHeader.includes('LIN'));
  assert.strictEqual(h.kind, 'onset');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('death notice'));
  assert.ok(r.advice[0].includes('toxicology'));
  assert.strictEqual(r.score, 70);
});

test('en: onset rescued by CAUSE toxicology report and organ failure', () => {
  const draft = [
    'INT. MANOR - NIGHT',
    'She drank the poisoned wine.',
    'She foamed at the mouth, convulsing.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He swallowed the poisoned soup.',
    'He lay dying, gasping for breath.',
    'The toxicology report identified aconitine; the toxin had attacked the liver and kidneys.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: onset rescued by DIAG induced vomiting, stomach pump, antivenom, ICU', () => {
  const draft = [
    'INT. MANOR - NIGHT',
    'She drank the poisoned wine.',
    'She foamed at the mouth, convulsing.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He swallowed the poisoned broth.',
    'He was comatose, writhing on the floor.',
    'They induced vomiting, pumped his stomach and gave him antivenom in the ICU.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: onset rescued by PRICE death days later and funeral', () => {
  const draft = [
    'INT. COTTAGE - NIGHT',
    'She drank the poisoned wine.',
    'She foamed at the mouth, convulsing.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He took the poisoned medicine.',
    'He was comatose, given up for dead.',
    'She died days later and never woke up; the family arranged a funeral.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: “one antidote pill fixed it” does not rescue onset → 70', () => {
  const draft = [
    'INT. CELLAR - NIGHT',
    'She drank the poisoned wine.',
    'She foamed at the mouth.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He drank the poisoned tea.',
    'He lay dying, on his last breath.',
    'Luckily he carried the antidote; one pill and he was fine.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'onset');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: WEAK reaction without poison context (hangover) → pass', () => {
  const draft = [
    'INT. TAVERN - NIGHT',
    'He drained the cup of wine.',
    'He felt nauseous and threw up overnight.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: GENERIC+WEAK with poison context gate → event forms (first exempt)', () => {
  const draft = [
    'INT. HOME - NIGHT',
    'He drank a bowl of soup at supper.',
    'Violent cramps doubled him over.',
    'They whispered the word poison.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: pure poisoned statement without crisis → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'He had been poisoned in the war.',
    'He rarely spoke of those years.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single antidote instant cure exempt', () => {
  const draft = [
    'INT. WARD - DAY',
    'The doctor gave him the antidote.',
    'He was instantly fine, good as new.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second cheap instant cure unrescued → 70, kind=cure', () => {
  const draft = [
    'INT. WARD - DAY',
    'The antidote was administered.',
    'Within moments she was back on her feet.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'A famed doctor pressed a magic pill between her lips.',
    'She was instantly good as new.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.ok(r.hits[0].reason.includes('light switch'));
  assert.strictEqual(r.score, 70);
});

test('en: cure rescued by CPROCESS stomach pump, coma days, months of recovery', () => {
  const draft = [
    'INT. WARD - DAY',
    'The antidote went down.',
    'She was instantly fine and stood up.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He swallowed the herbal antidote.',
    'At once he sat up, fully recovered.',
    'His stomach was pumped, he spent days in a coma and needed months of recovery.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: cure rescued by PARTIAL residual toxin, frailty, relapse risk', () => {
  const draft = [
    'INT. WARD - DAY',
    'The antidote went down.',
    'She was instantly fine and stood up.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He swallowed the herbal antidote.',
    'At once he sat up, fully recovered.',
    'Traces of the poison remained; he was still weak and could relapse.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: cure rescued by COST only one antidote, maker died, messenger lost', () => {
  const draft = [
    'INT. APOTHECARY - DAY',
    'The antidote went down.',
    'She was instantly fine and stood up.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He swallowed the herbal antidote.',
    'At once he sat up, fully recovered.',
    'It was the only one antidote in existence; the pill maker died, and whoever fetched it never returned.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: antidote with slow gradual recovery, no instant FINE → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'He took the antidote as instructed.',
    'Months of recovery followed; he gradually recovered his strength.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene contact and crisis do not pair → pass', () => {
  const draft = [
    'INT. HALL - NIGHT',
    'She drank the poisoned wine.',
    'INT. BEDCHAMBER - NIGHT',
    'She foamed at the mouth and lay dying.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: adjacent lacing/drinking rows merge into one event', () => {
  const draft = [
    'INT. FEAST HALL - NIGHT',
    'The wine in his goblet had been laced.',
    'He drank the wine from the goblet.',
    'He convulsed, foaming at the mouth.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: snakebite to death\u2019s door SPEC direct pairing (first exempt)', () => {
  const draft = [
    'EXT. GARDEN - DAY',
    'He was bitten by a poisonous snake on the ankle.',
    'He convulsed and lay dying within minutes.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: sucking venom out plus instant recovery (cure); second beat rescued by residual toxin', () => {
  const draft = [
    'INT. RUINED TEMPLE - NIGHT',
    'The antidote went down.',
    'She was instantly fine.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He knelt and sucked the venom out of the wound.',
    'She was instantly back on her feet.',
    'Traces of the poison remained and the doctor warned she could relapse.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].kind, 'cure');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: bare ordinary “dose” no longer rescues onset → 70', () => {
  const draft = [
    'INT. MANOR - NIGHT',
    'She drank the poisoned wine.',
    'She foamed at the mouth, convulsing.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The soup had been poisoned too.',
    'He was comatose, given up for dead.',
    'A dose of ordinary medicine was all anyone gave him.',
  ].join('\n');
  const r = poisonOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});
