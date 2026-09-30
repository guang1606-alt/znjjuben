const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runner = path.resolve(__dirname, '../scripts/run-tests.cjs');
test('测试入口递归展开目录，透传过滤参数并保留失败退出码', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zn-tests-'));
  try {
    mkdirSync(path.join(dir, 'test/nested'), { recursive: true });
    writeFileSync(path.join(dir, 'test/pass.test.cjs'), "require('node:test')('pass-case', () => {});");
    writeFileSync(path.join(dir, 'test/nested/fail.test.cjs'), "require('node:test')('fail-case', () => { throw new Error('expected-fixture-failure'); });");
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = (args) => spawnSync(process.execPath, [runner, ...args], { cwd: dir, encoding: 'utf8', env });
    const all = run([]);
    assert.equal(all.status, 1);
    assert.match(all.stdout + all.stderr, /expected-fixture-failure/);
    assert.match(all.stdout + all.stderr, /pass-case/);
    const filtered = run(['--test-name-pattern', 'pass-case']);
    assert.equal(filtered.status, 0, filtered.stdout + filtered.stderr);
    assert.match(filtered.stdout, /pass-case/);
    const explicit = run(['test/', '--test-name-pattern=pass-case']);
    assert.equal(explicit.status, 0, explicit.stdout + explicit.stderr);
    assert.match(explicit.stdout, /pass-case/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
