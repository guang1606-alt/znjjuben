#!/usr/bin/env node
/**
 * v2.307 常驻守卫：web 裸 promise 链缺 catch 设卡（AST-lite 行级扫描器）。
 *
 * 背景：c199（room-view copyText：clipboard?. 静默失败 + then 无 catch → unhandledrejection、
 * 零用户反馈）同族在 v2.307 勘察中再咬出漏网——teardown-view.js 复制大纲按钮裸链。
 * 同族样本（room/app 两处剪贴板合规 + admApi 链群 + tags 链群 + 1 处违规）攒够，
 * 沉淀为本守卫：对「新增裸 promise 链」设卡，全量测试自动跑。
 *
 * 设卡点（web/*.js 中所有 `.then(` 出现点）：
 *   取「语句头」（then 所在行行首起，跨行链向上回溯到链头行）与
 *   「链块」（then 点起括号平衡向后延伸到语句结束 ;），按下列规则判定。
 *
 * 放行规则（任一命中即合规）：
 *   a. 链块含 .catch( —— 链尾兜底
 *   b. 该 then 括号块顶层含逗号 —— then(onOk, onErr) 双参自管
 *   c. 语句头以 await/return/void 开头 —— reject 由 await 点/调用方负责
 *   d. 语句头含赋值 `=` —— promise 被存留，由使用方负责（如 const ensure = ...）
 *   e. 语句头含 Promise.resolve( / Promise.reject( —— 微任务调度形态
 *   f. 行级白名单 ALLOW_MARKERS（特殊有意形态，逐条锚定 marker 子串）
 *
 * 不设卡：后端 src（进程语义不同，reject 不进用户交互面；v2.307 已人工全量核实合规）。
 *
 * 用法：node scripts/guard-promise-chain.cjs  → 0 violation 退出码 0，否则列出并退出码 1
 * 测试：test/guard-promise-chain.test.cjs（真实扫描 + fixture 变异红黑自证）
 */
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, '..', 'web');

/** 行级白名单：逐条锚定（marker 须为语句头所在行独有子串） */
const ALLOW_MARKERS = [
  // { file: 'web/app.js', marker: 'xxx' },
];

const THEN_RE = /\.then\s*\(/g;

function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

/** 跳过字符串字面量：i 指向引号，返回引号后一个位置 */
function skipString(text, i) {
  const q = text[i]; i++;
  while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; }
  return i;
}

/**
 * 语句头：then 所在行（行首缩进后）若以 '.' 开头说明是跨行链中段，
 * 逐行向上回溯到链头行（行首非点号）；返回链头行的去缩进文本。
 */
function stmtHead(lines, line) {
  let i = line - 1;
  let head = (lines[i] || '').trim();
  while (/^\./.test(head) && i > 0) { i--; head = (lines[i] || '').trim(); }
  return head;
}

/** 链块：从 thenIdx 起括号平衡向后延伸，跨行链随下行点号开头继续，到顶层 ; 或行尾结束 */
function sliceChain(text, thenIdx) {
  let depth = 0;
  for (let i = thenIdx; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i); continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ';' && depth <= 0) return text.slice(thenIdx, i + 1);
    else if (c === '\n' && depth <= 0) {
      if (/^\s*\./.test(text.slice(i + 1))) continue; // 下行点号开头：链延续
      return text.slice(thenIdx, i);
    }
  }
  return text.slice(thenIdx);
}

/** 该 then 括号块顶层是否含逗号（双参形态） */
function thenHasSecondArg(text, thenIdx) {
  const open = text.indexOf('(', thenIdx);
  if (open < 0) return false;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i); continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return false; }
    else if (c === ',' && depth === 1) return true;
  }
  return false;
}

/** 赋值等号判定（排除 == === => >= <= !=） */
const ASSIGN_RE = /(^|[^=!<>])=(?![=>])/;

/**
 * 扫描单文件源码，返回 violations: [{ file, line, snippet, why }]
 * @param {string} text 源码全文
 * @param {string} file 相对路径（用于白名单匹配与报告）
 */
function scanSource(text, file) {
  const violations = [];
  const lines = text.split('\n');
  let m;
  THEN_RE.lastIndex = 0;
  while ((m = THEN_RE.exec(text))) {
    const line = lineOf(text, m.index);
    const head = stmtHead(lines, line);
    // 规则 f：行级白名单（语句头行 ±1 行内含 marker）
    const win = lines.slice(Math.max(0, line - 2), line + 1).join('\n');
    if (ALLOW_MARKERS.some((w) => file.endsWith(w.file) && win.includes(w.marker))) continue;
    // 规则 c：await / return / void 头
    if (/^(await|return|void)\b/.test(head)) continue;
    // 规则 d：赋值头（promise 被存留，使用方负责）
    if (ASSIGN_RE.test(head)) continue;
    // 规则 e：Promise.resolve / reject 微任务调度
    if (/Promise\.(resolve|reject)\s*\(/.test(head)) continue;
    // 规则 a：链块含 .catch(
    const chain = sliceChain(text, m.index);
    if (/\.catch\s*\(/.test(chain)) continue;
    // 规则 b：then 双参自管
    if (thenHasSecondArg(text, m.index)) continue;
    violations.push({
      file, line,
      snippet: (lines[line - 1] || '').trim().slice(0, 120),
      why: 'promise 链缺 catch 兜底（reject 冒泡 unhandledrejection、零用户反馈）',
    });
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

module.exports = { scanSource, scanProject, ALLOW_MARKERS };

if (require.main === module) {
  const v = scanProject();
  if (!v.length) { console.log('guard-promise-chain: 0 violation（裸 promise 链设卡通过）'); process.exit(0); }
  console.error(`guard-promise-chain: ${v.length} violation(s)——裸 promise 链缺 catch 兜底：`);
  for (const x of v) console.error(`  ${x.file}:${x.line} ${x.snippet}`);
  process.exit(1);
}
