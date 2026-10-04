/**
 * v2.313 守卫接线元守卫（guard of guards）——静态守卫家族的常驻接线强制。
 *
 * 背景：scripts/guard-*.cjs 家族（v2.298 deleted-filter / v2.307 promise-chain /
 * v2.311 async-handler / v2.312 conditional-write）目前靠人工纪律各自配对 test 常驻
 * npm test。家族会继续扩（v2.312 日报已列沉淀方向），但没有机制保证新守卫：
 *   ①不漏建配对 test（否则脚本永不被 node --test 枚举，静默失效）；
 *   ②CLI 直跑当前真实代码库为绿（配对 test 被 .skip/改错/只测 fixture 时仍能抓红）；
 *   ③导出统一 scanProject 接口（守卫可组合、可被统一调度）。
 *
 * 本文件枚举 scripts/ 下全部 guard-*.cjs，逐个强制三条接线契约，并锁家族数量基线。
 * 废弃守卫须显式下调基线并在日报留证伪记录，不允许静默删除。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const TEST_DIR = path.join(ROOT, 'test');
/** 家族数量基线：v2.313 时 4 个，只增不减 */
const MIN_GUARDS = 4;
/** 配对 test 最小字节数：防空壳 test（仅注释/describe 壳）骗过存在性检查 */
const MIN_TEST_BYTES = 200;
const CLI_TIMEOUT_MS = 30000;

const guards = fs.readdirSync(SCRIPTS_DIR)
  .filter((f) => /^guard-.*\.cjs$/.test(f))
  .sort();

describe('v2.313 守卫接线元守卫（scripts/guard-*.cjs 家族接线强制）', () => {
  it(`守卫家族数量 ≥ ${MIN_GUARDS}（只增不减；废弃须显式改基线并留记录）`, () => {
    assert.ok(
      guards.length >= MIN_GUARDS,
      `当前仅 ${guards.length} 个守卫（${guards.join(', ') || '空'}），低于基线 ${MIN_GUARDS}：守卫被静默删除/重命名出 scripts/ 根目录`,
    );
  });

  for (const g of guards) {
    const name = g.replace(/\.cjs$/, '');
    const guardAbs = path.join(SCRIPTS_DIR, g);
    const testAbs = path.join(TEST_DIR, `${name}.test.cjs`);

    describe(`${g} 接线三契约`, () => {
      it('A. 配对 test/guard-*.test.cjs 存在且非空壳（真被 node --test 枚举常驻）', () => {
        assert.ok(fs.existsSync(testAbs), `缺少配对测试 ${path.relative(ROOT, testAbs)}——守卫不会被 npm test 执行，等同静默失效`);
        const size = fs.statSync(testAbs).size;
        assert.ok(
          size >= MIN_TEST_BYTES,
          `${path.relative(ROOT, testAbs)} 仅 ${size} 字节 < ${MIN_TEST_BYTES}，疑似空壳 test`,
        );
      });

      it('B. CLI 直跑退出 0 且明示 0 violation（对当前真实代码库全量扫描，不依赖配对 test 写法）', () => {
        const r = spawnSync(process.execPath, [guardAbs], { cwd: ROOT, timeout: CLI_TIMEOUT_MS });
        const out = `${r.stdout?.toString() || ''}${r.stderr?.toString() || ''}`;
        assert.ok(
          r.status === 0,
          `node scripts/${g} 退出码 ${r.status}（应为 0）——真实代码库扫描有 violation 或守卫脚本自身崩溃：\n${out}`,
        );
        assert.ok(
          /0 violation/.test(out),
          `node scripts/${g} 虽退出 0 但未输出「0 violation」，疑似提前 return/空扫描假绿：\n${out}`,
        );
      });

      it('C. 导出 scanProject 函数（守卫统一接口，可组合调度）', () => {
        const mod = require(guardAbs);
        assert.strictEqual(typeof mod.scanProject, 'function', `${g} 须 module.exports.scanProject（当前：${typeof mod.scanProject}）`);
      });
    });
  }
});
