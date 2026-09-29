/**
 * v2.80 配角在场防遗忘台账（cast-presence-ledger）测试
 * 覆盖：空输入、缺席<3不报、最近集出场跳过、从未出场不追踪、
 *       mid/high 阈值边界、streak 降序排序、presentIn 去重、
 *       zh/en 指令内容、en 层零中文（角色名透传例外）、curEpNo 取整兜底。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  castPresenceLedger, presenceDirective,
  PRESENCE_ABSENT_MID, PRESENCE_ABSENT_HIGH,
} = require('../dist/engine/cast-presence-ledger.js');

test('空输入：无 issue、tracked=0，双语指令均为空串', () => {
  const r = castPresenceLedger([], 5);
  assert.strictEqual(r.tracked, 0);
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(presenceDirective([], 5).zh, '');
  assert.strictEqual(presenceDirective([], 5).en, '');
});

test('缺席 <3 集不报；最近完成集仍出场跳过', () => {
  // curEpNo=10 → lastDone=9；lastIn=8 → streak=1，不报
  assert.deepStrictEqual(castPresenceLedger([{ name: '张三', presentIn: [1, 5, 8] }], 10).issues, []);
  // lastIn=9（最近完成集）→ 跳过
  assert.deepStrictEqual(castPresenceLedger([{ name: '李四', presentIn: [9] }], 10).issues, []);
});

test('从未出场不追踪；空白名跳过（tracked 仍计数）', () => {
  const r = castPresenceLedger([{ name: '王五', presentIn: [] }, { name: '   ', presentIn: [1] }], 10);
  assert.strictEqual(r.tracked, 2);
  assert.deepStrictEqual(r.issues, []);
});

test('阈值边界：缺席 3=mid、5=mid、6=high（lastIn 与 streak 对应正确）', () => {
  assert.strictEqual(PRESENCE_ABSENT_MID, 3);
  assert.strictEqual(PRESENCE_ABSENT_HIGH, 6);
  const r = castPresenceLedger([
    { name: '甲', presentIn: [6] }, // streak=9-6=3 → mid
    { name: '乙', presentIn: [4] }, // streak=5 → mid
    { name: '丙', presentIn: [3] }, // streak=6 → high
  ], 10);
  assert.strictEqual(r.issues.length, 3);
  const by = Object.fromEntries(r.issues.map((i) => [i.name, i]));
  assert.strictEqual(by['甲'].severity, 'mid');
  assert.strictEqual(by['甲'].lastIn, 6);
  assert.strictEqual(by['乙'].severity, 'mid');
  assert.strictEqual(by['丙'].severity, 'high');
  assert.strictEqual(by['丙'].absentStreak, 6);
});

test('排序：按 absentStreak 降序，不足阈值的角色不出现', () => {
  const r = castPresenceLedger([
    { name: '丙', presentIn: [8] }, // streak=1，不报
    { name: '丁', presentIn: [6] }, // streak=3
    { name: '戊', presentIn: [5] }, // streak=4
  ], 10);
  assert.deepStrictEqual(r.issues.map((i) => i.name), ['戊', '丁']);
});

test('presentIn 去重/乱序归一，lastIn 取最大出场集', () => {
  const r = castPresenceLedger([{ name: '赵六', presentIn: [4, 1, 4, 2] }], 10);
  assert.strictEqual(r.issues.length, 1);
  assert.strictEqual(r.issues[0].lastIn, 4);
  assert.strictEqual(r.issues[0].absentStreak, 5);
  assert.strictEqual(r.issues[0].severity, 'mid');
});

test('zh 指令：头行+条目格式齐备（缺席 8 集=high）', () => {
  const d = presenceDirective([{ name: '钱七', presentIn: [1] }], 10);
  assert.ok(d.zh.startsWith('【配角在场·防遗忘调度】'));
  assert.ok(d.zh.includes('「钱七」'));
  assert.ok(d.zh.includes('已连续 8 集未出场'));
  assert.ok(d.zh.includes('最后出现第1集'));
  assert.ok(d.zh.includes('本集给一场戏'));
  assert.ok(d.zh.endsWith('\n'));
});

test('en 指令：英文名下系统文案零中文', () => {
  const d = presenceDirective([{ name: 'Elena', presentIn: [1] }], 10);
  assert.ok(d.en.startsWith('[Supporting cast presence guard'));
  assert.ok(d.en.includes('"Elena"'));
  assert.ok(d.en.includes('absent for 8 consecutive episodes'));
  assert.ok(d.en.includes('last seen ep1'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en), `en 层含中文: ${d.en}`);
});

test('en 指令：中文名按圣经标识符透传，系统文案（除名外）零中文', () => {
  const d = presenceDirective([{ name: '林晚', presentIn: [1] }], 10);
  assert.ok(d.en.includes('"林晚"'));
  const body = d.en.split('"林晚"').join('');
  assert.ok(!/[\u4e00-\u9fff]/.test(body), `en 系统文案含中文: ${body}`);
});

test('curEpNo 取整与兜底：非整数向下取整参与计算；0/缺省回退为 1', () => {
  // 10.4 → 10 → lastDone=9，lastIn=6 → streak=3
  const r = castPresenceLedger([{ name: '孙八', presentIn: [6] }], 10.4);
  assert.strictEqual(r.issues[0].absentStreak, 3);
  // curEpNo=0 → lastDone=0，lastIn=1 已≥lastDone，跳过
  assert.deepStrictEqual(castPresenceLedger([{ name: '周九', presentIn: [1] }], 0).issues, []);
});
