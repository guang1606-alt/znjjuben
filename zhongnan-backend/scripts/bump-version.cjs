#!/usr/bin/env node
/**
 * v2.496 版本号一键自增（package.json + package-lock 根与 packages[""] + 文档基线行）
 *
 * 为什么需要：每轮发布都要手改四处版本号，既重复又容易漏改导致 scope-guard 拦截。
 * 一条命令同步四处，避免「只改 package.json 忘了 lock/docs」的半截升版。
 *
 * 用法：
 *   node scripts/bump-version.cjs              # 自增 patch（2.495.0 → 2.496.0）
 *   node scripts/bump-version.cjs --patch      # 同上
 *   node scripts/bump-version.cjs --minor      # 自增 minor（2.495.0 → 2.500.0）
 *   node scripts/bump-version.cjs --major      # 自增 major（2.495.0 → 3.0.0）
 *   node scripts/bump-version.cjs --to 2.500.0 # 指定目标版本
 *   node scripts/bump-version.cjs --dry-run    # 只打印不改文件
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function currentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function bump(version, mode) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (mode) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch':
    default:      return `${major}.${minor + 1}.0`;  // 本项目 patch 步长在次位
  }
}

function targetVersion() {
  const toIdx = process.argv.indexOf('--to');
  if (toIdx >= 0 && process.argv[toIdx + 1]) return process.argv[toIdx + 1];
  if (process.argv.includes('--major')) return bump(currentVersion(), 'major');
  if (process.argv.includes('--minor')) return bump(currentVersion(), 'minor');
  return bump(currentVersion(), 'patch');
}

function writeJson(file, transform) {
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(obj, null, 2);
  transform(obj);
  const after = JSON.stringify(obj, null, 2) + '\n';
  if (!dryRun) fs.writeFileSync(file, after);
  return { changed: before !== after };
}

function updateDocBaseline(newVer) {
  const file = path.join(ROOT, 'docs', 'FRONTEND-ADAPTATION.md');
  let text = fs.readFileSync(file, 'utf8');
  const re = /当前基线：\*\*v[0-9.]+\*\*/;
  const before = text;
  text = text.replace(re, `当前基线：**v${newVer}**`);
  if (text === before) {
    console.error('✗ docs/FRONTEND-ADAPTATION.md 未找到「当前基线：**v...**」行');
    process.exit(1);
  }
  if (!dryRun) fs.writeFileSync(file, text);
}

function main() {
  const from = currentVersion();
  const to = targetVersion();
  if (from === to) {
    console.log(`版本已是 ${to}，无需改动`);
    return;
  }

  const changes = [];

  const pkgRes = writeJson(path.join(ROOT, 'package.json'), (o) => { o.version = to; });
  changes.push(['package.json', pkgRes.changed]);

  const lockRes = writeJson(path.join(ROOT, 'package-lock.json'), (o) => {
    o.version = to;
    if (o.packages && o.packages['']) o.packages[''].version = to;
  });
  changes.push(['package-lock.json', lockRes.changed]);

  updateDocBaseline(to);
  changes.push(['docs/FRONTEND-ADAPTATION.md', true]);

  console.log(`${dryRun ? '[dry-run] ' : ''}${from} → ${to}`);
  for (const [f, c] of changes) {
    console.log(`  ${c ? '✓' : '='} ${f}`);
  }
  if (dryRun) console.log('（--dry-run：未实际写入）');
}

main();
