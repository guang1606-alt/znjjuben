const test = require('node:test');
const assert = require('node:assert');
const { dialogueLengthScore } = require('../dist/engine/dialogue-length-score.js');

// —— 中文剧本样本 ——

// 高质量剧本：短促有力、长短交替、有交锋
const ZH_HIGH_QUALITY = `
场景：客厅 日 内景
△林晚走进来
林晚：滚！
李明：你凭什么？你知道我为你付出了多少吗？
△林晚摔杯子
林晚：凭我是这家公司的老板。从今天起，你被解雇了。
李明（震惊）：不可能！这不可能！
林晚：今天起，公司是我的。你的股份，你的职位，一切归零。
李明：你疯了？
△林晚转身
林晚：疯了？你才疯了。你以为你能骗我一辈子？
`;

// 台词墙：单条超长对白（>60字）
const ZH_WALL = `
场景：客厅 日 内景
△林晚走进来
林晚：你知道吗，从三年前你背叛我的那天起，我就一直在等这一天。你以为我不知道你和那个女人在一起吗？你以为我不知道你把公司的钱转走了吗？你以为我不知道你一直在骗我吗？现在一切都结束了，你欠我的，今天要还清。
△李明沉默
李明：不是这样的。
`;

// 独白戏：单角色连续4条以上
const ZH_MONOLOGUE = `
场景：客厅 日 内景
△林晚站起来
林晚：你听着。
林晚：从今天起，一切都变了。
林晚：你以为你能骗我一辈子？
林晚：你以为我不知道你和她的关系？
林晚：你以为我不知道你做的那些事？
林晚：现在，该还了。
△李明沉默
`;

// 超长对白占比过高（每条>40字）
const ZH_OVERLONG_RATIO = `
场景：客厅 日 内景
△林晚走进来
林晚：你知道吗，从三年前你背叛我的那天起，我就一直在等这一天，你以为我不知道你和那个女人在一起吗？你以为我不知道你把公司的钱都转走了吗？
李明：你听我解释，事情不是你想的那样，我和她只是普通朋友，真的没什么，你一定要相信我，那天晚上什么都没发生。
林晚：普通朋友？你以为我会信吗？你做的那些事我都知道了，你以为你能骗我一辈子吗？你以为我不知道你的真面目吗？
李明：你误会了，真的误会了，我从来没有想过要伤害你，你是我最重要的人，我怎么可能做出那种事来呢？
林晚：够了，我不想再听你的谎言，今天一切都该结束了，你欠我的，今天必须还清，一分都不能少。
`;

// 无节奏感：全短句
const ZH_NO_RHYTHM_SHORT = `
场景：客厅 日 内景
△林晚走进来
林晚：滚！
李明：不。
林晚：走！
李明：不。
林晚：滚蛋！
李明：不。
林晚：出去！
李明：不。
`;

// 无节奏感：全长句（平均>25字）
const ZH_NO_RHYTHM_LONG = `
场景：客厅 日 内景
△林晚走进来
林晚：你知道吗，我一直以为我们是最亲密的朋友，没想到你竟然会在背后捅我一刀，我真的非常失望。
李明：我从来没有想过要伤害你，那天的事情真的是一个意外，你不能因为这一件事就否定我们多年的感情。
林晚：意外？你以为我会相信这种拙劣的借口吗？我亲眼看到你和那个女人在一起，你还要怎么解释？
李明：你看到的只是事情的表面，你根本不知道那天到底发生了什么，你完全误会我了，你听我解释。
林晚：解释？你还有什么好解释的？事实就摆在这里，你不需要再说什么了，我已经看透了你的真面目。
李明：你为什么就不愿意给我一个机会呢？我们这么多年的感情，难道就因为这一件事就要全部归零吗？
`;

// 低质量问题：对白过少
const ZH_TOO_FEW = `
场景：客厅 日 内景
△林晚走进来，沉默
林晚：嗯。
△李明沉默
`;

// —— 英文剧本样本 ——

// 英文高质量
const EN_HIGH_QUALITY = `
Scene: Living room, Day, Interior
Lin walks in.
Lin: Get out!
Li: Why?
Lin slams a cup.
Lin: Because I own this place.
Li (shocked): Impossible!
Lin: As of today, it's mine.
Li: You're crazy?
Lin turns.
Lin: Crazy? You're the one who's crazy.
`;

// 英文台词墙
const EN_WALL = `
Scene: Office, Day, Interior
Lin walks in.
Lin: You know what, from the day you betrayed me three years ago, I have been waiting for this moment. Did you think I didn't know about you and that woman? Did you think I didn't know you transferred the company's money? Did you think I didn't know you've been lying to me all along? Now it's all over, and you owe me everything you took.
Li remains silent.
Li: That's not how it was.
`;

