#!/usr/bin/env node
/**
 * v2.324 从 web/app.js 外提纯数据常量到 web/data/constants.js
 * 纯数据 = 不含 function / => / window. / .push() / 赋值的顶层 const XX = {...}/[...]
 * 生成 IIFE 挂 window.ZN_DATA，app.js 后续用 window.ZN_DATA.XX 替换原值（带兜底）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appPath = path.join(ROOT, 'web/app.js');
const outPath = path.join(ROOT, 'web/data/constants.js');

const src = fs.readFileSync(appPath, 'utf8');
const lines = src.split('\n');

// 1. 先粗筛：所有顶层 const XX = {...} / const XX = [...] 块
const rawBlocks = [];
let i = 0;
while (i < lines.length) {
  const m = lines[i].match(/^  const ([A-Z][A-Z0-9_]+) = (\{|\[)/);
  if (m) {
    const name = m[1], brace = m[2];
    let depth = 0, start = i, end = i;
    for (; i < lines.length; i++) {
      const l = lines[i];
      for (const c of l) {
        if (c === brace) depth++;
        else if ((brace === '{' ? '}' : ']') === c) depth--;
      }
      if (depth === 0) { end = i; break; }
    }
    rawBlocks.push({ name, start, end, size: end - start + 1 });
  }
  i++;
}

// 2. 过滤纯数据：块内不含函数/闭包/赋值/副作用的
const PURE_FORBIDDEN = /\bfunction\b|\(\)\s*=>|window\.|\.push\(|\.splice\(|\.sort\(|\.map\(|\.filter\(|\.forEach\(|\.reduce\(|\.test\(|\.match\(|\.replace\(|\.split\(|\.join\(|\.includes\(|= [a-zA-Z_\$]/;
const pureBlocks = rawBlocks.filter(b => {
  if (b.size <= 3) return false;
  const block = lines.slice(b.start, b.end + 1).join('\n');
  return !PURE_FORBIDDEN.test(block);
});

console.log(`粗筛顶层常量: ${rawBlocks.length} 个 → 纯数据: ${pureBlocks.length} 个 (${pureBlocks.reduce((s, b) => s + b.size, 0)} 行)`);

if (pureBlocks.length === 0) {
  console.log('没有纯数据常量可外提，退出');
  process.exit(0);
}

// 3. 生成 constants.js
const header = `// 终南集 · 纯数据常量（v2.324 从 app.js 外提，IIFE 挂载到 window.ZN_DATA）
// 零构建原生 ES，多个 script 顺序加载；app.js 保留同名 const 作为兜底
(function () {
  'use strict';
  const C = {};
`;

const bodyChunks = pureBlocks.map(b => {
  // 原样拷贝块内容，把 "  const NAME = " 改成 "C.NAME = "
  const blockLines = lines.slice(b.start, b.end + 1);
  blockLines[0] = blockLines[0].replace(/^  const [A-Z][A-Z0-9_]+ = /, `C.${b.name} = `);
  return blockLines.join('\n');
});

const footer = `
  window.ZN_DATA = C;
  // 兼容：把每个常量直接挂 window，让老代码不改也能读
  Object.keys(C).forEach(k => { if (!window[k]) window[k] = C[k]; });
})();
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + bodyChunks.join('\n\n') + footer);
console.log(`✓ 写入: ${path.relative(ROOT, outPath)} (${(header + bodyChunks.join('\n\n') + footer).split('\n').length} 行)`);

// 4. 生成 app.js 替换映射表（输出到 stdout 供后续手动改）
console.log('\n=== app.js 兜底替换映射 ===');
pureBlocks.forEach(b => {
  const firstLine = lines[b.start].trim();
  console.log(`  L${b.start + 1}  ${b.name.padEnd(25,' ')} → const ${b.name} = (window.ZN_DATA && window.ZN_DATA.${b.name}) || <原定义>`);
});
