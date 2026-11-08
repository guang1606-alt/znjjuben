#!/usr/bin/env node
/**
 * v2.490 变异一键跑（含强制还原）
 *
 * 痛点：「变异测试」原本是手工流程——改一处源码、跑测试、看是否变红、再改回来。
 * 手工还原靠人记，漏还原就会把变异带进提交，或者两三轮之后自己也分不清
 * 工作区里那一行到底是变异还是真修复。每轮都要重复一遍，既费 token 又不可靠。
 *
 * 这个脚本把「备份 → 变异 → 跑测试 → 期望判定 → 强制还原 → 校验还原」做成一次调用：
 *   node scripts/mutation-run.cjs --file web/app.js \
 *        --find "旧串" --replace "新串" --test test/web-view-router.test.cjs
 *
 * 约定与保证：
 *   - 目标文件必须是 git 干净态（或不传 --allow-dirty 时拒绝开始），避免把未提交改动卷进来；
 *   - --find 必须命中（默认至少 1 处；可用 --count N 要求精确处数）；
 *   - 默认期望测试变红（--expect red），也可 --expect green 验证「改坏了但测试没抓到」；
 *   - 无论测试结果如何（含脚本异常、Ctrl-C），finally 都会还原并核对 sha256；
 *   - 退出码 0 仅当「期望匹配」且「还原核对通过」，其余情况非 0，便于接进 CI/钩子。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = { expect: 'red', count: null, allowDirty: false, timeout: 600000 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) fail('参数 ' + a + ' 缺少取值');
      i += 1;
      return v;
    };
    if (a === '--file') out.file = next();
    else if (a === '--find') out.find = next();
    else if (a === '--replace') out.replace = next();
    else if (a === '--test') out.test = next();
    else if (a === '--expect') out.expect = next();
    else if (a === '--count') out.count = Number(next());
    else if (a === '--timeout') out.timeout = Number(next());
    else if (a === '--allow-dirty') out.allowDirty = true;
    else if (a === '-h' || a === '--help') usage();
    else fail('未知参数 ' + a);
  }
  if (!out.file || out.find === undefined || out.replace === undefined || !out.test) usage();
  if (!['red', 'green'].includes(out.expect)) fail('--expect 只能是 red 或 green');
  if (out.count !== null && (!Number.isInteger(out.count) || out.count < 1)) fail('--count 必须是正整数');
  return out;
}

function usage() {
  console.log(`用法：
  node scripts/mutation-run.cjs --file <源码> --find <原文> --replace <变异> --test <测试文件> [选项]

选项：
  --expect red|green   期望测试结果（默认 red：变异应被守卫抓住）
  --count N            要求 --find 精确命中 N 处
  --allow-dirty        允许目标文件带未提交改动（默认拒绝，避免把真实修改卷进变异）
  --timeout ms         跑测试的超时（默认 600000）`);
  process.exit(0);
}

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '').trim() };
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const file = path.resolve(ROOT, opt.file);
  const testFile = path.resolve(ROOT, opt.test);
  if (!fs.existsSync(file)) fail('源码不存在：' + opt.file);
  if (!fs.existsSync(testFile)) fail('测试不存在：' + opt.test);

  const rel = path.relative(ROOT, file);
  // 基线脏度：--allow-dirty 时用它做「还原前后一致」的比对，
  // 而不是要求工作区绝对干净（否则本来就有真实改动时永远判失败）。
  const baselineDirty = git(['status', '--porcelain', '--', rel]).out;
  if (baselineDirty && !opt.allowDirty) {
    fail('目标文件有未提交改动，拒绝变异（先提交，或加 --allow-dirty）：\n' + baselineDirty);
  }

  const original = fs.readFileSync(file, 'utf8');
  const before = sha(file);
  const hits = original.split(opt.find).length - 1;
  if (hits === 0) fail('--find 在 ' + rel + ' 中未命中，变异无效（请检查原文是否与当前代码一致）');
  if (opt.count !== null && hits !== opt.count) fail('--find 命中 ' + hits + ' 处，期望 ' + opt.count + ' 处');

  const mutated = original.split(opt.find).join(opt.replace);
  const backup = path.join(os.tmpdir(), 'zn-mutation-' + process.pid + path.extname(file));
  fs.writeFileSync(backup, original);

  let exit = 0;
  let restored = false;
  try {
    fs.writeFileSync(file, mutated);
    console.log(`▶ 变异 ${rel}（命中 ${hits} 处）→ 运行 ${opt.test}`);
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'run-tests.cjs'), path.relative(ROOT, testFile)], {
      cwd: ROOT, encoding: 'utf8', timeout: opt.timeout,
    });
    const code = r.status === null ? 124 : r.status;
    const tail = String(r.stdout || '').split('\n').filter((l) => /^(not ok|# fail)/.test(l)).slice(0, 6);
    const got = code === 0 ? 'green' : 'red';
    const ok = got === opt.expect;
    console.log(`  测试结果：${got}（退出码 ${code}），期望 ${opt.expect} → ${ok ? '符合预期' : '不符合预期'}`);
    tail.forEach((l) => console.log('  | ' + l));
    exit = ok ? 0 : 1;
  } finally {
    // 强制还原：不管测试抛错、超时还是被中断，都要把源码写回原样并核对
    fs.writeFileSync(file, fs.readFileSync(backup, 'utf8'));
    restored = sha(file) === before;
    try { fs.unlinkSync(backup); } catch { /* 临时文件已不存在 */ }
  }

  if (!restored) fail('还原核对失败：' + rel + ' 与变异前不一致，请立即 git diff 手工确认');
  const afterDirty = git(['status', '--porcelain', '--', rel]).out;
  if (afterDirty !== baselineDirty) {
    fail('还原后 git 状态与变异前不一致，请立即 git diff 确认：\n' + afterDirty);
  }
  console.log(`✓ 已还原 ${rel}（sha256 一致，git 状态与变异前相同）`);
  process.exit(exit);
}

main();
