/**
 * v2.484 轮次自检（doctor）测试
 *
 * 为什么需要：agent 每轮开工都会重复摸索「版本几处一致/改动分布/守卫几族/钩子装没装/日报写到哪」，
 * 这些探索不产出价值却持续烧 token，还容易摸到旧结论。doctor 把结论一次打全，本测试锁住三件事：
 *   ①关键结论字段齐全且与真源一致（不手抄常量）；
 *   ②它本身必须只读（跑完不产生任何改动）；
 *   ③它必须暴露「跑偏」而不是永远报绿（退出码沿用 scope-guard）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'doctor.cjs');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function run(args = [], cwd = ROOT) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}
function doctorJson() {
  const r = run(['--json']);
  return { r, state: JSON.parse(r.stdout) };
}
function gitStatus() {
  return spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;
}

describe('v2.484 轮次自检 doctor', () => {
  it('D0 package.json 暴露 doctor 并且脚本存在', () => {
    assert.ok(fs.existsSync(SCRIPT), '缺少 scripts/doctor.cjs');
    assert.strictEqual(pkg.scripts.doctor, 'node scripts/doctor.cjs');
  });

  it('D1 JSON 结论完整，版本与守卫数量来自真源', () => {
    const { r, state } = doctorJson();
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    assert.strictEqual(state.root.isRightRepo, true);
    assert.strictEqual(path.resolve(state.root.repo), path.resolve(ROOT, '..'));
    // 版本必须与 package.json 同源，且四处一致（scope-guard 负责判定）
    assert.strictEqual(state.version, pkg.version);
    assert.deepStrictEqual(state.drift, [], '当前工作树不应有跑偏项：' + JSON.stringify(state.drift));
    assert.ok(state.guards.length >= 5, `守卫族数应 >=5，实际 ${state.guards.length}`);
    assert.ok(state.copyGuards >= 12, `文案守卫组数应 >=12，实际 ${state.copyGuards}`);
    assert.ok(state.daily.file.includes(path.join('docs', 'daily-review')), '日报必须在本地目录');
    assert.ok(Array.isArray(state.hooks.installed) && Array.isArray(state.hooks.missing));
  });

  it('D2 只读：运行前后 git status 完全一致', () => {
    const before = gitStatus();
    run([]);
    run(['--json']);
    assert.strictEqual(gitStatus(), before, 'doctor 不得修改工作树');
  });

  it('D3 退出码沿用闸门：与 scope-guard 结论一致，不谎报成功', () => {
    const sg = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'scope-guard.cjs'), '--json'], { cwd: ROOT, encoding: 'utf8' });
    const r = run(['--json']);
    assert.strictEqual(r.status, sg.status, 'doctor 必须与 preflight 同结论（0/1 一致）');
    const state = JSON.parse(r.stdout);
    assert.strictEqual(state.drift.length === 0, r.status === 0, '退出码必须与跑偏项数量自洽');
  });
});
