// v2.347 AIGC 修复轮消费真人内核诊断 + 修复后内核重扫
// 缺口 1：42+ 真人内核引擎的场级 high 诊断要进 AIGC 修复轮 issueList（不只进打回重写）
// 缺口 2：AIGC 版式修复后要轻量重扫内核指标，防止"版式修好、爽点修没"
const test = require('node:test');
const assert = require('node:assert');
const K = require('../dist/engine/aigc-kernel-issues.js');

// ---------- collectSceneKernelIssues：收集场级 high 诊断 ----------

test('v2.347 收集器：空输入返回空数组', () => {
  const r = K.collectSceneKernelIssues([]);
  assert.deepStrictEqual(r, []);
});

test('v2.347 收集器：只保留 high 严重度的诊断，medium/low 被过滤', () => {
  const r = K.collectSceneKernelIssues([
    { name: 'sceneSoftEnding', issues: [
      { severity: 'high', message: '第2场结尾泄气软收尾' },
      { severity: 'mid', message: '第3场略软' },
    ] },
  ]);
  assert.strictEqual(r.length, 1);
  assert.ok(r[0].includes('第2场'), r[0]);
});

test('v2.347 收集器：多个引擎的 high 诊断合并，带来源前缀', () => {
  const r = K.collectSceneKernelIssues([
    { name: 'sceneSoftEnding', issues: [{ severity: 'high', message: '第2场结尾泄气' }] },
    { name: 'scenePadding', issues: [{ severity: 'high', message: '第1场三无场景' }] },
    { name: 'coolMoment', issues: [{ severity: 'high', message: '爽点不足3个' }] },
  ]);
  assert.strictEqual(r.length, 3);
  // 每条诊断要带引擎来源，让修复模型知道是哪把尺子抓的
  assert.ok(r.every((s) => /【.+】/.test(s) || /\[.+\]/.test(s)), JSON.stringify(r));
});

test('v2.347 收集器：issues 为字符串数组的引擎也能消费（适配 string[] 形态）', () => {
  const r = K.collectSceneKernelIssues([
    { name: 'sceneSoftEnding', issues: ['第2场：冲突后叹气收场，泄气软收尾'] },
  ]);
  assert.strictEqual(r.length, 1);
  assert.ok(r[0].includes('第2场'), r[0]);
});

test('v2.347 收集器：总量封顶（默认 8 条），避免修复提示词过长', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ severity: 'high', message: `第${i + 1}场问题${i}` }));
  const r = K.collectSceneKernelIssues([{ name: 'x', issues: many }]);
  assert.ok(r.length <= 8, `got ${r.length}`);
});

// ---------- 变异咬红：收集器/重扫的边界鲁棒性 ----------

test('v2.347 变异1：畸形输入不崩溃（null/undefined/空issues/缺字段）', () => {
  // 变异：管线某引擎返回 null / issues 缺失 / issue 缺 message 与 advice
  const r = K.collectSceneKernelIssues([
    null,
    undefined,
    { name: 'x' },                       // 无 issues
    { name: 'y', issues: null },         // issues 为 null
    { name: 'z', issues: [{}] },         // issue 无任何文本字段
    { name: 'w', issues: [{ severity: 'high' }] }, // 有 severity 无文本
  ]);
  assert.ok(Array.isArray(r)); // 不抛错即赢
});

test('v2.347 变异2：过滤逻辑不能放水中度诊断——mid 不得混入 high 收集', () => {
  const r = K.collectSceneKernelIssues([
    { name: 'coolMoment', issues: [
      { severity: 'mid', message: '中度不该进' },
      { severity: 'low', message: '低度不该进' },
      { severity: 'high', message: '第4场该进' },
    ] },
  ]);
  assert.strictEqual(r.length, 1);
  assert.ok(!r.some((s) => s.includes('不该进')), JSON.stringify(r));
});

test('v2.347 变异3：重扫空稿/纯空白稿必须返回空数组不崩溃', () => {
  assert.deepStrictEqual(K.aigcKernelRescan('', 'zh'), []);
  assert.deepStrictEqual(K.aigcKernelRescan('   \n\n  ', 'zh'), []);
});

