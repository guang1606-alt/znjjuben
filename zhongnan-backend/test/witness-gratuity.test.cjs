'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { witnessGratuity } = require('../dist/engine/witness-gratuity.js');

/* ============================ 中文：命中 ============================ */

test('zh: 空稿满分', () => {
  const r = witnessGratuity('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 一句空问换五族套餐 → 1 hit，bundle+emptyAsk，66 分', () => {
  const draft = [
    '林晚：福伯，当年我妈是怎么走的？',
    '福伯：是你继父换了太太的药！换药记录锁在他书房保险柜里，密码是你生日，他明晚还要去码头把护工灭口，当年是他买通的人。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.dialogueLines, 2);
  assert.equal(r.hits.length, 1);
  const h = r.hits[0];
  assert.equal(h.line, 2);
  assert.equal(h.speaker, '福伯');
  assert.ok(h.families.includes('deed'));
  assert.ok(h.families.includes('evidence'));
  assert.ok(h.families.includes('next'));
  assert.ok(h.families.includes('accomplice'));
  assert.ok(h.boosters.includes('bundle'));
  assert.ok(h.boosters.includes('emptyAsk'));
  assert.equal(h.prompted, true);
  assert.equal(h.rescued, false);
  assert.equal(r.score, 66);
  assert.equal(r.issues.length, 1);
});

test('zh: 无人发问主动倾倒（volunteer）→ bundle+volunteer，62 分', () => {
  const draft = [
    '△福伯把鸡汤放在桌上，站在原地没走。',
    '福伯：小姐，有句话我憋了十年，是你继父害死你妈的，那本账本就藏在别墅地下室，他明晚还要派人去烧掉。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].boosters.includes('bundle'));
  assert.ok(r.hits[0].boosters.includes('volunteer'));
  assert.equal(r.hits[0].prompted, false);
  assert.equal(r.score, 62);
});

test('zh: 两族小型白给（罪行+证据）无加压 → 72 分', () => {
  const draft = [
    '林晚：福伯，你知道什么？',
    '福伯：是他换的药，那本换药记录就锁在他书房保险柜里。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].families.sort(), ['deed', 'evidence']);
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 72);
});

test('zh: 同一证人连续两句合并为一个 turn', () => {
  const draft = [
    '林晚：告诉我当年的事。',
    '福伯：是他换的药。',
    '福伯：账本在地下室，明晚他要去码头灭口护工。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 2);
  assert.equal(r.hits[0].endLine, 3);
  assert.ok(r.hits[0].families.length >= 3);
});

test('zh: 两名证人各自白给 → 2 hits 分别计入', () => {
  const draft = [
    '林晚：当年怎么回事？',
    '张妈：是他换的药，药瓶在他保险柜。',
    '林晚：那你呢？',
    '老周：是他放的火，监控备份在我手里。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[0].speaker, '张妈');
  assert.equal(r.hits[1].speaker, '老周');
  assert.equal(r.score, 44);
});

test('zh: 三处白给触底 20 分', () => {
  const draft = [
    '林晚：怎么回事？',
    '张妈：是他换的药，药瓶在保险柜。',
    '林晚：你知道什么？',
    '老周：是他放的火，监控在地下室。',
    '林晚：还有呢？',
    '护士：是他拔的氧气管，记录在护士站抽屉。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 3);
  assert.equal(r.score, 20);
});

/* ============================ 中文：豁免 ============================ */

test('zh rescue: 证人给动机（他也害过我女儿+旧债）→ 豁免', () => {
  const draft = [
    '林晚：福伯，你告诉我实话。',
    '福伯：他当年也害死了我女儿，我欠你妈一条命——是他换的药，账本在他保险柜里。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.ok(r.hits[0].rescueLine);
  assert.equal(r.score, 100);
});

test('zh rescue: 主角先拍钱逼问开价 → extract 豁免', () => {
  const draft = [
    '△林晚掏出一沓钱拍在桌上，一把揪住他的衣领。',
    '林晚：开个价，你要多少钱才肯说？',
    '福伯：是他换的药，账本在保险柜，明晚他去码头。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh rescue: 先给安全承诺再开口 → promise 豁免', () => {
  const draft = [
    '林晚：你说，我保证不说出去，没人知道是你说的。',
    '福伯：是他换的药，录音在保险柜里。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('zh rescue: 检察官庭上职务陈述 → duty 豁免', () => {
  const draft = [
    '法庭上，庭审正在进行。',
    '检察官：根据卷宗，被告换了死者的药物，监控录像已列入证物。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('zh rescue: 说完即被报复失踪 → riskAfter 豁免', () => {
  const draft = [
    '林晚：当年怎么回事？',
    '福伯：是他换的药，账本在地下室。',
    '△第二天，福伯被发现神秘失踪，家中一片狼藉。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh rescue: 迟疑害怕+只挤一条（2 族）→ 冒险漏口豁免', () => {
  const draft = [
    '林晚：福伯？',
    '福伯（压低声音，四下看了看）：是他换的药……我只能说这么多了。',
  ].join('\n');
  const r = witnessGratuity(draft);
  // 仅 1 族不构成套餐时无 hit；这里补证据族测 2 族豁免
  const draft2 = [
    '林晚：福伯？',
    '福伯（压低声音，四下看了看）：是他换的药……记录在他保险柜……我只能说这么多了。',
  ].join('\n');
  const r2 = witnessGratuity(draft2);
  assert.equal(r2.hits.length, 1);
  assert.equal(r2.hits[0].rescued, true);
  assert.ok(r.score === 100);
});

test('zh rescue: 光有迟疑但五样货照端 → 不豁免', () => {
  const draft = [
    '林晚：福伯你告诉我。',
    '福伯（压低声音，四下看了看）：是他换的药，账本在保险柜，密码是你生日，明晚他去码头灭口，护工是他买通的。',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, false);
  assert.ok(r.hits[0].boosters.includes('bundle'));
});

/* ============================ 中文：反例 ============================ */

test('neg zh: 第一人称认罪归块67，本引擎不收', () => {
  const draft = [
    '林晚：当年到底怎么回事？',
    '沈志国：是我换的药，我买通了护工，明晚我还要去码头。',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg zh: 日常寒暄无情报 → 0', () => {
  const draft = [
    '林晚：福伯，今晚吃什么？',
    '福伯：厨房炖了汤，先生今晚不回来吃饭，你自己趁热喝。',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg zh: 只有罪行一族，没有证据/套餐 → 0', () => {
  const draft = [
    '林晚：你知道什么？',
    '福伯：是他换的药！',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg zh: 只有时间地点+见面，无罪行无证据 → 0', () => {
  const draft = [
    '林晚：他什么时候见我？',
    '助理：他明晚八点在码头仓库等你，要带你去见客户。',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg zh: 叙述行撞听归 eavesdrop-dump，本引擎只扫台词 → 0', () => {
  const draft = [
    '△她走到书房门口，听见里面压低声音：是他换的药，账本在保险柜。',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg zh: 知情者只给当下一条，自己留着后续 → 0（只 1 族）', () => {
  const draft = [
    '林晚：我妈到底怎么死的？',
    '福伯（沉默良久，红了眼）：药……是被人换过的。别的我不能再说。',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

/* ============================ 英文：命中 ============================ */

test('en: empty draft scores 100', () => {
  const r = witnessGratuity('');
  assert.equal(r.score, 100);
});

test('en: one empty question buys the full bundle → 66', () => {
  const draft = [
    'LINA: Alfred, what really happened that night?',
    'ALFRED: Your stepfather switched her pills. The medical record is locked in his safe, the code is your birthday, tomorrow night he goes to the docks to silence the nurse, and he paid her off back then.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].speaker, 'ALFRED');
  assert.ok(r.hits[0].families.includes('deed'));
  assert.ok(r.hits[0].families.includes('evidence'));
  assert.ok(r.hits[0].families.includes('next'));
  assert.ok(r.hits[0].families.includes('accomplice'));
  assert.ok(r.hits[0].boosters.includes('bundle'));
  assert.ok(r.hits[0].boosters.includes('emptyAsk'));
  assert.equal(r.score, 66);
});

test('en: volunteer bundle with no ask at all → 62', () => {
  const draft = [
    'ALFRED: Miss Lina, he killed your mother. The ledger is hidden in the basement, and tomorrow he will silence the nurse.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].boosters.includes('volunteer'));
  assert.equal(r.score, 62);
});

/* ============================ 英文：豁免 ============================ */

test('en rescue: motive — he killed my own daughter too', () => {
  const draft = [
    'LINA: Tell me.',
    'ALFRED: He killed my own daughter too. He switched her pills, and the recording is in his safe.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: extraction — money slammed and name your price', () => {
  const draft = [
    'LINA cornered him and shoved the money across the table.',
    'LINA: Name your price. Talk, or I hand this photo to the police myself.',
    'ALFRED: He switched the pills, the ledger is in the safe, tomorrow he hits the docks.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: promise of protection', () => {
  const draft = [
    'LINA: Your name stays out of this. I will protect you. Tell me.',
    'ALFRED: He switched the pills, and the recording is in his safe.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: detective official statement', () => {
  const draft = [
    'DETECTIVE: The file says he switched the pills, and the surveillance footage is in evidence.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: witness found dead the next day', () => {
  const draft = [
    'LINA: What happened?',
    'ALFRED: He switched the pills. The ledger is in the basement.',
    'The next morning Alfred was found dead in the river, silenced for talking.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: fearful grudged single fact', () => {
  const draft = [
    'LINA: Alfred?',
    'ALFRED (lowered his voice, glanced around): He switched the pills… the record is in his safe… I should not say more.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: reluctant but full bundle still charged', () => {
  const draft = [
    'LINA: Tell me, Alfred.',
    'ALFRED (hesitated, then leaned in): He switched the pills, the record is in his safe, the code is your birthday, tomorrow night he will silence the nurse, he paid her off.',
  ].join('\n');
  const r = witnessGratuity(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, false);
});

/* ============================ 英文：反例 ============================ */

test('neg en: first-person confession excluded', () => {
  const draft = [
    'LINA: What happened?',
    'VICTOR: I killed her. I switched the pills and paid off the nurse.',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg en: ordinary household chat', () => {
  const draft = [
    'LINA: What is for dinner?',
    'ALFRED: Soup is on the stove, and sir will not be home tonight.',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg en: one intel family only', () => {
  const draft = [
    'LINA: What do you know?',
    'ALFRED: He switched the pills, miss. That is all I can say.',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});

test('neg en: schedule without crime or evidence', () => {
  const draft = [
    'LINA: When is he seeing me?',
    'ASSISTANT: He will meet you tomorrow at the docks to go over the client dinner.',
  ].join('\n');
  assert.equal(witnessGratuity(draft).hits.length, 0);
});
