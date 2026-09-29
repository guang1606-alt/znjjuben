'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { villainOverconfession } = require('../dist/engine/villain-overconfession.js');

/* ============================ 中文：命中 ============================ */

test('zh: 空稿满分', () => {
  const r = villainOverconfession('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 经典不打自招——一句空问换手法+旧案+下一步 → confess hit', () => {
  const draft = [
    '林晚：公司的事，是不是你做的？',
    '沈志国：是我又怎么样？你爸的药是我换的，遗嘱是我伪造的，你妈也是我逼死的。明天董事会一结束，我连你一起送走。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.dialogueLines, 2);
  assert.equal(r.hits.length, 1);
  const h = r.hits[0];
  assert.equal(h.kind, 'confess');
  assert.equal(h.speaker, '沈志国');
  assert.equal(h.probeLine, 1);
  assert.equal(h.line, 2);
  assert.ok(h.families.includes('method'));
  assert.ok(h.families.includes('next'));
  assert.equal(h.rescued, false);
  assert.equal(r.score, 75);
  assert.equal(r.issues.length, 1);
});

test('zh: 免费加料型 freebie——没承认也替编剧补全旧案+同伙+下一步', () => {
  const draft = [
    '林晚：你到底做了什么？',
    '沈志国：你不是一直想知道你妈怎么死的吗？我不妨再告诉你，当年的护士早被我买通了，你弟弟现在就在去码头的路上。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'freebie');
  assert.ok(r.hits[0].families.includes('accomplice'));
  assert.ok(r.hits[0].families.includes('coldcase'));
  assert.ok(r.hits[0].families.includes('next'));
  assert.equal(r.hits[0].rescued, false);
});

test('zh: 旧案+动机族——当年推下楼，为了股份等十年', () => {
  const draft = [
    '林晚：公司的账，是不是你动的？',
    '沈志国：没错，当年是我把你爸推下楼的，为了公司的股份我等了整整十年。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].families.sort(), ['coldcase', 'method', 'motive']);
});

test('zh: 同伙+下一步族——好秘书早就串通，股东大会翻盘', () => {
  const draft = [
    '林晚：你和秘书是什么关系？',
    '沈志国：是我。你那个好秘书早就跟我串通了，明天股东大会，你手里的票一张都不算。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].families.includes('accomplice'));
  assert.ok(r.hits[0].families.includes('next'));
});

test('zh: probe 与招供之间夹 1 行叙述动作仍配对', () => {
  const draft = [
    '林晚：公司的事，是不是你做的？',
    '沈志国冷笑一声，慢慢转过椅子。',
    '沈志国：是我又怎么样？三年前是我把你爸推下楼的，明天董事会后就轮到你了。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 3);
  assert.ok(r.hits[0].families.includes('coldcase'));
});

test('zh: 同场两处不打自招 → 2 hits，score ≤52', () => {
  const draft = [
    '场1 夜 办公室',
    '林晚：药是不是你换的？',
    '沈志国：是我换的，当年你妈的车祸也是我安排的，明天就送你去见她。',
    '林晚：那遗嘱呢，你说啊？',
    '沈志国：我承认，遗嘱是我伪造的，你弟弟跟我联手做的局，今晚你走不出这个门。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 2);
  assert.ok(r.hits.every((h) => !h.rescued));
  assert.ok(r.score <= 52);
  assert.equal(r.issues.length, 2);
});

test('zh: 心声追问也算 probe（任意话者均可被反向自爆）', () => {
  const draft = [
    '苏晴：你为什么要这样对我？',
    '周明：没错，保单是我伪造的，为了那笔赔偿我等了两年，后天葬礼上就收网。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.deepEqual(r.hits[0].families.sort(), ['method', 'motive', 'next']);
});

/* ============================ 英文：命中 ============================ */

test('en: classic over-confession across 3 secret families', () => {
  const draft = [
    'LIN: Did you do this to my father?',
    'SHEN: That\'s right, I switched his pills and forged the will. Three years ago I set the fire, and tomorrow the board hands me everything.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'confess');
  assert.ok(r.hits[0].families.includes('method'));
  assert.ok(r.hits[0].families.includes('coldcase'));
  assert.ok(r.hits[0].families.includes('next'));
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 75);
});

test('en: freebie frame — hitman + husband accomplice + tonight', () => {
  const draft = [
    'LIN: Was it you?',
    'SHEN: Might as well tell you: I paid a hitman, and your own husband helped me. Tonight you disappear.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'freebie');
  assert.ok(r.hits[0].families.includes('method'));
  assert.ok(r.hits[0].families.includes('accomplice'));
  assert.ok(r.hits[0].families.includes('next'));
});

test('en: probe then one narration beat, still pairs', () => {
  const draft = [
    'LIN: Did you kill him?',
    'SHEN smirks and turns from the window.',
    'SHEN: Yes, I did. I poisoned him for the inheritance, and that night I paid the staff to disappear.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 3);
  assert.ok(r.hits[0].families.includes('method'));
  assert.ok(r.hits[0].families.includes('motive'));
});

/* ============================ rescue：证据/交易/圈套/执法 ============================ */

test('zh rescue: 证据已摊在叙述行（银行流水+亲子鉴定），无下一步 → rescued', () => {
  const draft = [
    '桌上摊着银行流水和亲子鉴定报告。',
    '林晚：是不是你？',
    '沈志国：没错，钱是我挪用的，为了补上当年亏空我才出此下策。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.hits[0].rescueLine, 1);
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
});

test('zh rescue: 真探方此前台词已亮明掌握证据 → rescued', () => {
  const draft = [
    '林晚：我已经查到换药记录了，护士也愿意作证。',
    '林晚：是不是你做的？',
    '沈志国：没错，药是我换的，我恨他当年偏心。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('zh: 证据在桌但仍主动交代"下一步" → 不 rescue（照样蠢）', () => {
  const draft = [
    '她把录音笔拍在桌上。',
    '林晚：药是不是你换的？',
    '沈志国：没错，药是我换的，不过你听不到明天董事会了，轮到你了。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, false);
  assert.ok(r.hits[0].families.includes('next'));
});

test('zh rescue: 附交换条件（你先放了我女儿）→ rescued', () => {
  const draft = [
    '林晚：是不是你做的？',
    '沈志国：我可以告诉你，但你先放了我女儿。钱是我挪用的，三年前的火也是我放的。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('zh rescue: 叙述明示诈供套话、录音在身 → rescued', () => {
  const draft = [
    '林晚按住口袋里的录音笔，故意诈他，引他说出实情。',
    '林晚：公司的事是不是你干的？',
    '沈志国：是我干的，账是我做的，当年的火也是我放的。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('zh rescue: 警官在场审讯语境 → rescued', () => {
  const draft = [
    '审讯室里，警官坐在桌对面做笔录。',
    '林警官：人是不是你撞的？',
    '沈志国：是我撞的，刹车是我提前动的手脚，就为了那笔保险金。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: DNA report already on the table → rescued', () => {
  const draft = [
    'She slides the DNA report across the table.',
    'LIN: Did you kill him?',
    'SHEN: Yes, I did. I poisoned him for the inheritance, I couldn\'t stand him anymore.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: negotiated confession (promise first) → rescued', () => {
  const draft = [
    'LIN: Tell me the truth, was it you?',
    'SHEN: Fine. If I tell you, you have to promise me safe passage. I embezzled the funds and forged the signatures years ago.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

test('en rescue: detective + recorded bluff context → rescued', () => {
  const draft = [
    'At the station, the detective was fishing for a confession.',
    'DET: Did you do this?',
    'SHEN: Fine, I did it, I staged the accident and your own secretary helped me.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
});

/* ============================ 反例：不应命中 ============================ */

test('zh 反例: 反派抵赖倒打一耙 → no hit', () => {
  const draft = [
    '林晚：公司的事是不是你做的？',
    '沈志国：你凭什么质问我？就凭你那个死鬼爸托梦？我看你是伤心过度疯了。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh 反例: 只认一族（光承认手法，长度够也不凑族）→ no hit', () => {
  const draft = [
    '林晚：药是不是你动的？',
    '沈志国：没错，你爸每天晚上吃的那些药都是我换的，那又怎么样，你有证据吗？',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('zh 反例: 超短承认"是我。"不达长度门槛 → no hit', () => {
  const draft = [
    '林晚：是不是你？',
    '沈志国：是我。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('zh 反例: probe 过长且自带具体事实（主角已拼出真相）→ no hit', () => {
  const draft = [
    '林晚：三月七号晚上你去过仁和医院，监控都拍到了，换药的人就是你，是不是？',
    '沈志国：……是我。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('zh 反例: probe 后接同一话者心声（没人接招）→ no hit', () => {
  const draft = [
    '林晚：公司的事，是不是你做的？',
    '林晚（心声）：他一定不会承认，我还得再找证据。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('zh 反例: 招供发生在下一场（场景边界断开）→ no hit', () => {
  const draft = [
    '场1 夜 办公室',
    '林晚：是不是你做的？',
    '场2 日 看守所',
    '沈志国：是我又怎么样，遗嘱是我伪造的，明天我连你一起告。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('zh 反例: 纯叙述罪行段落（没有对白就没有不打自招）→ no hit', () => {
  const draft = '三年前的雨夜，他调换了病房里的药，又买通护工伪造了签字。\n这笔账，他以为没人会查到。';
  const r = villainOverconfession(draft);
  assert.equal(r.dialogueLines, 0);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh 反例: 反派间正常短对答（无空问无招供框架）→ no hit', () => {
  const draft = [
    '阿坤：老板，明天按计划办？',
    '沈志国：嗯。东西都收干净，别留尾巴。',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});

test('en 反例: flat denial → no hit', () => {
  const draft = [
    'LIN: Was it you?',
    'SHEN: Prove it. I have nothing to say to you.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('en 反例: single-family admission under threshold → no hit', () => {
  const draft = [
    'LIN: Did you do this?',
    'SHEN: I did it, I forged the will, and there is nothing else you will ever get from me.',
  ].join('\n');
  const r = villainOverconfession(draft);
  assert.equal(r.hits.length, 0);
});
