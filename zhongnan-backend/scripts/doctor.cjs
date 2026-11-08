#!/usr/bin/env node
/**
 * v2.484 轮次自检（doctor）：把「每轮开工前要摸清的状态」压成一条只读命令。
 *
 * 为什么需要：每轮开工都要重新摸索一遍「当前版本几处一致了吗 / 改了哪些文件 / 守卫有几族 /
 * 钩子装了没 / 今天日报写到哪 / 发布要敲哪几条命令」。这些探索本身不产出价值，却吃掉大量
 * 时间与 token，还容易摸到旧结论。doctor 把结论一次打全，且不修改任何文件。
 *
 * 用法：
 *   npm run doctor            # 人读版（每轮开工第一条命令）
 *   node scripts/doctor.cjs --json
 *
 * 退出码沿用 scope-guard：0 = 未跑偏；1 = 有跑偏项（此时先修，不要继续开发）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');   // zhongnan-backend
const REPO = path.dirname(ROOT);           // zhongnan
const JSON_OUT = process.argv.includes('--json');

function sh(cmd, args, cwd = REPO) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : '';
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function guardFamilies() {
  const dir = path.join(ROOT, 'scripts');
  return fs.readdirSync(dir).filter((f) => /^guard-.+\.cjs$/.test(f)).map((f) => f.replace(/^guard-|\.cjs$/g, '')).sort();
}

function copyGuardCount() {
  const f = path.join(ROOT, 'test', 'web-copy-accuracy.test.cjs');
  if (!fs.existsSync(f)) return 0;
  return (fs.readFileSync(f, 'utf8').match(/\bit\('G\d+/g) || []).length;
}

// v2.490 巡检盲区播报：needsData 登记的弹窗只能靠「有数据账号」在真机覆盖，
// 复盘时最容易被忘（红色报告里它们不出现，看着像全绿）。每轮把个数摆在 doctor 里。
function auditBlindSpots() {
  const f = path.join(ROOT, 'scripts', 'ui-audit.cjs');
  if (!fs.existsSync(f)) return 0;
  return (fs.readFileSync(f, 'utf8').match(/needsData:\s*['"]/g) || []).length;
}

function hooksState() {
  const gitDir = sh('git', ['rev-parse', '--git-dir']);
  if (!gitDir) return { installed: [], missing: ['pre-commit', 'pre-push'], dir: '' };
  const dir = path.resolve(REPO, gitDir, 'hooks');
  const installed = [];
  const missing = [];
  for (const stage of ['pre-commit', 'pre-push']) {
    const p = path.join(dir, stage);
    const ok = fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('zn-hooks:managed');
    (ok ? installed : missing).push(stage);
  }
  return { installed, missing, dir };
}

function dailyNote(version) {
  const file = path.join(ROOT, 'docs', 'daily-review', `${today()}.md`);
  if (!fs.existsSync(file)) return { file, exists: false, hasVersion: false };
  const short = version ? version.split('.').slice(0, 2).join('.') : '';
  const hasVersion = !!short && new RegExp(`v${short.replace(/\./g, '\\.')}(?![\\d.])`).test(fs.readFileSync(file, 'utf8'));
  return { file, exists: true, hasVersion };
}

function statusSummary() {
  const raw = sh('git', ['status', '--porcelain']);
  const lines = raw ? raw.split('\n').filter(Boolean) : [];
  const staged = lines.filter((l) => l[0] !== ' ' && l[0] !== '?').length;
  const untracked = lines.filter((l) => l.startsWith('??'));
  const localOnly = untracked.filter((l) => /zhongnan-backend\/(\.trae|docs\/daily-review)\//.test(l)).length;
  return { total: lines.length, staged, worktree: lines.length - staged - untracked.length, untracked: untracked.length, localOnly };
}

function main() {
  // scope-guard 是权威闸门：直接拿它的 JSON，避免 doctor 与它各算一套
  const g = spawnSync(process.execPath, [path.join(__dirname, 'scope-guard.cjs'), '--json'], { cwd: ROOT, encoding: 'utf8' });
  let scope = { ok: false, violations: ['scope-guard 执行失败'], version: {} };
  try { scope = JSON.parse(g.stdout); } catch { /* 保留默认失败态 */ }

  const version = scope.version && scope.version.pkg ? scope.version.pkg : '';
  const state = {
    root: { repo: REPO, backend: ROOT, isRightRepo: scope.ok !== false && (scope.violations || []).every((v) => !v.startsWith('root:')) },
    branch: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    head: sh('git', ['log', '-1', '--format=%h %s']),
    tag: sh('git', ['describe', '--tags', '--abbrev=0']),
    version,
    versionSources: scope.version || {},
    drift: scope.violations || [],
    changes: statusSummary(),
    guards: guardFamilies(),
    copyGuards: copyGuardCount(),
    blindSpots: auditBlindSpots(),
    hooks: hooksState(),
    daily: dailyNote(version),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(scope.ok ? 0 : 1);
  }

  const ok = (b) => (b ? '✔' : '✘');
  const v = state.versionSources;
  console.log('终南集 · 轮次自检（只读）');
  console.log(`仓库   ${state.root.repo}  ${ok(state.root.isRightRepo)}`);
  console.log(`分支   ${state.branch} @ ${state.head}`);
  console.log(`标签   最近 ${state.tag || '无'}`);
  console.log(`版本   ${version || '缺失'}（pkg ${v.pkg || '-'} / lock ${v.lock || '-'} / lockRoot ${v.lockRoot || '-'} / 文档 ${v.docs || '-'}）${ok(scope.ok)}`);
  console.log(`改动   总 ${state.changes.total} · 暂存 ${state.changes.staged} · 工作区 ${state.changes.worktree} · 未跟踪 ${state.changes.untracked}（本地专属 ${state.changes.localOnly}）`);
  console.log(`守卫   ${state.guards.length} 族（${state.guards.join(' / ')}）+ 文案 ${state.copyGuards} 组`);
  console.log(`巡检   控件接线 H1-H3 · 弹窗需数据盲区 ${state.blindSpots} 个（真机未覆盖，勿当成全绿）`);
  console.log(`钩子   ${state.hooks.installed.length ? '已装 ' + state.hooks.installed.join(' + ') : '未安装'}${state.hooks.missing.length ? '，缺 ' + state.hooks.missing.join(' + ') + ' → npm run hooks:install' : ''}`);
  console.log(`日报   ${state.daily.exists ? '今日已建' : '今日未建（发布前需补）'}${state.daily.hasVersion ? ' · 已记录本版' : ''}`);
  if (state.drift.length) {
    console.error('✘ 跑偏项：');
    state.drift.forEach((s) => console.error('  - ' + s));
  }
  console.log('');
  console.log('本轮推荐顺序：');
  console.log('  1) 改代码 → npm run build && npm test -- <相关测试>');
  console.log('  2) npm run mutate -- --file <源码> --find <原文> --replace <变异> --test <测试>  # 变异必红并自动还原');
  console.log('  3) npm run verify:copy    # 文案/离线壳/死链/控件接线/UI 触发面');
  console.log('  4) npm run release:prep   # 升版 + 日报 + 发布命令');
  console.log('  5) npm run verify:full    # 全量（发布前最后一道）');
  process.exit(scope.ok ? 0 : 1);
}

main();
