const test = require('node:test');
const assert = require('node:assert');
const CC = require('../dist/engine/creation-context.js');
const P = require('../dist/config/platform-playbook.js');

test('创作上下文：空输入安全降级，仍带活人感/懂观众/情绪沉淀三条底线', () => {
  const c = CC.buildCreationContext();
  assert.ok(c.contextBrief.includes('活人感'));
  assert.ok(c.contextBrief.includes('懂观众'));
  assert.ok(c.contextBrief.includes('情绪'));
  assert.ok(c.xiaonanLines.length >= 1);
});

test('创作上下文：高考时令+东北画像 → 注入方向与地域，小南透明播报', () => {
  const c = CC.buildCreationContext({
    date: new Date(2026, 5, 7),
    profile: { region: '辽宁沈阳', bio: '东北编剧', pastTags: ['大女主'] },
  });
  assert.ok(c.contextBrief.includes('高考') || c.xiaonanLines.join('').includes('高考'));
  assert.ok(c.contextBrief.includes('东北'));
  assert.ok(c.regional && c.regional.includes('东北'));
  assert.ok(c.xiaonanLines.some((l) => l.includes('小南')));
});

test('创作上下文：跨文化三要素注入', () => {
  const c = CC.buildCreationContext({ crossCulture: { from: '东北', to: '上海' } });
  assert.ok(c.contextBrief.includes('跨文化'));
  assert.ok(c.contextBrief.includes('不丑化'));
});

test('活人感/懂观众/跨文化方法论可检验', () => {
  const a = P.alivenessCheck(['livelihood']);
  assert.strictEqual(a.completenessPct, Math.round(1 / 6 * 100));
  assert.ok(a.missing.length === 5);
  assert.ok(P.alivenessCheck(['livelihood', 'motive', 'speech', 'action', 'flaw', 'boundary']).advice.includes('齐备'));
  assert.strictEqual(P.audienceFirstCheck([]).missing.length, 4);
  const cb = P.crossCultureBrief('东北', '香港豪门');
  ['跨文化', '不丑化', '真诚'].forEach((k) => assert.ok(cb.includes(k)));
});

test('历史脑洞：标签/关键词命中即自动注入What-if方法论与小南播报，普通题材不触发', () => {
  const hit = CC.buildCreationContext({ tags: ['历史WhatIf', '平行历史'], historyAnchor: '赤壁之战' });
  assert.ok(hit.contextBrief.includes('历史脑洞 What-if'));
  assert.ok(hit.contextBrief.includes('赤壁之战'));
  assert.ok(hit.xiaonanLines.some((l) => l.includes('历史脑洞')));
  const hit2 = CC.buildCreationContext({ tagBrief: '假如历史跑偏，唐朝有了互联网' });
  assert.ok(CC.isHistoryWhatIf([], '假如历史跑偏'));
  assert.ok(hit2.contextBrief.includes('历史脑洞'));
  const plain = CC.buildCreationContext({ tags: ['都市日常', '治愈慢生活'] });
  assert.ok(!plain.contextBrief.includes('What-if 创作法'));
});
