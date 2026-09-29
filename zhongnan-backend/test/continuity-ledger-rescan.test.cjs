'use strict';
// c217 跨集连续性台账 24 键（propLedger/timelineLedger/costLedger/deathLedger/villainFate/
// woundRecovery/powerProgress/itemOwnership/relLedger/affLedger/locLedger/leakLedger/disguiseLedger/
// debtLedger/allianceLedger/memoryLedger/impersonationLedger/betrayalLedger/sacrificeLedger/curseLedger/
// possessionLedger/timeTravelLedger/transformationLedger/poisonLedger）
// 限界落库形态 + /fix 按新正文+前序短名摘要行重放。
// 病象：24 键无 score 被 buildQcEngineDigest 跳过，旧版 SSE done 不带、qcReport 不落库、/fix 不重算、
// 前端无渲染——封禁信物再现/死者复活/反派下场穿帮等 24 类硬伤刷新即永久失明。
const test = require('node:test');
const assert = require('node:assert');

const MOD = require('../dist/engine/continuity-ledger-rescan.js');

test('shapeContinuityLedgers: 状态白名单透传 + 名册≤30 削形 + issues 计数/截断；villainFate 诊断绝不含 rows', () => {
  const bigIssues = Array.from({ length: 9 }, (_, i) => ({
    severity: i % 2 ? 'mid' : 'high',
    type: 'prop_phantom',
    evidence: '证'.repeat(200),
    advice: '议'.repeat(240),
    extraLeak: { nested: true }, // 白名单外字段必须剥除
  }));
  const manyFelled = Array.from({ length: 35 }, (_, i) => ({ name: `反派${i}`, fateEp: i + 1, dirty: true }));
  const out = MOD.shapeContinuityLedgers({
    propLedger: {
      plantedCount: 2,
      stale: [{ name: '玉佩', plantedEp: 1, lastSeenEp: 1, gap: 4, secret: 1 }],
      closed: ['玉佩'],
      phantom: [{ name: '玉佩', closedEp: 2, reopenedEp: 5 }],
      level: 'high',
      unusedTop: 'leak', // STATE_FIELDS 白名单外顶层字段必须剥除
      issues: bigIssues,
    },
    villainFate: {
      rows: [{ name: '赵四', felled: true, active: false }], // 短名摘要行：诊断输出严禁携带
      felled: manyFelled,
      issues: [],
    },
    timelineLedger: { droughtRun: 3, level: 'mid', line: '三日后', issues: [] },
    deathLedger: null, // 非对象不出键
  });
  assert.strictEqual(out.propLedger.plantedCount, 2);
  assert.strictEqual(out.propLedger.level, 'high');
  assert.ok(!('unusedTop' in out.propLedger), '白名单外顶层字段必须剥除');
  assert.deepStrictEqual(out.propLedger.stale[0], { name: '玉佩', plantedEp: 1, lastSeenEp: 1, gap: 4 });
  assert.strictEqual(out.propLedger.issueCount, 9, 'issueCount 是原始条数而非截断后条数');
  assert.strictEqual(out.propLedger.issues.length, 5, 'issues 最多 5 条');
  assert.strictEqual(out.propLedger.issues[0].evidence.length, 160, 'evidence 截断 160');
  assert.strictEqual(out.propLedger.issues[0].advice.length, 200, 'advice 截断 200');
  assert.ok(!('extraLeak' in out.propLedger.issues[0]), 'issue 白名单外字段必须剥除');
  assert.ok(!('rows' in out.villainFate), 'villainFate 纯诊断不得携带短名 rows（否则合流时蒸发下一集 prev 输入）');
  assert.strictEqual(out.villainFate.felled.length, 30, '名册最多 30 条');
  assert.deepStrictEqual(out.villainFate.felled[0], { name: '反派0', fateEp: 1 }, '名册元素逐键白名单，dirty 剥除');
  assert.strictEqual(out.villainFate.issueCount, 0);
  assert.strictEqual(out.timelineLedger.droughtRun, 3);
  assert.ok(!('deathLedger' in out), '非对象输入不出键');
});

