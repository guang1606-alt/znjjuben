// v2.80 信物跨集连续性账本（prop-ledger）测试：信物提取 / 摘要规范化 / 状态机记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractPropMentions,
  normalizePropRow,
  propLedger,
  propDirective,
  PROP_DANGLING_MID,
  PROP_DANGLING_HIGH,
  PROP_DIRECTIVE_GAP,
} = require('../dist/engine/prop-ledger.js');

// —— extractPropMentions：信物提取 ——

test('extractPropMentions：zh 正文提取信物，逐句去重', () => {
  const items = extractPropMentions('她攥紧了半块玉佩，这是娘留下的遗物。\n婚书就压在箱底。');
  const names = items.map((i) => i.name);
  assert.ok(names.includes('半块玉佩'));
  assert.ok(names.includes('婚书'));
  assert.ok(names.every((n) => !n.includes('玉佩') || n === '半块玉佩' || n === '玉佩')); // 长词优先，玉佩单独句也可能入
  assert.equal(items.filter((i) => i.name === '半块玉佩').length, 1);
});

test('extractPropMentions：销毁动作同句 → closed，不同句不误伤', () => {
  const closed = extractPropMentions('他一把将玉佩摔在地上，顿时碎了。');
  assert.equal(closed.length, 1);
  assert.equal(closed[0].name, '玉佩');
  assert.equal(closed[0].closed, true);
  const alive = extractPropMentions('她小心翼翼地收好玉佩，转身离开。');
  assert.equal(alive[0].closed, false);
});

test('extractPropMentions：无信物/空文本 → 空数组，en 提取走词界', () => {
  assert.deepEqual(extractPropMentions('两人对坐喝茶，聊起了天气。'), []);
  assert.deepEqual(extractPropMentions(''), []);
  assert.deepEqual(extractPropMentions('   '), []);
  const en = extractPropMentions('She held the locket tight. The contract was gone.');
  assert.ok(en.some((i) => i.name === 'locket'));
  assert.ok(en.some((i) => i.name === 'contract'));
  const enClosed = extractPropMentions('He burned the diary last night.');
  assert.equal(enClosed[0].name, 'diary');
  assert.equal(enClosed[0].closed, true);
});

// —— normalizePropRow：摘要规范化 ——

test('normalizePropRow：合法行入账，ep 非法 → null，坏条目过滤', () => {
  assert.deepEqual(
    normalizePropRow({ ep: 4, items: [{ name: '玉佩', closed: false }, { name: '婚书', closed: true }] }),
    { ep: 4, items: [{ name: '玉佩', closed: false }, { name: '婚书', closed: true }] },
  );
  assert.equal(normalizePropRow({ ep: 0, items: [] }), null);
  assert.equal(normalizePropRow({ ep: NaN, items: [] }), null);
  assert.equal(normalizePropRow(null), null);
  // items 非数组/坏条目容错：非对象丢弃、name 非字符串丢弃、closed 数字容错
  const r = normalizePropRow({ ep: 3, items: 'bad', x: 1 });
  assert.deepEqual(r, { ep: 3, items: [] });
  const r2 = normalizePropRow({ ep: 3, items: [{ name: 42 }, { name: ' 玉佩 ', closed: 1 }, null, { foo: 'x' }] });
  assert.deepEqual(r2, { ep: 3, items: [{ name: '玉佩', closed: true }] });
});

// —— propLedger：状态机记账 ——

test('propLedger：空序列 → 全空无问题', () => {
  const r = propLedger([], 5);
  assert.equal(r.plantedCount, 0);
  assert.deepEqual(r.stale, []);
  assert.deepEqual(r.closed, []);
  assert.deepEqual(r.phantom, []);
  assert.equal(r.level, 'none');
  assert.deepEqual(r.issues, []);
});

test('propLedger：planted 后持续提及 → 不悬空；gap≥3 → dangling mid，≥4 → high', () => {
  const kept = [
    { ep: 1, items: [{ name: '玉佩', closed: false }] },
    { ep: 2, items: [{ name: '玉佩', closed: false }] },
    { ep: 3, items: [{ name: '玉佩', closed: false }] },
  ];
  const ok = propLedger(kept, 4); // 第3集刚提过，gap=1
  assert.equal(ok.level, 'none');
  assert.equal(ok.plantedCount, 1);
  const mid = propLedger(kept.slice(0, 1), 4); // 第1集后 2、3 集未提，gap=3
  assert.equal(mid.level, 'mid');
  assert.equal(mid.issues[0].type, 'prop_dangling');
  assert.ok(mid.issues[0].evidence.includes('玉佩'));
  const high = propLedger(kept.slice(0, 1), 5); // gap=4
  assert.equal(high.level, 'high');
});

