'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cheapForgiveness } = require('../dist/engine/cheap-forgiveness.js');

/* ============================ 中文：命中 ============================ */

test('zh: 空稿满分', () => {
  const r = cheapForgiveness('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 人命级重伤+借口道歉+哭着认爸 → grave hit（excuse+instant）', () => {
  const draft = [
    '沈知夏：当年是你害死我妈的！',
    '沈建国（跪下）：爸一时糊涂，你就原谅爸吧。',
    '沈知夏（哭着点头）：……爸，我们回家。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  const h = r.hits[0];
  assert.equal(h.severity, 'grave');
  assert.equal(h.kind, 'accept');
  assert.equal(h.harmLine, 1);
  assert.ok(h.boosters.includes('excuse'));
  assert.ok(h.boosters.includes('instant'));
  assert.equal(h.rescued, false);
  assert.equal(r.score, 45); // 100-45-10
  assert.equal(r.issues.length, 1);
});

test('zh: 陷害冤狱+明示原谅，无任何代价 → grave hit', () => {
  const draft = [
    '林晚：是你伪造证据，害我坐了三年牢。',
    '张远山：知夏，事情都过去了。',
    '林晚：算了，我原谅你了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
  assert.equal(r.hits[0].kind, 'grant');
  assert.equal(r.hits[0].rescued, false);
});

test('zh: 出轨卷款+借口式道歉+"算了都过去了" → heavy hit（excuse+instant）', () => {
  const draft = [
    '苏蔓：你出轨，还卷走公司所有的钱，毁了我三年。',
    '周凯：对不起嘛，我也是没办法，一时糊涂。',
    '苏蔓：算了，都过去了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  const h = r.hits[0];
  assert.equal(h.severity, 'heavy');
  assert.ok(h.boosters.includes('excuse'));
  assert.ok(h.boosters.includes('instant'));
  assert.equal(r.score, 55); // 100-35-10
});

test('zh: 抛弃母女二十年+旁人按头+扑抱认爸 → coerce hit（pressure）', () => {
  const draft = [
    '沈知夏：当年你抛弃我和妈妈，二十年没回过一次家。',
    '姑姑：他毕竟是你爸，血浓于水啊。',
    '沈知夏沉默良久，扑进他怀里，喊了一声：爸。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'coerce');
  assert.ok(r.hits[0].boosters.includes('pressure'));
  assert.equal(r.hits[0].line, 3);
});

test('zh: 叙述行立伤+台词赦免照样命中', () => {
  const draft = [
    '△三年前，陈董夺走公司，把林晚赶出公司，让她一无所有。',
    '陈董：晚晚，以前的事……',
    '林晚（握住他的手，点了点头）：都过去了，我不怪你。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'heavy');
});

test('zh: 重伤在前面场次，本集后文廉价赦免照样命中', () => {
  const draft = [
    '第1场',
    '林晚：你害死了我爸！',
    '沈志国冷笑，摔门而去。',
    '第12场',
    '林晚（端来一杯茶）：爸，以前的事翻篇吧。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 5);
});

test('zh: 替人顶罪黑锅+"翻篇"无代价 → grave hit', () => {
  const draft = [
    '老赵：当年是我让你替我顶罪，你替我背了黑锅。',
    '小钱：这一页翻过去吧，我不计较了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
});

test('zh: 借口+按头双加压 → grave 45+20，score 35', () => {
  const draft = [
    '沈知夏：你害死我妈。',
    '沈建国：爸一时糊涂，鬼迷心窍了。',
    '姑姑：他都跪下了你还要怎样，得饶人处且饶人。',
    '沈知夏（哭着点头，抱住他）：……爸，回家吧。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  const h = r.hits[0];
  assert.equal(h.severity, 'grave');
  assert.ok(h.boosters.includes('excuse'));
  assert.ok(h.boosters.includes('pressure'));
  assert.equal(r.score, 35);
});

test('zh: 两处廉价和解分别计入', () => {
  const draft = [
    '林晚：你害死我爸。',
    '沈志国：爸一时糊涂。',
    '林晚：我原谅你了。',
    '苏蔓：你卷走了家里全部的钱。',
    '周凯：我也是没办法。',
    '苏蔓：算了，都过去了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 20); // floor
});

/* ============================ 中文：豁免（合法兑付） ============================ */

test('zh rescue: 加害者自首+警察戴手铐 → 实际代价豁免', () => {
  const draft = [
    '沈知夏：当年是你害死我妈的！',
    '沈建国：是我害死你妈的，我已经让人报警了。',
    '两名警察走进来，给他戴上手铐，带走了。',
    '沈知夏：我等着法律判你。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh rescue: grave 仅靠具体道歉无代价 → 仍判 hit（人命不能一句 sorry 兑付）', () => {
  const draft = [
    '沈知夏：你害死我妈。',
    '沈建国：对不起，是我害死你妈的，爸对不起你。',
    '沈知夏（抱住他）：爸，都过去了，我原谅你。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
});

test('zh rescue: 多年后+具体道歉再原谅 → 时间+认罪豁免', () => {
  const draft = [
    '三年后。',
    '沈建国：知夏，这三年我天天在你妈墓前守着。是我害死你妈的，对不起。',
    '沈知夏：都过去了，我放下了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh rescue: 自我解放式放下（不是给加害者免单）→ 豁免', () => {
  const draft = [
    '沈知夏：当年你害死我妈，让我坐了三年牢。',
    '沈建国：知夏……',
    '沈知夏：我不是原谅你，我是放过我自己。以后别再来了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('zh rescue: heavy 具体、不找借口的道歉 → 可独立和解', () => {
  const draft = [
    '林晚：是你伪造证据，害我被公司开除、身败名裂。',
    '陈明：对不起，是我伪造了那份邮件陷害你，让你丢了工作。我没有任何借口。',
    '林晚（叹气）：……我原谅你这一次。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('zh rescue: 借口式道歉阻断"具体道歉"豁免', () => {
  const draft = [
    '林晚：是你伪造证据害我被开除的。',
    '陈明：对不起，是我伪造了证据，可我当时一时糊涂，为了这个家。',
    '林晚：算了，都过去了。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'heavy');
  assert.ok(r.hits[0].boosters.includes('excuse'));
});

test('zh rescue: 先拒绝、间隔足够、之后实际兑付 → earned 豁免', () => {
  const draft = [
    '林晚：你害死我妈，我绝不原谅你，你走！',
    '陈明站在门外，她摔上了门。',
    '△接下来的日子，他一次次来，一次次被拒之门外。',
    '△他把公司的流水一笔笔查清，寄到她家门口。',
    '△他去墓前长跪不起。',
    '△她始终没有见他。',
    '△他搬空了自己的办公室。',
    '△他把老宅的钥匙放在物业。',
    '△冬天过去了。',
    '陈明：我已经把公司全部资产转回你名下，股权转让书我签了。我今天就去自首。',
    '林晚（看着文件，很久）：……起来吧，这一页翻过去。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('zh rescue: 净身出户+放弃继承 → 财产代价豁免', () => {
  const draft = [
    '苏蔓：你出轨，还吞了家产。',
    '周凯：离婚协议我签了，我净身出户，房子存款都给你。',
    '苏蔓：我不追究了，好聚好散。',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

/* ============================ 英文：命中 ============================ */

test('en: empty draft scores 100', () => {
  const r = cheapForgiveness('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('en: grave harm + excuse + tearful hug → hit', () => {
  const draft = [
    'LINA: You killed my mother and let me rot behind bars for three years.',
    'DAD: I was weak, baby. Forgive me.',
    'LINA nodded through tears and hugged him: Come home, Dad.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
  assert.equal(r.hits[0].kind, 'accept');
  assert.ok(r.hits[0].boosters.includes('excuse'));
  assert.ok(r.hits[0].boosters.includes('instant'));
});

test('en: affair + embezzlement + "water under the bridge" + I had my reasons → heavy hit', () => {
  const draft = [
    'LINA: You cheated on Mom and embezzled the family money.',
    'DAD: Come on, I had my reasons, I was weak.',
    'LINA: Water under the bridge. I forgive you.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'heavy');
  assert.ok(r.hits[0].boosters.includes('excuse'));
});

test('en: abandonment + family coercion + hug → coerce hit', () => {
  const draft = [
    'LINA: You abandoned me and walked out when I was five.',
    'AUNT: He is still your father. Blood is thicker than water.',
    'LINA threw herself into his arms, sobbing: Dad.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'coerce');
  assert.ok(r.hits[0].boosters.includes('pressure'));
});

test('en: framed and wrongfully imprisoned + instant I forgive you → grave hit', () => {
  const draft = [
    'LINA: You framed me. I was wrongfully imprisoned for two years because of you.',
    'DAD: I am sorry, kiddo.',
    'LINA: I forgive you, Dad.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
});

/* ============================ 英文：豁免 ============================ */

test('en rescue: turned himself in + police present → consequence', () => {
  const draft = [
    'LINA: You killed my mother.',
    'DAD: It was me. I already turned myself in.',
    'The police came and handcuffed him in front of her.',
    'LINA: I forgive you — for myself.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('en rescue: grave + specific apology only, no payment → still hit', () => {
  const draft = [
    'LINA: You killed my mother.',
    'DAD: I am sorry. I killed her, and I apologize.',
    'LINA hugged him: It is all in the past. I forgive you.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].severity, 'grave');
});

test('en rescue: years later + named deed apology → time + apology', () => {
  const draft = [
    'Three years later.',
    'DAD: Lina, I come to her grave every week. I am sorry I framed you and forged the evidence.',
    'LINA: I have let it go.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('en rescue: self-liberation wording → rescued', () => {
  const draft = [
    'LINA: You killed my mother and ruined my life.',
    'DAD: Please…',
    'LINA: I am not forgiving you. I am letting go for me, not for you.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('en rescue: heavy harm + excuse-free specific apology → rescued', () => {
  const draft = [
    'LINA: You embezzled the funds and destroyed my reputation at the company.',
    'DAD: I am sorry. I embezzled the funds and made it look like your doing. There is no excuse.',
    'LINA: I forgive you this once.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

test('en rescue: signed away everything + restitution → rescued', () => {
  const draft = [
    'LINA: You took everything after Dad died.',
    'DAD: I signed away the inheritance and gave the company back to you.',
    'LINA: We are good now.',
  ].join('\n');
  const r = cheapForgiveness(draft);
  assert.equal(r.hits.length, 0);
});

/* ============================ 反例（防误伤） ============================ */

test('neg: 日常客气"对不起/没关系"无重伤 → 0', () => {
  const draft = [
    '前台：对不起，让您久等了。',
    '林晚：没关系。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 误会澄清"我错怪你了"不是赦免 → 0', () => {
  const draft = [
    '林晚：是我错怪你了，这案子你没做手脚。',
    '老张：没事，查清楚就好。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 旁人施压但受害者走开（无身体回归）→ 0', () => {
  const draft = [
    '沈知夏：当年你害死我妈。',
    '姑姑：他毕竟是你爸，你就认了吧。',
    '沈知夏：我没你说的这个爸。你走。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 有重伤但绝不原谅、摔门 → 0', () => {
  const draft = [
    '林晚：是你害死我妈的！',
    '沈志国：知夏……',
    '林晚：我不可能原谅你，滚出去！',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 有重伤无和解（复仇收场）→ 0', () => {
  const draft = [
    '林晚：是你害死我妈的。',
    '沈志国：你想怎么样？',
    '林晚：我已经报警了。',
    '△警察冲进门，将他按倒戴上手铐。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 日常拥抱（无道歉/施压前引）不算和解 → 0', () => {
  const draft = [
    '△林晚出差三周回家。',
    '林晚：妈，我回来了。',
    '△母亲笑着抱住她，接过行李箱。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg: 普通吵架拌嘴的"算了"不接赦免句式 → 0', () => {
  const draft = [
    '同事：这份报表是不是你害我被经理骂的？',
    '林晚：算了，走吧，吃饭去。',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg en: workplace politeness without harm → 0', () => {
  const draft = [
    'CLERK: I am sorry for the wait.',
    'LINA: It is fine, no worries.',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg en: coercion spoken but she walks away → 0', () => {
  const draft = [
    'LINA: You killed my mother.',
    'AUNT: He is family. Find it in your heart to forgive.',
    'LINA: Get out of my house. I never want to see him again.',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});

test('neg en: refusal only, no later forgiveness → 0', () => {
  const draft = [
    'LINA: You killed my mother. I will never forgive you.',
    'DAD: Please, listen…',
    'LINA slammed the door and called the police.',
  ].join('\n');
  assert.equal(cheapForgiveness(draft).hits.length, 0);
});
