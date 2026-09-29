// v2.80 创伤恢复账本（wound-recovery-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveWoundSignal,
  normalizeWoundRow,
  woundRecoveryLedger,
  woundDirective,
} = require('../dist/engine/wound-recovery-ledger.js');

// —— deriveWoundSignal：信号提取 ——

test('deriveWoundSignal：zh 重创词命中（重伤吐血 / 断臂）', () => {
  assert.deepEqual(deriveWoundSignal('△陈峰重伤倒地，口吐鲜血。', '陈峰'), { wounded: true, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('△沈青澜断臂之后晕厥过去。', '沈青澜'), { wounded: true, healed: false, strained: false });
});

test('deriveWoundSignal：zh 痊愈豁免命中（伤势痊愈 / 灵药断肢重生）', () => {
  assert.deepEqual(deriveWoundSignal('陈峰伤势痊愈，重归战场。', '陈峰'), { wounded: false, healed: true, strained: false });
  assert.deepEqual(deriveWoundSignal('△陈峰服下灵药，断肢重生。', '陈峰'), { wounded: false, healed: true, strained: false });
});

test('deriveWoundSignal：strained 高强度行动命中（△拔剑杀入），纯台词不算', () => {
  assert.deepEqual(deriveWoundSignal('△陈峰拔剑杀入敌阵。', '陈峰'), { wounded: false, healed: false, strained: true });
  assert.deepEqual(deriveWoundSignal('陈峰：我跟你拼了！', '陈峰'), { wounded: false, healed: false, strained: false });
});

test('deriveWoundSignal：zh"差点"前缀跳过（没受创成）', () => {
  assert.deepEqual(deriveWoundSignal('陈峰差点吐血，强撑着站稳。', '陈峰'), { wounded: false, healed: false, strained: false });
});

test('deriveWoundSignal：死亡行让位（重伤不治归 death-ledger），他人死亡行不误伤', () => {
  assert.deepEqual(deriveWoundSignal('陈峰重伤不治身亡。', '陈峰'), { wounded: false, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('△陈峰重伤倒地。他爹咽了气。', '陈峰'), { wounded: true, healed: false, strained: false });
});

test('deriveWoundSignal：en 重创词命中（含助动词隔开）', () => {
  assert.deepEqual(deriveWoundSignal('Wang was seriously wounded in the blast.', 'Wang'), { wounded: true, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('Wang lost an arm.', 'Wang'), { wounded: true, healed: false, strained: false });
});

test('deriveWoundSignal：en 痊愈豁免命中', () => {
  assert.deepEqual(deriveWoundSignal('Wang made a full recovery.', 'Wang'), { wounded: false, healed: true, strained: false });
});

test('deriveWoundSignal：en strained 命中 + almost 前缀跳过 + 死亡行让位', () => {
  assert.deepEqual(deriveWoundSignal('Wang fought like a cornered beast.', 'Wang'), { wounded: false, healed: false, strained: true });
  assert.deepEqual(deriveWoundSignal('Wang almost attacked the guard.', 'Wang'), { wounded: false, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('Wang was killed; his men were wounded.', 'Wang'), { wounded: false, healed: false, strained: false });
});

test('deriveWoundSignal：空文本/超短名字/超短文本安全返回三 false', () => {
  assert.deepEqual(deriveWoundSignal('', '陈峰'), { wounded: false, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('陈峰吐血了', '峰'), { wounded: false, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal('短', '陈峰'), { wounded: false, healed: false, strained: false });
  assert.deepEqual(deriveWoundSignal(null, null), { wounded: false, healed: false, strained: false });
});

// —— normalizeWoundRow：摘要规范化 ——

test('normalizeWoundRow：合法行入账，ep/name 非法 → null，布尔仅认 true', () => {
  assert.deepEqual(normalizeWoundRow({ ep: 4, name: ' 陈峰 ', wounded: true, healed: false, strained: true }), { ep: 4, name: '陈峰', wounded: true, healed: false, strained: true });
  assert.equal(normalizeWoundRow({ ep: 0, name: '陈峰', wounded: true }), null);
  assert.equal(normalizeWoundRow({ ep: NaN, name: '陈峰' }), null);
  assert.equal(normalizeWoundRow({ ep: 3, wounded: true }), null); // 缺 name
  assert.equal(normalizeWoundRow(null), null);
  assert.deepEqual(normalizeWoundRow({ ep: 2.6, name: '陈峰', wounded: 'yes', healed: 1, strained: true }), { ep: 3, name: '陈峰', wounded: false, healed: false, strained: true });
});

// —— woundRecoveryLedger：跨集记账 ——

test('woundRecoveryLedger：空序列 → 无名册无问题', () => {
  const r = woundRecoveryLedger([], 5);
  assert.deepEqual(r.wounded, []);
  assert.deepEqual(r.issues, []);
});

test('woundRecoveryLedger：重创后下一集高强度行动 → 伤势穿帮 high（每名字只报 1 次）', () => {
  const r = woundRecoveryLedger([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: true },
    { ep: 2, name: '陈峰', wounded: false, healed: false, strained: true },
    { ep: 3, name: '陈峰', wounded: false, healed: false, strained: true }, // 已报出册，不再重复
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'wounded_but_fighting');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('第 2 集'));
  assert.deepEqual(r.wounded, []); // 报过即出册
});

test('woundRecoveryLedger：痊愈出册后高强度行动不再追踪', () => {
  const r = woundRecoveryLedger([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: false },
    { ep: 2, name: '陈峰', wounded: false, healed: true, strained: false },
    { ep: 3, name: '陈峰', wounded: false, healed: false, strained: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.wounded, []);
});

test('woundRecoveryLedger：受创同集 strained 不报（受伤前有戏，正常）', () => {
  const r = woundRecoveryLedger([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: true },
  ], 2);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.wounded, [{ name: '陈峰', woundEp: 1 }]);
});

test('woundRecoveryLedger：乱序安全 + 只认 < curEpNo 的行', () => {
  const r = woundRecoveryLedger([
    { ep: 2, name: '陈峰', wounded: true, healed: false, strained: false },
    { ep: 1, name: '王虎', wounded: true, healed: false, strained: false },
    { ep: 9, name: '王虎', wounded: true, healed: false, strained: false }, // 未完成集剔除
  ], 4);
  assert.deepEqual(r.wounded.map((d) => d.name), ['王虎', '陈峰']); // 按集升序入册
  assert.deepEqual(r.issues, []);
});

test('woundRecoveryLedger：同集同名以后到为准', () => {
  const inBook = woundRecoveryLedger([
    { ep: 1, name: '陈峰', wounded: false, healed: false, strained: false },
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: false },
  ], 2);
  assert.deepEqual(inBook.wounded, [{ name: '陈峰', woundEp: 1 }]);
  const corrected = woundRecoveryLedger([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: true },
    { ep: 1, name: '陈峰', wounded: false, healed: false, strained: true }, // 同集修正：没受创
  ], 2);
  assert.deepEqual(corrected.wounded, []);
  assert.deepEqual(corrected.issues, []);
});

// —— woundDirective：架构师指令 ——

test('woundDirective：名册非空出"伤势维持"指令，zh 含名单/集号/痊愈要求', () => {
  const b = woundDirective([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: false },
    { ep: 2, name: '王虎', wounded: true, healed: false, strained: false },
  ]);
  assert.ok(b.zh.includes('【跨集创伤·伤势维持】'));
  assert.ok(b.zh.includes('陈峰（第1集）'));
  assert.ok(b.zh.includes('王虎（第2集）'));
  assert.ok(b.zh.includes('灵药救治/静养数日/断肢重生'));
});

test('woundDirective：en 层系统文案零中文（人名按原名透传）', () => {
  const b = woundDirective([
    { ep: 1, name: 'Wang', wounded: true, healed: false, strained: false },
  ]);
  assert.ok(b.en.includes('[Cross-episode wounds'));
  assert.ok(b.en.includes('Wang (ep1)'));
  assert.ok(b.en.includes('regenerated limb'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
});

test('woundDirective：无输入/痊愈清册后 → 空串（两语言一致）', () => {
  assert.deepEqual(woundDirective([]), { zh: '', en: '' });
  const cleared = woundDirective([
    { ep: 1, name: '陈峰', wounded: true, healed: false, strained: false },
    { ep: 2, name: '陈峰', wounded: false, healed: true, strained: false },
  ]);
  assert.equal(cleared.zh, '');
  assert.equal(cleared.en, '');
});
