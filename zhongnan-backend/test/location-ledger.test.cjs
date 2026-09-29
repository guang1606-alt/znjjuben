const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveLocationRows,
  normalizeLocRow,
  locationLedger,
  locationDirective,
} = require('../dist/engine/location-ledger');

const NAMES = ['林辰', '苏晚', '老者'];

test('location-ledger: zh 单集 stranded 提取（被困山洞）', () => {
  const draft = '林辰被困在山洞深处，浑身是伤。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.ok(rows.some((r) => r.name === '林辰' && r.stranded === true && r.place === '山洞'));
});

test('location-ledger: zh 单集 arrived 提取（回到林家）', () => {
  const draft = '林辰回到林家，发现大门敞开。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.ok(rows.some((r) => r.name === '林辰' && r.arrived === true && r.place === '林家'));
});

test('location-ledger: zh 单集 left 提取（离开京城）', () => {
  const draft = '林辰离开京城，踏上归途。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.ok(rows.some((r) => r.name === '林辰' && r.left === true && r.place === '京城'));
});

test('location-ledger: zh 单集 rescued 提取（脱困）', () => {
  const draft = '林辰终于脱困，重见天日。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.ok(rows.some((r) => r.name === '林辰' && r.rescued === true));
});

test('location-ledger: 跨集 trapped_then_free（上集被困山洞，下集无交代到林家）', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '林辰', place: '林家', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 2);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].type, 'trapped_then_free');
  assert.equal(res.issues[0].severity, 'high');
});

test('location-ledger: 跨集 rescued 后无 issue', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '林辰', place: '山洞', left: false, arrived: false, stranded: false, rescued: true },
    { ep: 2, name: '林辰', place: '林家', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 2);
  assert.equal(res.issues.length, 0);
});

test('location-ledger: 跨集 arrived 隐含脱困（上集重伤医院，下集抵达机场）', () => {
  // 上集 stranded 于医院，下集 arrived 机场无 rescued → 仍算穿帮（重伤不能直接到机场）
  const rows = [
    { ep: 1, name: '苏晚', place: '医院', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '苏晚', place: '机场', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 2);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].type, 'trapped_then_free');
});

test('location-ledger: 跨集 left 离开滞留地隐含脱困', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '林辰', place: '山洞', left: true, arrived: false, stranded: false, rescued: false },
    { ep: 2, name: '林辰', place: '林间', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 2);
  assert.equal(res.issues.length, 0);
});

test('location-ledger: 同集 stranded+arrived 合法过渡', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 1, name: '林辰', place: '林家', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 1);
  // 同集内先被困后到达（同集过账以 stranded 先置，arrived 后清），不跨集不报
  assert.equal(res.issues.length, 0);
});

test('location-ledger: 同集 stranded+rescued 合法', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 1, name: '林辰', place: '__rescued__', left: false, arrived: false, stranded: false, rescued: true },
  ];
  const res = locationLedger(rows, 1);
  assert.equal(res.issues.length, 0);
  assert.equal(res.strandeds.length, 0);
});

test('location-ledger: en stranded 提取', () => {
  const draft = 'Chen was trapped in the cave for three days.';
  const rows = deriveLocationRows(draft, ['Chen']);
  assert.ok(rows.some((r) => r.name === 'Chen' && r.stranded === true && r.place === 'cave'));
});

test('location-ledger: en arrived 提取', () => {
  const draft = 'Chen arrived at the Silver Lodge just before dawn.';
  const rows = deriveLocationRows(draft, ['Chen']);
  assert.ok(rows.some((r) => r.name === 'Chen' && r.arrived === true && r.place === 'Silver Lodge'));
});

test('location-ledger: 黑名单过滤（这里/那里不提取）', () => {
  const draft = '林辰被困在这里，动弹不得。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('location-ledger: 无信号不提取', () => {
  const draft = '林辰在屋里坐了下来，沉默不语。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('location-ledger: 短文本不提取', () => {
  const draft = '林辰被困。';
  const rows = deriveLocationRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('location-ledger: normalizeLocRow 容错', () => {
  assert.ok(normalizeLocRow({ ep: 3, name: '林辰', place: '山洞', stranded: true, rescued: false, left: false, arrived: false }));
  assert.equal(normalizeLocRow({ ep: 3, name: '', place: '山洞' }), null);
  assert.equal(normalizeLocRow({ ep: 3, name: '林辰', place: '' }), null);
  const r = normalizeLocRow({ ep: '5', name: '林辰', place: '山洞', stranded: 'true' });
  assert.equal(r?.ep, 5);
  assert.equal(r?.stranded, true);
});

test('location-ledger: locationDirective 非空输出', () => {
  const dir = locationDirective([
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
  ]);
  assert.ok(dir.zh.includes('地点连续性约束'));
  assert.ok(dir.zh.includes('山洞'));
  assert.ok(dir.en.includes('Location Continuity'));
});

test('location-ledger: 多角色独立记账', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 1, name: '苏晚', place: '医院', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '林辰', place: '林家', left: false, arrived: true, stranded: false, rescued: false },
    { ep: 2, name: '苏晚', place: '医院', left: false, arrived: false, stranded: false, rescued: true },
  ];
  const res = locationLedger(rows, 2);
  // 林辰穿帮，苏晚脱困
  assert.equal(res.issues.length, 1);
  assert.ok(res.issues[0].evidence.includes('林辰'));
});

test('location-ledger: 同集同名同地点合并（信号取并集）', () => {
  const draft = '林辰被困在山洞深处。\n林辰在山洞里苏醒过来。';
  const rows = deriveLocationRows(draft, NAMES);
  const r = rows.find((x) => x.name === '林辰' && x.place === '山洞');
  assert.ok(r);
  assert.equal(r.stranded, true);
  assert.equal(r.rescued, true);
});

test('location-ledger: stranded 名册输出（未脱困）', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
  ];
  const res = locationLedger(rows, 1);
  assert.equal(res.strandeds.length, 1);
  assert.equal(res.strandeds[0].place, '山洞');
  assert.equal(res.strandeds[0].strandEp, 1);
});

test('location-ledger: issue 只报一次（同地点跨多集瞬移只1条）', () => {
  const rows = [
    { ep: 1, name: '林辰', place: '山洞', left: false, arrived: false, stranded: true, rescued: false },
    { ep: 2, name: '林辰', place: '林家', left: false, arrived: true, stranded: false, rescued: false },
    { ep: 3, name: '林辰', place: '集市', left: false, arrived: true, stranded: false, rescued: false },
  ];
  const res = locationLedger(rows, 3);
  // 第2集报1次后 strandedPlace 被 arrived 清空，第3集无 stranded 状态不再报
  assert.equal(res.issues.length, 1);
});

test('location-ledger: 空输入安全返回', () => {
  const res = locationLedger([], 1);
  assert.equal(res.issues.length, 0);
  assert.equal(res.strandeds.length, 0);
  assert.equal(locationDirective([]).zh, '');
  assert.equal(locationDirective([]).en, '');
});
