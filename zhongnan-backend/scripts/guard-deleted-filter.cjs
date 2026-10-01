#!/usr/bin/env node
/**
 * v2.298 常驻守卫：软删除穿透静态设卡（AST-lite 行级扫描器）。
 *
 * 背景：v2.292/293/295/296/297 五轮同族修复（裸 project 查询缺 status 过滤 → 已删项目
 * 穿透到计费/导出/协作/海报/改编/市场上架），同族样本已攒够——沉淀为本守卫，
 * 对「新增裸查询」设卡：CI/全量测试自动跑，新增穿透面即刻红。
 *
 * 设卡点（project 直接查询 + script include project 间接查询）：
 *   project.findFirst / findMany / findUnique（update/count/create 不设卡：
 *   update 前置必有守卫查询，count 用于配额系有意含 deleted）
 *
 * 放行规则（任一命中即合规）：
 *   a. 调用语句块（括号平衡切片）内含 `status` —— where/select 内联已带
 *   b. 调用点后 12 行内含 deleted 判定（status === 'deleted' / !== / not: 'deleted'）——后置同函数判定
 *   c. 调用点前 30 行内 `const where` 构造段含 deleted —— 变量 where 模式
 *   d. 文件级白名单 ALLOW_FILES（admin 后台面：管理员语义即见全量）
 *   e. 行级白名单 ALLOW_MARKERS（待拍板项/有意语义，逐条锚定 marker 子串）
 *
 * 用法：node scripts/guard-deleted-filter.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-deleted-filter.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');

/** 文件级白名单：后台管理面（管理员语义即见全量，含已删） */
const ALLOW_FILES = [
  'src/routes/admin.ts',
];

/** 行级白名单：逐条锚定（marker 须为该调用行或紧邻行独有子串）
 *  - market.ts `listing.scriptId`：购买面存量 listing 详情查询——存量已删 listing 在架可购属待拍板项
 *  - generate.ts `select: { tags: true }`：标签聚合喂推荐，已删项目标签残留为弱信号（有意语义）
 */
const ALLOW_MARKERS = [
  { file: 'src/routes/market.ts', marker: 'listing.scriptId' },
  { file: 'src/routes/generate.ts', marker: 'select: { tags: true }' },
];

const DIRECT_RE = /project\.(findFirst|findMany|findUnique)\(/;
const INDIRECT_RE = /script\.(findFirst|findMany)\(/;
const DELETED_GUARD_RE = /status\s*(?:===|!==)\s*'deleted'|status:\s*\{\s*not:\s*'deleted'\s*\}|status:\s*'deleted'/;

/** 从 start 起做括号平衡切片，返回调用语句块文本 */
function sliceCallBlock(text, start) {
  let depth = 0, i = text.indexOf('(', start);
  for (; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}

function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

/**
 * 扫描单文件源码，返回 violations: [{ file, line, kind, snippet }]
 * @param {string} text 源码全文
 * @param {string} file 相对路径（用于白名单匹配与报告）
 */
function scanSource(text, file) {
  const violations = [];
  if (ALLOW_FILES.some((f) => file.endsWith(f))) return violations;
  const lines = text.split('\n');
  const points = [];
  let m;
  const re = new RegExp(`(?:${DIRECT_RE.source})|(?:${INDIRECT_RE.source})`, 'g');
  while ((m = re.exec(text))) points.push({ idx: m.index, kind: m[1] ? 'project' : 'script-include-project' });

  for (const p of points) {
    const line = lineOf(text, p.idx);
    // 间接面追加条件：后 8 行须含 include: { project（否则只是普通 script 查询）
    if (p.kind === 'script-include-project' && !/include:\s*\{\s*project/.test(lines.slice(line - 1, line + 8).join('\n'))) continue;
    // 规则 e：行级白名单（调用行 ±2 行内含 marker）
    const window2 = lines.slice(Math.max(0, line - 3), line + 2).join('\n');
    if (ALLOW_MARKERS.some((w) => file.endsWith(w.file) && window2.includes(w.marker))) continue;
    // 规则 a：调用语句块内含 status
    const block = sliceCallBlock(text, p.idx);
    if (/\bstatus\b/.test(block)) continue;
    // 规则 b：后 12 行 deleted 判定
    if (DELETED_GUARD_RE.test(lines.slice(line - 1, line + 12).join('\n'))) continue;
    // 规则 c：前 30 行变量 where 构造段含 deleted
    const before = lines.slice(Math.max(0, line - 31), line - 1).join('\n');
    if (/const where/.test(before) && /deleted/.test(before.slice(before.lastIndexOf('const where')))) continue;
    violations.push({ file, line, kind: p.kind, snippet: lines[line - 1].trim().slice(0, 120) });
  }
  return violations;
}

/** 递归收集 src 下 .ts 文件（排除 .d.ts / node_modules） */
function collectTsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') collectTsFiles(p, out); }
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** 扫描整个 src，返回全部 violations */
function scanProject(rootDir = SRC_ROOT) {
  const all = [];
  for (const abs of collectTsFiles(rootDir)) {
    const rel = path.relative(path.join(__dirname, '..'), abs);
    all.push(...scanSource(fs.readFileSync(abs, 'utf8'), rel));
  }
  return all;
}

module.exports = { scanSource, scanProject, ALLOW_FILES, ALLOW_MARKERS };

if (require.main === module) {
  const v = scanProject();
  if (!v.length) { console.log('guard-deleted-filter: 0 violation（软删除穿透设卡通过）'); process.exit(0); }
  console.error(`guard-deleted-filter: ${v.length} violation(s)——新增裸 project 查询缺 status 过滤：`);
  for (const x of v) console.error(`  ${x.file}:${x.line} [${x.kind}] ${x.snippet}`);
  process.exit(1);
}