test('中文高质量剧本应得高分（短促有力、长短交替）', () => {
  const res = dialogueLengthScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.score >= 70, `高质量剧本分数应≥70，实际${res.score}`);
  assert.strictEqual(res.wallHits.length, 0, '不应有台词墙');
  assert.ok(res.hasRhythm, '应有长短交替节奏');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('台词墙（>60字）应触发 high 级问题', () => {
  const res = dialogueLengthScore(ZH_WALL, 'zh');
  assert.ok(res.wallHits.length >= 1, `应有≥1条台词墙，实际${res.wallHits.length}`);
  assert.ok(res.maxLength > 60, `最长对白应>60字，实际${res.maxLength}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'dialogue_wall'), '应有 dialogue_wall 问题');
  assert.ok(res.score < 80, `台词墙分数应<80，实际${res.score}`);
});

test('独白戏（单角色连续4条+）应被识别', () => {
  const res = dialogueLengthScore(ZH_MONOLOGUE, 'zh');
  assert.ok(res.monologueHits.length >= 1, `应有≥1处独白戏，实际${res.monologueHits.length}`);
  const serious = res.monologueHits.find((m) => m.consecutiveCount >= 4);
  assert.ok(serious, '应有4条+连续独白');
  assert.ok(serious.consecutiveCount >= 4, `连续条数应≥4，实际${serious.consecutiveCount}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'monologue_serious'), '应有 monologue_serious 问题');
});

test('超长对白占比过高应触发问题', () => {
  const res = dialogueLengthScore(ZH_OVERLONG_RATIO, 'zh');
  assert.ok(res.overLongCount >= 3, `应有≥3条超长对白，实际${res.overLongCount}`);
  assert.ok(res.overLongRatio > 0.15, `超长占比应>15%，实际${(res.overLongRatio * 100).toFixed(0)}%`);
  const issues = res.issues.filter((i) => i.type.startsWith('overlong_ratio'));
  assert.ok(issues.length >= 1, '应有 overlong_ratio 问题');
});

test('全短句是好节奏（不应判为无节奏）', () => {
  const res = dialogueLengthScore(ZH_NO_RHYTHM_SHORT, 'zh');
  assert.ok(res.distribution.short >= 5, `短句应≥5条，实际${res.distribution.short}`);
  // 全短句是好节奏（短剧理想状态），不应判为无节奏
  assert.ok(res.hasRhythm, '全短句应是好节奏，不应判为无节奏');
  const rhythmIssues = res.issues.filter((i) => i.type === 'no_rhythm');
  assert.strictEqual(rhythmIssues.length, 0, '全短句不应有 no_rhythm 问题');
});

test('全长句无节奏感应被识别', () => {
  const res = dialogueLengthScore(ZH_NO_RHYTHM_LONG, 'zh');
  assert.ok(res.avgLength > 25, `平均长度应>25，实际${res.avgLength}`);
  assert.ok(!res.hasRhythm, '全长句应判定为无节奏');
  const rhythmIssues = res.issues.filter((i) => i.type === 'no_rhythm');
  assert.ok(rhythmIssues.length >= 1, '应有 no_rhythm 问题');
});

test('对白过少应被识别', () => {
  const res = dialogueLengthScore(ZH_TOO_FEW, 'zh');
  assert.ok(res.totalLines < 4, `对白条数应<4，实际${res.totalLines}`);
  const fewIssues = res.issues.filter((i) => i.type === 'too_few_dialogues');
  assert.ok(fewIssues.length >= 1, '应有 too_few_dialogues 问题');
});

test('长度分类应正确', () => {
  const res = dialogueLengthScore(ZH_HIGH_QUALITY, 'zh');
  // 检查至少有短句和中句
  assert.ok(res.distribution.short >= 1, `应有≥1条短句，实际${res.distribution.short}`);
  assert.ok(res.distribution.medium >= 1 || res.distribution.long >= 1, '应有≥1条中句或长句');
});

test('平均长度应正确计算', () => {
  const res = dialogueLengthScore(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.avgLength > 0, `平均长度应>0，实际${res.avgLength}`);
  assert.ok(res.avgLength <= 25, `高质量剧本平均长度应≤25，实际${res.avgLength}`);
});

test('英文高质量剧本应得高分', () => {
  const res = dialogueLengthScore(EN_HIGH_QUALITY, 'en');
  assert.ok(res.score >= 70, `英文高质量剧本分数应≥70，实际${res.score}`);
  assert.strictEqual(res.wallHits.length, 0, '英文不应有台词墙');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `英文不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('英文台词墙应触发 high 级问题', () => {
  const res = dialogueLengthScore(EN_WALL, 'en');
  assert.ok(res.wallHits.length >= 1, `英文应有≥1条台词墙，实际${res.wallHits.length}`);
  assert.ok(res.maxLength > 60, `英文最长对白应>60等效字数，实际${res.maxLength}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'dialogue_wall'), '英文应有 dialogue_wall 问题');
});

test('英文管道零中文（advice 应为英文）', () => {
  const res = dialogueLengthScore(EN_WALL, 'en');
  const wallIssue = res.issues.find((i) => i.type === 'dialogue_wall');
  if (wallIssue) {
    assert.ok(/^[A-Za-z]/.test(wallIssue.advice), `英文 advice 应以字母开头，实际"${wallIssue.advice.slice(0, 20)}"`);
    assert.ok(!/[一-龥]/.test(wallIssue.advice), `英文 advice 不应含中文，实际"${wallIssue.advice.slice(0, 40)}"`);
  }
});

test('分布占比应正确计算', () => {
  const res = dialogueLengthScore(ZH_HIGH_QUALITY, 'zh');
  const total = res.distribution.short + res.distribution.medium + res.distribution.long + res.distribution.extra_long + res.distribution.wall;
  assert.ok(total === res.totalLines, `分布总数应等于对白总数，实际${total}≠${res.totalLines}`);
  const ratioSum = res.ratios.short + res.ratios.medium + res.ratios.long + res.ratios.extra_long + res.ratios.wall;
  assert.ok(Math.abs(ratioSum - 1) < 0.01, `占比和应≈1，实际${ratioSum}`);
});
