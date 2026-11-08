/**
 * v2.487 定价矩阵守卫的配对测试：真实仓库为绿 + fixture 变异必须咬红（红黑双向自证）。
 *
 * 背景见 scripts/guard-pricing-matrix.cjs：generate.ts 的引擎门控只看 MEMBERSHIP.engines，
 * 计费走 episodePoints()（缺价返回 0）。「授权了但没配价」= 用户可选、能跑整条流水线、扣 0 积分；
 * 「配了价但没授权」= 死价目。两种漂移都不会让任何现有测试变红，只能靠本守卫常驻设卡。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const G = require(path.join(__dirname, '..', 'scripts', 'guard-pricing-matrix.cjs'));

/** 与真实 pricing.ts 同构的最小基线（多行缩进结构必须一致，否则解析器会当作结构变更抛错） */
const BASE = `
export const RESERVED_TIERS: EngineTier[] = [EngineTier.OVERSEAS];

export const EP_PRICE: Record<MemberLevel, Partial<Record<EngineTier, number>>> = {
  FREE:     { ECONOMY: 12 },
  BASIC:    { ECONOMY: 10, STANDARD: 15 },
  ADVANCED: { ECONOMY: 8, STANDARD: 12, FLAGSHIP: 28 },
  PRO:      { ECONOMY: 5, STANDARD: 9, FLAGSHIP: 24 },
};

export const MEMBERSHIP = {
  FREE: {
    engines: [EngineTier.ECONOMY], label: '免费版',
  },
  BASIC: {
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD], label: '基础会员',
  },
  ADVANCED: {
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: '高级会员',
  },
  PRO: {
    engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: '专业会员',
  },
} as const;

export const ENGINE = {
  ECONOMY: { costFenPerEp: 12 },
  STANDARD: { costFenPerEp: 35 },
  FLAGSHIP: { costFenPerEp: 110 },
  OVERSEAS: { costFenPerEp: 200 },
} as const;

export function assertNoLoss(): string[] {
  const errors: string[] = [];
  (Object.keys(ENGINE) as EngineTier[]).forEach((tier) => { if (tier) errors.push(tier); });
  return errors;
}
`;

const keysOf = (text) => G.scanText(text).map((x) => x.key);

describe('v2.487 定价矩阵守卫（可售引擎 ↔ 单集价双向一致）', () => {
  it('真实仓库：0 violation', () => {
    assert.deepStrictEqual(G.scanProject(), []);
  });

  it('基线 fixture 为绿（证明下方变异是唯一变量）', () => {
    assert.deepStrictEqual(G.scanText(BASE), []);
  });

  it('变异①：授权了标准档却删掉单价 → 必须咬「可选却按 0 积分计费」', () => {
    const text = BASE.replace('BASIC:    { ECONOMY: 10, STANDARD: 15 },', 'BASIC:    { ECONOMY: 10 },');
    assert.ok(keysOf(text).includes('BASIC+STANDARD'), '漏配单价的授权档位必须被拦');
  });

  it('变异②：配了海外档单价但未授权（且仍列预留）→ 死价目 + 预留泄漏双报', () => {
    const text = BASE.replace(
      'PRO:      { ECONOMY: 5, STANDARD: 9, FLAGSHIP: 24 },',
      'PRO:      { ECONOMY: 5, STANDARD: 9, FLAGSHIP: 24, OVERSEAS: 45 },',
    );
    const keys = keysOf(text);
    assert.ok(keys.includes('PRO+OVERSEAS'), '未授权的价目必须被拦');
    assert.ok(keys.includes('OVERSEAS'), '预留档出现在 EP_PRICE 必须被拦');
  });

  it('变异③：把预留档塞进 engines → 必须咬「尚未开放售卖」', () => {
    const text = BASE.replace(
      'engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: \'专业会员\',',
      'engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP, EngineTier.OVERSEAS], label: \'专业会员\',',
    );
    const keys = keysOf(text);
    assert.ok(keys.includes('PRO+OVERSEAS'), '预留档授权后缺价必须被拦');
    assert.ok(keys.includes('OVERSEAS'), '预留档出现在 engines 必须被拦');
  });

  it('变异④：非预留档从所有等级下架且删价 → 必须咬「整档静默下架」', () => {
    const text = BASE
      .replace('ADVANCED: { ECONOMY: 8, STANDARD: 12, FLAGSHIP: 28 },', 'ADVANCED: { ECONOMY: 8, STANDARD: 12 },')
      .replace('PRO:      { ECONOMY: 5, STANDARD: 9, FLAGSHIP: 24 },', 'PRO:      { ECONOMY: 5, STANDARD: 9 },')
      .replace(
        'engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: \'高级会员\',',
        'engines: [EngineTier.ECONOMY, EngineTier.STANDARD], label: \'高级会员\',',
      )
      .replace(
        'engines: [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP], label: \'专业会员\',',
        'engines: [EngineTier.ECONOMY, EngineTier.STANDARD], label: \'专业会员\',',
      );
    assert.ok(keysOf(text).includes('FLAGSHIP'), '整档静默下架必须被拦');
  });

  it('变异⑤：assertNoLoss 手抄档位列表 → 必须咬「新档位可绕开成本×2」', () => {
    const text = BASE.replace(
      '(Object.keys(ENGINE) as EngineTier[]).forEach((tier) => { if (tier) errors.push(tier); });',
      "([EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP] as EngineTier[]).forEach((tier) => { if (tier) errors.push(tier); });",
    );
    assert.ok(keysOf(text).includes('assertNoLoss'), '铁底检查退化为手抄列表必须被拦');
  });

  it('结构变更（等级数不足）必须抛错，不许静默假绿', () => {
    assert.throws(() => G.scanText('export const EP_PRICE = {};'), /结构已变更/);
  });
});
