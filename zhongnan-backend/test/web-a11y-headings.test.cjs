const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.244 a11y 第四梯队：标题层级无跳级（h1→h3 / h2→h4 会让读屏用户丢失结构上下文）
// 全文线性扫描 h1-h6 出现顺序，禁止上行跳级（level > prev + 1）；降级不限制。
// 已修复基线：工具箱卡片 h3→h2（85/90/95）、admin 三处 h4→h3（组合全景/供应商池/知识上传）。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

describe('v2.244 a11y：标题层级无上行跳级', () => {
  it('全文 h1-h6 顺序扫描，level 不得超过 prev+1', () => {
    const re = /<h([1-6])[\s>]/g;
    let m;
    let prev = 0;
    const violations = [];
    while ((m = re.exec(html)) !== null) {
      const level = Number(m[1]);
      if (prev > 0 && level > prev + 1) {
        const line = html.slice(0, m.index).split('\n').length;
        violations.push(`line ${line}: h${prev} → h${level}`);
      }
      prev = level;
    }
    assert.deepEqual(violations, [], `标题层级跳级：\n${violations.join('\n')}`);
  });

  it('工具箱视图三张卡片标题为 h2（视图标 h1 → 卡片 h2，不跳级）', () => {
    for (const i18n of ['tbCardTd', 'tbCardDv', 'tbCardBr']) {
      assert.match(html, new RegExp(`<h2 data-i="${i18n}"`), `工具箱卡片 ${i18n} 应为 h2`);
    }
  });

  it('admin 视图三处子区标题为 h3（adminZone h2 → 子区 h3，不跳级）', () => {
    assert.match(html, /<h3 style="margin-top:18px">组合全景与岗位顺序/, '组合全景标题应为 h3');
    assert.match(html, /<h3 style="margin-top:18px">多供应商池与九岗路由/, '供应商池标题应为 h3');
    assert.match(html, /<h3 data-i="admKnowUpload">/, '知识上传标题应为 h3');
  });
});
