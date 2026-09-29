'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cheapEmpathy } = require('../dist/engine/cheap-empathy.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(cheapEmpathy('').score, 100);
});

test('zh: 连发咨询师话术无救援 → 封底 20', () => {
  const draft = '场1：夜·客厅\n林晚：我妈走那年我才八岁。\n沈志国：我理解你的感受，这些年你一定很不容易。\n林晚：嗯。\n沈志国：想哭就哭，我会一直陪着你。\n林晚：谢谢。\n沈志国：你已经做得很好了。';
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 5);
  assert.equal(r.score, 20);
  assert.ok(r.issues.length > 0 && r.advice.length > 0);
});

test('rescue zh: 笨拙行动安抚（沉默+推纸巾+倒热水）→ 豁免', () => {
  const draft = '场1：夜\n林晚：我妈走那年我才八岁。\n△沈志国沉默了半天，把桌上的纸巾推过去，又倒了杯热水。\n沈志国：我理解你的感受。';
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 0);
  assert.equal(r.hits[0].rescued, true);
});

test('rescue zh: 安慰者自我暴露旧伤 → 豁免', () => {
  const draft = '场1：夜\n林晚：我妈走那年我才八岁。\n沈志国：我懂你。我爸走的那年，我一个人在老房子里坐了三天。';
  const r = cheapEmpathy(draft);
  assert.equal(r.score, 100);
});

test('exempt zh: 心理医生/大夫的职业共情 → professional', () => {
  const draft = '场1：日·诊室\n医生：我理解你的感受，你一定很难受，想哭就哭。\n林晚：医生，我还能好吗？\n医生：你有权难过。';
  const r = cheapEmpathy(draft);
  assert.ok(r.hits.length >= 3);
  assert.ok(r.hits.every((h) => h.professional === true));
  assert.equal(r.unrescuedCount, 0);
});

test('zh: 单次共情不判（人偶尔会说句人话）', () => {
  const r = cheapEmpathy('场1：夜\n林晚：我妈走那年我才八岁。\n沈志国：我理解你的感受。\n林晚：别说了。');
  assert.equal(r.unrescuedCount, 1);
  assert.equal(r.score, 100);
});

test('zh: n=2 起判 70', () => {
  const draft = '场1：夜\n林晚：我今天被开除了。\n沈志国：我理解你的感受。\n林晚：嗯。\n沈志国：你一定很难受。';
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 2);
  assert.equal(r.score, 70);
});

test('zh: n=4 → 30 分中档', () => {
  const draft = '场1：夜\n林晚：我今天被开除了。\n沈志国：我理解你的感受。\n林晚：嗯。\n沈志国：你一定很难受。\n林晚：还行。\n沈志国：想哭就哭。\n林晚：哭不出来。\n沈志国：别一个人扛着。';
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 4);
  assert.equal(r.score, 30);
});

test('neg zh: 伤者本人的袒露不算安慰者的救援证据', () => {
  const draft = '场1：夜\n林晚：我妈走那年我才八岁。\n沈志国：我理解你的感受。\n林晚：这些年我一个人惯了。\n沈志国：你一定很不容易。';
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 2);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(cheapEmpathy('').score, 100);
});

test('en: therapist scripts unrescued → 30 (n=4)', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'LINNA: I lost my mother when I was eight.',
    'VICTOR: I understand how you feel. That must have been so hard for you.',
    'LINNA: Yeah.',
    'VICTOR: It is okay to cry. Your feelings are valid.',
    'LINNA: Thanks.',
    'VICTOR: I am always here for you.',
  ].join('\n');
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 4);
  assert.equal(r.score, 30);
});

test('rescue en: awkward action (said nothing, pushed tissues, poured water) → exempt', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'LINNA: I lost my mother when I was eight.',
    'VICTOR said nothing. He pushed the tissues across the table and poured her some water.',
    'VICTOR: I understand how you feel.',
  ].join('\n');
  const r = cheapEmpathy(draft);
  assert.equal(r.score, 100);
  assert.equal(r.hits[0].rescued, true);
});

test('rescue en: comforter self-discloses own loss → exempt', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'LINNA: I lost my mother when I was eight.',
    'VICTOR: I know how you feel. When my own father died, I sat alone in the old house for three days.',
  ].join('\n');
  const r = cheapEmpathy(draft);
  assert.equal(r.score, 100);
});

test('exempt en: therapist in role → professional', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'THERAPIST: I understand how you feel. That must have been hard, and you have every right to be angry.',
    'LINNA: Can I still get better?',
  ].join('\n');
  const r = cheapEmpathy(draft);
  assert.ok(r.hits.every((h) => h.professional === true));
  assert.equal(r.unrescuedCount, 0);
});

test('neg en: single line scores 100; wounded disclosure is not rescue evidence', () => {
  const draft = [
    'INT. ROOM - NIGHT',
    'LINNA: I lost my mother when I was eight.',
    'VICTOR: That must have been hard.',
    'LINNA: I have been alone ever since.',
    'VICTOR: I hear you.',
  ].join('\n');
  const r = cheapEmpathy(draft);
  assert.equal(r.unrescuedCount, 2);
  assert.equal(r.score, 70);
});

/* ============================ 结构 ============================ */

test('struct: hit 携带行号/场景/speaker/marker/rescued/professional', () => {
  const r = cheapEmpathy('场1：夜·客厅\n林晚：疼。\n沈志国：我理解你的感受。\n林晚：嗯。\n沈志国：想哭就哭。');
  const h = r.hits[0];
  assert.equal(h.line, 3);
  assert.equal(h.speaker, '沈志国');
  assert.ok(h.marker.includes('理解'));
  assert.equal(typeof h.rescued, 'boolean');
  assert.equal(typeof h.professional, 'boolean');
});

test('struct: 英文输出零中文', () => {
  const r = cheapEmpathy('INT. ROOM - NIGHT\nLINNA: It hurt.\nVICTOR: I understand how you feel.\nLINNA: Yeah.\nVICTOR: That must have been hard.\nLINNA: Okay.\nVICTOR: It is okay to cry.');
  assert.equal(r.unrescuedCount, 3);
  assert.equal(/[一-鿿]/.test(JSON.stringify(r)), false);
});
