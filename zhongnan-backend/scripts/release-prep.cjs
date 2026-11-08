#!/usr/bin/env node
/**
 * v2.476 发布前收口脚本：把「每轮靠记忆的发布清单」变成一条命令。
 *
 * 为什么需要：dogfood 六步闭环里最容易被跳过、也最贵的两步是——
 *   ①防跑偏自检（改到别的仓库 / 把本地产物带进暂存区）；
 *   ②升版后日报段落没落盘（v2.472–v2.474 连续三版漏记，只能事后补）。
 * 这两件事都不该靠人记，而应一条命令给出结论 + 下一步要敲的命令。
 *
 * 用法：
 *   npm run release:prep            # 跑 preflight + 检查今日日报段落，打印发布后命令
 *   node scripts/release-prep.cjs --json
 *
 * 退出码：0 = 可以发布（日报缺失只提示）；1 = 有硬性问题（跑偏/版本不一致/日报缺段落）；2 = 脚本异常。
 *
 * 注意：全量测试与真机巡检是 `npm run verify:full`（耗时），本脚本不重复跑，避免双倍等待。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 今日日报必须出现当前版本号（如 v2.476）；文件不存在时返回 skipped，不平白阻碍发布 */
function checkDailyNote(dir, version, dateStr) {
  const file = path.join(dir, `${dateStr}.md`);
  if (!fs.existsSync(file)) return { ok: true, skipped: true, file, reason: '今日日报尚未创建' };
  const text = fs.readFileSync(file, 'utf8');
  // 版本号可能写作 v2.476 / v2.476.0，统一按主次版本匹配
  const short = version.split('.').slice(0, 2).join('.');
  const ok = new RegExp(`v${short.replace(/\./g, '\\.')}(?![\\d.])`).test(text);
  return { ok, skipped: false, file, reason: ok ? '' : `日报未记录 v${short} 段落（升版必须落盘）` };
}

/** 发布后要敲的命令：把易错的 tag/push 目标固化下来，避免手滑推到父仓库 */
function nextSteps(version) {
  const tag = 'v' + version.split('.').slice(0, 2).join('.');
  return [
    `git add <本任务明确列出的文件>`,
    `git commit -m "feat(${tag}): …"`,
    `git tag ${tag}`,
    `git push gitee master && git push gitee ${tag}`,
    `git ls-remote --tags gitee ${tag}   # 核对远端 tag 指向本次提交`,
    `# 释放巡检端口：lsof -nP -iTCP:8130 -sTCP:LISTEN -t | xargs -r kill`,
  ];
}

function runPreflight() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'scope-guard.cjs')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

function main(argv) {
  const json = argv.includes('--json');
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法：node scripts/release-prep.cjs [--json]');
    return 0;
  }
  const version = pkg.version;
  const pre = runPreflight();
  const note = checkDailyNote(path.join(ROOT, 'docs', 'daily-review'), version, today());
  const steps = nextSteps(version);
  const ok = pre.ok && note.ok;
  if (json) {
    console.log(JSON.stringify({ version, preflight: pre, dailyNote: note, steps, ok }, null, 2));
  } else {
    console.log(`release-prep ${ok ? '✓ 可以发布' : '✗ 有问题'}（版本 v${version}）`);
    console.log((pre.ok ? '  ✓ ' : '  ✗ ') + 'preflight：' + pre.out.trim().split('\n').pop());
    if (note.skipped) console.log('  · 日报：' + note.reason);
    else console.log((note.ok ? '  ✓ ' : '  ✗ ') + '日报：' + (note.ok ? '已记录当前版本段落' : note.reason));
    if (ok) {
      console.log('\n发布命令：');
      steps.forEach((s) => console.log('  ' + s));
    }
  }
  return ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error('release-prep 异常：' + (e && e.message));
    process.exit(2);
  }
}

module.exports = { checkDailyNote, nextSteps, today, runPreflight };