test('propLedger：再提及刷新 lastSeen（gap 重置），stale 预警位含 gap=2', () => {
  const rows = [
    { ep: 1, items: [{ name: '玉佩', closed: false }] },
    { ep: 3, items: [{ name: '玉佩', closed: false }] },
  ];
  const r = propLedger(rows, 5); // 第3集提过，gap=2 → 仅预警位，不报 issue
  assert.equal(r.level, 'none');
  assert.equal(r.plantedCount, 1);
  assert.deepEqual(r.issues, []);
  assert.equal(r.stale.length, 1);
  assert.equal(r.stale[0].gap, 2);
  assert.equal(r.stale[0].lastSeenEp, 3);
});

test('propLedger：销毁封禁移出账面 → 不再悬空；封禁后再提及 → phantom high', () => {
  const closedRows = [
    { ep: 1, items: [{ name: '玉佩', closed: false }] },
    { ep: 2, items: [{ name: '玉佩', closed: true }] },
  ];
  const ok = propLedger(closedRows, 6); // 已封禁，第6集也不悬空
  assert.equal(ok.level, 'none');
  assert.equal(ok.plantedCount, 0);
  assert.deepEqual(ok.closed, ['玉佩']);
  const phantomRows = [
    ...closedRows,
    { ep: 4, items: [{ name: '玉佩', closed: false }] },
  ];
  const bad = propLedger(phantomRows, 5);
  assert.equal(bad.level, 'high');
  assert.equal(bad.issues[0].type, 'prop_phantom');
  assert.ok(bad.issues[0].evidence.includes('凭空再现'));
  assert.equal(bad.phantom[0].closedEp, 2);
  assert.equal(bad.phantom[0].reopenedEp, 4);
});

test('propLedger：乱序输入安全 + 只认 < curEpNo 的行 + 多信物并行记账', () => {
  const rows = [
    { ep: 3, items: [{ name: '玉佩', closed: false }] },
    { ep: 1, items: [{ name: '婚书', closed: false }] },
    { ep: 2, items: [{ name: '婚书', closed: false }] },
    { ep: 9, items: [{ name: '玉佩', closed: false }] }, // 未完成集剔除
  ];
  const r = propLedger(rows, 5); // 婚书 lastSeen=2 gap=3 → mid；玉佩 lastSeen=3 gap=2 → 预警
  assert.equal(r.level, 'mid');
  assert.equal(r.plantedCount, 2);
  assert.ok(r.issues[0].evidence.includes('婚书'));
  assert.ok(r.stale.some((s) => s.name === '玉佩' && s.gap === 2));
});

// —— propDirective：架构师指令（预防式） ——

test('propDirective：封禁令 + 悬空预警出话，zh/en 双语齐备且 en 层零中文', () => {
  const rows = [
    { ep: 1, items: [{ name: '婚书', closed: false }] },
    { ep: 2, items: [{ name: '玉佩', closed: true }] },
  ];
  const d = propDirective(rows); // curEp=3：婚书 gap=2 预警；玉佩已封禁
  assert.ok(d.zh.includes('【信物连续性·封禁令】'));
  assert.ok(d.zh.includes('玉佩'));
  assert.ok(d.zh.includes('【信物连续性·悬空预警】'));
  assert.ok(d.zh.includes('婚书'));
  assert.ok(d.en.includes('[Prop continuity — banned props]'));
  assert.ok(d.en.includes('[Prop continuity — dangling warning]'));
  // en 系统文案零中文：信物名属内容词按原样透传，用英文信物名单独验证 en 模板
  const dEn = propDirective([
    { ep: 1, items: [{ name: 'marriage certificate', closed: false }] },
    { ep: 2, items: [{ name: 'locket', closed: true }] },
  ]);
  assert.ok(dEn.en.includes('locket'));
  assert.ok(!/[\u4e00-\u9fff]/.test(dEn.en));
});

test('propDirective：无封禁无预警/空输入 → 空串（两语言一致）', () => {
  assert.deepEqual(propDirective([]), { zh: '', en: '' });
  const fresh = propDirective([
    { ep: 1, items: [{ name: '玉佩', closed: false }] },
    { ep: 2, items: [{ name: '玉佩', closed: false }] },
  ]); // gap=1，无预警
  assert.equal(fresh.zh, '');
  assert.equal(fresh.en, '');
});

// —— 常量 sanity ——

test('常量 sanity：悬空阈值 3/4，指令预防 gap=2', () => {
  assert.equal(PROP_DANGLING_MID, 3);
  assert.equal(PROP_DANGLING_HIGH, 4);
  assert.equal(PROP_DIRECTIVE_GAP, 2);
});
