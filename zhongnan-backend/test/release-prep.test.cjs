/**
 * v2.476 发布收口脚本测试（scripts/release-prep.cjs）。
 *
 * 目的不是测「打印了什么」，而是锁住两条会反复踩的规则：
 *  ①升版后今日日报必须出现当前版本号（v2.472–v2.474 连续三版漏记的真实缺口）；v2.486 起
 *    「今日日报不存在」也按硬失败处理（此前的 missing-放行等于忘记建文件就永远绿）；
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
    assert.strictEqual(r.missing, false);
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

  // v2.486 收紧：此前「文件不存在」直接放行，等于忘了建文件就永远绿
  it('今日日报不存在 → 硬失败（不许以「忘了建」绕过落盘纪律）', () => {
    const r = checkDailyNote(tmpDir(), '2.476.0', '2026-11-08');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.missing, true);
    assert.match(r.reason, /2026-11-08\.md/);
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

  // v2.479 防跑偏闸门不该靠人记得敲：未装 pre-push 时把一次性安装命令排在最前
  it('未装 pre-push → 提示一次性安装 hooks:install', () => {
    const steps = nextSteps('2.479.0').join('\n');
    assert.match(steps, /npm run hooks:install/);
    assert.ok(steps.indexOf('hooks:install') < steps.indexOf('git commit'), '安装提示应排在提交流程之前');
  });

  it('已装 pre-push → 不再重复提示', () => {
    assert.doesNotMatch(nextSteps('2.479.0', true).join('\n'), /hooks:install/);
  });
});
