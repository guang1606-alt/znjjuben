/**
 * v2.485 定价死配置守卫的配对测试：真实仓库扫描必须为绿，fixture 必须能咬红。
 *
 * 背景见 scripts/guard-pricing-billing.cjs：VALUE_ADDED 里曾长期躺着 8 项「有价无实现」
 * 的死配置（听剧本 39 积分从未扣过、市场价值评估实际免费、分镜/版权/存储扩容从无路由）。
 * 本测试既锁「当前仓库零死配置」，也用 fixture 反向证明守卫不是假绿。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const G = require(path.join(__dirname, '..', 'scripts', 'guard-pricing-billing.cjs'));

const PRICING_FIXTURE = `
export const VALUE_ADDED = {
  USED_ITEM: { points: 20, costFen: 2, desc: '真被收费' },
  DEAD_ITEM: { points: 39, costFen: 13, desc: '从未被收费' },
  ONLY_IN_COMMENT: { points: 50, costFen: 12, desc: '只在注释里出现' },
  POSTER_STANDARD: { points: 39, costFen: 40, desc: '占位以满足最少项数' },
  PK_BATTLE: { points: 20, costFen: 2, desc: '占位以满足最少项数' },
} as const;
`;

describe('v2.485 定价死配置守卫', () => {
  it('真实仓库：VALUE_ADDED 每项都有收费代码引用（0 violation）', () => {
    assert.deepStrictEqual(G.scanProject(), []);
  });

  it('fixture：未被引用的键必须咬红，且只报死项不误伤活项', () => {
    const files = new Map([
      ['/repo/src/routes/demo.ts', "charge(u, 'USED_ITEM', ref, staff);"],
    ]);
    const v = G.scanText(PRICING_FIXTURE, files);
    const keys = v.map((x) => x.key).sort();
    assert.deepStrictEqual(keys, ['DEAD_ITEM', 'ONLY_IN_COMMENT', 'PK_BATTLE', 'POSTER_STANDARD']);
    assert.ok(!keys.includes('USED_ITEM'), '被真实代码引用的项不得误报');
  });

  it('fixture：只出现在注释里的引用不算收费实现', () => {
    const files = new Map([
      ['/repo/src/routes/demo.ts', "// 说明：DEAD_ITEM 未来可能收费\n/* DEAD_ITEM 计划中 */\nconst x = 1;"],
    ]);
    const keys = G.scanText(PRICING_FIXTURE, files).map((x) => x.key);
    assert.ok(keys.includes('DEAD_ITEM'), '注释里的键名不得被当成收费代码引用');
  });

  it('pricing.ts 结构变更（解析不出足够项）必须抛错，不许静默假绿', () => {
    assert.throws(() => G.scanText('export const VALUE_ADDED = {} as const;', new Map()), /结构已变更/);
  });

  it('已删除的 8 项死配置不得回到定价表', () => {
    const keys = G.valueAddedKeys(require('node:fs').readFileSync(
      path.join(__dirname, '..', 'src', 'config', 'pricing.ts'), 'utf8',
    ));
    for (const dead of ['SCRIPT_EP_ECONOMY', 'SHARE_POSTER', 'EVAL_REPORT', 'AI_POLISH',
      'STORYBOARD', 'COPYRIGHT', 'STORAGE_10G', 'LISTEN_SCRIPT']) {
      assert.ok(!keys.includes(dead), `${dead} 已被判定为死配置删除；重新启用必须先补真实收费代码`);
    }
  });
});
