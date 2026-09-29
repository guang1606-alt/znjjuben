/**
 * v2.80 生成侧跨集连续性简报（continuity-brief）测试
 * 覆盖：空输入、未揭示秘密推进、防揭示失忆、未桥接状态去重、
 *       前集伏笔回收、高危角色弧光、en 层零中文、条目上限、curEpNo 自愈与优先级。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { continuityBrief } = require('../dist/engine/continuity-brief.js');
const { CHAR_STATE_META } = require('../dist/engine/character-state-ledger.js');

test('空输入：无条目、两层指令均为空串、curEpNo 兜底 1', () => {
  const r = continuityBrief({});
  assert.strictEqual(r.curEpNo, 1);
  assert.deepStrictEqual(r.items, []);
  assert.strictEqual(r.directiveZh, '');
  assert.strictEqual(r.directiveEn, '');
  assert.strictEqual(r.endingBlockZh, '');
  assert.strictEqual(r.endingBlockEn, '');
});

test('未揭示秘密：已揭示主题出池，按悬空时长降序，age>=2 为 high，zh 含推进指令', () => {
  const r = continuityBrief({
    prevSecrets: {
      plants: [
        { topic: '身世', plantedInEp: 1, snippet: 'a' },
        { topic: '遗嘱', plantedInEp: 4, snippet: 'b' },
      ],
      revealedTopics: ['遗嘱'],
      epNo: 5,
    },
  });
  assert.strictEqual(r.curEpNo, 6); // 自愈：epNo+1
  const secrets = r.items.filter((i) => i.kind === 'secret');
  assert.strictEqual(secrets.length, 1);
  assert.strictEqual(secrets[0].priority, 'high');
  assert.ok(secrets[0].zh.includes('身世'));
  assert.ok(secrets[0].zh.includes('第1集'));
  assert.ok(secrets[0].zh.includes('必须推进'));
  assert.ok(!secrets[0].zh.includes('遗嘱')); // 已揭示主题不进"待推进"池（防失忆条目另行提示）
  assert.ok(r.directiveZh.includes('【跨集连续性简报'));
  assert.ok(r.directiveZh.includes('依据第5集台账'));
  assert.ok(r.directiveEn.includes('MUST advance it'));
});

test('防揭示失忆：已揭穿主题要求本集不得再按瞒着写', () => {
  const r = continuityBrief({ prevSecrets: { plants: [], revealedTopics: ['怀孕'], epNo: 3 } });
  const rev = r.items.find((i) => i.kind === 'revealed');
  assert.ok(rev, '应有 revealed 条目');
  assert.strictEqual(rev.priority, 'high');
  assert.ok(rev.zh.includes('不得再按'));
  assert.ok(rev.zh.includes('怀孕'));
  assert.ok(rev.en.includes('already public'));
});

test('未桥接人物状态：同状态去重取最早 onset，resolved 出池，悬空≥2 为 high', () => {
  const r = continuityBrief({
    prevStates: {
      onsets: [
        { state: 'pregnant', onsetInEp: 2, snippet: 'x' },
        { state: 'pregnant', onsetInEp: 4, snippet: 'y' }, // 同状态重复，应去重
        { state: 'jailed', onsetInEp: 5, snippet: 'z' }, // 已 resolved，应出池
      ],
      resolved: ['jailed'],
      epNo: 5,
    },
  });
  const states = r.items.filter((i) => i.kind === 'state');
  assert.strictEqual(states.length, 1);
  assert.ok(states[0].zh.includes('第2集确立')); // 取最早 onset
  assert.ok(states[0].zh.includes(CHAR_STATE_META.pregnant.zh));
  assert.strictEqual(states[0].priority, 'high'); // age=6-2=4
  assert.ok(!r.directiveZh.includes(CHAR_STATE_META.jailed.zh));
  assert.ok(states[0].en.includes(CHAR_STATE_META.pregnant.en));
});

test('前集伏笔：已回收 signal 出池，未回收的提示回收或推进', () => {
  const mk = (signal) => ({ type: 'plant', signal, category: 'object', lineNo: 1, snippet: '' });
  const r = continuityBrief({
    prevForeshadow: { plants: [mk('玉佩'), mk('日记')], payoffs: [mk('日记')], epNo: 5 },
  });
  const fs = r.items.filter((i) => i.kind === 'foreshadow');
  assert.strictEqual(fs.length, 1);
  assert.ok(fs[0].zh.includes('玉佩'));
  assert.ok(fs[0].zh.includes('尚未回收'));
  assert.ok(fs[0].en.includes('unrecovered'));
});

test('角色弧光：仅高危角色（危机/转变/绝望/愤怒）注入，普通角色由前集摘要兜底', () => {
  const r = continuityBrief({
    prevArc: {
      characters: [
        { name: '林晚', emotion: 'despair', stage: 'crisis', emotionTrack: [], changed: false, relations: [{ target: '沈舟', type: 'rival' }] },
        { name: '平静角色', emotion: 'calm', stage: 'setup', emotionTrack: [], changed: false, relations: [] },
      ],
      epNo: 5,
    },
  });
  const arcs = r.items.filter((i) => i.kind === 'arc');
  assert.strictEqual(arcs.length, 1);
  assert.ok(arcs[0].zh.includes('林晚'));
  assert.ok(arcs[0].zh.includes('危机'));
  assert.ok(arcs[0].zh.includes('绝望'));
  assert.ok(arcs[0].zh.includes('沈舟'));
  assert.ok(arcs[0].zh.includes('禁跳变'));
  assert.ok(!r.directiveZh.includes('平静角色'));
});

test('en 层零中文：en 词表输入下英文指令不含任何中文字符', () => {
  const r = continuityBrief({
    prevSecrets: { plants: [{ topic: 'birth secret', plantedInEp: 3, snippet: '' }], revealedTopics: [], epNo: 5 },
    prevStates: { onsets: [{ state: 'coma', onsetInEp: 4, snippet: '' }], resolved: [], epNo: 5 },
    prevForeshadow: { plants: [{ type: 'plant', signal: 'the letter', category: 'object', lineNo: 1, snippet: '' }], payoffs: [], epNo: 5 },
    prevArc: { characters: [{ name: 'Elena', emotion: 'despair', stage: 'crisis', emotionTrack: [], changed: false, relations: [] }], epNo: 5 },
  });
  assert.ok(r.items.length >= 4);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.directiveEn), '英文层不得含中文');
  assert.ok(r.directiveEn.includes('MUST honor this episode'));
  assert.ok(r.directiveEn.includes('birth secret'));
  assert.ok(r.directiveEn.includes(CHAR_STATE_META.coma.en));
  assert.ok(r.directiveEn.includes('the letter'));
  assert.ok(r.directiveEn.includes('Elena'));
});

test('条目上限：每类最多 3 条（秘密类验证）', () => {
  const r = continuityBrief({
    prevSecrets: {
      plants: ['身世', '怀孕', '卧底', '遗嘱', '破产'].map((topic, i) => ({ topic, plantedInEp: i + 1, snippet: '' })),
      revealedTopics: [],
      epNo: 6,
    },
  });
  const secrets = r.items.filter((i) => i.kind === 'secret');
  assert.strictEqual(secrets.length, 3);
  assert.ok(secrets[0].zh.includes('身世')); // age 最大者排第一
});

test('curEpNo 显式传入优先生效，age 随之计算；age=1 时为 mid', () => {
  const r = continuityBrief({
    curEpNo: 7,
    prevSecrets: { plants: [{ topic: '身世', plantedInEp: 1, snippet: '' }], revealedTopics: [], epNo: 5 },
  });
  assert.strictEqual(r.curEpNo, 7);
  const s = r.items.find((i) => i.kind === 'secret');
  assert.ok(s.zh.includes('已悬 6 集未揭示'));
  assert.strictEqual(s.priority, 'high');

  const r2 = continuityBrief({
    prevSecrets: { plants: [{ topic: '身世', plantedInEp: 5, snippet: '' }], revealedTopics: [], epNo: 5 },
  });
  const s2 = r2.items.find((i) => i.kind === 'secret');
  assert.strictEqual(s2.priority, 'mid'); // age=1
  assert.ok(s2.zh.includes('已悬 1 集未揭示'));
});

// —— v2.80 前集结尾焊点（prevEnding）：下一集开场必须从前集收尾瞬间无缝接起 ——

test('prevEnding：焊点块双语齐备，原句透传，不混入 items 指令层', () => {
  const r = continuityBrief({ prevEnding: '她举起那份亲子鉴定，门被一脚踹开。' });
  assert.ok(r.endingBlockZh.startsWith('【前集结尾·本集开场必须从此瞬间无缝接起】'));
  assert.ok(r.endingBlockZh.includes('「她举起那份亲子鉴定，门被一脚踹开。」'));
  assert.ok(r.endingBlockEn.startsWith("[Previous episode's final lines"));
  assert.ok(r.endingBlockEn.includes('MUST pick up from this exact moment'));
  assert.ok(r.endingBlockEn.includes('她举起那份亲子鉴定，门被一脚踹开。'));
  // 焊点不并入 items 指令层（保持 en 层零中文契约可测）
  assert.strictEqual(r.directiveZh, '');
  assert.strictEqual(r.directiveEn, '');
  assert.deepStrictEqual(r.items, []);
  assert.ok(r.endingBlockZh.endsWith('\n') && r.endingBlockEn.endsWith('\n'));
});

test('prevEnding：英文原句时 en 焊点块零中文；空白输入回退为空块', () => {
  const r = continuityBrief({ prevEnding: 'She raises the paternity report as the door bursts open.' });
  assert.ok(!/[\u4e00-\u9fff]/.test(r.endingBlockEn), `en 焊点块含中文: ${r.endingBlockEn}`);
  assert.ok(r.endingBlockEn.includes('She raises the paternity report'));
  // 缺省 / 空白串 → 双语焊点块均为空（旧数据无 ending 字段时零打扰）
  assert.strictEqual(continuityBrief({ prevEnding: null }).endingBlockZh, '');
  assert.strictEqual(continuityBrief({ prevEnding: null }).endingBlockEn, '');
  assert.strictEqual(continuityBrief({ prevEnding: '   \n  ' }).endingBlockZh, '');
});

test('prevEnding 与台账并存：焊点块独立拼装，items 指令层不受影响', () => {
  const r = continuityBrief({
    prevEnding: '雨夜里他把玉佩塞进她手心。',
    prevSecrets: { plants: [{ topic: '身世', plantedInEp: 3, snippet: '' }], revealedTopics: [], epNo: 5 },
  });
  assert.ok(r.directiveZh.includes('【跨集连续性简报'));
  assert.ok(r.directiveZh.includes('身世'));
  assert.ok(!r.directiveZh.includes('雨夜里'), '原句不得混入 items 指令层');
  assert.ok(r.endingBlockZh.includes('雨夜里他把玉佩塞进她手心。'));
});
