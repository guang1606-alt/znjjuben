// v2.80 反派威胁升级账本（villain-threat）测试：威胁动作分档 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectVillainAction,
  normalizeVillainRow,
  villainThreatLedger,
  villainThreatDirective,
  VILLAIN_SILENT_MID,
  VILLAIN_SILENT_HIGH,
  VILLAIN_STAGNANT_MID,
  VILLAIN_STAGNANT_HIGH,
} = require('../dist/engine/villain-threat.js');

// —— detectVillainAction：威胁动作分档检测 ——

test('detectVillainAction：L3 生死档优先于低档命中，逐档回落', () => {
  assert.deepEqual(detectVillainAction('他扬言要杀了他们全家，还威胁要毁掉一切'), { line: '杀了', level: 3 });
  assert.deepEqual(detectVillainAction('管家带人烧了仓库，砸了摊子'), { line: '烧了', level: 2 });
  assert.deepEqual(detectVillainAction('他威胁说，不会让你好过'), { line: '威胁', level: 1 });
  assert.deepEqual(detectVillainAction('两人对坐喝茶，聊起了天气。'), { line: '', level: 0 });
  assert.deepEqual(detectVillainAction(''), { line: '', level: 0 });
  assert.deepEqual(detectVillainAction('   '), { line: '', level: 0 });
});

test('detectVillainAction：en 词表逐档命中，代表词原样返回', () => {
  assert.deepEqual(detectVillainAction('They will kill him tonight.'), { line: 'kill', level: 3 });
  assert.deepEqual(detectVillainAction('He had her office burned down.'), { line: 'burned down', level: 2 });
  assert.deepEqual(detectVillainAction('He threatened to make them pay.'), { line: 'threaten', level: 1 });
  assert.deepEqual(detectVillainAction('They shook hands and had tea.'), { line: '', level: 0 });
});

// —— normalizeVillainRow：摘要规范化 ——

test('normalizeVillainRow：合法行入账，ep 非法 → null，level clamp，acted 容错', () => {
  assert.deepEqual(normalizeVillainRow({ ep: 4, line: '追杀', acted: true, level: 2 }), { ep: 4, line: '追杀', acted: true, level: 2 });
  assert.equal(normalizeVillainRow({ ep: 0, line: '', acted: false, level: 0 }), null);
  assert.equal(normalizeVillainRow({ ep: NaN, line: '', acted: false, level: 0 }), null);
  assert.equal(normalizeVillainRow(null), null);
  assert.equal(normalizeVillainRow({ ep: 3, line: '追杀'.repeat(15), acted: true, level: 2 }).line.length, 20);
  assert.equal(normalizeVillainRow({ ep: 3, line: '追杀', acted: true, level: 9 }).level, 3);
  assert.equal(normalizeVillainRow({ ep: 3, line: '追杀', acted: true, level: 0 }).level, 1); // 有动作缺档位 → 归口头档
  assert.deepEqual(normalizeVillainRow({ ep: 3, line: '追杀', acted: 1, level: 2 }), { ep: 3, line: '追杀', acted: true, level: 2 });
  // acted=false 强制清 line/level
  assert.deepEqual(normalizeVillainRow({ ep: 3, line: '追杀', acted: false, level: 3 }), { ep: 3, line: '', acted: false, level: 0 });
});

// —— villainThreatLedger：跨集记账 ——

test('villainThreatLedger：空序列 → 全 0 无问题', () => {
  const r = villainThreatLedger([], 5);
  assert.equal(r.silentRun, 0);
  assert.equal(r.stagnantRun, 0);
  assert.equal(r.level, 'none');
  assert.equal(r.line, '');
  assert.deepEqual(r.issues, []);
});

test('villainThreatLedger：连续无动作逐集 +1（2 集 mid、3 集 high），有动作清零', () => {
  const rows = [
    { ep: 1, line: '抓走', acted: true, level: 2 },
    { ep: 2, line: '', acted: false, level: 0 },
    { ep: 3, line: '', acted: false, level: 0 },
    { ep: 4, line: '', acted: false, level: 0 },
  ];
  const mid = villainThreatLedger(rows.slice(0, 3), 4);
  assert.equal(mid.silentRun, 2);
  assert.equal(mid.level, 'mid');
  assert.equal(mid.issues[0].type, 'villain_silent');
  const high = villainThreatLedger(rows, 5);
  assert.equal(high.silentRun, 3);
  assert.equal(high.level, 'high');
  assert.ok(high.issues[0].evidence.includes('抓走'));
  // 反派回场即清零
  const back = villainThreatLedger([...rows, { ep: 5, line: '堵门', acted: true, level: 2 }], 6);
  assert.equal(back.silentRun, 0);
  assert.equal(back.level, 'none');
});

