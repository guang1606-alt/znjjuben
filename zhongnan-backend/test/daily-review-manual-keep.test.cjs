/**
 * v2.303 守卫：scripts/daily-review.cjs 重写日报时必须保留结尾标记之后的手工编号段。
 * 背景实证：2026-10-02 脚本整体 writeFileSync 覆盖，把六十一~八十四共 335 行手工日报吞光
 * （HEAD 版 501 行 → 166 行）。mergeManual 为纯函数，require 脚本不得触发 git/写文件副作用。
 */
const nodeTest = require('node:test');
const assert = require('node:assert');

const mod = require('../scripts/daily-review.cjs');
const { mergeManual, MANUAL_MARKER } = mod;

nodeTest('daily-review mergeManual：重写自动区时手工段逐字保留', () => {
  assert.strictEqual(typeof mergeManual, 'function', 'mergeManual 必须导出（require.main guard 不得阻止导出）');
  assert.ok(MANUAL_MARKER.includes('报告入库共享'), '标记必须导出');

  const manual = '---\n\n## 八十四、v2.302 修复段\n\n- 手工内容一行不动\n';
  const oldReport = `# 每日仓库复盘 2026-10-02\n自动区旧内容……\n${MANUAL_MARKER}\n\n${manual}`;
  const newReport = `# 每日仓库复盘 2026-10-02\n自动区新内容（版本 2.303）……\n${MANUAL_MARKER}\n`;

  const out = mergeManual(oldReport, newReport);
  assert.ok(out.startsWith('# 每日仓库复盘 2026-10-02\n自动区新内容'), '自动区必须用新版');
  assert.ok(!out.includes('自动区旧内容'), '旧自动区不得残留');
  assert.ok(out.includes(manual.trim()), '手工段必须逐字保留');
  assert.ok(out.indexOf('自动区新内容') < out.indexOf('八十四'), '手工段位于自动区之后');
});

nodeTest('daily-review mergeManual：首跑（无旧文件/空串）原样返回新报告', () => {
  const newReport = `auto\n${MANUAL_MARKER}\n`;
  assert.strictEqual(mergeManual('', newReport), newReport);
  assert.strictEqual(mergeManual(null, newReport), newReport);
  assert.strictEqual(mergeManual(undefined, newReport), newReport);
});

nodeTest('daily-review mergeManual：旧文件无可信标记边界时不做猜测性拼接', () => {
  // 更老格式或他文：宁可丢"未识别内容"也不把自动节误判成手工段重复拼接
  const newReport = `auto\n${MANUAL_MARKER}\n`;
  assert.strictEqual(mergeManual('某个没有标记的旧文件\n## 八十四\n手工', newReport), newReport);
});

nodeTest('daily-review mergeManual：标记后只有空白（无手工段）原样返回', () => {
  const newReport = `auto\n${MANUAL_MARKER}\n`;
  assert.strictEqual(mergeManual(`old-auto\n${MANUAL_MARKER}\n\n  \n`, newReport), newReport);
});
