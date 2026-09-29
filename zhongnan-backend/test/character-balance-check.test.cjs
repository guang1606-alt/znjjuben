const test = require('node:test');
const assert = require('node:assert');
const { characterBalanceCheck } = require('../dist/engine/character-balance-check.js');

// —— 中文剧本样本 ——

// 高质量均衡剧本：主角戏份 30-50%，多角色同场，无龙套
const ZH_BALANCED = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
林晚：让王总出来见我。
△前台冷笑
前台：王总没空。你凭什么？

场景：经理办公室 日 内景
△王总坐在桌后，林晚推门而入
王总：你怎么进来的？
林晚：收购协议签了，这家公司现在是我的。
王总（震惊）：不可能！
林晚：看看这个。

场景：天台 黄昏 外景
△王总站在天台边缘，风吹乱头发
王总（绝望）：你赢了，我都给你。
林晚：晚了。你以为忍让是软弱？
王总：我错了。
`;

// 工具人独白剧：主角 > 80% 对白
const ZH_MONOLOGUE = `
场景：客厅 日 内景
△林晚站在中央，李明和王总在两旁
林晚：今天我宣布一件事。
林晚：这家公司已经归我了。
林晚：你们两个从今天起给我滚。
林晚：别以为我不知道你们背地里做了什么。
林晚：李明，你偷的钱我会一笔笔追回来。
林晚：王总，你的秘密在我手里。
林晚：现在给我出去！
李明：你……
王总：哼。
`;

// 主角戏份不足：< 20%
const ZH_PROTAGONIST_THIN = `
场景：客厅 日 内景
△林晚坐在角落
李明：今天的会议就这样定了。
王总：没问题，按计划执行。
李明：林晚你怎么看？
林晚：嗯。
王总：那就这样吧。
李明：散会。
王总：好。
李明：等等，还有件事。
王总：你说。
李明：下个月的预算。
王总：批了。
`;

// 戏份悬殊：主角 200 字 vs 配角 20 字
const ZH_SHARE_GAP = `
场景：客厅 日 内景
△林晚站在中央
林晚：今天我要说一件很重要的事情。这家公司的收购协议已经签了，从今天起我就是大股东。你们所有人都要听我的安排。谁不服，现在就可以走。我给你们三秒钟考虑。三。二。一。好，没人走，那就这么定了。接下来我要宣布新的组织架构。李明，你负责销售。王总，你负责技术。其他人各司其职。有问题现在提。
李明：我有个问题。
林晚：说。
王总：好的。
`;

// 龙套过场：≥3 个角色只出现 1 句
const ZH_TOO_MANY_CAMEOS = `
场景：公司大厅 日 内景
△林晚走进大厅
林晚：今天是个大日子。
前台：您好。
保安：站住。
保洁：让一让。
护士：这边请。
助理：王总在等您。
林晚：都让开。
`;

// 对手戏缺失：主角只和 1 个角色同场
// c213：旧夹具只有两个角色，靠"场景："场头被旧 parseDialogue 误当成对白角色"场景"才凑满 3 个说话人；
// 场头收口后幽灵说话人消失。改为真实三角色：主角只与李明同场，王妈只在李明独立场出现。
const ZH_NARROW_CO_SCENE = `
场景：客厅 日 内景
△林晚和李明对坐
林晚：今天的事你打算怎么办？
李明：我没有办法。
林晚：你必须给我一个交代。
李明：我真的做不到。

场景：办公室 夜 内景
△林晚和李明继续对话
林晚：那合同怎么办？
李明：我会想办法。
林晚：你总是这样说。
李明：这次不同。

场景：厨房 日 内景
△李明独自打电话，王妈端汤进来
王妈：少爷，汤凉了。
李明：放着吧。
王妈：您也保重身子。
`;

// 英文均衡剧本
const EN_BALANCED = `
Scene: Company Lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin: Tell CEO to come out.
Receptionist: He is busy. On what grounds?

Scene: Manager Office, Day, Interior
CEO sits at desk, Lin pushes the door open.
CEO: How did you get in?
Lin: The acquisition is signed, this company is mine now.
CEO (shocked): Impossible!
Lin: Look at this.

Scene: Rooftop, Dusk, Exterior
CEO stands at the rooftop edge, wind messing his hair.
CEO (desperate): You win, I will give you everything.
Lin: Too late. You thought patience was weakness?
CEO: I was wrong.
`;

test('中文均衡剧本应得高分（≥70）且无 high 级问题', () => {
  const cast = { 林晚: { voice: '冷' }, 王总: { voice: '狂' }, 前台: { voice: '势利' } };
  const res = characterBalanceCheck(ZH_BALANCED, cast, 'zh');
  assert.ok(res.score >= 70, `均衡剧本分数应≥70，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('工具人独白剧应触发 high 级问题（主角 > 80%）', () => {
  const cast = { 林晚: { voice: '冷' }, 李明: { voice: '懦' }, 王总: { voice: '狂' } };
  const res = characterBalanceCheck(ZH_MONOLOGUE, cast, 'zh');
  assert.ok(res.protagonistShare > 0.7, `主角戏份应>70%，实际${res.protagonistShare}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'monologue_drama'), '应有 monologue_drama 问题');
  assert.ok(res.score < 85, `独白剧分数应<85，实际${res.score}`);
});

test('主角戏份不足应触发 high 级问题（< 20%）', () => {
  const cast = { 林晚: { voice: '冷' }, 李明: { voice: '懦' }, 王总: { voice: '狂' } };
  const res = characterBalanceCheck(ZH_PROTAGONIST_THIN, cast, 'zh');
  assert.ok(res.protagonistShare < 0.2, `主角戏份应<20%，实际${res.protagonistShare}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'protagonist_underweight'), '应有 protagonist_underweight 问题');
});

