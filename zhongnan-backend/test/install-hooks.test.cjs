/**
 * v2.479 本地钩子安装器（pre-push 防跑偏闸门）
 *
 * 为什么需要：`scope-guard`（防跑偏 + 版本四处一致）此前只能靠人记得敲 `npm run preflight`，
 * 而「忘记敲」恰恰是最常见的泄漏路径——跑偏的改动、版本只改了一半，都是在这一步被漏过去推上远端的。
 * 钩子目录（`.git/hooks`）按仓库纪律不入库，所以把「安装」固化成一条命令 + 一组测试：
 * 任何人都能一条命令让每个仓库本地都拥有同一道闸门，且重复执行安全（幂等）。
 *
 * 设计要点：
 *   - 只接管自己写过的钩子（带 marker），别人的钩子不覆盖，必须显式 --force，且先备份；
 *   - 钩子里只跑 `scope-guard`（毫秒级），不跑全量测试——push 闸门要快，否则会被绕过；
 *   - `--dir` 支持指向任意目录，让测试能在临时目录真实执行而不是断言源码字符串。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'install-hooks.cjs');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
}

describe('v2.479 本地钩子安装器', () => {
  let tmp;
  before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zn-hooks-')); });
  after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('P0 package.json 暴露 hooks:install，安装器文件存在', () => {
    assert.ok(fs.existsSync(SCRIPT), '缺少 scripts/install-hooks.cjs');
    assert.strictEqual(pkg.scripts['hooks:install'], 'node scripts/install-hooks.cjs');
  });

  it('P1 能装出可执行的 pre-commit 与 pre-push，并在其中调用 scope-guard（不跑全量，保持秒级）', () => {
    const gitDir = path.join(tmp, 'p1');
    fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
    const r = run(['--dir', gitDir]);
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    for (const stage of ['pre-commit', 'pre-push']) {
      const src = fs.readFileSync(path.join(gitDir, 'hooks', stage), 'utf8');
      assert.match(src, /scope-guard\.cjs/, `${stage} 必须调用 scope-guard`);
      assert.match(src, /zn-hooks:managed/, `${stage} 必须带归属 marker（用于安全接管/幂等）`);
      assert.doesNotMatch(src, /verify:full|npm run verify/, `${stage} 闸门不得跑全量测试（会被绕过）`);
      if (process.platform !== 'win32') {
        assert.ok((fs.statSync(path.join(gitDir, 'hooks', stage)).mode & 0o111) !== 0, `${stage} 必须可执行`);
      }
    }
  });

  it('P2 幂等：重复安装不报错，内容保持不变', () => {
    const gitDir = path.join(tmp, 'p2');
    fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
    assert.strictEqual(run(['--dir', gitDir]).status, 0);
    const hooks = path.join(gitDir, 'hooks');
    const first = Object.fromEntries(['pre-commit', 'pre-push'].map((s) => [s, fs.readFileSync(path.join(hooks, s), 'utf8')]));
    assert.strictEqual(run(['--dir', gitDir]).status, 0);
    for (const s of ['pre-commit', 'pre-push']) assert.strictEqual(fs.readFileSync(path.join(hooks, s), 'utf8'), first[s]);
    assert.strictEqual(fs.readdirSync(hooks).length, 2, '不得留下备份垃圾');
  });

  it('P3 外来钩子不得静默覆盖：无 --force 直接失败且原文件不变', () => {
    const gitDir = path.join(tmp, 'p3');
    const hooks = path.join(gitDir, 'hooks');
    fs.mkdirSync(hooks, { recursive: true });
    const hook = path.join(hooks, 'pre-push');
    fs.writeFileSync(hook, '#!/bin/sh\necho custom\n');
    const r = run(['--dir', gitDir]);
    assert.strictEqual(r.status, 1, '必须失败');
    assert.strictEqual(fs.readFileSync(hook, 'utf8'), '#!/bin/sh\necho custom\n');
    assert.match(r.stderr + r.stdout, /--force/, '失败信息必须提示 --force');
  });

  it('P4 --force 覆盖前先备份，覆盖后带 marker', () => {
    const gitDir = path.join(tmp, 'p4');
    const hooks = path.join(gitDir, 'hooks');
    fs.mkdirSync(hooks, { recursive: true });
    const hook = path.join(hooks, 'pre-push');
    fs.writeFileSync(hook, '#!/bin/sh\necho custom\n');
    const r = run(['--dir', gitDir, '--force']);
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    const backups = fs.readdirSync(hooks).filter((f) => f.startsWith('pre-push.bak'));
    assert.strictEqual(backups.length, 1, '覆盖外来钩子前必须备份');
    assert.match(fs.readFileSync(path.join(hooks, backups[0]), 'utf8'), /echo custom/);
    assert.match(fs.readFileSync(hook, 'utf8'), /zn-hooks:managed/);
  });

  it('P5 安装结果可独立通过 shell 语法检查（sh -n），不是一段跑不起来的文本', { skip: process.platform === 'win32' }, () => {
    const gitDir = path.join(tmp, 'p5');
    fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
    assert.strictEqual(run(['--dir', gitDir]).status, 0);
    const r = spawnSync('sh', ['-n', path.join(gitDir, 'hooks', 'pre-push')], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
  });
});
