const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/config/pricing.js');

// v1.80 用户拍板定稿：只要不赔钱，会员货架按此锁定。本测试锁死定稿常量，任何漂移都会红。
test('会员货架定稿锁定（月/年费、赠送集、免费额度、佣金、项目数）', () => {
  const M = P.MEMBERSHIP;
  assert.strictEqual(M.FREE.freeEpsPerDay, 2, '免费每日2集（非3集）');
  assert.strictEqual(M.FREE.maxActiveProjects, 2);
  // 基础：39/月、365/年、不送集、1元/集经济、佣金15%、10项目
  assert.strictEqual(M.BASIC.monthlyFen, 3900);
  assert.strictEqual(M.BASIC.yearlyFen, 36500);
  assert.strictEqual(M.BASIC.quotaMonthly, 0);
  assert.strictEqual(M.BASIC.overagePerEp, 10);
  assert.strictEqual(M.BASIC.commission, 15);
  assert.strictEqual(M.BASIC.maxActiveProjects, 10);
  // 高级：99/月、999/年、赠300、0.8元/集、佣金10%、30项目
  assert.strictEqual(M.ADVANCED.monthlyFen, 9900);
  assert.strictEqual(M.ADVANCED.yearlyFen, 99900);
  assert.strictEqual(M.ADVANCED.quotaMonthly, 300);
  assert.strictEqual(M.ADVANCED.overagePerEp, 8);
  assert.strictEqual(M.ADVANCED.commission, 10);
  assert.strictEqual(M.ADVANCED.maxActiveProjects, 30);
  // 专业：299/月、2999/年、赠1000、0.5元/集、佣金5%、100项目
  assert.strictEqual(M.PRO.monthlyFen, 29900);
  assert.strictEqual(M.PRO.yearlyFen, 299900);
  assert.strictEqual(M.PRO.quotaMonthly, 1000);
  assert.strictEqual(M.PRO.overagePerEp, 5);
  assert.strictEqual(M.PRO.commission, 5);
  assert.strictEqual(M.PRO.maxActiveProjects, 100);
});

test('锚点不破：基础经济100集=100元=1000积分', () => {
  assert.strictEqual(P.ANCHOR_PACKAGE.episodes, 100);
  assert.strictEqual(P.ANCHOR_PACKAGE.yuan, 100);
  assert.strictEqual(P.ANCHOR_PACKAGE.points, 1000);
  assert.strictEqual(P.EP_PRICE.BASIC.ECONOMY * 100, 1000, '基础经济单集10积分×100=1000');
  assert.strictEqual(P.FEN_PER_POINT, 10);
});

test('定稿邀请奖励：双方各30积分、首充返10%', () => {
  assert.strictEqual(P.INVITE.BOTH_REWARD_POINTS, 30);
  assert.strictEqual(P.INVITE.FIRST_PAY_REWARD_PCT, 10);
});

test('定稿货架整体不赔钱（assertNoLoss 为空）', () => {
  assert.deepStrictEqual(P.assertNoLoss(), []);
});

// v2.487 定价矩阵：会员可售引擎与单集价必须双向一一对应。
// 门控只查 MEMBERSHIP.engines、计费走 episodePoints（缺价=0），
// 一旦「授权了却没配价」，用户能选、能跑完整条流水线、扣 0 积分——不报错也不红测试。
test('定价矩阵双向一致（pricingMatrixErrors 为空）', () => {
  assert.deepStrictEqual(P.pricingMatrixErrors(), []);
});

test('矩阵自检能咬红：临时给授权档配 0 价 / 给未授权档加价都必须报', () => {
  const EP = P.EP_PRICE;
  EP.BASIC.STANDARD = 0;
  assert.ok(P.pricingMatrixErrors().some((m) => m.includes('BASIC+STANDARD')),
    '已授权却无有效单集价必须被矩阵自检拦下');
  EP.BASIC.STANDARD = 15;
  EP.FREE.STANDARD = 15;
  assert.ok(P.pricingMatrixErrors().some((m) => m.includes('FREE+STANDARD')),
    '有价目但未授权（死价目）必须被矩阵自检拦下');
  delete EP.FREE.STANDARD;
  assert.deepStrictEqual(P.pricingMatrixErrors(), [], '还原后必须回到干净状态');
});

test('铁底检查覆盖新增档位（assertNoLoss 遍历全部 ENGINE，而非手抄三档）', () => {
  // 模拟未来启用海外档：只加价不加成本，售价必须被判定破底，证明新档位无法绕过铁底
  P.EP_PRICE.PRO.OVERSEAS = 1;
  assert.ok(P.assertNoLoss().some((m) => m.includes('PRO+OVERSEAS')),
    '新增档位进 EP_PRICE 后必须自动纳入「售价≥成本×2」检查');
  delete P.EP_PRICE.PRO.OVERSEAS;
  assert.deepStrictEqual(P.assertNoLoss(), []);
});