test('villainThreatLedger：同档复用 stagnant 逐集 +1（3 集 mid、4 集 high），升级/降档复用/沉默挂起语义', () => {
  const same = (n) => Array.from({ length: n }, (_, i) => ({ ep: i + 1, line: '威胁', acted: true, level: 1 }));
  const mid = villainThreatLedger(same(4), 5);
  assert.equal(mid.stagnantRun, 3);
  assert.equal(mid.level, 'mid');
  assert.equal(mid.issues[0].type, 'villain_stagnant');
  const high = villainThreatLedger(same(5), 6);
  assert.equal(high.stagnantRun, 4);
  assert.equal(high.level, 'high');
  // 升级双清零
  const up = villainThreatLedger([...same(3), { ep: 4, line: '追杀', acted: true, level: 2 }], 5);
  assert.equal(up.stagnantRun, 0);
  assert.equal(up.silentRun, 0);
  // 降档也算复用（不升级）
  const down = villainThreatLedger([{ ep: 1, line: '追杀', acted: true, level: 3 }, { ep: 2, line: '威胁', acted: true, level: 1 }], 3);
  assert.equal(down.stagnantRun, 1);
  // 沉默期间 stagnant 挂起保持（不清零不加重）
  const idle = villainThreatLedger([
    { ep: 1, line: '威胁', acted: true, level: 1 },
    { ep: 2, line: '威胁', acted: true, level: 1 },
    { ep: 3, line: '', acted: false, level: 0 },
    { ep: 4, line: '威胁', acted: true, level: 1 },
  ], 5);
  assert.equal(idle.stagnantRun, 2);
  assert.equal(idle.silentRun, 0);
});

test('villainThreatLedger：silent 与 stagnant 并存，level 取重者，双病齐报', () => {
  const rows = [
    { ep: 1, line: '威胁', acted: true, level: 1 },
    { ep: 2, line: '威胁', acted: true, level: 1 },
    { ep: 3, line: '威胁', acted: true, level: 1 },
    { ep: 4, line: '威胁', acted: true, level: 1 },
    { ep: 5, line: '', acted: false, level: 0 },
    { ep: 6, line: '', acted: false, level: 0 },
    { ep: 7, line: '', acted: false, level: 0 },
  ];
  const r = villainThreatLedger(rows, 8);
  assert.equal(r.stagnantRun, 3);
  assert.equal(r.silentRun, 3);
  assert.equal(r.level, 'high');
  assert.deepEqual(r.issues.map((i) => i.type).sort(), ['villain_silent', 'villain_stagnant']);
  assert.equal(r.line, '威胁');
});

test('villainThreatLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const rows = [
    { ep: 3, line: '', acted: false, level: 0 },
    { ep: 1, line: '抓走', acted: true, level: 2 },
    { ep: 2, line: '', acted: false, level: 0 },
    { ep: 9, line: '', acted: false, level: 0 }, // 未完成集剔除
  ];
  const r = villainThreatLedger(rows, 4);
  assert.equal(r.silentRun, 2);
  assert.equal(r.level, 'mid');
});

// —— villainThreatDirective：架构师指令 ——

test('villainThreatDirective：缺席达阈值出"回场施压"，zh/en 双语齐备', () => {
  const d = villainThreatDirective([
    { ep: 1, line: '抓走', acted: true, level: 2 },
    { ep: 2, line: '', acted: false, level: 0 },
    { ep: 3, line: '', acted: false, level: 0 },
  ]);
  assert.ok(d.zh.includes('【反派威胁·本集回场施压】'));
  assert.ok(d.zh.includes('连续 2 集无任何威胁动作'));
  assert.ok(d.zh.includes('回到台前'));
  assert.ok(d.en.includes('[Villain threat — bring him back on stage]'));
  assert.ok(d.en.includes('offstage for 2 episodes'));
});

test('villainThreatDirective：同档复用达阈值出"升档"，zh/en 双语齐备', () => {
  const same = (n) => Array.from({ length: n }, (_, i) => ({ ep: i + 1, line: '威胁', acted: true, level: 1 }));
  const d = villainThreatDirective(same(4));
  assert.ok(d.zh.includes('【反派威胁·本集升档】'));
  assert.ok(d.zh.includes('连续 3 集复用同档手段'));
  assert.ok(d.zh.includes('口头→行动→生死'));
  assert.ok(d.en.includes('[Villain threat — escalate this episode]'));
  assert.ok(d.en.includes('recycled the same level of menace'));
});

test('villainThreatDirective：en 层系统文案零中文（英文动作词单独验证）', () => {
  const same = (n) => Array.from({ length: n }, (_, i) => ({ ep: i + 1, line: 'hunt you down', acted: true, level: 2 }));
  const d = villainThreatDirective(same(4));
  assert.ok(d.en.includes('hunt you down'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en));
  const silent = villainThreatDirective([
    { ep: 1, line: 'threat', acted: true, level: 1 },
    { ep: 2, line: '', acted: false, level: 0 },
    { ep: 3, line: '', acted: false, level: 0 },
  ]);
  assert.ok(silent.en.includes('threat'));
  assert.ok(!/[\u4e00-\u9fff]/.test(silent.en));
});

test('villainThreatDirective：无达标/空输入 → 空串（两语言一致）', () => {
  assert.deepEqual(villainThreatDirective([]), { zh: '', en: '' });
  const fresh = villainThreatDirective([{ ep: 1, line: '追杀', acted: true, level: 3 }]);
  assert.equal(fresh.zh, '');
  assert.equal(fresh.en, '');
  const upgraded = villainThreatDirective([
    { ep: 1, line: '威胁', acted: true, level: 1 },
    { ep: 2, line: '追杀', acted: true, level: 2 },
  ]);
  assert.equal(upgraded.zh, '');
});

// —— 常量 sanity ——

test('常量 sanity：缺席阈值 2/3，复用阈值 3/4', () => {
  assert.equal(VILLAIN_SILENT_MID, 2);
  assert.equal(VILLAIN_SILENT_HIGH, 3);
  assert.equal(VILLAIN_STAGNANT_MID, 3);
  assert.equal(VILLAIN_STAGNANT_HIGH, 4);
});
