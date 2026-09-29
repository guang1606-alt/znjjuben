const test = require('node:test');
const assert = require('node:assert');
const { pickEpisodeForFix, buildFixPrompt, isUsableRewrite } = require('../dist/engine/polish-fix');
const { craftLint } = require('../dist/engine/craft-lint');

// 造一集“问题文本”：大量 AI 书面腔/通用反应，稳定触发 craft 尺子
function badEp(epNo) {
  const line = '他不禁陷入了沉思，心中五味杂陈，仿佛整个世界都静止了，眼眶微微湿润，嘴角勾起一抹不易察觉的弧度，缓缓开口说道。';
  return { epNo, content: Array(12).fill(line).join('') };
}
function goodEp(epNo) {
  return {
    epNo,
    content: '第' + epNo + '集 摊牌\n场景：傍晚·小面馆·内\n人物：老周、小林\n老周（把钥匙拍在桌上）：面钱下回给。\n小林（没抬头）：你上回也这么说。\n老周手一顿，把钥匙又攥回兜里。门外电动车喇叭响了两声，他扭头去看。\n小林（低声）：想走就走，别演。\n老周（笑了下，发苦）：就你眼睛毒。\n他到底坐了回去，端起那碗坨了的面，一口一口吃完。\n小林收碗，指尖在桌沿敲了两下：后天我妈过来，你躲不躲。\n老周（闷声）：不躲，欠的总得认。\n门外风把塑料帘子吹起来，他望着对面关了门的彩票店，半天没动筷子。',
  };
}

test('pickEpisodeForFix: 空输入兜底第1集不崩', () => {
  assert.deepStrictEqual(pickEpisodeForFix([], 'x'), { epNo: 1, score: null });
});

test('pickEpisodeForFix: 无任何集命中该规则时兜底第一集', () => {
  const r = pickEpisodeForFix([goodEp(3), goodEp(4)], 'rule_that_never_exists');
  assert.strictEqual(r.epNo, 3);
  assert.strictEqual(r.score, null);
});

test('pickEpisodeForFix: 能从两集中定位到问题更严重的那一集', () => {
  // 选一条“问题集确实比健康集更差”的规则，避免写死规则名/误选并列项
  const bad = badEp(7);
  const good = goodEp(1);
  const badIssues = craftLint({ episodes: [bad.content], text: bad.content }).issues;
  const goodMap = new Map(craftLint({ episodes: [good.content], text: good.content }).issues.map((i) => [i.rule, i.score]));
  const cand = badIssues.find((i) => typeof goodMap.get(i.rule) === 'number' && goodMap.get(i.rule) > i.score);
  assert.ok(cand, '应存在一条问题集更差的规则');
  const r = pickEpisodeForFix([good, bad], cand.rule);
  assert.strictEqual(r.epNo, 7, '应定位到问题集第7集');
  assert.ok(typeof r.score === 'number');
});

test('buildFixPrompt: 中文指令包含问题、维度与原稿，且要求输出完整修订版', () => {
  const p = buildFixPrompt('原稿内容XYZ', { rule: 'cliffhanger', dimLabel: '剧情', advice: '结尾必须留钩子' }, { castNames: ['老周', '小林'] });
  assert.ok(p.includes('结尾必须留钩子'));
  assert.ok(p.includes('剧情'));
  assert.ok(p.includes('原稿内容XYZ'));
  assert.ok(p.includes('老周'));
  assert.ok(p.includes('完整'));
});

test('buildFixPrompt: 英文模式输出英文指令', () => {
  const p = buildFixPrompt('ORIG', { rule: 'x', dimLabel: 'Plot', advice: 'add a hook' }, { lang: 'en' });
  assert.ok(/senior vertical-short-drama script doctor/i.test(p));
  assert.ok(p.includes('add a hook'));
});

test('isUsableRewrite: 识别可用与不可用改写', () => {
  const orig = goodEp(1).content;
  assert.strictEqual(isUsableRewrite('太短', orig), false);
  assert.strictEqual(isUsableRewrite('抱歉，我无法改写这个内容。'.repeat(10), orig), false);
  assert.ok(isUsableRewrite(goodEp(2).content, orig) === true);
  // 严重注水（远超原稿2.2倍）判不可用
  assert.strictEqual(isUsableRewrite(orig.repeat(4), orig), false);
});
