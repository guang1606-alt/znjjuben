#!/usr/bin/env node
/**
 * v2.312 常驻守卫：条件原子写静态设卡（AST-lite 行级扫描器）。
 *
 * 背景：v2.308/309/310/311 四轮同族修复（读取快照 → 裸 update 整体覆盖 → TOCTOU：
 * market delist 状态机抢占 / room join scalar list 条件 push / interview turnCount
 * 乐观锁 / interview brief 状态翻转条件更新），同族样本攒够——沉淀为本守卫，
 * 对「新增裸写」设卡：CI/全量测试自动跑，新增敏感字段裸覆盖即刻红。
 *
 * 设卡点：.update( 调用（updateMany 已是条件更新形态，不设卡；create 不设卡）
 *   where 仅单 id 键，且写入面含并发敏感字段：
 *     状态机字段 status:/state: 或 JSON 整体覆盖字段 payload:/bible:/materials:/transcript:
 *   （调用块 data 内联 或 前 15 行 const data/updateData/patch 变量构造段内出现即计入）
 *
 * 放行规则（任一命中即合规）：
 *   a. where 顶层多于 1 个键 —— 已是条件更新（id + 状态/版本/所有权等条件）
 *   b. 前 40 行内含 withBillingTransaction( / $transaction( / lockAccount( —— 事务+行锁保护
 *   c. 前 40 行内含 updateMany( —— 前置条件抢占（如 escrow：先抢占后同事务收尾）
 *   d. 文件级白名单 ALLOW_FILES（admin 后台面：管理员语义）
 *   e. 行级白名单 ALLOW_MARKERS（已证伪/待拍板项，逐条锚定 marker 子串，证伪理由见注释）
 *
 * 用法：node scripts/guard-conditional-write.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-conditional-write.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');

/** 文件级白名单：后台管理面（管理员语义， LLW 可接受） */
const ALLOW_FILES = [
  'src/routes/admin.ts',
];

/** 行级白名单：逐条锚定已证伪面（marker 须为该调用行 ±2 行内独有子串）
 * 每条对应一轮勘察证伪结论，固化后避免重复勘察：
 *  - interview close：close 只写 status，与 turn 落库（materials/transcript/turnCount）字段不相交；
 *    覆盖 CONVERTED→CLOSED 为用户主动关闭语义，无资金/内容损失
 *  - generate delete：v2.293 在途防线守护的软删除（删除前 count 在途任务）
 *  - generate 管线四处（FAILED 额度/RUNNING/DONE/CANCELLED）：generationTask 单写入者——
 *    task 由本请求创建，生命周期内仅本请求管线写状态，无第二写入者
 *  - generate archive：本人项目归档/恢复，LLW 可接受（无资金内容损失）
 *  - market relist：存量已删 listing 在架可购与改价快照口径为待拍板项（登记待用户决策）
 *  - knowledge prune：批量归档幂等（同状态重复翻转为 no-op）
 *  - room decide：单次消费语义，幂等键防重（v2.309 勘察证伪）
 *  - room read 收尾：围读结果落库，已证伪（v2.309 勘察）
 *  - generate bible 三处：v2.292 在途防线保护（管线运行期项目圣经快照合并）
 */
const ALLOW_MARKERS = [
  { file: 'src/routes/interview.ts', marker: `status: 'CLOSED'` },
  { file: 'src/routes/generate.ts', marker: `data: { status: 'deleted' }` },
  { file: 'src/routes/generate.ts', marker: '免费每日额度已用完' },
  { file: 'src/routes/generate.ts', marker: `status: 'RUNNING'` },
  { file: 'src/routes/generate.ts', marker: `status: 'DONE', finishedAt` },
  { file: 'src/routes/generate.ts', marker: `isCancelled ? 'CANCELLED' : 'FAILED'` },
  { file: 'src/routes/generate.ts', marker: 'status: toArchived' },
  { file: 'src/routes/market.ts', marker: `const data: any = { status: 'ON_SHELF' }` },
  { file: 'src/routes/knowledge.ts', marker: `status: 'ARCHIVED'` },
  { file: 'src/routes/room.ts', marker: `state: 'DECIDED', payload` },
  { file: 'src/routes/room.ts', marker: 'payload: { ...prevPayload, scriptMode' },
  { file: 'src/routes/generate.ts', marker: 'bible: nextBible' },
  { file: 'src/routes/generate.ts', marker: 'bible: JSON.parse(JSON.stringify({ ...storedBible' },
  // —— v2.312 勘察证伪面固化 ——
  { file: 'src/routes/feedback.ts', marker: 'data: { status: dbStatus, reply }' }, // 管理员回复反馈：管理员语义 LLW 可接受
  { file: 'src/routes/knowledge.ts', marker: `status: 'APPROVED', conflictNote: null` }, // 超管审核通过：幂等同态翻转
  { file: 'src/routes/knowledge.ts', marker: `status: 'REJECTED'` }, // 超管驳回：幂等同态翻转
  { file: 'src/routes/knowledge.ts', marker: `status: 'PENDING', pruneReason: null` }, // 超管恢复归档：幂等同态翻转
  { file: 'src/services/auto-learning.ts', marker: `status: 'ARCHIVED', pruneReason: a.reason` }, // 服务内批量淘汰：循环幂等
];

