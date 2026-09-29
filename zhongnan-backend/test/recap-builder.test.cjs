'use strict';
// v2.80 上集回顾生成器测试（确定性拼装、中英双语、en 层零中文）
const test = require('node:test');
const assert = require('node:assert');
const { buildRecap } = require('../dist/engine/recap-builder.js');

const CJK = /[\u4e00-\u9fff]/;

test('ZH 全素材：反转/爽点/情绪/揭示/状态/悬念全部拼装，1-2 句带集数标题', () => {
  const r = buildRecap({
    epNo: 3,
    title: '认亲宴',
    reversalId: 'rev_identity',
    payoffIds: ['pay_faceslap', 'pay_counter', 'pay_truth'],
    emotionId: 'emo_burst',
    revealedTopics: ['身世'],
    bridgedStates: ['pregnant'],
    cliffhanger: '宴会厅的灯突然全灭，黑暗里传来一声枪响——',
  });
  assert.strictEqual(r.epNo, 3);
  assert.ok(r.text.startsWith('上集回顾 · 第3集《认亲宴》：'));
  assert.ok(r.text.includes('身份反转'));
  assert.ok(r.text.includes('打脸爽'));
  assert.ok(r.text.includes('等'), '超过 2 个爽点应带"等"');
  assert.ok(r.text.includes('情绪爆发'));
  assert.ok(r.text.includes('身世') && r.text.includes('真相揭开'));
  assert.ok(r.text.includes('怀孕') && r.text.includes('有了交代'));
  assert.ok(r.text.includes('悬念停在：'));
  assert.ok(r.text.endsWith('。'));
  // 1-2 句：正文以分号连接成一个整句
  assert.strictEqual((r.text.match(/。/g) || []).length, 1);
});

test('ZH 空素材回退：不编造情节，输出中性句', () => {
  const r = buildRecap({ epNo: 5 });
  assert.strictEqual(r.text, '上集回顾 · 第5集：主线剧情推进。');
  assert.strictEqual(r.textEn, 'Previously: Ep5 — the main plot advances.');
});

test('长悬念截断 40 字加省略号', () => {
  const long = '一二三四五六七八九十'.repeat(5) + '超出的部分'; // 55 字
  const r = buildRecap({ epNo: 2, cliffhanger: long });
  const m = r.text.match(/悬念停在：(.+)$/);
  assert.ok(m);
  const clipped = m[1].replace(/。$/, '').replace(/…$/, '');
  assert.strictEqual(clipped.length, 40);
  assert.ok(r.text.includes('…'));
});

test('EN 层零中文：标题/揭示主题（中文词表）跳过，节拍名用英文', () => {
  const r = buildRecap({
    epNo: 4,
    title: '认亲宴',
    reversalId: 'rev_identity',
    payoffIds: ['pay_faceslap', 'pay_counter'],
    emotionId: 'emo_burst',
    revealedTopics: ['身世'],
    bridgedStates: ['pregnant'],
    cliffhanger: 'The lights went out and a gunshot rang out.',
  });
  assert.ok(r.textEn.startsWith('Previously: Ep4 — '));
  assert.ok(!CJK.test(r.textEn), `textEn 含中文: ${r.textEn}`);
  assert.ok(r.textEn.includes('the story pivots on'));
  assert.ok(r.textEn.includes('payoffs landed'));
  assert.ok(r.textEn.includes('emotional throughline'));
  assert.ok(r.textEn.includes('resolved: pregnancy'));
  assert.ok(r.textEn.includes('cliffhanger: The lights went out'));
  assert.ok(!r.textEn.includes('身世'), '揭示主题为中文词表，英文层应跳过');
});

test('en 空素材与 zh 英文标题外的回退一致', () => {
  const r = buildRecap({ epNo: 1 }, 'en');
  assert.ok(r.textEn.includes('the main plot advances'));
});

test('字段边界：epNo 取整/下限保护/数组越界安全/长度上限', () => {
  assert.strictEqual(buildRecap({ epNo: 2.7 }).epNo, 3);
  assert.strictEqual(buildRecap({ epNo: 0 }).epNo, 1);
  assert.strictEqual(buildRecap({ epNo: -3 }).epNo, 1);
  // 超量素材截断：爽点 4、揭示 3、状态 3
  const r = buildRecap({
    epNo: 6,
    payoffIds: ['pay_faceslap', 'pay_counter', 'pay_sweet', 'pay_crush', 'pay_truth'],
    revealedTopics: ['身世', '怀孕', '卧底', '遗嘱'],
    bridgedStates: ['pregnant', 'jailed', 'coma', 'bankrupt'],
  });
  assert.ok(r.text.length > 0);
  assert.ok(!r.text.includes('遗嘱'), '揭示主题最多取 3');
  assert.ok(!r.text.includes('破产'), '桥接状态最多取 3');
});
