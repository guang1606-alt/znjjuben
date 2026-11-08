/**
 * v2.476 发布收口脚本测试（scripts/release-prep.cjs）。
 *
 * 目的不是测「打印了什么」，而是锁住两条会反复踩的规则：
 *  ①升版后今日日报必须出现当前版本号（v2.472–v2.474 连续三版漏记的真实缺口）；
 *  ②发布后命令必须指向 gitee master/tag（历史事故是在父仓库「养正」里顺手改了东西）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkDailyNote, nextSteps } = require('../scripts/release-prep.cjs');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'release-prep.cjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zn-release-prep-'));
}

describe('v2.476 发布收口脚本', { concurrency: 1 }, () => {
  it('日报存在且含当前版本 → 通过', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '2026-11-08.md'), '## 第一百四十段 · v2.476 CLS 量化\n');
    const r = checkDailyNote(dir, '2.476.0', '2026-11-08');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.skipped, false);
  });

  it('日报存在但缺当前版本段落 → 转红（不许静默漏记）', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '2026-11-08.md'), '## 第一百三十九段 · v2.475 旧版本\n');
    const r = checkDailyNote(dir, '2.476.0', '2026-11-08');
    assert.strictEqual(r.ok, false);
    assert.match(r.reason, /v2\.476/);
  });

  it('版本号按主次匹配，不被 v2.4760 之类误命中', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '2026-11-08.md'), 'v2.4760 不是本版本\n');
    assert.strictEqual(checkDailyNote(dir, '2.476.0', '2026-11-08').ok, false);
  });

  it('今日日报不存在 → 跳过而不阻碍发布', () => {
    const r = checkDailyNote(tmpDir(), '2.476.0', '2026-11-08');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.skipped, true);
  });

  it('发布命令必须推 gitee 的 master 与同名 tag，并核对远端', () => {
    const steps = nextSteps('2.476.0').join('\n');
    assert.match(steps, /git tag v2\.476/);
    assert.match(steps, /git push gitee master/);
    assert.match(steps, /git push gitee v2\.476/);
    assert.match(steps, /git ls-remote --tags gitee v2\.476/);
    assert.match(steps, /8130/);
  });

  it('--help 可用且脚本语法可解析', () => {
    assert.strictEqual(spawnSync(process.execPath, ['--check', SCRIPT]).status, 0);
    const r = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /release-prep/);
  });
});
