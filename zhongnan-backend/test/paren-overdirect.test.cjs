'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parenOverdirect } = require('../dist/engine/paren-overdirect.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  const r = parenOverdirect('');
  assert.equal(r.score, 100);
  assert.equal(r.cueCount, 0);
});

test('zh: 高占比 + 冷笑复用三 → ratio+repeat 命中', () => {
  const draft = [
    '场1：日',
    '林晚（冷笑）：你走吧。',
    '沈志国：走了就别回来。',
    '林晚（挑眉）：不回来就不回来。',
    '沈志国（皱眉）：你再说一遍。',
    '林晚（勾唇）：我说，不回来。',
    '沈志国（愤怒）：反了你了。',
    '林晚（冷笑）：你试试。',
    '沈志国：好。',
    '林晚（冷笑）：等的就是这句。',
    '沈志国（意味深长）：别后悔。',
  ].join('\n');
  const r = parenOverdirect(draft);
  assert.ok(r.hits.some((h) => h.kind === 'ratio'));
  const rep = r.hits.find((h) => h.kind === 'repeat' && h.token === '冷笑');
  assert.ok(rep);
  assert.equal(r.score, 60); // −25 −15
});

test('zh: 行首内嵌括注 林晚：（冷笑）也算挂条', () => {
  const draft = '场1：日\n林晚：（冷笑）你走吧。\n沈志国：走了就别回来。';
  const r = parenOverdirect(draft);
  assert.equal(r.directedCount, 1);
});

test('zh: 长导演讲括注（含泪+冷笑+颤抖三 cue 堆叠）→ long', () => {
  const r = parenOverdirect('场1：日\n林晚（眼含热泪，嘴角却勾起一抹冷笑，声音颤抖地）：我没事。\n沈志国：真的？\n林晚：真的。');
  const hit = r.hits.find((h) => h.kind === 'long');
  assert.ok(hit);
  assert.ok(hit.paren.includes('颤抖'));
  assert.equal(r.score, 90);
});

test('rescue zh: V.O./画外音/电话另一端 技术括注豁免', () => {
  const r = parenOverdirect('场1：日\n林晚（画外音）：那年我十八岁。\n沈志国（电话另一端）：说话。\n林晚（V.O.）：好。\n沈志国：嗯。');
  assert.equal(r.directedCount, 0);
  assert.equal(r.score, 100);
});

test('neg zh: 干净稿（情绪写进动作行，零挂条）满分', () => {
  const draft = [
    '场1：日',
    '林晚：你走吧。',
    '沈志国：走了就别回来。',
    '林晚：不回来就不回来。',
    '沈志国：你再说一遍。',
    '△林晚把请帖推了回去。',
    '林晚：我说，不回来。',
    '沈志国：反了你了。',
    '林晚：你试试。',
    '沈志国：好。',
    '林晚：等的就是这句。',
  ].join('\n');
  const r = parenOverdirect(draft);
  assert.equal(r.directedCount, 0);
  assert.equal(r.score, 100);
});

test('neg zh: 短稿少量挂条（<6 cue）不判 ratio', () => {
  const r = parenOverdirect('场1：日\n林晚（冷笑）：走。\n沈志国：好。\n林晚（挑眉）：试试。');
  assert.equal(r.hits.filter((h) => h.kind === 'ratio').length, 0);
  assert.equal(r.score, 100);
});

test('neg zh: 占比未过 60% 不判 ratio', () => {
  const draft = '场1：日\n林晚：（冷笑）你走。\n沈志国：走。\n林晚：（挑眉）试试。\n沈志国：好。\n林晚：（冷笑）等着。\n沈志国：行。\n林晚：（勾唇）别后悔。\n沈志国：走。';
  const r = parenOverdirect(draft);
  assert.equal(r.directedCount, 4);
  assert.equal(r.hits.filter((h) => h.kind === 'ratio').length, 0);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(parenOverdirect('').score, 100);
});

test('en: high ratio + coldly reused → ratio+repeat', () => {
  const draft = [
    'INT. ROOM - DAY',
    'LINNA (coldly): Go.',
    'VICTOR: Leave and never come back.',
    'LINNA (smirking): Fine by me.',
    'VICTOR (frowning): Say that again.',
    "LINNA (raising an eyebrow): I will.",
    'VICTOR (angrily): You dare.',
    'LINNA (coldly): Try me.',
    'VICTOR: Fine.',
    'LINNA (coldly): That is what I wanted to hear.',
  ].join('\n');
  const r = parenOverdirect(draft);
  assert.ok(r.hits.some((h) => h.kind === 'ratio'));
  assert.ok(r.hits.find((h) => h.kind === 'repeat' && h.token === 'coldly'));
  assert.equal(r.score, 60);
});