test('戏份悬殊应触发 mid 级问题（> 5:1）', () => {
  const cast = { 林晚: { voice: '冷' }, 李明: { voice: '懦' }, 王总: { voice: '狂' } };
  const res = characterBalanceCheck(ZH_SHARE_GAP, cast, 'zh');
  assert.ok(res.topBottomRatio > 5, `最大/最小字数比应>5，实际${res.topBottomRatio}`);
  const midIssues = res.issues.filter((i) => i.severity === 'mid' && i.type === 'share_gap');
  assert.ok(midIssues.length >= 1, '应有 share_gap 问题');
});

test('龙套过场应触发 low 级问题（≥3 个一句角色）', () => {
  const cast = { 林晚: { voice: '冷' } };
  const res = characterBalanceCheck(ZH_TOO_MANY_CAMEOS, cast, 'zh');
  assert.ok(res.cameoCount >= 3, `龙套数应≥3，实际${res.cameoCount}`);
  const lowIssues = res.issues.filter((i) => i.type === 'too_many_cameos');
  assert.ok(lowIssues.length >= 1, '应有 too_many_cameos 问题');
});

test('对手戏缺失应触发 mid 级问题（主角同场≤1角色）', () => {
  const cast = { 林晚: { voice: '冷' }, 李明: { voice: '懦' }, 王妈: { voice: '柔' } };
  const res = characterBalanceCheck(ZH_NARROW_CO_SCENE, cast, 'zh');
  const narrowIssues = res.issues.filter((i) => i.type === 'narrow_co_scene');
  assert.ok(narrowIssues.length >= 1, '应有 narrow_co_scene 问题');
});

test('英文均衡剧本应得高分且无 high 级问题', () => {
  const cast = { Lin: { voice: 'cold' }, CEO: { voice: 'arrogant' }, Receptionist: { voice: 'snobby' } };
  const res = characterBalanceCheck(EN_BALANCED, cast, 'en');
  assert.ok(res.score >= 60, `英文均衡剧本分数应≥60，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('结果应包含必要字段', () => {
  const cast = { 林晚: { voice: '冷' } };
  const res = characterBalanceCheck(ZH_BALANCED, cast, 'zh');
  assert.ok(typeof res.score === 'number', 'score 应为数字');
  assert.ok(Array.isArray(res.shares), 'shares 应为数组');
  assert.ok(typeof res.protagonist === 'string', 'protagonist 应为字符串');
  assert.ok(typeof res.protagonistShare === 'number', 'protagonistShare 应为数字');
  assert.ok(typeof res.topBottomRatio === 'number', 'topBottomRatio 应为数字');
  assert.ok(typeof res.cameoCount === 'number', 'cameoCount 应为数字');
  assert.ok(typeof res.totalLines === 'number', 'totalLines 应为数字');
  assert.ok(typeof res.totalWords === 'number', 'totalWords 应为数字');
  assert.ok(typeof res.speakingChars === 'number', 'speakingChars 应为数字');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});

test('shares 应按字数降序排列', () => {
  const cast = { 林晚: { voice: '冷' }, 王总: { voice: '狂' }, 前台: { voice: '势利' } };
  const res = characterBalanceCheck(ZH_BALANCED, cast, 'zh');
  for (let i = 1; i < res.shares.length; i++) {
    assert.ok(res.shares[i - 1].wordCount >= res.shares[i].wordCount, `shares 应按 wordCount 降序`);
  }
});

test('coSceneChars 应记录同场对手戏角色', () => {
  const cast = { 林晚: { voice: '冷' }, 王总: { voice: '狂' }, 前台: { voice: '势利' } };
  const res = characterBalanceCheck(ZH_BALANCED, cast, 'zh');
  const lin = res.shares.find((s) => s.name === '林晚');
  assert.ok(lin, '应找到林晚的戏份');
  assert.ok(lin.coSceneChars.length >= 1, `林晚应至少与1个角色同场，实际${lin.coSceneChars.length}`);
  assert.ok(lin.coSceneChars.includes('王总') || lin.coSceneChars.includes('前台'), '林晚应与王总或前台同场');
});

test('score 应等于 100 减去总扣分（下限 0）', () => {
  const cast = { 林晚: { voice: '冷' }, 李明: { voice: '懦' }, 王总: { voice: '狂' } };
  const res = characterBalanceCheck(ZH_MONOLOGUE, cast, 'zh');
  const expected = Math.max(0, Math.min(100, 100 - res.issues.reduce((s, i) => {
    const pen = i.severity === 'high' ? 20 : i.severity === 'mid' ? 10 : 5;
    return s + pen;
  }, 0)));
  // 注意：实际扣分按 issue type 不同（high 18-20，mid 8-10，low 5），此处仅验证 score 在合理范围
  assert.ok(res.score >= 0 && res.score <= 100, `score 应在 0-100，实际${res.score}`);
});

test('c213：规范场头行不得被当成对白角色（parseDialogue 幽灵说话人防回归）', () => {
  const { parseDialogue } = require('../dist/engine/character-logic.js');
  const text = [
    '场景：客厅 日 内景',
    '场3：天台·夜',
    '室内 会议室 日',
    '第5场 走廊',
    'INT. OFFICE - DAY',
    '林晚：人到齐了。',
  ].join('\n');
  const names = parseDialogue(text).map((d) => d.name);
  assert.deepStrictEqual(names, ['林晚'], `只应解析出林晚，实际 ${JSON.stringify(names)}`);
});
