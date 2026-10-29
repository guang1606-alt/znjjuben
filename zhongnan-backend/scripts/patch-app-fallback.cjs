#!/usr/bin/env node
/**
 * v2.324 改 app.js 13 个纯数据常量为 window.ZN_DATA 优先 + 原定义兜底
 * 安全：不删除原定义，用 `||` 兜底；即使 data/constants.js 未加载也能正常跑
 *
 * v2.324.1 修复：findBlocks 改用逐行匹配（与 extract-constants.cjs 一致），
 *              避开多行 RegExp 无 m flag 导致 ^ 只匹配文件开头的坑
 *              处理逻辑改为直接操作 lines[] 数组，更安全
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appPath = path.join(ROOT, 'web/app.js');

const src = fs.readFileSync(appPath, 'utf8');
const lines = src.split('\n');

// 13 个纯数据常量（与 extract-constants.cjs 输出一致）
const NAMES = new Set([
  'HOME_TOOLS', 'X_REGIONS', 'MODE_BRIEF', 'BRAND_UI', 'TREND_UI', 'BRANCH_UI',
  'CRAFT_HOOK_EN', 'NOVEL_LIC_LABEL', 'SELECT_OPTS', 'WORKBENCH_TITLES',
  'DIFF_LEVEL_LABEL', 'QC_ENGINE_LABELS', 'MODEL_GROUPS'
]);

// 逐行匹配找块（与 extract-constants.cjs 逻辑完全一致，不会漏）
function findBlocks(allLines, nameSet) {
  const blocks = [];
  let i = 0;
  while (i < allLines.length) {
    // app.js 顶层常量缩进 2 空格
    const m = allLines[i].match(/^  const ([A-Z][A-Z0-9_]+) = (\{|\[)/);
    if (m) {
      const name = m[1], brace = m[2];
      if (!nameSet.has(name)) { i++; continue; }
      let depth = 0, start = i, end = i;
      for (; i < allLines.length; i++) {
        const l = allLines[i];
        for (const c of l) {
          if (c === brace) depth++;
          else if ((brace === '{' ? '}' : ']') === c) depth--;
        }
        if (depth === 0) { end = i; break; }
      }
      blocks.push({ name, startLine: start, endLine: end });
    }
    i++;
  }
  return blocks;
}

const blocks = findBlocks(lines, NAMES);
console.log(`找到 ${blocks.length} / ${NAMES.size} 个纯数据块`);

// 倒序处理（后面的块先改，前面的块行号不变）
blocks.sort((a, b) => b.startLine - a.startLine);

for (const b of blocks) {
  const firstLine = lines[b.startLine];
  const braceMatch = firstLine.match(/ = ([{[])/);
  if (!braceMatch) { console.log(`⚠ 跳过（无括号）: ${b.name}`); continue; }
  // 原首行去掉 "  const NAME = "，剩下 "{...}" 或 "[..." 起始
  const restFirstLine = firstLine.replace(/^\s*const [A-Z0-9_]+ = /, '');
  // 新首行：ZN_DATA 优先 + 原定义兜底
  const newFirstLine = `  const ${b.name} = (typeof window !== 'undefined' && window.ZN_DATA && window.ZN_DATA.${b.name}) || ${restFirstLine}`;
  lines[b.startLine] = newFirstLine;
  console.log(`✓ ${b.name} (L${b.startLine + 1}-${b.endLine + 1})`);
}

fs.writeFileSync(appPath, lines.join('\n'));
console.log(`\n✓ web/app.js 已更新`);
console.log(`  总行数: ${lines.length}（首行加长，块数: ${blocks.length}）`);