test('en: Hollywood three-line format NAME / (paren) / dialogue → 归属 cue', () => {
  const draft = 'INT. ROOM - DAY\nLINNA\n(coldly, smirking, raising an eyebrow)\nGo.\nVICTOR: Leave.';
  const r = parenOverdirect(draft);
  assert.equal(r.cueCount, 2);
  assert.equal(r.directedCount, 1);
  assert.ok(r.hits.find((h) => h.kind === 'long'));
});

test('rescue en: V.O./O.S./CONTD/filtered/on the phone 技术括注豁免', () => {
  const draft = [
    'INT. ROOM - DAY',
    "LINNA (V.O.): I was eighteen.",
    'VICTOR (filtered): Talk.',
    "LINNA (O.S., CONT'D): Okay.",
    'VICTOR (on the phone): Hmm.',
    'LINNA: Fine.',
  ].join('\n');
  const r = parenOverdirect(draft);
  assert.equal(r.directedCount, 0);
  assert.equal(r.score, 100);
});

test('neg en: bare-cue clean script (no parens) scores 100', () => {
  const draft = [
    'INT. ROOM - DAY',
    'LINNA',
    'Go.',
    'VICTOR',
    'Leave and never come back.',
    'LINNA',
    'Fine by me.',
    'VICTOR',
    'Say that again.',
    'LINNA',
    'I will.',
    'VICTOR',
    'You dare.',
  ].join('\n');
  const r = parenOverdirect(draft);
  assert.equal(r.cueCount, 6);
  assert.equal(r.directedCount, 0);
  assert.equal(r.score, 100);
});

test('neg en: CUT TO BLACK / FADE OUT 转场不算 cue', () => {
  const r = parenOverdirect('INT. ROOM - DAY\nLINNA: Go.\nCUT TO BLACK.\nFADE OUT.');
  assert.equal(r.cueCount, 1);
});

/* ============================ 封底与结构 ============================ */

test('score: 多 repeat + 多 long 封底 20', () => {
  const lines = ['INT. OFFICE - DAY'];
  const tags = ['coldly', 'smirking', 'angrily', 'frowning', 'tearfully'];
  for (let i = 0; i < 3; i += 1) {
    for (const t of tags) {
      lines.push(`VICTOR (${t}, trembling, with tears and a shaking voice right there): Speak.`);
      lines.push('LINNA (shouting, yelling, raising her shaking voice at him): Never.');
    }
  }
  const r = parenOverdirect(lines.join('\n'));
  assert.equal(r.score, 20);
  assert.ok(r.hits.some((h) => h.kind === 'ratio'));
  assert.equal(r.hits.filter((h) => h.kind === 'repeat').length, 3);
  assert.equal(r.hits.filter((h) => h.kind === 'long').length, 3);
});

test('struct: ratio hit 携带 ratio/cueCount/directedCount', () => {
  const draft = '场1：日\n林晚（冷笑）：一。\n沈志国（冷笑）：二。\n林晚（冷笑）：三。\n沈志国（皱眉）：四。\n林晚（挑眉）：五。\n沈志国（勾唇）：六。';
  const r = parenOverdirect(draft);
  const hit = r.hits.find((h) => h.kind === 'ratio');
  assert.ok(hit);
  assert.equal(hit.cueCount, 6);
  assert.equal(hit.directedCount, 6);
  assert.equal(hit.ratio, 1);
});

test('struct: 建议与问题非空且英文稿无中文', () => {
  const r = parenOverdirect('INT. ROOM - DAY\nLINNA (coldly): Go.\nVICTOR (coldly): Stop.\nLINNA (coldly): No.\nVICTOR (frowning): Yes.\nLINNA (angrily): Never.\nVICTOR (smirking): Done.');
  assert.ok(r.issues.length > 0);
  assert.ok(r.advice.length > 0);
  const joined = JSON.stringify(r);
  assert.equal(/[一-鿿]/.test(joined), false);
});
