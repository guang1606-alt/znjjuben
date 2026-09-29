'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selfPityLitany } = require('../dist/engine/self-pity-litany.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  const r = selfPityLitany('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 单族短口语放行（叹一口气不是卖惨）', () => {
  const draft = '林晚：我命苦。';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 两族短于长度门槛放行', () => {
  const draft = '林晚：老天不公，我活该。';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: 苦命+问天完整自怜连祷 charged → 80', () => {
  const draft = '林晚：我这辈子怎么这么苦啊，老天爷你为什么这么不公平，为什么所有的罪都要让我一个人受？';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].families.includes('doom'));
  assert.ok(r.hits[0].families.includes('heaven'));
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 80);
  assert.ok(r.issues[0].includes('自怜连祷'));
});

test('zh: 苦难罗列+自我定罪 charged', () => {
  const draft = '林晚：我从小没爹没妈，被丈夫打，还被赶出门，我到底做错了什么要受这些？';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].families.includes('list'));
  assert.ok(r.hits[0].families.includes('blame'));
  assert.equal(r.score, 80);
});

test('zh: 同族重复两次也 charged', () => {
  const draft = '林晚：老天爷为什么是我，老天啊你为什么不开眼看看我？';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].families.includes('heaven'));
});

test('zh: 单个苦难事实是陈述不是罗列 → 放行', () => {
  const draft = '林晚：我从小没爹没妈，是奶奶把我拉扯大的。';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: 心声括号话者同样扫描', () => {
  const draft = '林晚（心声）：我这一生没有过过一天好日子，老天爷你为什么要这样对我，我到底做错了什么？';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].speaker, '林晚');
  assert.equal(r.score, 80);
});

test('zh: 同话者连续多行合并为一个发言段', () => {
  const draft = [
    '林晚：我这辈子怎么这么苦。',
    '林晚：老天爷你为什么这么不公平？',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].startLine, 1);
  assert.equal(r.hits[0].endLine, 2);
});

test('zh: rescue——段内自己转身做决定', () => {
  const draft = '林晚：我这辈子怎么这么苦，老天爷你为什么这么不公平……但我要自己查清楚。';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh: rescue——下一拍擦干泪站起来', () => {
  const draft = [
    '林晚：我这辈子怎么这么苦，老天爷你为什么这么不公平？',
    '她擦干眼泪，猛地站起来，眼神冷了下来。',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.hits[0].rescueLine, 2);
  assert.equal(r.score, 100);
});

test('zh: 下一拍是冷笑（惨转攻击）也 rescue', () => {
  const draft = [
    '林晚：我从小受尽欺负，被赶出门，我到底做错了什么？',
    '她突然笑了，笑得比哭还难看：走着瞧。',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('zh: 别人发言来哄不算 rescue（脊梁必须自己给）', () => {
  const draft = [
    '林晚：我这辈子怎么这么苦，老天爷你为什么这么不公平？',
    '顾母：别哭了孩子，以后妈疼你。',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 80);
});

test('zh: 乞求"别赶我走"仍是乞怜不 rescue', () => {
  const draft = '林晚：求求你们别赶我走，我从小没爹没妈，被丈夫打，我到底做错了什么？';
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, false);
});

test('zh: 叙述行客观苦难不扫', () => {
  const draft = '她三岁丧母，五岁被父亲抛弃，在亲戚家看脸色长大。';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: 两处卖惨 → 56 分', () => {
  const draft = [
    '场1：日 内 客厅',
    '林晚：我这辈子怎么这么苦，老天爷你为什么这么不公平？',
    '场2：夜 内 卧室',
    '林晚：我从小受尽欺负，我到底做错了什么，为什么没人爱我？',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 56);
});

test('zh: dialogueLines 统计台词行', () => {
  const draft = [
    '场1：日 内 客厅',
    '林晚：你来了。',
    '顾母：嗯。',
    '窗外下雨了。',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.dialogueLines, 2);
});

/* ============================ English ============================ */

test('en: doom + heaven litany charged → 80', () => {
  const draft = 'LIN WAN: My whole life I have never gotten a single break. Why me? Why is life so unfair to me?';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].families.includes('doom'));
  assert.ok(r.hits[0].families.includes('heaven'));
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 80);
});

test('en: suffering list + self-blame charged', () => {
  const draft = 'LIN WAN: I was orphaned young, beaten by my husband, kicked out onto the street. What did I do wrong?';
  const r = selfPityLitany(draft);
  assert.ok(r.hits[0].families.includes('list'));
  assert.ok(r.hits[0].families.includes('blame'));
});

test('en: rescue in-segment — wipe tears and decide', () => {
  const draft = 'LIN WAN: My whole life has been nothing but pain, why me... But tomorrow I will file the report myself.';
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('en: rescue next beat — stood up, eyes cold', () => {
  const draft = [
    'LIN WAN: Why me? What did I do wrong to deserve all this pain in my whole life?',
    'She stood up, eyes turning cold.',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, true);
});

test('en: other character comforting does not rescue', () => {
  const draft = [
    'LIN WAN: Why me? My whole life has been nothing but unfair suffering and pain.',
    'MRS GU: There, there, child.',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 80);
});

test('en: objective narration not scanned', () => {
  const draft = 'She lost her mother at three and was abandoned by her father at five.';
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 0);
});

test('en: two litanies → 56', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'LIN WAN: My whole life has been nothing but pain, why me, why is life so unfair?',
    'INT. BEDROOM - NIGHT',
    'LIN WAN: Everyone used me and beat me, what did I do wrong, why does nobody love me?',
  ].join('\n');
  const r = selfPityLitany(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 56);
});
