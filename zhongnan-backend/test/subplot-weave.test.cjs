// v2.80 支线编织台账测试：派生清洗 / 冷却分级 / 双语指令（en 层零中文）
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveSubplotBits, subplotWeaveLedger, subplotWeaveDirective,
  SUBPLOT_GAP_MID, SUBPLOT_GAP_HIGH, SUBPLOT_MAX_PER_EP,
} = require('../dist/engine/subplot-weave.js');

const bits = (pairs) => pairs.map(([thread, epNo]) => ({ thread, epNo }));

test('deriveSubplotBits：基础提取并附带集号', () => {
  const out = deriveSubplotBits({ subplots: ['妹妹钢琴赛', '副总查账'] }, 4);
  assert.deepEqual(out, [
    { thread: '妹妹钢琴赛', epNo: 4 },
    { thread: '副总查账', epNo: 4 },
  ]);
});

test('deriveSubplotBits：trim/去重/滤空/滤单字/滤超长/上限3条', () => {
  const out = deriveSubplotBits(
    { subplots: [' 妹妹钢琴赛 ', '', '妹妹钢琴赛', '查', '一'.repeat(13), '副总查账', '健身房风云', '第四条线'] },
    2,
  );
  assert.deepEqual(out.map((b) => b.thread), ['妹妹钢琴赛', '副总查账', '健身房风云']);
  assert.equal(out.length, SUBPLOT_MAX_PER_EP);
});

test('deriveSubplotBits：非法输入一律返回空数组', () => {
  assert.deepEqual(deriveSubplotBits(undefined, 1), []);
  assert.deepEqual(deriveSubplotBits(null, 1), []);
  assert.deepEqual(deriveSubplotBits('subplots', 1), []);
  assert.deepEqual(deriveSubplotBits({ subplots: '不是数组' }, 1), []);
  assert.deepEqual(deriveSubplotBits({ subplots: [1, {}, null] }, 1), []);
  assert.deepEqual(deriveSubplotBits({ subplots: [] }, 1), []);
});

test('deriveSubplotBits：集号非法回退为 1', () => {
  const out = deriveSubplotBits({ subplots: ['副总查账'] }, 0);
  assert.equal(out[0].epNo, 1);
});

test(`台账：未接续 < ${SUBPLOT_GAP_MID} 集不报（新鲜/正常休整）`, () => {
  for (const gap of [0, 1, SUBPLOT_GAP_MID - 1]) {
    const r = subplotWeaveLedger(bits([['副总查账', 10 - gap]]), 11);
    assert.deepEqual(r, { tracked: 1, cold: [] }, `gap=${gap} 不应报警`);
  }
});

test('台账：gap 达 mid 阈值报冷却，达 high 阈值升断线', () => {
  const mid = subplotWeaveLedger(bits([['副总查账', 10 - SUBPLOT_GAP_MID]]), 11);
  assert.equal(mid.cold[0].severity, 'mid');
  assert.equal(mid.cold[0].gap, SUBPLOT_GAP_MID);
  const high = subplotWeaveLedger(bits([['副总查账', 10 - SUBPLOT_GAP_HIGH]]), 11);
  assert.equal(high.cold[0].severity, 'high');
  assert.equal(high.cold[0].lastEp, 10 - SUBPLOT_GAP_HIGH);
});

test('台账：同名多集取最后活跃集；多线按严重度降序排序且 cap 4', () => {
  const r = subplotWeaveLedger(
    bits([
      ['副总查账', 2], ['副总查账', 5],           // 同名取 5，gap=5 → high
      ['妹妹钢琴赛', 6],                          // gap=4 → mid
      ['健身房风云', 7],                          // gap=3 → mid
      ['第四条支线', 8],                          // gap=2 → 不报
      ['第五条支线', 4], ['第六条支线', 3],        // high/mid，挤满 cap
    ]),
    11,
  );
  assert.equal(r.tracked, 6);
  assert.equal(r.cold.length, 4);
  // cap 后首位 = 严重度最高且 gap 最大者（第六条支线 gap=7 high）
  assert.equal(r.cold[0].thread, '第六条支线');
  assert.equal(r.cold[0].severity, 'high');
  // 排序断言：high 全部排在 mid 之前
  const firstMid = r.cold.findIndex((c) => c.severity === 'mid');
  const lastHigh = r.cold.map((c) => c.severity).lastIndexOf('high');
  if (firstMid >= 0 && lastHigh >= 0) assert.ok(lastHigh < firstMid);
});

test('台账：空线程名跳过；epNo 缺失/非法回退为 1 并照常计入台账', () => {
  assert.deepEqual(subplotWeaveLedger([], 5), { tracked: 0, cold: [] });
  assert.deepEqual(subplotWeaveLedger(undefined, 5), { tracked: 0, cold: [] });
  // epNo 回退 1 → 生成第5集时 gap=3 恰达 mid 阈值
  assert.deepEqual(
    subplotWeaveLedger([{ thread: '', epNo: 3 }, { thread: '副总查账', epNo: Number.NaN }], 5),
    { tracked: 1, cold: [{ severity: 'mid', thread: '副总查账', lastEp: 1, gap: 3 }] },
  );
});

test('指令 zh：空台账仍有 subplots 字段要求与交织规则，无断线块', () => {
  const d = subplotWeaveDirective([], 1);
  assert.ok(d.zh.includes('subplots'));
  assert.ok(d.zh.includes('支线拍点要嵌进主线节拍'));
  assert.ok(!d.zh.includes('已断线'));
  assert.ok(d.zh.endsWith('\n'));
});

test('指令 zh：冷线块列出线名/最后集号/断线集数，要求接回或收束', () => {
  const d = subplotWeaveDirective(bits([['副总查账', 2]]), 6);
  assert.ok(d.zh.includes('已断线'));
  assert.ok(d.zh.includes('「副总查账」自第2集后再未出现（已断3集）'));
  assert.ok(d.zh.includes('接回'));
  assert.ok(d.zh.includes('收束'));
});

test('指令 en：系统文案零中文（英文线名透传），含 subplots 与冷线措辞', () => {
  const dEmpty = subplotWeaveDirective([], 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(dEmpty.en));
  assert.ok(dEmpty.en.includes('"subplots"'));
  assert.ok(dEmpty.en.includes('no standalone subplot-only scenes'));

  const d = subplotWeaveDirective(bits([['Audit Trail', 2]]), 6);
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en));
  assert.ok(d.en.includes('"Audit Trail" unseen since ep2 (3 episodes cold)'));
  assert.ok(d.en.includes('resume it') && d.en.includes('close it explicitly'));
});

test('指令双语层一一对应：同一输入两种语言均非空', () => {
  const d = subplotWeaveDirective(bits([['副总查账', 3]]), 9);
  assert.ok(d.zh.length > 0 && d.en.length > 0);
  assert.ok(d.zh.includes('subplots') && d.en.includes('subplots'));
});
