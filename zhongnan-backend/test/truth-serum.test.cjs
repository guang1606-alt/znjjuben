'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { truthSerum } = require('../dist/engine/truth-serum.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(truthSerum('').score, 100);
  assert.strictEqual(truthSerum('  \n ').score, 100);
  assert.strictEqual(truthSerum('').hitCount, 0);
});

test('zh: 单次吐真剂秒招豁免不扣分（STRONG 药剂名）', () => {
  const draft = [
    '内景 废弃仓库 夜',
    '△刀疤把一管吐真剂推进郑三胳膊。',
    '△郑三眼皮发沉，意识模糊。',
    '审讯者：人是谁杀的？',
    '郑三：人是周四杀的，账本藏在冷库三号柜。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次吐真剂秒招 → 70，元数据落情报行（STRONG + WEAK 双锚）', () => {
  const draft = [
    '内景 废弃仓库 夜',
    '△刀疤把一管吐真剂推进郑三胳膊。',
    '△郑三眼皮发沉，意识模糊。',
    '郑三：人是周四杀的，账本藏在冷库三号柜。',
    '△墙上的旧挂钟停在三点。',
    '△地上一摊积水泛着冷光。',
    '内景 私人诊所 夜',
    '△一针药剂扎进阿来胳膊，问什么答什么。',
    '△阿来浑身发软。',
    '阿来：内鬼是管家老吴，钱藏在祠堂地砖下。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 10);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('诊所'));
  assert.ok(h.snippet.includes('阿来'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('吐真剂秒招'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('拉锯'));
});

test('zh: STRONG 药剂名（硫喷妥钠）+ 旧案/证据族成立', () => {
  const draft = [
    '内景 安全屋 夜',
    '△针管里是硫喷妥钠，针头扎进福伯的胳膊。',
    '△福伯眼皮发沉，管不住自己的嘴。',
    '福伯：二十年前那桩纵火案也是我干的，录音带锁在银行保险柜。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 注射行为须同行带说实话意图（静脉注射）', () => {
  const draft = [
    '内景 审讯室 夜',
    '△黑影给她静脉注射，为了让她说实话。',
    '△她昏昏沉沉，没法撒谎。',
    '她：接应的人叫马六。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 正常医疗注射放行（退烧针/手术麻醉，无意图语境）', () => {
  const draft = [
    '内景 市立医院 日',
    '△护士给孩子打了一针退烧针。',
    '△孩子安静睡了过去。',
    '妈妈：烧退了就好。',
    '内景 手术室 日',
    '△麻醉师注射了麻药，主治医生宣布手术开始。',
    '△监护仪规律地响着。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 给药但只做情感倾诉（无实质情报）放行', () => {
  const draft = [
    '内景 病房 夜',
    '△一管吐真剂被推进去。',
    '△她神志不清，有问必答。',
    '她：我对不起妈妈，是我不孝，这些年苦了你了。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
});

test('zh: 顺序闸门——先招供后打针不成立', () => {
  const draft = [
    '内景 审讯室 夜',
    '郑三：人是周四杀的，账本藏在冷库。',
    '△刀疤愣了一下，这才把吐真剂扎进去。',
    '△郑三眼皮发沉。',
    '△屋里没人再问话。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
});

test('zh: 跨场景给药与招供不配对', () => {
  const draft = [
    '内景 审讯室甲 夜',
    '△一管吐真剂抽进针管，还没注射。',
    '△走廊灯闪了两下。',
    '△铁门哐当一声关上。',
    '内景 审讯室乙 夜',
    '△他眼皮发沉，问什么答什么。',
    '他：同伙是马六，钱藏在码头。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
});

test('zh: rescue FAKE——抗药/假名/胡乱攀扯，情报不可信', () => {
  const draft = [
    '内景 废弃仓库 夜',
    '△刀疤把一管吐真剂推进郑三胳膊。',
    '△郑三眼皮发沉，意识模糊。',
    '郑三：同伙是周四，账本藏在冷库三号柜。',
    '△旧风扇吱呀转动。',
    '△窗外一道闪电。',
    '△第二管吐真剂推进去。',
    '△他眼皮发沉，声音发飘。',
    '他：凶手是马六。',
    '△他心里冷笑，说的全是假名，胡乱攀扯。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue FRAGMENT——语无伦次没说两句就昏死，情报不可消费', () => {
  const draft = [
    '内景 仓库 夜',
    '△一管吐真剂推进郑三胳膊。',
    '△郑三眼皮发沉，意识模糊。',
    '郑三：同伙是周四，账本藏在冷库。',
    '△旧风扇吱呀转着。',
    '△窗外雷声滚过。',
    '△又一管吐真剂推进去。',
    '△阿来眼皮发沉。',
    '阿来：账本埋在……冷库……三号……',
    '△阿来语无伦次，没说两句就昏了过去。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue COST——黑市药剂/绑架用药/录音反成罪证', () => {
  const draft = [
    '内景 密室 夜',
    '△一管吐真剂推进福伯胳膊。',
    '△福伯神志不清，管不住嘴。',
    '福伯：十年前那桩命案也是我干的。',
    '△烛火晃了晃。',
    '△座钟滴答作响。',
    '△第二针吐真剂扎进去，药剂是黑市抢来的。',
    '△他浑身发软，有问必答。',
    '他：人质关在码头仓库。',
    '△全程被录音，后来成了呈堂证供。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 场景头含药剂名不参与匹配 + 情感倾诉无 payload 放行', () => {
  const draft = [
    '内景 吐真剂实验室 日',
    '△研究员推着仪器走过。',
    '△白板上写满分子式。',
    '研究员：今晚谁订外卖？',
    '内景 病房 夜',
    '△一管吐真剂被推进去。',
    '△她神志不清，有问必答。',
    '她：我对不起妈妈，是我不孝。',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: 2nd truth-serum dump → 70 (truth serum + sodium pentothal, STRONG)', () => {
  const draft = [
    'INT. WAREHOUSE - NIGHT',
    'The thug injected him with a truth serum.',
    'His eyes grew heavy and he couldn\'t lie.',
    'He said: "The killer is Vargas, the ledger is hidden under the boathouse."',
    'Water dripped from the ceiling.',
    'A siren wailed far away.',
    'INT. BACK CLINIC - NIGHT',
    'A second dose of sodium pentothal went into his arm.',
    'He went limp, compelled to answer.',
    'The inside man is Doyle, the cash is buried in the quarry.',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 10);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('CLINIC'));
  assert.ok(h.marker.includes('→'));
  assert.ok(h.marker.includes('pentothal'));
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('truth-serum'));
  assert.strictEqual(r.score, 70);
});

test('en: WEAK injection needs truth-intent context (needle + make him talk)', () => {
  const draft = [
    'INT. INTERROGATION ROOM - NIGHT',
    'The doctor slid the needle into his arm to make him talk.',
    'He grew drowsy; words poured out.',
    '"My accomplice is Renfro."',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: medical shot放行 + reverse order (confession before dosing) no event', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'The nurse gave him a shot of insulin.',
    'He fell asleep quietly.',
    'INT. PRECINCT - NIGHT',
    '"The killer is Hollis," he said.',
    'Only then did they inject him with a truth serum.',
    'His eyes grew heavy.',
    'Nobody asked another question.',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: rescue FAKE — tolerance and false name', () => {
  const draft = [
    'INT. WAREHOUSE - NIGHT',
    'A truth serum dose went into his arm.',
    'His eyes grew heavy.',
    '"The killer is Vargas," he said.',
    'Rain tapped the metal roof.',
    'A dog barked outside.',
    'A fresh syringe of truth serum went in.',
    'His eyes grew heavy again.',
    '"The killer is Hollis," he mumbled.',
    'But he had built up a tolerance and gave them a false name.',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: rescue FRAGMENT + COST across two more events (hitCount 3, both rescued)', () => {
  const draft = [
    'INT. BASEMENT - NIGHT',
    'The first truth serum dose went in.',
    'His eyes grew heavy and he couldn\'t resist.',
    '"The killer is Vargas," he said.',
    'A pipe leaked in the corner.',
    'Footsteps echoed upstairs.',
    'Another vial of pentothal was injected.',
    'His speech slurred and his eyes grew heavy.',
    '"The cash is buried... at the... quarry..."',
    'He passed out mid-sentence, incoherent.',
    'The bare bulb flickered once.',
    'A third truth serum dose went in; the serum was stolen from a robbed lab.',
    'He grew drowsy and answered every question.',
    '"My accomplice is Crane."',
    'The whole session was recorded and the recording became evidence.',
  ].join('\n');
  const r = truthSerum(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 2);
  assert.ok(r.hits.every((h) => h.rescued));
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});
