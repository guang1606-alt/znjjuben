// v2.80 时间线跨集账本（timeline-ledger）测试：锚点提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseZhNum,
  deriveTimelineMark,
  normalizeTimelineRow,
  timelineLedger,
  timelineDirective,
  TIMELINE_DROUGHT_MID,
  TIMELINE_DROUGHT_HIGH,
} = require('../dist/engine/timeline-ledger.js');

// —— parseZhNum：中文数字 ——
test('parseZhNum：阿拉伯/单字/十/百/几/半 全覆盖，失败 NaN', () => {
  assert.equal(parseZhNum('3'), 3);
  assert.equal(parseZhNum('二十'), 20);
  assert.equal(parseZhNum('二十一'), 21);
  assert.equal(parseZhNum('十'), 10);
  assert.equal(parseZhNum('十五'), 15);
  assert.equal(parseZhNum('一百'), 100);
  assert.equal(parseZhNum('两百'), 200);
  assert.equal(parseZhNum('几'), 3);
  assert.equal(parseZhNum('半'), 0.5);
  assert.ok(Number.isNaN(parseZhNum('甲')));
});

// —— deriveTimelineMark：时间锚提取 ——

test('deriveTimelineMark：数字跨度锚（三天后/二十天/半月/两小时），span 归一化成天', () => {
  assert.deepEqual(deriveTimelineMark('三天后，沈青澜抵达京城。'), { mark: '三天后', spanDays: 3, carry: false });
  assert.equal(deriveTimelineMark('二十天后，诏书到了。').spanDays, 20);
  assert.equal(deriveTimelineMark('半个月之后，她回来了。').spanDays, 15);
  assert.equal(deriveTimelineMark('两小时后，伤口缝好。').spanDays, 0);
  assert.equal(deriveTimelineMark('七日后，比武大会开场。').spanDays, 7);
});

test('deriveTimelineMark：固定词锚（翌日=1 前进 / 当晚=0 承接），按位置取首个', () => {
  assert.deepEqual(deriveTimelineMark('翌日清晨，两人在码头碰面。'), { mark: '翌日', spanDays: 1, carry: false });
  assert.deepEqual(deriveTimelineMark('当晚，他彻夜未眠。'), { mark: '当晚', spanDays: 0, carry: true });
  assert.deepEqual(deriveTimelineMark('与此同时，城另一头火光冲天。'), { mark: '与此同时', spanDays: 0, carry: true });
  assert.deepEqual(deriveTimelineMark('两人对坐喝茶，聊起了天气。'), { mark: '', spanDays: null, carry: false });
  assert.deepEqual(deriveTimelineMark(''), { mark: '', spanDays: null, carry: false });
});

test('deriveTimelineMark：闪回句豁免（当年/回忆/年前），回溯表达不取锚', () => {
  assert.deepEqual(deriveTimelineMark('当年，一夜之间家破人亡。翌日清晨，她离开了。'), { mark: '翌日', spanDays: 1, carry: false });
  assert.equal(deriveTimelineMark('他回忆起十年前的那场大火。').spanDays, null);
  assert.equal(deriveTimelineMark('这是十年前的旧事。').spanDays, null);
  assert.equal(deriveTimelineMark('第3天，比武开始。').spanDays, null); // 序数非跨度
});

test('deriveTimelineMark：en 固定词/数字跨度/half 短语，承接词标记 carry', () => {
  assert.equal(deriveTimelineMark('Three days later, he returned.').spanDays, 3);
  assert.deepEqual(deriveTimelineMark('The next day, they met again.'), { mark: 'the next day', spanDays: 1, carry: false });
  assert.deepEqual(deriveTimelineMark('That night, nobody slept.'), { mark: 'that night', spanDays: 0, carry: true });
  assert.equal(deriveTimelineMark('Half a month later, the baby was born.').spanDays, 15);
  assert.equal(deriveTimelineMark('He nodded and left the room.').spanDays, null);
});

// —— normalizeTimelineRow：摘要规范化 ——

test('normalizeTimelineRow：合法行入账，ep 非法 → null，mark 截断，spanDays 容错', () => {
  assert.deepEqual(normalizeTimelineRow({ ep: 4, mark: '三天后', spanDays: 3 }), { ep: 4, mark: '三天后', spanDays: 3 });
  assert.equal(normalizeTimelineRow({ ep: 0, mark: '', spanDays: null }), null);
  assert.equal(normalizeTimelineRow({ ep: NaN, mark: '', spanDays: 1 }), null);
  assert.equal(normalizeTimelineRow(null), null);
  assert.equal(normalizeTimelineRow({ ep: 3, mark: '三'.repeat(60), spanDays: 3 }).mark.length, 48);
  assert.equal(normalizeTimelineRow({ ep: 3, mark: '三天后', spanDays: 'x' }).spanDays, null);
  assert.deepEqual(normalizeTimelineRow({ ep: 3, mark: '当晚', spanDays: 0 }), { ep: 3, mark: '当晚', spanDays: 0 });
});

// —— timelineLedger：跨集记账 ——

test('timelineLedger：空序列 → 全空无问题', () => {
  const r = timelineLedger([], 5);
  assert.equal(r.droughtRun, 0);
  assert.equal(r.backwards, null);
  assert.equal(r.level, 'none');
  assert.equal(r.line, '');
  assert.deepEqual(r.issues, []);
});