test('shapeContinuityLedgers: 缺 issues 的引擎结果产出健康壳（issueCount:0），覆盖语义可清旧账', () => {
  const out = MOD.shapeContinuityLedgers({
    deathLedger: { dead: [] },
    woundRecovery: { wounded: [], issues: 'not-array' },
  });
  assert.strictEqual(out.deathLedger.issueCount, 0);
  assert.deepStrictEqual(out.deathLedger.issues, []);
  assert.deepStrictEqual(out.deathLedger.dead, []);
  assert.strictEqual(out.woundRecovery.issueCount, 0);
  assert.deepStrictEqual(out.woundRecovery.issues, []);
});

test('rescan 第 1 集（无前序）：24 键全部产出不炸，穿帮池为空、健康壳 issueCount=0', () => {
  const out = MOD.rescanContinuityLedgers({
    text: '清晨的市集人声鼎沸，摊贩吆喝此起彼伏，林晚在街角慢慢走着查看四周动静。',
    epNo: 1,
    castNames: ['林晚'],
    prevScripts: [],
  });
  assert.strictEqual(Object.keys(out).length, 24, `应产出全部 24 键，实际 ${Object.keys(out).length}`);
  for (const k of MOD.CONTINUITY_LEDGER_KEYS) {
    assert.ok(k in out, `${k} 缺席`);
    assert.strictEqual(out[k].issueCount, 0, `${k} 无前序无穿帮`);
  }
  assert.deepStrictEqual(out.deathLedger.dead, []);
  assert.ok(!('rows' in out.villainFate), 'rescan 的 villainFate 同样只出诊断');
});

test('rescan: 前集封禁的玉佩在后集凭空再现 → prop_phantom(high)，账面保持封禁', () => {
  const out = MOD.rescanContinuityLedgers({
    text: '这一集无人提起那枚旧玉佩，朝堂上人人自危。',
    epNo: 3,
    castNames: ['林晚'],
    prevScripts: [
      { epNo: 1, qcReport: { props: { items: [{ name: '玉佩', closed: true }] } } },
      { epNo: 2, qcReport: { props: { items: [{ name: '玉佩' }] } } }, // 封禁后再提及=凭空再现
    ],
  });
  assert.ok(out.propLedger.issues.some((i) => i.type === 'prop_phantom' && i.severity === 'high'));
  assert.deepStrictEqual(out.propLedger.closed, ['玉佩']);
  assert.strictEqual(out.propLedger.phantom[0].reopenedEp, 2);
  assert.strictEqual(out.propLedger.plantedCount, 0, 'phantom 不重新激活账面');
});

test('rescan: 第 1 集确认死亡的角色第 2 集再开口 → resurrected_after_death(high) 复活穿帮', () => {
  const out = MOD.rescanContinuityLedgers({
    text: '△ 林晚推门而入，面色平静。',
    epNo: 3,
    castNames: ['林晚'],
    prevScripts: [
      { epNo: 1, qcReport: { death: { rows: [{ name: '林晚', dead: true, revived: false, active: true }] } } },
      { epNo: 2, qcReport: { death: { rows: [{ name: '林晚', dead: false, revived: false, active: true }] } } },
    ],
  });
  assert.ok(out.deathLedger.issues.some((i) => i.type === 'resurrected_after_death' && i.severity === 'high'));
  // 每名字只报一次即出册：死亡名册不再滞留
  assert.ok(!out.deathLedger.dead.some((d) => d.name === '林晚'));
});

test('rescan: 乱序前序内部按 ep 升序记账；输出键与短名摘要行零碰撞（含 villainFate 不蒸发 rows 语义）', () => {
  const out = MOD.rescanContinuityLedgers({
    text: '平稳推进的一集，林晚在书房读书养花，无人再来招惹。',
    epNo: 3,
    castNames: ['林晚', '林晚', '  '], // 重复/空白名去重容错
    prevScripts: [
      { epNo: 2, qcReport: { props: { items: [{ name: '玉佩' }] } } },
      { epNo: 1, qcReport: { props: { items: [{ name: '玉佩' }] } } },
      { epNo: 99, qcReport: { props: { items: [{ name: '不应出现的令牌' }] } } }, // ep>=cur 必须被过滤
    ],
  });
  assert.strictEqual(out.propLedger.plantedCount, 1, '乱序安全；第 99 集行（ep>=cur）不得入账，令牌不出现');
  assert.ok(!JSON.stringify(out).includes('不应出现的令牌'));
  for (const shortName of ['props', 'timeline', 'cost', 'death', 'wound', 'power', 'item', 'relation', 'affiliation', 'location', 'secretLeak', 'disguise', 'debt', 'alliance', 'memory', 'impersonation', 'betrayal', 'sacrifice', 'curse', 'possession', 'timeTravel', 'transformation', 'poison']) {
    assert.ok(!(shortName in out), `诊断长名键不得占用短名台账键 ${shortName}`);
  }
});

