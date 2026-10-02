#!/usr/bin/env node
/**
 * v2.306 常驻守卫：web 裸 async 事件 handler 设卡（AST-lite 行级扫描器）。
 *
 * 背景：v2.284~v2.287 四轮同族修复（裸 async handler await reject → 冒泡
 * unhandledrejection、零用户反馈；行政/授权/作品/市场面逐点包 try/catch）——
 * 同族样本攒够，沉淀为本守卫：对「新增裸 async handler」设卡，全量测试自动跑。
 *
 * 设卡点（web/*.js 事件绑定，两种形态）：
 *   1. 内联：.onXxx = async (…) => {…} ／ addEventListener('…', async (…) => {…})
 *   2. 引用：.onXxx = ident ／ addEventListener('…', ident)——同文件解析 ident 定义体，
 *      仅当定义为 async 且含 await 时进入判定（找不到定义/非 async 一律放行）
 *
 * 放行规则（任一命中即合规）：
 *   a. 函数体不含 await —— 同步体无 reject 面（不在本守卫 lens 内）
 *   b. 函数体含 try { 且含 catch —— 自管异常
 *   c. 委托形态：函数体内全部 await ident(…) 的 ident ∈ SELF_MANAGED_FNS
 *      （内部自带 try/catch 的自管函数，如 dealAction）
 *   d. 行级白名单 ALLOW_MARKERS（特殊有意形态，逐条锚定 marker 子串）
 *
 * 用法：node scripts/guard-async-handler.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-async-handler.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, '..', 'web');

/** 自管函数白名单：内部 try/catch 兜底，await 它即合规（逐函数锚定，勿泛化） */
const SELF_MANAGED_FNS = [
  'dealAction', // app.js 市场确认/放款/退款：内部 try/catch + xnSay(e.message)
];

/** UI 原语白名单：resolve-only 对话框（取消也 resolve，语义上不 reject），await 它无风险 */
const UI_PRIMITIVES = [
  'uiConfirm', 'uiPrompt',
];

/** 行级白名单：逐条锚定（marker 须为绑定行独有子串） */
const ALLOW_MARKERS = [
  // { file: 'web/app.js', marker: 'xxx' },
];

// 内联形态：.onXxx = async ( 或 addEventListener('…', async (
const INLINE_RE = /\.on\w+\s*=\s*async\s*\(|addEventListener\(\s*['"][^'"]+['"]\s*,\s*async\s*\(/g;
// 引用形态：.onXxx = ident; 或 addEventListener('…', ident)
const REF_RE = /\.on\w+\s*=\s*([A-Za-z_$][\w$]*)\s*;|addEventListener\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;

function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

/** 从 text[openIdx]（须为 '{'）起做花括号平衡切片，返回函数体文本（含花括号） */
function sliceBraceBlock(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(openIdx, i + 1); }
    else if (c === "'" || c === '"' || c === '`') { // 跳过字符串字面量（防花括号误入）
      const q = c; i++;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; }
    }
  }
  return text.slice(openIdx);
}

/** 提取 async 箭头函数的函数体：从 async 关键字位置起，过参数括号到 =>，取花括号体或表达式体 */
function extractArrowBody(text, asyncIdx) {
  // 过参数：可能是 `async () =>` 或 `async (e) =>` 或 `async e =>`
  let i = asyncIdx + 'async'.length;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === '(') { // 括号平衡过参数
    let depth = 0;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') { depth--; if (depth === 0) { i++; break; } }
    }
  } else { // 单标识符参数
    while (i < text.length && /[\w$]/.test(text[i])) i++;
  }
  const arrow = text.indexOf('=>', i);
  if (arrow < 0) return null;
  let j = arrow + 2;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (text[j] === '{') return sliceBraceBlock(text, j);
  // 表达式体：取到行尾
  const nl = text.indexOf('\n', j);
  return text.slice(j, nl < 0 ? text.length : nl);
}

