// v2.80 憋爽波浪台账测试：规范化 / 四类连续段 / 断档即停 / 双语指令（en 层零中文）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeWaveEp, gratificationWave, gratificationDirective,
  GRAT_STRONG_MID, GRAT_STRONG_HIGH, GRAT_NORELEASE_HIGH, GRAT_STRETCH_MID, GRAT_TAIL_POSITION,
} = require('../dist/engine/gratification-wave.js');

const eps = (rows) => rows.map(([ep, suppressCount, releaseCount, strongReleaseCount, firstReleasePosition]) =>
  ({ ep, suppressCount, releaseCount, strongReleaseCount, firstReleasePosition }));

test('normalizeWaveEp：合法透传 + 位置截断 + 计数取整非负', () => {
  assert.deepEqual(
    normalizeWaveEp({ ep: 3, suppressCount: 2.7, releaseCount: -1, strongReleaseCount: 1, firstReleasePosition: 1.5 }),
    { ep: 3, suppressCount: 3, releaseCount: 0, strongReleaseCount: 1, firstReleasePosition: 1 },
  );
  assert.deepEqual(
    normalizeWaveEp({ ep: 4, suppressCount: 0, releaseCount: 0, strongReleaseCount: 0, firstReleasePosition: null }),
    { ep: 4, suppressCount: 0, releaseCount: 0, strongReleaseCount: 0, firstReleasePosition: null },
  );
});

test('normalizeWaveEp：非法输入一律返回 null', () => {
  assert.equal(normalizeWaveEp(undefined), null);
  assert.equal(normalizeWaveEp(null), null);
  assert.equal(normalizeWaveEp('ep3'), null);
  assert.equal(normalizeWaveEp({ suppressCount: 1 }), null); // 缺 ep
  assert.equal(normalizeWaveEp({ ep: 0 }), null);
  assert.equal(normalizeWaveEp({ ep: Number.NaN }), null);
  // 缺省字段按 0/null 补齐
  assert.deepEqual(
    normalizeWaveEp({ ep: 2 }),
    { ep: 2, suppressCount: 0, releaseCount: 0, strongReleaseCount: 0, firstReleasePosition: null },
  );
});

test('台账：无输入 / 最后已完成集无记录 → 零问题（宁少报不误报）', () => {
  assert.deepEqual(gratificationWave([], 11), { tracked: 0, issues: [] });
  assert.deepEqual(gratificationWave(undefined, 11), { tracked: 0, issues: [] });
  // 生成第11集，但前集只有 ep5（断档）→ 不数连续段
  assert.deepEqual(
    gratificationWave(eps([[5, 1, 0, 0, null]]), 11),
    { tracked: 1, issues: [] },
  );
});

test(`台账：连续 ${GRAT_STRONG_MID} 集无强释放报 mid，连续中断后重新计数`, () => {
  const r = gratificationWave(eps([
    [7, 2, 1, 1, 0.3],  // 有强爽 → 打断
    [8, 2, 1, 0, null],
    [9, 2, 1, 0, null],
    [10, 2, 1, 0, null],
  ]), 11);
  assert.equal(r.tracked, 4);
  assert.deepEqual(r.issues, [{ severity: 'mid', type: 'no_strong_stretch', fromEp: 8, stretch: 3 }]);
});

test(`台账：连续 ${GRAT_STRONG_HIGH} 集无强释放升 high`, () => {
  const rows = [];
  for (let ep = 6; ep <= 10; ep += 1) rows.push([ep, 2, 1, 0, null]);
  const r = gratificationWave(eps(rows), 11);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].stretch, 5);
  assert.equal(r.issues[0].fromEp, 6);
});

test('台账：连续段内断档（缺集）即停', () => {
  const r = gratificationWave(eps([
    [7, 2, 1, 0, null],
    // ep8 缺失
    [9, 2, 1, 0, null],
    [10, 2, 1, 0, null],
  ]), 11);
  assert.deepEqual(r.issues, []); // 只能数到 2 < 3，不报
});

