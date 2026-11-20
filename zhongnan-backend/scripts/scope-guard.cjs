#!/usr/bin/env node
/**
 * v2.474 防跑偏守卫（scope-guard）
 *
 * 为什么需要：本仓库嵌在父仓库 `养正/` 里，历史上真发生过「在剧本大师任务窗口里顺手改了养正」的事故，
 * 也出现过升版只改 package.json、文档基线不跟、临时截图/dump 混进提交的零散失误。
 * 这类问题单靠每轮人工回忆来防，既容易漏也浪费时间。本脚本把「这一轮有没有跑偏」变成一条可执行命令：
 *
 *   npm run preflight            # 提交前跑：仓库归属 + 改动范围 + 版本三件套 + 产物混入
 *   node scripts/scope-guard.cjs --json
 *   node scripts/scope-guard.cjs --paths "zhongnan-backend/web/app.js,frontend/x.ts"   # 只校验给定列表（供测试）
 *
 * 检查项：
 *   root       git 根必须正好是剧本大师仓库，不能是父仓库「养正」
 *   scope      所有改动（含未跟踪）必须落在 zhongnan-backend/ 内；仓库根仅放行 AGENTS.md/.gitignore
 *   localOnly  .trae/ 与 docs/daily-review/ 只允许本地未跟踪，一旦进入暂存区即失败
 *   artifacts  暂存区不得出现截图/日志/dump/压缩包等非交付产物
 *   version    package.json ↔ package-lock（根与 packages[""]）↔ 文档基线行 ↔ web/data/constants.js
 *              的 ZN_VERSION（首页更新通知直接展示），五处必须同版本
 *
 * 退出码：0 = 可以提交；1 = 有跑偏项；2 = 环境异常（不在 git 仓库内等）。
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');            // zhongnan-backend
const REPO = path.dirname(ROOT);                    // zhongnan
const ALLOWED_PREFIX = 'zhongnan-backend/';
// 仓库根上的协作约定文件属于本仓库、且需要随流程演进更新；放行白名单必须精确到文件名，
// 不能放宽成「仓库根随便改」——否则防跑偏就形同虚设。
const ALLOWED_ROOT_FILES = new Set(['AGENTS.md', '.gitignore']);
const LOCAL_ONLY = ['zhongnan-backend/.trae/', 'zhongnan-backend/docs/daily-review/'];
const ARTIFACT_RE = /\.(log|tmp|dump|png|jpe?g|webp|gif|mp4|mov|zip|tar|gz|pdf)$/i;

const JSON_OUT = process.argv.includes('--json');
function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

function git(args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', '-C', REPO, ...args], { encoding: 'utf8' }).trim();
}

// status 不能 trim：首行以「空格 + 状态」开头（如 " M path"），trim 会吃掉这枚空格，路径被截掉首字母
function gitStatusLines() {
  // core.quotePath=false：中文文件名按原文输出，否则 octal 转义后前缀比对会误判为跨目录
  const raw = execFileSync('git', ['-c', 'core.quotePath=false', '-C', REPO, 'status', '--porcelain'], { encoding: 'utf8' });
  return raw.split('\n').filter((l) => l.trim().length > 0);
}

function readVersionState() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'FRONTEND-ADAPTATION.md'), 'utf8');
  const m = doc.match(/当前基线：\*\*v([0-9.]+)\*\*/);
  // v2.581：运行时版本也纳入校验——bump 会改它，但发布提交曾连续三版漏带该文件，
  // 线上首页更新通知停留在旧版本号（app.js wireHomeUpdateNotice 读的就是 ZN_VERSION）。
  const constants = fs.readFileSync(path.join(ROOT, 'web', 'data', 'constants.js'), 'utf8');
  const cm = constants.match(/C\.ZN_VERSION = '([^']+)'/);
  return {
    pkg: pkg.version,
    lock: lock.version,
    lockRoot: lock.packages && lock.packages[''] && lock.packages[''].version,
    docs: m ? m[1] : '',
    constants: cm ? cm[1] : '',
  };
}

function collectChanges() {
  // --porcelain 第一列是暂存区状态、第二列是工作区状态
  const lines = gitStatusLines();
  const changed = [];
  const staged = [];
  for (const line of lines) {
    const raw = line.slice(3).trim();
    // 重命名显示为 "old -> new"，以新路径为准
    const p = raw.includes(' -> ') ? raw.split(' -> ').pop() : raw;
    changed.push(p);
    if (line[0] !== ' ' && line[0] !== '?') staged.push(p);
  }
  return { changed, staged };
}

function main() {
  const violations = [];
  const info = {};

  // 1) 仓库归属
  let top = '';
  try { top = git(['rev-parse', '--show-toplevel']); } catch {
    console.error('✗ 不在 git 仓库内（或 git 不可用）');
    process.exit(2);
  }
  info.root = top;
  if (path.resolve(top) !== path.resolve(REPO)) {
    violations.push(`root: git 根是 ${top}，应为 ${REPO}（跑错仓库 = 跑偏）`);
  }

  // 2) 改动范围
  const override = arg('--paths', null);
  const changed = typeof override === 'string'
    ? override.split(',').map((s) => s.trim()).filter(Boolean)
    : collectChanges().changed;
  const staged = typeof override === 'string' ? changed : collectChanges().staged;
  info.changed = changed;

  for (const p of changed) {
    const normalized = p.replace(/^\.\//, '');
    if (normalized !== ALLOWED_PREFIX.replace(/\/$/, '')
      && !normalized.startsWith(ALLOWED_PREFIX)
      && !ALLOWED_ROOT_FILES.has(normalized)) {
      violations.push(`scope: ${p} 不在 ${ALLOWED_PREFIX} 内（禁止跨仓库/跨目录顺手改）`);
    }
    if (LOCAL_ONLY.some((pre) => normalized.startsWith(pre)) && staged.includes(p)) {
      violations.push(`localOnly: ${p} 只能本地未跟踪，不得提交`);
    }
    if (ARTIFACT_RE.test(normalized) && staged.includes(p)) {
      violations.push(`artifacts: ${p} 像截图/日志/dump/压缩包，非交付物不得入库`);
    }
  }

  // 3) 版本五处一致（v2.581 起纳入运行时版本 constants.js）
  const v = readVersionState();
  info.version = v;
  const uniq = [...new Set([v.pkg, v.lock, v.lockRoot, v.docs, v.constants])];
  if (uniq.length !== 1 || !v.pkg) {
    violations.push(`version: 五处版本不一致 → package.json=${v.pkg} lock=${v.lock} lockRoot=${v.lockRoot} 文档基线=${v.docs || '缺失'} 运行时=${v.constants || '缺失'}`);
  }

  info.ok = violations.length === 0;
  info.violations = violations;

  if (JSON_OUT) {
    console.log(JSON.stringify(info, null, 2));
  } else if (info.ok) {
    console.log(`✓ 未跑偏：git 根 ${path.basename(REPO)}，${changed.length} 处改动均在 ${ALLOWED_PREFIX} 内，版本 v${v.pkg} 五处一致`);
  } else {
    console.error('✗ 发现跑偏项：');
    violations.forEach((s) => console.error('  - ' + s));
  }
  process.exit(info.ok ? 0 : 1);
}

// v2.581：可被测试 require 读取 readVersionState，不再在 import 时执行 main（main 内含 process.exit，
// 被 require 会直接终止测试进程，把断言失败伪装成通过）。
if (require.main === module) main();

module.exports = { readVersionState };