/** 在同文件内解析引用形态的函数定义体（async function / const|let|var = async 箭头），找不到返回 null */
function resolveRefBody(text, name) {
  const escName = name.replace(/[$]/g, '\\$');
  const pats = [
    new RegExp(`async\\s+function\\s+${escName}\\s*\\(`),                    // async function name(
    new RegExp(`(?:const|let|var)\\s+${escName}\\s*=\\s*async\\s*\\(`),     // const name = async (
    new RegExp(`(?:const|let|var)\\s+${escName}\\s*=\\s*async\\s+function\\s*\\(`), // const name = async function(
  ];
  for (const re of pats) {
    const m = re.exec(text);
    if (!m) continue;
    const asyncIdx = m.index + m[0].indexOf('async');
    if (m[0].includes('function')) { // function 声明形态：过参数括号后取 { }
      let i = text.indexOf('(', m.index);
      let depth = 0;
      for (; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') { depth--; if (depth === 0) break; }
      }
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '{') return sliceBraceBlock(text, j);
      return null;
    }
    return extractArrowBody(text, asyncIdx);
  }
  return null;
}

/** 判定函数体是否合规；返回 null=合规，否则返回违规原因 */
function judgeBody(body) {
  if (!/\bawait\b/.test(body)) return null;                       // 规则 a：同步体
  if (/\btry\s*\{/.test(body) && /\bcatch\s*[({]/.test(body)) return null; // 规则 b：自管 try/catch
  // 规则 c：白名单形态——体内全部 await ident( 的 ident ∈ 自管函数 ∪ UI 原语
  // （v2.285 修复形态：网络调用走 .then/.catch 链兜底，await 只留给 resolve-only UI 原语）
  const awaits = [...body.matchAll(/\bawait\s+(?:\w+\.)?([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  const SAFE = [...SELF_MANAGED_FNS, ...UI_PRIMITIVES];
  if (awaits.length && awaits.every((fn) => SAFE.includes(fn))) return null;
  return 'await reject 无 try/catch 兜底（冒泡 unhandledrejection、零用户反馈）';
}

/**
 * 扫描单文件源码，返回 violations: [{ file, line, form, snippet }]
 * @param {string} text 源码全文
 * @param {string} file 相对路径（用于白名单匹配与报告）
 */
function scanSource(text, file) {
  const violations = [];
  const lines = text.split('\n');
  const allowHit = (line) => {
    const win = lines.slice(Math.max(0, line - 2), line + 2).join('\n');
    return ALLOW_MARKERS.some((w) => file.endsWith(w.file) && win.includes(w.marker));
  };

  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    const line = lineOf(text, m.index);
    if (allowHit(line)) continue;
    const asyncIdx = m.index + m[0].indexOf('async');
    const body = extractArrowBody(text, asyncIdx);
    const why = body && judgeBody(body);
    if (why) violations.push({ file, line, form: 'inline', snippet: lines[line - 1].trim().slice(0, 120), why });
  }

  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text))) {
    const name = m[1] || m[2];
    const line = lineOf(text, m.index);
    if (allowHit(line)) continue;
    const body = resolveRefBody(text, name);
    if (body == null) continue; // 找不到定义（跨文件/内置/非 async）：保守放行
    const why = judgeBody(body);
    if (why) violations.push({ file, line, form: `ref:${name}`, snippet: lines[line - 1].trim().slice(0, 120), why });
  }
  return violations;
}

/** 扫描整个 web/，返回全部 violations */
function scanProject(rootDir = WEB_ROOT) {
  const all = [];
  for (const name of fs.readdirSync(rootDir)) {
    if (!name.endsWith('.js')) continue;
    const abs = path.join(rootDir, name);
    const rel = path.relative(path.join(__dirname, '..'), abs);
    all.push(...scanSource(fs.readFileSync(abs, 'utf8'), rel));
  }
  return all;
}

module.exports = { scanSource, scanProject, SELF_MANAGED_FNS, ALLOW_MARKERS };

if (require.main === module) {
  const v = scanProject();
  if (!v.length) { console.log('guard-async-handler: 0 violation（裸 async handler 设卡通过）'); process.exit(0); }
  console.error(`guard-async-handler: ${v.length} violation(s)——裸 async handler 缺异常兜底：`);
  for (const x of v) console.error(`  ${x.file}:${x.line} [${x.form}] ${x.snippet}`);
  process.exit(1);
}