test(`台账：连续 ${GRAT_NORELEASE_HIGH} 集零释放（纯虐）即报 high`, () => {
  const r = gratificationWave(eps([
    [9, 3, 0, 0, null],
    [10, 3, 0, 0, null],
  ]), 11);
  assert.deepEqual(r.issues, [{ severity: 'high', type: 'no_release_stretch', fromEp: 9, stretch: 2 }]);
});

test(`台账：连续 ${GRAT_STRETCH_MID} 集零受压（一路平推）报 mid`, () => {
  const r = gratificationWave(eps([
    [8, 0, 2, 1, 0.4],
    [9, 0, 2, 1, 0.5],
    [10, 0, 2, 1, 0.6],
  ]), 11);
  assert.deepEqual(r.issues, [{ severity: 'mid', type: 'no_suppress_stretch', fromEp: 8, stretch: 3 }]);
});

test(`台账：连续 ${GRAT_STRETCH_MID} 集首爽位置 ≥ ${GRAT_TAIL_POSITION}（尾段堆积）报 mid；0.69 不计入`, () => {
  const ok = gratificationWave(eps([
    [8, 1, 1, 1, 0.69],
    [9, 1, 1, 1, 0.8],
    [10, 1, 1, 1, 0.9],
  ]), 11);
  assert.deepEqual(ok.issues, []); // 0.69 断链（< 0.7 不计入）
  const bad = gratificationWave(eps([
    [8, 1, 1, 1, 0.75],
    [9, 1, 1, 1, 0.8],
    [10, 1, 1, 1, 0.9],
  ]), 11);
  assert.deepEqual(bad.issues, [{ severity: 'mid', type: 'tail_loaded_stretch', fromEp: 8, stretch: 3 }]);
});

test('台账：多问题并存，high 排在 mid 前', () => {
  const r = gratificationWave(eps([
    [8, 0, 0, 0, null],
    [9, 0, 0, 0, null],
    [10, 0, 0, 0, null],
  ]), 11);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'no_release_stretch');
  const types = r.issues.map((i) => i.type);
  assert.ok(types.includes('no_strong_stretch') && types.includes('no_suppress_stretch'));
});

test('指令：无问题返回空串（与疲劳指令同构）', () => {
  assert.equal(gratificationDirective([], 11).zh, '');
  assert.equal(gratificationDirective(eps([[10, 2, 1, 1, 0.3]]), 11).en, '');
});

test('指令 zh：列出连续集数与布点要求', () => {
  const d = gratificationDirective(eps([
    [9, 3, 0, 0, null],
    [10, 3, 0, 0, null],
  ]), 11);
  assert.ok(d.zh.startsWith('【爽感波浪·跨集节奏】'));
  assert.ok(d.zh.includes('已连续 2 集零释放'));
  assert.ok(d.zh.includes('弃剧线'));
  assert.ok(d.zh.endsWith('\n'));
});

test('指令 en：系统文案零中文', () => {
  const d = gratificationDirective(eps([
    [8, 2, 1, 0, null],
    [9, 2, 1, 0, null],
    [10, 2, 1, 0, null],
  ]), 11);
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en));
  assert.ok(d.en.includes('3 episodes in a row without a single strong release'));
  assert.ok(d.en.includes('MUST land at least one strong release'));
});

test('指令双语层一一对应：同一输入两种语言均非空', () => {
  const d = gratificationDirective(eps([
    [9, 0, 2, 1, 0.5],
    [10, 0, 2, 1, 0.5],
  ]), 11);
  assert.equal(d.zh.length, 0); // 只有1集零受压 < 3，无问题 → 空
  const d2 = gratificationDirective(eps([
    [8, 0, 2, 1, 0.5],
    [9, 0, 2, 1, 0.5],
    [10, 0, 2, 1, 0.5],
  ]), 11);
  assert.ok(d2.zh.length > 0 && d2.en.length > 0);
});
