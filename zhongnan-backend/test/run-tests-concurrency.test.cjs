/**
 * v2.222 run-tests.cjs 并发上限守卫（PENDING #13 根治）：
 *  高负载时段全量偶发 5~36 条 fetch failed（每文件自起 HTTP 服务器的测试在
 *  文件级全并发下启动竞争）。run-tests.cjs 默认注入 --test-concurrency=4
 *  限文件级并发；用户显式传参可覆盖。静态断言防回退。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'run-tests.cjs'), 'utf8');

describe('run-tests.cjs 默认并发上限', () => {
  it('默认注入 --test-concurrency=4（无显式传参时）', () => {
    assert.ok(/DEFAULT_CONCURRENCY|test-concurrency/.test(src), '应含并发上限逻辑');
    assert.ok(/--test-concurrency.*4/.test(src), '默认值应为 4');
  });

  it('显式传参不覆盖（takesValue 透传在前，注入有条件）', () => {
    // 注入必须是条件式的：已有 --test-concurrency 时不重复注入
    assert.ok(!/--test-concurrency.*4[\s\S]*if\s*\(\s*!/.test(src) || /options\.some|includes\('--test-concurrency'\)/.test(src),
      '注入前应检查 options 是否已含 --test-concurrency');
  });
});
