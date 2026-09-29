// v2.80 代价跨集账本（cost-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveCostSignal,
  normalizeCostRow,
  costLedger,
  costDirective,
  COST_STREAK_MID,
  COST_STREAK_HIGH,
} = require('../dist/engine/cost-ledger.js');

// —— deriveCostSignal：信号提取 ——

test('deriveCostSignal：zh 胜利词/代价词/双有/双无', () => {
  assert.deepEqual(deriveCostSignal('沈青澜翻盘得手，满堂喝彩。'), { won: true, paid: false });
  assert.deepEqual(deriveCostSignal('她重伤吐血，家产被查抄殆尽。'), { won: false, paid: true });
  assert.deepEqual(deriveCostSignal('他付出了断臂的代价，终于赢了这一局。'), { won: true, paid: true });
  assert.deepEqual(deriveCostSignal('两人在码头对坐喝茶，聊起旧事。'), { won: false, paid: false });
});

test('deriveCostSignal：en 胜利词/代价词，大小写不敏感', () => {
  assert.deepEqual(deriveCostSignal('He pulled off the heist and got away clean.'), { won: true, paid: false });
  assert.deepEqual(deriveCostSignal('VICTORY came at a cost — she lost her brother.'), { won: true, paid: true });
  assert.deepEqual(deriveCostSignal('They retreated under cover of night.'), { won: false, paid: false });
});

test('deriveCostSignal：空串/超短文本安全返回双 false', () => {
  assert.deepEqual(deriveCostSignal(''), { won: false, paid: false });
  assert.deepEqual(deriveCostSignal('很短'), { won: false, paid: false });
  assert.deepEqual(deriveCostSignal(null), { won: false, paid: false });
});

// —— normalizeCostRow：摘要规范化 ——

test('normalizeCostRow：合法行入账，ep 非法 → null，won/paid 仅认布尔 true', () => {
  assert.deepEqual(normalizeCostRow({ ep: 4, won: true, paid: false }), { ep: 4, won: true, paid: false });
  assert.equal(normalizeCostRow({ ep: 0, won: true, paid: false }), null);
  assert.equal(normalizeCostRow({ ep: NaN, won: true, paid: true }), null);
  assert.equal(normalizeCostRow(null), null);
  assert.deepEqual(normalizeCostRow({ ep: 3, won: 'yes', paid: 1 }), { ep: 3, won: false, paid: false });
  assert.deepEqual(normalizeCostRow({ ep: 2.6, won: true, paid: false }), { ep: 3, won: true, paid: false }); // 四舍五入
});

// —— costLedger：跨集记账 ——

test('costLedger：空序列 → 无连胜无问题', () => {
  const r = costLedger([], 5);
  assert.equal(r.streak, 0);
  assert.equal(r.fromEp, 0);
  assert.equal(r.level, 'none');
  assert.deepEqual(r.issues, []);
});

test('costLedger：零代价连胜 2 集 → mid（evidence 含起点与连续数）', () => {
  const r = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
  ], 3);
  assert.equal(r.streak, 2);
  assert.equal(r.fromEp, 1);
  assert.equal(r.level, 'mid');
  assert.equal(r.issues[0].type, 'cost_free_streak');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('连续 2 集'));
});

test('costLedger：零代价连胜 3 集 → high', () => {
  const r = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
    { ep: 3, won: true, paid: false },
  ], 4);
  assert.equal(r.streak, 3);
  assert.equal(r.level, 'high');
});

test('costLedger：付代价即清零（同集 won+paid / 仅 paid）', () => {
  const r1 = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: true }, // 赢但付了代价
  ], 3);
  assert.equal(r1.streak, 0);
  assert.equal(r1.level, 'none');
  const r2 = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: false, paid: true }, // 没赢还付了代价
  ], 3);
  assert.equal(r2.streak, 0);
});

test('costLedger：没赢（won=false）也清零连胜', () => {
  const r = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
    { ep: 3, won: false, paid: false }, // 平局/无胜利集
  ], 4);
  assert.equal(r.streak, 0);
  assert.equal(r.fromEp, 0);
  assert.equal(r.level, 'none');
});

test('costLedger：中断后重连，连胜起点重置（fromEp=3）', () => {
  const r = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: true }, // 付了代价，清零
    { ep: 3, won: true, paid: false },
    { ep: 4, won: true, paid: false },
    { ep: 5, won: true, paid: false },
  ], 6);
  assert.equal(r.streak, 3);
  assert.equal(r.fromEp, 3);
  assert.equal(r.level, 'high');
});

test('costLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const r = costLedger([
    { ep: 3, won: true, paid: false },
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
    { ep: 9, won: true, paid: false }, // 未完成集剔除
  ], 4);
  assert.equal(r.streak, 3); // 若 ep9 未剔除则会是 4
  assert.equal(r.fromEp, 1);
});

test('costLedger：同集重复只计一次（以后到为准）', () => {
  const r = costLedger([
    { ep: 1, won: true, paid: false },
    { ep: 1, won: true, paid: true }, // 同集修正：付了代价
    { ep: 2, won: true, paid: false },
  ], 3);
  assert.equal(r.streak, 1);
  assert.equal(r.fromEp, 2);
  assert.equal(r.level, 'none');
});

// —— costDirective：架构师指令 ——

test('costDirective：连胜出"零代价连胜"指令，zh 含起点/连续数/付代价要求', () => {
  const b = costDirective([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
  ]);
  assert.ok(b.zh.includes('【跨集代价·零代价连胜】'));
  assert.ok(b.zh.includes('第 1 集'));
  assert.ok(b.zh.includes('连续 2 集'));
  assert.ok(b.zh.includes('先付代价'));
});

test('costDirective：en 层系统文案零中文（英文行单独验证）', () => {
  const b = costDirective([
    { ep: 1, won: true, paid: false },
    { ep: 2, won: true, paid: false },
    { ep: 3, won: true, paid: false },
  ]);
  assert.ok(b.en.includes('[Cross-episode cost — free-win streak]'));
  assert.ok(b.en.includes('ep 1'));
  assert.ok(b.en.includes('3 episodes straight'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
});

test('costDirective：无连胜/空输入 → 空串（两语言一致）', () => {
  assert.deepEqual(costDirective([]), { zh: '', en: '' });
  const paid = costDirective([{ ep: 1, won: true, paid: true }]);
  assert.equal(paid.zh, '');
  assert.equal(paid.en, '');
  const single = costDirective([{ ep: 1, won: true, paid: false }]);
  assert.equal(single.zh, ''); // 1 集未达 mid 阈值
});

// —— 常量 sanity ——

test('常量 sanity：连胜阈值 2/3', () => {
  assert.equal(COST_STREAK_MID, 2);
  assert.equal(COST_STREAK_HIGH, 3);
});
