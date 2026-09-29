#!/usr/bin/env node
/**
 * 每日仓库复盘（v2.194）—— 省 token 机制 #1：一条命令产出仓库全景报告，替代人工重扫。
 * 用法：node scripts/daily-review.cjs          → 生成 docs/daily-review/YYYY-MM-DD.md 并打印精简摘要
 *       node scripts/daily-review.cjs --quiet  → 只生成不打印
 * 覆盖：同步状态 / 多人协作动态 / 远程分支风险 / 代码规模快照 / TODO 扫描 / 待确认清单回显。
 * 设计约束：仅依赖 Node 标准库与 git，任何一节失败不影响整体报告（单人离线也能跑）。
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const quiet = process.argv.includes('--quiet');
const sh = (c) => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8', timeout: 30_000 }).trim(); } catch { return ''; } };
const line = (t) => '- ' + t;

/* ---------- 1. 同步状态 ---------- */
sh('git fetch --all --prune');
const branch = sh('git rev-parse --abbrev-ref HEAD') || 'master';
const stLine = sh(`git status -sb`).split('\n')[0] || '';
const dirty = sh('git status -s').split('\n').filter(Boolean);
const aheadBehind = stLine.match(/ahead (\d+)|behind (\d+)/g) || [];

/* ---------- 2. 多人协作动态（近 7 天） ---------- */
const authorStats = sh('git log --since="7 days ago" --format="%an"').split('\n').filter(Boolean)
  .reduce((m, a) => { m[a] = (m[a] || 0) + 1; return m; }, {});
const authorLines = Object.entries(authorStats).sort((a, b) => b[1] - a[1])
  .map(([a, n]) => line(`**${a}**：${n} 次提交`));
const recent = sh('git log -5 --format="%h %an %s"').split('\n').filter(Boolean).map(line);

/* ---------- 3. 远程分支风险 ---------- */
const remoteBranches = sh('git branch -r --format="%(refname:short)"').split('\n').filter((b) => b && !b.includes('HEAD'));
const branchRisks = [];
for (const rb of remoteBranches) {
  if (rb === `origin/${branch}` || rb === 'gitee/master') continue;
  const ahead = parseInt(sh(`git rev-list ${branch}..${rb} --count`) || '0', 10);
  if (ahead > 0) branchRisks.push(line(`远程分支 \`${rb}\` 领先 ${branch} **${ahead}** 个提交，未合并（含他人工作，合并需负责人确认）`));
}

/* ---------- 4. 代码规模快照（免重扫） ---------- */
function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}
const srcFiles = walk(path.join(ROOT, 'src'), '.ts');
const srcLines = srcFiles.reduce((n, f) => n + fs.readFileSync(f, 'utf8').split('\n').length, 0);
const testFiles = walk(path.join(ROOT, 'test'), '.cjs');
const testCases = testFiles.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/^\s*(test|it)\(/gm) || []).length, 0);
const webFile = path.join(ROOT, 'web', 'app.js');
const webLines = fs.existsSync(webFile) ? fs.readFileSync(webFile, 'utf8').split('\n').length : 0;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/* ---------- 5. TODO/FIXME 扫描 ---------- */
const todoCount = srcFiles.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/\b(TODO|FIXME)\b/g) || []).length, 0);

/* ---------- 6. 待确认清单回显（明日提醒的单一事实源） ---------- */
const pendingPath = path.join(ROOT, 'docs', 'PENDING-CONFIRMATIONS.md');
const pending = fs.existsSync(pendingPath) ? fs.readFileSync(pendingPath, 'utf8') : '';

/* ---------- 汇总报告 ---------- */
const today = new Date().toISOString().slice(0, 10);
const report = `# 每日仓库复盘 ${today}

> 由 \`scripts/daily-review.cjs\` 自动生成（省 token 机制：看完本报告即可开工，无需重扫仓库）。

## 一、同步状态
- 分支 \`${branch}\` ${aheadBehind.length ? '**' + aheadBehind.join(' / ') + '**' : '与远程同步'}${dirty.length ? `，工作区未提交 ${dirty.length} 个文件` : '，工作区干净'}
${dirty.slice(0, 10).map((d) => '  - `' + d + '`').join('\n')}

## 二、多人协作动态（近 7 天）
${authorLines.length ? authorLines.join('\n') : line('近 7 天无提交')}

最近 5 次提交：
${recent.join('\n')}

## 三、远程分支风险
${branchRisks.length ? branchRisks.join('\n') : line('无未合并的领先分支')}

## 四、代码规模快照
- 版本：\`${pkg.version}\`（package.json）
- 后端 src：${srcFiles.length} 个 TS 文件 / ${srcLines} 行
- 前端 web/app.js：${webLines} 行
- 测试：${testFiles.length} 个文件 / ~${testCases} 条用例
- TODO/FIXME 未清：${todoCount} 处

## 五、待用户确认事项（明日提醒源）
${pending || '_（无待确认事项）_'}

## 六、风险提示
${[
  aheadBehind.some((x) => x.includes('behind')) ? line(`本地落后远程，开工前先 \`git pull\``) : '',
  dirty.length > 20 ? line(`未提交文件达 ${dirty.length} 个，超出单任务体量，建议尽快分批提交`) : '',
  todoCount > 30 ? line(`TODO/FIXME 累计 ${todoCount} 处，安排专项清理`) : '',
].filter(Boolean).join('\n') || '_（无）_'}

---
*报告入库共享（多人协作可见）；每日一条，历史可追溯。*
`;

const outDir = path.join(ROOT, 'docs', 'daily-review');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${today}.md`);
fs.writeFileSync(outPath, report);

if (!quiet) {
  console.log(`✅ 报告已生成: docs/daily-review/${today}.md`);
  console.log(`   分支: ${stLine || branch}${dirty.length ? ` | 未提交 ${dirty.length} 文件` : ' | 工作区干净'}`);
  console.log(`   协作: ${authorLines.length} 人活跃 | 分支风险: ${branchRisks.length} 项 | 版本: ${pkg.version}`);
  console.log(`   待确认: ${pending ? '有（见报告第五节）' : '无'}`);
}
