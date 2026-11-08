/**
 * v2.474 防跑偏守卫（scripts/scope-guard.cjs）的行为测试。
 *
 * 背景：仓库嵌在父仓库「养正」里，历史上出现过跨仓库误改、升版漏改文档、临时产物混入提交。
 * 本测试跑真实脚本（child_process），不只看源码字符串：
 *   S1 当前工作区（干净/正常改动）应 exit 0；
 *   S2 --paths 传入仓库外路径必须 exit 1 且报 scope；
 *   S3 --paths 传入截图/日志必须 exit 1 且报 artifacts；
 *   S4 --paths 只含本地未跟踪目录（.trae/、daily-review/）时按提交违规报 localOnly；
 *   S5 npm run preflight 必须指向该脚本（防止命令名漂移后无人发现）。
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'scope-guard.cjs');

function run(args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--json', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, json: JSON.parse(out) };
  } catch (e) {
    return { code: e.status, json: JSON.parse(e.stdout || '{}') };
  }
}

test('S1 当前工作区未跑偏（仓库归属 + 改动范围 + 版本三件套）', () => {
  const r = run([]);
  assert.strictEqual(r.code, 0, 'preflight 应通过，实际违规：' + JSON.stringify(r.json.violations));
  assert.ok(r.json.version.pkg, '应读到 package.json 版本');
  assert.strictEqual(
    new Set([r.json.version.pkg, r.json.version.lock, r.json.version.lockRoot, r.json.version.docs]).size,
    1,
    '四处版本必须一致',
  );
});

test('S2 仓库外路径必须判跑偏', () => {
  const r = run(['--paths', 'zhongnan-backend/web/app.js,frontend/src/App.tsx']);
  assert.strictEqual(r.code, 1);
  assert.ok(r.json.violations.some((s) => s.startsWith('scope:') && s.includes('frontend/src/App.tsx')),
    '应报 scope 违规：' + JSON.stringify(r.json.violations));
});

test('S3 截图/日志/dump 混入提交必须判跑偏', () => {
  const r = run(['--paths', 'zhongnan-backend/web/shot.png,zhongnan-backend/run.log,zhongnan-backend/core.dump']);
  assert.strictEqual(r.code, 1);
  const hits = r.json.violations.filter((s) => s.startsWith('artifacts:'));
  assert.strictEqual(hits.length, 3, '三个产物都应被拦：' + JSON.stringify(r.json.violations));
});

test('S4 本地未跟踪目录不得进入提交', () => {
  const r = run(['--paths', 'zhongnan-backend/.trae/session.json,zhongnan-backend/docs/daily-review/2026-11-08.md']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.json.violations.filter((s) => s.startsWith('localOnly:')).length, 2,
    '两个本地目录都应被拦：' + JSON.stringify(r.json.violations));
});

test('S6 仓库根仅放行协作约定文件，其余根目录文件仍判跑偏', () => {
  const ok = run(['--paths', 'AGENTS.md,zhongnan-backend/scripts/doctor.cjs']);
  assert.strictEqual(ok.code, 0, 'AGENTS.md 属于本仓库约定文件，应放行：' + JSON.stringify(ok.json.violations));
  const bad = run(['--paths', 'README.md,package.json']);
  assert.strictEqual(bad.code, 1, '根目录其它文件不得被白名单顺带放行');
  assert.strictEqual(bad.json.violations.filter((s) => s.startsWith('scope:')).length, 2,
    '两个根目录文件都应报 scope：' + JSON.stringify(bad.json.violations));
});

test('S5 npm run preflight 指向防跑偏脚本', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.preflight || '', /scope-guard\.cjs/, 'preflight 必须跑 scripts/scope-guard.cjs');
  // 脚本本身必须可被 node 解析，避免语法错误让守卫静默失效
  execFileSync(process.execPath, ['--check', SCRIPT], { stdio: 'ignore' });
});