test('rescan: 非法 epNo/畸形前序行不炸，整体退 {} 或跳过脏行，绝不阻断', () => {
  assert.deepStrictEqual(MOD.rescanContinuityLedgers({ text: '什么文本都无所谓', epNo: 0, castNames: [], prevScripts: [] }), {});
  assert.deepStrictEqual(MOD.rescanContinuityLedgers({ text: 'x', epNo: NaN, castNames: [], prevScripts: [] }), {});
  const out = MOD.rescanContinuityLedgers({
    text: '林晚安静地在院中坐着，天气很好，什么事都没有发生。',
    epNo: 2,
    castNames: ['林晚'],
    prevScripts: [
      { epNo: 1, qcReport: null },
      { epNo: 1, qcReport: { death: { rows: [null, '脏行', { name: 123 }] } } },
      { epNo: 1, qcReport: { props: 'not-object' } },
      { epNo: 'bad', qcReport: {} },
    ],
  });
  assert.strictEqual(Object.keys(out).length, 24, '脏数据下 24 引擎仍全部产出');
  assert.strictEqual(out.deathLedger.issueCount, 0, '脏行全部跳过，不误报');
});

// c197 名实不符：/fix 改写的是「已完成集」，旧重放照搬生成路径的预览语义（引擎按 ep<cur 过滤
// 本集行），导致：①改写集自身引入的跨集穿帮（死者本集再开口等）/fix 后抓不到；②本集 24 个
// 短名摘要行从不产出/落库，后续集仍读旧稿状态。修复：引擎按 cur+1 评估（等价下一集生成时看到
// 的账面），bundle 另出 curRows 供 /fix 回写短名行。
test('c197 rescanContinuityBundle：改写集按已完成集评估，死者本集再开口当场抓复活，curRows 出 24 短名行', () => {
  const text = '△ 林晚推门而入，面色平静。\n林晚：我回来了，这些日子我一直在想你。';
  const b = MOD.rescanContinuityBundle({
    text,
    epNo: 2,
    castNames: ['林晚'],
    prevScripts: [
      { epNo: 1, qcReport: { death: { rows: [{ name: '林晚', dead: true, revived: false, active: true }] } } },
    ],
  });
  assert.ok(b.ledgers && b.curRows, 'bundle 须同时返回诊断与本集短名行');
  assert.ok(
    b.ledgers.deathLedger.issues.some((i) => i.type === 'resurrected_after_death' && i.severity === 'high'),
    '改写集自身引入的复活穿帮必须在 /fix 当场抓到（旧码本集行被过滤，永久滞后到下一集生成）',
  );
  // curRows：24 个短名键齐备且与生成路径落库形态同构
  assert.strictEqual(Object.keys(b.curRows).length, 24);
  assert.ok(b.curRows.props && Array.isArray(b.curRows.props.items), 'props 单对象短名行');
  assert.ok(b.curRows.timeline && 'mark' in b.curRows.timeline && 'spanDays' in b.curRows.timeline);
  assert.ok(typeof b.curRows.cost.won === 'boolean' && typeof b.curRows.cost.paid === 'boolean');
  const drow = b.curRows.death.rows.find((r) => r.name === '林晚');
  assert.ok(drow, 'death 短名行须逐角色产出');
  assert.strictEqual(drow.active, true, '短名行按新正文提取：林晚本集有动作+台词');
  assert.strictEqual(drow.dead, false);
  assert.ok(!('ep' in drow), '短名行不带 ep（与生成路径 qcReport.death.rows 同构，ep 在读取侧补）');
  assert.ok(Array.isArray(b.curRows.villainFate.rows) && b.curRows.villainFate.rows.some((r) => r.name === '林晚'));
});
