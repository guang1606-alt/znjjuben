'use strict';
// c216 跨集诊断台账六键（hookPayoff/humiliationDebt/mysteryDrought/hookFatigue/promiseDrought/villainThreat）
// 限界落库形态 + /fix 按新正文+前序摘要行重算。
// 病象：六键无 score 被 buildQcEngineDigest 跳过，旧版 SSE done 不带、qcReport 不落库、/fix 不重算——
// 跨集欠账/干旱/疲劳/威胁空转/掉钩诊断刷新即永久失明。
const test = require('node:test');
const assert = require('node:assert');

const MOD = require('../dist/engine/ledger-diagnosis-rescan.js');

test('shapeLedgerDiagnoses: 六键限界形态（state 透传 + issueCount 原始计数 + issues 截断≤5 字段白名单）', () => {
  const bigIssues = Array.from({ length: 9 }, (_, i) => ({
    severity: i % 2 ? 'mid' : 'high',
    type: 'x_issue',
    evidence: '证'.repeat(200),
    advice: '议'.repeat(240),
    extraLeak: { nested: true }, // 白名单外字段必须被剥除
  }));
  const out = MOD.shapeLedgerDiagnoses({
    hookPayoff: { checked: true, paid: 'none', prevType: 'reversal', unused: 1, issues: bigIssues },
    hookFatigue: { endRun: 4, openRun: 0, level: 'high', endType: 'crisis', openId: 'h_open_1', issues: [] },
    humiliationDebt: { debt: 6, level: 'high', lastMarkers: ['耳光', '下跪'], issues: bigIssues.slice(0, 1) },
    mysteryDrought: { drought: 4, level: 'mid', line: '密诏', issues: [] },
    promiseDrought: { drought: 0, level: 'none', line: '', issues: [] },
    villainThreat: { silentRun: 3, stagnantRun: 0, level: 'high', line: '', issues: bigIssues.slice(0, 2) },
  });
  assert.deepStrictEqual(Object.keys(out).sort(), [
    'hookFatigue', 'hookPayoff', 'humiliationDebt', 'mysteryDrought', 'promiseDrought', 'villainThreat',
  ]);
  assert.strictEqual(out.hookPayoff.checked, true);
  assert.strictEqual(out.hookPayoff.paid, 'none');
  assert.strictEqual(out.hookPayoff.prevType, 'reversal');
  assert.ok(!('unused' in out.hookPayoff), '白名单外顶层字段必须剥除');
  assert.strictEqual(out.hookPayoff.issueCount, 9, 'issueCount 是原始条数而非截断后条数');
  assert.strictEqual(out.hookPayoff.issues.length, 5, 'issues 最多 5 条');
  assert.strictEqual(out.hookPayoff.issues[0].evidence.length, 160, 'evidence 截断 160');
  assert.strictEqual(out.hookPayoff.issues[0].advice.length, 200, 'advice 截断 200');
  assert.ok(!('extraLeak' in out.hookPayoff.issues[0]), 'issue 白名单外字段必须剥除');
  assert.deepStrictEqual(out.humiliationDebt.lastMarkers, ['耳光', '下跪']);
  assert.strictEqual(out.villainThreat.issueCount, 2);
});

test('shapeLedgerDiagnoses: 非对象/缺 issues 容错——非法输入不出键，合法空壳保留', () => {
  const out = MOD.shapeLedgerDiagnoses({
    hookPayoff: null,
    hookFatigue: undefined,
    humiliationDebt: { debt: 0, level: 'none', lastMarkers: [], issues: 'not-array' },
  });
  assert.ok(!('hookPayoff' in out));
  assert.ok(!('hookFatigue' in out));
  assert.strictEqual(out.humiliationDebt.issueCount, 0);
  assert.deepStrictEqual(out.humiliationDebt.issues, []);
});

test('rescan 第 1 集（无前序）：六键全部产出且不炸，hookPayoff 未检测', () => {
  const out = MOD.rescanLedgerDiagnoses({
    text: '清晨的市集人声鼎沸，摊贩吆喝此起彼伏。',
    epNo: 1,
    prevScripts: [],
    cliffhanger: { type: 'none', score: 20 },
    openHookRaw: { id: 'h_open_1' },
  });
  assert.strictEqual(Object.keys(out).length, 6);
  assert.strictEqual(out.hookPayoff.checked, false);
  assert.strictEqual(out.hookPayoff.paid, null);
  assert.strictEqual(out.villainThreat.silentRun, 1, 'c197：改写集已完成，沉默计数含本集（等价下一集生成所见）');
  assert.strictEqual(out.humiliationDebt.debt, 0);
});

test('rescan: 前集硬钩本集全文不接 → hook_dropped(high) 被捕获', () => {
  const text = '清晨市集人声鼎沸，摊贩吆喝此起彼伏，孩子们追着糖人跑过石板街，掌柜拨弄算盘核对昨日账目。' +
    '午后风起，酒旗招展，旅人在桌边闲聊今年收成，无人记得昨夜发生过什么，日子照旧往前过。';
  const out = MOD.rescanLedgerDiagnoses({
    text,
    epNo: 2,
    prevScripts: [{
      epNo: 1,
      qcReport: { cliffhanger: { type: 'reversal', score: 92, endingSnippet: '铜符骤然发出刺目强光' } },
    }],
    cliffhanger: { type: 'none', score: 20 },
    openHookRaw: { id: 'h_open_1' },
  });
  assert.strictEqual(out.hookPayoff.checked, true);
  assert.strictEqual(out.hookPayoff.paid, 'none');
  assert.strictEqual(out.hookPayoff.issues[0].type, 'hook_dropped');
  assert.strictEqual(out.hookPayoff.issues[0].severity, 'high');
});