test('timelineLedger：锚点跨度回落 → 时序倒流 high（报最后一处，含两锚明细）', () => {
  const r = timelineLedger([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '翌日', spanDays: 1 },
  ], 3);
  assert.equal(r.level, 'high');
  assert.deepEqual(r.backwards, { ep: 2, mark: '翌日', prevMark: '三天后', prevSpan: 3, span: 1 });
  assert.equal(r.issues[0].type, 'timeline_backwards');
  assert.ok(r.issues[0].evidence.includes('三天后'));
  // 前集锚 <2 天的回落不报（翌日→当天属正常同日推进）
  const minor = timelineLedger([
    { ep: 1, mark: '翌日', spanDays: 1 },
    { ep: 2, mark: '清晨', spanDays: 0 },
  ], 3);
  assert.equal(minor.backwards, null);
  // 多处倒流报最后一处
  const multi = timelineLedger([
    { ep: 1, mark: '五日后', spanDays: 5 },
    { ep: 2, mark: '翌日', spanDays: 1 },
    { ep: 3, mark: '七日后', spanDays: 7 },
    { ep: 4, mark: '三日后', spanDays: 3 },
  ], 5);
  assert.equal(multi.backwards.ep, 4);
  assert.equal(multi.backwards.prevMark, '七日后');
});

test('timelineLedger：承接锚时钟原地（三日后→当晚→翌日 不构成倒流）', () => {
  const r = timelineLedger([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '当晚', spanDays: 0 },
    { ep: 3, mark: '翌日', spanDays: 1 },
  ], 4);
  assert.equal(r.backwards, null);
  assert.equal(r.droughtRun, 0);
  assert.equal(r.line, '翌日');
});

test('timelineLedger：连续无锚干旱逐集 +1（2 集 mid、3 集 high），有锚/承接锚清零', () => {
  const rows = [
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '', spanDays: null },
    { ep: 3, mark: '', spanDays: null },
    { ep: 4, mark: '', spanDays: null },
  ];
  const mid = timelineLedger(rows.slice(0, 3), 4);
  assert.equal(mid.droughtRun, 2);
  assert.equal(mid.level, 'mid');
  assert.equal(mid.issues[0].type, 'timeline_drought');
  const high = timelineLedger(rows, 5);
  assert.equal(high.droughtRun, 3);
  assert.equal(high.level, 'high');
  // 有锚清零
  const back = timelineLedger([...rows, { ep: 5, mark: '七日后', spanDays: 7 }], 6);
  assert.equal(back.droughtRun, 0);
  assert.equal(back.level, 'none');
  // 承接锚也算有锚（清干旱）
  const carry = timelineLedger([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '', spanDays: null },
    { ep: 3, mark: '当晚', spanDays: 0 },
  ], 4);
  assert.equal(carry.droughtRun, 0);
});

test('timelineLedger：倒流与干旱并存 → 双病齐报，倒流压 level 为 high', () => {
  const r = timelineLedger([
    { ep: 1, mark: '七日后', spanDays: 7 },
    { ep: 2, mark: '翌日', spanDays: 1 },
    { ep: 3, mark: '', spanDays: null },
    { ep: 4, mark: '', spanDays: null },
  ], 5);
  assert.equal(r.level, 'high');
  assert.deepEqual(r.issues.map((i) => i.type).sort(), ['timeline_backwards', 'timeline_drought']);
});

test('timelineLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const rows = [
    { ep: 3, mark: '翌日', spanDays: 1 },
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '', spanDays: null },
    { ep: 9, mark: '', spanDays: null }, // 未完成集剔除
  ];
  const r = timelineLedger(rows, 4);
  assert.equal(r.droughtRun, 0); // 尾集 ep3 有锚 → 尾连干旱清零（若 ep9 未剔除则会是 1）
  assert.equal(r.backwards, null); // 无锚集断链：ep1(3)→ep2 无锚→ep3(1) 不判倒流
});

// —— timelineDirective：架构师指令 ——

test('timelineDirective：倒流出"时序校准"，干旱出"补时间锚"，zh/en 双语齐备', () => {
  const b = timelineDirective([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '翌日', spanDays: 1 },
  ]);
  assert.ok(b.zh.includes('【跨集时序·本集校准】'));
  assert.ok(b.zh.includes('三天后'));
  assert.ok(b.zh.includes('闪回'));
  assert.ok(b.en.includes('[Timeline — recalibrate this episode]'));
  const d = timelineDirective([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '', spanDays: null },
    { ep: 3, mark: '', spanDays: null },
  ]);
  assert.ok(d.zh.includes('【跨集时序·补时间锚】'));
  assert.ok(d.zh.includes('连续 2 集无任何时间锚'));
  assert.ok(d.en.includes('[Timeline — drop a time anchor]'));
});

test('timelineDirective：en 层系统文案零中文（英文锚词单独验证）', () => {
  const b = timelineDirective([
    { ep: 1, mark: 'three days later', spanDays: 3 },
    { ep: 2, mark: 'the next day', spanDays: 1 },
  ]);
  assert.ok(b.en.includes('three days later'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
  const d = timelineDirective([
    { ep: 1, mark: 'three days later', spanDays: 3 },
    { ep: 2, mark: '', spanDays: null },
    { ep: 3, mark: '', spanDays: null },
  ]);
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en));
});

test('timelineDirective：无病/空输入 → 空串（两语言一致）', () => {
  assert.deepEqual(timelineDirective([]), { zh: '', en: '' });
  const fresh = timelineDirective([{ ep: 1, mark: '三天后', spanDays: 3 }]);
  assert.equal(fresh.zh, '');
  assert.equal(fresh.en, '');
  const forward = timelineDirective([
    { ep: 1, mark: '三天后', spanDays: 3 },
    { ep: 2, mark: '七日后', spanDays: 7 },
  ]);
  assert.equal(forward.zh, '');
});

// —— 常量 sanity ——

test('常量 sanity：干旱阈值 2/3', () => {
  assert.equal(TIMELINE_DROUGHT_MID, 2);
  assert.equal(TIMELINE_DROUGHT_HIGH, 3);
});
