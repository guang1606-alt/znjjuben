/**
 * 工具箱 staff 文案精细化 —— TDD 先红后绿
 * 目标：内部账户在工具箱价格处看到的文案保留操作名+把数字归零+尾部加「（内部免费）」，
 *       而不是笼统替换为「内部账户·免费」丢失操作名。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { normalizeStaffCost, patchStaffCostInDom } = require('../web/staff-cost.js');

/** 最小假 DOM：只实现 querySelectorAll + textContent，足够测 patchStaffCostInDom */
function makeFakeDom(html) {
  const re = /<span[^>]*class="tool-cost"[^>]*>([^<]*)<\/span>/g;
  const elements = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    elements.push({ textContent: m[1] });
  }
  return {
    querySelectorAll: () => elements,
  };
}

describe('staff 工具箱文案精细化 · normalizeStaffCost', () => {
  it('中文：拆解+大纲混合积分行 → 保留操作名、数字归零、尾加（内部免费）', () => {
    const out = normalizeStaffCost('拆解30·大纲20积分', false);
    assert.ok(/拆解/.test(out), `应保留操作名「拆解」，实际：${out}`);
    assert.ok(/大纲/.test(out), `应保留操作名「大纲」，实际：${out}`);
    assert.ok(/0/.test(out), `数字应归零，实际：${out}`);
    assert.ok(/内部免费/.test(out), `应尾加「（内部免费）」，实际：${out}`);
    assert.ok(!/30|20/.test(out), `原数字 30/20 不应残留，实际：${out}`);
  });

  it('中文：单纯积分/轮 → 保留积分单位、归零、加尾', () => {
    const out = normalizeStaffCost('20 积分/轮', false);
    assert.ok(/积分/.test(out), `应保留「积分」，实际：${out}`);
    assert.ok(/0/.test(out), `数字应归零，实际：${out}`);
    assert.ok(/内部免费/.test(out), `应尾加，实际：${out}`);
  });

  it('中文：积分/次围读 → 保留「围读」操作名', () => {
    const out = normalizeStaffCost('30 积分/次围读', false);
    assert.ok(/围读/.test(out), `应保留「围读」，实际：${out}`);
    assert.ok(/0/.test(out), `数字应归零，实际：${out}`);
    assert.ok(/内部免费/.test(out), `应尾加，实际：${out}`);
  });

  it('英文：Teardown 30 · outline 20 pts → 保留操作名、归零、Staff Free', () => {
    const out = normalizeStaffCost('Teardown 30 · outline 20 pts', true);
    assert.ok(/Teardown/i.test(out), `应保留 Teardown，实际：${out}`);
    assert.ok(/outline/i.test(out), `应保留 outline，实际：${out}`);
    assert.ok(/0/.test(out), `数字应归零，实际：${out}`);
    assert.ok(/Staff Free/.test(out), `应尾加 Staff Free，实际：${out}`);
    assert.ok(!/30|20/.test(out), `原数字不应残留，实际：${out}`);
  });

  it('已是免费口径（含「免费」或「Free」）→ 原文不变，不加尾', () => {
    assert.strictEqual(normalizeStaffCost('免费 · 反同质化', false), '免费 · 反同质化');
    assert.strictEqual(normalizeStaffCost('Free · anti-homogeneity', true), 'Free · anti-homogeneity');
  });

  it('空/null/无数字 → 安全返回原值或空串', () => {
    assert.strictEqual(normalizeStaffCost('', false), '');
    assert.strictEqual(normalizeStaffCost(null, false), null);
    assert.strictEqual(normalizeStaffCost(undefined, true), undefined);
    // 无数字且非免费口径 → 仅加尾标
    const out = normalizeStaffCost('按次计费', false);
    assert.ok(/内部免费/.test(out), `无数字也应加尾标，实际：${out}`);
  });
});

describe('staff 工具箱文案精细化 · patchStaffCostInDom', () => {
  it('扫描 .tool-cost：含积分的元素被规则化替换，保留操作名', () => {
    const doc = makeFakeDom(
      '<div>'
      + '<span class="tool-cost" data-i="tbCostTd">拆解30·大纲20积分</span>'
      + '<span class="tool-cost" data-i="tbCostPitch">20 积分/轮</span>'
      + '<span class="tool-cost" data-i="tbCostRead">30 积分/次围读</span>'
      + '<span class="tool-cost" data-i="tbCostDv">免费 · 反同质化</span>'
      + '</div>'
    );
    patchStaffCostInDom(doc, false);
    const texts = doc.querySelectorAll().map((e) => e.textContent);
    assert.ok(/拆解/.test(texts[0]), `tbCostTd 应保留「拆解」，实际：${texts[0]}`);
    assert.ok(/0/.test(texts[0]), `tbCostTd 应归零，实际：${texts[0]}`);
    assert.ok(/内部免费/.test(texts[0]), `tbCostTd 应加尾标，实际：${texts[0]}`);
    assert.ok(/积分/.test(texts[1]), `tbCostPitch 应保留「积分」，实际：${texts[1]}`);
    assert.ok(/0/.test(texts[1]), `tbCostPitch 应归零，实际：${texts[1]}`);
    assert.ok(/围读/.test(texts[2]), `tbCostRead 应保留「围读」，实际：${texts[2]}`);
    assert.ok(/0/.test(texts[2]), `tbCostRead 应归零，实际：${texts[2]}`);
    assert.strictEqual(texts[3], '免费 · 反同质化', `已免费口径不应改动，实际：${texts[3]}`);
  });

  it('英文环境下：英文原文同样保留操作名+归零+Staff Free', () => {
    const doc = makeFakeDom(
      '<div>'
      + '<span class="tool-cost" data-i="tbCostTd">Teardown 30 · outline 20 pts</span>'
      + '<span class="tool-cost" data-i="tbCostDv">Free · anti-homogeneity</span>'
      + '</div>'
    );
    patchStaffCostInDom(doc, true);
    const texts = doc.querySelectorAll().map((e) => e.textContent);
    assert.ok(/Teardown/i.test(texts[0]), `英文 tbCostTd 应保留 Teardown，实际：${texts[0]}`);
    assert.ok(/0/.test(texts[0]), `英文 tbCostTd 应归零，实际：${texts[0]}`);
    assert.ok(/Staff Free/.test(texts[0]), `英文 tbCostTd 应尾加 Staff Free，实际：${texts[0]}`);
    assert.strictEqual(texts[1], 'Free · anti-homogeneity', `已 Free 口径不应改动，实际：${texts[1]}`);
  });

  it('非 staff 时不扫描不改（isStaff=false 应原样返回）', () => {
    const doc = makeFakeDom('<span class="tool-cost">20 积分/轮</span>');
    patchStaffCostInDom(doc, false, false);
    assert.strictEqual(doc.querySelectorAll()[0].textContent, '20 积分/轮');
  });
});
