'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eavesdropDump } = require('../dist/engine/eavesdrop-dump.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  const r = eavesdropDump('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 单次撞听一个秘密不罚（合法手法）', () => {
  const draft = [
    '场1：夜 内 书房',
    '她走到书房门口，听见父亲在电话里提到遗嘱的事。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'repeat');
  assert.equal(r.hits[0].charged, false);
  assert.equal(r.score, 100);
});

test('zh: 第二次撞听 charged，78 分', () => {
  const draft = [
    '场1：夜 内 书房',
    '她走到书房门口，听见父亲提到遗嘱的事。',
    '场2：夜 内 走廊',
    '她拐过走廊拐角，听见里面提到合同的事。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[1].charged, true);
  assert.equal(r.score, 78);
  assert.ok(r.issues.some((x) => x.includes('第4行')));
});

test('zh: 三次撞听，bad=2 → 52 分', () => {
  const draft = [
    '场1：夜 内 书房',
    '她走到书房门口，听见父亲提到遗嘱的事。',
    '场2：夜 内 走廊',
    '她拐过走廊拐角，听见里面提到合同的事。',
    '场3：夜 外 窗外',
    '她贴在窗外，听见里面说到亲子鉴定的安排。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 3);
  assert.equal(r.score, 52);
});

test('zh: 密谋套餐（多类机密+完整长段）单次即 charged', () => {
  const draft = '她走到书房门口，听见父亲压低声音：“明天动手，做掉他，股权转走，亲子鉴定一并烧掉。”';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'package');
  assert.equal(r.hits[0].charged, true);
  assert.ok(r.hits[0].events.length >= 3);
  assert.equal(r.score, 78);
  assert.ok(r.issues[0].includes('密谋套餐'));
});

test('zh: 位置帧但无机密内容 → 零命中', () => {
  const draft = '她走到书房门口，听见父亲在交代周末家宴的菜单。';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('zh: 路过非清单地点不构位置帧（花店误判保护）', () => {
  const draft = '她路过街角花店，听见里面传来轻轻的音乐声。';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: 机密落在紧邻下一非空行仍命中（画外对白延续）', () => {
  const draft = [
    '她走到虚掩的房门外，听见里面传来男人的声音。',
    '那声音说，那份遗嘱必须在天亮前销毁。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].events.includes('遗嘱'));
});

test('zh: 场景头截断内容延续窗口', () => {
  const draft = [
    '她走到办公室门口，听见里面传来声音。',
    '场2：日 内 大厅',
    '遗嘱在律师手里的消息写在文件上。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: rescue——提前布置、屏住呼吸（有成本）', () => {
  const draft = [
    '她屏住呼吸，贴在门上。',
    '她在门外听见父亲说出遗嘱藏在哪里。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh: rescue——差点暴露、赶紧躲（有风险）', () => {
  const draft = [
    '她走到书房门口，听见里面说那份合同是伪造的。',
    '脚步声突然逼近，她差点被发现，赶紧缩回拐角。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh: rescue——掏出手机录音（信息变成抢来的筹码）', () => {
  const draft = [
    '她走到门外，听见里面交代股权转移的细节。',
    '她掏出手机，按下录音。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh: 台词行里"口头转述"不算撞听（归别的引擎管）', () => {
  const draft = [
    '场1：日 内 客厅',
    '林晚：我刚走到书房门口就听见他说遗嘱改了。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 0);
});

test('zh: 同类机密重复出现只计一类（合同+合同 → repeat 非 package）', () => {
  const draft = '她在门外听见他反复说合同、合同必须重新签。';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'repeat');
  assert.equal(r.hits[0].events.length, 1);
});

test('zh: 先一次合法撞听、再一个套餐 → 套餐 charged 78', () => {
  const draft = [
    '场1：夜 内 书房',
    '她走到书房门口，听见父亲提到遗嘱的事。',
    '场2：夜 内 走廊',
    '她走到办公室门外，听见里面说：“明天动手，股权全部转走，亲子鉴定一并烧掉。”',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[1].kind, 'package');
  assert.equal(r.hits[1].charged, true);
  assert.equal(r.score, 78);
});

test('zh: narrationLines 只计叙述行', () => {
  const draft = [
    '场1：日 内 客厅',
    '林晚：你来了。',
    '窗外的光斜进来。',
    '她没有说话。',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.narrationLines, 2);
});

/* ============================ English ============================ */

test('en: single overhear of one secret is not charged', () => {
  const draft = 'Outside the study door, she heard her father mention the will on the phone.';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].charged, false);
  assert.equal(r.score, 100);
});

test('en: second overhear charged → 78', () => {
  const draft = [
    'INT. STUDY - NIGHT',
    'Outside the study door, she heard him mention the will.',
    'INT. HALLWAY - NIGHT',
    'Around the corner, she heard them discussing the contract.',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[1].charged, true);
  assert.equal(r.score, 78);
});

test('en: conspiracy package charged on first hit', () => {
  const draft = 'Through the half-open door, she heard them say: "Move tomorrow, silence him, transfer the shares and burn the DNA test."';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'package');
  assert.equal(r.hits[0].charged, true);
  assert.ok(r.hits[0].events.length >= 3);
  assert.equal(r.score, 78);
});

test('en: frame with no secret content → zero hits', () => {
  const draft = 'Outside the door, she heard them discussing the weekend schedule.';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 0);
});

test('en: rescue — held breath at the door', () => {
  const draft = 'Outside the door, she held her breath and heard him say where the will was hidden.';
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('en: rescue — almost caught by approaching footsteps', () => {
  const draft = [
    'She paused outside the office and heard them admit the contract was forged.',
    'Footsteps approached and she was almost caught.',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('en: rescue — pulls out phone to record', () => {
  const draft = [
    'Through the door, she heard the details of transferring the shares.',
    'She pulled out her phone to record.',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('en: mixed repeat+repeat+package → two bad → 52', () => {
  const draft = [
    'INT. STUDY - NIGHT',
    'Outside the study door, she heard him mention the will.',
    'INT. HALL - NIGHT',
    'Around the corner, she heard them mention the contract.',
    'INT. OFFICE - NIGHT',
    'Through the half-open door she heard: "Silence him tonight, transfer all shares, burn the DNA test."',
  ].join('\n');
  const r = eavesdropDump(draft);
  assert.equal(r.hits.length, 3);
  assert.equal(r.score, 52);
});
