const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// v2.228 市场定价校验与后端 validatePriceFen 对齐（src/routes/market.ts:110）：
// 价格 ≥1 元（MIN_PRICE_FEN=100 分）且为 0.1 元（1 积分 = FEN_PER_POINT=10 分）的整数倍，
// 违者后端 400「价格不低于 1 元，且需为 0.1 元(1积分)的整数倍」。前端上架/重新上架两入口须本地同口径预检。
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');

function setup(names) {
  const functions = new Map();
  const src = app;
  // 按 function name 抽取（与 web-workflow 同思路的轻量版：只需顶层 priceFenFromYuan）
  const m = src.match(new RegExp(`function ${names}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `app.js 应存在 function ${names}()`);
  return vm.runInNewContext(`(${m[0].replace(new RegExp(`^function ${names}`), 'function')})`);
}

describe('market price validation matches backend validatePriceFen', () => {
  const priceFenFromYuan = setup('priceFenFromYuan');

  it('合法价：≥1 元且 0.1 元整数倍 → 返回分值', () => {
    assert.equal(priceFenFromYuan('1'), 100);
    assert.equal(priceFenFromYuan('10.5'), 1050);
    assert.equal(priceFenFromYuan('2.0'), 200);
    assert.equal(priceFenFromYuan(' 3.9 '), 390); // 输入框两侧空格容忍
  });

  it('非法价：粒度不符/低于下限/非数字 → null', () => {
    assert.equal(priceFenFromYuan('10.55'), null); // 0.01 元粒度：后端会 400
    assert.equal(priceFenFromYuan('0.9'), null);   // 低于 1 元下限
    assert.equal(priceFenFromYuan('abc'), null);
    assert.equal(priceFenFromYuan(''), null);
  });

  it('listSubmit 与 relist 两处均接入助手（防回归）', () => {
    const submitSeg = app.slice(app.indexOf("$('listSubmit').onclick"), app.indexOf("$('listSubmit').onclick") + 500);
    assert.ok(submitSeg.includes('priceFenFromYuan'), 'listSubmit 应走 priceFenFromYuan 预检');
    const relistSeg = app.slice(app.indexOf('[data-relist]'), app.indexOf('[data-relist]') + 900);
    assert.ok(relistSeg.includes('priceFenFromYuan'), 'relist 应走 priceFenFromYuan 预检');
  });

  it('listPrice 输入框 placeholder 标注粒度', () => {
    const tag = html.split('\n').find((l) => l.includes('id="listPrice"'));
    assert.ok(tag && /0\.1/.test(tag), 'listPrice placeholder 应说明 0.1 元粒度');
  });
});
