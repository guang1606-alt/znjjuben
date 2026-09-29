const test = require('node:test');
const assert = require('node:assert');
const {
  emotionOutlineCheck, payoffChainCheck, villainDepthCheck, powerGrammarCheck,
  payoffTaxonomy, earlyRetention, sainthoodCheck, emotionCraftLint,
} = require('../dist/engine/emotion-craft.js');

test('emotionOutline: 无情绪=P1，四种情绪杂糅提示聚焦，单一主调高分', () => {
  assert.strictEqual(emotionOutlineCheck('他走进房间坐下喝水').level, 'P1');
  const mixed = emotionOutlineCheck('她先委屈被欺负，随后心动脸红，又悬疑藏秘密，最后打脸反击赢了，还哭了');
  assert.ok(mixed.advice.includes('主调'));
  assert.ok(emotionOutlineCheck('她被当众羞辱，强忍委屈，憋着一口气').score >= 80);
});

test('payoffChain: 只写结果没压抑=P1，三步齐不报P1', () => {
  const only = payoffChainCheck('她突然逆袭，瞬间翻盘，轻轻松松就赢了');
  assert.strictEqual(only.level, 'P1');
  assert.ok(only.advice.includes('站队'));
  const full = payoffChainCheck('她被上司抢方案、当众羞辱，本属于她的署名被剥夺，她憋着气，在复盘会上当场甩出九版修改记录，用条款一步步揭穿真相');
  assert.notStrictEqual(full.level, 'P1');
  assert.ok(full.score >= 80);
});

test('villainDepth: 纯坏无三角=P1，三角齐=满分，无反派跳过', () => {
  const flat = villainDepthCheck('反派就是个混蛋，嚣张跋扈，看主角不顺眼，处处使坏', true);
  assert.strictEqual(flat.level, 'P1');
  assert.strictEqual(flat.score, 0);
  const deep = villainDepthCheck('反派为了保护族人信仰正义，早已布局，主角发现的只是他故意露出的一角；他当年失去一切，伤口无法愈合', true);
  assert.strictEqual(deep.score, 100);
  assert.strictEqual(villainDepthCheck('两人日常相处', false).score, 80);
});

test('powerGrammar: 非权谋跳过，权谋满嘴我要=P1，三法则齐高分', () => {
  assert.strictEqual(powerGrammarCheck('普通家庭对话', false).score, 80);
  const blunt = powerGrammarCheck('这场朝堂权谋，我要赢，我要搞死他，我要上位', true);
  assert.strictEqual(blunt.level, 'P1');
  const good = powerGrammarCheck('他不亲自出手，只布局让两派互斗自己当裁判；把边关急报轻轻放在案头，给对方一个无法拒绝的条件，让他为了大局心甘情愿替自己办事', true);
  assert.ok(good.score >= 80);
});

test('payoffTaxonomy: 众人震惊偷懒=P1，分层差异化反应不报P1', () => {
  const lazy = payoffTaxonomy('他亮出身份，众人震惊，全场所有人都惊呆了');
  assert.strictEqual(lazy.issue.level, 'P1');
  assert.ok(lazy.lazyWitness.length >= 1);
  const layered = payoffTaxonomy('死对头后槽牙咬碎血丝渗出，红颜知己呼吸一停眼眶发红，老者手里核桃啪地裂开');
  assert.notStrictEqual(layered.issue.level, 'P1');
  assert.ok(layered.worms.includes(layered.worms.find((w) => w.includes('分层认同'))));
});

test('earlyRetention: 前3集纯铺背景=P1，每集麻烦目标在线=高分', () => {
  const bad = earlyRetention(['从小介绍她的身世背景，多年来一直如此', '继续讲出身来历', '还是背景', '冲突', '冲突']);
  assert.strictEqual(bad.level, 'P1');
  const good = earlyRetention(['婚礼当天被逼离婚，她要反击', '对方继续抢她东西逼她，她想拿回', '她拿出证据决定证明自己']);
  assert.ok(good.score >= 90);
});

test('sainthood: 无底线原谅且反派无代价=P1，付了代价不报', () => {
  assert.strictEqual(sainthoodCheck('她心软放过，算了原谅他，不跟你计较').level, 'P1');
  assert.notStrictEqual(sainthoodCheck('等他身败名裂付出代价后，她才选择放下').level, 'P1');
});

test('emotionCraftLint 聚合返回avg与p1', () => {
  const r = emotionCraftLint({ text: '反派是个混蛋，众人震惊，她突然逆袭瞬间翻盘，最后算了原谅他', isIntrigue: false });
  assert.ok(Array.isArray(r.issues) && r.issues.length >= 4);
  assert.ok(r.p1.length >= 2);
  assert.ok(r.avg >= 0 && r.avg <= 100);
});

test('v1.92 emotion-craft lang=en：英文检测召回 + 全英文建议，零中文；默认中文不变', () => {
  const cjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const bad = 'She explained meekly, forgive him spare him also pitiful, let it go, no one pays the price at all. '.repeat(3);
  const r = emotionCraftLint ? null : null;
  const E = require('../dist/engine/emotion-craft.js');
  const out = E.emotionCraftLint({ text: bad, lang: 'en' });
  assert.ok(!cjk(out.issues));
  assert.ok(out.issues.some((i) => i.rule === 'sainthood'), '圣母化应被英文词召回');
  const z = E.sainthoodCheck('算了，原谅他，放他一马，也是可怜');
  assert.strictEqual(z.dim, '主角圣母化');
});
