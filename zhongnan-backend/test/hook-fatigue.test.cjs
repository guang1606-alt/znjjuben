// v2.80 跨集钩型疲劳账本（hook-fatigue）测试：钩型提取 / 摘要规范化 / run-length 记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveEndHookType,
  deriveOpenHookId,
  normalizeHookTypeRow,
  hookFatigueLedger,
  hookFatigueDirective,
  HF_RUN_MID,
  HF_RUN_HIGH,
  HF_DIRECTIVE_RUN,
} = require('../dist/engine/hook-fatigue.js');

// —— deriveEndHookType：集尾实测钩型提取 ——

test('deriveEndHookType：六类实质钩入账，weak/none/未知/缺字段断段', () => {
  assert.equal(deriveEndHookType({ type: 'crisis' }), 'crisis');
  assert.equal(deriveEndHookType({ type: 'mystery' }), 'mystery');
  assert.equal(deriveEndHookType({ type: 'action_cut' }), 'action_cut');
  assert.equal(deriveEndHookType({ type: 'weak' }), null);
  assert.equal(deriveEndHookType({ type: 'none' }), null);
  assert.equal(deriveEndHookType({ type: 'banana' }), null);
  assert.equal(deriveEndHookType({}), null);
  assert.equal(deriveEndHookType(null), null);
});

// —— deriveOpenHookId：开场钩规划 ID 提取 ——

test('deriveOpenHookId：非空 ID 入账（≤40 截断），空/缺字段断段', () => {
  assert.equal(deriveOpenHookId({ id: 'slap_wake' }), 'slap_wake');
  assert.equal(deriveOpenHookId({ id: '  ' }), null);
  assert.equal(deriveOpenHookId({ id: '' }), null);
  assert.equal(deriveOpenHookId({}), null);
  assert.equal(deriveOpenHookId({ id: 'x'.repeat(50) }).length, 40);
});

// —— normalizeHookTypeRow：摘要规范化 ——

test('normalizeHookTypeRow：合法行入账，ep 非法 → null，endType 非法置空，弱钩行保留断段', () => {
  assert.deepEqual(normalizeHookTypeRow({ ep: 4, openId: 'slap_wake', endType: 'crisis' }), { ep: 4, openId: 'slap_wake', endType: 'crisis' });
  assert.equal(normalizeHookTypeRow({ ep: NaN, openId: 'a', endType: 'crisis' }), null);
  assert.deepEqual(normalizeHookTypeRow({ ep: 4, openId: '', endType: 'weak' }), { ep: 4, openId: '', endType: '' }); // 弱钩行保留=断段
  assert.equal(normalizeHookTypeRow(null), null);
  const r = normalizeHookTypeRow({ ep: 3, openId: '  countdown  ', endType: 'banana' });
  assert.deepEqual(r, { ep: 3, openId: 'countdown', endType: '' });
});

// —— hookFatigueLedger：run-length 记账 ——

test('hookFatigueLedger：空序列 → 全 0 无问题', () => {
  const r = hookFatigueLedger([], 5);
  assert.equal(r.endRun, 0);
  assert.equal(r.openRun, 0);
  assert.equal(r.level, 'none');
  assert.deepEqual(r.issues, []);
});

test('hookFatigueLedger：集尾同型连吊 → run 累积（≥3 mid、≥4 high）', () => {
  const rows = [
    { ep: 1, openId: '', endType: 'crisis' },
    { ep: 2, openId: '', endType: 'crisis' },
    { ep: 3, openId: '', endType: 'crisis' },
    { ep: 4, openId: '', endType: 'crisis' },
  ];
  const mid = hookFatigueLedger(rows.slice(0, 3), 4);
  assert.equal(mid.endRun, 3);
  assert.equal(mid.level, 'mid');
  const high = hookFatigueLedger(rows, 5);
  assert.equal(high.endRun, 4);
  assert.equal(high.level, 'high');
  assert.equal(high.issues[0].type, 'ending_hook_repeat');
  assert.ok(high.issues[0].evidence.includes('危机钩'));
});

