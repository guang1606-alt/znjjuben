// v2.80 屈辱-打脸跨集账本（humiliation-ledger）测试：雷位提取 / 欠账记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractHumiliationBits,
  normalizeDebtEp,
  humiliationDebtLedger,
  humiliationDirective,
  HUM_DEBT_MID,
  HUM_DEBT_HIGH,
} = require('../dist/engine/humiliation-ledger.js');

// —— extractHumiliationBits：正文 → 羞辱雷位 ——

test('extractHumiliationBits：中文正文提取羞辱雷（marker/ep/位置）', () => {
  const bits = extractHumiliationBits('他当众撕毁婚约：废物也配站在这里？滚出顾家。她攥紧了拳。', 5);
  assert.ok(bits.length >= 2);
  assert.equal(bits[0].ep, 5);
  assert.ok(bits.every((b) => b.marker.length >= 1 && b.position >= 0 && b.position <= 1));
  assert.ok(bits.some((b) => b.marker.includes('废物')));
});

test('extractHumiliationBits：英文正文提取羞辱雷', () => {
  const bits = extractHumiliationBits("You're worthless to this family. Get out of here before I call security.", 3);
  assert.ok(bits.length >= 1);
});

test('extractHumiliationBits：同词去重 + 每集 cap 5', () => {
  const text = ['废物', '穷鬼', '你配吗', '退婚', '等着瞧', '你会后悔', '扫地出门', '给我跪下'].join('，') + '。';
  const bits = extractHumiliationBits(text, 4);
  assert.equal(bits.length, 5); // cap 5
  const markers = bits.map((b) => b.marker);
  assert.equal(new Set(markers).size, markers.length); // 去重
});

test('extractHumiliationBits：空文本/过短文本/非法集号 → 空', () => {
  assert.deepEqual(extractHumiliationBits('', 2), []);
  assert.deepEqual(extractHumiliationBits('废物', 2), []); // <20 字
  assert.deepEqual(extractHumiliationBits('他骂了一句废物就走了，没有回头。'.repeat(2), 0), []);
  assert.deepEqual(extractHumiliationBits('他骂了一句废物就走了，没有回头。'.repeat(2), NaN), []);
});

// —— normalizeDebtEp：落库摘要 → DebtEpInput ——

test('normalizeDebtEp：合法摘要正常入账，非法 ep 丢弃', () => {
  const r = normalizeDebtEp({ ep: 7, planted: 4, paid: 1, strong: 0, markers: ['废物', '你配吗'] });
  assert.deepEqual(r, { ep: 7, planted: 4, paid: 1, strong: 0, markers: ['废物', '你配吗'] });
  assert.equal(normalizeDebtEp({ ep: NaN, planted: 1 }), null);
  assert.equal(normalizeDebtEp(null), null);
});

test('normalizeDebtEp：计数缺省兜底 0、负数归 0、markers 过滤非字符串并 cap 5', () => {
  const r = normalizeDebtEp({ ep: 3, planted: -2, strong: 'x', markers: ['废物', 42, null, '穷鬼', '退婚', '你配吗', '等着瞧', '滚出去'] });
  assert.ok(r);
  assert.equal(r.planted, 0);
  assert.equal(r.strong, 0);
  assert.equal(r.paid, 0);
  assert.equal(r.markers.length, 5);
  assert.ok(r.markers.every((m) => typeof m === 'string'));
});

// —— humiliationDebtLedger：欠账记账 ——

test('humiliationDebtLedger：空序列 → debt 0 无问题', () => {
  const r = humiliationDebtLedger([], 5);
  assert.equal(r.debt, 0);
  assert.equal(r.level, 'none');
  assert.deepEqual(r.issues, []);
});