test('rescan: 前三集羞辱雷只埋不还 → 截至前集 debt=6 high humiliation_debt', () => {
  const out = MOD.rescanLedgerDiagnoses({
    text: '这一集大家喝茶聊天，什么账都没有清算，平淡地过去了。'.repeat(4),
    epNo: 4,
    prevScripts: [1, 2, 3].map((ep) => ({
      epNo: ep,
      qcReport: { humiliation: { planted: 2, paid: 0, strong: 0, markers: ['耳光'] } },
    })),
    cliffhanger: { type: 'none', score: 20 },
    openHookRaw: { id: 'h_open_1' },
  });
  assert.strictEqual(out.humiliationDebt.debt, 6, '本集行 ep==cur 被过滤，欠账只累计前 3 集 6 雷');
  assert.strictEqual(out.humiliationDebt.level, 'high');
  assert.strictEqual(out.humiliationDebt.issues[0].type, 'humiliation_debt');
});

test('rescan: 前 3 集反派全程缺席 → villain_silent(high)；fatigue 同型集尾连 3 → ending_hook_repeat', () => {
  const out = MOD.rescanLedgerDiagnoses({
    text: '庭院里花开花落，仆从安静洒扫，主角闭门读书一月有余。'.repeat(4),
    epNo: 4,
    prevScripts: [1, 2, 3].map((ep) => ({
      epNo: ep,
      qcReport: {
        villain: { line: '', acted: false, level: 0 },
        openHook: { id: 'h_open_1' },
        cliffhanger: { type: 'crisis' },
      },
    })),
    cliffhanger: { type: 'crisis', score: 80 }, // 本集集尾仍 crisis → 连 4
    openHookRaw: { id: 'h_open_1' },
  });
  assert.strictEqual(out.villainThreat.silentRun, 4, 'c197：改写集已完成，沉默连段含本集');
  assert.strictEqual(out.villainThreat.level, 'high');
  assert.ok(out.villainThreat.issues.some((i) => i.type === 'villain_silent'));
  assert.strictEqual(out.hookFatigue.endRun, 4, 'c197：集尾同型连段含本集（前 3 集 + 本集 crisis）');
  assert.ok(out.hookFatigue.issues.some((i) => i.type === 'ending_hook_repeat'));
});

test('rescan: 乱序前序输入内部按 ep 升序记账；输出键与 LEDGER 短名键零碰撞', () => {
  const out = MOD.rescanLedgerDiagnoses({
    text: '平稳推进的一集，没有新的冲突，也没有旧账了结。'.repeat(4),
    epNo: 3,
    prevScripts: [
      { epNo: 2, qcReport: { villain: { line: '', acted: false, level: 0 } } },
      { epNo: 1, qcReport: { villain: { line: '', acted: false, level: 0 } } },
    ],
    cliffhanger: { type: 'none', score: 20 },
    openHookRaw: { id: 'h_open_1' },
  });
  assert.strictEqual(out.villainThreat.silentRun, 3, 'c197：沉默连段含已完成的改写集');
  assert.strictEqual(out.villainThreat.level, 'high');
  for (const shortName of ['humiliation', 'mystery', 'promise', 'villain', 'props', 'timeline']) {
    assert.ok(!(shortName in out), `诊断长名键不得占用短名台账键 ${shortName}`);
  }
});

// c197：改写集按已完成集评估（引擎 cur+1），bundle 另出 humiliation/mystery/promise/villain
// 四个短名摘要行供 /fix 回写（旧码本集行被过滤、短名行从不落库，后续集读的还是旧稿欠账/干旱状态）。
test('c197 rescanLedgerDiagnosisBundle：改写稿新埋 3 枚羞辱雷当集入账(mid)，curRows 出 4 短名行', () => {
  const text = '这一集里她被当众退婚，又被指着鼻子骂废物，最后还被狠狠扇了一巴掌，周围宾客全都冷眼旁观。'.repeat(2);
  const b = MOD.rescanLedgerDiagnosisBundle({
    text,
    epNo: 2,
    prevScripts: [{ epNo: 1, qcReport: { humiliation: { planted: 0, paid: 0, strong: 0, markers: [] } } }],
    cliffhanger: { type: 'none', score: 20 },
    openHookRaw: { id: 'h_open_1' },
  });
  assert.ok(b.diagnoses && b.curRows, 'bundle 须同时返回诊断与本集短名行');
  assert.strictEqual(b.diagnoses.humiliationDebt.level, 'mid', '旧码本集行被过滤时 debt 恒 0、level 恒 none');
  assert.ok(b.diagnoses.humiliationDebt.debt >= 3);
  assert.strictEqual(b.curRows.humiliation.planted, 3, '三枚不同羞辱雷逐词提取');
  assert.ok(Array.isArray(b.curRows.humiliation.markers) && b.curRows.humiliation.markers.length === 3);
  assert.ok(b.curRows.mystery && 'line' in b.curRows.mystery && 'advanced' in b.curRows.mystery && 'hooked' in b.curRows.mystery);
  assert.ok(b.curRows.promise && 'line' in b.curRows.promise && 'advanced' in b.curRows.promise);
  assert.ok(b.curRows.villain && 'line' in b.curRows.villain && 'acted' in b.curRows.villain && 'level' in b.curRows.villain);
});