test('hookFatigueLedger：换型重置 + weak/none 断段', () => {
  const switched = [
    { ep: 1, openId: '', endType: 'crisis' },
    { ep: 2, openId: '', endType: 'crisis' },
    { ep: 3, openId: '', endType: 'reversal' },
  ];
  assert.equal(hookFatigueLedger(switched, 4).endRun, 1);
  const broken = [
    { ep: 1, openId: '', endType: 'crisis' },
    { ep: 2, openId: '', endType: 'crisis' },
    { ep: 3, openId: '', endType: 'weak' }, // 弱钩断段
  ];
  const r = hookFatigueLedger(broken, 4);
  assert.equal(r.endRun, 0);
  assert.equal(r.level, 'none');
});

test('hookFatigueLedger：开场同 ID 连吊独立记账（≥3 mid）', () => {
  const rows = [
    { ep: 1, openId: 'slap_wake', endType: '' },
    { ep: 2, openId: 'slap_wake', endType: 'crisis' },
    { ep: 3, openId: 'slap_wake', endType: 'reversal' },
  ];
  const r = hookFatigueLedger(rows, 4);
  assert.equal(r.openRun, 3);
  assert.equal(r.endRun, 1); // 集尾通道独立
  assert.equal(r.level, 'mid');
  assert.equal(r.issues[0].type, 'opening_hook_repeat');
  assert.ok(r.issues[0].evidence.includes('slap_wake'));
});

test('hookFatigueLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const rows = [
    { ep: 3, openId: '', endType: 'mystery' },
    { ep: 1, openId: '', endType: 'mystery' },
    { ep: 2, openId: '', endType: 'mystery' },
    { ep: 9, openId: '', endType: 'mystery' }, // 未完成集剔除
  ];
  const r = hookFatigueLedger(rows, 4);
  assert.equal(r.endRun, 3);
  assert.equal(r.level, 'mid');
});

// —— hookFatigueDirective：架构师指令（预防式 run≥2） ——

test('hookFatigueDirective：集尾/开场双通道出话，zh/en 双语齐备且 en 层零中文', () => {
  const rows = [
    { ep: 1, openId: 'slap_wake', endType: 'crisis' },
    { ep: 2, openId: 'slap_wake', endType: 'crisis' },
  ];
  const d = hookFatigueDirective(rows);
  assert.ok(d.zh.includes('【钩型疲劳·集尾换型】'));
  assert.ok(d.zh.includes('最近 2 集集尾'));
  assert.ok(d.zh.includes('危机钩'));
  assert.ok(d.zh.includes('【钩型疲劳·开场换型】'));
  assert.ok(d.zh.includes('slap_wake'));
  assert.ok(d.en.includes('[Hook-type fatigue — rotate the ending hook]'));
  assert.ok(d.en.includes('last 2 episodes all ended on a Crisis hook'));
  assert.ok(d.en.includes('[Hook-type fatigue — rotate the opening hook]'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en)); // en 系统文案零中文
});

test('hookFatigueDirective：无重复/单集首用 → 空串（两语言一致）', () => {
  assert.equal(hookFatigueDirective([]).zh, '');
  assert.equal(hookFatigueDirective([{ ep: 1, openId: 'slap_wake', endType: 'crisis' }]).en, '');
  const noRepeat = hookFatigueDirective([
    { ep: 1, openId: 'a', endType: 'crisis' },
    { ep: 2, openId: 'b', endType: 'reversal' },
  ]);
  assert.equal(noRepeat.zh, '');
  assert.equal(noRepeat.en, '');
});

// —— 常量 sanity ——

test('常量 sanity：段长阈值 3/4，指令预防阈值 2', () => {
  assert.equal(HF_RUN_MID, 3);
  assert.equal(HF_RUN_HIGH, 4);
  assert.equal(HF_DIRECTIVE_RUN, 2);
});
