/* v2.353 跨集台词复读检测引擎 TDD（先红后绿）
 * 盲区：scene-padding 管集内 recap 注水词；cliffhanger-payoff 管钩子必须复现（反向）；
 * 无人管「上集说过的台词本集原样再说一遍」——追更付费用户最敏感「这段我看过」。
 * 口径：相邻两集（prevEpisode.summary≈上集全文），台词行归一相等，zh≥12 字 / en≥20 字母才比对；
 * 长句 zh≥30/en≥50 单条 high；同一句本集多次复读只报一次。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { episodeReplayCheck } = require('../dist/engine/episode-replay-check');

// ── 上集（prevEpisode.summary 模拟，≥20 字）──
const ZH_PREV = `场1 林家客厅 日内
林晚：妈，我回来了。
林母：我们之间的恩怨今天必须做个了断。
林晚：妈，你听我解释。
林母：解释什么你还有什么好解释的！
林晚：当年是爸爸自己选择离开这个家，我从来没有背叛过你，为什么就是不肯相信我。
林母：你走吧。
△林晚站在门口，雨水打湿了肩膀。`;
// 复读靶句：SHORT「我们之间的恩怨今天必须做个了断」15 字；SHORT2「解释什么你还有什么好解释的」13 字；
// LONG「当年是爸爸自己选择离开这个家我从来没有背叛过你为什么就是不肯相信我」33 字；TINY「你走吧」3 字

// ── 本集：全新台词（健康稿）──
const ZH_DRAFT_HEALTHY = `场1 林家客厅 日内
林晚：妈，这次我把当年的证据全都带回来了。
林母：什么证据能改变这十年的事实？
林晚：父亲的日记本，里面写清楚了当年的真相。
△林晚从包里拿出一个旧本子。`;

test('1 无上集 prevSummary 空串 → checked=false 满分放行', () => {
  const r = episodeReplayCheck('', ZH_DRAFT_HEALTHY);
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
  assert.equal(r.issues.length, 0);
});

test('2 上集 <20 字 → checked=false', () => {
  const r = episodeReplayCheck('林晚：妈。', ZH_DRAFT_HEALTHY);
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
});

test('3 本集 <20 字 → checked=false', () => {
  const r = episodeReplayCheck(ZH_PREV, '林晚：妈。');
  assert.equal(r.checked, false);
  assert.equal(r.score, 100);
});

test('4 健康稿：本集台词全新 → 满分零 issue，compared=3', () => {
  const r = episodeReplayCheck(ZH_PREV, ZH_DRAFT_HEALTHY);
  assert.equal(r.checked, true);
  assert.equal(r.score, 100);
  assert.equal(r.replayCount, 0);
  assert.equal(r.compared, 3);
  assert.equal(r.issues.length, 0);
});

test('5 一句短复读（15 字）→ mid 扣 10，evidence 含行号与原文', () => {
  const draft = `场1 林家客厅 日内
林晚：妈，这次我把当年的证据全都带回来了。
林母：我们之间的恩怨今天必须做个了断。
△林晚愣在原地。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 1);
  assert.equal(r.score, 90);
  assert.equal(r.issues[0].severity, 'mid');
  assert.equal(r.issues[0].type, 'episode_replay_line');
  assert.match(r.issues[0].evidence, /第3行/);
  assert.match(r.issues[0].evidence, /我们之间的恩怨/);
  assert.ok(r.issues[0].advice.length > 10);
});

test('6 一句长复读（33 字）→ high 扣 22', () => {
  const draft = `场1 林家客厅 日内
林晚：当年是爸爸自己选择离开这个家，我从来没有背叛过你，为什么就是不肯相信我。
林母：你说的这些我一句都不想听。
△林晚泪流满面。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 1);
  assert.equal(r.score, 78);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'episode_replay_long');
});

test('7 两句短复读 → 扣 20（90→80）', () => {
  const draft = `场1 林家客厅 日内
林母：我们之间的恩怨今天必须做个了断。
林晚：妈，你听我解释。
林母：解释什么你还有什么好解释的！
△林晚愣在原地。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 2);
  assert.equal(r.score, 80);
});

test('8 混合 1 长 2 短 → 100-22-10-10=58', () => {
  const draft = `场1 林家客厅 日内
林晚：当年是爸爸自己选择离开这个家，我从来没有背叛过你，为什么就是不肯相信我。
林母：我们之间的恩怨今天必须做个了断。
林晚：妈，你听我解释。
林母：解释什么你还有什么好解释的！
△林晚愣在原地。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 3);
  assert.equal(r.score, 58);
});

test('9 短句豁免：「你走吧」上集说过本集再说 → 不报', () => {
  const draft = `场1 林家客厅 日内
林母：你走吧。
林晚：妈，这次我不会再走了，我要留下来照顾你。
△林母转过身去。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 0);
  assert.equal(r.score, 100);
});

test('10 同一句本集复读两次只报一次', () => {
  const draft = `场1 林家客厅 日内
林母：我们之间的恩怨今天必须做个了断。
林晚：妈，你听我解释。
林母：我们之间的恩怨，今天必须做个了断！
△林晚愣在原地。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 1);
  assert.equal(r.score, 90);
});

test('11 场头同地名不算复读（场头/动作行不参与比对）', () => {
  const draft = `场1 林家客厅 日内
林晚：爸的忌日我每年都会记得回来看你。
林母：回来就好，饭菜都给你热着呢。
△林晚站在门口，泪水打湿了眼眶。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 0);
  assert.equal(r.score, 100);
});

test('12 标点归一：上集带句号本集带逗号感叹号 → 仍判复读', () => {
  const draft = `场1 林家客厅 日内
林母：我们之间的恩怨，今天必须做个了断！
林晚：妈，这次我不会再走了，我要留下来照顾你。
△林母转过身去。`;
  const r = episodeReplayCheck(ZH_PREV, draft);
  assert.equal(r.replayCount, 1);
  assert.equal(r.score, 90);
});

const EN_PREV = `Scene 1 - LIVING ROOM - DAY
EMMA: Mom, I am back.
MOTHER: I never betrayed this family, why won't you just believe me.
EMMA: Let it go.
MOTHER: Get out of my house right now and never come back again.
△Emma stands at the door in the rain.`;
// EN 复读靶句：「I never betrayed this family, why won't you just believe me」归一 48 字母 ≥20 → mid

test('13 EN：一句复读（≥20 字母）→ mid 扣 10', () => {
  const draft = `Scene 1 - LIVING ROOM - DAY
EMMA: I never betrayed this family, why won't you just believe me!
MOTHER: This time I brought back all the evidence from that year.
△Emma bursts into tears.`;
  const r = episodeReplayCheck(EN_PREV, draft, 'en');
  assert.equal(r.checked, true);
  assert.equal(r.replayCount, 1);
  assert.equal(r.score, 90);
  assert.equal(r.issues[0].type, 'episode_replay_line');
  assert.match(r.issues[0].evidence, /Line 2/);
});

test('14 EN：短句豁免（<20 字母）', () => {
  const draft = `Scene 1 - LIVING ROOM - DAY
EMMA: Let it go.
MOTHER: This time I brought back all the evidence from that year.
△Emma stays.`;
  const r = episodeReplayCheck(EN_PREV, draft, 'en');
  assert.equal(r.replayCount, 0);
  assert.equal(r.score, 100);
});

test('15 畸形输入 null/undefined/空白 → 不崩溃 checked=false', () => {
  for (const bad of [null, undefined, '', '   ']) {
    const r = episodeReplayCheck(bad, ZH_DRAFT_HEALTHY);
    assert.equal(r.checked, false);
    assert.equal(r.score, 100);
  }
  const r2 = episodeReplayCheck(ZH_PREV, null);
  assert.equal(r2.checked, false);
  assert.equal(r2.score, 100);
});

test('16 结构字段齐全 + score clamp 0（5 条长复读 → 100-110→0）', () => {
  const prev = `场1 林家客厅 日内
林晚：当年是爸爸自己选择离开这个家我从来没有背叛过你为什么就是不肯相信我。
林母：这十年来我没有一天不在想念你也没有一天不在后悔当初做出的那个决定。
林晚：爸爸临终前拉着我的手说他这辈子最对不起的人就是你和妈妈两个人。
林母：你以为我这十年在外面过得好吗我每天都在想回家可是我没有脸面回来见你。
林晚：如果可以重来一次我宁愿放弃外面所有的一切也要留在你和爸爸身边。
△林晚站在门口。`;
  const draft = `场1 林家客厅 日内
林晚：当年是爸爸自己选择离开这个家我从来没有背叛过你为什么就是不肯相信我。
林母：这十年来我没有一天不在想念你也没有一天不在后悔当初做出的那个决定。
林晚：爸爸临终前拉着我的手说他这辈子最对不起的人就是你和妈妈两个人。
林母：你以为我这十年在外面过得好吗我每天都在想回家可是我没有脸面回来见你。
林晚：如果可以重来一次我宁愿放弃外面所有的一切也要留在你和爸爸身边。
△林晚泪流满面。`;
  const r = episodeReplayCheck(prev, draft);
  assert.equal(r.replayCount, 5);
  assert.equal(r.score, 0);
  for (const k of ['score', 'checked', 'replayCount', 'compared', 'issues']) assert.ok(k in r, `缺字段 ${k}`);
  for (const i of r.issues) {
    for (const k of ['severity', 'type', 'evidence', 'advice']) assert.ok(k in i, `issue 缺字段 ${k}`);
    assert.equal(i.severity, 'high');
    assert.equal(i.type, 'episode_replay_long');
  }
});