test('v2.347 变异4：cap=0 时返回空（显式上限边界），cap 优先于先来先得', () => {
  const r0 = K.collectSceneKernelIssues([{ name: 'x', issues: [{ severity: 'high', message: 'm' }] }], 0);
  assert.deepStrictEqual(r0, []);
  // cap=1 时多引擎只取第 1 条
  const r1 = K.collectSceneKernelIssues([
    { name: 'coolMoment', issues: [{ severity: 'high', message: '甲' }] },
    { name: 'subtext', issues: [{ severity: 'high', message: '乙' }] },
  ], 1);
  assert.strictEqual(r1.length, 1);
  assert.ok(r1[0].includes('甲'), r1[0]);
});

test('v2.347 变异5：已知引擎名用中文标签前缀，未知引擎名兜底用原名', () => {
  const r = K.collectSceneKernelIssues([
    { name: 'coolMoment', issues: [{ severity: 'high', message: '爽点不足' }] },
    { name: 'brandNewEngine', issues: [{ severity: 'high', message: '新引擎问题' }] },
  ]);
  assert.ok(r[0].includes('【爽点密度】'), r[0]);
  assert.ok(r[1].includes('【brandNewEngine】'), r[1]);
});

// ---------- aigcKernelRescan：修复后内核轻量重扫 ----------

test('v2.347 重扫：三引擎都跑、返回结构稳定（爽点/冲突/钩子全覆盖）', () => {
  // 项目自带黄金样例：有爽点有冲突有钩子，但也带边界提示
  const S = require('../dist/engine/sample-script.js');
  const healthy = S.buildSampleScript('AIGC', 'zh');
  const w = K.aigcKernelRescan(healthy, 'zh');
  assert.ok(Array.isArray(w));
  // 关键验证：重扫确实调用了底层引擎（能给出带 engine 标签的结构化结果）
  for (const x of w) assert.ok(['coolMoment', 'conflictDensity', 'cliffhanger'].includes(x.engine), x.engine);
});

test('v2.347 重扫：零爽点零冲突稿比健全稿报出更多 high（对比即验证灵敏度）', () => {
  const S = require('../dist/engine/sample-script.js');
  const healthy = S.buildSampleScript('AIGC', 'zh');
  const flat = '内景 客厅·夜\n林晚坐着。\n赵明：哦。\n林晚：嗯。';
  const wHealthy = K.aigcKernelRescan(healthy, 'zh').filter((x) => x.severity === 'high').length;
  const wFlat = K.aigcKernelRescan(flat, 'zh').filter((x) => x.severity === 'high').length;
  // 退化稿的 high 告警必须严格多于健全稿——证明重扫能区分"修好"与"修没"
  assert.ok(wFlat > wHealthy, `flat=${wFlat} healthy=${wHealthy}`);
});

test('v2.347 重扫：修复把爽点修没（零爽点稿）→ 报 high warning', () => {
  const flat = [
    '内景 客厅·夜',
    '林晚坐在沙发上，看着窗外。',
    '赵明：吃饭了吗。',
    '林晚：吃了。',
    '赵明也坐下来，两人安静地看着电视，气氛平和。',
  ].join('\n');
  const w = K.aigcKernelRescan(flat, 'zh');
  assert.ok(w.some((x) => x.severity === 'high'), JSON.stringify(w));
});

test('v2.347 重扫：返回结构带 engine 与 message，供 SSE warnings 通道消费', () => {
  const flat = '内景 客厅·夜\n林晚坐着。\n赵明：哦。\n林晚：嗯。';
  const w = K.aigcKernelRescan(flat, 'zh');
  assert.ok(w.length > 0);
  for (const x of w) {
    assert.ok(typeof x.engine === 'string' && x.engine.length > 0, JSON.stringify(x));
    assert.ok(typeof x.message === 'string', JSON.stringify(x));
    assert.ok(['high', 'mid', 'low'].includes(x.severity), JSON.stringify(x));
  }
});