test('humiliationDebtLedger：连续只虐不还 → debt 累积报警（≥3 mid、≥5 high）', () => {
  const rows = [
    { ep: 1, planted: 2, paid: 0, strong: 0, markers: ['废物'] },
    { ep: 2, planted: 1, paid: 0, strong: 0, markers: ['你配吗'] },
  ];
  assert.equal(humiliationDebtLedger(rows, 3).debt, 3);
  assert.equal(humiliationDebtLedger(rows, 3).level, 'mid');
  const more = [...rows, { ep: 3, planted: 2, paid: 0, strong: 0, markers: ['穷鬼'] }];
  const r = humiliationDebtLedger(more, 4);
  assert.equal(r.debt, 5);
  assert.equal(r.level, 'high');
  assert.equal(r.issues[0].type, 'humiliation_debt');
  assert.ok(r.issues[0].evidence.includes('5'));
});

test('humiliationDebtLedger：强释放集跨集还账（无新雷爽集抵扣欠账）', () => {
  const rows = [
    { ep: 1, planted: 4, paid: 0, strong: 0, markers: ['废物'] },
    { ep: 2, planted: 0, paid: 0, strong: 3, markers: [] }, // 打脸还账
  ];
  const r = humiliationDebtLedger(rows, 3);
  assert.equal(r.debt, 1);
  assert.equal(r.level, 'none');
});

test('humiliationDebtLedger：debt 不为负（clamp 0）', () => {
  const rows = [
    { ep: 1, planted: 1, paid: 0, strong: 0, markers: [] },
    { ep: 2, planted: 0, paid: 0, strong: 9, markers: [] },
  ];
  assert.equal(humiliationDebtLedger(rows, 3).debt, 0);
});

test('humiliationDebtLedger：乱序输入安全（内部按 ep 升序）+ 只认 < curEpNo 的行', () => {
  const rows = [
    { ep: 2, planted: 2, paid: 0, strong: 0, markers: [] },
    { ep: 1, planted: 2, paid: 0, strong: 0, markers: [] },
    { ep: 5, planted: 9, paid: 0, strong: 0, markers: [] }, // 未完成集，剔除
  ];
  const r = humiliationDebtLedger(rows, 4);
  assert.equal(r.debt, 4);
});

test('humiliationDebtLedger：lastMarkers 取最近埋雷集的雷词', () => {
  const rows = [
    { ep: 1, planted: 2, paid: 0, strong: 0, markers: ['废物'] },
    { ep: 2, planted: 2, paid: 0, strong: 0, markers: ['穷鬼', '你配吗', '退婚', '等着瞧', '滚出去'] },
  ];
  const r = humiliationDebtLedger(rows, 3);
  assert.deepEqual(r.lastMarkers, ['穷鬼', '你配吗', '退婚']);
});

// —— humiliationDirective：架构师指令 ——

test('humiliationDirective：欠账达阈值出话，zh/en 双语齐备且 en 层零中文（英文雷词）', () => {
  const rows = [
    { ep: 1, planted: 2, paid: 0, strong: 0, markers: [] },
    { ep: 2, planted: 1, paid: 0, strong: 0, markers: ['trash', 'worthless'] },
  ];
  const d = humiliationDirective(rows);
  assert.ok(d.zh.includes('【屈辱欠账·对等还账】'));
  assert.ok(d.zh.includes('3 个未兑付'));
  assert.ok(d.zh.includes('对等兑付'));
  assert.ok(d.en.includes('[Humiliation debt'));
  assert.ok(d.en.includes('3 unpaid humiliation beats'));
  assert.ok(d.en.includes('trash'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en)); // en 雷词用英文内容，系统文案零中文
});

test('humiliationDirective：无欠账/欠账未达阈值 → 空串（两语言一致）', () => {
  assert.equal(humiliationDirective([]).zh, '');
  assert.equal(humiliationDirective([{ ep: 1, planted: 2, paid: 0, strong: 0, markers: ['废物'] }]).en, '');
});

test('常量 sanity：欠账阈值 3/5', () => {
  assert.equal(HUM_DEBT_MID, 3);
  assert.equal(HUM_DEBT_HIGH, 5);
});
