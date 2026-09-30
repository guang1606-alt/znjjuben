#!/usr/bin/env node
/**
 * 测试统一入口（v2.87）：
 *  - 为什么需要：@prisma/client 在构造 PrismaClient 时会从项目 .env 载入环境变量且【不覆盖已有值】；
 *    本仓库 .env 含 NODE_ENV=production，测试进程 require 链一碰 dist/lib/prisma.js 就会被改成
 *    production，进而触发 auth.js 的"生产必须 16 位密钥"铁律，把测试用的短 JWT 密钥全数炸掉
 *    （v2.87 自检实录：25 个 http 与 market 系列测试文件因此全红、个别文件空转挂死）。
 *  - 修复：在任何 require 发生前预设 NODE_ENV=test（Prisma 不覆盖已有值，故此后 .env 不再生效），
 *    然后透传 node --test。
 *  - 用法：npm test [同 node --test 参数，缺省跑 test/ 目录]
 */
const { spawnSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const path = require('node:path');

if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'test';
}

const args = process.argv.slice(2);
// Node 在 Windows 上不会将 test/ 展开为测试文件；显式枚举目录，保持 CLI 过滤参数可用。
const options = [];
const targets = [];
const takesValue = new Set([
  '--test-concurrency', '--test-name-pattern', '--test-skip-pattern', '--test-reporter',
  '--test-reporter-destination', '--test-timeout', '--test-shard', '--test-isolation',
  '--test-coverage-include', '--test-coverage-exclude', '--test-coverage-lines',
  '--test-coverage-branches', '--test-coverage-functions', '--import', '--require', '-r',
]);
let onlyTargets = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--') { onlyTargets = true; continue; }
  if (!onlyTargets && arg.startsWith('-')) {
    options.push(arg);
    if (takesValue.has(arg) && i + 1 < args.length) options.push(args[++i]);
  } else targets.push(arg);
}
function expand(target) {
  let stat;
  try { stat = statSync(target); } catch { return [target]; }
  if (!stat.isDirectory()) return [target];
  return readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const file = path.join(target, entry.name);
    if (entry.isDirectory()) return expand(file);
    return /\.test\.(?:cjs|mjs|js)$/.test(entry.name) ? [file] : [];
  });
}
const files = [...new Set((targets.length ? targets : ['test']).flatMap(expand))];
if (!files.length) { console.error('未找到测试文件'); process.exit(1); }
// v2.194 c195：默认不再带 --test-force-exit。实测该开关会在并发文件收集未完成时强杀进程，
// 每轮静默截断 7~14% 用例（全量 5002 条被截到 4316~4639，单文件 98 条被截到 59）——
// "# fail 0" 绿灯名实不符，真回归可能从未执行。全量/单文件实测均能自行干净退出，无需该开关。
// 若新增测试确有残留句柄导致不退出，应修句柄本身；应急可 FORCE_EXIT=1 临时绕过。
const nodeArgs = ['--test'];
if (process.env.FORCE_EXIT === '1') nodeArgs.push('--test-force-exit');
const r = spawnSync(process.execPath, [...nodeArgs, ...options, ...files], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status ?? 1);
