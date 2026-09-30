'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const proxy = require('../dist/lib/model-proxy.js');
const { runEpisode } = require('../dist/agents/pipeline.js');
const emptyBible = () => ({ worldview: '', characters: {}, timeline: [], foreshadow: [] });
const sandbox = () => ({ text: '', tokensIn: 0, tokensOut: 0, costFen: 0, sandbox: true });
const response = (text) => ({ text, tokensIn: 1, tokensOut: 1, costFen: 1 });

test('合规模型否决后不交付、不发完成事件、不推进跨集时间线', async () => {
  const original = proxy.callText;
  const events = [];
  const bible = emptyBible();
  proxy.callText = async (_tier, role) => role === 'compliance'
    ? response(JSON.stringify({ pass: false, risks: ['audit rejection'] })) : sandbox();
  try {
    await assert.rejects(runEpisode('economy', bible, '保洁工逆袭', e => events.push(e), { mode: 'tag' }), /COMPLIANCE_REJECTED/);
    assert.equal(events.some(e => e.role === 'done'), false);
    assert.deepEqual(bible.timeline, []);
    assert.deepEqual(bible.foreshadow, []);
  } finally { proxy.callText = original; }
});

test('末轮字数改稿的全部诊断、评分与台账以实际交付稿为准', async () => {
  const original = proxy.callText;
  try {
    proxy.callText = async () => sandbox();
    const baseline = await runEpisode('economy', emptyBible(), '保洁工逆袭', () => {}, { mode: 'tag' });
    const finalDraft = baseline.draft.replace('△', '△林晚怀孕了。林晚嘴角勾起一抹弧度，不禁五味杂陈，心中一紧。');
    const shortDraft = '场景：办公室 日 内景\n' + ('△林晚把账本放在桌上，陈总指着流水。\n林晚：你先看完这些记录，再告诉我昨晚你在哪里。\n陈总：我一直在公司，楼下保安可以作证。\n').repeat(4);
    proxy.callText = async (_tier, role, prompt) => role === 'writer' ? response(shortDraft)
      : role === 'polisher' && prompt.includes('制式字数修正：') ? response(finalDraft) : sandbox();
    const repaired = await runEpisode('economy', emptyBible(), '保洁工逆袭', () => {}, { mode: 'tag' });
    assert.equal(repaired.draft, finalDraft);
    assert.equal(repaired.antiAi.hitCount, 6);
    assert.equal(repaired.antiAi.pass, false);
    assert.equal(repaired.stateLedger.nextState.onsets.some(o => o.state === 'pregnant'), true);
    // 相同成稿直接进入主管线，应得到相同终稿诊断；中间的短稿不能污染终稿结果。
    proxy.callText = async (_tier, role) => role === 'writer' ? response(finalDraft) : sandbox();
    const direct = await runEpisode('economy', emptyBible(), '保洁工逆袭', () => {}, { mode: 'tag' });
    assert.equal(direct.draft, finalDraft);
    for (const field of ['antiAi', 'craftLint', 'craftDepth', 'stateLedger', 'secretLedger', 'foreshadow', 'arcTrack', 'character', 'rhythm', 'openingCheck', 'epThreeQ', 'cliffhanger', 'scorecard', 'recap']) {
      assert.deepEqual(repaired[field], direct[field], field + ' must describe the delivered draft');
    }
    assert.deepEqual(repaired.fixLoop.after, direct.fixLoop.after);
  } finally { proxy.callText = original; }
});