const UPDATE_RE = /\.update\(\s*\{/g;
/** 并发敏感写入字段：状态机翻转 + JSON 整体覆盖 */
const SENSITIVE_KEY_RE = /\b(?:status|state|payload|bible|materials|transcript)\s*:/;
/** 变量构造段起点：const data / let updateData / const patch 等 */
const DATA_VAR_RE = /(?:const|let|var)\s+(?:data|updateData|patch)\b/g;

/** 从 start 起做括号平衡切片（start 处须为开括号字符），返回切片文本 */
function sliceBalanced(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '{') depth++;
    else if (c === ')' || c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}

function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

/** 数对象文本顶层键数（深度 1 处按逗号分段） */
function topLevelKeyCount(objText) {
  let depth = 0, keys = 0, segHasKey = false;
  for (let i = 1; i < objText.length - 1; i++) {
    const c = objText[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (depth === 0 && c === ',') { if (segHasKey) keys++; segHasKey = false; }
    else if (depth === 0 && c === ':') segHasKey = true;
    else if (depth === 0 && /\S/.test(c) && !segHasKey) segHasKey = /[A-Za-z_$]/.test(c);
  }
  if (segHasKey) keys++;
  return keys;
}

/** 从调用块中提取 where 对象文本；无 where 返回 null */
function extractWhere(block) {
  const m = /where\s*:\s*\{/.exec(block);
  if (!m) return null;
  const braceIdx = m.index + m[0].length - 1;
  return sliceBalanced(block, braceIdx);
}

/**
 * 扫描单文件源码，返回 violations: [{ file, line, snippet }]
 * @param {string} text 源码全文
 * @param {string} file 相对路径（用于白名单匹配与报告）
 */
function scanSource(text, file) {
  const violations = [];
  if (ALLOW_FILES.some((f) => file.endsWith(f))) return violations;
  const lines = text.split('\n');
  let m;
  const re = new RegExp(UPDATE_RE.source, 'g');
  while ((m = re.exec(text))) {
    const idx = m.index;
    const line = lineOf(text, idx);
    const block = sliceBalanced(text, text.indexOf('{', idx));
    // 仅设卡 where 单 id 键的裸写；where 多键 = 已带条件
    const whereObj = extractWhere(block);
    if (whereObj && topLevelKeyCount(whereObj) > 1) continue;
    // 敏感字段检测：调用块内联 或 前 15 行 data 变量构造段
    const before15 = lines.slice(Math.max(0, line - 16), line - 1).join('\n');
    const dataVarHit = (() => {
      DATA_VAR_RE.lastIndex = 0;
      let dm; let hit = false;
      while ((dm = DATA_VAR_RE.exec(before15))) {
        // 构造段 = 从变量声明到 before15 末尾（构造后可能有逐行赋值 updateData[f]=x，一并计入）
        if (SENSITIVE_KEY_RE.test(before15.slice(dm.index))) { hit = true; break; }
      }
      return hit;
    })();
    if (!SENSITIVE_KEY_RE.test(block) && !dataVarHit) continue;
    // 规则 e：行级白名单（调用行 ±2 行内含 marker）
    const window2 = lines.slice(Math.max(0, line - 3), line + 2).join('\n');
    if (ALLOW_MARKERS.some((w) => file.endsWith(w.file) && window2.includes(w.marker))) continue;
    // 规则 b：前 40 行事务/行锁保护
    const before40 = lines.slice(Math.max(0, line - 41), line - 1).join('\n');
    if (/withBillingTransaction\(| \$transaction\(|[^.]\$transaction\(|lockAccount\(/.test(before40)) continue;
    // 规则 c：前 40 行前置条件抢占（updateMany）
    if (/\.updateMany\(/.test(before40)) continue;
    violations.push({ file, line, snippet: lines[line - 1].trim().slice(0, 120) });
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
  if (!v.length) { console.log('guard-conditional-write: 0 violation（条件原子写设卡通过）'); process.exit(0); }
  console.error(`guard-conditional-write: ${v.length} violation(s)——新增敏感字段裸写（where 仅 id 且写 status/state/payload/bible/materials/transcript）：`);
  for (const x of v) console.error(`  ${x.file}:${x.line} ${x.snippet}`);
  process.exit(1);
}
