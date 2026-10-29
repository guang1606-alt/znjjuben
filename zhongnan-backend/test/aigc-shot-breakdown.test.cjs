const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/aigc-shot-feasibility.js');
const SF = require('../dist/engine/script-format.js');
const S = require('../dist/engine/sample-script.js');

test('v2.343 空稿 → shotBreakdown 为空数组，不报错', () => {
  const r = F.checkAigcShotFeasibility('', 1, 'zh');
  assert.ok(Array.isArray(r.shotBreakdown), 'shotBreakdown 必须是数组');
  assert.strictEqual(r.shotBreakdown.length, 0);
});

test('v2.343 黄金样例 → shotBreakdown 长度 = stats.shotCount，每条有全部字段', () => {
  const t = S.buildSampleScript('AIGC', 'zh');
  const r = F.checkAigcShotFeasibility(t, 1, 'zh');
  assert.strictEqual(r.shotBreakdown.length, r.stats.shotCount,
    `breakdown=${r.shotBreakdown.length} shotCount=${r.stats.shotCount}`);
  for (const item of r.shotBreakdown) {
    assert.ok(Number.isInteger(item.scene) && item.scene >= 1, JSON.stringify(item));
    assert.ok(Number.isInteger(item.shot) && item.shot >= 1, JSON.stringify(item));
    assert.ok(typeof item.size === 'string' && item.size.length > 0, JSON.stringify(item));
    assert.ok(typeof item.move === 'string' && item.move.length > 0, JSON.stringify(item));
    assert.ok(typeof item.seconds === 'number' && item.seconds >= 0, JSON.stringify(item));
    assert.ok(typeof item.units === 'number' && item.units >= 0, JSON.stringify(item));
    assert.ok(Number.isInteger(item.lines) && item.lines >= 0, JSON.stringify(item));
    assert.ok(typeof item.hasVisual === 'boolean', JSON.stringify(item));
    assert.ok(['ok', 'mid', 'high'].includes(item.risk), JSON.stringify(item));
    assert.ok(typeof item.visual === 'string', JSON.stringify(item));
  }
});

test('v2.343 排序：按 seconds 降序 → units 降序 → scene 升序 → shot 升序', () => {
  const t = S.buildSampleScript('AIGC', 'zh');
  const r = F.checkAigcShotFeasibility(t, 1, 'zh');
  const bd = r.shotBreakdown;
  for (let i = 1; i < bd.length; i++) {
    const prev = bd[i - 1], cur = bd[i];
    if (prev.seconds !== cur.seconds) {
      assert.ok(prev.seconds >= cur.seconds,
        `[${i-1}]${prev.scene}:${prev.shot}(${prev.seconds}s) 应 >= [${i}]${cur.scene}:${cur.shot}(${cur.seconds}s)`);
      continue;
    }
    if (prev.units !== cur.units) {
      assert.ok(prev.units >= cur.units,
        `units: ${prev.units} >= ${cur.units}`);
      continue;
    }
    if (prev.scene !== cur.scene) {
      assert.ok(prev.scene <= cur.scene, `scene: ${prev.scene} <= ${cur.scene}`);
      continue;
    }
    assert.ok(prev.shot <= cur.shot, `shot: ${prev.shot} <= ${cur.shot}`);
  }
});

test('v2.343 risk 等级与 issues 对齐：high 风险镜标 high，mid 标 mid', () => {
  const lines = Array.from({ length: 8 }, (_, i) => `林晚：这是第${i + 1}句台词，我一句都不想再听下去，你也别再解释了。`).join('\n');
  const text = `第1集 试点集\n内景 客厅·夜\n他站在窗边，手指在玻璃上划了一下，外面的雨正下得急。\n${lines}`;
  const r = F.checkAigcShotFeasibility(text, 1, 'zh');
  // 找出标了 high 的 shotBreakdown 项
  const highItems = r.shotBreakdown.filter((b) => b.risk === 'high');
  assert.ok(highItems.length >= 1, `应有 high 风险镜，实际 ${highItems.length}`);
  // 与 issues 里的 high 级对齐
  const highIssues = r.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1);
  // risk 最高等级不能低于 issues 的最高等级
  const maxRiskOfBreakdown = r.shotBreakdown.reduce((max, b) =>
    ({ ok: 0, mid: 1, high: 2 }[b.risk] > max ? { ok: 0, mid: 1, high: 2 }[b.risk] : max), 0);
  const maxSeverityOfIssues = r.issues.reduce((max, i) =>
    i.severity === 'high' ? 2 : i.severity === 'mid' ? Math.max(max, 1) : max, 0);
  assert.ok(maxRiskOfBreakdown >= maxSeverityOfIssues,
    `breakdown maxRisk=${maxRiskOfBreakdown} 不应低于 issues maxSeverity=${maxSeverityOfIssues}`);
});

test('v2.343 hasVisual 与 visualess_shot issue 对齐', () => {
  const text = [
    '第1集 试点集',
    '内景 客厅·夜',
    '林晚：你终于回来了。',
    '陈凯：路上堵车。',
    '林晚：饭在锅里。',
    '陈凯：我不饿。',
  ].join('\n');
  const r = F.checkAigcShotFeasibility(text, 1, 'zh');
  const visualessInIssues = r.issues.filter((i) => i.kind === 'visualess_shot').length;
  const visualessInBreakdown = r.shotBreakdown.filter((b) => !b.hasVisual).length;
  assert.strictEqual(visualessInBreakdown, visualessInIssues,
    `hasVisual=false 数(${visualessInBreakdown}) 应等于 visualess_shot issue 数(${visualessInIssues})`);
  // 纯台词镜 risk 必须是 high
  for (const b of r.shotBreakdown) {
    if (!b.hasVisual) assert.strictEqual(b.risk, 'high', JSON.stringify(b));
  }
});

test('v2.343 format.shotPlan.shotBreakdown 存在且与独立调用同源', () => {
  const t = S.buildSampleScript('AIGC', 'zh');
  const independent = F.checkAigcShotFeasibility(t, 1, 'zh');
  const f = SF.validateScript(t, 'AIGC', 1);
  assert.ok(f.shotPlan, 'AIGC FormatReport 必须带 shotPlan');
  assert.ok(Array.isArray(f.shotPlan.shotBreakdown), 'shotPlan.shotBreakdown 必须是数组');
  assert.strictEqual(f.shotPlan.shotBreakdown.length, independent.shotBreakdown.length);
  // 逐键对比前 3 项（同源快照）
  for (let i = 0; i < Math.min(3, f.shotPlan.shotBreakdown.length); i++) {
    assert.strictEqual(f.shotPlan.shotBreakdown[i].scene, independent.shotBreakdown[i].scene);
    assert.strictEqual(f.shotPlan.shotBreakdown[i].shot, independent.shotBreakdown[i].shot);
    assert.strictEqual(f.shotPlan.shotBreakdown[i].seconds, independent.shotBreakdown[i].seconds);
  }
});
