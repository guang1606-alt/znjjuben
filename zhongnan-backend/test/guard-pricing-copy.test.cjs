/**
 * v2.475 常驻守卫测试：前端积分价与定价真源脱钩设卡（scripts/guard-pricing-copy.cjs）。
 *
 * 双证结构：
 *  ①真实 web/*.js、web/*.html 全量扫描必须 0 violation——当前文案全部命中 pricing.ts；
 *  ②fixture 变异自证：凭空价（99 积分）必被咬出；真源价（20 积分/18 pts）不得误杀；
 *    定价真源结构缺失时守卫必须抛错而不是假绿。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanProject, scanSource, allowedPoints, pricingSource } = require('../scripts/guard-pricing-copy.cjs');

describe('v2.475 积分定价文案守卫', { concurrency: 1 }, () => {
  it('真实前端全量扫描：0 violation（新增凭空价即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `前端积分价脱离定价真源：\n${v.map((x) => `  ${x.file}:${x.line} ${x.value} ← ${x.snippet}`).join('\n')}`);
  });

  it('红能力：凭空价 99 积分必须被咬出', () => {
    const v = scanSource("const tip = '解锁精修（99积分）';", 'web/fixture.js');
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].value, 99);
  });

  it('绿能力：真源价 20 积分 / 18 pts / 199积分 不误杀', () => {
    const fx = "a('剧本PK（20积分）'); b('Pro teardown 18 pts'); c('旗舰海报 199积分');";
    assert.deepStrictEqual(scanSource(fx, 'web/fixture.js'), []);
  });

  it('绿能力：非价格语境（集数/百分比）不误杀', () => {
    const fx = "d('每日 2 集免费'); e('已用 30% 额度'); f('第 3 集');";
    assert.deepStrictEqual(scanSource(fx, 'web/fixture.js'), []);
  });

  it('守卫自身：定价真源缺关键常量时必须抛错（不许静默假绿）', () => {
    assert.throws(() => allowedPoints('export const NOTHING = 1;'), /定价结构已变更|解析出/);
    assert.ok(allowedPoints(pricingSource()).has(20), '真源必须能解析出 20 积分');
  });
});
