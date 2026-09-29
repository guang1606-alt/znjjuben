'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { allergyOnCue } = require('../dist/engine/allergy-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(allergyOnCue('').score, 100);
  assert.strictEqual(allergyOnCue('  \n ').score, 100);
  assert.strictEqual(allergyOnCue('').hitCount, 0);
});

test('zh: 单次接触秒发作（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 宴会厅 夜',
    '△她夹了一只虾放进嘴里。',
    '△几口下去，她喉头水肿，喘不上气，当场倒下。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次接触秒发作未救 → 70，元数据落发作行', () => {
  const draft = [
    '内景 林家 夜',
    '△她夹了一只虾放进嘴里。',
    '△几口下去喉头水肿，喘不上气，当场倒下。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他叉起一块芒果送入口中。',
    '△气管瞬间堵死，人送急诊抢救。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('气管'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'attack');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('一口进急诊'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('过敏史'));
});

test('zh: attack 被 KNOWN 既往史/随身急救针救回', () => {
  const draft = [
    '内景 医院 日',
    '△她夹了一只虾放进嘴里。',
    '△喉头水肿，喘不上气，当场倒下。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他从小就对芒果过敏，随身带着急救针。',
    '△他还是尝了一口芒果。',
    '△喉头立刻发紧，呼吸困难。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: attack 被 APROCESS 留观吸氧激素输液救回', () => {
  const draft = [
    '内景 宴会厅 夜',
    '△她夹了一只虾放进嘴里。',
    '△喉头水肿，喘不上气，当场倒下。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△第二回，他吃了口菠萝。',
    '△脸肿成青紫，人直接送急诊。',
    '△在急诊留观了六小时，吸氧、激素输液，半夜才走。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'attack');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: attack 被 APRICE ICU/气管切开/差点死救回', () => {
  const draft = [
    '内景 寿宴 夜',
    '△她尝了一口芒果。',
    '△嘴唇发紫，当场倒下送急诊。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她误食了一粒花生。',
    '△过敏性休克，人当场没了呼吸，送进ICU抢救。',
    '△医生说再晚来一步就没救过来，气管都切开了。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "打了一针就好"不救 attack → 70', () => {
  const draft = [
    '内景 婚宴 夜',
    '△她夹了一只虾放进嘴里。',
    '△喉头水肿，喘不上气，当场倒下。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△他吃了一口螃蟹，嘴唇发紫，护士赶来给他打了一针。',
    '△他缓过来一点，但这顿婚宴还没完。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'attack');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: WEAK 轻症无过敏语境——普通咳嗽放行', () => {
  const draft = [
    '内景 客厅 日',
    '△她摸了一下猫。',
    '△她开始咳嗽，打了个喷嚏。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 轻症 + 过敏哮喘语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 客厅 日',
    '△她摸了一下猫。',
    '△她开始咳嗽打喷嚏，她对猫毛过敏，哮喘都要犯了。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯皮疹无接触锚放行', () => {
  const draft = [
    '内景 家中 日',
    '△他手臂起了一片红疹。',
    '△他挠了挠，没当回事。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯吃海鲜无发作锚放行（普通家宴）', () => {
  const draft = [
    '内景 家中 夜',
    '△大家围着桌子吃螃蟹。',
    '△他喝了口酒，笑了笑。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次一针秒解除（型B）豁免不扣分', () => {
  const draft = [
    '内景 医院 日',
    '△护士赶来打了一针抗过敏药。',
    '△他马上就没事了，跟没事人一样。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次一针秒解除未救 → 70，kind=relief', () => {
  const draft = [
    '内景 医院 日',
    '△护士赶来打了一针抗过敏药。',
    '△他马上就没事了，跟没事人一样。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△医生又给打了一针激素。',
    '△他瞬间恢复，活蹦乱跳。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'relief');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('一针秒解除'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('随访'));
});

test('zh: relief 被 RPROCESS 留观一夜/激素吃几天救回', () => {
  const draft = [
    '内景 急诊 夜',
    '△护士赶来打了一针抗过敏药。',
    '△他一会儿就好了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△护士又给打了一针肾上腺素。',
    '△他一会儿就好了，但要留观一夜，激素还得吃几天。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'relief');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: relief 被 PARTIAL 随身带针/终身忌口救回', () => {
  const draft = [
    '内景 医院 日',
    '△护士赶来打了一针过敏药。',
    '△他马上就没事了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△又打了一针过敏药。',
    '△他马上恢复了，从此随身携带急救针，终身忌口，再也不敢碰海鲜。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: relief 被 COST 寿宴搞砸/合作黄了救回', () => {
  const draft = [
    '内景 医院 夜',
    '△护士赶来打了一针抗过敏药。',
    '△他马上就没事了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△一针过敏药下去。',
    '△她立刻没事了，可整场寿宴彻底搞砸，合作也黄了。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 无触发物的缓慢好转放行（合法恢复）', () => {
  const draft = [
    '内景 家中 日',
    '△过了两天，他的疹子慢慢消了。',
    '△她终于放下心来。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——误食在一场发作在下一场放行', () => {
  const draft = [
    '内景 宴会厅 夜',
    '△她吃了一口花生。',
    '内景 医院 夜',
    '△喉头肿得说不出话。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻接触锚行合并为同一事件', () => {
  const draft = [
    '内景 寿宴 夜',
    '△她尝了一口芒果。',
    '△又吃了几粒花生。',
    '△当场过敏性休克，送急诊抢救。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 被蜂蛰后轻症无过敏语境放行（普通蛰伤）', () => {
  const draft = [
    '外景 山坡 日',
    '△他被蜜蜂蛰了一下。',
    '△起了个红包，有点痒。',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: single instant attack (STRONG) exempt', () => {
  const draft = [
    'INT. BANQUET HALL - NIGHT',
    'She took a bite of the shrimp.',
    "Her throat started closing up and she couldn't breathe.",
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued attack → 70, kind=attack', () => {
  const draft = [
    'INT. LIN HOME - NIGHT',
    'She took a bite of the shrimp.',
    "Her throat started closing up and she couldn't breathe.",
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He ate one peanut by mistake.',
    'His throat swelled and he collapsed.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'attack');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: attack rescued by KNOWN EpiPen/known allergy history', () => {
  const draft = [
    'INT. BANQUET HALL - NIGHT',
    'She tasted the mango.',
    'Her airway began to close and she was rushed to the ER.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'He always carried an EpiPen, he knew about the peanut allergy.',
    'Still, he ate a peanut by mistake.',
    'His throat swelled and he collapsed.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: attack rescued by APROCESS kept overnight on oxygen and steroids', () => {
  const draft = [
    'INT. RESTAURANT - NIGHT',
    'She took a bite of the shrimp.',
    "Her throat started closing and she couldn't breathe.",
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'At dinner he ate a spoonful of peanut sauce.',
    'His throat swelled; she was kept overnight on oxygen and IV steroids.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'attack');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('en: WEAK reaction without allergy context → pass', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'She petted the cat.',
    'She started sneezing and coughing.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK reaction + allergy/asthma context → event, exempt', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'She petted the cat.',
    'She started wheezing; her cat allergy always triggered her asthma.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single one-shot instant relief exempt', () => {
  const draft = [
    'INT. WARD - DAY',
    'The nurse gave him a shot of epinephrine.',
    'He was fine immediately, as if nothing had happened.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('en: second instant relief unrescued → 70, kind=relief', () => {
  const draft = [
    'INT. WARD - DAY',
    'The nurse gave him a shot of epinephrine.',
    'He was fine immediately, as if nothing had happened.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The doctor gave her another injection.',
    'She was fine in minutes, good as new.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'relief');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: second relief rescued by PARTIAL EpiPen tail + avoidance', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The nurse gave a shot of epinephrine.',
    'He was fine right away.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'She got another allergy shot at the clinic.',
    'She recovered instantly but still carries an EpiPen and avoids seafood for life.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'relief');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: slow recovery without trigger → pass', () => {
  const draft = [
    'INT. HOME - DAY',
    'The rash faded slowly over the next two days.',
    'She breathed easier at last.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: cross-scene exposure and reaction do not pair', () => {
  const draft = [
    'INT. BANQUET HALL - NIGHT',
    'She ate a shrimp.',
    'INT. HOSPITAL - NIGHT',
    'Her throat closed up.',
  ].join('\n');
  const r = allergyOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});
