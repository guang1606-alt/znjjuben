const test = require('node:test');
const assert = require('node:assert');
const { voicePrint } = require('../dist/engine/voice-print.js');

// 模拟一段对白同质化的剧本（三个角色说话方式高度相似——句长/句式/语气词/书面词全重合）
const HOMO_SCRIPT = `
场景：公司会议室 日 内景
△李明走进会议室，拉开椅子坐下
李明（冷静）：我们必须在本周内完成这个项目，否则会影响整体进度。
王刚（冷静）：我们必须在本周内完成这个项目，否则会影响整体进度。
张伟（冷静）：我们必须在本周内完成这个项目，否则会影响整体进度。
△三人互相看了看，气氛有些凝重
李明（冷静）：我们应该尽快制定计划，然后分配任务。
王刚（冷静）：我们应该尽快制定计划，然后分配任务。
张伟（冷静）：我们应该尽快制定计划，然后分配任务。
`;

// 模拟一段角色声音差异化的剧本
const DIVERSE_SCRIPT = `
场景：小巷 夜 外景
△小混混拦住去路
阿飞（嚣张）：喂！小子！留下钱再走！
老教授（颤抖）：这……这是干什么？你们不能这样……
小妹（急）：快跑啊！别跟他们废话！
△阿飞拍了拍手里的棍子
阿飞（大笑）：哈哈哈！跑？往哪跑？
老教授（哽咽）：求求你们……我老伴还在医院等着我……
小妹（吼）：报警！我报警了啊！
`;

// 英文版对白同质化剧本（三角色对白完全相同）
// 注意：英文链路仍用中文括号标注情绪，且角色名为无空格单词——这是 parseDialogue 的解析约定
const HOMO_SCRIPT_EN = `
SCENE: Office boardroom, day, INT
△Li enters and sits down
Li（calm）: We must complete this project within this week, otherwise it will affect the overall progress.
Wang（calm）: We must complete this project within this week, otherwise it will affect the overall progress.
Zhang（calm）: We must complete this project within this week, otherwise it will affect the overall progress.
△The three exchange glances, the atmosphere is somewhat heavy
Li（calm）: We should make a plan quickly and then assign tasks to everyone.
Wang（calm）: We should make a plan quickly and then assign tasks to everyone.
Zhang（calm）: We should make a plan quickly and then assign tasks to everyone.
`;

test('对白同质化剧本应检出 high 级问题', () => {
  const cast = {
    '李明': { voice: '冷静' },
    '王刚': { voice: '冷静' },
    '张伟': { voice: '冷静' },
  };
  const res = voicePrint(cast, HOMO_SCRIPT, 'zh');
  assert.ok(res.issues.length > 0, '应检出问题');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length > 0, '应存在 high 级问题');
  assert.ok(res.score < 100, '同质化剧本得分应低于100');
});

test('角色声音差异化剧本应无 high 级问题', () => {
  const cast = {
    '阿飞': { voice: '嚣张' },
    '老教授': { voice: '颤抖' },
    '小妹': { voice: '急' },
  };
  const res = voicePrint(cast, DIVERSE_SCRIPT, 'zh');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, '差异化剧本不应有 high 级问题');
});

test('英文链路零中文泄漏', () => {
  const cast = {
    'Li': { voice: 'calm' },
    'Wang': { voice: 'calm' },
    'Zhang': { voice: 'calm' },
  };
  const res = voicePrint(cast, HOMO_SCRIPT_EN, 'en');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length > 0, '英文同质化剧本应检出 high 级问题');
  // 所有 advice 必须是英文（不含中文字符）
  for (const issue of highIssues) {
    assert.ok(!/[\u4e00-\u9fa5]/.test(issue.advice), `英文链路 advice 不含中文：${issue.advice}`);
  }
});

test('样本不足角色应标记 low 级问题', () => {
  const cast = {
    '李明': { voice: '冷静' },
    '王刚': { voice: '冷静' },
    '张伟': { voice: '冷静' },
    '路人甲': { voice: '路人' },
  };
  const script = HOMO_SCRIPT + '\n路人甲（紧张）：好的。';
  const res = voicePrint(cast, script, 'zh');
  const lowIssues = res.issues.filter((i) => i.severity === 'low' && i.type === 'voice_thin_sample');
  assert.ok(lowIssues.length > 0, '样本不足角色应标记 low 级');
});

test('整体性同质化（3+角色互相相似）应触发 homogeneousAll', () => {
  const cast = {
    '李明': { voice: '冷静' },
    '王刚': { voice: '冷静' },
    '张伟': { voice: '冷静' },
  };
  const res = voicePrint(cast, HOMO_SCRIPT, 'zh');
  assert.ok(res.homogeneousAll, '3+角色互相相似应触发整体同质化');
});

test('返回值含 prints 数组且每个指纹含 signature', () => {
  const cast = {
    '李明': { voice: '冷静' },
    '王刚': { voice: '冷静' },
    '张伟': { voice: '冷静' },
  };
  const res = voicePrint(cast, HOMO_SCRIPT, 'zh');
  assert.ok(res.prints.length > 0, '返回 prints 数组');
  for (const p of res.prints) {
    assert.ok(typeof p.signature === 'string' && p.signature.length > 0, `指纹 ${p.name} 含 signature`);
    assert.ok(typeof p.avgLen === 'number', `指纹 ${p.name} 含 avgLen`);
    assert.ok(typeof p.lineCount === 'number', `指纹 ${p.name} 含 lineCount`);
  }
});

test('similarPairs 按相似度降序排列', () => {
  const cast = {
    '李明': { voice: '冷静' },
    '王刚': { voice: '冷静' },
    '张伟': { voice: '冷静' },
  };
  const res = voicePrint(cast, HOMO_SCRIPT, 'zh');
  if (res.similarPairs.length >= 2) {
    for (let i = 1; i < res.similarPairs.length; i++) {
      assert.ok(res.similarPairs[i - 1].similarity >= res.similarPairs[i].similarity, 'similarPairs 应降序排列');
    }
  }
});
